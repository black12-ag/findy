import { useState, useEffect } from 'react';
import { MapView } from './components/MapView';
import { SearchPanel } from './components/SearchPanel';
import { NavigationPanel } from './components/NavigationPanel';
import { BottomNavigation } from './components/BottomNavigation';
import { EnhancedRoutePanel } from './components/EnhancedRoutePanel';
import { SettingsPanel } from './components/SettingsPanel';
import { SavedPlacesPanel } from './components/SavedPlacesPanel';
import { PublicTransitPanel } from './components/PublicTransitPanel';
import { OfflineMapsPanel } from './components/OfflineMapsPanel';
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
import { LoginScreen } from './components/LoginScreen';
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
import { Search, MapPin, User, Target, Mic, Bell, Car, Brain, Trophy } from 'lucide-react';
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
import { logger } from './utils/logger';
import { UserProvider } from './contexts/UserContext';
import { NavigationProvider, useNavigation } from './contexts/NavigationContext';
import { useUser } from './contexts/UserContext';
import { SettingsProvider } from './contexts/SettingsContext';
import { LocationProvider } from './contexts/LocationContext';

import type { Location, Route, TransportMode } from './contexts/NavigationContext';

type Screen = 'map' | 'search' | 'route' | 'navigation' | 'saved' | 'settings' | 'transit' | 'offline' | 'ar' | 'social' | 'profile' | 'voice' | 'eta-share' | 'safety' | 'integrations' | 'ai-predictions' | 'analytics' | 'parking' | 'gamification' | 'fleet' | 'api-docs' | 'multi-stop' | 'ors-config' | 'developer' | 'place-details' | 'push-settings' | 'device-test' | 'crash-reports';

