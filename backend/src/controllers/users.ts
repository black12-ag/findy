import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '@/config/database';
import { AppError } from '@/utils/error';
import { sanitizeInput } from '@/utils/security';
import { logger } from '@/config/logger';
import { analyticsService } from '@/services/analytics';
import type {
  UpdateProfileRequest,
  UpdatePreferencesRequest,
  ChangePasswordRequest,
  DeleteAccountRequest,
  UserProfileResponse,
  UserPreferencesResponse,
  UserAnalyticsResponse,
} from '@/types/api';

// Validation schemas
const updateProfileSchema = z.object({
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  phone: z.string().regex(/^\+?[\d\s\-\(\)]+$/).optional(),
  dateOfBirth: z.string().datetime().optional(),
  bio: z.string().max(500).optional(),
  avatar: z.string().url().optional(),
});

const updatePreferencesSchema = z.object({
  defaultTravelMode: z.enum(['DRIVING', 'WALKING', 'BICYCLING', 'TRANSIT']).optional(),
  units: z.enum(['METRIC', 'IMPERIAL']).optional(),
  language: z.string().min(2).max(5).optional(),
  theme: z.enum(['LIGHT', 'DARK', 'SYSTEM']).optional(),
  notifications: z.object({
    email: z.boolean().optional(),
    push: z.boolean().optional(),
    sms: z.boolean().optional(),
    marketing: z.boolean().optional(),
  }).optional(),
  privacy: z.object({
    shareLocation: z.boolean().optional(),
    showOnlineStatus: z.boolean().optional(),
    allowFriendRequests: z.boolean().optional(),
    shareTrips: z.boolean().optional(),
  }).optional(),
  mapSettings: z.object({
    showTraffic: z.boolean().optional(),
    showSatellite: z.boolean().optional(),
    autoRecenter: z.boolean().optional(),
    voiceNavigation: z.boolean().optional(),
  }).optional(),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(128)
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, 
      'Password must contain at least one lowercase letter, one uppercase letter, one number, and one special character'),
});

const deleteAccountSchema = z.object({
  password: z.string().min(1),
  confirmationText: z.literal('DELETE MY ACCOUNT'),
  reason: z.string().max(500).optional(),
});

/**
 * Get user profile
 */
export const getUserProfile = async (
  req: Request,
  res: Response<UserProfileResponse>
): Promise<void> => {
  try {
    const userId = req.user!.id;

    const user = await prisma.user.findUnique({
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
      throw new AppError('User not found', 404);
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
  } catch (error) {
    logger.error('Error getting user profile:', error);
    throw new AppError('Failed to get user profile', 500);
  }
};

/**
 * Update user profile
 */
export const updateProfile = async (
  req: Request<{}, UserProfileResponse, UpdateProfileRequest>,
  res: Response<UserProfileResponse>
): Promise<void> => {
  try {
    const { firstName, lastName, phone, dateOfBirth, bio, avatar } = 
      updateProfileSchema.parse(req.body);
    const userId = req.user!.id;

    logger.info('Updating user profile', {
      userId,
      fields: Object.keys(req.body),
    });

    // Check if phone number is already taken by another user
    if (phone) {
      const existingUser = await prisma.user.findFirst({
        where: {
          phone,
          id: { not: userId },
        },
      });

      if (existingUser) {
        throw new AppError('Phone number already registered', 409);
      }
    }

    // Update user profile
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(firstName && { firstName: sanitizeInput(firstName) }),
        ...(lastName && { lastName: sanitizeInput(lastName) }),
        ...(phone && { phone: sanitizeInput(phone) }),
        ...(dateOfBirth && { dateOfBirth: new Date(dateOfBirth) }),
        ...(bio && { bio: sanitizeInput(bio) }),
        ...(avatar && { avatar: sanitizeInput(avatar) }),
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

    // Track analytics
    await analyticsService.trackEvent({
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
  } catch (error) {
    logger.error('Error updating user profile:', error);
    throw new AppError('Failed to update profile', 500);
  }
};

/**
 * Get user preferences
 */
export const getUserPreferences = async (
  req: Request,
  res: Response<UserPreferencesResponse>
): Promise<void> => {
  try {
    const userId = req.user!.id;

    const preferences = await prisma.userPreferences.findUnique({
      where: { userId },
    });

    if (!preferences) {
      // Create default preferences if they don't exist
      const defaultPreferences = await prisma.userPreferences.create({
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
            notifications: JSON.parse(defaultPreferences.notifications as string),
            privacy: JSON.parse(defaultPreferences.privacy as string),
            mapSettings: JSON.parse(defaultPreferences.mapSettings as string),
          },
        },
      });
    } else {
      res.status(200).json({
        success: true,
        data: {
          preferences: {
            ...preferences,
            notifications: JSON.parse(preferences.notifications as string),
            privacy: JSON.parse(preferences.privacy as string),
            mapSettings: JSON.parse(preferences.mapSettings as string),
          },
        },
      });
    }
  } catch (error) {
    logger.error('Error getting user preferences:', error);
    throw new AppError('Failed to get user preferences', 500);
  }
};

/**
 * Update user preferences
 */
export const updatePreferences = async (
  req: Request<{}, UserPreferencesResponse, UpdatePreferencesRequest>,
  res: Response<UserPreferencesResponse>
): Promise<void> => {
  try {
    const validatedData = updatePreferencesSchema.parse(req.body);
    const userId = req.user!.id;

    logger.info('Updating user preferences', {
      userId,
      fields: Object.keys(req.body),
    });

    // Get current preferences
    const currentPreferences = await prisma.userPreferences.findUnique({
      where: { userId },
    });

    if (!currentPreferences) {
      throw new AppError('User preferences not found', 404);
    }

    // Parse current JSON fields
    const currentNotifications = JSON.parse(currentPreferences.notifications as string);
    const currentPrivacy = JSON.parse(currentPreferences.privacy as string);
    const currentMapSettings = JSON.parse(currentPreferences.mapSettings as string);

    // Update preferences
    const updatedPreferences = await prisma.userPreferences.update({
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

    // Track analytics
    await analyticsService.trackEvent({
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
          notifications: JSON.parse(updatedPreferences.notifications as string),
          privacy: JSON.parse(updatedPreferences.privacy as string),
          mapSettings: JSON.parse(updatedPreferences.mapSettings as string),
        },
      },
    });
  } catch (error) {
    logger.error('Error updating user preferences:', error);
    throw new AppError('Failed to update preferences', 500);
  }
};

/**
 * Change user password
 */
export const changePassword = async (
  req: Request<{}, {}, ChangePasswordRequest>,
  res: Response
): Promise<void> => {
  try {
    const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);
    const userId = req.user!.id;

    logger.info('Changing user password', { userId });

    // Get user with password
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, password: true },
    });

    if (!user) {
      throw new AppError('User not found', 404);
    }

    // Verify current password
    const bcrypt = await import('bcrypt');
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);

    if (!isCurrentPasswordValid) {
      throw new AppError('Current password is incorrect', 400);
    }

    // Hash new password
    const hashedNewPassword = await bcrypt.hash(newPassword, 12);

    // Update password
    await prisma.user.update({
      where: { id: userId },
      data: {
        password: hashedNewPassword,
      },
    });

    // Invalidate all user sessions
    await prisma.session.deleteMany({
      where: { userId },
    });

    // Track analytics
    await analyticsService.trackEvent({
      userId,
      event: 'password_changed',
    });

    res.status(200).json({
      success: true,
      message: 'Password changed successfully. Please log in again.',
    });
  } catch (error) {
    logger.error('Error changing password:', error);
    throw new AppError('Failed to change password', 500);
  }
};

