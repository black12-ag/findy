import Bull from 'bull';
import { Job } from 'bull';
import { Route } from '@/types/maps';
export interface RouteOptimizationJobData {
    userId: string;
    routeId: string;
    waypoints: Array<{
        lat: number;
        lng: number;
        placeId?: string;
        name?: string;
    }>;
    preferences: {
        mode: 'driving' | 'walking' | 'bicycling' | 'transit';
        avoidTolls?: boolean;
        avoidHighways?: boolean;
        avoidFerries?: boolean;
        optimize?: boolean;
    };
    priority?: 'high' | 'normal' | 'low';
}
export interface OptimizedRouteResult {
    routeId: string;
    optimizedRoute: Route;
    timeSaved: number;
    distanceSaved: number;
    originalDuration: number;
    optimizedDuration: number;
    originalDistance: number;
    optimizedDistance: number;
}
declare class RouteOptimizationJobProcessor {
    private routeService;
    private notificationService;
    constructor();
    private setupProcessor;
    processOptimization(job: Job<RouteOptimizationJobData>): Promise<OptimizedRouteResult>;
    private selectBestRoute;
    private calculateRouteScore;
}
export declare const routeOptimizationProcessor: RouteOptimizationJobProcessor;
export declare function scheduleRouteOptimization(data: RouteOptimizationJobData, options?: Bull.JobOptions): Promise<Bull.Job>;
export declare function schedulePeriodicRouteOptimization(routeId: string, cronPattern?: string): Promise<Bull.Job>;
export {};
//# sourceMappingURL=routeOptimization.d.ts.map