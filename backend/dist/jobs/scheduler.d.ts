import { JobTypes } from '@/queues';
export declare class JobScheduler {
    private isInitialized;
    private scheduledJobs;
    constructor();
    initialize(): Promise<void>;
    private scheduleCleanupJobs;
    private scheduleAnalyticsJobs;
    private scheduleMonitoringJobs;
    private scheduleMaintenanceJobs;
    scheduleOneTimeJob(jobType: JobTypes, data: any, delay?: number): Promise<void>;
    scheduleRecurringJob(jobType: JobTypes, cronPattern: string, data: any, name: string): Promise<void>;
    stopRecurringJob(name: string): boolean;
    getQueueStats(): Promise<Record<string, any>>;
    pauseQueue(jobType: JobTypes): Promise<void>;
    resumeQueue(jobType: JobTypes): Promise<void>;
    shutdown(): Promise<void>;
    private setupGracefulShutdown;
    healthCheck(): Promise<{
        status: 'healthy' | 'degraded' | 'unhealthy';
        queues: Record<string, any>;
        scheduledJobs: string[];
    }>;
}
export declare const jobScheduler: JobScheduler;
//# sourceMappingURL=scheduler.d.ts.map