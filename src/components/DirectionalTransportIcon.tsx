import React from 'react';

interface DirectionalTransportIconProps {
  transportMode: 'walking' | 'cycling' | 'driving' | 'transit';
  heading: number; // 0-360 degrees (0 = North)
  size?: number;
  className?: string;
  showCompass?: boolean;
  isMoving?: boolean;
  speed?: number; // m/s
}

export function DirectionalTransportIcon({
  transportMode,
  heading,
  size = 32,
  className = '',
  showCompass = false,
  isMoving = false,
  speed = 0
}: DirectionalTransportIconProps) {
  
  // Convert heading to CSS rotation (0° = North = up)
  const rotation = heading;
  
  // Determine if we should animate based on movement
  const shouldAnimate = isMoving && speed > 0.5;
  
  // Get transport mode colors and icons
  const getTransportConfig = () => {
    switch (transportMode) {
      case 'walking':
        return {
          color: '#10B981', // emerald-500
          bgColor: '#D1FAE5', // emerald-100
          icon: '🚶',
          name: 'Walking'
        };
      case 'cycling':
        return {
          color: '#8B5CF6', // violet-500
          bgColor: '#EDE9FE', // violet-100
          icon: '🚴',
          name: 'Cycling'
        };
      case 'driving':
        return {
          color: '#3B82F6', // blue-500
          bgColor: '#DBEAFE', // blue-100
          icon: '🚗',
          name: 'Driving'
        };
      case 'transit':
        return {
          color: '#F59E0B', // amber-500
          bgColor: '#FEF3C7', // amber-100
          icon: '🚌',
          name: 'Transit'
        };
      default:
        return {
          color: '#6B7280', // gray-500
          bgColor: '#F3F4F6', // gray-100
          icon: '📍',
          name: 'Location'
        };
    }
  };

  const config = getTransportConfig();

  // Create SVG directional arrow based on transport mode
  const getDirectionalSVG = () => {
    const arrowColor = config.color;
    const shadowOpacity = shouldAnimate ? 0.4 : 0.2;
    
    switch (transportMode) {
      case 'walking':
        // Walking person icon with directional arrow
        return (
          <svg width={size} height={size} viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
            {/* Background circle */}
            <circle
              cx="16"
              cy="16"
              r="14"
              fill={config.bgColor}
              stroke={config.color}
              strokeWidth="2"
              opacity="0.9"
            />
            
            {/* Direction arrow */}
            <path
              d="M16 6 L12 10 L14 10 L14 16 L18 16 L18 10 L20 10 Z"
              fill={arrowColor}
              stroke="white"
              strokeWidth="0.5"
            />
            
            {/* Walking person */}
            <text
              x="16"
              y="24"
              textAnchor="middle"
              fontSize="10"
              fill={arrowColor}
            >
              🚶
            </text>
            
            {/* Movement animation */}
            {shouldAnimate && (
              <circle
                cx="16"
                cy="16"
                r="16"
                fill="none"
                stroke={arrowColor}
                strokeWidth="1"
                opacity="0.3"
                strokeDasharray="4 4"
              >
                <animateTransform
                  attributeName="transform"
                  type="rotate"
                  values="0 16 16;360 16 16"
                  dur="3s"
                  repeatCount="indefinite"
                />
              </circle>
            )}
          </svg>
        );

      case 'cycling':
        return (
          <svg width={size} height={size} viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
            <circle
              cx="16"
              cy="16"
              r="14"
              fill={config.bgColor}
              stroke={config.color}
              strokeWidth="2"
              opacity="0.9"
            />
            
            <path
              d="M16 4 L12 8 L14 8 L14 14 L18 14 L18 8 L20 8 Z"
              fill={arrowColor}
              stroke="white"
              strokeWidth="0.5"
            />
            
            <text
              x="16"
              y="26"
              textAnchor="middle"
              fontSize="10"
            >
              🚴
            </text>
            
            {shouldAnimate && (
              <circle
                cx="16"
                cy="16"
                r="15"
                fill="none"
                stroke={arrowColor}
                strokeWidth="2"
                opacity="0.5"
                strokeDasharray="8 8"
              >
                <animateTransform
                  attributeName="transform"
                  type="rotate"
                  values="0 16 16;360 16 16"
                  dur="2s"
                  repeatCount="indefinite"
                />
              </circle>
            )}
          </svg>
        );

      case 'driving':
        return (
          <svg width={size} height={size} viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
            <circle
              cx="16"
              cy="16"
              r="14"
              fill={config.bgColor}
              stroke={config.color}
              strokeWidth="2"
              opacity="0.9"
            />
            
            {/* Car direction arrow */}
            <path
              d="M16 3 L10 9 L13 9 L13 16 L19 16 L19 9 L22 9 Z"
              fill={arrowColor}
              stroke="white"
              strokeWidth="0.5"
            />
            
            <text
              x="16"
              y="26"
              textAnchor="middle"
              fontSize="10"
            >
              🚗
            </text>
            
            {shouldAnimate && (
              <>
                <circle
                  cx="16"
                  cy="16"
                  r="17"
                  fill="none"
                  stroke={arrowColor}
                  strokeWidth="1"
                  opacity="0.3"
                  strokeDasharray="6 6"
                >
                  <animateTransform
                    attributeName="transform"
                    type="rotate"
                    values="0 16 16;360 16 16"
                    dur="1.5s"
                    repeatCount="indefinite"
                  />
                </circle>
                
                {/* Speed lines for fast movement */}
                {speed > 10 && (
                  <g opacity="0.6">
                    <line x1="8" y1="16" x2="4" y2="16" stroke={arrowColor} strokeWidth="2" />
                    <line x1="24" y1="16" x2="28" y2="16" stroke={arrowColor} strokeWidth="2" />
                    <line x1="16" y1="8" x2="16" y2="4" stroke={arrowColor} strokeWidth="2" />
                  </g>
                )}
              </>
            )}
          </svg>
        );

      case 'transit':
        return (
          <svg width={size} height={size} viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
            <circle
              cx="16"
              cy="16"
              r="14"
              fill={config.bgColor}
              stroke={config.color}
              strokeWidth="2"
              opacity="0.9"
            />
            
            <path
              d="M16 5 L11 10 L13 10 L13 15 L19 15 L19 10 L21 10 Z"
              fill={arrowColor}
              stroke="white"
              strokeWidth="0.5"
            />
            
            <text
              x="16"
              y="25"
              textAnchor="middle"
              fontSize="9"
            >
              🚌
            </text>
            
            {shouldAnimate && (
              <rect
                x="4"
                y="4"
                width="24"
                height="24"
                fill="none"
                stroke={arrowColor}
                strokeWidth="1"
                opacity="0.4"
                strokeDasharray="3 3"
                rx="12"
              >
                <animateTransform
                  attributeName="transform"
                  type="rotate"
                  values="0 16 16;360 16 16"
                  dur="4s"
                  repeatCount="indefinite"
                />
              </rect>
            )}
          </svg>
        );

      default:
        return (
          <svg width={size} height={size} viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
            <circle
              cx="16"
              cy="16"
              r="14"
              fill="#F3F4F6"
              stroke="#6B7280"
              strokeWidth="2"
            />
            <text x="16" y="20" textAnchor="middle" fontSize="16">📍</text>
          </svg>
        );
    }
  };

  return (
    <div className={`relative inline-flex items-center justify-center ${className}`}>
      {/* Compass background (optional) */}
      {showCompass && (
        <div 
          className="absolute inset-0 rounded-full border-2 border-gray-300 opacity-20"
          style={{ 
            background: 'conic-gradient(from 0deg, transparent, rgba(0,0,0,0.1), transparent)' 
          }}
        />
      )}
      
      {/* Main directional icon */}
      <div
        className={`transform transition-transform duration-500 ease-out ${shouldAnimate ? 'scale-110' : 'scale-100'}`}
        style={{
          transform: `rotate(${rotation}deg) ${shouldAnimate ? 'scale(1.1)' : 'scale(1.0)'}`,
          filter: shouldAnimate ? `drop-shadow(0 0 8px ${config.color}40)` : 'none'
        }}
      >
        {getDirectionalSVG()}
      </div>
      
      {/* Speed indicator */}
      {isMoving && speed > 0.5 && (
        <div
          className="absolute -bottom-1 -right-1 px-1 py-0.5 bg-black bg-opacity-75 text-white text-xs rounded"
          style={{ fontSize: '9px' }}
        >
          {(speed * 3.6).toFixed(0)} km/h
        </div>
      )}
      
      {/* Compass directions (optional) */}
      {showCompass && (
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-full text-xs font-bold text-gray-600">
            N
          </div>
          <div className="absolute right-0 top-1/2 transform translate-x-full -translate-y-1/2 text-xs font-bold text-gray-600">
            E
          </div>
          <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-full text-xs font-bold text-gray-600">
            S
          </div>
          <div className="absolute left-0 top-1/2 transform -translate-x-full -translate-y-1/2 text-xs font-bold text-gray-600">
            W
          </div>
        </div>
      )}
      
      {/* Heading display */}
      <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 text-xs font-mono text-gray-600 bg-white px-1 rounded shadow">
        {Math.round(heading)}°
      </div>
    </div>
  );
}

export default DirectionalTransportIcon;