/**
 * 🔍 OpenRouteService Geocoding API Service
 * 
 * Handles search and address lookup with fallback to Nominatim
 * Geocoding Search: 1000/1000 requests (100/minute)
 */

import { 
  ORS_BASE_URL, 
  API_ENDPOINTS, 
  DEFAULT_HEADERS, 
  REQUEST_TIMEOUT,
  FALLBACK_APIS 
} from '../config/apiConfig';
import { quotaManager } from './quotaManager';
import { logger } from '../utils/logger';

export interface GeocodingOptions {
  text: string;
  size?: number;
  layers?: string[];
  sources?: string[];
  country?: string[];
  boundary?: {
    rect?: {
      min_lon: number;
      min_lat: number;
      max_lon: number;
      max_lat: number;
    };
    circle?: {
      lat: number;
      lon: number;
      radius: number; // km
    };
  };
  focus?: {
    lat: number;
    lon: number;
  };
}

export interface AutocompleteOptions {
  text: string;
  size?: number;
  layers?: string[];
  sources?: string[];
  country?: string[];
  boundary?: GeocodingOptions['boundary'];
  focus?: GeocodingOptions['focus'];
}

export interface ReverseGeocodingOptions {
  lat: number;
  lon: number;
  size?: number;
  layers?: string[];
  sources?: string[];
  boundary?: {
    country?: string[];
  };
}

export interface GeocodingResult {
  id: string;
  gid: string;
  layer: string;
  source: string;
  name: string;
  housenumber?: string;
  street?: string;
  locality?: string;
  region?: string;
  country: string;
  country_a: string;
  geometry: {
    type: 'Point';
    coordinates: [number, number]; // [lng, lat]
  };
  properties: {
    label: string;
    confidence: number;
    match_type?: string;
    accuracy?: string;
    country?: string;
    country_a?: string;
    region?: string;
    locality?: string;
    neighbourhood?: string;
    housenumber?: string;
    street?: string;
    postalcode?: string;
  };
  bbox?: [number, number, number, number]; // [minLng, minLat, maxLng, maxLat]
  distance?: number; // For reverse geocoding results
}

export interface GeocodingResponse {
  type: 'FeatureCollection';
  features: GeocodingResult[];
  geocoding: {
    version: string;
    attribution: string;
    query: any;
    engine: {
      name: string;
      author: string;
      version: string;
    };
    timestamp: number;
  };
  bbox?: [number, number, number, number];
}

export interface SimpleLocation {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  confidence: number;
  category?: string;
  country?: string;
  region?: string;
  distance?: number;
}

class GeocodingService {
  private cache: Map<string, { data: any; timestamp: number }> = new Map();
  private readonly cacheTTL = 24 * 60 * 60 * 1000; // 24 hours for geocoding

  /**
   * Search for places by text query
   */
  async searchPlaces(
    query: string,
    options: Partial<GeocodingOptions> = {}
  ): Promise<SimpleLocation[]> {
    const fullOptions: GeocodingOptions = {
      text: query.trim(),
      size: options.size || 10,
      layers: options.layers,
      sources: options.sources,
      country: options.country,
      boundary: options.boundary,
      focus: options.focus
    };

    const cacheKey = this.getCacheKey('search', fullOptions);
    
    // Check cache first
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      quotaManager.recordUsage('GEOCODING', true, true);
      return cached;
    }

    // Try OpenRouteService first
    const quotaCheck = quotaManager.canMakeRequest('GEOCODING');
    if (quotaCheck.allowed) {
      try {
        const response = await this.makeGeocodingRequest('search', fullOptions);
        const results = this.transformGeocodingResponse(response);
        
        this.setCache(cacheKey, results);
        quotaManager.recordUsage('GEOCODING', true);
        
        return results;
      } catch (error) {
        this.logError('geocoding_failed', 'OpenRouteService geocoding failed, trying fallback', { error: error.message, query });
        quotaManager.recordUsage('GEOCODING', false);
      }
    }

