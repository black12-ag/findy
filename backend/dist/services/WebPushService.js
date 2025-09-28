"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebPushService = void 0;
const web_push_1 = __importDefault(require("web-push"));
const error_1 = require("@/utils/error");
const logger_1 = require("@/config/logger");
const database_1 = require("@/config/database");
class WebPushService {
    constructor() {
        this.initializeWebPush();
    }
    initializeWebPush() {
        try {
            const vapidKeys = {
                publicKey: process.env.VAPID_PUBLIC_KEY || '',
                privateKey: process.env.VAPID_PRIVATE_KEY || '',
                subject: process.env.VAPID_SUBJECT || 'mailto:noreply@pathfinderpro.com',
            };
            if (!vapidKeys.publicKey || !vapidKeys.privateKey) {
                logger_1.logger.warn('VAPID keys not configured - push notifications will not work');
                return;
            }
            web_push_1.default.setVapidDetails(vapidKeys.subject, vapidKeys.publicKey, vapidKeys.privateKey);
            logger_1.logger.info('Web push service initialized');
        }
        catch (error) {
            logger_1.logger.error('Failed to initialize web push service', {
                error: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    }
    async sendPushNotification(userId, notification) {
        try {
            const subscriptions = await this.getUserSubscriptions(userId);
            if (subscriptions.length === 0) {
                logger_1.logger.info('No push subscriptions found for user', { userId });
                return;
            }
            const payload = JSON.stringify({
                title: notification.title,
                body: notification.body,
                icon: notification.icon || '/icons/icon-192x192.png',
                badge: notification.badge || '/icons/badge-72x72.png',
                image: notification.image,
                data: {
                    timestamp: Date.now(),
                    userId,
                    ...notification.data,
                },
                actions: notification.actions || [],
                tag: notification.tag || `notification-${Date.now()}`,
                requireInteraction: notification.requireInteraction || false,
                vibrate: [100, 50, 100],
            });
            const sendPromises = subscriptions.map(subscription => this.sendToSubscription(subscription, payload));
            const results = await Promise.allSettled(sendPromises);
            const successful = results.filter(result => result.status === 'fulfilled').length;
            const failed = results.filter(result => result.status === 'rejected').length;
            logger_1.logger.info('Push notification sent', {
                userId,
                title: notification.title,
                subscriptions: subscriptions.length,
                successful,
                failed,
            });
            if (failed > 0) {
                await this.cleanupExpiredSubscriptions(userId, results);
            }
        }
        catch (error) {
            logger_1.logger.error('Failed to send push notification', {
                userId,
                title: notification.title,
                error: error instanceof Error ? error.message : 'Unknown error',
            });
            throw new error_1.AppError('Failed to send push notification', 500);
        }
    }
    async sendBulkPushNotifications(userIds, notification) {
        try {
            logger_1.logger.info('Starting bulk push notification', {
                userCount: userIds.length,
                title: notification.title,
            });
            const batchSize = 100;
            let processedCount = 0;
            for (let i = 0; i < userIds.length; i += batchSize) {
                const batch = userIds.slice(i, i + batchSize);
                const batchPromises = batch.map(userId => this.sendPushNotification(userId, notification).catch(error => {
                    logger_1.logger.error('Failed to send push notification to user in batch', {
                        userId,
                        error: error instanceof Error ? error.message : 'Unknown error',
                    });
                    return null;
                }));
                await Promise.all(batchPromises);
                processedCount += batch.length;
                logger_1.logger.info('Bulk push notification progress', {
                    processed: processedCount,
                    total: userIds.length,
                });
                if (i + batchSize < userIds.length) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
            }
            logger_1.logger.info('Bulk push notification completed', {
                totalUsers: userIds.length,
                title: notification.title,
            });
        }
        catch (error) {
            logger_1.logger.error('Bulk push notification failed', {
                userCount: userIds.length,
                error: error instanceof Error ? error.message : 'Unknown error',
            });
            throw error;
        }
    }
    async subscribeToPush(userId, subscription, deviceInfo) {
        try {
            const existingSubscription = await database_1.prisma.pushSubscription.findFirst({
                where: {
                    userId,
                    endpoint: subscription.endpoint,
                },
            });
            if (existingSubscription) {
                await database_1.prisma.pushSubscription.update({
                    where: { id: existingSubscription.id },
                    data: {
                        p256dhKey: subscription.keys.p256dh,
                        authKey: subscription.keys.auth,
                        userAgent: deviceInfo?.userAgent,
                        deviceType: deviceInfo?.deviceType,
                        deviceName: deviceInfo?.deviceName,
                        isActive: true,
                        updatedAt: new Date(),
                    },
                });
            }
            else {
                await database_1.prisma.pushSubscription.create({
                    data: {
                        userId,
                        endpoint: subscription.endpoint,
                        p256dhKey: subscription.keys.p256dh,
                        authKey: subscription.keys.auth,
                        userAgent: deviceInfo?.userAgent,
                        deviceType: deviceInfo?.deviceType,
                        deviceName: deviceInfo?.deviceName,
                        isActive: true,
                    },
                });
            }
            logger_1.logger.info('User subscribed to push notifications', {
                userId,
                endpoint: subscription.endpoint.substring(0, 50) + '...',
                deviceType: deviceInfo?.deviceType,
            });
        }
        catch (error) {
            logger_1.logger.error('Failed to subscribe user to push notifications', {
                userId,
                error: error instanceof Error ? error.message : 'Unknown error',
            });
            throw new error_1.AppError('Failed to subscribe to push notifications', 500);
        }
    }
    async unsubscribeFromPush(userId, endpoint) {
        try {
            const whereClause = { userId };
            if (endpoint) {
                whereClause.endpoint = endpoint;
            }
            const result = await database_1.prisma.pushSubscription.deleteMany({
                where: whereClause,
            });
            logger_1.logger.info('User unsubscribed from push notifications', {
                userId,
                endpoint: endpoint ? endpoint.substring(0, 50) + '...' : 'all',
                deletedCount: result.count,
            });
        }
        catch (error) {
            logger_1.logger.error('Failed to unsubscribe user from push notifications', {
                userId,
                endpoint,
                error: error instanceof Error ? error.message : 'Unknown error',
            });
            throw new error_1.AppError('Failed to unsubscribe from push notifications', 500);
        }
    }
    async getUserSubscriptions(userId) {
        try {
            const subscriptions = await database_1.prisma.pushSubscription.findMany({
                where: {
                    userId,
                    isActive: true,
                },
            });
            return subscriptions.map(sub => ({
                endpoint: sub.endpoint,
                keys: {
                    p256dh: sub.p256dhKey,
                    auth: sub.authKey,
                },
            }));
        }
        catch (error) {
            logger_1.logger.error('Failed to get user subscriptions', {
                userId,
                error: error instanceof Error ? error.message : 'Unknown error',
            });
            return [];
        }
    }
    async sendToSubscription(subscription, payload) {
        try {
            const result = await web_push_1.default.sendNotification(subscription, payload);
            return result;
        }
        catch (error) {
            if (error.statusCode === 410) {
                throw new Error(`Expired subscription: ${error.body}`);
            }
            else if (error.statusCode === 413) {
                throw new Error(`Payload too large: ${error.body}`);
            }
            else if (error.statusCode === 429) {
                throw new Error(`Rate limited: ${error.body}`);
            }
            throw error;
        }
    }
    async cleanupExpiredSubscriptions(userId, results) {
        try {
            const expiredEndpoints = [];
            results.forEach((result, index) => {
                if (result.status === 'rejected') {
                    const error = result.reason;
                    if (error.message && error.message.includes('Expired subscription')) {
                        logger_1.logger.info('Found expired subscription', { userId, index });
                    }
                }
            });
            if (expiredEndpoints.length > 0) {
                await database_1.prisma.pushSubscription.deleteMany({
                    where: {
                        userId,
                        endpoint: {
                            in: expiredEndpoints,
                        },
                    },
                });
                logger_1.logger.info('Cleaned up expired subscriptions', {
                    userId,
                    count: expiredEndpoints.length,
                });
            }
        }
        catch (error) {
            logger_1.logger.error('Failed to cleanup expired subscriptions', {
                userId,
                error: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    }
    static generateVapidKeys() {
        return web_push_1.default.generateVAPIDKeys();
    }
    async testPushNotification(userId) {
        await this.sendPushNotification(userId, {
            title: 'Test Notification',
            body: 'This is a test notification from PathFinder Pro',
            icon: '/icons/icon-192x192.png',
            data: {
                type: 'test',
                timestamp: Date.now(),
            },
            actions: [
                {
                    action: 'view',
                    title: 'View',
                },
                {
                    action: 'dismiss',
                    title: 'Dismiss',
                },
            ],
        });
    }
    async sendRouteNotification(userId, type, routeData) {
        const notifications = {
            route_optimized: {
                title: 'Route Optimized!',
                body: `Your route "${routeData.routeName}" has been optimized. Time saved: ${Math.round((routeData.timeSaved || 0) / 60)} minutes`,
                tag: 'route_optimization',
                icon: '/icons/route-optimized.png',
            },
            route_shared: {
                title: 'Route Shared',
                body: `${routeData.senderName} shared "${routeData.routeName}" with you`,
                tag: 'route_shared',
                icon: '/icons/route-shared.png',
            },
            route_reminder: {
                title: 'Route Reminder',
                body: `Don't forget about your planned route: "${routeData.routeName}"`,
                tag: 'route_reminder',
                icon: '/icons/route-reminder.png',
            },
        };
        const notification = notifications[type];
        await this.sendPushNotification(userId, {
            ...notification,
            data: {
                type,
                routeData,
            },
            actions: [
                {
                    action: 'view_route',
                    title: 'View Route',
                },
                {
                    action: 'dismiss',
                    title: 'Dismiss',
                },
            ],
        });
    }
    async getNotificationStats(userId) {
        try {
            const whereClause = userId ? { userId } : {};
            const [totalSubscriptions, activeSubscriptions, deviceBreakdown] = await Promise.all([
                database_1.prisma.pushSubscription.count({ where: whereClause }),
                database_1.prisma.pushSubscription.count({
                    where: { ...whereClause, isActive: true }
                }),
                database_1.prisma.pushSubscription.groupBy({
                    by: ['deviceType'],
                    where: { ...whereClause, isActive: true },
                    _count: { deviceType: true },
                }),
            ]);
            const deviceTypeBreakdown = deviceBreakdown.reduce((acc, item) => {
                acc[item.deviceType || 'unknown'] = item._count.deviceType;
                return acc;
            }, {});
            return {
                totalSubscriptions,
                activeSubscriptions,
                deviceTypeBreakdown,
            };
        }
        catch (error) {
            logger_1.logger.error('Failed to get notification stats', {
                userId,
                error: error instanceof Error ? error.message : 'Unknown error',
            });
            throw new error_1.AppError('Failed to get notification statistics', 500);
        }
    }
}
exports.WebPushService = WebPushService;
//# sourceMappingURL=WebPushService.js.map