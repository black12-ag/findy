/**
 * 📍 OpenRouteService POIs API Service
 * 
 * Handles Points of Interest search with fallback to Overpass API
 * POIs: 500/500 requests (60/minute)
 */

import { 
  ORS_BASE_URL, 
  API_ENDPOINTS, 
  DEFAULT_HEADERS, 
  REQUEST_TIMEOUT,
  FALLBACK_APIS,
  POICategory
} from '../config/apiConfig';
import { quotaManager } from './quotaManager';

export interface POISearchOptions {
  coordinates: [number, number]; // [lng, lat]
  categories?: number[];
  radius?: number; // meters
  limit?: number;
  filters?: {
    wheelchair?: boolean;
    smoking?: boolean;
    fee?: boolean;
  };
}

export interface POILocation {
  coordinates: [number, number]; // [lng, lat]
  name: string;
  category_ids: number[];
  osm_id?: number;
  osm_type?: string;
  distance?: number;
}

export interface POIProperties {
  osm_id: number;
  osm_type: string;
  country: string;
  city: string;
  street: string;
  housenumber?: string;
  postcode?: string;
  name: string;
  category_ids: number[];
  category_group_ids: number[];
  categories: {
    category_name: string;
    category_group_name: string;
  }[];
  brand?: string;
  website?: string;
  phone?: string;
  opening_hours?: string;
  wheelchair?: string;
  smoking?: string;
  internet_access?: string;
  fee?: string;
  address: {
    name: string;
    house_number?: string;
    street?: string;
    postal_code?: string;
    locality?: string;
    region?: string;
    country?: string;
  };
}

export interface POIFeature {
  type: 'Feature';
  geometry: {
    type: 'Point';
    coordinates: [number, number];
  };
  properties: POIProperties;
}

export interface POIResponse {
  type: 'FeatureCollection';
  features: POIFeature[];
  info: {
    service: string;
    timestamp: number;
    query: {
      coordinates: [number, number];
      radius: number;
    };
  };
}

export interface SimplePOI {
  id: string;
  name: string;
  category: string;
  categoryId: number;
  coordinates: {
    lat: number;
    lng: number;
  };
  distance?: number;
  address?: string;
  phone?: string;
  website?: string;
  openingHours?: string;
  rating?: number;
  wheelchair?: boolean;
  fee?: boolean;
}

class POIsService {
  private cache: Map<string, { data: any; timestamp: number }> = new Map();
  private readonly cacheTTL = 60 * 60 * 1000; // 1 hour cache

  /**
   * Find nearby POIs by category
   */
  async findNearby(
    coordinates: [number, number],
    categories: number[],
    radius: number = 5000
  ): Promise<SimplePOI[]> {
    const options: POISearchOptions = {
      coordinates,
      categories,
      radius,
      limit: 50
    };

    const cacheKey = this.getCacheKey('nearby', options);
    
    // Check cache first
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      quotaManager.recordUsage('POIS', true, true);
      return cached;
    }

    // Try OpenRouteService first
    const quotaCheck = quotaManager.canMakeRequest('POIS');
    if (quotaCheck.allowed) {
      try {
        const response = await this.makePOIRequest(options);
        const results = this.transformPOIResponse(response);
        
        this.setCache(cacheKey, results);
        quotaManager.recordUsage('POIS', true);
        
        return results;
      } catch (error) {
        console.warn('OpenRouteService POIs failed, trying fallback:', error);
        quotaManager.recordUsage('POIS', false);
      }
    }

