import React, { useEffect, useRef, useState } from 'react';
import { MapPin, Navigation, Car, User, AlertTriangle, Layers, Box, Map as MapIcon, Plus, Minus, RotateCcw, Satellite, Mountain, Moon, Eye, EyeOff, Compass, X } from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { PlaceDetailsSheet } from './PlaceDetailsSheet';
import { CurrentLocationButton } from './CurrentLocationButton';
import { getCurrentLocationMarkerSVG } from './CurrentLocationMarker';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { logger } from '../utils/logger';
import { toast } from 'sonner';
import { directionsService } from '../services/directionsService';
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
}

interface MapViewProps {
  currentLocation: Location | null;
  selectedLocation: Location | null;
  route: Route | null;
  transportMode: string;
  isNavigating: boolean;
  centerSignal?: number;
  onLocationSelect?: (location: Location) => void;
  onRouteRequest?: (from: Location, to: Location) => void;
}

const getStyleUrl = (style: string) => {
  switch (style) {
    case 'satellite':
      return import.meta.env.VITE_MAP_STYLE_URL_SATELLITE;
    case 'terrain':
      return import.meta.env.VITE_MAP_STYLE_URL_TERRAIN;
    case 'dark':
      return import.meta.env.VITE_MAP_STYLE_URL_DARK;
    default:
      return import.meta.env.VITE_MAP_STYLE_URL_STANDARD;
  }
};

