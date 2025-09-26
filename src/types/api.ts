// Location types
export interface Location {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  category?: string;
}

// Auth types
export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  dateOfBirth?: string;
  bio?: string;
  avatar?: string;
  emailVerified: boolean;
  createdAt: string;
  updatedAt: string;
  stats: {
    routesCount: number;
    placesCount: number;
    friendsCount: number;
  };
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

// Place types
export interface Place {
  id: string;
  googlePlaceId?: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  category: string;
  isFavorite: boolean;
  userId: string;
  createdAt: string;
  updatedAt: string;
}

export interface PlaceSearchRequest {
  query: string;
  location?: {
    lat: number;
    lng: number;
  };
  radius?: number;
  type?: 'restaurant' | 'gas_station' | 'hospital' | 'school' | 'store' | 'attraction';
}

export interface PlaceSearchResult {
  id: string;
  name: string;
  address: string;
  location: {
    lat: number;
    lng: number;
  };
  category: string;
  rating?: number;
  priceLevel?: number;
  photos: Array<{
    reference: string;
    width: number;
    height: number;
  }>;
  openingHours?: {
    isOpen: boolean;
    periods: any[];
    weekdayText: string[];
  };
  website?: string;
  phoneNumber?: string;
  reviews: Array<{
    author: string;
    rating: number;
    text: string;
    time: number;
    profilePhoto?: string;
  }>;
  userRatingsTotal?: number;
  isSaved?: boolean;
}

// Route types
export interface Route {
  id: string;
  name: string;
  originLat: number;
  originLng: number;
  originAddress: string;
  destinationLat: number;
  destinationLng: number;
  destinationAddress: string;
  waypoints?: string; // JSON string
  travelMode: 'DRIVING' | 'WALKING' | 'BICYCLING' | 'TRANSIT';
  distance: number;
  duration: number;
  isFavorite: boolean;
  userId: string;
  createdAt: string;
  updatedAt: string;
}

export interface RouteCalculationRequest {
  origin: {
    lat: number;
    lng: number;
    address?: string;
  };
  destination: {
    lat: number;
    lng: number;
    address?: string;
  };
  waypoints?: Array<{
    lat: number;
    lng: number;
    address?: string;
  }>;
  travelMode?: 'DRIVING' | 'WALKING' | 'BICYCLING' | 'TRANSIT';
  optimize?: boolean;
  avoidTolls?: boolean;
  avoidHighways?: boolean;
}

export interface CalculatedRoute {
  summary: string;
  distance: {
    text: string;
    value: number;
  };
  duration: {
    text: string;
    value: number;
  };
  startAddress: string;
  endAddress: string;
  startLocation: {
    lat: number;
    lng: number;
  };
  endLocation: {
    lat: number;
    lng: number;
  };
  steps: Array<{
    instruction: string;
    distance: {
      text: string;
      value: number;
    };
    duration: {
      text: string;
      value: number;
    };
    startLocation: {
      lat: number;
      lng: number;
    };
    endLocation: {
      lat: number;
      lng: number;
    };
    polyline?: string;
    travelMode: string;
  }>;
  polyline?: string;
  bounds?: {
    northeast: {
      lat: number;
      lng: number;
    };
    southwest: {
      lat: number;
      lng: number;
    };
  };
}

// User preferences types
export interface UserPreferences {
  id: string;
  userId: string;
  defaultTravelMode: 'DRIVING' | 'WALKING' | 'BICYCLING' | 'TRANSIT';
  units: 'METRIC' | 'IMPERIAL';
  language: string;
  theme: 'LIGHT' | 'DARK' | 'SYSTEM';
  notifications: {
    email: boolean;
    push: boolean;
    sms: boolean;
    marketing: boolean;
  };
  privacy: {
    shareLocation: boolean;
    showOnlineStatus: boolean;
    allowFriendRequests: boolean;
    shareTrips: boolean;
  };
  mapSettings: {
    showTraffic: boolean;
    showSatellite: boolean;
    autoRecenter: boolean;
    voiceNavigation: boolean;
  };
  createdAt: string;
  updatedAt: string;
}

// Social types
export interface Friend {
  id: string;
  requesterId: string;
  addresseeId: string;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED';
  createdAt: string;
  updatedAt: string;
  requester: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    avatar?: string;
  };
  addressee: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    avatar?: string;
  };
  friend: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    avatar?: string;
  };
}

export interface FriendRequest {
  email?: string;
  userId?: string;
}

// Weather types
export interface WeatherData {
  temperature: number;
  feelsLike: number;
  humidity: number;
  pressure: number;
  visibility: number;
  windSpeed: number;
  windDirection: number;
  cloudCover: number;
  uvIndex?: number;
  conditions: Array<{
    id: number;
    main: string;
    description: string;
    icon: string;
  }>;
  timestamp: number;
}

export interface WeatherAlert {
  id: string;
  title: string;
  description: string;
  severity: 'minor' | 'moderate' | 'severe' | 'extreme';
  startTime: number;
  endTime: number;
  areas: string[];
}

// Pagination types
export interface PaginationParams {
  page?: number;
  limit?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Analytics types
export interface UserAnalytics {
  userId: string;
  period: number;
  totalEvents: number;
  eventsByType: Record<string, number>;
  dailyActivity: Array<{
    date: string;
    count: number;
  }>;
  popularPlaces: Array<{
    placeName: string;
    count: number;
  }>;
}