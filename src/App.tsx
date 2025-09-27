import React, { useState, useEffect, useMemo } from 'react';
import { GoogleMapView } from './components/GoogleMapView';
import { SearchPanel } from './components/SearchPanel';
import { NavigationPanel } from './components/NavigationPanel';
import { BottomNavigation } from './components/BottomNavigation';
import { EnhancedRoutePanel } from './components/EnhancedRoutePanel';
import { SettingsPanel } from './components/SettingsPanel';
import { SavedPlacesPanel } from './components/SavedPlacesPanel';
import { PublicTransitPanel } from './components/PublicTransitPanel';
import { ARNavigationPanel } from './components/ARNavigationPanel';
import SocialPanel from './components/SocialPanelFixed';
import { ProfilePanel } from './components/ProfilePanel';
import { VoiceCommandPanel } from './components/VoiceCommandPanel';
import { PushNotificationSettings } from './components/PushNotificationSettings';
import { DeviceIntegrationTest } from './components/DeviceIntegrationTest';
import CrashReporting from './components/CrashReporting';
import { SmartNotifications } from './components/SmartNotifications';
import { ETASharingPanel } from './components/ETASharingPanel';
import { TransportModeSelector } from './components/TransportModeSelector';
import { SafetyCenter } from './components/safety/SafetyCenter';
import { IntegrationsHub } from './components/integrations/IntegrationsHub';
import { AIPredictions } from './components/AIPredictions';
import { AnalyticsDashboard } from './components/AnalyticsDashboard';
import { ParkingFinder } from './components/ParkingFinder';
import { Gamification } from './components/Gamification';
import { FleetManagement } from './components/FleetManagement';
import { APIDocs } from './components/APIDocs';
import { MultiStopRoutePlanner } from './components/MultiStopRoutePlanner';
import { OnboardingFlow } from './components/OnboardingFlow';
import { Button } from './components/ui/button';
import { ORSConfigPanel } from './components/ORSConfigPanel';
import { Search, MapPin, User, Target, Mic, Bell, Car, Brain, Trophy, ArrowLeft, Menu, X } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from './hooks/useAuth';
import ErrorBoundary from './components/ErrorBoundary';
import { LoadingProvider, LoadingOverlay, useLoading } from './contexts/LoadingContext';
import { DeveloperPanel } from './components/DeveloperPanel';
import { PlaceDetailsSheet } from './components/PlaceDetailsSheet';
import AdvancedRouter, { usePageRouter, PageRoute } from './components/AdvancedRouter';
import { ImageWithFallback } from './components/figma/ImageWithFallback';
import LoadingSpinner from './components/LoadingSpinner';
import { NavigationMenu } from './components/NavigationMenu';
import { Toaster } from './components/ui/sonner';
import { ThemeToggle } from './components/ThemeToggle';
import { logger } from './utils/logger';
import googleMapsService from './services/googleMapsService';
import { UserProvider } from './contexts/UserContext';
import { NavigationProvider, useNavigation } from './contexts/NavigationContext';
import { useUser } from './contexts/UserContext';
import { SettingsProvider } from './contexts/SettingsContext';
import { LocationProvider, useLocation } from './contexts/LocationContext';
import { ThemeProvider } from 'next-themes';

import type { Location, Route, TransportMode } from './contexts/NavigationContext';

type Screen = 'map' | 'search' | 'route' | 'navigation' | 'saved' | 'settings' | 'transit' | 'offline' | 'ar' | 'social' | 'profile' | 'voice' | 'eta-share' | 'safety' | 'integrations' | 'ai-predictions' | 'analytics' | 'parking' | 'gamification' | 'fleet' | 'api-docs' | 'multi-stop' | 'ors-config' | 'developer' | 'place-details' | 'push-settings' | 'device-test' | 'crash-reports';

