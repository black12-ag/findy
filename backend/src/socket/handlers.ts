import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { prisma } from '@/config/database';
import { redisClient } from '@/config/redis';
import logger from '@/config/logger';
import { config } from '@/config/config';

// Extend Socket type to include user information
interface AuthenticatedSocket extends Socket {
  userId?: string;
  userEmail?: string;
}

// Location update interface
interface LocationUpdate {
  latitude: number;
  longitude: number;
  accuracy?: number;
  heading?: number;
  speed?: number;
  timestamp: string;
}

// Route progress interface
interface RouteProgress {
  routeId: string;
  progress: number; // 0-100
  currentLocation: {
    latitude: number;
    longitude: number;
  };
  estimatedTimeRemaining?: number;
}

// ETA sharing interface
interface ETAShare {
  routeId: string;
  recipientIds: string[];
  estimatedArrival: string;
  currentLocation: {
    latitude: number;
    longitude: number;
  };
}

// Notification interface
interface PushNotification {
  type: 'info' | 'warning' | 'error' | 'success';
  title: string;
  message: string;
  data?: any;
  recipientIds?: string[];
}

export class SocketHandlers {
  private io: Server;
  private connectedUsers = new Map<string, string>(); // userId -> socketId
  
  constructor(io: Server) {
    this.io = io;
    this.setupMiddleware();
    this.setupEventHandlers();
  }

  private setupMiddleware() {
    // Authentication middleware
    this.io.use(async (socket: AuthenticatedSocket, next) => {
      try {
        const token = socket.handshake.auth.token || 
                     socket.handshake.headers.authorization?.replace('Bearer ', '');

        if (!token) {
          return next(new Error('Authentication token missing'));
        }

        // Verify JWT token
        const decoded = jwt.verify(token, config.auth.jwtSecret) as any;
        
        // Fetch user from database
        const user = await prisma.user.findUnique({
          where: { id: decoded.userId, isActive: true }
        });

        if (!user) {
          return next(new Error('User not found or inactive'));
        }

        // Attach user info to socket
        socket.userId = user.id;
        socket.userEmail = user.email;

        logger.info('Socket authenticated', { 
          userId: user.id, 
          socketId: socket.id 
        });

        next();
      } catch (error) {
        logger.error('Socket authentication failed', { error });
        next(new Error('Authentication failed'));
      }
    });
  }

  private setupEventHandlers() {
    this.io.on('connection', (socket: AuthenticatedSocket) => {
      this.handleConnection(socket);
    });
  }

  private handleConnection(socket: AuthenticatedSocket) {
    const userId = socket.userId!;
    
    logger.info('User connected via socket', { 
      userId, 
      socketId: socket.id 
    });

    // Store connection
    this.connectedUsers.set(userId, socket.id);

    // Join user-specific room
    socket.join(`user:${userId}`);

    // Set up event handlers
    this.setupLocationHandlers(socket);
    this.setupRouteHandlers(socket);
    this.setupNotificationHandlers(socket);
    this.setupSocialHandlers(socket);

    // Handle disconnection
    socket.on('disconnect', () => {
      this.handleDisconnection(socket);
    });

    // Send welcome message
    socket.emit('connected', {
      message: 'Successfully connected to PathFinder Pro',
      userId,
      timestamp: new Date().toISOString()
    });
  }

  private setupLocationHandlers(socket: AuthenticatedSocket) {
    const userId = socket.userId!;

    // Handle location updates
    socket.on('location:update', async (data: LocationUpdate) => {
      try {
        logger.debug('Location update received', { userId, data });

        // Validate location data
        if (!this.isValidLocation(data)) {
          socket.emit('error', { message: 'Invalid location data' });
          return;
        }

        // Store location in Redis (temporary storage)
        const locationKey = `location:${userId}`;
        await redisClient.setex(locationKey, 300, JSON.stringify({
          ...data,
          userId,
          timestamp: new Date().toISOString()
        }));

        // Broadcast to friends who are sharing location
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
      } catch (error) {
        logger.error('Error handling location update', { error, userId });
        socket.emit('error', { message: 'Failed to process location update' });
      }
    });
  }

  private setupRouteHandlers(socket: AuthenticatedSocket) {
    const userId = socket.userId!;

    // Handle route recalculation requests
    socket.on('route:recalculate', async (data: { routeId: string; reason: string }) => {
      try {
        logger.info('Route recalculation requested', { userId, ...data });

        // Fetch route from database
        const route = await prisma.route.findFirst({
          where: { id: data.routeId, userId },
          include: { waypoints: true }
        });

        if (!route) {
          socket.emit('error', { message: 'Route not found' });
          return;
        }

        // Trigger route recalculation (would integrate with routing service)
        // For now, emit a mock response
        socket.emit('route:recalculated', {
          routeId: data.routeId,
          status: 'success',
          newRoute: {
            distance: route.distance,
            duration: route.duration,
            updatedAt: new Date().toISOString()
          }
        });

      } catch (error) {
        logger.error('Error recalculating route', { error, userId });
        socket.emit('error', { message: 'Failed to recalculate route' });
      }
    });

    // Handle route progress updates
    socket.on('route:progress', async (data: RouteProgress) => {
      try {
        logger.debug('Route progress update', { userId, data });

        // Store progress in Redis
        const progressKey = `route_progress:${data.routeId}:${userId}`;
        await redisClient.setex(progressKey, 3600, JSON.stringify({
          ...data,
          userId,
          timestamp: new Date().toISOString()
        }));

        // Notify friends who are tracking this route
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
      } catch (error) {
        logger.error('Error handling route progress', { error, userId });
        socket.emit('error', { message: 'Failed to process route progress' });
      }
    });
  }

