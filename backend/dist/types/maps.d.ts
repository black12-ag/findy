export interface Location {
    latitude: number;
    longitude: number;
}
export interface Coordinate3D extends Location {
    elevation?: number;
}
export interface BoundingBox {
    southwest: Location;
    northeast: Location;
}
export interface AddressComponent {
    longName: string;
    shortName: string;
    types: string[];
}
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
            open: {
                day: number;
                time: string;
            };
            close?: {
                day: number;
                time: string;
            };
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
export interface RouteStep {
    distance: {
        text: string;
        value: number;
    };
    duration: {
        text: string;
        value: number;
    };
    endLocation: Location;
    startLocation: Location;
    htmlInstructions: string;
    maneuver?: string;
    polyline: {
        points: string;
    };
    travelMode: 'DRIVING' | 'WALKING' | 'BICYCLING' | 'TRANSIT';
}
export interface RouteLeg {
    distance: {
        text: string;
        value: number;
    };
    duration: {
        text: string;
        value: number;
    };
    endAddress: string;
    endLocation: Location;
    startAddress: string;
    startLocation: Location;
    steps: RouteStep[];
    viaWaypoints: Location[];
}
export interface RouteResult {
    bounds: BoundingBox;
    copyrights: string;
    legs: RouteLeg[];
    overviewPolyline: {
        points: string;
    };
    summary: string;
    warnings: string[];
    waypointOrder: number[];
    fare?: {
        currency: string;
        text: string;
        value: number;
    };
}
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
export interface DistanceMatrixResult {
    originAddresses: string[];
    destinationAddresses: string[];
    rows: Array<{
        elements: Array<{
            status: 'OK' | 'NOT_FOUND' | 'ZERO_RESULTS' | 'MAX_ROUTE_LENGTH_EXCEEDED' | 'MAX_WAYPOINTS_EXCEEDED' | 'INVALID_REQUEST' | 'OVER_DAILY_LIMIT' | 'OVER_QUERY_LIMIT' | 'REQUEST_DENIED' | 'UNKNOWN_ERROR';
            distance?: {
                text: string;
                value: number;
            };
            duration?: {
                text: string;
                value: number;
            };
            durationInTraffic?: {
                text: string;
                value: number;
            };
            fare?: {
                currency: string;
                text: string;
                value: number;
            };
        }>;
    }>;
}
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
        speed: number;
        delay: number;
    }>;
}
export interface MapTile {
    x: number;
    y: number;
    z: number;
    url: string;
    format: 'png' | 'jpg' | 'webp';
}
export interface MapStyle {
    id: string;
    name: string;
    description: string;
    styleUrl: string;
    thumbnail: string;
    category: 'standard' | 'satellite' | 'terrain' | 'hybrid' | 'custom';
    features: string[];
}
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
    distance: number;
    duration: number;
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
export interface Isochrone {
    center: Location;
    timeLimit: number;
    transportMode: 'DRIVING' | 'WALKING' | 'CYCLING' | 'TRANSIT';
    geometry: {
        type: 'Polygon';
        coordinates: number[][][];
    };
    properties: {
        time: number;
        distance: number;
        reachableArea: number;
    };
}
//# sourceMappingURL=maps.d.ts.map