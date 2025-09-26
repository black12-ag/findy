import React, { useState } from 'react';
import { ArrowLeft, Navigation, Clock, MapPin, Route, Fuel, AlertTriangle, Star } from 'lucide-react';
import { Button } from './ui/button';
import { Card } from './ui/card';

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

interface RoutePanelProps {
  from: Location | null;
  to: Location | null;
  transportMode: string;
  onStartNavigation: (route: Route) => void;
  onBack: () => void;
}

export function RoutePanel({ from, to, transportMode, onStartNavigation, onBack }: RoutePanelProps) {
  const [selectedRoute, setSelectedRoute] = useState(0);

  // Mock route options
  const routeOptions = [
    {
      id: '1',
      from: from!,
      to: to!,
      distance: '2.4 mi',
      duration: '8 min',
      mode: transportMode,
      type: 'Fastest',
      traffic: 'Light traffic',
      tolls: false,
      co2: '1.2 kg',
      steps: [
        'Head north on Main St',
        'Turn right on 1st Ave',
        'Continue straight for 1.2 mi',
        'Turn left on Market St',
        'Arrive at destination'
      ]
    },
    {
      id: '2',
      from: from!,
      to: to!,
      distance: '2.1 mi',
      duration: '12 min',
      mode: transportMode,
      type: 'Avoid highways',
      traffic: 'Moderate traffic',
      tolls: false,
      co2: '1.0 kg',
      steps: [
        'Head east on Main St',
        'Turn right on 2nd Ave',
        'Continue on local roads',
        'Turn right on Market St',
        'Arrive at destination'
      ]
    },
    {
      id: '3',
      from: from!,
      to: to!,
      distance: '3.2 mi',
      duration: '15 min',
      mode: transportMode,
      type: 'Scenic route',
      traffic: 'Light traffic',
      tolls: false,
      co2: '1.5 kg',
      steps: [
        'Head south on Main St',
        'Take scenic route through park',
        'Continue on Scenic Dr',
        'Turn left on Market St',
        'Arrive at destination'
      ]
    }
  ];

  const getTransportColor = () => {
    switch (transportMode) {
      case 'driving': return '#3B82F6';
      case 'walking': return '#10B981';
      case 'transit': return '#F59E0B';
      case 'cycling': return '#8B5CF6';
      default: return '#5B4FE5';
    }
  };

  const getTransportMode = () => {
    switch (transportMode) {
      case 'driving': return 'driving';
      case 'walking': return 'walking';
      case 'transit': return 'transit';
      case 'cycling': return 'cycling';
      default: return 'driving';
    }
  };

  if (!from || !to) {
    return (
      <div className="h-full bg-white flex items-center justify-center">
        <div className="text-center">
          <MapPin className="w-12 h-12 text-gray-400 mx-auto mb-2" />
          <p className="text-gray-500">Select a destination to see routes</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-white flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 px-4 py-4 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={onBack}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h2 className="font-medium text-gray-900">Route Options</h2>
            <p className="text-sm text-gray-500">{from.name} → {to.name}</p>
          </div>
        </div>
      </div>

      {/* Route Options */}
      <div className="flex-1 p-4 space-y-3 scroll-y hide-scrollbar scroll-smooth">
        {routeOptions.map((route, index) => (
          <Card 
            key={route.id}
            className={`p-4 cursor-pointer transition-all ${
              selectedRoute === index 
                ? 'ring-2 border-transparent' 
                : 'hover:shadow-md'
            }`}
            style={selectedRoute === index ? { 
              backgroundColor: `${getTransportColor()}08`
            } : undefined}
            onClick={() => setSelectedRoute(index)}
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-medium text-gray-900">{route.type}</h3>
                  {route.type === 'Fastest' && (
                    <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full">
                      Recommended
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-4 text-sm text-gray-600">
                  <div className="flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    <span>{route.duration}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Route className="w-4 h-4" />
                    <span>{route.distance}</span>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-lg font-medium text-gray-900">{route.duration}</div>
                <div className="text-sm text-gray-500">{route.distance}</div>
              </div>
            </div>

            <div className="flex items-center gap-4 text-xs text-gray-500 mb-3">
              <span>{route.traffic}</span>
              {!route.tolls && <span>No tolls</span>}
              <div className="flex items-center gap-1">
                <Fuel className="w-3 h-3" />
                <span>{route.co2} CO₂</span>
              </div>
            </div>

            {/* Route Preview */}
            <div className="space-y-1">
              {route.steps.slice(0, 3).map((step, stepIndex) => (
                <div key={stepIndex} className="text-xs text-gray-600 flex items-center gap-2">
                  <div 
                    className="w-2 h-2 rounded-full flex-shrink-0" 
                    style={{ backgroundColor: getTransportColor() }}
                  />
                  <span>{step}</span>
                </div>
              ))}
              {route.steps.length > 3 && (
                <div className="text-xs text-gray-400 ml-4">
                  +{route.steps.length - 3} more steps
                </div>
              )}
            </div>
          </Card>
        ))}
      </div>

      {/* Bottom Actions */}
      <div className="flex-shrink-0 p-4 border-t border-gray-200">
        <Button
          className="w-full"
          style={{ backgroundColor: getTransportColor() }}
          onClick={() => onStartNavigation(routeOptions[selectedRoute])}
        >
          <Navigation className="w-4 h-4 mr-2" />
          Start Navigation
        </Button>
        
        <div className="flex items-center justify-center gap-4 mt-3 text-sm text-gray-500">
          <button className="flex items-center gap-1 hover:text-gray-700">
            <Star className="w-4 h-4" />
            Save Route
          </button>
          <button className="flex items-center gap-1 hover:text-gray-700">
            <Navigation className="w-4 h-4" />
            Share
          </button>
          <button className="flex items-center gap-1 hover:text-gray-700">
            <AlertTriangle className="w-4 h-4" />
            Report Issue
          </button>
        </div>
      </div>
    </div>
  );
}