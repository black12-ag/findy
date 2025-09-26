import Bull, { Job } from 'bull';
import { queueManager, JobTypes } from '@/queues';
import { AnalyticsService } from '@/services/AnalyticsService';
import { NotificationService } from '@/services/NotificationService';
import logger from '@/config/logger';
import { prisma } from '@/config/database';

export interface AnalyticsProcessingJobData {
  type: 'daily_summary' | 'weekly_report' | 'monthly_report' | 'user_behavior' | 'route_analytics' | 'location_patterns';
  userId?: string; // For user-specific analytics
  dateRange: {
    startDate: Date;
    endDate: Date;
  };
  includeComparison?: boolean;
  sendReport?: boolean;
  reportFormat?: 'email' | 'in-app' | 'both';
}

export interface UserAnalyticsJobData {
  userId: string;
  eventType: 'route_created' | 'route_completed' | 'place_saved' | 'location_shared' | 'search_performed';
  eventData: Record<string, any>;
  timestamp: Date;
  location?: {
    lat: number;
    lng: number;
  };
}

export interface AnalyticsResult {
  type: string;
  userId?: string;
  dateRange: {
    startDate: Date;
    endDate: Date;
  };
  metrics: Record<string, any>;
  insights: string[];
  recommendations: string[];
}

class AnalyticsJobProcessor {
  private analyticsService: AnalyticsService;
  private notificationService: NotificationService;

  constructor() {
    this.analyticsService = new AnalyticsService();
    this.notificationService = new NotificationService();
    this.setupProcessors();
  }

  private setupProcessors() {
    const processQueue = queueManager.getQueue(JobTypes.ANALYTICS_PROCESS);
    const userQueue = queueManager.getQueue(JobTypes.USER_ANALYTICS);

    if (processQueue) {
      processQueue.process('*', this.processAnalytics.bind(this));
      logger.info('Analytics processing job processor initialized');
    }

    if (userQueue) {
      userQueue.process('*', this.processUserEvent.bind(this));
      logger.info('User analytics job processor initialized');
    }
  }

