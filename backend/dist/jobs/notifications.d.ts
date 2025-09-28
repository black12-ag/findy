import Bull, { Job } from 'bull';
export interface NotificationJobData {
    userId: string;
    type: 'email' | 'push' | 'in-app' | 'sms';
    template: string;
    data: Record<string, any>;
    priority?: 'high' | 'normal' | 'low';
    scheduleAt?: Date;
    retryCount?: number;
}
export interface ScheduledNotificationJobData {
    userId: string;
    notificationId: string;
    triggerType: 'time' | 'location' | 'event';
    triggerData: {
        scheduledTime?: Date;
        location?: {
            lat: number;
            lng: number;
            radius: number;
        };
        eventType?: string;
    };
    notificationData: {
        title: string;
        message: string;
        type: 'route_reminder' | 'location_alert' | 'weather_update' | 'traffic_alert' | 'general';
        data?: Record<string, any>;
    };
}
export interface BatchNotificationJobData {
    userIds: string[];
    template: string;
    data: Record<string, any>;
    type: 'email' | 'push' | 'in-app';
    batchSize?: number;
}
declare class NotificationJobProcessor {
    private notificationService;
    private emailService;
    private webPushService;
    constructor();
    private setupProcessors;
    processSingleNotification(job: Job<NotificationJobData>): Promise<void>;
    processBatchNotification(job: Job<BatchNotificationJobData>): Promise<void>;
    processScheduledNotification(job: Job<ScheduledNotificationJobData>): Promise<void>;
    private checkTriggerCondition;
    private calculateDistance;
}
export declare const notificationJobProcessor: NotificationJobProcessor;
export declare function sendNotification(data: NotificationJobData, options?: Bull.JobOptions): Promise<Bull.Job>;
export declare function sendBatchNotification(data: BatchNotificationJobData, options?: Bull.JobOptions): Promise<Bull.Job>;
export declare function scheduleNotification(data: ScheduledNotificationJobData, cronPattern?: string): Promise<Bull.Job>;
export {};
//# sourceMappingURL=notifications.d.ts.map