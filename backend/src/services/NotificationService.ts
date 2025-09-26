import { logger } from '@/config/logger';
import { prisma } from '@/config/database';
import { EmailService } from './EmailService';
import { WebPushService } from './WebPushService';
import { AppError } from '@/utils/error';

export interface NotificationPayload {
  title: string;
  message: string;
  type?: 'info' | 'warning' | 'error' | 'success';
  data?: Record<string, any>;
  priority?: 'low' | 'normal' | 'high';
  expiresAt?: Date;
}

export interface NotificationPreferences {
  email: boolean;
  push: boolean;
  sms: boolean;
  inApp: boolean;
}

export interface BulkNotificationOptions {
  userIds: string[];
  payload: NotificationPayload;
  preferences?: Partial<NotificationPreferences>;
  delay?: number;
  batchSize?: number;
}

export class NotificationService {
  private emailService: EmailService;
  private webPushService: WebPushService;

  constructor() {
    this.emailService = new EmailService();
    this.webPushService = new WebPushService();
  }

  /**
   * Send notification to a single user
   */
  async sendNotification(
    userId: string,
    payload: NotificationPayload,
    preferences: Partial<NotificationPreferences> = {}
  ): Promise<void> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { preferences: true }
      });

      if (!user) {
        throw new AppError('User not found', 404);
      }

      const userPrefs = user.preferences;
      const defaultPrefs = {
        email: true,
        push: true,
        sms: false,
        inApp: true,
      };

      const finalPrefs = { ...defaultPrefs, ...preferences };

      // Send push notification
      if (finalPrefs.push) {
        try {
          await this.webPushService.sendNotification(userId, {
            title: payload.title,
            body: payload.message,
            data: payload.data,
          });
        } catch (error) {
          logger.warn('Failed to send push notification', {
            userId,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      // Send email notification
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
        } catch (error) {
          logger.warn('Failed to send email notification', {
            userId,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      // Send SMS if requested
      if (finalPrefs.sms && user.phoneNumber) {
        try {
          await this.sendSMS(user.phoneNumber, payload.message);
        } catch (error) {
          logger.warn('Failed to send SMS notification', {
            userId,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      // Store in-app notification
      if (finalPrefs.inApp) {
        await this.createInAppNotification(userId, payload);
      }

      logger.info('Notification sent successfully', {
        userId,
        title: payload.title,
        preferences: finalPrefs,
      });
    } catch (error) {
      logger.error('Failed to send notification', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Send bulk notifications
   */
  async sendBulkNotifications(options: BulkNotificationOptions): Promise<void> {
    const { userIds, payload, preferences = {}, delay = 0, batchSize = 10 } = options;

    logger.info('Starting bulk notification send', {
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
          } catch (error) {
            logger.warn('Failed to send notification in bulk', {
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

      logger.info('Bulk notifications completed', {
        userCount: userIds.length,
        title: payload.title,
      });
    } catch (error) {
      logger.error('Bulk notification send failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Send SMS notification
   */
  async sendSMS(phoneNumber: string, message: string): Promise<void> {
    // In a real implementation, you would integrate with an SMS service like Twilio
    logger.info('SMS notification would be sent', {
      phoneNumber: phoneNumber.replace(/\d(?=\d{4})/g, '*'), // Mask phone number
      messageLength: message.length,
    });
    
    // Simulate SMS sending delay
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  /**
   * Create in-app notification
   */
  private async createInAppNotification(userId: string, payload: NotificationPayload): Promise<void> {
    // In a real implementation, this would store the notification in the database
    // and potentially emit a real-time event
    logger.debug('In-app notification created', {
      userId,
      title: payload.title,
      type: payload.type,
    });
  }

  /**
   * Send route-related notification
   */
  async sendRouteNotification(
    userId: string,
    type: 'route_shared' | 'route_completed' | 'route_optimized' | 'traffic_alert',
    data: Record<string, any>
  ): Promise<void> {
    const templates = {
      route_shared: {
        title: 'Route Shared',
        message: `A route has been shared with you: ${data.routeName || 'Unnamed Route'}`,
        type: 'info' as const,
      },
      route_completed: {
        title: 'Route Completed',
        message: `You have completed your route: ${data.routeName || 'Unnamed Route'}`,
        type: 'success' as const,
      },
      route_optimized: {
        title: 'Route Optimized',
        message: `Your route has been optimized and is now ${data.improvementPercent || 0}% faster!`,
        type: 'success' as const,
      },
      traffic_alert: {
        title: 'Traffic Alert',
        message: `Heavy traffic detected on your route. Consider alternate routes.`,
        type: 'warning' as const,
      },
    };

    const template = templates[type];
    if (!template) {
      throw new AppError(`Unknown notification type: ${type}`, 400);
    }

    await this.sendNotification(userId, {
      ...template,
      data,
    });
  }

  /**
   * Send friend-related notification
   */
  async sendFriendNotification(
    userId: string,
    type: 'friend_request' | 'friend_accepted' | 'friend_shared_location',
    data: Record<string, any>
  ): Promise<void> {
    const templates = {
      friend_request: {
        title: 'Friend Request',
        message: `${data.fromUserName || 'Someone'} sent you a friend request`,
        type: 'info' as const,
      },
      friend_accepted: {
        title: 'Friend Request Accepted',
        message: `${data.friendName || 'Your friend'} accepted your friend request`,
        type: 'success' as const,
      },
      friend_shared_location: {
        title: 'Location Shared',
        message: `${data.friendName || 'Your friend'} shared their location with you`,
        type: 'info' as const,
      },
    };

    const template = templates[type];
    if (!template) {
      throw new AppError(`Unknown notification type: ${type}`, 400);
    }

    await this.sendNotification(userId, {
      ...template,
      data,
    });
  }

  /**
   * Send system notification
   */
  async sendSystemNotification(
    userId: string,
    type: 'maintenance' | 'feature_update' | 'account_security',
    data: Record<string, any>
  ): Promise<void> {
    const templates = {
      maintenance: {
        title: 'Scheduled Maintenance',
        message: data.message || 'System maintenance is scheduled',
        type: 'warning' as const,
      },
      feature_update: {
        title: 'New Feature Available',
        message: data.message || 'Check out the latest features!',
        type: 'info' as const,
      },
      account_security: {
        title: 'Security Alert',
        message: data.message || 'Security-related activity detected on your account',
        type: 'warning' as const,
      },
    };

    const template = templates[type];
    if (!template) {
      throw new AppError(`Unknown notification type: ${type}`, 400);
    }

    await this.sendNotification(userId, {
      ...template,
      data,
      priority: 'high',
    });
  }

  /**
   * Get notification statistics
   */
  async getNotificationStats(): Promise<{
    totalSent: number;
    sentToday: number;
    avgDeliveryTime: number;
    successRate: number;
  }> {
    // In a real implementation, this would query actual notification logs
    return {
      totalSent: 0,
      sentToday: 0,
      avgDeliveryTime: 0,
      successRate: 0,
    };
  }
}