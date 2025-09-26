/**
 * 📍 Place Details Page
 * 
 * Shows detailed information about a selected POI with navigation options
 * Connected to: POIs API for similar places, Directions API for navigation
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  Platform,
  Share,
  Linking
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Services
import { poisService } from '../services/poisService';
import { directionsService } from '../services/directionsService';
import { geolocationService } from '../services/geolocationService';
import type { PointOfInterest } from '../services/poisService';

// Config
import { TransportProfile } from '../config/apiConfig';

interface RouteParams {
  place: PointOfInterest;
  currentLocation?: {
    lat: number;
    lng: number;
  };
}

interface PlaceDetails extends PointOfInterest {
  distance?: number;
  travelTime?: number;
  isFavorite: boolean;
}

const FAVORITES_STORAGE_KEY = '@findy_favorites';

export default function PlaceDetailsPage() {
  const route = useRoute();
  const navigation = useNavigation();
  
  const { place, currentLocation } = route.params as RouteParams;
  
  // State
  const [placeDetails, setPlaceDetails] = useState<PlaceDetails>({
    ...place,
    isFavorite: false
  });
  const [similarPlaces, setSimilarPlaces] = useState<PointOfInterest[]>([]);
  const [isLoadingSimilar, setIsLoadingSimilar] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);
  const [selectedTransport, setSelectedTransport] = useState<TransportProfile>('driving-car');

  const TRANSPORT_MODES = [
    { id: 'driving-car', name: 'Car', icon: 'car', color: '#2196F3' },
    { id: 'foot-walking', name: 'Walk', icon: 'walk', color: '#4CAF50' },
    { id: 'cycling-regular', name: 'Bike', icon: 'bicycle', color: '#FF9800' }
  ] as const;

  // Load place details on mount
  useEffect(() => {
    loadPlaceDetails();
    loadSimilarPlaces();
  }, []);

  /**
   * Load additional place details and check if it's favorited
   */
  const loadPlaceDetails = async () => {
    try {
      // Check if place is in favorites
      const favorites = await AsyncStorage.getItem(FAVORITES_STORAGE_KEY);
      const favoritePlaces = favorites ? JSON.parse(favorites) : [];
      const isFavorite = favoritePlaces.some((fav: PointOfInterest) => 
        fav.properties.osm_id === place.properties.osm_id
      );

      // Calculate distance and travel time if current location available
      let distance, travelTime;
      if (currentLocation) {
        distance = calculateDistance(
          currentLocation.lat,
          currentLocation.lng,
          place.geometry.coordinates[1],
          place.geometry.coordinates[0]
        );

        // Get travel time estimate
        try {
          const route = await directionsService.getRoute(
            [currentLocation.lng, currentLocation.lat],
            [place.geometry.coordinates[0], place.geometry.coordinates[1]],
            selectedTransport
          );
          
          if (route.routes.length > 0) {
            travelTime = Math.round(route.routes[0].summary.duration / 60); // Convert to minutes
          }
        } catch (error) {
          console.log('Could not get travel time:', error);
        }
      }

      setPlaceDetails({
        ...place,
        distance,
        travelTime,
        isFavorite
      });
    } catch (error) {
      console.error('Error loading place details:', error);
    }
  };

  /**
   * Load similar places using POIs API
   */
  const loadSimilarPlaces = async () => {
    try {
      setIsLoadingSimilar(true);
      
      // Get category from place properties
      const categoryId = place.properties.osm_tags?.amenity || 
                        place.properties.osm_tags?.shop || 
                        place.properties.osm_tags?.tourism;
      
      if (!categoryId) {
        return;
      }

      // Find similar places within 2km radius
      const similar = await poisService.findNearby(
        place.geometry.coordinates,
        2000, // 2km radius
        [categoryId]
      );

      // Filter out the current place and limit to 5 results
      const filteredSimilar = similar
        .filter(poi => poi.properties.osm_id !== place.properties.osm_id)
        .slice(0, 5);

      setSimilarPlaces(filteredSimilar);
    } catch (error) {
      console.error('Error loading similar places:', error);
      Alert.alert('Info', 'Could not load similar places. API quota may be exceeded.');
    } finally {
      setIsLoadingSimilar(false);
    }
  };

  /**
   * Navigate to this place - connects to Directions API
   */
  const handleNavigateHere = async () => {
    if (!currentLocation) {
      // Try to get current location
      try {
        const location = await geolocationService.getCurrentPosition();
        const origin = {
          lat: location.coords.latitude,
          lng: location.coords.longitude
        };
        
        navigateToPlace(origin);
      } catch (error) {
        Alert.alert('Location Required', 'Please enable location services to navigate.');
      }
      return;
    }

    navigateToPlace(currentLocation);
  };

  /**
   * Start navigation to place
   */
  const navigateToPlace = (origin: { lat: number; lng: number }) => {
    setIsNavigating(true);
    
    const destination = {
      lat: place.geometry.coordinates[1],
      lng: place.geometry.coordinates[0],
      name: place.properties.name,
      address: place.properties.label
    };

    navigation.navigate('Navigation' as never, {
      origin,
      destination,
      transport: selectedTransport
    } as never);
  };

  /**
   * Add/remove from favorites - Local storage only
   */
  const handleToggleFavorite = async () => {
    try {
      const favorites = await AsyncStorage.getItem(FAVORITES_STORAGE_KEY);
      let favoritePlaces = favorites ? JSON.parse(favorites) : [];

      if (placeDetails.isFavorite) {
        // Remove from favorites
        favoritePlaces = favoritePlaces.filter((fav: PointOfInterest) => 
          fav.properties.osm_id !== place.properties.osm_id
        );
      } else {
        // Add to favorites
        favoritePlaces.push(place);
      }

      await AsyncStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(favoritePlaces));
      
      setPlaceDetails(prev => ({ ...prev, isFavorite: !prev.isFavorite }));
      
      Alert.alert(
        placeDetails.isFavorite ? 'Removed from Favorites' : 'Added to Favorites',
        placeDetails.isFavorite 
          ? `${place.properties.name} was removed from your favorites.`
          : `${place.properties.name} was added to your favorites.`
      );
    } catch (error) {
      console.error('Error toggling favorite:', error);
      Alert.alert('Error', 'Could not update favorites.');
    }
  };

  /**
   * Share location - No API call
   */
  const handleShareLocation = async () => {
    try {
      const shareMessage = `Check out ${place.properties.name}!\n` +
        `Address: ${place.properties.label}\n` +
        `Location: ${place.geometry.coordinates[1]}, ${place.geometry.coordinates[0]}`;

      await Share.share({
        message: shareMessage,
        title: place.properties.name,
      });
    } catch (error) {
      console.error('Error sharing location:', error);
    }
  };

  /**
   * Navigate to similar place
   */
  const handleSimilarPlaceSelect = (similarPlace: PointOfInterest) => {
    navigation.push('PlaceDetails' as never, {
      place: similarPlace,
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
   * Get place category icon
   */
  const getCategoryIcon = (): keyof typeof Ionicons.glyphMap => {
    const tags = place.properties.osm_tags;
    if (tags?.amenity === 'restaurant') return 'restaurant';
    if (tags?.amenity === 'fuel') return 'car';
    if (tags?.amenity === 'hospital') return 'medical';
    if (tags?.shop) return 'storefront';
    if (tags?.tourism) return 'camera';
    return 'location';
  };

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
        <Text style={styles.headerTitle}>Place Details</Text>
        <TouchableOpacity 
          style={styles.shareButton}
          onPress={handleShareLocation}
        >
          <Ionicons name="share-outline" size={24} color="#333" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Place Information */}
        <View style={styles.placeCard}>
          <View style={styles.placeHeader}>
            <View style={styles.placeIconContainer}>
              <Ionicons name={getCategoryIcon()} size={32} color="#2196F3" />
            </View>
            <View style={styles.placeInfo}>
              <Text style={styles.placeName}>{place.properties.name}</Text>
              <Text style={styles.placeAddress}>{place.properties.label}</Text>
              {placeDetails.distance && (
                <View style={styles.distanceContainer}>
                  <Ionicons name="location-outline" size={16} color="#666" />
                  <Text style={styles.distanceText}>
                    {formatDistance(placeDetails.distance)}
                    {placeDetails.travelTime && ` • ${placeDetails.travelTime} min`}
                  </Text>
                </View>
              )}
            </View>
            <TouchableOpacity 
              style={styles.favoriteButton}
              onPress={handleToggleFavorite}
            >
              <Ionicons 
                name={placeDetails.isFavorite ? "heart" : "heart-outline"} 
                size={24} 
                color={placeDetails.isFavorite ? "#F44336" : "#666"} 
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* Transport Mode Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Transport Mode</Text>
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
                  size={20} 
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
        <View style={styles.section}>
          <TouchableOpacity 
            style={[styles.actionButton, styles.navigateButton]}
            onPress={handleNavigateHere}
            disabled={isNavigating}
          >
            {isNavigating ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <Ionicons name="navigate" size={20} color="white" />
            )}
            <Text style={styles.actionButtonText}>
              {isNavigating ? 'Starting...' : 'Navigate Here'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Similar Places */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Find Similar</Text>
            {isLoadingSimilar && <ActivityIndicator size="small" color="#2196F3" />}
          </View>
          
          {similarPlaces.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {similarPlaces.map((similarPlace, index) => (
                <TouchableOpacity
                  key={`similar-${index}`}
                  style={styles.similarPlaceCard}
                  onPress={() => handleSimilarPlaceSelect(similarPlace)}
                >
                  <View style={styles.similarPlaceIcon}>
                    <Ionicons name={getCategoryIcon()} size={20} color="#2196F3" />
                  </View>
                  <Text style={styles.similarPlaceName} numberOfLines={2}>
                    {similarPlace.properties.name}
                  </Text>
                  <Text style={styles.similarPlaceDistance}>
                    {currentLocation && formatDistance(
                      calculateDistance(
                        currentLocation.lat,
                        currentLocation.lng,
                        similarPlace.geometry.coordinates[1],
                        similarPlace.geometry.coordinates[0]
                      )
                    )}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          ) : !isLoadingSimilar && (
            <Text style={styles.noSimilarText}>No similar places found nearby</Text>
          )}
        </View>

        {/* Additional Info */}
        {place.properties.osm_tags && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Details</Text>
            <View style={styles.detailsContainer}>
              {Object.entries(place.properties.osm_tags).map(([key, value]) => (
                <View key={key} style={styles.detailItem}>
                  <Text style={styles.detailKey}>{key.replace('_', ' ')}:</Text>
                  <Text style={styles.detailValue}>{String(value)}</Text>
                </View>
              ))}
            </View>
          </View>
        )}
      </ScrollView>
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
  shareButton: {
    padding: 5,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  placeCard: {
    backgroundColor: '#f8f9fa',
    borderRadius: 15,
    padding: 20,
    marginBottom: 20,
  },
  placeHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  placeIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#E3F2FD',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 15,
  },
  placeInfo: {
    flex: 1,
  },
  placeName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
    marginBottom: 5,
  },
  placeAddress: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 8,
  },
  distanceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  distanceText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 4,
  },
  favoriteButton: {
    padding: 8,
  },
  section: {
    marginBottom: 25,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 15,
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
    paddingVertical: 12,
    marginHorizontal: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  transportText: {
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 6,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
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
  actionButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  similarPlaceCard: {
    width: 120,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginRight: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  similarPlaceIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E3F2FD',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  similarPlaceName: {
    fontSize: 12,
    fontWeight: '500',
    color: '#333',
    textAlign: 'center',
    marginBottom: 4,
  },
  similarPlaceDistance: {
    fontSize: 11,
    color: '#666',
    textAlign: 'center',
  },
  noSimilarText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  detailsContainer: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 15,
  },
  detailItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  detailKey: {
    fontSize: 14,
    color: '#666',
    textTransform: 'capitalize',
  },
  detailValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
    textTransform: 'capitalize',
  },
});