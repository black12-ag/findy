import React, { useEffect, useRef, useState, useCallback } from 'react';
import { MapPin, Navigation, Car, User, AlertTriangle, Layers, RotateCcw, Satellite, Moon, Eye, EyeOff, Compass, X, Plus, Minus } from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { PlaceDetailsSheet } from './PlaceDetailsSheet';
import { CurrentLocationButton } from './CurrentLocationButton';
import { getCurrentLocationMarkerSVG } from './CurrentLocationMarker';
import googleMapsService from '../services/googleMapsService';
import { logger } from '../utils/logger';
import { toast } from 'sonner';
import { DirectionsDebugger } from '../utils/directionsDebugger';
import { useLocation } from '../contexts/LocationContext';

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
        // Try to get current location from browser
        if ('geolocation' in navigator) {
          const loadingToast = toast.loading('📍 Getting your location...');
          
          try {
            const position = await new Promise<GeolocationPosition>((resolve, reject) => {
              navigator.geolocation.getCurrentPosition(
                resolve,
                reject,
                {
                  enableHighAccuracy: true,
                  timeout: 10000,
                  maximumAge: 0
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
            
            toast.dismiss(loadingToast);
            logger.info('Got current location:', userLocation);
          } catch (error) {
            toast.dismiss(loadingToast);
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
      if (!directionsRenderer) {
        logger.warn('DirectionsRenderer not initialized, creating new one');
        const newRenderer = new google.maps.DirectionsRenderer({
          suppressMarkers: false, // Show Google's default A and B markers
          suppressInfoWindows: false, // Allow info windows on markers
          draggable: false,
          preserveViewport: false,
          polylineOptions: {
            strokeWeight: 5,
            strokeOpacity: 1,
            strokeColor: '#4285F4', // Google Maps blue
            geodesic: true
          },
          markerOptions: {
            animation: google.maps.Animation.DROP
          }
        });
        setDirectionsRenderer(newRenderer);
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

      // Display the route on map
      if (map) {
        // Ensure we have a DirectionsRenderer
        let renderer = directionsRenderer;
        if (!renderer) {
          logger.info('Creating new DirectionsRenderer');
          renderer = new google.maps.DirectionsRenderer({
            suppressMarkers: false, // Show A and B markers
            suppressInfoWindows: false, // Show info windows
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
          setDirectionsRenderer(renderer);
        }
        
        // Clear any existing route first
        renderer.setMap(null);
        
        // Set Google Maps-like styling for route
        const routeOptions = {
          suppressMarkers: false, // Show A and B markers
          suppressInfoWindows: false, // Show info windows
          suppressBicyclingLayer: transportMode !== 'cycling',
          preserveViewport: false,
          polylineOptions: {
            strokeColor: {
              driving: '#4285F4', // Google blue
              walking: '#4285F4', // Keep blue for consistency  
              cycling: '#4285F4', // Keep blue for consistency
              transit: '#4285F4'  // Keep blue for consistency
            }[transportMode] || '#4285F4',
            strokeWeight: 5,
            strokeOpacity: 1.0,
            geodesic: true,
            zIndex: 1
          },
          markerOptions: {
            animation: google.maps.Animation.DROP
          }
        };
        
        // Apply the new options
        renderer.setOptions(routeOptions);
        
        // Attach to map and set directions
        renderer.setMap(map);
        renderer.setDirections(directionsResult);
        
        logger.info('Route displayed on map', { 
          transportMode, 
          routeDistance: directionsResult.routes[0]?.legs[0]?.distance?.text,
          routeDuration: directionsResult.routes[0]?.legs[0]?.duration?.text,
          mapHasRenderer: !!renderer,
          rendererHasMap: renderer.getMap() === map,
          routeHasGeometry: !!directionsResult.routes[0]?.overview_polyline
        });
        
        // Verify route is rendered after a short delay
        setTimeout(() => {
          if (renderer.getDirections() === directionsResult && renderer.getMap() === map) {
            logger.info('Route confirmed visible on map');
          } else {
            logger.warn('Route may not be visible - running diagnostics...');
            
            // Run full diagnostics
            DirectionsDebugger.logDiagnostics(renderer, directionsResult, map);
            
            // Attempt auto-fix
            const fixed = DirectionsDebugger.attemptAutoFix(renderer, directionsResult, map);
            if (fixed) {
              logger.info('Auto-fix applied successfully');
            } else {
              logger.error('Auto-fix failed - manual intervention may be needed');
            }
          }
        }, 500);
        
        // Fit bounds to show entire route
        const bounds = new google.maps.LatLngBounds();
        directionsResult.routes[0].legs.forEach(leg => {
          bounds.extend(leg.start_location);
          bounds.extend(leg.end_location);
        });
        map.fitBounds(bounds, { top: 50, right: 50, bottom: 50, left: 50 });

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
      } else {
        logger.error('Map instance not available for displaying route');
      }
    } catch (error) {
      logger.error('Failed to calculate route:', error);
      toast.error(`Failed to calculate ${transportMode} route: ${error.message || error}`);
      
      // Clear any existing route on error
      if (directionsRenderer) {
        directionsRenderer.setMap(null);
      }
    }
  };

  // Clear current route
  const clearRoute = () => {
    if (directionsRenderer) {
      directionsRenderer.setMap(null);
      logger.info('Route cleared from map');
    }
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
    toast.info('Route cleared');
  };

  // Initialize Google Map
  useEffect(() => {
    const initializeMap = async () => {
      if (!mapContainerRef.current) return;

      try {
        const googleMap = await googleMapsService.createMap(mapContainerRef.current, {
          zoom: 15,
          center: currentLocation 
            ? { lat: currentLocation.lat, lng: currentLocation.lng }
            : { lat: 37.7749, lng: -122.4194 }, // Default to San Francisco
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
          toast.success('Map loaded successfully');
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
          logger.info('Current location marker created with AdvancedMarkerElement');
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

  // Display route when provided via props or state
  useEffect(() => {
    logger.info('Route prop effect triggered', {
      hasMap: !!map,
      hasRenderer: !!directionsRenderer,
      hasRoute: !!route,
      routeType: route ? typeof route : 'none',
      hasGoogleDirections: !!route?.googleDirectionsResult,
      hasRoutesArray: !!(route && 'routes' in route)
    });
    
    if (!map || !directionsRenderer) {
      logger.info('Map or directionsRenderer not ready for displaying route');
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
    } else if (directionsRenderer.getMap()) {
      logger.info('No valid route in props - clearing route from map');
      directionsRenderer.setMap(null);
    } else {
      logger.info('No route to display and no route to clear');
    }
  }, [map, directionsRenderer, route]);

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
      <div ref={mapContainerRef} className="h-full w-full" />
      
      {/* Current Location Button */}
      <CurrentLocationButton
        transportMode={transportMode as 'walking' | 'driving' | 'cycling' | 'transit'}
        isTracking={isTrackingLocation}
        accuracy={locationAccuracy}
        onCenterLocation={() => {
          if (map && currentLocation) {
            map.panTo({ lat: currentLocation.lat, lng: currentLocation.lng });
            map.setZoom(17);
            toast.success(`Centered on ${transportMode} location`);
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

      {/* Map Controls */}
      <div className="absolute top-4 right-4 flex flex-col gap-2 z-10">
        {/* Zoom Controls */}
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          <Button
            size="sm"
            variant="ghost"
            className="h-10 w-10 rounded-none border-b"
            onClick={zoomIn}
          >
            <Plus className="w-4 h-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-10 w-10 rounded-none"
            onClick={zoomOut}
          >
            <Minus className="w-4 h-4" />
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

      {/* Route Info */}
      {route && (
        <div className="absolute bottom-4 right-4 z-10">
          <div className="bg-white rounded-lg shadow-lg p-3 max-w-xs">
            <div className="flex items-center gap-2 mb-1">
              <Navigation className="w-4 h-4 text-blue-500" />
              <span className="text-sm font-medium text-gray-900">
                {route.distance} • {route.duration}
              </span>
            </div>
            <p className="text-xs text-gray-600">
              {route.mode.charAt(0).toUpperCase() + route.mode.slice(1)} route
            </p>
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
                      if (onRouteRequest && currentLocation && clickedLocation) {
                        onRouteRequest(currentLocation, clickedLocation);
                      }
                      toast.success('Starting navigation to ' + clickedLocation.name);
                    }}
                  >
                    <Navigation className="w-4 h-4 mr-1" />
                    Start Navigation
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