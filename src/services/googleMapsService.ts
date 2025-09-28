/**
 * 🗺️ Google Maps Service Layer
 * 
 * Comprehensive Google Maps API integration
 * Includes: Maps JavaScript API, Directions API, Places API, Geocoding API
 */

import { logger } from '../utils/logger';
import { toast } from 'sonner';
import { googleMapsLoader } from './googleMapsLoader';

class GoogleMapsService {
  private map: google.maps.Map | null = null;
  private directionsService: google.maps.DirectionsService | null = null;
  private directionsRenderer: google.maps.DirectionsRenderer | null = null;
  private placesService: google.maps.places.PlacesService | null = null;
  private geocoder: google.maps.Geocoder | null = null;
  private isInitialized = false;

  /**
   * Initialize Google Maps APIs using centralized loader
   */
  async initialize(): Promise<boolean> {
    if (this.isInitialized) return true;

    try {
      // Use centralized loader
      const isLoaded = await googleMapsLoader.waitForGoogleMaps();
      if (!isLoaded) {
        throw new Error('Google Maps API failed to load');
      }
      
      this.directionsService = new google.maps.DirectionsService();
      this.directionsRenderer = new google.maps.DirectionsRenderer();
      this.geocoder = new google.maps.Geocoder();
      
      this.isInitialized = true;
      logger.info('Google Maps APIs initialized successfully');
      return true;
    } catch (error) {
      logger.error('Failed to initialize Google Maps APIs', error);
      toast.error('Failed to load Google Maps. Using fallback services.');
      return false;
    }
  }

  /**
   * Create Google Map instance
   */
  async createMap(container: HTMLElement, options: google.maps.MapOptions): Promise<google.maps.Map | null> {
    if (!await this.initialize()) return null;

    try {
      this.map = new google.maps.Map(container, {
        zoom: 15,
        center: { lat: 37.7749, lng: -122.4194 }, // Default to San Francisco
        ...options,
        mapId: 'DEMO_MAP_ID', // Required for AdvancedMarkerElement
        mapTypeControl: false,
        streetViewControl: true,
        fullscreenControl: true,
        zoomControl: true,
      });

      // Modern Places API will be loaded dynamically when needed
      // No need to initialize legacy PlacesService
      
      return this.map;
    } catch (error) {
      logger.error('Failed to create Google Map', error);
      return null;
    }
  }

  /**
   * Get directions between two points
   */
  async getDirections(request: {
    origin: string | google.maps.LatLng | google.maps.LatLngLiteral;
    destination: string | google.maps.LatLng | google.maps.LatLngLiteral;
    travelMode?: google.maps.TravelMode;
    waypoints?: google.maps.DirectionsWaypoint[];
    optimizeWaypoints?: boolean;
    avoidHighways?: boolean;
    avoidTolls?: boolean;
    avoidFerries?: boolean;
    provideRouteAlternatives?: boolean;
  }): Promise<google.maps.DirectionsResult | null> {
    if (!await this.initialize()) return null;
    if (!this.directionsService) return null;

    const directionsRequest: google.maps.DirectionsRequest = {
      origin: request.origin,
      destination: request.destination,
      travelMode: request.travelMode || google.maps.TravelMode.DRIVING,
      waypoints: request.waypoints || [],
      optimizeWaypoints: request.optimizeWaypoints || false,
      avoidHighways: request.avoidHighways || false,
      avoidTolls: request.avoidTolls || false,
      avoidFerries: request.avoidFerries || false,
      provideRouteAlternatives: request.provideRouteAlternatives || false,
    };

    return new Promise((resolve, reject) => {
      this.directionsService!.route(directionsRequest, (result, status) => {
        if (status === google.maps.DirectionsStatus.OK && result) {
          resolve(result);
        } else {
          logger.error('Directions request failed', { status, request: directionsRequest });
          reject(new Error(`Directions request failed: ${status}`));
        }
      });
    });
  }

  /**
   * Display directions on map
   */
  displayDirections(directionsResult: google.maps.DirectionsResult): void {
    if (!this.map || !this.directionsRenderer) return;

    this.directionsRenderer.setMap(this.map);
    this.directionsRenderer.setDirections(directionsResult);
  }

