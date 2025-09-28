"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CLEANUP_INTERVALS = exports.JOB_RETRY_DELAYS = exports.JOB_PRIORITIES = exports.JobUtils = void 0;
exports.initializeJobSystem = initializeJobSystem;
exports.shutdownJobSystem = shutdownJobSystem;
exports.checkJobSystemHealth = checkJobSystemHealth;
__exportStar(require("@/queues"), exports);
__exportStar(require("./routeOptimization"), exports);
__exportStar(require("./notifications"), exports);
__exportStar(require("./dataCleanup"), exports);
__exportStar(require("./analytics"), exports);
__exportStar(require("./scheduler"), exports);
const scheduler_1 = require("./scheduler");
const queues_1 = require("@/queues");
const logger_1 = __importDefault(require("@/config/logger"));
async function initializeJobSystem() {
    try {
        logger_1.default.info('Initializing job system...');
        await scheduler_1.jobScheduler.initialize();
        logger_1.default.info('Job system initialized successfully');
    }
    catch (error) {
        logger_1.default.error('Failed to initialize job system', {
            error: error instanceof Error ? error.message : 'Unknown error',
        });
        throw error;
    }
}
async function shutdownJobSystem() {
    try {
        logger_1.default.info('Shutting down job system...');
        await scheduler_1.jobScheduler.shutdown();
        logger_1.default.info('Job system shut down successfully');
    }
    catch (error) {
        logger_1.default.error('Failed to shutdown job system', {
            error: error instanceof Error ? error.message : 'Unknown error',
        });
        throw error;
    }
}
async function checkJobSystemHealth() {
    try {
        const health = await scheduler_1.jobScheduler.healthCheck();
        return {
            status: health.status,
            details: {
                queues: health.queues,
                scheduledJobs: health.scheduledJobs,
                timestamp: new Date().toISOString(),
            },
        };
    }
    catch (error) {
        logger_1.default.error('Job system health check failed', {
            error: error instanceof Error ? error.message : 'Unknown error',
        });
        return {
            status: 'unhealthy',
            details: {
                error: error instanceof Error ? error.message : 'Unknown error',
                timestamp: new Date().toISOString(),
            },
        };
    }
}
exports.JobUtils = {
    async optimizeRoute(routeData) {
        return queues_1.queueManager.addJob(queues_1.JobTypes.ROUTE_OPTIMIZATION, routeData);
    },
    async sendNotification(notificationData) {
        return queues_1.queueManager.addJob(queues_1.JobTypes.NOTIFICATION_SEND, notificationData);
    },
    async trackUserEvent(eventData) {
        return queues_1.queueManager.addJob(queues_1.JobTypes.USER_ANALYTICS, eventData);
    },
    async scheduleCleanup(cleanupData) {
        return queues_1.queueManager.addJob(queues_1.JobTypes.DATA_CLEANUP, cleanupData);
    },
    async processAnalytics(analyticsData) {
        return queues_1.queueManager.addJob(queues_1.JobTypes.ANALYTICS_PROCESS, analyticsData);
    },
    async getQueueStats() {
        return queues_1.queueManager.getAllQueueStats();
    },
    async pauseQueue(jobType) {
        return queues_1.queueManager.pauseQueue(jobType);
    },
    async resumeQueue(jobType) {
        return queues_1.queueManager.resumeQueue(jobType);
    },
    async scheduleOneTimeJob(jobType, data, delay = 0) {
        return scheduler_1.jobScheduler.scheduleOneTimeJob(jobType, data, delay);
    },
    async scheduleRecurringJob(jobType, cronPattern, data, name) {
        return scheduler_1.jobScheduler.scheduleRecurringJob(jobType, cronPattern, data, name);
    },
    stopRecurringJob(name) {
        return scheduler_1.jobScheduler.stopRecurringJob(name);
    },
};
exports.JOB_PRIORITIES = {
    HIGH: 1,
    NORMAL: 5,
    LOW: 10,
};
exports.JOB_RETRY_DELAYS = {
    IMMEDIATE: 0,
    SHORT: 30000,
    MEDIUM: 300000,
    LONG: 3600000,
};
exports.CLEANUP_INTERVALS = {
    SESSIONS: 7 * 24 * 60 * 60 * 1000,
    LOCATIONS: 30 * 24 * 60 * 60 * 1000,
    CACHE: 24 * 60 * 60 * 1000,
    LOGS: 7 * 24 * 60 * 60 * 1000,
    TEMP_FILES: 24 * 60 * 60 * 1000,
    ANALYTICS: 90 * 24 * 60 * 60 * 1000,
};
//# sourceMappingURL=index.js.map