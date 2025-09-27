import React, { createContext, useContext, useReducer, useEffect, ReactNode, useCallback } from 'react';
import { useGeolocation, GeolocationPosition } from '../services/geolocationService';
import { logger } from '../utils/logger';
import { toast } from 'sonner';

// Location types
export interface LocationData {
  lat: number;
  lng: number;
  accuracy?: number;
  altitude?: number;
  speed?: number;
  heading?: number;
  timestamp: number;
}

export interface PlaceLocation {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  category?: string;
}

// Location context state
interface LocationState {
  // Current GPS location
  currentLocation: LocationData | null;
  
  // Selected locations
  selectedLocation: PlaceLocation | null;
  previousLocation: PlaceLocation | null;
  
  // GPS status
  isTrackingLocation: boolean;
  permissionStatus: PermissionState | 'unknown';
  locationError: string | null;
  accuracy: 'high' | 'medium' | 'low' | 'unknown';
  
  // Location history
  locationHistory: LocationData[];
  maxHistoryItems: number;
  
  // Settings
  highAccuracy: boolean;
  backgroundTracking: boolean;
  shareLocation: boolean;
}

// Initial state
const initialState: LocationState = {
  currentLocation: null,
  selectedLocation: null,
  previousLocation: null,
  isTrackingLocation: false,
  permissionStatus: 'unknown',
  locationError: null,
  accuracy: 'unknown',
  locationHistory: [],
  maxHistoryItems: 100,
  highAccuracy: true,
  backgroundTracking: false,
  shareLocation: false,
};

// Action types
type LocationAction =
  | { type: 'SET_CURRENT_LOCATION'; location: LocationData }
  | { type: 'SET_SELECTED_LOCATION'; location: PlaceLocation | null }
  | { type: 'SET_TRACKING_STATUS'; isTracking: boolean }
  | { type: 'SET_PERMISSION_STATUS'; status: PermissionState }
  | { type: 'SET_LOCATION_ERROR'; error: string | null }
  | { type: 'SET_ACCURACY'; accuracy: 'high' | 'medium' | 'low' | 'unknown' }
  | { type: 'ADD_TO_HISTORY'; location: LocationData }
  | { type: 'CLEAR_HISTORY' }
  | { type: 'UPDATE_SETTINGS'; settings: Partial<Pick<LocationState, 'highAccuracy' | 'backgroundTracking' | 'shareLocation'>> };

// Reducer
function locationReducer(state: LocationState, action: LocationAction): LocationState {
  switch (action.type) {
    case 'SET_CURRENT_LOCATION':
      return {
        ...state,
        currentLocation: action.location,
        locationError: null,
      };

    case 'SET_SELECTED_LOCATION':
      return {
        ...state,
        previousLocation: state.selectedLocation,
        selectedLocation: action.location,
      };

    case 'SET_TRACKING_STATUS':
      return {
        ...state,
        isTrackingLocation: action.isTracking,
      };

    case 'SET_PERMISSION_STATUS':
      return {
        ...state,
        permissionStatus: action.status,
      };

    case 'SET_LOCATION_ERROR':
      return {
        ...state,
        locationError: action.error,
      };

    case 'SET_ACCURACY':
      return {
        ...state,
        accuracy: action.accuracy,
      };

    case 'ADD_TO_HISTORY':
      const newHistory = [action.location, ...state.locationHistory];
      return {
        ...state,
        locationHistory: newHistory.slice(0, state.maxHistoryItems),
      };

    case 'CLEAR_HISTORY':
      return {
        ...state,
        locationHistory: [],
      };

    case 'UPDATE_SETTINGS':
      return {
        ...state,
        ...action.settings,
      };

    default:
      return state;
  }
}

// Context type
interface LocationContextType extends LocationState {
  // Actions
  startLocationTracking: () => Promise<void>;
  stopLocationTracking: () => void;
  selectLocation: (location: PlaceLocation | null) => void;
  updateLocationSettings: (settings: Partial<Pick<LocationState, 'highAccuracy' | 'backgroundTracking' | 'shareLocation'>>) => void;
  clearLocationHistory: () => void;
  getCurrentPosition: () => Promise<LocationData>;
  
