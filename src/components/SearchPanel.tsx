import React, { useState, useEffect } from 'react';
import { Search, MapPin, Clock, Star, Navigation, ArrowLeft, Mic, QrCode, Camera, Filter, Accessibility } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from './ui/sheet';
import { Switch } from './ui/switch';
import { Slider } from './ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { ORSGeocodingService, setORSApiKey } from '../services/googleUnifiedService';
import placesService from '../services/places';
import { logger } from '../utils/logger';
import { searchQuerySchema, validateForm } from '../utils/validation';
import { toast } from 'sonner';
import { useLoadingState } from '../contexts/LoadingContext';

// Helper function to get current location
const getCurrentLocation = (): Promise<{ lat: number; lng: number } | null> => {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve(null);
      return;
    }
    
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude
        });
      },
      () => resolve(null),
      { timeout: 5000 }
    );
  });
};

interface Location {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  category?: string;
}

interface SearchPanelProps {
  query: string;
  onSearch: (query: string) => void;
  onLocationSelect: (location: Location) => void;
  transportMode: string;
  onBack: () => void;
  onOpenVoicePanel: () => void;
}

export function SearchPanel({ query, onSearch, onLocationSelect, transportMode, onBack, onOpenVoicePanel }: SearchPanelProps) {
  const [searchInput, setSearchInput] = useState(query);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const { isLoading, startLoading, stopLoading } = useLoadingState('search');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [recentSearches, setRecentSearches] = useState<Location[]>([]);
  const [filters, setFilters] = useState({
    openNow: false,
    rating: 0,
    priceRange: [1, 4],
    distance: 10,
    accessibility: false
  });

  // Initialize ORS API key
  useEffect(() => {
    const apiKey = import.meta.env.VITE_ORS_API_KEY || localStorage.getItem('ors_api_key');
    if (apiKey) {
      setORSApiKey(apiKey);
      logger.debug('ORS API key configured');
    } else {
      // In development mode, show a helpful message
      if (process.env.NODE_ENV === 'development') {
        logger.info('ORS API key not configured - using fallback data for development');
        // Set a placeholder key to prevent initialization errors
        setORSApiKey('development-fallback-key');
      }
    }
    loadRecentSearches();
  }, []);

  // Load recent searches from localStorage
  const loadRecentSearches = () => {
    const saved = localStorage.getItem('recent_searches');
    if (saved) {
      setRecentSearches(JSON.parse(saved));
    }
  };

  // Save search to recent searches
  const saveToRecentSearches = (location: Location) => {
    const updated = [location, ...recentSearches.filter(r => r.id !== location.id)].slice(0, 5);
    setRecentSearches(updated);
    localStorage.setItem('recent_searches', JSON.stringify(updated));
  };

  // Calculate distance between two points (Haversine formula)
  const calculateDistance = (point1: { lat: number; lng: number }, point2: { lat: number; lng: number }): string => {
    const R = 6371; // Earth's radius in km
    const dLat = (point2.lat - point1.lat) * Math.PI / 180;
    const dLng = (point2.lng - point1.lng) * Math.PI / 180;
    
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(point1.lat * Math.PI / 180) * Math.cos(point2.lat * Math.PI / 180) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;
    
    if (distance < 1) {
      return `${Math.round(distance * 1000)}m`;
    }
    return `${distance.toFixed(1)}km`;
  };

  // Parse opening hours from OSM format
  const parseOpeningHours = (openingHours: string | undefined): boolean | undefined => {
    if (!openingHours) return undefined;
    
    // Simple parsing for common formats
    const now = new Date();
    const currentHour = now.getHours();
    
    // Handle 24/7
    if (openingHours.includes('24/7')) return true;
    
    // Handle basic hour ranges (e.g., "09:00-17:00")
    const hourMatch = openingHours.match(/(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})/);
    if (hourMatch) {
      const openHour = parseInt(hourMatch[1]);
      const closeHour = parseInt(hourMatch[3]);
      return currentHour >= openHour && currentHour < closeHour;
    }
    
    // Default to undefined if can't parse
    return undefined;
  };

  // Search function using ORS API only
  const performSearch = async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setSearchError('Search query cannot be empty');
      setSearchResults([]);
      return;
    }

    // Validate search query
    const validationResult = validateForm({ query: searchQuery }, searchQuerySchema);
    if (!validationResult.isValid) {
      const errorMessage = Object.values(validationResult.errors)[0];
      setSearchError(errorMessage);
      toast.error(errorMessage);
      return;
    }

    setSearchError(null);

    startLoading();
    
    // Check if ORS API key is available
    const hasAPIKey = import.meta.env?.VITE_ORS_API_KEY || localStorage.getItem('ors_api_key');
    if (!hasAPIKey) {
      logger.warn('Missing ORS API key - search results unavailable');
      setSearchResults([]);
      stopLoading();
      return;
    }
    
    if (hasAPIKey) {
      // Try ORS API first
      try {
        const results = await ORSGeocodingService.search(searchQuery, {
          limit: 20,
          countryCode: 'US'
        });

        const formattedResults = results.map(result => ({
          id: result.place_id,
          name: result.display_name.split(',')[0],
          address: result.display_name,
          lat: result.lat,
          lng: result.lon,
          category: result.class,
          // Remove mock data - these should come from real APIs or be optional
          rating: undefined,
          distance: undefined,
          priceLevel: undefined,
          openNow: undefined,
          accessible: undefined
        }));

        setSearchResults(formattedResults);
        stopLoading();
        return;
      } catch (error) {
        logger.info('Google geocoding completed, using unified Google service', { query: searchQuery });
        // Continue with Google Places API results
      }
    }
  };

  // Handle search input changes with debouncing
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (searchInput.trim()) {
        performSearch(searchInput);
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [searchInput]);

  // Handle search submission
  const handleSearchSubmit = () => {
    if (!searchInput.trim()) {
      setSearchError('Search query cannot be empty');
      toast.error('Please enter a search query');
      return;
    }

    // Validate search query
    const validationResult = validateForm({ query: searchInput }, searchQuerySchema);
    if (!validationResult.isValid) {
      const errorMessage = Object.values(validationResult.errors)[0];
      setSearchError(errorMessage);
      toast.error(errorMessage);
      return;
    }

    setSearchError(null);
    performSearch(searchInput);
    onSearch(searchInput);
  };

  // Handle category button clicks using enhanced places service
  const handleCategoryClick = async (categoryId: string) => {
    startLoading();
    
    try {
      // Get current location or use default
      const currentLocation = await getCurrentLocation() || { lat: 37.7749, lng: -122.4194 };
      
      // Use enhanced places service (Google Maps with ORS fallback)
      const places = await placesService.searchPlacesEnhanced(
        currentLocation,
        undefined, // no query, just category
        categoryId,
        5000 // 5km radius
      );

      // Format places from the enhanced places service
      const formattedPOIs = places.map(place => ({
        id: place.id || place.place_id || `${categoryId}_${Date.now()}`,
        name: place.name || `${categoryId} location`,
        address: place.address || place.formatted_address || 'Address not available',
        lat: place.location?.lat || place.lat,
        lng: place.location?.lng || place.lng,
        category: categoryId,
        rating: place.rating,
        distance: place.location ? calculateDistance(currentLocation, place.location) : undefined,
        priceLevel: place.price_level,
        openNow: place.opening_hours?.open_now,
        accessible: place.wheelchair_accessible_entrance
      }));

      setSearchResults(formattedPOIs);
    } catch (error) {
      logger.warn('ORS POI search failed', { error, category: categoryId });
      setSearchResults([]);
    } finally {
      stopLoading();
    }
  };

  const categories = [
    { id: 'restaurants', name: 'Restaurants', icon: '🍽️' },
    { id: 'gas_stations', name: 'Gas Stations', icon: '⛽' },
    { id: 'parking', name: 'Parking', icon: '🅿️' },
    { id: 'banks', name: 'ATMs', icon: '💵' },
    { id: 'hospitals', name: 'Hospitals', icon: '🏥' },
    { id: 'shopping', name: 'Shopping', icon: '🛍️' },
    { id: 'hotels', name: 'Hotels', icon: '🏨' },
    { id: 'entertainment', name: 'Entertainment', icon: '🎭' },
  ];

  const getCategoryIcon = (category: string) => {
    const categoryMap: Record<string, string> = {
      restaurants: '🍽️',
      gas_stations: '⛽',
      parking: '🅿️',
      banks: '💵',
      hospitals: '🏥',
      shopping: '🛍️',
      hotels: '🏨',
      entertainment: '🎭',
    };
    return categoryMap[category] || '📍';
  };

  const handleLocationSelect = (location: any) => {
    const formattedLocation: Location = {
      id: location.id,
      name: location.name,
      address: location.address,
      lat: location.lat,
      lng: location.lng,
      category: location.category
    };
    
    saveToRecentSearches(formattedLocation);
    onLocationSelect(formattedLocation);
  };

  return (
    <div className="h-full bg-white flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 bg-white px-4 py-4 border-b border-gray-200">
        <div className="flex items-center gap-3 mb-4">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h2 className="font-medium text-gray-900">Search</h2>
            <p className="text-sm text-gray-500">Find places and addresses</p>
          </div>
        </div>

        {/* Search Input */}
        <div className="relative">
          <Input
            value={searchInput}
            onChange={(e) => {
              setSearchInput(e.target.value);
              if (searchError) setSearchError(null); // Clear error on typing
            }}
            placeholder="Search for places, addresses..."
            className={`pl-10 pr-20 ${searchError ? 'border-red-300 focus:border-red-500' : ''}`}
            onKeyPress={(e) => e.key === 'Enter' && handleSearchSubmit()}
            autoFocus
          />
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <div className="absolute right-1 top-1/2 transform -translate-y-1/2 flex gap-1">
            <Button variant="ghost" size="icon" className="w-8 h-8" onClick={onOpenVoicePanel}>
              <Mic className="w-4 h-4" />
            </Button>
          </div>
          {searchError && (
            <p className="text-red-600 text-sm mt-1">{searchError}</p>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scroll-y hide-scrollbar scroll-smooth">
        {/* Quick Categories */}
        <div className="px-4 py-4 border-b border-gray-100">
          <h3 className="font-medium text-gray-900 mb-3">Quick Search</h3>
          <div className="grid grid-cols-3 gap-3">
            {categories.map((category) => (
              <button
                key={category.id}
                className="flex flex-col items-center p-3 rounded-lg hover:bg-gray-50 transition-colors"
                onClick={() => handleCategoryClick(category.id)}
              >
                <span className="text-2xl mb-1">{category.icon}</span>
                <span className="text-xs text-gray-700 text-center">{category.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="px-4 py-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="text-gray-600 mt-2">Searching with OpenRouteService...</p>
          </div>
        )}

        {/* Recent Searches */}
        {!isLoading && searchResults.length === 0 && recentSearches.length > 0 && (
          <div className="px-4 py-4">
            <h3 className="font-medium text-gray-900 mb-3">Recent Searches</h3>
            <div className="space-y-3">
              {recentSearches.map((place) => (
                <div
                  key={place.id}
                  className="flex items-center gap-4 p-3 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => handleLocationSelect(place)}
                >
                  <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                    <Clock className="w-5 h-5 text-gray-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-gray-900 truncate">{place.name}</h4>
                    <p className="text-sm text-gray-600 truncate">{place.address}</p>
                  </div>
                  <Navigation className="w-4 h-4 text-gray-400" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Search Results */}
        {searchResults.length > 0 && (
          <div className="px-4 py-4">
            <h3 className="font-medium text-gray-900 mb-3">Search Results ({searchResults.length})</h3>
            <div className="space-y-3">
              {searchResults.map((place) => (
                <div
                  key={place.id}
                  className="flex items-center gap-4 p-3 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => handleLocationSelect(place)}
                >
                  <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                    <span className="text-lg">{getCategoryIcon(place.category)}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-gray-900 truncate">{place.name}</h4>
                    <p className="text-sm text-gray-600 truncate">{place.address}</p>
                    <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                      {place.rating && (
                        <div className="flex items-center gap-1">
                          <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                          <span>{place.rating.toFixed(1)}</span>
                        </div>
                      )}
                      <span className="w-1 h-1 bg-gray-300 rounded-full" />
                      <span className="text-xs text-gray-600">{place.distance}</span>
                      {place.accessible && (
                        <Accessibility className="w-3 h-3 text-blue-500" />
                      )}
                    </div>
                  </div>
                  <Navigation className="w-4 h-4 text-gray-400" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* No Results */}
        {!isLoading && searchResults.length === 0 && searchInput.trim() && (
          <div className="px-4 py-8 text-center">
            <MapPin className="w-12 h-12 text-gray-400 mx-auto mb-2" />
            <p className="text-gray-600">No results found for "{searchInput}"</p>
            <p className="text-sm text-gray-500 mt-1">Try a different search term</p>
          </div>
        )}
      </div>
    </div>
  );
}
