import React, { useState } from 'react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Card } from './ui/card';
import { ChevronDown, ChevronUp, Navigation, Clock, MapPin, AlertTriangle, Route, Car, User, Bike, Bus } from 'lucide-react';

interface RouteInfoPanelProps {
  directionsResult: google.maps.DirectionsResult | null;
  transportMode: string;
  onAlternativeSelect?: (routeIndex: number) => void;
  onStartNavigation?: () => void;
  isVisible?: boolean;
  onToggleVisibility?: () => void;
}

export function RouteInfoPanel({ 
  directionsResult, 
  transportMode, 
  onAlternativeSelect,
  onStartNavigation,
  isVisible = true,
  onToggleVisibility 
}: RouteInfoPanelProps) {
  const [expandedRoute, setExpandedRoute] = useState<number | null>(null);
  const [showSteps, setShowSteps] = useState(false);

  if (!directionsResult || !directionsResult.routes.length) {
    return null;
  }

  const getTransportIcon = (mode: string) => {
    switch (mode) {
      case 'walking': return <User className="w-4 h-4" />;
      case 'driving': return <Car className="w-4 h-4" />;
      case 'cycling': return <Bike className="w-4 h-4" />;
      case 'transit': return <Bus className="w-4 h-4" />;
      default: return <Navigation className="w-4 h-4" />;
    }
  };

  const getRouteColor = (mode: string, isSelected: boolean = false) => {
    if (!isSelected) return '#9aa0a6';
    
    switch (mode) {
      case 'walking': return '#34a853';
      case 'driving': return '#1a73e8';
      case 'cycling': return '#ea4335';
      case 'transit': return '#fbbc04';
      default: return '#1a73e8';
    }
  };

  const formatDuration = (duration: google.maps.Duration | undefined) => {
    if (!duration?.text) return 'Unknown';
    return duration.text;
  };

  const formatDistance = (distance: google.maps.Distance | undefined) => {
    if (!distance?.text) return 'Unknown';
    return distance.text;
  };

  const getTrafficDelay = (route: google.maps.DirectionsRoute) => {
    // Calculate traffic delay if duration_in_traffic is available
    const normalDuration = route.legs.reduce((total, leg) => total + (leg.duration?.value || 0), 0);
    const trafficDuration = route.legs.reduce((total, leg) => total + (leg.duration_in_traffic?.value || 0), 0);
    
    if (trafficDuration > normalDuration) {
      const delayMinutes = Math.round((trafficDuration - normalDuration) / 60);
      return delayMinutes > 0 ? `+${delayMinutes} min` : null;
    }
    return null;
  };

  const mainRoute = directionsResult.routes[0];
  const alternativeRoutes = directionsResult.routes.slice(1);

  return (
    <div className={`fixed bottom-4 left-4 right-4 bg-white rounded-xl shadow-lg border transition-all duration-300 z-50 ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'}`}>
      <div className="p-4">
        {/* Main Route Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-full" style={{ backgroundColor: getRouteColor(transportMode, true) + '20' }}>
              {getTransportIcon(transportMode)}
            </div>
            <div>
              <h3 className="font-semibold text-lg">Best Route</h3>
              <div className="flex items-center space-x-4 text-sm text-gray-600">
                <span className="flex items-center space-x-1">
                  <Clock className="w-4 h-4" />
                  <span>{formatDuration(mainRoute.legs[0]?.duration)}</span>
                  {getTrafficDelay(mainRoute) && (
                    <Badge variant="destructive" className="text-xs ml-1">
                      {getTrafficDelay(mainRoute)}
                    </Badge>
                  )}
                </span>
                <span className="flex items-center space-x-1">
                  <Route className="w-4 h-4" />
                  <span>{formatDistance(mainRoute.legs[0]?.distance)}</span>
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowSteps(!showSteps)}
            >
              {showSteps ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              Steps
            </Button>
            {onStartNavigation && (
              <Button 
                onClick={onStartNavigation}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                <Navigation className="w-4 h-4 mr-1" />
                Start
              </Button>
            )}
          </div>
        </div>

        {/* Step-by-step directions */}
        {showSteps && (
          <div className="mb-4 border-t pt-4">
            <h4 className="font-medium text-sm text-gray-700 mb-2">Directions:</h4>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {mainRoute.legs[0]?.steps?.map((step, index) => (
                <div key={index} className="flex items-start space-x-3 text-sm">
                  <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-xs font-medium text-blue-600 flex-shrink-0 mt-0.5">
                    {index + 1}
                  </div>
                  <div className="flex-1">
                    <div 
                      className="text-gray-800"
                      dangerouslySetInnerHTML={{ __html: step.instructions }}
                    />
                    <div className="text-xs text-gray-500 mt-1">
                      {step.distance?.text} • {step.duration?.text}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Alternative Routes */}
        {alternativeRoutes.length > 0 && (
          <div className="border-t pt-4">
            <h4 className="font-medium text-sm text-gray-700 mb-3">Alternative Routes:</h4>
            <div className="space-y-2">
              {alternativeRoutes.map((route, index) => {
                const routeIndex = index + 1;
                const isExpanded = expandedRoute === routeIndex;
                const trafficDelay = getTrafficDelay(route);
                
                return (
                  <Card 
                    key={routeIndex} 
                    className="p-3 cursor-pointer hover:bg-gray-50 border-l-4"
                    style={{ borderLeftColor: '#9aa0a6' }}
                    onClick={() => {
                      onAlternativeSelect?.(routeIndex);
                      setExpandedRoute(isExpanded ? null : routeIndex);
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded">
                          Alt {routeIndex}
                        </div>
                        <div className="flex items-center space-x-3 text-sm">
                          <span className="flex items-center space-x-1">
                            <Clock className="w-3 h-3" />
                            <span>{formatDuration(route.legs[0]?.duration)}</span>
                            {trafficDelay && (
                              <Badge variant="outline" className="text-xs">
                                {trafficDelay}
                              </Badge>
                            )}
                          </span>
                          <span className="flex items-center space-x-1">
                            <Route className="w-3 h-3" />
                            <span>{formatDistance(route.legs[0]?.distance)}</span>
                          </span>
                        </div>
                      </div>
                      <ChevronDown 
                        className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                      />
                    </div>
                    
                    {/* Route summary when expanded */}
                    {isExpanded && (
                      <div className="mt-3 pt-3 border-t border-gray-100 text-xs text-gray-600">
                        <p>Via: {route.summary || 'Alternative route'}</p>
                        {route.warnings && route.warnings.length > 0 && (
                          <div className="mt-2 flex items-start space-x-1 text-amber-600">
                            <AlertTriangle className="w-3 h-3 mt-0.5" />
                            <span>{route.warnings[0]}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div className="flex justify-between items-center mt-4 pt-4 border-t">
          <div className="text-xs text-gray-500">
            Tap routes to compare • Powered by Google Maps
          </div>
          {onToggleVisibility && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onToggleVisibility}
              className="text-gray-500"
            >
              {isVisible ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}