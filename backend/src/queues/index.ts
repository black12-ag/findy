import Bull from 'bull';
import { getRedisClient } from '@/config/redis';
import logger from '@/config/logger';

// Job types
export enum JobTypes {
  ROUTE_OPTIMIZATION = 'route:optimization',
  NOTIFICATION_SEND = 'notification:send',
  NOTIFICATION_SCHEDULE = 'notification:schedule',
  DATA_CLEANUP = 'data:cleanup',
  ANALYTICS_PROCESS = 'analytics:process',
  USER_ANALYTICS = 'user:analytics',
  LOCATION_CLEANUP = 'location:cleanup',
  SESSION_CLEANUP = 'session:cleanup',
  EMAIL_SEND = 'email:send',
  CACHE_WARM = 'cache:warm',
  BACKUP_DATABASE = 'backup:database',
}

// Queue configurations
const queueConfigs: Record<JobTypes, any> = {
  [JobTypes.ROUTE_OPTIMIZATION]: {
    priority: 'high',
    attempts: 3,
    delay: 0,
    removeOnComplete: 50,
    removeOnFail: 20,
  },
  [JobTypes.NOTIFICATION_SEND]: {
    priority: 'high',
    attempts: 5,
    delay: 0,
    removeOnComplete: 100,
    removeOnFail: 50,
  },
  [JobTypes.NOTIFICATION_SCHEDULE]: {
    priority: 'normal',
    attempts: 3,
    delay: 0,
    removeOnComplete: 100,
    removeOnFail: 20,
  },
  [JobTypes.DATA_CLEANUP]: {
    priority: 'low',
    attempts: 2,
    delay: 0,
    removeOnComplete: 10,
    removeOnFail: 5,
  },
  [JobTypes.ANALYTICS_PROCESS]: {
    priority: 'normal',
    attempts: 3,
    delay: 0,
    removeOnComplete: 50,
    removeOnFail: 20,
  },
  [JobTypes.USER_ANALYTICS]: {
    priority: 'normal',
    attempts: 3,
    delay: 0,
    removeOnComplete: 50,
    removeOnFail: 20,
  },
  [JobTypes.LOCATION_CLEANUP]: {
    priority: 'low',
    attempts: 2,
    delay: 0,
    removeOnComplete: 10,
    removeOnFail: 5,
  },
  [JobTypes.SESSION_CLEANUP]: {
    priority: 'low',
    attempts: 2,
    delay: 0,
    removeOnComplete: 10,
    removeOnFail: 5,
  },
  [JobTypes.EMAIL_SEND]: {
    priority: 'normal',
    attempts: 5,
    delay: 0,
    removeOnComplete: 100,
    removeOnFail: 50,
  },
  [JobTypes.CACHE_WARM]: {
    priority: 'low',
    attempts: 2,
    delay: 0,
    removeOnComplete: 5,
    removeOnFail: 2,
  },
  [JobTypes.BACKUP_DATABASE]: {
    priority: 'low',
    attempts: 2,
    delay: 0,
    removeOnComplete: 3,
    removeOnFail: 3,
  },
};

export class QueueManager {
  private queues: Map<JobTypes, Bull.Queue> = new Map();
  private redisClient = getRedisClient();

  constructor() {
    this.initializeQueues();
    this.setupEventHandlers();
  }

