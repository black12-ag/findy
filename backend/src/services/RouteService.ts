import axios from 'axios';
import { AppError } from '@/utils/error';
import { logger } from '@/config/logger';
import { redisClient } from '@/config/redis';
import { prisma } from '@/config/database';
import { config } from '@/config/env';

export interface RouteWaypoint {
  lat: number;
  lng: number;
  placeId?: string;
  name?: string;
  address?: string;
}

export interface RoutePreferences {
  mode: 'driving' | 'walking' | 'bicycling' | 'transit';
  avoidTolls?: boolean;
  avoidHighways?: boolean;
  avoidFerries?: boolean;
  optimize?: boolean;
}

export interface Route {
  distance: number; // in meters
  duration: number; // in seconds
  geometry: any; // GeoJSON or encoded polyline
  bounds: {
    north: number;
    south: number;
    east: number;
    west: number;
  };
  steps: RouteStep[];
  warnings?: string[];
  trafficMultiplier?: number;
  estimatedFuel?: number;
  estimatedCost?: number;
}

export interface RouteStep {
  instruction: string;
  distance: number;
  duration: number;
  startLocation: {
    lat: number;
    lng: number;
  };
  endLocation: {
    lat: number;
    lng: number;
  };
  maneuver?: string;
  polyline?: string;
}

export interface RouteOptions {
  alternatives?: boolean;
  traffic?: boolean;
  language?: string;
  units?: 'metric' | 'imperial';
}

export class RouteService {
  private readonly GOOGLE_MAPS_API_KEY: string;
  private readonly MAPBOX_API_KEY: string;
  private readonly CACHE_TTL = 3600; // 1 hour

  constructor() {
    this.GOOGLE_MAPS_API_KEY = config.api.googleMaps.key || '';
    this.MAPBOX_API_KEY = config.api.mapbox.key || '';
  }

