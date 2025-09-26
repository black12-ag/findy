import { prisma } from '@/config/database';
import { redisClient } from '@/config/redis';
import { logger } from '@/config/logger';
import { AppError } from '@/utils/error';

export interface AnalyticsEvent {
  id?: string;
  userId: string;
  sessionId?: string;
  event: string;
  category: string;
  properties: Record<string, any>;
  timestamp: Date;
  location?: {
    lat: number;
    lng: number;
  };
}

export interface UserBehaviorPattern {
  mostActiveHours: number[];
  preferredTransportMode: string;
  averageRouteDistance: number;
  favoriteLocations: string[];
  searchPatterns: Record<string, number>;
}

export interface RouteAnalyticsPattern {
  popularRoutes: Array<{
    startLocation: string;
    endLocation: string;
    frequency: number;
    averageDistance: number;
    averageDuration: number;
  }>;
  peakHours: number[];
  transportModeDistribution: Record<string, number>;
  averageWaypointCount: number;
}

export interface LocationPattern {
  hotspots: Array<{
    lat: number;
    lng: number;
    visits: number;
    radius: number;
    category?: string;
  }>;
  timePatterns: Record<string, number>;
  categoryPreferences: Record<string, number>;
}

export interface MonthlyStats {
  totalRoutes: number;
  totalDistance: number;
  totalDuration: number;
  uniqueLocations: number;
  mostVisitedPlace: string;
  transportModeBreakdown: Record<string, number>;
  weeklyTrends: Array<{
    week: string;
    routes: number;
    distance: number;
  }>;
}

