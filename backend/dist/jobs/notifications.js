"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.notificationJobProcessor = void 0;
exports.sendNotification = sendNotification;
exports.sendBatchNotification = sendBatchNotification;
exports.scheduleNotification = scheduleNotification;
const queues_1 = require("@/queues");
const NotificationService_1 = require("@/services/NotificationService");
const EmailService_1 = require("@/services/EmailService");
const WebPushService_1 = require("@/services/WebPushService");
const logger_1 = __importDefault(require("@/config/logger"));
class NotificationJobProcessor {
    constructor() {
        this.notificationService = new NotificationService_1.NotificationService();
        this.emailService = new EmailService_1.EmailService();
        this.webPushService = new WebPushService_1.WebPushService();
        this.setupProcessors();
    }
    setupProcessors() {
        const sendQueue = queues_1.queueManager.getQueue(queues_1.JobTypes.NOTIFICATION_SEND);
        const scheduleQueue = queues_1.queueManager.getQueue(queues_1.JobTypes.NOTIFICATION_SCHEDULE);
        if (sendQueue) {
            sendQueue.process('single', this.processSingleNotification.bind(this));
            sendQueue.process('batch', this.processBatchNotification.bind(this));
            logger_1.default.info('Notification send job processor initialized');
        }
        if (scheduleQueue) {
            scheduleQueue.process('*', this.processScheduledNotification.bind(this));
            logger_1.default.info('Notification schedule job processor initialized');
        }
    }
    async processSingleNotification(job) {
        const { userId, type, template, data, retryCount = 0 } = job.data;
        try {
            logger_1.default.info('Processing single notification', {
                jobId: job.id,
                userId,
                type,
                template,
            });
            await job.progress(10);
            switch (type) {
                case 'email':
                    await this.emailService.sendTemplateEmail(userId, template, data);
                    break;
                case 'push':
                    await this.webPushService.sendPushNotification(userId, {
                        title: data.title,
                        body: data.message,
                        data: data.payload,
                    });
                    break;
                case 'in-app':
                    await this.notificationService.createInAppNotification(userId, {
                        title: data.title,
                        message: data.message,
                        type: data.notificationType || 'info',
                        data: data.payload,
                    });
                    break;
                case 'sms':
                    await this.notificationService.sendSMS(userId, data.message);
                    break;
                default:
                    throw new Error(`Unsupported notification type: ${type}`);
            }
            await job.progress(100);
            logger_1.default.info('Single notification sent successfully', {
                jobId: job.id,
                userId,
                type,
                template,
            });
        }
        catch (error) {
            logger_1.default.error('Failed to send single notification', {
                jobId: job.id,
                userId,
                type,
                template,
                error: error instanceof Error ? error.message : 'Unknown error',
                retryCount,
            });
            if (retryCount < 3) {
                const delay = Math.pow(2, retryCount) * 60000;
                await queues_1.queueManager.addJob(queues_1.JobTypes.NOTIFICATION_SEND, { ...job.data, retryCount: retryCount + 1 }, { delay, jobId: `retry-${job.id}-${retryCount + 1}` });
            }
            throw error;
        }
    }
    async processBatchNotification(job) {
        const { userIds, template, data, type, batchSize = 50 } = job.data;
        try {
            logger_1.default.info('Processing batch notification', {
                jobId: job.id,
                userCount: userIds.length,
                type,
                template,
                batchSize,
            });
            const totalBatches = Math.ceil(userIds.length / batchSize);
            let processedBatches = 0;
            for (let i = 0; i < userIds.length; i += batchSize) {
                const batchUserIds = userIds.slice(i, i + batchSize);
                const batchJobs = batchUserIds.map(userId => queues_1.queueManager.addJob(queues_1.JobTypes.NOTIFICATION_SEND, {
                    userId,
                    type,
                    template,
                    data,
                    priority: 'normal',
                }, {
                    jobId: `batch-${job.id}-${userId}-${i}`,
                }));
                await Promise.all(batchJobs);
                processedBatches++;
                const progress = Math.round((processedBatches / totalBatches) * 100);
                await job.progress(progress);
                logger_1.default.info('Batch notification progress', {
                    jobId: job.id,
                    processedBatches,
                    totalBatches,
                    progress,
                });
                if (i + batchSize < userIds.length) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
            }
            logger_1.default.info('Batch notification processing completed', {
                jobId: job.id,
                totalUsers: userIds.length,
                totalBatches,
            });
        }
        catch (error) {
            logger_1.default.error('Failed to process batch notification', {
                jobId: job.id,
                userCount: userIds.length,
                type,
                template,
                error: error instanceof Error ? error.message : 'Unknown error',
            });
            throw error;
        }
    }
    async processScheduledNotification(job) {
        const { userId, notificationId, triggerType, triggerData, notificationData } = job.data;
        try {
            logger_1.default.info('Processing scheduled notification', {
                jobId: job.id,
                userId,
                notificationId,
                triggerType,
            });
            const shouldSend = await this.checkTriggerCondition(triggerType, triggerData, userId);
            if (!shouldSend) {
                logger_1.default.info('Trigger condition not met, skipping notification', {
                    jobId: job.id,
                    userId,
                    triggerType,
                });
                return;
            }
            await job.progress(50);
            await queues_1.queueManager.addJob(queues_1.JobTypes.NOTIFICATION_SEND, {
                userId,
                type: 'push',
                template: 'scheduled_notification',
                data: {
                    title: notificationData.title,
                    message: notificationData.message,
                    notificationType: notificationData.type,
                    payload: notificationData.data,
                },
                priority: 'high',
            });
            await job.progress(100);
            logger_1.default.info('Scheduled notification processed successfully', {
                jobId: job.id,
                userId,
                notificationId,
                triggerType,
            });
        }
        catch (error) {
            logger_1.default.error('Failed to process scheduled notification', {
                jobId: job.id,
                userId,
                notificationId,
                triggerType,
                error: error instanceof Error ? error.message : 'Unknown error',
            });
            throw error;
        }
    }
    async checkTriggerCondition(triggerType, triggerData, userId) {
        switch (triggerType) {
            case 'time':
                if (triggerData.scheduledTime) {
                    const now = new Date();
                    const scheduledTime = new Date(triggerData.scheduledTime);
                    return now >= scheduledTime;
                }
                return false;
            case 'location':
                if (triggerData.location) {
                    const userLocation = await this.notificationService.getUserCurrentLocation(userId);
                    if (userLocation) {
                        const distance = this.calculateDistance(userLocation.lat, userLocation.lng, triggerData.location.lat, triggerData.location.lng);
                        return distance <= triggerData.location.radius;
                    }
                }
                return false;
            case 'event':
                return await this.notificationService.checkEventTrigger(userId, triggerData.eventType || '');
            default:
                logger_1.default.warn('Unknown trigger type', { triggerType });
                return false;
        }
    }
    calculateDistance(lat1, lng1, lat2, lng2) {
        const R = 6371000;
        const φ1 = (lat1 * Math.PI) / 180;
        const φ2 = (lat2 * Math.PI) / 180;
        const Δφ = ((lat2 - lat1) * Math.PI) / 180;
        const Δλ = ((lng2 - lng1) * Math.PI) / 180;
        const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }
}
exports.notificationJobProcessor = new NotificationJobProcessor();
async function sendNotification(data, options = {}) {
    const priority = data.priority === 'high' ? 1 : data.priority === 'low' ? 10 : 5;
    const jobOptions = {
        priority,
        ...options,
    };
    if (data.scheduleAt) {
        jobOptions.delay = data.scheduleAt.getTime() - Date.now();
    }
    return queues_1.queueManager.addJob(queues_1.JobTypes.NOTIFICATION_SEND, data, jobOptions);
}
async function sendBatchNotification(data, options = {}) {
    return queues_1.queueManager.addJob(queues_1.JobTypes.NOTIFICATION_SEND, data, {
        jobId: `batch-${Date.now()}`,
        ...options,
    });
}
async function scheduleNotification(data, cronPattern) {
    if (cronPattern) {
        return queues_1.queueManager.scheduleJob(queues_1.JobTypes.NOTIFICATION_SCHEDULE, cronPattern, data);
    }
    else {
        return queues_1.queueManager.addJob(queues_1.JobTypes.NOTIFICATION_SCHEDULE, data);
    }
}
//# sourceMappingURL=notifications.js.map