import React, { useEffect, useState } from 'react';
import { MapPin, Navigation, Car, User, AlertTriangle, Layers, Box, Map as MapIcon, Plus, Minus, RotateCcw, Satellite, Mountain, Moon } from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { PlaceDetailsSheet } from './PlaceDetailsSheet';

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
}

interface MapViewProps {
  currentLocation: Location;
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
  const [selectedPlace, setSelectedPlace] = useState(null);
  const [isPlaceSheetOpen, setIsPlaceSheetOpen] = useState(false);

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

  return (
    <div className="w-full h-full relative bg-gradient-to-br from-blue-50 to-green-50">
      {/* Mock Map Background */}
      <div
        className={`absolute inset-0 ${getMapBackground()}`}
        style={{
          transform: `scale(${zoomScale})`,
          transformOrigin: '50% 60%'
        }}
      >
        {/* Grid pattern to simulate map */}
        <div className="absolute inset-0 opacity-20">
          <svg width="100%" height="100%" className={getMapGridColor()}>
            <defs>
              <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="1"/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
          </svg>
        </div>

        {/* Mock street patterns */}
        <div className="absolute inset-0">
          <div className="absolute top-1/3 left-0 right-0 h-2 bg-gray-300 opacity-60" />
          <div className="absolute top-2/3 left-0 right-0 h-2 bg-gray-300 opacity-60" />
          <div className="absolute left-1/4 top-0 bottom-0 w-2 bg-gray-300 opacity-60" />
          <div className="absolute left-3/4 top-0 bottom-0 w-2 bg-gray-300 opacity-60" />
        </div>

        {/* Current Location Marker */}
        <div 
          className="absolute w-6 h-6 bg-blue-500 rounded-full border-4 border-white shadow-lg z-20"
          style={{
            left: '50%',
            top: '60%',
            transform: 'translate(-50%, -50%)'
          }}
        >
          <div className="absolute inset-0 bg-blue-500 rounded-full animate-ping opacity-75" />
          {centerPulse && (
            <div className="absolute -inset-2 rounded-full border-2 border-blue-500 animate-ping" />
          )}
        </div>

        {/* Current Location Accuracy Ring */}
        <div 
          className="absolute w-20 h-20 border-2 border-blue-300 rounded-full opacity-30 z-10"
          style={{
            left: '50%',
            top: '60%',
            transform: 'translate(-50%, -50%)'
          }}
        />

        {/* Selected Location Marker */}
        {selectedLocation && (
          <div 
            className="absolute z-20 cursor-pointer"
            style={{
              left: '30%',
              top: '30%',
              transform: 'translate(-50%, -100%)'
            }}
            onClick={() => {
              const mockPlaceDetails = {
                id: selectedLocation.id,
                name: selectedLocation.name,
                address: selectedLocation.address,
                category: selectedLocation.category || 'Restaurant',
                rating: 4.5,
                reviewCount: 127,
                priceLevel: 2,
                isOpen: true,
                openHours: 'Open until 10:00 PM',
                phone: '(555) 123-4567',
                website: 'example.com',
                photos: [],
                amenities: ['WiFi', 'Parking', 'Accessible', 'Cards'],
                reviews: []
              };
              setSelectedPlace(mockPlaceDetails);
              setIsPlaceSheetOpen(true);
            }}
          >
            <div className="bg-red-500 text-white p-2 rounded-full shadow-lg hover:bg-red-600 transition-colors">
              <MapPin className="w-6 h-6" />
            </div>
            <div className="bg-white rounded-lg shadow-lg p-3 mt-2 min-w-48 hover:shadow-xl transition-shadow">
              <h4 className="font-medium text-gray-900">{selectedLocation.name}</h4>
              <p className="text-sm text-gray-600">{selectedLocation.address}</p>
              <p className="text-xs text-blue-600 mt-1">Tap for details</p>
            </div>
          </div>
        )}

        {/* Route Line */}
        {route && (
          <svg className="absolute inset-0 w-full h-full z-15">
            <path
              d="M 50% 60% Q 40% 45% 30% 30%"
              stroke={getTransportColor()}
              strokeWidth="4"
              fill="none"
              strokeLinecap="round"
              strokeDasharray={isNavigating ? "0" : "10,5"}
              className="opacity-80"
            />
          </svg>
        )}

        {/* Traffic Indicators - Only show if traffic layer is enabled */}
        {showTrafficLayer && (
          <>
            <div className="absolute top-1/2 left-1/3 w-3 h-8 bg-red-400 opacity-70 rounded-full z-10" />
            <div className="absolute top-1/4 right-1/3 w-3 h-6 bg-yellow-400 opacity-70 rounded-full z-10" />
            <div className="absolute bottom-1/3 left-2/3 w-3 h-4 bg-green-400 opacity-70 rounded-full z-10" />
          </>
        )}
      </div>

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
            console.log('Resetting map orientation');
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
          console.log('Navigate to place:', selectedPlace?.name);
          setIsPlaceSheetOpen(false);
        }}
        onShare={() => {
          console.log('Share place:', selectedPlace?.name);
        }}
      />
    </div>
  );
}