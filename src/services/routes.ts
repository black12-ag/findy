import { get, post, del, patch } from '../lib/api';
import { logger } from '../utils/logger';
import { directionsService } from './directionsService';
import type { 
  Route, 
  RouteCalculationRequest, 
  CalculatedRoute,
  SimpleRoute,
  RouteCoordinate
} from '../types/api';

interface StoredRoute {
  id: string;
  name: string;
  route: SimpleRoute;
  timestamp: number;
  userId?: string;
}

interface RouteHistory {
  origin: RouteCoordinate;
  destination: RouteCoordinate;
  timestamp: number;
  route: SimpleRoute;
}

class RoutesService {
  private routeHistory: RouteHistory[] = [];
  private savedRoutes: Map<string, StoredRoute> = new Map();
  private readonly ROUTE_HISTORY_KEY = 'comtion_route_history';
  private readonly SAVED_ROUTES_KEY = 'comtion_saved_routes';
  private readonly MAX_HISTORY_ITEMS = 50;
  constructor() {
    this.loadFromLocalStorage();
  }

  /**
   * Load data from localStorage
   */
  private loadFromLocalStorage() {
    try {
      const historyData = localStorage.getItem(this.ROUTE_HISTORY_KEY);
      if (historyData) {
        this.routeHistory = JSON.parse(historyData);
      }
      
      const routesData = localStorage.getItem(this.SAVED_ROUTES_KEY);
      if (routesData) {
        const routes = JSON.parse(routesData);
        this.savedRoutes = new Map(Object.entries(routes));
      }
    } catch (error) {
      logger.error('Failed to load routes from localStorage', error);
    }
  }

  /**
   * Save data to localStorage
   */
  private saveToLocalStorage() {
    try {
      localStorage.setItem(this.ROUTE_HISTORY_KEY, JSON.stringify(this.routeHistory));
      const routesObj = Object.fromEntries(this.savedRoutes.entries());
      localStorage.setItem(this.SAVED_ROUTES_KEY, JSON.stringify(routesObj));
    } catch (error) {
      logger.error('Failed to save routes to localStorage', error);
    }
  }

  /**
   * Enhanced route calculation using DirectionsService
   */
  async calculateRouteEnhanced(
    origin: RouteCoordinate,
    destination: RouteCoordinate,
    profile: 'driving-car' | 'foot-walking' | 'cycling-regular' = 'driving-car',
    options?: {
      includeAlternatives?: boolean;
      avoidTolls?: boolean;
      avoidHighways?: boolean;
    }
  ): Promise<SimpleRoute[]> {
    try {
      let routes: SimpleRoute[];
      
      if (options?.includeAlternatives) {
        // Get multiple alternatives
        routes = await directionsService.getEnhancedAlternativeRoutes(origin, destination, profile);
      } else {
        // Get single route
        const singleRoute = await directionsService.getRoute({
          profile,
          coordinates: [origin, destination],
          avoidTolls: options?.avoidTolls,
          avoidHighways: options?.avoidHighways,
          instructions: true
        });
        routes = [singleRoute];
      }
      
      // Add to history
      this.addToHistory(origin, destination, routes[0]);
      
      return routes;
    } catch (error) {
      logger.error('Failed to calculate enhanced route', error);
      throw error;
    }
  }

  /**
   * Add route to history
   */
  private addToHistory(origin: RouteCoordinate, destination: RouteCoordinate, route: SimpleRoute) {
    const historyItem: RouteHistory = {
      origin,
      destination,
      timestamp: Date.now(),
      route
    };
    
    // Add to beginning of array
    this.routeHistory.unshift(historyItem);
    
    // Keep only MAX_HISTORY_ITEMS
    if (this.routeHistory.length > this.MAX_HISTORY_ITEMS) {
      this.routeHistory = this.routeHistory.slice(0, this.MAX_HISTORY_ITEMS);
    }
    
    this.saveToLocalStorage();
  }

  /**
   * Get route history
   */
  getRouteHistory(): RouteHistory[] {
    return [...this.routeHistory];
  }

  /**
   * Clear route history
   */
  clearRouteHistory() {
    this.routeHistory = [];
    this.saveToLocalStorage();
  }

