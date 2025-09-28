"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.jobScheduler = exports.JobScheduler = void 0;
const node_cron_1 = __importDefault(require("node-cron"));
const queues_1 = require("@/queues");
const logger_1 = __importDefault(require("@/config/logger"));
const dataCleanup_1 = require("./dataCleanup");
const analytics_1 = require("./analytics");
class JobScheduler {
    constructor() {
        this.isInitialized = false;
        this.scheduledJobs = new Map();
        this.setupGracefulShutdown();
    }
    async initialize() {
        if (this.isInitialized) {
            logger_1.default.warn('Job scheduler already initialized');
            return;
        }
        try {
            logger_1.default.info('Initializing job scheduler...');
            logger_1.default.info('Job processors initialized');
            await this.scheduleCleanupJobs();
            await this.scheduleAnalyticsJobs();
            await this.scheduleMonitoringJobs();
            await this.scheduleMaintenanceJobs();
            this.isInitialized = true;
            logger_1.default.info('Job scheduler initialized successfully');
        }
        catch (error) {
            logger_1.default.error('Failed to initialize job scheduler', {
                error: error instanceof Error ? error.message : 'Unknown error',
            });
            throw error;
        }
    }
    async scheduleCleanupJobs() {
        try {
            await (0, dataCleanup_1.scheduleRegularCleanups)();
            logger_1.default.info('Cleanup jobs scheduled');
        }
        catch (error) {
            logger_1.default.error('Failed to schedule cleanup jobs', {
                error: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    }
    async scheduleAnalyticsJobs() {
        try {
            await (0, analytics_1.scheduleRegularAnalytics)();
            logger_1.default.info('Analytics jobs scheduled');
        }
        catch (error) {
            logger_1.default.error('Failed to schedule analytics jobs', {
                error: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    }
    async scheduleMonitoringJobs() {
        try {
            const healthCheckTask = node_cron_1.default.schedule('*/5 * * * *', async () => {
                try {
                    const stats = await queues_1.queueManager.getAllQueueStats();
                    logger_1.default.info('Queue health check', { stats });
                    Object.entries(stats).forEach(([queueName, queueStats]) => {
                        if (typeof queueStats === 'object' && queueStats.failed > 10) {
                            logger_1.default.warn(`High failure rate in queue: ${queueName}`, {
                                failed: queueStats.failed,
                                waiting: queueStats.waiting,
                                active: queueStats.active,
                            });
                        }
                        if (typeof queueStats === 'object' && queueStats.active > 100) {
                            logger_1.default.warn(`High active job count in queue: ${queueName}`, {
                                active: queueStats.active,
                            });
                        }
                    });
                }
                catch (error) {
                    logger_1.default.error('Queue health check failed', {
                        error: error instanceof Error ? error.message : 'Unknown error',
                    });
                }
            }, {
                scheduled: false,
            });
            healthCheckTask.start();
            this.scheduledJobs.set('health_check', healthCheckTask);
            const performanceTask = node_cron_1.default.schedule('0 * * * *', async () => {
                try {
                    await queues_1.queueManager.addJob(queues_1.JobTypes.ANALYTICS_PROCESS, {
                        type: 'daily_summary',
                        dateRange: {
                            startDate: new Date(Date.now() - 60 * 60 * 1000),
                            endDate: new Date(),
                        },
                    });
                }
                catch (error) {
                    logger_1.default.error('Performance monitoring job failed', {
                        error: error instanceof Error ? error.message : 'Unknown error',
                    });
                }
            }, {
                scheduled: false,
            });
            performanceTask.start();
            this.scheduledJobs.set('performance_monitoring', performanceTask);
            logger_1.default.info('Monitoring jobs scheduled');
        }
        catch (error) {
            logger_1.default.error('Failed to schedule monitoring jobs', {
                error: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    }
    async scheduleMaintenanceJobs() {
        try {
            const dbMaintenanceTask = node_cron_1.default.schedule('0 2 * * 0', async () => {
                try {
                    logger_1.default.info('Starting database maintenance');
                    for (const jobType of Object.values(queues_1.JobTypes)) {
                        try {
                            await queues_1.queueManager.cleanCompletedJobs(jobType, 7 * 24 * 60 * 60 * 1000);
                        }
                        catch (error) {
                            logger_1.default.error(`Failed to clean jobs for ${jobType}`, {
                                error: error instanceof Error ? error.message : 'Unknown error',
                            });
                        }
                    }
                    await queues_1.queueManager.addJob(queues_1.JobTypes.BACKUP_DATABASE, {
                        type: 'full_backup',
                        retention: 30,
                    });
                    logger_1.default.info('Database maintenance completed');
                }
                catch (error) {
                    logger_1.default.error('Database maintenance failed', {
                        error: error instanceof Error ? error.message : 'Unknown error',
                    });
                }
            }, {
                scheduled: false,
            });
            dbMaintenanceTask.start();
            this.scheduledJobs.set('db_maintenance', dbMaintenanceTask);
            const cacheWarmingTask = node_cron_1.default.schedule('0 5 * * *', async () => {
                try {
                    await queues_1.queueManager.addJob(queues_1.JobTypes.CACHE_WARM, {
                        type: 'popular_places',
                        limit: 100,
                    });
                    await queues_1.queueManager.addJob(queues_1.JobTypes.CACHE_WARM, {
                        type: 'user_preferences',
                        activeUsersOnly: true,
                    });
                    logger_1.default.info('Cache warming jobs scheduled');
                }
                catch (error) {
                    logger_1.default.error('Cache warming scheduling failed', {
                        error: error instanceof Error ? error.message : 'Unknown error',
                    });
                }
            }, {
                scheduled: false,
            });
            cacheWarmingTask.start();
            this.scheduledJobs.set('cache_warming', cacheWarmingTask);
            logger_1.default.info('Maintenance jobs scheduled');
        }
        catch (error) {
            logger_1.default.error('Failed to schedule maintenance jobs', {
                error: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    }
    async scheduleOneTimeJob(jobType, data, delay = 0) {
        try {
            await queues_1.queueManager.addJob(jobType, data, {
                delay,
                jobId: `onetime-${Date.now()}-${Math.random()}`,
            });
            logger_1.default.info('One-time job scheduled', {
                jobType,
                delay,
                data,
            });
        }
        catch (error) {
            logger_1.default.error('Failed to schedule one-time job', {
                jobType,
                error: error instanceof Error ? error.message : 'Unknown error',
            });
            throw error;
        }
    }
    async scheduleRecurringJob(jobType, cronPattern, data, name) {
        try {
            const existingJob = this.scheduledJobs.get(name);
            if (existingJob) {
                existingJob.stop();
                this.scheduledJobs.delete(name);
            }
            const task = node_cron_1.default.schedule(cronPattern, async () => {
                try {
                    await queues_1.queueManager.addJob(jobType, data);
                    logger_1.default.debug(`Recurring job executed: ${name}`);
                }
                catch (error) {
                    logger_1.default.error(`Recurring job failed: ${name}`, {
                        error: error instanceof Error ? error.message : 'Unknown error',
                    });
                }
            }, {
                scheduled: false,
            });
            task.start();
            this.scheduledJobs.set(name, task);
            logger_1.default.info('Recurring job scheduled', {
                name,
                jobType,
                cronPattern,
            });
        }
        catch (error) {
            logger_1.default.error('Failed to schedule recurring job', {
                name,
                jobType,
                cronPattern,
                error: error instanceof Error ? error.message : 'Unknown error',
            });
            throw error;
        }
    }
    stopRecurringJob(name) {
        const job = this.scheduledJobs.get(name);
        if (job) {
            job.stop();
            this.scheduledJobs.delete(name);
            logger_1.default.info(`Recurring job stopped: ${name}`);
            return true;
        }
        return false;
    }
    async getQueueStats() {
        try {
            return await queues_1.queueManager.getAllQueueStats();
        }
        catch (error) {
            logger_1.default.error('Failed to get queue stats', {
                error: error instanceof Error ? error.message : 'Unknown error',
            });
            throw error;
        }
    }
    async pauseQueue(jobType) {
        try {
            await queues_1.queueManager.pauseQueue(jobType);
            logger_1.default.info(`Queue paused: ${jobType}`);
        }
        catch (error) {
            logger_1.default.error(`Failed to pause queue: ${jobType}`, {
                error: error instanceof Error ? error.message : 'Unknown error',
            });
            throw error;
        }
    }
    async resumeQueue(jobType) {
        try {
            await queues_1.queueManager.resumeQueue(jobType);
            logger_1.default.info(`Queue resumed: ${jobType}`);
        }
        catch (error) {
            logger_1.default.error(`Failed to resume queue: ${jobType}`, {
                error: error instanceof Error ? error.message : 'Unknown error',
            });
            throw error;
        }
    }
    async shutdown() {
        if (!this.isInitialized) {
            return;
        }
        logger_1.default.info('Shutting down job scheduler...');
        try {
            for (const [name, job] of this.scheduledJobs.entries()) {
                try {
                    job.stop();
                    logger_1.default.info(`Stopped cron job: ${name}`);
                }
                catch (error) {
                    logger_1.default.error(`Failed to stop cron job: ${name}`, {
                        error: error instanceof Error ? error.message : 'Unknown error',
                    });
                }
            }
            this.scheduledJobs.clear();
            await queues_1.queueManager.close();
            this.isInitialized = false;
            logger_1.default.info('Job scheduler shut down successfully');
        }
        catch (error) {
            logger_1.default.error('Error during job scheduler shutdown', {
                error: error instanceof Error ? error.message : 'Unknown error',
            });
            throw error;
        }
    }
    setupGracefulShutdown() {
        process.on('SIGTERM', async () => {
            logger_1.default.info('Received SIGTERM, shutting down gracefully...');
            try {
                await this.shutdown();
                process.exit(0);
            }
            catch (error) {
                logger_1.default.error('Error during graceful shutdown', {
                    error: error instanceof Error ? error.message : 'Unknown error',
                });
                process.exit(1);
            }
        });
        process.on('SIGINT', async () => {
            logger_1.default.info('Received SIGINT, shutting down gracefully...');
            try {
                await this.shutdown();
                process.exit(0);
            }
            catch (error) {
                logger_1.default.error('Error during graceful shutdown', {
                    error: error instanceof Error ? error.message : 'Unknown error',
                });
                process.exit(1);
            }
        });
    }
    async healthCheck() {
        try {
            const queueStats = await this.getQueueStats();
            const scheduledJobNames = Array.from(this.scheduledJobs.keys());
            let status = 'healthy';
            const hasHighFailureRate = Object.values(queueStats).some(stats => typeof stats === 'object' && stats.failed > 50);
            const hasStuckJobs = Object.values(queueStats).some(stats => typeof stats === 'object' && stats.active > 200);
            if (hasHighFailureRate || hasStuckJobs) {
                status = 'unhealthy';
            }
            else if (Object.values(queueStats).some(stats => typeof stats === 'object' && (stats.failed > 10 || stats.active > 100))) {
                status = 'degraded';
            }
            return {
                status,
                queues: queueStats,
                scheduledJobs: scheduledJobNames,
            };
        }
        catch (error) {
            logger_1.default.error('Health check failed', {
                error: error instanceof Error ? error.message : 'Unknown error',
            });
            return {
                status: 'unhealthy',
                queues: {},
                scheduledJobs: [],
            };
        }
    }
}
exports.JobScheduler = JobScheduler;
exports.jobScheduler = new JobScheduler();
//# sourceMappingURL=scheduler.js.map