    // Fallback to Nominatim
    try {
      const results = await this.searchWithNominatim(query, options);
      this.setCache(cacheKey, results);
      quotaManager.recordUsage('GEOCODING', true, false, true);
      
      return results;
    } catch (error) {
      quotaManager.recordUsage('GEOCODING', false, false, true);
      throw new Error(`Both geocoding services failed: ${error}`);
    }
  }

  /**
   * Autocomplete search for real-time suggestions
   */
  async autocomplete(
    query: string,
    options: Partial<AutocompleteOptions> = {}
  ): Promise<SimpleLocation[]> {
    if (query.trim().length < 2) {
      return [];
    }

    const fullOptions: AutocompleteOptions = {
      text: query.trim(),
      size: options.size || 5,
      layers: options.layers,
      sources: options.sources,
      country: options.country,
      boundary: options.boundary,
      focus: options.focus
    };

    const cacheKey = this.getCacheKey('autocomplete', fullOptions);
    const cached = this.getFromCache(cacheKey);
    
    if (cached) {
      quotaManager.recordUsage('GEOCODING', true, true);
      return cached;
    }

    const quotaCheck = quotaManager.canMakeRequest('GEOCODING');
    if (quotaCheck.allowed) {
      try {
        const response = await this.makeGeocodingRequest('autocomplete', fullOptions);
        const results = this.transformGeocodingResponse(response);
        
        this.setCache(cacheKey, results);
        quotaManager.recordUsage('GEOCODING', true);
        
        return results;
      } catch (error) {
        this.logError('autocomplete_failed', 'OpenRouteService autocomplete failed', { error: error.message, query });
        quotaManager.recordUsage('GEOCODING', false);
      }
    }

    // For autocomplete, fallback to cached results or empty array
    return [];
  }

  /**
   * Reverse geocoding - get address from coordinates
   */
  async reverseGeocode(
    lat: number,
    lng: number,
    options: Partial<ReverseGeocodingOptions> = {}
  ): Promise<SimpleLocation[]> {
    const fullOptions: ReverseGeocodingOptions = {
      lat,
      lon: lng,
      size: options.size || 1,
      layers: options.layers,
      sources: options.sources,
      boundary: options.boundary
    };

    const cacheKey = this.getCacheKey('reverse', fullOptions);
    const cached = this.getFromCache(cacheKey);
    
    if (cached) {
      quotaManager.recordUsage('GEOCODING', true, true);
      return cached;
    }

    const quotaCheck = quotaManager.canMakeRequest('GEOCODING');
    if (quotaCheck.allowed) {
      try {
        const response = await this.makeGeocodingRequest('reverse', fullOptions);
        const results = this.transformGeocodingResponse(response);
        
        this.setCache(cacheKey, results);
        quotaManager.recordUsage('GEOCODING', true);
        
        return results;
      } catch (error) {
        this.logError('reverse_geocoding_failed', 'OpenRouteService reverse geocoding failed, trying fallback', { error: error.message, lat, lng });
        quotaManager.recordUsage('GEOCODING', false);
      }
    }

    // Fallback to Nominatim reverse geocoding
    try {
      const results = await this.reverseGeocodeWithNominatim(lat, lng);
      this.setCache(cacheKey, results);
      quotaManager.recordUsage('GEOCODING', true, false, true);
      
      return results;
    } catch (error) {
      quotaManager.recordUsage('GEOCODING', false, false, true);
      throw new Error(`Both reverse geocoding services failed: ${error}`);
    }
  }

  /**
   * Make request to OpenRouteService Geocoding API
   */
  private async makeGeocodingRequest(
    type: 'search' | 'autocomplete' | 'reverse',
    options: any
  ): Promise<GeocodingResponse> {
    let endpoint: string;
    let params: URLSearchParams;

    switch (type) {
      case 'search':
        endpoint = API_ENDPOINTS.GEOCODING.search;
        params = this.buildSearchParams(options);
        break;
      case 'autocomplete':
        endpoint = API_ENDPOINTS.GEOCODING.autocomplete;
        params = this.buildSearchParams(options);
        break;
      case 'reverse':
        endpoint = API_ENDPOINTS.GEOCODING.reverse;
        params = this.buildReverseParams(options);
        break;
    }

    const url = `${ORS_BASE_URL}${endpoint}?${params}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: DEFAULT_HEADERS,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT.DEFAULT)
    });

    if (!response.ok) {
      throw new Error(`Geocoding API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Fallback search using Nominatim
   */
  private async searchWithNominatim(
    query: string,
    options: Partial<GeocodingOptions> = {}
  ): Promise<SimpleLocation[]> {
    const params = new URLSearchParams({
      q: query,
      format: 'json',
      limit: String(options.size || 10),
      addressdetails: '1',
      extratags: '1'
    });

    const url = `${FALLBACK_APIS.GEOCODING.baseUrl}/search?${params}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'PathFinderPro/1.0'
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT.DEFAULT)
    });

    if (!response.ok) {
      throw new Error(`Nominatim error: ${response.status}`);
    }

    const results = await response.json();
    return this.transformNominatimResults(results);
  }

  /**
   * Fallback reverse geocoding using Nominatim
   */
  private async reverseGeocodeWithNominatim(
    lat: number,
    lng: number
  ): Promise<SimpleLocation[]> {
    const params = new URLSearchParams({
      lat: String(lat),
      lon: String(lng),
      format: 'json',
      limit: '1',
      addressdetails: '1'
    });

    const url = `${FALLBACK_APIS.GEOCODING.baseUrl}/reverse?${params}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'PathFinderPro/1.0'
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT.DEFAULT)
    });

    if (!response.ok) {
      throw new Error(`Nominatim reverse error: ${response.status}`);
    }

    const result = await response.json();
    return this.transformNominatimResults([result]);
  }

  /**
   * Build URL parameters for search/autocomplete
   */
  private buildSearchParams(options: GeocodingOptions | AutocompleteOptions): URLSearchParams {
    const params = new URLSearchParams({
      text: options.text,
      size: String(options.size || 10)
    });

    if (options.layers?.length) {
      params.append('layers', options.layers.join(','));
    }

    if (options.sources?.length) {
      params.append('sources', options.sources.join(','));
    }

    if (options.country?.length) {
      params.append('boundary.country', options.country.join(','));
    }

    if (options.focus) {
      params.append('focus.point.lat', String(options.focus.lat));
      params.append('focus.point.lon', String(options.focus.lon));
    }

    if (options.boundary?.rect) {
      const rect = options.boundary.rect;
      params.append('boundary.rect.min_lon', String(rect.min_lon));
      params.append('boundary.rect.min_lat', String(rect.min_lat));
      params.append('boundary.rect.max_lon', String(rect.max_lon));
      params.append('boundary.rect.max_lat', String(rect.max_lat));
    }

    if (options.boundary?.circle) {
      const circle = options.boundary.circle;
      params.append('boundary.circle.lat', String(circle.lat));
      params.append('boundary.circle.lon', String(circle.lon));
      params.append('boundary.circle.radius', String(circle.radius));
    }

    return params;
  }

  /**
   * Build URL parameters for reverse geocoding
   */
  private buildReverseParams(options: ReverseGeocodingOptions): URLSearchParams {
    const params = new URLSearchParams({
      'point.lat': String(options.lat),
      'point.lon': String(options.lon),
      size: String(options.size || 1)
    });

    if (options.layers?.length) {
      params.append('layers', options.layers.join(','));
    }

    if (options.sources?.length) {
      params.append('sources', options.sources.join(','));
    }

    if (options.boundary?.country?.length) {
      params.append('boundary.country', options.boundary.country.join(','));
    }

    return params;
  }

  /**
   * Transform OpenRouteService response to simple format
   */
  private transformGeocodingResponse(response: GeocodingResponse): SimpleLocation[] {
    return response.features.map(feature => ({
      id: feature.gid,
      name: feature.name || feature.properties.label,
      address: feature.properties.label,
      lat: feature.geometry.coordinates[1],
      lng: feature.geometry.coordinates[0],
      confidence: feature.properties.confidence,
      category: feature.layer,
      country: feature.properties.country,
      region: feature.properties.region,
      distance: feature.distance
    }));
  }

  /**
   * Transform Nominatim results to simple format
   */
  private transformNominatimResults(results: any[]): SimpleLocation[] {
    return results.map((result, index) => ({
      id: result.osm_id ? `osm_${result.osm_id}` : `nominatim_${index}`,
      name: result.name || result.display_name.split(',')[0],
      address: result.display_name,
      lat: parseFloat(result.lat),
      lng: parseFloat(result.lon),
      confidence: result.importance || 0.5,
      category: result.type || result.category,
      country: result.address?.country,
      region: result.address?.state || result.address?.region
    }));
  }

  /**
   * Generate cache key
   */
  private getCacheKey(type: string, options: any): string {
    return `geocoding_${type}_${JSON.stringify(options)}`;
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
    if (this.cache.size > 100) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }
  }

  /**
   * Log errors to monitoring service instead of console
   */
  private logError(errorType: string, message: string, metadata?: any) {
    const errorData = {
      service: 'GeocodingService',
      type: errorType,
      message,
      timestamp: new Date().toISOString(),
      metadata
    };
    
    // For development, structured logging
    if (import.meta.env.DEV) {
      logger.error('[GeocodingService] ' + message, errorData);
    }
  }

  /**
   * Get current quota status
   */
  getQuotaStatus() {
    return quotaManager.getQuotaStatus('GEOCODING');
  }
}

export const geocodingService = new GeocodingService();
export default geocodingService;