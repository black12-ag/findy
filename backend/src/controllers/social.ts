import { Response } from 'express';
import { AuthenticatedRequest } from '@/types';
import { z } from 'zod';
import { prisma } from '@/config/database';
import { AppError } from '@/utils/error';
import { sanitizeInput } from '@/utils/security';
import { logger } from '@/config/logger';
import { analyticsService } from "@/services/analytics-simple";
import type {
  SendFriendRequestRequest,
  FriendRequestResponse,
  GetFriendsRequest,
  FriendsResponse,
  ShareRouteRequest,
  SharePlaceRequest,
  SharedItemResponse,
} from '@/types/api';

// Validation schemas
const sendFriendRequestSchema = z.object({
  email: z.string().email().optional(),
  userId: z.string().uuid().optional(),
}).refine(data => data.email || data.userId, {
  message: "Either email or userId must be provided"
});

const shareRouteSchema = z.object({
  routeId: z.string().uuid(),
  friendIds: z.array(z.string().uuid()).min(1),
  message: z.string().max(500).optional(),
});

const sharePlaceSchema = z.object({
  placeId: z.string().uuid(),
  friendIds: z.array(z.string().uuid()).min(1),
  message: z.string().max(500).optional(),
});

/**
 * Send friend request
 */
export const sendFriendRequest = async (
  req: AuthenticatedRequest & { body: SendFriendRequestRequest },
  res: Response<FriendRequestResponse>
): Promise<void> => {
  try {
    const { email, userId } = sendFriendRequestSchema.parse(req.body);
    const requesterId = req.user!.id;

    logger.info('Sending friend request', {
      requesterId,
      email,
      userId,
    });

    // Find target user
    let targetUser;
    if (email) {
      targetUser = await prisma.user.findUnique({
        where: { email },
        select: { id: true, email: true, firstName: true, lastName: true },
      });
    } else if (userId) {
      targetUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, email: true, firstName: true, lastName: true },
      });
    }

    if (!targetUser) {
      throw new AppError('User not found', 404);
    }

    if (targetUser.id === requesterId) {
      throw new AppError('Cannot send friend request to yourself', 400);
    }

    // Check if friendship already exists
    const existingFriendship = await prisma.friendship.findFirst({
      where: {
        OR: [
          {
            requesterId,
            addresseeId: targetUser.id,
          },
          {
            requesterId: targetUser.id,
            addresseeId: requesterId,
          },
        ],
      },
    });

    if (existingFriendship) {
      if (existingFriendship.status === 'ACCEPTED') {
        throw new AppError('Already friends with this user', 409);
      } else if (existingFriendship.status === 'PENDING') {
        throw new AppError('Friend request already sent', 409);
      }
    }

    // Check user's privacy settings
    const targetPreferences = await prisma.userPreferences.findUnique({
      where: { userId: targetUser.id },
    });

    if (targetPreferences) {
      const privacy = JSON.parse(targetPreferences.privacy as string);
      if (!privacy.allowFriendRequests) {
        throw new AppError('User is not accepting friend requests', 403);
      }
    }

    // Create friend request
    const friendRequest = await prisma.friendship.create({
      data: {
        userId: requesterId,
        friendId: targetUser.id,
        requesterId,
        addresseeId: targetUser.id,
        status: 'PENDING',
      },
      include: {
        requester: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            avatar: true,
          },
        },
        addressee: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            avatar: true,
          },
        },
      },
    });

    // Track analytics
    await analyticsService.trackEvent({
      userId: requesterId,
      event: 'friend_request_sent',
      properties: {
        targetUserId: targetUser.id,
      },
    });

    res.status(201).json({
      success: true,
      data: friendRequest,
    });
  } catch (error) {
    logger.error('Error sending friend request:', error);
    throw new AppError('Failed to send friend request', 500);
  }
};

/**
 * Respond to friend request
 */
