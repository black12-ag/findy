import React, { useEffect, useState } from 'react';
import { 
  ArrowLeft, 
  Navigation, 
  Clock, 
  MapPin, 
  Route, 
  Fuel, 
  AlertTriangle, 
  Star,
  Plus,
  X,
  Calendar,
  Share,
  Save,
  GripVertical,
  ChevronDown,
  Timer
} from 'lucide-react';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { routesService } from '../services/routes';

interface Location {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  category?: string;
}

interface Stop {
  id: string;
  location: Location;
  duration?: string; // time to spend at this stop
}

interface EnhancedRoute {
  id: string;
  from: Location;
  to: Location;
  stops: Stop[];
  distance: string;
  duration: string;
  mode: string;
  steps: string[];
  type: string;
  traffic: string;
  tolls: boolean;
  co2: string;
  departureTime?: string;
  arrivalTime?: string;
}

interface EnhancedRoutePanelProps {
  from: Location;
  to: Location | null;
  transportMode: TransportMode;
  onStartNavigation: (route: Route) => void;
  onBack: () => void;
  onOpenMultiStop?: () => void;
}

export function EnhancedRoutePanel({ from, to, transportMode, onStartNavigation, onBack, onOpenMultiStop }: EnhancedRoutePanelProps) {
  const [selectedRoute, setSelectedRoute] = useState(0);
  const [activeTab, setActiveTab] = useState('routes');
  const [stops, setStops] = useState<Stop[]>([]);
  const [departureTime, setDepartureTime] = useState('now');
  const [customTime, setCustomTime] = useState('');
  const [routeName, setRouteName] = useState('');
  const [routeOptions, setRouteOptions] = useState<EnhancedRoute[]>([]);
  const [loading, setLoading] = useState(false);

  // Calculate route when inputs change
  useEffect(() => {
    const calc = async () => {
      if (!from || !to) return;
      setLoading(true);
      try {
        const res = await routesService.calculateRoute({
          origin: { lat: from.lat, lng: from.lng, address: from.address },
          destination: { lat: to.lat, lng: to.lng, address: to.address },
          travelMode: transportMode.toUpperCase() as any,
        });
        const r = res.route;
        const enhanced: EnhancedRoute = {
          id: Date.now().toString(),
          from: from!,
          to: to!,
          stops,
          distance: r.distance.text,
          duration: r.duration.text,
          mode: transportMode,
          type: 'Fastest',
          traffic: 'Based on current conditions',
          tolls: false,
          co2: '—',
          departureTime: departureTime === 'now' ? 'Leave now' : customTime,
          arrivalTime: '',
          steps: r.steps?.map(s => s.instruction) || [],
        };
        setRouteOptions([enhanced]);
        setSelectedRoute(0);
      } catch (e) {
        // If API fails, keep previous or empty
        setRouteOptions([]);
      } finally {
        setLoading(false);
      }
    };
    calc();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from?.id, to?.id, transportMode, stops.length, departureTime, customTime]);

  const getTransportColor = () => {
    switch (transportMode) {
      case 'driving': return '#3B82F6';
      case 'walking': return '#10B981';
      case 'transit': return '#F59E0B';
      case 'cycling': return '#8B5CF6';
      default: return '#5B4FE5';
    }
  };

  const addStop = () => {
    const newStop: Stop = {
      id: Date.now().toString(),
      location: {
        id: 'temp',
        name: 'Add location',
        address: 'Tap to search',
        lat: 0,
        lng: 0
      }
    };
    setStops([...stops, newStop]);
  };

  const removeStop = (stopId: string) => {
    setStops(stops.filter(stop => stop.id !== stopId));
  };

  const reorderStops = (fromIndex: number, toIndex: number) => {
    const newStops = [...stops];
    const [removed] = newStops.splice(fromIndex, 1);
    newStops.splice(toIndex, 0, removed);
    setStops(newStops);
  };

  const saveRoute = async () => {
    if (!routeName.trim() || !from || !to || !routeOptions[selectedRoute]) return;
    try {
      await routesService.saveRoute({
        name: routeName.trim(),
        origin: { lat: from.lat, lng: from.lng, address: from.address },
        destination: { lat: to.lat, lng: to.lng, address: to.address },
        waypoints: stops.map(s => ({ lat: s.location.lat, lng: s.location.lng, address: s.location.address })),
        travelMode: transportMode.toUpperCase() as any,
        distance: Number((routeOptions[selectedRoute].distance || '0').toString().replace(/[^0-9.]/g, '')) * 1000 || 0,
        duration: Number((routeOptions[selectedRoute].duration || '0').toString().replace(/[^0-9.]/g, '')) * 60 || 0,
        isFavorite: false,
      });
      alert('Route saved');
      setRouteName('');
    } catch (e) {
      alert('Failed to save route');
    }
  };

  const shareRoute = () => {
    // In a real app, this would generate a shareable link
    console.log('Sharing route:', routeOptions[selectedRoute]);
  };

  const optimize = async () => {
    if (!from || !to) return;
    setLoading(true);
    try {
      const res = await routesService.optimizeRoute({
        origin: { lat: from.lat, lng: from.lng, address: from.address },
        destination: { lat: to.lat, lng: to.lng, address: to.address },
        waypoints: stops.map(s => ({ lat: s.location.lat, lng: s.location.lng, address: s.location.address })),
      });
      const r = res.route;
      const enhanced: EnhancedRoute = {
        id: Date.now().toString(),
        from: from!,
        to: to!,
        stops,
        distance: r.distance.text,
        duration: r.duration.text,
        mode: transportMode,
        type: 'Optimized',
        traffic: 'Optimized ordering',
        tolls: false,
        co2: '—',
        departureTime: departureTime === 'now' ? 'Leave now' : customTime,
        arrivalTime: '',
        steps: r.steps?.map(s => s.instruction) || [],
      };
      setRouteOptions([enhanced]);
      setSelectedRoute(0);
      setActiveTab('routes');
    } catch (e) {
      alert('Failed to optimize route');
    } finally {
      setLoading(false);
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
          <div className="flex-1">
            <h2 className="font-medium text-gray-900">Route Planning</h2>
            <p className="text-sm text-gray-500">{from.name} → {to.name}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="icon" onClick={shareRoute}>
              <Share className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={saveRoute}>
              <Star className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <div className="flex-shrink-0 px-4 py-2">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="routes">Routes</TabsTrigger>
            <TabsTrigger value="stops">Stops ({stops.length})</TabsTrigger>
            <TabsTrigger value="timing">Timing</TabsTrigger>
          </TabsList>
        </div>

        <div className="flex-1 overflow-hidden min-h-0">
          {/* Routes Tab */}
          <TabsContent value="routes" className="h-full overflow-y-auto scroll-y hide-scrollbar scroll-smooth p-4 mt-0">
            <div className="space-y-3">
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
                          <Badge className="bg-green-100 text-green-700">
                            Recommended
                          </Badge>
                        )}
                        {stops.length > 0 && (
                          <Badge variant="outline">
                            +{stops.length} stop{stops.length > 1 ? 's' : ''}
                          </Badge>
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
                        {route.departureTime && (
                          <div className="flex items-center gap-1">
                            <Timer className="w-4 h-4" />
                            <span>{route.departureTime}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-medium text-gray-900">{route.duration}</div>
                      <div className="text-sm text-gray-500">{route.arrivalTime}</div>
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
          </TabsContent>

          {/* Stops Tab */}
          <TabsContent value="stops" className="h-full overflow-y-auto scroll-y hide-scrollbar scroll-smooth p-4 mt-0">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-medium text-gray-900">Multi-Stop Route</h3>
                <div className="flex items-center gap-2">
                  {onOpenMultiStop && (
                    <Button size="sm" variant="outline" onClick={onOpenMultiStop}>
                      Advanced Planning
                    </Button>
                  )}
                  <span className="text-sm text-gray-500">Up to 10 stops</span>
                </div>
              </div>

              {/* Route Points */}
              <div className="space-y-3">
                {/* Start Point */}
                <Card className="p-3 bg-green-50 border-green-200">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                      <span className="text-white text-sm font-medium">A</span>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{from.name}</p>
                      <p className="text-sm text-gray-600">{from.address}</p>
                    </div>
                  </div>
                </Card>

                {/* Stops */}
                {stops.map((stop, index) => (
                  <Card key={stop.id} className="p-3">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        <GripVertical className="w-4 h-4 text-gray-400" />
                        <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                          <span className="text-white text-sm font-medium">{index + 1}</span>
                        </div>
                      </div>
                      <div className="flex-1">
                        <Input
                          placeholder="Search for a location"
                          value={stop.location.name === 'Add location' ? '' : stop.location.name}
                          className="border-none p-0 h-auto font-medium"
                        />
                        <Input
                          placeholder="Optional: time to spend here"
                          value={stop.duration || ''}
                          className="border-none p-0 h-auto text-sm text-gray-600 mt-1"
                        />
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeStop(stop.id)}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </Card>
                ))}

                {/* Add Stop Button */}
                {stops.length < 10 && (
                  <Card 
                    className="p-3 border-dashed border-2 border-gray-300 cursor-pointer hover:border-gray-400 transition-colors"
                    onClick={addStop}
                  >
                    <div className="flex items-center justify-center gap-2 text-gray-500">
                      <Plus className="w-4 h-4" />
                      <span>Add stop</span>
                    </div>
                  </Card>
                )}

                {/* End Point */}
                <Card className="p-3 bg-red-50 border-red-200">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-red-500 rounded-full flex items-center justify-center">
                      <span className="text-white text-sm font-medium">B</span>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{to.name}</p>
                      <p className="text-sm text-gray-600">{to.address}</p>
                    </div>
                  </div>
                </Card>
              </div>

              {/* Route Optimization */}
              <Card className="p-4 bg-blue-50 border-blue-200">
                <div className="flex items-center gap-3">
                  <Route className="w-5 h-5 text-blue-600" />
                  <div>
                    <h4 className="font-medium text-blue-900">Route Optimization</h4>
                    <p className="text-sm text-blue-800">We'll find the best order for your stops</p>
                  </div>
                  <Button variant="outline" size="sm" className="ml-auto" onClick={optimize} disabled={loading}>
                    Optimize
                  </Button>
                </div>
              </Card>
            </div>
          </TabsContent>

          {/* Timing Tab */}
          <TabsContent value="timing" className="h-full overflow-y-auto scroll-y hide-scrollbar scroll-smooth p-4 mt-0">
            <div className="space-y-6">
              <div>
                <h3 className="font-medium text-gray-900 mb-4">Departure Time</h3>
                <div className="space-y-3">
                  <Card 
                    className={`p-3 cursor-pointer ${
                      departureTime === 'now' ? 'ring-2 ring-blue-500 bg-blue-50' : 'hover:bg-gray-50'
                    }`}
                    onClick={() => setDepartureTime('now')}
                  >
                    <div className="flex items-center gap-3">
                      <Navigation className="w-5 h-5 text-blue-600" />
                      <div>
                        <p className="font-medium text-gray-900">Leave now</p>
                        <p className="text-sm text-gray-600">Best route for current conditions</p>
                      </div>
                    </div>
                  </Card>

                  <Card 
                    className={`p-3 cursor-pointer ${
                      departureTime === 'depart' ? 'ring-2 ring-blue-500 bg-blue-50' : 'hover:bg-gray-50'
                    }`}
                    onClick={() => setDepartureTime('depart')}
                  >
                    <div className="flex items-center gap-3">
                      <Clock className="w-5 h-5 text-green-600" />
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">Depart at</p>
                        <Input
                          type="time"
                          value={customTime}
                          onChange={(e) => setCustomTime(e.target.value)}
                          className="mt-2"
                          placeholder="Select time"
                        />
                      </div>
                    </div>
                  </Card>

                  <Card 
                    className={`p-3 cursor-pointer ${
                      departureTime === 'arrive' ? 'ring-2 ring-blue-500 bg-blue-50' : 'hover:bg-gray-50'
                    }`}
                    onClick={() => setDepartureTime('arrive')}
                  >
                    <div className="flex items-center gap-3">
                      <MapPin className="w-5 h-5 text-purple-600" />
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">Arrive by</p>
                        <Input
                          type="time"
                          value={customTime}
                          onChange={(e) => setCustomTime(e.target.value)}
                          className="mt-2"
                          placeholder="Select time"
                        />
                      </div>
                    </div>
                  </Card>
                </div>
              </div>

              <div>
                <h3 className="font-medium text-gray-900 mb-4">Smart Suggestions</h3>
                <div className="space-y-3">
                  <Card className="p-3 bg-yellow-50 border-yellow-200">
                    <div className="flex items-center gap-3">
                      <AlertTriangle className="w-5 h-5 text-yellow-600" />
                      <div>
                        <p className="font-medium text-yellow-900">Peak Traffic Alert</p>
                        <p className="text-sm text-yellow-800">Leave 10 minutes earlier to avoid rush hour</p>
                      </div>
                    </div>
                  </Card>

                  <Card className="p-3 bg-green-50 border-green-200">
                    <div className="flex items-center gap-3">
                      <Timer className="w-5 h-5 text-green-600" />
                      <div>
                        <p className="font-medium text-green-900">Optimal Time</p>
                        <p className="text-sm text-green-800">Best departure time: 2:45 PM (saves 8 minutes)</p>
                      </div>
                    </div>
                  </Card>
                </div>
              </div>

              <div>
                <h3 className="font-medium text-gray-900 mb-4">Save Route</h3>
                <div className="space-y-3">
                  <Input
                    value={routeName}
                    onChange={(e) => setRouteName(e.target.value)}
                    placeholder="Route name (e.g., Morning commute)"
                  />
                  <Button 
                    variant="outline" 
                    className="w-full"
                    onClick={saveRoute}
                    disabled={!routeName.trim()}
                  >
                    <Save className="w-4 h-4 mr-2" />
                    Save for Later
                  </Button>
                </div>
              </div>
            </div>
          </TabsContent>
        </div>
      </Tabs>

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
      </div>
    </div>
  );
}