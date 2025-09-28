import Bull, { Job } from 'bull';
export interface DataCleanupJobData {
    type: 'sessions' | 'locations' | 'cache' | 'logs' | 'temp_files' | 'expired_tokens' | 'old_analytics';
    maxAge?: number;
    batchSize?: number;
    dryRun?: boolean;
}
export interface CleanupResult {
    type: string;
    itemsProcessed: number;
    itemsDeleted: number;
    spaceSaved: number;
    duration: number;
    errors: string[];
}
declare class DataCleanupJobProcessor {
    private databaseService;
    private cacheService;
    private storageService;
    constructor();
    private setupProcessor;
    processCleanup(job: Job<DataCleanupJobData>): Promise<CleanupResult>;
    private cleanupExpiredSessions;
    private cleanupOldLocations;
    private cleanupCache;
    private cleanupOldLogs;
    private cleanupTempFiles;
    private cleanupExpiredTokens;
    private cleanupOldAnalytics;
}
export declare const dataCleanupProcessor: DataCleanupJobProcessor;
export declare function scheduleDataCleanup(data: DataCleanupJobData, options?: Bull.JobOptions): Promise<Bull.Job>;
export declare function scheduleRegularCleanups(): Promise<void>;
export {};
//# sourceMappingURL=dataCleanup.d.ts.map