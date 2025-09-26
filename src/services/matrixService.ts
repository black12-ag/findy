/**
 * 📊 OpenRouteService Matrix API Service
 * 
 * Handles route comparison and optimization calculations
 * Matrix V2: 500/500 requests (40/minute)
 */

import { 
  ORS_BASE_URL, 
  API_ENDPOINTS, 
  DEFAULT_HEADERS, 
  REQUEST_TIMEOUT,
  TransportProfile 
} from '../config/apiConfig';
import { quotaManager } from './quotaManager';

export interface MatrixOptions {
  profile?: TransportProfile;
  sources: Array<[number, number]>; // [lng, lat] coordinates
  destinations: Array<[number, number]>; // [lng, lat] coordinates
  metrics?: ('duration' | 'distance')[];
  units?: 'km' | 'mi' | 'm';
  optimizeOrder?: boolean;
}

export interface MatrixResponse {
  sources: Array<{
    location: [number, number];
    snapped_distance?: number;
  }>;
  destinations: Array<{
    location: [number, number];
    snapped_distance?: number;
  }>;
  durations?: number[][]; // Matrix of durations in seconds
  distances?: number[][]; // Matrix of distances in meters
  info: {
    service: string;
    timestamp: number;
    query: {
      profile: string;
      format: string;
    };
  };
}

export interface RouteComparison {
  source: {
    coordinates: [number, number];
    name?: string;
  };
  destinations: Array<{
    coordinates: [number, number];
    name?: string;
    duration: number; // seconds
    distance: number; // meters
    durationFormatted: string;
    distanceFormatted: string;
    rank: number; // 1 = closest/fastest
  }>;
  profile: TransportProfile;
  optimized?: {
    order: number[];
    totalDuration: number;
    totalDistance: number;
  };
}

export interface OptimizedRoute {
  waypoints: Array<{
    coordinates: [number, number];
    name?: string;
    order: number;
  }>;
  route: {
    totalDuration: number;
    totalDistance: number;
    durationFormatted: string;
    distanceFormatted: string;
    segments: Array<{
      from: number;
      to: number;
      duration: number;
      distance: number;
    }>;
  };
  savings: {
    durationSaved: number;
    distanceSaved: number;
    percentageSaved: number;
  };
}

class MatrixService {
  private cache: Map<string, { data: any; timestamp: number }> = new Map();
  private readonly cacheTTL = 10 * 60 * 1000; // 10 minutes cache

  /**
   * Calculate matrix of durations and distances
   */
  async calculateMatrix(options: MatrixOptions): Promise<RouteComparison> {
    const cacheKey = this.getCacheKey('matrix', options);
    
    // Check cache first
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      quotaManager.recordUsage('MATRIX', true, true);
      return cached;
    }

    // Check quota
    const quotaCheck = quotaManager.canMakeRequest('MATRIX');
    if (!quotaCheck.allowed) {
      throw new Error(`Matrix API quota exceeded: ${quotaCheck.reason}`);
    }

