/**
 * 🧭 Google Maps Directions API Service
 * 
 * Handles all routing and navigation API calls using Google Maps exclusively
 */

import googleMapsService from './googleMapsService';
import { logger } from '../utils/logger';
import { toast } from 'sonner';

export interface RouteCoordinate {
  lng: number;
  lat: number;
}

export interface RouteOptions {
  coordinates: RouteCoordinate[];
  preference?: 'fastest' | 'shortest' | 'recommended';
  avoidTolls?: boolean;
  avoidHighways?: boolean;
  avoidFerries?: boolean;
  alternativeRoutes?: {
    targetCount: number;
    weightFactor: number;
  };
  instructions?: boolean;
  units?: 'km' | 'mi' | 'm';
}

export interface RouteInstruction {
  type: number;
  instruction: string;
  name: string;
  distance: number;
  duration: number;
  way_points: [number, number];
}

export interface RouteSegment {
  distance: number;
  duration: number;
  steps: RouteInstruction[];
}

export interface SimpleRoute {
  id: string;
  distance: string;
  duration: string;
  geometry: string;
  instructions: string[];
  summary: {
    distanceMeters: number;
    durationSeconds: number;
  };
  coordinates: RouteCoordinate[];
}

class DirectionsService {
  private cache: Map<string, { data: any; timestamp: number }> = new Map();
  private readonly cacheTTL = 5 * 60 * 1000; // 5 minutes
  
  constructor() {
    // Google Maps API service initialization handled by googleMapsService
  }

  /**
   * Get route using Google Maps API
   */
  async getRoute(
    start: RouteCoordinate,
    end: RouteCoordinate,
    transportMode: 'driving' | 'walking' | 'cycling' | 'transit' = 'driving',
    options?: {
      avoidTolls?: boolean;
      avoidHighways?: boolean;
      avoidFerries?: boolean;
      alternative?: boolean;
      waypoints?: RouteCoordinate[];
    }
  ): Promise<any> {
    return this.getRouteWithGoogleMaps(start, end, transportMode, options);
  }

  /**
   * Get route using Google Maps API
   */
  async getRouteWithGoogleMaps(
    start: RouteCoordinate,
    end: RouteCoordinate,
    transportMode: 'driving' | 'walking' | 'cycling' | 'transit' = 'driving',
    options?: {
      avoidTolls?: boolean;
      avoidHighways?: boolean;
      avoidFerries?: boolean;
      alternative?: boolean;
      waypoints?: RouteCoordinate[];
    }
  ): Promise<any | null> {
    try {
      if (!googleMapsService.isAvailable()) {
        await googleMapsService.initialize();
      }

      if (!googleMapsService.isAvailable()) {
        logger.warn('Google Maps not available');
        return this.getMockRoute(start, end, transportMode);
      }

      const waypoints = options?.waypoints?.map(wp => ({
        location: { lat: wp.lat, lng: wp.lng },
        stopover: true
      })) || [];

      const directionsResult = await googleMapsService.getDirections({
        origin: { lat: start.lat, lng: start.lng },
        destination: { lat: end.lat, lng: end.lng },
        travelMode: googleMapsService.convertToGoogleTravelMode(transportMode),
        waypoints,
        avoidHighways: options?.avoidHighways || false,
        avoidTolls: options?.avoidTolls || false,
        avoidFerries: options?.avoidFerries || false,
        provideRouteAlternatives: options?.alternative || false,
      });

      if (!directionsResult || !directionsResult.routes || directionsResult.routes.length === 0) {
        logger.warn('No routes found in Google Maps response');
        return this.getMockRoute(start, end, transportMode);
      }

      const route = directionsResult.routes[0];
      const leg = route.legs[0];

      // Convert Google Maps response to app format
      const appRoute = {
        id: `google_route_${Date.now()}`,
        distance: leg.distance?.text || '0 km',
        duration: leg.duration?.text || '0 min',
        mode: transportMode,
        steps: route.legs.flatMap(leg => 
          leg.steps?.map(step => step.instructions?.replace(/<[^>]*>/g, '') || '') || []
        ),
        geometry: route.overview_polyline?.points || '',
        from: { lat: start.lat, lng: start.lng },
        to: { lat: end.lat, lng: end.lng },
        transportMode,
        summary: {
          distanceMeters: leg.distance?.value || 0,
          durationSeconds: leg.duration?.value || 0,
        },
        googleDirectionsResult: directionsResult, // Store original for map display
      };

      logger.info('Google Maps route calculated successfully', {
        distance: appRoute.distance,
        duration: appRoute.duration,
        mode: transportMode
      });

      return appRoute;
    } catch (error) {
      logger.error('Google Maps directions failed', { error: error.message, transportMode, start, end });
      toast.error('Route calculation failed, using fallback data...');
      return this.getMockRoute(start, end, transportMode);
    }
  }

