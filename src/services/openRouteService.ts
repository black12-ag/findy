import axios, { AxiosResponse } from 'axios';

// OpenRouteService API configuration
const ORS_BASE_URL = 'https://api.openrouteservice.org';
const ORS_API_VERSION = 'v2';

// Note: In production, these should be environment variables
// For now, they'll need to be set when initializing the service
let ORS_API_KEY: string | null = null;

export const setORSApiKey = (apiKey: string) => {
  ORS_API_KEY = apiKey;
};

// Create axios instance for ORS API
const orsApi = axios.create({
  baseURL: `${ORS_BASE_URL}/${ORS_API_VERSION}`,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add API key
orsApi.interceptors.request.use(
  (config) => {
    if (!ORS_API_KEY) {
      throw new Error('OpenRouteService API key is not configured');
    }
    
    // Add API key to headers
    config.headers.Authorization = `Bearer ${ORS_API_KEY}`;
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
orsApi.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('ORS API Error:', error.response?.data || error.message);
    
    if (error.response?.status === 401) {
      throw new Error('Invalid OpenRouteService API key');
    } else if (error.response?.status === 403) {
      throw new Error('API quota exceeded or insufficient permissions');
    } else if (error.response?.status === 429) {
      throw new Error('Rate limit exceeded. Please try again later.');
    } else if (error.response?.status >= 500) {
      throw new Error('OpenRouteService is temporarily unavailable');
    }
    
    return Promise.reject(error);
  }
);

// Types for ORS API responses
export interface ORSCoordinate {
  lat: number;
  lng: number;
}

export interface ORSGeocodingResult {
  place_id: string;
  display_name: string;
  lat: number;
  lon: number;
  importance: number;
  class: string;
  type: string;
  address?: {
    house_number?: string;
    road?: string;
    city?: string;
    state?: string;
    postcode?: string;
    country?: string;
    country_code?: string;
  };
  boundingbox?: [string, string, string, string];
}

export interface ORSDirectionsStep {
  distance: number;
  duration: number;
  instruction: string;
  name: string;
  way_points: [number, number];
}

export interface ORSDirectionsSegment {
  distance: number;
  duration: number;
  steps: ORSDirectionsStep[];
}

export interface ORSDirectionsRoute {
  summary: {
    distance: number;
    duration: number;
  };
  geometry: {
    coordinates: [number, number][];
    type: string;
  };
  segments: ORSDirectionsSegment[];
  bbox: [number, number, number, number];
  way_points: number[];
}

export interface ORSDirectionsResponse {
  type: string;
  features: Array<{
    bbox: [number, number, number, number];
    type: string;
    properties: {
      segments: ORSDirectionsSegment[];
      summary: {
        distance: number;
        duration: number;
      };
      way_points: number[];
    };
    geometry: {
      coordinates: [number, number][];
      type: string;
    };
  }>;
  bbox: [number, number, number, number];
  metadata: {
    attribution: string;
    service: string;
    timestamp: number;
    query: any;
    engine: any;
  };
}

export interface ORSPOIResult {
  properties: {
    osm_id: number;
    osm_type: string;
    category_ids: number[];
    osm_tags: Record<string, any>;
  };
  geometry: {
    coordinates: [number, number];
    type: string;
  };
}

// Geocoding Service
export class ORSGeocodingService {
  static async search(query: string, options?: {
    limit?: number;
    countryCode?: string;
    boundingBox?: [number, number, number, number];
  }): Promise<ORSGeocodingResult[]> {
    try {
      const params: any = {
        text: query,
        size: options?.limit || 10,
      };

      if (options?.countryCode) {
        params['boundary.country'] = options.countryCode;
      }

      if (options?.boundingBox) {
        const [minLon, minLat, maxLon, maxLat] = options.boundingBox;
        params['boundary.rect.min_lon'] = minLon;
        params['boundary.rect.min_lat'] = minLat;
        params['boundary.rect.max_lon'] = maxLon;
        params['boundary.rect.max_lat'] = maxLat;
      }

      const response: AxiosResponse<{ features: any[] }> = await orsApi.get('/geocode/search', {
        params
      });

      return response.data.features.map((feature: any) => ({
        place_id: feature.properties.id || feature.properties.gid,
        display_name: feature.properties.label,
        lat: feature.geometry.coordinates[1],
        lon: feature.geometry.coordinates[0],
        importance: feature.properties.confidence || 0,
        class: feature.properties.layer || 'unknown',
        type: feature.properties.source || 'unknown',
        address: feature.properties.address,
        boundingbox: feature.bbox
      }));
    } catch (error) {
      console.error('Geocoding search failed:', error);
      throw error;
    }
  }

  static async reverse(lat: number, lng: number): Promise<ORSGeocodingResult | null> {
    try {
      const response: AxiosResponse<{ features: any[] }> = await orsApi.get('/geocode/reverse', {
        params: {
          'point.lat': lat,
          'point.lon': lng,
          size: 1
        }
      });

      if (response.data.features.length === 0) {
        return null;
      }

      const feature = response.data.features[0];
      return {
        place_id: feature.properties.id || feature.properties.gid,
        display_name: feature.properties.label,
        lat: feature.geometry.coordinates[1],
        lon: feature.geometry.coordinates[0],
        importance: feature.properties.confidence || 0,
        class: feature.properties.layer || 'unknown',
        type: feature.properties.source || 'unknown',
        address: feature.properties.address,
        boundingbox: feature.bbox
      };
    } catch (error) {
      console.error('Reverse geocoding failed:', error);
      throw error;
    }
  }
}

// Directions Service
export class ORSDirectionsService {
  static async getDirections(
    start: ORSCoordinate,
    end: ORSCoordinate,
    profile: 'driving-car' | 'walking' | 'cycling-regular' | 'foot-walking' = 'driving-car',
    options?: {
      avoidTolls?: boolean;
      avoidHighways?: boolean;
      avoidFerries?: boolean;
      alternative?: boolean;
    }
  ): Promise<ORSDirectionsResponse> {
    try {
      const coordinates = [
        [start.lng, start.lat],
        [end.lng, end.lat]
      ];

      const requestBody: any = {
        coordinates,
        format: 'geojson',
        instructions: true,
        language: 'en',
        geometry: true,
        elevation: false
      };

      // Add avoidance options if specified
      if (options) {
        const avoidFeatures: string[] = [];
        
        if (options.avoidTolls) avoidFeatures.push('tollways');
        if (options.avoidHighways) avoidFeatures.push('highways');
        if (options.avoidFerries) avoidFeatures.push('ferries');
        
        if (avoidFeatures.length > 0) {
          requestBody.options = {
            avoid_features: avoidFeatures
          };
        }
      }

      // Request alternative routes if specified
      if (options?.alternative) {
        requestBody.alternative_routes = {
          target_count: 2,
          weight_factor: 1.4,
          share_factor: 0.6
        };
      }

      const response: AxiosResponse<ORSDirectionsResponse> = await orsApi.post(
        `/directions/${profile}/geojson`,
        requestBody
      );

      return response.data;
    } catch (error) {
      console.error('Directions request failed:', error);
      throw error;
    }
  }

  static async getMatrix(
    locations: ORSCoordinate[],
    profile: 'driving-car' | 'walking' | 'cycling-regular' | 'foot-walking' = 'driving-car'
  ): Promise<{
    durations: number[][];
    distances: number[][];
    destinations: ORSCoordinate[];
    sources: ORSCoordinate[];
  }> {
    try {
      const coordinates = locations.map(coord => [coord.lng, coord.lat]);

      const requestBody = {
        locations: coordinates,
        sources: 'all',
        destinations: 'all',
        metrics: ['duration', 'distance'],
        units: 'km'
      };

      const response = await orsApi.post(`/matrix/${profile}`, requestBody);

      return {
        durations: response.data.durations,
        distances: response.data.distances,
        destinations: response.data.destinations?.map((coord: number[]) => ({
          lat: coord[1],
          lng: coord[0]
        })) || [],
        sources: response.data.sources?.map((coord: number[]) => ({
          lat: coord[1],
          lng: coord[0]
        })) || []
      };
    } catch (error) {
      console.error('Matrix request failed:', error);
      throw error;
    }
  }
}

// Points of Interest Service
export class ORSPOIService {
  static async searchPOIs(
    center: ORSCoordinate,
    radius: number = 1000,
    category?: string,
    limit: number = 50
  ): Promise<ORSPOIResult[]> {
    try {
      const requestBody: any = {
        request: 'pois',
        geometry: {
          buffer: radius,
          geojson: {
            type: 'Point',
            coordinates: [center.lng, center.lat]
          }
        },
        limit
      };

      if (category) {
        // Map common categories to ORS category IDs
        const categoryMap: Record<string, number[]> = {
          'restaurants': [560, 561, 562],
          'gas_stations': [470],
          'hotels': [580, 581],
          'banks': [540],
          'hospitals': [620],
          'shopping': [600, 601, 602],
          'entertainment': [580, 581, 582],
          'tourism': [540, 541, 542]
        };

        const categoryIds = categoryMap[category.toLowerCase()];
        if (categoryIds) {
          requestBody.filters = {
            category_ids: categoryIds
          };
        }
      }

      const response: AxiosResponse<{ features: ORSPOIResult[] }> = await orsApi.post(
        '/pois',
        requestBody
      );

      return response.data.features;
    } catch (error) {
      console.error('POI search failed:', error);
      throw error;
    }
  }
}

// Isochrone Service (for showing reachable areas)
export class ORSIsochroneService {
  static async getIsochrone(
    center: ORSCoordinate,
    range: number[],
    rangeType: 'time' | 'distance' = 'time',
    profile: 'driving-car' | 'walking' | 'cycling-regular' | 'foot-walking' = 'driving-car'
  ): Promise<any> {
    try {
      const requestBody = {
        locations: [[center.lng, center.lat]],
        range,
        range_type: rangeType,
        attributes: ['area', 'reachfactor'],
        units: rangeType === 'time' ? 'seconds' : 'km'
      };

      const response = await orsApi.post(`/isochrones/${profile}`, requestBody);
      return response.data;
    } catch (error) {
      console.error('Isochrone request failed:', error);
      throw error;
    }
  }
}

// Utility functions
export const formatDuration = (durationInSeconds: number): string => {
  const hours = Math.floor(durationInSeconds / 3600);
  const minutes = Math.floor((durationInSeconds % 3600) / 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
};

export const formatDistance = (distanceInMeters: number): string => {
  if (distanceInMeters >= 1000) {
    return `${(distanceInMeters / 1000).toFixed(1)} km`;
  }
  return `${Math.round(distanceInMeters)} m`;
};

export const convertORSRouteToAppRoute = (
  orsResponse: ORSDirectionsResponse,
  transportMode: 'driving' | 'walking' | 'transit' | 'cycling'
): any => {
  if (!orsResponse.features || orsResponse.features.length === 0) {
    throw new Error('No route found');
  }

  const route = orsResponse.features[0];
  const summary = route.properties.summary;
  const segments = route.properties.segments;

  // Convert steps to string array
  const steps: string[] = [];
  segments.forEach(segment => {
    segment.steps.forEach(step => {
      if (step.instruction && step.instruction.trim()) {
        steps.push(step.instruction);
      }
    });
  });

  return {
    id: `ors_route_${Date.now()}`,
    distance: formatDistance(summary.distance),
    duration: formatDuration(summary.duration),
    mode: transportMode,
    steps,
    geometry: route.geometry.coordinates,
    bbox: route.bbox
  };
};