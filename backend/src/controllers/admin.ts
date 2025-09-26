import { Request, Response } from 'express';
import { 
  JobUtils, 
  checkJobSystemHealth, 
  JobTypes 
} from '@/jobs';
import { AppError } from '@/utils/error';
import logger from '@/config/logger';

export class AdminController {
  // Get job system health status
  public async getJobSystemHealth(_req: Request, res: Response): Promise<void> {
    try {
      const health = await checkJobSystemHealth();
      
      res.json({
        success: true,
        data: health,
      });
    } catch (error) {
      logger.error('Failed to get job system health', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      
      throw new AppError('Failed to get job system health', 500);
    }
  }

  // Get queue statistics
  public async getQueueStats(_req: Request, res: Response): Promise<void> {
    try {
      const stats = await JobUtils.getQueueStats();
      
      res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      logger.error('Failed to get queue stats', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      
      throw new AppError('Failed to get queue statistics', 500);
    }
  }

  // Pause a specific queue
  public async pauseQueue(req: Request, res: Response): Promise<void> {
    try {
      const { queueType } = req.params;
      
      if (!Object.values(JobTypes).includes(queueType as JobTypes)) {
        throw new AppError('Invalid queue type', 400);
      }

      await JobUtils.pauseQueue(queueType as JobTypes);
      
      res.json({
        success: true,
        message: `Queue ${queueType} paused successfully`,
      });
    } catch (error) {
      if (error instanceof AppError) throw error;
      
      logger.error('Failed to pause queue', {
        queueType: req.params['queueType'],
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      
      throw new AppError('Failed to pause queue', 500);
    }
  }

  // Resume a specific queue
  public async resumeQueue(req: Request, res: Response): Promise<void> {
    try {
      const { queueType } = req.params;
      
      if (!Object.values(JobTypes).includes(queueType as JobTypes)) {
        throw new AppError('Invalid queue type', 400);
      }

      await JobUtils.resumeQueue(queueType as JobTypes);
      
      res.json({
        success: true,
        message: `Queue ${queueType} resumed successfully`,
      });
    } catch (error) {
      if (error instanceof AppError) throw error;
      
      logger.error('Failed to resume queue', {
        queueType: req.params['queueType'],
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      
      throw new AppError('Failed to resume queue', 500);
    }
  }

  // Schedule a one-time job
  public async scheduleJob(req: Request, res: Response): Promise<void> {
    try {
      const { jobType, data, delay = 0 } = req.body;
      
      if (!Object.values(JobTypes).includes(jobType)) {
        throw new AppError('Invalid job type', 400);
      }

      if (!data) {
        throw new AppError('Job data is required', 400);
      }

      await JobUtils.scheduleOneTimeJob(jobType, data, delay);
      
      res.json({
        success: true,
        message: 'Job scheduled successfully',
        data: {
          jobType,
          delay,
        },
      });
    } catch (error) {
      if (error instanceof AppError) throw error;
      
      logger.error('Failed to schedule job', {
        jobType: req.body.jobType,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      
      throw new AppError('Failed to schedule job', 500);
    }
  }

  // Schedule a recurring job
  public async scheduleRecurringJob(req: Request, res: Response): Promise<void> {
    try {
      const { jobType, cronPattern, data, name } = req.body;
      
      if (!Object.values(JobTypes).includes(jobType)) {
        throw new AppError('Invalid job type', 400);
      }

      if (!cronPattern || !data || !name) {
        throw new AppError('Job type, cron pattern, data, and name are required', 400);
      }

      await JobUtils.scheduleRecurringJob(jobType, cronPattern, data, name);
      
      res.json({
        success: true,
        message: 'Recurring job scheduled successfully',
        data: {
          jobType,
          cronPattern,
          name,
        },
      });
    } catch (error) {
      if (error instanceof AppError) throw error;
      
      logger.error('Failed to schedule recurring job', {
        jobType: req.body.jobType,
        name: req.body.name,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      
      throw new AppError('Failed to schedule recurring job', 500);
    }
  }

  // Stop a recurring job
  public async stopRecurringJob(req: Request, res: Response): Promise<void> {
    try {
      const { name } = req.params;
      
      if (!name) {
        throw new AppError('Job name is required', 400);
      }

      const stopped = JobUtils.stopRecurringJob(name);
      
      if (!stopped) {
        throw new AppError('Recurring job not found', 404);
      }
      
      res.json({
        success: true,
        message: `Recurring job '${name}' stopped successfully`,
      });
    } catch (error) {
      if (error instanceof AppError) throw error;
      
      logger.error('Failed to stop recurring job', {
        name: req.params['name'],
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      
      throw new AppError('Failed to stop recurring job', 500);
    }
  }

  // Trigger immediate data cleanup
  public async triggerCleanup(req: Request, res: Response): Promise<void> {
    try {
      const { 
        type = 'sessions',
        maxAge,
        batchSize = 1000,
        dryRun = false 
      } = req.body;

      const validTypes = ['sessions', 'locations', 'cache', 'logs', 'temp_files', 'expired_tokens', 'old_analytics'];
      
      if (!validTypes.includes(type)) {
        throw new AppError(`Invalid cleanup type. Valid types: ${validTypes.join(', ')}`, 400);
      }

      await JobUtils.scheduleCleanup({
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
    } catch (error) {
      if (error instanceof AppError) throw error;
      
      logger.error('Failed to trigger cleanup', {
        type: req.body.type,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      
      throw new AppError('Failed to trigger cleanup', 500);
    }
  }

  // Trigger analytics processing
  public async triggerAnalytics(req: Request, res: Response): Promise<void> {
    try {
      const { 
        type = 'daily_summary',
        userId,
        dateRange,
        includeComparison = false,
        sendReport = false,
        reportFormat = 'in-app'
      } = req.body;

      const validTypes = ['daily_summary', 'weekly_report', 'monthly_report', 'user_behavior', 'route_analytics', 'location_patterns'];
      
      if (!validTypes.includes(type)) {
        throw new AppError(`Invalid analytics type. Valid types: ${validTypes.join(', ')}`, 400);
      }

      // Default date range to last 24 hours if not provided
      const defaultDateRange = {
        startDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
        endDate: new Date(),
      };

      await JobUtils.processAnalytics({
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
    } catch (error) {
      if (error instanceof AppError) throw error;
      
      logger.error('Failed to trigger analytics', {
        type: req.body.type,
        userId: req.body.userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      
      throw new AppError('Failed to trigger analytics processing', 500);
    }
  }

  // Send notification
  public async sendNotification(req: Request, res: Response): Promise<void> {
    try {
      const { 
        userId, 
        type = 'in-app', 
        template, 
        data, 
        priority = 'normal',
        scheduleAt 
      } = req.body;

      if (!userId || !template || !data) {
        throw new AppError('User ID, template, and data are required', 400);
      }

      const validTypes = ['email', 'push', 'in-app', 'sms'];
      if (!validTypes.includes(type)) {
        throw new AppError(`Invalid notification type. Valid types: ${validTypes.join(', ')}`, 400);
      }

      const notificationData = {
        userId,
        type,
        template,
        data,
        priority,
        ...(scheduleAt && { scheduleAt: new Date(scheduleAt) })
      };
      
      await JobUtils.sendNotification(notificationData);
      
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
    } catch (error) {
      if (error instanceof AppError) throw error;
      
      logger.error('Failed to send notification', {
        userId: req.body.userId,
        type: req.body.type,
        template: req.body.template,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      
      throw new AppError('Failed to schedule notification', 500);
    }
  }

  // Get list of available job types
  public async getJobTypes(_req: Request, res: Response): Promise<void> {
    try {
      const jobTypes = Object.values(JobTypes);
      
      res.json({
        success: true,
        data: {
          jobTypes,
          descriptions: {
            [JobTypes.ROUTE_OPTIMIZATION]: 'Optimize route waypoint order and find alternatives',
            [JobTypes.NOTIFICATION_SEND]: 'Send notifications to users',
            [JobTypes.NOTIFICATION_SCHEDULE]: 'Schedule notifications based on triggers',
            [JobTypes.DATA_CLEANUP]: 'Clean up old data and expired records',
            [JobTypes.ANALYTICS_PROCESS]: 'Process analytics data and generate reports',
            [JobTypes.USER_ANALYTICS]: 'Track user events and update statistics',
            [JobTypes.LOCATION_CLEANUP]: 'Clean up old location data',
            [JobTypes.SESSION_CLEANUP]: 'Clean up expired sessions',
            [JobTypes.EMAIL_SEND]: 'Send email notifications',
            [JobTypes.CACHE_WARM]: 'Warm up cache with frequently accessed data',
            [JobTypes.BACKUP_DATABASE]: 'Create database backups',
          },
        },
      });
    } catch (error) {
      logger.error('Failed to get job types', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      
      throw new AppError('Failed to get job types', 500);
    }
  }
}