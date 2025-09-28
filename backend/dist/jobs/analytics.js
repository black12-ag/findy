"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.analyticsJobProcessor = void 0;
exports.processAnalytics = processAnalytics;
exports.trackUserEvent = trackUserEvent;
exports.scheduleRegularAnalytics = scheduleRegularAnalytics;
const queues_1 = require("@/queues");
const AnalyticsService_1 = require("@/services/AnalyticsService");
const NotificationService_1 = require("@/services/NotificationService");
const logger_1 = __importDefault(require("@/config/logger"));
const database_1 = require("@/config/database");
class AnalyticsJobProcessor {
    constructor() {
        this.analyticsService = new AnalyticsService_1.AnalyticsService();
        this.notificationService = new NotificationService_1.NotificationService();
        this.setupProcessors();
    }
    setupProcessors() {
        const processQueue = queues_1.queueManager.getQueue(queues_1.JobTypes.ANALYTICS_PROCESS);
        const userQueue = queues_1.queueManager.getQueue(queues_1.JobTypes.USER_ANALYTICS);
        if (processQueue) {
            processQueue.process('*', this.processAnalytics.bind(this));
            logger_1.default.info('Analytics processing job processor initialized');
        }
        if (userQueue) {
            userQueue.process('*', this.processUserEvent.bind(this));
            logger_1.default.info('User analytics job processor initialized');
        }
    }
    async processAnalytics(job) {
        const { type, userId, dateRange, includeComparison, sendReport, reportFormat } = job.data;
        try {
            logger_1.default.info('Starting analytics processing job', {
                jobId: job.id,
                type,
                userId,
                dateRange,
            });
            await job.progress(10);
            let result;
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
                    result = await this.analyzeUserBehavior(userId, dateRange, job);
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
            if (sendReport && userId) {
                await this.sendAnalyticsReport(userId, result, reportFormat || 'in-app');
            }
            await job.progress(100);
            logger_1.default.info('Analytics processing job completed', {
                jobId: job.id,
                type,
                userId,
                metricsCount: Object.keys(result.metrics).length,
                insightsCount: result.insights.length,
            });
            return result;
        }
        catch (error) {
            logger_1.default.error('Analytics processing job failed', {
                jobId: job.id,
                type,
                userId,
                error: error instanceof Error ? error.message : 'Unknown error',
            });
            throw error;
        }
    }
    async processUserEvent(job) {
        const { userId, eventType, eventData, timestamp, location } = job.data;
        try {
            logger_1.default.info('Processing user analytics event', {
                jobId: job.id,
                userId,
                eventType,
                timestamp,
            });
            await job.progress(20);
            await database_1.prisma.userAnalytics.create({
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
            await this.updateUserStatistics(userId, eventType, eventData);
            await job.progress(80);
            await this.checkUserMilestones(userId, eventType, eventData);
            await job.progress(100);
            logger_1.default.info('User analytics event processed successfully', {
                jobId: job.id,
                userId,
                eventType,
            });
        }
        catch (error) {
            logger_1.default.error('User analytics event processing failed', {
                jobId: job.id,
                userId,
                eventType,
                error: error instanceof Error ? error.message : 'Unknown error',
            });
            throw error;
        }
    }
    async generateDailySummary(userId, dateRange, includeComparison = false, job) {
        const metrics = {};
        const insights = [];
        const recommendations = [];
        await job.progress(20);
        const baseQuery = userId ? { userId } : {};
        const dateFilter = {
            createdAt: {
                gte: dateRange.startDate,
                lte: dateRange.endDate,
            },
        };
        const routeCount = await database_1.prisma.route.count({
            where: { ...baseQuery, ...dateFilter },
        });
        const completedRoutes = await database_1.prisma.route.count({
            where: {
                ...baseQuery,
                ...dateFilter,
                status: 'completed',
            },
        });
        await job.progress(40);
        const locationEvents = await database_1.prisma.userLocation.count({
            where: { ...baseQuery, ...dateFilter },
        });
        const placeInteractions = await database_1.prisma.savedPlace.count({
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
    async generateWeeklyReport(userId, dateRange, includeComparison = false, job) {
        const metrics = {};
        const insights = [];
        const recommendations = [];
        await job.progress(20);
        const baseQuery = userId ? { userId } : {};
        const dateFilter = {
            createdAt: {
                gte: dateRange.startDate,
                lte: dateRange.endDate,
            },
        };
        const routes = await database_1.prisma.route.findMany({
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
        const dailyBreakdown = {};
        routes.forEach(route => {
            const day = route.createdAt.toISOString().split('T')[0];
            dailyBreakdown[day] = (dailyBreakdown[day] || 0) + 1;
        });
        await job.progress(60);
        metrics.routes = {
            total: routes.length,
            completed: completedRoutes.length,
            totalDistance: Math.round(totalDistance / 1000),
            totalDuration: Math.round(totalDuration / 60),
            averageDistance: routes.length > 0 ? Math.round(totalDistance / routes.length / 1000) : 0,
            dailyBreakdown,
        };
        const locationEvents = await database_1.prisma.userLocation.groupBy({
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
    async generateMonthlyReport(userId, dateRange, includeComparison = false, job) {
        const metrics = {};
        const insights = [];
        const recommendations = [];
        await job.progress(20);
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
    async analyzeUserBehavior(userId, dateRange, job) {
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
    async analyzeRoutePatterns(userId, dateRange, job) {
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
    async analyzeLocationPatterns(userId, dateRange, job) {
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
    async updateUserStatistics(userId, eventType, eventData) {
        const updateData = {};
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
            await database_1.prisma.userStatistics.upsert({
                where: { userId },
                create: {
                    userId,
                    ...Object.fromEntries(Object.entries(updateData).map(([key, value]) => [key, value.increment])),
                },
                update: updateData,
            });
        }
    }
    async checkUserMilestones(userId, eventType, eventData) {
        const userStats = await database_1.prisma.userStatistics.findUnique({
            where: { userId },
        });
        if (!userStats)
            return;
        const milestones = [];
        if (userStats.totalRoutesCompleted === 10) {
            milestones.push({ type: 'routes_completed', milestone: 10 });
        }
        else if (userStats.totalRoutesCompleted === 50) {
            milestones.push({ type: 'routes_completed', milestone: 50 });
        }
        else if (userStats.totalRoutesCompleted === 100) {
            milestones.push({ type: 'routes_completed', milestone: 100 });
        }
        if (userStats.totalPlacesSaved === 25) {
            milestones.push({ type: 'places_saved', milestone: 25 });
        }
        for (const milestone of milestones) {
            await this.notificationService.sendMilestoneNotification(userId, milestone);
        }
    }
    async sendAnalyticsReport(userId, result, format) {
        const reportData = {
            title: `Analytics Report: ${result.type}`,
            metrics: result.metrics,
            insights: result.insights,
            recommendations: result.recommendations,
            dateRange: result.dateRange,
        };
        if (format === 'email' || format === 'both') {
            await queues_1.queueManager.addJob(queues_1.JobTypes.NOTIFICATION_SEND, {
                userId,
                type: 'email',
                template: 'analytics_report',
                data: reportData,
            });
        }
        if (format === 'in-app' || format === 'both') {
            await queues_1.queueManager.addJob(queues_1.JobTypes.NOTIFICATION_SEND, {
                userId,
                type: 'in-app',
                template: 'analytics_report',
                data: reportData,
            });
        }
    }
}
exports.analyticsJobProcessor = new AnalyticsJobProcessor();
async function processAnalytics(data, options = {}) {
    return queues_1.queueManager.addJob(queues_1.JobTypes.ANALYTICS_PROCESS, data, {
        priority: 5,
        ...options,
    });
}
async function trackUserEvent(data, options = {}) {
    return queues_1.queueManager.addJob(queues_1.JobTypes.USER_ANALYTICS, data, {
        priority: 7,
        ...options,
    });
}
async function scheduleRegularAnalytics() {
    await queues_1.queueManager.scheduleJob(queues_1.JobTypes.ANALYTICS_PROCESS, '0 6 * * *', {
        type: 'daily_summary',
        dateRange: {
            startDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
            endDate: new Date(),
        },
    });
    await queues_1.queueManager.scheduleJob(queues_1.JobTypes.ANALYTICS_PROCESS, '0 7 * * 1', {
        type: 'weekly_report',
        dateRange: {
            startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
            endDate: new Date(),
        },
    });
    await queues_1.queueManager.scheduleJob(queues_1.JobTypes.ANALYTICS_PROCESS, '0 8 1 * *', {
        type: 'monthly_report',
        dateRange: {
            startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
            endDate: new Date(),
        },
    });
    logger_1.default.info('Regular analytics jobs scheduled');
}
//# sourceMappingURL=analytics.js.map