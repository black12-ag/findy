export interface AnalyticsEvent {
    id?: string;
    userId: string;
    sessionId?: string;
    event: string;
    category: string;
    properties: Record<string, any>;
    timestamp: Date;
    location?: {
        lat: number;
        lng: number;
    };
}
export interface UserBehaviorPattern {
    mostActiveHours: number[];
    preferredTransportMode: string;
    averageRouteDistance: number;
    favoriteLocations: string[];
    searchPatterns: Record<string, number>;
}
export interface RouteAnalyticsPattern {
    popularRoutes: Array<{
        startLocation: string;
        endLocation: string;
        frequency: number;
        averageDistance: number;
        averageDuration: number;
    }>;
    peakHours: number[];
    transportModeDistribution: Record<string, number>;
    averageWaypointCount: number;
}
export interface LocationPattern {
    hotspots: Array<{
        lat: number;
        lng: number;
        visits: number;
        radius: number;
        category?: string;
    }>;
    timePatterns: Record<string, number>;
    categoryPreferences: Record<string, number>;
}
export interface MonthlyStats {
    totalRoutes: number;
    totalDistance: number;
    totalDuration: number;
    uniqueLocations: number;
    mostVisitedPlace: string;
    transportModeBreakdown: Record<string, number>;
    weeklyTrends: Array<{
        week: string;
        routes: number;
        distance: number;
    }>;
}
export declare class AnalyticsService {
    trackEvent(eventData: Partial<AnalyticsEvent>): Promise<void>;
    analyzeUserBehavior(userId: string, dateRange: {
        startDate: Date;
        endDate: Date;
    }): Promise<UserBehaviorPattern>;
    analyzeRoutePatterns(userId: string | undefined, dateRange: {
        startDate: Date;
        endDate: Date;
    }): Promise<RouteAnalyticsPattern>;
    analyzeLocationPatterns(userId: string | undefined, dateRange: {
        startDate: Date;
        endDate: Date;
    }): Promise<LocationPattern>;
    getMonthlyStats(userId: string | undefined, dateRange: {
        startDate: Date;
        endDate: Date;
    }): Promise<MonthlyStats>;
    sendMilestoneNotification(userId: string, milestone: {
        type: string;
        milestone: number;
    }): Promise<void>;
    getUserCurrentLocation(userId: string): Promise<{
        lat: number;
        lng: number;
    } | null>;
    checkEventTrigger(userId: string, eventType: string): Promise<boolean>;
    sendRouteOptimizationNotification(data: {
        userId: string;
        routeId: string;
        timeSaved: number;
        distanceSaved: number;
    }): Promise<void>;
    private updateRealtimeCounters;
    private getTimeSlot;
    private calculateWeeklyTrends;
    private getWeekStart;
}
//# sourceMappingURL=AnalyticsService.d.ts.map