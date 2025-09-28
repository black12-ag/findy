"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SocketHandlers = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const database_1 = require("@/config/database");
const redis_1 = require("@/config/redis");
const logger_1 = __importDefault(require("@/config/logger"));
const config_1 = require("@/config/config");
class SocketHandlers {
    constructor(io) {
        this.connectedUsers = new Map();
        this.io = io;
        this.setupMiddleware();
        this.setupEventHandlers();
    }
    setupMiddleware() {
        this.io.use(async (socket, next) => {
            try {
                const token = socket.handshake.auth.token ||
                    socket.handshake.headers.authorization?.replace('Bearer ', '');
                if (!token) {
                    return next(new Error('Authentication token missing'));
                }
                const decoded = jsonwebtoken_1.default.verify(token, config_1.config.auth.jwtSecret);
                const user = await database_1.prisma.user.findUnique({
                    where: { id: decoded.userId, isActive: true }
                });
                if (!user) {
                    return next(new Error('User not found or inactive'));
                }
                socket.userId = user.id;
                socket.userEmail = user.email;
                logger_1.default.info('Socket authenticated', {
                    userId: user.id,
                    socketId: socket.id
                });
                next();
            }
            catch (error) {
                logger_1.default.error('Socket authentication failed', { error });
                next(new Error('Authentication failed'));
            }
        });
    }
    setupEventHandlers() {
        this.io.on('connection', (socket) => {
            this.handleConnection(socket);
        });
    }
    handleConnection(socket) {
        const userId = socket.userId;
        logger_1.default.info('User connected via socket', {
            userId,
            socketId: socket.id
        });
        this.connectedUsers.set(userId, socket.id);
        socket.join(`user:${userId}`);
        this.setupLocationHandlers(socket);
        this.setupRouteHandlers(socket);
        this.setupNotificationHandlers(socket);
        this.setupSocialHandlers(socket);
        socket.on('disconnect', () => {
            this.handleDisconnection(socket);
        });
        socket.emit('connected', {
            message: 'Successfully connected to PathFinder Pro',
            userId,
            timestamp: new Date().toISOString()
        });
    }
    setupLocationHandlers(socket) {
        const userId = socket.userId;
        socket.on('location:update', async (data) => {
            try {
                logger_1.default.debug('Location update received', { userId, data });
                if (!this.isValidLocation(data)) {
                    socket.emit('error', { message: 'Invalid location data' });
                    return;
                }
                const locationKey = `location:${userId}`;
                await redis_1.redisClient.setex(locationKey, 300, JSON.stringify({
                    ...data,
                    userId,
                    timestamp: new Date().toISOString()
                }));
                const friends = await this.getActiveFriends(userId);
                friends.forEach(friendId => {
                    const friendSocketId = this.connectedUsers.get(friendId);
                    if (friendSocketId) {
                        this.io.to(friendSocketId).emit('friend:location:updated', {
                            userId,
                            location: data,
                            timestamp: data.timestamp
                        });
                    }
                });
                socket.emit('location:update:ack', { status: 'success' });
            }
            catch (error) {
                logger_1.default.error('Error handling location update', { error, userId });
                socket.emit('error', { message: 'Failed to process location update' });
            }
        });
    }
    setupRouteHandlers(socket) {
        const userId = socket.userId;
        socket.on('route:recalculate', async (data) => {
            try {
                logger_1.default.info('Route recalculation requested', { userId, ...data });
                const route = await database_1.prisma.route.findFirst({
                    where: { id: data.routeId, userId },
                    include: { waypoints: true }
                });
                if (!route) {
                    socket.emit('error', { message: 'Route not found' });
                    return;
                }
                socket.emit('route:recalculated', {
                    routeId: data.routeId,
                    status: 'success',
                    newRoute: {
                        distance: route.distance,
                        duration: route.duration,
                        updatedAt: new Date().toISOString()
                    }
                });
            }
            catch (error) {
                logger_1.default.error('Error recalculating route', { error, userId });
                socket.emit('error', { message: 'Failed to recalculate route' });
            }
        });
        socket.on('route:progress', async (data) => {
            try {
                logger_1.default.debug('Route progress update', { userId, data });
                const progressKey = `route_progress:${data.routeId}:${userId}`;
                await redis_1.redisClient.setex(progressKey, 3600, JSON.stringify({
                    ...data,
                    userId,
                    timestamp: new Date().toISOString()
                }));
                const sharedWith = await this.getRouteShareRecipients(data.routeId);
                sharedWith.forEach(friendId => {
                    const friendSocketId = this.connectedUsers.get(friendId);
                    if (friendSocketId) {
                        this.io.to(friendSocketId).emit('route:progress:updated', {
                            userId,
                            routeId: data.routeId,
                            progress: data.progress,
                            currentLocation: data.currentLocation,
                            eta: data.estimatedTimeRemaining
                        });
                    }
                });
                socket.emit('route:progress:ack', { status: 'success' });
            }
            catch (error) {
                logger_1.default.error('Error handling route progress', { error, userId });
                socket.emit('error', { message: 'Failed to process route progress' });
            }
        });
    }
    setupNotificationHandlers(socket) {
        const userId = socket.userId;
        socket.on('notification:send', async (data) => {
            try {
                logger_1.default.info('Push notification requested', { userId, data });
                const recipients = data.recipientIds || await this.getActiveFriends(userId);
                recipients.forEach(recipientId => {
                    const recipientSocketId = this.connectedUsers.get(recipientId);
                    if (recipientSocketId) {
                        this.io.to(recipientSocketId).emit('notification:push', {
                            type: data.type,
                            title: data.title,
                            message: data.message,
                            data: data.data,
                            fromUserId: userId,
                            timestamp: new Date().toISOString()
                        });
                    }
                });
                await this.storeNotificationForOfflineUsers(recipients, data, userId);
                socket.emit('notification:sent', {
                    status: 'success',
                    recipientCount: recipients.length
                });
            }
            catch (error) {
                logger_1.default.error('Error sending notification', { error, userId });
                socket.emit('error', { message: 'Failed to send notification' });
            }
        });
    }
    setupSocialHandlers(socket) {
        const userId = socket.userId;
        socket.on('eta:share', async (data) => {
            try {
                logger_1.default.info('ETA sharing requested', { userId, data });
                data.recipientIds.forEach(recipientId => {
                    const recipientSocketId = this.connectedUsers.get(recipientId);
                    if (recipientSocketId) {
                        this.io.to(recipientSocketId).emit('eta:received', {
                            fromUserId: userId,
                            routeId: data.routeId,
                            estimatedArrival: data.estimatedArrival,
                            currentLocation: data.currentLocation,
                            timestamp: new Date().toISOString()
                        });
                    }
                });
                socket.emit('eta:shared', {
                    status: 'success',
                    recipientCount: data.recipientIds.length
                });
            }
            catch (error) {
                logger_1.default.error('Error sharing ETA', { error, userId });
                socket.emit('error', { message: 'Failed to share ETA' });
            }
        });
        socket.on('location:share:start', async (data) => {
            try {
                logger_1.default.info('Location sharing started', { userId, friendIds: data.friendIds });
                data.friendIds.forEach(friendId => {
                    socket.join(`location_share:${friendId}`);
                });
                socket.emit('location:share:started', { status: 'success' });
            }
            catch (error) {
                logger_1.default.error('Error starting location sharing', { error, userId });
                socket.emit('error', { message: 'Failed to start location sharing' });
            }
        });
    }
    handleDisconnection(socket) {
        const userId = socket.userId;
        if (userId) {
            logger_1.default.info('User disconnected', { userId, socketId: socket.id });
            this.connectedUsers.delete(userId);
            this.updateUserLastSeen(userId);
        }
    }
    isValidLocation(data) {
        return (typeof data.latitude === 'number' &&
            typeof data.longitude === 'number' &&
            data.latitude >= -90 && data.latitude <= 90 &&
            data.longitude >= -180 && data.longitude <= 180);
    }
    async getActiveFriends(userId) {
        try {
            const friendships = await database_1.prisma.friendship.findMany({
                where: {
                    OR: [
                        { userId: userId, status: 'ACCEPTED' },
                        { friendId: userId, status: 'ACCEPTED' }
                    ]
                }
            });
            return friendships.map(friendship => friendship.userId === userId ? friendship.friendId : friendship.userId);
        }
        catch (error) {
            logger_1.default.error('Error fetching friends', { error, userId });
            return [];
        }
    }
    async getRouteShareRecipients(routeId) {
        try {
            return [];
        }
        catch (error) {
            logger_1.default.error('Error fetching route share recipients', { error, routeId });
            return [];
        }
    }
    async storeNotificationForOfflineUsers(recipientIds, notification, senderId) {
        try {
            const offlineUsers = recipientIds.filter(id => !this.connectedUsers.has(id));
            if (offlineUsers.length > 0) {
                logger_1.default.info('Storing notifications for offline users', {
                    offlineUsers,
                    notification: notification.title
                });
            }
        }
        catch (error) {
            logger_1.default.error('Error storing offline notifications', { error });
        }
    }
    async updateUserLastSeen(userId) {
        try {
            await database_1.prisma.user.update({
                where: { id: userId },
                data: { updatedAt: new Date() }
            });
        }
        catch (error) {
            logger_1.default.error('Error updating user last seen', { error, userId });
        }
    }
    getUserSocketId(userId) {
        return this.connectedUsers.get(userId);
    }
    isUserOnline(userId) {
        return this.connectedUsers.has(userId);
    }
    getOnlineUsersCount() {
        return this.connectedUsers.size;
    }
    async broadcastToAllUsers(event, data) {
        this.io.emit(event, data);
        logger_1.default.info('Broadcasted message to all users', { event, userCount: this.connectedUsers.size });
    }
}
exports.SocketHandlers = SocketHandlers;
//# sourceMappingURL=handlers.js.map