  private initializeQueues() {
    // Create queues for each job type
    Object.values(JobTypes).forEach(jobType => {
      try {
        const queue = new Bull(jobType, {
          redis: process.env.REDIS_URL || {
            host: process.env.REDIS_HOST || 'localhost',
            port: parseInt(process.env.REDIS_PORT || '6379'),
            password: process.env.REDIS_PASSWORD,
          },
          defaultJobOptions: {
            removeOnComplete: queueConfigs[jobType]?.removeOnComplete || 10,
            removeOnFail: queueConfigs[jobType]?.removeOnFail || 5,
            attempts: queueConfigs[jobType]?.attempts || 3,
            backoff: {
              type: 'exponential',
              delay: 2000,
            },
          },
        });

        this.queues.set(jobType, queue);
        logger.info(`Queue initialized: ${jobType}`);
      } catch (error) {
        logger.error(`Failed to initialize queue: ${jobType}`, {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    });
  }

  private setupEventHandlers() {
    this.queues.forEach((queue, jobType) => {
      queue.on('completed', (job) => {
        logger.info(`Job completed: ${jobType}`, {
          jobId: job.id,
          data: job.data,
          duration: Date.now() - job.timestamp,
        });
      });

      queue.on('failed', (job, err) => {
        logger.error(`Job failed: ${jobType}`, {
          jobId: job.id,
          error: err.message,
          data: job.data,
          attempts: job.attemptsMade,
        });
      });

      queue.on('stalled', (job) => {
        logger.warn(`Job stalled: ${jobType}`, {
          jobId: job.id,
          data: job.data,
        });
      });

      queue.on('error', (error) => {
        logger.error(`Queue error: ${jobType}`, { error });
      });
    });
  }

  // Add job to queue
  public async addJob(
    jobType: JobTypes,
    data: any,
    options: Bull.JobOptions = {}
  ): Promise<Bull.Job> {
    const queue = this.queues.get(jobType);
    if (!queue) {
      throw new Error(`Queue not found for job type: ${jobType}`);
    }

    const job = await queue.add(data, {
      ...queueConfigs[jobType],
      ...options,
    });

    logger.info(`Job added to queue: ${jobType}`, {
      jobId: job.id,
      data,
      options,
    });

    return job;
  }

  // Schedule recurring job
  public async scheduleJob(
    jobType: JobTypes,
    cronPattern: string,
    data: any = {}
  ): Promise<Bull.Job> {
    const queue = this.queues.get(jobType);
    if (!queue) {
      throw new Error(`Queue not found for job type: ${jobType}`);
    }

    const job = await queue.add(data, {
      repeat: { cron: cronPattern },
      ...queueConfigs[jobType],
    });

    logger.info(`Scheduled job: ${jobType}`, {
      jobId: job.id,
      cronPattern,
      data,
    });

    return job;
  }

  // Get queue stats
  public async getQueueStats(jobType: JobTypes) {
    const queue = this.queues.get(jobType);
    if (!queue) {
      throw new Error(`Queue not found for job type: ${jobType}`);
    }

    const [waiting, active, completed, failed, delayed] = await Promise.all([
      queue.getWaiting(),
      queue.getActive(),
      queue.getCompleted(),
      queue.getFailed(),
      queue.getDelayed(),
    ]);

    return {
      waiting: waiting.length,
      active: active.length,
      completed: completed.length,
      failed: failed.length,
      delayed: delayed.length,
    };
  }

  // Get all queue stats
  public async getAllQueueStats() {
    const stats: Record<string, any> = {};

    for (const [jobType] of this.queues.entries()) {
      try {
        stats[jobType] = await this.getQueueStats(jobType);
      } catch (error) {
        logger.error(`Error getting stats for queue: ${jobType}`, { error });
        stats[jobType] = { error: error instanceof Error ? error.message : 'Unknown error' };
      }
    }

    return stats;
  }

  // Clean completed jobs
  public async cleanCompletedJobs(jobType: JobTypes, maxAge: number = 24 * 60 * 60 * 1000) {
    const queue = this.queues.get(jobType);
    if (!queue) {
      throw new Error(`Queue not found for job type: ${jobType}`);
    }

    await queue.clean(maxAge, 'completed');
    await queue.clean(maxAge, 'failed');

    logger.info(`Cleaned old jobs for queue: ${jobType}`, { maxAge });
  }

  // Get queue instance
  public getQueue(jobType: JobTypes): Bull.Queue | undefined {
    return this.queues.get(jobType);
  }

  // Close all queues
  public async close(): Promise<void> {
    const closePromises = Array.from(this.queues.values()).map(queue => queue.close());
    await Promise.all(closePromises);
    logger.info('All queues closed');
  }

  // Pause queue
  public async pauseQueue(jobType: JobTypes): Promise<void> {
    const queue = this.queues.get(jobType);
    if (queue) {
      await queue.pause();
      logger.info(`Queue paused: ${jobType}`);
    }
  }

  // Resume queue
  public async resumeQueue(jobType: JobTypes): Promise<void> {
    const queue = this.queues.get(jobType);
    if (queue) {
      await queue.resume();
      logger.info(`Queue resumed: ${jobType}`);
    }
  }
}

// Export singleton instance
export const queueManager = new QueueManager();