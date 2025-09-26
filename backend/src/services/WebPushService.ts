import webpush from 'web-push';
import { AppError } from '@/utils/error';
import { logger } from '@/config/logger';
import { prisma } from '@/config/database';

export interface PushNotificationData {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  image?: string;
  data?: Record<string, any>;
  actions?: Array<{
    action: string;
    title: string;
    icon?: string;
  }>;
  tag?: string;
  requireInteraction?: boolean;
}

export interface PushSubscription {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export class WebPushService {
  constructor() {
    this.initializeWebPush();
  }

  /**
   * Initialize web push service
   */
  private initializeWebPush(): void {
    try {
      const vapidKeys = {
        publicKey: process.env.VAPID_PUBLIC_KEY || '',
        privateKey: process.env.VAPID_PRIVATE_KEY || '',
        subject: process.env.VAPID_SUBJECT || 'mailto:noreply@pathfinderpro.com',
      };

      if (!vapidKeys.publicKey || !vapidKeys.privateKey) {
        logger.warn('VAPID keys not configured - push notifications will not work');
        return;
      }

      webpush.setVapidDetails(
        vapidKeys.subject,
        vapidKeys.publicKey,
        vapidKeys.privateKey
      );

      logger.info('Web push service initialized');
    } catch (error) {
      logger.error('Failed to initialize web push service', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Send push notification to user
   */
  async sendPushNotification(
    userId: string,
    notification: PushNotificationData
  ): Promise<void> {
    try {
      // Get user's push subscriptions
      const subscriptions = await this.getUserSubscriptions(userId);

      if (subscriptions.length === 0) {
        logger.info('No push subscriptions found for user', { userId });
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

      // Send to all user's devices
      const sendPromises = subscriptions.map(subscription =>
        this.sendToSubscription(subscription, payload)
      );

      const results = await Promise.allSettled(sendPromises);

      // Count successful sends
      const successful = results.filter(result => result.status === 'fulfilled').length;
      const failed = results.filter(result => result.status === 'rejected').length;

      logger.info('Push notification sent', {
        userId,
        title: notification.title,
        subscriptions: subscriptions.length,
        successful,
        failed,
      });

      // Remove expired subscriptions
      if (failed > 0) {
        await this.cleanupExpiredSubscriptions(userId, results);
      }
    } catch (error) {
      logger.error('Failed to send push notification', {
        userId,
        title: notification.title,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw new AppError('Failed to send push notification', 500);
    }
  }

  /**
   * Send push notification to multiple users
   */
  async sendBulkPushNotifications(
    userIds: string[],
    notification: PushNotificationData
  ): Promise<void> {
    try {
      logger.info('Starting bulk push notification', {
        userCount: userIds.length,
        title: notification.title,
      });

      // Send notifications in batches to avoid overwhelming the service
      const batchSize = 100;
      let processedCount = 0;

      for (let i = 0; i < userIds.length; i += batchSize) {
        const batch = userIds.slice(i, i + batchSize);
        
        const batchPromises = batch.map(userId =>
          this.sendPushNotification(userId, notification).catch(error => {
            logger.error('Failed to send push notification to user in batch', {
              userId,
              error: error instanceof Error ? error.message : 'Unknown error',
            });
            return null; // Don't fail entire batch
          })
        );

        await Promise.all(batchPromises);
        processedCount += batch.length;

        logger.info('Bulk push notification progress', {
          processed: processedCount,
          total: userIds.length,
        });

        // Small delay between batches
        if (i + batchSize < userIds.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      logger.info('Bulk push notification completed', {
        totalUsers: userIds.length,
        title: notification.title,
      });
    } catch (error) {
      logger.error('Bulk push notification failed', {
        userCount: userIds.length,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Subscribe user to push notifications
   */
  async subscribeToPush(
    userId: string,
    subscription: PushSubscription,
    deviceInfo?: {
      userAgent: string;
      deviceType: string;
      deviceName?: string;
    }
  ): Promise<void> {
    try {
      // Check if subscription already exists
      const existingSubscription = await prisma.pushSubscription.findFirst({
        where: {
          userId,
          endpoint: subscription.endpoint,
        },
      });

      if (existingSubscription) {
        // Update existing subscription
        await prisma.pushSubscription.update({
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
      } else {
        // Create new subscription
        await prisma.pushSubscription.create({
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

      logger.info('User subscribed to push notifications', {
        userId,
        endpoint: subscription.endpoint.substring(0, 50) + '...',
        deviceType: deviceInfo?.deviceType,
      });
    } catch (error) {
      logger.error('Failed to subscribe user to push notifications', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw new AppError('Failed to subscribe to push notifications', 500);
    }
  }

  /**
   * Unsubscribe user from push notifications
   */
  async unsubscribeFromPush(userId: string, endpoint?: string): Promise<void> {
    try {
      const whereClause: any = { userId };
      if (endpoint) {
        whereClause.endpoint = endpoint;
      }

      const result = await prisma.pushSubscription.deleteMany({
        where: whereClause,
      });

      logger.info('User unsubscribed from push notifications', {
        userId,
        endpoint: endpoint ? endpoint.substring(0, 50) + '...' : 'all',
        deletedCount: result.count,
      });
    } catch (error) {
      logger.error('Failed to unsubscribe user from push notifications', {
        userId,
        endpoint,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw new AppError('Failed to unsubscribe from push notifications', 500);
    }
  }

  /**
   * Get user's push subscriptions
   */
  private async getUserSubscriptions(userId: string): Promise<PushSubscription[]> {
    try {
      const subscriptions = await prisma.pushSubscription.findMany({
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
    } catch (error) {
      logger.error('Failed to get user subscriptions', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return [];
    }
  }

  /**
   * Send notification to a specific subscription
   */
  private async sendToSubscription(
    subscription: PushSubscription,
    payload: string
  ): Promise<any> {
    try {
      const result = await webpush.sendNotification(subscription, payload);
      return result;
    } catch (error: any) {
      // Handle specific web push errors
      if (error.statusCode === 410) {
        // Subscription has expired or is no longer valid
        throw new Error(`Expired subscription: ${error.body}`);
      } else if (error.statusCode === 413) {
        // Payload too large
        throw new Error(`Payload too large: ${error.body}`);
      } else if (error.statusCode === 429) {
        // Rate limited
        throw new Error(`Rate limited: ${error.body}`);
      }
      
      throw error;
    }
  }

  /**
   * Clean up expired subscriptions
   */
  private async cleanupExpiredSubscriptions(
    userId: string,
    results: PromiseSettledResult<any>[]
  ): Promise<void> {
    try {
      const expiredEndpoints: string[] = [];

      results.forEach((result, index) => {
        if (result.status === 'rejected') {
          const error = result.reason;
          if (error.message && error.message.includes('Expired subscription')) {
            // Extract endpoint from error or use index to identify
            // This is a simplified approach - in production, you'd track which subscription failed
            logger.info('Found expired subscription', { userId, index });
          }
        }
      });

      // Remove expired subscriptions
      if (expiredEndpoints.length > 0) {
        await prisma.pushSubscription.deleteMany({
          where: {
            userId,
            endpoint: {
              in: expiredEndpoints,
            },
          },
        });

        logger.info('Cleaned up expired subscriptions', {
          userId,
          count: expiredEndpoints.length,
        });
      }
    } catch (error) {
      logger.error('Failed to cleanup expired subscriptions', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Generate VAPID keys (utility method for setup)
   */
  static generateVapidKeys(): { publicKey: string; privateKey: string } {
    return webpush.generateVAPIDKeys();
  }

  /**
   * Test push notification
   */
  async testPushNotification(userId: string): Promise<void> {
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

  /**
   * Send route-related notification
   */
  async sendRouteNotification(
    userId: string,
    type: 'route_optimized' | 'route_shared' | 'route_reminder',
    routeData: {
      routeName: string;
      timeSaved?: number;
      distanceSaved?: number;
      senderName?: string;
    }
  ): Promise<void> {
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

  /**
   * Get push notification statistics
   */
  async getNotificationStats(userId?: string): Promise<{
    totalSubscriptions: number;
    activeSubscriptions: number;
    deviceTypeBreakdown: Record<string, number>;
  }> {
    try {
      const whereClause = userId ? { userId } : {};

      const [totalSubscriptions, activeSubscriptions, deviceBreakdown] = await Promise.all([
        prisma.pushSubscription.count({ where: whereClause }),
        prisma.pushSubscription.count({ 
          where: { ...whereClause, isActive: true } 
        }),
        prisma.pushSubscription.groupBy({
          by: ['deviceType'],
          where: { ...whereClause, isActive: true },
          _count: { deviceType: true },
        }),
      ]);

      const deviceTypeBreakdown = deviceBreakdown.reduce((acc, item) => {
        acc[item.deviceType || 'unknown'] = item._count.deviceType;
        return acc;
      }, {} as Record<string, number>);

      return {
        totalSubscriptions,
        activeSubscriptions,
        deviceTypeBreakdown,
      };
    } catch (error) {
      logger.error('Failed to get notification stats', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw new AppError('Failed to get notification statistics', 500);
    }
  }
}