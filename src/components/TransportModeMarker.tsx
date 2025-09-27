import React from 'react';
import { cn } from './ui/utils';

interface TransportModeMarkerProps {
  mode: 'walking' | 'driving' | 'cycling' | 'transit';
  lat: number;
  lng: number;
  heading?: number; // Direction in degrees (0-360)
  speed?: number; // Speed in m/s
  accuracy?: number; // Accuracy in meters
  isActive?: boolean;
  className?: string;
}

// Transport mode configurations
const TRANSPORT_CONFIG = {
  walking: {
    emoji: '🚶',
    alternateEmoji: '🚶‍♂️',
    femaleEmoji: '🚶‍♀️',
    size: 'text-3xl',
    accuracyMultiplier: 1.2,
    minSpeed: 0,
    maxSpeed: 2, // ~7.2 km/h
    pulseColor: 'rgba(16, 185, 129, 0.4)', // green
    bgColor: '#10B981'
  },
  driving: {
    emoji: '🚗',
    alternateEmoji: '🚙',
    luxuryEmoji: '🏎️',
    size: 'text-3xl',
    accuracyMultiplier: 1.5,
    minSpeed: 2,
    maxSpeed: 30, // ~108 km/h
    pulseColor: 'rgba(59, 130, 246, 0.4)', // blue
    bgColor: '#3B82F6'
  },
  cycling: {
    emoji: '🚴',
    alternateEmoji: '🚴‍♂️',
    femaleEmoji: '🚴‍♀️',
    size: 'text-3xl',
    accuracyMultiplier: 1.3,
    minSpeed: 1,
    maxSpeed: 8, // ~28.8 km/h
    pulseColor: 'rgba(139, 92, 246, 0.4)', // purple
    bgColor: '#8B5CF6'
  },
  transit: {
    emoji: '🚌',
    alternateEmoji: '🚊',
    trainEmoji: '🚆',
    size: 'text-3xl',
    accuracyMultiplier: 2.0,
    minSpeed: 0,
    maxSpeed: 20, // ~72 km/h
    pulseColor: 'rgba(245, 158, 11, 0.4)', // amber
    bgColor: '#F59E0B'
  }
};

// Helper to get the appropriate emoji based on speed
const getTransportEmoji = (mode: 'walking' | 'driving' | 'cycling' | 'transit', speed?: number) => {
  const config = TRANSPORT_CONFIG[mode];
  
  if (mode === 'driving' && speed) {
    // Show luxury car for high speeds
    if (speed > 25) return config.luxuryEmoji || config.emoji;
    if (speed > 15) return config.alternateEmoji || config.emoji;
  }
  
  if (mode === 'transit' && speed) {
    // Show train for higher speeds
    if (speed > 15) return config.trainEmoji || config.emoji;
    if (speed > 8) return config.alternateEmoji || config.emoji;
  }
  
  // For walking and cycling, randomly alternate for variety
  if (mode === 'walking' || mode === 'cycling') {
    const emojis = [config.emoji, config.alternateEmoji, config.femaleEmoji].filter(Boolean);
    return emojis[Math.floor(Date.now() / 5000) % emojis.length];
  }
  
  return config.emoji;
};

export function TransportModeMarker({
  mode,
  lat,
  lng,
  heading = 0,
  speed = 0,
  accuracy = 10,
  isActive = true,
  className
}: TransportModeMarkerProps) {
  const config = TRANSPORT_CONFIG[mode];
  const emoji = getTransportEmoji(mode, speed);
  
  // Calculate accuracy radius (larger radius for lower accuracy)
  const accuracyRadius = accuracy * config.accuracyMultiplier;
  
  // Determine if moving based on speed
  const isMoving = speed > 0.5; // > 1.8 km/h
  
  return (
    <div 
      className={cn('relative flex items-center justify-center', className)}
      style={{ 
        transform: `translate(-50%, -50%)`,
        zIndex: isActive ? 1000 : 100
      }}
    >
      {/* Accuracy circle */}
      {isActive && (
        <div
          className="absolute rounded-full animate-pulse"
          style={{
            width: `${Math.min(accuracyRadius * 2, 200)}px`,
            height: `${Math.min(accuracyRadius * 2, 200)}px`,
            backgroundColor: config.pulseColor,
            opacity: accuracy > 20 ? 0.2 : 0.3,
            transform: 'translate(-50%, -50%)',
            top: '50%',
            left: '50%'
          }}
        />
      )}
      
      {/* Direction indicator (shows when moving) */}
      {isMoving && heading !== undefined && (
        <div
          className="absolute w-0 h-0"
          style={{
            borderLeft: '8px solid transparent',
            borderRight: '8px solid transparent',
            borderBottom: `20px solid ${config.bgColor}`,
            transform: `rotate(${heading}deg) translateY(-25px)`,
            opacity: 0.6
          }}
        />
      )}
      
      {/* Main marker container */}
      <div 
        className={cn(
          'relative bg-white rounded-full shadow-lg border-2 flex items-center justify-center',
          isActive && 'ring-4 ring-opacity-30',
          isMoving && 'animate-bounce'
        )}
        style={{
          borderColor: config.bgColor,
          ringColor: config.bgColor,
          width: '48px',
          height: '48px',
          transform: isMoving ? `rotate(${heading - 90}deg)` : 'none',
          transition: 'transform 0.3s ease'
        }}
      >
        {/* Transport emoji */}
        <span 
          className={cn(config.size, 'select-none')}
          style={{ 
            transform: isMoving ? `rotate(${90 - heading}deg)` : 'none',
            transition: 'transform 0.3s ease'
          }}
        >
          {emoji}
        </span>
        
        {/* Speed indicator (small badge) */}
        {isMoving && speed > 0 && (
          <div 
            className="absolute -bottom-1 -right-1 bg-white rounded-full px-1 text-xs font-bold shadow-sm"
            style={{ 
              color: config.bgColor,
              fontSize: '10px',
              minWidth: '20px',
              textAlign: 'center'
            }}
          >
            {Math.round(speed * 3.6)}
          </div>
        )}
      </div>
      
      {/* Status dot */}
      {isActive && (
        <div 
          className="absolute top-0 right-0 w-3 h-3 rounded-full animate-pulse"
          style={{ 
            backgroundColor: isMoving ? '#10B981' : config.bgColor,
            border: '2px solid white'
          }}
        />
      )}
    </div>
  );
}

