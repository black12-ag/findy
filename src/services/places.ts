import { get, post, del, patch } from '../lib/api';
import type { 
  Place, 
  PlaceSearchRequest, 
  PlaceSearchResult, 
  PaginatedResponse 
} from '../types/api';

class PlacesService {
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
  } = {}): Promise<{
    places: Place[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> {
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