function AppContent() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { user } = useUser();
  const { 
    currentLocation: locationData,
    startLocationTracking,
  } = useLocation();
  const {
    currentLocation: navLocation,
    selectedLocation,
    currentRoute,
    transportMode,
    searchQuery,
    isNavigating,
    setSelectedLocation,
    setTransportMode,
    setSearchQuery,
    startNavigation,
    stopNavigation,
    calculateRoute,
    setCurrentLocation,
  } = useNavigation();
  
  // Store map instance for sharing with components
  const [mapInstance, setMapInstance] = useState<google.maps.Map | null>(null);
  
  const [isOnboardingComplete, setIsOnboardingComplete] = useState(false);
  const [currentScreen, setCurrentScreen] = useState<Screen>('map');
  const [showNotifications, setShowNotifications] = useState(false);
  const [centerSignal, setCenterSignal] = useState(0);
  const [selectedPlace, setSelectedPlace] = useState<any>(null);
  const [showPlaceDetails, setShowPlaceDetails] = useState(false);
  const [useEnhancedMap, setUseEnhancedMap] = useState(true);
  const [pendingSearchQuery, setPendingSearchQuery] = useState('');
  const pageRouter = usePageRouter();

  // Check if user has completed onboarding
  useEffect(() => {
    const hasCompletedOnboarding = localStorage.getItem('pathfinder_onboarding_complete');
    setIsOnboardingComplete(!!hasCompletedOnboarding);
  }, []);

  const completeOnboarding = () => {
    localStorage.setItem('pathfinder_onboarding_complete', 'true');
    setIsOnboardingComplete(true);
  };

  // Saved places - loaded from localStorage or API
  const [savedPlaces, setSavedPlaces] = useState<Location[]>([]);

  // Sync location data from LocationContext to NavigationContext
  useEffect(() => {
    if (locationData && (!navLocation || 
        locationData.lat !== navLocation.lat || 
        locationData.lng !== navLocation.lng)) {
      setCurrentLocation(locationData);
      logger.debug('Synced location data to navigation context', { locationData });
    }
  }, [locationData, navLocation, setCurrentLocation]);

  // Start location tracking on mount
  useEffect(() => {
    startLocationTracking();
    logger.debug('Started location tracking');
  }, [startLocationTracking]);

  // Load saved places on mount
  useEffect(() => {
    const loadSavedPlaces = () => {
      try {
        const saved = localStorage.getItem('saved_places');
        if (saved) {
          setSavedPlaces(JSON.parse(saved));
        }
      } catch (error) {
        logger.error('Failed to load saved places', { error });
      }
    };
    loadSavedPlaces();
  }, []);

  // Save places to localStorage whenever they change
  useEffect(() => {
    if (savedPlaces.length > 0) {
      localStorage.setItem('saved_places', JSON.stringify(savedPlaces));
    }
  }, [savedPlaces]);

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    logger.debug('Search initiated', { query });
    
    if (!query.trim()) return;
    
    try {
      // Use Google Places search for suggestions
      const results = await googleMapsService.searchPlaces({
        query: query,
        location: navLocation ? { lat: navLocation.lat, lng: navLocation.lng } : undefined,
        radius: 50000 // 50km radius
      });
      
      if (results.length > 0) {
        // Navigate to search panel with results
        setCurrentScreen('search');
        toast.success(`Found ${results.length} results for "${query}"`);
      } else {
        toast.info('No results found for your search');
      }
    } catch (error) {
      logger.error('Search failed:', error);
      toast.error('Search failed. Please try again.');
      // Fallback to search panel
      setCurrentScreen('search');
    }
  };

  const handleLocationSelect = (location: Location) => {
    logger.debug('Location selected', { location });
    setSelectedLocation(location);
    
    // Navigate to appropriate screen based on transport mode
    if (transportMode === 'transit') {
      setCurrentScreen('transit');
    } else {
      setCurrentScreen('route');
    }
  };

  const handleStartNavigation = (route: Route) => {
    startNavigation(route);
    setCurrentScreen('navigation');
    logger.info('Navigation started from App', { route: route.id });
  };

  const handleStopNavigation = () => {
    stopNavigation();
    setCurrentScreen('map');
    logger.info('Navigation stopped from App');
  };

  // Normalize routes coming from different panels to our internal Route type
  const handleStartEnhancedNavigation = (route: any) => {
    const normalized: Route = {
      id: route.id || `route_${Date.now()}`,
      from: route.from,
      to: route.to,
      distance: route.distance,
      duration: route.duration,
      mode: (['driving','walking','transit','cycling'].includes(route.mode)
        ? route.mode
        : transportMode) as TransportMode,
      steps: route.steps || [],
      geometry: route.geometry,
      createdAt: new Date().toISOString(),
    };
    handleStartNavigation(normalized);
  };

  const handleStartTransitNavigation = (route: any) => {
    const stepsText: string[] = (route.steps || []).map((step: any) => {
      if (step.type === 'walk') return `Walk ${step.duration}`;
      const line = step.line ? `${step.line}` : 'Transit';
      return `${line} • ${step.duration}`;
    });
    const normalized: Route = {
      id: route.id || `transit_route_${Date.now()}`,
      from: route.from,
      to: route.to,
      distance: route.distance || route.duration,
      duration: route.totalTime || route.duration,
      mode: 'transit',
      steps: stepsText,
      createdAt: new Date().toISOString(),
    };
    handleStartNavigation(normalized);
  };

  const handleVoiceCommand = (command: string) => {
    logger.debug('Processing voice command', { command });
    // Process voice commands here
    const lowerCommand = command.toLowerCase();
    
    if (lowerCommand.includes('take me home') || lowerCommand.includes('go home')) {
      const homeLocation = savedPlaces.find(place => place.category === 'home');
      if (homeLocation) {
        handleLocationSelect(homeLocation);
      }
    } else if (lowerCommand.includes('go to work') || lowerCommand.includes('navigate to work')) {
      const workLocation = savedPlaces.find(place => place.category === 'work');
      if (workLocation) {
        handleLocationSelect(workLocation);
      }
    } else if (lowerCommand.includes('find') && lowerCommand.includes('coffee')) {
      setSearchQuery('coffee shops');
      setCurrentScreen('search');
    }
    // Add more voice command processing as needed
  };

  const handleNotificationAction = (notification: any) => {
    logger.debug('Handling notification action', { notification });
    // Handle notification actions here
    if (notification.actionData?.destination === 'work') {
      const workLocation = savedPlaces.find(place => place.category === 'work');
      if (workLocation) {
        handleLocationSelect(workLocation);
      }
    } else if (notification.actionData?.mode === 'transit') {
      setTransportMode('transit');
    } else if (notification.actionData?.findParking) {
      setCurrentScreen('parking');
    }
    // Add more notification action handling as needed
  };

  const renderCurrentScreen = () => {
    switch (currentScreen) {
      case 'search':
        return (
          <SearchPanel
            query={searchQuery}
            onSearch={handleSearch}
            onLocationSelect={handleLocationSelect}
            transportMode={transportMode}
            onBack={() => setCurrentScreen('map')}
            onOpenVoicePanel={() => setCurrentScreen('voice')}
          />
        );
      case 'route':
        return (
          <EnhancedRoutePanel
            from={navLocation}
            to={selectedLocation}
            transportMode={transportMode}
            onStartNavigation={handleStartEnhancedNavigation}
            onBack={() => setCurrentScreen('map')}
            onOpenMultiStop={() => setCurrentScreen('multi-stop')}
          />
        );
      case 'transit':
        return (
          <PublicTransitPanel
            from={navLocation}
            to={selectedLocation}
            onStartNavigation={handleStartTransitNavigation}
            onBack={() => setCurrentScreen('map')}
          />
        );
      case 'navigation':
        return (
          <NavigationPanel
            route={currentRoute}
            onStopNavigation={handleStopNavigation}
            onStartAR={() => setCurrentScreen('ar')}
            onShareETA={() => setCurrentScreen('eta-share')}
          />
        );
      case 'saved':
        return (
          <SavedPlacesPanel
            places={savedPlaces}
            onLocationSelect={handleLocationSelect}
            onBack={() => setCurrentScreen('map')}
            onAddPlace={(place) => {
              setSavedPlaces((prev) => [...prev, place]);
            }}
          />
        );
      case 'ar':
        return (
          <ARNavigationPanel
            route={currentRoute}
            onClose={() => setCurrentScreen('navigation')}
          />
        );
      case 'social':
        return (
          <SocialPanel
            onBack={() => setCurrentScreen('map')}
            onLocationSelect={handleLocationSelect}
          />
        );
      case 'profile':
        return (
          <ProfilePanel
            onBack={() => setCurrentScreen('map')}
            onOpenSettings={() => setCurrentScreen('settings')}
            onOpenSafety={() => setCurrentScreen('safety')}
            onOpenAnalytics={() => setCurrentScreen('analytics')}
            onOpenGamification={() => setCurrentScreen('gamification')}
          />
        );
      case 'voice':
        return (
          <VoiceCommandPanel
            onClose={() => setCurrentScreen('map')}
            onVoiceCommand={handleVoiceCommand}
          />
        );
      case 'eta-share':
        return currentRoute ? (
          <ETASharingPanel
            route={{
              id: currentRoute.id,
              from: { name: currentRoute.from.name, address: currentRoute.from.address },
              to: { name: currentRoute.to?.name || '', address: currentRoute.to?.address || '' },
              distance: currentRoute.distance,
              duration: currentRoute.duration,
              mode: currentRoute.mode,
              eta: currentRoute.duration,
            }}
            onClose={() => setCurrentScreen('navigation')}
          />
        ) : (
          <div className="h-full bg-white flex items-center justify-center">
            <p className="text-gray-500">No active route to share</p>
          </div>
        );
      case 'settings':
        return (
          <SettingsPanel
            onBack={() => setCurrentScreen('map')}
            onNavigateToIntegrations={() => setCurrentScreen('integrations')}
            onNavigateToFleet={() => setCurrentScreen('fleet')}
            onNavigateToAPIDocs={() => setCurrentScreen('api-docs')}
            onNavigateToORSConfig={() => setCurrentScreen('ors-config')}
            onNavigateToDeveloper={() => setCurrentScreen('developer')}
            onNavigateToPushSettings={() => setCurrentScreen('push-settings')}
            onNavigateToDeviceTest={() => setCurrentScreen('device-test')}
            onNavigateToCrashReports={() => setCurrentScreen('crash-reports')}
          />
        );
      case 'safety':
        return (
          <SafetyCenter
            onBack={() => setCurrentScreen('map')}
          />
        );
      case 'integrations':
        return (
          <IntegrationsHub
            onBack={() => setCurrentScreen('settings')}
          />
        );
      case 'ai-predictions':
        return (
          <div className="h-full bg-white p-4">
            <AIPredictions
              destination={selectedLocation?.name}
              currentLocation={navLocation?.name || ''}
              map={mapInstance}
              onSuggestionAccept={(suggestion) => {
                logger.debug('AI suggestion accepted', { suggestion });
                // Handle different types of AI suggestions
                if (suggestion.type === 'traffic' && suggestion.actionData?.trafficData) {
                  // Handle traffic suggestions
                  const alt = suggestion.actionData.trafficData.alternativeRoutes[0];
                  if (alt) {
                    toast.info(`Consider taking ${alt.via} to save ${alt.timeSaved} minutes`);
                  }
                } else if (suggestion.type === 'parking' && suggestion.actionData?.parkingSpots) {
                  // Switch to parking finder with spots already loaded
                  setCurrentScreen('parking');
                } else if (suggestion.type === 'route') {
                  // Auto-select suggested route
                  setTransportMode(suggestion.mode || transportMode);
                  if (suggestion.destination) {
                    handleLocationSelect(suggestion.destination);
                  }
                } else if (suggestion.type === 'departure') {
                  // Set departure time suggestion
                  logger.info('Departure time suggestion accepted', { time: suggestion.time });
                } else if (suggestion.type === 'place') {
                  // Navigate to suggested place
                  if (suggestion.place) {
                    handleLocationSelect(suggestion.place);
                  }
                }
              }}
            />
            <Button 
              className="mt-4" 
              onClick={() => setCurrentScreen('map')}
            >
              Back to Map
            </Button>
          </div>
        );
      case 'analytics':
        return (
          <AnalyticsDashboard
            onBack={() => setCurrentScreen('profile')}
          />
        );
      case 'parking':
        return (
          <ParkingFinder
            onBack={() => setCurrentScreen('map')}
            destination={selectedLocation?.name}
            map={mapInstance}
            onNavigateToParking={(spot) => {
              // Start navigation to parking spot
              if (spot.location) {
                handleLocationSelect({
                  lat: spot.location.lat,
                  lng: spot.location.lng,
                  name: spot.name,
                  address: spot.address
                });
                setCurrentScreen('route');
              }
            }}
          />
        );
      case 'gamification':
        return (
          <Gamification
            onBack={() => setCurrentScreen('profile')}
          />
        );
      case 'fleet':
        return (
          <FleetManagement
            onBack={() => setCurrentScreen('settings')}
          />
        );
      case 'api-docs':
        return (
          <APIDocs
            onBack={() => setCurrentScreen('settings')}
          />
        );
      case 'multi-stop':
        return (
          <MultiStopRoutePlanner
            onRouteCalculated={(route) => {
              logger.debug('Multi-stop route calculated', { route });
              // Convert to normalized route and start navigation
              if (route.from && route.to) {
                const normalizedRoute: Route = {
                  id: route.id || 'multi-stop-route',
                  from: route.from,
                  to: route.to,
                  distance: route.distance || '0 km',
                  duration: route.duration || '0 min',
                  mode: transportMode,
                  steps: route.steps || [],
                  waypoints: route.waypoints || [],
                  createdAt: new Date().toISOString(),
                };
                handleStartNavigation(normalizedRoute);
              }
            }}
            onBack={() => setCurrentScreen('route')}
          />
        );
      case 'ors-config':
        return (
          <ORSConfigPanel
            onBack={() => setCurrentScreen('settings')}
          />
        );
      case 'developer':
        return (
          <DeveloperPanel
            onBack={() => setCurrentScreen('settings')}
          />
        );
      case 'place-details':
        return selectedPlace ? (
          <div className="h-full bg-white p-4">
            <Button 
              className="mb-4" 
              onClick={() => setCurrentScreen('map')}
              variant="outline"
            >
              ← Back to Map
            </Button>
            <div className="text-center">
              <h2 className="text-lg font-semibold mb-2">{selectedPlace.name}</h2>
              <p className="text-gray-600">{selectedPlace.address}</p>
            </div>
          </div>
        ) : (
          <div className="h-full bg-white flex items-center justify-center">
            <p className="text-gray-500">No place selected</p>
          </div>
        );
      case 'push-settings':
        return (
          <div className="h-full bg-white">
            <PushNotificationSettings />
          </div>
        );
      case 'device-test':
        return (
          <div className="h-full bg-white">
            <DeviceIntegrationTest />
          </div>
        );
      case 'crash-reports':
        return (
          <div className="h-full bg-white p-4">
            <Button 
              className="mb-4" 
              onClick={() => setCurrentScreen('settings')}
              variant="outline"
            >
              ← Back to Settings
            </Button>
            <CrashReporting />
          </div>
        );
      default:
        // Always use GoogleMapView only
        return (
          <GoogleMapView
            currentLocation={navLocation}
            selectedLocation={selectedLocation}
            route={currentRoute}
            transportMode={transportMode}
            isNavigating={isNavigating}
            centerSignal={centerSignal}
            onLocationSelect={handleLocationSelect}
            onMapReady={(map) => {
              logger.info('Google Map instance ready');
            }}
            onRouteRequest={(from, to) => {
              // Calculate and start route
              logger.info('Route requested from map click', { from, to });
              setSelectedLocation(to);
              
              // Navigate to route screen to show route options
              if (transportMode === 'transit') {
                setCurrentScreen('transit');
              } else {
                setCurrentScreen('route');
              }
            }}
          />
        );
    }
  };

  // Show onboarding if user hasn't completed it
  if (!isOnboardingComplete) {
    return <OnboardingFlow onComplete={completeOnboarding} />;
  }

  // Free mode: no login required; users continue as guests

  return (
    <div className="h-screen w-full bg-background flex flex-col overflow-hidden">
      {/* Persistent Top Navigation Bar */}
      <div className="flex-shrink-0 bg-white border-b border-gray-200 px-4 py-3 z-50">
        <div className="flex items-center gap-3">
          {/* Back button - show on all screens except map */}
          {currentScreen !== 'map' && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                // Handle back navigation based on current screen
                if (currentScreen === 'navigation') {
                  handleStopNavigation();
                } else if (currentScreen === 'ar' || currentScreen === 'eta-share') {
                  setCurrentScreen('navigation');
                } else if (currentScreen === 'multi-stop') {
                  setCurrentScreen('route');
                } else if (currentScreen === 'transit' || currentScreen === 'route') {
                  setCurrentScreen('map');
                } else {
                  setCurrentScreen('map');
                }
              }}
              className="hover:bg-gray-100"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
          )}
          
          {/* Search Bar - show on map screen */}
          {currentScreen === 'map' && (
            <div className="flex-1 flex items-center gap-2">
              <div className="flex-1 bg-gray-50 rounded-xl border border-gray-200 px-4 py-2.5">
                <div className="flex items-center gap-3">
                  <Search className="w-5 h-5 text-gray-500" />
                  <input
                    type="text"
                    placeholder="Where to?"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter' && searchQuery.trim()) {
                        handleSearch(searchQuery);
                        setPendingSearchQuery(searchQuery);
                      }
                    }}
                    className="flex-1 bg-transparent border-none outline-none text-gray-700 placeholder-gray-500"
                  />
                  {searchQuery && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setSearchQuery('');
                        setPendingSearchQuery('');
                      }}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>
              <Button
                size="sm"
                onClick={() => {
                  if (searchQuery.trim()) {
                    handleSearch(searchQuery);
                    setPendingSearchQuery(searchQuery);
                  } else {
                    setCurrentScreen('search');
                  }
                }}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                <Search className="w-4 h-4" />
              </Button>
            </div>
          )}
          
          {/* Screen Title - show on non-map screens */}
          {currentScreen !== 'map' && (
            <div className="flex-1">
              <h1 className="font-semibold text-lg text-gray-900">
                {currentScreen === 'search' && 'Search'}
                {currentScreen === 'route' && 'Route'}
                {currentScreen === 'navigation' && 'Navigation'}
                {currentScreen === 'saved' && 'Saved Places'}
                {currentScreen === 'settings' && 'Settings'}
                {currentScreen === 'transit' && 'Public Transit'}
                {currentScreen === 'offline' && 'Offline Maps'}
                {currentScreen === 'ar' && 'AR Navigation'}
                {currentScreen === 'social' && 'Community'}
                {currentScreen === 'profile' && 'Profile'}
                {currentScreen === 'voice' && 'Voice Commands'}
                {currentScreen === 'eta-share' && 'Share ETA'}
                {currentScreen === 'safety' && 'Safety Center'}
                {currentScreen === 'integrations' && 'Integrations'}
                {currentScreen === 'ai-predictions' && 'AI Assistant'}
                {currentScreen === 'analytics' && 'Analytics'}
                {currentScreen === 'parking' && 'Find Parking'}
                {currentScreen === 'gamification' && 'Achievements'}
                {currentScreen === 'fleet' && 'Fleet Management'}
                {currentScreen === 'api-docs' && 'API Documentation'}
                {currentScreen === 'multi-stop' && 'Multi-Stop Route'}
                {currentScreen === 'ors-config' && 'API Configuration'}
                {currentScreen === 'developer' && 'Developer Tools'}
                {currentScreen === 'place-details' && 'Place Details'}
                {currentScreen === 'push-settings' && 'Notifications'}
                {currentScreen === 'device-test' && 'Device Test'}
                {currentScreen === 'crash-reports' && 'Crash Reports'}
              </h1>
            </div>
          )}
          
          {/* Action Buttons - always visible */}
          <div className="flex gap-2">
            <Button
              size="icon"
              className="bg-white text-gray-700 shadow-sm border border-gray-200 hover:bg-gray-50"
              onClick={() => setCurrentScreen('voice')}
            >
              <Mic className="w-5 h-5" />
            </Button>
            
            <Button
              size="icon"
              className="bg-white text-gray-700 shadow-sm border border-gray-200 hover:bg-gray-50 relative"
              onClick={() => setShowNotifications(!showNotifications)}
            >
              <Bell className="w-5 h-5" />
              {showNotifications && (
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full" />
              )}
            </Button>
            
            <Button
              size="icon"
              className="bg-white text-gray-700 shadow-sm border border-gray-200 hover:bg-gray-50"
              onClick={() => setCurrentScreen('profile')}
            >
              <User className="w-5 h-5" />
            </Button>
            
              <ThemeToggle />
              <NavigationMenu
              onNavigateToPage={(route, params) => pageRouter.navigateTo(route, params)}
              onNavigateToScreen={(screen) => setCurrentScreen(screen as Screen)}
            />
          </div>
        </div>
      </div>

      {/* Transport Mode Selector - Only show on map screen */}
      {currentScreen === 'map' && (
        <div className="absolute top-20 left-4 z-40">
          <TransportModeSelector
            currentMode={transportMode}
            onModeChange={setTransportMode}
          />
        </div>
      )}

      {/* Smart Notifications - Only show on map screen */}
      {currentScreen === 'map' && showNotifications && (
        <div className="absolute top-28 left-4 right-4 z-40 max-w-md">
          <SmartNotifications
            currentLocation={navLocation}
            onActionClick={handleNotificationAction}
          />
        </div>
      )}

      {/* Quick Action Buttons - Only show on map screen */}
      {currentScreen === 'map' && (
        <div className="absolute left-4 bottom-32 z-40 flex flex-col gap-3">
          <Button
            size="icon"
            className="h-12 w-12 rounded-2xl bg-white text-gray-700 shadow-lg border border-gray-200 hover:bg-gray-50"
            onClick={() => {
              // Center on current location: trigger a pulse/visual center
              setCenterSignal((n) => n + 1);
            }}
          >
            <Target className="w-5 h-5" />
          </Button>
          
          <Button
            size="icon"
            className="h-12 w-12 rounded-2xl bg-white text-gray-700 shadow-lg border border-gray-200 hover:bg-gray-50"
            onClick={() => setCurrentScreen('saved')}
          >
            <MapPin className="w-5 h-5" />
          </Button>
          
          <Button
            size="icon"
            className="h-12 w-12 rounded-2xl bg-white text-orange-600 hover:bg-orange-50 shadow-lg border border-orange-300 dark:bg-orange-600 dark:text-white dark:hover:bg-orange-700 dark:border-white/10"
            onClick={() => setCurrentScreen('parking')}
          >
            <Car className="w-5 h-5" />
          </Button>
          
          <Button
            size="icon"
            className="h-12 w-12 rounded-2xl bg-white text-purple-600 hover:bg-purple-50 shadow-lg border border-purple-300 dark:bg-purple-600 dark:text-white dark:hover:bg-purple-700 dark:border-white/10"
            onClick={() => setCurrentScreen('ai-predictions')}
          >
            <Brain className="w-5 h-5" />
          </Button>
        </div>
      )}

      {/* Main Content - with proper scrolling; add bottom padding so it doesn't hide behind fixed bottom nav */}
      <div className="flex-1 relative overflow-y-auto pb-20">
        {renderCurrentScreen()}
      </div>

      {/* Bottom Navigation - Always visible and fixed */}
      <div className="fixed bottom-0 left-0 right-0 z-[1000]">
        <BottomNavigation
          currentScreen={currentScreen}
          onScreenChange={setCurrentScreen}
        />
      </div>

      {/* Place Details Sheet */}
      <PlaceDetailsSheet
        place={selectedPlace}
        isOpen={showPlaceDetails}
        onClose={() => setShowPlaceDetails(false)}
        onNavigate={() => {
          if (selectedPlace && navLocation) {
            // Start navigation to selected place
            const route: Route = {
              id: 'place-route',
              from: navLocation,
              to: selectedPlace,
              distance: '2.5 km',
              duration: '8 min',
              mode: transportMode,
              steps: ['Head south on Main St', 'Turn left on Oak Ave'],
              createdAt: new Date().toISOString(),
            };
            handleStartNavigation(route);
            setShowPlaceDetails(false);
          }
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

      {/* Advanced Router for Page Components */}
      <AdvancedRouter
        currentRoute={pageRouter.currentRoute}
        onNavigateBack={pageRouter.navigateBack}
        routeParams={pageRouter.routeParams}
      />
      
      {/* Toast notifications */}
      <Toaster richColors closeButton />
    </div>
  );
}

// Component to show global loading overlay when needed
function GlobalLoadingOverlay() {
  const { isAnyLoading } = useLoading();
  
  return (
    <LoadingOverlay 
      visible={isAnyLoading()} 
      text="Processing..." 
      backdrop={false}
    />
  );
}

// Main App wrapper with providers and error boundary
export default function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <ErrorBoundary onError={(error, errorInfo) => {
        logger.error('App Error occurred', { error: error.message, stack: error.stack, errorInfo });
        // Send to analytics service for crash reporting
        import('./services/analyticsService').then(({ analyticsService }) => {
          analyticsService.reportCrash(error, 'high', {
            componentStack: errorInfo.componentStack,
            type: 'react_error_boundary'
          });
        }).catch(console.error);
      }}>
        <LoadingProvider>
          <SettingsProvider>
            <LocationProvider>
              <UserProvider>
                <NavigationProvider>
                  <AppContent />
                  <GlobalLoadingOverlay />
                </NavigationProvider>
              </UserProvider>
            </LocationProvider>
          </SettingsProvider>
        </LoadingProvider>
      </ErrorBoundary>
    </ThemeProvider>
  );
}
