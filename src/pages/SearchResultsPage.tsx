/**
 * 🔍 Search Results Page
 * 
 * Displays search results with autocomplete functionality
 * Connected to: Geocoding Search & Autocomplete APIs, Directions API for navigation
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Alert,
  ActivityIndicator,
  Platform,
  Keyboard
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

// Services
import { geocodingService } from '../services/geocodingService';
import { geolocationService } from '../services/geolocationService';
import type { GeocodeLocation } from '../services/geocodingService';

// Config
import { TransportProfile } from '../config/apiConfig';

interface RouteParams {
  initialQuery?: string;
  currentLocation?: {
    lat: number;
    lng: number;
  };
}

interface SearchResult extends GeocodeLocation {
  distance?: number;
}

export default function SearchResultsPage() {
  const route = useRoute();
  const navigation = useNavigation();
  
  const { initialQuery = '', currentLocation } = route.params as RouteParams;
  
  // State
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [autocompleteResults, setAutocompleteResults] = useState<GeocodeLocation[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isLoadingAutocomplete, setIsLoadingAutocomplete] = useState(false);
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [selectedTransport, setSelectedTransport] = useState<TransportProfile>('driving-car');

  // Refs
  const searchInputRef = useRef<TextInput>(null);
  const autocompleteTimer = useRef<NodeJS.Timeout | null>(null);

  const TRANSPORT_MODES = [
    { id: 'driving-car', name: 'Car', icon: 'car', color: '#2196F3' },
    { id: 'foot-walking', name: 'Walk', icon: 'walk', color: '#4CAF50' },
    { id: 'cycling-regular', name: 'Bike', icon: 'bicycle', color: '#FF9800' }
  ] as const;

  // Search on mount if initial query provided
  useEffect(() => {
    if (initialQuery) {
      performSearch(initialQuery);
    }
  }, []);

  // Handle text input changes for autocomplete
  useEffect(() => {
    if (searchQuery.length >= 2) {
      // Clear previous timer
      if (autocompleteTimer.current) {
        clearTimeout(autocompleteTimer.current);
      }
      
      // Set new timer for autocomplete with 300ms delay
      autocompleteTimer.current = setTimeout(() => {
        loadAutocompleteResults(searchQuery);
      }, 300);
    } else {
      setShowAutocomplete(false);
      setAutocompleteResults([]);
    }

    return () => {
      if (autocompleteTimer.current) {
        clearTimeout(autocompleteTimer.current);
      }
    };
  }, [searchQuery]);

  /**
   * Perform full search using Geocoding Search API
   */
  const performSearch = async (query: string) => {
    if (!query.trim()) return;

    try {
      setIsSearching(true);
      setShowAutocomplete(false);
      Keyboard.dismiss();

      // Use current location as bias if available
      const bias = currentLocation ? {
        bias_longitude: currentLocation.lng,
        bias_latitude: currentLocation.lat
      } : {};

      const results = await geocodingService.geocode(query, {
        limit: 20,
        ...bias
      });

      // Calculate distances if current location available
      const resultsWithDistance = results.map(result => ({
        ...result,
        distance: currentLocation ? calculateDistance(
          currentLocation.lat,
          currentLocation.lng,
          result.geometry.coordinates[1],
          result.geometry.coordinates[0]
        ) : undefined
      }));

      // Sort by distance if available
      if (currentLocation) {
        resultsWithDistance.sort((a, b) => (a.distance || 0) - (b.distance || 0));
      }

      setSearchResults(resultsWithDistance);
      
      if (results.length === 0) {
        Alert.alert('No Results', 'No locations found for your search. Try a different search term.');
      }
    } catch (error) {
      console.error('Search error:', error);
      Alert.alert(
        'Search Error', 
        'Unable to search for locations. Please check your connection and API quota.'
      );
    } finally {
      setIsSearching(false);
    }
  };

  /**
   * Load autocomplete suggestions using Geocoding Autocomplete API
   */
  const loadAutocompleteResults = async (query: string) => {
    try {
      setIsLoadingAutocomplete(true);
      
      // Use current location as bias if available
      const bias = currentLocation ? {
        bias_longitude: currentLocation.lng,
        bias_latitude: currentLocation.lat
      } : {};

      const results = await geocodingService.autocomplete(query, {
        limit: 8,
        ...bias
      });

      setAutocompleteResults(results);
      setShowAutocomplete(true);
    } catch (error) {
      console.error('Autocomplete error:', error);
      // Don't show error for autocomplete failures
    } finally {
      setIsLoadingAutocomplete(false);
    }
  };

  /**
   * Handle search submission
   */
  const handleSearchSubmit = () => {
    performSearch(searchQuery);
  };

  /**
   * Handle autocomplete selection
   */
  const handleAutocompleteSelect = (item: GeocodeLocation) => {
    setSearchQuery(item.properties.label);
    setShowAutocomplete(false);
    
    // Add to search results
    const resultWithDistance = {
      ...item,
      distance: currentLocation ? calculateDistance(
        currentLocation.lat,
        currentLocation.lng,
        item.geometry.coordinates[1],
        item.geometry.coordinates[0]
      ) : undefined
    };
    
    setSearchResults([resultWithDistance]);
  };

  /**
   * Navigate to selected result - connects to Directions API
   */
  const handleNavigateHere = async (result: SearchResult) => {
    if (!currentLocation) {
      // Try to get current location
      try {
        const location = await geolocationService.getCurrentPosition();
        const origin = {
          lat: location.coords.latitude,
          lng: location.coords.longitude
        };
        
        startNavigation(origin, result);
      } catch (error) {
        Alert.alert('Location Required', 'Please enable location services to navigate.');
      }
      return;
    }

    startNavigation(currentLocation, result);
  };

  /**
   * Start navigation to destination
   */
  const startNavigation = (origin: { lat: number; lng: number }, result: SearchResult) => {
    const destination = {
      lat: result.geometry.coordinates[1],
      lng: result.geometry.coordinates[0],
      name: result.properties.name,
      address: result.properties.label
    };

    navigation.navigate('Navigation' as never, {
      origin,
      destination,
      transport: selectedTransport
    } as never);
  };

  /**
   * View place details
   */
  const handleViewDetails = (result: SearchResult) => {
    // Convert to POI format for place details page
    const place = {
      type: 'Feature' as const,
      geometry: result.geometry,
      properties: {
        osm_id: result.properties.osm_id || Date.now(),
        name: result.properties.name,
        label: result.properties.label,
        osm_tags: {}
      }
    };

    navigation.navigate('PlaceDetails' as never, {
      place,
      currentLocation
    } as never);
  };

  /**
   * Calculate distance between two coordinates
   */
  const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = lat1 * Math.PI/180;
    const φ2 = lat2 * Math.PI/180;
    const Δφ = (lat2-lat1) * Math.PI/180;
    const Δλ = (lng2-lng1) * Math.PI/180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c;
  };

  /**
   * Format distance for display
   */
  const formatDistance = (meters: number): string => {
    if (meters < 1000) {
      return `${Math.round(meters)}m`;
    }
    const km = meters / 1000;
    return `${km.toFixed(1)}km`;
  };

  /**
   * Get location type icon
   */
  const getLocationIcon = (result: GeocodeLocation): keyof typeof Ionicons.glyphMap => {
    const layer = result.properties.layer;
    if (layer === 'address') return 'home-outline';
    if (layer === 'street') return 'trail-sign-outline';
    if (layer === 'venue') return 'business-outline';
    if (layer === 'locality') return 'location-outline';
    return 'pin-outline';
  };

  /**
   * Render search result item
   */
  const renderSearchResult = ({ item }: { item: SearchResult }) => (
    <View style={styles.resultItem}>
      <View style={styles.resultIcon}>
        <Ionicons name={getLocationIcon(item)} size={20} color="#2196F3" />
      </View>
      
      <View style={styles.resultInfo}>
        <Text style={styles.resultName}>{item.properties.name}</Text>
        <Text style={styles.resultAddress}>{item.properties.label}</Text>
        {item.distance && (
          <Text style={styles.resultDistance}>{formatDistance(item.distance)}</Text>
        )}
      </View>

      <View style={styles.resultActions}>
        <TouchableOpacity 
          style={styles.detailsButton}
          onPress={() => handleViewDetails(item)}
        >
          <Ionicons name="information-circle-outline" size={20} color="#666" />
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.navigateButton}
          onPress={() => handleNavigateHere(item)}
        >
          <Ionicons name="navigate" size={20} color="white" />
        </TouchableOpacity>
      </View>
    </View>
  );

  /**
   * Render autocomplete item
   */
  const renderAutocompleteItem = ({ item }: { item: GeocodeLocation }) => (
    <TouchableOpacity 
      style={styles.autocompleteItem}
      onPress={() => handleAutocompleteSelect(item)}
    >
      <Ionicons name={getLocationIcon(item)} size={16} color="#666" />
      <View style={styles.autocompleteInfo}>
        <Text style={styles.autocompleteName}>{item.properties.name}</Text>
        <Text style={styles.autocompleteAddress}>{item.properties.label}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Search Results</Text>
        <View style={styles.headerRight} />
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color="#666" style={styles.searchIcon} />
          <TextInput
            ref={searchInputRef}
            style={styles.searchInput}
            placeholder="Search for places..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={handleSearchSubmit}
            returnKeyType="search"
            autoFocus={!initialQuery}
          />
          {(isSearching || isLoadingAutocomplete) && (
            <ActivityIndicator size="small" color="#2196F3" style={styles.searchSpinner} />
          )}
          {searchQuery.length > 0 && (
            <TouchableOpacity 
              style={styles.clearButton}
              onPress={() => {
                setSearchQuery('');
                setSearchResults([]);
                setShowAutocomplete(false);
              }}
            >
              <Ionicons name="close-circle" size={20} color="#666" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Transport Mode Selection */}
      <View style={styles.transportContainer}>
        <Text style={styles.transportTitle}>Navigation Mode</Text>
        <View style={styles.transportModes}>
          {TRANSPORT_MODES.map((mode) => (
            <TouchableOpacity
              key={mode.id}
              style={[
                styles.transportButton,
                { 
                  backgroundColor: selectedTransport === mode.id ? mode.color : '#f0f0f0',
                  borderColor: mode.color 
                }
              ]}
              onPress={() => setSelectedTransport(mode.id)}
            >
              <Ionicons 
                name={mode.icon as any} 
                size={16} 
                color={selectedTransport === mode.id ? 'white' : mode.color} 
              />
              <Text style={[
                styles.transportText,
                { color: selectedTransport === mode.id ? 'white' : '#333' }
              ]}>
                {mode.name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Autocomplete Results */}
      {showAutocomplete && autocompleteResults.length > 0 && (
        <View style={styles.autocompleteContainer}>
          <FlatList
            data={autocompleteResults}
            renderItem={renderAutocompleteItem}
            keyExtractor={(item, index) => `autocomplete-${index}`}
            style={styles.autocompleteList}
            keyboardShouldPersistTaps="handled"
          />
        </View>
      )}

      {/* Search Results */}
      {!showAutocomplete && (
        <View style={styles.resultsContainer}>
          {searchResults.length > 0 ? (
            <>
              <Text style={styles.resultsCount}>
                {searchResults.length} result{searchResults.length !== 1 ? 's' : ''} found
              </Text>
              <FlatList
                data={searchResults}
                renderItem={renderSearchResult}
                keyExtractor={(item, index) => `result-${index}`}
                style={styles.resultsList}
                showsVerticalScrollIndicator={false}
              />
            </>
          ) : !isSearching && searchQuery.length > 0 && (
            <View style={styles.noResultsContainer}>
              <Ionicons name="search-outline" size={48} color="#ccc" />
              <Text style={styles.noResultsText}>No results found</Text>
              <Text style={styles.noResultsSubtext}>
                Try searching for an address, place name, or landmark
              </Text>
            </View>
          )}

          {searchQuery.length === 0 && !isSearching && (
            <View style={styles.emptyStateContainer}>
              <Ionicons name="location-outline" size={48} color="#ccc" />
              <Text style={styles.emptyStateText}>Start searching</Text>
              <Text style={styles.emptyStateSubtext}>
                Enter an address, place name, or landmark to find locations
              </Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    paddingBottom: 15,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    padding: 5,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  headerRight: {
    width: 34, // Same as back button to center title
  },
  searchContainer: {
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderRadius: 25,
    paddingHorizontal: 15,
    paddingVertical: 12,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#333',
  },
  searchSpinner: {
    marginLeft: 10,
  },
  clearButton: {
    marginLeft: 10,
  },
  transportContainer: {
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  transportTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 10,
  },
  transportModes: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  transportButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    marginHorizontal: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  transportText: {
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 4,
  },
  autocompleteContainer: {
    maxHeight: 300,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  autocompleteList: {
    paddingHorizontal: 20,
  },
  autocompleteItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  autocompleteInfo: {
    flex: 1,
    marginLeft: 12,
  },
  autocompleteName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  autocompleteAddress: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  resultsContainer: {
    flex: 1,
  },
  resultsCount: {
    fontSize: 14,
    color: '#666',
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  resultsList: {
    flex: 1,
    paddingHorizontal: 20,
  },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  resultIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E3F2FD',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 15,
  },
  resultInfo: {
    flex: 1,
  },
  resultName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 4,
  },
  resultAddress: {
    fontSize: 14,
    color: '#666',
    lineHeight: 18,
  },
  resultDistance: {
    fontSize: 12,
    color: '#888',
    marginTop: 4,
  },
  resultActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailsButton: {
    padding: 10,
    marginRight: 8,
  },
  navigateButton: {
    backgroundColor: '#4CAF50',
    borderRadius: 20,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noResultsContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  noResultsText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginTop: 16,
    textAlign: 'center',
  },
  noResultsSubtext: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginTop: 8,
  },
  emptyStateContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginTop: 16,
    textAlign: 'center',
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginTop: 8,
  },
});