  /**
   * Search for places using modern Places API
   */
  async searchPlaces(request: {
    query?: string;
    location?: google.maps.LatLng | google.maps.LatLngLiteral;
    radius?: number;
    type?: string;
    keyword?: string;
  }): Promise<google.maps.places.PlaceResult[]> {
    if (!await this.initialize()) return [];

    try {
      // Use only the modern Places API
      return await this.searchPlacesModern(request);
    } catch (error) {
      logger.error('Places search failed', error);
      return [];
    }
  }

  /**
   * Search for nearby places using modern Places API
   */
  async searchNearbyPlaces(request: {
    location: google.maps.LatLng | google.maps.LatLngLiteral;
    radius?: number;
    type?: string;
    keyword?: string;
  }): Promise<google.maps.places.PlaceResult[]> {
    if (!await this.initialize()) return [];

    try {
      return await this.searchPlacesModern({
        location: request.location,
        radius: request.radius,
        type: request.type,
        keyword: request.keyword
      });
    } catch (error) {
      logger.error('Nearby places search failed', error);
      return [];
    }
  }

  /**
   * Modern Places API search
   */
  private async searchPlacesModern(request: {
    query?: string;
    location?: google.maps.LatLng | google.maps.LatLngLiteral;
    radius?: number;
    type?: string;
    keyword?: string;
  }): Promise<google.maps.places.PlaceResult[]> {
    try {
      // Import the places library
      const { Place } = await google.maps.importLibrary('places') as any;
      
      if (!Place) {
        logger.error('Modern Places API not available');
        return [];
      }

      const results: google.maps.places.PlaceResult[] = [];

      // Text search using modern API
      if (request.query) {
        try {
          const searchRequest = {
            textQuery: request.query,
            fields: ['displayName', 'location', 'businessStatus', 'formattedAddress', 'rating'],
            locationBias: request.location ? {
              center: request.location,
              radius: request.radius || 5000
            } : undefined,
            maxResultCount: 20
          };

          const { places } = await Place.searchByText(searchRequest);
          
          // Convert new Place objects to legacy PlaceResult format for compatibility
          places.forEach((place: any) => {
            results.push({
              place_id: place.id,
              name: place.displayName,
              geometry: {
                location: place.location
              },
              formatted_address: place.formattedAddress,
              rating: place.rating,
              business_status: place.businessStatus
            } as google.maps.places.PlaceResult);
          });

        } catch (error) {
          logger.error('Modern Places text search failed', error);
          return [];
        }
      }

      // Nearby search using modern API
      else if (request.location) {
        try {
          const searchRequest = {
            fields: ['displayName', 'location', 'businessStatus', 'formattedAddress', 'rating'],
            locationRestriction: {
              center: request.location,
              radius: request.radius || 5000
            },
            includedTypes: request.type ? [request.type] : undefined,
            maxResultCount: 20
          };

          const { places } = await Place.searchNearby(searchRequest);
          
          // Convert new Place objects to legacy PlaceResult format for compatibility
          places.forEach((place: any) => {
            results.push({
              place_id: place.id,
              name: place.displayName,
              geometry: {
                location: place.location
              },
              formatted_address: place.formattedAddress,
              rating: place.rating,
              business_status: place.businessStatus
            } as google.maps.places.PlaceResult);
          });

        } catch (error) {
          logger.error('Modern Places nearby search failed', error);
          return [];
        }
      }

      logger.info('Modern Places API search completed successfully', { resultCount: results.length });
      return results;
    } catch (error) {
      logger.error('Modern Places API search failed entirely', error);
      return [];
    }
  }

  /**
   * Legacy Places API search (with deprecation handling)
   */
  private async searchPlacesLegacy(request: {
    query?: string;
    location?: google.maps.LatLng | google.maps.LatLngLiteral;
    radius?: number;
    type?: string;
    keyword?: string;
  }): Promise<google.maps.places.PlaceResult[]> {
    if (!this.placesService) return [];

    // Text search
    if (request.query) {
      return new Promise((resolve, reject) => {
        const searchRequest: google.maps.places.TextSearchRequest = {
          query: request.query!,
          location: request.location,
          radius: request.radius || 5000,
        };

        this.placesService!.textSearch(searchRequest, (results, status) => {
          if (status === google.maps.places.PlacesServiceStatus.OK && results) {
            resolve(results);
          } else {
            logger.warn('Legacy Places text search failed, this API will be deprecated', { status, request: searchRequest });
            resolve([]);
          }
        });
      });
    }

    // Nearby search
    if (request.location) {
      return new Promise((resolve, reject) => {
        const nearbyRequest: google.maps.places.PlaceSearchRequest = {
          location: request.location!,
          radius: request.radius || 5000,
          type: request.type as any,
          keyword: request.keyword,
        };

        this.placesService!.nearbySearch(nearbyRequest, (results, status) => {
          if (status === google.maps.places.PlacesServiceStatus.OK && results) {
            resolve(results);
          } else {
            logger.warn('Legacy Places nearby search failed, this API will be deprecated', { status, request: nearbyRequest });
            resolve([]);
          }
        });
      });
    }

    return [];
  }

