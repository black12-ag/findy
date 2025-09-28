import { Server } from 'socket.io';
export declare class SocketHandlers {
    private io;
    private connectedUsers;
    constructor(io: Server);
    private setupMiddleware;
    private setupEventHandlers;
    private handleConnection;
    private setupLocationHandlers;
    private setupRouteHandlers;
    private setupNotificationHandlers;
    private setupSocialHandlers;
    private handleDisconnection;
    private isValidLocation;
    private getActiveFriends;
    private getRouteShareRecipients;
    private storeNotificationForOfflineUsers;
    private updateUserLastSeen;
    getUserSocketId(userId: string): string | undefined;
    isUserOnline(userId: string): boolean;
    getOnlineUsersCount(): number;
    broadcastToAllUsers(event: string, data: any): Promise<void>;
}
//# sourceMappingURL=handlers.d.ts.map