import Bull, { Job } from 'bull';
import { queueManager, JobTypes } from '@/queues';
import { DatabaseService } from '@/services/DatabaseService';
import { CacheService } from '@/services/CacheService';
import { StorageService } from '@/services/StorageService';
import logger from '@/config/logger';
import { prisma } from '@/config/database';

export interface DataCleanupJobData {
  type: 'sessions' | 'locations' | 'cache' | 'logs' | 'temp_files' | 'expired_tokens' | 'old_analytics';
  maxAge?: number; // Age in milliseconds
  batchSize?: number;
  dryRun?: boolean;
}

export interface CleanupResult {
  type: string;
  itemsProcessed: number;
  itemsDeleted: number;
  spaceSaved: number; // in bytes
  duration: number; // in milliseconds
  errors: string[];
}

class DataCleanupJobProcessor {
  private databaseService: DatabaseService;
  private cacheService: CacheService;
  private storageService: StorageService;

  constructor() {
    this.databaseService = new DatabaseService();
    this.cacheService = new CacheService();
    this.storageService = new StorageService();
    this.setupProcessor();
  }

  private setupProcessor() {
    const queue = queueManager.getQueue(JobTypes.DATA_CLEANUP);
    if (queue) {
      queue.process('*', this.processCleanup.bind(this));
      logger.info('Data cleanup job processor initialized');
    }
  }

