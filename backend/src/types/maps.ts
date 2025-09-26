// Geographic coordinate
export interface Location {
  latitude: number;
  longitude: number;
}

// Coordinate with elevation
export interface Coordinate3D extends Location {
  elevation?: number;
}

// Bounding box
export interface BoundingBox {
  southwest: Location;
  northeast: Location;
}

// Address components
export interface AddressComponent {
  longName: string;
  shortName: string;
  types: string[];
}

// Geocoding result
export interface GeocodingResult {
  placeId: string;
  formattedAddress: string;
  location: Location;
  addressComponents: AddressComponent[];
  types: string[];
  partialMatch?: boolean;
  geometry: {
    location: Location;
    locationType: string;
    viewport: BoundingBox;
    bounds?: BoundingBox;
  };
}

// Reverse geocoding result
export interface ReverseGeocodingResult {
  placeId: string;
  formattedAddress: string;
  addressComponents: AddressComponent[];
  types: string[];
  geometry: {
    location: Location;
    locationType: string;
    viewport: BoundingBox;
  };
}

// Place details
export interface PlaceDetails {
  placeId: string;
  name: string;
  formattedAddress: string;
  location: Location;
  rating?: number;
  userRatingsTotal?: number;
  priceLevel?: number;
  types: string[];
  openingHours?: {
    openNow: boolean;
    periods: Array<{
      open: { day: number; time: string };
      close?: { day: number; time: string };
    }>;
    weekdayText: string[];
  };
  photos?: Array<{
    photoReference: string;
    height: number;
    width: number;
    htmlAttributions: string[];
  }>;
  reviews?: Array<{
    authorName: string;
    authorUrl?: string;
    language: string;
    profilePhotoUrl?: string;
    rating: number;
    relativeTimeDescription: string;
    text: string;
    time: number;
  }>;
  website?: string;
  phoneNumber?: string;
  internationalPhoneNumber?: string;
  businessStatus?: string;
  plusCode?: {
    globalCode: string;
    compoundCode: string;
  };
  utcOffset?: number;
  adrAddress?: string;
  url?: string;
  vicinity?: string;
}

// Route step
export interface RouteStep {
  distance: { text: string; value: number };
  duration: { text: string; value: number };
  endLocation: Location;
  startLocation: Location;
  htmlInstructions: string;
  maneuver?: string;
  polyline: { points: string };
  travelMode: 'DRIVING' | 'WALKING' | 'BICYCLING' | 'TRANSIT';
}

// Route leg
export interface RouteLeg {
  distance: { text: string; value: number };
  duration: { text: string; value: number };
  endAddress: string;
  endLocation: Location;
  startAddress: string;
  startLocation: Location;
  steps: RouteStep[];
  viaWaypoints: Location[];
}

// Route
export interface RouteResult {
  bounds: BoundingBox;
  copyrights: string;
  legs: RouteLeg[];
  overviewPolyline: { points: string };
  summary: string;
  warnings: string[];
  waypointOrder: number[];
  fare?: {
    currency: string;
    text: string;
    value: number;
  };
}

// Directions request
export interface DirectionsRequest {
  origin: string | Location;
  destination: string | Location;
  waypoints?: Array<{
    location: string | Location;
    stopover: boolean;
  }>;
  travelMode: 'DRIVING' | 'WALKING' | 'BICYCLING' | 'TRANSIT';
  alternatives?: boolean;
  avoidHighways?: boolean;
  avoidTolls?: boolean;
  avoidFerries?: boolean;
  language?: string;
  region?: string;
  units?: 'METRIC' | 'IMPERIAL';
  arrivalTime?: Date;
  departureTime?: Date;
  optimizeWaypoints?: boolean;
  transitOptions?: {
    modes?: string[];
    routingPreference?: 'LESS_WALKING' | 'FEWER_TRANSFERS';
  };
}

// Distance matrix request
export interface DistanceMatrixRequest {
  origins: (string | Location)[];
  destinations: (string | Location)[];
  travelMode: 'DRIVING' | 'WALKING' | 'BICYCLING' | 'TRANSIT';
  avoidHighways?: boolean;
  avoidTolls?: boolean;
  avoidFerries?: boolean;
  language?: string;
  region?: string;
  units?: 'METRIC' | 'IMPERIAL';
  departureTime?: Date;
  arrivalTime?: Date;
  transitOptions?: {
    modes?: string[];
    routingPreference?: 'LESS_WALKING' | 'FEWER_TRANSFERS';
  };
}

