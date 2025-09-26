import React, { useState } from 'react';
import { 
  Plus,
  X,
  GripVertical,
  MapPin,
  Clock,
  Route,
  Save,
  Share2,
  ArrowUp,
  ArrowDown,
  Navigation,
  Calendar,
  Leaf
} from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Switch } from './ui/switch';

interface Location {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
}

interface RouteStop {
  id: string;
  location: Location | null;
  stopDuration: number; // minutes
}

interface MultiStopRoutePlannerProps {
  onRouteCalculated: (route: any) => void;
  onBack: () => void;
}

export function MultiStopRoutePlanner({ onRouteCalculated, onBack }: MultiStopRoutePlannerProps) {
  const [stops, setStops] = useState<RouteStop[]>([
    { id: '1', location: null, stopDuration: 0 },
    { id: '2', location: null, stopDuration: 0 }
  ]);
  
  const [routeOptions, setRouteOptions] = useState({
    optimize: 'time', // 'time', 'distance', 'fuel'
    avoidTolls: false,
    avoidHighways: false,
    departureTime: '',
    isRoundTrip: false
  });
  
  const [calculatedRoute, setCalculatedRoute] = useState<any>(null);
  const [isCalculating, setIsCalculating] = useState(false);

  // Mock locations for autocomplete
  const mockLocations: Location[] = [
    { id: '1', name: 'Home', address: '123 Main St', lat: 37.7749, lng: -122.4194 },
    { id: '2', name: 'Work', address: '456 Market St', lat: 37.7849, lng: -122.4094 },
    { id: '3', name: 'Grocery Store', address: '789 Mission St', lat: 37.7649, lng: -122.4294 },
    { id: '4', name: 'Gym', address: '321 Folsom St', lat: 37.7549, lng: -122.3994 },
    { id: '5', name: 'Restaurant', address: '654 Union St', lat: 37.7949, lng: -122.4394 }
  ];

  const addStop = () => {
    if (stops.length < 10) {
      setStops([...stops, { id: Date.now().toString(), location: null, stopDuration: 0 }]);
    }
  };

  const removeStop = (stopId: string) => {
    if (stops.length > 2) {
      setStops(stops.filter(stop => stop.id !== stopId));
    }
  };

  const updateStopLocation = (stopId: string, location: Location) => {
    setStops(stops.map(stop => 
      stop.id === stopId ? { ...stop, location } : stop
    ));
  };

  const updateStopDuration = (stopId: string, duration: number) => {
    setStops(stops.map(stop => 
      stop.id === stopId ? { ...stop, stopDuration: duration } : stop
    ));
  };

  const moveStop = (stopId: string, direction: 'up' | 'down') => {
    const index = stops.findIndex(stop => stop.id === stopId);
    if (
      (direction === 'up' && index > 0) ||
      (direction === 'down' && index < stops.length - 1)
    ) {
      const newStops = [...stops];
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      [newStops[index], newStops[targetIndex]] = [newStops[targetIndex], newStops[index]];
      setStops(newStops);
    }
  };

  const calculateRoute = async () => {
    const validStops = stops.filter(stop => stop.location);
    if (validStops.length < 2) return;

    setIsCalculating(true);
    
    // Simulate route calculation
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    const mockRoute = {
      id: Date.now().toString(),
      stops: validStops.map((stop, index) => ({
        order: index + 1,
        location: stop.location,
        arrivalTime: `${9 + Math.floor(index * 1.5)}:${(index * 30) % 60}0 AM`,
        stopDuration: stop.stopDuration,
        distanceToNext: index < validStops.length - 1 ? `${2 + Math.random() * 5}mi` : null
      })),
      totalDistance: `${10 + validStops.length * 3}mi`,
      totalTime: `${45 + validStops.length * 15}min`,
      estimatedFuel: `$${(8 + validStops.length * 2).toFixed(2)}`,
      co2Emissions: `${2 + validStops.length * 0.5}kg`,
      routeOptions
    };
    
    setCalculatedRoute(mockRoute);
    setIsCalculating(false);
  };

  const startNavigation = () => {
    if (calculatedRoute) {
      onRouteCalculated(calculatedRoute);
    }
  };

  const saveRoute = () => {
    if (calculatedRoute) {
      const savedRoutes = JSON.parse(localStorage.getItem('savedRoutes') || '[]');
      savedRoutes.push({
        ...calculatedRoute,
        name: `Route - ${new Date().toLocaleDateString()}`,
        createdAt: new Date().toISOString()
      });
      localStorage.setItem('savedRoutes', JSON.stringify(savedRoutes));
      alert('Route saved successfully!');
    }
  };

  return (
    <div className="h-full bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 bg-white px-4 py-4 border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={onBack}>
              <X className="w-5 h-5" />
            </Button>
            <div>
              <h2 className="font-semibold">Multi-Stop Route</h2>
              <p className="text-sm text-gray-500">Plan up to 10 stops</p>
            </div>
          </div>
          <Badge variant="outline">{stops.length}/10 stops</Badge>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="p-4 space-y-6">
          {/* Route Stops */}
          <Card className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Route Stops</h3>
              <Button
                size="sm"
                onClick={addStop}
                disabled={stops.length >= 10}
                className="text-xs"
              >
                <Plus className="w-3 h-3 mr-1" />
                Add Stop
              </Button>
            </div>
            
            <div className="space-y-3">
              {stops.map((stop, index) => (
                <div key={stop.id} className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg">
                  <div className="flex flex-col items-center">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-medium ${
                      index === 0 ? 'bg-green-500' : 
                      index === stops.length - 1 ? 'bg-red-500' : 
                      'bg-blue-500'
                    }`}>
                      {index === 0 ? 'A' : index === stops.length - 1 ? 'B' : index + 1}
                    </div>
                    {index < stops.length - 1 && (
                      <div className="w-0.5 h-4 bg-gray-300 mt-1" />
                    )}
                  </div>
                  
                  <div className="flex-1">
                    <Select 
                      value={stop.location?.id || ''} 
                      onValueChange={(locationId) => {
                        const location = mockLocations.find(l => l.id === locationId);
                        if (location) updateStopLocation(stop.id, location);
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={`Stop ${index + 1} destination`} />
                      </SelectTrigger>
                      <SelectContent>
                        {mockLocations.map(location => (
                          <SelectItem key={location.id} value={location.id}>
                            {location.name} - {location.address}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    
                    {stop.location && index > 0 && index < stops.length - 1 && (
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-xs text-gray-500">Stop for:</span>
                        <Input
                          type="number"
                          value={stop.stopDuration}
                          onChange={(e) => updateStopDuration(stop.id, parseInt(e.target.value) || 0)}
                          className="w-16 h-6 text-xs"
                          min="0"
                          max="480"
                        />
                        <span className="text-xs text-gray-500">min</span>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex flex-col gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="w-6 h-6"
                      onClick={() => moveStop(stop.id, 'up')}
                      disabled={index === 0}
                    >
                      <ArrowUp className="w-3 h-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="w-6 h-6"
                      onClick={() => moveStop(stop.id, 'down')}
                      disabled={index === stops.length - 1}
                    >
                      <ArrowDown className="w-3 h-3" />
                    </Button>
                    {stops.length > 2 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="w-6 h-6 text-red-500"
                        onClick={() => removeStop(stop.id)}
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Route Options */}
          <Card className="p-4">
            <h3 className="font-semibold mb-4">Route Options</h3>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Optimize for</label>
                <Select value={routeOptions.optimize} onValueChange={(value) => 
                  setRouteOptions(prev => ({ ...prev, optimize: value }))
                }>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="time">Fastest Time</SelectItem>
                    <SelectItem value="distance">Shortest Distance</SelectItem>
                    <SelectItem value="fuel">Fuel Efficiency</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm">Avoid tolls</span>
                <Switch 
                  checked={routeOptions.avoidTolls}
                  onCheckedChange={(checked) => setRouteOptions(prev => ({ ...prev, avoidTolls: checked }))}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm">Avoid highways</span>
                <Switch 
                  checked={routeOptions.avoidHighways}
                  onCheckedChange={(checked) => setRouteOptions(prev => ({ ...prev, avoidHighways: checked }))}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm">Round trip</span>
                <Switch 
                  checked={routeOptions.isRoundTrip}
                  onCheckedChange={(checked) => setRouteOptions(prev => ({ ...prev, isRoundTrip: checked }))}
                />
              </div>
              
              <div>
                <label className="text-sm font-medium mb-2 block">Departure time (optional)</label>
                <Input
                  type="datetime-local"
                  value={routeOptions.departureTime}
                  onChange={(e) => setRouteOptions(prev => ({ ...prev, departureTime: e.target.value }))}
                />
              </div>
            </div>
          </Card>

          {/* Calculate Button */}
          <Button 
            onClick={calculateRoute}
            disabled={isCalculating || stops.filter(s => s.location).length < 2}
            className="w-full"
            size="lg"
          >
            {isCalculating ? (
              <>Calculating...</>
            ) : (
              <>
                <Route className="w-4 h-4 mr-2" />
                Calculate Route
              </>
            )}
          </Button>

          {/* Route Results */}
          {calculatedRoute && (
            <Card className="p-4">
              <h3 className="font-semibold mb-4">Route Summary</h3>
              
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div className="text-center">
                  <div className="text-lg font-bold text-blue-600">{calculatedRoute.totalDistance}</div>
                  <div className="text-xs text-gray-500">Distance</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-green-600">{calculatedRoute.totalTime}</div>
                  <div className="text-xs text-gray-500">Time</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-purple-600">{calculatedRoute.estimatedFuel}</div>
                  <div className="text-xs text-gray-500">Est. Fuel</div>
                </div>
              </div>
              
              <div className="flex items-center justify-center mb-4 text-sm text-gray-600">
                <Leaf className="w-4 h-4 mr-1 text-green-500" />
                CO2 emissions: {calculatedRoute.co2Emissions}
              </div>

              <div className="flex gap-2">
                <Button onClick={startNavigation} className="flex-1">
                  <Navigation className="w-4 h-4 mr-2" />
                  Start Navigation
                </Button>
                <Button variant="outline" onClick={saveRoute}>
                  <Save className="w-4 h-4" />
                </Button>
                <Button variant="outline">
                  <Share2 className="w-4 h-4" />
                </Button>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}