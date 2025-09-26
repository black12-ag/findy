import { Client } from '@googlemaps/google-maps-services-js';
import { logger } from '@/config/logger';
import { AppError } from '@/utils/error';
import { config } from '@/config/env';
import type {
  PlaceSearchParams,
  RouteCalculationParams,
  GeocodeParams,
  Place,
  Route,
  Location,
  GeocodingResult,
} from '@/types/maps';

class MapsService {
  private client: Client;

  constructor() {
    this.client = new Client({});
  }

  /**
   * Search for places using Google Places API
   */
  async searchPlaces(params: PlaceSearchParams): Promise<Place[]> {
    try {
      const { query, location, radius = 5000, type } = params;

      const searchParams: any = {
        params: {
          key: config.google.mapsApiKey,
          query,
          radius,
          language: 'en',
          fields: [
            'place_id',
            'name',
            'formatted_address',
            'geometry',
            'rating',
            'price_level',
            'opening_hours',
            'photos',
            'types',
            'website',
            'international_phone_number',
          ],
        },
      };

      if (location) {
        searchParams.params.location = `${location.lat},${location.lng}`;
      }

      if (type) {
        searchParams.params.type = type;
      }

      const response = await this.client.textSearch(searchParams);

      if (response.data.status !== 'OK' && response.data.status !== 'ZERO_RESULTS') {
        throw new AppError(`Google Places API error: ${response.data.status}`, 500);
      }

      return response.data.results.map(this.formatPlace);
    } catch (error) {
      logger.error('Error searching places:', error);
      throw new AppError('Failed to search places', 500);
    }
  }

  /**
   * Get detailed information about a specific place
   */
  async getPlaceDetails(placeId: string): Promise<Place | null> {
    try {
      const response = await this.client.placeDetails({
        params: {
          key: config.google.mapsApiKey,
          place_id: placeId,
          fields: [
            'place_id',
            'name',
            'formatted_address',
            'geometry',
            'rating',
            'price_level',
            'opening_hours',
            'photos',
            'types',
            'website',
            'international_phone_number',
            'reviews',
            'user_ratings_total',
          ],
          language: 'en',
        },
      });

      if (response.data.status !== 'OK') {
        if (response.data.status === 'NOT_FOUND') {
          return null;
        }
        throw new AppError(`Google Places API error: ${response.data.status}`, 500);
      }

      return this.formatPlace(response.data.result);
    } catch (error) {
      logger.error('Error getting place details:', error);
      throw new AppError('Failed to get place details', 500);
    }
  }

  /**
   * Calculate route between two points
   */
  async calculateRoute(params: RouteCalculationParams): Promise<Route> {
    try {
      const { origin, destination, waypoints, travelMode = 'DRIVING', optimize = false } = params;

      const routeParams: any = {
        params: {
          key: config.google.mapsApiKey,
          origin: `${origin.lat},${origin.lng}`,
          destination: `${destination.lat},${destination.lng}`,
          mode: travelMode.toLowerCase(),
          units: 'metric',
          language: 'en',
        },
      };

      if (waypoints && waypoints.length > 0) {
        const waypointStr = waypoints
          .map(wp => `${wp.lat},${wp.lng}`)
          .join('|');
        routeParams.params.waypoints = optimize ? `optimize:true|${waypointStr}` : waypointStr;
      }

      const response = await this.client.directions(routeParams);

      if (response.data.status !== 'OK') {
        throw new AppError(`Google Directions API error: ${response.data.status}`, 500);
      }

      const route = response.data.routes[0];
      if (!route) {
        throw new AppError('No route found', 404);
      }

      return this.formatRoute(route);
    } catch (error) {
      logger.error('Error calculating route:', error);
      throw new AppError('Failed to calculate route', 500);
    }
  }

  /**
   * Geocode an address to coordinates
   */
  async geocode(params: GeocodeParams): Promise<GeocodingResult[]> {
    try {
      const { address, location, bounds } = params;

      const geocodeParams: any = {
        params: {
          key: config.google.mapsApiKey,
          language: 'en',
        },
      };

      if (address) {
        geocodeParams.params.address = address;
      }

      if (location) {
        geocodeParams.params.latlng = `${location.lat},${location.lng}`;
      }

      if (bounds) {
        geocodeParams.params.bounds = `${bounds.southwest.lat},${bounds.southwest.lng}|${bounds.northeast.lat},${bounds.northeast.lng}`;
      }

      const response = await this.client.geocode(geocodeParams);

      if (response.data.status !== 'OK' && response.data.status !== 'ZERO_RESULTS') {
        throw new AppError(`Google Geocoding API error: ${response.data.status}`, 500);
      }

      return response.data.results.map(this.formatGeocodingResult);
    } catch (error) {
      logger.error('Error geocoding:', error);
      throw new AppError('Failed to geocode', 500);
    }
  }

