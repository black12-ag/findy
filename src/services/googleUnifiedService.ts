/**
 * 🗺️ Google Maps Unified Service
 * 
 * Replaces all OpenRouteService (ORS) functionality with Google Maps APIs
 * Provides: Geocoding, Directions, Places, POI Search, and more
 */

import googleMapsService from './googleMapsService';
import { logger } from '../utils/logger';

// Unified types that match ORS interface but use Google data
export interface UnifiedCoordinate {
  lat: number;
  lng: number;
}

export interface UnifiedGeocodingResult {
  place_id: string;
  display_name: string;
  lat: number;
  lon: number; // Keep 'lon' for ORS compatibility
  formatted_address: string;
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

export interface UnifiedDirectionsStep {
  distance: number;
  duration: number;
  instruction: string;
  name: string;
  way_points: [number, number];
}

export interface UnifiedDirectionsRoute {
  summary: {
    distance: number;
    duration: number;
  };
  geometry: {
    coordinates: [number, number][];
    type: string;
  };
  segments: Array<{
    distance: number;
    duration: number;
    steps: UnifiedDirectionsStep[];
  }>;
  bbox: [number, number, number, number];
}

export interface UnifiedPOIResult {
  properties: {
    osm_id: string;
    osm_type: string;
    category_ids: string[];
    osm_tags: Record<string, any>;
  };
  geometry: {
    coordinates: [number, number];
    type: string;
  };
}

/**
 * Unified Geocoding Service using Google Maps Geocoding API
 */
export class UnifiedGeocodingService {
  static async search(query: string, options?: {
    limit?: number;
    countryCode?: string;
    boundingBox?: [number, number, number, number];
  }): Promise<UnifiedGeocodingResult[]> {
    try {
      logger.info('Google Geocoding search:', { query, options });
      
      // Use Google Maps Geocoding API
      const results = await googleMapsService.geocodeAddress(query);
      
      // Convert Google results to unified format
      const unifiedResults: UnifiedGeocodingResult[] = results.slice(0, options?.limit || 10).map(result => {
        const location = result.geometry.location;
        const addressComponents = result.address_components || [];
        
        // Extract address components
        const getComponent = (types: string[]) => {
          const component = addressComponents.find(comp => 
            comp.types.some(type => types.includes(type))
          );
          return component?.long_name || component?.short_name;
        };
        
        return {
          place_id: result.place_id || `google_${Date.now()}`,
          display_name: result.formatted_address || query,
          formatted_address: result.formatted_address || query,
          lat: location.lat(),
          lon: location.lng(), // Keep 'lon' for compatibility
          importance: 1.0,
          class: result.types?.[0] || 'unknown',
          type: result.types?.[0] || 'unknown',
          address: {
            house_number: getComponent(['street_number']),
            road: getComponent(['route', 'street_address']),
            city: getComponent(['locality', 'administrative_area_level_2']),
            state: getComponent(['administrative_area_level_1']),
            postcode: getComponent(['postal_code']),
            country: getComponent(['country']),
            country_code: addressComponents.find(comp => 
              comp.types.includes('country')
            )?.short_name?.toLowerCase()
          }
        };
      });
      
      logger.info('Google geocoding completed', { resultCount: unifiedResults.length });
      return unifiedResults;
    } catch (error) {
      logger.error('Google geocoding failed:', error);
      throw error;
    }
  }