  public async processAnalytics(job: Job<AnalyticsProcessingJobData>): Promise<AnalyticsResult> {
    const { type, userId, dateRange, includeComparison, sendReport, reportFormat } = job.data;

    try {
      logger.info('Starting analytics processing job', {
        jobId: job.id,
        type,
        userId,
        dateRange,
      });

      await job.progress(10);

      let result: AnalyticsResult;

      switch (type) {
        case 'daily_summary':
          result = await this.generateDailySummary(userId, dateRange, includeComparison, job);
          break;
        
        case 'weekly_report':
          result = await this.generateWeeklyReport(userId, dateRange, includeComparison, job);
          break;
        
        case 'monthly_report':
          result = await this.generateMonthlyReport(userId, dateRange, includeComparison, job);
          break;
        
        case 'user_behavior':
          result = await this.analyzeUserBehavior(userId!, dateRange, job);
          break;
        
        case 'route_analytics':
          result = await this.analyzeRoutePatterns(userId, dateRange, job);
          break;
        
        case 'location_patterns':
          result = await this.analyzeLocationPatterns(userId, dateRange, job);
          break;
        
        default:
          throw new Error(`Unknown analytics type: ${type}`);
      }

      await job.progress(90);

      // Send report if requested
      if (sendReport && userId) {
        await this.sendAnalyticsReport(userId, result, reportFormat || 'in-app');
      }

      await job.progress(100);

      logger.info('Analytics processing job completed', {
        jobId: job.id,
        type,
        userId,
        metricsCount: Object.keys(result.metrics).length,
        insightsCount: result.insights.length,
      });

      return result;
    } catch (error) {
      logger.error('Analytics processing job failed', {
        jobId: job.id,
        type,
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  public async processUserEvent(job: Job<UserAnalyticsJobData>): Promise<void> {
    const { userId, eventType, eventData, timestamp, location } = job.data;

    try {
      logger.info('Processing user analytics event', {
        jobId: job.id,
        userId,
        eventType,
        timestamp,
      });

      await job.progress(20);

      // Store the analytics event
      await prisma.userAnalytics.create({
        data: {
          userId,
          eventType,
          eventData: JSON.stringify(eventData),
          timestamp,
          location: location ? JSON.stringify(location) : null,
          metadata: JSON.stringify({
            processed: true,
            jobId: job.id,
          }),
        },
      });

      await job.progress(60);

      // Update user statistics
      await this.updateUserStatistics(userId, eventType, eventData);

      await job.progress(80);

      // Check for milestones or achievements
      await this.checkUserMilestones(userId, eventType, eventData);

      await job.progress(100);

      logger.info('User analytics event processed successfully', {
        jobId: job.id,
        userId,
        eventType,
      });
    } catch (error) {
      logger.error('User analytics event processing failed', {
        jobId: job.id,
        userId,
        eventType,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  private async generateDailySummary(
    userId: string | undefined,
    dateRange: AnalyticsProcessingJobData['dateRange'],
    includeComparison: boolean = false,
    job: Job
  ): Promise<AnalyticsResult> {
    const metrics: Record<string, any> = {};
    const insights: string[] = [];
    const recommendations: string[] = [];

    await job.progress(20);

    // Get basic metrics for the day
    const baseQuery = userId ? { userId } : {};
    const dateFilter = {
      createdAt: {
        gte: dateRange.startDate,
        lte: dateRange.endDate,
      },
    };

    // Route metrics
    const routeCount = await prisma.route.count({
      where: { ...baseQuery, ...dateFilter },
    });

    const completedRoutes = await prisma.route.count({
      where: { 
        ...baseQuery, 
        ...dateFilter,
        status: 'completed',
      },
    });

    await job.progress(40);

    // Location metrics
    const locationEvents = await prisma.userLocation.count({
      where: { ...baseQuery, ...dateFilter },
    });

    // Place interactions
    const placeInteractions = await prisma.savedPlace.count({
      where: { ...baseQuery, ...dateFilter },
    });

    await job.progress(60);

    metrics.routes = {
      created: routeCount,
      completed: completedRoutes,
      completionRate: routeCount > 0 ? (completedRoutes / routeCount) * 100 : 0,
    };

    metrics.locations = {
      events: locationEvents,
    };

    metrics.places = {
      saved: placeInteractions,
    };

    await job.progress(80);

    // Generate insights
    if (completedRoutes > 0) {
      insights.push(`Completed ${completedRoutes} routes today`);
    }

    if (routeCount > completedRoutes) {
      const incompleteRoutes = routeCount - completedRoutes;
      insights.push(`${incompleteRoutes} routes were started but not completed`);
      recommendations.push('Consider reviewing incomplete routes and optimizing route planning');
    }

    if (placeInteractions > 5) {
      insights.push(`High place engagement with ${placeInteractions} interactions`);
      recommendations.push('Share your favorite places with friends');
    }

    return {
      type: 'daily_summary',
      userId,
      dateRange,
      metrics,
      insights,
      recommendations,
    };
  }

  private async generateWeeklyReport(
    userId: string | undefined,
    dateRange: AnalyticsProcessingJobData['dateRange'],
    includeComparison: boolean = false,
    job: Job
  ): Promise<AnalyticsResult> {
    const metrics: Record<string, any> = {};
    const insights: string[] = [];
    const recommendations: string[] = [];

    await job.progress(20);

    const baseQuery = userId ? { userId } : {};
    const dateFilter = {
      createdAt: {
        gte: dateRange.startDate,
        lte: dateRange.endDate,
      },
    };

    // Weekly route statistics
    const routes = await prisma.route.findMany({
      where: { ...baseQuery, ...dateFilter },
      select: {
        id: true,
        status: true,
        distance: true,
        duration: true,
        createdAt: true,
      },
    });

    await job.progress(40);

    const totalDistance = routes.reduce((sum, route) => sum + (route.distance || 0), 0);
    const totalDuration = routes.reduce((sum, route) => sum + (route.duration || 0), 0);
    const completedRoutes = routes.filter(r => r.status === 'completed');

    // Daily breakdown
    const dailyBreakdown: Record<string, number> = {};
    routes.forEach(route => {
      const day = route.createdAt.toISOString().split('T')[0];
      dailyBreakdown[day] = (dailyBreakdown[day] || 0) + 1;
    });

    await job.progress(60);

    metrics.routes = {
      total: routes.length,
      completed: completedRoutes.length,
      totalDistance: Math.round(totalDistance / 1000), // Convert to km
      totalDuration: Math.round(totalDuration / 60), // Convert to minutes
      averageDistance: routes.length > 0 ? Math.round(totalDistance / routes.length / 1000) : 0,
      dailyBreakdown,
    };

    // User activity patterns
    const locationEvents = await prisma.userLocation.groupBy({
      by: ['userId'],
      where: { ...baseQuery, ...dateFilter },
      _count: {
        id: true,
      },
    });

    await job.progress(80);

    metrics.activity = {
      locationUpdates: locationEvents.reduce((sum, item) => sum + item._count.id, 0),
      activeUsers: locationEvents.length,
    };

    // Generate insights
    if (completedRoutes.length > 0) {
      const avgDistance = totalDistance / completedRoutes.length / 1000;
      insights.push(`Average route distance: ${Math.round(avgDistance)}km`);
      
      if (avgDistance > 10) {
        recommendations.push('Consider breaking longer routes into segments for better navigation');
      }
    }

    const mostActiveDay = Object.entries(dailyBreakdown)
      .reduce((max, [day, count]) => count > max.count ? { day, count } : max, { day: '', count: 0 });

    if (mostActiveDay.day) {
      insights.push(`Most active day was ${mostActiveDay.day} with ${mostActiveDay.count} routes`);
    }

    return {
      type: 'weekly_report',
      userId,
      dateRange,
      metrics,
      insights,
      recommendations,
    };
  }

  private async generateMonthlyReport(
    userId: string | undefined,
    dateRange: AnalyticsProcessingJobData['dateRange'],
    includeComparison: boolean = false,
    job: Job
  ): Promise<AnalyticsResult> {
    const metrics: Record<string, any> = {};
    const insights: string[] = [];
    const recommendations: string[] = [];

    await job.progress(20);

    // Similar to weekly but with more comprehensive analysis
    // Implementation would include trend analysis, monthly comparisons, etc.
    // This is a simplified version

    const baseQuery = userId ? { userId } : {};
    const dateFilter = {
      createdAt: {
        gte: dateRange.startDate,
        lte: dateRange.endDate,
      },
    };

    const monthlyStats = await this.analyticsService.getMonthlyStats(userId, dateRange);

    await job.progress(80);

    return {
      type: 'monthly_report',
      userId,
      dateRange,
      metrics: monthlyStats,
      insights: ['Monthly report generated'],
      recommendations: ['Continue using the app regularly'],
    };
  }

  private async analyzeUserBehavior(
    userId: string,
    dateRange: AnalyticsProcessingJobData['dateRange'],
    job: Job
  ): Promise<AnalyticsResult> {
    const behaviorPatterns = await this.analyticsService.analyzeUserBehavior(userId, dateRange);
    
    await job.progress(80);

    return {
      type: 'user_behavior',
      userId,
      dateRange,
      metrics: behaviorPatterns,
      insights: ['User behavior analysis completed'],
      recommendations: ['Continue current usage patterns'],
    };
  }

  private async analyzeRoutePatterns(
    userId: string | undefined,
    dateRange: AnalyticsProcessingJobData['dateRange'],
    job: Job
  ): Promise<AnalyticsResult> {
    const routePatterns = await this.analyticsService.analyzeRoutePatterns(userId, dateRange);
    
    await job.progress(80);

    return {
      type: 'route_analytics',
      userId,
      dateRange,
      metrics: routePatterns,
      insights: ['Route pattern analysis completed'],
      recommendations: ['Optimize frequently used routes'],
    };
  }

  private async analyzeLocationPatterns(
    userId: string | undefined,
    dateRange: AnalyticsProcessingJobData['dateRange'],
    job: Job
  ): Promise<AnalyticsResult> {
    const locationPatterns = await this.analyticsService.analyzeLocationPatterns(userId, dateRange);
    
    await job.progress(80);

    return {
      type: 'location_patterns',
      userId,
      dateRange,
      metrics: locationPatterns,
      insights: ['Location pattern analysis completed'],
      recommendations: ['Consider saving frequently visited locations'],
    };
  }

  private async updateUserStatistics(
    userId: string,
    eventType: string,
    eventData: Record<string, any>
  ): Promise<void> {
    // Update user statistics based on event type
    const updateData: any = {};

    switch (eventType) {
      case 'route_created':
        updateData.totalRoutesCreated = { increment: 1 };
        break;
      case 'route_completed':
        updateData.totalRoutesCompleted = { increment: 1 };
        if (eventData.distance) {
          updateData.totalDistanceTraveled = { increment: eventData.distance };
        }
        break;
      case 'place_saved':
        updateData.totalPlacesSaved = { increment: 1 };
        break;
      case 'location_shared':
        updateData.totalLocationsShared = { increment: 1 };
        break;
      case 'search_performed':
        updateData.totalSearches = { increment: 1 };
        break;
    }

    if (Object.keys(updateData).length > 0) {
      await prisma.userStatistics.upsert({
        where: { userId },
        create: {
          userId,
          ...Object.fromEntries(
            Object.entries(updateData).map(([key, value]) => [key, (value as any).increment])
          ),
        },
        update: updateData,
      });
    }
  }

  private async checkUserMilestones(
    userId: string,
    eventType: string,
    eventData: Record<string, any>
  ): Promise<void> {
    const userStats = await prisma.userStatistics.findUnique({
      where: { userId },
    });

    if (!userStats) return;

    const milestones = [];

    // Check for milestone achievements
    if (userStats.totalRoutesCompleted === 10) {
      milestones.push({ type: 'routes_completed', milestone: 10 });
    } else if (userStats.totalRoutesCompleted === 50) {
      milestones.push({ type: 'routes_completed', milestone: 50 });
    } else if (userStats.totalRoutesCompleted === 100) {
      milestones.push({ type: 'routes_completed', milestone: 100 });
    }

    if (userStats.totalPlacesSaved === 25) {
      milestones.push({ type: 'places_saved', milestone: 25 });
    }

    // Send notifications for achieved milestones
    for (const milestone of milestones) {
      await this.notificationService.sendMilestoneNotification(userId, milestone);
    }
  }

  private async sendAnalyticsReport(
    userId: string,
    result: AnalyticsResult,
    format: 'email' | 'in-app' | 'both'
  ): Promise<void> {
    const reportData = {
      title: `Analytics Report: ${result.type}`,
      metrics: result.metrics,
      insights: result.insights,
      recommendations: result.recommendations,
      dateRange: result.dateRange,
    };

    if (format === 'email' || format === 'both') {
      await queueManager.addJob(JobTypes.NOTIFICATION_SEND, {
        userId,
        type: 'email',
        template: 'analytics_report',
        data: reportData,
      });
    }

    if (format === 'in-app' || format === 'both') {
      await queueManager.addJob(JobTypes.NOTIFICATION_SEND, {
        userId,
        type: 'in-app',
        template: 'analytics_report',
        data: reportData,
      });
    }
  }
}

// Initialize the processor
export const analyticsJobProcessor = new AnalyticsJobProcessor();

// Helper functions
export async function processAnalytics(
  data: AnalyticsProcessingJobData,
  options: Bull.JobOptions = {}
): Promise<Bull.Job> {
  return queueManager.addJob(JobTypes.ANALYTICS_PROCESS, data, {
    priority: 5,
    ...options,
  });
}

export async function trackUserEvent(
  data: UserAnalyticsJobData,
  options: Bull.JobOptions = {}
): Promise<Bull.Job> {
  return queueManager.addJob(JobTypes.USER_ANALYTICS, data, {
    priority: 7,
    ...options,
  });
}

// Schedule regular analytics processing
export async function scheduleRegularAnalytics(): Promise<void> {
  // Daily analytics processing
  await queueManager.scheduleJob(
    JobTypes.ANALYTICS_PROCESS,
    '0 6 * * *', // 6 AM daily
    {
      type: 'daily_summary',
      dateRange: {
        startDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
        endDate: new Date(),
      },
    }
  );

  // Weekly analytics processing
  await queueManager.scheduleJob(
    JobTypes.ANALYTICS_PROCESS,
    '0 7 * * 1', // 7 AM on Mondays
    {
      type: 'weekly_report',
      dateRange: {
        startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        endDate: new Date(),
      },
    }
  );

  // Monthly analytics processing
  await queueManager.scheduleJob(
    JobTypes.ANALYTICS_PROCESS,
    '0 8 1 * *', // 8 AM on the 1st of each month
    {
      type: 'monthly_report',
      dateRange: {
        startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        endDate: new Date(),
      },
    }
  );

  logger.info('Regular analytics jobs scheduled');
}