  /**
   * Get place details using modern Places API with legacy fallback
   */
  async getPlaceDetails(placeId: string): Promise<google.maps.places.PlaceResult | null> {
    if (!await this.initialize()) return null;

    try {
      // Try modern Places API first
      const { Place } = await google.maps.importLibrary('places') as any;
      
      if (Place) {
        try {
          const place = new Place({ id: placeId });
          await place.fetchFields({
            fields: [
              'id',
              'displayName',
              'formattedAddress',
              'location',
              'rating',
              'regularOpeningHours',
              'nationalPhoneNumber',
              'websiteURI',
              'photos',
              'reviews',
              'priceLevel',
              'types'
            ]
          });

          // Convert modern Place to legacy PlaceResult format for compatibility
          const result: google.maps.places.PlaceResult = {
            place_id: place.id,
            name: place.displayName,
            formatted_address: place.formattedAddress,
            geometry: {
              location: place.location
            },
            rating: place.rating,
            opening_hours: place.regularOpeningHours ? {
              isOpen: () => place.regularOpeningHours?.isOpen(),
              periods: place.regularOpeningHours.periods,
              weekday_text: place.regularOpeningHours.weekdayDescriptions
            } : undefined,
            formatted_phone_number: place.nationalPhoneNumber,
            website: place.websiteURI,
            photos: place.photos,
            reviews: place.reviews,
            price_level: place.priceLevel,
            types: place.types
          };

          logger.info('Modern Places API place details retrieved successfully');
          return result;
        } catch (error) {
          logger.warn('Modern Places API place details failed, falling back to legacy', error);
        }
      }
    } catch (error) {
      logger.warn('Failed to load modern Places API, using legacy', error);
    }

    // Fallback to legacy Places API
    if (!this.placesService) return null;

    return new Promise((resolve, reject) => {
      const request: google.maps.places.PlaceDetailsRequest = {
        placeId,
        fields: [
          'place_id',
          'name',
          'formatted_address',
          'geometry',
          'rating',
          'opening_hours',
          'formatted_phone_number',
          'website',
          'photos',
          'reviews',
          'price_level',
          'types',
        ],
      };

      this.placesService!.getDetails(request, (result, status) => {
        if (status === google.maps.places.PlacesServiceStatus.OK && result) {
          logger.info('Legacy Places API place details retrieved successfully');
          resolve(result);
        } else {
          logger.error('Place details request failed', { status, placeId });
          resolve(null);
        }
      });
    });
  }

  /**
   * Geocode address to coordinates
   */
  async geocodeAddress(address: string): Promise<google.maps.GeocoderResult[]> {
    if (!await this.initialize()) return [];
    if (!this.geocoder) return [];

    return new Promise((resolve, reject) => {
      this.geocoder!.geocode({ address }, (results, status) => {
        if (status === google.maps.GeocoderStatus.OK && results) {
          resolve(results);
        } else {
          logger.error('Geocoding failed', { status, address });
          resolve([]);
        }
      });
    });
  }

  /**
   * Reverse geocode coordinates to address
   */
  async reverseGeocode(location: google.maps.LatLng | google.maps.LatLngLiteral): Promise<google.maps.GeocoderResult[]> {
    if (!await this.initialize()) return [];
    if (!this.geocoder) return [];

    return new Promise((resolve, reject) => {
      this.geocoder!.geocode({ location }, (results, status) => {
        if (status === google.maps.GeocoderStatus.OK && results) {
          resolve(results);
        } else {
          logger.error('Reverse geocoding failed', { status, location });
          resolve([]);
        }
      });
    });
  }

