import Bull, { Job } from 'bull';
import { queueManager, JobTypes } from '@/queues';
import { NotificationService } from '@/services/NotificationService';
import { EmailService } from '@/services/EmailService';
import { WebPushService } from '@/services/WebPushService';
import logger from '@/config/logger';

export interface NotificationJobData {
  userId: string;
  type: 'email' | 'push' | 'in-app' | 'sms';
  template: string;
  data: Record<string, any>;
  priority?: 'high' | 'normal' | 'low';
  scheduleAt?: Date;
  retryCount?: number;
}

export interface ScheduledNotificationJobData {
  userId: string;
  notificationId: string;
  triggerType: 'time' | 'location' | 'event';
  triggerData: {
    scheduledTime?: Date;
    location?: {
      lat: number;
      lng: number;
      radius: number;
    };
    eventType?: string;
  };
  notificationData: {
    title: string;
    message: string;
    type: 'route_reminder' | 'location_alert' | 'weather_update' | 'traffic_alert' | 'general';
    data?: Record<string, any>;
  };
}

export interface BatchNotificationJobData {
  userIds: string[];
  template: string;
  data: Record<string, any>;
  type: 'email' | 'push' | 'in-app';
  batchSize?: number;
}

class NotificationJobProcessor {
  private notificationService: NotificationService;
  private emailService: EmailService;
  private webPushService: WebPushService;

  constructor() {
    this.notificationService = new NotificationService();
    this.emailService = new EmailService();
    this.webPushService = new WebPushService();
    this.setupProcessors();
  }

  private setupProcessors() {
    const sendQueue = queueManager.getQueue(JobTypes.NOTIFICATION_SEND);
    const scheduleQueue = queueManager.getQueue(JobTypes.NOTIFICATION_SCHEDULE);

    if (sendQueue) {
      sendQueue.process('single', this.processSingleNotification.bind(this));
      sendQueue.process('batch', this.processBatchNotification.bind(this));
      logger.info('Notification send job processor initialized');
    }

    if (scheduleQueue) {
      scheduleQueue.process('*', this.processScheduledNotification.bind(this));
      logger.info('Notification schedule job processor initialized');
    }
  }

