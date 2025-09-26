import React, { useState } from 'react';
import { 
  ArrowLeft, 
  Bus, 
  Train, 
  Clock, 
  MapPin, 
  Navigation, 
  AlertCircle,
  Star,
  Accessibility,
  CreditCard,
  Route,
  ChevronRight,
  Wifi,
  WifiOff
} from 'lucide-react';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';

interface Location {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  category?: string;
}

interface TransitRoute {
  id: string;
  from: Location;
  to: Location;
  duration: string;
  walkingTime: string;
  totalTime: string;
  fare: string;
  steps: TransitStep[];
  accessibility: string[];
  alerts?: string[];
}

interface TransitStep {
  id: string;
  type: 'walk' | 'bus' | 'train' | 'subway';
  line?: string;
  duration: string;
  departure?: string;
  arrival?: string;
  platform?: string;
  direction?: string;
  stops?: number;
  realTimeDelay?: string;
}

interface PublicTransitPanelProps {
  from: Location | null;
  to: Location | null;
  onBack: () => void;
  onStartNavigation: (route: TransitRoute) => void;
}

export function PublicTransitPanel({ from, to, onBack, onStartNavigation }: PublicTransitPanelProps) {
  const [selectedRoute, setSelectedRoute] = useState(0);
  const [activeTab, setActiveTab] = useState('routes');
  const [offlineMode, setOfflineMode] = useState(false);
  
  // Mock service alerts
  const serviceAlerts = [
    { 
      id: '1', 
      line: 'Red Line', 
      type: 'delay', 
      message: 'Delays of up to 10 minutes due to signal problems', 
      severity: 'moderate' 
    },
    { 
      id: '2', 
      line: '38 Geary', 
      type: 'detour', 
      message: 'Route detour on Geary St between 4th-8th St due to construction', 
      severity: 'minor' 
    },
    { 
      id: '3', 
      line: 'All Lines', 
      type: 'service', 
      message: 'Weekend service schedule in effect', 
      severity: 'info' 
    }
  ];
  
  // Mock fare information
  const fareInfo = {
    adult: '$3.25',
    senior: '$1.60',
    youth: '$2.40',
    disabled: '$1.60',
    monthly: '$89.00',
    weekly: '$25.00'
  };

  // Mock transit routes
  const transitRoutes: TransitRoute[] = [
    {
      id: '1',
      from: from!,
      to: to!,
      duration: '32 min',
      walkingTime: '8 min',
      totalTime: '40 min',
      fare: '$3.25',
      accessibility: ['wheelchair', 'elevator'],
      alerts: ['Bus 38 experiencing 5 min delays'],
      steps: [
        {
          id: '1',
          type: 'walk',
          duration: '4 min',
        },
        {
          id: '2',
          type: 'bus',
          line: '38 Geary',
          duration: '18 min',
          departure: '2:15 PM',
          arrival: '2:33 PM',
          platform: 'Stop A',
          direction: 'Outbound',
          stops: 12,
          realTimeDelay: '+2 min'
        },
        {
          id: '3',
          type: 'walk',
          duration: '2 min',
        },
        {
          id: '4',
          type: 'subway',
          line: 'Red Line',
          duration: '8 min',
          departure: '2:35 PM',
          arrival: '2:43 PM',
          platform: 'Platform 2',
          direction: 'Downtown',
          stops: 4,
        },
        {
          id: '5',
          type: 'walk',
          duration: '2 min',
        }
      ]
    },
    {
      id: '2',
      from: from!,
      to: to!,
      duration: '28 min',
      walkingTime: '12 min',
      totalTime: '40 min',
      fare: '$2.75',
      accessibility: ['wheelchair'],
      steps: [
        {
          id: '1',
          type: 'walk',
          duration: '6 min',
        },
        {
          id: '2',
          type: 'train',
          line: 'Express 101',
          duration: '22 min',
          departure: '2:18 PM',
          arrival: '2:40 PM',
          platform: 'Track 3',
          direction: 'North',
          stops: 8,
        },
        {
          id: '3',
          type: 'walk',
          duration: '6 min',
        }
      ]
    }
  ];

  // Mock nearby transit lines
  const nearbyLines = [
    { id: '1', name: '38 Geary', type: 'bus', nextArrival: '3 min', delay: '+2 min', color: '#FF6B35' },
    { id: '2', name: 'Red Line', type: 'subway', nextArrival: '7 min', delay: 'On time', color: '#DC2626' },
    { id: '3', name: '101 Express', type: 'train', nextArrival: '12 min', delay: 'On time', color: '#059669' },
    { id: '4', name: '14 Mission', type: 'bus', nextArrival: '15 min', delay: '+1 min', color: '#7C3AED' },
  ];

  const getStepIcon = (type: string) => {
    switch (type) {
      case 'bus': return <Bus className="w-5 h-5" />;
      case 'train': return <Train className="w-5 h-5" />;
      case 'subway': return <Train className="w-5 h-5" />;
      case 'walk': return <Navigation className="w-5 h-5" />;
      default: return <MapPin className="w-5 h-5" />;
    }
  };

  const getStepColor = (type: string) => {
    switch (type) {
      case 'bus': return '#F59E0B';
      case 'train': return '#059669';
      case 'subway': return '#DC2626';
      case 'walk': return '#6B7280';
      default: return '#6B7280';
    }
  };

  if (!from || !to) {
    return (
      <div className="h-full bg-white flex items-center justify-center">
        <div className="text-center">
          <Bus className="w-12 h-12 text-gray-400 mx-auto mb-2" />
          <p className="text-gray-500">Select a destination for transit directions</p>
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
            <h2 className="font-medium text-gray-900">Public Transit</h2>
            <p className="text-sm text-gray-500">{from.name} → {to.name}</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <div className="flex-shrink-0 px-4 py-2">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="routes">Routes</TabsTrigger>
            <TabsTrigger value="nearby">Live</TabsTrigger>
            <TabsTrigger value="alerts">Alerts</TabsTrigger>
            <TabsTrigger value="fares">Fares</TabsTrigger>
          </TabsList>
        </div>

        <div className="flex-1 overflow-hidden min-h-0">
          {/* Routes Tab */}
          <TabsContent value="routes" className="h-full flex flex-col mt-0">
            <div className="flex-1 p-4 space-y-3 scroll-y hide-scrollbar scroll-smooth">
              {transitRoutes.map((route, index) => (
                <Card 
                  key={route.id}
                  className={`p-4 cursor-pointer transition-all ${
                    selectedRoute === index 
                      ? 'ring-2 ring-amber-500 border-transparent bg-amber-50' 
                      : 'hover:shadow-md'
                  }`}
                  onClick={() => setSelectedRoute(index)}
                >
                  {/* Route Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="font-medium text-gray-900">{route.totalTime}</h3>
                        <Badge variant="secondary" className="text-green-700 bg-green-100">
                          {route.fare}
                        </Badge>
                        {route.accessibility.includes('wheelchair') && (
                          <Accessibility className="w-4 h-4 text-blue-600" />
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-gray-600">
                        <div className="flex items-center gap-1">
                          <Bus className="w-4 h-4" />
                          <span>{route.duration}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Navigation className="w-4 h-4" />
                          <span>{route.walkingTime} walking</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Service Alerts */}
                  {route.alerts && route.alerts.length > 0 && (
                    <div className="mb-4">
                      {route.alerts.map((alert, alertIndex) => (
                        <div key={alertIndex} className="flex items-start gap-2 p-2 bg-yellow-50 border border-yellow-200 rounded-lg">
                          <AlertCircle className="w-4 h-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                          <span className="text-sm text-yellow-800">{alert}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Route Steps */}
                  <div className="space-y-3">
                    {route.steps.map((step, stepIndex) => (
                      <div key={step.id} className="flex items-center gap-3">
                        <div 
                          className="w-8 h-8 rounded-full flex items-center justify-center text-white flex-shrink-0"
                          style={{ backgroundColor: getStepColor(step.type) }}
                        >
                          {getStepIcon(step.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          {step.type === 'walk' ? (
                            <div className="text-sm text-gray-900">
                              Walk {step.duration}
                            </div>
                          ) : (
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-gray-900">{step.line}</span>
                                {step.realTimeDelay && (
                                  <Badge variant="outline" className="text-red-600 border-red-200">
                                    {step.realTimeDelay}
                                  </Badge>
                                )}
                              </div>
                              <div className="text-sm text-gray-600">
                                {step.departure} - {step.arrival} • {step.platform} • {step.stops} stops
                              </div>
                            </div>
                          )}
                        </div>
                        <div className="text-sm text-gray-500">{step.duration}</div>
                      </div>
                    ))}
                  </div>
                </Card>
              ))}
            </div>

            {/* Bottom Actions */}
            <div className="flex-shrink-0 p-4 border-t border-gray-200">
              <Button
                className="w-full"
                style={{ backgroundColor: '#F59E0B' }}
                onClick={() => onStartNavigation(transitRoutes[selectedRoute])}
              >
                <Bus className="w-4 h-4 mr-2" />
                Start Transit Navigation
              </Button>
            </div>
          </TabsContent>

          {/* Nearby Lines Tab */}
          <TabsContent value="nearby" className="h-full p-4 scroll-y hide-scrollbar scroll-smooth mt-0">
            <div className="space-y-3">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-medium text-gray-900">Live Arrivals</h3>
                <Button variant="ghost" size="sm">
                  <Star className="w-4 h-4 mr-2" />
                  Favorites
                </Button>
              </div>

              {nearbyLines.map((line) => (
                <Card key={line.id} className="p-4 hover:shadow-md transition-shadow cursor-pointer">
                  <div className="flex items-center gap-4">
                    <div 
                      className="w-12 h-12 rounded-full flex items-center justify-center text-white"
                      style={{ backgroundColor: line.color }}
                    >
                      {line.type === 'bus' ? <Bus className="w-6 h-6" /> : <Train className="w-6 h-6" />}
                    </div>
                    
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-medium text-gray-900">{line.name}</h4>
                        <Badge variant="outline" className="capitalize">
                          {line.type}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 text-sm text-gray-600">
                        <div className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          <span>Next: {line.nextArrival}</span>
                        </div>
                        <span className={line.delay === 'On time' ? 'text-green-600' : 'text-red-600'}>
                          {line.delay}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-2">
                      <Button variant="ghost" size="sm">
                        <Star className="w-4 h-4" />
                      </Button>
                      <div className="flex items-center gap-1 text-sm text-gray-500">
                        {Math.random() > 0.5 ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
                      </div>
                    </div>
                  </div>

                  {/* Additional Info */}
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1">
                          <CreditCard className="w-4 h-4 text-gray-400" />
                          <span className="text-gray-600">$2.75</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Accessibility className="w-4 h-4 text-blue-600" />
                          <span className="text-gray-600">Accessible</span>
                        </div>
                      </div>
                      <Button variant="ghost" size="sm">
                        <Route className="w-4 h-4 mr-2" />
                        View Route
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}

              {/* Service Alerts */}
              <Card className="p-4 bg-yellow-50 border-yellow-200">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <h4 className="font-medium text-yellow-900 mb-1">Service Alert</h4>
                    <p className="text-sm text-yellow-800 mb-2">
                      Weekend service changes on Red Line. Check schedule for updates.
                    </p>
                    <Button variant="ghost" size="sm" className="text-yellow-700 hover:text-yellow-900 p-0">
                      Learn more
                      <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  </div>
                </div>
              </Card>
            </div>
          </TabsContent>

          {/* Alerts Tab */}
          <TabsContent value="alerts" className="h-full p-4 scroll-y hide-scrollbar scroll-smooth mt-0">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-medium text-gray-900">Service Alerts</h3>
                <Button variant="ghost" size="sm" onClick={() => setOfflineMode(!offlineMode)}>
                  {offlineMode ? <WifiOff className="w-4 h-4 mr-2" /> : <Wifi className="w-4 h-4 mr-2" />}
                  {offlineMode ? 'Offline' : 'Live'}
                </Button>
              </div>

              {serviceAlerts.map((alert) => {
                const getSeverityColor = (severity: string) => {
                  switch (severity) {
                    case 'moderate': return 'bg-yellow-50 border-yellow-200 text-yellow-800';
                    case 'minor': return 'bg-blue-50 border-blue-200 text-blue-800';
                    case 'info': return 'bg-gray-50 border-gray-200 text-gray-800';
                    default: return 'bg-red-50 border-red-200 text-red-800';
                  }
                };

                return (
                  <Card key={alert.id} className={`p-4 ${getSeverityColor(alert.severity)}`}>
                    <div className="flex items-start gap-3">
                      <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-medium">{alert.line}</h4>
                          <Badge variant="outline" className="capitalize text-xs">
                            {alert.type}
                          </Badge>
                        </div>
                        <p className="text-sm mb-3">{alert.message}</p>
                        <div className="flex gap-2">
                          <Button variant="ghost" size="sm" className="text-xs p-0">
                            View Details
                          </Button>
                          <Button variant="ghost" size="sm" className="text-xs p-0">
                            Get Updates
                          </Button>
                        </div>
                      </div>
                    </div>
                  </Card>
                );
              })}

              {/* Offline Schedules Info */}
              {offlineMode && (
                <Card className="p-4 bg-blue-50 border-blue-200">
                  <div className="flex items-start gap-3">
                    <WifiOff className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <h4 className="font-medium text-blue-900 mb-1">Offline Mode</h4>
                      <p className="text-sm text-blue-800 mb-2">
                        Using cached schedules. Last updated 2 hours ago.
                      </p>
                      <Button variant="ghost" size="sm" className="text-blue-700 p-0">
                        Update when online
                      </Button>
                    </div>
                  </div>
                </Card>
              )}
            </div>
          </TabsContent>

          {/* Fares Tab */}
          <TabsContent value="fares" className="h-full p-4 scroll-y hide-scrollbar scroll-smooth mt-0">
            <div className="space-y-4">
              <h3 className="font-medium text-gray-900">Fare Information</h3>
              
              {/* Single Trip Fares */}
              <Card className="p-4">
                <h4 className="font-medium text-gray-900 mb-3">Single Trip</h4>
                <div className="space-y-2">
                  {Object.entries(fareInfo).filter(([key]) => !['monthly', 'weekly'].includes(key)).map(([type, price]) => (
                    <div key={type} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                      <div className="flex items-center gap-2">
                        <span className="capitalize text-gray-700">{type}</span>
                        {type === 'disabled' && <Accessibility className="w-4 h-4 text-blue-600" />}
                      </div>
                      <span className="font-medium text-gray-900">{price}</span>
                    </div>
                  ))}
                </div>
              </Card>

              {/* Passes */}
              <Card className="p-4">
                <h4 className="font-medium text-gray-900 mb-3">Passes & Discounts</h4>
                <div className="space-y-2">
                  <div className="flex items-center justify-between py-2 border-b border-gray-100">
                    <div>
                      <span className="text-gray-700">Weekly Pass</span>
                      <div className="text-xs text-green-600">Save 20%</div>
                    </div>
                    <span className="font-medium text-gray-900">{fareInfo.weekly}</span>
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <div>
                      <span className="text-gray-700">Monthly Pass</span>
                      <div className="text-xs text-green-600">Save 35%</div>
                    </div>
                    <span className="font-medium text-gray-900">{fareInfo.monthly}</span>
                  </div>
                </div>
              </Card>

              {/* Payment Methods */}
              <Card className="p-4">
                <h4 className="font-medium text-gray-900 mb-3">Payment Methods</h4>
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <CreditCard className="w-5 h-5 text-gray-600" />
                    <div>
                      <div className="font-medium text-gray-900">Transit Card</div>
                      <div className="text-sm text-gray-600">Tap to pay on all vehicles</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <MapPin className="w-5 h-5 text-gray-600" />
                    <div>
                      <div className="font-medium text-gray-900">Mobile Wallet</div>
                      <div className="text-sm text-gray-600">Apple Pay, Google Pay, Samsung Pay</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <CreditCard className="w-5 h-5 text-gray-600" />
                    <div>
                      <div className="font-medium text-gray-900">Exact Change</div>
                      <div className="text-sm text-gray-600">Cash accepted on buses only</div>
                    </div>
                  </div>
                </div>
              </Card>
            </div>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}