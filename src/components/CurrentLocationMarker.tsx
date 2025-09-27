import React from 'react';
import { cn } from './ui/utils';

interface CurrentLocationMarkerProps {
  transportMode: 'walking' | 'driving' | 'cycling' | 'transit';
  accuracy?: number; // in meters
  isTracking?: boolean;
  speed?: number; // in m/s
  heading?: number; // in degrees
  className?: string;
}

const TRANSPORT_CONFIG = {
  walking: {
    emoji: '🚶‍♂️',
    color: '#10B981',
    pulseColor: 'rgba(16, 185, 129, 0.3)',
    shadowColor: 'rgba(16, 185, 129, 0.5)'
  },
  driving: {
    emoji: '🚗',
    color: '#3B82F6',
    pulseColor: 'rgba(59, 130, 246, 0.3)',
    shadowColor: 'rgba(59, 130, 246, 0.5)'
  },
  cycling: {
    emoji: '🚴‍♂️',
    color: '#8B5CF6',
    pulseColor: 'rgba(139, 92, 246, 0.3)',
    shadowColor: 'rgba(139, 92, 246, 0.5)'
  },
  transit: {
    emoji: '🚌',
    color: '#F59E0B',
    pulseColor: 'rgba(245, 158, 11, 0.3)',
    shadowColor: 'rgba(245, 158, 11, 0.5)'
  }
};

