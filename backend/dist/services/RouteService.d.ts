export interface RouteWaypoint {
    lat: number;
    lng: number;
    placeId?: string;
    name?: string;
    address?: string;
}
export interface RoutePreferences {
    mode: 'driving' | 'walking' | 'bicycling' | 'transit';
    avoidTolls?: boolean;
    avoidHighways?: boolean;
    avoidFerries?: boolean;
    optimize?: boolean;
}
export interface Route {
    distance: number;
    duration: number;
    geometry: any;
    bounds: {
        north: number;
        south: number;
        east: number;
        west: number;
    };
    steps: RouteStep[];
    warnings?: string[];
    trafficMultiplier?: number;
    estimatedFuel?: number;
    estimatedCost?: number;
}
export interface RouteStep {
    instruction: string;
    distance: number;
    duration: number;
    startLocation: {
        lat: number;
        lng: number;
    };
    endLocation: {
        lat: number;
        lng: number;
    };
    maneuver?: string;
    polyline?: string;
}
export interface RouteOptions {
    alternatives?: boolean;
    traffic?: boolean;
    language?: string;
    units?: 'metric' | 'imperial';
}
export declare class RouteService {
    private readonly GOOGLE_MAPS_API_KEY;
    private readonly MAPBOX_API_KEY;
    private readonly CACHE_TTL;
    constructor();
    calculateRoute(waypoints: RouteWaypoint[], preferences: RoutePreferences, options?: RouteOptions): Promise<Route>;
    getAlternativeRoutes(waypoints: RouteWaypoint[], preferences: RoutePreferences, maxAlternatives?: number): Promise<Route[]>;
    optimizeWaypointOrder(waypoints: RouteWaypoint[], preferences: RoutePreferences): Promise<Route>;
    updateRoute(routeId: string, route: Route): Promise<void>;
    private getCachedRoute;
    private cacheRoute;
    private generateCacheKey;
    private calculateGoogleRoute;
    private parseGoogleRoute;
    estimateFuelConsumption(distance: number, vehicleType?: 'car' | 'motorcycle' | 'truck'): Promise<number>;
    estimateRouteCost(route: Route, fuelPricePerLiter?: number, vehicleType?: 'car' | 'motorcycle' | 'truck'): Promise<number>;
    getETAWithTraffic(waypoints: RouteWaypoint[], preferences: RoutePreferences): Promise<{
        duration: number;
        durationInTraffic: number;
        eta: Date;
    }>;
}
//# sourceMappingURL=RouteService.d.ts.map