import { Response } from 'express';
import { AuthenticatedRequest } from '@/types';
import type { RouteCalculationRequest, SaveRouteRequest, GetUserRoutesRequest, RouteCalculationResponse, SaveRouteResponse, UserRoutesResponse, OptimizeRouteRequest } from '@/types/api';
export declare const calculateRoute: (req: AuthenticatedRequest & {
    body: RouteCalculationRequest;
}, res: Response<RouteCalculationResponse>) => Promise<void>;
export declare const saveRoute: (req: AuthenticatedRequest & {
    body: SaveRouteRequest;
}, res: Response<SaveRouteResponse>) => Promise<void>;
export declare const getUserRoutes: (req: AuthenticatedRequest & {
    query: GetUserRoutesRequest;
}, res: Response<UserRoutesResponse>) => Promise<void>;
export declare const deleteRoute: (req: AuthenticatedRequest & {
    params: {
        routeId: string;
    };
}, res: Response) => Promise<void>;
export declare const toggleRouteFavorite: (req: AuthenticatedRequest & {
    params: {
        routeId: string;
    };
}, res: Response) => Promise<void>;
export declare const optimizeRoute: (req: AuthenticatedRequest & {
    body: OptimizeRouteRequest;
}, res: Response<RouteCalculationResponse>) => Promise<void>;
//# sourceMappingURL=routes.d.ts.map