export function MapView({ 
  currentLocation, 
  selectedLocation, 
  route, 
  transportMode,
  isNavigating,
  centerSignal = 0,
  onLocationSelect,
  onRouteRequest,
}: MapViewProps) {
  const { isTrackingLocation, startLocationTracking, stopLocationTracking } = useLocation();
  const [showTrafficLayer, setShowTrafficLayer] = useState(true);
  const [is3DView, setIs3DView] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(15);
  const [centerPulse, setCenterPulse] = useState(false);
  const [mapStyle, setMapStyle] = useState<'standard' | 'satellite' | 'terrain' | 'dark'>('standard');
  const [mapBearing, setMapBearing] = useState(0); // For compass rotation
  const [trafficData, setTrafficData] = useState<any[]>([]); // Mock traffic data
  const [selectedPlace, setSelectedPlace] = useState<any>(null);
  const [isPlaceSheetOpen, setIsPlaceSheetOpen] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [showWalking, setShowWalking] = useState(false);

  // Base map providers (no API keys required)
  const BASE_SOURCE_ID = 'base-tiles';
  const BASE_LAYER_ID = 'base-raster';
  const OSM_SOURCE_ID = 'osm-tiles';
  const OSM_LAYER_ID = 'osm-tiles';
  const baseStyles: Record<'standard' | 'satellite' | 'terrain' | 'dark', { tiles: string[]; tileSize: number; attribution: string }> = {
    standard: {
      tiles: [
        'https://a.tile.openstreetmap.org/{z}/{x}/{y}.png',
        'https://b.tile.openstreetmap.org/{z}/{x}/{y}.png',
        'https://c.tile.openstreetmap.org/{z}/{x}/{y}.png',
      ],
      tileSize: 256,
      attribution: '© OpenStreetMap contributors',
    },
    terrain: {
      tiles: [
        'https://a.tile.opentopomap.org/{z}/{x}/{y}.png',
        'https://b.tile.opentopomap.org/{z}/{x}/{y}.png',
        'https://c.tile.opentopomap.org/{z}/{x}/{y}.png',
      ],
      tileSize: 256,
      attribution: '© OpenTopoMap contributors',
    },
    satellite: {
      tiles: [
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      ],
      tileSize: 256,
      attribution: '© Esri & contributors',
    },
    dark: {
      tiles: [
        'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
        'https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
        'https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
      ],
      tileSize: 256,
      attribution: '© OpenStreetMap, © CARTO',
    },
  };

  const applyBaseMap = (styleKey: 'standard' | 'satellite' | 'terrain' | 'dark') => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;
    const cfg = baseStyles[styleKey];
    try { localStorage.setItem('map_style', styleKey); } catch {}

    // Remove current base layer/source if present
    try { if (map.getLayer(BASE_LAYER_ID)) map.removeLayer(BASE_LAYER_ID); } catch {}
    try { if (map.getSource(BASE_SOURCE_ID)) map.removeSource(BASE_SOURCE_ID); } catch {}

    // Also remove the initial OSM layer/source if still present
    try { if (map.getLayer(OSM_LAYER_ID)) map.removeLayer(OSM_LAYER_ID); } catch {}
    try { if (map.getSource(OSM_SOURCE_ID)) map.removeSource(OSM_SOURCE_ID); } catch {}

    map.addSource(BASE_SOURCE_ID, {
      type: 'raster',
      tiles: cfg.tiles,
      tileSize: cfg.tileSize,
      attribution: cfg.attribution,
    } as any);

    const baseLayerDef: any = {
      id: BASE_LAYER_ID,
      type: 'raster',
      source: BASE_SOURCE_ID,
      minzoom: 0,
      maxzoom: 20,
    };

    // Place the base layer at the very bottom so overlays remain visible
    const layers = map.getStyle()?.layers || [];
    const firstLayerId = layers.length > 0 ? layers[0].id : undefined;
    if (firstLayerId) {
      map.addLayer(baseLayerDef, firstLayerId);
    } else {
      map.addLayer(baseLayerDef);
    }

    setMapStyle(styleKey);
  };
  const [markedDestination, setMarkedDestination] = useState<Location | null>(null);
  const [userPath, setUserPath] = useState<[number, number][]>([]);
  const [directions, setDirections] = useState<string[]>([]);
  const [currentDirection, setCurrentDirection] = useState<string>('');
  const [distanceToDestination, setDistanceToDestination] = useState<number | null>(null);
  const [routeOptions, setRouteOptions] = useState<any[]>([]);
  const [selectedRoute, setSelectedRoute] = useState<number>(0);
  const [showRouteOptions, setShowRouteOptions] = useState(false);
  const [locationAccuracy, setLocationAccuracy] = useState<number>(10);
  const [locationSpeed, setLocationSpeed] = useState<number>(0);
  const [locationHeading, setLocationHeading] = useState<number>(0);

  // MapLibre refs
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const currentMarkerRef = useRef<maplibregl.Marker | null>(null);
  const selectedMarkerRef = useRef<maplibregl.Marker | null>(null);
  const destinationMarkerRef = useRef<maplibregl.Marker | null>(null);
  const watchIdRef = useRef<number | null>(null);

  // Compute a visual zoom scale from the zoom level
  const baseZoom = 15;
  const zoomScale = Math.max(0.8, Math.min(1.8, zoomLevel / baseZoom));

  // Trigger a brief pulse on the current location when center is requested
  useEffect(() => {
    if (centerSignal > 0 && mapRef.current && currentLocation) {
      setCenterPulse(true);
      // Actually center the map
      mapRef.current.flyTo({
        center: [currentLocation.lng, currentLocation.lat],
        zoom: 15,
        duration: 1000
      });
      const t = setTimeout(() => setCenterPulse(false), 800);
      return () => clearTimeout(t);
    }
  }, [centerSignal, currentLocation]);
 
  // Start real-time GPS tracking
  useEffect(() => {
    if (!isTrackingLocation) {
      // If GPS tracking is disabled but we have currentLocation, use it for path tracking
      if (currentLocation && userPath.length === 0) {
        setUserPath([[currentLocation.lng, currentLocation.lat]]);
      }
      return;
    }

    const startTracking = () => {
      if (!navigator.geolocation) {
        toast.error('Geolocation is not supported by this browser');
        return;
      }

      const options = {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 1000
      };

      watchIdRef.current = navigator.geolocation.watchPosition(
        (position) => {
          const newLocation = {
            id: 'current',
            name: 'Current Location',
            address: 'Your current position',
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };
          
          // Update location accuracy and speed
          setLocationAccuracy(position.coords.accuracy || 10);
          if (position.coords.speed !== null) {
            setLocationSpeed(position.coords.speed);
          }
          if (position.coords.heading !== null) {
            setLocationHeading(position.coords.heading);
          }

          // Auto-detect transport mode based on speed
          if (position.coords.speed && position.coords.speed > 0) {
            const detectedMode = detectTransportMode(position.coords.speed);
            if (detectedMode !== transportMode) {
              // Only update if we have a reliable speed reading and it's different
              logger.debug('Transport mode auto-detected:', detectedMode, 'Speed:', position.coords.speed);
              // You could update transport mode here if desired
              // setTransportMode(detectedMode);
            }
          }

          // Update path tracking
          setUserPath(prev => {
            const newPath = [...prev, [newLocation.lng, newLocation.lat] as [number, number]];
            // Keep only last 100 points to avoid memory issues
            return newPath.slice(-100);
          });

          // Calculate distance to destination if one is marked
          if (markedDestination) {
            // Use selected route for navigation if available
            let targetCoords = { lat: markedDestination.lat, lng: markedDestination.lng };
            let routeInfo = '';
            
            if (routeOptions.length > 0 && selectedRoute < routeOptions.length) {
              const selectedRouteOption = routeOptions[selectedRoute];
              routeInfo = ` via ${selectedRouteOption.name.split(' ')[1]} Route`;
              
              // Find the next waypoint in the selected route
              const currentPos = [newLocation.lng, newLocation.lat];
              const routeGeometry = selectedRouteOption.geometry;
              
              // Find closest point on route and next waypoint
              let closestIndex = 0;
              let minDistance = Infinity;
              
              routeGeometry.forEach((coord: [number, number], index: number) => {
                const distance = calculateDistance(
                  newLocation.lat, newLocation.lng,
                  coord[1], coord[0]
                );
                if (distance < minDistance) {
                  minDistance = distance;
                  closestIndex = index;
                }
              });
              
              // Use next waypoint as target if available
              if (closestIndex < routeGeometry.length - 1) {
                const nextWaypoint = routeGeometry[closestIndex + 1];
                targetCoords = { lat: nextWaypoint[1], lng: nextWaypoint[0] };
              }
            }
            
            const distance = calculateDistance(
              newLocation.lat,
              newLocation.lng,
              targetCoords.lat,
              targetCoords.lng
            );
            setDistanceToDestination(distance);
            
            // Update direction
            const bearing = calculateBearing(
              newLocation.lat,
              newLocation.lng,
              targetCoords.lat,
              targetCoords.lng
            );
            setCurrentDirection(getDirectionText(bearing) + routeInfo);
          }

          logger.debug('GPS position updated:', position.coords);
        },
        (error) => {
          logger.error('GPS tracking error:', error);
          // Only show user-facing errors for critical issues, not timeouts
          switch (error.code) {
            case error.PERMISSION_DENIED:
              toast.error('Location access denied. Please enable GPS permissions.');
              stopLocationTracking(); // Stop trying if permission denied
              break;
            case error.POSITION_UNAVAILABLE:
              logger.warn('GPS position unavailable, using fallback location');
              // Don't show toast for this, it's common indoors
              break;
            case error.TIMEOUT:
              logger.warn('GPS timeout, will retry on next update');
              // Don't show toast for timeouts, they're normal
              break;
          }
        },
        options
      );
    };

    startTracking();

    return () => {
      if (watchIdRef.current) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [isTrackingLocation, markedDestination, routeOptions, selectedRoute]);

  // Fallback: Update path with currentLocation prop when GPS tracking is disabled
  useEffect(() => {
    if (!isTrackingLocation && currentLocation) {
      setUserPath(prev => {
        // Only add if this is a new position
        const lastPos = prev[prev.length - 1];
        if (!lastPos || lastPos[0] !== currentLocation.lng || lastPos[1] !== currentLocation.lat) {
          const newPath = [...prev, [currentLocation.lng, currentLocation.lat] as [number, number]];
          return newPath.slice(-100);
        }
        return prev;
      });

      // Update distance and direction if we have a destination
      if (markedDestination) {
        const distance = calculateDistance(
          currentLocation.lat,
          currentLocation.lng,
          markedDestination.lat,
          markedDestination.lng
        );
        setDistanceToDestination(distance);
        
        const bearing = calculateBearing(
          currentLocation.lat,
          currentLocation.lng,
          markedDestination.lat,
          markedDestination.lng
        );
        setCurrentDirection(getDirectionText(bearing));
      }
    }
  }, [currentLocation, isTrackingLocation, markedDestination]);

  // Initialize MapLibre map (even if we don't have currentLocation yet)
  useEffect(() => {
    if (mapRef.current || !mapContainerRef.current) return;

    // Use a free OpenStreetMap style that doesn't require API keys
    const openMapStyle = {
      version: 8,
      sources: {
        'osm-tiles': {
          type: 'raster',
          tiles: [
            'https://a.tile.openstreetmap.org/{z}/{x}/{y}.png',
            'https://b.tile.openstreetmap.org/{z}/{x}/{y}.png',
            'https://c.tile.openstreetmap.org/{z}/{x}/{y}.png'
          ],
          tileSize: 256,
          attribution: '© OpenStreetMap contributors'
        }
      },
      layers: [
        {
          id: 'osm-tiles',
          type: 'raster',
          source: 'osm-tiles',
          minzoom: 0,
          maxzoom: 19
        }
      ]
    };

    const defaultCenter: [number, number] = [-122.4194, 37.7749]; // SF fallback for dev/demo
    const startCenter: [number, number] = currentLocation 
      ? [currentLocation.lng, currentLocation.lat]
      : defaultCenter;

    try {
      const map = new maplibregl.Map({
        container: mapContainerRef.current,
        style: openMapStyle as any,
        center: startCenter,
        zoom: 14,
        attributionControl: true
      });
      mapRef.current = map;
      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-left');

      // Helpful debug
      logger.info('Map initialized with OpenStreetMap', { center: startCenter });

      map.on('load', () => {
        setMapLoaded(true);
        setMapError(null);
        logger.info('Map loaded successfully');
        try {
          const savedStyle = (localStorage.getItem('map_style') as 'standard' | 'satellite' | 'terrain' | 'dark' | null) || null;
          if (savedStyle && savedStyle !== mapStyle) {
            // apply on next frame to allow mapLoaded state to propagate
            requestAnimationFrame(() => applyBaseMap(savedStyle));
          }
        } catch {}
      });

      map.on('rotate', () => {
        setMapBearing(map.getBearing());
      });

      map.on('zoom', () => {
        setZoomLevel(map.getZoom());
      });

      // Add map click handler for marking destinations
      map.on('click', async (e) => {
        if (!currentLocation) {
          toast.error('Current location not available. Please enable location services.');
          return;
        }

        const { lng, lat } = e.lngLat;
        const newDestination: Location = {
          id: `clicked_${Date.now()}`,
          name: 'Selected Location',
          address: `${lat.toFixed(6)}, ${lng.toFixed(6)}`,
          lat,
          lng,
          category: 'selected'
        };
        
        setMarkedDestination(newDestination);
        
        // Call parent callback if provided
        if (onLocationSelect) {
          onLocationSelect(newDestination);
        }
        
        // Generate route options if we have current location
        if (currentLocation) {
          toast.info(`Calculating ${transportMode} route...`);
          
          try {
            const routes = await generateRouteOptions(currentLocation, newDestination);
            setRouteOptions(routes);
            setSelectedRoute(0); // Default to shortest route (now first)
            setShowRouteOptions(false); // Don't show panel by default
            
            // Show success message with transport mode
            const modeEmoji = {
              driving: '🚗',
              walking: '🚶',
              cycling: '🚴',
              transit: '🚌'
            }[transportMode] || '📍';
            
            toast.success(`${modeEmoji} ${transportMode.toUpperCase()} route found!`, {
              duration: 4000
            });
            
            // Call parent route callback if provided
            if (onRouteRequest) {
              onRouteRequest(currentLocation, newDestination);
            }
            
            logger.debug('Generated route options for', transportMode, ':', routes);
          } catch (error) {
            logger.error('Failed to generate routes:', error);
            toast.error('Failed to calculate route. Please try again.');
          }
        }
        
        logger.debug('Location clicked for', transportMode, ':', newDestination);
      });

      map.on('error', (e) => {
        // Capture style/tile loading errors (401/403/etc.)
        const message = (e && (e as any).error && (e as any).error.message) || 'Map error';
        // Don't show minor tile loading errors
        if (!message.includes('404') && !message.includes('tile')) {
          setMapError(message);
        }
        logger.warn('Map warning', { message, event: e });
      });

      // If we already have a current location on mount, add the marker
      if (currentLocation) {
        currentMarkerRef.current = new maplibregl.Marker({ color: '#3B82F6' })
          .setLngLat([currentLocation.lng, currentLocation.lat])
          .addTo(map);
      }
      

    } catch (error) {
      logger.error('Failed to initialize map', error);
      setMapError('Failed to initialize map. Please refresh the page.');
    }

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      currentMarkerRef.current = null;
      selectedMarkerRef.current = null;
      destinationMarkerRef.current = null;
      if (watchIdRef.current) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, []);

  // Update current location marker with transport mode indicator
  useEffect(() => {
    if (!mapRef.current || !currentLocation) return;
    const map = mapRef.current;
    
    // Remove existing marker
    if (currentMarkerRef.current) {
      currentMarkerRef.current.remove();
    }
    
    // Create custom HTML element for enhanced location marker
    const el = document.createElement('div');
    el.className = 'current-location-marker';
    el.style.cssText = 'position: relative; width: 60px; height: 60px;';
    
    // Set the SVG content using the enhanced marker
    const markerSVG = getCurrentLocationMarkerSVG(
      transportMode as 'walking' | 'driving' | 'cycling' | 'transit',
      {
        heading: locationHeading,
        speed: locationSpeed,
        accuracy: locationAccuracy,
        isTracking: isTrackingLocation
      }
    );
    
    el.innerHTML = markerSVG;
    
    // Create new marker with custom element
    currentMarkerRef.current = new maplibregl.Marker({ element: el })
      .setLngLat([currentLocation.lng, currentLocation.lat])
      .addTo(map);
    
    // Smoothly center the map on the new location once
    map.flyTo({ center: [currentLocation.lng, currentLocation.lat], zoom: Math.max(12, map.getZoom()) });
  }, [currentLocation?.lat, currentLocation?.lng, transportMode, locationHeading, locationSpeed, locationAccuracy, isTrackingLocation]);

  // Update selected marker
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (selectedLocation) {
      if (!selectedMarkerRef.current) {
        selectedMarkerRef.current = new maplibregl.Marker({ color: '#EF4444' });
      }
      selectedMarkerRef.current.setLngLat([selectedLocation.lng, selectedLocation.lat]).addTo(map);
    } else if (selectedMarkerRef.current) {
      selectedMarkerRef.current.remove();
      selectedMarkerRef.current = null;
    }
  }, [selectedLocation?.lat, selectedLocation?.lng]);

  // Draw multiple route options
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    // Remove existing route layers and outline layers
    const routeLayerIds = ['route-line', 'route-fastest', 'route-shortest', 'route-safest', 'route-scenic',
                          'route-fastest-outline', 'route-shortest-outline', 'route-safest-outline', 'route-scenic-outline'];
    const routeSourceIds = ['route-source', 'route-fastest-source', 'route-shortest-source', 'route-safest-source', 'route-scenic-source',
                           'route-fastest-outline-source', 'route-shortest-outline-source', 'route-safest-outline-source', 'route-scenic-outline-source'];
    
    routeLayerIds.forEach(layerId => {
      if (map.getLayer(layerId)) map.removeLayer(layerId);
    });
    routeSourceIds.forEach(sourceId => {
      if (map.getSource(sourceId)) map.removeSource(sourceId);
    });

    // Draw original route if available
    const r: any = route as any;
    if (r && Array.isArray(r?.geometry) && r.geometry.length > 1) {
      const geojson: any = {
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: r.geometry },
        properties: {},
      };
      map.addSource('route-source', { type: 'geojson', data: geojson });
      map.addLayer({
        id: 'route-line',
        type: 'line',
        source: 'route-source',
        paint: { 'line-color': '#3B82F6', 'line-width': 4, 'line-opacity': 0.85 },
      });
    }

    // Draw multiple route options - all visible like Google Maps
    if (routeOptions.length > 0) {
      // Sort routes so selected route is drawn last (on top)
      const sortedRoutes = [...routeOptions];
      const selectedRouteOption = sortedRoutes[selectedRoute];
      
      // Remove selected route from array and add it at the end
      sortedRoutes.splice(selectedRoute, 1);
      sortedRoutes.push(selectedRouteOption);
      
      sortedRoutes.forEach((routeOption, drawIndex) => {
        const originalIndex = routeOptions.findIndex(r => r.id === routeOption.id);
        const isSelected = originalIndex === selectedRoute;
        const sourceId = `route-${routeOption.id}-source`;
        
        // Create outline layer (shadow) for selected route
        if (isSelected) {
          const outlineLayerId = `route-${routeOption.id}-outline`;
          const outlineSourceId = `route-${routeOption.id}-outline-source`;
          
          const outlineGeojson = {
            type: 'Feature',
            geometry: {
              type: 'LineString',
              coordinates: routeOption.geometry
            },
            properties: { routeType: routeOption.type }
          };

          map.addSource(outlineSourceId, {
            type: 'geojson',
            data: outlineGeojson as any
          });

          map.addLayer({
            id: outlineLayerId,
            type: 'line',
            source: outlineSourceId,
            paint: {
              'line-color': '#FFFFFF',
              'line-width': 8,
              'line-opacity': 0.8
            }
          });
        }
        
        // Main route line
        const layerId = `route-${routeOption.id}`;
        const geojson = {
          type: 'Feature',
          geometry: {
            type: 'LineString',
            coordinates: routeOption.geometry
          },
          properties: { routeType: routeOption.type }
        };

        map.addSource(sourceId, {
          type: 'geojson',
          data: geojson as any
        });

        // Determine visual properties based on selection
        const routeColor = isSelected ? '#1E40AF' : '#6B7280'; // Blue for selected, gray for others
        const routeWidth = isSelected ? 6 : 4;
        const routeOpacity = isSelected ? 1.0 : 0.5;

        map.addLayer({
          id: layerId,
          type: 'line',
          source: sourceId,
          paint: {
            'line-color': routeColor,
            'line-width': routeWidth,
            'line-opacity': routeOpacity
            // All routes are solid lines like Google Maps
          }
        });
        
        // Add click handler to route line for selection
        map.on('click', layerId, () => {
          const clickedIndex = routeOptions.findIndex(r => r.id === routeOption.id);
          if (clickedIndex !== selectedRoute) {
            setSelectedRoute(clickedIndex);
            toast.success(`${routeOptions[clickedIndex].name} selected`);
            logger.debug('Route clicked and selected:', routeOptions[clickedIndex]);
          }
        });
        
        // Change cursor on hover
        map.on('mouseenter', layerId, () => {
          map.getCanvas().style.cursor = 'pointer';
        });
        
        map.on('mouseleave', layerId, () => {
          map.getCanvas().style.cursor = '';
        });
      });

      // Fit map to show all routes with some padding
      const bounds = new maplibregl.LngLatBounds();
      routeOptions.forEach(routeOption => {
        routeOption.geometry.forEach((coord: [number, number]) => {
          bounds.extend(coord);
        });
      });
      map.fitBounds(bounds, { padding: 100 });
    }
  }, [route, routeOptions, selectedRoute, mapLoaded]);

  // Add/remove traffic overlay visualization
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    // Remove existing traffic layers
    if (map.getLayer('traffic-heavy')) map.removeLayer('traffic-heavy');
    if (map.getLayer('traffic-moderate')) map.removeLayer('traffic-moderate');
    if (map.getLayer('traffic-light')) map.removeLayer('traffic-light');
    if (map.getSource('traffic-source')) map.removeSource('traffic-source');

    if (showTrafficLayer && currentLocation) {
      // Create mock traffic data around current location
      const mockTrafficData = {
        type: 'FeatureCollection',
        features: [
          // Heavy traffic (red)
          {
            type: 'Feature',
            geometry: {
              type: 'LineString',
              coordinates: [
                [currentLocation.lng - 0.002, currentLocation.lat + 0.001],
                [currentLocation.lng + 0.001, currentLocation.lat + 0.002]
              ]
            },
            properties: { congestion: 'heavy' }
          },
          // Moderate traffic (yellow)
          {
            type: 'Feature',
            geometry: {
              type: 'LineString',
              coordinates: [
                [currentLocation.lng - 0.001, currentLocation.lat - 0.001],
                [currentLocation.lng + 0.002, currentLocation.lat - 0.001]
              ]
            },
            properties: { congestion: 'moderate' }
          },
          // Light traffic (green)
          {
            type: 'Feature',
            geometry: {
              type: 'LineString',
              coordinates: [
                [currentLocation.lng, currentLocation.lat + 0.003],
                [currentLocation.lng + 0.004, currentLocation.lat + 0.003]
              ]
            },
            properties: { congestion: 'light' }
          },
          // Another heavy traffic segment
          {
            type: 'Feature',
            geometry: {
              type: 'LineString',
              coordinates: [
                [currentLocation.lng + 0.003, currentLocation.lat],
                [currentLocation.lng + 0.003, currentLocation.lat - 0.003]
              ]
            },
            properties: { congestion: 'heavy' }
          }
        ]
      };

      map.addSource('traffic-source', {
        type: 'geojson',
        data: mockTrafficData as any
      });

      // Add heavy traffic layer (red)
      map.addLayer({
        id: 'traffic-heavy',
        type: 'line',
        source: 'traffic-source',
        filter: ['==', ['get', 'congestion'], 'heavy'],
        paint: {
          'line-color': '#DC2626',
          'line-width': 6,
          'line-opacity': 0.7
        }
      });

      // Add moderate traffic layer (yellow)
      map.addLayer({
        id: 'traffic-moderate',
        type: 'line',
        source: 'traffic-source',
        filter: ['==', ['get', 'congestion'], 'moderate'],
        paint: {
          'line-color': '#F59E0B',
          'line-width': 5,
          'line-opacity': 0.6
        }
      });

      // Add light traffic layer (green)
      map.addLayer({
        id: 'traffic-light',
        type: 'line',
        source: 'traffic-source',
        filter: ['==', ['get', 'congestion'], 'light'],
        paint: {
          'line-color': '#10B981',
          'line-width': 4,
          'line-opacity': 0.5
        }
      });

      logger.debug('Traffic layers added to map');
    }
  }, [showTrafficLayer, currentLocation, mapLoaded]);

  // Utility function to calculate distance between two points in meters
  const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lng2 - lng1) * Math.PI / 180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c;
  };

  // Calculate bearing (direction) from point A to point B
  const calculateBearing = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δλ = (lng2 - lng1) * Math.PI / 180;

    const y = Math.sin(Δλ) * Math.cos(φ2);
    const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);

    const θ = Math.atan2(y, x);
    return (θ * 180 / Math.PI + 360) % 360; // Convert to degrees and normalize
  };

  // Convert bearing to human-readable direction
  const getDirectionText = (bearing: number): string => {
    const directions = [
      'North', 'North-Northeast', 'Northeast', 'East-Northeast',
      'East', 'East-Southeast', 'Southeast', 'South-Southeast',
      'South', 'South-Southwest', 'Southwest', 'West-Southwest',
      'West', 'West-Northwest', 'Northwest', 'North-Northwest'
    ];
    const index = Math.round(bearing / 22.5) % 16;
    return directions[index];
  };

  // Format distance for display
  const formatDistance = (distance: number): string => {
    if (distance < 1000) {
      return `${Math.round(distance)}m`;
    } else {
      return `${(distance / 1000).toFixed(1)}km`;
    }
  };

  // Fetch real routes from OpenRouteService API (free tier)
  const fetchRealRoute = async (start: Location, destination: Location, mode: string = 'driving-car') => {
    try {
      // OpenRouteService API endpoint (free tier, no API key required for demo)
      const orsMode = mode === 'walking' ? 'foot-walking' : 
                      mode === 'cycling' ? 'cycling-regular' : 'driving-car';
      
      // Use the ORS directions API
      const url = `https://api.openrouteservice.org/v2/directions/${orsMode}`;
      
      // For demo purposes, use the public instance (limited requests)
      // In production, you should get a free API key from https://openrouteservice.org/
      const apiKey = '5b3ce3597851110001cf6248aa7b5a4c14ab4e10a5e5c45a851ad65c'; // Demo key
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': apiKey
        },
        body: JSON.stringify({
          coordinates: [
            [start.lng, start.lat],
            [destination.lng, destination.lat]
          ]
        })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.routes && data.routes[0]) {
          const route = data.routes[0];
          // Decode the geometry to get actual street coordinates
          const coordinates = route.geometry.coordinates || [];
          return {
            geometry: coordinates,
            distance: route.summary.distance,
            duration: route.summary.duration
          };
        }
      }
    } catch (error) {
      logger.warn('Failed to fetch real route, using fallback', error);
    }
    
    // Fallback to simple routing if API fails
    return null;
  };

  // Create realistic fallback route if API fails
  const createFallbackRoute = (start: Location, destination: Location, routeType: 'fastest' | 'shortest' | 'safest' | 'scenic') => {
    const lngDiff = destination.lng - start.lng;
    const latDiff = destination.lat - start.lat;
    
    // Create L-shaped route that follows grid pattern
    const route: [number, number][] = [[start.lng, start.lat]];
    
    if (routeType === 'shortest') {
      // Simple L-shape
      route.push([destination.lng, start.lat]);
      route.push([destination.lng, destination.lat]);
    } else if (routeType === 'fastest') {
      // Diagonal then straight
      const midPoint = [start.lng + lngDiff * 0.6, start.lat + latDiff * 0.4];
      route.push(midPoint as [number, number]);
      route.push([destination.lng, destination.lat]);
    } else if (routeType === 'safest') {
      // Multiple right-angle turns
      route.push([start.lng + lngDiff * 0.3, start.lat]);
      route.push([start.lng + lngDiff * 0.3, start.lat + latDiff * 0.5]);
      route.push([start.lng + lngDiff * 0.7, start.lat + latDiff * 0.5]);
      route.push([start.lng + lngDiff * 0.7, destination.lat]);
      route.push([destination.lng, destination.lat]);
    } else {
      // Scenic with curves
      route.push([start.lng + lngDiff * 0.2, start.lat + latDiff * 0.3]);
      route.push([start.lng + lngDiff * 0.5, start.lat + latDiff * 0.6]);
      route.push([start.lng + lngDiff * 0.8, start.lat + latDiff * 0.4]);
      route.push([destination.lng, destination.lat]);
    }
    
    return route;
  };

  // Detect transport mode based on user speed
  const detectTransportMode = (speed: number) => {
    // Speed in m/s
    if (speed < 2) return 'walking'; // < 7.2 km/h
    if (speed < 8) return 'cycling'; // < 28.8 km/h
    if (speed < 15) return 'transit'; // < 54 km/h
    return 'driving'; // > 54 km/h
  };

  // Generate multiple route options with different criteria
  const generateRouteOptions = async (start: Location, destination: Location) => {
    const baseDistance = calculateDistance(start.lat, start.lng, destination.lat, destination.lng);
    const walkingSpeed = 5; // km/h
    const cyclingSpeed = 15; // km/h
    const drivingSpeed = 30; // km/h
    const transitSpeed = 20; // km/h
    
    // Try to fetch real route from API
    const realRoute = await fetchRealRoute(start, destination, transportMode);
    
    let shortestRoute, fastestRoute, safestRoute, scenicRoute;
    
    if (realRoute && realRoute.geometry.length > 0) {
      // Use real route data for the primary route
      shortestRoute = realRoute.geometry;
      
      // Create variations for other route types
      fastestRoute = realRoute.geometry;
      safestRoute = realRoute.geometry;
      scenicRoute = realRoute.geometry;
      
      logger.info('Using real route data from API');
    } else {
      // Fallback to generated routes
      shortestRoute = createFallbackRoute(start, destination, 'shortest');
      fastestRoute = createFallbackRoute(start, destination, 'fastest');
      safestRoute = createFallbackRoute(start, destination, 'safest');
      scenicRoute = createFallbackRoute(start, destination, 'scenic');
      
      logger.info('Using fallback routes');
    }
    
    // Calculate durations based on transport mode
    const calculateDuration = (distance: number, speed: number) => {
      const hours = distance / 1000 / speed;
      const minutes = Math.round(hours * 60);
      return Math.max(1, minutes);
    };

    // Get transport mode icons
    const getTransportIcon = (mode: string) => {
      switch (mode) {
        case 'walking': return '🚶';
        case 'cycling': return '🚴';
        case 'driving': return '🚗';
        case 'transit': return '🚍';
        default: return '🚶';
      }
    };
    
    const currentTransportMode = transportMode || 'walking';
    const transportIcon = getTransportIcon(currentTransportMode);
    
    // Calculate speed based on transport mode
    let speed = walkingSpeed;
    switch (currentTransportMode) {
      case 'cycling': speed = cyclingSpeed; break;
      case 'driving': speed = drivingSpeed; break;
      case 'transit': speed = transitSpeed; break;
    }

    return [
      {
        id: 'shortest',
        name: `${transportIcon} Shortest Route`,
        description: 'Most direct path',
        geometry: shortestRoute,
        distance: formatDistance(baseDistance),
        duration: `${calculateDuration(baseDistance, speed)} min`,
        color: '#1E40AF', // Prominent blue for recommended route
        type: 'shortest',
        safety: 'High',
        traffic: 'Light',
        highlights: ['Direct path', 'Shortest distance']
      },
      {
        id: 'fastest',
        name: `${transportIcon} Fastest Route`,
        description: 'Quickest way with main roads',
        geometry: fastestRoute,
        distance: formatDistance(baseDistance * 0.95),
        duration: `${calculateDuration(baseDistance * 0.95, speed * 1.2)} min`,
        color: '#6B7280', // Gray for alternative route
        type: 'fastest',
        safety: 'Medium',
        traffic: 'Moderate',
        highlights: ['Main roads', 'Less traffic']
      },
      {
        id: 'safest',
        name: `${transportIcon} Safest Route`,
        description: 'Well-lit roads with low crime',
        geometry: safestRoute,
        distance: formatDistance(baseDistance * 1.15),
        duration: `${calculateDuration(baseDistance * 1.15, speed * 0.9)} min`,
        color: '#6B7280', // Gray for alternative route
        type: 'safest',
        safety: 'Very High',
        traffic: 'Light',
        highlights: ['Well-lit streets', 'Safe neighborhoods']
      },
      {
        id: 'scenic',
        name: `${transportIcon} Scenic Route`,
        description: 'Beautiful views and landmarks',
        geometry: scenicRoute,
        distance: formatDistance(baseDistance * 1.25),
        duration: `${calculateDuration(baseDistance * 1.25, speed * 0.8)} min`,
        color: '#6B7280', // Gray for alternative route
        type: 'scenic',
        safety: 'Medium',
        traffic: 'Light',
        highlights: ['City views', 'Parks', 'Landmarks']
      }
    ];
  };

  // Add clickable places on the map
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded || !currentLocation) return;

    // Mock nearby places
    const nearbyPlaces = [
      {
        id: 'place1',
        name: 'Central Coffee Shop',
        lat: currentLocation.lat + 0.002,
        lng: currentLocation.lng + 0.001,
        address: '123 Main St',
        category: 'Coffee',
        rating: 4.5,
        hours: 'Open until 8 PM',
        phone: '555-0123'
      },
      {
        id: 'place2',
        name: 'City Park',
        lat: currentLocation.lat - 0.003,
        lng: currentLocation.lng + 0.002,
        address: '456 Park Ave',
        category: 'Park',
        rating: 4.8,
        hours: 'Open 24 hours',
        phone: null
      },
      {
        id: 'place3',
        name: 'Tech Store',
        lat: currentLocation.lat + 0.001,
        lng: currentLocation.lng - 0.003,
        address: '789 Tech Blvd',
        category: 'Electronics',
        rating: 4.2,
        hours: 'Open until 9 PM',
        phone: '555-0456'
      }
    ];

    // Add place markers
    nearbyPlaces.forEach(place => {
      const marker = new maplibregl.Marker({ color: '#8B5CF6' })
        .setLngLat([place.lng, place.lat])
        .addTo(map);

      // Add click handler
      marker.getElement().addEventListener('click', () => {
        setSelectedPlace(place);
        setIsPlaceSheetOpen(true);
        logger.debug('Place clicked:', place.name);
      });
    });
  }, [currentLocation, mapLoaded]);

  // Update destination marker
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Remove existing destination marker
    if (destinationMarkerRef.current) {
      destinationMarkerRef.current.remove();
      destinationMarkerRef.current = null;
    }

    if (markedDestination) {
      // Create red destination marker
      destinationMarkerRef.current = new maplibregl.Marker({ color: '#DC2626' })
        .setLngLat([markedDestination.lng, markedDestination.lat])
        .addTo(map);

      // Add popup with destination info
      const popup = new maplibregl.Popup({ offset: 25 })
        .setHTML(`
          <div class="p-2">
            <h3 class="font-semibold">${markedDestination.name}</h3>
            <p class="text-sm text-gray-600">${markedDestination.address}</p>
            ${distanceToDestination ? `<p class="text-sm font-medium text-blue-600 mt-1">${formatDistance(distanceToDestination)} away</p>` : ''}
          </div>
        `);
      
      destinationMarkerRef.current.setPopup(popup);
    }
  }, [markedDestination, distanceToDestination]);

  // Draw user's path
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded || userPath.length < 2) return;

    // Remove existing path
    if (map.getLayer('user-path')) map.removeLayer('user-path');
    if (map.getSource('user-path-source')) map.removeSource('user-path-source');

    const pathGeoJson = {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: userPath
      },
      properties: {}
    };

    map.addSource('user-path-source', {
      type: 'geojson',
      data: pathGeoJson as any
    });

    map.addLayer({
      id: 'user-path',
      type: 'line',
      source: 'user-path-source',
      paint: {
        'line-color': '#10B981', // Green color for user path
        'line-width': 3,
        'line-opacity': 0.8
      }
    });
  }, [userPath, mapLoaded]);

  const getTransportIcon = () => {
    switch (transportMode) {
      case 'driving': return <Car className="w-4 h-4" />;
      case 'walking': return <User className="w-4 h-4" />;
      case 'transit': return <Navigation className="w-4 h-4" />;
      case 'cycling': return <Navigation className="w-4 h-4" style={{ transform: 'rotate(45deg)' }} />;
      default: return <Car className="w-4 h-4" />;
    }
  };

  const getTransportColor = () => {
    switch (transportMode) {
      case 'driving': return '#3B82F6'; // Blue
      case 'walking': return '#10B981'; // Green  
      case 'transit': return '#F59E0B'; // Amber
      case 'cycling': return '#8B5CF6'; // Violet
      default: return '#5B4FE5'; // Primary purple
    }
  };

  const getMapBackground = () => {
    switch (mapStyle) {
      case 'satellite':
        return 'bg-gradient-to-br from-gray-800 to-gray-900';
      case 'terrain':
        return 'bg-gradient-to-br from-green-100 to-amber-50';
      case 'dark':
        return 'bg-gradient-to-br from-gray-900 to-black';
      default:
        return 'bg-gray-100';
    }
  };

  const getMapGridColor = () => {
    return mapStyle === 'dark' || mapStyle === 'satellite' ? 'text-gray-700' : 'text-gray-300';
  };

  // Show loading state if no current location
  if (!currentLocation) {
    return (
      <div className="w-full h-full relative flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
          <p className="text-gray-600">Getting your location...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full relative">
      {/* Map status / errors */}
      {!mapLoaded && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-white/90 text-gray-700 text-sm px-3 py-1 rounded shadow z-50">
          Loading map...
        </div>
      )}
      {mapError && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-red-50 text-red-700 text-sm px-3 py-1 rounded border border-red-200 shadow z-50">
          Map error: {mapError}
        </div>
      )}
      {/* MapLibre map container */}
      <div ref={mapContainerRef} className="absolute inset-0" />


      {/* Transport Mode Indicator */}
      <div className="absolute bottom-32 right-4 bg-white rounded-full p-3 shadow-lg border border-gray-200">
        <div style={{ color: getTransportColor() }}>
          {getTransportIcon()}
        </div>
      </div>

      {/* GPS Accuracy Indicator */}
      {isTrackingLocation && (
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-green-100 text-green-800 px-3 py-1 rounded-full text-xs">
          🛰️ GPS Active
        </div>
      )}

      {/* Compact Navigation Info */}
      {markedDestination && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-white rounded-lg shadow-md px-3 py-2 border border-gray-200">
          <div className="flex items-center gap-3 text-sm">
            {routeOptions.length > 0 && selectedRoute < routeOptions.length && (
              <div className="flex items-center gap-2">
                <div 
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: '#1E40AF' }}
                ></div>
                <span className="font-medium text-gray-900">
                  {routeOptions[selectedRoute].distance} • {routeOptions[selectedRoute].duration}
                </span>
              </div>
            )}
            {distanceToDestination && currentDirection && (
              <>
                <div className="w-px h-4 bg-gray-300" />
                <div className="text-gray-600">
                  {currentDirection.replace(' via Fastest Route', '')}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Compact Route Options Panel */}
      {showRouteOptions && routeOptions.length > 0 && (
        <div className="absolute top-16 left-4 right-4 bg-white rounded-lg shadow-lg border border-gray-200 max-h-64 overflow-hidden">
          <div className="p-3 border-b border-gray-100">
            <div className="flex items-center justify-between">
              <h3 className="font-medium text-gray-900">Route options</h3>
              <Button
                size="icon"
                variant="ghost"
                className="w-6 h-6 text-gray-400 hover:text-gray-600"
                onClick={() => {
                  setShowRouteOptions(false);
                }}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
          <div className="max-h-56 overflow-y-auto">
            {routeOptions.map((option, index) => (
              <div
                key={option.id}
                className={`p-3 border-b border-gray-50 cursor-pointer transition-colors hover:bg-gray-50 ${
                  selectedRoute === index ? 'bg-blue-50' : ''
                }`}
                onClick={() => {
                  setSelectedRoute(index);
                  logger.debug('Route selected:', option);
                }}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="flex items-center">
                        <div 
                          className={`w-1 h-6 rounded-full mr-2 ${selectedRoute === index ? 'bg-blue-600' : 'bg-gray-400'}`}
                        ></div>
                        <span className={`font-medium ${selectedRoute === index ? 'text-blue-900' : 'text-gray-700'}`}>
                          {option.name}
                        </span>
                      </div>
                      {selectedRoute === index && (
                        <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full font-medium">
                          RECOMMENDED
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <span>{option.distance}</span>
                      <span>•</span>
                      <span>{option.duration}</span>
                      {selectedRoute !== index && index === 1 && (
                        <span className="text-green-600 ml-2">usually faster</span>
                      )}
                    </div>
                  </div>
                  {selectedRoute === index && (
                    <div className="text-blue-500 ml-2">
                      ✓
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
          <div className="p-3 bg-gray-50 border-t border-gray-100">
            <Button
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium"
              onClick={() => {
                const selected = routeOptions[selectedRoute];
                toast.success(`Navigation started via ${selected.name}`);
                setShowRouteOptions(false);
                logger.info('Navigation started with route:', selected);
              }}
            >
              Start
            </Button>
          </div>
        </div>
      )}

      {/* Location Tracking Controls */}
      <div className="absolute bottom-20 left-4 space-y-2">
        <Button
          size="icon"
          variant={isTrackingLocation ? "default" : "outline"}
          className="bg-white text-gray-700 shadow-lg border border-gray-200 hover:bg-gray-50"
          onClick={async () => {
            try {
              if (isTrackingLocation) {
                await stopLocationTracking();
                toast.info('GPS tracking disabled');
              } else {
                await startLocationTracking();
                toast.success('GPS tracking enabled');
              }
            } catch (error) {
              logger.error('Failed to toggle GPS tracking', { error });
              toast.error('Failed to toggle GPS tracking');
            }
          }}
        >
          <Navigation className={`w-5 h-5 ${isTrackingLocation ? 'text-white' : 'text-gray-600'}`} />
        </Button>
        
        {/* Route Options Toggle - Only show if multiple routes */}
        {routeOptions.length > 1 && (
          <Button
            size="icon"
            variant={showRouteOptions ? "default" : "outline"}
            className="bg-white text-gray-700 shadow-lg border border-gray-200 hover:bg-gray-50 relative"
            onClick={() => {
              setShowRouteOptions(!showRouteOptions);
              if (!showRouteOptions) {
                toast.info(`${routeOptions.length} route options - tap route lines to switch`);
              }
            }}
          >
            <Navigation className={`w-5 h-5 ${showRouteOptions ? 'text-white' : 'text-gray-600'}`} />
            <div className="absolute -top-1 -right-1 w-4 h-4 bg-blue-600 text-white text-xs rounded-full flex items-center justify-center font-bold">
              {routeOptions.length}
            </div>
          </Button>
        )}
        
        {/* Clear destination button */}
        {markedDestination && (
          <Button
            size="icon"
            variant="outline"
            className="bg-white text-gray-700 shadow-lg border border-gray-200 hover:bg-gray-50"
            onClick={() => {
              setMarkedDestination(null);
              setUserPath([]);
              setDistanceToDestination(null);
              setCurrentDirection('');
              setRouteOptions([]);
              setSelectedRoute(0);
              setShowRouteOptions(false);
              toast.info('Destination cleared');
            }}
          >
            <X className="w-5 h-5" />
          </Button>
        )}
      </div>

      {/* GPS Tracking Toggle (left, below selector) */}
      <div className="absolute top-40 left-4 z-40">
        <Button
          size="icon"
          variant={isTrackingLocation ? "default" : "outline"}
          className="bg-white text-gray-700 shadow-lg border border-gray-200 hover:bg-gray-50"
          onClick={async () => {
            try {
              if (isTrackingLocation) {
                await stopLocationTracking();
                toast.info('GPS tracking disabled');
              } else {
                await startLocationTracking();
                toast.success('GPS tracking enabled');
              }
            } catch (error) {
              logger.error('Failed to toggle GPS tracking', { error });
            }
          }}
          title="GPS tracking"
          aria-label="gps-tracking"
        >
          <Navigation className="w-5 h-5" />
        </Button>
      </div>

      {/* Current Location Button */}
      <CurrentLocationButton
        transportMode={transportMode as 'walking' | 'driving' | 'cycling' | 'transit'}
        isTracking={isTrackingLocation}
        accuracy={locationAccuracy}
        onCenterLocation={() => {
          if (mapRef.current && currentLocation) {
            mapRef.current.flyTo({
              center: [currentLocation.lng, currentLocation.lat],
              zoom: 17,
              duration: 1000
            });
            setCenterPulse(true);
            setTimeout(() => setCenterPulse(false), 800);
          }
        }}
        onToggleTracking={async () => {
          try {
            if (isTrackingLocation) {
              await stopLocationTracking();
              toast.info('GPS tracking disabled');
            } else {
              await startLocationTracking();
              toast.success('GPS tracking enabled');
            }
          } catch (error) {
            logger.error('Failed to toggle GPS tracking', { error });
          }
        }}
        position="bottom-right"
      />
      
      {/* Map Controls Cluster */}
      <div className="absolute top-36 right-4 space-y-2">
        {/* Map Style Selector */}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              size="icon"
              variant="outline"
              className="bg-white text-gray-700 shadow-lg border border-gray-200 hover:bg-gray-50"
            >
              <Layers className="w-5 h-5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent side="left" className="w-48 p-2">
            <div className="space-y-1">
              <button
                className={`w-full flex items-center gap-3 p-2 rounded hover:bg-gray-100 ${
                  mapStyle === 'standard' ? 'bg-gray-100' : ''
                }`}
                onClick={() => {
                  applyBaseMap('standard');
                  toast.success('Standard map');
                }}
              >
                <MapIcon className="w-4 h-4" />
                <span className="text-sm">Standard</span>
              </button>
              <button
                className={`w-full flex items-center gap-3 p-2 rounded hover:bg-gray-100 ${
                  mapStyle === 'satellite' ? 'bg-gray-100' : ''
                }`}
                onClick={() => {
                  applyBaseMap('satellite');
                  toast.info('Satellite view');
                }}
              >
                <Satellite className="w-4 h-4" />
                <span className="text-sm">Satellite</span>
              </button>
              <button
                className={`w-full flex items-center gap-3 p-2 rounded hover:bg-gray-100 ${
                  mapStyle === 'terrain' ? 'bg-gray-100' : ''
                }`}
                onClick={() => {
                  applyBaseMap('terrain');
                  toast.info('Terrain view');
                }}
              >
                <Mountain className="w-4 h-4" />
                <span className="text-sm">Terrain</span>
              </button>
              <button
                className={`w-full flex items-center gap-3 p-2 rounded hover:bg-gray-100 ${
                  mapStyle === 'dark' ? 'bg-gray-100' : ''
                }`}
                onClick={() => {
                  applyBaseMap('dark');
                  toast.info('Dark map');
                }}
              >
                <Moon className="w-4 h-4" />
                <span className="text-sm">Dark</span>
              </button>
            </div>
          </PopoverContent>
        </Popover>

        {/* Traffic Layer Toggle */}
        <Button
          size="icon"
          variant={showTrafficLayer ? "default" : "outline"}
          className="bg-white text-gray-700 shadow-lg border border-gray-200 hover:bg-gray-50"
          onClick={() => {
            setShowTrafficLayer(!showTrafficLayer);
            if (!showTrafficLayer) {
              // Add mock traffic data
              toast.success('Traffic layer enabled');
              // In production, you'd fetch real traffic data here
            } else {
              toast.info('Traffic layer disabled');
            }
          }}
        >
          <Car className="w-5 h-5" />
        </Button>
        {showTrafficLayer && (
          <Badge variant="secondary" className="absolute -right-2 -top-2 text-xs px-1 py-0.5">
            Traffic
          </Badge>
        )}

        {/* 2D/3D Toggle */}
        <Button
          size="icon"
          variant={is3DView ? "default" : "outline"}
          className="bg-white text-gray-700 shadow-lg border border-gray-200 hover:bg-gray-50"
          onClick={() => {
            setIs3DView(!is3DView);
            if (mapRef.current) {
              if (!is3DView) {
                // Enable 3D view
                mapRef.current.setPitch(60);
                toast.success('3D view enabled');
              } else {
                // Disable 3D view
                mapRef.current.setPitch(0);
                toast.info('2D view enabled');
              }
            }
          }}
        >
          {is3DView ? <Box className="w-5 h-5" /> : <MapIcon className="w-5 h-5" />}
        </Button>

        {/* Compass */}
        <Button
          size="icon"
          variant="outline"
          className="bg-white text-gray-700 shadow-lg border border-gray-200 hover:bg-gray-50"
          onClick={() => {
            // Reset map rotation to north
            if (mapRef.current) {
              mapRef.current.resetNorth({ duration: 500 });
              setMapBearing(0);
              toast.info('Map oriented to North');
              logger.debug('Reset map orientation to North');
            }
          }}
        >
          <Compass 
            className="w-5 h-5 transition-transform duration-300" 
            style={{ transform: `rotate(${-mapBearing}deg)` }}
          />
        </Button>

        {/* Zoom Controls */}
        <div className="bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden">
          <Button
            size="icon"
            variant="ghost"
            className="w-10 h-10 rounded-none"
            onClick={() => {
              const newZoom = Math.min(20, zoomLevel + 1);
              setZoomLevel(newZoom);
              if (mapRef.current) {
                mapRef.current.zoomTo(newZoom, { duration: 300 });
                logger.debug('Zoomed in to:', newZoom);
              }
            }}
          >
            <Plus className="w-4 h-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="w-10 h-10 rounded-none"
            onClick={() => {
              const newZoom = Math.max(1, zoomLevel - 1);
              setZoomLevel(newZoom);
              if (mapRef.current) {
                mapRef.current.zoomTo(newZoom, { duration: 300 });
                logger.debug('Zoomed out to:', newZoom);
              }
            }}
          >
            <Minus className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Traffic Alert (smaller) */}
      <div className="absolute top-24 left-1/2 transform -translate-x-1/2 bg-yellow-100 border border-yellow-300 rounded-md px-2 py-1 flex items-center gap-1.5 shadow-sm">
        <AlertTriangle className="w-3.5 h-3.5 text-yellow-600" />
        <span className="text-xs text-yellow-800">Heavy traffic ahead - +5 min</span>
      </div>

      {/* Place Details Bottom Sheet */}
      <PlaceDetailsSheet
        place={selectedPlace}
        isOpen={isPlaceSheetOpen}
        onClose={() => setIsPlaceSheetOpen(false)}
        onNavigate={() => {
          logger.info('Navigate to place:', selectedPlace?.name);
          setIsPlaceSheetOpen(false);
        }}
        onShare={() => {
          logger.info('Share place:', selectedPlace?.name);
        }}
      />
    </div>
  );
}