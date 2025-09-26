/**
 * ⏰ OpenRouteService Isochrones API Service
 * 
 * Handles reachability analysis and time-based coverage areas
 * Isochrones V2: 500/500 requests (20/minute)
 */

import { 
  ORS_BASE_URL, 
  API_ENDPOINTS, 
  DEFAULT_HEADERS, 
  REQUEST_TIMEOUT,
  TransportProfile 
} from '../config/apiConfig';
import { quotaManager } from './quotaManager';

export interface IsochroneOptions {
  profile?: TransportProfile;
  locations: Array<[number, number]>; // [lng, lat] coordinates
  range: number[]; // Time in seconds or distance in meters
  rangeType?: 'time' | 'distance';
  interval?: number; // Interval for multiple ranges
  units?: 'km' | 'mi' | 'm';
  locationIndex?: number[]; // Which locations to calculate for
  attributes?: ('area' | 'reachfactor' | 'total_pop')[];
  intersections?: boolean;
  areaUnits?: 'km' | 'm';
}

export interface IsochroneGeometry {
  type: 'Polygon' | 'MultiPolygon';
  coordinates: number[][][] | number[][][][];
}

export interface IsochroneProperties {
  group_index: number;
  value: number; // Range value (time in seconds or distance in meters)
  center: [number, number]; // [lng, lat]
  area?: number; // Area in square units
  reachfactor?: number; // Reachability factor
  total_pop?: number; // Total population in area
}

export interface IsochroneFeature {
  type: 'Feature';
  properties: IsochroneProperties;
  geometry: IsochroneGeometry;
}

export interface IsochroneResponse {
  type: 'FeatureCollection';
  features: IsochroneFeature[];
  bbox: [number, number, number, number]; // [minLng, minLat, maxLng, maxLat]
  info: {
    service: string;
    timestamp: number;
    query: {
      profile: string;
      locations: Array<[number, number]>;
      range: number[];
      range_type: string;
    };
  };
}

export interface ReachabilityArea {
  id: string;
  center: {
    lat: number;
    lng: number;
  };
  timeMinutes: number;
  timeSeconds: number;
  profile: TransportProfile;
  area: {
    sqKm: number;
    sqMeters: number;
    formatted: string;
  };
  geometry: {
    type: 'Polygon' | 'MultiPolygon';
    coordinates: number[][][] | number[][][][];
  };
  bounds: {
    north: number;
    south: number;
    east: number;
    west: number;
  };
  population?: number;
  reachabilityScore?: number;
}

export interface AccessibilityMap {
  location: {
    lat: number;
    lng: number;
    name?: string;
  };
  profile: TransportProfile;
  areas: ReachabilityArea[];
  summary: {
    maxTimeMinutes: number;
    totalAreaSqKm: number;
    averageReachability: number;
    populationReached?: number;
  };
  visualization: {
    colors: string[];
    opacities: number[];
    timeIntervals: number[];
  };
}

class IsochronesService {
  private cache: Map<string, { data: any; timestamp: number }> = new Map();
  private readonly cacheTTL = 30 * 60 * 1000; // 30 minutes cache

  /**
   * Get reachable area for a specific time/distance
   */
  async getReachableArea(
    location: [number, number],
    timeMinutes: number,
    profile: TransportProfile = 'driving-car'
  ): Promise<ReachabilityArea> {
    const timeSeconds = timeMinutes * 60;
    const options: IsochroneOptions = {
      profile,
      locations: [location],
      range: [timeSeconds],
      rangeType: 'time',
      attributes: ['area', 'reachfactor'],
      areaUnits: 'km'
    };

    const cacheKey = this.getCacheKey('single', options);
    
    // Check cache first
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      quotaManager.recordUsage('ISOCHRONES', true, true);
      return cached;
    }

    // Check quota
    const quotaCheck = quotaManager.canMakeRequest('ISOCHRONES');
    if (!quotaCheck.allowed) {
      throw new Error(`Isochrones API quota exceeded: ${quotaCheck.reason}`);
    }

