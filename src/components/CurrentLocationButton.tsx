import React, { useState, useEffect } from 'react';
import { MapPin, Navigation2, Locate, Crosshair } from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { cn } from './ui/utils';
import { toast } from 'sonner';
import { logger } from '../utils/logger';

interface CurrentLocationButtonProps {
  transportMode: 'walking' | 'driving' | 'cycling' | 'transit';
  isTracking: boolean;
  accuracy: number | null; // in meters
  onCenterLocation: () => void;
  onToggleTracking: () => void;
  className?: string;
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
}

const TRANSPORT_EMOJIS = {
  walking: '🚶',
  driving: '🚗',
  cycling: '🚴',
  transit: '🚌'
};

const TRANSPORT_COLORS = {
  walking: '#10B981', // green
  driving: '#3B82F6', // blue
  cycling: '#8B5CF6', // purple
  transit: '#F59E0B'  // amber
};

const getAccuracyLevel = (accuracy: number | null): 'high' | 'medium' | 'low' | 'unknown' => {
  if (!accuracy) return 'unknown';
  if (accuracy <= 5) return 'high';
  if (accuracy <= 20) return 'medium';
  return 'low';
};

const getAccuracyColor = (level: 'high' | 'medium' | 'low' | 'unknown') => {
  switch (level) {
    case 'high': return '#10B981'; // green
    case 'medium': return '#F59E0B'; // amber
    case 'low': return '#EF4444'; // red
    default: return '#9CA3AF'; // gray
  }
};

export function CurrentLocationButton({
  transportMode,
  isTracking,
  accuracy,
  onCenterLocation,
  onToggleTracking,
  className,
  position = 'bottom-right'
}: CurrentLocationButtonProps) {
  const [isPulsing, setIsPulsing] = useState(false);
  const [showAccuracy, setShowAccuracy] = useState(false);
  
  const accuracyLevel = getAccuracyLevel(accuracy);
  const accuracyColor = getAccuracyColor(accuracyLevel);
  const transportEmoji = TRANSPORT_EMOJIS[transportMode];
  const transportColor = TRANSPORT_COLORS[transportMode];

  // Position classes based on prop
  const positionClasses = {
    'top-left': 'top-4 left-4',
    'top-right': 'top-4 right-4',
    'bottom-left': 'bottom-20 left-4',
    'bottom-right': 'bottom-20 right-4'
  };

  const handleClick = () => {
    setIsPulsing(true);
    onCenterLocation();
    
    // Show toast with current mode
    toast.success(`Centering on current location (${transportMode} mode)`);
    
    // Reset pulse animation
    setTimeout(() => setIsPulsing(false), 1000);
    
    logger.info('Current location button clicked', { transportMode, isTracking });
  };

  const handleLongPress = () => {
    onToggleTracking();
    toast.info(isTracking ? 'Location tracking disabled' : 'Location tracking enabled');
  };

  // Handle long press for tracking toggle
  useEffect(() => {
    let pressTimer: NodeJS.Timeout;
    const button = document.getElementById('current-location-btn');
    
    if (!button) return;

    const handleMouseDown = () => {
      pressTimer = setTimeout(handleLongPress, 500);
    };

    const handleMouseUp = () => {
      clearTimeout(pressTimer);
    };

    button.addEventListener('mousedown', handleMouseDown);
    button.addEventListener('mouseup', handleMouseUp);
    button.addEventListener('mouseleave', handleMouseUp);
    button.addEventListener('touchstart', handleMouseDown);
    button.addEventListener('touchend', handleMouseUp);

    return () => {
      button.removeEventListener('mousedown', handleMouseDown);
      button.removeEventListener('mouseup', handleMouseUp);
      button.removeEventListener('mouseleave', handleMouseUp);
      button.removeEventListener('touchstart', handleMouseDown);
      button.removeEventListener('touchend', handleMouseUp);
      clearTimeout(pressTimer);
    };
  }, [isTracking]);

  return (
    <div className={cn('relative flex flex-col items-center gap-2', className)}>
      {/* Main Location Button */}
      <div className="relative">
        <Button
          id="current-location-btn"
          size="icon"
          variant="outline"
          onClick={handleClick}
          onMouseEnter={() => setShowAccuracy(true)}
          onMouseLeave={() => setShowAccuracy(false)}
          className={cn(
            'relative w-16 h-16 bg-white shadow-xl border-0 rounded-full transition-all duration-300 hover:scale-105 hover:shadow-2xl',
            isPulsing && 'animate-pulse ring-4 ring-blue-400 ring-opacity-50',
            isTracking && 'ring-2 ring-offset-2',
            'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2'
          )}
          style={{ 
            ringColor: isTracking ? transportColor : undefined,
            boxShadow: isTracking 
              ? `0 8px 32px rgba(0,0,0,0.12), 0 0 0 2px ${transportColor}20` 
              : '0 8px 32px rgba(0,0,0,0.12)'
          }}
        >
          {/* Transport Mode Emoji */}
          <span 
            className="text-3xl absolute inset-0 flex items-center justify-center filter drop-shadow-sm"
            style={{ textShadow: '0 1px 3px rgba(0,0,0,0.3)' }}
          >
            {transportEmoji}
          </span>
          
          {/* Tracking Indicator */}
          {isTracking && (
            <div 
              className="absolute -top-1 -right-1 w-3 h-3 rounded-full animate-pulse"
              style={{ backgroundColor: transportColor }}
            />
          )}
        </Button>

        {/* Accuracy Ring (shows on hover or when tracking) */}
        {(showAccuracy || isTracking) && accuracy && (
          <div 
            className={cn(
              'absolute inset-0 rounded-full pointer-events-none transition-all duration-300',
              'ring-2 ring-offset-2'
            )}
            style={{
              ringColor: accuracyColor,
              transform: `scale(${1 + (accuracy / 100)})`,
              opacity: 0.3
            }}
          />
        )}
      </div>

      {/* Accuracy Badge */}
      {showAccuracy && accuracy && (
        <Badge 
          variant="secondary"
          className="absolute -bottom-8 whitespace-nowrap text-xs"
          style={{ backgroundColor: `${accuracyColor}20`, color: accuracyColor }}
        >
          ±{accuracy.toFixed(0)}m accuracy
        </Badge>
      )}

      {/* Transport Mode Label */}
      <Badge 
        variant="outline"
        className="text-xs capitalize"
        style={{ borderColor: transportColor, color: transportColor }}
      >
        {transportMode}
      </Badge>
    </div>
  );
}