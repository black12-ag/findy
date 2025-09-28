/**
 * 📡 Offline Map Indicator
 * 
 * Shows when offline maps are available for the current location
 * Provides quick access to download or manage offline maps
 */

import React, { useState, useEffect } from 'react';
import { WifiOff, Download, Check, MapPin } from 'lucide-react';
import { Button } from './ui/button';
import offlineMapsService from '../services/offlineMapsService';
import { logger } from '../utils/logger';

interface OfflineMapIndicatorProps {
  currentLocation?: {
    lat: number;
    lng: number;
    name?: string;
  };
  onOpenOfflineMaps: () => void;
  className?: string;
}

export function OfflineMapIndicator({ 
  currentLocation, 
  onOpenOfflineMaps,
  className = '' 
}: OfflineMapIndicatorProps) {
  const [hasOfflineMap, setHasOfflineMap] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [userCity, setUserCity] = useState<any>(null);

  // Check for offline maps when location changes
  useEffect(() => {
    if (!currentLocation) return;

    const checkOfflineAvailability = async () => {
      setIsChecking(true);
      try {
        // First, try to get city info from coordinates
        const city = await offlineMapsService.getCityDetails(
          currentLocation.lat, 
          currentLocation.lng
        );
        
        if (city) {
          setUserCity(city);
          // Check if we have offline maps for this city
          const hasMap = await offlineMapsService.hasOfflineMap(city.id);
          setHasOfflineMap(hasMap);
          logger.debug('Offline map availability checked', { 
            city: city.name, 
            hasMap 
          });
        }
      } catch (error) {
        logger.error('Failed to check offline map availability:', error);
      } finally {
        setIsChecking(false);
      }
    };

    checkOfflineAvailability();
  }, [currentLocation]);

  // Don't render if we don't have location data
  if (!currentLocation || isChecking) {
    return null;
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {hasOfflineMap ? (
        <Button
          size="sm"
          onClick={onOpenOfflineMaps}
          className="bg-green-100 text-green-700 border border-green-300 hover:bg-green-200 shadow-sm"
          title={`Offline maps available for ${userCity?.name || 'this area'}`}
        >
          <Check className="w-4 h-4 mr-1" />
          <WifiOff className="w-4 h-4 mr-1" />
          <span className="text-xs">Offline Ready</span>
        </Button>
      ) : (
        <Button
          size="sm"
          variant="outline"
          onClick={onOpenOfflineMaps}
          className="bg-white text-blue-600 border border-blue-300 hover:bg-blue-50 shadow-sm"
          title={`Download offline maps for ${userCity?.name || 'this area'}`}
        >
          <Download className="w-4 h-4 mr-1" />
          <MapPin className="w-4 h-4 mr-1" />
          <span className="text-xs">Get Offline</span>
        </Button>
      )}
    </div>
  );
}

export default OfflineMapIndicator;