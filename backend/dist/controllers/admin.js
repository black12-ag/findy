"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminController = void 0;
const jobs_1 = require("@/jobs");
const error_1 = require("@/utils/error");
const logger_1 = __importDefault(require("@/config/logger"));
class AdminController {
    async getJobSystemHealth(_req, res) {
        try {
            const health = await (0, jobs_1.checkJobSystemHealth)();
            res.json({
                success: true,
                data: health,
            });
        }
        catch (error) {
            logger_1.default.error('Failed to get job system health', {
                error: error instanceof Error ? error.message : 'Unknown error',
            });
            throw new error_1.AppError('Failed to get job system health', 500);
        }
    }
    async getQueueStats(_req, res) {
        try {
            const stats = await jobs_1.JobUtils.getQueueStats();
            res.json({
                success: true,
                data: stats,
            });
        }
        catch (error) {
            logger_1.default.error('Failed to get queue stats', {
                error: error instanceof Error ? error.message : 'Unknown error',
            });
            throw new error_1.AppError('Failed to get queue statistics', 500);
        }
    }
    async pauseQueue(req, res) {
        try {
            const { queueType } = req.params;
            if (!Object.values(jobs_1.JobTypes).includes(queueType)) {
                throw new error_1.AppError('Invalid queue type', 400);
            }
            await jobs_1.JobUtils.pauseQueue(queueType);
            res.json({
                success: true,
                message: `Queue ${queueType} paused successfully`,
            });
        }
        catch (error) {
            if (error instanceof error_1.AppError)
                throw error;
            logger_1.default.error('Failed to pause queue', {
                queueType: req.params['queueType'],
                error: error instanceof Error ? error.message : 'Unknown error',
            });
            throw new error_1.AppError('Failed to pause queue', 500);
        }
    }
    async resumeQueue(req, res) {
        try {
            const { queueType } = req.params;
            if (!Object.values(jobs_1.JobTypes).includes(queueType)) {
                throw new error_1.AppError('Invalid queue type', 400);
            }
            await jobs_1.JobUtils.resumeQueue(queueType);
            res.json({
                success: true,
                message: `Queue ${queueType} resumed successfully`,
            });
        }
        catch (error) {
            if (error instanceof error_1.AppError)
                throw error;
            logger_1.default.error('Failed to resume queue', {
                queueType: req.params['queueType'],
                error: error instanceof Error ? error.message : 'Unknown error',
            });
            throw new error_1.AppError('Failed to resume queue', 500);
        }
    }
    async scheduleJob(req, res) {
        try {
            const { jobType, data, delay = 0 } = req.body;
            if (!Object.values(jobs_1.JobTypes).includes(jobType)) {
                throw new error_1.AppError('Invalid job type', 400);
            }
            if (!data) {
                throw new error_1.AppError('Job data is required', 400);
            }
            await jobs_1.JobUtils.scheduleOneTimeJob(jobType, data, delay);
            res.json({
                success: true,
                message: 'Job scheduled successfully',
                data: {
                    jobType,
                    delay,
                },
            });
        }
        catch (error) {
            if (error instanceof error_1.AppError)
                throw error;
            logger_1.default.error('Failed to schedule job', {
                jobType: req.body.jobType,
                error: error instanceof Error ? error.message : 'Unknown error',
            });
            throw new error_1.AppError('Failed to schedule job', 500);
        }
    }
    async scheduleRecurringJob(req, res) {
        try {
            const { jobType, cronPattern, data, name } = req.body;
            if (!Object.values(jobs_1.JobTypes).includes(jobType)) {
                throw new error_1.AppError('Invalid job type', 400);
            }
            if (!cronPattern || !data || !name) {
                throw new error_1.AppError('Job type, cron pattern, data, and name are required', 400);
            }
            await jobs_1.JobUtils.scheduleRecurringJob(jobType, cronPattern, data, name);
            res.json({
                success: true,
                message: 'Recurring job scheduled successfully',
                data: {
                    jobType,
                    cronPattern,
                    name,
                },
            });
        }
        catch (error) {
            if (error instanceof error_1.AppError)
                throw error;
            logger_1.default.error('Failed to schedule recurring job', {
                jobType: req.body.jobType,
                name: req.body.name,
                error: error instanceof Error ? error.message : 'Unknown error',
            });
            throw new error_1.AppError('Failed to schedule recurring job', 500);
        }
    }
    async stopRecurringJob(req, res) {
        try {
            const { name } = req.params;
            if (!name) {
                throw new error_1.AppError('Job name is required', 400);
            }
            const stopped = jobs_1.JobUtils.stopRecurringJob(name);
            if (!stopped) {
                throw new error_1.AppError('Recurring job not found', 404);
            }
            res.json({
                success: true,
                message: `Recurring job '${name}' stopped successfully`,
            });
        }
        catch (error) {
            if (error instanceof error_1.AppError)
                throw error;
            logger_1.default.error('Failed to stop recurring job', {
                name: req.params['name'],
                error: error instanceof Error ? error.message : 'Unknown error',
            });
            throw new error_1.AppError('Failed to stop recurring job', 500);
        }
    }
    async triggerCleanup(req, res) {
        try {
            const { type = 'sessions', maxAge, batchSize = 1000, dryRun = false } = req.body;
            const validTypes = ['sessions', 'locations', 'cache', 'logs', 'temp_files', 'expired_tokens', 'old_analytics'];
            if (!validTypes.includes(type)) {
                throw new error_1.AppError(`Invalid cleanup type. Valid types: ${validTypes.join(', ')}`, 400);
            }
            await jobs_1.JobUtils.scheduleCleanup({
                type,
                maxAge,
                batchSize,
                dryRun,
            });
            res.json({
                success: true,
                message: `Cleanup job for ${type} scheduled successfully`,
                data: {
                    type,
                    maxAge,
                    batchSize,
                    dryRun,
                },
            });
        }
        catch (error) {
            if (error instanceof error_1.AppError)
                throw error;
            logger_1.default.error('Failed to trigger cleanup', {
                type: req.body.type,
                error: error instanceof Error ? error.message : 'Unknown error',
            });
            throw new error_1.AppError('Failed to trigger cleanup', 500);
        }
    }
    async triggerAnalytics(req, res) {
        try {
            const { type = 'daily_summary', userId, dateRange, includeComparison = false, sendReport = false, reportFormat = 'in-app' } = req.body;
            const validTypes = ['daily_summary', 'weekly_report', 'monthly_report', 'user_behavior', 'route_analytics', 'location_patterns'];
            if (!validTypes.includes(type)) {
                throw new error_1.AppError(`Invalid analytics type. Valid types: ${validTypes.join(', ')}`, 400);
            }
            const defaultDateRange = {
                startDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
                endDate: new Date(),
            };
            await jobs_1.JobUtils.processAnalytics({
                type,
                userId,
                dateRange: dateRange || defaultDateRange,
                includeComparison,
                sendReport,
                reportFormat,
            });
            res.json({
                success: true,
                message: `Analytics processing for ${type} scheduled successfully`,
                data: {
                    type,
                    userId,
                    dateRange: dateRange || defaultDateRange,
                    includeComparison,
                    sendReport,
                    reportFormat,
                },
            });
        }
        catch (error) {
            if (error instanceof error_1.AppError)
                throw error;
            logger_1.default.error('Failed to trigger analytics', {
                type: req.body.type,
                userId: req.body.userId,
                error: error instanceof Error ? error.message : 'Unknown error',
            });
            throw new error_1.AppError('Failed to trigger analytics processing', 500);
        }
    }
    async sendNotification(req, res) {
        try {
            const { userId, type = 'in-app', template, data, priority = 'normal', scheduleAt } = req.body;
            if (!userId || !template || !data) {
                throw new error_1.AppError('User ID, template, and data are required', 400);
            }
            const validTypes = ['email', 'push', 'in-app', 'sms'];
            if (!validTypes.includes(type)) {
                throw new error_1.AppError(`Invalid notification type. Valid types: ${validTypes.join(', ')}`, 400);
            }
            const notificationData = {
                userId,
                type,
                template,
                data,
                priority,
                ...(scheduleAt && { scheduleAt: new Date(scheduleAt) })
            };
            await jobs_1.JobUtils.sendNotification(notificationData);
            res.json({
                success: true,
                message: 'Notification scheduled successfully',
                data: {
                    userId,
                    type,
                    template,
                    priority,
                    scheduleAt,
                },
            });
        }
        catch (error) {
            if (error instanceof error_1.AppError)
                throw error;
            logger_1.default.error('Failed to send notification', {
                userId: req.body.userId,
                type: req.body.type,
                template: req.body.template,
                error: error instanceof Error ? error.message : 'Unknown error',
            });
            throw new error_1.AppError('Failed to schedule notification', 500);
        }
    }
    async getJobTypes(_req, res) {
        try {
            const jobTypes = Object.values(jobs_1.JobTypes);
            res.json({
                success: true,
                data: {
                    jobTypes,
                    descriptions: {
                        [jobs_1.JobTypes.ROUTE_OPTIMIZATION]: 'Optimize route waypoint order and find alternatives',
                        [jobs_1.JobTypes.NOTIFICATION_SEND]: 'Send notifications to users',
                        [jobs_1.JobTypes.NOTIFICATION_SCHEDULE]: 'Schedule notifications based on triggers',
                        [jobs_1.JobTypes.DATA_CLEANUP]: 'Clean up old data and expired records',
                        [jobs_1.JobTypes.ANALYTICS_PROCESS]: 'Process analytics data and generate reports',
                        [jobs_1.JobTypes.USER_ANALYTICS]: 'Track user events and update statistics',
                        [jobs_1.JobTypes.LOCATION_CLEANUP]: 'Clean up old location data',
                        [jobs_1.JobTypes.SESSION_CLEANUP]: 'Clean up expired sessions',
                        [jobs_1.JobTypes.EMAIL_SEND]: 'Send email notifications',
                        [jobs_1.JobTypes.CACHE_WARM]: 'Warm up cache with frequently accessed data',
                        [jobs_1.JobTypes.BACKUP_DATABASE]: 'Create database backups',
                    },
                },
            });
        }
        catch (error) {
            logger_1.default.error('Failed to get job types', {
                error: error instanceof Error ? error.message : 'Unknown error',
            });
            throw new error_1.AppError('Failed to get job types', 500);
        }
    }
}
exports.AdminController = AdminController;
//# sourceMappingURL=admin.js.map