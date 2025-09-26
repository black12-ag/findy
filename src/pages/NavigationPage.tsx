/**
 * 🧭 Real-Time Navigation Page
 * 
 * Provides turn-by-turn navigation with real-time updates,
 * voice guidance, and live tracking
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Platform,
  Dimensions,
  AppState,
  AppStateStatus
} from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE, Region } from 'react-native-maps';
import { useRoute, useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';

// Services
import { directionsService } from '../services/directionsService';
import { geolocationService } from '../services/geolocationService';
import type { RouteResponse, Step, RouteInstruction } from '../services/directionsService';

// Config
import { TransportProfile } from '../config/apiConfig';

interface LocationState {
  lat: number;
  lng: number;
  address?: string;
  name?: string;
}

interface RouteParams {
  origin: LocationState;
  destination: LocationState;
  transport: TransportProfile;
}

interface NavigationState {
  currentRoute: RouteResponse | null;
  currentPosition: LocationState | null;
  currentStepIndex: number;
  distanceToNextStep: number;
  timeToDestination: number;
  isRerouting: boolean;
  hasArrived: boolean;
  bearingToNext: number;
}

const { width, height } = Dimensions.get('window');
const REROUTE_THRESHOLD = 50; // meters off route before rerouting
const UPDATE_INTERVAL = 5000; // 5 seconds between position updates
const ARRIVAL_THRESHOLD = 20; // meters from destination to consider arrived

export default function NavigationPage() {
  const route = useRoute();
  const navigation = useNavigation();
  const mapRef = useRef<MapView>(null);
  const locationSubscription = useRef<Location.LocationSubscription | null>(null);
  const updateTimer = useRef<NodeJS.Timeout | null>(null);
  
  const { origin, destination, transport } = route.params as RouteParams;
  
  // Navigation state
  const [navState, setNavState] = useState<NavigationState>({
    currentRoute: null,
    currentPosition: null,
    currentStepIndex: 0,
    distanceToNextStep: 0,
    timeToDestination: 0,
    isRerouting: false,
    hasArrived: false,
    bearingToNext: 0
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isTrackingLocation, setIsTrackingLocation] = useState(false);
  const [routePolylineCoords, setRoutePolylineCoords] = useState<Array<{latitude: number, longitude: number}>>([]);
  
  const [mapRegion, setMapRegion] = useState<Region>({
    latitude: origin.lat,
    longitude: origin.lng,
    latitudeDelta: 0.01,
    longitudeDelta: 0.01,
  });

  // Initialize navigation on mount
  useEffect(() => {
    initializeNavigation();
    return cleanup;
  }, []);

  // Handle app state changes
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        startLocationTracking();
      } else {
        stopLocationTracking();
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription?.remove();
  }, []);

  // Focus effect for navigation
  useFocusEffect(
    useCallback(() => {
      startLocationTracking();
      return () => stopLocationTracking();
    }, [])
  );

  /**
   * Initialize navigation with route calculation
   */
  const initializeNavigation = async () => {
    try {
      setIsLoading(true);
      
      // Calculate initial route
      const routeResponse = await directionsService.getRoute(
        [origin.lng, origin.lat],
        [destination.lng, destination.lat],
        transport,
        {
          geometries: 'geojson',
          steps: true,
          continue_straight: false,
          alternatives: false
        }
      );

      if (routeResponse.routes.length === 0) {
        throw new Error('No route found');
      }

      const initialRoute = routeResponse.routes[0];
      
      // Convert route coordinates for map polyline
      const polylineCoords = initialRoute.geometry.coordinates.map(([lng, lat]) => ({
        latitude: lat,
        longitude: lng
      }));
      
      setRoutePolylineCoords(polylineCoords);
      
      // Initialize navigation state
      setNavState(prev => ({
        ...prev,
        currentRoute: routeResponse,
        timeToDestination: initialRoute.summary.duration
      }));

      // Start location tracking
      await startLocationTracking();
      
    } catch (error) {
      console.error('Navigation initialization error:', error);
      Alert.alert(
        'Navigation Error',
        'Unable to calculate route. Please try again.',
        [
          { text: 'Retry', onPress: initializeNavigation },
          { text: 'Cancel', onPress: () => navigation.goBack() }
        ]
      );
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Start location tracking
   */
  const startLocationTracking = async () => {
    try {
      // Request location permissions
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location access is required for navigation.');
        return;
      }

      setIsTrackingLocation(true);
      
      // Start location subscription
      locationSubscription.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.BestForNavigation,
          timeInterval: 1000, // Update every second
          distanceInterval: 5, // Update every 5 meters
        },
        handleLocationUpdate
      );

      // Set update timer for route recalculation
      updateTimer.current = setInterval(() => {
        updateNavigationState();
      }, UPDATE_INTERVAL);

    } catch (error) {
      console.error('Location tracking error:', error);
      Alert.alert('Location Error', 'Unable to start location tracking.');
    }
  };

  /**
   * Stop location tracking
   */
  const stopLocationTracking = () => {
    setIsTrackingLocation(false);
    
    if (locationSubscription.current) {
      locationSubscription.current.remove();
      locationSubscription.current = null;
    }
    
    if (updateTimer.current) {
      clearInterval(updateTimer.current);
      updateTimer.current = null;
    }
  };

  /**
   * Handle location updates
   */
  const handleLocationUpdate = (location: Location.LocationObject) => {
    const currentPos = {
      lat: location.coords.latitude,
      lng: location.coords.longitude
    };

    setNavState(prev => ({ ...prev, currentPosition: currentPos }));
    
    // Update map region to follow current position
    setMapRegion(prevRegion => ({
      ...prevRegion,
      latitude: currentPos.lat,
      longitude: currentPos.lng
    }));

    // Check if arrived at destination
    const distanceToDestination = calculateDistance(
      currentPos.lat,
      currentPos.lng,
      destination.lat,
      destination.lng
    );

    if (distanceToDestination <= ARRIVAL_THRESHOLD) {
      handleArrival();
    }
  };

  /**
   * Update navigation state
   */
  const updateNavigationState = () => {
    if (!navState.currentRoute || !navState.currentPosition) return;

    const route = navState.currentRoute.routes[0];
    const steps = route.segments[0]?.steps || [];
    
    if (steps.length === 0) return;

    // Find current step
    let currentStep = navState.currentStepIndex;
    let distanceToNext = 0;
    
    // Calculate distance to next step
    if (currentStep < steps.length) {
      const nextStep = steps[currentStep];
      const stepCoords = nextStep.geometry.coordinates[0];
      distanceToNext = calculateDistance(
        navState.currentPosition.lat,
        navState.currentPosition.lng,
        stepCoords[1],
        stepCoords[0]
      );

      // If close to current step, advance to next
      if (distanceToNext <= 20 && currentStep < steps.length - 1) {
        currentStep++;
      }
    }

    // Calculate bearing to next step
    const bearing = currentStep < steps.length 
      ? calculateBearing(navState.currentPosition, steps[currentStep])
      : 0;

    setNavState(prev => ({
      ...prev,
      currentStepIndex: currentStep,
      distanceToNextStep: distanceToNext,
      bearingToNext: bearing
    }));

    // Check if we need to reroute
    checkForReroute();
  };

  /**
   * Check if rerouting is needed
   */
  const checkForReroute = async () => {
    if (!navState.currentPosition || !navState.currentRoute || navState.isRerouting) {
      return;
    }

    // Calculate distance from current position to route
    const distanceFromRoute = calculateDistanceToRoute(
      navState.currentPosition,
      routePolylineCoords
    );

    if (distanceFromRoute > REROUTE_THRESHOLD) {
      await rerouteNavigation();
    }
  };

  /**
   * Recalculate route from current position
   */
  const rerouteNavigation = async () => {
    if (!navState.currentPosition) return;

    setNavState(prev => ({ ...prev, isRerouting: true }));
    
    try {
      const newRoute = await directionsService.getRoute(
        [navState.currentPosition.lng, navState.currentPosition.lat],
        [destination.lng, destination.lat],
        transport,
        {
          geometries: 'geojson',
          steps: true,
          continue_straight: false
        }
      );

      if (newRoute.routes.length > 0) {
        const route = newRoute.routes[0];
        
        // Update polyline coordinates
        const newPolylineCoords = route.geometry.coordinates.map(([lng, lat]) => ({
          latitude: lat,
          longitude: lng
        }));
        
        setRoutePolylineCoords(newPolylineCoords);
        
        setNavState(prev => ({
          ...prev,
          currentRoute: newRoute,
          currentStepIndex: 0,
          timeToDestination: route.summary.duration,
          isRerouting: false
        }));
      }
    } catch (error) {
      console.error('Rerouting error:', error);
      setNavState(prev => ({ ...prev, isRerouting: false }));
    }
  };

  /**
   * Handle arrival at destination
   */
  const handleArrival = () => {
    setNavState(prev => ({ ...prev, hasArrived: true }));
    stopLocationTracking();
    
    Alert.alert(
      '🎉 Arrived!',
      'You have reached your destination.',
      [
        { text: 'Finish Navigation', onPress: () => navigation.goBack() }
      ]
    );
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
   * Calculate bearing between current position and step
   */
  const calculateBearing = (from: LocationState, step: Step): number => {
    const stepCoords = step.geometry.coordinates[0];
    const lat1 = from.lat * Math.PI/180;
    const lat2 = stepCoords[1] * Math.PI/180;
    const deltaLng = (stepCoords[0] - from.lng) * Math.PI/180;

    const y = Math.sin(deltaLng) * Math.cos(lat2);
    const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLng);

    const bearing = Math.atan2(y, x);
    return (bearing * 180/Math.PI + 360) % 360;
  };

  /**
   * Calculate distance from point to route polyline
   */
  const calculateDistanceToRoute = (position: LocationState, routeCoords: Array<{latitude: number, longitude: number}>): number => {
    let minDistance = Infinity;
    
    for (let i = 0; i < routeCoords.length - 1; i++) {
      const segmentDistance = calculateDistanceToLineSegment(
        position,
        routeCoords[i],
        routeCoords[i + 1]
      );
      minDistance = Math.min(minDistance, segmentDistance);
    }
    
    return minDistance;
  };

  /**
   * Calculate distance from point to line segment
   */
  const calculateDistanceToLineSegment = (
    point: LocationState,
    lineStart: {latitude: number, longitude: number},
    lineEnd: {latitude: number, longitude: number}
  ): number => {
    const A = point.lat - lineStart.latitude;
    const B = point.lng - lineStart.longitude;
    const C = lineEnd.latitude - lineStart.latitude;
    const D = lineEnd.longitude - lineStart.longitude;

    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    let param = -1;
    
    if (lenSq !== 0) {
      param = dot / lenSq;
    }

    let xx, yy;

    if (param < 0) {
      xx = lineStart.latitude;
      yy = lineStart.longitude;
    } else if (param > 1) {
      xx = lineEnd.latitude;
      yy = lineEnd.longitude;
    } else {
      xx = lineStart.latitude + param * C;
      yy = lineStart.longitude + param * D;
    }

    return calculateDistance(point.lat, point.lng, xx, yy);
  };

  /**
   * Format time duration
   */
  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  /**
   * Format distance
   */
  const formatDistance = (meters: number): string => {
    if (meters < 1000) {
      return `${Math.round(meters)}m`;
    }
    const km = meters / 1000;
    return `${km.toFixed(1)}km`;
  };

  /**
   * Get current instruction
   */
  const getCurrentInstruction = (): string => {
    if (!navState.currentRoute || navState.currentStepIndex >= navState.currentRoute.routes[0].segments[0].steps.length) {
      return "Continue to destination";
    }

    const step = navState.currentRoute.routes[0].segments[0].steps[navState.currentStepIndex];
    return step.instruction || "Continue straight";
  };

  /**
   * Cleanup function
   */
  const cleanup = () => {
    stopLocationTracking();
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2196F3" />
        <Text style={styles.loadingText}>Calculating route...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Map */}
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        region={mapRegion}
        showsUserLocation={true}
        showsMyLocationButton={false}
        followsUserLocation={true}
        userLocationUpdateInterval={1000}
        mapType="standard"
      >
        {/* Destination Marker */}
        <Marker
          coordinate={{ latitude: destination.lat, longitude: destination.lng }}
          title="Destination"
          description={destination.address || destination.name}
          pinColor="red"
        />

        {/* Route Polyline */}
        {routePolylineCoords.length > 0 && (
          <Polyline
            coordinates={routePolylineCoords}
            strokeColor="#2196F3"
            strokeWidth={5}
            strokeOpacity={0.8}
          />
        )}
      </MapView>

      {/* Navigation Controls */}
      <View style={styles.controlsContainer}>
        {/* Exit Navigation */}
        <TouchableOpacity 
          style={styles.exitButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="close" size={24} color="white" />
        </TouchableOpacity>
      </View>

      {/* Navigation Info Panel */}
      <View style={styles.infoPanel}>
        {navState.isRerouting && (
          <View style={styles.reroutingBanner}>
            <ActivityIndicator size="small" color="white" />
            <Text style={styles.reroutingText}>Recalculating route...</Text>
          </View>
        )}
        
        <View style={styles.instructionContainer}>
          <View style={styles.distanceInfo}>
            <Text style={styles.distanceText}>
              {formatDistance(navState.distanceToNextStep)}
            </Text>
            <Text style={styles.etaText}>
              {formatDuration(navState.timeToDestination)} to destination
            </Text>
          </View>
          
          <Text style={styles.instructionText}>
            {getCurrentInstruction()}
          </Text>
        </View>

        {/* Status Indicators */}
        <View style={styles.statusContainer}>
          <View style={[styles.statusDot, { backgroundColor: isTrackingLocation ? '#4CAF50' : '#F44336' }]} />
          <Text style={styles.statusText}>
            {isTrackingLocation ? 'GPS Active' : 'GPS Inactive'}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#333',
  },
  map: {
    flex: 1,
  },
  controlsContainer: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 20,
    right: 20,
    zIndex: 1000,
  },
  exitButton: {
    backgroundColor: '#F44336',
    borderRadius: 25,
    width: 50,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  infoPanel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  reroutingBanner: {
    backgroundColor: '#FF9800',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    marginHorizontal: 20,
    borderRadius: 8,
    marginBottom: 15,
  },
  reroutingText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 8,
  },
  instructionContainer: {
    paddingHorizontal: 20,
    marginBottom: 15,
  },
  distanceInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  distanceText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#2196F3',
  },
  etaText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'right',
  },
  instructionText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    lineHeight: 26,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  statusText: {
    fontSize: 12,
    color: '#666',
  },
});