  private setupNotificationHandlers(socket: AuthenticatedSocket) {
    const userId = socket.userId!;

    // Handle push notification requests
    socket.on('notification:send', async (data: PushNotification) => {
      try {
        logger.info('Push notification requested', { userId, data });

        // If no specific recipients, send to user's friends
        const recipients = data.recipientIds || await this.getActiveFriends(userId);

        // Send notifications
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

        // Store notification in database for offline users
        await this.storeNotificationForOfflineUsers(recipients, data, userId);

        socket.emit('notification:sent', { 
          status: 'success',
          recipientCount: recipients.length 
        });
      } catch (error) {
        logger.error('Error sending notification', { error, userId });
        socket.emit('error', { message: 'Failed to send notification' });
      }
    });
  }

  private setupSocialHandlers(socket: AuthenticatedSocket) {
    const userId = socket.userId!;

    // Handle ETA sharing
    socket.on('eta:share', async (data: ETAShare) => {
      try {
        logger.info('ETA sharing requested', { userId, data });

        // Send ETA to specified recipients
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
      } catch (error) {
        logger.error('Error sharing ETA', { error, userId });
        socket.emit('error', { message: 'Failed to share ETA' });
      }
    });

    // Handle joining location sharing rooms
    socket.on('location:share:start', async (data: { friendIds: string[] }) => {
      try {
        logger.info('Location sharing started', { userId, friendIds: data.friendIds });

        // Join sharing rooms
        data.friendIds.forEach(friendId => {
          socket.join(`location_share:${friendId}`);
        });

        socket.emit('location:share:started', { status: 'success' });
      } catch (error) {
        logger.error('Error starting location sharing', { error, userId });
        socket.emit('error', { message: 'Failed to start location sharing' });
      }
    });
  }

  private handleDisconnection(socket: AuthenticatedSocket) {
    const userId = socket.userId;
    
    if (userId) {
      logger.info('User disconnected', { userId, socketId: socket.id });
      
      // Remove from connected users
      this.connectedUsers.delete(userId);

      // Update user's last seen
      this.updateUserLastSeen(userId);
    }
  }

  // Helper methods
  private isValidLocation(data: LocationUpdate): boolean {
    return (
      typeof data.latitude === 'number' &&
      typeof data.longitude === 'number' &&
      data.latitude >= -90 && data.latitude <= 90 &&
      data.longitude >= -180 && data.longitude <= 180
    );
  }

  private async getActiveFriends(userId: string): Promise<string[]> {
    try {
      const friendships = await prisma.friendship.findMany({
        where: {
          OR: [
            { userId: userId, status: 'ACCEPTED' },
            { friendId: userId, status: 'ACCEPTED' }
          ]
        }
      });

      return friendships.map(friendship => 
        friendship.userId === userId ? friendship.friendId : friendship.userId
      );
    } catch (error) {
      logger.error('Error fetching friends', { error, userId });
      return [];
    }
  }

  private async getRouteShareRecipients(routeId: string): Promise<string[]> {
    try {
      // This would fetch from a route sharing table
      // For now, return empty array
      return [];
    } catch (error) {
      logger.error('Error fetching route share recipients', { error, routeId });
      return [];
    }
  }

  private async storeNotificationForOfflineUsers(
    recipientIds: string[], 
    notification: PushNotification, 
    senderId: string
  ): Promise<void> {
    try {
      // Store notifications in database for offline users
      const offlineUsers = recipientIds.filter(id => !this.connectedUsers.has(id));
      
      // This would store in a notifications table
      // For now, just log
      if (offlineUsers.length > 0) {
        logger.info('Storing notifications for offline users', { 
          offlineUsers,
          notification: notification.title 
        });
      }
    } catch (error) {
      logger.error('Error storing offline notifications', { error });
    }
  }

  private async updateUserLastSeen(userId: string): Promise<void> {
    try {
      await prisma.user.update({
        where: { id: userId },
        data: { updatedAt: new Date() }
      });
    } catch (error) {
      logger.error('Error updating user last seen', { error, userId });
    }
  }

  // Public methods for external use
  public getUserSocketId(userId: string): string | undefined {
    return this.connectedUsers.get(userId);
  }

  public isUserOnline(userId: string): boolean {
    return this.connectedUsers.has(userId);
  }

  public getOnlineUsersCount(): number {
    return this.connectedUsers.size;
  }

  public async broadcastToAllUsers(event: string, data: any): Promise<void> {
    this.io.emit(event, data);
    logger.info('Broadcasted message to all users', { event, userCount: this.connectedUsers.size });
  }
}