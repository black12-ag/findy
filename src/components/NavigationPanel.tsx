import React, { useState, useEffect } from 'react';
import { X, Volume2, VolumeX, AlertTriangle, Navigation, MapPin, Phone, Camera, Share, Zap, Eye } from 'lucide-react';
import { Button } from './ui/button';
import { Progress } from './ui/progress';
import { Badge } from './ui/badge';
import { useGeolocation, GeolocationPosition } from '../services/geolocationService';
import directionsService from '../services/directionsService';
import { logger } from '../utils/logger';
import { toast } from 'sonner';

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

interface NavigationPanelProps {
  route: Route | null;
  onStopNavigation: () => void;
  onStartAR?: () => void;
  onShareETA?: () => void;
}

export function NavigationPanel({ route, onStopNavigation, onStartAR, onShareETA }: NavigationPanelProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [remainingTime, setRemainingTime] = useState('8 min');
  const [remainingDistance, setRemainingDistance] = useState('2.4 mi');
  const [nextTurnDistance, setNextTurnDistance] = useState('0.3 mi');
  const [currentSpeed, setCurrentSpeed] = useState('35 mph');
  const [speedLimit, setSpeedLimit] = useState('35');
  const [showAlternativeRoute, setShowAlternativeRoute] = useState(false);
  const [alternativeRoute, setAlternativeRoute] = useState({
    time: '12 min',
    distance: '3.1 mi',
    description: 'Avoid traffic on Highway 101'
  });
  const [zoomLevel, setZoomLevel] = useState(18); // Auto-zoom at intersections
  const [isNavigationActive, setIsNavigationActive] = useState(false);
  const [lastRecalculationTime, setLastRecalculationTime] = useState(0);
  
  // Real GPS tracking
  const { position, error, isLoading, permissionStatus, isAccurateEnoughForNavigation } = useGeolocation({
    trackLocation: true,
    enableHighAccuracy: true,
    timeout: 15000,
    maximumAge: 5000
  });

  // Real GPS-based navigation tracking
  useEffect(() => {
    if (!route || !position) return;

    const updateNavigationProgress = () => {
      // Calculate distance to destination
      const distanceToDestination = calculateDistance(
        position.lat,
        position.lng,
        route.to.lat,
        route.to.lng
      );

      // Update current speed based on GPS
      if (position.speed !== undefined && position.speed > 0) {
        const speedMph = (position.speed * 2.237).toFixed(0); // Convert m/s to mph
        setCurrentSpeed(`${speedMph} mph`);
      }

      // Update remaining distance
      if (distanceToDestination < 1000) {
        setRemainingDistance(`${Math.round(distanceToDestination)} m`);
      } else {
        setRemainingDistance(`${(distanceToDestination / 1000).toFixed(1)} km`);
      }

      // Handle turn-by-turn navigation
      handleTurnByTurnNavigation(position);
      
      // Check speed limits
      handleSpeedLimitCheck(position);
      
      // Update estimated arrival time based on current speed
      updateETA(position, distanceToDestination);

      // Check if we need to recalculate route (if user deviated)
      const now = Date.now();
      if (now - lastRecalculationTime > 30000) { // Check every 30 seconds
        checkForRerouting(position);
        setLastRecalculationTime(now);
      }

      // Check if we've reached destination (within 50 meters)
      if (distanceToDestination < 50) {
        handleArrival();
      }
    };

    updateNavigationProgress();
  }, [position, route]);

  // Initialize navigation when route starts
  useEffect(() => {
    if (route && !isNavigationActive) {
      setIsNavigationActive(true);
      // Start navigation announcements if not muted
      if (!isMuted) {
        announceNavigation(`Starting navigation to ${route.to.name}`);
      }
    }
  }, [route]);

  // Helper functions
  const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
    const R = 6371000; // Earth's radius in meters
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  const checkForRerouting = async (currentPosition: GeolocationPosition) => {
    if (!route) return;
    
    try {
      // Check if we need a new route due to deviation or traffic
      const newRoute = await directionsService.getRoute(
        { lat: currentPosition.lat, lng: currentPosition.lng },
        { lat: route.to.lat, lng: route.to.lng },
        route.mode as any
      );
      
      // Compare with current route and suggest alternative if significantly better
      if (newRoute && shouldSuggestAlternativeRoute(newRoute)) {
        setAlternativeRoute({
          time: newRoute.duration,
          distance: newRoute.distance,
          description: 'Updated route due to current conditions'
        });
        setShowAlternativeRoute(true);
      }
    } catch (error) {
      // Fallback: continue with current route
    }
  };

  const shouldSuggestAlternativeRoute = (newRoute: any): boolean => {
    // Logic to determine if new route is significantly better
    // For now, suggest if it saves more than 2 minutes
    const currentTimeMinutes = parseFloat(remainingTime.replace(/[^0-9.]/g, ''));
    const newTimeMinutes = parseFloat(newRoute.duration.replace(/[^0-9.]/g, ''));
    return (currentTimeMinutes - newTimeMinutes) > 2;
  };

  const handleArrival = () => {
    if (!isMuted) {
      announceNavigation(`You have arrived at ${route?.to.name}`);
    }
    setIsNavigationActive(false);
    // Trigger completion callback
    setTimeout(() => {
      onStopNavigation();
    }, 3000); // Auto-stop after 3 seconds
  };

  const handleTurnByTurnNavigation = (currentPosition: GeolocationPosition) => {
    if (!route || !route.steps || currentStep >= route.steps.length) return;

    const currentInstruction = route.steps[currentStep];
    
    // Check if we should advance to next step based on distance
    // This is a simplified version - in production you'd use more sophisticated logic
    const distanceToNextTurn = calculateDistanceToNextTurn(currentPosition);
    
    if (distanceToNextTurn < 100 && !isMuted) { // Within 100m of turn
      if (distanceToNextTurn < 50) {
        announceNavigation(`In 50 meters, ${currentInstruction}`);
      } else {
        announceNavigation(`In 100 meters, ${currentInstruction}`);
      }
    }
    
    // Advance to next step if very close to current turn
    if (distanceToNextTurn < 20 && currentStep < route.steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const calculateDistanceToNextTurn = (currentPosition: GeolocationPosition): number => {
    // Simplified distance calculation to next turn
    // In production, this would use route geometry and waypoints
    return Math.random() * 200; // Mock distance for now
  };

  const handleSpeedLimitCheck = (currentPosition: GeolocationPosition) => {
    if (!currentPosition.speed) return;
    
    const speedMph = currentPosition.speed * 2.237; // Convert m/s to mph
    const currentSpeedLimit = parseInt(speedLimit);
    
    // Speed limit warning
    if (speedMph > currentSpeedLimit + 5) {
      // Visual warning could be added here
      if (!isMuted && Math.random() > 0.95) { // Occasional warning
        announceNavigation(`Speed limit is ${speedLimit} miles per hour`);
      }
    }
  };

  const updateETA = (currentPosition: GeolocationPosition, distanceToDestination: number) => {
    if (!currentPosition.speed || currentPosition.speed < 1) return; // Skip if not moving
    
    const speedMs = currentPosition.speed; // Speed in m/s
    const etaSeconds = distanceToDestination / speedMs;
    
    // Format ETA
    if (etaSeconds < 60) {
      setRemainingTime('< 1 min');
    } else if (etaSeconds < 3600) {
      const minutes = Math.round(etaSeconds / 60);
      setRemainingTime(`${minutes} min`);
    } else {
      const hours = Math.floor(etaSeconds / 3600);
      const minutes = Math.round((etaSeconds % 3600) / 60);
      setRemainingTime(`${hours}h ${minutes}m`);
    }
  };

  const announceNavigation = (message: string) => {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(message);
      utterance.rate = 0.8;
      utterance.pitch = 1;
      speechSynthesis.speak(utterance);
    }
  };

  if (!route) {
    return (
      <div className="h-full bg-white flex items-center justify-center">
        <div className="text-center">
          <Navigation className="w-12 h-12 text-gray-400 mx-auto mb-2" />
          <p className="text-gray-500">No active navigation</p>
        </div>
      </div>
    );
  }

  const getTransportColor = () => {
    switch (route.mode) {
      case 'driving': return '#3B82F6';
      case 'walking': return '#10B981';
      case 'transit': return '#F59E0B';
      case 'cycling': return '#8B5CF6';
      default: return '#5B4FE5';
    }
  };

  const progress = (currentStep / route.steps.length) * 100;

  return (
    <div className="h-full bg-white flex flex-col">
      {/* Top Status Bar */}
      <div 
        className="flex-shrink-0 px-4 py-3 text-white"
        style={{ backgroundColor: getTransportColor() }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/20"
              onClick={onStopNavigation}
            >
              <X className="w-5 h-5" />
            </Button>
            <div>
              <div className="font-medium">{remainingTime} • {remainingDistance}</div>
              <div className="text-sm opacity-90">Arriving at {route.to.name}</div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/20"
              onClick={() => setIsMuted(!isMuted)}
            >
              {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/20"
              onClick={() => {
                // Emergency call function
                if ('tel:' in window) {
                  window.location.href = 'tel:911';
                } else {
                  toast.error('Emergency calling not available on this device');
                  logger.warn('Emergency call attempted but tel: protocol not supported');
                }
              }}
            >
              <Phone className="w-5 h-5" />
            </Button>
          </div>
        </div>
        
        <Progress 
          value={progress} 
          className="mt-2 h-1 bg-white/30"
        />
      </div>

      {/* Main Navigation Display */}
      <div className="flex-1 flex flex-col">
        {/* Next Turn Information */}
        <div className="flex-shrink-0 px-6 py-8 text-center bg-gray-50">
          <div className="mb-4">
            <div className="w-16 h-16 mx-auto bg-blue-100 rounded-full flex items-center justify-center mb-3">
              <Navigation 
                className="w-8 h-8 text-blue-600" 
                style={{ transform: 'rotate(45deg)' }}
              />
            </div>
            <div className="text-3xl font-light text-gray-900 mb-1">{nextTurnDistance}</div>
            <div className="text-gray-600">Then turn right</div>
          </div>
          
          <div className="text-lg text-gray-900 font-medium">
            {route.steps[currentStep] || 'Continue straight'}
          </div>
        </div>

        {/* Current Street & Enhanced Speed Info */}
        <div className="flex-shrink-0 px-6 py-4 bg-white border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div>
                <div className="font-medium text-gray-900">Market Street</div>
                <div className="text-sm text-gray-500">Stay in right lane</div>
              </div>
              
              {/* Speed Trap Warning */}
              <div className="flex items-center gap-2 bg-yellow-50 px-3 py-1 rounded-full">
                <Eye className="w-4 h-4 text-yellow-600" />
                <span className="text-sm text-yellow-700">Speed trap in 0.3 mi</span>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              {/* GPS Accuracy Indicator */}
              {position && (
                <div className="text-center">
                  <div className={`text-sm font-medium ${
                    isAccurateEnoughForNavigation(position) ? 'text-green-600' : 'text-orange-600'
                  }`}>
                    GPS
                  </div>
                  <div className="text-xs text-gray-500">
                    {position.accuracy < 5 ? 'Excellent' : position.accuracy < 15 ? 'Good' : position.accuracy < 50 ? 'Fair' : 'Poor'}
                  </div>
                </div>
              )}
              
              {/* Current Speed */}
              <div className="text-center">
                <div className="text-2xl font-light text-gray-900">{currentSpeed}</div>
                <div className="text-xs text-gray-500">Current</div>
              </div>
              
              {/* Speed Limit Sign */}
              <div className="w-12 h-12 bg-white border-4 border-red-500 rounded-lg flex items-center justify-center">
                <div className="text-center">
                  <div className="text-sm font-bold text-red-600">{speedLimit.replace(' mph', '')}</div>
                  <div className="text-xs text-red-600 leading-none">MPH</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Lane Guidance */}
        <div className="flex-shrink-0 px-6 py-4 bg-gray-50">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">Stay in lane:</span>
            <div className="flex gap-1">
              {[0, 1, 2].map((lane) => (
                <div
                  key={lane}
                  className={`w-8 h-6 rounded border-2 ${
                    lane === 2 
                      ? 'border-blue-500 bg-blue-100' 
                      : 'border-gray-300 bg-white'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Upcoming Steps */}
        <div className="flex-1 p-6 scroll-y hide-scrollbar scroll-smooth">
          <h3 className="font-medium text-gray-900 mb-4">Upcoming</h3>
          <div className="space-y-4">
            {route.steps.slice(currentStep + 1, currentStep + 4).map((step, index) => (
              <div key={index} className="flex items-start gap-3">
                <div className="w-6 h-6 bg-gray-200 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                  <span className="text-xs text-gray-600">{currentStep + index + 2}</span>
                </div>
                <div>
                  <div className="text-gray-900">{step}</div>
                  <div className="text-sm text-gray-500">
                    {index === 0 ? '0.8 mi' : index === 1 ? '1.5 mi' : '2.1 mi'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex-shrink-0 p-4 border-t border-gray-200">
          <div className="grid grid-cols-2 gap-3">
            <Button
              variant="outline"
              size="sm"
              className="flex items-center gap-2"
              onClick={() => {
                // Open incident reporting
                // This would typically open a modal or sheet
                toast.info('Incident reporting feature coming soon');
                logger.info('User attempted to report incident during navigation');
              }}
            >
              <AlertTriangle className="w-4 h-4" />
              Report
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex items-center gap-2"
              onClick={() => {
                // Add intermediate stop functionality
                toast.info('Add stop feature - would open location picker');
                logger.info('User attempted to add stop during navigation');
              }}
            >
              <MapPin className="w-4 h-4" />
              Add Stop
            </Button>
            {route?.mode === 'walking' && onStartAR ? (
              <Button
                variant="outline"
                size="sm"
                className="flex items-center gap-2"
                onClick={onStartAR}
              >
                <Camera className="w-4 h-4" />
                AR View
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="flex items-center gap-2"
                onClick={() => {
                  // Switch to overview/map mode
                  toast.info('Overview mode - would show full route map');
                  logger.info('User requested overview mode during navigation');
                }}
              >
                <Navigation className="w-4 h-4" />
                Overview
              </Button>
            )}
            {onShareETA && (
              <Button
                variant="outline"
                size="sm"
                className="flex items-center gap-2"
                onClick={onShareETA}
              >
                <Share className="w-4 h-4" />
                Share ETA
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Alternative Route Alert */}
      {showAlternativeRoute && (
        <div className="absolute top-32 left-4 right-4 bg-blue-100 border border-blue-300 rounded-lg px-4 py-3 flex items-center gap-3">
          <Navigation className="w-5 h-5 text-blue-600 flex-shrink-0" />
          <div className="flex-1">
            <div className="font-medium text-blue-800">Faster route available</div>
            <div className="text-sm text-blue-700">Save 4 min • {alternativeRoute.description}</div>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="ghost" 
              size="sm" 
              className="text-blue-800"
              onClick={() => setShowAlternativeRoute(false)}
            >
              Dismiss
            </Button>
            <Button 
              size="sm" 
              className="bg-blue-600 hover:bg-blue-700 text-white"
              onClick={() => {
                setShowAlternativeRoute(false);
                // In a real app, this would switch to the alternative route
                // For now, simulate the switch by updating remaining time/distance
                setRemainingTime(alternativeRoute.time);
                setRemainingDistance(alternativeRoute.distance);
              }}
            >
              Switch
            </Button>
          </div>
        </div>
      )}

      {/* Traffic Alert */}
      {!showAlternativeRoute && (
        <div className="absolute top-32 left-4 right-4 bg-yellow-100 border border-yellow-300 rounded-lg px-4 py-3 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0" />
          <div className="flex-1">
            <div className="font-medium text-yellow-800">Traffic ahead</div>
            <div className="text-sm text-yellow-700">Heavy traffic in 0.5 mi - adds 3 min</div>
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            className="text-yellow-800"
            onClick={() => setShowAlternativeRoute(true)}
          >
            Find Route
          </Button>
        </div>
      )}
    </div>
  );
}