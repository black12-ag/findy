export interface PushNotificationData {
    title: string;
    body: string;
    icon?: string;
    badge?: string;
    image?: string;
    data?: Record<string, any>;
    actions?: Array<{
        action: string;
        title: string;
        icon?: string;
    }>;
    tag?: string;
    requireInteraction?: boolean;
}
export interface PushSubscription {
    endpoint: string;
    keys: {
        p256dh: string;
        auth: string;
    };
}
export declare class WebPushService {
    constructor();
    private initializeWebPush;
    sendPushNotification(userId: string, notification: PushNotificationData): Promise<void>;
    sendBulkPushNotifications(userIds: string[], notification: PushNotificationData): Promise<void>;
    subscribeToPush(userId: string, subscription: PushSubscription, deviceInfo?: {
        userAgent: string;
        deviceType: string;
        deviceName?: string;
    }): Promise<void>;
    unsubscribeFromPush(userId: string, endpoint?: string): Promise<void>;
    private getUserSubscriptions;
    private sendToSubscription;
    private cleanupExpiredSubscriptions;
    static generateVapidKeys(): {
        publicKey: string;
        privateKey: string;
    };
    testPushNotification(userId: string): Promise<void>;
    sendRouteNotification(userId: string, type: 'route_optimized' | 'route_shared' | 'route_reminder', routeData: {
        routeName: string;
        timeSaved?: number;
        distanceSaved?: number;
        senderName?: string;
    }): Promise<void>;
    getNotificationStats(userId?: string): Promise<{
        totalSubscriptions: number;
        activeSubscriptions: number;
        deviceTypeBreakdown: Record<string, number>;
    }>;
}
//# sourceMappingURL=WebPushService.d.ts.map