  /**
   * Calculate distance between two points
   */
  calculateDistance(
    origin: google.maps.LatLng | google.maps.LatLngLiteral,
    destination: google.maps.LatLng | google.maps.LatLngLiteral
  ): number {
    if (!google.maps.geometry) return 0;

    const originLatLng = origin instanceof google.maps.LatLng ? origin : new google.maps.LatLng(origin.lat, origin.lng);
    const destLatLng = destination instanceof google.maps.LatLng ? destination : new google.maps.LatLng(destination.lat, destination.lng);

    return google.maps.geometry.spherical.computeDistanceBetween(originLatLng, destLatLng);
  }

  /**
   * Create marker on map (using AdvancedMarkerElement)
   */
  async createMarker(options: google.maps.MarkerOptions): Promise<google.maps.marker.AdvancedMarkerElement | google.maps.Marker | null> {
    if (!this.map) return null;

    try {
      // Import the marker library if not already available
      const { AdvancedMarkerElement } = await google.maps.importLibrary('marker') as any;
      
      if (AdvancedMarkerElement) {
        // Use modern AdvancedMarkerElement
        return new AdvancedMarkerElement({
          map: this.map,
          position: options.position,
          title: options.title,
          // Note: AdvancedMarkerElement uses different options than legacy Marker
          // Custom icons would be handled differently via content property
        });
      } else {
        // Fallback to legacy Marker
        logger.warn('AdvancedMarkerElement not available, using legacy Marker');
        return new google.maps.Marker({
          map: this.map,
          ...options,
        });
      }
    } catch (error) {
      logger.error('Failed to create marker, falling back to legacy Marker', error);
      // Fallback to legacy marker if AdvancedMarkerElement fails
      try {
        return new google.maps.Marker({
          map: this.map,
          ...options,
        });
      } catch (fallbackError) {
        logger.error('Failed to create fallback marker', fallbackError);
        return null;
      }
    }
  }

  /**
   * Create info window
   */
  createInfoWindow(options: google.maps.InfoWindowOptions): google.maps.InfoWindow {
    return new google.maps.InfoWindow(options);
  }

  /**
   * Add autocomplete to input element
   */
  createAutocomplete(input: HTMLInputElement, options?: google.maps.places.AutocompleteOptions): google.maps.places.Autocomplete | null {
    if (!this.isInitialized) return null;

    return new google.maps.places.Autocomplete(input, {
      types: ['establishment', 'geocode'],
      ...options,
    });
  }

  /**
   * Get current map instance
   */
  getMap(): google.maps.Map | null {
    return this.map;
  }

  /**
   * Check if Google Maps is available
   */
  isAvailable(): boolean {
    return this.isInitialized;
  }

  /**
   * Format distance for display
   */
  formatDistance(distanceMeters: number): string {
    if (distanceMeters < 1000) {
      return `${Math.round(distanceMeters)} m`;
    }
    return `${(distanceMeters / 1000).toFixed(1)} km`;
  }

  /**
   * Format duration for display
   */
  formatDuration(durationSeconds: number): string {
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
   * Convert Google Maps travel mode to app travel mode
   */
  convertTravelMode(googleMode: google.maps.TravelMode): 'driving' | 'walking' | 'transit' | 'cycling' {
    switch (googleMode) {
      case google.maps.TravelMode.DRIVING:
        return 'driving';
      case google.maps.TravelMode.WALKING:
        return 'walking';
      case google.maps.TravelMode.TRANSIT:
        return 'transit';
      case google.maps.TravelMode.BICYCLING:
        return 'cycling';
      default:
        return 'driving';
    }
  }

  /**
   * Convert app travel mode to Google Maps travel mode
   */
  convertToGoogleTravelMode(appMode: 'driving' | 'walking' | 'transit' | 'cycling'): google.maps.TravelMode {
    switch (appMode) {
      case 'driving':
        return google.maps.TravelMode.DRIVING;
      case 'walking':
        return google.maps.TravelMode.WALKING;
      case 'transit':
        return google.maps.TravelMode.TRANSIT;
      case 'cycling':
        return google.maps.TravelMode.BICYCLING;
      default:
        return google.maps.TravelMode.DRIVING;
    }
  }
}

export const googleMapsService = new GoogleMapsService();
export default googleMapsService;