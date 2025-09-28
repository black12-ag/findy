import Bull from 'bull';
export declare enum JobTypes {
    ROUTE_OPTIMIZATION = "route:optimization",
    NOTIFICATION_SEND = "notification:send",
    NOTIFICATION_SCHEDULE = "notification:schedule",
    DATA_CLEANUP = "data:cleanup",
    ANALYTICS_PROCESS = "analytics:process",
    USER_ANALYTICS = "user:analytics",
    LOCATION_CLEANUP = "location:cleanup",
    SESSION_CLEANUP = "session:cleanup",
    EMAIL_SEND = "email:send",
    CACHE_WARM = "cache:warm",
    BACKUP_DATABASE = "backup:database"
}
export declare class QueueManager {
    private queues;
    private redisClient;
    constructor();
    private initializeQueues;
    private setupEventHandlers;
    addJob(jobType: JobTypes, data: any, options?: Bull.JobOptions): Promise<Bull.Job>;
    scheduleJob(jobType: JobTypes, cronPattern: string, data?: any): Promise<Bull.Job>;
    getQueueStats(jobType: JobTypes): Promise<{
        waiting: number;
        active: number;
        completed: number;
        failed: number;
        delayed: number;
    }>;
    getAllQueueStats(): Promise<Record<string, any>>;
    cleanCompletedJobs(jobType: JobTypes, maxAge?: number): Promise<void>;
    getQueue(jobType: JobTypes): Bull.Queue | undefined;
    close(): Promise<void>;
    pauseQueue(jobType: JobTypes): Promise<void>;
    resumeQueue(jobType: JobTypes): Promise<void>;
}
export declare const queueManager: QueueManager;
//# sourceMappingURL=index.d.ts.map