  static async reverseGeocode(lat: number, lng: number): Promise<UnifiedGeocodingResult[]> {
    try {
      const results = await googleMapsService.reverseGeocode({ lat, lng });
      
      return results.map(result => {
        const location = result.geometry.location;
        
        return {
          place_id: result.place_id || `reverse_${Date.now()}`,
          display_name: result.formatted_address || `${lat}, ${lng}`,
          formatted_address: result.formatted_address || `${lat}, ${lng}`,
          lat: location.lat(),
          lon: location.lng(),
          importance: 1.0,
          class: result.types?.[0] || 'unknown',
          type: result.types?.[0] || 'unknown'
        };
      });
    } catch (error) {
      logger.error('Google reverse geocoding failed:', error);
      throw error;
    }
  }
}

/**
 * Unified Directions Service using Google Maps Directions API
 */
export class UnifiedDirectionsService {
  static async getDirections(
    start: UnifiedCoordinate,
    end: UnifiedCoordinate,
    profile: 'driving-car' | 'foot-walking' | 'cycling-regular' | 'driving-hgv' = 'driving-car'
  ): Promise<UnifiedDirectionsRoute> {
    try {
      // Convert profile to Google travel mode
      const travelModeMap = {
        'driving-car': 'driving',
        'foot-walking': 'walking',
        'cycling-regular': 'cycling',
        'driving-hgv': 'driving'
      };
      
      const travelMode = travelModeMap[profile] as 'driving' | 'walking' | 'cycling';
      
      logger.info('Google Directions request:', { start, end, profile, travelMode });
      
      const result = await googleMapsService.getDirections({
        origin: { lat: start.lat, lng: start.lng },
        destination: { lat: end.lat, lng: end.lng },
        travelMode: googleMapsService.convertToGoogleTravelMode(travelMode)
      });
      
      if (!result || !result.routes[0]) {
        throw new Error('No route found');
      }
      
      const route = result.routes[0];
      const leg = route.legs[0];
      
      // Convert Google route to unified format
      const coordinates: [number, number][] = [];
      route.overview_path.forEach(point => {
        coordinates.push([point.lng(), point.lat()]);
      });
      
      // Convert steps
      const steps: UnifiedDirectionsStep[] = leg.steps.map(step => ({
        distance: step.distance?.value || 0,
        duration: step.duration?.value || 0,
        instruction: step.instructions || '',
        name: step.instructions || '',
        way_points: [step.start_location.lng(), step.start_location.lat()]
      }));
      
      const unifiedRoute: UnifiedDirectionsRoute = {
        summary: {
          distance: leg.distance?.value || 0,
          duration: leg.duration?.value || 0
        },
        geometry: {
          coordinates,
          type: 'LineString'
        },
        segments: [{
          distance: leg.distance?.value || 0,
          duration: leg.duration?.value || 0,
          steps
        }],
        bbox: [
          Math.min(...coordinates.map(c => c[0])),
          Math.min(...coordinates.map(c => c[1])),
          Math.max(...coordinates.map(c => c[0])),
          Math.max(...coordinates.map(c => c[1]))
        ]
      };
      
      logger.info('Google directions completed', { 
        distance: leg.distance?.text,
        duration: leg.duration?.text
      });
      
      return unifiedRoute;
    } catch (error) {
      logger.error('Google directions failed:', error);
      throw error;
    }
  }
}

/**
 * Unified POI Service using Google Maps Places API
 */
export class UnifiedPOIService {
  static async searchPOIs(
    location: UnifiedCoordinate,
    radius: number,
    category?: string,
    limit: number = 20
  ): Promise<UnifiedPOIResult[]> {
    try {
      logger.info('Google Places POI search:', { location, radius, category, limit });
      
      // Use Google Places API for POI search
      const places = await googleMapsService.searchNearbyPlaces({
        location: { lat: location.lat, lng: location.lng },
        radius,
        type: category || 'establishment'
      });
      
      // Convert Google Places to unified POI format
      const unifiedPOIs: UnifiedPOIResult[] = places.slice(0, limit).map((place, index) => ({
        properties: {
          osm_id: place.place_id || `google_poi_${index}`,
          osm_type: 'node',
          category_ids: place.types || ['establishment'],
          osm_tags: {
            name: place.name,
            amenity: category,
            rating: place.rating?.toString(),
            price_level: place.price_level?.toString(),
            business_status: place.business_status
          }
        },
        geometry: {
          coordinates: [
            place.geometry?.location?.lng() || location.lng,
            place.geometry?.location?.lat() || location.lat
          ],
          type: 'Point'
        }
      }));
      
      logger.info('Google POI search completed', { resultCount: unifiedPOIs.length });
      return unifiedPOIs;
    } catch (error) {
      logger.error('Google POI search failed:', error);
      throw error;
    }
  }
}

// Export services with ORS-compatible names for easy replacement
export const ORSGeocodingService = UnifiedGeocodingService;
export const ORSDirectionsService = UnifiedDirectionsService;
export const ORSPOIService = UnifiedPOIService;

// Export types with ORS-compatible names
export type ORSGeocodingResult = UnifiedGeocodingResult;
export type ORSDirectionsRoute = UnifiedDirectionsRoute;
export type ORSPOIResult = UnifiedPOIResult;
export type ORSCoordinate = UnifiedCoordinate;

// Mock the setORSApiKey function (no longer needed)
export const setORSApiKey = (apiKey: string) => {
  logger.info('ORS API key setting ignored - now using Google Maps APIs');
};

export default {
  UnifiedGeocodingService,
  UnifiedDirectionsService, 
  UnifiedPOIService,
  ORSGeocodingService: UnifiedGeocodingService,
  ORSDirectionsService: UnifiedDirectionsService,
  ORSPOIService: UnifiedPOIService,
  setORSApiKey
};