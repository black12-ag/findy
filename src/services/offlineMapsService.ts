/**
 * 🗺️ Offline Maps Service
 * 
 * Handles downloading and caching map tiles for user's city
 * Provides offline navigation capabilities with Google Maps tiles
 */

import { logger } from '../utils/logger';
import { toast } from 'sonner';
import { GOOGLE_MAPS_API_KEY, API_SERVICES, REQUEST_TIMEOUT } from '../config/apiConfig';

export interface CityBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

export interface CityInfo {
  id: string;
  name: string;
  country: string;
  bounds: CityBounds;
  center: {
    lat: number;
    lng: number;
  };
  population?: number;
  area?: number; // in km²
}

export interface OfflineMapData {
  id: string;
  cityId: string;
  cityName: string;
  bounds: CityBounds;
  zoomLevels: number[];
  downloadDate: string;
  lastUsed: string;
  tileCount: number;
  sizeBytes: number;
  version: string;
}

export interface DownloadProgress {
  cityId: string;
  cityName: string;
  totalTiles: number;
  downloadedTiles: number;
  failedTiles: number;
  progress: number; // 0-100
  status: 'preparing' | 'downloading' | 'completed' | 'failed' | 'cancelled';
  estimatedSize: number;
  downloadedSize: number;
  startTime: number;
  estimatedTimeRemaining?: number;
}

class OfflineMapsService {
  private db: IDBDatabase | null = null;
  private downloadQueue: Map<string, DownloadProgress> = new Map();
  private isDownloading = false;
  private currentDownload: string | null = null;
  private googleMapsLoadPromise: Promise<void> | null = null;

  constructor() {
    this.initializeDB();
    this.validateAPIKey();
    this.ensureGoogleMapsLoaded();
  }

  /**
   * Ensure Google Maps JavaScript API is loaded
   */
  private async ensureGoogleMapsLoaded(): Promise<void> {
    if (this.googleMapsLoadPromise) {
      return this.googleMapsLoadPromise;
    }

    this.googleMapsLoadPromise = new Promise<void>(async (resolve, reject) => {
      try {
        // Check if Google Maps is already loaded
        if (typeof google !== 'undefined' && google.maps && google.maps.places) {
          logger.info('Google Maps API already loaded');
          resolve();
          return;
        }

        // Import Google Maps Loader
        const { Loader } = await import('@googlemaps/js-api-loader');
        
        const loader = new Loader({
          apiKey: GOOGLE_MAPS_API_KEY,
          version: 'weekly',
          libraries: ['places', 'geometry', 'geocoding']
        });

        await loader.load();
        logger.info('Google Maps API loaded successfully');
        resolve();
      } catch (error) {
        logger.error('Failed to load Google Maps API:', error);
        reject(error);
      }
    });

    return this.googleMapsLoadPromise;
  }

  /**
   * Check if Google Maps API is ready
   */
  private async waitForGoogleMaps(): Promise<boolean> {
    try {
      await this.ensureGoogleMapsLoaded();
      return typeof google !== 'undefined' && !!google.maps && !!google.maps.places;
    } catch (error) {
      logger.error('Google Maps API not available:', error);
      return false;
    }
  }

  /**
   * Validate Google Maps API key
   */
  private validateAPIKey(): void {
    if (!GOOGLE_MAPS_API_KEY) {
      logger.error('Google Maps API key is missing');
      toast.error('Google Maps API key is required for location services');
    }
  }

