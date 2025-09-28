import React, { useEffect, useState } from 'react';
import { Button } from './ui/button';
import { MapPin, Navigation, Clock, X } from 'lucide-react';
import { toast } from 'sonner';

interface LocationSelectedNotificationProps {
  location: {
    name: string;
    address: string;
  } | null;
  routeInfo?: {
    distance?: string;
    duration?: string;
  } | null;
  transportMode: string;
  isCalculating: boolean;
  onStartNavigation?: () => void;
  onViewDetails?: () => void;
  onDismiss?: () => void;
}

export function LocationSelectedNotification({ 
  location, 
  routeInfo,
  transportMode,
  isCalculating,
  onStartNavigation,
  onViewDetails, 
  onDismiss 
}: LocationSelectedNotificationProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [animateIn, setAnimateIn] = useState(false);

  useEffect(() => {
    if (location) {
      setIsVisible(true);
      setTimeout(() => setAnimateIn(true), 50);
    } else {
      setAnimateIn(false);
      setTimeout(() => setIsVisible(false), 200);
    }
  }, [location]);

  if (!isVisible || !location) return null;

  const getTransportEmoji = (mode: string) => {
    switch (mode) {
      case 'walking': return '🚶';
      case 'driving': return '🚗';
      case 'cycling': return '🚴';
      case 'transit': return '🚌';
      default: return '📍';
    }
  };

  const handleDismiss = () => {
    if (onDismiss) {
      onDismiss();
    }
    setAnimateIn(false);
  };

  const handleViewDetails = () => {
    if (onViewDetails) {
      onViewDetails();
    } else {
      toast.info('Tap the route info panel for more details');
    }
  };

  return (
    <div className={`fixed top-4 left-1/2 transform -translate-x-1/2 z-50 transition-all duration-300 ${
      animateIn ? 'translate-y-0 opacity-100' : '-translate-y-4 opacity-0'
    }`}>
      <div className="bg-white rounded-xl shadow-lg border border-gray-200 px-4 py-3 max-w-sm mx-auto">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3 flex-1 min-w-0">
            <div className="flex-shrink-0">
              <MapPin className="w-5 h-5 text-blue-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {location.name}
              </p>
              <div className="flex items-center space-x-2 mt-1">
                {isCalculating ? (
                  <div className="flex items-center space-x-1">
                    <div className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                    <span className="text-xs text-gray-500">Calculating {transportMode} route...</span>
                  </div>
                ) : routeInfo ? (
                  <div className="flex items-center space-x-2 text-xs text-gray-600">
                    <span className="flex items-center space-x-1">
                      <span>{getTransportEmoji(transportMode)}</span>
                      <span>{routeInfo.distance || 'Unknown'}</span>
                    </span>
                    {routeInfo.duration && (
                      <span className="flex items-center space-x-1">
                        <Clock className="w-3 h-3" />
                        <span>{routeInfo.duration}</span>
                      </span>
                    )}
                  </div>
                ) : (
                  <span className="text-xs text-gray-500">
                    Route calculated • Tap for details
                  </span>
                )}
              </div>
            </div>
            <Button
              size="sm"
              variant="ghost"
              className="flex-shrink-0 h-6 w-6 p-0 text-gray-400 hover:text-gray-600"
              onClick={handleDismiss}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
        
        {!isCalculating && routeInfo && (
          <div className="flex items-center space-x-2 mt-3 pt-2 border-t border-gray-100">
            <Button
              size="sm"
              variant="outline"
              className="flex-1 h-7 text-xs"
              onClick={handleViewDetails}
            >
              Details
            </Button>
            {onStartNavigation && (
              <Button
                size="sm"
                className="flex-1 h-7 text-xs bg-blue-600 hover:bg-blue-700 text-white"
                onClick={onStartNavigation}
              >
                <Navigation className="w-3 h-3 mr-1" />
                Start
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}