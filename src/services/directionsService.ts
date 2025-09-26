/**
 * 🧭 OpenRouteService Directions API Service
 * 
 * Handles all routing and navigation API calls with your quota limits
 * Directions V2: 2000/2000 requests (40/minute)
 */

import { 
  ORS_BASE_URL, 
  API_ENDPOINTS, 
  DEFAULT_HEADERS, 
  REQUEST_TIMEOUT,
  TransportProfile 
} from '../config/apiConfig';
import { quotaManager } from './quotaManager';
import { ORSDirectionsService, ORSCoordinate, convertORSRouteToAppRoute, setORSApiKey, formatDuration, formatDistance } from './openRouteService';

export interface RouteCoordinate {
  lng: number;
  lat: number;
}

export interface RouteOptions {
  profile?: TransportProfile;
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
  format?: 'json' | 'geojson';
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

export interface DirectionsResponse {
  routes: Array<{
    summary: {
      distance: number; // meters
      duration: number; // seconds
    };
    geometry: string; // encoded polyline
    segments?: RouteSegment[];
    way_points: number[];
    bbox?: [number, number, number, number]; // [minLng, minLat, maxLng, maxLat]
  }>;
  bbox?: [number, number, number, number];
  info: {
    copyrights: string[];
    took: number;
  };
}

export interface SimpleRoute {
  id: string;
  distance: string;
  duration: string;
  geometry: string;
  instructions: RouteInstruction[];
  summary: {
    distanceMeters: number;
    durationSeconds: number;
  };
  profile: TransportProfile;
  coordinates: RouteCoordinate[];
}

class DirectionsService {
  private cache: Map<string, { data: any; timestamp: number }> = new Map();
  private readonly cacheTTL = 5 * 60 * 1000; // 5 minutes
  private useRealAPI: boolean = false;
  
  constructor() {
    // Check if ORS API key is available
    this.useRealAPI = !!process.env.VITE_ORS_API_KEY;
    if (this.useRealAPI) {
      setORSApiKey(process.env.VITE_ORS_API_KEY!);
    }
  }

  /**
   * Get route using OpenRouteService API (if available) or fallback to existing implementation
   */
  async getRouteWithORS(
    start: RouteCoordinate,
    end: RouteCoordinate,
    transportMode: 'driving' | 'walking' | 'cycling' | 'transit' = 'driving',
    options?: {
      avoidTolls?: boolean;
      avoidHighways?: boolean;
      avoidFerries?: boolean;
      alternative?: boolean;
    }
  ): Promise<any> {
    const cacheKey = `ors_route_${start.lng}_${start.lat}_${end.lng}_${end.lat}_${transportMode}_${JSON.stringify(options || {})}`;
    
    // Check cache first
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      quotaManager.recordUsage('DIRECTIONS', true, true);
      return cached;
    }

    if (this.useRealAPI) {
      // Check quota
      const quotaCheck = quotaManager.canMakeRequest('DIRECTIONS');
      if (!quotaCheck.allowed) {
        console.warn(`Directions API quota exceeded: ${quotaCheck.reason}. Falling back to mock.`);
        return this.getMockRoute(start, end, transportMode);
      }

      try {
        // Map transport modes to ORS profiles
        const profileMap = {
          'driving': 'driving-car' as const,
          'walking': 'foot-walking' as const,
          'cycling': 'cycling-regular' as const,
          'transit': 'foot-walking' as const // ORS doesn't have direct public transit
        };

        const profile = profileMap[transportMode] || 'driving-car';
        
        const orsStart: ORSCoordinate = { lat: start.lat, lng: start.lng };
        const orsEnd: ORSCoordinate = { lat: end.lat, lng: end.lng };

        const orsResponse = await ORSDirectionsService.getDirections(
          orsStart,
          orsEnd,
          profile,
          options
        );

        const convertedRoute = convertORSRouteToAppRoute(orsResponse, transportMode);
        
        // Add additional fields expected by the app
        const appRoute = {
          ...convertedRoute,
          from: { lat: start.lat, lng: start.lng },
          to: { lat: end.lat, lng: end.lng },
          transportMode
        };

        // Cache the result
        this.setCache(cacheKey, appRoute);
        quotaManager.recordUsage('DIRECTIONS', true);
        
        return appRoute;
      } catch (error) {
        console.error('ORS directions failed:', error);
        quotaManager.recordUsage('DIRECTIONS', false);
        
        // Fall back to mock data
        return this.getMockRoute(start, end, transportMode);
      }
    }

