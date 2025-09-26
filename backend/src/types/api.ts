// Standard API response structure
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
  };
}

// Authentication types
export interface LoginRequest {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface RegisterRequest {
  email: string;
  password: string;
  confirmPassword: string;
  firstName?: string;
  lastName?: string;
  username?: string;
}

export interface AuthResponse {
  user: UserProfile;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

// User types
export interface UserProfile {
  id: string;
  email: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  avatar?: string;
  phoneNumber?: string;
  isVerified: boolean;
  role: 'USER' | 'ADMIN' | 'MODERATOR';
  createdAt: string;
  updatedAt: string;
}

export interface UpdateUserRequest {
  firstName?: string;
  lastName?: string;
  username?: string;
  phoneNumber?: string;
  avatar?: string;
}

// Place types
export interface Place {
  id: string;
  name: string;
  description?: string;
  address: string;
  latitude: number;
  longitude: number;
  category?: string;
  subcategory?: string;
  rating?: number;
  priceLevel?: number;
  phoneNumber?: string;
  website?: string;
  openingHours?: any;
  photos: string[];
  amenities: string[];
  isVerified: boolean;
  googlePlaceId?: string;
  mapboxId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePlaceRequest {
  name: string;
  description?: string;
  address: string;
  latitude: number;
  longitude: number;
  category?: string;
  subcategory?: string;
  phoneNumber?: string;
  website?: string;
  openingHours?: any;
  amenities?: string[];
}

export interface SavedPlace {
  id: string;
  name: string;
  notes?: string;
  category: 'HOME' | 'WORK' | 'FAVORITE' | 'RESTAURANT' | 'SHOPPING' | 'ENTERTAINMENT' | 'HEALTH' | 'EDUCATION' | 'OTHER';
  isHome: boolean;
  isWork: boolean;
  customLatitude?: number;
  customLongitude?: number;
  customAddress?: string;
  place?: Place;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSavedPlaceRequest {
  name: string;
  notes?: string;
  category?: SavedPlace['category'];
  isHome?: boolean;
  isWork?: boolean;
  placeId?: string;
  customLatitude?: number;
  customLongitude?: number;
  customAddress?: string;
}

// Route types
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
  waypoints: RouteWaypoint[];
  avoidTolls: boolean;
  avoidHighways: boolean;
  avoidFerries: boolean;
  status: 'PLANNED' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RouteWaypoint {
  id: string;
  latitude: number;
  longitude: number;
  address?: string;
  order: number;
  place?: Place;
}

export interface CreateRouteRequest {
  name?: string;
  transportMode: Route['transportMode'];
  startLatitude: number;
  startLongitude: number;
  startAddress: string;
  endLatitude: number;
  endLongitude: number;
  endAddress: string;
  waypoints?: {
    latitude: number;
    longitude: number;
    address?: string;
    order: number;
    placeId?: string;
  }[];
  avoidTolls?: boolean;
  avoidHighways?: boolean;
  avoidFerries?: boolean;
}

// Social types
export interface SocialPost {
  id: string;
  content?: string;
  type: 'CHECK_IN' | 'REVIEW' | 'PHOTO' | 'TIP' | 'INCIDENT';
  photos: string[];
  latitude?: number;
  longitude?: number;
  user: UserProfile;
  place?: Place;
  comments: SocialComment[];
  reactions: SocialReaction[];
  createdAt: string;
  updatedAt: string;
}

export interface SocialComment {
  id: string;
  content: string;
  user: UserProfile;
  createdAt: string;
  updatedAt: string;
}

export interface SocialReaction {
  id: string;
  type: 'LIKE' | 'LOVE' | 'LAUGH' | 'ANGRY' | 'SAD';
  user: UserProfile;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSocialPostRequest {
  content?: string;
  type: SocialPost['type'];
  photos?: string[];
  latitude?: number;
  longitude?: number;
  placeId?: string;
}

export interface Friendship {
  id: string;
  user: UserProfile;
  friend: UserProfile;
  status: 'PENDING' | 'ACCEPTED' | 'BLOCKED';
  createdAt: string;
  updatedAt: string;
}

export interface FriendRequest {
  email?: string;
  userId?: string;
  username?: string;
}

// Pagination
export interface PaginationParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

// Search types
export interface SearchParams extends PaginationParams {
  query?: string;
  category?: string;
  latitude?: number;
  longitude?: number;
  radius?: number; // meters
  minRating?: number;
  maxPriceLevel?: number;
}

export interface PlaceSearchRequest extends SearchParams {
  type?: string;
  keyword?: string;
  openNow?: boolean;
}

export interface PlaceDetailsRequest {
  placeId: string;
  fields?: string[];
  language?: string;
  region?: string;
}

export interface SavePlaceRequest {
  placeId?: string;
  name: string;
  notes?: string;
  category?: SavedPlace['category'];
  isHome?: boolean;
  isWork?: boolean;
  customLatitude?: number;
  customLongitude?: number;
  customAddress?: string;
}

export interface DeletePlaceRequest {
  placeId: string;
}

export interface GetUserPlacesRequest {
  category?: string;
  page?: number;
  limit?: number;
}

export interface PlaceSearchResponse extends ApiResponse<Place[]> {
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface PlaceDetailsResponse extends ApiResponse<Place> {}

export interface SavePlaceResponse extends ApiResponse<SavedPlace> {}

export interface UserPlacesResponse extends ApiResponse<SavedPlace[]> {
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Location sharing
export interface SharedLocation {
  id: string;
  latitude: number;
  longitude: number;
  accuracy?: number;
  heading?: number;
  speed?: number;
  isActive: boolean;
  expiresAt?: string;
  shareToken: string;
  user: UserProfile;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSharedLocationRequest {
  latitude: number;
  longitude: number;
  accuracy?: number;
  heading?: number;
  speed?: number;
  expiresAt?: string;
}

// Error types
export interface ApiError {
  code: string;
  message: string;
  details?: any;
  statusCode: number;
}

// Additional Route Types
export interface RouteCalculationRequest {
  startLatitude: number;
  startLongitude: number;
  startAddress: string;
  endLatitude: number;
  endLongitude: number;
  endAddress: string;
  waypoints?: RouteWaypoint[];
  transportMode?: 'DRIVING' | 'WALKING' | 'TRANSIT' | 'CYCLING';
  avoidTolls?: boolean;
  avoidHighways?: boolean;
  avoidFerries?: boolean;
}

export interface RouteCalculationResponse extends ApiResponse<Route> {}

export interface SaveRouteRequest extends CreateRouteRequest {
  name: string;
  isFavorite?: boolean;
}

export interface SaveRouteResponse extends ApiResponse<Route> {}

export interface GetUserRoutesRequest extends PaginationParams {
  status?: 'PLANNED' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
  transportMode?: 'DRIVING' | 'WALKING' | 'TRANSIT' | 'CYCLING';
}

export interface UserRoutesResponse extends PaginatedResponse<Route> {}

export interface OptimizeRouteRequest {
  waypoints: Array<{
    latitude: number;
    longitude: number;
    address?: string;
  }>;
  transportMode?: 'DRIVING' | 'WALKING' | 'TRANSIT' | 'CYCLING';
  avoidTolls?: boolean;
  avoidHighways?: boolean;
  avoidFerries?: boolean;
}

// Additional Social Types
export interface SendFriendRequestRequest {
  email?: string;
  userId?: string;
  username?: string;
}

export interface FriendRequestResponse extends ApiResponse<Friendship> {}

export interface GetFriendsRequest extends PaginationParams {
  status?: 'PENDING' | 'ACCEPTED' | 'BLOCKED';
}

export interface FriendsResponse extends PaginatedResponse<Friendship> {}

export interface ShareRouteRequest {
  routeId: string;
  friendIds: string[];
  message?: string;
}

export interface SharePlaceRequest {
  placeId: string;
  friendIds: string[];
  message?: string;
}

export interface SharedItemResponse extends ApiResponse<any> {}

// Additional User Types
export interface UpdateProfileRequest {
  firstName?: string;
  lastName?: string;
  username?: string;
  phoneNumber?: string;
  phone?: string;
  avatar?: string;
}

export interface UpdatePreferencesRequest {
  defaultTransportMode?: 'DRIVING' | 'WALKING' | 'TRANSIT' | 'CYCLING';
  defaultTravelMode?: 'DRIVING' | 'WALKING' | 'TRANSIT' | 'CYCLING';
  voiceGuidance?: boolean;
  avoidTolls?: boolean;
  avoidHighways?: boolean;
  avoidFerries?: boolean;
  mapStyle?: string;
  darkMode?: boolean;
  language?: string;
  units?: string;
  shareLocation?: boolean;
  shareActivity?: boolean;
  allowFriendRequests?: boolean;
  trafficAlerts?: boolean;
  weatherAlerts?: boolean;
  socialNotifications?: boolean;
  notifications?: any;
  privacy?: any;
  mapSettings?: any;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export interface DeleteAccountRequest {
  password: string;
  confirmationText: string;
  reason?: string;
}

export interface UserProfileResponse extends ApiResponse<UserProfile & {
  routesCount: number;
  placesCount: number;
  friendsCount: number;
}> {}

export interface UserPreferencesResponse extends ApiResponse<{
  defaultTransportMode: string;
  voiceGuidance: boolean;
  avoidTolls: boolean;
  avoidHighways: boolean;
  avoidFerries: boolean;
  mapStyle: string;
  darkMode: boolean;
  language: string;
  units: string;
  shareLocation: boolean;
  shareActivity: boolean;
  allowFriendRequests: boolean;
  trafficAlerts: boolean;
  weatherAlerts: boolean;
  socialNotifications: boolean;
  notifications: any;
  privacy: any;
  mapSettings: any;
}> {}

export interface UserAnalyticsResponse extends ApiResponse<any> {}

// Health check
export interface HealthCheckResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  environment: string;
  services: {
    database: 'up' | 'down';
    redis: 'up' | 'down';
    external_apis: 'up' | 'down';
  };
}
