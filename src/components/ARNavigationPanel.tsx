import React, { useState, useEffect } from 'react';
import { 
  X, 
  Camera, 
  Navigation, 
  MapPin, 
  Battery, 
  AlertTriangle,
  Zap,
  Eye,
  EyeOff,
  Settings
} from 'lucide-react';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Switch } from './ui/switch';

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

interface ARNavigationPanelProps {
  route: Route | null;
  onClose: () => void;
}

export function ARNavigationPanel({ route, onClose }: ARNavigationPanelProps) {
  const [isARActive, setIsARActive] = useState(true);
  const [batteryLevel, setBatteryLevel] = useState(78);
  const [distanceToTurn, setDistanceToTurn] = useState('150 ft');
  const [nextDirection, setNextDirection] = useState('Turn right on Market St');
  const [nearbyPOIs] = useState([
    { id: '1', name: 'Starbucks', distance: '50 ft', type: 'coffee' },
    { id: '2', name: 'ATM', distance: '120 ft', type: 'atm' },
    { id: '3', name: 'Parking', distance: '200 ft', type: 'parking' },
  ]);

  // Simulate battery drain and distance updates
  useEffect(() => {
    const interval = setInterval(() => {
      setBatteryLevel(prev => Math.max(prev - 0.1, 0));
      
      // Simulate approaching turn
      const currentDistance = parseInt(distanceToTurn);
      if (currentDistance > 10) {
        setDistanceToTurn(`${currentDistance - 5} ft`);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [distanceToTurn]);

  if (!route) {
    return (
      <div className="h-full bg-black flex items-center justify-center">
        <div className="text-center text-white">
          <Camera className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p className="opacity-75">No active route for AR navigation</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-black relative overflow-hidden">
      {/* Camera View Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-gray-800 via-gray-600 to-gray-800">
        {/* Simulated camera feed with street view */}
        <div className="absolute inset-0 opacity-60">
          <div className="absolute bottom-0 left-0 right-0 h-1/3 bg-gradient-to-t from-gray-900 to-transparent" />
          <div className="absolute top-1/3 left-0 right-0 h-px bg-gray-500 opacity-30" />
          <div className="absolute top-2/3 left-0 right-0 h-px bg-gray-500 opacity-30" />
        </div>

        {/* Street Elements */}
        <div className="absolute bottom-24 left-1/4 w-2 h-12 bg-gray-400 opacity-70" /> {/* Building */}
        <div className="absolute bottom-24 right-1/3 w-2 h-16 bg-gray-400 opacity-70" /> {/* Building */}
        <div className="absolute bottom-16 left-1/2 w-1 h-8 bg-yellow-400 opacity-80" /> {/* Street light */}
      </div>

      {/* Top Status Bar */}
      <div className="absolute top-0 left-0 right-0 z-50 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/20"
              onClick={onClose}
            >
              <X className="w-5 h-5" />
            </Button>
            <div className="text-white">
              <div className="text-sm font-medium">AR Walking</div>
              <div className="text-xs opacity-75">{route.to.name}</div>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <div className={`flex items-center gap-1 text-white text-sm ${
              batteryLevel < 20 ? 'text-red-400' : ''
            }`}>
              <Battery className="w-4 h-4" />
              <span>{Math.round(batteryLevel)}%</span>
            </div>
            
            <Button
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/20"
              onClick={() => setIsARActive(!isARActive)}
            >
              {isARActive ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
            </Button>
          </div>
        </div>
      </div>

      {/* AR Direction Arrow */}
      {isARActive && (
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-40">
          <div className="relative">
            {/* Large directional arrow */}
            <div className="w-20 h-20 bg-blue-500 rounded-full flex items-center justify-center shadow-lg animate-pulse">
              <Navigation 
                className="w-10 h-10 text-white" 
                style={{ transform: 'rotate(45deg)' }} // Right turn
              />
            </div>
            
            {/* Distance indicator */}
            <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 bg-black/80 rounded-lg px-3 py-1">
              <span className="text-white text-sm font-medium">{distanceToTurn}</span>
            </div>
          </div>
        </div>
      )}

      {/* Direction Instructions */}
      <Card className="absolute top-20 left-4 right-4 bg-black/80 border-gray-600 text-white z-30">
        <div className="p-4">
          <div className="flex items-center gap-3">
            <Navigation className="w-6 h-6 text-blue-400" />
            <div>
              <div className="font-medium">{nextDirection}</div>
              <div className="text-sm opacity-75">in {distanceToTurn}</div>
            </div>
          </div>
        </div>
      </Card>

      {/* Nearby POIs */}
      {isARActive && (
        <div className="absolute inset-0 z-20">
          {nearbyPOIs.map((poi, index) => (
            <div
              key={poi.id}
              className="absolute"
              style={{
                left: `${30 + index * 25}%`,
                top: `${40 + index * 10}%`,
                transform: 'translate(-50%, -50%)'
              }}
            >
              <div className="bg-white/90 rounded-lg px-3 py-2 shadow-lg">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  <div>
                    <div className="text-sm font-medium text-gray-900">{poi.name}</div>
                    <div className="text-xs text-gray-600">{poi.distance}</div>
                  </div>
                </div>
              </div>
              
              {/* Line connecting to POI */}
              <div className="absolute top-full left-1/2 w-px h-8 bg-blue-500/50"></div>
            </div>
          ))}
        </div>
      )}

      {/* Distance markers on ground */}
      {isARActive && (
        <>
          <div className="absolute bottom-32 left-1/2 transform -translate-x-1/2 z-10">
            <div className="w-16 h-2 bg-blue-500/70 rounded-full"></div>
            <div className="text-center text-white text-xs mt-1">100 ft</div>
          </div>
          <div className="absolute bottom-48 left-1/2 transform -translate-x-1/2 z-10">
            <div className="w-12 h-2 bg-blue-500/50 rounded-full"></div>
            <div className="text-center text-white text-xs mt-1">200 ft</div>
          </div>
        </>
      )}

      {/* Bottom Controls */}
      <div className="absolute bottom-0 left-0 right-0 z-30">
        <Card className="m-4 bg-black/80 border-gray-600 text-white">
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="font-medium">AR Walking Navigation</div>
                <div className="text-sm opacity-75">3 min remaining • 0.2 mi</div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="text-white hover:bg-white/20"
              >
                <Settings className="w-5 h-5" />
              </Button>
            </div>
            
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-yellow-400" />
                  <span className="text-sm">Low Battery Mode</span>
                </div>
                <Switch
                  checked={batteryLevel < 20}
                  onCheckedChange={() => {}}
                  disabled
                />
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Eye className="w-4 h-4 text-blue-400" />
                  <span className="text-sm">AR Overlays</span>
                </div>
                <Switch
                  checked={isARActive}
                  onCheckedChange={setIsARActive}
                />
              </div>
            </div>
            
            <div className="mt-4 pt-3 border-t border-gray-600">
              <Button
                variant="outline"
                size="sm"
                className="w-full border-gray-600 text-white hover:bg-white/10"
              >
                Switch to Map View
              </Button>
            </div>
          </div>
        </Card>
      </div>

      {/* Safety Warning */}
      {batteryLevel < 15 && (
        <Card className="absolute bottom-48 left-4 right-4 bg-red-900/90 border-red-600 text-white z-40">
          <div className="p-3">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-red-400" />
              <div>
                <div className="font-medium">Low Battery Warning</div>
                <div className="text-sm opacity-75">AR mode will disable soon to save power</div>
              </div>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}