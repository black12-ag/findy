import Bull, { Job } from 'bull';
export interface AnalyticsProcessingJobData {
    type: 'daily_summary' | 'weekly_report' | 'monthly_report' | 'user_behavior' | 'route_analytics' | 'location_patterns';
    userId?: string;
    dateRange: {
        startDate: Date;
        endDate: Date;
    };
    includeComparison?: boolean;
    sendReport?: boolean;
    reportFormat?: 'email' | 'in-app' | 'both';
}
export interface UserAnalyticsJobData {
    userId: string;
    eventType: 'route_created' | 'route_completed' | 'place_saved' | 'location_shared' | 'search_performed';
    eventData: Record<string, any>;
    timestamp: Date;
    location?: {
        lat: number;
        lng: number;
    };
}
export interface AnalyticsResult {
    type: string;
    userId?: string;
    dateRange: {
        startDate: Date;
        endDate: Date;
    };
    metrics: Record<string, any>;
    insights: string[];
    recommendations: string[];
}
declare class AnalyticsJobProcessor {
    private analyticsService;
    private notificationService;
    constructor();
    private setupProcessors;
    processAnalytics(job: Job<AnalyticsProcessingJobData>): Promise<AnalyticsResult>;
    processUserEvent(job: Job<UserAnalyticsJobData>): Promise<void>;
    private generateDailySummary;
    private generateWeeklyReport;
    private generateMonthlyReport;
    private analyzeUserBehavior;
    private analyzeRoutePatterns;
    private analyzeLocationPatterns;
    private updateUserStatistics;
    private checkUserMilestones;
    private sendAnalyticsReport;
}
export declare const analyticsJobProcessor: AnalyticsJobProcessor;
export declare function processAnalytics(data: AnalyticsProcessingJobData, options?: Bull.JobOptions): Promise<Bull.Job>;
export declare function trackUserEvent(data: UserAnalyticsJobData, options?: Bull.JobOptions): Promise<Bull.Job>;
export declare function scheduleRegularAnalytics(): Promise<void>;
export {};
//# sourceMappingURL=analytics.d.ts.map