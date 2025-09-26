import type { AnalyticsEvent, AnalyticsEventType, UserAnalytics, EventAggregation } from '@/types/analytics';
declare class AnalyticsService {
    trackEvent(event: AnalyticsEvent): Promise<void>;
    getUserAnalytics(userId: string, days?: number): Promise<UserAnalytics>;
    getPlatformAnalytics(days?: number): Promise<EventAggregation>;
    getRealtimeStats(eventType: AnalyticsEventType): Promise<number>;
    getUserTopActions(userId: string, limit?: number): Promise<Array<{
        action: string;
        count: number;
    }>>;
    trackSearchAnalytics(query: string, resultCount: number, userId?: string): Promise<void>;
    getPopularSearches(limit?: number): Promise<Array<{
        query: string;
        count: number;
    }>>;
    cleanupOldData(daysToKeep?: number): Promise<void>;
    private updateRealtimeCounters;
    private getPopularPlaces;
}
export declare const analyticsService: AnalyticsService;
export {};
//# sourceMappingURL=analytics.d.ts.map