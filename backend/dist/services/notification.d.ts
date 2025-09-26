interface NotificationRecipient {
    userId: string;
    email?: string;
    pushTokens?: string[];
    preferences?: {
        email: boolean;
        push: boolean;
        sms: boolean;
    };
}
type NotificationType = 'friend_request' | 'friend_request_accepted' | 'route_shared' | 'place_shared' | 'trip_started' | 'trip_ended' | 'weather_alert' | 'system_maintenance' | 'welcome' | 'password_changed' | 'account_deleted';
declare class NotificationService {
    private emailTransporter;
    private readonly fcmServerKey;
    constructor();
    private setupEmailTransporter;
    sendNotification(type: NotificationType, recipient: NotificationRecipient, data?: Record<string, any>): Promise<void>;
    sendBulkNotification(type: NotificationType, recipients: NotificationRecipient[], data?: Record<string, any>): Promise<void>;
    private sendEmailNotification;
    private sendPushNotification;
    private getEmailTemplate;
    private getPushNotificationContent;
    sendWelcomeEmail(userId: string, email: string, firstName: string): Promise<void>;
    sendFriendRequestNotification(recipientId: string, senderName: string, requestId: string): Promise<void>;
    sendRouteSharedNotification(recipientIds: string[], senderName: string, routeData: {
        id: string;
        name: string;
        distance: string;
        duration: string;
    }, message?: string): Promise<void>;
    private getUserNotificationSettings;
    registerPushToken(userId: string, token: string): Promise<void>;
    unregisterPushToken(userId: string, token: string): Promise<void>;
}
export declare const notificationService: NotificationService;
export {};
//# sourceMappingURL=notification.d.ts.map