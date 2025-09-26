import React, { useState, useEffect } from 'react';
import { X, Volume2, VolumeX, AlertTriangle, Navigation, MapPin, Phone, Camera, Share, Zap, Eye } from 'lucide-react';
import { Button } from './ui/button';
import { Progress } from './ui/progress';
import { Badge } from './ui/badge';

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

  // Simulate navigation progress
  useEffect(() => {
    const interval = setInterval(() => {
      // This would normally update based on GPS position
      // For demo purposes, we'll just simulate progress
    }, 1000);

    return () => clearInterval(interval);
  }, []);

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
            >
              <AlertTriangle className="w-4 h-4" />
              Report
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex items-center gap-2"
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
                alert('Switching to alternative route...');
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