    try {
      const response = await this.makeIsochroneRequest(options);
      const area = this.transformSingleIsochrone(response, location, timeMinutes, profile);
      
      // Cache the result
      this.setCache(cacheKey, area);
      
      // Record successful usage
      quotaManager.recordUsage('ISOCHRONES', true);
      
      return area;
    } catch (error) {
      quotaManager.recordUsage('ISOCHRONES', false);
      throw error;
    }
  }

  /**
   * Get multiple isochrone polygons for different time intervals
   */
  async getIsochronePolygon(
    center: [number, number],
    intervals: number[], // Time in minutes
    mode: TransportProfile = 'driving-car'
  ): Promise<ReachabilityArea[]> {
    const timeSeconds = intervals.map(minutes => minutes * 60);
    const options: IsochroneOptions = {
      profile: mode,
      locations: [center],
      range: timeSeconds,
      rangeType: 'time',
      attributes: ['area', 'reachfactor'],
      areaUnits: 'km'
    };

    const cacheKey = this.getCacheKey('multiple', options);
    const cached = this.getFromCache(cacheKey);
    
    if (cached) {
      quotaManager.recordUsage('ISOCHRONES', true, true);
      return cached;
    }

    const quotaCheck = quotaManager.canMakeRequest('ISOCHRONES');
    if (!quotaCheck.allowed) {
      throw new Error(`Isochrones API quota exceeded: ${quotaCheck.reason}`);
    }

    try {
      const response = await this.makeIsochroneRequest(options);
      const areas = this.transformMultipleIsochrones(response, center, intervals, mode);
      
      this.setCache(cacheKey, areas);
      quotaManager.recordUsage('ISOCHRONES', true);
      
      return areas;
    } catch (error) {
      quotaManager.recordUsage('ISOCHRONES', false);
      throw error;
    }
  }

  /**
   * Calculate reachability from a point with multiple time ranges
   */
  async calculateReachability(
    origin: [number, number],
    maxTime: number, // Maximum time in minutes
    transport: TransportProfile = 'driving-car'
  ): Promise<AccessibilityMap> {
    // Create intervals (e.g., 5, 10, 15 minutes)
    const intervals = [];
    const step = Math.max(5, Math.floor(maxTime / 3)); // Create ~3 intervals
    for (let i = step; i <= maxTime; i += step) {
      intervals.push(i);
    }

    const areas = await this.getIsochronePolygon(origin, intervals, transport);
    
    return {
      location: {
        lat: origin[1],
        lng: origin[0]
      },
      profile: transport,
      areas,
      summary: {
        maxTimeMinutes: maxTime,
        totalAreaSqKm: areas.reduce((sum, area) => sum + area.area.sqKm, 0),
        averageReachability: areas.reduce((sum, area) => sum + (area.reachabilityScore || 0), 0) / areas.length,
        populationReached: areas.reduce((sum, area) => sum + (area.population || 0), 0)
      },
      visualization: {
        colors: this.generateColors(intervals.length),
        opacities: this.generateOpacities(intervals.length),
        timeIntervals: intervals
      }
    };
  }

  /**
   * Get accessibility map with multiple time ranges
   */
  async getAccessibilityMap(
    location: [number, number],
    timeRanges: number[], // Array of time ranges in minutes
    profile: TransportProfile = 'driving-car'
  ): Promise<AccessibilityMap> {
    const areas = await this.getIsochronePolygon(location, timeRanges, profile);
    
    return {
      location: {
        lat: location[1],
        lng: location[0]
      },
      profile,
      areas,
      summary: {
        maxTimeMinutes: Math.max(...timeRanges),
        totalAreaSqKm: areas[areas.length - 1]?.area.sqKm || 0, // Largest area
        averageReachability: areas.reduce((sum, area) => sum + (area.reachabilityScore || 0), 0) / areas.length,
        populationReached: areas.reduce((sum, area) => sum + (area.population || 0), 0)
      },
      visualization: {
        colors: this.generateColors(timeRanges.length),
        opacities: this.generateOpacities(timeRanges.length),
        timeIntervals: timeRanges
      }
    };
  }

  /**
   * Make request to OpenRouteService Isochrones API
   */
  private async makeIsochroneRequest(options: IsochroneOptions): Promise<IsochroneResponse> {
    const { profile = 'driving-car', locations, range, rangeType = 'time' } = options;
    
    const requestBody = {
      locations,
      range,
      range_type: rangeType,
      units: options.units || 'km',
      location_index: options.locationIndex,
      attributes: options.attributes || [],
      intersections: options.intersections || false,
      interval: options.interval,
      area_units: options.areaUnits || 'km'
    };

    const url = `${ORS_BASE_URL}${API_ENDPOINTS.ISOCHRONES.base}/${profile}`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: DEFAULT_HEADERS,
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT.ISOCHRONES)
    });

    if (!response.ok) {
      throw new Error(`Isochrones API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Transform single isochrone response
   */
  private transformSingleIsochrone(
    response: IsochroneResponse,
    location: [number, number],
    timeMinutes: number,
    profile: TransportProfile
  ): ReachabilityArea {
    if (!response.features || response.features.length === 0) {
      throw new Error('No isochrone data found');
    }

    const feature = response.features[0];
    const [lng, lat] = location;
    
    return {
      id: `isochrone_${Date.now()}`,
      center: { lat, lng },
      timeMinutes,
      timeSeconds: timeMinutes * 60,
      profile,
      area: {
        sqKm: feature.properties.area || 0,
        sqMeters: (feature.properties.area || 0) * 1000000,
        formatted: this.formatArea(feature.properties.area || 0)
      },
      geometry: feature.geometry,
      bounds: this.calculateBounds(feature.geometry),
      population: feature.properties.total_pop,
      reachabilityScore: feature.properties.reachfactor
    };
  }

  /**
   * Transform multiple isochrones response
   */
  private transformMultipleIsochrones(
    response: IsochroneResponse,
    center: [number, number],
    intervals: number[],
    profile: TransportProfile
  ): ReachabilityArea[] {
    if (!response.features || response.features.length === 0) {
      throw new Error('No isochrone data found');
    }

    const [lng, lat] = center;
    
    return response.features.map((feature, index) => ({
      id: `isochrone_${Date.now()}_${index}`,
      center: { lat, lng },
      timeMinutes: intervals[index] || Math.floor(feature.properties.value / 60),
      timeSeconds: feature.properties.value,
      profile,
      area: {
        sqKm: feature.properties.area || 0,
        sqMeters: (feature.properties.area || 0) * 1000000,
        formatted: this.formatArea(feature.properties.area || 0)
      },
      geometry: feature.geometry,
      bounds: this.calculateBounds(feature.geometry),
      population: feature.properties.total_pop,
      reachabilityScore: feature.properties.reachfactor
    }));
  }

  /**
   * Calculate bounding box from geometry
   */
  private calculateBounds(geometry: IsochroneGeometry): ReachabilityArea['bounds'] {
    let minLng = Infinity, minLat = Infinity;
    let maxLng = -Infinity, maxLat = -Infinity;

    const processCoordinates = (coords: any) => {
      if (Array.isArray(coords[0])) {
        coords.forEach(processCoordinates);
      } else {
        const [lng, lat] = coords;
        minLng = Math.min(minLng, lng);
        maxLng = Math.max(maxLng, lng);
        minLat = Math.min(minLat, lat);
        maxLat = Math.max(maxLat, lat);
      }
    };

    processCoordinates(geometry.coordinates);

    return {
      north: maxLat,
      south: minLat,
      east: maxLng,
      west: minLng
    };
  }

  /**
   * Format area for display
   */
  private formatArea(sqKm: number): string {
    if (sqKm < 1) {
      const sqMeters = Math.round(sqKm * 1000000);
      return `${sqMeters.toLocaleString()} m²`;
    } else {
      return `${sqKm.toFixed(1)} km²`;
    }
  }

  /**
   * Generate colors for visualization
   */
  private generateColors(count: number): string[] {
    // Generate colors from light to dark for different time ranges
    const baseColors = [
      '#E3F2FD', // Light Blue
      '#81C784', // Light Green  
      '#FFB74D', // Light Orange
      '#F06292', // Light Pink
      '#9575CD', // Light Purple
      '#4FC3F7', // Sky Blue
      '#AED581', // Lime Green
      '#FFD54F'  // Light Yellow
    ];
    
    return baseColors.slice(0, count);
  }

  /**
   * Generate opacities for visualization
   */
  private generateOpacities(count: number): number[] {
    // Generate decreasing opacities for layered effect
    const step = 0.8 / count;
    return Array.from({ length: count }, (_, i) => 0.2 + (i * step));
  }

  /**
   * Generate cache key for request
   */
  private getCacheKey(type: string, options: any): string {
    return `isochrones_${type}_${JSON.stringify(options)}`;
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
    if (this.cache.size > 20) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }
  }

  /**
   * Get current quota status for debugging
   */
  getQuotaStatus() {
    return quotaManager.getQuotaStatus('ISOCHRONES');
  }
}

export const isochronesService = new IsochronesService();
export default isochronesService;