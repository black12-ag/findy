import React, { useEffect, useRef, useState, useCallback } from 'react';
import { MapPin, Navigation, Car, User, AlertTriangle, Layers, RotateCcw, Satellite, Moon, Eye, EyeOff, Compass, X, Plus, Minus, Coffee, Utensils, Landmark, CreditCard, Fuel, ShoppingBag, Store, Hotel } from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { PlaceDetailsSheet } from './PlaceDetailsSheet';
import { CurrentLocationButton } from './CurrentLocationButton';
import { getCurrentLocationMarkerSVG } from './CurrentLocationMarker';
import googleMapsService from '../services/googleMapsService';
import { logger } from '../utils/logger';
import { toast } from 'sonner';
import './GoogleMapView.css';
import { DirectionsDebugger } from '../utils/directionsDebugger';
import { useLocation } from '../contexts/LocationContext';
import { RouteInfoPanel } from './RouteInfoPanel';
import { LocationSelectedNotification } from './LocationSelectedNotification';
import { Switch } from './ui/switch';
import { Label } from './ui/label';
import { voiceNavigationService } from '../services/voiceNavigationService';
import { Volume2, VolumeX, RefreshCw, Navigation2, AlertTriangle as Warning } from 'lucide-react';
import { geolocationService } from '../services/geolocationService';
import { realtimeNavigationService, NavigationState, RouteDeviation } from '../services/realtimeNavigationService';
import { DirectionalTransportIcon } from './DirectionalTransportIcon';

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
  mode: string;
  steps: string[];
  geometry?: [number, number][];
  googleDirectionsResult?: google.maps.DirectionsResult;
}

interface GoogleMapViewProps {
  currentLocation: Location | null;
  selectedLocation: Location | null;
  route: Route | null;
  transportMode: string;
  isNavigating: boolean;
  centerSignal?: number;
  onLocationSelect?: (location: Location) => void;
  onRouteRequest?: (from: Location, to: Location) => void;
  onRouteCalculated?: (result: google.maps.DirectionsResult) => void;
  onMapReady?: (map: google.maps.Map) => void;
  onForceRouteScreen?: (location: Location) => void;
}

