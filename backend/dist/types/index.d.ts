import { Request } from 'express';
import { User } from '@prisma/client';
export interface AuthenticatedRequest extends Request {
    user?: User & {
        id: string;
    };
}
export interface ApiResponse<T = any> {
    success: boolean;
    data?: T;
    message?: string;
    error?: string;
    meta?: {
        page?: number;
        limit?: number;
        total?: number;
        hasMore?: boolean;
    };
}
export interface PaginationParams {
    page: number;
    limit: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
}
export interface PaginatedResponse<T> {
    data: T[];
    meta: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
        hasMore: boolean;
    };
}
export interface Coordinates {
    latitude: number;
    longitude: number;
}
export interface LocationData extends Coordinates {
    accuracy?: number;
    heading?: number;
    speed?: number;
    timestamp?: Date;
}
export interface PlaceSearchParams {
    query?: string;
    latitude?: number;
    longitude?: number;
    radius?: number;
    category?: string;
    minRating?: number;
    priceLevel?: number;
    openNow?: boolean;
    page?: number;
    limit?: number;
}
export interface RouteRequest {
    origin: Coordinates;
    destination: Coordinates;
    waypoints?: Coordinates[];
    transportMode?: 'DRIVING' | 'WALKING' | 'TRANSIT' | 'CYCLING';
    avoidTolls?: boolean;
    avoidHighways?: boolean;
    avoidFerries?: boolean;
    departureTime?: Date;
    arrivalTime?: Date;
}
export interface RouteResponse {
    routes: RouteOption[];
    status: string;
}
export interface RouteOption {
    distance: number;
    duration: number;
    geometry: string;
    steps?: RouteStep[];
    warnings?: string[];
    fare?: RouteFare;
}
export interface RouteStep {
    instruction: string;
    distance: number;
    duration: number;
    polyline: string;
    maneuver: string;
    location: Coordinates;
}
export interface RouteFare {
    currency: string;
    value: number;
    text: string;
}
export interface UserProfileUpdate {
    firstName?: string;
    lastName?: string;
    username?: string;
    phoneNumber?: string;
    avatar?: string;
}
export interface UserPreferencesUpdate {
    defaultTransportMode?: 'DRIVING' | 'WALKING' | 'TRANSIT' | 'CYCLING';
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
}
export interface SocialPostCreate {
    content?: string;
    type: 'CHECK_IN' | 'REVIEW' | 'PHOTO' | 'TIP' | 'INCIDENT';
    placeId?: string;
    photos?: string[];
    latitude?: number;
    longitude?: number;
}
export interface ReviewCreate {
    placeId: string;
    rating: number;
    content?: string;
    photos?: string[];
}
export interface LocationUpdate extends LocationData {
    userId: string;
    shareToken?: string;
}
export interface SocketEvents {
    'join-room': {
        roomId: string;
    };
    'leave-room': {
        roomId: string;
    };
    'location-update': LocationUpdate;
    'route-progress': {
        routeId: string;
        progress: number;
        currentLocation: Coordinates;
    };
    'user-joined': {
        userId: string;
        userData: any;
    };
    'user-left': {
        userId: string;
    };
    'location-updated': LocationUpdate;
    'route-progress-updated': {
        userId: string;
        routeId: string;
        progress: number;
    };
    'notification': {
        type: string;
        message: string;
        data?: any;
    };
}
export interface WeatherData {
    location: string;
    temperature: number;
    description: string;
    icon: string;
    humidity: number;
    windSpeed: number;
    visibility: number;
    alerts?: WeatherAlert[];
}
export interface WeatherAlert {
    title: string;
    description: string;
    severity: 'minor' | 'moderate' | 'severe' | 'extreme';
    startTime: Date;
    endTime: Date;
}
export interface TrafficIncident {
    id: string;
    type: 'accident' | 'construction' | 'closure' | 'congestion';
    severity: 'low' | 'medium' | 'high';
    location: Coordinates;
    description: string;
    startTime: Date;
    estimatedEndTime?: Date;
    affectedRoads: string[];
}
export interface CacheOptions {
    ttl?: number;
    tags?: string[];
}
export declare class AppError extends Error {
    readonly statusCode: number;
    readonly isOperational: boolean;
    constructor(message: string, statusCode?: number, isOperational?: boolean);
}
export declare enum HttpStatus {
    OK = 200,
    CREATED = 201,
    ACCEPTED = 202,
    NO_CONTENT = 204,
    BAD_REQUEST = 400,
    UNAUTHORIZED = 401,
    FORBIDDEN = 403,
    NOT_FOUND = 404,
    CONFLICT = 409,
    UNPROCESSABLE_ENTITY = 422,
    TOO_MANY_REQUESTS = 429,
    INTERNAL_SERVER_ERROR = 500,
    SERVICE_UNAVAILABLE = 503
}
export interface FileUploadOptions {
    maxSize: number;
    allowedTypes: string[];
    destination: string;
}
export interface UploadedFile {
    originalName: string;
    filename: string;
    path: string;
    size: number;
    mimetype: string;
    url?: string;
}
export interface AnalyticsEvent {
    id?: string;
    userId?: string;
    sessionId?: string;
    event: string;
    category?: string;
    properties?: Record<string, any>;
    timestamp?: Date;
}
export interface UserStats {
    totalRoutes: number;
    totalDistance: number;
    totalTravelTime: number;
    favoriteTransportMode: string;
    mostVisitedPlaces: Array<{
        placeId: string;
        name: string;
        visits: number;
    }>;
}
//# sourceMappingURL=index.d.ts.map