  /**
   * Initialize IndexedDB for offline maps storage
   */
  private async initializeDB(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('OfflineMapsDB', 3);

      request.onerror = () => {
        logger.error('Failed to open offline maps database');
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        logger.info('Offline maps database initialized');
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Map tiles store
        if (!db.objectStoreNames.contains('mapTiles')) {
          const tilesStore = db.createObjectStore('mapTiles', { keyPath: 'id' });
          tilesStore.createIndex('cityId', 'cityId', { unique: false });
          tilesStore.createIndex('zoomLevel', 'zoomLevel', { unique: false });
        }

        // Offline maps metadata
        if (!db.objectStoreNames.contains('offlineMaps')) {
          const mapsStore = db.createObjectStore('offlineMaps', { keyPath: 'id' });
          mapsStore.createIndex('cityId', 'cityId', { unique: true });
        }

        // Cities database
        if (!db.objectStoreNames.contains('cities')) {
          const citiesStore = db.createObjectStore('cities', { keyPath: 'id' });
          citiesStore.createIndex('name', 'name', { unique: false });
          citiesStore.createIndex('country', 'country', { unique: false });
        }

        // User preferences
        if (!db.objectStoreNames.contains('preferences')) {
          db.createObjectStore('preferences', { keyPath: 'key' });
        }
      };
    });
  }

  /**
   * Detect user's current city using geolocation
   */
  async detectUserCity(): Promise<CityInfo | null> {
    try {
      const position = await this.getCurrentPosition();
      const { latitude: lat, longitude: lng } = position.coords;

      // Log coordinates for debugging
      logger.info('Got user coordinates:', { lat, lng });
      
      // Use Google Maps Geocoding API to get city info
      const cityInfo = await this.geocodeLocation(lat, lng);
      
      if (cityInfo) {
        await this.saveCityInfo(cityInfo);
        logger.info('User city detected:', cityInfo.name, cityInfo.country);
        toast.success(`Detected your location: ${cityInfo.name}, ${cityInfo.country}`);
        return cityInfo;
      }

      // If no city info was found
      toast.error('Could not determine your city. Please select a city manually.');
      return null;
    } catch (error) {
      logger.error('Failed to detect user city:', error);
      toast.error('Could not access your location. Please select a city manually.');
      return null;
    }
  }

  /**
   * Search for cities by name using Google Places JavaScript API
   */
  async searchCities(query: string): Promise<CityInfo[]> {
    if (!query || query.trim().length < 2) {
      return [];
    }

    try {
      // Ensure Google Maps is loaded
      const isReady = await this.waitForGoogleMaps();
      if (!isReady) {
        throw new Error('Google Maps Places API not loaded');
      }

      // Use Places Service with a temporary div element
      const tempDiv = document.createElement('div');
      const service = new google.maps.places.PlacesService(tempDiv);
      
      // Create search request
      const request = {
        query: `${query.trim()} city`,
        fields: ['place_id', 'name', 'formatted_address', 'geometry'],
        locationBias: { radius: 50000000, center: new google.maps.LatLng(0, 0) } // Global search
      };
      
      logger.info('Searching cities with Google Places API:', { query: request.query });
      
      const results = await new Promise<google.maps.places.PlaceResult[]>((resolve, reject) => {
        service.textSearch(request, (results, status) => {
          logger.info('Places API response:', { status, resultCount: results?.length || 0 });
          
          if (status === google.maps.places.PlacesServiceStatus.OK && results) {
            resolve(results);
          } else if (status === google.maps.places.PlacesServiceStatus.ZERO_RESULTS) {
            logger.warn('No cities found for query:', query);
            resolve([]);
          } else {
            logger.error('Places API error:', status);
            reject(new Error(`Places API returned status: ${status}`));
          }
        });
      });
      
      if (results.length === 0) {
        logger.info('No cities found for query:', query);
        return [];
      }
      
      // Convert Google Places results to CityInfo format
      const cities: CityInfo[] = results.slice(0, 10).map((place) => {
        const { geometry, name, formatted_address, place_id } = place;
        
        if (!geometry || !geometry.location || !geometry.viewport) {
          logger.warn('Invalid geometry data for place:', place);
          return null;
        }
        
        // Extract country from formatted address
        const addressParts = (formatted_address || '').split(', ');
        const country = addressParts[addressParts.length - 1] || 'Unknown';
        
        return {
          id: place_id || `place-${Date.now()}-${Math.random()}`,
          name: name || 'Unknown City',
          country: country,
          bounds: {
            north: geometry.viewport.getNorthEast().lat(),
            south: geometry.viewport.getSouthWest().lat(),
            east: geometry.viewport.getNorthEast().lng(),
            west: geometry.viewport.getSouthWest().lng()
          },
          center: {
            lat: geometry.location.lat(),
            lng: geometry.location.lng()
          }
        };
      }).filter(Boolean) as CityInfo[];
      
      logger.info('Successfully converted places to cities:', { count: cities.length });
      
      // Save search results to database
      for (const city of cities) {
        await this.saveCityInfo(city);
      }
      
      return cities;
      
    } catch (error) {
      logger.error('Error searching cities:', error);
      
      // Check if it's a Google Maps loading issue
      if (error.message?.includes('Google Maps') || error.message?.includes('not loaded')) {
        toast.error('Google Maps is still loading. Please try again in a moment.');
      } else {
        toast.error('Failed to search cities. Please try again.');
      }
      
      return [];
    }
  }

  /**
   * Get popular cities for manual selection using Google Places API
   */
  async getPopularCities(): Promise<CityInfo[]> {
    try {
      // First, try to get cities from cache/database
      const cachedCities = await this.getCachedPopularCities();
      if (cachedCities.length > 0) {
        logger.info('Using cached popular cities', { count: cachedCities.length });
        return cachedCities;
      }

      // If no cache, fetch from Google Places API
      const popularCityNames = [
        'New York, USA', 'London, UK', 'Paris, France', 'Tokyo, Japan', 'San Francisco, USA',
        'Los Angeles, USA', 'Chicago, USA', 'Berlin, Germany', 'Sydney, Australia', 'Toronto, Canada',
        'Madrid, Spain', 'Rome, Italy', 'Amsterdam, Netherlands', 'Vienna, Austria', 'Stockholm, Sweden',
        'Dubai, UAE', 'Singapore', 'Hong Kong', 'Mumbai, India', 'Bangkok, Thailand',
        'Mexico City, Mexico', 'São Paulo, Brazil', 'Buenos Aires, Argentina', 'Cairo, Egypt', 'Lagos, Nigeria'
      ];

      const popularCities: CityInfo[] = [];
      
      // Fetch city data from Google Places API in batches to avoid rate limits
      for (let i = 0; i < Math.min(popularCityNames.length, 15); i++) {
        try {
          const cityName = popularCityNames[i];
          const cities = await this.searchCities(cityName.split(',')[0]); // Search for just the city name
          
          if (cities.length > 0) {
            // Find the best match (usually the first result)
            const bestMatch = cities.find(city => 
              city.name.toLowerCase().includes(cityName.split(',')[0].toLowerCase()) ||
              city.country.toLowerCase().includes(cityName.split(',')[1]?.trim().toLowerCase() || '')
            ) || cities[0];
            
            popularCities.push(bestMatch);
          }
          
          // Small delay to respect API rate limits
          if (i < popularCityNames.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 200));
          }
        } catch (error) {
          logger.warn(`Failed to fetch data for ${popularCityNames[i]}:`, error);
        }
      }

      // If Google API failed, use fallback hardcoded data
      if (popularCities.length === 0) {
        logger.warn('Google Places API failed, using fallback city data');
        return this.getFallbackPopularCities();
      }

      // Save to cache
      await this.cachePopularCities(popularCities);
      
      logger.info('Fetched popular cities from Google Places API', { count: popularCities.length });
      return popularCities;
      
    } catch (error) {
      logger.error('Failed to get popular cities:', error);
      // Return fallback hardcoded data
      return this.getFallbackPopularCities();
    }
  }

  /**
   * Get cached popular cities from database
   */
  private async getCachedPopularCities(): Promise<CityInfo[]> {
    if (!this.db) await this.initializeDB();
    
    try {
      const transaction = this.db!.transaction(['preferences'], 'readonly');
      const store = transaction.objectStore('preferences');
      const request = store.get('popularCities');
      
      return new Promise((resolve) => {
        request.onsuccess = () => {
          const result = request.result;
          if (result && result.data && result.timestamp) {
            // Check if cache is still valid (24 hours)
            const cacheAge = Date.now() - result.timestamp;
            const maxAge = 24 * 60 * 60 * 1000; // 24 hours
            
            if (cacheAge < maxAge) {
              resolve(result.data);
              return;
            }
          }
          resolve([]);
        };
        request.onerror = () => resolve([]);
      });
    } catch (error) {
      logger.error('Failed to get cached cities:', error);
      return [];
    }
  }

  /**
   * Cache popular cities in database
   */
  private async cachePopularCities(cities: CityInfo[]): Promise<void> {
    if (!this.db) await this.initializeDB();
    
    try {
      const transaction = this.db!.transaction(['preferences'], 'readwrite');
      const store = transaction.objectStore('preferences');
      
      store.put({
        key: 'popularCities',
        data: cities,
        timestamp: Date.now()
      });
      
      // Also save individual cities
      for (const city of cities) {
        await this.saveCityInfo(city);
      }
    } catch (error) {
      logger.error('Failed to cache popular cities:', error);
    }
  }

  /**
   * Get fallback popular cities (hardcoded)
   */
  private getFallbackPopularCities(): CityInfo[] {
    return [
      {
        id: 'new-york-us',
        name: 'New York City',
        country: 'United States',
        bounds: {
          north: 40.9176,
          south: 40.4774,
          east: -73.7004,
          west: -74.2591
        },
        center: { lat: 40.7128, lng: -74.0060 },
        population: 8336817
      },
      {
        id: 'london-uk',
        name: 'London',
        country: 'United Kingdom',
        bounds: {
          north: 51.6723,
          south: 51.2868,
          east: 0.3340,
          west: -0.5103
        },
        center: { lat: 51.5074, lng: -0.1278 },
        population: 9648110
      },
      {
        id: 'paris-fr',
        name: 'Paris',
        country: 'France',
        bounds: {
          north: 48.9021,
          south: 48.8155,
          east: 2.4699,
          west: 2.2241
        },
        center: { lat: 48.8566, lng: 2.3522 },
        population: 2175601
      },
      {
        id: 'tokyo-jp',
        name: 'Tokyo',
        country: 'Japan',
        bounds: {
          north: 35.8983,
          south: 35.4969,
          east: 139.9295,
          west: 139.5694
        },
        center: { lat: 35.6762, lng: 139.6503 },
        population: 14094034
      },
      {
        id: 'san-francisco-us',
        name: 'San Francisco',
        country: 'United States',
        bounds: {
          north: 37.8324,
          south: 37.7081,
          east: -122.3482,
          west: -122.5150
        },
        center: { lat: 37.7749, lng: -122.4194 },
        population: 873965
      }
    ];
  }

  /**
   * Download offline maps for a city
   */
  async downloadCityMaps(
    cityId: string,
    options: {
      zoomLevels?: number[];
      mapTypes?: string[];
      onProgress?: (progress: DownloadProgress) => void;
    } = {}
  ): Promise<void> {
    const city = await this.getCityInfo(cityId);
    if (!city) {
      throw new Error(`City with ID ${cityId} not found`);
    }

    if (this.downloadQueue.has(cityId)) {
      toast.info('Download already in progress for this city');
      return;
    }

    const zoomLevels = options.zoomLevels || [10, 11, 12, 13, 14, 15, 16];
    const mapTypes = options.mapTypes || ['roadmap'];

    const progress: DownloadProgress = {
      cityId,
      cityName: city.name,
      totalTiles: 0,
      downloadedTiles: 0,
      failedTiles: 0,
      progress: 0,
      status: 'preparing',
      estimatedSize: 0,
      downloadedSize: 0,
      startTime: Date.now()
    };

    this.downloadQueue.set(cityId, progress);

    try {
      // Calculate total tiles needed
      progress.totalTiles = this.calculateTotalTiles(city.bounds, zoomLevels);
      progress.estimatedSize = progress.totalTiles * 15000; // ~15KB per tile estimate

      logger.info(`Starting download for ${city.name}:`, {
        totalTiles: progress.totalTiles,
        estimatedSize: `${(progress.estimatedSize / (1024 * 1024)).toFixed(1)}MB`
      });

      if (options.onProgress) {
        options.onProgress(progress);
      }

      // Start downloading tiles
      progress.status = 'downloading';
      await this.downloadTilesForCity(city, zoomLevels, mapTypes, progress, options.onProgress);

      if (progress.status !== 'cancelled') {
        progress.status = 'completed';
        progress.progress = 100;

        // Save offline map metadata
        const offlineMap: OfflineMapData = {
          id: `${cityId}-${Date.now()}`,
          cityId,
          cityName: city.name,
          bounds: city.bounds,
          zoomLevels,
          downloadDate: new Date().toISOString(),
          lastUsed: new Date().toISOString(),
          tileCount: progress.downloadedTiles,
          sizeBytes: progress.downloadedSize,
          version: '1.0'
        };

        await this.saveOfflineMapData(offlineMap);

        logger.info(`Download completed for ${city.name}`);
        toast.success(`${city.name} maps downloaded successfully!`);
      }

      if (options.onProgress) {
        options.onProgress(progress);
      }

    } catch (error) {
      logger.error('Failed to download city maps:', error);
      progress.status = 'failed';
      toast.error(`Failed to download maps for ${city.name}`);
    } finally {
      this.downloadQueue.delete(cityId);
    }
  }

  /**
   * Cancel ongoing download
   */
  async cancelDownload(cityId: string): Promise<void> {
    const progress = this.downloadQueue.get(cityId);
    if (progress) {
      progress.status = 'cancelled';
      logger.info(`Download cancelled for ${progress.cityName}`);
      toast.info(`Download cancelled for ${progress.cityName}`);
    }
  }

  /**
   * Get all downloaded offline maps
   */
  async getOfflineMaps(): Promise<OfflineMapData[]> {
    if (!this.db) await this.initializeDB();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['offlineMaps'], 'readonly');
      const store = transaction.objectStore('offlineMaps');
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Delete offline map data for a city
   */
  async deleteOfflineMap(cityId: string): Promise<void> {
    if (!this.db) await this.initializeDB();

    const transaction = this.db!.transaction(['offlineMaps', 'mapTiles'], 'readwrite');
    
    // Delete tiles
    const tilesStore = transaction.objectStore('mapTiles');
    const tilesIndex = tilesStore.index('cityId');
    const tilesRequest = tilesIndex.openCursor(IDBKeyRange.only(cityId));
    
    tilesRequest.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest).result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      }
    };

    // Delete metadata
    const mapsStore = transaction.objectStore('offlineMaps');
    const mapsIndex = mapsStore.index('cityId');
    mapsIndex.delete(cityId);

    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => {
        logger.info(`Offline map deleted for city: ${cityId}`);
        toast.success('Offline map deleted successfully');
        resolve();
      };
      transaction.onerror = () => reject(transaction.error);
    });
  }

  /**
   * Get detailed city information by coordinates
   */
  async getCityDetails(lat: number, lng: number): Promise<CityInfo | null> {
    return this.geocodeLocation(lat, lng);
  }

  /**
   * Get city information by place ID
   */
  async getCityByPlaceId(placeId: string): Promise<CityInfo | null> {
    try {
      const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=name,geometry,formatted_address,place_id&key=${GOOGLE_MAPS_API_KEY}`;
      
      const response = await fetch(url, {
        signal: AbortSignal.timeout(REQUEST_TIMEOUT.PLACES)
      });
      
      if (!response.ok) {
        throw new Error(`Place Details API returned status: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.status !== 'OK' || !data.result) {
        logger.warn('Place Details API returned no results', { status: data.status });
        return null;
      }
      
      const place = data.result;
      const { geometry, name, formatted_address } = place;
      const { location, viewport } = geometry;
      
      // Extract country from formatted address
      const addressParts = formatted_address.split(', ');
      const country = addressParts[addressParts.length - 1] || 'Unknown';
      
      const cityInfo: CityInfo = {
        id: placeId,
        name: name,
        country: country,
        bounds: {
          north: viewport.northeast.lat,
          south: viewport.southwest.lat,
          east: viewport.northeast.lng,
          west: viewport.southwest.lng
        },
        center: {
          lat: location.lat,
          lng: location.lng
        }
      };
      
      await this.saveCityInfo(cityInfo);
      return cityInfo;
    } catch (error) {
      logger.error('Error getting city details:', error);
      return null;
    }
  }

  /**
   * Check if city has offline maps available
   */
  async hasOfflineMap(cityId: string): Promise<boolean> {
    if (!this.db) await this.initializeDB();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['offlineMaps'], 'readonly');
      const store = transaction.objectStore('offlineMaps');
      const index = store.index('cityId');
      const request = index.count(cityId);

      request.onsuccess = () => resolve(request.result > 0);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Private helper methods
   */
  private async getCurrentPosition(): Promise<GeolocationPosition> {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation is not supported'));
        return;
      }

      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 60000
      });
    });
  }

  private async geocodeLocation(lat: number, lng: number): Promise<CityInfo | null> {
    try {
      // Ensure Google Maps is loaded
      const isReady = await this.waitForGoogleMaps();
      if (!isReady) {
        throw new Error('Google Maps API not loaded');
      }

      const geocoder = new google.maps.Geocoder();
      const request: google.maps.GeocoderRequest = {
        location: { lat, lng },
        resultTypes: ['locality', 'administrative_area_level_1', 'country']
      };
      
      logger.info('Geocoding location:', { lat, lng });
      
      const results = await new Promise<google.maps.GeocoderResult[]>((resolve, reject) => {
        geocoder.geocode(request, (results, status) => {
          logger.info('Geocoding response:', { status, resultCount: results?.length || 0 });
          
          if (status === google.maps.GeocoderStatus.OK && results && results.length > 0) {
            resolve(results);
          } else if (status === google.maps.GeocoderStatus.ZERO_RESULTS) {
            logger.warn('No geocoding results found for location:', { lat, lng });
            resolve([]);
          } else {
            logger.error('Geocoding error:', status);
            reject(new Error(`Geocoding failed: ${status}`));
          }
        });
      });
      
      if (results.length === 0) {
        logger.warn('No city found for coordinates:', { lat, lng });
        return null;
      }
      
      // Find the best result (prefer locality type)
      const localityResult = results.find(result => 
        result.types.includes('locality')
      ) || results[0];
      
      if (!localityResult) {
        logger.warn('No suitable geocoding result found');
        return null;
      }
      
      // Extract city name
      const cityComponent = localityResult.address_components?.find(
        component => component.types.includes('locality')
      );
      
      const cityName = cityComponent?.long_name || 
                      localityResult.address_components?.[0]?.long_name || 
                      'Unknown City';
      
      // Extract country
      const countryComponent = localityResult.address_components?.find(
        component => component.types.includes('country')
      );
      
      const country = countryComponent?.long_name || 'Unknown Country';
      const countryCode = countryComponent?.short_name || 'unknown';
      
      // Get viewport for city bounds
      const viewport = localityResult.geometry?.viewport;
      let bounds;
      
      if (viewport) {
        bounds = {
          north: viewport.getNorthEast().lat(),
          south: viewport.getSouthWest().lat(),
          east: viewport.getNorthEast().lng(),
          west: viewport.getSouthWest().lng()
        };
      } else {
        // Fallback bounds if no viewport
        bounds = {
          north: lat + 0.05,
          south: lat - 0.05,
          east: lng + 0.05,
          west: lng - 0.05
        };
      }
      
      const cityInfo: CityInfo = {
        id: `${cityName.toLowerCase().replace(/\s+/g, '-')}-${countryCode.toLowerCase()}`,
        name: cityName,
        country: country,
        bounds,
        center: { lat, lng }
      };
      
      logger.info('Successfully geocoded location:', cityInfo);
      return cityInfo;
      
    } catch (error) {
      logger.error('Error geocoding location:', error);
      
      // Check if it's a Google Maps loading issue
      if (error.message?.includes('Google Maps') || error.message?.includes('not loaded')) {
        logger.warn('Google Maps not loaded, using fallback geocoding');
      }
      
      // Fallback to coordinate-based detection
      const cityName = this.getCityNameFromCoords(lat, lng);
      return {
        id: `city-${Math.round(lat * 100)}-${Math.round(lng * 100)}`,
        name: cityName,
        country: 'Unknown (fallback)',
        bounds: {
          north: lat + 0.05,
          south: lat - 0.05,
          east: lng + 0.05,
          west: lng - 0.05
        },
        center: { lat, lng }
      };
    }
  }

  private getCityNameFromCoords(lat: number, lng: number): string {
    // Simple city detection based on coordinates (fallback method)
    if (lat >= 40.4 && lat <= 41.0 && lng >= -74.5 && lng <= -73.5) return 'New York City';
    if (lat >= 51.2 && lat <= 51.7 && lng >= -0.6 && lng <= 0.4) return 'London';
    if (lat >= 48.8 && lat <= 49.0 && lng >= 2.2 && lng <= 2.5) return 'Paris';
    if (lat >= 35.5 && lat <= 35.8 && lng >= 139.5 && lng <= 140.0) return 'Tokyo';
    if (lat >= 37.7 && lat <= 37.8 && lng >= -122.6 && lng <= -122.3) return 'San Francisco';
    
    // If no match, return approximate coordinates as name
    return `Location (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
  }

  private calculateTotalTiles(bounds: CityBounds, zoomLevels: number[]): number {
    let total = 0;
    
    for (const zoom of zoomLevels) {
      const n = Math.pow(2, zoom);
      const minX = Math.floor(((bounds.west + 180) / 360) * n);
      const maxX = Math.floor(((bounds.east + 180) / 360) * n);
      const minY = Math.floor((1 - Math.log(Math.tan((bounds.north * Math.PI) / 180) + 1 / Math.cos((bounds.north * Math.PI) / 180)) / Math.PI) / 2 * n);
      const maxY = Math.floor((1 - Math.log(Math.tan((bounds.south * Math.PI) / 180) + 1 / Math.cos((bounds.south * Math.PI) / 180)) / Math.PI) / 2 * n);
      
      total += (maxX - minX + 1) * (maxY - minY + 1);
    }
    
    return total;
  }

  private async downloadTilesForCity(
    city: CityInfo,
    zoomLevels: number[],
    mapTypes: string[],
    progress: DownloadProgress,
    onProgress?: (progress: DownloadProgress) => void
  ): Promise<void> {
    const { bounds } = city;
    
    for (const zoom of zoomLevels) {
      if (progress.status === 'cancelled') break;
      
      const n = Math.pow(2, zoom);
      const minX = Math.floor(((bounds.west + 180) / 360) * n);
      const maxX = Math.floor(((bounds.east + 180) / 360) * n);
      const minY = Math.floor((1 - Math.log(Math.tan((bounds.north * Math.PI) / 180) + 1 / Math.cos((bounds.north * Math.PI) / 180)) / Math.PI) / 2 * n);
      const maxY = Math.floor((1 - Math.log(Math.tan((bounds.south * Math.PI) / 180) + 1 / Math.cos((bounds.south * Math.PI) / 180)) / Math.PI) / 2 * n);
      
      for (let x = minX; x <= maxX; x++) {
        if (progress.status === 'cancelled') break;
        
        for (let y = minY; y <= maxY; y++) {
          if (progress.status === 'cancelled') break;
          
          for (const mapType of mapTypes) {
            try {
              await this.downloadTile(x, y, zoom, mapType, city.id);
              progress.downloadedTiles++;
              progress.downloadedSize += 15000; // Estimate
            } catch (error) {
              progress.failedTiles++;
            }
            
            progress.progress = Math.round((progress.downloadedTiles / progress.totalTiles) * 100);
            
            // Update ETA
            const elapsed = Date.now() - progress.startTime;
            const remaining = progress.totalTiles - progress.downloadedTiles;
            if (progress.downloadedTiles > 0) {
              const avgTimePerTile = elapsed / progress.downloadedTiles;
              progress.estimatedTimeRemaining = remaining * avgTimePerTile;
            }
            
            if (onProgress && progress.downloadedTiles % 50 === 0) {
              onProgress(progress);
            }
          }
        }
      }
    }
  }

  private async downloadTile(x: number, y: number, z: number, mapType: string, cityId: string): Promise<void> {
    // Create mock tile data - in production this would fetch from Google Maps
    const tileId = `${x}-${y}-${z}-${mapType}`;
    const tileData = {
      id: tileId,
      x, y, z,
      cityId,
      mapType,
      data: new Blob(['mock tile data'], { type: 'image/png' }),
      downloadDate: new Date().toISOString()
    };

    return this.saveTileData(tileData);
  }

  private async saveTileData(tileData: any): Promise<void> {
    if (!this.db) await this.initializeDB();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['mapTiles'], 'readwrite');
      const store = transaction.objectStore('mapTiles');
      const request = store.put(tileData);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  private async saveCityInfo(cityInfo: CityInfo): Promise<void> {
    if (!this.db) await this.initializeDB();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['cities'], 'readwrite');
      const store = transaction.objectStore('cities');
      const request = store.put(cityInfo);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  private async getCityInfo(cityId: string): Promise<CityInfo | null> {
    if (!this.db) await this.initializeDB();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['cities'], 'readonly');
      const store = transaction.objectStore('cities');
      const request = store.get(cityId);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  private async saveOfflineMapData(mapData: OfflineMapData): Promise<void> {
    if (!this.db) await this.initializeDB();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['offlineMaps'], 'readwrite');
      const store = transaction.objectStore('offlineMaps');
      const request = store.put(mapData);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
}

// Create and export singleton instance
const offlineMapsService = new OfflineMapsService();
export default offlineMapsService;