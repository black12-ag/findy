import Bull from 'bull';
import { Job } from 'bull';
import { queueManager, JobTypes } from '@/queues';
import { RouteService } from '@/services/RouteService';
import { NotificationService } from '@/services/NotificationService';
import logger from '@/config/logger';
import { Route } from '@/types/maps';

export interface RouteOptimizationJobData {
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
}

export interface OptimizedRouteResult {
  routeId: string;
  optimizedRoute: Route;
  timeSaved: number;
  distanceSaved: number;
  originalDuration: number;
  optimizedDuration: number;
  originalDistance: number;
  optimizedDistance: number;
}

class RouteOptimizationJobProcessor {
  private routeService: RouteService;
  private notificationService: NotificationService;

  constructor() {
    this.routeService = new RouteService();
    this.notificationService = new NotificationService();
    this.setupProcessor();
  }

  private setupProcessor() {
    const queue = queueManager.getQueue(JobTypes.ROUTE_OPTIMIZATION);
    if (queue) {
      queue.process('*', this.processOptimization.bind(this));
      logger.info('Route optimization job processor initialized');
    }
  }

  public async processOptimization(job: Job<RouteOptimizationJobData>): Promise<OptimizedRouteResult> {
    const startTime = Date.now();
    const { userId, routeId, waypoints, preferences } = job.data;

    try {
      logger.info('Starting route optimization job', {
        jobId: job.id,
        userId,
        routeId,
        waypointCount: waypoints.length,
      });

      // Update job progress
      await job.progress(10);

      // Get the original route
      const originalRoute = await this.routeService.calculateRoute(
        waypoints,
        preferences
      );

      await job.progress(30);

      // Optimize waypoint order if there are multiple waypoints
      let optimizedRoute = originalRoute;
      if (waypoints.length > 2) {
        optimizedRoute = await this.routeService.optimizeWaypointOrder(
          waypoints,
          preferences
        );
      }

      await job.progress(60);

      // Calculate alternative routes for comparison
      const alternativeRoutes = await this.routeService.getAlternativeRoutes(
        waypoints,
        preferences,
        3 // Get up to 3 alternatives
      );

      await job.progress(80);

      // Select the best route based on preferences and traffic
      const bestRoute = this.selectBestRoute(
        [optimizedRoute, ...alternativeRoutes],
        preferences
      );

      // Calculate improvements
      const timeSaved = Math.max(0, originalRoute.duration - bestRoute.duration);
      const distanceSaved = Math.max(0, originalRoute.distance - bestRoute.distance);

      await job.progress(90);

      // Update the route in database
      await this.routeService.updateRoute(routeId, bestRoute);

      // Send notification to user if significant improvement
      if (timeSaved > 300 || distanceSaved > 1000) { // 5 minutes or 1km
        await this.notificationService.sendRouteOptimizationNotification({
          userId,
          routeId,
          timeSaved,
          distanceSaved,
        });
      }

      await job.progress(100);

      const processingTime = Date.now() - startTime;
      const result: OptimizedRouteResult = {
        routeId,
        optimizedRoute: bestRoute,
        timeSaved,
        distanceSaved,
        originalDuration: originalRoute.duration,
        optimizedDuration: bestRoute.duration,
        originalDistance: originalRoute.distance,
        optimizedDistance: bestRoute.distance,
      };

      logger.info('Route optimization job completed', {
        jobId: job.id,
        userId,
        routeId,
        processingTime,
        timeSaved,
        distanceSaved,
      });

      return result;
    } catch (error) {
      logger.error('Route optimization job failed', {
        jobId: job.id,
        userId,
        routeId,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }

  private selectBestRoute(routes: Route[], preferences: RouteOptimizationJobData['preferences']): Route {
    if (routes.length === 0) {
      throw new Error('No routes provided for selection');
    }

    if (routes.length === 1) {
      return routes[0];
    }

    // Score each route based on preferences
    const scoredRoutes = routes.map(route => ({
      route,
      score: this.calculateRouteScore(route, preferences),
    }));

    // Sort by score (higher is better)
    scoredRoutes.sort((a, b) => b.score - a.score);

    return scoredRoutes[0].route;
  }

  private calculateRouteScore(route: Route, preferences: RouteOptimizationJobData['preferences']): number {
    let score = 0;

    // Base score on time efficiency (lower duration = higher score)
    const maxDuration = 7200; // 2 hours max
    score += (1 - Math.min(route.duration, maxDuration) / maxDuration) * 100;

    // Add distance efficiency (lower distance = higher score for walking/bicycling)
    if (preferences.mode === 'walking' || preferences.mode === 'bicycling') {
      const maxDistance = 50000; // 50km max
      score += (1 - Math.min(route.distance, maxDistance) / maxDistance) * 50;
    }

    // Traffic considerations (if available)
    if (route.trafficMultiplier) {
      score -= (route.trafficMultiplier - 1) * 30; // Penalize heavy traffic
    }

    // Route quality factors
    if (route.warnings && route.warnings.length > 0) {
      score -= route.warnings.length * 10;
    }

    return Math.max(0, score);
  }
}

// Initialize the processor
export const routeOptimizationProcessor = new RouteOptimizationJobProcessor();

// Helper function to add route optimization job
export async function scheduleRouteOptimization(
  data: RouteOptimizationJobData,
  options: Bull.JobOptions = {}
): Promise<Bull.Job> {
  const priority = data.priority === 'high' ? 1 : data.priority === 'low' ? 10 : 5;
  
  return queueManager.addJob(JobTypes.ROUTE_OPTIMIZATION, data, {
    priority,
    ...options,
  });
}

// Helper function to schedule periodic route re-optimization
export async function schedulePeriodicRouteOptimization(
  routeId: string,
  cronPattern: string = '0 */6 * * *' // Every 6 hours by default
): Promise<Bull.Job> {
  return queueManager.scheduleJob(
    JobTypes.ROUTE_OPTIMIZATION,
    cronPattern,
    { routeId, periodic: true }
  );
}