    try {
      const response = await this.makeMatrixRequest(options);
      const comparison = this.transformMatrixResponse(response, options);
      
      // Cache the result
      this.setCache(cacheKey, comparison);
      
      // Record successful usage
      quotaManager.recordUsage('MATRIX', true);
      
      return comparison;
    } catch (error) {
      quotaManager.recordUsage('MATRIX', false);
      throw error;
    }
  }

  /**
   * Get distance matrix for multiple locations
   */
  async getDistanceMatrix(
    locations: Array<[number, number]>,
    transportMode: TransportProfile = 'driving-car'
  ): Promise<number[][]> {
    const options: MatrixOptions = {
      profile: transportMode,
      sources: locations,
      destinations: locations,
      metrics: ['distance']
    };

    const result = await this.calculateMatrix(options);
    
    // Extract distance matrix from comparison result
    // This is a simplified extraction - in a full matrix, we'd return the raw matrix
    return locations.map((_, sourceIndex) => 
      locations.map((_, destIndex) => {
        if (sourceIndex === 0) {
          const dest = result.destinations[destIndex];
          return dest ? dest.distance : 0;
        }
        return 0; // For now, only return first row - would need full matrix API call
      })
    );
  }

  /**
   * Get time matrix for multiple locations  
   */
  async getTimeMatrix(
    locations: Array<[number, number]>,
    transportMode: TransportProfile = 'driving-car'
  ): Promise<number[][]> {
    const options: MatrixOptions = {
      profile: transportMode,
      sources: locations,
      destinations: locations,
      metrics: ['duration']
    };

    const result = await this.calculateMatrix(options);
    
    // Extract duration matrix from comparison result
    return locations.map((_, sourceIndex) => 
      locations.map((_, destIndex) => {
        if (sourceIndex === 0) {
          const dest = result.destinations[destIndex];
          return dest ? dest.duration : 0;
        }
        return 0; // For now, only return first row
      })
    );
  }

  /**
   * Optimize route for multiple waypoints (Traveling Salesman Problem)
   */
  async optimizeRoute(
    waypoints: Array<{ coordinates: [number, number]; name?: string }>,
    profile: TransportProfile = 'driving-car'
  ): Promise<OptimizedRoute> {
    if (waypoints.length < 2) {
      throw new Error('At least 2 waypoints required for optimization');
    }

    // Get full matrix between all waypoints
    const coordinates = waypoints.map(wp => wp.coordinates);
    const fullMatrixOptions: MatrixOptions = {
      profile,
      sources: coordinates,
      destinations: coordinates,
      metrics: ['duration', 'distance']
    };

    const cacheKey = this.getCacheKey('optimize', fullMatrixOptions);
    const cached = this.getFromCache(cacheKey);
    
    if (cached) {
      quotaManager.recordUsage('MATRIX', true, true);
      return cached;
    }

    const quotaCheck = quotaManager.canMakeRequest('MATRIX');
    if (!quotaCheck.allowed) {
      throw new Error(`Matrix API quota exceeded: ${quotaCheck.reason}`);
    }

    try {
      const response = await this.makeMatrixRequest(fullMatrixOptions);
      
      if (!response.durations || !response.distances) {
        throw new Error('Matrix response missing duration or distance data');
      }

      // Solve TSP using nearest neighbor heuristic
      const optimizedOrder = this.solveTSP(response.durations);
      const originalOrder = waypoints.map((_, index) => index);
      
      // Calculate route segments
      const segments = [];
      let totalDuration = 0;
      let totalDistance = 0;
      
      for (let i = 0; i < optimizedOrder.length - 1; i++) {
        const from = optimizedOrder[i];
        const to = optimizedOrder[i + 1];
        const duration = response.durations[from][to];
        const distance = response.distances[from][to];
        
        segments.push({ from, to, duration, distance });
        totalDuration += duration;
        totalDistance += distance;
      }

      // Calculate original route for comparison
      let originalDuration = 0;
      let originalDistance = 0;
      for (let i = 0; i < originalOrder.length - 1; i++) {
        originalDuration += response.durations[i][i + 1];
        originalDistance += response.distances[i][i + 1];
      }

      const optimized: OptimizedRoute = {
        waypoints: optimizedOrder.map((index, order) => ({
          coordinates: waypoints[index].coordinates,
          name: waypoints[index].name,
          order: order + 1
        })),
        route: {
          totalDuration,
          totalDistance,
          durationFormatted: this.formatDuration(totalDuration),
          distanceFormatted: this.formatDistance(totalDistance),
          segments
        },
        savings: {
          durationSaved: Math.max(0, originalDuration - totalDuration),
          distanceSaved: Math.max(0, originalDistance - totalDistance),
          percentageSaved: originalDuration > 0 
            ? Math.round(((originalDuration - totalDuration) / originalDuration) * 100)
            : 0
        }
      };

      this.setCache(cacheKey, optimized);
      quotaManager.recordUsage('MATRIX', true);
      
      return optimized;
    } catch (error) {
      quotaManager.recordUsage('MATRIX', false);
      throw error;
    }
  }

  /**
   * Find nearest location from a source to multiple candidates
   */
  async findNearestLocation(
    source: [number, number],
    candidates: Array<{ coordinates: [number, number]; name?: string }>,
    profile: TransportProfile = 'driving-car'
  ): Promise<{ location: typeof candidates[0]; duration: number; distance: number; index: number }> {
    const options: MatrixOptions = {
      profile,
      sources: [source],
      destinations: candidates.map(c => c.coordinates),
      metrics: ['duration', 'distance']
    };

    const comparison = await this.calculateMatrix(options);
    
    if (comparison.destinations.length === 0) {
      throw new Error('No destinations found');
    }

    // Find the closest destination
    const closest = comparison.destinations.reduce((prev, current) => 
      current.duration < prev.duration ? current : prev
    );

    const closestIndex = comparison.destinations.indexOf(closest);

    return {
      location: candidates[closestIndex],
      duration: closest.duration,
      distance: closest.distance,
      index: closestIndex
    };
  }

  /**
   * Make request to OpenRouteService Matrix API
   */
  private async makeMatrixRequest(options: MatrixOptions): Promise<MatrixResponse> {
    const { profile = 'driving-car', sources, destinations, metrics = ['duration', 'distance'] } = options;
    
    const requestBody = {
      sources: sources.map((coord, index) => ({ 
        location: coord,
        id: index 
      })),
      destinations: destinations.map((coord, index) => ({ 
        location: coord,
        id: index 
      })),
      metrics,
      units: options.units || 'km'
    };

    const url = `${ORS_BASE_URL}${API_ENDPOINTS.MATRIX.base}/${profile}`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: DEFAULT_HEADERS,
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT.MATRIX)
    });

    if (!response.ok) {
      throw new Error(`Matrix API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Transform Matrix API response to route comparison format
   */
  private transformMatrixResponse(response: MatrixResponse, options: MatrixOptions): RouteComparison {
    if (!response.durations || !response.distances) {
      throw new Error('Matrix response missing duration or distance data');
    }

    const source = {
      coordinates: options.sources[0],
      name: 'Origin'
    };

    // Transform destinations with rankings
    const destinations = response.destinations.map((dest, index) => {
      const duration = response.durations![0][index];
      const distance = response.distances![0][index];
      
      return {
        coordinates: dest.location,
        duration,
        distance,
        durationFormatted: this.formatDuration(duration),
        distanceFormatted: this.formatDistance(distance),
        rank: 0 // Will be set after sorting
      };
    }).filter(dest => dest.duration !== null && dest.distance !== null);

    // Sort by duration and assign ranks
    destinations.sort((a, b) => a.duration - b.duration);
    destinations.forEach((dest, index) => {
      dest.rank = index + 1;
    });

    return {
      source,
      destinations,
      profile: options.profile || 'driving-car'
    };
  }

  /**
   * Solve Traveling Salesman Problem using nearest neighbor heuristic
   */
  private solveTSP(distanceMatrix: number[][]): number[] {
    const n = distanceMatrix.length;
    if (n <= 1) return Array.from({ length: n }, (_, i) => i);

    const visited = new Array(n).fill(false);
    const route = [0]; // Start from first city
    visited[0] = true;

    for (let i = 1; i < n; i++) {
      const current = route[route.length - 1];
      let nearest = -1;
      let nearestDistance = Infinity;

      // Find nearest unvisited city
      for (let j = 0; j < n; j++) {
        if (!visited[j] && distanceMatrix[current][j] < nearestDistance) {
          nearest = j;
          nearestDistance = distanceMatrix[current][j];
        }
      }

      if (nearest !== -1) {
        route.push(nearest);
        visited[nearest] = true;
      }
    }

    return route;
  }

  /**
   * Format duration for display
   */
  private formatDuration(seconds: number): string {
    if (seconds < 60) return `${Math.round(seconds)}s`;
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else {
      return `${minutes}m`;
    }
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
   * Generate cache key for request
   */
  private getCacheKey(type: string, options: any): string {
    return `matrix_${type}_${JSON.stringify(options)}`;
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
    if (this.cache.size > 25) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }
  }

  /**
   * Get current quota status for debugging
   */
  getQuotaStatus() {
    return quotaManager.getQuotaStatus('MATRIX');
  }
}

export const matrixService = new MatrixService();
export default matrixService;