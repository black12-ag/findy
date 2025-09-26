/**
 * NavigationContext - Navigation and route state management
 * Handles current location, routes, navigation status, and transport modes
 */

import React, { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';
import { logger } from '../utils/logger';
import { geofencingService, GeofenceRegion } from '../services/geofencingService';
import { advancedNavigationIntelligenceService } from '../services/advancedNavigationIntelligence';

interface Location {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  category?: string;
}

interface Route {
  id: string;
  from: Location;
  to: Location;
  distance: string;
  duration: string;
  mode: TransportMode;
  steps: string[];
  geometry?: [number, number][];
  waypoints?: Location[];
  createdAt: string;
}

type TransportMode = 'driving' | 'walking' | 'transit' | 'cycling';
type NavigationStatus = 'idle' | 'planning' | 'navigating' | 'paused' | 'completed';

interface NavigationState {
  // Location state
  currentLocation: Location | null;
  selectedLocation: Location | null;
  searchQuery: string;
  
  // Route state
  currentRoute: Route | null;
  routeHistory: Route[];
  alternativeRoutes: Route[];
  
  // Navigation state
  navigationStatus: NavigationStatus;
  transportMode: TransportMode;
  isNavigating: boolean;
  
  // Advanced features
  activeGeofences: GeofenceRegion[];
  intelligentRecommendations: any[];
  trafficPredictions: any[];
  weatherImpact: any;
  
  // Settings
  routePreferences: {
    avoidTolls: boolean;
    avoidHighways: boolean;
    avoidFerries: boolean;
    optimizeFor: 'fastest' | 'shortest' | 'eco';
    enableIntelligence: boolean;
    enableGeofencing: boolean;
  };
  
  // Loading and error states
  isLoading: boolean;
  error: string | null;
}

type NavigationAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_CURRENT_LOCATION'; payload: Location | null }
  | { type: 'SET_SELECTED_LOCATION'; payload: Location | null }
  | { type: 'SET_SEARCH_QUERY'; payload: string }
  | { type: 'SET_CURRENT_ROUTE'; payload: Route | null }
  | { type: 'ADD_TO_ROUTE_HISTORY'; payload: Route }
  | { type: 'SET_ALTERNATIVE_ROUTES'; payload: Route[] }
  | { type: 'SET_NAVIGATION_STATUS'; payload: NavigationStatus }
  | { type: 'SET_TRANSPORT_MODE'; payload: TransportMode }
  | { type: 'START_NAVIGATION'; payload: Route }
  | { type: 'STOP_NAVIGATION' }
  | { type: 'PAUSE_NAVIGATION' }
  | { type: 'RESUME_NAVIGATION' }
  | { type: 'COMPLETE_NAVIGATION' }
  | { type: 'UPDATE_ROUTE_PREFERENCES'; payload: Partial<NavigationState['routePreferences']> }
  | { type: 'CLEAR_ROUTES' }
  | { type: 'CLEAR_SELECTION' };

const initialState: NavigationState = {
  currentLocation: null,
  selectedLocation: null,
  searchQuery: '',
  currentRoute: null,
  routeHistory: [],
  alternativeRoutes: [],
  navigationStatus: 'idle',
  transportMode: 'driving',
  isNavigating: false,
  activeGeofences: [],
  intelligentRecommendations: [],
  trafficPredictions: [],
  weatherImpact: null,
  routePreferences: {
    avoidTolls: false,
    avoidHighways: false,
    avoidFerries: false,
    optimizeFor: 'fastest',
    enableIntelligence: true,
    enableGeofencing: true,
  },
  isLoading: false,
  error: null,
};

const navigationReducer = (state: NavigationState, action: NavigationAction): NavigationState => {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };

    case 'SET_ERROR':
      return { ...state, error: action.payload };

    case 'SET_CURRENT_LOCATION':
      return { ...state, currentLocation: action.payload };

    case 'SET_SELECTED_LOCATION':
      return { ...state, selectedLocation: action.payload };

    case 'SET_SEARCH_QUERY':
      return { ...state, searchQuery: action.payload };

    case 'SET_CURRENT_ROUTE':
      return { ...state, currentRoute: action.payload };

    case 'ADD_TO_ROUTE_HISTORY':
      const newHistory = [action.payload, ...state.routeHistory.slice(0, 49)]; // Keep last 50 routes
      return { ...state, routeHistory: newHistory };

    case 'SET_ALTERNATIVE_ROUTES':
      return { ...state, alternativeRoutes: action.payload };

    case 'SET_NAVIGATION_STATUS':
      return { ...state, navigationStatus: action.payload };

    case 'SET_TRANSPORT_MODE':
      return { ...state, transportMode: action.payload };

    case 'START_NAVIGATION':
      return {
        ...state,
        currentRoute: action.payload,
        navigationStatus: 'navigating',
        isNavigating: true,
        error: null,
      };

    case 'STOP_NAVIGATION':
      return {
        ...state,
        navigationStatus: 'idle',
        isNavigating: false,
        currentRoute: null,
      };

    case 'PAUSE_NAVIGATION':
      return {
        ...state,
        navigationStatus: 'paused',
      };

    case 'RESUME_NAVIGATION':
      return {
        ...state,
        navigationStatus: 'navigating',
      };

    case 'COMPLETE_NAVIGATION':
      const completedRoute = state.currentRoute;
      return {
        ...state,
        navigationStatus: 'completed',
        isNavigating: false,
        routeHistory: completedRoute 
          ? [completedRoute, ...state.routeHistory.slice(0, 49)]
          : state.routeHistory,
      };

    case 'UPDATE_ROUTE_PREFERENCES':
      return {
        ...state,
        routePreferences: { ...state.routePreferences, ...action.payload },
      };

    case 'CLEAR_ROUTES':
      return {
        ...state,
        currentRoute: null,
        alternativeRoutes: [],
        navigationStatus: 'idle',
        isNavigating: false,
      };

    case 'CLEAR_SELECTION':
      return {
        ...state,
        selectedLocation: null,
        searchQuery: '',
      };

    default:
      return state;
  }
};

