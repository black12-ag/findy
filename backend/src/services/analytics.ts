import { prisma } from '@/config/database';
import { redisClient } from '@/config/redis';
import { logger } from '@/config/logger';
import { AppError } from '@/utils/error';
import type {
  AnalyticsEvent,
  AnalyticsEventType,
  UserAnalytics,
  EventAggregation,
} from '@/types/analytics';

class AnalyticsService {
  /**
   * Track a user event
   */
  async trackEvent(event: AnalyticsEvent): Promise<void> {
    try {
      const { userId, event: eventType, properties = {}, timestamp = new Date() } = event;

      // Store in database
      await prisma.analyticsEvent.create({
        data: {
          userId,
          event: eventType,
          properties: JSON.stringify(properties),
          timestamp,
        },
      });

      // Update real-time counters in Redis
      await this.updateRealtimeCounters(eventType, userId, timestamp);

      logger.debug('Analytics event tracked', {
        userId,
        event: eventType,
        properties,
      });
    } catch (error) {
      logger.error('Error tracking analytics event:', error);
      // Don't throw error to avoid disrupting main functionality
    }
  }

  /**
   * Get user analytics summary
   */
  async getUserAnalytics(userId: string, days: number = 30): Promise<UserAnalytics> {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      // Get event counts by type
      const eventCounts = await prisma.analyticsEvent.groupBy({
        by: ['event'],
        where: {
          userId,
          timestamp: {
            gte: startDate,
          },
        },
        _count: {
          event: true,
        },
      });

      // Get total events
      const totalEvents = eventCounts.reduce((sum, item) => sum + item._count.event, 0);

      // Get most active days
      const dailyActivity = await prisma.analyticsEvent.groupBy({
        by: ['timestamp'],
        where: {
          userId,
          timestamp: {
            gte: startDate,
          },
        },
        _count: {
          event: true,
        },
        orderBy: {
          _count: {
            event: 'desc',
          },
        },
        take: 7,
      });

      // Get popular places (from place-related events)
      const popularPlaces = await this.getPopularPlaces(userId, days);

      return {
        userId,
        period: days,
        totalEvents,
        eventsByType: eventCounts.reduce((acc, item) => {
          acc[item.event] = item._count.event;
          return acc;
        }, {} as Record<string, number>),
        dailyActivity: dailyActivity.map(item => ({
          date: item.timestamp.toISOString().split('T')[0],
          count: item._count.event,
        })),
        popularPlaces,
      };
    } catch (error) {
      logger.error('Error getting user analytics:', error);
      throw new AppError('Failed to get user analytics', 500);
    }
  }

  /**
   * Get platform-wide analytics
   */
  async getPlatformAnalytics(days: number = 30): Promise<EventAggregation> {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      // Total users active in period
      const activeUsers = await prisma.analyticsEvent.findMany({
        where: {
          timestamp: {
            gte: startDate,
          },
        },
        distinct: ['userId'],
        select: {
          userId: true,
        },
      });

      // Event counts by type
      const eventCounts = await prisma.analyticsEvent.groupBy({
        by: ['event'],
        where: {
          timestamp: {
            gte: startDate,
          },
        },
        _count: {
          event: true,
        },
        orderBy: {
          _count: {
            event: 'desc',
          },
        },
      });

      // Daily activity
      const dailyActivity = await prisma.$queryRaw<Array<{ date: string; count: number }>>`
        SELECT 
          DATE(timestamp) as date,
          COUNT(*) as count
        FROM analytics_events 
        WHERE timestamp >= ${startDate}
        GROUP BY DATE(timestamp)
        ORDER BY date DESC
      `;

      return {
        period: days,
        activeUsers: activeUsers.length,
        totalEvents: eventCounts.reduce((sum, item) => sum + item._count.event, 0),
        eventsByType: eventCounts.reduce((acc, item) => {
          acc[item.event] = item._count.event;
          return acc;
        }, {} as Record<string, number>),
        dailyActivity: dailyActivity.map(item => ({
          date: item.date,
          count: Number(item.count),
        })),
      };
    } catch (error) {
      logger.error('Error getting platform analytics:', error);
      throw new AppError('Failed to get platform analytics', 500);
    }
  }

  /**
   * Get real-time event counts from Redis
   */
  async getRealtimeStats(eventType: AnalyticsEventType): Promise<number> {
    try {
      const key = `analytics:realtime:${eventType}`;
      const count = await redisClient.get(key);
      return parseInt(count || '0', 10);
    } catch (error) {
      logger.error('Error getting realtime stats:', error);
      return 0;
    }
  }

  /**
   * Get user's most frequent actions
   */
  async getUserTopActions(userId: string, limit: number = 10): Promise<Array<{ action: string; count: number }>> {
    try {
      const results = await prisma.analyticsEvent.groupBy({
        by: ['event'],
        where: {
          userId,
        },
        _count: {
          event: true,
        },
        orderBy: {
          _count: {
            event: 'desc',
          },
        },
        take: limit,
      });

      return results.map(item => ({
        action: item.event,
        count: item._count.event,
      }));
    } catch (error) {
      logger.error('Error getting user top actions:', error);
      throw new AppError('Failed to get user top actions', 500);
    }
  }

  /**
   * Track search performance and popular queries
   */
  async trackSearchAnalytics(query: string, resultCount: number, userId?: string): Promise<void> {
    try {
      // Track the search event
      await this.trackEvent({
        userId,
        event: 'search_performed',
        properties: {
          query,
          resultCount,
          hasResults: resultCount > 0,
        },
      });

      // Store popular search terms in Redis with expiration
      const searchKey = `analytics:popular_searches`;
      await redisClient.zincrby(searchKey, 1, query);
      await redisClient.expire(searchKey, 86400 * 7); // 7 days
    } catch (error) {
      logger.error('Error tracking search analytics:', error);
    }
  }

  /**
   * Get popular search queries
   */
  async getPopularSearches(limit: number = 10): Promise<Array<{ query: string; count: number }>> {
    try {
      const results = await redisClient.zrevrange('analytics:popular_searches', 0, limit - 1, 'WITHSCORES');
      const searches: Array<{ query: string; count: number }> = [];

      for (let i = 0; i < results.length; i += 2) {
        searches.push({
          query: results[i],
          count: parseInt(results[i + 1], 10),
        });
      }

      return searches;
    } catch (error) {
      logger.error('Error getting popular searches:', error);
      return [];
    }
  }

  /**
   * Clean up old analytics data
   */
  async cleanupOldData(daysToKeep: number = 90): Promise<void> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      const deletedCount = await prisma.analyticsEvent.deleteMany({
        where: {
          timestamp: {
            lt: cutoffDate,
          },
        },
      });

      logger.info(`Cleaned up ${deletedCount.count} old analytics records`);
    } catch (error) {
      logger.error('Error cleaning up analytics data:', error);
      throw new AppError('Failed to cleanup analytics data', 500);
    }
  }

  /**
   * Update real-time counters in Redis
   */
  private async updateRealtimeCounters(
    eventType: AnalyticsEventType,
    userId?: string,
    timestamp: Date = new Date()
  ): Promise<void> {
    try {
      const hour = timestamp.toISOString().substring(0, 13); // YYYY-MM-DDTHH

      // Global counters
      await redisClient.incr(`analytics:realtime:${eventType}`);
      await redisClient.incr(`analytics:hourly:${eventType}:${hour}`);
      
      // Set expiration on hourly counters (24 hours)
      await redisClient.expire(`analytics:hourly:${eventType}:${hour}`, 86400);

      // User-specific counters
      if (userId) {
        await redisClient.incr(`analytics:user:${userId}:${eventType}`);
        await redisClient.expire(`analytics:user:${userId}:${eventType}`, 86400 * 30); // 30 days
      }
    } catch (error) {
      logger.error('Error updating realtime counters:', error);
    }
  }

  /**
   * Get user's popular places from analytics
   */
  private async getPopularPlaces(userId: string, days: number): Promise<Array<{ placeName: string; count: number }>> {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      // Get place-related events
      const placeEvents = await prisma.analyticsEvent.findMany({
        where: {
          userId,
          timestamp: {
            gte: startDate,
          },
          event: {
            in: ['place_search', 'place_details_view', 'place_saved'],
          },
        },
        select: {
          properties: true,
        },
      });

      // Count place occurrences
      const placeCounts: Record<string, number> = {};
      
      placeEvents.forEach(event => {
        try {
          const properties = JSON.parse(event.properties as string);
          const placeName = properties.placeName;
          if (placeName) {
            placeCounts[placeName] = (placeCounts[placeName] || 0) + 1;
          }
        } catch (error) {
          // Skip invalid JSON
        }
      });

      // Convert to array and sort
      return Object.entries(placeCounts)
        .map(([placeName, count]) => ({ placeName, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);
    } catch (error) {
      logger.error('Error getting popular places:', error);
      return [];
    }
  }
}

export const analyticsService = new AnalyticsService();