function AppContent() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { user } = useUser();
  const {
    currentLocation,
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
  } = useNavigation();
  
  const [isOnboardingComplete, setIsOnboardingComplete] = useState(false);
  const [currentScreen, setCurrentScreen] = useState<Screen>('map');
  const [showNotifications, setShowNotifications] = useState(true);
  const [centerSignal, setCenterSignal] = useState(0);
  const [selectedPlace, setSelectedPlace] = useState<any>(null);
  const [showPlaceDetails, setShowPlaceDetails] = useState(false);
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

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    logger.debug('Search initiated', { query });
    // Search context will handle the actual search
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
            from={currentLocation}
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
            from={currentLocation}
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
      case 'offline':
        return (
          <OfflineMapsPanel
            onBack={() => setCurrentScreen('map')}
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
            onNavigateToOffline={() => setCurrentScreen('offline')}
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
              currentLocation={currentLocation.name}
              onSuggestionAccept={(suggestion) => {
                logger.debug('AI suggestion accepted', { suggestion });
                // Handle different types of AI suggestions
                if (suggestion.type === 'route') {
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
        return (
          <MapView
            currentLocation={currentLocation}
            selectedLocation={selectedLocation}
            route={currentRoute}
            transportMode={transportMode}
            isNavigating={isNavigating}
            centerSignal={centerSignal}
          />
        );
    }
  };

  // Show onboarding if user hasn't completed it
  if (!isOnboardingComplete) {
    return <OnboardingFlow onComplete={completeOnboarding} />;
  }

  // Optional login - users can continue as guest
  // Commenting out forced authentication to allow guest access
  // if (!authLoading && !isAuthenticated) {
  //   return <LoginScreen onSuccess={() => {
  //     // Handle successful login
  //     logger.info('Login successful');
  //   }} />;
  // }

  return (
    <div className="h-screen w-full bg-background flex flex-col relative overflow-hidden">
      {/* Top Bar - Only show on map screen */}
      {currentScreen === 'map' && (
        <div className="absolute top-0 left-0 right-0 z-50 p-4">
          <div className="flex items-center gap-3">
            {/* Search Bar */}
            <div 
              className="flex-1 bg-white rounded-xl shadow-lg border border-gray-200 px-4 py-3 cursor-pointer"
              onClick={() => setCurrentScreen('search')}
            >
              <div className="flex items-center gap-3">
                <Search className="w-5 h-5 text-gray-500" />
                <span className="text-gray-500">Where to?</span>
              </div>
            </div>
            
            {/* Action Buttons */}
            <div className="flex gap-2">
              <Button
                size="icon"
                className="bg-white text-gray-700 shadow-lg border border-gray-200 hover:bg-gray-50"
                onClick={() => setCurrentScreen('voice')}
              >
                <Mic className="w-5 h-5" />
              </Button>
              
              <Button
                size="icon"
                className="bg-white text-gray-700 shadow-lg border border-gray-200 hover:bg-gray-50 relative"
                onClick={() => setShowNotifications(!showNotifications)}
              >
                <Bell className="w-5 h-5" />
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full" />
              </Button>
              
              <Button
                size="icon"
                className="bg-white text-gray-700 shadow-lg border border-gray-200 hover:bg-gray-50"
                onClick={() => setCurrentScreen('profile')}
              >
                <User className="w-5 h-5" />
              </Button>
              
              <NavigationMenu
                onNavigateToPage={(route, params) => pageRouter.navigateTo(route, params)}
                onNavigateToScreen={(screen) => setCurrentScreen(screen as Screen)}
              />
            </div>
          </div>
        </div>
      )}

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
        <div className="absolute top-32 left-4 right-4 z-40 max-w-md">
          <SmartNotifications
            currentLocation={currentLocation}
            onActionClick={handleNotificationAction}
          />
        </div>
      )}

      {/* Quick Action Buttons - Only show on map screen */}
      {currentScreen === 'map' && (
        <div className="absolute right-4 bottom-32 z-40 flex flex-col gap-3">
          <Button
            size="icon"
            className="bg-white text-gray-700 shadow-lg border border-gray-200 hover:bg-gray-50"
            onClick={() => {
              // Center on current location: trigger a pulse/visual center
              setCenterSignal((n) => n + 1);
            }}
          >
            <Target className="w-5 h-5" />
          </Button>
          
          <Button
            size="icon"
            className="bg-white text-gray-700 shadow-lg border border-gray-200 hover:bg-gray-50"
            onClick={() => setCurrentScreen('saved')}
          >
            <MapPin className="w-5 h-5" />
          </Button>
          
          <Button
            size="icon"
            className="bg-orange-600 text-white shadow-lg hover:bg-orange-700"
            onClick={() => setCurrentScreen('parking')}
          >
            <Car className="w-5 h-5" />
          </Button>
          
          <Button
            size="icon"
            className="bg-purple-600 text-white shadow-lg hover:bg-purple-700"
            onClick={() => setCurrentScreen('ai-predictions')}
          >
            <Brain className="w-5 h-5" />
          </Button>
          
          {/* Demo place details button */}
          <Button
            size="icon"
            className="bg-green-600 text-white shadow-lg hover:bg-green-700"
            onClick={() => {
              setSelectedPlace({
                id: 'demo-place',
                name: 'Demo Coffee Shop',
                address: '123 Main St, San Francisco, CA',
                category: 'restaurant',
                rating: 4.5,
                reviewCount: 127,
                priceLevel: 2,
                isOpen: true,
                openHours: 'Open until 9 PM',
                phone: '(555) 123-4567',
                website: 'demo-coffee.com',
                photos: [],
                amenities: ['WiFi', 'Parking'],
                reviews: []
              });
              setShowPlaceDetails(true);
            }}
          >
            <MapPin className="w-5 h-5" />
          </Button>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 relative min-h-0">
        {renderCurrentScreen()}
      </div>

      {/* Bottom Navigation - Only show on map screen when not navigating */}
      {currentScreen === 'map' && !isNavigating && (
        <BottomNavigation
          currentScreen={currentScreen}
          onScreenChange={setCurrentScreen}
        />
      )}

      {/* Place Details Sheet */}
      <PlaceDetailsSheet
        place={selectedPlace}
        isOpen={showPlaceDetails}
        onClose={() => setShowPlaceDetails(false)}
        onNavigate={() => {
          if (selectedPlace && currentLocation) {
            // Start navigation to selected place
            const route: Route = {
              id: 'place-route',
              from: currentLocation,
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
  );
}