  /**
   * Reverse geocode coordinates to address
   */
  async reverseGeocode(location: Location): Promise<GeocodingResult[]> {
    return this.geocode({ location });
  }

  /**
   * Get travel time matrix between multiple origins and destinations
   */
  async getTravelTimeMatrix(origins: Location[], destinations: Location[], travelMode: string = 'DRIVING') {
    try {
      const response = await this.client.distancematrix({
        params: {
          key: config.google.mapsApiKey,
          origins: origins.map(o => `${o.lat},${o.lng}`),
          destinations: destinations.map(d => `${d.lat},${d.lng}`),
          mode: travelMode.toLowerCase(),
          units: 'metric',
          language: 'en',
        },
      });

      if (response.data.status !== 'OK') {
        throw new AppError(`Google Distance Matrix API error: ${response.data.status}`, 500);
      }

      return response.data;
    } catch (error) {
      logger.error('Error getting travel time matrix:', error);
      throw new AppError('Failed to get travel time matrix', 500);
    }
  }

  /**
   * Format Google Places result to our Place interface
   */
  private formatPlace(place: any): Place {
    return {
      id: place.place_id,
      name: place.name,
      address: place.formatted_address || '',
      location: {
        lat: place.geometry?.location?.lat || 0,
        lng: place.geometry?.location?.lng || 0,
      },
      category: this.getCategoryFromTypes(place.types || []),
      rating: place.rating,
      priceLevel: place.price_level,
      photos: place.photos?.map((photo: any) => ({
        reference: photo.photo_reference,
        width: photo.width,
        height: photo.height,
      })) || [],
      openingHours: place.opening_hours ? {
        isOpen: place.opening_hours.open_now,
        periods: place.opening_hours.periods || [],
        weekdayText: place.opening_hours.weekday_text || [],
      } : undefined,
      website: place.website,
      phoneNumber: place.international_phone_number,
      reviews: place.reviews?.map((review: any) => ({
        author: review.author_name,
        rating: review.rating,
        text: review.text,
        time: review.time,
        profilePhoto: review.profile_photo_url,
      })) || [],
      userRatingsTotal: place.user_ratings_total,
    };
  }

  /**
   * Format Google Directions result to our Route interface
   */
  private formatRoute(route: any): Route {
    const leg = route.legs[0];
    
    return {
      summary: route.summary,
      distance: {
        text: leg.distance.text,
        value: leg.distance.value,
      },
      duration: {
        text: leg.duration.text,
        value: leg.duration.value,
      },
      startAddress: leg.start_address,
      endAddress: leg.end_address,
      startLocation: {
        lat: leg.start_location.lat,
        lng: leg.start_location.lng,
      },
      endLocation: {
        lat: leg.end_location.lat,
        lng: leg.end_location.lng,
      },
      steps: leg.steps?.map((step: any) => ({
        instruction: step.html_instructions,
        distance: step.distance,
        duration: step.duration,
        startLocation: {
          lat: step.start_location.lat,
          lng: step.start_location.lng,
        },
        endLocation: {
          lat: step.end_location.lat,
          lng: step.end_location.lng,
        },
        polyline: step.polyline?.points,
        travelMode: step.travel_mode,
      })) || [],
      polyline: route.overview_polyline?.points,
      bounds: route.bounds ? {
        northeast: {
          lat: route.bounds.northeast.lat,
          lng: route.bounds.northeast.lng,
        },
        southwest: {
          lat: route.bounds.southwest.lat,
          lng: route.bounds.southwest.lng,
        },
      } : undefined,
    };
  }

  /**
   * Format Google Geocoding result
   */
  private formatGeocodingResult(result: any): GeocodingResult {
    return {
      formattedAddress: result.formatted_address,
      location: {
        lat: result.geometry.location.lat,
        lng: result.geometry.location.lng,
      },
      placeId: result.place_id,
      types: result.types,
      addressComponents: result.address_components?.map((component: any) => ({
        longName: component.long_name,
        shortName: component.short_name,
        types: component.types,
      })) || [],
    };
  }

  /**
   * Extract primary category from Google Place types
   */
  private getCategoryFromTypes(types: string[]): string {
    const categoryMap: { [key: string]: string } = {
      restaurant: 'Restaurant',
      food: 'Restaurant',
      gas_station: 'Gas Station',
      hospital: 'Healthcare',
      pharmacy: 'Healthcare',
      school: 'Education',
      university: 'Education',
      shopping_mall: 'Shopping',
      store: 'Shopping',
      tourist_attraction: 'Attraction',
      amusement_park: 'Attraction',
      lodging: 'Accommodation',
      bank: 'Finance',
      atm: 'Finance',
      gym: 'Fitness',
      beauty_salon: 'Beauty & Wellness',
      spa: 'Beauty & Wellness',
    };

    for (const type of types) {
      if (categoryMap[type]) {
        return categoryMap[type];
      }
    }

    return 'Other';
  }
}

export const mapsService = new MapsService();