    // Fallback to Overpass API
    try {
      const results = await this.searchWithOverpass(categories, coordinates, radius);
      this.setCache(cacheKey, results);
      quotaManager.recordUsage('POIS', true, false, true);
      
      return results;
    } catch (error) {
      quotaManager.recordUsage('POIS', false, false, true);
      throw new Error(`Both POI services failed: ${error}`);
    }
  }

  /**
   * Search POIs by query and location
   */
  async searchPOIs(
    query: string,
    categories: number[] = [],
    location: [number, number],
    radius: number = 10000
  ): Promise<SimplePOI[]> {
    // For text search, we'll use nearby search with category filtering
    const nearbyResults = await this.findNearby(location, categories, radius);
    
    // Filter results by query string
    const queryLower = query.toLowerCase();
    return nearbyResults.filter(poi => 
      poi.name.toLowerCase().includes(queryLower) ||
      poi.category.toLowerCase().includes(queryLower)
    );
  }

  /**
   * Get POIs by specific category
   */
  async getPOIsByCategory(
    category: POICategory,
    location: [number, number],
    radius: number = 5000
  ): Promise<SimplePOI[]> {
    const categoryConfig = API_ENDPOINTS.POIS.categories[category];
    if (!categoryConfig) {
      throw new Error(`Unknown POI category: ${category}`);
    }

    return this.findNearby(location, [categoryConfig.id], radius);
  }

  /**
   * Get popular/highly-rated POIs in area
   */
  async getPopularPOIs(
    location: [number, number],
    radius: number = 10000
  ): Promise<SimplePOI[]> {
    // Get POIs from multiple categories
    const popularCategories = [560, 470, 600, 580]; // Restaurants, Fuel, Shopping, Hotels
    const allPOIs = await this.findNearby(location, popularCategories, radius);
    
    // Sort by distance and limit to most relevant
    return allPOIs
      .sort((a, b) => (a.distance || 0) - (b.distance || 0))
      .slice(0, 20);
  }

  /**
   * Get POI details by ID (from cached data)
   */
  getPOIDetails(poiId: string): SimplePOI | null {
    // Search through cache for POI details
    for (const [key, cached] of this.cache.entries()) {
      if (key.includes('nearby') && cached.data) {
        const poi = cached.data.find((p: SimplePOI) => p.id === poiId);
        if (poi) return poi;
      }
    }
    return null;
  }

  /**
   * Make request to OpenRouteService POIs API
   */
  private async makePOIRequest(options: POISearchOptions): Promise<POIResponse> {
    const [lng, lat] = options.coordinates;
    const radius = options.radius || 5000;
    
    // Calculate bounding box from center point and radius
    const latDelta = (radius / 111000); // rough conversion: 1 degree ≈ 111km
    const lngDelta = latDelta / Math.cos(lat * Math.PI / 180);
    
    const bbox = [
      [lng - lngDelta, lat - latDelta], // southwest
      [lng + lngDelta, lat + latDelta]  // northeast
    ];

    const requestBody = {
      request: 'pois',
      geometry: {
        bbox: bbox,
        geojson: {
          type: 'Point',
          coordinates: [lng, lat]
        }
      }
    };

    // Add category filters if specified
    if (options.categories && options.categories.length > 0) {
      requestBody.request = {
        ...requestBody,
        filters: {
          category_ids: options.categories
        }
      } as any;
    }

    // Add other filters
    if (options.filters) {
      requestBody.request.filters = {
        ...requestBody.request.filters,
        ...options.filters
      } as any;
    }

    const url = `${ORS_BASE_URL}${API_ENDPOINTS.POIS.base}`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: DEFAULT_HEADERS,
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT.DEFAULT)
    });

    if (!response.ok) {
      throw new Error(`POIs API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Fallback search using Overpass API
   */
  private async searchWithOverpass(
    categories: number[],
    coordinates: [number, number],
    radius: number
  ): Promise<SimplePOI[]> {
    const [lng, lat] = coordinates;
    
    // Map ORS categories to Overpass tags (simplified mapping)
    const overpassQueries = this.mapCategoriesToOverpassTags(categories);
    
    const query = `
      [out:json][timeout:25];
      (
        ${overpassQueries.map(tag => `
          node["${tag.key}"="${tag.value}"](around:${radius},${lat},${lng});
          way["${tag.key}"="${tag.value}"](around:${radius},${lat},${lng});
        `).join('')}
      );
      out center meta;
    `;

    const response = await fetch(`${FALLBACK_APIS.POIS.baseUrl}/interpreter`, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain',
        'User-Agent': 'PathFinderPro/1.0'
      },
      body: query,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT.DEFAULT)
    });

    if (!response.ok) {
      throw new Error(`Overpass API error: ${response.status}`);
    }

    const data = await response.json();
    return this.transformOverpassResults(data, coordinates);
  }

  /**
   * Map ORS category IDs to Overpass API tags
   */
  private mapCategoriesToOverpassTags(categories: number[]): Array<{key: string, value: string}> {
    const tagMap: Record<number, Array<{key: string, value: string}>> = {
      560: [{ key: 'amenity', value: 'restaurant' }, { key: 'amenity', value: 'fast_food' }],
      470: [{ key: 'amenity', value: 'fuel' }],
      360: [{ key: 'amenity', value: 'hospital' }, { key: 'amenity', value: 'clinic' }],
      600: [{ key: 'shop', value: 'supermarket' }, { key: 'shop', value: 'mall' }],
      510: [{ key: 'amenity', value: 'atm' }, { key: 'amenity', value: 'bank' }],
      580: [{ key: 'tourism', value: 'hotel' }, { key: 'tourism', value: 'hostel' }],
      590: [{ key: 'tourism', value: 'attraction' }, { key: 'tourism', value: 'museum' }],
      480: [{ key: 'amenity', value: 'parking' }]
    };

    const tags: Array<{key: string, value: string}> = [];
    categories.forEach(catId => {
      const categoryTags = tagMap[catId];
      if (categoryTags) {
        tags.push(...categoryTags);
      }
    });

    return tags.length > 0 ? tags : [{ key: 'amenity', value: 'restaurant' }]; // default
  }

  /**
   * Transform OpenRouteService response to simple format
   */
  private transformPOIResponse(response: POIResponse): SimplePOI[] {
    return response.features.map((feature, index) => {
      const props = feature.properties;
      const [lng, lat] = feature.geometry.coordinates;
      
      return {
        id: `ors_${props.osm_id}_${index}`,
        name: props.name || 'Unnamed Place',
        category: props.categories?.[0]?.category_name || 'Unknown',
        categoryId: props.category_ids?.[0] || 0,
        coordinates: { lat, lng },
        distance: this.calculateDistance(
          response.info.query.coordinates,
          [lng, lat]
        ),
        address: this.formatAddress(props.address),
        phone: props.phone,
        website: props.website,
        openingHours: props.opening_hours,
        wheelchair: props.wheelchair === 'yes',
        fee: props.fee === 'yes'
      };
    });
  }

  /**
   * Transform Overpass results to simple format
   */
  private transformOverpassResults(
    data: any,
    centerCoords: [number, number]
  ): SimplePOI[] {
    return data.elements.map((element: any, index: number) => {
      const lat = element.lat || element.center?.lat || 0;
      const lng = element.lon || element.center?.lon || 0;
      const tags = element.tags || {};
      
      return {
        id: `overpass_${element.id}_${index}`,
        name: tags.name || tags.brand || 'Unnamed Place',
        category: this.getCategoryFromTags(tags),
        categoryId: this.getCategoryIdFromTags(tags),
        coordinates: { lat, lng },
        distance: this.calculateDistance(centerCoords, [lng, lat]),
        address: this.formatOverpassAddress(tags),
        phone: tags.phone,
        website: tags.website,
        openingHours: tags.opening_hours,
        wheelchair: tags.wheelchair === 'yes',
        fee: tags.fee === 'yes'
      };
    });
  }

  /**
   * Get category name from Overpass tags
   */
  private getCategoryFromTags(tags: any): string {
    if (tags.amenity) {
      const amenityMap: Record<string, string> = {
        restaurant: 'Restaurant',
        fast_food: 'Fast Food',
        fuel: 'Gas Station',
        hospital: 'Hospital',
        clinic: 'Medical',
        atm: 'ATM',
        bank: 'Bank',
        parking: 'Parking'
      };
      return amenityMap[tags.amenity] || tags.amenity;
    }
    
    if (tags.shop) {
      return tags.shop === 'supermarket' ? 'Supermarket' : 'Shopping';
    }
    
    if (tags.tourism) {
      const tourismMap: Record<string, string> = {
        hotel: 'Hotel',
        hostel: 'Hostel',
        attraction: 'Attraction',
        museum: 'Museum'
      };
      return tourismMap[tags.tourism] || tags.tourism;
    }
    
    return 'Unknown';
  }

  /**
   * Get category ID from Overpass tags
   */
  private getCategoryIdFromTags(tags: any): number {
    const tagToCategoryMap: Record<string, number> = {
      // Amenity
      'amenity_restaurant': 560,
      'amenity_fast_food': 560,
      'amenity_fuel': 470,
      'amenity_hospital': 360,
      'amenity_clinic': 360,
      'amenity_atm': 510,
      'amenity_bank': 510,
      'amenity_parking': 480,
      // Shop
      'shop_supermarket': 600,
      'shop_mall': 600,
      // Tourism
      'tourism_hotel': 580,
      'tourism_hostel': 580,
      'tourism_attraction': 590,
      'tourism_museum': 590
    };

    for (const [key, value] of Object.entries(tags)) {
      const mapKey = `${key}_${value}`;
      if (tagToCategoryMap[mapKey]) {
        return tagToCategoryMap[mapKey];
      }
    }

    return 0; // Unknown category
  }

  /**
   * Format address from ORS response
   */
  private formatAddress(address: any): string {
    if (!address) return '';
    
    const parts = [
      address.house_number,
      address.street,
      address.locality,
      address.region,
      address.country
    ].filter(Boolean);
    
    return parts.join(', ');
  }

  /**
   * Format address from Overpass tags
   */
  private formatOverpassAddress(tags: any): string {
    const parts = [
      tags.housenumber || tags['addr:housenumber'],
      tags.street || tags['addr:street'],
      tags.city || tags['addr:city'],
      tags.postcode || tags['addr:postcode'],
      tags.country || tags['addr:country']
    ].filter(Boolean);
    
    return parts.join(', ');
  }

  /**
   * Calculate distance between two coordinates (Haversine formula)
   */
  private calculateDistance(coord1: [number, number], coord2: [number, number]): number {
    const [lng1, lat1] = coord1;
    const [lng2, lat2] = coord2;
    
    const R = 6371000; // Earth's radius in meters
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lng2 - lng1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) *
      Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    
    return Math.round(R * c);
  }

  /**
   * Generate cache key
   */
  private getCacheKey(type: string, options: any): string {
    return `pois_${type}_${JSON.stringify(options)}`;
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
   * Get current quota status
   */
  getQuotaStatus() {
    return quotaManager.getQuotaStatus('POIS');
  }
}

export const poisService = new POIsService();
export default poisService;