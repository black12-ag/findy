import React, { useEffect, useRef, useState } from 'react';
import { MapPin, Navigation, Car, User, AlertTriangle, Layers, Box, Map as MapIcon, Plus, Minus, RotateCcw, Satellite, Mountain, Moon } from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { PlaceDetailsSheet } from './PlaceDetailsSheet';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { logger } from '../utils/logger';

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
}

export function MapView({ 
  currentLocation, 
  selectedLocation, 
  route, 
  transportMode,
  isNavigating,
  centerSignal = 0,
}: MapViewProps) {
  const [showTrafficLayer, setShowTrafficLayer] = useState(true);
  const [is3DView, setIs3DView] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(15);
  const [centerPulse, setCenterPulse] = useState(false);
  const [mapStyle, setMapStyle] = useState<'standard' | 'satellite' | 'terrain' | 'dark'>('standard');
  const [selectedPlace, setSelectedPlace] = useState<any>(null);
  const [isPlaceSheetOpen, setIsPlaceSheetOpen] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);

  // MapLibre refs
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const currentMarkerRef = useRef<maplibregl.Marker | null>(null);
  const selectedMarkerRef = useRef<maplibregl.Marker | null>(null);

  // Compute a visual zoom scale from the zoom level
  const baseZoom = 15;
  const zoomScale = Math.max(0.8, Math.min(1.8, zoomLevel / baseZoom));

  // Trigger a brief pulse on the current location when center is requested
  useEffect(() => {
    if (centerSignal > 0) {
      setCenterPulse(true);
      const t = setTimeout(() => setCenterPulse(false), 800);
      return () => clearTimeout(t);
    }
  }, [centerSignal]);
 
  // Initialize MapLibre map (even if we don't have currentLocation yet)
  useEffect(() => {
    if (mapRef.current || !mapContainerRef.current) return;

    const styleUrl = import.meta.env.VITE_MAP_STYLE_URL || 'https://demotiles.maplibre.org/style.json';
    const defaultCenter: [number, number] = [-122.4194, 37.7749]; // SF fallback for dev/demo
    const startCenter: [number, number] = currentLocation 
      ? [currentLocation.lng, currentLocation.lat]
      : defaultCenter;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: styleUrl,
      center: startCenter,
      zoom: 14,
    });
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-left');

    // Helpful debug
    logger.info('Map init', { styleUrl, startCenter });

    map.on('load', () => {
      setMapLoaded(true);
      setMapError(null);
    });

    map.on('error', (e) => {
      // Capture style/tile loading errors (401/403/etc.)
      const message = (e && (e as any).error && (e as any).error.message) || 'Map error';
      setMapError(message);
      logger.error('Map error', { message, event: e });
    });

    // If we already have a current location on mount, add the marker
    if (currentLocation) {
      currentMarkerRef.current = new maplibregl.Marker({ color: '#3B82F6' })
        .setLngLat([currentLocation.lng, currentLocation.lat])
        .addTo(map);
    }

    return () => {
      map.remove();
      mapRef.current = null;
      currentMarkerRef.current = null;
      selectedMarkerRef.current = null;
    };
  }, []);

  // Update current location marker and center when location changes
  useEffect(() => {
    if (!mapRef.current || !currentLocation) return;
    const map = mapRef.current;
    if (!currentMarkerRef.current) {
      currentMarkerRef.current = new maplibregl.Marker({ color: '#3B82F6' })
        .setLngLat([currentLocation.lng, currentLocation.lat])
        .addTo(map);
    } else {
      currentMarkerRef.current.setLngLat([currentLocation.lng, currentLocation.lat]);
    }
    // Smoothly center the map on the new location once
    map.flyTo({ center: [currentLocation.lng, currentLocation.lat], zoom: Math.max(12, map.getZoom()) });
  }, [currentLocation?.lat, currentLocation?.lng]);

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

  // Draw route line if geometry available
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (map.getLayer('route-line')) map.removeLayer('route-line');
    if (map.getSource('route-source')) map.removeSource('route-source');
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
      const bounds = new maplibregl.LngLatBounds();
      r.geometry.forEach((c: [number, number]) => bounds.extend(c));
      map.fitBounds(bounds, { padding: 50 });
    }
  }, [route]);

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
      <div className="absolute bottom-32 left-4 bg-white rounded-full p-3 shadow-lg border border-gray-200">
        <div style={{ color: getTransportColor() }}>
          {getTransportIcon()}
        </div>
      </div>

      {/* Speed/Location Info - Show when navigating */}
      {isNavigating && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-white rounded-xl shadow-lg px-4 py-2 border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="text-lg font-medium">35 mph</div>
            <div className="w-px h-6 bg-gray-300" />
            <div className="text-sm text-gray-600">Main St</div>
          </div>
        </div>
      )}

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
                onClick={() => setMapStyle('standard')}
              >
                <MapIcon className="w-4 h-4" />
                <span className="text-sm">Standard</span>
              </button>
              <button
                className={`w-full flex items-center gap-3 p-2 rounded hover:bg-gray-100 ${
                  mapStyle === 'satellite' ? 'bg-gray-100' : ''
                }`}
                onClick={() => setMapStyle('satellite')}
              >
                <Satellite className="w-4 h-4" />
                <span className="text-sm">Satellite</span>
              </button>
              <button
                className={`w-full flex items-center gap-3 p-2 rounded hover:bg-gray-100 ${
                  mapStyle === 'terrain' ? 'bg-gray-100' : ''
                }`}
                onClick={() => setMapStyle('terrain')}
              >
                <Mountain className="w-4 h-4" />
                <span className="text-sm">Terrain</span>
              </button>
              <button
                className={`w-full flex items-center gap-3 p-2 rounded hover:bg-gray-100 ${
                  mapStyle === 'dark' ? 'bg-gray-100' : ''
                }`}
                onClick={() => setMapStyle('dark')}
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
          onClick={() => setShowTrafficLayer(!showTrafficLayer)}
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
          onClick={() => setIs3DView(!is3DView)}
        >
          {is3DView ? <Box className="w-5 h-5" /> : <MapIcon className="w-5 h-5" />}
        </Button>

        {/* Compass */}
        <Button
          size="icon"
          variant="outline"
          className="bg-white text-gray-700 shadow-lg border border-gray-200 hover:bg-gray-50"
          onClick={() => {
            // Reset map rotation
            logger.debug('Resetting map orientation');
          }}
        >
          <div className="w-5 h-5 relative">
            <Navigation className="w-5 h-5 text-gray-600" />
            <div className="absolute top-0 left-1/2 w-0.5 h-2 bg-red-500 transform -translate-x-1/2" />
          </div>
        </Button>

        {/* Zoom Controls */}
        <div className="bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden">
          <Button
            size="icon"
            variant="ghost"
            className="w-10 h-10 rounded-none border-b border-gray-200"
            onClick={() => setZoomLevel(Math.min(20, zoomLevel + 1))}
          >
            <Plus className="w-4 h-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="w-10 h-10 rounded-none"
            onClick={() => setZoomLevel(Math.max(1, zoomLevel - 1))}
          >
            <Minus className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Traffic Alert */}
      <div className="absolute top-24 left-1/2 transform -translate-x-1/2 bg-yellow-100 border border-yellow-300 rounded-lg px-4 py-2 flex items-center gap-2">
        <AlertTriangle className="w-4 h-4 text-yellow-600" />
        <span className="text-sm text-yellow-800">Heavy traffic ahead - +5 min</span>
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