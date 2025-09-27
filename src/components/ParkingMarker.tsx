import React from 'react';

interface ParkingMarkerProps {
  type: 'street' | 'garage' | 'lot' | 'valet';
  availability: number;
  price?: string;
  size?: 'small' | 'medium' | 'large';
  isSelected?: boolean;
  onClick?: () => void;
}

export function ParkingMarker({ 
  type, 
  availability, 
  price,
  size = 'medium',
  isSelected = false,
  onClick 
}: ParkingMarkerProps) {
  const getTypeIcon = (parkingType: string) => {
    switch (parkingType) {
      case 'street': return '🚗';
      case 'garage': return '🏢';
      case 'lot': return '🅿️';
      case 'valet': return '🎩';
      default: return '🚗';
    }
  };

  const getAvailabilityColor = (availability: number) => {
    if (availability > 70) return '#10b981'; // green
    if (availability > 30) return '#f59e0b'; // amber
    return '#ef4444'; // red
  };

  const getSizeClasses = (size: string) => {
    switch (size) {
      case 'small': return 'w-8 h-8 text-xs';
      case 'large': return 'w-16 h-16 text-lg';
      default: return 'w-12 h-12 text-sm';
    }
  };

  return (
    <div
      className={`
        relative cursor-pointer transition-all duration-200 transform hover:scale-110
        ${isSelected ? 'scale-125 z-50' : 'z-10'}
      `}
      onClick={onClick}
    >
      {/* Main marker background */}
      <div
        className={`
          ${getSizeClasses(size)} 
          rounded-full border-2 border-white shadow-lg flex items-center justify-center
          font-bold text-white
          ${isSelected ? 'ring-4 ring-blue-400 ring-opacity-50' : ''}
        `}
        style={{
          backgroundColor: getAvailabilityColor(availability),
        }}
      >
        <span className="text-lg leading-none">
          {getTypeIcon(type)}
        </span>
      </div>

      {/* Availability badge */}
      <div
        className="absolute -top-1 -right-1 w-5 h-5 bg-white rounded-full border border-gray-200 flex items-center justify-center text-xs font-bold"
        style={{ color: getAvailabilityColor(availability) }}
      >
        {Math.round(availability / 10)}
      </div>

      {/* Price badge */}
      {price && (
        <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 bg-white px-1.5 py-0.5 rounded text-xs font-semibold border border-gray-200 shadow-sm">
          {price}
        </div>
      )}

      {/* Pulsing effect for selected marker */}
      {isSelected && (
        <div
          className="absolute inset-0 rounded-full animate-ping opacity-30"
          style={{
            backgroundColor: getAvailabilityColor(availability),
          }}
        />
      )}
    </div>
  );
}

// SVG version for Google Maps overlay
export function createParkingMarkerSVG(type: string, availability: number, price?: string): string {
  const icon = type === 'street' ? '🚗' : type === 'garage' ? '🏢' : type === 'lot' ? '🅿️' : '🚗';
  const color = availability > 70 ? '#10b981' : availability > 30 ? '#f59e0b' : '#ef4444';
  const availabilityText = Math.round(availability / 10);
  
  return `
    <svg width="48" height="60" viewBox="0 0 48 60" xmlns="http://www.w3.org/2000/svg">
      <!-- Main marker circle -->
      <circle cx="24" cy="24" r="20" fill="${color}" stroke="white" stroke-width="3" />
      
      <!-- Icon -->
      <text x="24" y="30" text-anchor="middle" font-size="16" fill="white">
        ${icon}
      </text>
      
      <!-- Availability badge -->
      <circle cx="36" cy="12" r="8" fill="white" stroke="#e5e7eb" stroke-width="1" />
      <text x="36" y="16" text-anchor="middle" font-size="10" font-weight="bold" fill="${color}">
        ${availabilityText}
      </text>
      
      <!-- Price badge -->
      ${price ? `
        <rect x="8" y="44" width="32" height="12" rx="6" fill="white" stroke="#e5e7eb" stroke-width="1" />
        <text x="24" y="52" text-anchor="middle" font-size="8" font-weight="bold" fill="#374151">
          ${price}
        </text>
      ` : ''}
      
      <!-- Bottom point -->
      <path d="M24 44 L30 54 L18 54 Z" fill="${color}" />
    </svg>
  `;
}