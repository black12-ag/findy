import type { PlaceSearchParams, RouteCalculationParams, GeocodeParams, Place, Route, Location, GeocodingResult } from '@/types/maps';
declare class MapsService {
    private client;
    constructor();
    searchPlaces(params: PlaceSearchParams): Promise<Place[]>;
    getPlaceDetails(placeId: string): Promise<Place | null>;
    calculateRoute(params: RouteCalculationParams): Promise<Route>;
    geocode(params: GeocodeParams): Promise<GeocodingResult[]>;
    reverseGeocode(location: Location): Promise<GeocodingResult[]>;
    getTravelTimeMatrix(origins: Location[], destinations: Location[], travelMode?: string): Promise<any>;
    private formatPlace;
    private formatRoute;
    private formatGeocodingResult;
    private getCategoryFromTypes;
}
export declare const mapsService: MapsService;
export {};
//# sourceMappingURL=maps.d.ts.map