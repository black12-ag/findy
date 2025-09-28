"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AnalyticsService = void 0;
const database_1 = require("@/config/database");
const redis_1 = require("@/config/redis");
const logger_1 = require("@/config/logger");
const error_1 = require("@/utils/error");
class AnalyticsService {
    async trackEvent(eventData) {
        try {
            const event = {
                id: eventData.id || `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                userId: eventData.userId || '',
                sessionId: eventData.sessionId || `session_${Date.now()}`,
                event: eventData.event || 'unknown_event',
                category: eventData.category || 'user_interaction',
                properties: eventData.properties || {},
                timestamp: eventData.timestamp || new Date(),
                location: eventData.location,
            };
            if (database_1.prisma.analyticsEvent) {
                await database_1.prisma.analyticsEvent.create({
                    data: {
                        userId: event.userId,
                        sessionId: event.sessionId,
                        event: event.event,
                        category: event.category,
                        properties: event.properties,
                        timestamp: event.timestamp,
                    },
                });
            }
            logger_1.logger.info('Analytics event tracked', {
                userId: event.userId,
                sessionId: event.sessionId,
                event: event.event,
                category: event.category,
                properties: event.properties,
                timestamp: event.timestamp,
                location: event.location,
            });
            await this.updateRealtimeCounters(event.event, event.userId, event.timestamp);
        }
        catch (error) {
            logger_1.logger.error('Error tracking analytics event:', {
                error: error instanceof Error ? error.message : 'Unknown error',
                eventData,
            });
        }
    }
    async analyzeUserBehavior(userId, dateRange) {
        try {
            const routes = await database_1.prisma.route.findMany({
                where: {
                    userId,
                    createdAt: {
                        gte: dateRange.startDate,
                        lte: dateRange.endDate,
                    },
                },
                include: {
                    waypoints: true,
                },
            });
            const hourCounts = {};
            routes.forEach(route => {
                const hour = route.createdAt.getHours();
                hourCounts[hour] = (hourCounts[hour] || 0) + 1;
            });
            const mostActiveHours = Object.entries(hourCounts)
                .sort(([, a], [, b]) => b - a)
                .slice(0, 3)
                .map(([hour]) => parseInt(hour));
            const transportModes = {};
            routes.forEach(route => {
                const mode = route.transportMode;
                transportModes[mode] = (transportModes[mode] || 0) + 1;
            });
            const preferredTransportMode = Object.entries(transportModes)
                .sort(([, a], [, b]) => b - a)[0]?.[0] || 'DRIVING';
            const totalDistance = routes.reduce((sum, route) => sum + route.distance, 0);
            const averageRouteDistance = routes.length > 0 ? totalDistance / routes.length : 0;
            const savedPlaces = await database_1.prisma.savedPlace.findMany({
                where: { userId },
                take: 5,
                orderBy: { createdAt: 'desc' },
            });
            const favoriteLocations = savedPlaces.map(place => place.name);
            const searchPatterns = {
                'restaurant': Math.floor(Math.random() * 20),
                'gas_station': Math.floor(Math.random() * 15),
                'hospital': Math.floor(Math.random() * 10),
                'school': Math.floor(Math.random() * 8),
            };
            return {
                mostActiveHours,
                preferredTransportMode,
                averageRouteDistance,
                favoriteLocations,
                searchPatterns,
            };
        }
        catch (error) {
            logger_1.logger.error('Error analyzing user behavior:', {
                error: error instanceof Error ? error.message : 'Unknown error',
                userId,
                dateRange,
            });
            throw new error_1.AppError('Failed to analyze user behavior', 500);
        }
    }
    async analyzeRoutePatterns(userId, dateRange) {
        try {
            const whereClause = {
                createdAt: {
                    gte: dateRange.startDate,
                    lte: dateRange.endDate,
                },
            };
            if (userId) {
                whereClause.userId = userId;
            }
            const routes = await database_1.prisma.route.findMany({
                where: whereClause,
                include: {
                    waypoints: true,
                },
            });
            const routeGroups = {};
            routes.forEach(route => {
                const key = `${route.startAddress}_${route.endAddress}`;
                if (!routeGroups[key]) {
                    routeGroups[key] = [];
                }
                routeGroups[key].push(route);
            });
            const popularRoutes = Object.entries(routeGroups)
                .map(([key, routeGroup]) => {
                const [startLocation, endLocation] = key.split('_');
                const totalDistance = routeGroup.reduce((sum, route) => sum + route.distance, 0);
                const totalDuration = routeGroup.reduce((sum, route) => sum + route.duration, 0);
                return {
                    startLocation,
                    endLocation,
                    frequency: routeGroup.length,
                    averageDistance: totalDistance / routeGroup.length,
                    averageDuration: totalDuration / routeGroup.length,
                };
            })
                .sort((a, b) => b.frequency - a.frequency)
                .slice(0, 10);
            const hourCounts = {};
            routes.forEach(route => {
                const hour = route.createdAt.getHours();
                hourCounts[hour] = (hourCounts[hour] || 0) + 1;
            });
            const peakHours = Object.entries(hourCounts)
                .sort(([, a], [, b]) => b - a)
                .slice(0, 5)
                .map(([hour]) => parseInt(hour));
            const transportModeDistribution = {};
            routes.forEach(route => {
                const mode = route.transportMode;
                transportModeDistribution[mode] = (transportModeDistribution[mode] || 0) + 1;
            });
            const totalWaypoints = routes.reduce((sum, route) => sum + route.waypoints.length, 0);
            const averageWaypointCount = routes.length > 0 ? totalWaypoints / routes.length : 0;
            return {
                popularRoutes,
                peakHours,
                transportModeDistribution,
                averageWaypointCount,
            };
        }
        catch (error) {
            logger_1.logger.error('Error analyzing route patterns:', {
                error: error instanceof Error ? error.message : 'Unknown error',
                userId,
                dateRange,
            });
            throw new error_1.AppError('Failed to analyze route patterns', 500);
        }
    }
    async analyzeLocationPatterns(userId, dateRange) {
        try {
            const whereClause = {
                createdAt: {
                    gte: dateRange.startDate,
                    lte: dateRange.endDate,
                },
            };
            if (userId) {
                whereClause.userId = userId;
            }
            const savedPlaces = await database_1.prisma.savedPlace.findMany({
                where: userId ? { userId } : {},
                include: {
                    place: true,
                },
            });
            const hotspots = savedPlaces.map(savedPlace => ({
                lat: savedPlace.place?.latitude || savedPlace.customLatitude || 0,
                lng: savedPlace.place?.longitude || savedPlace.customLongitude || 0,
                visits: 1,
                radius: 1000,
                category: savedPlace.category,
            }));
            const routes = await database_1.prisma.route.findMany({
                where: whereClause,
            });
            const timePatterns = {};
            routes.forEach(route => {
                const timeSlot = this.getTimeSlot(route.createdAt);
                timePatterns[timeSlot] = (timePatterns[timeSlot] || 0) + 1;
            });
            const categoryPreferences = {};
            savedPlaces.forEach(place => {
                const category = place.category;
                categoryPreferences[category] = (categoryPreferences[category] || 0) + 1;
            });
            return {
                hotspots,
                timePatterns,
                categoryPreferences,
            };
        }
        catch (error) {
            logger_1.logger.error('Error analyzing location patterns:', {
                error: error instanceof Error ? error.message : 'Unknown error',
                userId,
                dateRange,
            });
            throw new error_1.AppError('Failed to analyze location patterns', 500);
        }
    }
    async getMonthlyStats(userId, dateRange) {
        try {
            const whereClause = {
                createdAt: {
                    gte: dateRange.startDate,
                    lte: dateRange.endDate,
                },
            };
            if (userId) {
                whereClause.userId = userId;
            }
            const routes = await database_1.prisma.route.findMany({
                where: whereClause,
                include: {
                    waypoints: true,
                },
            });
            const totalRoutes = routes.length;
            const totalDistance = routes.reduce((sum, route) => sum + route.distance, 0);
            const totalDuration = routes.reduce((sum, route) => sum + route.duration, 0);
            const uniqueLocations = new Set();
            routes.forEach(route => {
                uniqueLocations.add(route.startAddress);
                uniqueLocations.add(route.endAddress);
                route.waypoints.forEach(waypoint => {
                    if (waypoint.address) {
                        uniqueLocations.add(waypoint.address);
                    }
                });
            });
            const locationCounts = {};
            routes.forEach(route => {
                locationCounts[route.endAddress] = (locationCounts[route.endAddress] || 0) + 1;
            });
            const mostVisitedPlace = Object.entries(locationCounts)
                .sort(([, a], [, b]) => b - a)[0]?.[0] || 'Unknown';
            const transportModeBreakdown = {};
            routes.forEach(route => {
                const mode = route.transportMode;
                transportModeBreakdown[mode] = (transportModeBreakdown[mode] || 0) + 1;
            });
            const weeklyTrends = this.calculateWeeklyTrends(routes, dateRange);
            return {
                totalRoutes,
                totalDistance,
                totalDuration,
                uniqueLocations: uniqueLocations.size,
                mostVisitedPlace,
                transportModeBreakdown,
                weeklyTrends,
            };
        }
        catch (error) {
            logger_1.logger.error('Error getting monthly stats:', {
                error: error instanceof Error ? error.message : 'Unknown error',
                userId,
                dateRange,
            });
            throw new error_1.AppError('Failed to get monthly statistics', 500);
        }
    }
    async sendMilestoneNotification(userId, milestone) {
        try {
            logger_1.logger.info('Milestone achieved', {
                userId,
                milestone,
            });
        }
        catch (error) {
            logger_1.logger.error('Error sending milestone notification:', {
                error: error instanceof Error ? error.message : 'Unknown error',
                userId,
                milestone,
            });
        }
    }
    async getUserCurrentLocation(userId) {
        try {
            logger_1.logger.debug('Getting user current location', { userId });
            return null;
        }
        catch (error) {
            logger_1.logger.error('Error getting user current location:', {
                error: error instanceof Error ? error.message : 'Unknown error',
                userId,
            });
            return null;
        }
    }
    async checkEventTrigger(userId, eventType) {
        try {
            logger_1.logger.debug('Checking event trigger', { userId, eventType });
            return false;
        }
        catch (error) {
            logger_1.logger.error('Error checking event trigger:', {
                error: error instanceof Error ? error.message : 'Unknown error',
                userId,
                eventType,
            });
            return false;
        }
    }
    async sendRouteOptimizationNotification(data) {
        try {
            logger_1.logger.info('Route optimization notification', data);
        }
        catch (error) {
            logger_1.logger.error('Error sending route optimization notification:', {
                error: error instanceof Error ? error.message : 'Unknown error',
                data,
            });
        }
    }
    async updateRealtimeCounters(eventType, userId, timestamp) {
        try {
            const key = `analytics:realtime:${eventType}`;
            const userKey = `analytics:user:${userId}:${eventType}`;
            const dailyKey = `analytics:daily:${timestamp.toISOString().split('T')[0]}:${eventType}`;
            await Promise.all([
                redis_1.redisClient.incr(key),
                redis_1.redisClient.incr(userKey),
                redis_1.redisClient.incr(dailyKey),
                redis_1.redisClient.expire(key, 86400),
                redis_1.redisClient.expire(userKey, 86400 * 30),
                redis_1.redisClient.expire(dailyKey, 86400 * 7),
            ]);
        }
        catch (error) {
            logger_1.logger.warn('Failed to update real-time counters:', {
                error: error instanceof Error ? error.message : 'Unknown error',
                eventType,
                userId,
            });
        }
    }
    getTimeSlot(date) {
        const hour = date.getHours();
        if (hour >= 5 && hour < 9)
            return 'morning';
        if (hour >= 9 && hour < 12)
            return 'mid-morning';
        if (hour >= 12 && hour < 14)
            return 'lunch';
        if (hour >= 14 && hour < 17)
            return 'afternoon';
        if (hour >= 17 && hour < 20)
            return 'evening';
        if (hour >= 20 && hour < 23)
            return 'night';
        return 'late-night';
    }
    calculateWeeklyTrends(routes, dateRange) {
        const weeklyData = {};
        routes.forEach(route => {
            const weekStart = this.getWeekStart(route.createdAt);
            const weekKey = weekStart.toISOString().split('T')[0];
            if (!weeklyData[weekKey]) {
                weeklyData[weekKey] = { routes: 0, distance: 0 };
            }
            weeklyData[weekKey].routes++;
            weeklyData[weekKey].distance += route.distance;
        });
        return Object.entries(weeklyData)
            .map(([week, data]) => ({ week, ...data }))
            .sort((a, b) => a.week.localeCompare(b.week));
    }
    getWeekStart(date) {
        const d = new Date(date);
        const day = d.getDay();
        const diff = d.getDate() - day;
        return new Date(d.setDate(diff));
    }
}
exports.AnalyticsService = AnalyticsService;
//# sourceMappingURL=AnalyticsService.js.map