import React, { useState, useEffect, useRef } from 'react';
import { Search, MapPin, Clock, Star, Navigation, ArrowLeft, Mic, X, Loader, Accessibility } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { logger } from '../utils/logger';
import { toast } from '../utils/toastConfig';
import { ToastCategory } from '../utils/toastConfig';

// Import centralized loader
import { googleMapsLoader } from '../services/googleMapsLoader';

// Google Places Service Interface
class GooglePlacesSearchService {
  private async ensureGoogleLoaded(): Promise<boolean> {
    try {
      return await googleMapsLoader.waitForGoogleMaps();
    } catch (error) {
      logger.error('Failed to load Google Maps:', error);
      return false;
    }
  }

  async searchPlaces(query: string): Promise<Location[]> {
    if (!query.trim()) return [];

    const isReady = await this.ensureGoogleLoaded();
    if (!isReady) {
      throw new Error('Google Maps not loaded');
    }

    return new Promise((resolve, reject) => {
      const service = new google.maps.places.PlacesService(document.createElement('div'));
      
      const request = {
        query: query.trim(),
        fields: ['place_id', 'name', 'formatted_address', 'geometry', 'rating', 'user_ratings_total', 'price_level', 'opening_hours']
      };

      service.textSearch(request, (results, status) => {
        if (status === google.maps.places.PlacesServiceStatus.OK && results) {
          const places: Location[] = results.slice(0, 10).map((place, index) => {
            const geometry = place.geometry;
            if (!geometry || !geometry.location) {
              return null;
            }

            return {
              id: place.place_id || `search-${Date.now()}-${index}`,
              name: place.name || 'Unknown Place',
              address: place.formatted_address || 'Address not available',
              lat: geometry.location.lat(),
              lng: geometry.location.lng(),
              category: 'search_result',
              rating: place.rating,
              userRatingsTotal: place.user_ratings_total,
              priceLevel: place.price_level,
              isOpenNow: place.opening_hours?.isOpen?.() ?? undefined
            };
          }).filter(Boolean) as Location[];

          resolve(places);
        } else if (status === google.maps.places.PlacesServiceStatus.ZERO_RESULTS) {
          resolve([]);
        } else {
          reject(new Error(`Places search failed: ${status}`));
        }
      });
    });
  }

  async getAutocompleteSuggestions(query: string): Promise<{id: string, description: string, place_id?: string}[]> {
    if (!query.trim()) return [];

    const isReady = await this.ensureGoogleLoaded();
    if (!isReady) return [];

    return new Promise((resolve) => {
      const service = new google.maps.places.AutocompleteService();
      
      service.getPlacePredictions(
        {
          input: query.trim(),
          types: ['establishment', 'geocode'],
          componentRestrictions: { country: [] } // Global search
        },
        (predictions, status) => {
          if (status === google.maps.places.PlacesServiceStatus.OK && predictions) {
            const suggestions = predictions.slice(0, 8).map((prediction, index) => ({
              id: prediction.place_id || `suggestion-${index}`,
              description: prediction.description,
              place_id: prediction.place_id
            }));
            resolve(suggestions);
          } else {
            resolve([]);
          }
        }
      );
    });
  }

  async getPlaceDetails(placeId: string): Promise<Location | null> {
    const isReady = await this.ensureGoogleLoaded();
    if (!isReady) return null;

    return new Promise((resolve, reject) => {
      const service = new google.maps.places.PlacesService(document.createElement('div'));
      
      service.getDetails(
        {
          placeId: placeId,
          fields: ['place_id', 'name', 'formatted_address', 'geometry', 'rating', 'user_ratings_total', 'price_level', 'opening_hours']
        },
        (place, status) => {
          if (status === google.maps.places.PlacesServiceStatus.OK && place) {
            const geometry = place.geometry;
            if (!geometry || !geometry.location) {
              resolve(null);
              return;
            }

            resolve({
              id: place.place_id || placeId,
              name: place.name || 'Unknown Place',
              address: place.formatted_address || 'Address not available',
              lat: geometry.location.lat(),
              lng: geometry.location.lng(),
              category: 'place_details',
              rating: place.rating,
              userRatingsTotal: place.user_ratings_total,
              priceLevel: place.price_level,
              isOpenNow: place.opening_hours?.isOpen?.() ?? undefined
            });
          } else {
            resolve(null);
          }
        }
      );
    });
  }