export function CurrentLocationMarker({
  transportMode,
  accuracy = 10,
  isTracking = true,
  speed = 0,
  heading = 0,
  className
}: CurrentLocationMarkerProps) {
  const config = TRANSPORT_CONFIG[transportMode];
  const isMoving = speed > 0.5; // > 1.8 km/h
  const accuracyRadius = Math.min(accuracy * 2, 100); // Cap radius for very inaccurate readings

  return (
    <div 
      className={cn('relative flex items-center justify-center', className)}
      style={{ 
        width: '60px',
        height: '60px',
        transform: 'translate(-50%, -50%)'
      }}
    >
      {/* Accuracy Circle - Outermost */}
      {isTracking && accuracy > 5 && (
        <div
          className="absolute rounded-full animate-pulse"
          style={{
            width: `${accuracyRadius}px`,
            height: `${accuracyRadius}px`,
            backgroundColor: config.pulseColor,
            opacity: accuracy > 20 ? 0.15 : 0.25,
            transform: 'translate(-50%, -50%)',
            top: '50%',
            left: '50%'
          }}
        />
      )}

      {/* GPS Pulse Ring - Middle */}
      {isTracking && (
        <div
          className="absolute rounded-full animate-ping"
          style={{
            width: '50px',
            height: '50px',
            backgroundColor: config.pulseColor,
            opacity: 0.4,
            transform: 'translate(-50%, -50%)',
            top: '50%',
            left: '50%',
            animationDuration: '2s'
          }}
        />
      )}

      {/* Direction Arrow - Shows when moving */}
      {isMoving && (
        <div
          className="absolute"
          style={{
            width: '0',
            height: '0',
            borderLeft: '6px solid transparent',
            borderRight: '6px solid transparent',
            borderBottom: `16px solid ${config.color}`,
            transform: `rotate(${heading}deg) translateY(-35px)`,
            transformOrigin: 'center bottom',
            opacity: 0.8,
            filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))'
          }}
        />
      )}

      {/* Main Location Dot */}
      <div
        className="relative z-10 rounded-full shadow-lg"
        style={{
          width: '40px',
          height: '40px',
          backgroundColor: 'white',
          border: `3px solid ${config.color}`,
          boxShadow: `0 0 0 3px ${config.shadowColor}, 0 4px 12px rgba(0,0,0,0.15)`,
          ...(isTracking && {
            animation: 'pulse 2s infinite'
          })
        }}
      >
        {/* Inner Dot with Transport Emoji */}
        <div 
          className="absolute inset-0 rounded-full flex items-center justify-center"
          style={{
            backgroundColor: config.color,
            transform: isMoving ? `rotate(${heading - 90}deg)` : 'none',
            transition: 'transform 0.3s ease'
          }}
        >
          <span 
            className="text-white text-lg font-bold select-none"
            style={{
              transform: isMoving ? `rotate(${90 - heading}deg)` : 'none',
              transition: 'transform 0.3s ease',
              textShadow: '0 1px 2px rgba(0,0,0,0.3)'
            }}
          >
            {config.emoji}
          </span>
        </div>

        {/* Speed Badge - Shows when moving */}
        {isMoving && speed > 1 && (
          <div 
            className="absolute -bottom-2 -right-2 bg-white rounded-full px-1.5 py-0.5 text-xs font-bold shadow-md border"
            style={{ 
              color: config.color,
              borderColor: config.color,
              fontSize: '9px',
              minWidth: '18px',
              textAlign: 'center'
            }}
          >
            {Math.round(speed * 3.6)}
          </div>
        )}

        {/* Status Indicator Dot */}
        <div 
          className="absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-white shadow-sm"
          style={{ 
            backgroundColor: isTracking ? (isMoving ? '#10B981' : config.color) : '#9CA3AF',
            ...(isTracking && {
              animation: 'pulse 1.5s infinite'
            })
          }}
        />
      </div>

      {/* Custom CSS for animations */}
      <style jsx>{`
        @keyframes pulse {
          0% { 
            opacity: 1;
            transform: scale(1);
          }
          50% { 
            opacity: 0.8;
            transform: scale(1.05);
          }
          100% { 
            opacity: 1;
            transform: scale(1);
          }
        }
        
        @keyframes ping {
          75%, 100% {
            transform: translate(-50%, -50%) scale(2);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}

// SVG version for better quality
export function getCurrentLocationMarkerSVG(
  transportMode: 'walking' | 'driving' | 'cycling' | 'transit',
  options: {
    accuracy?: number;
    isTracking?: boolean;
    speed?: number;
    heading?: number;
  } = {}
): string {
  const { accuracy = 10, isTracking = true, speed = 0, heading = 0 } = options;
  const config = TRANSPORT_CONFIG[transportMode];
  const isMoving = speed > 0.5;
  
  return `
    <svg width="60" height="60" viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <!-- Gradient for main dot -->
        <radialGradient id="mainGradient" cx="50%" cy="30%" r="70%">
          <stop offset="0%" style="stop-color:white;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#f8f9fa;stop-opacity:1" />
        </radialGradient>
        
        <!-- Drop shadow filter -->
        <filter id="dropshadow" x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="rgba(0,0,0,0.2)"/>
        </filter>
        
        <!-- Glow effect -->
        <filter id="glow">
          <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
          <feMerge> 
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>
      
      <!-- Accuracy circle -->
      ${isTracking && accuracy > 5 ? `
        <circle 
          cx="30" 
          cy="30" 
          r="${Math.min(accuracy, 25)}"
          fill="${config.pulseColor}"
          opacity="${accuracy > 20 ? '0.15' : '0.25'}"
        >
          <animate attributeName="opacity" values="0.1;0.3;0.1" dur="2s" repeatCount="indefinite"/>
        </circle>
      ` : ''}
      
      <!-- GPS pulse ring -->
      ${isTracking ? `
        <circle 
          cx="30" 
          cy="30" 
          r="20"
          fill="none"
          stroke="${config.color}"
          stroke-width="2"
          opacity="0.5"
        >
          <animate attributeName="r" values="20;35;20" dur="2s" repeatCount="indefinite"/>
          <animate attributeName="opacity" values="0.5;0;0.5" dur="2s" repeatCount="indefinite"/>
        </circle>
      ` : ''}
      
      <!-- Direction arrow when moving -->
      ${isMoving ? `
        <polygon 
          points="30,10 26,20 34,20" 
          fill="${config.color}"
          opacity="0.8"
          filter="url(#dropshadow)"
          transform="rotate(${heading} 30 30)"
        />
      ` : ''}
      
      <!-- Main white circle with border -->
      <circle 
        cx="30" 
        cy="30" 
        r="16"
        fill="url(#mainGradient)"
        stroke="${config.color}"
        stroke-width="3"
        filter="url(#dropshadow)"
      >
        ${isTracking ? '<animate attributeName="stroke-width" values="3;4;3" dur="2s" repeatCount="indefinite"/>' : ''}
      </circle>
      
      <!-- Inner colored circle -->
      <circle 
        cx="30" 
        cy="30" 
        r="12"
        fill="${config.color}"
        filter="url(#glow)"
      />
      
      <!-- Transport mode emoji -->
      <text 
        x="30" 
        y="35" 
        text-anchor="middle" 
        fill="white" 
        font-size="14" 
        font-weight="bold"
        filter="url(#dropshadow)"
      >
        ${config.emoji}
      </text>
      
      <!-- Speed badge when moving -->
      ${isMoving && speed > 1 ? `
        <circle cx="42" cy="42" r="8" fill="white" stroke="${config.color}" stroke-width="1.5"/>
        <text x="42" y="45" text-anchor="middle" fill="${config.color}" font-size="8" font-weight="bold">
          ${Math.round(speed * 3.6)}
        </text>
      ` : ''}
      
      <!-- Status indicator -->
      <circle 
        cx="42" 
        cy="18" 
        r="4"
        fill="${isTracking ? (isMoving ? '#10B981' : config.color) : '#9CA3AF'}"
        stroke="white" 
        stroke-width="2"
        filter="url(#dropshadow)"
      >
        ${isTracking ? '<animate attributeName="opacity" values="1;0.5;1" dur="1.5s" repeatCount="indefinite"/>' : ''}
      </circle>
    </svg>
  `;
}