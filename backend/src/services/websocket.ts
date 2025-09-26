import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HTTPServer } from 'http';
import jwt from 'jsonwebtoken';
import { config } from '@/config/env';
import { logger } from '@/config/logger';
import { redisClient } from '@/config/redis';
import { prisma } from '@/config/database';
import { analyticsService } from './analytics';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  user?: {
    id: string;
    firstName: string;
    lastName: string;
  };
}

interface LocationUpdate {
  lat: number;
  lng: number;
  heading?: number;
  speed?: number;
  accuracy?: number;
  timestamp: number;
}

interface TripTracking {
  tripId: string;
  userId: string;
  startLocation: { lat: number; lng: number };
  currentLocation: { lat: number; lng: number };
  routeId?: string;
  isActive: boolean;
  startTime: number;
  estimatedArrival?: number;
  sharedWith: string[];
}

class WebSocketService {
  private io: SocketIOServer;
  private connectedUsers: Map<string, string> = new Map(); // userId -> socketId
  private activeTrips: Map<string, TripTracking> = new Map(); // tripId -> TripTracking

  constructor(server: HTTPServer) {
    this.io = new SocketIOServer(server, {
      cors: {
        origin: config.cors.allowedOrigins,
        credentials: true,
      },
      transports: ['websocket', 'polling'],
    });

    this.setupMiddleware();
    this.setupEventHandlers();
    this.setupCleanupTimers();
  }

