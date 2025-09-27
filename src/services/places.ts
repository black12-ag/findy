import { get, post, del, patch } from '../lib/api';
import type { 
  Place, 
  PlaceSearchRequest, 
  PlaceSearchResult, 
  PaginatedResponse 
} from '../types/api';
import googleMapsService from './googleMapsService';
import { ORSPOIService, ORSGeocodingService, setORSApiKey } from './googleUnifiedService';
import { logger } from '../utils/logger';

class PlacesService {
  private useRealAPI: boolean = false;
  private useGoogleMaps: boolean = false;
  
  constructor() {
    // Check if Google Maps API is available
    const googleApiKey = import.meta.env?.VITE_GOOGLE_MAPS_API_KEY || '';
    this.useGoogleMaps = !!googleApiKey && googleApiKey !== 'YOUR_GOOGLE_MAPS_API_KEY_HERE';
    
    // Check if ORS API key is available as fallback
    const orsApiKey = import.meta.env?.VITE_ORS_API_KEY || '';
    this.useRealAPI = !!orsApiKey;
    if (this.useRealAPI) {
      setORSApiKey(orsApiKey);
    }
  }

  /**
   * Search for places using Google Maps with ORS fallback
   */
  async searchPlacesEnhanced(
    location: { lat: number; lng: number },
    query?: string,
    category?: string,
    radius: number = 1000
  ): Promise<PlaceSearchResult[]> {
    // Try Google Maps first
    if (this.useGoogleMaps) {
      try {
        const googleResults = await this.searchPlacesWithGoogle(location, query, category, radius);
        if (googleResults.length > 0) {
          return googleResults;
        }
      } catch (error) {
        logger.error('Google Maps places search failed, falling back to ORS', error);
      }
    }
    
    // Fallback to ORS
    return this.searchPlacesWithORS(location, query, category, radius);
  }

  /**
   * Search for places using Google Maps Places API
   */
  async searchPlacesWithGoogle(
    location: { lat: number; lng: number },
    query?: string,
    category?: string,
    radius: number = 1000
  ): Promise<PlaceSearchResult[]> {
    try {
      if (!googleMapsService.isAvailable()) {
        await googleMapsService.initialize();
      }

      if (!googleMapsService.isAvailable()) {
        throw new Error('Google Maps not available');
      }

      let googlePlaces: any[];
      
      if (query) {
        // Text search for specific query
        googlePlaces = await googleMapsService.searchPlaces({
          query: query,
          location: { lat: location.lat, lng: location.lng },
          radius,
        });
      } else if (category) {
        // Category-based search using nearby search
        const googleType = this.mapCategoryToGoogleType(category);
        googlePlaces = await googleMapsService.searchNearbyPlaces({
          location: { lat: location.lat, lng: location.lng },
          radius,
          type: googleType || 'establishment',
        });
      } else {
        // General places search
        googlePlaces = await googleMapsService.searchNearbyPlaces({
          location: { lat: location.lat, lng: location.lng },
          radius,
          type: 'establishment',
        });
      }
      
      logger.info('Google Places search completed', { 
        resultCount: googlePlaces.length, 
        query, 
        category,
        location 
      });

      // Convert Google Places results to our format
      return googlePlaces.map((place, index) => ({
        id: place.place_id || `google_place_${index}`,
        name: place.name || 'Unnamed Place',
        address: place.formatted_address || place.vicinity || 'Address not available',
        location: {
          lat: place.geometry?.location?.lat() || 0,
          lng: place.geometry?.location?.lng() || 0
        },
        category: this.mapGoogleTypesToCategory(place.types || []),
        rating: place.rating,
        openingHours: {
          isOpen: place.opening_hours?.isOpen() || true
        },
        isSaved: false,
        photos: place.photos?.map(photo => photo.getUrl({ maxWidth: 400, maxHeight: 400 })) || [],
        priceLevel: place.price_level,
        website: place.website,
        phoneNumber: place.formatted_phone_number,
      }));
    } catch (error) {
      logger.error('Google Places search failed', error);
      throw error;
    }
  }

  /**
   * Map category to Google Places type
   */
  private mapCategoryToGoogleType(category?: string): string | undefined {
    const categoryMap: Record<string, string> = {
      'restaurants': 'restaurant',
      'gas_stations': 'gas_station',
      'parking': 'parking',
      'banks': 'bank',
      'hospitals': 'hospital',
      'shopping': 'store',
      'hotels': 'lodging',
      'entertainment': 'amusement_park',
      'restaurant': 'restaurant',
      'gas_station': 'gas_station',
      'hospital': 'hospital',
      'school': 'school',
      'store': 'store',
      'tourist_attraction': 'tourist_attraction',
      'lodging': 'lodging',
      'bank': 'bank',
      'gym': 'gym',
    };
    
    return category ? categoryMap[category] : undefined;
  }

