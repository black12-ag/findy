export declare class AnalyticsService {
    trackEvent(event: any): Promise<void>;
    analyzeUserBehavior(userId: string, dateRange: any): Promise<any>;
    analyzeRoutePatterns(userId: string | undefined, dateRange: any): Promise<any>;
    analyzeLocationPatterns(userId: string | undefined, dateRange: any): Promise<any>;
    getMonthlyStats(userId: string): Promise<any>;
    private updateRealtimeCounters;
    private checkMilestone;
    private aggregateUserStatistics;
    private sendInsightNotifications;
}
export declare const analyticsService: AnalyticsService;
//# sourceMappingURL=analytics-simple.d.ts.map