  /**
   * Setup authentication middleware
   */
  private setupMiddleware(): void {
    this.io.use(async (socket: AuthenticatedSocket, next) => {
      try {
        const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');
        
        if (!token) {
          return next(new Error('Authentication token required'));
        }

        const decoded = jwt.verify(token, config.jwt.accessTokenSecret) as any;
        
        // Get user details
        const user = await prisma.user.findUnique({
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
      } catch (error) {
        logger.error('WebSocket authentication error:', error);
        next(new Error('Invalid authentication token'));
      }
    });
  }

  /**
   * Setup event handlers
   */
  private setupEventHandlers(): void {
    this.io.on('connection', (socket: AuthenticatedSocket) => {
      this.handleConnection(socket);
    });
  }

  /**
   * Handle new socket connection
   */
  private handleConnection(socket: AuthenticatedSocket): void {
    const userId = socket.userId!;
    
    logger.info('User connected to WebSocket', {
      userId,
      socketId: socket.id,
    });

    // Store user connection
    this.connectedUsers.set(userId, socket.id);

    // Join user to their personal room
    socket.join(`user:${userId}`);

    // Update user online status
    this.updateUserOnlineStatus(userId, true);

    // Setup event handlers for this socket
    this.setupSocketEvents(socket);

    // Handle disconnection
    socket.on('disconnect', () => {
      this.handleDisconnection(socket);
    });
  }

  /**
   * Setup event handlers for individual socket
   */
  private setupSocketEvents(socket: AuthenticatedSocket): void {
    const userId = socket.userId!;

    // Location tracking events
    socket.on('location:update', (data: LocationUpdate) => {
      this.handleLocationUpdate(socket, data);
    });

    socket.on('trip:start', (data: { routeId?: string; startLocation: { lat: number; lng: number }; sharedWith?: string[] }) => {
      this.handleTripStart(socket, data);
    });

    socket.on('trip:end', (data: { tripId: string }) => {
      this.handleTripEnd(socket, data);
    });

    socket.on('trip:share', (data: { tripId: string; friendIds: string[] }) => {
      this.handleTripShare(socket, data);
    });

    // Friend interaction events
    socket.on('friends:online', () => {
      this.handleGetOnlineFriends(socket);
    });

    // Notification events
    socket.on('notification:read', (data: { notificationId: string }) => {
      this.handleNotificationRead(socket, data);
    });

    // Route sharing events
    socket.on('route:share:live', (data: { routeId: string; friendIds: string[] }) => {
      this.handleLiveRouteShare(socket, data);
    });
  }

  /**
   * Handle location updates
   */
  private async handleLocationUpdate(socket: AuthenticatedSocket, data: LocationUpdate): Promise<void> {
    const userId = socket.userId!;

    try {
      // Validate location data
      if (!data.lat || !data.lng || !data.timestamp) {
        socket.emit('error', { message: 'Invalid location data' });
        return;
      }

      // Store location in Redis with expiration
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

      await redisClient.setex(locationKey, 300, JSON.stringify(locationData)); // 5 minutes expiration

      // Update active trip if exists
      const activeTrip = Array.from(this.activeTrips.values()).find(trip => trip.userId === userId);
      if (activeTrip) {
        activeTrip.currentLocation = { lat: data.lat, lng: data.lng };
        
        // Broadcast to shared users
        activeTrip.sharedWith.forEach(friendId => {
          this.io.to(`user:${friendId}`).emit('trip:location:update', {
            tripId: activeTrip.tripId,
            location: { lat: data.lat, lng: data.lng },
            timestamp: data.timestamp,
          });
        });
      }

      // Track analytics
      await analyticsService.trackEvent({
        userId,
        event: 'location_updated',
        properties: {
          accuracy: data.accuracy,
          speed: data.speed,
        },
      });

    } catch (error) {
      logger.error('Error handling location update:', error);
      socket.emit('error', { message: 'Failed to update location' });
    }
  }

  /**
   * Handle trip start
   */
  private async handleTripStart(
    socket: AuthenticatedSocket, 
    data: { routeId?: string; startLocation: { lat: number; lng: number }; sharedWith?: string[] }
  ): Promise<void> {
    const userId = socket.userId!;

    try {
      const tripId = `trip_${userId}_${Date.now()}`;
      const trip: TripTracking = {
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

      // Notify shared users
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

      // Track analytics
      await analyticsService.trackEvent({
        userId,
        event: 'trip_started',
        properties: {
          routeId: data.routeId,
          sharedWithCount: trip.sharedWith.length,
        },
      });

    } catch (error) {
      logger.error('Error handling trip start:', error);
      socket.emit('error', { message: 'Failed to start trip' });
    }
  }

  /**
   * Handle trip end
   */
  private async handleTripEnd(socket: AuthenticatedSocket, data: { tripId: string }): Promise<void> {
    const userId = socket.userId!;

    try {
      const trip = this.activeTrips.get(data.tripId);
      if (!trip || trip.userId !== userId) {
        socket.emit('error', { message: 'Trip not found' });
        return;
      }

      trip.isActive = false;

      // Notify shared users
      trip.sharedWith.forEach(friendId => {
        this.io.to(`user:${friendId}`).emit('trip:ended', {
          tripId: data.tripId,
          userId,
        });
      });

      socket.emit('trip:ended', { tripId: data.tripId });

      // Calculate trip duration
      const duration = Date.now() - trip.startTime;

      // Track analytics
      await analyticsService.trackEvent({
        userId,
        event: 'trip_ended',
        properties: {
          tripId: data.tripId,
          duration,
          routeId: trip.routeId,
        },
      });

      // Remove from active trips after delay
      setTimeout(() => {
        this.activeTrips.delete(data.tripId);
      }, 30000); // Keep for 30 seconds for cleanup

    } catch (error) {
      logger.error('Error handling trip end:', error);
      socket.emit('error', { message: 'Failed to end trip' });
    }
  }

  /**
   * Handle trip sharing
   */
  private async handleTripShare(socket: AuthenticatedSocket, data: { tripId: string; friendIds: string[] }): Promise<void> {
    const userId = socket.userId!;

    try {
      const trip = this.activeTrips.get(data.tripId);
      if (!trip || trip.userId !== userId) {
        socket.emit('error', { message: 'Trip not found' });
        return;
      }

      // Add new friends to sharing list
      data.friendIds.forEach(friendId => {
        if (!trip.sharedWith.includes(friendId)) {
          trip.sharedWith.push(friendId);
          
          // Notify new friend
          this.io.to(`user:${friendId}`).emit('trip:shared', {
            tripId: data.tripId,
            userId,
            user: socket.user,
            currentLocation: trip.currentLocation,
          });
        }
      });

      socket.emit('trip:share:success', { tripId: data.tripId });

    } catch (error) {
      logger.error('Error handling trip share:', error);
      socket.emit('error', { message: 'Failed to share trip' });
    }
  }

  /**
   * Get online friends
   */
  private async handleGetOnlineFriends(socket: AuthenticatedSocket): Promise<void> {
    const userId = socket.userId!;

    try {
      // Get user's friends
      const friendships = await prisma.friendship.findMany({
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

      const friends = friendships.map(friendship => 
        friendship.requesterId === userId ? friendship.addressee : friendship.requester
      );

      // Check which friends are online
      const onlineFriends = friends.filter(friend => 
        this.connectedUsers.has(friend.id)
      );

      socket.emit('friends:online:list', { friends: onlineFriends });

    } catch (error) {
      logger.error('Error getting online friends:', error);
      socket.emit('error', { message: 'Failed to get online friends' });
    }
  }

  /**
   * Handle notification read
   */
  private async handleNotificationRead(socket: AuthenticatedSocket, data: { notificationId: string }): Promise<void> {
    const userId = socket.userId!;

    try {
      // Mark notification as read (if implemented in database)
      // await prisma.notification.updateMany({
      //   where: {
      //     id: data.notificationId,
      //     userId,
      //   },
      //   data: {
      //     readAt: new Date(),
      //   },
      // });

      socket.emit('notification:read:success', { notificationId: data.notificationId });

    } catch (error) {
      logger.error('Error handling notification read:', error);
      socket.emit('error', { message: 'Failed to mark notification as read' });
    }
  }

  /**
   * Handle live route sharing
   */
  private async handleLiveRouteShare(socket: AuthenticatedSocket, data: { routeId: string; friendIds: string[] }): Promise<void> {
    const userId = socket.userId!;

    try {
      // Notify friends about live route sharing
      data.friendIds.forEach(friendId => {
        this.io.to(`user:${friendId}`).emit('route:live:shared', {
          routeId: data.routeId,
          userId,
          user: socket.user,
        });
      });

      socket.emit('route:live:share:success', { routeId: data.routeId });

    } catch (error) {
      logger.error('Error handling live route share:', error);
      socket.emit('error', { message: 'Failed to share route live' });
    }
  }

  /**
   * Handle socket disconnection
   */
  private handleDisconnection(socket: AuthenticatedSocket): void {
    const userId = socket.userId!;

    logger.info('User disconnected from WebSocket', {
      userId,
      socketId: socket.id,
    });

    // Remove user connection
    this.connectedUsers.delete(userId);

    // Update user online status
    this.updateUserOnlineStatus(userId, false);

    // End any active trips
    const userTrips = Array.from(this.activeTrips.values()).filter(trip => trip.userId === userId);
    userTrips.forEach(trip => {
      trip.isActive = false;
      // Notify shared users
      trip.sharedWith.forEach(friendId => {
        this.io.to(`user:${friendId}`).emit('trip:ended', {
          tripId: trip.tripId,
          userId,
        });
      });
    });
  }

  /**
   * Update user online status
   */
  private async updateUserOnlineStatus(userId: string, isOnline: boolean): Promise<void> {
    try {
      const statusKey = `user_status:${userId}`;
      if (isOnline) {
        await redisClient.setex(statusKey, 300, JSON.stringify({
          isOnline: true,
          lastSeen: Date.now(),
        }));
      } else {
        await redisClient.setex(statusKey, 86400, JSON.stringify({
          isOnline: false,
          lastSeen: Date.now(),
        }));
      }
    } catch (error) {
      logger.error('Error updating user online status:', error);
    }
  }

  /**
   * Setup cleanup timers
   */
  private setupCleanupTimers(): void {
    // Clean up inactive trips every 10 minutes
    setInterval(() => {
      const now = Date.now();
      const tripsToDelete: string[] = [];

      this.activeTrips.forEach((trip, tripId) => {
        // Remove trips that are inactive for more than 1 hour
        if (!trip.isActive && (now - trip.startTime) > 3600000) {
          tripsToDelete.push(tripId);
        }
      });

      tripsToDelete.forEach(tripId => {
        this.activeTrips.delete(tripId);
      });

      if (tripsToDelete.length > 0) {
        logger.info(`Cleaned up ${tripsToDelete.length} inactive trips`);
      }
    }, 600000); // 10 minutes
  }

  /**
   * Send notification to user
   */
  public async sendNotificationToUser(userId: string, notification: any): Promise<void> {
    const socketId = this.connectedUsers.get(userId);
    if (socketId) {
      this.io.to(`user:${userId}`).emit('notification', notification);
    }
  }

  /**
   * Send notification to multiple users
   */
  public async sendNotificationToUsers(userIds: string[], notification: any): Promise<void> {
    userIds.forEach(userId => {
      this.sendNotificationToUser(userId, notification);
    });
  }

  /**
   * Get connected users count
   */
  public getConnectedUsersCount(): number {
    return this.connectedUsers.size;
  }

  /**
   * Get active trips count
   */
  public getActiveTripsCount(): number {
    return Array.from(this.activeTrips.values()).filter(trip => trip.isActive).length;
  }
}

export { WebSocketService };