// Distance matrix result
export interface DistanceMatrixResult {
  originAddresses: string[];
  destinationAddresses: string[];
  rows: Array<{
    elements: Array<{
      status: 'OK' | 'NOT_FOUND' | 'ZERO_RESULTS' | 'MAX_ROUTE_LENGTH_EXCEEDED' | 'MAX_WAYPOINTS_EXCEEDED' | 'INVALID_REQUEST' | 'OVER_DAILY_LIMIT' | 'OVER_QUERY_LIMIT' | 'REQUEST_DENIED' | 'UNKNOWN_ERROR';
      distance?: { text: string; value: number };
      duration?: { text: string; value: number };
      durationInTraffic?: { text: string; value: number };
      fare?: { currency: string; text: string; value: number };
    }>;
  }>;
}

// Places search request
export interface PlacesSearchRequest {
  query?: string;
  location?: Location;
  radius?: number;
  type?: string;
  keyword?: string;
  minPrice?: number;
  maxPrice?: number;
  openNow?: boolean;
  language?: string;
  region?: string;
  pageToken?: string;
}

// Places search result
export interface PlacesSearchResult {
  results: Array<{
    placeId: string;
    name: string;
    formattedAddress: string;
    geometry: {
      location: Location;
      viewport: BoundingBox;
    };
    rating?: number;
    userRatingsTotal?: number;
    priceLevel?: number;
    types: string[];
    businessStatus?: string;
    openingHours?: {
      openNow: boolean;
    };
    photos?: Array<{
      photoReference: string;
      height: number;
      width: number;
    }>;
    plusCode?: {
      globalCode: string;
      compoundCode: string;
    };
  }>;
  nextPageToken?: string;
}

// Weather data
export interface WeatherData {
  location: Location;
  current: {
    temperature: number;
    feelsLike: number;
    humidity: number;
    pressure: number;
    visibility: number;
    windSpeed: number;
    windDirection: number;
    description: string;
    icon: string;
    timestamp: Date;
  };
  forecast: Array<{
    date: Date;
    high: number;
    low: number;
    description: string;
    icon: string;
    precipitation: number;
    windSpeed: number;
  }>;
}

// Traffic data
export interface TrafficData {
  incidents: Array<{
    id: string;
    type: 'ACCIDENT' | 'CONSTRUCTION' | 'CLOSURE' | 'CONGESTION' | 'OTHER';
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    location: Location;
    description: string;
    startTime: Date;
    endTime?: Date;
    affectedRoads: string[];
  }>;
  congestion: Array<{
    road: string;
    location: Location;
    level: 'LIGHT' | 'MODERATE' | 'HEAVY' | 'SEVERE';
    speed: number; // km/h
    delay: number; // minutes
  }>;
}

// Map tile
export interface MapTile {
  x: number;
  y: number;
  z: number;
  url: string;
  format: 'png' | 'jpg' | 'webp';
}

// Map style
export interface MapStyle {
  id: string;
  name: string;
  description: string;
  styleUrl: string;
  thumbnail: string;
  category: 'standard' | 'satellite' | 'terrain' | 'hybrid' | 'custom';
  features: string[];
}

// Route (for optimization)
export interface Route {
  id: string;
  name?: string;
  transportMode: 'DRIVING' | 'WALKING' | 'TRANSIT' | 'CYCLING';
  startLatitude: number;
  startLongitude: number;
  startAddress: string;
  endLatitude: number;
  endLongitude: number;
  endAddress: string;
  distance: number; // meters
  duration: number; // seconds
  routeGeometry?: any;
  waypoints: Array<{
    id: string;
    latitude: number;
    longitude: number;
    address?: string;
    order: number;
  }>;
  avoidTolls: boolean;
  avoidHighways: boolean;
  avoidFerries: boolean;
  status: 'PLANNED' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
  startedAt?: string;
  completedAt?: string;
  isFavorite?: boolean;
  createdAt: string;
  updatedAt: string;
}

// Isochrone
export interface Isochrone {
  center: Location;
  timeLimit: number; // seconds
  transportMode: 'DRIVING' | 'WALKING' | 'CYCLING' | 'TRANSIT';
  geometry: {
    type: 'Polygon';
    coordinates: number[][][];
  };
  properties: {
    time: number;
    distance: number;
    reachableArea: number; // square meters
  };
}
