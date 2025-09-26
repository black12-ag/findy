/**
 * 📊 Route Options Page
 * 
 * Compare multiple routes and select preferences
 * Connected to: Directions API for alternatives, Matrix API for comparison
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
  Switch
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';

// Services
import { directionsService } from '../services/directionsService';
import { matrixService } from '../services/matrixService';
import type { RouteResponse, Route } from '../services/directionsService';

// Config
import { TransportProfile } from '../config/apiConfig';

interface RouteParams {
  origin: {
    lat: number;
    lng: number;
    name?: string;
    address?: string;
  };
  destination: {
    lat: number;
    lng: number;
    name?: string;
    address?: string;
  };
  transport: TransportProfile;
}

interface RouteOption {
  id: string;
  route: Route;
  polylineCoords: Array<{ latitude: number; longitude: number }>;
  isRecommended: boolean;
  routeType: 'fastest' | 'shortest' | 'balanced';
  color: string;
}

interface RoutePreferences {
  avoidTolls: boolean;
  avoidHighways: boolean;
  avoidFerries: boolean;
  preference: 'fastest' | 'shortest' | 'recommended';
}

interface Waypoint {
  lat: number;
  lng: number;
  name: string;
  order: number;
}

export default function RouteOptionsPage() {
  const route = useRoute();
  const navigation = useNavigation();
  
  const { origin, destination, transport } = route.params as RouteParams;
  
  // State
  const [routeOptions, setRouteOptions] = useState<RouteOption[]>([]);
  const [selectedRoute, setSelectedRoute] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isComparingRoutes, setIsComparingRoutes] = useState(false);
  const [waypoints, setWaypoints] = useState<Waypoint[]>([]);
  const [routePreferences, setRoutePreferences] = useState<RoutePreferences>({
    avoidTolls: false,
    avoidHighways: false,
    avoidFerries: false,
    preference: 'fastest'
  });

  const ROUTE_COLORS = ['#2196F3', '#4CAF50', '#FF9800', '#9C27B0', '#F44336'];

  // Load route alternatives on mount
  useEffect(() => {
    loadRouteAlternatives();
  }, [routePreferences]);

  /**
   * Load route alternatives using Directions API
   */
  const loadRouteAlternatives = async () => {
    try {
      setIsLoading(true);

      // Build coordinates array including waypoints
      const coordinates = [
        [origin.lng, origin.lat],
        ...waypoints
          .sort((a, b) => a.order - b.order)
          .map(wp => [wp.lng, wp.lat]),
        [destination.lng, destination.lat]
      ];

      // Get route alternatives
      const routeResponse = await directionsService.getRoute(
        [origin.lng, origin.lat],
        [destination.lng, destination.lat],
        transport,
        {
          geometries: 'geojson',
          steps: false,
          continue_straight: false,
          alternatives: true,
          alternative_routes: {
            target_count: 3,
            weight_factor: 1.4
          },
          options: {
            avoid_tolls: routePreferences.avoidTolls,
            avoid_highways: routePreferences.avoidHighways,
            avoid_ferries: routePreferences.avoidFerries
          }
        }
      );

      // Also get fastest and shortest routes separately
      const [fastestResponse, shortestResponse] = await Promise.all([
        directionsService.getRoute([origin.lng, origin.lat], [destination.lng, destination.lat], transport, {
          geometries: 'geojson',
          preference: 'fastest',
          alternatives: false,
          options: {
            avoid_tolls: routePreferences.avoidTolls,
            avoid_highways: routePreferences.avoidHighways,
            avoid_ferries: routePreferences.avoidFerries
          }
        }),
        directionsService.getRoute([origin.lng, origin.lat], [destination.lng, destination.lat], transport, {
          geometries: 'geojson',
          preference: 'shortest',
          alternatives: false,
          options: {
            avoid_tolls: routePreferences.avoidTolls,
            avoid_highways: routePreferences.avoidHighways,
            avoid_ferries: routePreferences.avoidFerries
          }
        })
      ]);

      // Combine all routes
      const allRoutes = [
        ...routeResponse.routes,
        ...fastestResponse.routes,
        ...shortestResponse.routes
      ];

      // Remove duplicates and create route options
      const uniqueRoutes = removeDuplicateRoutes(allRoutes);
      const options = uniqueRoutes.map((route, index) => ({
        id: `route-${index}`,
        route,
        polylineCoords: route.geometry.coordinates.map(([lng, lat]) => ({
          latitude: lat,
          longitude: lng
        })),
        isRecommended: index === 0, // First route is recommended
        routeType: determineRouteType(route, uniqueRoutes),
        color: ROUTE_COLORS[index % ROUTE_COLORS.length]
      }));

      setRouteOptions(options);
      setSelectedRoute(options[0]?.id || null);
    } catch (error) {
      console.error('Error loading route alternatives:', error);
      Alert.alert('Error', 'Unable to load route alternatives. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Compare routes using Matrix API
   */
  const handleCompareRoutes = async () => {
    if (routeOptions.length < 2) {
      Alert.alert('Info', 'Need at least 2 routes to compare.');
      return;
    }

    try {
      setIsComparingRoutes(true);
      
      // Use matrix API to get detailed comparison
      const locations = [
        { lat: origin.lat, lng: origin.lng, name: origin.name || 'Origin' },
        { lat: destination.lat, lng: destination.lng, name: destination.name || 'Destination' }
      ];

      const comparison = await matrixService.compareRoutes(
        locations[0],
        [locations[1]],
        transport
      );

      // Show comparison results
      const fastestRoute = routeOptions.find(opt => opt.routeType === 'fastest');
      const shortestRoute = routeOptions.find(opt => opt.routeType === 'shortest');

      Alert.alert(
        'Route Comparison',
        `Fastest Route: ${formatDuration(fastestRoute?.route.summary.duration || 0)}\n` +
        `Shortest Route: ${formatDistance(shortestRoute?.route.summary.distance || 0)}\n` +
        `Recommended: ${comparison.recommendations.fastest.durationFormatted}`,
        [{ text: 'OK' }]
      );
    } catch (error) {
      console.error('Error comparing routes:', error);
      Alert.alert('Error', 'Unable to compare routes. API quota may be exceeded.');
    } finally {
      setIsComparingRoutes(false);
    }
  };

  /**
   * Show route alternatives with different preferences
   */
  const handleShowAlternatives = () => {
    // Toggle between different preference types
    const preferences: Array<'fastest' | 'shortest' | 'recommended'> = ['fastest', 'shortest', 'recommended'];
    const currentIndex = preferences.indexOf(routePreferences.preference);
    const nextPreference = preferences[(currentIndex + 1) % preferences.length];
    
    setRoutePreferences(prev => ({ ...prev, preference: nextPreference }));
  };

  /**
   * Add waypoint (stop) to route
   */
  const handleAddStop = () => {
    Alert.alert(
      'Add Stop',
      'This feature allows you to add waypoints to your route for multiple stops.',
      [
        {
          text: 'Add Waypoint',
          onPress: () => {
            // For demo, add a waypoint halfway between origin and destination
            const midLat = (origin.lat + destination.lat) / 2;
            const midLng = (origin.lng + destination.lng) / 2;
            
            const newWaypoint: Waypoint = {
              lat: midLat,
              lng: midLng,
              name: `Stop ${waypoints.length + 1}`,
              order: waypoints.length
            };
            
            setWaypoints(prev => [...prev, newWaypoint]);
          }
        },
        { text: 'Cancel', style: 'cancel' }
      ]
    );
  };

  /**
   * Start navigation with selected route
   */
  const handleStartNavigation = () => {
    if (!selectedRoute) {
      Alert.alert('Error', 'Please select a route first.');
      return;
    }

    navigation.navigate('Navigation' as never, {
      origin,
      destination,
      transport,
      selectedRouteId: selectedRoute
    } as never);
  };

  /**
   * Remove duplicate routes based on similarity
   */
  const removeDuplicateRoutes = (routes: Route[]): Route[] => {
    const unique: Route[] = [];
    const tolerance = 0.1; // 10% tolerance for considering routes different

    routes.forEach(route => {
      const isDuplicate = unique.some(existing => {
        const timeDiff = Math.abs(existing.summary.duration - route.summary.duration) / existing.summary.duration;
        const distanceDiff = Math.abs(existing.summary.distance - route.summary.distance) / existing.summary.distance;
        return timeDiff < tolerance && distanceDiff < tolerance;
      });

      if (!isDuplicate) {
        unique.push(route);
      }
    });

    return unique.slice(0, 4); // Limit to 4 routes max
  };

  /**
   * Determine route type based on characteristics
   */
  const determineRouteType = (route: Route, allRoutes: Route[]): 'fastest' | 'shortest' | 'balanced' => {
    const fastestTime = Math.min(...allRoutes.map(r => r.summary.duration));
    const shortestDistance = Math.min(...allRoutes.map(r => r.summary.distance));

    if (route.summary.duration === fastestTime) return 'fastest';
    if (route.summary.distance === shortestDistance) return 'shortest';
    return 'balanced';
  };

  /**
   * Format duration in seconds
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
   * Format distance in meters
   */
  const formatDistance = (meters: number): string => {
    if (meters < 1000) {
      return `${Math.round(meters)}m`;
    }
    const km = meters / 1000;
    return `${km.toFixed(1)}km`;
  };

  /**
   * Get route type icon
   */
  const getRouteTypeIcon = (routeType: string): keyof typeof Ionicons.glyphMap => {
    switch (routeType) {
      case 'fastest': return 'flash';
      case 'shortest': return 'resize';
      default: return 'checkmark-circle';
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2196F3" />
        <Text style={styles.loadingText}>Loading route alternatives...</Text>
      </View>
    );
  }

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
        <Text style={styles.headerTitle}>Route Options</Text>
        <TouchableOpacity 
          style={styles.addStopButton}
          onPress={handleAddStop}
        >
          <Ionicons name="add-circle-outline" size={24} color="#2196F3" />
        </TouchableOpacity>
      </View>

      {/* Map */}
      <View style={styles.mapContainer}>
        <MapView
          style={styles.map}
          provider={PROVIDER_GOOGLE}
          initialRegion={{
            latitude: (origin.lat + destination.lat) / 2,
            longitude: (origin.lng + destination.lng) / 2,
            latitudeDelta: Math.abs(origin.lat - destination.lat) * 1.5,
            longitudeDelta: Math.abs(origin.lng - destination.lng) * 1.5,
          }}
        >
          {/* Origin Marker */}
          <Marker
            coordinate={{ latitude: origin.lat, longitude: origin.lng }}
            title="Origin"
            description={origin.address}
            pinColor="green"
          />

          {/* Destination Marker */}
          <Marker
            coordinate={{ latitude: destination.lat, longitude: destination.lng }}
            title="Destination"
            description={destination.address}
            pinColor="red"
          />

          {/* Waypoint Markers */}
          {waypoints.map((waypoint, index) => (
            <Marker
              key={`waypoint-${index}`}
              coordinate={{ latitude: waypoint.lat, longitude: waypoint.lng }}
              title={waypoint.name}
              pinColor="orange"
            />
          ))}

          {/* Route Polylines */}
          {routeOptions.map((option) => (
            <Polyline
              key={option.id}
              coordinates={option.polylineCoords}
              strokeColor={option.color}
              strokeWidth={selectedRoute === option.id ? 6 : 4}
              strokeOpacity={selectedRoute === option.id ? 1 : 0.7}
            />
          ))}
        </MapView>
      </View>

      {/* Route Options List */}
      <ScrollView style={styles.optionsContainer} showsVerticalScrollIndicator={false}>
        {/* Preferences */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Route Preferences</Text>
          
          <View style={styles.preferenceItem}>
            <View style={styles.preferenceInfo}>
              <Ionicons name="cash-outline" size={20} color="#666" />
              <Text style={styles.preferenceText}>Avoid Tolls</Text>
            </View>
            <Switch
              value={routePreferences.avoidTolls}
              onValueChange={(value) => 
                setRoutePreferences(prev => ({ ...prev, avoidTolls: value }))
              }
              trackColor={{ false: '#ccc', true: '#4CAF50' }}
            />
          </View>

          <View style={styles.preferenceItem}>
            <View style={styles.preferenceInfo}>
              <Ionicons name="speedometer-outline" size={20} color="#666" />
              <Text style={styles.preferenceText}>Avoid Highways</Text>
            </View>
            <Switch
              value={routePreferences.avoidHighways}
              onValueChange={(value) => 
                setRoutePreferences(prev => ({ ...prev, avoidHighways: value }))
              }
              trackColor={{ false: '#ccc', true: '#4CAF50' }}
            />
          </View>

          <View style={styles.preferenceItem}>
            <View style={styles.preferenceInfo}>
              <Ionicons name="boat-outline" size={20} color="#666" />
              <Text style={styles.preferenceText}>Avoid Ferries</Text>
            </View>
            <Switch
              value={routePreferences.avoidFerries}
              onValueChange={(value) => 
                setRoutePreferences(prev => ({ ...prev, avoidFerries: value }))
              }
              trackColor={{ false: '#ccc', true: '#4CAF50' }}
            />
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.section}>
          <View style={styles.actionButtons}>
            <TouchableOpacity 
              style={[styles.actionButton, styles.compareButton]}
              onPress={handleCompareRoutes}
              disabled={isComparingRoutes}
            >
              {isComparingRoutes ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <Ionicons name="analytics" size={20} color="white" />
              )}
              <Text style={styles.actionButtonText}>Compare Routes</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.actionButton, styles.alternativesButton]}
              onPress={handleShowAlternatives}
            >
              <Ionicons name="options" size={20} color="white" />
              <Text style={styles.actionButtonText}>Show Alternatives</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Route Options */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Available Routes</Text>
          {routeOptions.map((option) => (
            <TouchableOpacity
              key={option.id}
              style={[
                styles.routeOption,
                { borderColor: selectedRoute === option.id ? option.color : '#e0e0e0' }
              ]}
              onPress={() => setSelectedRoute(option.id)}
            >
              <View style={styles.routeHeader}>
                <View style={styles.routeInfo}>
                  <View style={styles.routeTypeContainer}>
                    <Ionicons 
                      name={getRouteTypeIcon(option.routeType)} 
                      size={20} 
                      color={option.color} 
                    />
                    <Text style={[styles.routeType, { color: option.color }]}>
                      {option.routeType.charAt(0).toUpperCase() + option.routeType.slice(1)}
                    </Text>
                    {option.isRecommended && (
                      <View style={styles.recommendedBadge}>
                        <Text style={styles.recommendedText}>Recommended</Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.routeStats}>
                    <Text style={styles.routeDuration}>
                      {formatDuration(option.route.summary.duration)}
                    </Text>
                    <Text style={styles.routeDistance}>
                      {formatDistance(option.route.summary.distance)}
                    </Text>
                  </View>
                </View>
                <View style={styles.routeIndicator}>
                  <View 
                    style={[
                      styles.colorIndicator, 
                      { backgroundColor: option.color }
                    ]} 
                  />
                  {selectedRoute === option.id && (
                    <Ionicons name="checkmark-circle" size={24} color={option.color} />
                  )}
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* Waypoints */}
        {waypoints.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Waypoints ({waypoints.length})</Text>
            {waypoints.map((waypoint, index) => (
              <View key={index} style={styles.waypointItem}>
                <Ionicons name="location" size={20} color="#FF9800" />
                <Text style={styles.waypointText}>{waypoint.name}</Text>
                <TouchableOpacity
                  style={styles.removeWaypoint}
                  onPress={() => setWaypoints(prev => prev.filter((_, i) => i !== index))}
                >
                  <Ionicons name="close-circle" size={20} color="#F44336" />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {/* Start Navigation Button */}
        <View style={styles.section}>
          <TouchableOpacity 
            style={[styles.actionButton, styles.startButton]}
            onPress={handleStartNavigation}
          >
            <Ionicons name="navigate" size={20} color="white" />
            <Text style={styles.actionButtonText}>Start Navigation</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
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
  addStopButton: {
    padding: 5,
  },
  mapContainer: {
    height: 250,
  },
  map: {
    flex: 1,
  },
  optionsContainer: {
    flex: 1,
    padding: 20,
  },
  section: {
    marginBottom: 25,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 15,
  },
  preferenceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  preferenceInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  preferenceText: {
    fontSize: 16,
    color: '#333',
    marginLeft: 12,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 25,
    marginHorizontal: 4,
  },
  compareButton: {
    backgroundColor: '#2196F3',
  },
  alternativesButton: {
    backgroundColor: '#FF9800',
  },
  startButton: {
    backgroundColor: '#4CAF50',
  },
  actionButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  routeOption: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 15,
    marginBottom: 10,
    borderWidth: 2,
  },
  routeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  routeInfo: {
    flex: 1,
  },
  routeTypeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  routeType: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  recommendedBadge: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    marginLeft: 8,
  },
  recommendedText: {
    color: 'white',
    fontSize: 10,
    fontWeight: '500',
  },
  routeStats: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  routeDuration: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    marginRight: 12,
  },
  routeDistance: {
    fontSize: 14,
    color: '#666',
  },
  routeIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  colorIndicator: {
    width: 20,
    height: 20,
    borderRadius: 10,
    marginRight: 8,
  },
  waypointItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 15,
    backgroundColor: '#fff3e0',
    borderRadius: 8,
    marginBottom: 8,
  },
  waypointText: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    marginLeft: 12,
  },
  removeWaypoint: {
    padding: 4,
  },
});