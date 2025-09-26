// Export all job types and interfaces
export * from '@/queues';

// Export job processors and their functions
export * from './routeOptimization';
export * from './notifications';
export * from './dataCleanup';
export * from './analytics';

// Export job scheduler
export * from './scheduler';

// Job management utilities
import { jobScheduler } from './scheduler';
import { queueManager, JobTypes } from '@/queues';
import logger from '@/config/logger';

// Main initialization function for the job system
export async function initializeJobSystem(): Promise<void> {
  try {
    logger.info('Initializing job system...');
    
    // Initialize the job scheduler which will set up all processors and recurring jobs
    await jobScheduler.initialize();
    
    logger.info('Job system initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize job system', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

// Graceful shutdown function for the job system
export async function shutdownJobSystem(): Promise<void> {
  try {
    logger.info('Shutting down job system...');
    
    // Shutdown the job scheduler
    await jobScheduler.shutdown();
    
    logger.info('Job system shut down successfully');
  } catch (error) {
    logger.error('Failed to shutdown job system', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

// Health check for the job system
export async function checkJobSystemHealth(): Promise<{
  status: 'healthy' | 'degraded' | 'unhealthy';
  details: any;
}> {
  try {
    const health = await jobScheduler.healthCheck();
    
    return {
      status: health.status,
      details: {
        queues: health.queues,
        scheduledJobs: health.scheduledJobs,
        timestamp: new Date().toISOString(),
      },
    };
  } catch (error) {
    logger.error('Job system health check failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    
    return {
      status: 'unhealthy',
      details: {
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
    };
  }
}

// Utility functions for common job operations
export const JobUtils = {
  // Add a route optimization job
  async optimizeRoute(routeData: {
    userId: string;
    routeId: string;
    waypoints: Array<{
      lat: number;
      lng: number;
      placeId?: string;
      name?: string;
    }>;
    preferences: {
      mode: 'driving' | 'walking' | 'bicycling' | 'transit';
      avoidTolls?: boolean;
      avoidHighways?: boolean;
      avoidFerries?: boolean;
      optimize?: boolean;
    };
    priority?: 'high' | 'normal' | 'low';
  }) {
    return queueManager.addJob(JobTypes.ROUTE_OPTIMIZATION, routeData);
  },

  // Send a notification
  async sendNotification(notificationData: {
    userId: string;
    type: 'email' | 'push' | 'in-app' | 'sms';
    template: string;
    data: Record<string, any>;
    priority?: 'high' | 'normal' | 'low';
    scheduleAt?: Date;
  }) {
    return queueManager.addJob(JobTypes.NOTIFICATION_SEND, notificationData);
  },

  // Track user analytics event
  async trackUserEvent(eventData: {
    userId: string;
    eventType: 'route_created' | 'route_completed' | 'place_saved' | 'location_shared' | 'search_performed';
    eventData: Record<string, any>;
    timestamp: Date;
    location?: {
      lat: number;
      lng: number;
    };
  }) {
    return queueManager.addJob(JobTypes.USER_ANALYTICS, eventData);
  },

  // Schedule data cleanup
  async scheduleCleanup(cleanupData: {
    type: 'sessions' | 'locations' | 'cache' | 'logs' | 'temp_files' | 'expired_tokens' | 'old_analytics';
    maxAge?: number;
    batchSize?: number;
    dryRun?: boolean;
  }) {
    return queueManager.addJob(JobTypes.DATA_CLEANUP, cleanupData);
  },

  // Process analytics
  async processAnalytics(analyticsData: {
    type: 'daily_summary' | 'weekly_report' | 'monthly_report' | 'user_behavior' | 'route_analytics' | 'location_patterns';
    userId?: string;
    dateRange: {
      startDate: Date;
      endDate: Date;
    };
    includeComparison?: boolean;
    sendReport?: boolean;
    reportFormat?: 'email' | 'in-app' | 'both';
  }) {
    return queueManager.addJob(JobTypes.ANALYTICS_PROCESS, analyticsData);
  },

  // Get queue statistics
  async getQueueStats() {
    return queueManager.getAllQueueStats();
  },

  // Pause/resume queues
  async pauseQueue(jobType: JobTypes) {
    return queueManager.pauseQueue(jobType);
  },

  async resumeQueue(jobType: JobTypes) {
    return queueManager.resumeQueue(jobType);
  },

  // Schedule one-time job
  async scheduleOneTimeJob(jobType: JobTypes, data: any, delay: number = 0) {
    return jobScheduler.scheduleOneTimeJob(jobType, data, delay);
  },

  // Schedule recurring job
  async scheduleRecurringJob(
    jobType: JobTypes,
    cronPattern: string,
    data: any,
    name: string
  ) {
    return jobScheduler.scheduleRecurringJob(jobType, cronPattern, data, name);
  },

  // Stop recurring job
  stopRecurringJob(name: string) {
    return jobScheduler.stopRecurringJob(name);
  },
};

// Export common job constants
export const JOB_PRIORITIES = {
  HIGH: 1,
  NORMAL: 5,
  LOW: 10,
} as const;

export const JOB_RETRY_DELAYS = {
  IMMEDIATE: 0,
  SHORT: 30000, // 30 seconds
  MEDIUM: 300000, // 5 minutes
  LONG: 3600000, // 1 hour
} as const;

export const CLEANUP_INTERVALS = {
  SESSIONS: 7 * 24 * 60 * 60 * 1000, // 7 days
  LOCATIONS: 30 * 24 * 60 * 60 * 1000, // 30 days
  CACHE: 24 * 60 * 60 * 1000, // 24 hours
  LOGS: 7 * 24 * 60 * 60 * 1000, // 7 days
  TEMP_FILES: 24 * 60 * 60 * 1000, // 24 hours
  ANALYTICS: 90 * 24 * 60 * 60 * 1000, // 90 days
} as const;