export const respondToFriendRequest = async (
  req: AuthenticatedRequest & { params: { requestId: string }; body: { action: 'ACCEPT' | 'REJECT' } },
  res: Response
): Promise<void> => {
  try {
    const { requestId } = req.params;
    const { action } = req.body;
    const userId = req.user!.id;

    if (!['ACCEPT', 'REJECT'].includes(action)) {
      throw new AppError('Invalid action. Must be ACCEPT or REJECT', 400);
    }

    logger.info('Responding to friend request', {
      userId,
      requestId,
      action,
    });

    // Find the friend request
    const friendRequest = await prisma.friendship.findFirst({
      where: {
        id: requestId,
        addresseeId: userId,
        status: 'PENDING',
      },
    });

    if (!friendRequest) {
      throw new AppError('Friend request not found', 404);
    }

    // Update the friend request
    const updatedRequest = await prisma.friendship.update({
      where: { id: requestId },
      data: {
        status: action === 'ACCEPT' ? 'ACCEPTED' : 'BLOCKED',
      },
      include: {
        requester: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            avatar: true,
          },
        },
        addressee: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            avatar: true,
          },
        },
      },
    });

    // Track analytics
    await analyticsService.trackEvent({
      userId,
      event: 'friend_request_responded',
      properties: {
        requestId,
        action,
        requesterId: friendRequest.requesterId,
      },
    });

    res.status(200).json({
      success: true,
      data: updatedRequest,
    });
  } catch (error) {
    logger.error('Error responding to friend request:', error);
    throw new AppError('Failed to respond to friend request', 500);
  }
};

/**
 * Get user's friends
 */
