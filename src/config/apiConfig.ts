/**
 * 🗺️ OpenRouteService API Configuration
 * 
 * Complete configuration for all OpenRouteService endpoints
 * with quota management and fallback strategies
 */

// API Key from environment variables
export const ORS_API_KEY = import.meta.env.VITE_ORS_API_KEY || '';

// Validate API key availability
if (!ORS_API_KEY) {
  console.warn('⚠️ OpenRouteService API key not found. Please set VITE_ORS_API_KEY in your environment variables.');
}

// Base URL for all API calls
export const ORS_BASE_URL = 'https://api.openrouteservice.org';

// API Endpoints Configuration
export const API_ENDPOINTS = {
  // 🧭 DIRECTIONS API - Primary navigation functionality
  DIRECTIONS: {
    base: '/v2/directions',
    profiles: {
      DRIVING: 'driving-car',
      WALKING: 'foot-walking', 
      CYCLING: 'cycling-regular',
      HEAVY_VEHICLE: 'driving-hgv',
      WHEELCHAIR: 'wheelchair'
    },
    quota: {
      daily: 2000,
      perMinute: 40,
      current: 0, // Will be tracked dynamically
      reset: null // Will be set when quota resets
    }
  },

  // 🔍 GEOCODING API - Search and address lookup
  GEOCODING: {
    search: '/geocode/search',
    autocomplete: '/geocode/autocomplete', 
    reverse: '/geocode/reverse',
    quota: {
      daily: 1000,
      perMinute: 100,
      current: 0,
      reset: null
    }
  },

  // 📍 POINTS OF INTEREST API - Find nearby places
  POIS: {
    base: '/pois',
    categories: {
      RESTAURANTS: { id: 560, name: 'Restaurants' },
      GAS_STATIONS: { id: 470, name: 'Fuel' },
      HOSPITALS: { id: 360, name: 'Healthcare' },
      SHOPPING: { id: 600, name: 'Shopping' },
      ATM: { id: 510, name: 'Financial' },
      HOTELS: { id: 580, name: 'Accommodation' },
      TOURISM: { id: 590, name: 'Tourism' },
      PARKING: { id: 480, name: 'Parking' }
    },
    quota: {
      daily: 500,
      perMinute: 60,
      current: 0,
      reset: null
    }
  },

  // 📊 MATRIX API - Route comparison and optimization
  MATRIX: {
    base: '/v2/matrix',
    profiles: {
      DRIVING: 'driving-car',
      WALKING: 'foot-walking',
      CYCLING: 'cycling-regular'
    },
    quota: {
      daily: 500,
      perMinute: 40,
      current: 0,
      reset: null
    }
  },

  // ⏰ ISOCHRONES API - Reachability analysis
  ISOCHRONES: {
    base: '/v2/isochrones',
    profiles: {
      DRIVING: 'driving-car',
      WALKING: 'foot-walking',
      CYCLING: 'cycling-regular'
    },
    quota: {
      daily: 500,
      perMinute: 20,
      current: 0,
      reset: null
    }
  }
} as const;

// HTTP Headers for all requests
export const DEFAULT_HEADERS = {
  'Authorization': `Bearer ${ORS_API_KEY}`,
  'Content-Type': 'application/json',
  'Accept': 'application/json'
};

// Request timeout configuration
export const REQUEST_TIMEOUT = {
  DEFAULT: 10000, // 10 seconds
  DIRECTIONS: 15000, // 15 seconds for complex routes
  MATRIX: 20000, // 20 seconds for matrix calculations
  ISOCHRONES: 25000 // 25 seconds for isochrone calculations
};

// Fallback API configurations (when ORS quota is exceeded)
export const FALLBACK_APIS = {
  GEOCODING: {
    provider: 'Nominatim',
    baseUrl: 'https://nominatim.openstreetmap.org',
    rateLimit: 1000 // 1 request per second
  },
  POIS: {
    provider: 'Overpass',
    baseUrl: 'https://overpass-api.de/api',
    rateLimit: 10000 // More generous limits
  }
};

// Error codes and messages
export const API_ERRORS = {
  QUOTA_EXCEEDED: {
    code: 'QUOTA_EXCEEDED',
    message: 'API quota exceeded. Using cached or fallback data.',
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
  SERVER_ERROR: {
    code: 'SERVER_ERROR',
    message: 'Server temporarily unavailable.',
    fallbackAvailable: true
  }
} as const;

// Cache configuration
export const CACHE_CONFIG = {
  TTL: {
    DIRECTIONS: 5 * 60 * 1000, // 5 minutes
    GEOCODING: 24 * 60 * 60 * 1000, // 24 hours
    POIS: 60 * 60 * 1000, // 1 hour
    MATRIX: 10 * 60 * 1000, // 10 minutes
    ISOCHRONES: 30 * 60 * 1000 // 30 minutes
  },
  MAX_SIZE: 100 // Maximum cached items per type
};

// Export types for TypeScript
export type APIEndpointType = keyof typeof API_ENDPOINTS;
export type TransportProfile = 'driving-car' | 'foot-walking' | 'cycling-regular' | 'driving-hgv' | 'wheelchair';
export type POICategory = keyof typeof API_ENDPOINTS.POIS.categories;