  public async processSingleNotification(job: Job<NotificationJobData>): Promise<void> {
    const { userId, type, template, data, retryCount = 0 } = job.data;

    try {
      logger.info('Processing single notification', {
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

      logger.info('Single notification sent successfully', {
        jobId: job.id,
        userId,
        type,
        template,
      });
    } catch (error) {
      logger.error('Failed to send single notification', {
        jobId: job.id,
        userId,
        type,
        template,
        error: error instanceof Error ? error.message : 'Unknown error',
        retryCount,
      });

      // Re-queue with exponential backoff if retries remain
      if (retryCount < 3) {
        const delay = Math.pow(2, retryCount) * 60000; // 1, 2, 4 minutes
        await queueManager.addJob(
          JobTypes.NOTIFICATION_SEND,
          { ...job.data, retryCount: retryCount + 1 },
          { delay, jobId: `retry-${job.id}-${retryCount + 1}` }
        );
      }

      throw error;
    }
  }

  public async processBatchNotification(job: Job<BatchNotificationJobData>): Promise<void> {
    const { userIds, template, data, type, batchSize = 50 } = job.data;

    try {
      logger.info('Processing batch notification', {
        jobId: job.id,
        userCount: userIds.length,
        type,
        template,
        batchSize,
      });

      const totalBatches = Math.ceil(userIds.length / batchSize);
      let processedBatches = 0;

      // Process users in batches
      for (let i = 0; i < userIds.length; i += batchSize) {
        const batchUserIds = userIds.slice(i, i + batchSize);
        
        // Create individual notification jobs for each user in the batch
        const batchJobs = batchUserIds.map(userId =>
          queueManager.addJob(JobTypes.NOTIFICATION_SEND, {
            userId,
            type,
            template,
            data,
            priority: 'normal',
          }, {
            jobId: `batch-${job.id}-${userId}-${i}`,
          })
        );

        await Promise.all(batchJobs);
        
        processedBatches++;
        const progress = Math.round((processedBatches / totalBatches) * 100);
        await job.progress(progress);

        logger.info('Batch notification progress', {
          jobId: job.id,
          processedBatches,
          totalBatches,
          progress,
        });

        // Small delay to prevent overwhelming the system
        if (i + batchSize < userIds.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      logger.info('Batch notification processing completed', {
        jobId: job.id,
        totalUsers: userIds.length,
        totalBatches,
      });
    } catch (error) {
      logger.error('Failed to process batch notification', {
        jobId: job.id,
        userCount: userIds.length,
        type,
        template,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  public async processScheduledNotification(job: Job<ScheduledNotificationJobData>): Promise<void> {
    const { userId, notificationId, triggerType, triggerData, notificationData } = job.data;

    try {
      logger.info('Processing scheduled notification', {
        jobId: job.id,
        userId,
        notificationId,
        triggerType,
      });

      // Check if the trigger condition is met
      const shouldSend = await this.checkTriggerCondition(triggerType, triggerData, userId);

      if (!shouldSend) {
        logger.info('Trigger condition not met, skipping notification', {
          jobId: job.id,
          userId,
          triggerType,
        });
        return;
      }

      await job.progress(50);

      // Send the notification
      await queueManager.addJob(JobTypes.NOTIFICATION_SEND, {
        userId,
        type: 'push', // Default to push for scheduled notifications
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

      logger.info('Scheduled notification processed successfully', {
        jobId: job.id,
        userId,
        notificationId,
        triggerType,
      });
    } catch (error) {
      logger.error('Failed to process scheduled notification', {
        jobId: job.id,
        userId,
        notificationId,
        triggerType,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  private async checkTriggerCondition(
    triggerType: string,
    triggerData: ScheduledNotificationJobData['triggerData'],
    userId: string
  ): Promise<boolean> {
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
          // Check if user is within the specified radius of the location
          const userLocation = await this.notificationService.getUserCurrentLocation(userId);
          if (userLocation) {
            const distance = this.calculateDistance(
              userLocation.lat,
              userLocation.lng,
              triggerData.location.lat,
              triggerData.location.lng
            );
            return distance <= triggerData.location.radius;
          }
        }
        return false;

      case 'event':
        // Custom event-based triggers can be implemented here
        return await this.notificationService.checkEventTrigger(
          userId,
          triggerData.eventType || ''
        );

      default:
        logger.warn('Unknown trigger type', { triggerType });
        return false;
    }
  }

  private calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371000; // Earth's radius in meters
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lng2 - lng1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance in meters
  }
}

// Initialize the processor
export const notificationJobProcessor = new NotificationJobProcessor();

// Helper functions to add notification jobs
export async function sendNotification(
  data: NotificationJobData,
  options: Bull.JobOptions = {}
): Promise<Bull.Job> {
  const priority = data.priority === 'high' ? 1 : data.priority === 'low' ? 10 : 5;
  
  const jobOptions = {
    priority,
    ...options,
  };

  if (data.scheduleAt) {
    jobOptions.delay = data.scheduleAt.getTime() - Date.now();
  }

  return queueManager.addJob(JobTypes.NOTIFICATION_SEND, data, jobOptions);
}

export async function sendBatchNotification(
  data: BatchNotificationJobData,
  options: Bull.JobOptions = {}
): Promise<Bull.Job> {
  return queueManager.addJob(JobTypes.NOTIFICATION_SEND, data, {
    jobId: `batch-${Date.now()}`,
    ...options,
  });
}

export async function scheduleNotification(
  data: ScheduledNotificationJobData,
  cronPattern?: string
): Promise<Bull.Job> {
  if (cronPattern) {
    return queueManager.scheduleJob(JobTypes.NOTIFICATION_SCHEDULE, cronPattern, data);
  } else {
    return queueManager.addJob(JobTypes.NOTIFICATION_SCHEDULE, data);
  }
}