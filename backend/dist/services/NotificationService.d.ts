export interface NotificationPayload {
    title: string;
    message: string;
    type?: 'info' | 'warning' | 'error' | 'success';
    data?: Record<string, any>;
    priority?: 'low' | 'normal' | 'high';
    expiresAt?: Date;
}
export interface NotificationPreferences {
    email: boolean;
    push: boolean;
    sms: boolean;
    inApp: boolean;
}
export interface BulkNotificationOptions {
    userIds: string[];
    payload: NotificationPayload;
    preferences?: Partial<NotificationPreferences>;
    delay?: number;
    batchSize?: number;
}
export declare class NotificationService {
    private emailService;
    private webPushService;
    constructor();
    sendNotification(userId: string, payload: NotificationPayload, preferences?: Partial<NotificationPreferences>): Promise<void>;
    sendBulkNotifications(options: BulkNotificationOptions): Promise<void>;
    sendSMS(phoneNumber: string, message: string): Promise<void>;
    private createInAppNotification;
    sendRouteNotification(userId: string, type: 'route_shared' | 'route_completed' | 'route_optimized' | 'traffic_alert', data: Record<string, any>): Promise<void>;
    sendFriendNotification(userId: string, type: 'friend_request' | 'friend_accepted' | 'friend_shared_location', data: Record<string, any>): Promise<void>;
    sendSystemNotification(userId: string, type: 'maintenance' | 'feature_update' | 'account_security', data: Record<string, any>): Promise<void>;
    getNotificationStats(): Promise<{
        totalSent: number;
        sentToday: number;
        avgDeliveryTime: number;
        successRate: number;
    }>;
}
//# sourceMappingURL=NotificationService.d.ts.map