interface NavigationContextType extends NavigationState {
  // Location actions
  setCurrentLocation: (location: Location | null) => void;
  setSelectedLocation: (location: Location | null) => void;
  setSearchQuery: (query: string) => void;
  getCurrentPosition: () => Promise<Location | null>;
  
  // Route actions
  calculateRoute: (from: Location, to: Location, mode?: TransportMode) => Promise<Route | null>;
  setCurrentRoute: (route: Route | null) => void;
  setAlternativeRoutes: (routes: Route[]) => void;
  
  // Navigation actions
  startNavigation: (route: Route) => void;
  stopNavigation: () => void;
  pauseNavigation: () => void;
  resumeNavigation: () => void;
  completeNavigation: () => void;
  
  // Settings actions
  setTransportMode: (mode: TransportMode) => void;
  updateRoutePreferences: (preferences: Partial<NavigationState['routePreferences']>) => void;
  
  // Utility actions
  clearRoutes: () => void;
  clearSelection: () => void;
}

const NavigationContext = createContext<NavigationContextType | undefined>(undefined);

interface NavigationProviderProps {
  children: ReactNode;
}

export const NavigationProvider: React.FC<NavigationProviderProps> = ({ children }) => {
  const [state, dispatch] = useReducer(navigationReducer, initialState);

  // Save route history to localStorage
  useEffect(() => {
    if (state.routeHistory.length > 0) {
      localStorage.setItem('route_history', JSON.stringify(state.routeHistory));
    }
  }, [state.routeHistory]);

  // Save route preferences to localStorage
  useEffect(() => {
    localStorage.setItem('route_preferences', JSON.stringify(state.routePreferences));
  }, [state.routePreferences]);

  // Load data from localStorage on mount
  useEffect(() => {
    const loadStoredData = () => {
      try {
        // Load route history
        const savedHistory = localStorage.getItem('route_history');
        if (savedHistory) {
          const history = JSON.parse(savedHistory);
          dispatch({ type: 'ADD_TO_ROUTE_HISTORY', payload: history[0] });
        }

        // Load route preferences
        const savedPreferences = localStorage.getItem('route_preferences');
        if (savedPreferences) {
          const preferences = JSON.parse(savedPreferences);
          dispatch({ type: 'UPDATE_ROUTE_PREFERENCES', payload: preferences });
        }

        // Load transport mode
        const savedMode = localStorage.getItem('transport_mode');
        if (savedMode && ['driving', 'walking', 'transit', 'cycling'].includes(savedMode)) {
          dispatch({ type: 'SET_TRANSPORT_MODE', payload: savedMode as TransportMode });
        }
      } catch (error) {
        logger.error('Failed to load navigation data from localStorage', { error });
      }
    };

    loadStoredData();
    
    // Initialize advanced navigation services
    const initializeAdvancedServices = async () => {
      try {
        if (state.routePreferences.enableGeofencing) {
          const geofencingStarted = await geofencingService.startMonitoring();
          if (geofencingStarted) {
            logger.info('Geofencing service initialized successfully');
          } else {
            logger.warn('Geofencing service started in limited mode (location permission may be denied)');
          }
        }
        
        if (state.routePreferences.enableIntelligence) {
          await advancedNavigationIntelligenceService.initialize();
          logger.info('Advanced navigation intelligence initialized');
        }
      } catch (error) {
        logger.error('Failed to initialize advanced services:', error);
        // Don't prevent the app from continuing if advanced services fail
      }
    };
    
    initializeAdvancedServices();
    
    // Try to get current location on mount
    getCurrentPosition();
  }, []);

  const setCurrentLocation = (location: Location | null) => {
    dispatch({ type: 'SET_CURRENT_LOCATION', payload: location });
    logger.debug('Current location set', { location });
  };

  const setSelectedLocation = (location: Location | null) => {
    dispatch({ type: 'SET_SELECTED_LOCATION', payload: location });
    logger.debug('Selected location set', { location });
  };

  const setSearchQuery = (query: string) => {
    dispatch({ type: 'SET_SEARCH_QUERY', payload: query });
  };

  const getCurrentPosition = async (): Promise<Location | null> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        logger.warn('Geolocation not supported');
        resolve(null);
        return;
      }

      dispatch({ type: 'SET_LOADING', payload: true });

      // Try with less aggressive settings first
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const location: Location = {
            id: 'current',
            name: 'Current Location',
            address: 'Your current location',
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };

          dispatch({ type: 'SET_CURRENT_LOCATION', payload: location });
          dispatch({ type: 'SET_LOADING', payload: false });
          logger.info('Current position obtained', { location });
          resolve(location);
        },
        (error) => {
          logger.debug('Initial location request failed, trying fallback:', error.message);
          
          // Fallback: Try with cached position and lower accuracy
          navigator.geolocation.getCurrentPosition(
            (position) => {
              const location: Location = {
                id: 'current',
                name: 'Current Location',
                address: 'Your current location',
                lat: position.coords.latitude,
                lng: position.coords.longitude,
              };
              
              dispatch({ type: 'SET_CURRENT_LOCATION', payload: location });
              dispatch({ type: 'SET_LOADING', payload: false });
              logger.info('Fallback position obtained', { location });
              resolve(location);
            },
            (fallbackError) => {
              logger.debug('Fallback location request also failed:', fallbackError.message);
              
              // Final fallback: Use default location for development
              if (process.env.NODE_ENV === 'development') {
                const defaultLocation: Location = {
                  id: 'default',
                  name: 'Default Location',
                  address: 'San Francisco, CA',
                  lat: 37.7749,
                  lng: -122.4194,
                };
                
                dispatch({ type: 'SET_CURRENT_LOCATION', payload: defaultLocation });
                dispatch({ type: 'SET_LOADING', payload: false });
                logger.info('Using default development location', { location: defaultLocation });
                resolve(defaultLocation);
              } else {
                dispatch({ type: 'SET_LOADING', payload: false });
                logger.warn('Location unavailable in production mode');
                resolve(null);
              }
            },
            {
              enableHighAccuracy: false,
              timeout: 5000,
              maximumAge: 600000, // 10 minutes
            }
          );
        },
        {
          enableHighAccuracy: false, // Less demanding for initial try
          timeout: 5000, // Shorter timeout
          maximumAge: 300000, // 5 minutes
        }
      );
    });
  };

  const calculateRoute = async (
    from: Location, 
    to: Location, 
    mode: TransportMode = state.transportMode
  ): Promise<Route | null> => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      dispatch({ type: 'SET_ERROR', payload: null });

      // TODO: Replace with actual route calculation API call
      const mockRoute: Route = {
        id: `route_${Date.now()}`,
        from,
        to,
        distance: '5.2 km',
        duration: '12 min',
        mode,
        steps: [
          'Head north on Main St',
          'Turn right on Oak Ave',
          'Continue straight for 2 km',
          'Turn left on destination street',
          'Arrive at destination'
        ],
        createdAt: new Date().toISOString(),
      };

      dispatch({ type: 'SET_CURRENT_ROUTE', payload: mockRoute });
      dispatch({ type: 'SET_NAVIGATION_STATUS', payload: 'planning' });
      dispatch({ type: 'SET_LOADING', payload: false });
      
      logger.info('Route calculated', { from: from.name, to: to.name, mode });
      return mockRoute;
    } catch (error) {
      logger.error('Route calculation failed', { error, from, to, mode });
      dispatch({ type: 'SET_ERROR', payload: 'Failed to calculate route' });
      dispatch({ type: 'SET_LOADING', payload: false });
      return null;
    }
  };

  const setCurrentRoute = (route: Route | null) => {
    dispatch({ type: 'SET_CURRENT_ROUTE', payload: route });
  };

  const setAlternativeRoutes = (routes: Route[]) => {
    dispatch({ type: 'SET_ALTERNATIVE_ROUTES', payload: routes });
  };

  const startNavigation = (route: Route) => {
    dispatch({ type: 'START_NAVIGATION', payload: route });
    logger.info('Navigation started', { route: route.id });
  };

  const stopNavigation = () => {
    const currentRoute = state.currentRoute;
    if (currentRoute) {
      dispatch({ type: 'ADD_TO_ROUTE_HISTORY', payload: currentRoute });
    }
    dispatch({ type: 'STOP_NAVIGATION' });
    logger.info('Navigation stopped');
  };

  const pauseNavigation = () => {
    dispatch({ type: 'PAUSE_NAVIGATION' });
    logger.info('Navigation paused');
  };

  const resumeNavigation = () => {
    dispatch({ type: 'RESUME_NAVIGATION' });
    logger.info('Navigation resumed');
  };

  const completeNavigation = () => {
    dispatch({ type: 'COMPLETE_NAVIGATION' });
    logger.info('Navigation completed');
  };

  const setTransportMode = (mode: TransportMode) => {
    dispatch({ type: 'SET_TRANSPORT_MODE', payload: mode });
    localStorage.setItem('transport_mode', mode);
    logger.debug('Transport mode changed', { mode });
  };

  const updateRoutePreferences = (preferences: Partial<NavigationState['routePreferences']>) => {
    dispatch({ type: 'UPDATE_ROUTE_PREFERENCES', payload: preferences });
    logger.debug('Route preferences updated', { preferences });
  };

  const clearRoutes = () => {
    dispatch({ type: 'CLEAR_ROUTES' });
    logger.debug('Routes cleared');
  };

  const clearSelection = () => {
    dispatch({ type: 'CLEAR_SELECTION' });
    logger.debug('Selection cleared');
  };

  const contextValue: NavigationContextType = {
    ...state,
    setCurrentLocation,
    setSelectedLocation,
    setSearchQuery,
    getCurrentPosition,
    calculateRoute,
    setCurrentRoute,
    setAlternativeRoutes,
    startNavigation,
    stopNavigation,
    pauseNavigation,
    resumeNavigation,
    completeNavigation,
    setTransportMode,
    updateRoutePreferences,
    clearRoutes,
    clearSelection,
  };

  return (
    <NavigationContext.Provider value={contextValue}>
      {children}
    </NavigationContext.Provider>
  );
};

export const useNavigation = (): NavigationContextType => {
  const context = useContext(NavigationContext);
  if (context === undefined) {
    throw new Error('useNavigation must be used within a NavigationProvider');
  }
  return context;
};

export type { Location, Route, TransportMode, NavigationStatus, NavigationState };