"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteAccount = exports.getUserAnalytics = exports.changePassword = exports.updatePreferences = exports.getUserPreferences = exports.updateProfile = exports.getUserProfile = void 0;
const zod_1 = require("zod");
const database_1 = require("@/config/database");
const error_1 = require("@/utils/error");
const security_1 = require("@/utils/security");
const logger_1 = require("@/config/logger");
const analytics_1 = require("@/services/analytics");
const updateProfileSchema = zod_1.z.object({
    firstName: zod_1.z.string().min(1).max(100).optional(),
    lastName: zod_1.z.string().min(1).max(100).optional(),
    phone: zod_1.z.string().regex(/^\+?[\d\s\-\(\)]+$/).optional(),
    dateOfBirth: zod_1.z.string().datetime().optional(),
    bio: zod_1.z.string().max(500).optional(),
    avatar: zod_1.z.string().url().optional(),
});
const updatePreferencesSchema = zod_1.z.object({
    defaultTravelMode: zod_1.z.enum(['DRIVING', 'WALKING', 'BICYCLING', 'TRANSIT']).optional(),
    units: zod_1.z.enum(['METRIC', 'IMPERIAL']).optional(),
    language: zod_1.z.string().min(2).max(5).optional(),
    theme: zod_1.z.enum(['LIGHT', 'DARK', 'SYSTEM']).optional(),
    notifications: zod_1.z.object({
        email: zod_1.z.boolean().optional(),
        push: zod_1.z.boolean().optional(),
        sms: zod_1.z.boolean().optional(),
        marketing: zod_1.z.boolean().optional(),
    }).optional(),
    privacy: zod_1.z.object({
        shareLocation: zod_1.z.boolean().optional(),
        showOnlineStatus: zod_1.z.boolean().optional(),
        allowFriendRequests: zod_1.z.boolean().optional(),
        shareTrips: zod_1.z.boolean().optional(),
    }).optional(),
    mapSettings: zod_1.z.object({
        showTraffic: zod_1.z.boolean().optional(),
        showSatellite: zod_1.z.boolean().optional(),
        autoRecenter: zod_1.z.boolean().optional(),
        voiceNavigation: zod_1.z.boolean().optional(),
    }).optional(),
});
const changePasswordSchema = zod_1.z.object({
    currentPassword: zod_1.z.string().min(1),
    newPassword: zod_1.z.string().min(8).max(128)
        .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, 'Password must contain at least one lowercase letter, one uppercase letter, one number, and one special character'),
});
const deleteAccountSchema = zod_1.z.object({
    password: zod_1.z.string().min(1),
    confirmationText: zod_1.z.literal('DELETE MY ACCOUNT'),
    reason: zod_1.z.string().max(500).optional(),
});
const getUserProfile = async (req, res) => {
    try {
        const userId = req.user.id;
        const user = await database_1.prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                phone: true,
                dateOfBirth: true,
                bio: true,
                avatar: true,
                emailVerified: true,
                createdAt: true,
                updatedAt: true,
                _count: {
                    select: {
                        routes: true,
                        places: true,
                        friends: true,
                    },
                },
            },
        });
        if (!user) {
            throw new error_1.AppError('User not found', 404);
        }
        res.status(200).json({
            success: true,
            data: {
                user: {
                    ...user,
                    stats: {
                        routesCount: user._count.routes,
                        placesCount: user._count.places,
                        friendsCount: user._count.friends,
                    },
                },
            },
        });
    }
    catch (error) {
        logger_1.logger.error('Error getting user profile:', error);
        throw new error_1.AppError('Failed to get user profile', 500);
    }
};
exports.getUserProfile = getUserProfile;
const updateProfile = async (req, res) => {
    try {
        const { firstName, lastName, phone, dateOfBirth, bio, avatar } = updateProfileSchema.parse(req.body);
        const userId = req.user.id;
        logger_1.logger.info('Updating user profile', {
            userId,
            fields: Object.keys(req.body),
        });
        if (phone) {
            const existingUser = await database_1.prisma.user.findFirst({
                where: {
                    phone,
                    id: { not: userId },
                },
            });
            if (existingUser) {
                throw new error_1.AppError('Phone number already registered', 409);
            }
        }
        const updatedUser = await database_1.prisma.user.update({
            where: { id: userId },
            data: {
                ...(firstName && { firstName: (0, security_1.sanitizeInput)(firstName) }),
                ...(lastName && { lastName: (0, security_1.sanitizeInput)(lastName) }),
                ...(phone && { phone: (0, security_1.sanitizeInput)(phone) }),
                ...(dateOfBirth && { dateOfBirth: new Date(dateOfBirth) }),
                ...(bio && { bio: (0, security_1.sanitizeInput)(bio) }),
                ...(avatar && { avatar: (0, security_1.sanitizeInput)(avatar) }),
            },
            select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                phone: true,
                dateOfBirth: true,
                bio: true,
                avatar: true,
                emailVerified: true,
                createdAt: true,
                updatedAt: true,
                _count: {
                    select: {
                        routes: true,
                        places: true,
                        friends: true,
                    },
                },
            },
        });
        await analytics_1.analyticsService.trackEvent({
            userId,
            event: 'profile_updated',
            properties: {
                updatedFields: Object.keys(req.body),
            },
        });
        res.status(200).json({
            success: true,
            data: {
                user: {
                    ...updatedUser,
                    stats: {
                        routesCount: updatedUser._count.routes,
                        placesCount: updatedUser._count.places,
                        friendsCount: updatedUser._count.friends,
                    },
                },
            },
        });
    }
    catch (error) {
        logger_1.logger.error('Error updating user profile:', error);
        throw new error_1.AppError('Failed to update profile', 500);
    }
};
exports.updateProfile = updateProfile;
const getUserPreferences = async (req, res) => {
    try {
        const userId = req.user.id;
        const preferences = await database_1.prisma.userPreferences.findUnique({
            where: { userId },
        });
        if (!preferences) {
            const defaultPreferences = await database_1.prisma.userPreferences.create({
                data: {
                    userId,
                    defaultTravelMode: 'DRIVING',
                    units: 'METRIC',
                    language: 'en',
                    theme: 'SYSTEM',
                    notifications: JSON.stringify({
                        email: true,
                        push: true,
                        sms: false,
                        marketing: false,
                    }),
                    privacy: JSON.stringify({
                        shareLocation: false,
                        showOnlineStatus: true,
                        allowFriendRequests: true,
                        shareTrips: false,
                    }),
                    mapSettings: JSON.stringify({
                        showTraffic: true,
                        showSatellite: false,
                        autoRecenter: true,
                        voiceNavigation: true,
                    }),
                },
            });
            res.status(200).json({
                success: true,
                data: {
                    preferences: {
                        ...defaultPreferences,
                        notifications: JSON.parse(defaultPreferences.notifications),
                        privacy: JSON.parse(defaultPreferences.privacy),
                        mapSettings: JSON.parse(defaultPreferences.mapSettings),
                    },
                },
            });
        }
        else {
            res.status(200).json({
                success: true,
                data: {
                    preferences: {
                        ...preferences,
                        notifications: JSON.parse(preferences.notifications),
                        privacy: JSON.parse(preferences.privacy),
                        mapSettings: JSON.parse(preferences.mapSettings),
                    },
                },
            });
        }
    }
    catch (error) {
        logger_1.logger.error('Error getting user preferences:', error);
        throw new error_1.AppError('Failed to get user preferences', 500);
    }
};
exports.getUserPreferences = getUserPreferences;
const updatePreferences = async (req, res) => {
    try {
        const validatedData = updatePreferencesSchema.parse(req.body);
        const userId = req.user.id;
        logger_1.logger.info('Updating user preferences', {
            userId,
            fields: Object.keys(req.body),
        });
        const currentPreferences = await database_1.prisma.userPreferences.findUnique({
            where: { userId },
        });
        if (!currentPreferences) {
            throw new error_1.AppError('User preferences not found', 404);
        }
        const currentNotifications = JSON.parse(currentPreferences.notifications);
        const currentPrivacy = JSON.parse(currentPreferences.privacy);
        const currentMapSettings = JSON.parse(currentPreferences.mapSettings);
        const updatedPreferences = await database_1.prisma.userPreferences.update({
            where: { userId },
            data: {
                ...(validatedData.defaultTravelMode && { defaultTravelMode: validatedData.defaultTravelMode }),
                ...(validatedData.units && { units: validatedData.units }),
                ...(validatedData.language && { language: validatedData.language }),
                ...(validatedData.theme && { theme: validatedData.theme }),
                ...(validatedData.notifications && {
                    notifications: JSON.stringify({
                        ...currentNotifications,
                        ...validatedData.notifications,
                    }),
                }),
                ...(validatedData.privacy && {
                    privacy: JSON.stringify({
                        ...currentPrivacy,
                        ...validatedData.privacy,
                    }),
                }),
                ...(validatedData.mapSettings && {
                    mapSettings: JSON.stringify({
                        ...currentMapSettings,
                        ...validatedData.mapSettings,
                    }),
                }),
            },
        });
        await analytics_1.analyticsService.trackEvent({
            userId,
            event: 'preferences_updated',
            properties: {
                updatedFields: Object.keys(req.body),
            },
        });
        res.status(200).json({
            success: true,
            data: {
                preferences: {
                    ...updatedPreferences,
                    notifications: JSON.parse(updatedPreferences.notifications),
                    privacy: JSON.parse(updatedPreferences.privacy),
                    mapSettings: JSON.parse(updatedPreferences.mapSettings),
                },
            },
        });
    }
    catch (error) {
        logger_1.logger.error('Error updating user preferences:', error);
        throw new error_1.AppError('Failed to update preferences', 500);
    }
};
exports.updatePreferences = updatePreferences;
const changePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);
        const userId = req.user.id;
        logger_1.logger.info('Changing user password', { userId });
        const user = await database_1.prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, password: true },
        });
        if (!user) {
            throw new error_1.AppError('User not found', 404);
        }
        const bcrypt = await Promise.resolve().then(() => __importStar(require('bcrypt')));
        const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
        if (!isCurrentPasswordValid) {
            throw new error_1.AppError('Current password is incorrect', 400);
        }
        const hashedNewPassword = await bcrypt.hash(newPassword, 12);
        await database_1.prisma.user.update({
            where: { id: userId },
            data: {
                password: hashedNewPassword,
            },
        });
        await database_1.prisma.session.deleteMany({
            where: { userId },
        });
        await analytics_1.analyticsService.trackEvent({
            userId,
            event: 'password_changed',
        });
        res.status(200).json({
            success: true,
            message: 'Password changed successfully. Please log in again.',
        });
    }
    catch (error) {
        logger_1.logger.error('Error changing password:', error);
        throw new error_1.AppError('Failed to change password', 500);
    }
};
exports.changePassword = changePassword;
const getUserAnalytics = async (req, res) => {
    try {
        const { days = '30' } = req.query;
        const userId = req.user.id;
        const daysNumber = parseInt(days, 10);
        if (isNaN(daysNumber) || daysNumber < 1 || daysNumber > 365) {
            throw new error_1.AppError('Days must be a number between 1 and 365', 400);
        }
        logger_1.logger.info('Getting user analytics', { userId, days: daysNumber });
        const analytics = await analytics_1.analyticsService.getUserAnalytics(userId, daysNumber);
        res.status(200).json({
            success: true,
            data: {
                analytics,
            },
        });
    }
    catch (error) {
        logger_1.logger.error('Error getting user analytics:', error);
        throw new error_1.AppError('Failed to get user analytics', 500);
    }
};
exports.getUserAnalytics = getUserAnalytics;
const deleteAccount = async (req, res) => {
    try {
        const { password, confirmationText, reason } = deleteAccountSchema.parse(req.body);
        const userId = req.user.id;
        logger_1.logger.info('Deleting user account', { userId, reason });
        const user = await database_1.prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, password: true, email: true },
        });
        if (!user) {
            throw new error_1.AppError('User not found', 404);
        }
        const bcrypt = await Promise.resolve().then(() => __importStar(require('bcrypt')));
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            throw new error_1.AppError('Password is incorrect', 400);
        }
        await database_1.prisma.$transaction(async (tx) => {
            await tx.session.deleteMany({ where: { userId } });
            await tx.analyticsEvent.deleteMany({ where: { userId } });
            await tx.userPreferences.deleteMany({ where: { userId } });
            await tx.route.deleteMany({ where: { userId } });
            await tx.place.deleteMany({ where: { userId } });
            await tx.friendship.deleteMany({
                where: {
                    OR: [
                        { requesterId: userId },
                        { addresseeId: userId },
                    ],
                },
            });
            await tx.user.delete({ where: { id: userId } });
        });
        try {
            await analytics_1.analyticsService.trackEvent({
                userId,
                event: 'account_deleted',
                properties: {
                    reason: reason || 'Not specified',
                },
            });
        }
        catch (analyticsError) {
        }
        res.status(200).json({
            success: true,
            message: 'Account deleted successfully',
        });
    }
    catch (error) {
        logger_1.logger.error('Error deleting account:', error);
        throw new error_1.AppError('Failed to delete account', 500);
    }
};
exports.deleteAccount = deleteAccount;
//# sourceMappingURL=users.js.map