    // Use mock data if ORS is not available
    return this.getMockRoute(start, end, transportMode);
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
      distance: formatDistance(distance * 1000),
      duration: formatDuration(duration * 60),
      mode: transportMode,
      steps: [
        `Head ${this.getDirection(start, end)} on your route`,
        `Continue for ${formatDistance(distance * 1000)}`,
        'You have arrived at your destination'
      ],
      from: start,
      to: end,
      transportMode
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
   * Get route between two or more points
   */
  async getRoute(options: RouteOptions): Promise<SimpleRoute> {
    const cacheKey = this.getCacheKey(options);
    
    // Check cache first
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      quotaManager.recordUsage('DIRECTIONS', true, true);
      return cached;
    }

    // Check quota
    const quotaCheck = quotaManager.canMakeRequest('DIRECTIONS');
    if (!quotaCheck.allowed) {
      throw new Error(`Directions API quota exceeded: ${quotaCheck.reason}`);
    }

    try {
      const response = await this.makeDirectionsRequest(options);
      const simpleRoute = this.transformResponse(response, options);
      
      // Cache the result
      this.setCache(cacheKey, simpleRoute);
      
      // Record successful usage
      quotaManager.recordUsage('DIRECTIONS', true);
      
      return simpleRoute;
    } catch (error) {
      quotaManager.recordUsage('DIRECTIONS', false);
      throw error;
    }
  }

  /**
   * Get multiple route alternatives
   */
  async getAlternativeRoutes(
    start: RouteCoordinate,
    end: RouteCoordinate,
    profile: TransportProfile = 'driving-car',
    maxAlternatives: number = 3
  ): Promise<SimpleRoute[]> {
    const options: RouteOptions = {
      profile,
      coordinates: [start, end],
      alternativeRoutes: {
        targetCount: maxAlternatives,
        weightFactor: 1.4
      },
      instructions: true,
      format: 'json'
    };

    const cacheKey = this.getCacheKey(options);
    const cached = this.getFromCache(cacheKey);
    
    if (cached) {
      quotaManager.recordUsage('DIRECTIONS', true, true);
      return Array.isArray(cached) ? cached : [cached];
    }

    const quotaCheck = quotaManager.canMakeRequest('DIRECTIONS');
    if (!quotaCheck.allowed) {
      throw new Error(`Directions API quota exceeded: ${quotaCheck.reason}`);
    }

    try {
      const response = await this.makeDirectionsRequest(options);
      const routes = response.routes.map((route, index) => 
        this.transformSingleRoute(route, options, index)
      );
      
      this.setCache(cacheKey, routes);
      quotaManager.recordUsage('DIRECTIONS', true);
      
      return routes;
    } catch (error) {
      quotaManager.recordUsage('DIRECTIONS', false);
      throw error;
    }
  }

  /**
   * Get optimized route for multiple waypoints
   */
  async getOptimizedRoute(
    waypoints: RouteCoordinate[],
    profile: TransportProfile = 'driving-car'
  ): Promise<SimpleRoute> {
    if (waypoints.length < 2) {
      throw new Error('At least 2 waypoints are required');
    }

    const options: RouteOptions = {
      profile,
      coordinates: waypoints,
      preference: 'fastest',
      instructions: true,
      format: 'json'
    };

    return this.getRoute(options);
  }