// HTML marker for map libraries that need string HTML
export function getTransportModeMarkerHTML(
  mode: 'walking' | 'driving' | 'cycling' | 'transit',
  options: {
    heading?: number;
    speed?: number;
    accuracy?: number;
    isActive?: boolean;
  } = {}
): string {
  const { heading = 0, speed = 0, accuracy = 10, isActive = true } = options;
  const config = TRANSPORT_CONFIG[mode];
  const emoji = getTransportEmoji(mode, speed);
  const isMoving = speed > 0.5;
  const accuracyRadius = accuracy * config.accuracyMultiplier;

  return `
    <div style="
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      transform: translate(-50%, -50%);
      z-index: ${isActive ? 1000 : 100};
    ">
      ${isActive ? `
        <div style="
          position: absolute;
          width: ${Math.min(accuracyRadius * 2, 200)}px;
          height: ${Math.min(accuracyRadius * 2, 200)}px;
          border-radius: 50%;
          background-color: ${config.pulseColor};
          opacity: ${accuracy > 20 ? 0.2 : 0.3};
          animation: pulse 2s infinite;
          transform: translate(-50%, -50%);
          top: 50%;
          left: 50%;
        "></div>
      ` : ''}
      
      ${isMoving && heading !== undefined ? `
        <div style="
          position: absolute;
          width: 0;
          height: 0;
          border-left: 8px solid transparent;
          border-right: 8px solid transparent;
          border-bottom: 20px solid ${config.bgColor};
          transform: rotate(${heading}deg) translateY(-25px);
          opacity: 0.6;
        "></div>
      ` : ''}
      
      <div style="
        position: relative;
        background: white;
        border-radius: 50%;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        border: 2px solid ${config.bgColor};
        width: 48px;
        height: 48px;
        display: flex;
        align-items: center;
        justify-content: center;
        transform: ${isMoving ? `rotate(${heading - 90}deg)` : 'none'};
        transition: transform 0.3s ease;
        ${isActive ? `box-shadow: 0 0 0 4px ${config.pulseColor};` : ''}
      ">
        <span style="
          font-size: 24px;
          transform: ${isMoving ? `rotate(${90 - heading}deg)` : 'none'};
          transition: transform 0.3s ease;
          user-select: none;
        ">${emoji}</span>
        
        ${isMoving && speed > 0 ? `
          <div style="
            position: absolute;
            bottom: -2px;
            right: -2px;
            background: white;
            border-radius: 50%;
            padding: 0 4px;
            font-size: 10px;
            font-weight: bold;
            color: ${config.bgColor};
            box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
            min-width: 20px;
            text-align: center;
          ">${Math.round(speed * 3.6)}</div>
        ` : ''}
      </div>
      
      ${isActive ? `
        <div style="
          position: absolute;
          top: 0;
          right: 0;
          width: 12px;
          height: 12px;
          border-radius: 50%;
          background-color: ${isMoving ? '#10B981' : config.bgColor};
          border: 2px solid white;
          animation: pulse 1.5s infinite;
        "></div>
      ` : ''}
    </div>
    
    <style>
      @keyframes pulse {
        0% { opacity: 1; transform: scale(1); }
        50% { opacity: 0.7; transform: scale(1.1); }
        100% { opacity: 1; transform: scale(1); }
      }
    </style>
  `;
}