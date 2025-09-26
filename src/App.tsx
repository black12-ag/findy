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

type Screen = 'map' | 'search' | 'route' | 'navigation' | 'saved' | 'settings' | 'transit' | 'offline' | 'ar' | 'social' | 'profile' | 'voice' | 'eta-share' | 'safety' | 'integrations' | 'ai-predictions' | 'analytics' | 'parking' | 'gamification' | 'fleet' | 'api-docs' | 'multi-stop' | 'ors-config';
type TransportMode = 'driving' | 'walking' | 'transit' | 'cycling';

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
}

function AppContent() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [isOnboardingComplete, setIsOnboardingComplete] = useState(false);
  const [currentScreen, setCurrentScreen] = useState<Screen>('map');
  const [transportMode, setTransportMode] = useState<TransportMode>('driving');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);
  const [currentRoute, setCurrentRoute] = useState<Route | null>(null);
  const [isNavigating, setIsNavigating] = useState(false);
  const [showNotifications, setShowNotifications] = useState(true);
  const [centerSignal, setCenterSignal] = useState(0);
  const [currentLocation] = useState<Location>({
    id: 'current',
    name: 'Current Location',
    address: '123 Main St, San Francisco, CA',
    lat: 37.7749,
    lng: -122.4194
  });

  // Check if user has completed onboarding
  useEffect(() => {
    const hasCompletedOnboarding = localStorage.getItem('pathfinder_onboarding_complete');
    setIsOnboardingComplete(!!hasCompletedOnboarding);
  }, []);

  const completeOnboarding = () => {
    localStorage.setItem('pathfinder_onboarding_complete', 'true');
    setIsOnboardingComplete(true);
  };

  // Mock data for demonstration
  const [savedPlaces, setSavedPlaces] = useState<Location[]>([
    {
      id: '1',
      name: 'Home',
      address: '123 Main St, San Francisco, CA',
      lat: 37.7749,
      lng: -122.4194,
      category: 'home'
    },
    {
      id: '2',
      name: 'Work',
      address: '456 Market St, San Francisco, CA',
      lat: 37.7849,
      lng: -122.4094,
      category: 'work'
    },
    {
      id: '3',
      name: 'Gym',
      address: '789 Fitness Ave, San Francisco, CA',
      lat: 37.7649,
      lng: -122.4294,
      category: 'gym'
    }
  ]);

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    // Mock search results would be implemented here
    console.log('Searching for:', query);
  };

  const handleLocationSelect = (location: Location) => {
    setSelectedLocation(location);
    if (transportMode === 'transit') {
      setCurrentScreen('transit');
    } else {
      setCurrentScreen('route');
    }
  };

  const startNavigation = (route: Route) => {
    setCurrentRoute(route);
    setIsNavigating(true);
    setCurrentScreen('navigation');
  };

  const stopNavigation = () => {
    setIsNavigating(false);
    setCurrentRoute(null);
    setCurrentScreen('map');
  };

  // Normalize routes coming from different panels to our internal Route type
  const handleStartEnhancedNavigation = (route: any) => {
    const normalized: Route = {
      id: route.id,
      from: route.from,
      to: route.to,
      distance: route.distance,
      duration: route.duration,
      // cast mode to our TransportMode if possible
      mode: (['driving','walking','transit','cycling'].includes(route.mode)
        ? route.mode
        : transportMode) as TransportMode,
      steps: route.steps || [],
    };
    startNavigation(normalized);
  };

  const handleStartTransitNavigation = (route: any) => {
    const stepsText: string[] = (route.steps || []).map((step: any) => {
      if (step.type === 'walk') return `Walk ${step.duration}`;
      const line = step.line ? `${step.line}` : 'Transit';
      return `${line} • ${step.duration}`;
    });
    const normalized: Route = {
      id: route.id,
      from: route.from,
      to: route.to,
      distance: route.duration,
      duration: route.totalTime || route.duration,
      mode: 'transit',
      steps: stepsText,
    };
    startNavigation(normalized);
  };

  const handleVoiceCommand = (command: string) => {
    console.log('Processing voice command:', command);
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
    console.log('Handling notification action:', notification);
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
            onStopNavigation={stopNavigation}
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
              onSuggestionAccept={(suggestion) => console.log('Accepted:', suggestion)}
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
              console.log('Multi-stop route:', route);
              setCurrentScreen('navigation');
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

  // Show login if user isn't authenticated
  if (!authLoading && !isAuthenticated) {
    return <LoginScreen onSuccess={() => {
      // Handle successful login
      console.log('Login successful');
    }} />;
  }

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
      console.error('App Error:', error);
      // Could send to analytics service here
    }}>
      <LoadingProvider>
        <AppContent />
        <GlobalLoadingOverlay />
      </LoadingProvider>
    </ErrorBoundary>
  );
}