  /**
   * Save a route for later use
   */
  saveRouteLocally(name: string, route: SimpleRoute): string {
    const id = `route_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const storedRoute: StoredRoute = {
      id,
      name,
      route,
      timestamp: Date.now()
    };
    
    this.savedRoutes.set(id, storedRoute);
    this.saveToLocalStorage();
    
    return id;
  }

  /**
   * Get all saved routes
   */
  getSavedRoutes(): StoredRoute[] {
    return Array.from(this.savedRoutes.values())
      .sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Get a specific saved route
   */
  getSavedRoute(id: string): StoredRoute | null {
    return this.savedRoutes.get(id) || null;
  }

  /**
   * Delete a saved route
   */
  deleteSavedRoute(id: string): boolean {
    const deleted = this.savedRoutes.delete(id);
    if (deleted) {
      this.saveToLocalStorage();
    }
    return deleted;
  }

  /**
   * Calculate route between two points
   */
  async calculateRoute(params: RouteCalculationRequest): Promise<{
    route: CalculatedRoute;
  }> {
    return post('/routes/calculate', params);
  }

  /**
   * Optimize route with multiple waypoints
   */
  async optimizeRoute(params: {
    origin: {
      lat: number;
      lng: number;
      address?: string;
    };
    destination: {
      lat: number;
      lng: number;
      address?: string;
    };
    waypoints: Array<{
      lat: number;
      lng: number;
      address?: string;
    }>;
  }): Promise<{
    route: CalculatedRoute;
  }> {
    return post('/routes/optimize', params);
  }

  /**
   * Save a calculated route
   */
  async saveRoute(routeData: {
    name: string;
    origin: {
      lat: number;
      lng: number;
      address: string;
    };
    destination: {
      lat: number;
      lng: number;
      address: string;
    };
    waypoints?: Array<{
      lat: number;
      lng: number;
      address: string;
    }>;
    travelMode: 'DRIVING' | 'WALKING' | 'BICYCLING' | 'TRANSIT';
    distance: number;
    duration: number;
    isFavorite?: boolean;
  }): Promise<{
    route: Route;
  }> {
    return post('/routes', routeData);
  }

  /**
   * Get user's saved routes
   */
  async getUserRoutes(params: {
    travelMode?: 'DRIVING' | 'WALKING' | 'BICYCLING' | 'TRANSIT';
    favorites?: boolean;
    sortBy?: 'createdAt' | 'distance' | 'duration';
    sortOrder?: 'asc' | 'desc';
    page?: number;
    limit?: number;
  } = {}): Promise<{
    routes: Route[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> {
    const searchParams = new URLSearchParams();
    
    if (params.travelMode) searchParams.append('travelMode', params.travelMode);
    if (params.favorites) searchParams.append('favorites', 'true');
    if (params.sortBy) searchParams.append('sortBy', params.sortBy);
    if (params.sortOrder) searchParams.append('sortOrder', params.sortOrder);
    if (params.page) searchParams.append('page', params.page.toString());
    if (params.limit) searchParams.append('limit', params.limit.toString());

    return get(`/routes?${searchParams.toString()}`);
  }

  /**
   * Delete a saved route
   */
  async deleteRoute(routeId: string): Promise<void> {
    await del(`/routes/${routeId}`);
  }

  /**
   * Toggle favorite status of a saved route
   */
  async toggleRouteFavorite(routeId: string): Promise<{
    route: Route;
  }> {
    return patch(`/routes/${routeId}/favorite`);
  }

  /**
   * Get route alternatives
   */
  async getRouteAlternatives(
    origin: { lat: number; lng: number },
    destination: { lat: number; lng: number },
    travelMode: 'DRIVING' | 'WALKING' | 'BICYCLING' | 'TRANSIT' = 'DRIVING'
  ): Promise<CalculatedRoute[]> {
    // Get multiple route options by using different avoid parameters
    const promises = [
      this.calculateRoute({ origin, destination, travelMode }),
      this.calculateRoute({ origin, destination, travelMode, avoidHighways: true }),
      this.calculateRoute({ origin, destination, travelMode, avoidTolls: true }),
    ];

    try {
      const results = await Promise.allSettled(promises);
      return results
        .filter((result): result is PromiseFulfilledResult<{ route: CalculatedRoute }> => 
          result.status === 'fulfilled'
        )
        .map(result => result.value.route)
        .slice(0, 3); // Return up to 3 alternatives
    } catch (error) {
      logger.error('Error getting route alternatives', error);
      // Fallback to single route
      const result = await this.calculateRoute({ origin, destination, travelMode });
      return [result.route];
    }
  }

  /**
   * Get estimated travel time considering current traffic
   */
  async getTravelTime(
    origin: { lat: number; lng: number },
    destination: { lat: number; lng: number },
    travelMode: 'DRIVING' | 'WALKING' | 'BICYCLING' | 'TRANSIT' = 'DRIVING'
  ): Promise<{
    duration: number;
    durationInTraffic?: number;
    distance: number;
  }> {
    const result = await this.calculateRoute({
      origin,
      destination,
      travelMode,
    });

    return {
      duration: result.route.duration.value,
      distance: result.route.distance.value,
    };
  }

  /**
   * Format route for display
   */
  formatRoute(route: Route | CalculatedRoute): {
    id?: string;
    name?: string;
    from: { name: string; address: string };
    to: { name: string; address: string };
    distance: string;
    duration: string;
    mode: string;
    steps?: string[];
  } {
    if ('name' in route) {
      // It's a saved Route
      const waypoints = route.waypoints ? JSON.parse(route.waypoints) : [];
      return {
        id: route.id,
        name: route.name,
        from: { 
          name: this.extractLocationName(route.originAddress), 
          address: route.originAddress 
        },
        to: { 
          name: this.extractLocationName(route.destinationAddress), 
          address: route.destinationAddress 
        },
        distance: this.formatDistance(route.distance),
        duration: this.formatDuration(route.duration),
        mode: route.travelMode.toLowerCase(),
        steps: waypoints.map((wp: any) => wp.address),
      };
    } else {
      // It's a CalculatedRoute
      return {
        from: { 
          name: this.extractLocationName(route.startAddress), 
          address: route.startAddress 
        },
        to: { 
          name: this.extractLocationName(route.endAddress), 
          address: route.endAddress 
        },
        distance: route.distance.text,
        duration: route.duration.text,
        mode: 'driving', // Default for calculated routes
        steps: route.steps?.map(step => step.instruction) || [],
      };
    }
  }

  /**
   * Extract location name from full address
   */
  private extractLocationName(address: string): string {
    // Try to extract a meaningful name from the address
    const parts = address.split(',');
    return parts[0].trim() || address;
  }

  /**
   * Format distance in meters to readable string
   */
  private formatDistance(distanceMeters: number): string {
    if (distanceMeters < 1000) {
      return `${Math.round(distanceMeters)}m`;
    }
    return `${(distanceMeters / 1000).toFixed(1)}km`;
  }

  /**
   * Format duration in seconds to readable string
   */
  private formatDuration(durationSeconds: number): string {
    const minutes = Math.round(durationSeconds / 60);
    
    if (minutes < 60) {
      return `${minutes} min`;
    }
    
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    
    if (remainingMinutes === 0) {
      return `${hours} hr`;
    }
    
    return `${hours} hr ${remainingMinutes} min`;
  }

  /**
   * Get travel mode display name
   */
  getTravelModeDisplayName(mode: string): string {
    const modeMap: Record<string, string> = {
      'DRIVING': 'Driving',
      'WALKING': 'Walking',
      'BICYCLING': 'Cycling',
      'TRANSIT': 'Public Transit',
      'driving': 'Driving',
      'walking': 'Walking',
      'cycling': 'Cycling',
      'transit': 'Public Transit',
    };
    
    return modeMap[mode] || mode;
  }

  /**
   * Get travel mode icon
   */
  getTravelModeIcon(mode: string): string {
    const iconMap: Record<string, string> = {
      'DRIVING': '🚗',
      'WALKING': '🚶',
      'BICYCLING': '🚴',
      'TRANSIT': '🚌',
      'driving': '🚗',
      'walking': '🚶',
      'cycling': '🚴',
      'transit': '🚌',
    };
    
    return iconMap[mode] || '🚗';
  }

  /**
   * Share a route and generate shareable link
   */
  async shareRoute(routeId: string, options?: {
    includePersonalNotes?: boolean;
    expirationDays?: number;
  }): Promise<{
    shareId: string;
    shareLink: string;
    expiresAt: Date | null;
  }> {
    try {
      const route = this.getSavedRoute(routeId);
      if (!route) {
        throw new Error('Route not found');
      }

      // Generate unique share ID
      const shareId = `share_${Date.now()}_${Math.random().toString(36).substr(2, 12)}`;
      const expiresAt = options?.expirationDays 
        ? new Date(Date.now() + options.expirationDays * 24 * 60 * 60 * 1000)
        : null;

      // Create shareable route data
      const shareData = {
        id: shareId,
        routeId: route.id,
        route: {
          ...route.route,
          // Remove sensitive data if needed
          name: route.name
        },
        sharedAt: Date.now(),
        expiresAt: expiresAt?.getTime() || null,
        includePersonalNotes: options?.includePersonalNotes || false
      };

      // Store share data in localStorage (in real implementation, this would go to a backend)
      localStorage.setItem(`shared_route_${shareId}`, JSON.stringify(shareData));

      const shareLink = `${window.location.origin}/shared-route/${shareId}`;
      
      logger.info('Route shared', { routeId, shareId, expiresAt });
      
      return {
        shareId,
        shareLink,
        expiresAt
      };
    } catch (error) {
      logger.error('Failed to share route', error);
      throw error;
    }
  }

  /**
   * Get shared route by share ID
   */
  async getSharedRoute(shareId: string): Promise<{
    route: SimpleRoute;
    name: string;
    sharedAt: number;
    expiresAt: number | null;
    isExpired: boolean;
  } | null> {
    try {
      const shareData = localStorage.getItem(`shared_route_${shareId}`);
      if (!shareData) {
        return null;
      }

      const parsed = JSON.parse(shareData);
      
      // Check if expired
      const isExpired = parsed.expiresAt && Date.now() > parsed.expiresAt;
      
      if (isExpired) {
        // Clean up expired share
        localStorage.removeItem(`shared_route_${shareId}`);
        return null;
      }

      return {
        route: parsed.route,
        name: parsed.route.name || 'Shared Route',
        sharedAt: parsed.sharedAt,
        expiresAt: parsed.expiresAt,
        isExpired
      };
    } catch (error) {
      logger.error('Failed to get shared route', error);
      return null;
    }
  }

  /**
   * Generate route link for sharing via URL parameters
   */
  generateRouteLink(
    origin: RouteCoordinate,
    destination: RouteCoordinate,
    profile?: string,
    waypoints?: RouteCoordinate[]
  ): string {
    const params = new URLSearchParams();
    params.set('from', `${origin.lat},${origin.lng}`);
    params.set('to', `${destination.lat},${destination.lng}`);
    
    if (profile) {
      params.set('mode', profile);
    }
    
    if (waypoints && waypoints.length > 0) {
      const waypointStr = waypoints.map(wp => `${wp.lat},${wp.lng}`).join('|');
      params.set('waypoints', waypointStr);
    }
    
    return `${window.location.origin}/navigation?${params.toString()}`;
  }

  /**
   * Parse route from URL parameters
   */
  parseRouteFromUrl(searchParams: URLSearchParams): {
    origin: RouteCoordinate | null;
    destination: RouteCoordinate | null;
    profile?: string;
    waypoints?: RouteCoordinate[];
  } {
    try {
      const fromParam = searchParams.get('from');
      const toParam = searchParams.get('to');
      const modeParam = searchParams.get('mode');
      const waypointsParam = searchParams.get('waypoints');

      if (!fromParam || !toParam) {
        return { origin: null, destination: null };
      }

      const [fromLat, fromLng] = fromParam.split(',').map(Number);
      const [toLat, toLng] = toParam.split(',').map(Number);

      const origin: RouteCoordinate = { lat: fromLat, lng: fromLng };
      const destination: RouteCoordinate = { lat: toLat, lng: toLng };

      let waypoints: RouteCoordinate[] = [];
      if (waypointsParam) {
        waypoints = waypointsParam.split('|').map(wp => {
          const [lat, lng] = wp.split(',').map(Number);
          return { lat, lng };
        });
      }

      return {
        origin,
        destination,
        profile: modeParam || undefined,
        waypoints: waypoints.length > 0 ? waypoints : undefined
      };
    } catch (error) {
      logger.error('Failed to parse route from URL', error);
      return { origin: null, destination: null };
    }
  }

  /**
   * Validate route coordinates
   */
  validateCoordinates(lat: number, lng: number): boolean {
    return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
  }

  /**
   * Calculate route polyline bounds
   */
  calculateBounds(coordinates: Array<{ lat: number; lng: number }>): {
    northeast: { lat: number; lng: number };
    southwest: { lat: number; lng: number };
  } {
    if (coordinates.length === 0) {
      return {
        northeast: { lat: 0, lng: 0 },
        southwest: { lat: 0, lng: 0 },
      };
    }

    let north = coordinates[0].lat;
    let south = coordinates[0].lat;
    let east = coordinates[0].lng;
    let west = coordinates[0].lng;

    coordinates.forEach(coord => {
      north = Math.max(north, coord.lat);
      south = Math.min(south, coord.lat);
      east = Math.max(east, coord.lng);
      west = Math.min(west, coord.lng);
    });

    return {
      northeast: { lat: north, lng: east },
      southwest: { lat: south, lng: west },
    };
  }
}

export const routesService = new RoutesService();
export default routesService;