  /**
   * Make the actual API request to OpenRouteService
   */
  private async makeDirectionsRequest(options: RouteOptions): Promise<DirectionsResponse> {
    const { profile = 'driving-car', coordinates, ...otherOptions } = options;
    
    // Simple GET request for basic routing
    if (coordinates.length === 2 && !otherOptions.alternativeRoutes) {
      const [start, end] = coordinates;
      const params = new URLSearchParams({
        start: `${start.lng},${start.lat}`,
        end: `${end.lng},${end.lat}`,
        format: options.format || 'json',
        instructions: String(options.instructions !== false),
        units: options.units || 'km'
      });

      const url = `${ORS_BASE_URL}${API_ENDPOINTS.DIRECTIONS.base}/${profile}?${params}`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: DEFAULT_HEADERS,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT.DIRECTIONS)
      });

      if (!response.ok) {
        throw new Error(`Directions API error: ${response.status} ${response.statusText}`);
      }

      return response.json();
    }

    // POST request for complex routing
    const body = {
      coordinates: coordinates.map(coord => [coord.lng, coord.lat]),
      format: options.format || 'json',
      instructions: options.instructions !== false,
      units: options.units || 'km',
      ...this.buildRequestOptions(otherOptions)
    };

    const url = `${ORS_BASE_URL}${API_ENDPOINTS.DIRECTIONS.base}/${profile}`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: DEFAULT_HEADERS,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT.DIRECTIONS)
    });

    if (!response.ok) {
      throw new Error(`Directions API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Build request options for POST requests
   */
  private buildRequestOptions(options: Partial<RouteOptions>) {
    const requestOptions: any = {};

    if (options.preference) {
      requestOptions.preference = options.preference;
    }

    if (options.avoidTolls || options.avoidHighways || options.avoidFerries) {
      requestOptions.options = {};
      if (options.avoidTolls) requestOptions.options.avoid_features = ['tollways'];
      if (options.avoidHighways) {
        requestOptions.options.avoid_features = [
          ...(requestOptions.options.avoid_features || []),
          'highways'
        ];
      }
      if (options.avoidFerries) {
        requestOptions.options.avoid_features = [
          ...(requestOptions.options.avoid_features || []),
          'ferries'
        ];
      }
    }

    if (options.alternativeRoutes) {
      requestOptions.alternative_routes = options.alternativeRoutes;
    }

    return requestOptions;
  }

  /**
   * Transform API response to simplified format
   */
  private transformResponse(response: DirectionsResponse, options: RouteOptions): SimpleRoute {
    if (!response.routes || response.routes.length === 0) {
      throw new Error('No route found');
    }

    return this.transformSingleRoute(response.routes[0], options, 0);
  }

  /**
   * Transform single route from API response
   */
  private transformSingleRoute(
    route: DirectionsResponse['routes'][0], 
    options: RouteOptions,
    index: number
  ): SimpleRoute {
    const instructions: RouteInstruction[] = [];
    
    if (route.segments) {
      route.segments.forEach(segment => {
        instructions.push(...segment.steps);
      });
    }

    return {
      id: `route_${Date.now()}_${index}`,
      distance: this.formatDistance(route.summary.distance),
      duration: this.formatDuration(route.summary.duration),
      geometry: route.geometry,
      instructions,
      summary: {
        distanceMeters: route.summary.distance,
        durationSeconds: route.summary.duration
      },
      profile: options.profile || 'driving-car',
      coordinates: options.coordinates
    };
  }

  /**
   * Format distance for display
   */
  private formatDistance(meters: number): string {
    if (meters < 1000) {
      return `${Math.round(meters)} m`;
    } else {
      return `${(meters / 1000).toFixed(1)} km`;
    }
  }

  /**
   * Format duration for display
   */
  private formatDuration(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else {
      return `${minutes}m`;
    }
  }

  /**
   * Generate cache key for request
   */
  private getCacheKey(options: RouteOptions): string {
    const key = {
      profile: options.profile,
      coordinates: options.coordinates,
      preference: options.preference,
      avoidTolls: options.avoidTolls,
      avoidHighways: options.avoidHighways,
      avoidFerries: options.avoidFerries,
      alternativeRoutes: options.alternativeRoutes
    };
    
    return `directions_${JSON.stringify(key)}`;
  }

  /**
   * Get data from cache
   */
  private getFromCache(key: string) {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      return cached.data;
    }
    return null;
  }

  /**
   * Store data in cache
   */
  private setCache(key: string, data: any) {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });

    // Clean old cache entries
    if (this.cache.size > 50) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }
  }

  /**
   * Get current quota status for debugging
   */
  getQuotaStatus() {
    return quotaManager.getQuotaStatus('DIRECTIONS');
  }
}

export const directionsService = new DirectionsService();
export default directionsService;