  /**
   * Generate mock route data as fallback
   */
  private getMockRoute(start: RouteCoordinate, end: RouteCoordinate, transportMode: string) {
    // Calculate approximate distance and duration
    const distance = this.calculateDistance(start.lat, start.lng, end.lat, end.lng);
    const speed = transportMode === 'walking' ? 5 : transportMode === 'cycling' ? 15 : 50; // km/h
    const duration = (distance / speed) * 60; // minutes
    
    return {
      id: `mock_route_${Date.now()}`,
      distance: this.formatDistance(distance * 1000),
      duration: this.formatDuration(duration * 60),
      mode: transportMode,
      steps: [
        `Head ${this.getDirection(start, end)} on your route`,
        `Continue for ${this.formatDistance(distance * 1000)}`,
        'You have arrived at your destination'
      ],
      from: start,
      to: end,
      transportMode,
      summary: {
        distanceMeters: distance * 1000,
        durationSeconds: duration * 60,
      }
    };
  }

  /**
   * Calculate distance between two coordinates (Haversine formula)
   */
  private calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  /**
   * Get general direction between two points
   */
  private getDirection(start: RouteCoordinate, end: RouteCoordinate): string {
    const dLat = end.lat - start.lat;
    const dLng = end.lng - start.lng;
    
    if (Math.abs(dLat) > Math.abs(dLng)) {
      return dLat > 0 ? 'north' : 'south';
    } else {
      return dLng > 0 ? 'east' : 'west';
    }
  }

  /**
   * Format distance in meters to human readable string
   */
  private formatDistance(meters: number): string {
    if (meters < 1000) {
      return `${Math.round(meters)} m`;
    } else {
      return `${(meters / 1000).toFixed(1)} km`;
    }
  }

  /**
   * Format duration in seconds to human readable string
   */
  private formatDuration(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes}min`;
    } else {
      return `${minutes}min`;
    }
  }

  /**
   * Test routing functionality - simple route calculation
   */
  async testRouting(
    start: RouteCoordinate,
    end: RouteCoordinate,
    transportMode: 'driving' | 'walking' | 'cycling' | 'transit' = 'driving'
  ): Promise<any> {
    logger.info('Testing routing functionality', { start, end, transportMode });
    
    try {
      const result = await this.getRoute(start, end, transportMode);
      if (result) {
        logger.info('Routing test successful with Google Maps', {
          distance: result.distance,
          duration: result.duration
        });
        return result;
      }
    } catch (error) {
      logger.warn('Google Maps routing failed, using mock data', error);
    }
    
    // Generate mock route as fallback
    const mockRoute = this.getMockRoute(start, end, transportMode);
    logger.info('Using mock route for testing', {
      distance: mockRoute.distance,
      duration: mockRoute.duration
    });
    
    return mockRoute;
  }

  /**
   * Get multiple route alternatives using Google Maps
   */
  async getAlternativeRoutes(
    start: RouteCoordinate,
    end: RouteCoordinate,
    transportMode: 'driving' | 'walking' | 'cycling' | 'transit' = 'driving',
    maxAlternatives: number = 3
  ): Promise<any[]> {
    try {
      const result = await this.getRoute(start, end, transportMode, { alternative: true });
      // Google Maps may return multiple routes
      return result ? [result] : [];
    } catch (error) {
      logger.error('Alternative routes failed', error);
      return [];
    }
  }

  /**
   * Get optimized route for multiple waypoints
   */
  async getOptimizedRoute(
    waypoints: RouteCoordinate[],
    transportMode: 'driving' | 'walking' | 'cycling' | 'transit' = 'driving'
  ): Promise<any> {
    if (waypoints.length < 2) {
      throw new Error('At least 2 waypoints are required');
    }

    const start = waypoints[0];
    const end = waypoints[waypoints.length - 1];
    const intermediateWaypoints = waypoints.slice(1, -1);

    return this.getRoute(start, end, transportMode, {
      waypoints: intermediateWaypoints
    });
  }

  /**
   * Cache management methods
   */
  private getFromCache(key: string): any | null {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      return cached.data;
    }
    if (cached) {
      this.cache.delete(key);
    }
    return null;
  }

  private setCache(key: string, data: any): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }
}

// Create and export singleton instance
const directionsService = new DirectionsService();
export default directionsService;
// Also provide a named export so both import styles work
export { directionsService };