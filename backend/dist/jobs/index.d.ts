export * from '@/queues';
export * from './routeOptimization';
export * from './notifications';
export * from './dataCleanup';
export * from './analytics';
export * from './scheduler';
import { JobTypes } from '@/queues';
export declare function initializeJobSystem(): Promise<void>;
export declare function shutdownJobSystem(): Promise<void>;
export declare function checkJobSystemHealth(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    details: any;
}>;
export declare const JobUtils: {
    optimizeRoute(routeData: {
        userId: string;
        routeId: string;
        waypoints: Array<{
            lat: number;
            lng: number;
            placeId?: string;
            name?: string;
        }>;
        preferences: {
            mode: "driving" | "walking" | "bicycling" | "transit";
            avoidTolls?: boolean;
            avoidHighways?: boolean;
            avoidFerries?: boolean;
            optimize?: boolean;
        };
        priority?: "high" | "normal" | "low";
    }): Promise<import("bull").Job<any>>;
    sendNotification(notificationData: {
        userId: string;
        type: "email" | "push" | "in-app" | "sms";
        template: string;
        data: Record<string, any>;
        priority?: "high" | "normal" | "low";
        scheduleAt?: Date;
    }): Promise<import("bull").Job<any>>;
    trackUserEvent(eventData: {
        userId: string;
        eventType: "route_created" | "route_completed" | "place_saved" | "location_shared" | "search_performed";
        eventData: Record<string, any>;
        timestamp: Date;
        location?: {
            lat: number;
            lng: number;
        };
    }): Promise<import("bull").Job<any>>;
    scheduleCleanup(cleanupData: {
        type: "sessions" | "locations" | "cache" | "logs" | "temp_files" | "expired_tokens" | "old_analytics";
        maxAge?: number;
        batchSize?: number;
        dryRun?: boolean;
    }): Promise<import("bull").Job<any>>;
    processAnalytics(analyticsData: {
        type: "daily_summary" | "weekly_report" | "monthly_report" | "user_behavior" | "route_analytics" | "location_patterns";
        userId?: string;
        dateRange: {
            startDate: Date;
            endDate: Date;
        };
        includeComparison?: boolean;
        sendReport?: boolean;
        reportFormat?: "email" | "in-app" | "both";
    }): Promise<import("bull").Job<any>>;
    getQueueStats(): Promise<Record<string, any>>;
    pauseQueue(jobType: JobTypes): Promise<void>;
    resumeQueue(jobType: JobTypes): Promise<void>;
    scheduleOneTimeJob(jobType: JobTypes, data: any, delay?: number): Promise<void>;
    scheduleRecurringJob(jobType: JobTypes, cronPattern: string, data: any, name: string): Promise<void>;
    stopRecurringJob(name: string): boolean;
};
export declare const JOB_PRIORITIES: {
    readonly HIGH: 1;
    readonly NORMAL: 5;
    readonly LOW: 10;
};
export declare const JOB_RETRY_DELAYS: {
    readonly IMMEDIATE: 0;
    readonly SHORT: 30000;
    readonly MEDIUM: 300000;
    readonly LONG: 3600000;
};
export declare const CLEANUP_INTERVALS: {
    readonly SESSIONS: number;
    readonly LOCATIONS: number;
    readonly CACHE: number;
    readonly LOGS: number;
    readonly TEMP_FILES: number;
    readonly ANALYTICS: number;
};
//# sourceMappingURL=index.d.ts.map