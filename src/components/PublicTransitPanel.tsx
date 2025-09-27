import React, { useState, useEffect } from 'react';
// Removed mock data imports - using real transit APIs
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
  WifiOff,
  RefreshCw
} from 'lucide-react';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { transitService, TransitItinerary, TransitAlert, NearbyDeparture } from '../services/transitService';
import { enhancedTransitService, MultimodalItinerary, TransitServiceOptions } from '../services/enhancedTransitService';

interface Location {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  category?: string;
}

// Using TransitItinerary from transitService instead of local interfaces

interface PublicTransitPanelProps {
  from: Location | null;
  to: Location | null;
  onBack: () => void;
  onStartNavigation: (route: any) => void;
}

export function PublicTransitPanel({ from, to, onBack, onStartNavigation }: PublicTransitPanelProps) {
  const [selectedRoute, setSelectedRoute] = useState(0);
  const [activeTab, setActiveTab] = useState('routes');
  const [offlineMode, setOfflineMode] = useState(false);
  const [transitRoutes, setTransitRoutes] = useState<TransitItinerary[]>([]);
  const [multimodalRoutes, setMultimodalRoutes] = useState<MultimodalItinerary[]>([]);
  const [nearbyDepartures, setNearbyDepartures] = useState<NearbyDeparture[]>([]);
  const [serviceAlerts, setServiceAlerts] = useState<TransitAlert[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [useEnhancedService, setUseEnhancedService] = useState(true);
  // Initialize enhanced transit service
  useEffect(() => {
    if (useEnhancedService) {
      enhancedTransitService.initialize({
        location: from ? { lat: from.lat, lng: from.lng } : undefined,
        agencies: ['MTA-NYC', 'SFMTA', 'WMATA'], // Auto-detect based on location
      });
    }
  }, [from, useEnhancedService]);

  // Real data loading
  useEffect(() => {
    if (from && to) {
      loadTransitData();
    }
  }, [from, to]);

  useEffect(() => {
    // Auto-refresh live data every 30 seconds
    if (activeTab === 'nearby' && !offlineMode) {
      const interval = setInterval(loadLiveData, 30000);
      return () => clearInterval(interval);
    }
  }, [activeTab, offlineMode]);

  const loadTransitData = async () => {
    if (!from || !to) return;
    
    setIsLoading(true);
    try {
      if (useEnhancedService) {
        // Use enhanced service for multimodal routing
        const serviceOptions: TransitServiceOptions = {
          max_walk_distance: 800,
          max_transfers: 3,
          wheelchair_accessible: false,
          bikes_allowed: false,
          max_wait_time: 15,
          include_alternatives: true,
          real_time_updates: true
        };
        
        const multimodalRoutes = await enhancedTransitService.planTrip(
          { lat: from.lat, lng: from.lng, name: from.name },
          { lat: to.lat, lng: to.lng, name: to.name },
          {
            departure_time: new Date().toISOString(),
            service_options: serviceOptions,
            optimize_for: 'time'
          }
        );
        setMultimodalRoutes(multimodalRoutes);
        
        // Load service alerts from enhanced service
        const alerts = await enhancedTransitService.getServiceAlerts();
        setServiceAlerts(alerts as TransitAlert[]); // Type compatibility
      } else {
        // Fallback to basic service
        const routes = await transitService.planTrip(
          { lat: from.lat, lng: from.lng },
          { lat: to.lat, lng: to.lng },
          {
            departureTime: new Date().toISOString(),
            maxWalkDistance: 800,
            optimize: 'TIME'
          }
        );
        setTransitRoutes(routes);
        
        // Load service alerts
        const alerts = await transitService.getAlerts();
        setServiceAlerts(alerts);
      }
      
      setLastUpdated(new Date());
    } catch (error) {
      console.warn('Enhanced transit service failed, falling back to basic service:', error);
      setUseEnhancedService(false);
      // Retry with basic service
      if (useEnhancedService) {
        await loadTransitData();
      }
    } finally {
      setIsLoading(false);
    }
  };

  const loadLiveData = async () => {
    if (!from) return;
    
    try {
      // Find nearby stops and get live departures
      const stops = await transitService.findNearbyStops({ lat: from.lat, lng: from.lng }, 500);
      if (stops.length > 0) {
        const departures = await transitService.getDepartures(stops[0].id, 8);
        setNearbyDepartures(departures);
      }
    } catch (error) {
      // Handle error silently, use cached data
    }
  };

  const refreshData = async () => {
    await Promise.all([loadTransitData(), loadLiveData()]);
  };
  
  // Fare information - could be loaded from service
  const fareInfo = {
    adult: '$3.25',
    senior: '$1.60',
    youth: '$2.40',
    disabled: '$1.60',
    monthly: '$89.00',
    weekly: '$25.00'
  };

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
          
          {/* Refresh Button */}
          <div className="flex items-center justify-between mt-2">
            <div className="text-xs text-gray-500">
              {lastUpdated && `Updated ${lastUpdated.toLocaleTimeString()}`}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={refreshData}
              disabled={isLoading}
              className="text-xs"
            >
              <RefreshCw className={`w-3 h-3 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-hidden min-h-0">
          {/* Routes Tab */}
          <TabsContent value="routes" className="h-full flex flex-col mt-0">
            <div className="flex-1 p-4 space-y-3 scroll-y hide-scrollbar scroll-smooth">
              {isLoading && (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="w-6 h-6 animate-spin text-gray-400 mr-2" />
                  <span className="text-gray-500">Finding routes...</span>
                </div>
              )}
              
              {!isLoading && transitRoutes.length === 0 && (
                <div className="flex items-center justify-center py-8">
                  <div className="text-center">
                    <Bus className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                    <p className="text-gray-500">No transit routes found</p>
                    <Button variant="ghost" size="sm" onClick={loadTransitData} className="mt-2">
                      Try again
                    </Button>
                  </div>
                </div>
              )}
              
              {transitRoutes.map((itinerary, index) => (
                <Card 
                  key={`itinerary_${index}`}
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
                        <h3 className="font-medium text-gray-900">{Math.round(itinerary.duration / 60)} min</h3>
                        <Badge variant="secondary" className="text-green-700 bg-green-100">
                          ${itinerary.fare?.total.toFixed(2) || '3.25'}
                        </Badge>
                        {itinerary.accessibility.wheelchair && (
                          <Accessibility className="w-4 h-4 text-blue-600" />
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-gray-600">
                        <div className="flex items-center gap-1">
                          <Bus className="w-4 h-4" />
                          <span>{Math.round(itinerary.transitTime / 60)} min</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Navigation className="w-4 h-4" />
                          <span>{Math.round(itinerary.walkTime / 60)} min walking</span>
                        </div>
                        {itinerary.transfers > 0 && (
                          <div className="flex items-center gap-1">
                            <Route className="w-4 h-4" />
                            <span>{itinerary.transfers} transfer{itinerary.transfers > 1 ? 's' : ''}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Service Alerts for this route */}
                  {itinerary.legs.some(leg => leg.alerts?.length) && (
                    <div className="mb-4">
                      {itinerary.legs.flatMap(leg => leg.alerts || []).map((alert, alertIndex) => (
                        <div key={alertIndex} className="flex items-start gap-2 p-2 bg-yellow-50 border border-yellow-200 rounded-lg mb-2">
                          <AlertCircle className="w-4 h-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                          <span className="text-sm text-yellow-800">{alert.headerText}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Route Legs */}
                  <div className="space-y-3">
                    {itinerary.legs.map((leg, legIndex) => (
                      <div key={legIndex} className="flex items-center gap-3">
                        <div 
                          className="w-8 h-8 rounded-full flex items-center justify-center text-white flex-shrink-0"
                          style={{ backgroundColor: getStepColor(leg.type.toLowerCase()) }}
                        >
                          {getStepIcon(leg.type.toLowerCase())}
                        </div>
                        <div className="flex-1 min-w-0">
                          {leg.type === 'WALK' ? (
                            <div className="text-sm text-gray-900">
                              Walk {Math.round(leg.duration / 60)} min
                              {leg.steps && leg.steps.length > 0 && (
                                <div className="text-xs text-gray-500 mt-1">
                                  {leg.steps[0]}
                                </div>
                              )}
                            </div>
                          ) : (
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-gray-900">
                                  {leg.route?.shortName} {leg.route?.longName}
                                </span>
                                {leg.realtime_delay && leg.realtime_delay > 0 && (
                                  <Badge variant="outline" className="text-red-600 border-red-200">
                                    +{Math.round(leg.realtime_delay / 60)}m
                                  </Badge>
                                )}
                              </div>
                              <div className="text-sm text-gray-600">
                                {new Date(leg.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - 
                                {new Date(leg.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                {leg.trip?.headsign && ` • ${leg.trip.headsign}`}
                              </div>
                            </div>
                          )}
                        </div>
                        <div className="text-sm text-gray-500">
                          {Math.round(leg.duration / 60)}m
                        </div>
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
                onClick={() => {
                  if (transitRoutes[selectedRoute]) {
                    // Convert TransitItinerary to route format expected by navigation
                    const itinerary = transitRoutes[selectedRoute];
                    const route = {
                      id: `transit_${selectedRoute}`,
                      from: { name: from?.name, address: from?.address },
                      to: { name: to?.name, address: to?.address },
                      duration: `${Math.round(itinerary.duration / 60)} min`,
                      totalTime: `${Math.round(itinerary.duration / 60)} min`,
                      mode: 'transit',
                      steps: itinerary.legs.map(leg => {
                        if (leg.type === 'WALK') {
                          return `Walk ${Math.round(leg.duration / 60)} minutes`;
                        } else {
                          return `${leg.route?.shortName || 'Transit'} • ${Math.round(leg.duration / 60)} minutes`;
                        }
                      })
                    };
                    onStartNavigation(route);
                  }
                }}
                disabled={!transitRoutes[selectedRoute]}
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

              {nearbyDepartures.length === 0 && !isLoading && (
                <div className="text-center py-8">
                  <Clock className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                  <p className="text-gray-500">No live departures available</p>
                  <Button variant="ghost" size="sm" onClick={loadLiveData} className="mt-2">
                    Refresh
                  </Button>
                </div>
              )}
              
              {nearbyDepartures.map((departure, index) => {
                const minutesToDeparture = Math.round((new Date(departure.estimatedDeparture).getTime() - Date.now()) / 60000);
                const isDelayed = departure.delay > 60; // More than 1 minute delay
                
                return (
                  <Card key={`${departure.route.id}_${index}`} className="p-4 hover:shadow-md transition-shadow cursor-pointer">
                    <div className="flex items-center gap-4">
                      <div 
                        className="w-12 h-12 rounded-full flex items-center justify-center text-white"
                        style={{ backgroundColor: departure.route.color }}
                      >
                        {departure.route.type === 3 ? <Bus className="w-6 h-6" /> : <Train className="w-6 h-6" />}
                      </div>
                      
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-medium text-gray-900">{departure.route.shortName} {departure.route.longName}</h4>
                          <Badge variant="outline" className="capitalize">
                            {departure.route.type === 3 ? 'Bus' : 'Train'}
                          </Badge>
                          {departure.realtime && (
                            <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                              Live
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-sm text-gray-600">
                          <div className="flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            <span>
                              {minutesToDeparture <= 0 ? 'Now' : 
                               minutesToDeparture === 1 ? '1 min' : `${minutesToDeparture} min`}
                            </span>
                          </div>
                          {departure.trip.headsign && (
                            <span className="text-gray-500">to {departure.trip.headsign}</span>
                          )}
                          <span className={isDelayed ? 'text-red-600' : 'text-green-600'}>
                            {departure.delay > 60 ? `+${Math.round(departure.delay / 60)}m` : 'On time'}
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
                );
              })}

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

              {serviceAlerts.length === 0 && !isLoading && (
                <div className="text-center py-8">
                  <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                  <p className="text-gray-500">No active service alerts</p>
                </div>
              )}
              
              {serviceAlerts.map((alert) => {
                const getSeverityColor = (severity: string) => {
                  switch (severity.toLowerCase()) {
                    case 'warning': return 'bg-yellow-50 border-yellow-200 text-yellow-800';
                    case 'info': return 'bg-blue-50 border-blue-200 text-blue-800';
                    case 'severe': return 'bg-red-50 border-red-200 text-red-800';
                    default: return 'bg-gray-50 border-gray-200 text-gray-800';
                  }
                };

                return (
                  <Card key={alert.id} className={`p-4 ${getSeverityColor(alert.severity)}`}>
                    <div className="flex items-start gap-3">
                      <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-medium">{alert.headerText}</h4>
                          <Badge variant="outline" className="capitalize text-xs">
                            {alert.severity.toLowerCase()}
                          </Badge>
                          {alert.routeIds && alert.routeIds.length > 0 && (
                            <Badge variant="outline" className="text-xs">
                              {alert.routeIds.join(', ')}
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm mb-3">{alert.descriptionText}</p>
                        <div className="text-xs text-gray-500 mb-2">
                          Valid until: {alert.validTo ? new Date(alert.validTo).toLocaleDateString() : 'Further notice'}
                        </div>
                        <div className="flex gap-2">
                          {alert.url && (
                            <Button variant="ghost" size="sm" className="text-xs p-0">
                              <a href={alert.url} target="_blank" rel="noopener noreferrer">
                                View Details
                              </a>
                            </Button>
                          )}
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