"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSharedContent = exports.sharePlace = exports.shareRoute = exports.removeFriend = exports.getFriends = exports.respondToFriendRequest = exports.sendFriendRequest = void 0;
const zod_1 = require("zod");
const database_1 = require("@/config/database");
const error_1 = require("@/utils/error");
const security_1 = require("@/utils/security");
const logger_1 = require("@/config/logger");
const analytics_simple_1 = require("@/services/analytics-simple");
const sendFriendRequestSchema = zod_1.z.object({
    email: zod_1.z.string().email().optional(),
    userId: zod_1.z.string().uuid().optional(),
}).refine(data => data.email || data.userId, {
    message: "Either email or userId must be provided"
});
const shareRouteSchema = zod_1.z.object({
    routeId: zod_1.z.string().uuid(),
    friendIds: zod_1.z.array(zod_1.z.string().uuid()).min(1),
    message: zod_1.z.string().max(500).optional(),
});
const sharePlaceSchema = zod_1.z.object({
    placeId: zod_1.z.string().uuid(),
    friendIds: zod_1.z.array(zod_1.z.string().uuid()).min(1),
    message: zod_1.z.string().max(500).optional(),
});
const sendFriendRequest = async (req, res) => {
    try {
        const { email, userId } = sendFriendRequestSchema.parse(req.body);
        const requesterId = req.user.id;
        logger_1.logger.info('Sending friend request', {
            requesterId,
            email,
            userId,
        });
        let targetUser;
        if (email) {
            targetUser = await database_1.prisma.user.findUnique({
                where: { email },
                select: { id: true, email: true, firstName: true, lastName: true },
            });
        }
        else if (userId) {
            targetUser = await database_1.prisma.user.findUnique({
                where: { id: userId },
                select: { id: true, email: true, firstName: true, lastName: true },
            });
        }
        if (!targetUser) {
            throw new error_1.AppError('User not found', 404);
        }
        if (targetUser.id === requesterId) {
            throw new error_1.AppError('Cannot send friend request to yourself', 400);
        }
        const existingFriendship = await database_1.prisma.friendship.findFirst({
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
                throw new error_1.AppError('Already friends with this user', 409);
            }
            else if (existingFriendship.status === 'PENDING') {
                throw new error_1.AppError('Friend request already sent', 409);
            }
        }
        const targetPreferences = await database_1.prisma.userPreferences.findUnique({
            where: { userId: targetUser.id },
        });
        if (targetPreferences) {
            const privacy = JSON.parse(targetPreferences.privacy);
            if (!privacy.allowFriendRequests) {
                throw new error_1.AppError('User is not accepting friend requests', 403);
            }
        }
        const friendRequest = await database_1.prisma.friendship.create({
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
        await analytics_simple_1.analyticsService.trackEvent({
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
    }
    catch (error) {
        logger_1.logger.error('Error sending friend request:', error);
        throw new error_1.AppError('Failed to send friend request', 500);
    }
};
exports.sendFriendRequest = sendFriendRequest;
const respondToFriendRequest = async (req, res) => {
    try {
        const { requestId } = req.params;
        const { action } = req.body;
        const userId = req.user.id;
        if (!['ACCEPT', 'REJECT'].includes(action)) {
            throw new error_1.AppError('Invalid action. Must be ACCEPT or REJECT', 400);
        }
        logger_1.logger.info('Responding to friend request', {
            userId,
            requestId,
            action,
        });
        const friendRequest = await database_1.prisma.friendship.findFirst({
            where: {
                id: requestId,
                addresseeId: userId,
                status: 'PENDING',
            },
        });
        if (!friendRequest) {
            throw new error_1.AppError('Friend request not found', 404);
        }
        const updatedRequest = await database_1.prisma.friendship.update({
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
        await analytics_simple_1.analyticsService.trackEvent({
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
    }
    catch (error) {
        logger_1.logger.error('Error responding to friend request:', error);
        throw new error_1.AppError('Failed to respond to friend request', 500);
    }
};
exports.respondToFriendRequest = respondToFriendRequest;
const getFriends = async (req, res) => {
    try {
        const { status = 'ACCEPTED', page = 1, limit = 20 } = req.query;
        const userId = req.user.id;
        const skip = (page - 1) * limit;
        logger_1.logger.info('Getting user friends', {
            userId,
            status,
            page,
            limit,
        });
        const [friendships, total] = await Promise.all([
            database_1.prisma.friendship.findMany({
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
            database_1.prisma.friendship.count({
                where: {
                    OR: [
                        { requesterId: userId },
                        { addresseeId: userId },
                    ],
                    status,
                },
            }),
        ]);
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
    }
    catch (error) {
        logger_1.logger.error('Error getting friends:', error);
        throw new error_1.AppError('Failed to get friends', 500);
    }
};
exports.getFriends = getFriends;
const removeFriend = async (req, res) => {
    try {
        const { friendshipId } = req.params;
        const userId = req.user.id;
        logger_1.logger.info('Removing friend', {
            userId,
            friendshipId,
        });
        const deletedFriendship = await database_1.prisma.friendship.deleteMany({
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
            throw new error_1.AppError('Friendship not found', 404);
        }
        await analytics_simple_1.analyticsService.trackEvent({
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
    }
    catch (error) {
        logger_1.logger.error('Error removing friend:', error);
        throw new error_1.AppError('Failed to remove friend', 500);
    }
};
exports.removeFriend = removeFriend;
const shareRoute = async (req, res) => {
    try {
        const { routeId, friendIds, message } = shareRouteSchema.parse(req.body);
        const userId = req.user.id;
        logger_1.logger.info('Sharing route', {
            userId,
            routeId,
            friendIds,
        });
        const route = await database_1.prisma.route.findFirst({
            where: {
                id: routeId,
                userId,
            },
        });
        if (!route) {
            throw new error_1.AppError('Route not found', 404);
        }
        const friendships = await database_1.prisma.friendship.findMany({
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
            throw new error_1.AppError('One or more users are not your friends', 400);
        }
        const shares = await Promise.all(friendIds.map(friendId => database_1.prisma.sharedContent.create({
            data: {
                userId,
                type: 'route',
                itemId: routeId,
                title: route.name,
                message: message ? (0, security_1.sanitizeInput)(message) : null,
                recipients: [friendId],
                shareToken: Math.random().toString(36).substring(2, 15),
            },
        })));
        await analytics_simple_1.analyticsService.trackEvent({
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
    }
    catch (error) {
        logger_1.logger.error('Error sharing route:', error);
        throw new error_1.AppError('Failed to share route', 500);
    }
};
exports.shareRoute = shareRoute;
const sharePlace = async (req, res) => {
    try {
        const { placeId, friendIds, message } = sharePlaceSchema.parse(req.body);
        const userId = req.user.id;
        logger_1.logger.info('Sharing place', {
            userId,
            placeId,
            friendIds,
        });
        const place = await database_1.prisma.place.findFirst({
            where: {
                id: placeId,
                userId,
            },
        });
        if (!place) {
            throw new error_1.AppError('Place not found', 404);
        }
        const friendships = await database_1.prisma.friendship.findMany({
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
            throw new error_1.AppError('One or more users are not your friends', 400);
        }
        const shares = await Promise.all(friendIds.map(friendId => database_1.prisma.sharedContent.create({
            data: {
                userId,
                type: 'place',
                itemId: placeId,
                title: place.name,
                message: message ? (0, security_1.sanitizeInput)(message) : null,
                recipients: [friendId],
                shareToken: Math.random().toString(36).substring(2, 15),
            },
        })));
        await analytics_simple_1.analyticsService.trackEvent({
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
    }
    catch (error) {
        logger_1.logger.error('Error sharing place:', error);
        throw new error_1.AppError('Failed to share place', 500);
    }
};
exports.sharePlace = sharePlace;
const getSharedContent = async (req, res) => {
    try {
        const { type, page = 1, limit = 20 } = req.query;
        const userId = req.user.id;
        const skip = (page - 1) * limit;
        logger_1.logger.info('Getting shared content', {
            userId,
            type,
            page,
            limit,
        });
        const where = { recipients: { has: userId } };
        if (type) {
            where.type = type;
        }
        const [sharedContent, total] = await Promise.all([
            database_1.prisma.sharedContent.findMany({
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
            database_1.prisma.sharedContent.count({ where }),
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
    }
    catch (error) {
        logger_1.logger.error('Error getting shared content:', error);
        throw new error_1.AppError('Failed to get shared content', 500);
    }
};
exports.getSharedContent = getSharedContent;
//# sourceMappingURL=social.js.map