  async searchNearbyPlaces(location: {lat: number, lng: number}, type: string, radius = 5000): Promise<Location[]> {
    const isReady = await this.ensureGoogleLoaded();
    if (!isReady) return [];

    return new Promise((resolve, reject) => {
      const service = new google.maps.places.PlacesService(document.createElement('div'));
      
      const request = {
        location: new google.maps.LatLng(location.lat, location.lng),
        radius,
        type: type as any
      };

      service.nearbySearch(request, (results, status) => {
        if (status === google.maps.places.PlacesServiceStatus.OK && results) {
          const places: Location[] = results.slice(0, 15).map((place, index) => {
            const geometry = place.geometry;
            if (!geometry || !geometry.location) {
              return null;
            }

            return {
              id: place.place_id || `nearby-${type}-${index}`,
              name: place.name || 'Unknown Place',
              address: place.vicinity || place.formatted_address || 'Address not available',
              lat: geometry.location.lat(),
              lng: geometry.location.lng(),
              category: type,
              rating: place.rating,
              userRatingsTotal: place.user_ratings_total,
              priceLevel: place.price_level,
              isOpenNow: place.opening_hours?.open_now
            };
          }).filter(Boolean) as Location[];

          resolve(places);
        } else {
          resolve([]);
        }
      });
    });
  }
}

