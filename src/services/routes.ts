import { get, post, del, patch } from '../lib/api';
import type { 
  Route, 
  RouteCalculationRequest, 
  CalculatedRoute 
} from '../types/api';

class RoutesService {
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
      console.error('Error getting route alternatives:', error);
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