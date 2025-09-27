import React, { useState, useEffect, useCallback, useRef } from 'react';
import { MapPin, Search, Bookmark, Navigation, Menu, X, Plus, Layers, Settings, Car } from 'lucide-react';
import { GoogleMapView } from './GoogleMapView';
import { MapView } from './MapView';
import { SearchPanel } from './SearchPanel';
import { SavedPlacesPanel } from './SavedPlacesPanel';
import { SaveLocationModal } from './SaveLocationModal';
import { MapContextMenu } from './MapContextMenu';
import { CurrentLocationButton } from './CurrentLocationButton';
import { SearchResultsOverlay } from './SearchResultsOverlay';
import { ParkingResultsOverlay } from './ParkingResultsOverlay';
import { ParkingFinder } from './ParkingFinder';
import { ParkingMarker } from './ParkingMarker';
import { Button } from './ui/button';
import { Sheet, SheetContent, SheetTrigger } from './ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { placesService } from '../services/places';
import googleMapsService from '../services/googleMapsService';
import { logger } from '../utils/logger';
import { toast } from 'sonner';
import { useLocation } from '../contexts/LocationContext';

interface Location {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  category?: string;
  notes?: string;
  tags?: string[];
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

interface ParkingSpot {
  id: string;
  name: string;
  type: 'street' | 'garage' | 'lot' | 'valet';
  distance: string;
  walkTime: string;
  price: string;
  availability: number;
  rating: number;
  features: string[];
  hours: string;
  address: string;
  location?: { lat: number; lng: number };
}

interface IntegratedMapViewProps {
  onSearchRequest?: () => void;
  searchQuery?: string;
  onLocationSelect?: (location: Location) => void;
  onParkingRequest?: () => void;
}

export function IntegratedMapView({ 
  onSearchRequest,
  searchQuery = '',
  onLocationSelect: externalOnLocationSelect,
  onParkingRequest
}: IntegratedMapViewProps = {}) {
  // State management
  const [useGoogleMaps, setUseGoogleMaps] = useState(true);
  const [currentLocation, setCurrentLocation] = useState<Location | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);
  const [savedPlaces, setSavedPlaces] = useState<Location[]>([]);
  const [route, setRoute] = useState<Route | null>(null);
  const [transportMode, setTransportMode] = useState('driving');
  const [isNavigating, setIsNavigating] = useState(false);
  const [centerSignal, setCenterSignal] = useState(0);
  