const googlePlacesService = new GooglePlacesSearchService();

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
  rating?: number;
  userRatingsTotal?: number;
  priceLevel?: number;
  isOpenNow?: boolean;
  distance?: string;
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
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<Location[]>([]);
  const [suggestions, setSuggestions] = useState<{id: string, description: string, place_id?: string}[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [recentSearches, setRecentSearches] = useState<Location[]>([]);
  const [currentLocation, setCurrentLocation] = useState<{lat: number, lng: number} | null>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Initialize component
  useEffect(() => {
    loadRecentSearches();
    getCurrentLocation().then(setCurrentLocation);
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

  // Modern Google Places search function
  const performSearch = async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    setShowSuggestions(false);
    
    try {
      logger.info('Searching places with Google Places API:', { query: searchQuery });
      const places = await googlePlacesService.searchPlaces(searchQuery);
      
      // Add distance if current location is available
      const placesWithDistance = places.map(place => ({
        ...place,
        distance: currentLocation ? calculateDistance(currentLocation, { lat: place.lat, lng: place.lng }) : undefined
      }));
      
      setSearchResults(placesWithDistance);
      
      if (places.length === 0) {
        toast.searchResult(`No results found for "${searchQuery}"`, 'info');
      } else {
        logger.info('Search successful:', { query: searchQuery, count: places.length });
      }
      
    } catch (error) {
      logger.error('Search failed:', error);
      const errorMessage = error.message || 'Search failed';
      
      if (errorMessage.includes('Google Maps') || errorMessage.includes('not loaded')) {
        toast.error('Google Maps is still loading. Please try again.', ToastCategory.SEARCH);
      } else {
        toast.error('Search failed. Please try again.', ToastCategory.SEARCH);
      }
      
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  // Get autocomplete suggestions
  const getSuggestions = async (query: string) => {
    if (!query.trim()) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    try {
      const suggestions = await googlePlacesService.getAutocompleteSuggestions(query);
      setSuggestions(suggestions);
      setShowSuggestions(suggestions.length > 0);
    } catch (error) {
      logger.warn('Suggestions failed:', error);
      setSuggestions([]);
      setShowSuggestions(false);
    }
  };

  // Handle suggestion selection
  const handleSuggestionSelect = async (suggestion: {id: string, description: string, place_id?: string}) => {
    if (!suggestion.place_id) {
      // Fallback to text search
      setSearchInput(suggestion.description);
      performSearch(suggestion.description);
      return;
    }

    setIsSearching(true);
    setShowSuggestions(false);
    
    try {
      const place = await googlePlacesService.getPlaceDetails(suggestion.place_id);
      if (place) {
        setSearchInput(place.name);
        
        // Add distance if current location is available
        const placeWithDistance = {
          ...place,
          distance: currentLocation ? calculateDistance(currentLocation, { lat: place.lat, lng: place.lng }) : undefined
        };
        
        setSearchResults([placeWithDistance]);
      }
    } catch (error) {
      logger.error('Failed to get place details:', error);
      toast.error('Failed to get place details', ToastCategory.SEARCH);
    } finally {
      setIsSearching(false);
    }
  };

  // Handle input changes with suggestions
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (searchInput.trim() && searchInput.length > 2) {
        getSuggestions(searchInput);
      } else {
        setSuggestions([]);
        setShowSuggestions(false);
      }
    }, 300); // Faster suggestions

    return () => clearTimeout(timeoutId);
  }, [searchInput]);

  // Handle search submission
  const handleSearchSubmit = () => {
    if (!searchInput.trim()) {
      toast.error('Please enter a search query', ToastCategory.SEARCH);
      return;
    }

    performSearch(searchInput);
    onSearch(searchInput);
  };

  // Handle category button clicks using Google Places nearby search
  const handleCategoryClick = async (categoryId: string) => {
    if (!currentLocation) {
      toast.error('Location not available for nearby search', ToastCategory.SEARCH);
      return;
    }

    setIsSearching(true);
    setSearchInput(''); // Clear search input
    setShowSuggestions(false);
    
    try {
      logger.info('Searching nearby places:', { category: categoryId, location: currentLocation });
      const places = await googlePlacesService.searchNearbyPlaces(currentLocation, categoryId, 5000);

      // Add distance to all places
      const placesWithDistance = places.map(place => ({
        ...place,
        distance: calculateDistance(currentLocation, { lat: place.lat, lng: place.lng })
      }));

      setSearchResults(placesWithDistance);
      
      if (places.length === 0) {
        toast.searchResult(`No ${categoryId.replace('_', ' ')} found nearby`, 'info');
      } else {
        logger.info('Nearby search successful:', { category: categoryId, count: places.length });
      }
      
    } catch (error) {
      logger.error('Nearby search failed:', error);
      toast.error('Failed to find nearby places', ToastCategory.SEARCH);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  // Handle clicks outside suggestions
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const categories = [
    { id: 'restaurant', name: 'Restaurants', icon: '🍽️' },
    { id: 'gas_station', name: 'Gas Stations', icon: '⛽' },
    { id: 'parking', name: 'Parking', icon: '🉿️' },
    { id: 'atm', name: 'ATMs', icon: '💵' },
    { id: 'hospital', name: 'Hospitals', icon: '🏥' },
    { id: 'shopping_mall', name: 'Shopping', icon: '🛍️' },
    { id: 'lodging', name: 'Hotels', icon: '🏨' },
    { id: 'movie_theater', name: 'Entertainment', icon: '🎭' },
  ];

  const getCategoryIcon = (category: string) => {
    const categoryMap: Record<string, string> = {
      restaurant: '🍽️',
      gas_station: '⛽',
      parking: '🉿️',
      atm: '💵',
      hospital: '🏥',
      shopping_mall: '🛍️',
      lodging: '🏨',
      movie_theater: '🎭',
      search_result: '📍',
      place_details: '📍'
    };
    return categoryMap[category] || '📍';
  };

  const handleLocationSelect = (location: Location) => {
    saveToRecentSearches(location);
    onLocationSelect(location);
    
    // Show minimal route calculation message
    const modeEmoji = transportMode === 'walking' ? '🚶' : transportMode === 'driving' ? '🚗' : transportMode === 'cycling' ? '🚴' : '🚌';
    toast.searchResult(`${modeEmoji} Route to ${location.name}`, 'success');
    
    // Go back to map to show the route
    onBack();
  };

  return (
    <div className="h-full flex flex-col bg-white">
      <div className="flex-shrink-0 p-3 sm:p-4 border-b border-gray-100">
        {/* Header */}
        <div className="flex items-center gap-3 sm:gap-4 mb-3 sm:mb-4">
          <Button variant="ghost" size="icon" onClick={onBack} className="h-8 w-8 sm:h-10 sm:w-10">
            <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
          </Button>
          <div className="min-w-0">
            <h2 className="font-medium text-gray-900 text-base sm:text-lg truncate">Search</h2>
            <p className="text-xs sm:text-sm text-gray-500 truncate">Find places and addresses</p>
          </div>
        </div>

        {/* Search Input */}
        <div className="relative">
          <Input
            value={searchInput}
            onChange={(e) => {
              setSearchInput(e.target.value);
            }}
            placeholder="Search for places, addresses..."
            className="pl-9 sm:pl-10 pr-16 sm:pr-20 text-sm sm:text-base"
            onKeyPress={(e) => e.key === 'Enter' && handleSearchSubmit()}
            onFocus={() => {
              if (suggestions.length > 0) {
                setShowSuggestions(true);
              }
            }}
            autoFocus
          />
          <Search className="absolute left-2.5 sm:left-3 top-1/2 transform -translate-y-1/2 w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-400" />
          <div className="absolute right-0.5 sm:right-1 top-1/2 transform -translate-y-1/2 flex gap-0.5 sm:gap-1">
            {searchInput && (
              <Button 
                variant="ghost" 
                size="icon" 
                className="w-6 h-6 sm:w-8 sm:h-8 touch-manipulation" 
                onClick={() => {
                  setSearchInput('');
                  setSuggestions([]);
                  setShowSuggestions(false);
                  setSearchResults([]);
                }}
              >
                <X className="w-3 h-3 sm:w-4 sm:h-4" />
              </Button>
            )}
            <Button variant="ghost" size="icon" className="w-6 h-6 sm:w-8 sm:h-8 touch-manipulation" onClick={onOpenVoicePanel}>
              <Mic className="w-3 h-3 sm:w-4 sm:h-4" />
            </Button>
          </div>
          
          {/* Autocomplete Suggestions */}
          {showSuggestions && suggestions.length > 0 && (
            <div 
              ref={suggestionsRef}
              className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-md shadow-lg z-50 max-h-48 sm:max-h-60 overflow-y-auto mt-1"
            >
              {suggestions.map((suggestion) => (
                <button
                  key={suggestion.id}
                  className="w-full text-left px-3 sm:px-4 py-2.5 sm:py-3 hover:bg-gray-50 border-b border-gray-100 last:border-b-0 flex items-center gap-2 sm:gap-3 touch-manipulation"
                  onClick={() => handleSuggestionSelect(suggestion)}
                >
                  <Search className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-400 flex-shrink-0" />
                  <span className="text-xs sm:text-sm text-gray-900 truncate">{suggestion.description}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scroll-y hide-scrollbar scroll-smooth">
        {/* Quick Categories */}
        <div className="px-3 sm:px-4 py-3 sm:py-4 border-b border-gray-100">
          <h3 className="font-medium text-gray-900 mb-2 sm:mb-3 text-sm sm:text-base">Quick Search</h3>
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            {categories.map((category) => (
              <button
                key={category.id}
                className="flex flex-col items-center p-2 sm:p-3 rounded-lg hover:bg-gray-50 transition-colors touch-manipulation"
                onClick={() => handleCategoryClick(category.id)}
              >
                <span className="text-xl sm:text-2xl mb-1">{category.icon}</span>
                <span className="text-xs text-gray-700 text-center leading-tight">{category.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Loading State */}
        {isSearching && (
          <div className="px-3 sm:px-4 py-6 sm:py-8 text-center">
            <div className="animate-spin rounded-full h-6 w-6 sm:h-8 sm:w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="text-gray-600 mt-2 flex items-center justify-center gap-2 text-sm sm:text-base">
              <Loader className="w-3 h-3 sm:w-4 sm:h-4 animate-spin" />
              Searching with Google Places...
            </p>
          </div>
        )}

        {/* Recent Searches */}
        {!isSearching && searchResults.length === 0 && recentSearches.length > 0 && (
          <div className="px-3 sm:px-4 py-3 sm:py-4">
            <h3 className="font-medium text-gray-900 mb-2 sm:mb-3 text-sm sm:text-base">Recent Searches</h3>
            <div className="space-y-2 sm:space-y-3">
              {recentSearches.map((place) => (
                <div
                  key={place.id}
                  className="flex items-center gap-3 sm:gap-4 p-2.5 sm:p-3 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors touch-manipulation"
                  onClick={() => handleLocationSelect(place)}
                >
                  <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-gray-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-gray-900 truncate text-sm sm:text-base">{place.name}</h4>
                    <p className="text-xs sm:text-sm text-gray-600 truncate">{place.address}</p>
                  </div>
                  <Navigation className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-400 flex-shrink-0" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Search Results */}
        {searchResults.length > 0 && (
          <div className="px-3 sm:px-4 py-3 sm:py-4">
            <h3 className="font-medium text-gray-900 mb-2 sm:mb-3 text-sm sm:text-base">Search Results ({searchResults.length})</h3>
            <div className="space-y-2 sm:space-y-3">
              {searchResults.map((place) => (
                <div
                  key={place.id}
                  className="flex items-center gap-3 sm:gap-4 p-2.5 sm:p-3 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors touch-manipulation"
                  onClick={() => handleLocationSelect(place)}
                >
                  <div className="w-8 h-8 sm:w-10 sm:h-10 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-base sm:text-lg">{getCategoryIcon(place.category)}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-gray-900 truncate text-sm sm:text-base">{place.name}</h4>
                    <p className="text-xs sm:text-sm text-gray-600 truncate">{place.address}</p>
                    <div className="flex items-center gap-1.5 sm:gap-2 mt-1 text-xs text-gray-500">
                      {place.rating && (
                        <div className="flex items-center gap-1">
                          <Star className="w-2.5 h-2.5 sm:w-3 sm:h-3 fill-yellow-400 text-yellow-400" />
                          <span className="text-xs">{place.rating.toFixed(1)}</span>
                          {place.userRatingsTotal && (
                            <span className="text-gray-400 text-xs hidden sm:inline">({place.userRatingsTotal})</span>
                          )}
                        </div>
                      )}
                      {place.rating && place.distance && (
                        <span className="w-0.5 h-0.5 sm:w-1 sm:h-1 bg-gray-300 rounded-full" />
                      )}
                      {place.distance && (
                        <span className="text-xs text-gray-600">{place.distance}</span>
                      )}
                      {place.priceLevel && place.priceLevel > 0 && (
                        <>
                          <span className="w-0.5 h-0.5 sm:w-1 sm:h-1 bg-gray-300 rounded-full" />
                          <span className="text-green-600 text-xs">{'$'.repeat(place.priceLevel)}</span>
                        </>
                      )}
                      {place.isOpenNow !== undefined && (
                        <>
                          <span className="w-0.5 h-0.5 sm:w-1 sm:h-1 bg-gray-300 rounded-full" />
                          <span className={`text-xs ${place.isOpenNow ? 'text-green-600' : 'text-red-600'}`}>
                            {place.isOpenNow ? 'Open' : 'Closed'}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <Navigation className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-400 flex-shrink-0" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* No Results */}
        {!isSearching && searchResults.length === 0 && searchInput.trim() && (
          <div className="px-3 sm:px-4 py-6 sm:py-8 text-center">
            <MapPin className="w-10 h-10 sm:w-12 sm:h-12 text-gray-400 mx-auto mb-2" />
            <p className="text-gray-600 text-sm sm:text-base">No results found for "{searchInput}"</p>
            <p className="text-xs sm:text-sm text-gray-500 mt-1">Try a different search term</p>
          </div>
        )}
      </div>
    </div>
  );
}