/**
 * Get user analytics
 */
export const getUserAnalytics = async (
  req: Request<{}, UserAnalyticsResponse, {}, { days?: string }>,
  res: Response<UserAnalyticsResponse>
): Promise<void> => {
  try {
    const { days = '30' } = req.query;
    const userId = req.user!.id;
    const daysNumber = parseInt(days, 10);

    if (isNaN(daysNumber) || daysNumber < 1 || daysNumber > 365) {
      throw new AppError('Days must be a number between 1 and 365', 400);
    }

    logger.info('Getting user analytics', { userId, days: daysNumber });

    const analytics = await analyticsService.getUserAnalytics(userId, daysNumber);

    res.status(200).json({
      success: true,
      data: {
        analytics,
      },
    });
  } catch (error) {
    logger.error('Error getting user analytics:', error);
    throw new AppError('Failed to get user analytics', 500);
  }
};

/**
 * Delete user account
 */
export const deleteAccount = async (
  req: Request<{}, {}, DeleteAccountRequest>,
  res: Response
): Promise<void> => {
  try {
    const { password, confirmationText, reason } = deleteAccountSchema.parse(req.body);
    const userId = req.user!.id;

    logger.info('Deleting user account', { userId, reason });

    // Get user with password
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, password: true, email: true },
    });

    if (!user) {
      throw new AppError('User not found', 404);
    }

    // Verify password
    const bcrypt = await import('bcrypt');
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      throw new AppError('Password is incorrect', 400);
    }

    // Delete user and related data (cascade delete should handle most)
    await prisma.$transaction(async (tx) => {
      // Delete user sessions
      await tx.session.deleteMany({ where: { userId } });
      
      // Delete user analytics events
      await tx.analyticsEvent.deleteMany({ where: { userId } });
      
      // Delete user preferences
      await tx.userPreferences.deleteMany({ where: { userId } });
      
      // Delete user routes
      await tx.route.deleteMany({ where: { userId } });
      
      // Delete user places
      await tx.place.deleteMany({ where: { userId } });
      
      // Delete user friendships
      await tx.friendship.deleteMany({
        where: {
          OR: [
            { requesterId: userId },
            { addresseeId: userId },
          ],
        },
      });
      
      // Finally delete the user
      await tx.user.delete({ where: { id: userId } });
    });

    // Track analytics (if possible)
    try {
      await analyticsService.trackEvent({
        userId,
        event: 'account_deleted',
        properties: {
          reason: reason || 'Not specified',
        },
      });
    } catch (analyticsError) {
      // Ignore analytics error during deletion
    }

    res.status(200).json({
      success: true,
      message: 'Account deleted successfully',
    });
  } catch (error) {
    logger.error('Error deleting account:', error);
    throw new AppError('Failed to delete account', 500);
  }
};