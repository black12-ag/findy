"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.routeOptimizationProcessor = void 0;
exports.scheduleRouteOptimization = scheduleRouteOptimization;
exports.schedulePeriodicRouteOptimization = schedulePeriodicRouteOptimization;
const queues_1 = require("@/queues");
const RouteService_1 = require("@/services/RouteService");
const NotificationService_1 = require("@/services/NotificationService");
const logger_1 = __importDefault(require("@/config/logger"));
class RouteOptimizationJobProcessor {
    constructor() {
        this.routeService = new RouteService_1.RouteService();
        this.notificationService = new NotificationService_1.NotificationService();
        this.setupProcessor();
    }
    setupProcessor() {
        const queue = queues_1.queueManager.getQueue(queues_1.JobTypes.ROUTE_OPTIMIZATION);
        if (queue) {
            queue.process('*', this.processOptimization.bind(this));
            logger_1.default.info('Route optimization job processor initialized');
        }
    }
    async processOptimization(job) {
        const startTime = Date.now();
        const { userId, routeId, waypoints, preferences } = job.data;
        try {
            logger_1.default.info('Starting route optimization job', {
                jobId: job.id,
                userId,
                routeId,
                waypointCount: waypoints.length,
            });
            await job.progress(10);
            const originalRoute = await this.routeService.calculateRoute(waypoints, preferences);
            await job.progress(30);
            let optimizedRoute = originalRoute;
            if (waypoints.length > 2) {
                optimizedRoute = await this.routeService.optimizeWaypointOrder(waypoints, preferences);
            }
            await job.progress(60);
            const alternativeRoutes = await this.routeService.getAlternativeRoutes(waypoints, preferences, 3);
            await job.progress(80);
            const bestRoute = this.selectBestRoute([optimizedRoute, ...alternativeRoutes], preferences);
            const timeSaved = Math.max(0, originalRoute.duration - bestRoute.duration);
            const distanceSaved = Math.max(0, originalRoute.distance - bestRoute.distance);
            await job.progress(90);
            await this.routeService.updateRoute(routeId, bestRoute);
            if (timeSaved > 300 || distanceSaved > 1000) {
                await this.notificationService.sendRouteOptimizationNotification({
                    userId,
                    routeId,
                    timeSaved,
                    distanceSaved,
                });
            }
            await job.progress(100);
            const processingTime = Date.now() - startTime;
            const result = {
                routeId,
                optimizedRoute: bestRoute,
                timeSaved,
                distanceSaved,
                originalDuration: originalRoute.duration,
                optimizedDuration: bestRoute.duration,
                originalDistance: originalRoute.distance,
                optimizedDistance: bestRoute.distance,
            };
            logger_1.default.info('Route optimization job completed', {
                jobId: job.id,
                userId,
                routeId,
                processingTime,
                timeSaved,
                distanceSaved,
            });
            return result;
        }
        catch (error) {
            logger_1.default.error('Route optimization job failed', {
                jobId: job.id,
                userId,
                routeId,
                error: error instanceof Error ? error.message : 'Unknown error',
                stack: error instanceof Error ? error.stack : undefined,
            });
            throw error;
        }
    }
    selectBestRoute(routes, preferences) {
        if (routes.length === 0) {
            throw new Error('No routes provided for selection');
        }
        if (routes.length === 1) {
            return routes[0];
        }
        const scoredRoutes = routes.map(route => ({
            route,
            score: this.calculateRouteScore(route, preferences),
        }));
        scoredRoutes.sort((a, b) => b.score - a.score);
        return scoredRoutes[0].route;
    }
    calculateRouteScore(route, preferences) {
        let score = 0;
        const maxDuration = 7200;
        score += (1 - Math.min(route.duration, maxDuration) / maxDuration) * 100;
        if (preferences.mode === 'walking' || preferences.mode === 'bicycling') {
            const maxDistance = 50000;
            score += (1 - Math.min(route.distance, maxDistance) / maxDistance) * 50;
        }
        if (route.trafficMultiplier) {
            score -= (route.trafficMultiplier - 1) * 30;
        }
        if (route.warnings && route.warnings.length > 0) {
            score -= route.warnings.length * 10;
        }
        return Math.max(0, score);
    }
}
exports.routeOptimizationProcessor = new RouteOptimizationJobProcessor();
async function scheduleRouteOptimization(data, options = {}) {
    const priority = data.priority === 'high' ? 1 : data.priority === 'low' ? 10 : 5;
    return queues_1.queueManager.addJob(queues_1.JobTypes.ROUTE_OPTIMIZATION, data, {
        priority,
        ...options,
    });
}
async function schedulePeriodicRouteOptimization(routeId, cronPattern = '0 */6 * * *') {
    return queues_1.queueManager.scheduleJob(queues_1.JobTypes.ROUTE_OPTIMIZATION, cronPattern, { routeId, periodic: true });
}
//# sourceMappingURL=routeOptimization.js.map