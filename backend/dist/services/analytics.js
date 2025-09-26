"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.analyticsService = void 0;
const database_1 = require("@/config/database");
const redis_1 = require("@/config/redis");
const logger_1 = require("@/config/logger");
const error_1 = require("@/utils/error");
class AnalyticsService {
    async trackEvent(event) {
        try {
            const { userId, event: eventType, properties = {}, timestamp = new Date() } = event;
            await database_1.prisma.analyticsEvent.create({
                data: {
                    userId,
                    event: eventType,
                    properties: JSON.stringify(properties),
                    timestamp,
                },
            });
            await this.updateRealtimeCounters(eventType, userId, timestamp);
            logger_1.logger.debug('Analytics event tracked', {
                userId,
                event: eventType,
                properties,
            });
        }
        catch (error) {
            logger_1.logger.error('Error tracking analytics event:', error);
        }
    }
    async getUserAnalytics(userId, days = 30) {
        try {
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - days);
            const eventCounts = await database_1.prisma.analyticsEvent.groupBy({
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
            const totalEvents = eventCounts.reduce((sum, item) => sum + item._count.event, 0);
            const dailyActivity = await database_1.prisma.analyticsEvent.groupBy({
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
            const popularPlaces = await this.getPopularPlaces(userId, days);
            return {
                userId,
                period: days,
                totalEvents,
                eventsByType: eventCounts.reduce((acc, item) => {
                    acc[item.event] = item._count.event;
                    return acc;
                }, {}),
                dailyActivity: dailyActivity.map(item => ({
                    date: item.timestamp.toISOString().split('T')[0],
                    count: item._count.event,
                })),
                popularPlaces,
            };
        }
        catch (error) {
            logger_1.logger.error('Error getting user analytics:', error);
            throw new error_1.AppError('Failed to get user analytics', 500);
        }
    }
    async getPlatformAnalytics(days = 30) {
        try {
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - days);
            const activeUsers = await database_1.prisma.analyticsEvent.findMany({
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
            const eventCounts = await database_1.prisma.analyticsEvent.groupBy({
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
            const dailyActivity = await database_1.prisma.$queryRaw `
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
                }, {}),
                dailyActivity: dailyActivity.map(item => ({
                    date: item.date,
                    count: Number(item.count),
                })),
            };
        }
        catch (error) {
            logger_1.logger.error('Error getting platform analytics:', error);
            throw new error_1.AppError('Failed to get platform analytics', 500);
        }
    }
    async getRealtimeStats(eventType) {
        try {
            const key = `analytics:realtime:${eventType}`;
            const count = await redis_1.redisClient.get(key);
            return parseInt(count || '0', 10);
        }
        catch (error) {
            logger_1.logger.error('Error getting realtime stats:', error);
            return 0;
        }
    }
    async getUserTopActions(userId, limit = 10) {
        try {
            const results = await database_1.prisma.analyticsEvent.groupBy({
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
        }
        catch (error) {
            logger_1.logger.error('Error getting user top actions:', error);
            throw new error_1.AppError('Failed to get user top actions', 500);
        }
    }
    async trackSearchAnalytics(query, resultCount, userId) {
        try {
            await this.trackEvent({
                userId,
                event: 'search_performed',
                properties: {
                    query,
                    resultCount,
                    hasResults: resultCount > 0,
                },
            });
            const searchKey = `analytics:popular_searches`;
            await redis_1.redisClient.zincrby(searchKey, 1, query);
            await redis_1.redisClient.expire(searchKey, 86400 * 7);
        }
        catch (error) {
            logger_1.logger.error('Error tracking search analytics:', error);
        }
    }
    async getPopularSearches(limit = 10) {
        try {
            const results = await redis_1.redisClient.zrevrange('analytics:popular_searches', 0, limit - 1, 'WITHSCORES');
            const searches = [];
            for (let i = 0; i < results.length; i += 2) {
                searches.push({
                    query: results[i],
                    count: parseInt(results[i + 1], 10),
                });
            }
            return searches;
        }
        catch (error) {
            logger_1.logger.error('Error getting popular searches:', error);
            return [];
        }
    }
    async cleanupOldData(daysToKeep = 90) {
        try {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
            const deletedCount = await database_1.prisma.analyticsEvent.deleteMany({
                where: {
                    timestamp: {
                        lt: cutoffDate,
                    },
                },
            });
            logger_1.logger.info(`Cleaned up ${deletedCount.count} old analytics records`);
        }
        catch (error) {
            logger_1.logger.error('Error cleaning up analytics data:', error);
            throw new error_1.AppError('Failed to cleanup analytics data', 500);
        }
    }
    async updateRealtimeCounters(eventType, userId, timestamp = new Date()) {
        try {
            const hour = timestamp.toISOString().substring(0, 13);
            await redis_1.redisClient.incr(`analytics:realtime:${eventType}`);
            await redis_1.redisClient.incr(`analytics:hourly:${eventType}:${hour}`);
            await redis_1.redisClient.expire(`analytics:hourly:${eventType}:${hour}`, 86400);
            if (userId) {
                await redis_1.redisClient.incr(`analytics:user:${userId}:${eventType}`);
                await redis_1.redisClient.expire(`analytics:user:${userId}:${eventType}`, 86400 * 30);
            }
        }
        catch (error) {
            logger_1.logger.error('Error updating realtime counters:', error);
        }
    }
    async getPopularPlaces(userId, days) {
        try {
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - days);
            const placeEvents = await database_1.prisma.analyticsEvent.findMany({
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
            const placeCounts = {};
            placeEvents.forEach(event => {
                try {
                    const properties = JSON.parse(event.properties);
                    const placeName = properties.placeName;
                    if (placeName) {
                        placeCounts[placeName] = (placeCounts[placeName] || 0) + 1;
                    }
                }
                catch (error) {
                }
            });
            return Object.entries(placeCounts)
                .map(([placeName, count]) => ({ placeName, count }))
                .sort((a, b) => b.count - a.count)
                .slice(0, 5);
        }
        catch (error) {
            logger_1.logger.error('Error getting popular places:', error);
            return [];
        }
    }
}
exports.analyticsService = new AnalyticsService();
//# sourceMappingURL=analytics.js.map