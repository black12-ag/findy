"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebSocketService = void 0;
const socket_io_1 = require("socket.io");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const env_1 = require("@/config/env");
const logger_1 = require("@/config/logger");
const redis_1 = require("@/config/redis");
const database_1 = require("@/config/database");
const analytics_1 = require("./analytics");
class WebSocketService {
    constructor(server) {
        this.connectedUsers = new Map();
        this.activeTrips = new Map();
        this.io = new socket_io_1.Server(server, {
            cors: {
                origin: env_1.config.cors.allowedOrigins,
                credentials: true,
            },
            transports: ['websocket', 'polling'],
        });
        this.setupMiddleware();
        this.setupEventHandlers();
        this.setupCleanupTimers();
    }
    setupMiddleware() {
        this.io.use(async (socket, next) => {
            try {
                const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');
                if (!token) {
                    return next(new Error('Authentication token required'));
                }
                const decoded = jsonwebtoken_1.default.verify(token, env_1.config.jwt.accessTokenSecret);
                const user = await database_1.prisma.user.findUnique({
                    where: { id: decoded.userId },
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                    },
                });
                if (!user) {
                    return next(new Error('User not found'));
                }
                socket.userId = user.id;
                socket.user = user;
                next();
            }
            catch (error) {
                logger_1.logger.error('WebSocket authentication error:', error);
                next(new Error('Invalid authentication token'));
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
        logger_1.logger.info('User connected to WebSocket', {
            userId,
            socketId: socket.id,
        });
        this.connectedUsers.set(userId, socket.id);
        socket.join(`user:${userId}`);
        this.updateUserOnlineStatus(userId, true);
        this.setupSocketEvents(socket);
        socket.on('disconnect', () => {
            this.handleDisconnection(socket);
        });
    }
    setupSocketEvents(socket) {
        const userId = socket.userId;
        socket.on('location:update', (data) => {
            this.handleLocationUpdate(socket, data);
        });
        socket.on('trip:start', (data) => {
            this.handleTripStart(socket, data);
        });
        socket.on('trip:end', (data) => {
            this.handleTripEnd(socket, data);
        });
        socket.on('trip:share', (data) => {
            this.handleTripShare(socket, data);
        });
        socket.on('friends:online', () => {
            this.handleGetOnlineFriends(socket);
        });
        socket.on('notification:read', (data) => {
            this.handleNotificationRead(socket, data);
        });
        socket.on('route:share:live', (data) => {
            this.handleLiveRouteShare(socket, data);
        });
    }
    async handleLocationUpdate(socket, data) {
        const userId = socket.userId;
        try {
            if (!data.lat || !data.lng || !data.timestamp) {
                socket.emit('error', { message: 'Invalid location data' });
                return;
            }
            const locationKey = `location:${userId}`;
            const locationData = {
                lat: data.lat,
                lng: data.lng,
                heading: data.heading,
                speed: data.speed,
                accuracy: data.accuracy,
                timestamp: data.timestamp,
                updatedAt: Date.now(),
            };
            await redis_1.redisClient.setex(locationKey, 300, JSON.stringify(locationData));
            const activeTrip = Array.from(this.activeTrips.values()).find(trip => trip.userId === userId);
            if (activeTrip) {
                activeTrip.currentLocation = { lat: data.lat, lng: data.lng };
                activeTrip.sharedWith.forEach(friendId => {
                    this.io.to(`user:${friendId}`).emit('trip:location:update', {
                        tripId: activeTrip.tripId,
                        location: { lat: data.lat, lng: data.lng },
                        timestamp: data.timestamp,
                    });
                });
            }
            await analytics_1.analyticsService.trackEvent({
                userId,
                event: 'location_updated',
                properties: {
                    accuracy: data.accuracy,
                    speed: data.speed,
                },
            });
        }
        catch (error) {
            logger_1.logger.error('Error handling location update:', error);
            socket.emit('error', { message: 'Failed to update location' });
        }
    }
    async handleTripStart(socket, data) {
        const userId = socket.userId;
        try {
            const tripId = `trip_${userId}_${Date.now()}`;
            const trip = {
                tripId,
                userId,
                startLocation: data.startLocation,
                currentLocation: data.startLocation,
                routeId: data.routeId,
                isActive: true,
                startTime: Date.now(),
                sharedWith: data.sharedWith || [],
            };
            this.activeTrips.set(tripId, trip);
            trip.sharedWith.forEach(friendId => {
                this.io.to(`user:${friendId}`).emit('trip:started', {
                    tripId,
                    userId,
                    user: socket.user,
                    startLocation: data.startLocation,
                    routeId: data.routeId,
                });
            });
            socket.emit('trip:started', { tripId });
            await analytics_1.analyticsService.trackEvent({
                userId,
                event: 'trip_started',
                properties: {
                    routeId: data.routeId,
                    sharedWithCount: trip.sharedWith.length,
                },
            });
        }
        catch (error) {
            logger_1.logger.error('Error handling trip start:', error);
            socket.emit('error', { message: 'Failed to start trip' });
        }
    }
    async handleTripEnd(socket, data) {
        const userId = socket.userId;
        try {
            const trip = this.activeTrips.get(data.tripId);
            if (!trip || trip.userId !== userId) {
                socket.emit('error', { message: 'Trip not found' });
                return;
            }
            trip.isActive = false;
            trip.sharedWith.forEach(friendId => {
                this.io.to(`user:${friendId}`).emit('trip:ended', {
                    tripId: data.tripId,
                    userId,
                });
            });
            socket.emit('trip:ended', { tripId: data.tripId });
            const duration = Date.now() - trip.startTime;
            await analytics_1.analyticsService.trackEvent({
                userId,
                event: 'trip_ended',
                properties: {
                    tripId: data.tripId,
                    duration,
                    routeId: trip.routeId,
                },
            });
            setTimeout(() => {
                this.activeTrips.delete(data.tripId);
            }, 30000);
        }
        catch (error) {
            logger_1.logger.error('Error handling trip end:', error);
            socket.emit('error', { message: 'Failed to end trip' });
        }
    }
    async handleTripShare(socket, data) {
        const userId = socket.userId;
        try {
            const trip = this.activeTrips.get(data.tripId);
            if (!trip || trip.userId !== userId) {
                socket.emit('error', { message: 'Trip not found' });
                return;
            }
            data.friendIds.forEach(friendId => {
                if (!trip.sharedWith.includes(friendId)) {
                    trip.sharedWith.push(friendId);
                    this.io.to(`user:${friendId}`).emit('trip:shared', {
                        tripId: data.tripId,
                        userId,
                        user: socket.user,
                        currentLocation: trip.currentLocation,
                    });
                }
            });
            socket.emit('trip:share:success', { tripId: data.tripId });
        }
        catch (error) {
            logger_1.logger.error('Error handling trip share:', error);
            socket.emit('error', { message: 'Failed to share trip' });
        }
    }
    async handleGetOnlineFriends(socket) {
        const userId = socket.userId;
        try {
            const friendships = await database_1.prisma.friendship.findMany({
                where: {
                    OR: [
                        { requesterId: userId },
                        { addresseeId: userId },
                    ],
                    status: 'ACCEPTED',
                },
                include: {
                    requester: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                            avatar: true,
                        },
                    },
                    addressee: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                            avatar: true,
                        },
                    },
                },
            });
            const friends = friendships.map(friendship => friendship.requesterId === userId ? friendship.addressee : friendship.requester);
            const onlineFriends = friends.filter(friend => this.connectedUsers.has(friend.id));
            socket.emit('friends:online:list', { friends: onlineFriends });
        }
        catch (error) {
            logger_1.logger.error('Error getting online friends:', error);
            socket.emit('error', { message: 'Failed to get online friends' });
        }
    }
    async handleNotificationRead(socket, data) {
        const userId = socket.userId;
        try {
            socket.emit('notification:read:success', { notificationId: data.notificationId });
        }
        catch (error) {
            logger_1.logger.error('Error handling notification read:', error);
            socket.emit('error', { message: 'Failed to mark notification as read' });
        }
    }
    async handleLiveRouteShare(socket, data) {
        const userId = socket.userId;
        try {
            data.friendIds.forEach(friendId => {
                this.io.to(`user:${friendId}`).emit('route:live:shared', {
                    routeId: data.routeId,
                    userId,
                    user: socket.user,
                });
            });
            socket.emit('route:live:share:success', { routeId: data.routeId });
        }
        catch (error) {
            logger_1.logger.error('Error handling live route share:', error);
            socket.emit('error', { message: 'Failed to share route live' });
        }
    }
    handleDisconnection(socket) {
        const userId = socket.userId;
        logger_1.logger.info('User disconnected from WebSocket', {
            userId,
            socketId: socket.id,
        });
        this.connectedUsers.delete(userId);
        this.updateUserOnlineStatus(userId, false);
        const userTrips = Array.from(this.activeTrips.values()).filter(trip => trip.userId === userId);
        userTrips.forEach(trip => {
            trip.isActive = false;
            trip.sharedWith.forEach(friendId => {
                this.io.to(`user:${friendId}`).emit('trip:ended', {
                    tripId: trip.tripId,
                    userId,
                });
            });
        });
    }
    async updateUserOnlineStatus(userId, isOnline) {
        try {
            const statusKey = `user_status:${userId}`;
            if (isOnline) {
                await redis_1.redisClient.setex(statusKey, 300, JSON.stringify({
                    isOnline: true,
                    lastSeen: Date.now(),
                }));
            }
            else {
                await redis_1.redisClient.setex(statusKey, 86400, JSON.stringify({
                    isOnline: false,
                    lastSeen: Date.now(),
                }));
            }
        }
        catch (error) {
            logger_1.logger.error('Error updating user online status:', error);
        }
    }
    setupCleanupTimers() {
        setInterval(() => {
            const now = Date.now();
            const tripsToDelete = [];
            this.activeTrips.forEach((trip, tripId) => {
                if (!trip.isActive && (now - trip.startTime) > 3600000) {
                    tripsToDelete.push(tripId);
                }
            });
            tripsToDelete.forEach(tripId => {
                this.activeTrips.delete(tripId);
            });
            if (tripsToDelete.length > 0) {
                logger_1.logger.info(`Cleaned up ${tripsToDelete.length} inactive trips`);
            }
        }, 600000);
    }
    async sendNotificationToUser(userId, notification) {
        const socketId = this.connectedUsers.get(userId);
        if (socketId) {
            this.io.to(`user:${userId}`).emit('notification', notification);
        }
    }
    async sendNotificationToUsers(userIds, notification) {
        userIds.forEach(userId => {
            this.sendNotificationToUser(userId, notification);
        });
    }
    getConnectedUsersCount() {
        return this.connectedUsers.size;
    }
    getActiveTripsCount() {
        return Array.from(this.activeTrips.values()).filter(trip => trip.isActive).length;
    }
}
exports.WebSocketService = WebSocketService;
//# sourceMappingURL=websocket.js.map