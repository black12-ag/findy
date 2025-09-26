import { Request, Response } from 'express';
import type { RouteCalculationRequest, SaveRouteRequest, GetUserRoutesRequest, RouteCalculationResponse, SaveRouteResponse, UserRoutesResponse, OptimizeRouteRequest } from '@/types/api';
export declare const calculateRoute: (req: Request<{}, RouteCalculationResponse, RouteCalculationRequest>, res: Response<RouteCalculationResponse>) => Promise<void>;
export declare const saveRoute: (req: Request<{}, SaveRouteResponse, SaveRouteRequest>, res: Response<SaveRouteResponse>) => Promise<void>;
export declare const getUserRoutes: (req: Request<{}, UserRoutesResponse, {}, GetUserRoutesRequest>, res: Response<UserRoutesResponse>) => Promise<void>;
export declare const deleteRoute: (req: Request<{
    routeId: string;
}>, res: Response) => Promise<void>;
export declare const toggleRouteFavorite: (req: Request<{
    routeId: string;
}>, res: Response) => Promise<void>;
export declare const optimizeRoute: (req: Request<{}, RouteCalculationResponse, OptimizeRouteRequest>, res: Response<RouteCalculationResponse>) => Promise<void>;
//# sourceMappingURL=routes.d.ts.map