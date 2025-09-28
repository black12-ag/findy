"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.queueManager = exports.QueueManager = exports.JobTypes = void 0;
const bull_1 = __importDefault(require("bull"));
const redis_1 = require("@/config/redis");
const logger_1 = __importDefault(require("@/config/logger"));
var JobTypes;
(function (JobTypes) {
    JobTypes["ROUTE_OPTIMIZATION"] = "route:optimization";
    JobTypes["NOTIFICATION_SEND"] = "notification:send";
    JobTypes["NOTIFICATION_SCHEDULE"] = "notification:schedule";
    JobTypes["DATA_CLEANUP"] = "data:cleanup";
    JobTypes["ANALYTICS_PROCESS"] = "analytics:process";
    JobTypes["USER_ANALYTICS"] = "user:analytics";
    JobTypes["LOCATION_CLEANUP"] = "location:cleanup";
    JobTypes["SESSION_CLEANUP"] = "session:cleanup";
    JobTypes["EMAIL_SEND"] = "email:send";
    JobTypes["CACHE_WARM"] = "cache:warm";
    JobTypes["BACKUP_DATABASE"] = "backup:database";
})(JobTypes || (exports.JobTypes = JobTypes = {}));
const queueConfigs = {
    [JobTypes.ROUTE_OPTIMIZATION]: {
        priority: 'high',
        attempts: 3,
        delay: 0,
        removeOnComplete: 50,
        removeOnFail: 20,
    },
    [JobTypes.NOTIFICATION_SEND]: {
        priority: 'high',
        attempts: 5,
        delay: 0,
        removeOnComplete: 100,
        removeOnFail: 50,
    },
    [JobTypes.NOTIFICATION_SCHEDULE]: {
        priority: 'normal',
        attempts: 3,
        delay: 0,
        removeOnComplete: 100,
        removeOnFail: 20,
    },
    [JobTypes.DATA_CLEANUP]: {
        priority: 'low',
        attempts: 2,
        delay: 0,
        removeOnComplete: 10,
        removeOnFail: 5,
    },
    [JobTypes.ANALYTICS_PROCESS]: {
        priority: 'normal',
        attempts: 3,
        delay: 0,
        removeOnComplete: 50,
        removeOnFail: 20,
    },
    [JobTypes.USER_ANALYTICS]: {
        priority: 'normal',
        attempts: 3,
        delay: 0,
        removeOnComplete: 50,
        removeOnFail: 20,
    },
    [JobTypes.LOCATION_CLEANUP]: {
        priority: 'low',
        attempts: 2,
        delay: 0,
        removeOnComplete: 10,
        removeOnFail: 5,
    },
    [JobTypes.SESSION_CLEANUP]: {
        priority: 'low',
        attempts: 2,
        delay: 0,
        removeOnComplete: 10,
        removeOnFail: 5,
    },
    [JobTypes.EMAIL_SEND]: {
        priority: 'normal',
        attempts: 5,
        delay: 0,
        removeOnComplete: 100,
        removeOnFail: 50,
    },
    [JobTypes.CACHE_WARM]: {
        priority: 'low',
        attempts: 2,
        delay: 0,
        removeOnComplete: 5,
        removeOnFail: 2,
    },
    [JobTypes.BACKUP_DATABASE]: {
        priority: 'low',
        attempts: 2,
        delay: 0,
        removeOnComplete: 3,
        removeOnFail: 3,
    },
};
class QueueManager {
    constructor() {
        this.queues = new Map();
        this.redisClient = (0, redis_1.getRedisClient)();
        this.initializeQueues();
        this.setupEventHandlers();
    }
    initializeQueues() {
        Object.values(JobTypes).forEach(jobType => {
            try {
                const queue = new bull_1.default(jobType, {
                    redis: process.env.REDIS_URL || {
                        host: process.env.REDIS_HOST || 'localhost',
                        port: parseInt(process.env.REDIS_PORT || '6379'),
                        password: process.env.REDIS_PASSWORD,
                    },
                    defaultJobOptions: {
                        removeOnComplete: queueConfigs[jobType]?.removeOnComplete || 10,
                        removeOnFail: queueConfigs[jobType]?.removeOnFail || 5,
                        attempts: queueConfigs[jobType]?.attempts || 3,
                        backoff: {
                            type: 'exponential',
                            delay: 2000,
                        },
                    },
                });
                this.queues.set(jobType, queue);
                logger_1.default.info(`Queue initialized: ${jobType}`);
            }
            catch (error) {
                logger_1.default.error(`Failed to initialize queue: ${jobType}`, {
                    error: error instanceof Error ? error.message : 'Unknown error',
                });
            }
        });
    }
    setupEventHandlers() {
        this.queues.forEach((queue, jobType) => {
            queue.on('completed', (job) => {
                logger_1.default.info(`Job completed: ${jobType}`, {
                    jobId: job.id,
                    data: job.data,
                    duration: Date.now() - job.timestamp,
                });
            });
            queue.on('failed', (job, err) => {
                logger_1.default.error(`Job failed: ${jobType}`, {
                    jobId: job.id,
                    error: err.message,
                    data: job.data,
                    attempts: job.attemptsMade,
                });
            });
            queue.on('stalled', (job) => {
                logger_1.default.warn(`Job stalled: ${jobType}`, {
                    jobId: job.id,
                    data: job.data,
                });
            });
            queue.on('error', (error) => {
                logger_1.default.error(`Queue error: ${jobType}`, { error });
            });
        });
    }
    async addJob(jobType, data, options = {}) {
        const queue = this.queues.get(jobType);
        if (!queue) {
            throw new Error(`Queue not found for job type: ${jobType}`);
        }
        const job = await queue.add(data, {
            ...queueConfigs[jobType],
            ...options,
        });
        logger_1.default.info(`Job added to queue: ${jobType}`, {
            jobId: job.id,
            data,
            options,
        });
        return job;
    }
    async scheduleJob(jobType, cronPattern, data = {}) {
        const queue = this.queues.get(jobType);
        if (!queue) {
            throw new Error(`Queue not found for job type: ${jobType}`);
        }
        const job = await queue.add(data, {
            repeat: { cron: cronPattern },
            ...queueConfigs[jobType],
        });
        logger_1.default.info(`Scheduled job: ${jobType}`, {
            jobId: job.id,
            cronPattern,
            data,
        });
        return job;
    }
    async getQueueStats(jobType) {
        const queue = this.queues.get(jobType);
        if (!queue) {
            throw new Error(`Queue not found for job type: ${jobType}`);
        }
        const [waiting, active, completed, failed, delayed] = await Promise.all([
            queue.getWaiting(),
            queue.getActive(),
            queue.getCompleted(),
            queue.getFailed(),
            queue.getDelayed(),
        ]);
        return {
            waiting: waiting.length,
            active: active.length,
            completed: completed.length,
            failed: failed.length,
            delayed: delayed.length,
        };
    }
    async getAllQueueStats() {
        const stats = {};
        for (const [jobType] of this.queues.entries()) {
            try {
                stats[jobType] = await this.getQueueStats(jobType);
            }
            catch (error) {
                logger_1.default.error(`Error getting stats for queue: ${jobType}`, { error });
                stats[jobType] = { error: error instanceof Error ? error.message : 'Unknown error' };
            }
        }
        return stats;
    }
    async cleanCompletedJobs(jobType, maxAge = 24 * 60 * 60 * 1000) {
        const queue = this.queues.get(jobType);
        if (!queue) {
            throw new Error(`Queue not found for job type: ${jobType}`);
        }
        await queue.clean(maxAge, 'completed');
        await queue.clean(maxAge, 'failed');
        logger_1.default.info(`Cleaned old jobs for queue: ${jobType}`, { maxAge });
    }
    getQueue(jobType) {
        return this.queues.get(jobType);
    }
    async close() {
        const closePromises = Array.from(this.queues.values()).map(queue => queue.close());
        await Promise.all(closePromises);
        logger_1.default.info('All queues closed');
    }
    async pauseQueue(jobType) {
        const queue = this.queues.get(jobType);
        if (queue) {
            await queue.pause();
            logger_1.default.info(`Queue paused: ${jobType}`);
        }
    }
    async resumeQueue(jobType) {
        const queue = this.queues.get(jobType);
        if (queue) {
            await queue.resume();
            logger_1.default.info(`Queue resumed: ${jobType}`);
        }
    }
}
exports.QueueManager = QueueManager;
exports.queueManager = new QueueManager();
//# sourceMappingURL=index.js.map