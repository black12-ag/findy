/**
 * 🏠 Home/Map Page Component
 * 
 * Main landing page with location search, quick transport modes,
 * and core navigation features
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Dimensions
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE, Region } from 'react-native-maps';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

// Services
import { geocodingService } from '../services/geocodingService';
import { geolocationService } from '../services/geolocationService';
import { directionsService } from '../services/directionsService';
import { poisService } from '../services/poisService';

// Types
import { TransportProfile } from '../config/apiConfig';
import { GeocodeLocation } from '../services/geocodingService';
import { PointOfInterest } from '../services/poisService';

interface LocationState {
  lat: number;
  lng: number;
  address?: string;
  name?: string;
}

interface TransportMode {
  id: TransportProfile;
  name: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
}

const TRANSPORT_MODES: TransportMode[] = [
  { id: 'driving-car', name: 'Car', icon: 'car', color: '#2196F3' },
  { id: 'walking', name: 'Walk', icon: 'walk', color: '#4CAF50' },
  { id: 'cycling-regular', name: 'Bike', icon: 'bicycle', color: '#FF9800' },
  { id: 'public-transport', name: 'Transit', icon: 'bus', color: '#9C27B0' }
];

const { width, height } = Dimensions.get('window');

export default function HomePage() {
  const navigation = useNavigation();
  const mapRef = useRef<MapView>(null);
  
  // State
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<LocationState | null>(null);
  const [destination, setDestination] = useState<LocationState | null>(null);
  const [selectedTransport, setSelectedTransport] = useState<TransportProfile>('driving-car');
  const [nearbyPOIs, setNearbyPOIs] = useState<PointOfInterest[]>([]);
  const [isLoadingLocation, setIsLoadingLocation] = useState(true);
  const [isLoadingPOIs, setIsLoadingPOIs] = useState(false);
  
  const [mapRegion, setMapRegion] = useState<Region>({
    latitude: 37.7749, // San Francisco default
    longitude: -122.4194,
    latitudeDelta: 0.0922,
    longitudeDelta: 0.0421,
  });

  // Load current location on mount
  useEffect(() => {
    getCurrentLocation();
  }, []);

  // Load nearby POIs when location changes
  useEffect(() => {
    if (currentLocation) {
      loadNearbyPOIs();
    }
  }, [currentLocation]);

  /**
   * Get user's current location
   */
  const getCurrentLocation = async () => {
    try {
      setIsLoadingLocation(true);
      const location = await geolocationService.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 10000
      });

      const locationState = {
        lat: location.coords.latitude,
        lng: location.coords.longitude
      };

      setCurrentLocation(locationState);
      
      // Update map region
      setMapRegion({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      });

      // Reverse geocode to get address
      try {
        const address = await geocodingService.reverseGeocode(
          location.coords.latitude,
          location.coords.longitude
        );
        setCurrentLocation(prev => prev ? { ...prev, address: address.label } : null);
      } catch (error) {
        console.log('Reverse geocoding failed:', error);
      }
    } catch (error) {
      console.error('Location error:', error);
      Alert.alert(
        'Location Error',
        'Unable to get your current location. Please enable location services.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsLoadingLocation(false);
    }
  };

  /**
   * Load nearby points of interest
   */
  const loadNearbyPOIs = async () => {
    if (!currentLocation) return;

    try {
      setIsLoadingPOIs(true);
      const pois = await poisService.findNearby(
        [currentLocation.lng, currentLocation.lat],
        1000, // 1km radius
        ['restaurant', 'gas_station', 'hospital', 'bank']
      );
      setNearbyPOIs(pois.slice(0, 10)); // Limit to 10 POIs
    } catch (error) {
      console.error('POI loading error:', error);
    } finally {
      setIsLoadingPOIs(false);
    }
  };

  /**
   * Handle location search - Navigate to SearchResults page
   */
  const handleLocationSearch = async () => {
    if (!searchQuery.trim()) return;

    // Navigate to SearchResults page with query
    navigation.navigate('SearchResults' as never, {
      initialQuery: searchQuery,
      currentLocation
    } as never);

    // Clear search query
    setSearchQuery('');
  };

  /**
   * Handle transport mode selection (local state change only)
   */
  const handleTransportModeSelect = (mode: TransportProfile) => {
    setSelectedTransport(mode);
  };

  /**
   * Navigate to destination
   */
  const handleNavigateToDestination = async () => {
    if (!currentLocation || !destination) {
      Alert.alert('Missing Location', 'Please set both origin and destination.');
      return;
    }

    try {
      // Navigate to navigation page with route data
      navigation.navigate('Navigation' as never, {
        origin: currentLocation,
        destination,
        transport: selectedTransport
      } as never);
    } catch (error) {
      console.error('Navigation error:', error);
      Alert.alert('Navigation Error', 'Unable to start navigation.');
    }
  };

  /**
   * Handle POI selection - Navigate to PlaceDetails page
   */
  const handlePOISelect = (poi: PointOfInterest) => {
    navigation.navigate('PlaceDetails' as never, {
      place: poi,
      currentLocation
    } as never);
  };

  /**
   * Show route options - Navigate to RouteOptions page
   */
  const handleShowRouteOptions = () => {
    if (!currentLocation) {
      Alert.alert('Location Required', 'Please enable location to view route options.');
      return;
    }

    // Use current location and a nearby destination for route options demo
    const demoDestination = {
      lat: currentLocation.lat + 0.01,
      lng: currentLocation.lng + 0.01,
      name: 'Nearby Location',
      address: 'Demo destination for route comparison'
    };

    navigation.navigate('RouteOptions' as never, {
      origin: currentLocation,
      destination: demoDestination,
      transport: selectedTransport
    } as never);
  };

  /**
   * Open reachability analysis
   */
  const handleReachabilityAnalysis = () => {
    if (!currentLocation) {
      Alert.alert('Location Required', 'Please enable location to analyze reachability.');
      return;
    }

    navigation.navigate('Reachability' as never, {
      location: currentLocation,
      transport: selectedTransport
    } as never);
  };

  /**
   * Open settings page
   */
  const handleOpenSettings = () => {
    navigation.navigate('Settings' as never);
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Map View */}
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        region={mapRegion}
        onRegionChangeComplete={setMapRegion}
        showsUserLocation={true}
        showsMyLocationButton={false}
      >
        {/* Current Location Marker */}
        {currentLocation && (
          <Marker
            coordinate={{ latitude: currentLocation.lat, longitude: currentLocation.lng }}
            title="Current Location"
            description={currentLocation.address}
            pinColor="blue"
          />
        )}

        {/* Destination Marker */}
        {destination && (
          <Marker
            coordinate={{ latitude: destination.lat, longitude: destination.lng }}
            title={destination.name || "Destination"}
            description={destination.address}
            pinColor="red"
          />
        )}

        {/* Nearby POIs */}
        {nearbyPOIs.map((poi, index) => (
          <Marker
            key={`poi-${index}`}
            coordinate={{ 
              latitude: poi.geometry.coordinates[1], 
              longitude: poi.geometry.coordinates[0] 
            }}
            title={poi.properties.name}
            description={poi.properties.label}
            pinColor="green"
            onPress={() => handlePOISelect(poi)}
          />
        ))}
      </MapView>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color="#666" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search for places..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={handleLocationSearch}
            returnKeyType="search"
          />
          {isSearching && (
            <ActivityIndicator size="small" color="#007AFF" style={styles.searchSpinner} />
          )}
        </View>
      </View>

      {/* Quick Transport Modes */}
      <View style={styles.transportContainer}>
        <Text style={styles.transportTitle}>Transport Mode</Text>
        <View style={styles.transportModes}>
          {TRANSPORT_MODES.map((mode) => (
            <TouchableOpacity
              key={mode.id}
              style={[
                styles.transportButton,
                { backgroundColor: selectedTransport === mode.id ? mode.color : '#f0f0f0' }
              ]}
              onPress={() => handleTransportModeSelect(mode.id)}
            >
              <Ionicons 
                name={mode.icon} 
                size={24} 
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

      {/* Action Buttons */}
      <View style={styles.actionsContainer}>
        {/* Navigate Button */}
        {destination && (
          <TouchableOpacity 
            style={[styles.actionButton, styles.navigateButton]}
            onPress={handleNavigateToDestination}
          >
            <Ionicons name="navigate" size={20} color="white" />
            <Text style={styles.actionButtonText}>Navigate</Text>
          </TouchableOpacity>
        )}

        {/* Route Options Button */}
        {destination && (
          <TouchableOpacity 
            style={[styles.actionButton, styles.routeButton]}
            onPress={handleShowRouteOptions}
          >
            <Ionicons name="options" size={20} color="white" />
            <Text style={styles.actionButtonText}>Routes</Text>
          </TouchableOpacity>
        )}

        {/* Reachability Button */}
        <TouchableOpacity 
          style={[styles.actionButton, styles.reachabilityButton]}
          onPress={handleReachabilityAnalysis}
        >
          <Ionicons name="radio" size={20} color="white" />
          <Text style={styles.actionButtonText}>Reachable</Text>
        </TouchableOpacity>

        {/* Current Location Button */}
        <TouchableOpacity 
          style={[styles.actionButton, styles.locationButton]}
          onPress={getCurrentLocation}
          disabled={isLoadingLocation}
        >
          {isLoadingLocation ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <Ionicons name="location" size={20} color="white" />
          )}
          <Text style={styles.actionButtonText}>My Location</Text>
        </TouchableOpacity>

        {/* Settings Button */}
        <TouchableOpacity 
          style={[styles.actionButton, styles.settingsButton]}
          onPress={handleOpenSettings}
        >
          <Ionicons name="settings" size={20} color="white" />
          <Text style={styles.actionButtonText}>Settings</Text>
        </TouchableOpacity>
      </View>

      {/* Loading Overlay */}
      {(isLoadingLocation || isLoadingPOIs) && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>
            {isLoadingLocation ? 'Getting your location...' : 'Loading nearby places...'}
          </Text>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  map: {
    flex: 1,
  },
  searchContainer: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 20,
    left: 20,
    right: 20,
    zIndex: 1000,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 25,
    paddingHorizontal: 15,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
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
  transportContainer: {
    position: 'absolute',
    bottom: 160,
    left: 20,
    right: 20,
    backgroundColor: 'white',
    borderRadius: 15,
    padding: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
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
    alignItems: 'center',
    paddingVertical: 12,
    marginHorizontal: 4,
    borderRadius: 12,
  },
  transportText: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 4,
  },
  actionsContainer: {
    position: 'absolute',
    bottom: 40,
    left: 20,
    right: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    marginHorizontal: 4,
    borderRadius: 25,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  navigateButton: {
    backgroundColor: '#4CAF50',
  },
  routeButton: {
    backgroundColor: '#2196F3',
  },
  reachabilityButton: {
    backgroundColor: '#FF9800',
  },
  locationButton: {
    backgroundColor: '#9C27B0',
  },
  settingsButton: {
    backgroundColor: '#607D8B',
  },
  actionButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2000,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#333',
  },
});