  /**
   * Map Google Places types to our categories
   */
  private mapGoogleTypesToCategory(types: string[]): string {
    const typeMap: Record<string, string> = {
      'restaurant': 'Restaurant',
      'food': 'Restaurant',
      'meal_takeaway': 'Restaurant',
      'gas_station': 'Gas Station',
      'hospital': 'Healthcare',
      'doctor': 'Healthcare',
      'pharmacy': 'Healthcare',
      'school': 'Education',
      'university': 'Education',
      'store': 'Shopping',
      'shopping_mall': 'Shopping',
      'supermarket': 'Shopping',
      'tourist_attraction': 'Attraction',
      'amusement_park': 'Attraction',
      'lodging': 'Accommodation',
      'bank': 'Finance',
      'atm': 'Finance',
      'gym': 'Fitness',
      'spa': 'Beauty & Wellness',
    };
    
    for (const type of types) {
      if (typeMap[type]) {
        return typeMap[type];
      }
    }
    
    return 'Other';
  }

  /**
   * Search for places using ORS POI service (fallback)
   */
  async searchPlacesWithORS(
    location: { lat: number; lng: number },
    query?: string,
    category?: string,
    radius: number = 1000
  ): Promise<PlaceSearchResult[]> {
    if (this.useRealAPI) {
      try {
        const orsResults = await ORSPOIService.searchPOIs(
          { lat: location.lat, lng: location.lng },
          radius,
          category,
          20 // limit
        );

        // Convert ORS POI results to our format
        return orsResults.map((poi, index) => ({
          id: poi.properties.osm_id?.toString() || `ors_poi_${index}`,
          name: poi.properties.osm_tags?.name || poi.properties.osm_tags?.amenity || 'Unnamed Place',
          address: this.formatORSAddress(poi.properties.osm_tags),
          location: {
            lat: poi.geometry.coordinates[1],
            lng: poi.geometry.coordinates[0]
          },
          category: this.mapORSCategory(poi.properties.category_ids),
          rating: this.extractRating(poi.properties.osm_tags),
          openingHours: {
            isOpen: true // ORS doesn't provide real-time hours
          },
          isSaved: false
        }));
      } catch (error) {
        console.error('ORS POI search failed:', error);
        // Fall back to regular API search
      }
    }
    
    // Fallback to existing API search
    const result = await this.searchPlaces({
      query: query || category || 'places',
      location,
      radius,
      type: category as any,
    });
    return result.places;
  }

  /**
   * Format ORS address from tags
   */
  private formatORSAddress(tags: Record<string, any>): string {
    const parts = [];
    if (tags['addr:housenumber'] && tags['addr:street']) {
      parts.push(`${tags['addr:housenumber']} ${tags['addr:street']}`);
    } else if (tags['addr:street']) {
      parts.push(tags['addr:street']);
    }
    if (tags['addr:city']) parts.push(tags['addr:city']);
    if (tags['addr:state']) parts.push(tags['addr:state']);
    return parts.join(', ') || tags.name || 'Address not available';
  }

  /**
   * Map ORS category IDs to readable categories
   */
  private mapORSCategory(categoryIds: number[]): string {
    if (!categoryIds || categoryIds.length === 0) return 'Other';
    
    // Map based on common ORS category IDs
    const categoryMap: Record<number, string> = {
      560: 'Restaurant', 561: 'Restaurant', 562: 'Restaurant',
      470: 'Gas Station',
      620: 'Healthcare',
      540: 'Finance', 541: 'Tourism', 542: 'Tourism',
      580: 'Accommodation', 581: 'Accommodation',
      600: 'Shopping', 601: 'Shopping', 602: 'Shopping'
    };
    
    for (const id of categoryIds) {
      if (categoryMap[id]) {
        return categoryMap[id];
      }
    }
    
    return 'Other';
  }

  /**
   * Extract rating from OSM tags
   */
  private extractRating(tags: Record<string, any>): number | undefined {
    if (tags.rating) {
      const rating = parseFloat(tags.rating);
      if (!isNaN(rating) && rating >= 0 && rating <= 5) {
        return rating;
      }
    }
    return undefined;
  }

  /**
   * Search for places
   */
  async searchPlaces(searchParams: PlaceSearchRequest): Promise<{
    places: PlaceSearchResult[];
    count: number;
  }> {
    return post('/places/search', searchParams);
  }