  /**
   * Calculate route between waypoints
   */
  async calculateRoute(
    waypoints: RouteWaypoint[],
    preferences: RoutePreferences,
    options: RouteOptions = {}
  ): Promise<Route> {
    try {
      if (waypoints.length < 2) {
        throw new AppError('At least 2 waypoints are required', 400);
      }

      // Check cache first
      const cacheKey = this.generateCacheKey(waypoints, preferences, options);
      const cachedRoute = await this.getCachedRoute(cacheKey);
      
      if (cachedRoute) {
        logger.debug('Route served from cache', { cacheKey });
        return cachedRoute;
      }

      // Calculate route using Google Directions API
      const route = await this.calculateGoogleRoute(waypoints, preferences, options);

      // Cache the result
      await this.cacheRoute(cacheKey, route);

      // Log route calculation
      logger.info('Route calculated successfully', {
        waypointCount: waypoints.length,
        distance: route.distance,
        duration: route.duration,
        mode: preferences.mode,
      });

      return route;
    } catch (error) {
      logger.error('Route calculation failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        waypoints: waypoints.length,
        mode: preferences.mode,
      });
      throw error;
    }
  }

  /**
   * Get alternative routes
   */
  async getAlternativeRoutes(
    waypoints: RouteWaypoint[],
    preferences: RoutePreferences,
    maxAlternatives: number = 3
  ): Promise<Route[]> {
    try {
      const routes = await this.calculateGoogleRoute(waypoints, preferences, {
        alternatives: true,
      });

      // Google returns multiple routes in the response
      // For now, return single route wrapped in array
      // In production, parse multiple routes from Google response
      return [routes].slice(0, maxAlternatives);
    } catch (error) {
      logger.error('Alternative routes calculation failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return [];
    }
  }

  /**
   * Optimize waypoint order for shortest route
   */
  async optimizeWaypointOrder(
    waypoints: RouteWaypoint[],
    preferences: RoutePreferences
  ): Promise<Route> {
    try {
      if (waypoints.length <= 2) {
        return this.calculateRoute(waypoints, preferences);
      }

      // Use Google's waypoint optimization
      const optimizedPreferences = {
        ...preferences,
        optimize: true,
      };

      return this.calculateRoute(waypoints, optimizedPreferences);
    } catch (error) {
      logger.error('Waypoint optimization failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      // Fallback to original order
      return this.calculateRoute(waypoints, preferences);
    }
  }

  /**
   * Update existing route in database
   */
  async updateRoute(routeId: string, route: Route): Promise<void> {
    try {
      await prisma.route.update({
        where: { id: routeId },
        data: {
          distance: route.distance,
          duration: route.duration,
          routeGeometry: route.geometry,
          updatedAt: new Date(),
        },
      });

      logger.info('Route updated in database', { routeId });
    } catch (error) {
      logger.error('Failed to update route in database', {
        routeId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw new AppError('Failed to update route', 500);
    }
  }

  /**
   * Get route from cache
   */
  private async getCachedRoute(cacheKey: string): Promise<Route | null> {
    try {
      const cachedData = await redisClient.get(cacheKey);
      return cachedData ? JSON.parse(cachedData) : null;
    } catch (error) {
      logger.warn('Cache lookup failed', {
        cacheKey,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return null;
    }
  }

  /**
   * Cache route data
   */
  private async cacheRoute(cacheKey: string, route: Route): Promise<void> {
    try {
      await redisClient.setex(cacheKey, this.CACHE_TTL, JSON.stringify(route));
    } catch (error) {
      logger.warn('Route caching failed', {
        cacheKey,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Generate cache key for route
   */
  private generateCacheKey(
    waypoints: RouteWaypoint[],
    preferences: RoutePreferences,
    options: RouteOptions
  ): string {
    const waypointString = waypoints
      .map(w => `${w.lat.toFixed(6)},${w.lng.toFixed(6)}`)
      .join('|');
    
    const prefsString = `${preferences.mode}_${preferences.avoidTolls}_${preferences.avoidHighways}_${preferences.avoidFerries}`;
    const optsString = `${options.alternatives}_${options.traffic}`;
    
    return `route:${Buffer.from(`${waypointString}_${prefsString}_${optsString}`).toString('base64')}`;
  }

  /**
   * Calculate route using Google Directions API
   */
  private async calculateGoogleRoute(
    waypoints: RouteWaypoint[],
    preferences: RoutePreferences,
    options: RouteOptions = {}
  ): Promise<Route> {
    try {
      const origin = waypoints[0];
      const destination = waypoints[waypoints.length - 1];
      const intermediateWaypoints = waypoints.slice(1, -1);

      const params: any = {
        origin: `${origin.lat},${origin.lng}`,
        destination: `${destination.lat},${destination.lng}`,
        mode: preferences.mode,
        key: this.GOOGLE_MAPS_API_KEY,
        language: options.language || 'en',
        units: options.units || 'metric',
        alternatives: options.alternatives || false,
      };

      // Add intermediate waypoints
      if (intermediateWaypoints.length > 0) {
        const waypointString = intermediateWaypoints
          .map(w => `${w.lat},${w.lng}`)
          .join('|');
        
        params.waypoints = preferences.optimize 
          ? `optimize:true|${waypointString}`
          : waypointString;
      }

      // Add avoidance preferences
      const avoid = [];
      if (preferences.avoidTolls) avoid.push('tolls');
      if (preferences.avoidHighways) avoid.push('highways');
      if (preferences.avoidFerries) avoid.push('ferries');
      
      if (avoid.length > 0) {
        params.avoid = avoid.join('|');
      }

      // Add traffic information
      if (options.traffic) {
        params.departure_time = 'now';
      }

      const response = await axios.get('https://maps.googleapis.com/maps/api/directions/json', {
        params,
        timeout: 10000,
      });

      if (response.data.status !== 'OK') {
        throw new AppError(`Google Directions API error: ${response.data.status}`, 400);
      }

      const route = response.data.routes[0];
      const leg = route.legs[0];

      return this.parseGoogleRoute(route, leg);
    } catch (error) {
      if (axios.isAxiosError(error)) {
        logger.error('Google Directions API request failed', {
          status: error.response?.status,
          message: error.message,
        });
        throw new AppError('Route calculation service unavailable', 503);
      }
      throw error;
    }
  }

  /**
   * Parse Google Directions API response
   */
  private parseGoogleRoute(route: any, leg: any): Route {
    const steps: RouteStep[] = leg.steps.map((step: any) => ({
      instruction: step.html_instructions.replace(/<[^>]*>/g, ''), // Remove HTML tags
      distance: step.distance.value,
      duration: step.duration.value,
      startLocation: {
        lat: step.start_location.lat,
        lng: step.start_location.lng,
      },
      endLocation: {
        lat: step.end_location.lat,
        lng: step.end_location.lng,
      },
      maneuver: step.maneuver,
      polyline: step.polyline.points,
    }));

    return {
      distance: leg.distance.value,
      duration: leg.duration.value,
      geometry: route.overview_polyline.points,
      bounds: {
        north: route.bounds.northeast.lat,
        south: route.bounds.southwest.lat,
        east: route.bounds.northeast.lng,
        west: route.bounds.southwest.lng,
      },
      steps,
      warnings: route.warnings || [],
      trafficMultiplier: leg.duration_in_traffic 
        ? leg.duration_in_traffic.value / leg.duration.value 
        : undefined,
    };
  }

  /**
   * Estimate fuel consumption for route
   */
  async estimateFuelConsumption(
    distance: number, // in meters
    vehicleType: 'car' | 'motorcycle' | 'truck' = 'car'
  ): Promise<number> {
    const distanceKm = distance / 1000;
    
    // Average fuel consumption (L/100km)
    const fuelConsumptionRates = {
      car: 8.5,
      motorcycle: 4.5,
      truck: 25.0,
    };

    const rate = fuelConsumptionRates[vehicleType];
    return (distanceKm * rate) / 100;
  }

  /**
   * Estimate route cost (fuel + tolls)
   */
  async estimateRouteCost(
    route: Route,
    fuelPricePerLiter: number = 1.5,
    vehicleType: 'car' | 'motorcycle' | 'truck' = 'car'
  ): Promise<number> {
    const fuelNeeded = await this.estimateFuelConsumption(route.distance, vehicleType);
    const fuelCost = fuelNeeded * fuelPricePerLiter;
    
    // Estimate toll costs (simplified)
    const estimatedTollCost = route.warnings?.some(w => w.includes('toll')) ? 5.0 : 0;
    
    return fuelCost + estimatedTollCost;
  }

  /**
   * Get ETA with current traffic
   */
  async getETAWithTraffic(
    waypoints: RouteWaypoint[],
    preferences: RoutePreferences
  ): Promise<{ duration: number; durationInTraffic: number; eta: Date }> {
    try {
      const route = await this.calculateRoute(waypoints, preferences, {
        traffic: true,
      });

      const durationInTraffic = route.trafficMultiplier 
        ? route.duration * route.trafficMultiplier
        : route.duration;

      const eta = new Date(Date.now() + durationInTraffic * 1000);

      return {
        duration: route.duration,
        durationInTraffic,
        eta,
      };
    } catch (error) {
      logger.error('ETA calculation failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw new AppError('Failed to calculate ETA', 500);
    }
  }
}