  public async processCleanup(job: Job<DataCleanupJobData>): Promise<CleanupResult> {
    const startTime = Date.now();
    const { type, maxAge, batchSize = 1000, dryRun = false } = job.data;

    try {
      logger.info('Starting data cleanup job', {
        jobId: job.id,
        type,
        maxAge,
        batchSize,
        dryRun,
      });

      await job.progress(5);

      let result: CleanupResult;

      switch (type) {
        case 'sessions':
          result = await this.cleanupExpiredSessions(maxAge, batchSize, dryRun, job);
          break;
        
        case 'locations':
          result = await this.cleanupOldLocations(maxAge, batchSize, dryRun, job);
          break;
        
        case 'cache':
          result = await this.cleanupCache(maxAge, dryRun, job);
          break;
        
        case 'logs':
          result = await this.cleanupOldLogs(maxAge, batchSize, dryRun, job);
          break;
        
        case 'temp_files':
          result = await this.cleanupTempFiles(maxAge, dryRun, job);
          break;
        
        case 'expired_tokens':
          result = await this.cleanupExpiredTokens(batchSize, dryRun, job);
          break;
        
        case 'old_analytics':
          result = await this.cleanupOldAnalytics(maxAge, batchSize, dryRun, job);
          break;
        
        default:
          throw new Error(`Unknown cleanup type: ${type}`);
      }

      result.duration = Date.now() - startTime;
      await job.progress(100);

      logger.info('Data cleanup job completed', {
        jobId: job.id,
        ...result,
      });

      return result;
    } catch (error) {
      logger.error('Data cleanup job failed', {
        jobId: job.id,
        type,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  private async cleanupExpiredSessions(
    maxAge: number = 7 * 24 * 60 * 60 * 1000, // 7 days
    batchSize: number,
    dryRun: boolean,
    job: Job
  ): Promise<CleanupResult> {
    const cutoffDate = new Date(Date.now() - maxAge);
    let itemsProcessed = 0;
    let itemsDeleted = 0;
    const errors: string[] = [];

    try {
      // Count expired sessions
      const expiredCount = await prisma.session.count({
        where: {
          expiresAt: {
            lt: cutoffDate,
          },
        },
      });

      itemsProcessed = expiredCount;
      await job.progress(20);

      if (!dryRun && expiredCount > 0) {
        // Delete in batches
        let processed = 0;
        while (processed < expiredCount) {
          const batch = await prisma.session.findMany({
            where: {
              expiresAt: {
                lt: cutoffDate,
              },
            },
            take: batchSize,
            select: { id: true },
          });

          if (batch.length === 0) break;

          const deleteResult = await prisma.session.deleteMany({
            where: {
              id: {
                in: batch.map(s => s.id),
              },
            },
          });

          itemsDeleted += deleteResult.count;
          processed += batch.length;

          const progress = Math.min(90, 20 + (processed / expiredCount) * 70);
          await job.progress(progress);

          // Small delay to prevent overwhelming the database
          if (processed < expiredCount) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        }
      } else {
        itemsDeleted = dryRun ? 0 : itemsProcessed;
      }
    } catch (error) {
      errors.push(`Session cleanup error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return {
      type: 'sessions',
      itemsProcessed,
      itemsDeleted,
      spaceSaved: itemsDeleted * 512, // Estimate 512 bytes per session
      duration: 0, // Will be set by caller
      errors,
    };
  }

  private async cleanupOldLocations(
    maxAge: number = 30 * 24 * 60 * 60 * 1000, // 30 days
    batchSize: number,
    dryRun: boolean,
    job: Job
  ): Promise<CleanupResult> {
    const cutoffDate = new Date(Date.now() - maxAge);
    let itemsProcessed = 0;
    let itemsDeleted = 0;
    const errors: string[] = [];

    try {
      // Count old location records
      const oldLocationCount = await prisma.userLocation.count({
        where: {
          createdAt: {
            lt: cutoffDate,
          },
        },
      });

      itemsProcessed = oldLocationCount;
      await job.progress(20);

      if (!dryRun && oldLocationCount > 0) {
        // Delete in batches
        let processed = 0;
        while (processed < oldLocationCount) {
          const batch = await prisma.userLocation.findMany({
            where: {
              createdAt: {
                lt: cutoffDate,
              },
            },
            take: batchSize,
            select: { id: true },
          });

          if (batch.length === 0) break;

          const deleteResult = await prisma.userLocation.deleteMany({
            where: {
              id: {
                in: batch.map(l => l.id),
              },
            },
          });

          itemsDeleted += deleteResult.count;
          processed += batch.length;

          const progress = Math.min(90, 20 + (processed / oldLocationCount) * 70);
          await job.progress(progress);

          if (processed < oldLocationCount) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        }
      } else {
        itemsDeleted = dryRun ? 0 : itemsProcessed;
      }
    } catch (error) {
      errors.push(`Location cleanup error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return {
      type: 'locations',
      itemsProcessed,
      itemsDeleted,
      spaceSaved: itemsDeleted * 256, // Estimate 256 bytes per location record
      duration: 0,
      errors,
    };
  }

  private async cleanupCache(
    maxAge: number = 24 * 60 * 60 * 1000, // 24 hours
    dryRun: boolean,
    job: Job
  ): Promise<CleanupResult> {
    let itemsProcessed = 0;
    let itemsDeleted = 0;
    const errors: string[] = [];

    try {
      await job.progress(20);

      // Clean expired cache entries
      const cacheStats = await this.cacheService.getStats();
      itemsProcessed = cacheStats.keys || 0;

      if (!dryRun) {
        const deletedKeys = await this.cacheService.cleanupExpired(maxAge);
        itemsDeleted = deletedKeys.length;
      }

      await job.progress(90);
    } catch (error) {
      errors.push(`Cache cleanup error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return {
      type: 'cache',
      itemsProcessed,
      itemsDeleted,
      spaceSaved: itemsDeleted * 1024, // Estimate 1KB per cache entry
      duration: 0,
      errors,
    };
  }

  private async cleanupOldLogs(
    maxAge: number = 7 * 24 * 60 * 60 * 1000, // 7 days
    batchSize: number,
    dryRun: boolean,
    job: Job
  ): Promise<CleanupResult> {
    const cutoffDate = new Date(Date.now() - maxAge);
    let itemsProcessed = 0;
    let itemsDeleted = 0;
    const errors: string[] = [];

    try {
      // Count old log entries
      const oldLogCount = await prisma.systemLog.count({
        where: {
          createdAt: {
            lt: cutoffDate,
          },
        },
      });

      itemsProcessed = oldLogCount;
      await job.progress(20);

      if (!dryRun && oldLogCount > 0) {
        // Delete in batches
        let processed = 0;
        while (processed < oldLogCount) {
          const deleteResult = await prisma.systemLog.deleteMany({
            where: {
              createdAt: {
                lt: cutoffDate,
              },
            },
          });

          itemsDeleted += deleteResult.count;
          processed += deleteResult.count;

          const progress = Math.min(90, 20 + (processed / oldLogCount) * 70);
          await job.progress(progress);

          if (deleteResult.count === 0) break;

          if (processed < oldLogCount) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        }
      } else {
        itemsDeleted = dryRun ? 0 : itemsProcessed;
      }
    } catch (error) {
      errors.push(`Log cleanup error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return {
      type: 'logs',
      itemsProcessed,
      itemsDeleted,
      spaceSaved: itemsDeleted * 2048, // Estimate 2KB per log entry
      duration: 0,
      errors,
    };
  }

  private async cleanupTempFiles(
    maxAge: number = 24 * 60 * 60 * 1000, // 24 hours
    dryRun: boolean,
    job: Job
  ): Promise<CleanupResult> {
    let itemsProcessed = 0;
    let itemsDeleted = 0;
    let spaceSaved = 0;
    const errors: string[] = [];

    try {
      await job.progress(20);

      const tempFiles = await this.storageService.listTempFiles();
      itemsProcessed = tempFiles.length;

      const cutoffDate = Date.now() - maxAge;
      const filesToDelete = tempFiles.filter(file => file.lastModified < cutoffDate);

      await job.progress(50);

      if (!dryRun) {
        for (const file of filesToDelete) {
          try {
            await this.storageService.deleteFile(file.path);
            spaceSaved += file.size;
            itemsDeleted++;
          } catch (error) {
            errors.push(`Failed to delete ${file.path}: ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
        }
      } else {
        itemsDeleted = filesToDelete.length;
        spaceSaved = filesToDelete.reduce((total, file) => total + file.size, 0);
      }

      await job.progress(90);
    } catch (error) {
      errors.push(`Temp file cleanup error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return {
      type: 'temp_files',
      itemsProcessed,
      itemsDeleted,
      spaceSaved,
      duration: 0,
      errors,
    };
  }

  private async cleanupExpiredTokens(
    batchSize: number,
    dryRun: boolean,
    job: Job
  ): Promise<CleanupResult> {
    let itemsProcessed = 0;
    let itemsDeleted = 0;
    const errors: string[] = [];

    try {
      const now = new Date();

      // Count expired tokens
      const expiredTokenCount = await prisma.refreshToken.count({
        where: {
          expiresAt: {
            lt: now,
          },
        },
      });

      itemsProcessed = expiredTokenCount;
      await job.progress(20);

      if (!dryRun && expiredTokenCount > 0) {
        const deleteResult = await prisma.refreshToken.deleteMany({
          where: {
            expiresAt: {
              lt: now,
            },
          },
        });

        itemsDeleted = deleteResult.count;
      } else {
        itemsDeleted = dryRun ? 0 : itemsProcessed;
      }

      await job.progress(90);
    } catch (error) {
      errors.push(`Token cleanup error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return {
      type: 'expired_tokens',
      itemsProcessed,
      itemsDeleted,
      spaceSaved: itemsDeleted * 128, // Estimate 128 bytes per token
      duration: 0,
      errors,
    };
  }

  private async cleanupOldAnalytics(
    maxAge: number = 90 * 24 * 60 * 60 * 1000, // 90 days
    batchSize: number,
    dryRun: boolean,
    job: Job
  ): Promise<CleanupResult> {
    const cutoffDate = new Date(Date.now() - maxAge);
    let itemsProcessed = 0;
    let itemsDeleted = 0;
    const errors: string[] = [];

    try {
      // Count old analytics records
      const oldAnalyticsCount = await prisma.userAnalytics.count({
        where: {
          createdAt: {
            lt: cutoffDate,
          },
        },
      });

      itemsProcessed = oldAnalyticsCount;
      await job.progress(20);

      if (!dryRun && oldAnalyticsCount > 0) {
        let processed = 0;
        while (processed < oldAnalyticsCount) {
          const deleteResult = await prisma.userAnalytics.deleteMany({
            where: {
              createdAt: {
                lt: cutoffDate,
              },
            },
          });

          itemsDeleted += deleteResult.count;
          processed += deleteResult.count;

          const progress = Math.min(90, 20 + (processed / oldAnalyticsCount) * 70);
          await job.progress(progress);

          if (deleteResult.count === 0) break;

          if (processed < oldAnalyticsCount) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        }
      } else {
        itemsDeleted = dryRun ? 0 : itemsProcessed;
      }
    } catch (error) {
      errors.push(`Analytics cleanup error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return {
      type: 'old_analytics',
      itemsProcessed,
      itemsDeleted,
      spaceSaved: itemsDeleted * 1024, // Estimate 1KB per analytics record
      duration: 0,
      errors,
    };
  }
}

// Initialize the processor
export const dataCleanupProcessor = new DataCleanupJobProcessor();

// Helper function to schedule cleanup job
export async function scheduleDataCleanup(
  data: DataCleanupJobData,
  options: Bull.JobOptions = {}
): Promise<Bull.Job> {
  return queueManager.addJob(JobTypes.DATA_CLEANUP, data, {
    priority: 10, // Low priority
    ...options,
  });
}

// Schedule regular cleanup jobs
export async function scheduleRegularCleanups(): Promise<void> {
  // Daily session cleanup
  await queueManager.scheduleJob(
    JobTypes.DATA_CLEANUP,
    '0 2 * * *', // 2 AM daily
    { type: 'sessions' }
  );

  // Weekly location cleanup
  await queueManager.scheduleJob(
    JobTypes.DATA_CLEANUP,
    '0 3 * * 0', // 3 AM on Sundays
    { type: 'locations' }
  );

  // Daily cache cleanup
  await queueManager.scheduleJob(
    JobTypes.DATA_CLEANUP,
    '0 1 * * *', // 1 AM daily
    { type: 'cache' }
  );

  // Weekly log cleanup
  await queueManager.scheduleJob(
    JobTypes.DATA_CLEANUP,
    '0 4 * * 0', // 4 AM on Sundays
    { type: 'logs' }
  );

  // Daily temp file cleanup
  await queueManager.scheduleJob(
    JobTypes.DATA_CLEANUP,
    '0 5 * * *', // 5 AM daily
    { type: 'temp_files' }
  );

  // Daily expired token cleanup
  await queueManager.scheduleJob(
    JobTypes.DATA_CLEANUP,
    '0 6 * * *', // 6 AM daily
    { type: 'expired_tokens' }
  );

  // Monthly analytics cleanup
  await queueManager.scheduleJob(
    JobTypes.DATA_CLEANUP,
    '0 7 1 * *', // 7 AM on the 1st of each month
    { type: 'old_analytics' }
  );

  logger.info('Regular cleanup jobs scheduled');
}