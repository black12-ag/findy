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
  const [lastKey, setLastKey] = useState<string | null>(null);

  useEffect(() => {
    // Only show when location changes meaningfully (by name)
    const key = location?.name || null;
    if (location && key !== lastKey) {
      setLastKey(key);
      setIsVisible(true);
      const t = setTimeout(() => setAnimateIn(true), 50);
      // Auto-dismiss after 6 seconds to avoid lingering
      const auto = setTimeout(() => {
        setAnimateIn(false);
        setTimeout(() => setIsVisible(false), 200);
      }, 6000);
      return () => {
        clearTimeout(t);
        clearTimeout(auto);
      };
    } else if (!location) {
      setAnimateIn(false);
      const t = setTimeout(() => setIsVisible(false), 200);
      return () => clearTimeout(t);
    }
  }, [location, lastKey]);

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
    <div className={`fixed top-3 left-1/2 transform -translate-x-1/2 z-50 transition-all duration-300 ${
      animateIn ? 'translate-y-0 opacity-100' : '-translate-y-4 opacity-0'
    }`}>
      <div className="bg-white rounded-lg shadow-lg border border-gray-200 px-3 py-2 max-w-xs mx-auto">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3 flex-1 min-w-0">
            <div className="flex-shrink-0">
              <MapPin className="w-4 h-4 text-blue-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-gray-900 truncate">
                {location.name}
              </p>
              <div className="flex items-center space-x-2 mt-1">
                {isCalculating ? (
                  <div className="flex items-center space-x-1">
                    <div className="w-2.5 h-2.5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                    <span className="text-[11px] text-gray-500">Calculating {transportMode} route...</span>
                  </div>
                ) : routeInfo ? (
                  <div className="flex items-center space-x-2 text-[11px] text-gray-600">
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
                  <span className="text-[11px] text-gray-500">
                    Route calculated • Tap for details
                  </span>
                )}
              </div>
            </div>
            <Button
              size="icon"
              variant="ghost"
              className="flex-shrink-0 h-6 w-6 p-0 text-gray-400 hover:text-gray-600"
              onClick={handleDismiss}
            >
              <X className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
        
        {!isCalculating && routeInfo && (
          <div className="flex items-center space-x-2 mt-2 pt-2 border-t border-gray-100">
            <Button
              size="sm"
              variant="outline"
              className="flex-1 h-6 text-[11px]"
              onClick={handleViewDetails}
            >
              Details
            </Button>
            {onStartNavigation && (
              <Button
                size="sm"
                className="flex-1 h-6 text-[11px] bg-blue-600 hover:bg-blue-700 text-white"
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