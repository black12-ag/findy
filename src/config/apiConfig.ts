/**
 * 🗺️ Google Maps API Configuration
 * 
 * Complete configuration for Google Maps APIs
 * with quota management and caching strategies
 */

// API Key from environment variables
export const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

// Validate API key availability
if (!GOOGLE_MAPS_API_KEY) {
  console.warn('⚠️ Google Maps API key not found. Please set VITE_GOOGLE_MAPS_API_KEY in your environment variables.');
}

// Google Maps JavaScript API configuration
export const GOOGLE_MAPS_CONFIG = {
  apiKey: GOOGLE_MAPS_API_KEY,
  version: 'weekly',
  libraries: ['places', 'geometry', 'directions'] as const,
  language: 'en',
  region: 'US'
};

// API Services Configuration
export const API_SERVICES = {
  // 🧭 DIRECTIONS API - Navigation functionality
  DIRECTIONS: {
    name: 'Google Directions API',
    quota: {
      daily: 25000, // Google's generous free tier
      perMinute: 50,
      current: 0,
      reset: null
    },
    travelModes: {
      DRIVING: 'DRIVING',
      WALKING: 'WALKING', 
      BICYCLING: 'BICYCLING',
      TRANSIT: 'TRANSIT'
    }
  },

  // 🔍 PLACES API - Search and place details
  PLACES: {
    name: 'Google Places API',
    quota: {
      daily: 3000, // Per Google's free tier
      perMinute: 100,
      current: 0,
      reset: null
    },
    searchTypes: {
      TEXT_SEARCH: 'textSearch',
      NEARBY_SEARCH: 'nearbySearch',
      PLACE_DETAILS: 'getDetails',
      AUTOCOMPLETE: 'getPlacePredictions'
    }
  },

  // 📍 GEOCODING API - Address to coordinates conversion
  GEOCODING: {
    name: 'Google Geocoding API',
    quota: {
      daily: 2500,
      perMinute: 50,
      current: 0,
      reset: null
    }
  },

  // 📊 DISTANCE MATRIX API - Route comparison
  DISTANCE_MATRIX: {
    name: 'Google Distance Matrix API',
    quota: {
      daily: 25000,
      perMinute: 100,
      current: 0,
      reset: null
    }
  }
} as const;

// Request timeout configuration
export const REQUEST_TIMEOUT = {
  DEFAULT: 10000, // 10 seconds
  DIRECTIONS: 15000, // 15 seconds for complex routes
  PLACES: 8000, // 8 seconds for place searches
  GEOCODING: 5000 // 5 seconds for geocoding
};

// Error codes and messages
export const API_ERRORS = {
  QUOTA_EXCEEDED: {
    code: 'QUOTA_EXCEEDED',
    message: 'Google Maps API quota exceeded. Using cached data.',
    fallbackAvailable: true
  },
  NETWORK_ERROR: {
    code: 'NETWORK_ERROR',
    message: 'Network connection failed. Please check your internet.',
    fallbackAvailable: false
  },
  INVALID_REQUEST: {
    code: 'INVALID_REQUEST',
    message: 'Invalid request parameters.',
    fallbackAvailable: false
  },
  API_KEY_INVALID: {
    code: 'API_KEY_INVALID',
    message: 'Invalid or missing Google Maps API key.',
    fallbackAvailable: false
  },
  SERVICE_ERROR: {
    code: 'SERVICE_ERROR',
    message: 'Google Maps service temporarily unavailable.',
    fallbackAvailable: true
  }
} as const;

// Cache configuration
export const CACHE_CONFIG = {
  TTL: {
    DIRECTIONS: 5 * 60 * 1000, // 5 minutes
    PLACES: 24 * 60 * 60 * 1000, // 24 hours
    GEOCODING: 24 * 60 * 60 * 1000, // 24 hours
    DISTANCE_MATRIX: 10 * 60 * 1000 // 10 minutes
  },
  MAX_SIZE: 200 // Maximum cached items per type
};

// Map display options
export const MAP_OPTIONS = {
  zoom: 15,
  center: { lat: 37.7749, lng: -122.4194 }, // San Francisco default
  disableDefaultUI: false,
  zoomControl: true,
  mapTypeControl: true,
  scaleControl: true,
  streetViewControl: true,
  rotateControl: true,
  fullscreenControl: true,
  mapTypeId: 'roadmap' as const,
  styles: [] // Can be customized for dark mode, etc.
};

// Export types for TypeScript
export type APIServiceType = keyof typeof API_SERVICES;
export type GoogleTravelMode = 'DRIVING' | 'WALKING' | 'BICYCLING' | 'TRANSIT';
export type PlaceSearchType = 'textSearch' | 'nearbySearch' | 'getDetails' | 'getPlacePredictions';

// Feature flags for Google Maps functionality
export const FEATURES = {
  TRAFFIC_LAYER: true,
  TRANSIT_LAYER: true,
  BICYCLING_LAYER: true,
  STREET_VIEW: true,
  PLACE_PHOTOS: true,
  AUTOCOMPLETE: true,
  DIRECTIONS_ALTERNATIVES: true
};