export function GoogleMapView({ 
  currentLocation, 
  selectedLocation, 
  route, 
  transportMode,
  isNavigating,
  centerSignal = 0,
  onLocationSelect,
  onRouteRequest,
  onRouteCalculated,
  onMapReady,
  onForceRouteScreen,
}: GoogleMapViewProps) {
  const { isTrackingLocation, startLocationTracking, stopLocationTracking } = useLocation();
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [currentMarker, setCurrentMarker] = useState<google.maps.Marker | null>(null);
  const [selectedMarker, setSelectedMarker] = useState<google.maps.Marker | null>(null);
  const [directionsRenderer, setDirectionsRenderer] = useState<google.maps.DirectionsRenderer | null>(null);
  const [mapStyle, setMapStyle] = useState<'roadmap' | 'satellite' | 'terrain' | 'hybrid'>('roadmap');
  const [isTrafficEnabled, setIsTrafficEnabled] = useState(true);
  const [selectedPlace, setSelectedPlace] = useState<any>(null);
  const [isPlaceSheetOpen, setIsPlaceSheetOpen] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [centerPulse, setCenterPulse] = useState(false);
  const [clickedLocation, setClickedLocation] = useState<Location | null>(null);
  const [isCalculatingRoute, setIsCalculatingRoute] = useState(false);
  const [showRouteOptions, setShowRouteOptions] = useState(false);
  const [locationAccuracy, setLocationAccuracy] = useState<number>(10);
  const [locationSpeed, setLocationSpeed] = useState<number>(0);
  const [locationHeading, setLocationHeading] = useState<number>(0);
  const [localRouteInfo, setLocalRouteInfo] = useState<{ distance?: string; duration?: string } | null>(null);
  const [currentDirectionsResult, setCurrentDirectionsResult] = useState<google.maps.DirectionsResult | null>(null);
  const [showRoutePanel, setShowRoutePanel] = useState(false);
  const [alternativeRenderers, setAlternativeRenderers] = useState<google.maps.DirectionsRenderer[]>([]);
  const [showLocationNotification, setShowLocationNotification] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isMouseDown, setIsMouseDown] = useState(false);
  const isMouseDownRef = useRef(false);
  const isDraggingRef = useRef(false);
  
  // Nearby places state
  const [showNearbyPlaces, setShowNearbyPlaces] = useState({
    restaurants: true,
    atms: true,
    landmarks: true,
    services: true,
    parking: true,
  });
  const [nearbyPlaceMarkers, setNearbyPlaceMarkers] = useState<google.maps.Marker[]>([]);
  const [isLoadingPlaces, setIsLoadingPlaces] = useState(false);
  
  // Navigation tracking state
  const [isVoiceEnabled, setIsVoiceEnabled] = useState(true);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [distanceToNextTurn, setDistanceToNextTurn] = useState<number | null>(null);
  const navigationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Real-time navigation state
  const [navigationState, setNavigationState] = useState<NavigationState | null>(null);
  const [isRealTimeNavigation, setIsRealTimeNavigation] = useState(false);
  const [wrongWayAlert, setWrongWayAlert] = useState<boolean>(false);
  const [routeDeviation, setRouteDeviation] = useState<RouteDeviation | null>(null);
  const [alternativeRoutes, setAlternativeRoutes] = useState<google.maps.DirectionsRoute[]>([]);
  
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const trafficLayer = useRef<google.maps.TrafficLayer | null>(null);
  const clickedMarkerRef = useRef<google.maps.Marker | null>(null);

  // Handle map click to select location and calculate route with marker
  const handleMapClick = async (position: { lat: number; lng: number }) => {
    try {
      logger.info('Map clicked at:', position);

      // Create location object with placeholder data first
      const clickedLoc: Location = {
        id: `clicked_${Date.now()}`,
        name: 'Destination',
        address: 'Getting address...',
        lat: position.lat,
        lng: position.lng,
        category: 'selected'
      };

      setClickedLocation(clickedLoc);
      
      // Get current location if not available
      let userLocation = currentLocation;
      if (!userLocation) {
        // Try to get current location from browser - faster settings
        if ('geolocation' in navigator) {
          try {
            const position = await new Promise<GeolocationPosition>((resolve, reject) => {
              navigator.geolocation.getCurrentPosition(
                resolve,
                reject,
                {
                  enableHighAccuracy: true, // Use high accuracy for location clicking
                  timeout: 10000, // Reasonable timeout
                  maximumAge: 60000 // Accept cached location up to 1 minute old
                }
              );
            });
            
            userLocation = {
              id: 'current',
              name: 'Your Location',
              address: 'Current Location',
              lat: position.coords.latitude,
              lng: position.coords.longitude,
            };
            
            logger.info('Got current location:', userLocation);
          } catch (error) {
            logger.error('Failed to get current location:', error);
            
            // Use a default location or last known location
            if (map) {
              const center = map.getCenter();
              if (center) {
                userLocation = {
                  id: 'center',
                  name: 'Map Center',
                  address: 'Map Center Location',
                  lat: center.lat(),
                  lng: center.lng(),
                };
                toast.info('Using map center as starting point');
              }
            }
          }
        }
      }
      
      // If we have a location now, calculate route
      if (userLocation) {
        setIsCalculatingRoute(true);
        
        // Show loading indicator
        const loadingToast = toast.loading(`📍 Calculating ${transportMode} route...`);
        
        // Calculate route immediately
        await calculateRouteToLocation(userLocation, clickedLoc);
        
        // Dismiss loading toast
        toast.dismiss(loadingToast);
        
        setIsCalculatingRoute(false);
        
        // Don't show route options - just display the route
        setShowRouteOptions(false);
      } else {
        // If still no location, show error
        toast.error('Unable to get your location. Please enable location services.');
        setShowRouteOptions(true);
      }

      // Reverse geocode in background to get actual address
      googleMapsService.reverseGeocode(position).then((geocodeResults) => {
        let locationName = 'Selected Location';
        let address = `${position.lat.toFixed(4)}, ${position.lng.toFixed(4)}`;

        if (geocodeResults && geocodeResults.length > 0) {
          const result = geocodeResults[0];
          address = result.formatted_address || address;
          locationName = result.address_components?.[0]?.long_name || 
                        result.formatted_address?.split(',')[0] || 
                        locationName;
        }

        // Update location with real address
        const updatedLoc: Location = {
          ...clickedLoc,
          name: locationName,
          address: address
        };

        setClickedLocation(updatedLoc);
        
        // Update marker title
        if (clickedMarkerRef.current) {
          clickedMarkerRef.current.setTitle(`${locationName}\n${address}`);
          
          // Show info window with route details if route info exists
          if (localRouteInfo || route) {
            const distance = localRouteInfo?.distance || route?.distance || 'Calculating...';
            const duration = localRouteInfo?.duration || route?.duration || 'Calculating...';
            
            const infoWindow = new google.maps.InfoWindow({
              content: `
                <div style="padding: 10px; min-width: 200px;">
                  <h3 style="margin: 0 0 8px 0; color: #1a73e8;">${locationName}</h3>
                  <p style="margin: 0 0 8px 0; color: #5f6368; font-size: 12px;">${address}</p>
                  <div style="border-top: 1px solid #e0e0e0; padding-top: 8px; margin-top: 8px;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                      <span>📏 Distance:</span>
                      <strong>${distance}</strong>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                      <span>⏱️ Duration:</span>
                      <strong>${duration}</strong>
                    </div>
                    <div style="display: flex; justify-content: space-between;">
                      <span>🚗 Mode:</span>
                      <strong style="text-transform: capitalize;">${transportMode}</strong>
                    </div>
                  </div>
                </div>
              `,
              maxWidth: 300
            });
            
            infoWindow.open(map, clickedMarkerRef.current);
            
            // Auto close after 7 seconds
            setTimeout(() => infoWindow.close(), 7000);
          }
        }
        
        // Call parent callback with updated location
        if (onLocationSelect) {
          onLocationSelect(updatedLoc);
        }
        
        // Show success message
        const modeEmoji = {
          driving: '🚗',
          walking: '🚶',
          cycling: '🚴',
          transit: '🚌'
        }[transportMode as string] || '📍';
        
        if (currentLocation) {
          toast.success(`${modeEmoji} Route to ${locationName} calculated!`);
        }
      }).catch(error => {
        logger.warn('Failed to get address:', error);
      });
      
    } catch (error) {
      logger.error('Failed to handle map click:', error);
      toast.error('Failed to mark location. Please try again.');
    }
  };

  // Calculate route to selected location
  const calculateRouteToLocation = async (from: Location, to: Location) => {
    try {
      logger.info(`Calculating ${transportMode} route from`, from, 'to', to);
      
      // Ensure we have a valid DirectionsRenderer
      let renderer = directionsRenderer;
      if (!renderer && map) {
        logger.warn('DirectionsRenderer not initialized, creating new one');
        renderer = new google.maps.DirectionsRenderer({
          suppressMarkers: false, // Show Google's default A and B markers
          suppressInfoWindows: false, // Allow info windows on markers
          draggable: false,
          preserveViewport: false,
          polylineOptions: {
            strokeWeight: 6,
            strokeOpacity: 1,
            strokeColor: '#4285F4', // Always blue for all routes
            geodesic: true
          },
          markerOptions: {
            animation: google.maps.Animation.DROP
          }
        });
        renderer.setMap(map); // Attach renderer to the map immediately
        setDirectionsRenderer(renderer);
      }
      
      // Initialize DirectionsService if needed
      if (!googleMapsService.isAvailable()) {
        await googleMapsService.initialize();
      }
      
      logger.info('Requesting directions', { 
        from: { lat: from.lat, lng: from.lng },
        to: { lat: to.lat, lng: to.lng },
        transportMode 
      });
      
      // Use Google Directions Service directly for better control
      const directionsService = new google.maps.DirectionsService();
      
      const request: google.maps.DirectionsRequest = {
        origin: { lat: from.lat, lng: from.lng },
        destination: { lat: to.lat, lng: to.lng },
        travelMode: google.maps.TravelMode[transportMode.toUpperCase() as keyof typeof google.maps.TravelMode] || google.maps.TravelMode.DRIVING,
        avoidHighways: transportMode === 'cycling',
        avoidTolls: transportMode === 'walking' || transportMode === 'cycling',
        provideRouteAlternatives: true,
        unitSystem: google.maps.UnitSystem.METRIC
      };
      
      // Add transit-specific options if needed
      if (transportMode === 'transit') {
        request.transitOptions = {
          departureTime: new Date(Date.now() + 60000),
          modes: [google.maps.TransitMode.BUS, google.maps.TransitMode.RAIL, google.maps.TransitMode.SUBWAY],
          routingPreference: google.maps.TransitRoutePreference.FEWER_TRANSFERS
        };
      }
      
      // Request the route
      const directionsResult = await new Promise<google.maps.DirectionsResult>((resolve, reject) => {
        directionsService.route(request, (result, status) => {
          logger.info('Directions service response', { status, hasResult: !!result });
          
          if (status === google.maps.DirectionsStatus.OK && result) {
            resolve(result);
          } else {
            reject(new Error(`Directions request failed: ${status}`));
          }
        });
      });
      
      if (!directionsResult) {
        throw new Error('No directions result received from Google Maps');
      }
      
      if (!directionsResult.routes || directionsResult.routes.length === 0) {
        throw new Error('No routes found in directions result');
      }
      
      logger.info('Directions received successfully', {
        routeCount: directionsResult.routes.length,
        distance: directionsResult.routes[0]?.legs[0]?.distance?.text,
        duration: directionsResult.routes[0]?.legs[0]?.duration?.text
      });
      
      // Store the route distance and duration info locally
      const distance = directionsResult.routes[0]?.legs[0]?.distance?.text;
      const duration = directionsResult.routes[0]?.legs[0]?.duration?.text;
      setLocalRouteInfo({ distance, duration });

      // Display the route on map with alternative routes
      if (map) {
        // Clear any existing route renderers
        if (directionsRenderer) {
          directionsRenderer.setMap(null);
        }
        
        // Clear any alternative route renderers
        alternativeRenderers.forEach(renderer => renderer.setMap(null));
        setAlternativeRenderers([]);
        
        // Ensure we have a renderer attached to the map
        let activeRenderer = directionsRenderer;
        if (!activeRenderer || !activeRenderer.getMap()) {
          activeRenderer = new google.maps.DirectionsRenderer({
            suppressMarkers: false,
            suppressInfoWindows: false,
            draggable: false,
            preserveViewport: false,
            polylineOptions: {
              strokeWeight: 6,
              strokeOpacity: 1.0,
              strokeColor: '#4285F4',
              geodesic: true,
              zIndex: 100
            },
            markerOptions: {
              animation: google.maps.Animation.DROP
            }
          });
          activeRenderer.setMap(map);
          setDirectionsRenderer(activeRenderer);
        }
        
        // First, display alternative routes if available
        const newAlternativeRenderers: google.maps.DirectionsRenderer[] = [];
        if (directionsResult.routes.length > 1) {
          directionsResult.routes.slice(1).forEach((route, index) => {
            const altRenderer = new google.maps.DirectionsRenderer({
              suppressMarkers: true,
              suppressInfoWindows: true,
              draggable: false,
              preserveViewport: true,
              polylineOptions: {
                strokeColor: '#9CA3AF', // Light gray for alternatives
                strokeWeight: 5,
                strokeOpacity: 0.5,
                geodesic: true,
                zIndex: 10 + index,
                strokePattern: [10, 5] // Dashed line for alternatives
              },
              routeIndex: index + 1
            });
            
            // Create a result with only this route
            const singleRouteResult = {
              ...directionsResult,
              routes: [route]
            };
            
            altRenderer.setMap(map);
            altRenderer.setDirections(singleRouteResult);
            newAlternativeRenderers.push(altRenderer);
            
            // Add click listener to switch to this route
            google.maps.event.addListener(altRenderer, 'click', () => {
              // Clear all renderers and show this route as primary
              setDirectionsRenderer(null);
              setTimeout(() => {
                const newResult = {
                  ...directionsResult,
                  routes: [route, ...directionsResult.routes.filter((_, i) => i !== index + 1)]
                };
                displayPrimaryRoute(newResult);
              }, 100);
            });
            
            logger.info(`Alternative route ${index + 1} displayed`);
          });
          
          // Store alternative renderers for cleanup later
          setAlternativeRenderers(newAlternativeRenderers);
        }
        
        // Store the current directions result and show route panel
        setCurrentDirectionsResult(directionsResult);
        setShowRoutePanel(true);
        
        // Display primary route
        displayPrimaryRoute(directionsResult);
        
        // Call parent callbacks if provided
        if (onRouteRequest) {
          onRouteRequest(from, to);
        }
        if (onRouteCalculated) {
          onRouteCalculated(directionsResult);
        }

        const route = directionsResult.routes[0];
        const leg = route.legs[0];
        
        toast.success(
          `Route calculated: ${leg.distance?.text} in ${leg.duration?.text}`,
          { duration: 5000 }
        );
        
        // Start navigation tracking if navigating
        if (isNavigating) {
          startNavigationTracking(directionsResult);
        }
      } else {
        logger.error('Map instance not available for displaying route');
      }
    } catch (error) {
      logger.error('Failed to calculate route:', error);
      
      // Check if it's an API key restriction error
      const errorMessage = error.message || error.toString();
      if (errorMessage.includes('REQUEST_DENIED') || errorMessage.includes('API key')) {
        toast.error(
          'Route calculation unavailable. Please check your Google Maps API key configuration.',
          { duration: 6000 }
        );
        
        // Show helpful info to developer
        if (process.env.NODE_ENV === 'development') {
          console.group('🔧 Google Maps API Configuration Issue');
          console.warn('The Directions API is not working with your current API key.');
          console.info('Common solutions:');
          console.info('1. Remove HTTP referrer restrictions from your API key');
          console.info('2. Create a separate unrestricted API key for Directions API');
          console.info('3. Use IP address restrictions instead of HTTP referrer restrictions');
          console.info('Visit: https://console.cloud.google.com/apis/credentials');
          console.groupEnd();
        }
      } else {
        toast.error(`Failed to calculate ${transportMode} route: ${errorMessage}`);
      }
      
      // Clear any existing route on error
      if (directionsRenderer) {
        directionsRenderer.setMap(null);
      }
      
      // Clear route panel
      setCurrentDirectionsResult(null);
      setShowRoutePanel(false);
      
      // Development mode: create mock route for UI testing
      if (process.env.NODE_ENV === 'development' && errorMessage.includes('REQUEST_DENIED')) {
        setTimeout(() => {
          const mockDirectionsResult: google.maps.DirectionsResult = {
            routes: [{
              legs: [{
                start_location: new google.maps.LatLng(from.lat, from.lng),
                end_location: new google.maps.LatLng(to.lat, to.lng),
                distance: { text: '1.2 km', value: 1200 },
                duration: { text: '15 min', value: 900 },
                steps: [
                  {
                    instructions: 'Head <b>north</b> on <b>Main St</b>',
                    distance: { text: '0.3 km', value: 300 },
                    duration: { text: '4 min', value: 240 },
                    start_location: new google.maps.LatLng(from.lat, from.lng),
                    end_location: new google.maps.LatLng(from.lat + 0.001, from.lng),
                    travel_mode: google.maps.TravelMode.WALKING,
                    path: [],
                    maneuver: ''
                  },
                  {
                    instructions: 'Turn <b>right</b> on <b>Oak Ave</b>',
                    distance: { text: '0.5 km', value: 500 },
                    duration: { text: '6 min', value: 360 },
                    start_location: new google.maps.LatLng(from.lat + 0.001, from.lng),
                    end_location: new google.maps.LatLng(from.lat + 0.002, from.lng + 0.001),
                    travel_mode: google.maps.TravelMode.WALKING,
                    path: [],
                    maneuver: 'turn-right'
                  },
                  {
                    instructions: 'Continue to destination',
                    distance: { text: '0.4 km', value: 400 },
                    duration: { text: '5 min', value: 300 },
                    start_location: new google.maps.LatLng(from.lat + 0.002, from.lng + 0.001),
                    end_location: new google.maps.LatLng(to.lat, to.lng),
                    travel_mode: google.maps.TravelMode.WALKING,
                    path: [],
                    maneuver: ''
                  }
                ],
                start_address: from.address,
                end_address: to.address,
                via_waypoints: []
              }],
              summary: 'Mock route for development',
              overview_polyline: {
                points: ''  // Empty for mock
              },
              bounds: new google.maps.LatLngBounds(
                new google.maps.LatLng(Math.min(from.lat, to.lat), Math.min(from.lng, to.lng)),
                new google.maps.LatLng(Math.max(from.lat, to.lat), Math.max(from.lng, to.lng))
              ),
              copyrights: 'Mock data for development',
              fare: undefined,
              warnings: ['This is mock routing data for development testing'],
              waypoint_order: []
            }],
            status: google.maps.DirectionsStatus.OK,
            request: {
              origin: { lat: from.lat, lng: from.lng },
              destination: { lat: to.lat, lng: to.lng },
              travelMode: google.maps.TravelMode.WALKING
            }
          };
          
          // Show mock route info
          const distance = mockDirectionsResult.routes[0]?.legs[0]?.distance?.text;
          const duration = mockDirectionsResult.routes[0]?.legs[0]?.duration?.text;
          setLocalRouteInfo({ distance, duration });
          setCurrentDirectionsResult(mockDirectionsResult);
          setShowRoutePanel(true);
          
          toast.info('📍 Showing mock route data for development testing', { duration: 4000 });
          logger.warn('Using mock directions data due to API key restrictions');
        }, 1000);
      }
    }
  };

  // Helper function to display the primary route
  const displayPrimaryRoute = (result: google.maps.DirectionsResult) => {
    if (!map) {
      logger.error('Map instance not available for displaying route');
      return;
    }

    // Clear existing renderer if any
    if (directionsRenderer) {
      directionsRenderer.setMap(null);
    }
    
    // Clear alternative renderers
    alternativeRenderers.forEach(renderer => renderer.setMap(null));
    setAlternativeRenderers([]);

    // Create enhanced primary route renderer
    const renderer = new google.maps.DirectionsRenderer({
      suppressMarkers: false,
      suppressInfoWindows: false,
      draggable: false,
      preserveViewport: false,
      polylineOptions: {
        strokeWeight: 7,
        strokeOpacity: 1.0,
        strokeColor: '#4285F4', // Always blue for primary route
        geodesic: true,
        zIndex: 100
      },
      markerOptions: {
        animation: google.maps.Animation.DROP
      },
      routeIndex: 0
    });
    
    renderer.setMap(map); // Set map first
    renderer.setDirections(result); // Then set directions
    setDirectionsRenderer(renderer); // Finally update state
    
    // Fit bounds to show entire route with padding for route panel
    const bounds = new google.maps.LatLngBounds();
    result.routes[0].legs.forEach(leg => {
      bounds.extend(leg.start_location);
      bounds.extend(leg.end_location);
    });
    // Extra bottom padding for route info panel
    map.fitBounds(bounds, { top: 50, right: 50, bottom: 200, left: 50 });
    
    logger.info('Primary route displayed successfully');
  };

  // Clear current route
  const clearRoute = () => {
    if (directionsRenderer) {
      directionsRenderer.setMap(null);
      logger.info('Route cleared from map');
    }
    // Clear alternative renderers
    alternativeRenderers.forEach(renderer => renderer.setMap(null));
    setAlternativeRenderers([]);
    // Clear route panel and directions result
    setCurrentDirectionsResult(null);
    setShowRoutePanel(false);
  };

  // Clear clicked marker
  const clearClickedMarker = () => {
    if (clickedMarkerRef.current) {
      clickedMarkerRef.current.setMap(null);
      clickedMarkerRef.current = null;
    }
  };

  // Double click to clear route
  const handleMapDoubleClick = () => {
    clearRoute();
    clearClickedMarker();
    setClickedLocation(null);
    setShowRouteOptions(false);
    setCurrentDirectionsResult(null);
    setShowRoutePanel(false);
    toast.info('Route cleared');
  };

  // Load nearby places based on current map center
  const loadNearbyPlaces = async () => {
    if (!map) return;
    
    setIsLoadingPlaces(true);
    
    // Clear existing place markers
    nearbyPlaceMarkers.forEach(marker => marker.setMap(null));
    setNearbyPlaceMarkers([]);
    
    const center = map.getCenter();
    if (!center) {
      setIsLoadingPlaces(false);
      return;
    }
    
    const newMarkers: google.maps.Marker[] = [];
    const placesService = new google.maps.places.PlacesService(map);
    
    // Define place types to search for
    const placeSearches = [];
    
    if (showNearbyPlaces.restaurants) {
      placeSearches.push({ type: 'restaurant', icon: '🍽️', color: '#EF4444' });
      placeSearches.push({ type: 'cafe', icon: '☕', color: '#8B4513' });
    }
    
    if (showNearbyPlaces.atms) {
      placeSearches.push({ type: 'atm', icon: '💳', color: '#10B981' });
      placeSearches.push({ type: 'bank', icon: '🏦', color: '#3B82F6' });
    }
    
    if (showNearbyPlaces.landmarks) {
      placeSearches.push({ type: 'tourist_attraction', icon: '🏛️', color: '#8B5CF6' });
      placeSearches.push({ type: 'museum', icon: '🏛️', color: '#8B5CF6' });
      placeSearches.push({ type: 'park', icon: '🌳', color: '#22C55E' });
    }
    
    if (showNearbyPlaces.services) {
      placeSearches.push({ type: 'gas_station', icon: '⛽', color: '#F59E0B' });
      placeSearches.push({ type: 'pharmacy', icon: '💊', color: '#EC4899' });
    }
    
    if (showNearbyPlaces.parking) {
      placeSearches.push({ type: 'parking', icon: '🅿️', color: '#1E40AF' });
    }
    
    // Load places for each type
    for (const placeSearch of placeSearches) {
      const request = {
        location: center,
        radius: 500, // 500m radius only
        type: placeSearch.type
      };
      
      try {
        const results = await new Promise<google.maps.places.PlaceResult[]>((resolve, reject) => {
          placesService.nearbySearch(request, (results, status) => {
            if (status === google.maps.places.PlacesServiceStatus.OK && results) {
              resolve(results.slice(0, 3)); // Limit to 3 places per type for less clutter
            } else {
              resolve([]);
            }
          });
        });
        
        // Create markers for each place
        results.forEach(place => {
          if (!place.geometry?.location) return;
          
          const marker = new google.maps.Marker({
            position: place.geometry.location,
            map: map,
            title: place.name,
            icon: {
              url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
                <svg width="32" height="32" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="16" cy="16" r="14" fill="${placeSearch.color}" stroke="white" stroke-width="2" opacity="0.9"/>
                  <text x="16" y="20" text-anchor="middle" font-size="14">${placeSearch.icon}</text>
                </svg>
              `)}`,
              scaledSize: new google.maps.Size(32, 32),
              anchor: new google.maps.Point(16, 16)
            },
            animation: google.maps.Animation.DROP,
            zIndex: 50
          });
          
          // Add click listener to show place details
          marker.addListener('click', () => {
            const infoWindow = new google.maps.InfoWindow({
              content: `
                <div style="padding: 8px; min-width: 200px;">
                  <h3 style="margin: 0 0 8px 0; font-size: 16px; font-weight: bold;">${place.name}</h3>
                  <p style="margin: 0 0 4px 0; color: #666; font-size: 13px;">${place.vicinity || place.formatted_address || ''}</p>
                  ${place.rating ? `<p style="margin: 0; color: #f59e0b;">⭐ ${place.rating} ${place.user_ratings_total ? `(${place.user_ratings_total} reviews)` : ''}</p>` : ''}
                  ${place.opening_hours ? `<p style="margin: 4px 0 0 0; color: ${place.opening_hours.open_now ? '#10b981' : '#ef4444'}; font-size: 13px; font-weight: 500;">${place.opening_hours.open_now ? '✅ Open Now' : '❌ Closed'}</p>` : ''}
                </div>
              `
            });
            infoWindow.open(map, marker);
            
            // Auto-close after 10 seconds
            setTimeout(() => infoWindow.close(), 10000);
          });
          
          newMarkers.push(marker);
        });
      } catch (error) {
        logger.warn(`Failed to load ${placeSearch.type} places:`, error);
      }
    }
    
    setNearbyPlaceMarkers(newMarkers);
    setIsLoadingPlaces(false);
    
    if (newMarkers.length > 0) {
      toast.success(`Found ${newMarkers.length} nearby places`, { duration: 2000 });
    }
  };

  // Start real-time navigation tracking
  const startNavigationTracking = (directionsResult: google.maps.DirectionsResult) => {
    if (!directionsResult.routes?.[0]?.legs?.[0]) return;
    
    const route = directionsResult.routes[0];
    const leg = route.legs[0];
    
    // Announce navigation start
    if (isVoiceEnabled) {
      voiceNavigationService.announceStart(
        leg.distance?.text || '',
        leg.duration?.text || ''
      );
    }
    
    // Clear any existing tracking
    if (navigationIntervalRef.current) {
      clearInterval(navigationIntervalRef.current);
    }
    
    // Track user position every second
    navigationIntervalRef.current = setInterval(() => {
      if (!currentLocation || !leg.steps) return;
      
      // Find current step based on user location
      let minDistance = Infinity;
      let closestStepIndex = 0;
      
      leg.steps.forEach((step, index) => {
        if (!step.start_location) return;
        
        const distance = google.maps.geometry.spherical.computeDistanceBetween(
          new google.maps.LatLng(currentLocation.lat, currentLocation.lng),
          step.start_location
        );
        
        if (distance < minDistance) {
          minDistance = distance;
          closestStepIndex = index;
        }
      });
      
      setCurrentStepIndex(closestStepIndex);
      
      // Get next turn info
      const currentStep = leg.steps[closestStepIndex];
      const nextStep = leg.steps[closestStepIndex + 1];
      
      if (nextStep && nextStep.start_location) {
        const distanceToTurn = google.maps.geometry.spherical.computeDistanceBetween(
          new google.maps.LatLng(currentLocation.lat, currentLocation.lng),
          nextStep.start_location
        );
        
        setDistanceToNextTurn(Math.round(distanceToTurn));
        
        // Voice announcements for turns
        if (isVoiceEnabled && nextStep.instructions) {
          voiceNavigationService.announceTurn(
            nextStep.instructions,
            distanceToTurn,
            nextStep.maneuver
          );
        }
      }
      
      // Check if arrived at destination
      if (leg.end_location) {
        const distanceToDestination = google.maps.geometry.spherical.computeDistanceBetween(
          new google.maps.LatLng(currentLocation.lat, currentLocation.lng),
          leg.end_location
        );
        
        if (distanceToDestination < 50) {
          // Arrived at destination
          if (isVoiceEnabled) {
            voiceNavigationService.announceArrival();
          }
          
          // Stop tracking
          if (navigationIntervalRef.current) {
            clearInterval(navigationIntervalRef.current);
            navigationIntervalRef.current = null;
          }
        }
      }
    }, 1000); // Update every second
  };
  
  // Stop navigation tracking
  const stopNavigationTracking = () => {
    if (navigationIntervalRef.current) {
      clearInterval(navigationIntervalRef.current);
      navigationIntervalRef.current = null;
    }
    voiceNavigationService.stop();
    setCurrentStepIndex(0);
    setDistanceToNextTurn(null);
  };
  
  // Initialize Google Map
  useEffect(() => {
    const initializeMap = async () => {
      if (!mapContainerRef.current) return;

      try {
        // Try to get user's current location for initial center
        let initialCenter = currentLocation 
          ? { lat: currentLocation.lat, lng: currentLocation.lng }
          : { lat: 9.0320, lng: 38.7469 }; // Default to Addis Ababa, Ethiopia
        
        // If no current location, try to get it from browser
        if (!currentLocation && 'geolocation' in navigator) {
          try {
            const position = await new Promise<GeolocationPosition>((resolve, reject) => {
              navigator.geolocation.getCurrentPosition(
                resolve,
                (error) => {
                  logger.warn('Geolocation failed:', error.message);
                  reject(error);
                },
                {
                  enableHighAccuracy: true,
                  timeout: 15000, // Longer timeout for initial location
                  maximumAge: 300000 // Allow cached location up to 5 minutes
                }
              );
            });
            
            initialCenter = {
              lat: position.coords.latitude,
              lng: position.coords.longitude
            };
            
            logger.info('Got initial location from browser:', initialCenter);
          } catch (error) {
            logger.info('Using default location (geolocation failed)');
          }
        }
        
        const googleMap = await googleMapsService.createMap(mapContainerRef.current, {
          zoom: 15,
          center: initialCenter,
          mapTypeId: mapStyle,
          disableDefaultUI: false,
          zoomControl: true,
          mapTypeControl: false,
          scaleControl: true,
          streetViewControl: true,
          rotateControl: true,
          fullscreenControl: true,
        });

        if (googleMap) {
          setMap(googleMap);
          
          // Initialize traffic layer
          const traffic = new google.maps.TrafficLayer();
          trafficLayer.current = traffic;
          if (isTrafficEnabled) {
            traffic.setMap(googleMap);
          }

          // Initialize directions renderer with Google Maps default styling
          const renderer = new google.maps.DirectionsRenderer({
            suppressMarkers: false, // Show default A and B markers
            suppressInfoWindows: false, // Show info windows on markers
            draggable: false,
            preserveViewport: false,
            polylineOptions: {
              strokeWeight: 5,
              strokeOpacity: 1.0,
              strokeColor: '#4285F4', // Google Maps blue
              geodesic: true,
              zIndex: 1
            },
            markerOptions: {
              animation: google.maps.Animation.DROP
            }
          });
          
          // Track renderer creation for debugging
          if (typeof window !== 'undefined') {
            window._directionsRendererCount = (window._directionsRendererCount || 0) + 1;
          }
          
          setDirectionsRenderer(renderer);
          
          logger.info('DirectionsRenderer initialized', {
            rendererCount: window._directionsRendererCount || 1,
            hasMap: !!googleMap,
            mapId: googleMap?.getDiv()?.id
          });
          
          // Also call onMapReady callback if provided
          if (onMapReady) {
            onMapReady(googleMap);
          }

          // Add map click handler
          googleMap.addListener('click', async (event: google.maps.MapMouseEvent) => {
            if (event.latLng) {
              const clickedPosition = {
                lat: event.latLng.lat(),
                lng: event.latLng.lng()
              };
              
              await handleMapClick(clickedPosition);
            }
          });
          
          // Add double-click handler to clear route
          googleMap.addListener('dblclick', handleMapDoubleClick);
          
          // Add drag detection event listeners
          googleMap.addListener('mousedown', () => {
            isMouseDownRef.current = true;
            isDraggingRef.current = false;
            setIsMouseDown(true);
            setIsDragging(false);
          });
          
          googleMap.addListener('mousemove', () => {
            if (isMouseDownRef.current) {
              isDraggingRef.current = true;
              setIsDragging(true);
            }
          });
          
          googleMap.addListener('mouseup', () => {
            isMouseDownRef.current = false;
            setIsMouseDown(false);
            setTimeout(() => {
              isDraggingRef.current = false;
              setIsDragging(false);
            }, 100);
          });
          
          // Handle drag start and end events from Google Maps API
          googleMap.addListener('dragstart', () => {
            isDraggingRef.current = true;
            setIsDragging(true);
          });
          
          googleMap.addListener('dragend', () => {
            setTimeout(() => {
              isDraggingRef.current = false;
              setIsDragging(false);
            }, 150);
          });
          
          // Start watching location for accuracy updates
          if (navigator.geolocation) {
            const watchId = navigator.geolocation.watchPosition(
              (position) => {
                setLocationAccuracy(position.coords.accuracy || 10);
                if (position.coords.speed !== null) {
                  setLocationSpeed(position.coords.speed || 0);
                }
                if (position.coords.heading !== null) {
                  setLocationHeading(position.coords.heading || 0);
                }
              },
              (error) => logger.warn('Location tracking error:', error),
              { enableHighAccuracy: true, maximumAge: 1000 }
            );
            
            // Clean up on unmount
            return () => navigator.geolocation.clearWatch(watchId);
          }

          // Notify parent component that map is ready
          if (onMapReady) {
            onMapReady(googleMap);
          }
          
          logger.info('Google Map initialized successfully');
          // Map loaded - no toast needed
        }
      } catch (error) {
        logger.error('Failed to initialize Google Map', error);
        setMapError('Failed to load Google Maps. Please check your internet connection and API key.');
        toast.error('Failed to load map');
      }
    };

    initializeMap();
  }, []);

  // Update current location marker with transport mode icon
  useEffect(() => {
    if (!map || !currentLocation) return;

    // Remove existing marker
    if (currentMarker) {
      currentMarker.setMap(null);
    }

    // Create enhanced current location marker SVG
    const markerSVG = getCurrentLocationMarkerSVG(
      transportMode as 'walking' | 'driving' | 'cycling' | 'transit',
      {
        heading: locationHeading,
        speed: locationSpeed,
        accuracy: locationAccuracy,
        isTracking: isTrackingLocation
      }
    );

    // Create custom marker with enhanced SVG using modern API
    const createModernMarker = async () => {
      try {
        // Try to use AdvancedMarkerElement
        const { AdvancedMarkerElement, PinElement } = await google.maps.importLibrary('marker') as any;
        
        if (AdvancedMarkerElement) {
          // Create content element with SVG
          const content = document.createElement('div');
          content.innerHTML = markerSVG;
          content.style.width = '60px';
          content.style.height = '60px';
          content.style.cursor = 'pointer';
          
          const marker = new AdvancedMarkerElement({
            map,
            position: { lat: currentLocation.lat, lng: currentLocation.lng },
            content,
            title: `Your Location (${transportMode})`,
            zIndex: 1000
          });
          
          setCurrentMarker(marker);
          logger.debug('Current location marker created with AdvancedMarkerElement');
        } else {
          throw new Error('AdvancedMarkerElement not available');
        }
      } catch (error) {
        // Fallback to legacy marker
        logger.warn('Using legacy marker for current location', error);
        const marker = new google.maps.Marker({
          position: { lat: currentLocation.lat, lng: currentLocation.lng },
          map: map,
          title: `Your Location (${transportMode})`,
          icon: {
            url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(markerSVG),
            scaledSize: new google.maps.Size(60, 60),
            anchor: new google.maps.Point(30, 30),
          },
          optimized: false,
          zIndex: 1000
        });
        
        setCurrentMarker(marker);
      }
    };
    
    createModernMarker();
  }, [map, currentLocation, transportMode, locationHeading, locationSpeed, locationAccuracy, isTrackingLocation]);

  // Add global mouse event listeners to handle mouse leave scenarios
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (isMouseDownRef.current || isDraggingRef.current) {
        isMouseDownRef.current = false;
        isDraggingRef.current = false;
        setIsMouseDown(false);
        setIsDragging(false);
      }
    };

    const handleGlobalMouseMove = (e: MouseEvent) => {
      // If mouse is down but not over the map, stop dragging
      if (isMouseDownRef.current && mapContainerRef.current) {
        const rect = mapContainerRef.current.getBoundingClientRect();
        const isOverMap = (
          e.clientX >= rect.left &&
          e.clientX <= rect.right &&
          e.clientY >= rect.top &&
          e.clientY <= rect.bottom
        );
        
        if (!isOverMap && isDraggingRef.current) {
          handleGlobalMouseUp();
        }
      }
    };

    document.addEventListener('mouseup', handleGlobalMouseUp);
    document.addEventListener('mousemove', handleGlobalMouseMove);

    return () => {
      document.removeEventListener('mouseup', handleGlobalMouseUp);
      document.removeEventListener('mousemove', handleGlobalMouseMove);
    };
  }, []);

  // Update selected location marker
  useEffect(() => {
    if (!map) return;

    const createSelectedMarker = async () => {
      // Remove existing selected marker
      if (selectedMarker) {
        if ('setMap' in selectedMarker) {
          selectedMarker.setMap(null);
        }
      }

      if (selectedLocation) {
        // Create new selected location marker
        const marker = await googleMapsService.createMarker({
          position: { lat: selectedLocation.lat, lng: selectedLocation.lng },
          map: map,
          title: selectedLocation.name,
          icon: {
            url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="#EA4335" stroke="#ffffff" stroke-width="2"/>
                <circle cx="12" cy="9" r="2.5" fill="#ffffff"/>
              </svg>
            `),
            scaledSize: new google.maps.Size(24, 24),
            anchor: new google.maps.Point(12, 24),
          },
        });

        // Add click listener for place details
        if (marker && 'addListener' in marker) {
          marker.addListener('click', () => {
            setSelectedPlace(selectedLocation);
            setIsPlaceSheetOpen(true);
          });
        }

        setSelectedMarker(marker);
      } else {
        setSelectedMarker(null);
      }
    };

    createSelectedMarker();
  }, [map, selectedLocation]);

  // Auto-calculate route when selectedLocation changes
  useEffect(() => {
    if (!map || !selectedLocation || !currentLocation) {
      if (selectedLocation) {
        setShowLocationNotification(true);
      } else {
        setShowLocationNotification(false);
      }
      return;
    }
    
    // Show location notification first
    setShowLocationNotification(true);
    
    // Automatically calculate route to selected location
    logger.info('Auto-calculating route to selected location', { 
      from: currentLocation.name, 
      to: selectedLocation.name,
      transportMode 
    });
    
    calculateRouteToLocation(currentLocation, selectedLocation);
  }, [map, selectedLocation, currentLocation, transportMode]);

  // Load nearby places when map is ready or when toggles change
  useEffect(() => {
    if (!map) return;
    
    // Load places when map is ready or toggles change
    loadNearbyPlaces();
  }, [map, showNearbyPlaces]);
  
  // Reload places when map center changes significantly (after dragging)
  useEffect(() => {
    if (!map || isDragging) return;
    
    const listener = map.addListener('idle', () => {
      // Map has stopped moving, load new places
      loadNearbyPlaces();
    });
    
    return () => {
      google.maps.event.removeListener(listener);
    };
  }, [map, isDragging]);

  // Display route when provided via props or state
  useEffect(() => {
    if (!map) {
      return;
    }
    
    // Only process if we have a valid route prop
    if (!route) {
      return;
    }

    // Check if route is a google.maps.DirectionsResult or has googleDirectionsResult property
    const directionsResult = route?.googleDirectionsResult || 
                            (route && 'routes' in route ? route : null);
    
    if (directionsResult && directionsResult.routes && directionsResult.routes.length > 0) {
      logger.info('Displaying route from props/state', {
        routeCount: directionsResult.routes.length,
        legs: directionsResult.routes[0].legs.length,
        distance: directionsResult.routes[0].legs[0]?.distance?.text,
        duration: directionsResult.routes[0].legs[0]?.duration?.text
      });
      
      // Ensure renderer is attached to map before setting directions
      if (directionsRenderer.getMap() !== map) {
        logger.info('Attaching renderer to map before displaying route');
        directionsRenderer.setMap(map);
      }
      
      // Set the directions
      directionsRenderer.setDirections(directionsResult);
      
      // Verify the route was set
      setTimeout(() => {
        const currentDirections = directionsRenderer.getDirections();
        if (currentDirections === directionsResult) {
          logger.info('✅ Route successfully set on renderer from props');
        } else {
          logger.error('❌ Route was not set correctly on renderer');
          DirectionsDebugger.logDiagnostics(directionsRenderer, directionsResult, map);
        }
      }, 100);
      
      // Fit bounds to show entire route
      const bounds = new google.maps.LatLngBounds();
      directionsResult.routes[0].legs.forEach(leg => {
        bounds.extend(leg.start_location);
        bounds.extend(leg.end_location);
      });
      map.fitBounds(bounds, { top: 50, right: 50, bottom: 50, left: 50 });
      
      logger.info('Route display complete from props/state');
    }
  }, [map, route]);

  // Handle center signal
  useEffect(() => {
    if (centerSignal > 0 && map && currentLocation) {
      setCenterPulse(true);
      map.panTo({ lat: currentLocation.lat, lng: currentLocation.lng });
      map.setZoom(16);
      
      setTimeout(() => setCenterPulse(false), 1000);
    }
  }, [centerSignal, map, currentLocation]);

  // Toggle map style
  const toggleMapStyle = useCallback(() => {
    if (!map) return;
    
    const styles: ('roadmap' | 'satellite' | 'terrain' | 'hybrid')[] = ['roadmap', 'satellite', 'terrain', 'hybrid'];
    const currentIndex = styles.indexOf(mapStyle);
    const nextStyle = styles[(currentIndex + 1) % styles.length];
    
    map.setMapTypeId(nextStyle);
    setMapStyle(nextStyle);
    
    toast.success(`Map style: ${nextStyle}`);
  }, [map, mapStyle]);

  // Toggle traffic layer
  const toggleTraffic = useCallback(() => {
    if (!trafficLayer.current) return;
    
    if (isTrafficEnabled) {
      trafficLayer.current.setMap(null);
    } else {
      trafficLayer.current.setMap(map);
    }
    
    setIsTrafficEnabled(!isTrafficEnabled);
    toast.success(`Traffic ${!isTrafficEnabled ? 'enabled' : 'disabled'}`);
  }, [map, isTrafficEnabled]);

  // Zoom controls
  const zoomIn = useCallback(() => {
    if (!map) return;
    const currentZoom = map.getZoom() || 15;
    map.setZoom(currentZoom + 1);
  }, [map]);

  const zoomOut = useCallback(() => {
    if (!map) return;
    const currentZoom = map.getZoom() || 15;
    map.setZoom(Math.max(currentZoom - 1, 1));
  }, [map]);

  // Force get real location
  const forceGetLocation = useCallback(async () => {
    const loadingToast = toast.loading('🌍 Getting your real location...');
    
    try {
      // Try to get fresh location with aggressive settings
      const position = await geolocationService.getFreshCurrentPosition({
        enableHighAccuracy: true,
        timeout: 30000, // Very long timeout
        maximumAge: 0 // Force fresh position
      });

      // Update current location in parent
      if (onLocationSelect) {
        const freshLocation = {
          id: 'current_real',
          name: 'Your Real Location',
          address: `Lat: ${position.lat.toFixed(6)}, Lng: ${position.lng.toFixed(6)}`,
          lat: position.lat,
          lng: position.lng,
          category: 'current'
        };
        onLocationSelect(freshLocation);
      }

      // Center map on real location
      if (map) {
        map.panTo({ lat: position.lat, lng: position.lng });
        map.setZoom(17);
      }

      toast.dismiss(loadingToast);
      toast.success(`📍 Got your location in Addis Ababa! Accuracy: ±${Math.round(position.accuracy)}m`);
      
      logger.info('Real location found:', position);
    } catch (error) {
      toast.dismiss(loadingToast);
      toast.error('Could not get your real location. Make sure location permission is enabled and you have GPS signal.');
      logger.error('Failed to get real location:', error);
    }
  }, [map, onLocationSelect]);

  // Start real-time navigation with intelligent voice guidance
  const startRealTimeNavigation = useCallback(async (directionsResult: google.maps.DirectionsResult) => {
    if (!directionsResult.routes?.[0]) {
      toast.error('No route available for real-time navigation');
      return;
    }

    try {
      const route = directionsResult.routes[0];
      const transportModeMap = {
        'walking': 'walking' as const,
        'cycling': 'cycling' as const, 
        'driving': 'driving' as const,
        'transit': 'transit' as const
      };
      
      const mode = transportModeMap[transportMode as keyof typeof transportModeMap] || 'walking';
      
      await realtimeNavigationService.startNavigation(route, mode, {
        onLocationUpdate: (state: NavigationState) => {
          setNavigationState(state);
          
          // Update transport mode icon based on detected mode
          if (state.transportMode !== mode) {
            logger.info(`🚶➡️🚴➡️🚗 Transport mode auto-updated: ${state.transportMode}`);
          }
        },
        
        onWrongWayDetected: (deviation: RouteDeviation) => {
          setWrongWayAlert(true);
          setRouteDeviation(deviation);
          
          if (isVoiceEnabled && navigationState) {
            voiceNavigationService.announceWrongWay(
              navigationState.movementHeading,
              navigationState.routeDirection || 0,
              navigationState.transportMode
            );
          }
          
          // Auto-clear alert after 10 seconds
          setTimeout(() => setWrongWayAlert(false), 10000);
        },
        
        onRouteDeviationDetected: (deviation: RouteDeviation) => {
          setRouteDeviation(deviation);
          
          if (isVoiceEnabled) {
            voiceNavigationService.announceRouteDeviation(deviation, mode);
          }
          
          toast.warning(`You're ${Math.round(deviation.deviationDistance)}m off route`, {
            description: deviation.suggestedAction === 'recalculate' 
              ? 'Looking for alternative routes...' 
              : 'Please return to the main path'
          });
        },
        
        onAlternativeRouteFound: (routes: google.maps.DirectionsRoute[]) => {
          setAlternativeRoutes(routes);
          
          if (isVoiceEnabled && routes.length > 0) {
            voiceNavigationService.announceAlternativeRoute(routes);
          }
          
          toast.success(`Found ${routes.length} alternative routes`, {
            description: 'Tap to switch to a different route'
          });
        },
        
        onBackOnRoute: () => {
          setWrongWayAlert(false);
          setRouteDeviation(null);
          
          if (isVoiceEnabled) {
            voiceNavigationService.announceBackOnRoute();
          }
          
          toast.success('✅ Back on route!');
        }
      });
      
      setIsRealTimeNavigation(true);
      voiceNavigationService.reset(); // Reset voice navigation state
      
      // Navigation started - minimal notification only
      logger.info('Real-time navigation started with voice guidance');
      
    } catch (error) {
      logger.error('Failed to start real-time navigation:', error);
      toast.error('Failed to start real-time navigation');
    }
  }, [transportMode, isVoiceEnabled, navigationState]);

  // Stop real-time navigation
  const stopRealTimeNavigation = useCallback(() => {
    realtimeNavigationService.stopNavigation();
    setIsRealTimeNavigation(false);
    setNavigationState(null);
    setWrongWayAlert(false);
    setRouteDeviation(null);
    setAlternativeRoutes([]);
    
    voiceNavigationService.stop();
    logger.info('Real-time navigation stopped');
  }, []);

  // Handle alternative route selection
  const selectAlternativeRoute = useCallback((routeIndex: number) => {
    if (!alternativeRoutes[routeIndex]) return;
    
    const selectedRoute = alternativeRoutes[routeIndex];
    
    // Update the directions renderer with new route
    if (directionsRenderer && map) {
      const newResult: google.maps.DirectionsResult = {
        routes: [selectedRoute],
        status: google.maps.DirectionsStatus.OK,
        request: {} as google.maps.DirectionsRequest
      };
      
      directionsRenderer.setDirections(newResult);
      
      // Restart real-time navigation with new route
      stopRealTimeNavigation();
      setTimeout(() => {
        startRealTimeNavigation(newResult);
      }, 1000);
      
      toast.success(`Switched to alternative route ${routeIndex + 1}`);
    }
  }, [alternativeRoutes, directionsRenderer, map, startRealTimeNavigation, stopRealTimeNavigation]);

  if (mapError) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-gray-100">
        <div className="text-center p-6 max-w-md">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Map Error</h3>
          <p className="text-gray-600 mb-4">{mapError}</p>
          <Button onClick={() => window.location.reload()} variant="outline">
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full relative">
      {/* Map Container */}
      <div 
        ref={mapContainerRef} 
        className={`map-container h-full w-full ${
          isDragging || isMouseDown ? 'dragging' : ''
        }`}
      />
      
      {/* Real-time Directional Transport Icon */}
      {navigationState ? (
        <div className="absolute bottom-20 right-4 z-10">
          <div 
            className="cursor-pointer"
            onClick={() => {
              if (map && navigationState.currentLocation) {
                map.panTo({
                  lat: navigationState.currentLocation.lat,
                  lng: navigationState.currentLocation.lng
                });
                map.setZoom(18);
                // Location centered - no toast needed
              }
            }}
          >
            <DirectionalTransportIcon
              transportMode={navigationState.transportMode}
              heading={navigationState.currentHeading}
              size={64}
              showCompass={true}
              isMoving={navigationState.speed > 0.5}
              speed={navigationState.speed}
            />
          </div>
          
          {/* Real-time status indicators */}
          <div className="mt-2 space-y-1">
            {/* Speed and accuracy */}
            <div className="bg-white rounded-lg px-2 py-1 text-xs shadow-lg">
              <div className="flex items-center gap-1">
                <span className="text-gray-600">Speed:</span>
                <span className="font-mono">{(navigationState.speed * 3.6).toFixed(1)} km/h</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-gray-600">GPS:</span>
                <span className={`font-mono ${
                  navigationState.accuracy < 20 ? 'text-green-600' : 
                  navigationState.accuracy < 50 ? 'text-yellow-600' : 'text-red-600'
                }`}>
                  ±{Math.round(navigationState.accuracy)}m
                </span>
              </div>
            </div>
            
            {/* Wrong way alert */}
            {wrongWayAlert && (
              <div className="bg-red-100 border border-red-300 rounded-lg px-2 py-1 text-xs">
                <div className="flex items-center gap-1 text-red-700">
                  <Warning className="w-3 h-3" />
                  <span className="font-semibold">Wrong Way!</span>
                </div>
                <div className="text-red-600 text-xs mt-1">
                  Turn around and head {navigationState.routeDirection ? 
                    Math.round(navigationState.routeDirection) + '°' : 'back to route'}
                </div>
              </div>
            )}
            
            {/* Route deviation alert */}
            {routeDeviation && !wrongWayAlert && (
              <div className="bg-yellow-100 border border-yellow-300 rounded-lg px-2 py-1 text-xs">
                <div className="flex items-center gap-1 text-yellow-700">
                  <Navigation2 className="w-3 h-3" />
                  <span className="font-semibold">Off Route</span>
                </div>
                <div className="text-yellow-600 text-xs mt-1">
                  {Math.round(routeDeviation.deviationDistance)}m from path
                </div>
              </div>
            )}
            
            {/* Alternative routes available */}
            {alternativeRoutes.length > 0 && (
              <Button
                size="sm"
                className="w-full bg-blue-100 hover:bg-blue-200 text-blue-700 text-xs py-1"
                onClick={() => {
                  // Show alternative routes selector
                  toast.info(`${alternativeRoutes.length} alternative routes available`);
                }}
              >
                {alternativeRoutes.length} Alt Routes
              </Button>
            )}
          </div>
        </div>
      ) : (
        /* Fallback to current location button when not in real-time navigation */
        <CurrentLocationButton
          transportMode={transportMode as 'walking' | 'driving' | 'cycling' | 'transit'}
          isTracking={isTrackingLocation}
          accuracy={locationAccuracy}
          onCenterLocation={() => {
            if (map && currentLocation) {
              map.panTo({ lat: currentLocation.lat, lng: currentLocation.lng });
              map.setZoom(17);
              // Location centered
            }
          }}
          onToggleTracking={() => {
            if (isTrackingLocation) {
              stopLocationTracking();
            } else {
              startLocationTracking();
            }
          }}
          position="bottom-right"
        />
      )}

      {/* Map Controls */}
      <div className="absolute top-4 right-4 flex flex-col gap-2 z-10">
        {/* Nearby Places Controls */}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              size="sm"
              className="h-10 w-10 bg-white hover:bg-gray-50 text-gray-700 shadow-lg"
            >
              <MapPin className="w-4 h-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64" align="end">
            <div className="space-y-3">
              <h3 className="font-semibold text-sm">Nearby Places</h3>
              
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="restaurants" className="text-sm flex items-center gap-2">
                    <Utensils className="w-4 h-4 text-red-500" />
                    Restaurants & Cafes
                  </Label>
                  <Switch
                    id="restaurants"
                    checked={showNearbyPlaces.restaurants}
                    onCheckedChange={(checked) => {
                      setShowNearbyPlaces(prev => ({ ...prev, restaurants: checked }));
                    }}
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <Label htmlFor="atms" className="text-sm flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-green-500" />
                    ATMs & Banks
                  </Label>
                  <Switch
                    id="atms"
                    checked={showNearbyPlaces.atms}
                    onCheckedChange={(checked) => {
                      setShowNearbyPlaces(prev => ({ ...prev, atms: checked }));
                    }}
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <Label htmlFor="landmarks" className="text-sm flex items-center gap-2">
                    <Landmark className="w-4 h-4 text-purple-500" />
                    Landmarks & Parks
                  </Label>
                  <Switch
                    id="landmarks"
                    checked={showNearbyPlaces.landmarks}
                    onCheckedChange={(checked) => {
                      setShowNearbyPlaces(prev => ({ ...prev, landmarks: checked }));
                    }}
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <Label htmlFor="services" className="text-sm flex items-center gap-2">
                    <Fuel className="w-4 h-4 text-orange-500" />
                    Gas & Pharmacy
                  </Label>
                  <Switch
                    id="services"
                    checked={showNearbyPlaces.services}
                    onCheckedChange={(checked) => {
                      setShowNearbyPlaces(prev => ({ ...prev, services: checked }));
                    }}
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <Label htmlFor="parking" className="text-sm flex items-center gap-2">
                    <Car className="w-4 h-4 text-blue-600" />
                    Parking Areas
                  </Label>
                  <Switch
                    id="parking"
                    checked={showNearbyPlaces.parking}
                    onCheckedChange={(checked) => {
                      setShowNearbyPlaces(prev => ({ ...prev, parking: checked }));
                    }}
                  />
                </div>
              </div>
              
              {isLoadingPlaces && (
                <div className="text-sm text-gray-500 flex items-center gap-2">
                  <div className="animate-spin w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full" />
                  Loading places...
                </div>
              )}
              
              <Button
                size="sm"
                variant="outline"
                className="w-full"
                onClick={loadNearbyPlaces}
              >
                Refresh Places
              </Button>
            </div>
          </PopoverContent>
        </Popover>
        
        {/* Zoom Controls */}
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          <Button
            size="sm"
            variant="ghost"
            className="h-10 w-10 rounded-none border-b bg-blue-50 hover:bg-blue-100 text-blue-600"
            onClick={zoomIn}
          >
            <Plus className="w-5 h-5 font-bold" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-10 w-10 rounded-none bg-blue-50 hover:bg-blue-100 text-blue-600"
            onClick={zoomOut}
          >
            <Minus className="w-5 h-5 font-bold" />
          </Button>
        </div>

        {/* Map Style Control */}
        <Button
          size="sm"
          className="h-10 w-10 bg-white hover:bg-gray-50 text-gray-700 shadow-lg"
          onClick={toggleMapStyle}
        >
          {mapStyle === 'satellite' ? <Satellite className="w-4 h-4" /> : <Layers className="w-4 h-4" />}
        </Button>

        {/* Traffic Control */}
        <Button
          size="sm"
          className={`h-10 w-10 shadow-lg ${
            isTrafficEnabled 
              ? 'bg-red-500 hover:bg-red-600 text-white' 
              : 'bg-white hover:bg-gray-50 text-gray-700'
          }`}
          onClick={toggleTraffic}
        >
          <Car className="w-4 h-4" />
        </Button>
        
        {/* Voice Navigation Toggle */}
        {(isNavigating || isRealTimeNavigation) && (
          <Button
            size="sm"
            className={`h-10 w-10 shadow-lg ${
              isVoiceEnabled 
                ? 'bg-green-500 hover:bg-green-600 text-white' 
                : 'bg-white hover:bg-gray-50 text-gray-700'
            }`}
            onClick={() => {
              const newState = voiceNavigationService.toggle();
              setIsVoiceEnabled(newState);
              toast.success(`Voice navigation ${newState ? 'enabled' : 'disabled'}`);
            }}
          >
            {isVoiceEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </Button>
        )}
      </div>

      {/* Location Status and Click Instructions */}
      {currentLocation && !showRouteOptions && (
        <div className="absolute bottom-4 left-4 z-10">
          <div className={`bg-white rounded-lg shadow-lg px-3 py-2 flex items-center gap-2 transition-all duration-300 ${
            centerPulse ? 'ring-4 ring-blue-400 ring-opacity-50' : ''
          }`}>
            <div className={`w-3 h-3 rounded-full ${isTrackingLocation ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
            <span className="text-sm font-medium text-gray-700">
              {isTrackingLocation ? 'Location tracking' : 'Location found'}
            </span>
          </div>
          
          <div className="mt-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
            <p className="text-xs text-blue-700 font-medium">
              💡 Click anywhere on the map to get directions
            </p>
          </div>
        </div>
      )}

      {/* Route Info and Navigation Status */}
      {route && (
        <div className="absolute bottom-4 right-4 z-10">
          <div className="bg-white rounded-lg shadow-lg p-3 max-w-xs">
            {/* Navigation Status - Show when navigating */}
            {isNavigating && distanceToNextTurn !== null && (
              <div className="mb-3 pb-3 border-b border-gray-200">
                <div className="flex items-center gap-2">
                  <div className="bg-blue-500 text-white rounded-full p-1">
                    <Navigation className="w-3 h-3" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">
                      Next turn in {distanceToNextTurn}m
                    </p>
                    {isVoiceEnabled && (
                      <p className="text-xs text-green-600 flex items-center gap-1">
                        <Volume2 className="w-3 h-3" />
                        Voice guidance active
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}
            
            {/* Route Summary */}
            <div className="flex items-center gap-2 mb-1">
              <Navigation className="w-4 h-4 text-blue-500" />
              <span className="text-sm font-medium text-gray-900">
                {route.distance} • {route.duration}
              </span>
            </div>
            <p className="text-xs text-gray-600">
              {route.mode.charAt(0).toUpperCase() + route.mode.slice(1)} route
            </p>
            
            {/* Quick Start Navigation Button */}
            {!isRealTimeNavigation && (
              <Button
                size="sm"
                className="w-full mt-2 bg-blue-600 hover:bg-blue-700 text-white"
                onClick={() => {
                  if (currentDirectionsResult) {
                    startRealTimeNavigation(currentDirectionsResult);
                  } else {
                    toast.error('No route available for navigation');
                  }
                }}
              >
                <Navigation2 className="w-4 h-4 mr-1" />
                Start Smart Navigation
              </Button>
            )}
            
            {/* Stop Navigation Button */}
            {isRealTimeNavigation && (
              <Button
                size="sm"
                className="w-full mt-2 bg-red-600 hover:bg-red-700 text-white"
                onClick={stopRealTimeNavigation}
              >
                <X className="w-4 h-4 mr-1" />
                Stop Smart Navigation
              </Button>
            )}
          </div>
        </div>
      )}
      
      {/* Step-by-Step Navigation Panel - Show when navigating */}
      {isNavigating && currentDirectionsResult && (
        <div className="absolute bottom-4 left-4 z-10 max-w-sm">
          <div className="bg-white rounded-lg shadow-lg p-4">
            <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <Navigation className="w-4 h-4 text-blue-600" />
              Turn-by-Turn Directions
            </h3>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {currentDirectionsResult.routes[0]?.legs[0]?.steps?.map((step, index) => {
                const isCurrentStep = index === currentStepIndex;
                const isUpcoming = index === currentStepIndex + 1;
                
                return (
                  <div
                    key={index}
                    className={`p-2 rounded-lg text-sm ${
                      isCurrentStep
                        ? 'bg-blue-100 border-l-4 border-blue-500'
                        : isUpcoming
                        ? 'bg-yellow-50 border-l-4 border-yellow-400'
                        : 'bg-gray-50'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                        isCurrentStep
                          ? 'bg-blue-500 text-white'
                          : isUpcoming
                          ? 'bg-yellow-400 text-black'
                          : 'bg-gray-300 text-gray-600'
                      }`}>
                        {index + 1}
                      </div>
                      <div className="flex-1">
                        <div
                          className="text-gray-900"
                          dangerouslySetInnerHTML={{
                            __html: step.instructions?.replace(/<[^>]*>/g, '') || 'Continue straight'
                          }}
                        />
                        <div className="text-xs text-gray-600 mt-1">
                          {step.distance?.text} • {step.duration?.text}
                          {isCurrentStep && distanceToNextTurn && (
                            <span className="ml-2 font-semibold text-blue-600">
                              ({distanceToNextTurn}m remaining)
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              }).slice(0, 5) /* Show only next 5 steps */}
            </div>
            
            {/* Progress indicator */}
            <div className="mt-3 pt-3 border-t border-gray-200">
              <div className="flex justify-between text-xs text-gray-600 mb-1">
                <span>Step {currentStepIndex + 1} of {currentDirectionsResult.routes[0]?.legs[0]?.steps?.length || 0}</span>
                <span>{transportMode === 'walking' ? '🚶 Walking' : transportMode === 'driving' ? '🚗 Driving' : '🚴 Cycling'}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-1">
                <div
                  className="bg-blue-600 h-1 rounded-full transition-all duration-300"
                  style={{
                    width: `${((currentStepIndex + 1) / (currentDirectionsResult.routes[0]?.legs[0]?.steps?.length || 1)) * 100}%`
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Clicked Location Route Options */}
      {showRouteOptions && clickedLocation && currentLocation && (
        <div className="absolute bottom-4 left-4 right-4 z-20">
          <div className="bg-white rounded-lg shadow-lg p-4 max-w-md mx-auto">
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900 mb-1">
                  {clickedLocation.name}
                </h3>
                <p className="text-sm text-gray-600 mb-2">
                  {clickedLocation.address}
                </p>
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="text-gray-400 hover:text-gray-600 p-1"
                onClick={() => {
                  setShowRouteOptions(false);
                  setClickedLocation(null);
                  if (clickedMarkerRef.current) {
                    clickedMarkerRef.current.setMap(null);
                  }
                  if (directionsRenderer) {
                    directionsRenderer.setMap(null);
                  }
                }}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
            
            {isCalculatingRoute ? (
              <div className="flex items-center gap-2 py-2">
                <div className="animate-spin w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full" />
                <span className="text-sm text-gray-600">Calculating fastest route...</span>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center gap-2 py-1">
                  <Navigation className="w-4 h-4 text-green-500" />
                  <span className="text-sm text-gray-900">
                    Route calculated • {transportMode.charAt(0).toUpperCase() + transportMode.slice(1)}
                  </span>
                </div>
                
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="bg-blue-500 hover:bg-blue-600 text-white flex-1"
                    onClick={() => {
                      if (currentDirectionsResult) {
                        startRealTimeNavigation(currentDirectionsResult);
                      } else {
                        toast.error('Please calculate route first');
                      }
                    }}
                  >
                    <Navigation2 className="w-4 h-4 mr-1" />
                    Start Smart Navigation
                  </Button>
                  
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setSelectedPlace(clickedLocation);
                      setIsPlaceSheetOpen(true);
                    }}
                  >
                    Details
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Loading Overlay for Route Calculation */}
      {isCalculatingRoute && (
        <div className="absolute inset-0 bg-black bg-opacity-20 flex items-center justify-center z-30">
          <div className="bg-white rounded-lg p-6 shadow-lg">
            <div className="flex items-center gap-3">
              <div className="animate-spin w-6 h-6 border-3 border-blue-500 border-t-transparent rounded-full" />
              <div>
                <p className="font-medium text-gray-900">Finding fastest route...</p>
                <p className="text-sm text-gray-600">Calculating directions with real-time traffic</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Location Selected Notification */}
      <LocationSelectedNotification
        location={selectedLocation ? {
          name: selectedLocation.name,
          address: selectedLocation.address
        } : null}
        routeInfo={localRouteInfo}
        transportMode={transportMode}
        isCalculating={isCalculatingRoute}
        onStartNavigation={() => {
          if (currentDirectionsResult) {
            // Start real-time smart navigation
            startRealTimeNavigation(currentDirectionsResult);
          } else {
            toast.error('No route available for navigation. Please calculate route first.');
          }
        }}
        onViewDetails={() => {
          // Force show the route screen for detailed planning
          if (selectedLocation && onForceRouteScreen) {
            onForceRouteScreen(selectedLocation);
          } else {
            // Fallback: just show the route panel
            setShowRoutePanel(true);
          }
        }}
        onDismiss={() => {
          setShowLocationNotification(false);
          // Optionally clear the selected location
          if (onLocationSelect) {
            // Clear selection by calling with null - this needs to be handled in parent
            onLocationSelect(null as any);
          }
        }}
      />

      {/* Enhanced Route Info Panel */}
      {currentDirectionsResult && (
        <RouteInfoPanel
          directionsResult={currentDirectionsResult}
          transportMode={transportMode}
          isVisible={showRoutePanel}
          onToggleVisibility={() => setShowRoutePanel(!showRoutePanel)}
          onAlternativeSelect={(routeIndex) => {
            // Switch to alternative route
            if (currentDirectionsResult && routeIndex < currentDirectionsResult.routes.length) {
              const selectedRoute = currentDirectionsResult.routes[routeIndex];
              const newResult = {
                ...currentDirectionsResult,
                routes: [selectedRoute, ...currentDirectionsResult.routes.filter((_, i) => i !== routeIndex)]
              };
              
              // Clear existing renderers
              if (directionsRenderer) {
                directionsRenderer.setMap(null);
              }
              
              // Display new primary route
              displayPrimaryRoute(newResult);
              setCurrentDirectionsResult(newResult);
              
              toast.success(`Switched to alternative route ${routeIndex + 1}`);
            }
          }}
          onStartNavigation={() => {
            if (currentDirectionsResult && currentLocation && clickedLocation) {
              // Create route object for navigation
              const route = currentDirectionsResult.routes[0];
              const leg = route.legs[0];
              
              const routeObj = {
                id: `route_${Date.now()}`,
                from: currentLocation,
                to: clickedLocation,
                distance: leg.distance?.text || 'Unknown',
                duration: leg.duration?.text || 'Unknown',
                mode: transportMode,
                steps: leg.steps?.map(step => step.instructions.replace(/<[^>]*>/g, '')) || [],
                geometry: route.overview_polyline ? [] : undefined,
                googleDirectionsResult: currentDirectionsResult
              };
              
              if (onRouteRequest) {
                onRouteRequest(currentLocation, clickedLocation);
              }
              
              toast.success(`Started navigation to ${clickedLocation.name}`);
            }
          }}
        />
      )}

      {/* Place Details Sheet */}
      <PlaceDetailsSheet
        place={selectedPlace}
        isOpen={isPlaceSheetOpen}
        onClose={() => setIsPlaceSheetOpen(false)}
        onNavigate={() => {
          // Handle navigation to selected place
          if (selectedPlace) {
            toast.success(`Starting navigation to ${selectedPlace.name}`);
          }
          setIsPlaceSheetOpen(false);
        }}
        onShare={() => {
          if (selectedPlace && navigator.share) {
            navigator.share({
              title: selectedPlace.name,
              text: `Check out ${selectedPlace.name} - ${selectedPlace.address}`,
              url: window.location.href
            });
          }
        }}
      />
    </div>
  );
}
