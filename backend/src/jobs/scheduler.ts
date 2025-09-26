import cron from 'node-cron';
import { queueManager, JobTypes } from '@/queues';
import logger from '@/config/logger';

// Import job processors to initialize them
import { routeOptimizationProcessor } from './routeOptimization';
import { notificationJobProcessor } from './notifications';
import { dataCleanupProcessor, scheduleRegularCleanups } from './dataCleanup';
import { analyticsJobProcessor, scheduleRegularAnalytics } from './analytics';

export class JobScheduler {
  private isInitialized = false;
  private scheduledJobs: Map<string, cron.ScheduledTask> = new Map();

  constructor() {
    this.setupGracefulShutdown();
  }

  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.warn('Job scheduler already initialized');
      return;
    }

    try {
      logger.info('Initializing job scheduler...');

      // Initialize job processors (they're imported above so they initialize automatically)
      logger.info('Job processors initialized');

      // Schedule regular cleanup jobs
      await this.scheduleCleanupJobs();

      // Schedule regular analytics jobs
      await this.scheduleAnalyticsJobs();

      // Schedule health checks and monitoring jobs
      await this.scheduleMonitoringJobs();

      // Schedule maintenance jobs
      await this.scheduleMaintenanceJobs();

      this.isInitialized = true;
      logger.info('Job scheduler initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize job scheduler', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  private async scheduleCleanupJobs(): Promise<void> {
    try {
      // Use the function from dataCleanup.ts
      await scheduleRegularCleanups();
      logger.info('Cleanup jobs scheduled');
    } catch (error) {
      logger.error('Failed to schedule cleanup jobs', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  private async scheduleAnalyticsJobs(): Promise<void> {
    try {
      // Use the function from analytics.ts
      await scheduleRegularAnalytics();
      logger.info('Analytics jobs scheduled');
    } catch (error) {
      logger.error('Failed to schedule analytics jobs', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  private async scheduleMonitoringJobs(): Promise<void> {
    try {
      // Queue health monitoring - every 5 minutes
      const healthCheckTask = cron.schedule('*/5 * * * *', async () => {
        try {
          const stats = await queueManager.getAllQueueStats();
          
          // Log queue statistics
          logger.info('Queue health check', { stats });

          // Check for stuck jobs
          Object.entries(stats).forEach(([queueName, queueStats]) => {
            if (typeof queueStats === 'object' && queueStats.failed > 10) {
              logger.warn(`High failure rate in queue: ${queueName}`, {
                failed: queueStats.failed,
                waiting: queueStats.waiting,
                active: queueStats.active,
              });
            }

            if (typeof queueStats === 'object' && queueStats.active > 100) {
              logger.warn(`High active job count in queue: ${queueName}`, {
                active: queueStats.active,
              });
            }
          });
        } catch (error) {
          logger.error('Queue health check failed', {
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }, {
        scheduled: false,
      });

      healthCheckTask.start();
      this.scheduledJobs.set('health_check', healthCheckTask);

      // Performance monitoring - every hour
      const performanceTask = cron.schedule('0 * * * *', async () => {
        try {
          await queueManager.addJob(JobTypes.ANALYTICS_PROCESS, {
            type: 'daily_summary',
            dateRange: {
              startDate: new Date(Date.now() - 60 * 60 * 1000), // Last hour
              endDate: new Date(),
            },
          });
        } catch (error) {
          logger.error('Performance monitoring job failed', {
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }, {
        scheduled: false,
      });

      performanceTask.start();
      this.scheduledJobs.set('performance_monitoring', performanceTask);

      logger.info('Monitoring jobs scheduled');
    } catch (error) {
      logger.error('Failed to schedule monitoring jobs', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  private async scheduleMaintenanceJobs(): Promise<void> {
    try {
      // Database maintenance - weekly on Sundays at 2 AM
      const dbMaintenanceTask = cron.schedule('0 2 * * 0', async () => {
        try {
          logger.info('Starting database maintenance');

          // Clean up old completed jobs
          for (const jobType of Object.values(JobTypes)) {
            try {
              await queueManager.cleanCompletedJobs(jobType, 7 * 24 * 60 * 60 * 1000); // 7 days
            } catch (error) {
              logger.error(`Failed to clean jobs for ${jobType}`, {
                error: error instanceof Error ? error.message : 'Unknown error',
              });
            }
          }

          // Add database backup job
          await queueManager.addJob(JobTypes.BACKUP_DATABASE, {
            type: 'full_backup',
            retention: 30, // Keep backups for 30 days
          });

          logger.info('Database maintenance completed');
        } catch (error) {
          logger.error('Database maintenance failed', {
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }, {
        scheduled: false,
      });

      dbMaintenanceTask.start();
      this.scheduledJobs.set('db_maintenance', dbMaintenanceTask);

      // Cache warming - daily at 5 AM
      const cacheWarmingTask = cron.schedule('0 5 * * *', async () => {
        try {
          await queueManager.addJob(JobTypes.CACHE_WARM, {
            type: 'popular_places',
            limit: 100,
          });

          await queueManager.addJob(JobTypes.CACHE_WARM, {
            type: 'user_preferences',
            activeUsersOnly: true,
          });

          logger.info('Cache warming jobs scheduled');
        } catch (error) {
          logger.error('Cache warming scheduling failed', {
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }, {
        scheduled: false,
      });

      cacheWarmingTask.start();
      this.scheduledJobs.set('cache_warming', cacheWarmingTask);

      logger.info('Maintenance jobs scheduled');
    } catch (error) {
      logger.error('Failed to schedule maintenance jobs', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  // Schedule a one-time job
  public async scheduleOneTimeJob(
    jobType: JobTypes,
    data: any,
    delay: number = 0
  ): Promise<void> {
    try {
      await queueManager.addJob(jobType, data, {
        delay,
        jobId: `onetime-${Date.now()}-${Math.random()}`,
      });

      logger.info('One-time job scheduled', {
        jobType,
        delay,
        data,
      });
    } catch (error) {
      logger.error('Failed to schedule one-time job', {
        jobType,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  // Schedule a recurring job with cron pattern
  public async scheduleRecurringJob(
    jobType: JobTypes,
    cronPattern: string,
    data: any,
    name: string
  ): Promise<void> {
    try {
      // Stop existing job with same name if it exists
      const existingJob = this.scheduledJobs.get(name);
      if (existingJob) {
        existingJob.stop();
        this.scheduledJobs.delete(name);
      }

      // Create new cron job
      const task = cron.schedule(cronPattern, async () => {
        try {
          await queueManager.addJob(jobType, data);
          logger.debug(`Recurring job executed: ${name}`);
        } catch (error) {
          logger.error(`Recurring job failed: ${name}`, {
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }, {
        scheduled: false,
      });

      task.start();
      this.scheduledJobs.set(name, task);

      logger.info('Recurring job scheduled', {
        name,
        jobType,
        cronPattern,
      });
    } catch (error) {
      logger.error('Failed to schedule recurring job', {
        name,
        jobType,
        cronPattern,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  // Stop a recurring job
  public stopRecurringJob(name: string): boolean {
    const job = this.scheduledJobs.get(name);
    if (job) {
      job.stop();
      this.scheduledJobs.delete(name);
      logger.info(`Recurring job stopped: ${name}`);
      return true;
    }
    return false;
  }

  // Get queue statistics
  public async getQueueStats(): Promise<Record<string, any>> {
    try {
      return await queueManager.getAllQueueStats();
    } catch (error) {
      logger.error('Failed to get queue stats', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  // Pause/resume queues
  public async pauseQueue(jobType: JobTypes): Promise<void> {
    try {
      await queueManager.pauseQueue(jobType);
      logger.info(`Queue paused: ${jobType}`);
    } catch (error) {
      logger.error(`Failed to pause queue: ${jobType}`, {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  public async resumeQueue(jobType: JobTypes): Promise<void> {
    try {
      await queueManager.resumeQueue(jobType);
      logger.info(`Queue resumed: ${jobType}`);
    } catch (error) {
      logger.error(`Failed to resume queue: ${jobType}`, {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  // Graceful shutdown
  public async shutdown(): Promise<void> {
    if (!this.isInitialized) {
      return;
    }

    logger.info('Shutting down job scheduler...');

    try {
      // Stop all cron jobs
      for (const [name, job] of this.scheduledJobs.entries()) {
        try {
          job.stop();
          logger.info(`Stopped cron job: ${name}`);
        } catch (error) {
          logger.error(`Failed to stop cron job: ${name}`, {
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      this.scheduledJobs.clear();

      // Close all queues
      await queueManager.close();

      this.isInitialized = false;
      logger.info('Job scheduler shut down successfully');
    } catch (error) {
      logger.error('Error during job scheduler shutdown', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  private setupGracefulShutdown(): void {
    process.on('SIGTERM', async () => {
      logger.info('Received SIGTERM, shutting down gracefully...');
      try {
        await this.shutdown();
        process.exit(0);
      } catch (error) {
        logger.error('Error during graceful shutdown', {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        process.exit(1);
      }
    });

    process.on('SIGINT', async () => {
      logger.info('Received SIGINT, shutting down gracefully...');
      try {
        await this.shutdown();
        process.exit(0);
      } catch (error) {
        logger.error('Error during graceful shutdown', {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        process.exit(1);
      }
    });
  }

  // Health check method
  public async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    queues: Record<string, any>;
    scheduledJobs: string[];
  }> {
    try {
      const queueStats = await this.getQueueStats();
      const scheduledJobNames = Array.from(this.scheduledJobs.keys());

      // Determine overall health
      let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

      // Check for unhealthy conditions
      const hasHighFailureRate = Object.values(queueStats).some(
        stats => typeof stats === 'object' && stats.failed > 50
      );

      const hasStuckJobs = Object.values(queueStats).some(
        stats => typeof stats === 'object' && stats.active > 200
      );

      if (hasHighFailureRate || hasStuckJobs) {
        status = 'unhealthy';
      } else if (Object.values(queueStats).some(
        stats => typeof stats === 'object' && (stats.failed > 10 || stats.active > 100)
      )) {
        status = 'degraded';
      }

      return {
        status,
        queues: queueStats,
        scheduledJobs: scheduledJobNames,
      };
    } catch (error) {
      logger.error('Health check failed', {
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

// Export singleton instance
export const jobScheduler = new JobScheduler();