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
import { OfflineMapsPanel } from './components/OfflineMapsPanel';
import { OfflineMapIndicator } from './components/OfflineMapIndicator';
import { OnboardingFlow } from './components/OnboardingFlow';
import { Button } from './components/ui/button';
import { Search, MapPin, User, Target, Mic, Bell, Car, Brain, Trophy, ArrowLeft, Menu, X, Download, WifiOff } from 'lucide-react';
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

type Screen = 'map' | 'search' | 'route' | 'navigation' | 'saved' | 'settings' | 'transit' | 'offline' | 'ar' | 'social' | 'profile' | 'voice' | 'eta-share' | 'safety' | 'integrations' | 'ai-predictions' | 'analytics' | 'parking' | 'gamification' | 'fleet' | 'api-docs' | 'multi-stop' | 'developer' | 'place-details' | 'push-settings' | 'device-test' | 'crash-reports';

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
  const [searchSuggestions, setSearchSuggestions] = useState<Location[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isVoiceSearching, setIsVoiceSearching] = useState(false);
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
    
    if (!query.trim()) {
      setSearchSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    
    try {
      // Use Google Places search for suggestions
      const results = await googleMapsService.searchPlaces({
        query: query,
        location: navLocation ? { lat: navLocation.lat, lng: navLocation.lng } : undefined,
        radius: 50000 // 50km radius
      });
      
      if (results.length > 0) {
        // Convert to Location objects
        const suggestions: Location[] = results.map(result => ({
          id: result.place_id || `search_${Date.now()}_${Math.random()}`,
          name: result.name || query,
          address: result.formatted_address || result.vicinity || '',
          lat: result.geometry?.location?.lat() || 0,
          lng: result.geometry?.location?.lng() || 0,
          category: result.types?.[0] || 'place'
        }));
        
        setSearchSuggestions(suggestions);
        setShowSuggestions(true);
        
        // If there's an exact match or single result, auto-select it
        if (suggestions.length === 1 || 
            suggestions[0].name.toLowerCase() === query.toLowerCase()) {
          handleLocationSelect(suggestions[0]);
          setShowSuggestions(false);
        }
      } else {
        // Show popular suggestions based on transport mode
        const popularSuggestions = getPopularSuggestions(transportMode, query);
        setSearchSuggestions(popularSuggestions);
        setShowSuggestions(popularSuggestions.length > 0);
        
        if (popularSuggestions.length === 0) {
          toast.info('No results found. Try a different search term.');
        }
      }
    } catch (error) {
      logger.error('Search failed:', error);
      
      // Show popular suggestions as fallback
      const popularSuggestions = getPopularSuggestions(transportMode, query);
      setSearchSuggestions(popularSuggestions);
      setShowSuggestions(popularSuggestions.length > 0);
      
      if (popularSuggestions.length === 0) {
        toast.error('Search failed. Please check your connection.');
      }
    }
  };
  
  // Get popular search suggestions
  const getPopularSuggestions = (mode: string, query: string): Location[] => {
    const suggestions = [
      // Restaurants & Food
      { id: 'mcdonalds', name: "McDonald's", category: 'restaurant', keywords: ['mcdonalds', 'food', 'burger', 'restaurant'] },
      { id: 'starbucks', name: 'Starbucks', category: 'cafe', keywords: ['starbucks', 'coffee', 'cafe'] },
      { id: 'walmart', name: 'Walmart', category: 'store', keywords: ['walmart', 'shopping', 'store', 'grocery'] },
      { id: 'target', name: 'Target', category: 'store', keywords: ['target', 'shopping', 'store'] },
      
      // Gas Stations (more relevant for driving)
      ...(mode === 'driving' ? [
        { id: 'shell', name: 'Shell Gas Station', category: 'gas_station', keywords: ['shell', 'gas', 'fuel'] },
        { id: 'chevron', name: 'Chevron', category: 'gas_station', keywords: ['chevron', 'gas', 'fuel'] },
        { id: 'parking', name: 'Parking', category: 'parking', keywords: ['parking', 'park'] },
      ] : []),
      
      // Services
      { id: 'hospital', name: 'Hospital', category: 'hospital', keywords: ['hospital', 'emergency', 'medical'] },
      { id: 'pharmacy', name: 'Pharmacy', category: 'pharmacy', keywords: ['pharmacy', 'medicine', 'cvs', 'walgreens'] },
      { id: 'bank', name: 'Bank/ATM', category: 'bank', keywords: ['bank', 'atm', 'money'] },
      { id: 'hotel', name: 'Hotels', category: 'lodging', keywords: ['hotel', 'motel', 'stay', 'accommodation'] },
      
      // Walking specific
      ...(mode === 'walking' ? [
        { id: 'park', name: 'Park', category: 'park', keywords: ['park', 'green', 'nature'] },
        { id: 'library', name: 'Library', category: 'library', keywords: ['library', 'books'] },
      ] : []),
    ];
    
    const queryLower = query.toLowerCase();
    return suggestions
      .filter(suggestion => 
        suggestion.keywords.some(keyword => keyword.includes(queryLower)) ||
        suggestion.name.toLowerCase().includes(queryLower)
      )
      .slice(0, 5)
      .map(suggestion => ({
        id: suggestion.id,
        name: suggestion.name,
        address: `Search for nearby ${suggestion.category}`,
        lat: 0, // Will be filled when selected
        lng: 0, // Will be filled when selected  
        category: suggestion.category
      }));
  };
  
  // Handle voice search
  const startVoiceSearch = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      toast.error('Voice search not supported in this browser');
      return;
    }
    
    const SpeechRecognition = window.webkitSpeechRecognition || window.SpeechRecognition;
    const recognition = new SpeechRecognition();
    
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';
    
    setIsVoiceSearching(true);
    toast.info('🎤 Listening... Say a place name or address');
    
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setSearchQuery(transcript);
      handleSearch(transcript);
      toast.success(`Searching for: "${transcript}"`);
    };
    
    recognition.onerror = (event) => {
      logger.error('Voice recognition error:', event.error);
      toast.error('Voice search failed. Please try again.');
      setIsVoiceSearching(false);
    };
    
    recognition.onend = () => {
      setIsVoiceSearching(false);
    };
    
    recognition.start();
  };

  const handleLocationSelect = (location: Location, forceRouteScreen: boolean = false) => {
    logger.debug('Location selected', { location, forceRouteScreen });
    setSelectedLocation(location);
    
    // Always stay on map screen for better UX - route will auto-display on map
    setCurrentScreen('map');
    
    // Show appropriate emoji based on transport mode
    const modeEmoji = {
      driving: '🚗',
      walking: '🚶',
      cycling: '🚴',
      transit: '🚌'
    }[transportMode as string] || '📍';
    
    // Show quick feedback
    toast.info(`${modeEmoji} Getting ${transportMode} directions to ${location.name}...`, {
      duration: 2000
    });
  };

  // Handle detailed route planning (but keep on map)
  const handleForceRouteScreen = (location: Location) => {
    logger.debug('Route planning requested', { location });
    setSelectedLocation(location);
    
    // Stay on map - the route will be calculated and displayed automatically
    setCurrentScreen('map');
    
    // Show appropriate feedback
    const modeEmoji = {
      driving: '🚗',
      walking: '🚶',
      cycling: '🚴',
      transit: '🚌'
    }[transportMode as string] || '📍';
    
    toast.info(`${modeEmoji} Calculating detailed ${transportMode} route...`, {
      duration: 2500
    });
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
            onOpenOfflineMaps={() => setCurrentScreen('offline')}
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
            onNavigateToOfflineMaps={() => setCurrentScreen('offline')}
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
                // Stay on map - route will auto-display
                setCurrentScreen('map');
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
            onBack={() => setCurrentScreen('map')}
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
      case 'offline':
        return (
          <OfflineMapsPanel
            onBack={() => setCurrentScreen('map')}
          />
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
            onForceRouteScreen={handleForceRouteScreen}
            onMapReady={(map) => {
              logger.info('Google Map instance ready');
            }}
            onRouteRequest={(from, to) => {
              // Calculate and start route
              logger.info('Route requested from map click', { from, to });
              setSelectedLocation(to);
              
              // Stay on map - route will display automatically
              // The GoogleMapView will handle the route display
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
                } else {
                  // Always go back to map for all other screens
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
            <div className="flex-1 flex items-center gap-2 relative">
              <div className="flex-1 bg-gray-50 rounded-xl border border-gray-200 px-4 py-2.5 relative">
                <div className="flex items-center gap-3">
                  <Search className="w-5 h-5 text-gray-500" />
                  <input
                    type="text"
                    placeholder="Where to?"
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      if (e.target.value.trim()) {
                        handleSearch(e.target.value);
                      } else {
                        setShowSuggestions(false);
                      }
                    }}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter' && searchQuery.trim()) {
                        // If there are suggestions, select the first one
                        if (searchSuggestions.length > 0) {
                          handleLocationSelect(searchSuggestions[0]);
                          setShowSuggestions(false);
                        } else {
                          handleSearch(searchQuery);
                        }
                        setPendingSearchQuery(searchQuery);
                      }
                    }}
                    onFocus={() => {
                      if (searchSuggestions.length > 0) {
                        setShowSuggestions(true);
                      }
                    }}
                    onBlur={() => {
                      // Delay hiding suggestions to allow clicking
                      setTimeout(() => setShowSuggestions(false), 200);
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
                        setSearchSuggestions([]);
                        setShowSuggestions(false);
                      }}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  )}
                </div>
                
                {/* Search Suggestions Dropdown */}
                {showSuggestions && searchSuggestions.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-lg shadow-lg border border-gray-200 max-h-80 overflow-y-auto z-50">
                    {searchSuggestions.map((suggestion) => (
                      <div
                        key={suggestion.id}
                        className="flex items-center gap-3 p-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                        onClick={() => {
                          if (suggestion.lat === 0 && suggestion.lng === 0) {
                            // It's a category suggestion, search for it
                            handleSearch(suggestion.name);
                          } else {
                            // It's a real place, navigate to it
                            handleLocationSelect(suggestion);
                          }
                          setShowSuggestions(false);
                        }}
                      >
                        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                          <MapPin className="w-4 h-4 text-blue-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900 truncate">{suggestion.name}</p>
                          <p className="text-sm text-gray-600 truncate">{suggestion.address}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
              {/* Voice Search Button */}
              <Button
                size="sm"
                onClick={startVoiceSearch}
                disabled={isVoiceSearching}
                className={`${isVoiceSearching ? 'bg-red-500 hover:bg-red-600' : 'bg-green-600 hover:bg-green-700'} text-white`}
              >
                {isVoiceSearching ? (
                  <div className="flex items-center gap-1">
                    <div className="animate-pulse w-2 h-2 bg-white rounded-full" />
                    <Mic className="w-4 h-4" />
                  </div>
                ) : (
                  <Mic className="w-4 h-4" />
                )}
              </Button>
              
              {/* Search Button */}
              <Button
                size="sm"
                onClick={() => {
                  if (searchQuery.trim()) {
                    if (searchSuggestions.length > 0) {
                      handleLocationSelect(searchSuggestions[0]);
                      setShowSuggestions(false);
                    } else {
                      handleSearch(searchQuery);
                    }
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
            
            <Button
              size="icon"
              className="bg-white text-blue-600 shadow-sm border border-gray-200 hover:bg-blue-50"
              onClick={() => setCurrentScreen('offline')}
              title="Offline Maps"
            >
              <WifiOff className="w-5 h-5" />
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
      
      {/* Offline Map Indicator - Hidden per user request */}
      {/* {currentScreen === 'map' && (
        <div className="absolute top-20 right-4 z-40">
          <OfflineMapIndicator
            currentLocation={navLocation}
            onOpenOfflineMaps={() => setCurrentScreen('offline')}
          />
        </div>
      )} */}

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
