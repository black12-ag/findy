import { Server as HTTPServer } from 'http';
declare class WebSocketService {
    private io;
    private connectedUsers;
    private activeTrips;
    constructor(server: HTTPServer);
    private setupMiddleware;
    private setupEventHandlers;
    private handleConnection;
    private setupSocketEvents;
    private handleLocationUpdate;
    private handleTripStart;
    private handleTripEnd;
    private handleTripShare;
    private handleGetOnlineFriends;
    private handleNotificationRead;
    private handleLiveRouteShare;
    private handleDisconnection;
    private updateUserOnlineStatus;
    private setupCleanupTimers;
    sendNotificationToUser(userId: string, notification: any): Promise<void>;
    sendNotificationToUsers(userIds: string[], notification: any): Promise<void>;
    getConnectedUsersCount(): number;
    getActiveTripsCount(): number;
}
export { WebSocketService };
//# sourceMappingURL=websocket.d.ts.map