export const getFriends = async (
  req: AuthenticatedRequest & { query: GetFriendsRequest },
  res: Response<FriendsResponse>
): Promise<void> => {
  try {
    const { status = 'ACCEPTED', page = 1, limit = 20 } = req.query;
    const userId = req.user!.id;
    const skip = (page - 1) * limit;

    logger.info('Getting user friends', {
      userId,
      status,
      page,
      limit,
    });

    // Get friendships
    const [friendships, total] = await Promise.all([
      prisma.friendship.findMany({
        where: {
          OR: [
            { requesterId: userId },
            { addresseeId: userId },
          ],
          status,
        },
        include: {
          requester: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              avatar: true,
            },
          },
          addressee: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              avatar: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take: limit,
      }),
      prisma.friendship.count({
        where: {
          OR: [
            { requesterId: userId },
            { addresseeId: userId },
          ],
          status,
        },
      }),
    ]);

    // Format response to show the friend (not the current user)
    const friends = friendships.map(friendship => ({
      ...friendship,
      friend: friendship.requesterId === userId ? friendship.addressee : friendship.requester,
    }));

    res.status(200).json({
      success: true,
      data: friends,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    logger.error('Error getting friends:', error);
    throw new AppError('Failed to get friends', 500);
  }
};

/**
 * Remove friend
 */
export const removeFriend = async (
  req: AuthenticatedRequest & { params: { friendshipId: string } },
  res: Response
): Promise<void> => {
  try {
    const { friendshipId } = req.params;
    const userId = req.user!.id;

    logger.info('Removing friend', {
      userId,
      friendshipId,
    });

    // Find and delete the friendship
    const deletedFriendship = await prisma.friendship.deleteMany({
      where: {
        id: friendshipId,
        OR: [
          { requesterId: userId },
          { addresseeId: userId },
        ],
        status: 'ACCEPTED',
      },
    });

    if (deletedFriendship.count === 0) {
      throw new AppError('Friendship not found', 404);
    }

    // Track analytics
    await analyticsService.trackEvent({
      userId,
      event: 'friend_removed',
      properties: {
        friendshipId,
      },
    });

    res.status(200).json({
      success: true,
      message: 'Friend removed successfully',
    });
  } catch (error) {
    logger.error('Error removing friend:', error);
    throw new AppError('Failed to remove friend', 500);
  }
};

/**
 * Share a route with friends
 */
export const shareRoute = async (
  req: AuthenticatedRequest & { body: ShareRouteRequest },
  res: Response<SharedItemResponse>
): Promise<void> => {
  try {
    const { routeId, friendIds, message } = shareRouteSchema.parse(req.body);
    const userId = req.user!.id;

    logger.info('Sharing route', {
      userId,
      routeId,
      friendIds,
    });

    // Verify route exists and belongs to user
    const route = await prisma.route.findFirst({
      where: {
        id: routeId,
        userId,
      },
    });

    if (!route) {
      throw new AppError('Route not found', 404);
    }

    // Verify all friend IDs are valid friends
    const friendships = await prisma.friendship.findMany({
      where: {
        OR: [
          {
            requesterId: userId,
            addresseeId: { in: friendIds },
          },
          {
            requesterId: { in: friendIds },
            addresseeId: userId,
          },
        ],
        status: 'ACCEPTED',
      },
    });

    if (friendships.length !== friendIds.length) {
      throw new AppError('One or more users are not your friends', 400);
    }

    // Create share records
    const shares = await Promise.all(
      friendIds.map(friendId =>
        prisma.sharedContent.create({
          data: {
            userId,
            type: 'route',
            itemId: routeId,
            title: route.name,
            message: message ? sanitizeInput(message) : null,
            recipients: [friendId],
            shareToken: Math.random().toString(36).substring(2, 15),
          },
        })
      )
    );

    // Track analytics
    await analyticsService.trackEvent({
      userId,
      event: 'route_shared',
      properties: {
        routeId,
        friendsCount: friendIds.length,
        hasMessage: !!message,
      },
    });

    res.status(201).json({
      success: true,
      data: {
        shares,
      },
    });
  } catch (error) {
    logger.error('Error sharing route:', error);
    throw new AppError('Failed to share route', 500);
  }
};

/**
 * Share a place with friends
 */
export const sharePlace = async (
  req: AuthenticatedRequest & { body: SharePlaceRequest },
  res: Response<SharedItemResponse>
): Promise<void> => {
  try {
    const { placeId, friendIds, message } = sharePlaceSchema.parse(req.body);
    const userId = req.user!.id;

    logger.info('Sharing place', {
      userId,
      placeId,
      friendIds,
    });

    // Verify place exists and belongs to user
    const place = await prisma.place.findFirst({
      where: {
        id: placeId,
        userId,
      },
    });

    if (!place) {
      throw new AppError('Place not found', 404);
    }

    // Verify all friend IDs are valid friends
    const friendships = await prisma.friendship.findMany({
      where: {
        OR: [
          {
            requesterId: userId,
            addresseeId: { in: friendIds },
          },
          {
            requesterId: { in: friendIds },
            addresseeId: userId,
          },
        ],
        status: 'ACCEPTED',
      },
    });

    if (friendships.length !== friendIds.length) {
      throw new AppError('One or more users are not your friends', 400);
    }

    // Create share records
    const shares = await Promise.all(
      friendIds.map(friendId =>
        prisma.sharedContent.create({
          data: {
            userId,
            type: 'place',
            itemId: placeId,
            title: place.name,
            message: message ? sanitizeInput(message) : null,
            recipients: [friendId],
            shareToken: Math.random().toString(36).substring(2, 15),
          },
        })
      )
    );

    // Track analytics
    await analyticsService.trackEvent({
      userId,
      event: 'place_shared',
      properties: {
        placeId,
        friendsCount: friendIds.length,
        hasMessage: !!message,
      },
    });

    res.status(201).json({
      success: true,
      data: {
        shares,
      },
    });
  } catch (error) {
    logger.error('Error sharing place:', error);
    throw new AppError('Failed to share place', 500);
  }
};

/**
 * Get shared content received by user
 */
export const getSharedContent = async (
  req: AuthenticatedRequest & { query: { type?: 'route' | 'place'; page?: number; limit?: number } },
  res: Response
): Promise<void> => {
  try {
    const { type, page = 1, limit = 20 } = req.query;
    const userId = req.user!.id;
    const skip = (page - 1) * limit;

    logger.info('Getting shared content', {
      userId,
      type,
      page,
      limit,
    });

    const where: any = { recipients: { has: userId } };
    if (type) {
      where.type = type;
    }

    const [sharedContent, total] = await Promise.all([
      prisma.sharedContent.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              avatar: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take: limit,
      }),
      prisma.sharedContent.count({ where }),
    ]);

    res.status(200).json({
      success: true,
      data: sharedContent,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    logger.error('Error getting shared content:', error);
    throw new AppError('Failed to get shared content', 500);
  }
};