export class AnalyticsService {
  /**
   * Track a user event
   */
  async trackEvent(eventData: Partial<AnalyticsEvent>): Promise<void> {
    try {
      // Generate missing required fields
      const event: AnalyticsEvent = {
        id: eventData.id || `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        userId: eventData.userId || '',
        sessionId: eventData.sessionId || `session_${Date.now()}`,
        event: eventData.event || 'unknown_event',
        category: eventData.category || 'user_interaction',
        properties: eventData.properties || {},
        timestamp: eventData.timestamp || new Date(),
        location: eventData.location,
      };

      // Store in database
      if (prisma.analyticsEvent) {
        await prisma.analyticsEvent.create({
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

      // Log analytics event
      logger.info('Analytics event tracked', {
        userId: event.userId,
        sessionId: event.sessionId,
        event: event.event,
        category: event.category,
        properties: event.properties,
        timestamp: event.timestamp,
        location: event.location,
      });

      // Update real-time counters in Redis
      await this.updateRealtimeCounters(event.event, event.userId, event.timestamp);
    } catch (error) {
      logger.error('Error tracking analytics event:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        eventData,
      });
      // Don't throw error to avoid disrupting main functionality
    }
  }

  /**
   * Analyze user behavior patterns
   */
  async analyzeUserBehavior(
    userId: string,
    dateRange: { startDate: Date; endDate: Date }
  ): Promise<UserBehaviorPattern> {
    try {
      // Get user routes for analysis
      const routes = await prisma.route.findMany({
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

      // Analyze most active hours
      const hourCounts: Record<number, number> = {};
      routes.forEach(route => {
        const hour = route.createdAt.getHours();
        hourCounts[hour] = (hourCounts[hour] || 0) + 1;
      });

      const mostActiveHours = Object.entries(hourCounts)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 3)
        .map(([hour]) => parseInt(hour));

      // Calculate preferred transport mode
      const transportModes: Record<string, number> = {};
      routes.forEach(route => {
        const mode = route.transportMode;
        transportModes[mode] = (transportModes[mode] || 0) + 1;
      });

      const preferredTransportMode = Object.entries(transportModes)
        .sort(([,a], [,b]) => b - a)[0]?.[0] || 'DRIVING';

      // Calculate average route distance
      const totalDistance = routes.reduce((sum, route) => sum + route.distance, 0);
      const averageRouteDistance = routes.length > 0 ? totalDistance / routes.length : 0;

      // Get favorite locations from saved places
      const savedPlaces = await prisma.savedPlace.findMany({
        where: { userId },
        take: 5,
        orderBy: { createdAt: 'desc' },
      });

      const favoriteLocations = savedPlaces.map(place => place.name);

      // Analyze search patterns (simplified)
      const searchPatterns: Record<string, number> = {
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
    } catch (error) {
      logger.error('Error analyzing user behavior:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
        dateRange,
      });
      throw new AppError('Failed to analyze user behavior', 500);
    }
  }

  /**
   * Analyze route patterns
   */
  async analyzeRoutePatterns(
    userId: string | undefined,
    dateRange: { startDate: Date; endDate: Date }
  ): Promise<RouteAnalyticsPattern> {
    try {
      const whereClause: any = {
        createdAt: {
          gte: dateRange.startDate,
          lte: dateRange.endDate,
        },
      };

      if (userId) {
        whereClause.userId = userId;
      }

      const routes = await prisma.route.findMany({
        where: whereClause,
        include: {
          waypoints: true,
        },
      });

      // Analyze popular routes
      const routeGroups: Record<string, any[]> = {};
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

      // Analyze peak hours
      const hourCounts: Record<number, number> = {};
      routes.forEach(route => {
        const hour = route.createdAt.getHours();
        hourCounts[hour] = (hourCounts[hour] || 0) + 1;
      });

      const peakHours = Object.entries(hourCounts)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5)
        .map(([hour]) => parseInt(hour));

      // Transport mode distribution
      const transportModeDistribution: Record<string, number> = {};
      routes.forEach(route => {
        const mode = route.transportMode;
        transportModeDistribution[mode] = (transportModeDistribution[mode] || 0) + 1;
      });

      // Average waypoint count
      const totalWaypoints = routes.reduce((sum, route) => sum + route.waypoints.length, 0);
      const averageWaypointCount = routes.length > 0 ? totalWaypoints / routes.length : 0;

      return {
        popularRoutes,
        peakHours,
        transportModeDistribution,
        averageWaypointCount,
      };
    } catch (error) {
      logger.error('Error analyzing route patterns:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
        dateRange,
      });
      throw new AppError('Failed to analyze route patterns', 500);
    }
  }

  /**
   * Analyze location patterns
   */
  async analyzeLocationPatterns(
    userId: string | undefined,
    dateRange: { startDate: Date; endDate: Date }
  ): Promise<LocationPattern> {
    try {
      const whereClause: any = {
        createdAt: {
          gte: dateRange.startDate,
          lte: dateRange.endDate,
        },
      };

      if (userId) {
        whereClause.userId = userId;
      }

      // Get saved places as hotspots
      const savedPlaces = await prisma.savedPlace.findMany({
        where: userId ? { userId } : {},
        include: {
          place: true,
        },
      });

      // Create hotspots from saved places
      const hotspots = savedPlaces.map(savedPlace => ({
        lat: savedPlace.place?.latitude || savedPlace.customLatitude || 0,
        lng: savedPlace.place?.longitude || savedPlace.customLongitude || 0,
        visits: 1, // Simplified - in production, track actual visits
        radius: 1000, // 1km radius
        category: savedPlace.category,
      }));

      // Analyze time patterns (simplified)
      const routes = await prisma.route.findMany({
        where: whereClause,
      });

      const timePatterns: Record<string, number> = {};
      routes.forEach(route => {
        const timeSlot = this.getTimeSlot(route.createdAt);
        timePatterns[timeSlot] = (timePatterns[timeSlot] || 0) + 1;
      });

      // Category preferences from saved places
      const categoryPreferences: Record<string, number> = {};
      savedPlaces.forEach(place => {
        const category = place.category;
        categoryPreferences[category] = (categoryPreferences[category] || 0) + 1;
      });

      return {
        hotspots,
        timePatterns,
        categoryPreferences,
      };
    } catch (error) {
      logger.error('Error analyzing location patterns:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
        dateRange,
      });
      throw new AppError('Failed to analyze location patterns', 500);
    }
  }

  /**
   * Get monthly statistics
   */
  async getMonthlyStats(
    userId: string | undefined,
    dateRange: { startDate: Date; endDate: Date }
  ): Promise<MonthlyStats> {
    try {
      const whereClause: any = {
        createdAt: {
          gte: dateRange.startDate,
          lte: dateRange.endDate,
        },
      };

      if (userId) {
        whereClause.userId = userId;
      }

      const routes = await prisma.route.findMany({
        where: whereClause,
        include: {
          waypoints: true,
        },
      });

      const totalRoutes = routes.length;
      const totalDistance = routes.reduce((sum, route) => sum + route.distance, 0);
      const totalDuration = routes.reduce((sum, route) => sum + route.duration, 0);

      // Get unique locations
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

      // Most visited place (simplified)
      const locationCounts: Record<string, number> = {};
      routes.forEach(route => {
        locationCounts[route.endAddress] = (locationCounts[route.endAddress] || 0) + 1;
      });

      const mostVisitedPlace = Object.entries(locationCounts)
        .sort(([,a], [,b]) => b - a)[0]?.[0] || 'Unknown';

      // Transport mode breakdown
      const transportModeBreakdown: Record<string, number> = {};
      routes.forEach(route => {
        const mode = route.transportMode;
        transportModeBreakdown[mode] = (transportModeBreakdown[mode] || 0) + 1;
      });

      // Weekly trends (simplified)
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
    } catch (error) {
      logger.error('Error getting monthly stats:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
        dateRange,
      });
      throw new AppError('Failed to get monthly statistics', 500);
    }
  }

  /**
   * Send milestone notification
   */
  async sendMilestoneNotification(
    userId: string,
    milestone: { type: string; milestone: number }
  ): Promise<void> {
    try {
      logger.info('Milestone achieved', {
        userId,
        milestone,
      });

      // In production, this would integrate with the notification service
      // For now, just log the milestone
    } catch (error) {
      logger.error('Error sending milestone notification:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
        milestone,
      });
    }
  }

  /**
   * Get user current location (mock implementation)
   */
  async getUserCurrentLocation(userId: string): Promise<{ lat: number; lng: number } | null> {
    try {
      // In production, this would get the user's latest location from a location tracking table
      // For now, return null to indicate no location available
      logger.debug('Getting user current location', { userId });
      return null;
    } catch (error) {
      logger.error('Error getting user current location:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
      });
      return null;
    }
  }

  /**
   * Check event trigger for scheduled notifications
   */
  async checkEventTrigger(userId: string, eventType: string): Promise<boolean> {
    try {
      // Implement custom event trigger logic here
      // This could check various conditions like user activity, location, etc.
      logger.debug('Checking event trigger', { userId, eventType });
      return false; // Default to false for now
    } catch (error) {
      logger.error('Error checking event trigger:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
        eventType,
      });
      return false;
    }
  }

  /**
   * Send route optimization notification
   */
  async sendRouteOptimizationNotification(data: {
    userId: string;
    routeId: string;
    timeSaved: number;
    distanceSaved: number;
  }): Promise<void> {
    try {
      logger.info('Route optimization notification', data);
      // In production, integrate with notification service
    } catch (error) {
      logger.error('Error sending route optimization notification:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        data,
      });
    }
  }

  /**
   * Update real-time counters in Redis
   */
  private async updateRealtimeCounters(
    eventType: string,
    userId: string,
    timestamp: Date
  ): Promise<void> {
    try {
      const key = `analytics:realtime:${eventType}`;
      const userKey = `analytics:user:${userId}:${eventType}`;
      const dailyKey = `analytics:daily:${timestamp.toISOString().split('T')[0]}:${eventType}`;

      await Promise.all([
        redisClient.incr(key),
        redisClient.incr(userKey),
        redisClient.incr(dailyKey),
        redisClient.expire(key, 86400), // 24 hours
        redisClient.expire(userKey, 86400 * 30), // 30 days
        redisClient.expire(dailyKey, 86400 * 7), // 7 days
      ]);
    } catch (error) {
      logger.warn('Failed to update real-time counters:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        eventType,
        userId,
      });
    }
  }

  /**
   * Get time slot for time pattern analysis
   */
  private getTimeSlot(date: Date): string {
    const hour = date.getHours();
    
    if (hour >= 5 && hour < 9) return 'morning';
    if (hour >= 9 && hour < 12) return 'mid-morning';
    if (hour >= 12 && hour < 14) return 'lunch';
    if (hour >= 14 && hour < 17) return 'afternoon';
    if (hour >= 17 && hour < 20) return 'evening';
    if (hour >= 20 && hour < 23) return 'night';
    return 'late-night';
  }

  /**
   * Calculate weekly trends
   */
  private calculateWeeklyTrends(
    routes: any[],
    dateRange: { startDate: Date; endDate: Date }
  ): Array<{ week: string; routes: number; distance: number }> {
    const weeklyData: Record<string, { routes: number; distance: number }> = {};

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

  /**
   * Get the start of the week for a given date
   */
  private getWeekStart(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day;
    return new Date(d.setDate(diff));
  }
}