  // Utilities
  getDistanceTo: (location: PlaceLocation) => number | null;
  getBearingTo: (location: PlaceLocation) => number | null;
  isLocationAccurate: () => boolean;
}

// Create context
const LocationContext = createContext<LocationContextType | undefined>(undefined);

// Provider component
interface LocationProviderProps {
  children: ReactNode;
}

export function LocationProvider({ children }: LocationProviderProps) {
  const [state, dispatch] = useReducer(locationReducer, initialState);

  // DEV-ONLY: Set default location only once on mount
  useEffect(() => {
    if (import.meta.env.DEV && !state.currentLocation) {
      const defaultDevLocation: LocationData = {
        lat: 37.7749, // San Francisco
        lng: -122.4194,
        accuracy: 10,
        altitude: 50,
        speed: 0,
        heading: 0,
        timestamp: Date.now(),
      };
      dispatch({ type: 'SET_CURRENT_LOCATION', location: defaultDevLocation });
      dispatch({ type: 'SET_PERMISSION_STATUS', status: 'granted' });
      logger.info('Using default development location', defaultDevLocation);
    }
  }, []); // Empty dependency array - only run once on mount

  // Use the geolocation service
  const {
    position,
    error,
    permissionStatus,
    startTracking,
    stopTracking,
    getCurrentPosition: getGPSPosition,
    isAccurateEnoughForNavigation
  } = useGeolocation({
    enableHighAccuracy: state.highAccuracy,
    trackLocation: state.isTrackingLocation && !import.meta.env.DEV, // Disable in DEV
    timeout: 15000,
    maximumAge: 10000,
  });

  // Update location when GPS position changes
  useEffect(() => {
    if (import.meta.env.DEV) return;
    if (position) {
      const locationData: LocationData = {
        lat: position.lat,
        lng: position.lng,
        accuracy: position.accuracy,
        altitude: position.altitude,
        speed: position.speed,
        heading: position.heading,
        timestamp: Date.now(),
      };

      dispatch({ type: 'SET_CURRENT_LOCATION', location: locationData });
      dispatch({ type: 'ADD_TO_HISTORY', location: locationData });

      // Update accuracy status
      if (position.accuracy < 5) {
        dispatch({ type: 'SET_ACCURACY', accuracy: 'high' });
      } else if (position.accuracy < 15) {
        dispatch({ type: 'SET_ACCURACY', accuracy: 'medium' });
      } else {
        dispatch({ type: 'SET_ACCURACY', accuracy: 'low' });
      }

      logger.debug('Location updated', { position, accuracy: position.accuracy });
    }
  }, [position]);

  // Update permission status
  useEffect(() => {
    if (import.meta.env.DEV) return;
    if (permissionStatus && permissionStatus !== 'unknown') {
      dispatch({ type: 'SET_PERMISSION_STATUS', status: permissionStatus as PermissionState });
      
      if (permissionStatus === 'denied') {
        toast.error('Location permission denied. Some features may not work properly.');
        logger.warn('Location permission denied');
      } else if (permissionStatus === 'granted') {
        logger.info('Location permission granted');
      }
    }
  }, [permissionStatus]);

  // Update error status
  useEffect(() => {
    if (import.meta.env.DEV) return;
    if (error) {
      const errorMessage = getLocationErrorMessage(error);
      dispatch({ type: 'SET_LOCATION_ERROR', error: errorMessage });
      toast.error(errorMessage);
      logger.error('Location error', { error });
    } else {
      dispatch({ type: 'SET_LOCATION_ERROR', error: null });
    }
  }, [error]);

  // Actions
  const startLocationTracking = useCallback(async () => {
    if (import.meta.env.DEV) {
      dispatch({ type: 'SET_TRACKING_STATUS', isTracking: true });
      logger.info('Mock location tracking started');
      return;
    }
    try {
      dispatch({ type: 'SET_TRACKING_STATUS', isTracking: true });
      await startTracking();
      logger.info('Location tracking started');
    } catch (error) {
      dispatch({ type: 'SET_TRACKING_STATUS', isTracking: false });
      logger.error('Failed to start location tracking', { error });
      throw error;
    }
  }, [startTracking]);

  const stopLocationTracking = useCallback(() => {
    if (import.meta.env.DEV) {
      dispatch({ type: 'SET_TRACKING_STATUS', isTracking: false });
      logger.info('Mock location tracking stopped');
      return;
    }
    dispatch({ type: 'SET_TRACKING_STATUS', isTracking: false });
    stopTracking();
    logger.info('Location tracking stopped');
  }, [stopTracking]);

  const selectLocation = useCallback((location: PlaceLocation | null) => {
    dispatch({ type: 'SET_SELECTED_LOCATION', location });
    if (location) {
      logger.debug('Location selected', { location: location.name });
    }
  }, []);

  const updateLocationSettings = useCallback((settings: Partial<Pick<LocationState, 'highAccuracy' | 'backgroundTracking' | 'shareLocation'>>) => {
    dispatch({ type: 'UPDATE_SETTINGS', settings });
    logger.debug('Location settings updated', { settings });
  }, []);

  const clearLocationHistory = useCallback(() => {
    dispatch({ type: 'CLEAR_HISTORY' });
    logger.info('Location history cleared');
  }, []);

  const getCurrentPosition = useCallback(async (): Promise<LocationData> => {
    if (import.meta.env.DEV) {
      logger.info('Returning mock current position for DEV');
      const defaultDevLocation: LocationData = {
        lat: 37.7749,
        lng: -122.4194,
        accuracy: 10,
        altitude: 50,
        speed: 0,
        heading: 0,
        timestamp: Date.now(),
      };
      return Promise.resolve(defaultDevLocation);
    }
    const gpsPosition = await getGPSPosition();
    const locationData: LocationData = {
      lat: gpsPosition.lat,
      lng: gpsPosition.lng,
      accuracy: gpsPosition.accuracy,
      altitude: gpsPosition.altitude,
      speed: gpsPosition.speed,
      heading: gpsPosition.heading,
      timestamp: Date.now(),
    };
    return locationData;
  }, [getGPSPosition]);

  // Utilities
  const getDistanceTo = useCallback((location: PlaceLocation): number | null => {
    if (!state.currentLocation) return null;

    return calculateDistance(
      state.currentLocation.lat,
      state.currentLocation.lng,
      location.lat,
      location.lng
    );
  }, [state.currentLocation]);

  const getBearingTo = useCallback((location: PlaceLocation): number | null => {
    if (!state.currentLocation) return null;

    return calculateBearing(
      state.currentLocation.lat,
      state.currentLocation.lng,
      location.lat,
      location.lng
    );
  }, [state.currentLocation]);

  const isLocationAccurate = useCallback((): boolean => {
    if (import.meta.env.DEV) return true; // Always accurate in DEV
    if (!position) return false;
    return isAccurateEnoughForNavigation(position);
  }, [position, isAccurateEnoughForNavigation]);

  const contextValue: LocationContextType = {
    ...state,
    startLocationTracking,
    stopLocationTracking,
    selectLocation,
    updateLocationSettings,
    clearLocationHistory,
    getCurrentPosition,
    getDistanceTo,
    getBearingTo,
    isLocationAccurate,
  };

  return (
    <LocationContext.Provider value={contextValue}>
      {children}
    </LocationContext.Provider>
  );
}

// Hook to use location context
export function useLocation() {
  const context = useContext(LocationContext);
  if (context === undefined) {
    throw new Error('useLocation must be used within a LocationProvider');
  }
  return context;
}

// Utility functions
function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000; // Earth's radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

function calculateBearing(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const lat1Rad = lat1 * Math.PI / 180;
  const lat2Rad = lat2 * Math.PI / 180;
  
  const y = Math.sin(dLng) * Math.cos(lat2Rad);
  const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) - 
            Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLng);
  
  const bearing = Math.atan2(y, x) * 180 / Math.PI;
  return (bearing + 360) % 360; // Normalize to 0-360
}

function getLocationErrorMessage(error: GeolocationPositionError): string {
  switch (error.code) {
    case error.PERMISSION_DENIED:
      return 'Location access denied. Please enable location services.';
    case error.POSITION_UNAVAILABLE:
      return 'Location information unavailable. Please check your connection.';
    case error.TIMEOUT:
      return 'Location request timed out. Please try again.';
    default:
      return 'Unable to get your location. Please try again.';
  }
}