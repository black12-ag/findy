/**
 * 🎯 Reachability Analysis Page
 * 
 * Shows areas reachable within specified time limits using isochrones
 * Connected to: Isochrones API service for time-based coverage analysis
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView,
  Dimensions,
  Platform
} from 'react-native';
import MapView, { Marker, Polygon, PROVIDER_GOOGLE, Region } from 'react-native-maps';
import { useRoute, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';

// Services
import { isochronesService } from '../services/isochronesService';
import type { ReachabilityArea, AccessibilityMap } from '../services/isochronesService';

// Config
import { TransportProfile } from '../config/apiConfig';

interface LocationState {
  lat: number;
  lng: number;
  address?: string;
  name?: string;
}

interface RouteParams {
  location: LocationState;
  transport: TransportProfile;
}

const TIME_PRESETS = [5, 10, 15, 30, 45, 60]; // minutes

const TRANSPORT_MODES = [
  { id: 'driving-car', name: 'Car', icon: 'car', color: '#2196F3' },
  { id: 'walking', name: 'Walk', icon: 'walk', color: '#4CAF50' },
  { id: 'cycling-regular', name: 'Bike', icon: 'bicycle', color: '#FF9800' },
  { id: 'public-transport', name: 'Transit', icon: 'bus', color: '#9C27B0' }
] as const;

const { width } = Dimensions.get('window');

export default function ReachabilityPage() {
  const route = useRoute();
  const navigation = useNavigation();
  const mapRef = useRef<MapView>(null);
  
  const { location, transport } = route.params as RouteParams;
  
  // State
  const [selectedTime, setSelectedTime] = useState(15); // Default 15 minutes
  const [selectedTransport, setSelectedTransport] = useState<TransportProfile>(transport);
  const [reachabilityData, setReachabilityData] = useState<AccessibilityMap | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showingMultipleRanges, setShowingMultipleRanges] = useState(false);
  const [customTimeRanges, setCustomTimeRanges] = useState<number[]>([5, 10, 15]);
  
  const [mapRegion, setMapRegion] = useState<Region>({
    latitude: location.lat,
    longitude: location.lng,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  });

  // Load reachability data on mount and when parameters change
  useEffect(() => {
    loadReachabilityData();
  }, [selectedTime, selectedTransport]);

  /**
   * Load reachability analysis
   */
  const loadReachabilityData = async () => {
    setIsLoading(true);
    
    try {
      let data: AccessibilityMap;
      
      if (showingMultipleRanges) {
        // Load multiple time ranges
        data = await isochronesService.getAccessibilityMap(
          [location.lng, location.lat],
          customTimeRanges,
          selectedTransport
        );
      } else {
        // Load single time range
        data = await isochronesService.calculateReachability(
          [location.lng, location.lat],
          selectedTime,
          selectedTransport
        );
      }
      
      setReachabilityData(data);
      
      // Adjust map region to fit all areas
      if (data.areas.length > 0) {
        const bounds = calculateBounds(data.areas);
        setMapRegion({
          latitude: (bounds.north + bounds.south) / 2,
          longitude: (bounds.east + bounds.west) / 2,
          latitudeDelta: Math.abs(bounds.north - bounds.south) * 1.2,
          longitudeDelta: Math.abs(bounds.east - bounds.west) * 1.2,
        });
      }
    } catch (error) {
      console.error('Reachability error:', error);
      Alert.alert(
        'Analysis Error',
        'Unable to calculate reachability. Please check your quota and try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Calculate bounds for all reachability areas
   */
  const calculateBounds = (areas: ReachabilityArea[]) => {
    let north = -90, south = 90, east = -180, west = 180;
    
    areas.forEach(area => {
      north = Math.max(north, area.bounds.north);
      south = Math.min(south, area.bounds.south);
      east = Math.max(east, area.bounds.east);
      west = Math.min(west, area.bounds.west);
    });
    
    return { north, south, east, west };
  };

  /**
   * Convert polygon coordinates for react-native-maps
   */
  const convertPolygonCoordinates = (coordinates: number[][][]) => {
    return coordinates[0].map(([lng, lat]) => ({
      latitude: lat,
      longitude: lng
    }));
  };

  /**
   * Handle time preset selection
   */
  const handleTimePresetSelect = (time: number) => {
    setSelectedTime(time);
    setShowingMultipleRanges(false);
  };

  /**
   * Handle transport mode change
   */
  const handleTransportChange = (transport: TransportProfile) => {
    setSelectedTransport(transport);
  };

  /**
   * Toggle between single and multiple range view
   */
  const toggleMultipleRanges = () => {
    setShowingMultipleRanges(!showingMultipleRanges);
    if (!showingMultipleRanges) {
      setCustomTimeRanges([5, 10, 15, 30]);
    }
  };

  /**
   * Show reachable area for single time
   */
  const showSingleReachableArea = async () => {
    setIsLoading(true);
    setShowingMultipleRanges(false);
    
    try {
      const area = await isochronesService.getReachableArea(
        [location.lng, location.lat],
        selectedTime,
        selectedTransport
      );
      
      // Create accessibility map with single area
      const data: AccessibilityMap = {
        location: {
          lat: location.lat,
          lng: location.lng,
          name: location.name
        },
        profile: selectedTransport,
        areas: [area],
        summary: {
          maxTimeMinutes: selectedTime,
          totalAreaSqKm: area.area.sqKm,
          averageReachability: area.reachabilityScore || 0,
          populationReached: area.population
        },
        visualization: {
          colors: ['#4CAF50'],
          opacities: [0.6],
          timeIntervals: [selectedTime]
        }
      };
      
      setReachabilityData(data);
      
      // Fit map to area
      setMapRegion({
        latitude: (area.bounds.north + area.bounds.south) / 2,
        longitude: (area.bounds.east + area.bounds.west) / 2,
        latitudeDelta: Math.abs(area.bounds.north - area.bounds.south) * 1.2,
        longitudeDelta: Math.abs(area.bounds.east - area.bounds.west) * 1.2,
      });
      
    } catch (error) {
      console.error('Single area error:', error);
      Alert.alert('Error', 'Unable to calculate reachable area.');
    } finally {
      setIsLoading(false);
    }
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
        <Text style={styles.headerTitle}>Reachability Analysis</Text>
        <View style={styles.headerRight} />
      </View>

      {/* Map */}
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        region={mapRegion}
        onRegionChangeComplete={setMapRegion}
      >
        {/* Origin Marker */}
        <Marker
          coordinate={{ latitude: location.lat, longitude: location.lng }}
          title="Origin"
          description={location.address || location.name}
          pinColor="blue"
        />

        {/* Reachability Polygons */}
        {reachabilityData?.areas.map((area, index) => {
          if (area.geometry.type === 'Polygon') {
            return (
              <Polygon
                key={`area-${index}`}
                coordinates={convertPolygonCoordinates(area.geometry.coordinates)}
                fillColor={reachabilityData.visualization.colors[index] || '#4CAF50'}
                fillOpacity={reachabilityData.visualization.opacities[index] || 0.3}
                strokeColor={reachabilityData.visualization.colors[index] || '#4CAF50'}
                strokeWidth={2}
                strokeOpacity={0.8}
              />
            );
          }
          return null;
        })}
      </MapView>

      {/* Controls Panel */}
      <ScrollView style={styles.controlsPanel} showsVerticalScrollIndicator={false}>
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
                onPress={() => handleTransportChange(mode.id)}
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

        {/* Time Selection */}
        {!showingMultipleRanges && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Time Limit: {selectedTime} minutes</Text>
            
            {/* Time Presets */}
            <View style={styles.timePresets}>
              {TIME_PRESETS.map((time) => (
                <TouchableOpacity
                  key={time}
                  style={[
                    styles.timePreset,
                    { backgroundColor: selectedTime === time ? '#2196F3' : '#f0f0f0' }
                  ]}
                  onPress={() => handleTimePresetSelect(time)}
                >
                  <Text style={[
                    styles.timePresetText,
                    { color: selectedTime === time ? 'white' : '#333' }
                  ]}>
                    {time}m
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Custom Time Slider */}
            <View style={styles.sliderContainer}>
              <Text style={styles.sliderLabel}>Custom: {selectedTime} min</Text>
              <Slider
                style={styles.slider}
                minimumValue={5}
                maximumValue={120}
                step={5}
                value={selectedTime}
                onValueChange={setSelectedTime}
                minimumTrackTintColor="#2196F3"
                maximumTrackTintColor="#ccc"
                thumbStyle={{ backgroundColor: '#2196F3' }}
              />
            </View>
          </View>
        )}

        {/* Analysis Actions */}
        <View style={styles.section}>
          <TouchableOpacity 
            style={[styles.actionButton, styles.showAreaButton]}
            onPress={showSingleReachableArea}
            disabled={isLoading}
          >
            <Ionicons name="location" size={20} color="white" />
            <Text style={styles.actionButtonText}>
              {isLoading ? 'Calculating...' : 'Show Reachable Area'}
            </Text>
            {isLoading && <ActivityIndicator size="small" color="white" style={{ marginLeft: 8 }} />}
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.actionButton, styles.multiRangeButton]}
            onPress={toggleMultipleRanges}
          >
            <Ionicons name="layers" size={20} color="white" />
            <Text style={styles.actionButtonText}>
              {showingMultipleRanges ? 'Single Range' : 'Multiple Ranges'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Analysis Results */}
        {reachabilityData && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Analysis Results</Text>
            <View style={styles.resultsContainer}>
              <View style={styles.resultItem}>
                <Text style={styles.resultLabel}>Max Time:</Text>
                <Text style={styles.resultValue}>{reachabilityData.summary.maxTimeMinutes} min</Text>
              </View>
              <View style={styles.resultItem}>
                <Text style={styles.resultLabel}>Total Area:</Text>
                <Text style={styles.resultValue}>{reachabilityData.summary.totalAreaSqKm.toFixed(1)} km²</Text>
              </View>
              <View style={styles.resultItem}>
                <Text style={styles.resultLabel}>Accessibility Score:</Text>
                <Text style={styles.resultValue}>{Math.round(reachabilityData.summary.averageReachability)}/100</Text>
              </View>
              {reachabilityData.summary.populationReached && (
                <View style={styles.resultItem}>
                  <Text style={styles.resultLabel}>Population:</Text>
                  <Text style={styles.resultValue}>{reachabilityData.summary.populationReached.toLocaleString()}</Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Area Breakdown */}
        {reachabilityData && reachabilityData.areas.length > 1 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Time Intervals</Text>
            {reachabilityData.areas.map((area, index) => (
              <View key={index} style={styles.areaItem}>
                <View 
                  style={[
                    styles.areaColor, 
                    { backgroundColor: reachabilityData.visualization.colors[index] }
                  ]} 
                />
                <Text style={styles.areaTime}>{area.timeMinutes} min</Text>
                <Text style={styles.areaSize}>{area.area.formatted}</Text>
              </View>
            ))}
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
  headerRight: {
    width: 34, // Same as back button to center title
  },
  map: {
    flex: 1,
  },
  controlsPanel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'white',
    maxHeight: '50%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 20,
    paddingHorizontal: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
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
    paddingVertical: 10,
    marginHorizontal: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  transportText: {
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 6,
  },
  timePresets: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 15,
  },
  timePreset: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    marginBottom: 8,
  },
  timePresetText: {
    fontSize: 14,
    fontWeight: '500',
  },
  sliderContainer: {
    marginTop: 10,
  },
  sliderLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  slider: {
    width: '100%',
    height: 40,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 25,
    marginBottom: 10,
  },
  showAreaButton: {
    backgroundColor: '#4CAF50',
  },
  multiRangeButton: {
    backgroundColor: '#FF9800',
  },
  actionButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  resultsContainer: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 15,
  },
  resultItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  resultLabel: {
    fontSize: 14,
    color: '#666',
  },
  resultValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  areaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  areaColor: {
    width: 20,
    height: 20,
    borderRadius: 10,
    marginRight: 12,
  },
  areaTime: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    minWidth: 60,
  },
  areaSize: {
    fontSize: 14,
    color: '#666',
    marginLeft: 'auto',
  },
});