  /**
   * Get place details by ID
   */
  async getPlaceDetails(placeId: string): Promise<{
    place: PlaceSearchResult;
  }> {
    return get(`/places/${placeId}`);
  }

  /**
   * Save a place to user's collection
   */
  async savePlace(placeData: {
    googlePlaceId: string;
    name: string;
    address: string;
    location: {
      lat: number;
      lng: number;
    };
    category: string;
    isFavorite?: boolean;
  }): Promise<{
    place: Place;
  }> {
    return post('/places', placeData);
  }

  /**
   * Delete a saved place
   */
  async deletePlace(placeId: string): Promise<void> {
    await del(`/places/${placeId}`);
  }

  /**
   * Get user's saved places
   */
  async getUserPlaces(params: {
    category?: string;
    favorites?: boolean;
    page?: number;
    limit?: number;
  } = {}): Promise<PaginatedResponse<Place>> {
    const searchParams = new URLSearchParams();
    
    if (params.category) searchParams.append('category', params.category);
    if (params.favorites) searchParams.append('favorites', 'true');
    if (params.page) searchParams.append('page', params.page.toString());
    if (params.limit) searchParams.append('limit', params.limit.toString());

    return get(`/places?${searchParams.toString()}`);
  }

  /**
   * Toggle favorite status of a saved place
   */
  async toggleFavorite(placeId: string): Promise<{
    place: Place;
  }> {
    return patch(`/places/${placeId}/favorite`);
  }

  /**
   * Get nearby places based on current location
   */
  async getNearbyPlaces(
    location: { lat: number; lng: number },
    type?: string,
    radius: number = 5000
  ): Promise<PlaceSearchResult[]> {
    const result = await this.searchPlaces({
      query: type || 'restaurants',
      location,
      radius,
      type: type as any,
    });
    return result.places;
  }

  /**
   * Get popular places in area
   */
  async getPopularPlaces(
    location: { lat: number; lng: number },
    radius: number = 10000
  ): Promise<PlaceSearchResult[]> {
    const result = await this.searchPlaces({
      query: 'popular places',
      location,
      radius,
    });
    return result.places;
  }

  /**
   * Search for specific place types
   */
  async searchByType(
    location: { lat: number; lng: number },
    type: 'restaurant' | 'gas_station' | 'hospital' | 'school' | 'store' | 'attraction',
    radius: number = 5000
  ): Promise<PlaceSearchResult[]> {
    const typeQueries = {
      restaurant: 'restaurants',
      gas_station: 'gas stations',
      hospital: 'hospitals',
      school: 'schools',
      store: 'stores',
      attraction: 'attractions'
    };

    const result = await this.searchPlaces({
      query: typeQueries[type],
      location,
      radius,
      type,
    });
    return result.places;
  }

  /**
   * Get place categories for filtering
   */
  getPlaceCategories(): string[] {
    return [
      'Restaurant',
      'Gas Station', 
      'Healthcare',
      'Education',
      'Shopping',
      'Attraction',
      'Accommodation',
      'Finance',
      'Fitness',
      'Beauty & Wellness',
      'Other'
    ];
  }

  /**
   * Format place for display
   */
  formatPlace(place: PlaceSearchResult | Place): {
    id: string;
    name: string;
    address: string;
    location: { lat: number; lng: number };
    category: string;
    rating?: number;
    isOpen?: boolean;
    distance?: string;
    isSaved?: boolean;
  } {
    if ('latitude' in place) {
      // It's a saved Place
      return {
        id: place.id,
        name: place.name,
        address: place.address,
        location: { lat: place.latitude, lng: place.longitude },
        category: place.category,
        isSaved: true,
      };
    } else {
      // It's a PlaceSearchResult
      return {
        id: place.id,
        name: place.name,
        address: place.address,
        location: place.location,
        category: place.category,
        rating: place.rating,
        isOpen: place.openingHours?.isOpen,
        isSaved: place.isSaved,
      };
    }
  }

  /**
   * Calculate distance between two points (Haversine formula)
   */
  calculateDistance(
    point1: { lat: number; lng: number },
    point2: { lat: number; lng: number }
  ): number {
    const R = 6371; // Earth's radius in kilometers
    const dLat = this.toRadians(point2.lat - point1.lat);
    const dLng = this.toRadians(point2.lng - point1.lng);
    
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(point1.lat)) * Math.cos(this.toRadians(point2.lat)) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  /**
   * Format distance for display
   */
  formatDistance(distanceKm: number): string {
    if (distanceKm < 1) {
      return `${Math.round(distanceKm * 1000)}m`;
    }
    return `${distanceKm.toFixed(1)}km`;
  }
}

export const placesService = new PlacesService();
export default placesService;