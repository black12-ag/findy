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
export interface UserProfile {
    id: string;
    email: string;
    username: string | null;
    firstName: string | null;
    lastName: string | null;
    avatar: string | null;
    phoneNumber: string | null;
    isVerified: boolean;
    role: string;
    createdAt: Date;
    updatedAt: Date;
}
export interface Friendship {
    id: string;
    user: UserProfile;
    friend: UserProfile;
    status: string;
    createdAt: Date;
    updatedAt: Date;
}
export interface FriendRequest {
    email?: string;
    userId?: string;
    username?: string;
}
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
export interface SearchParams extends PaginationParams {
    query?: string;
    category?: string;
    latitude?: number;
    longitude?: number;
    radius?: number;
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
export interface PlaceDetailsResponse extends ApiResponse<Place> {
}
export interface SavePlaceResponse extends ApiResponse<SavedPlace> {
}
export interface UserPlacesResponse extends ApiResponse<SavedPlace[]> {
    meta: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
}
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
export interface ApiError {
    code: string;
    message: string;
    details?: any;
    statusCode: number;
}
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
export interface RouteCalculationResponse extends ApiResponse<Route> {
}
export interface SaveRouteRequest extends CreateRouteRequest {
    name: string;
    isFavorite?: boolean;
}
export interface SaveRouteResponse extends ApiResponse<Route> {
}
export interface GetUserRoutesRequest extends PaginationParams {
    status?: 'PLANNED' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
    transportMode?: 'DRIVING' | 'WALKING' | 'TRANSIT' | 'CYCLING';
}
export interface UserRoutesResponse extends PaginatedResponse<Route> {
}
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
export interface SendFriendRequestRequest {
    email?: string;
    userId?: string;
    username?: string;
}
export interface FriendRequestResponse extends ApiResponse<Friendship> {
}
export interface GetFriendsRequest extends PaginationParams {
    status?: 'PENDING' | 'ACCEPTED' | 'BLOCKED';
}
export interface FriendsResponse extends PaginatedResponse<Friendship> {
}
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
export interface SharedItemResponse extends ApiResponse<any> {
}
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
}> {
}
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
}> {
}
export interface UserAnalyticsResponse extends ApiResponse<any> {
}
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
//# sourceMappingURL=api.d.ts.map