  // UI state
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isSavedOpen, setIsSavedOpen] = useState(false);
  const [isParkingOpen, setIsParkingOpen] = useState(false);
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [locationToSave, setLocationToSave] = useState<Location | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    position: { x: number; y: number } | null;
    location: Location | null;
    isOpen: boolean;
  }>({ position: null, location: null, isOpen: false });
  
  // Map interaction
  const [mapClickedLocation, setMapClickedLocation] = useState<Location | null>(null);
  const [searchResults, setSearchResults] = useState<Location[]>([]);
  const [parkingSpots, setParkingSpots] = useState<ParkingSpot[]>([]);
  const [visibleMarkers, setVisibleMarkers] = useState<Location[]>([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [showParkingResults, setShowParkingResults] = useState(false);
  const [locationAccuracy, setLocationAccuracy] = useState<number>(10);
  const [locationSpeed, setLocationSpeed] = useState<number>(0);
  const [locationHeading, setLocationHeading] = useState<number>(0);
  const [mapInstance, setMapInstance] = useState<google.maps.Map | null>(null);
  
  const { isTrackingLocation, startLocationTracking, stopLocationTracking } = useLocation();
  const mapContainerRef = useRef<HTMLDivElement>(null);

  // Initialize current location
  useEffect(() => {
    const initLocation = async () => {
      try {
        if (!navigator.geolocation) {
          toast.error('Geolocation not supported');
          return;
        }

        navigator.geolocation.getCurrentPosition(
          (position) => {
            const location: Location = {
              id: 'current',
              name: 'Current Location',
              address: 'Your current position',
              lat: position.coords.latitude,
              lng: position.coords.longitude,
            };
            setCurrentLocation(location);
            
            // Update location accuracy and speed
            setLocationAccuracy(position.coords.accuracy || 10);
            if (position.coords.speed !== null) {
              setLocationSpeed(position.coords.speed || 0);
            }
            if (position.coords.heading !== null) {
              setLocationHeading(position.coords.heading || 0);
            }
            
            logger.info('Current location initialized:', location);
          },
          (error) => {
            logger.error('Failed to get current location:', error);
            // Set default location (San Francisco)
            setCurrentLocation({
              id: 'default',
              name: 'San Francisco',
              address: 'San Francisco, CA',
              lat: 37.7749,
              lng: -122.4194,
            });
          }
        );
      } catch (error) {
        logger.error('Location initialization error:', error);
      }
    };

    initLocation();
    loadSavedPlaces();
  }, []);

  // Load saved places from backend or local storage
  const loadSavedPlaces = async () => {
    try {
      const response = await placesService.getUserPlaces();
      const places = response.data.map((p: any) => {
        const formatted = placesService.formatPlace(p);
        return {
          id: formatted.id,
          name: formatted.name,
          address: formatted.address,
          lat: formatted.location.lat,
          lng: formatted.location.lng,
          category: formatted.category,
          notes: formatted.notes,
          tags: formatted.tags,
        };
      });
      setSavedPlaces(places);
      setVisibleMarkers(places); // Show saved places on map
    } catch (error) {
      logger.warn('Failed to load from backend, using local storage:', error);
      const localPlaces = JSON.parse(localStorage.getItem('saved_places') || '[]');
      setSavedPlaces(localPlaces);
      setVisibleMarkers(localPlaces);
    }
  };

  // Handle search - triggered by external search query
  const handleSearch = async (query: string) => {
    if (!query.trim()) return;

    try {
      // Use Google Places search if available
      if (useGoogleMaps && googleMapsService) {
        const results = await googleMapsService.searchPlaces(query);
        const formatted = results.map((place: any) => ({
          id: place.place_id || `search_${Date.now()}`,
          name: place.name || place.formatted_address,
          address: place.formatted_address || place.vicinity,
          lat: place.geometry.location.lat,
          lng: place.geometry.location.lng,
          category: place.types?.[0],
        }));
        setSearchResults(formatted);
        setVisibleMarkers([...savedPlaces, ...formatted]);
        
        if (formatted.length > 0) {
          setShowSearchResults(true);
          toast.success(`Found ${formatted.length} results for "${query}"`);
        } else {
          setShowSearchResults(false);
          toast.info('No results found');
        }
      } else {
        // Fallback to basic search
        toast.info('Search functionality limited in offline mode');
      }
    } catch (error) {
      logger.error('Search failed:', error);
      toast.error('Search failed. Please try again.');
    }
  };
  
  // Effect to handle external search queries
  useEffect(() => {
    if (searchQuery && searchQuery.trim()) {
      handleSearch(searchQuery);
    }
  }, [searchQuery]);

  // Handle location selection from search or saved places
  const handleLocationSelect = async (location: Location) => {
    setSelectedLocation(location);
    setIsSearchOpen(false);
    setIsSavedOpen(false);
    
    // Center map on selected location
    setCenterSignal(prev => prev + 1);
    
    // Calculate route if current location is available
    if (currentLocation) {
      await calculateRoute(currentLocation, location);
    }
    
    // Call external callback if provided
    if (externalOnLocationSelect) {
      externalOnLocationSelect(location);
    }
    
    toast.success(`Selected: ${location.name}`);
  };

  // Calculate route between two locations
  const calculateRoute = async (from: Location, to: Location) => {
    try {
      if (useGoogleMaps && googleMapsService) {
        const directionsResult = await googleMapsService.getDirections({
          origin: { lat: from.lat, lng: from.lng },
          destination: { lat: to.lat, lng: to.lng },
          travelMode: googleMapsService.convertToGoogleTravelMode(
            transportMode as 'driving' | 'walking' | 'cycling' | 'transit'
          ),
        });

        if (directionsResult && directionsResult.routes.length > 0) {
          const route = directionsResult.routes[0];
          const leg = route.legs[0];
          
          setRoute({
            id: `route_${Date.now()}`,
            from,
            to,
            distance: leg.distance?.text || '',
            duration: leg.duration?.text || '',
            mode: transportMode,
            steps: leg.steps?.map(step => step.instructions || '') || [],
            googleDirectionsResult: directionsResult,
          });
          
          toast.success(`Route: ${leg.distance?.text} in ${leg.duration?.text}`);
        }
      } else {
        // Simple route for MapLibre
        setRoute({
          id: `route_${Date.now()}`,
          from,
          to,
          distance: 'Calculating...',
          duration: 'Calculating...',
          mode: transportMode,
          steps: [],
          geometry: [
            [from.lng, from.lat],
            [to.lng, to.lat]
          ],
        });
      }
    } catch (error) {
      logger.error('Failed to calculate route:', error);
      toast.error('Failed to calculate route');
    }
  };

  // Handle map click/right-click
  const handleMapInteraction = useCallback((event: any, isRightClick: boolean = false) => {
    const location: Location = {
      id: `map_${Date.now()}`,
      name: 'Selected Location',
      address: 'Click to get address',
      lat: event.lat || event.latLng?.lat() || 0,
      lng: event.lng || event.latLng?.lng() || 0,
    };

    if (isRightClick) {
      // Show context menu
      setContextMenu({
        position: { x: event.clientX || event.pixel?.x || 0, y: event.clientY || event.pixel?.y || 0 },
        location,
        isOpen: true,
      });
    } else {
      // Regular click - set as destination
      setMapClickedLocation(location);
      if (currentLocation) {
        calculateRoute(currentLocation, location);
      }
    }
  }, [currentLocation, transportMode]);

  // Save location handler
  const handleSaveLocation = async (location: Location) => {
    try {
      // Save to backend
      await placesService.savePlace({
        googlePlaceId: location.id,
        name: location.name,
        address: location.address,
        location: { lat: location.lat, lng: location.lng },
        category: location.category,
        notes: location.notes,
        tags: location.tags,
      });

      // Update local state
      setSavedPlaces(prev => [location, ...prev]);
      setVisibleMarkers(prev => [location, ...prev]);
      
      toast.success(`${location.name} saved!`);
    } catch (error) {
      logger.error('Failed to save location:', error);
      
      // Save locally as fallback
      const localPlaces = JSON.parse(localStorage.getItem('saved_places') || '[]');
      localPlaces.unshift(location);
      localStorage.setItem('saved_places', JSON.stringify(localPlaces.slice(0, 50)));
      
      setSavedPlaces(prev => [location, ...prev]);
      setVisibleMarkers(prev => [location, ...prev]);
      
      toast.info('Saved locally (will sync when online)');
    }
  };

  // Share location handler
  const handleShareLocation = async (location: Location) => {
    const shareData = {
      title: location.name,
      text: `Check out ${location.name} at ${location.address}`,
      url: `https://maps.google.com/?q=${location.lat},${location.lng}`,
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
        toast.success('Location shared!');
      } else {
        // Fallback to copying link
        await navigator.clipboard.writeText(shareData.url);
        toast.success('Location link copied to clipboard');
      }
    } catch (error) {
      logger.error('Failed to share:', error);
      toast.error('Failed to share location');
    }
  };

  // Handle parking spot selection
  const handleParkingSpotSelect = (spot: ParkingSpot) => {
    if (spot.location) {
      const location: Location = {
        id: spot.id,
        name: spot.name,
        address: spot.address,
        lat: spot.location.lat,
        lng: spot.location.lng,
        category: 'parking'
      };
      
      setSelectedLocation(location);
      if (currentLocation) {
        calculateRoute(currentLocation, location);
      }
      
      toast.success(`Selected parking: ${spot.name}`);
      setIsParkingOpen(false);
      setShowParkingResults(false);
      
      // Call external callback if provided
      if (externalOnLocationSelect) {
        externalOnLocationSelect(location);
      }
    }
  };

  // Handle parking results received from ParkingFinder
  const handleParkingResults = (spots: ParkingSpot[]) => {
    setParkingSpots(spots);
    setShowParkingResults(spots.length > 0);
    
    // Center map on parking area if spots available
    if (spots.length > 0 && spots[0].location && mapInstance) {
      mapInstance.setCenter(spots[0].location);
      mapInstance.setZoom(15);
      setCenterSignal(prev => prev + 1);
    }
  };

  return (
    <div className="h-full w-full relative flex">
      {/* Main Map Container */}
      <div ref={mapContainerRef} className="flex-1 relative">
        {useGoogleMaps ? (
          <GoogleMapView
            currentLocation={currentLocation}
            selectedLocation={selectedLocation}
            route={route}
            transportMode={transportMode}
            isNavigating={isNavigating}
            centerSignal={centerSignal}
            onLocationSelect={handleLocationSelect}
            onRouteRequest={calculateRoute}
            onRouteCalculated={(directionsResult) => {
              logger.info('GoogleMapView calculated route with directions result', {
                hasResult: !!directionsResult,
                routeCount: directionsResult?.routes?.length
              });
            }}
            onMapReady={(map) => setMapInstance(map)}
          />
        ) : (
          <MapView
            currentLocation={currentLocation}
            selectedLocation={selectedLocation}
            route={route}
            transportMode={transportMode}
            isNavigating={isNavigating}
            centerSignal={centerSignal}
            onLocationSelect={handleLocationSelect}
            onRouteRequest={calculateRoute}
          />
        )}

        {/* Map Context Menu */}
        <MapContextMenu
          position={contextMenu.position}
          location={contextMenu.location}
          isOpen={contextMenu.isOpen}
          onClose={() => setContextMenu({ position: null, location: null, isOpen: false })}
          onNavigate={(location) => {
            if (currentLocation) {
              calculateRoute(currentLocation, location);
            }
          }}
          onSave={(location) => {
            setLocationToSave(location);
            setIsSaveModalOpen(true);
          }}
          onShare={handleShareLocation}
          onCopyCoordinates={(location) => {
            logger.info('Coordinates copied:', location);
          }}
          onOpenInMaps={(location) => {
            logger.info('Opened in Google Maps:', location);
          }}
          onViewDetails={(location) => {
            setSelectedLocation(location);
          }}
        />

        {/* Quick Action Buttons */}
        <div className="absolute top-4 left-4 flex gap-2">
          <Button
            size="sm"
            variant="outline"
            className="bg-white shadow-lg"
            onClick={() => {
              if (onSearchRequest) {
                onSearchRequest();
              } else {
                setIsSearchOpen(true);
              }
            }}
          >
            <Search className="w-4 h-4 mr-2" />
            Search Places
          </Button>
          
          <Button
            size="sm"
            variant="outline"
            className="bg-white shadow-lg"
            onClick={() => setIsSavedOpen(true)}
          >
            <Bookmark className="w-4 h-4 mr-2" />
            Saved ({savedPlaces.length})
          </Button>

          <Button
            size="sm"
            variant="outline"
            className="bg-white shadow-lg"
            onClick={() => {
              if (mapClickedLocation || selectedLocation) {
                setLocationToSave(mapClickedLocation || selectedLocation);
                setIsSaveModalOpen(true);
              } else {
                toast.info('Click on the map to select a location to save');
              }
            }}
          >
            <Plus className="w-4 h-4 mr-2" />
            Save Location
          </Button>
          
          <Button
            size="sm"
            variant="outline"
            className="bg-white shadow-lg text-orange-600 hover:bg-orange-50 border-orange-200"
            onClick={() => {
              if (onParkingRequest) {
                onParkingRequest();
              } else {
                setIsParkingOpen(true);
              }
            }}
          >
            <Car className="w-4 h-4 mr-2" />
            Find Parking
          </Button>
        </div>

        {/* Map Type Toggle and Transport Mode Indicator */}
        <div className="absolute top-4 right-4 flex flex-col gap-2">
          <Button
            size="sm"
            variant="outline"
            className="bg-white"
            onClick={() => setUseGoogleMaps(!useGoogleMaps)}
          >
            <Layers className="w-4 h-4 mr-1" />
            {useGoogleMaps ? 'Google Maps' : 'MapLibre'}
          </Button>
          
          {/* Transport Mode Indicator */}
          <div className="bg-white px-3 py-2 rounded-lg shadow-lg border text-sm font-medium flex items-center gap-2">
            <span className="text-lg">
              {{
                driving: '🚗',
                walking: '🚶',
                cycling: '🚴',
                transit: '🚌'
              }[transportMode] || '📍'}
            </span>
            <span className="text-gray-700 capitalize">{transportMode}</span>
          </div>
          
          {/* Click Instructions */}
          <div className="bg-blue-50 px-3 py-2 rounded-lg shadow-sm border border-blue-200 text-xs text-blue-700 max-w-48">
            💡 Click anywhere on map for {transportMode} directions
          </div>
        </div>
        
        {/* Current Location Button - My Location FAB */}
        <div className="absolute bottom-6 right-6 z-50">
          <CurrentLocationButton
            transportMode={transportMode as 'walking' | 'driving' | 'cycling' | 'transit'}
            isTracking={isTrackingLocation}
            accuracy={locationAccuracy}
            onCenterLocation={() => {
              setCenterSignal(prev => prev + 1);
              toast.success(`Centered on ${transportMode} location`);
            }}
            onToggleTracking={() => {
              if (isTrackingLocation) {
                stopLocationTracking();
                toast.info('GPS tracking disabled');
              } else {
                startLocationTracking();
                toast.success('GPS tracking enabled');
              }
            }}
            position="bottom-right"
          />
        </div>
        
        {/* Search Results Overlay */}
        {showSearchResults && searchResults.length > 0 && (
          <SearchResultsOverlay
            results={searchResults.map(result => ({
              id: result.id,
              name: result.name,
              address: result.address,
              lat: result.lat,
              lng: result.lng,
              category: result.category
            }))}
            searchQuery={searchQuery}
            onResultSelect={(result) => {
              handleLocationSelect(result as Location);
              setShowSearchResults(false);
            }}
            onClose={() => {
              setShowSearchResults(false);
              setSearchResults([]);
              setVisibleMarkers(savedPlaces);
            }}
          />
        )}

        {/* Parking Results Overlay */}
        {showParkingResults && parkingSpots.length > 0 && (
          <ParkingResultsOverlay
            parkingSpots={parkingSpots}
            onSpotSelect={handleParkingSpotSelect}
            onNavigateToSpot={handleParkingSpotSelect}
            onClose={() => {
              setShowParkingResults(false);
              setParkingSpots([]);
            }}
          />
        )}

        {/* Navigation Info Bar */}
        {route && (
          <div className="absolute bottom-4 left-4 right-24">
            <div className="bg-white rounded-lg shadow-lg p-4 flex items-center justify-between">
              <div className="flex items-center gap-4 flex-1">
                <Navigation className="w-6 h-6 text-blue-600" />
                <div className="flex-1">
                  <p className="font-medium text-gray-900 truncate">{route.to.name}</p>
                  <p className="text-sm text-gray-600">
                    {route.distance} • {route.duration} • {route.mode}
                  </p>
                </div>
              </div>
              <div className="flex gap-2 ml-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setRoute(null)}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    setIsNavigating(true);
                    toast.success('Navigation started!');
                  }}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  Start
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Search Panel Sheet */}
      <Sheet open={isSearchOpen} onOpenChange={setIsSearchOpen}>
        <SheetContent side="left" className="w-96 p-0">
          <SearchPanel
            query={searchQuery}
            onSearch={handleSearch}
            onLocationSelect={handleLocationSelect}
            transportMode={transportMode}
            onBack={() => setIsSearchOpen(false)}
            onOpenVoicePanel={() => toast.info('Voice search coming soon!')}
          />
        </SheetContent>
      </Sheet>

      {/* Saved Places Sheet */}
      <Sheet open={isSavedOpen} onOpenChange={setIsSavedOpen}>
        <SheetContent side="right" className="w-96 p-0">
          <SavedPlacesPanel
            places={savedPlaces}
            onLocationSelect={handleLocationSelect}
            onBack={() => setIsSavedOpen(false)}
            onAddPlace={(place) => {
              setSavedPlaces(prev => [place, ...prev]);
              setVisibleMarkers(prev => [place, ...prev]);
            }}
          />
        </SheetContent>
      </Sheet>

      {/* Parking Finder Sheet */}
      <Sheet open={isParkingOpen} onOpenChange={setIsParkingOpen}>
        <SheetContent side="right" className="w-96 p-0">
          <ParkingFinder
            onBack={() => {
              setIsParkingOpen(false);
              // Keep parking results visible when closing the finder
            }}
            destination={selectedLocation?.name}
            map={mapInstance}
            onNavigateToParking={handleParkingSpotSelect}
            onParkingResults={handleParkingResults}
          />
        </SheetContent>
      </Sheet>

      {/* Save Location Modal */}
      <SaveLocationModal
        location={locationToSave}
        isOpen={isSaveModalOpen}
        onClose={() => {
          setIsSaveModalOpen(false);
          setLocationToSave(null);
        }}
        onSave={handleSaveLocation}
        existingSavedPlaces={savedPlaces}
      />
    </div>
  );
}