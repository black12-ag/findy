"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationService = void 0;
const logger_1 = require("@/config/logger");
const database_1 = require("@/config/database");
const EmailService_1 = require("./EmailService");
const WebPushService_1 = require("./WebPushService");
const error_1 = require("@/utils/error");
class NotificationService {
    constructor() {
        this.emailService = new EmailService_1.EmailService();
        this.webPushService = new WebPushService_1.WebPushService();
    }
    async sendNotification(userId, payload, preferences = {}) {
        try {
            const user = await database_1.prisma.user.findUnique({
                where: { id: userId },
                include: { preferences: true }
            });
            if (!user) {
                throw new error_1.AppError('User not found', 404);
            }
            const userPrefs = user.preferences;
            const defaultPrefs = {
                email: true,
                push: true,
                sms: false,
                inApp: true,
            };
            const finalPrefs = { ...defaultPrefs, ...preferences };
            if (finalPrefs.push) {
                try {
                    await this.webPushService.sendNotification(userId, {
                        title: payload.title,
                        body: payload.message,
                        data: payload.data,
                    });
                }
                catch (error) {
                    logger_1.logger.warn('Failed to send push notification', {
                        userId,
                        error: error instanceof Error ? error.message : 'Unknown error',
                    });
                }
            }
            if (finalPrefs.email) {
                try {
                    await this.emailService.sendEmail({
                        to: user.email,
                        subject: payload.title,
                        template: 'notification',
                        data: {
                            title: payload.title,
                            message: payload.message,
                            type: payload.type || 'info',
                            data: payload.data,
                        },
                    });
                }
                catch (error) {
                    logger_1.logger.warn('Failed to send email notification', {
                        userId,
                        error: error instanceof Error ? error.message : 'Unknown error',
                    });
                }
            }
            if (finalPrefs.sms && user.phoneNumber) {
                try {
                    await this.sendSMS(user.phoneNumber, payload.message);
                }
                catch (error) {
                    logger_1.logger.warn('Failed to send SMS notification', {
                        userId,
                        error: error instanceof Error ? error.message : 'Unknown error',
                    });
                }
            }
            if (finalPrefs.inApp) {
                await this.createInAppNotification(userId, payload);
            }
            logger_1.logger.info('Notification sent successfully', {
                userId,
                title: payload.title,
                preferences: finalPrefs,
            });
        }
        catch (error) {
            logger_1.logger.error('Failed to send notification', {
                userId,
                error: error instanceof Error ? error.message : 'Unknown error',
            });
            throw error;
        }
    }
    async sendBulkNotifications(options) {
        const { userIds, payload, preferences = {}, delay = 0, batchSize = 10 } = options;
        logger_1.logger.info('Starting bulk notification send', {
            userCount: userIds.length,
            title: payload.title,
            batchSize,
        });
        try {
            for (let i = 0; i < userIds.length; i += batchSize) {
                const batch = userIds.slice(i, i + batchSize);
                const promises = batch.map(async (userId) => {
                    try {
                        await this.sendNotification(userId, payload, preferences);
                    }
                    catch (error) {
                        logger_1.logger.warn('Failed to send notification in bulk', {
                            userId,
                            error: error instanceof Error ? error.message : 'Unknown error',
                        });
                    }
                });
                await Promise.all(promises);
                if (delay > 0 && i + batchSize < userIds.length) {
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
            logger_1.logger.info('Bulk notifications completed', {
                userCount: userIds.length,
                title: payload.title,
            });
        }
        catch (error) {
            logger_1.logger.error('Bulk notification send failed', {
                error: error instanceof Error ? error.message : 'Unknown error',
            });
            throw error;
        }
    }
    async sendSMS(phoneNumber, message) {
        logger_1.logger.info('SMS notification would be sent', {
            phoneNumber: phoneNumber.replace(/\d(?=\d{4})/g, '*'),
            messageLength: message.length,
        });
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    async createInAppNotification(userId, payload) {
        logger_1.logger.debug('In-app notification created', {
            userId,
            title: payload.title,
            type: payload.type,
        });
    }
    async sendRouteNotification(userId, type, data) {
        const templates = {
            route_shared: {
                title: 'Route Shared',
                message: `A route has been shared with you: ${data.routeName || 'Unnamed Route'}`,
                type: 'info',
            },
            route_completed: {
                title: 'Route Completed',
                message: `You have completed your route: ${data.routeName || 'Unnamed Route'}`,
                type: 'success',
            },
            route_optimized: {
                title: 'Route Optimized',
                message: `Your route has been optimized and is now ${data.improvementPercent || 0}% faster!`,
                type: 'success',
            },
            traffic_alert: {
                title: 'Traffic Alert',
                message: `Heavy traffic detected on your route. Consider alternate routes.`,
                type: 'warning',
            },
        };
        const template = templates[type];
        if (!template) {
            throw new error_1.AppError(`Unknown notification type: ${type}`, 400);
        }
        await this.sendNotification(userId, {
            ...template,
            data,
        });
    }
    async sendFriendNotification(userId, type, data) {
        const templates = {
            friend_request: {
                title: 'Friend Request',
                message: `${data.fromUserName || 'Someone'} sent you a friend request`,
                type: 'info',
            },
            friend_accepted: {
                title: 'Friend Request Accepted',
                message: `${data.friendName || 'Your friend'} accepted your friend request`,
                type: 'success',
            },
            friend_shared_location: {
                title: 'Location Shared',
                message: `${data.friendName || 'Your friend'} shared their location with you`,
                type: 'info',
            },
        };
        const template = templates[type];
        if (!template) {
            throw new error_1.AppError(`Unknown notification type: ${type}`, 400);
        }
        await this.sendNotification(userId, {
            ...template,
            data,
        });
    }
    async sendSystemNotification(userId, type, data) {
        const templates = {
            maintenance: {
                title: 'Scheduled Maintenance',
                message: data.message || 'System maintenance is scheduled',
                type: 'warning',
            },
            feature_update: {
                title: 'New Feature Available',
                message: data.message || 'Check out the latest features!',
                type: 'info',
            },
            account_security: {
                title: 'Security Alert',
                message: data.message || 'Security-related activity detected on your account',
                type: 'warning',
            },
        };
        const template = templates[type];
        if (!template) {
            throw new error_1.AppError(`Unknown notification type: ${type}`, 400);
        }
        await this.sendNotification(userId, {
            ...template,
            data,
            priority: 'high',
        });
    }
    async getNotificationStats() {
        return {
            totalSent: 0,
            sentToday: 0,
            avgDeliveryTime: 0,
            successRate: 0,
        };
    }
}
exports.NotificationService = NotificationService;
//# sourceMappingURL=NotificationService.js.map