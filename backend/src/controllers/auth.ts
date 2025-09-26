import { Response } from 'express';
import { z } from 'zod';
import { getPrismaClient } from '@/config/database';
import { 
  generateTokens, 
  hashPassword, 
  comparePassword, 
  verifyRefreshToken, 
  generateEmailVerificationToken,
  generatePasswordResetToken,
  validatePasswordStrength,
  sanitizeUser
} from '@/utils/auth';
import { AuthenticatedRequest, AppError, HttpStatus, ApiResponse } from '@/types';
import logger from '@/config/logger';

// Validation schemas
const registerSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  firstName: z.string().min(1, 'First name is required').optional(),
  lastName: z.string().min(1, 'Last name is required').optional(),
  username: z.string().min(3, 'Username must be at least 3 characters').optional(),
});

const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
});

const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email format'),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

/**
 * Register a new user
 */
export const register = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    const validatedData = registerSchema.parse(req.body);
    
    // Validate password strength
    const passwordValidation = validatePasswordStrength(validatedData.password);
    if (!passwordValidation.isValid) {
      throw new AppError(
        `Password validation failed: ${passwordValidation.errors.join(', ')}`,
        HttpStatus.BAD_REQUEST,
      );
    }

    const prisma = getPrismaClient();
    
    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: validatedData.email },
    });

    if (existingUser) {
      throw new AppError('User with this email already exists', HttpStatus.CONFLICT);
    }

    // Check username uniqueness if provided
    if (validatedData.username) {
      const existingUsername = await prisma.user.findUnique({
        where: { username: validatedData.username },
      });

      if (existingUsername) {
        throw new AppError('Username is already taken', HttpStatus.CONFLICT);
      }
    }

    // Hash password
    const hashedPassword = await hashPassword(validatedData.password);
    
    // Generate email verification token
    const emailVerifyToken = generateEmailVerificationToken();

    // Create user with default preferences
    const user = await prisma.user.create({
      data: {
        email: validatedData.email,
        password: hashedPassword,
        firstName: validatedData.firstName,
        lastName: validatedData.lastName,
        username: validatedData.username,
        emailVerifyToken,
        preferences: {
          create: {
            // Default preferences are set in schema
          },
        },
      },
      include: {
        preferences: true,
      },
    });

    // Generate tokens
    const tokens = generateTokens(user);

    // Update refresh token in database
    await prisma.user.update({
      where: { id: user.id },
      data: { refreshToken: tokens.refreshToken },
    });

    // Log registration
    logger.info('User registered successfully', { 
      userId: user.id, 
      email: user.email 
    });

    // TODO: Send email verification email
    logger.info('Email verification token generated', { 
      userId: user.id, 
      token: emailVerifyToken 
    });

    const response: ApiResponse = {
      success: true,
      message: 'User registered successfully',
      data: {
        user: sanitizeUser(user),
        tokens,
      },
    };

    res.status(HttpStatus.CREATED).json(response);
  } catch (error) {
    logger.error('Registration failed', { error: error.message });
    throw error;
  }
};

/**
 * Login user
 */
export const login = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    const validatedData = loginSchema.parse(req.body);
    const prisma = getPrismaClient();

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email: validatedData.email },
      include: {
        preferences: true,
      },
    });

    if (!user) {
      throw new AppError('Invalid email or password', HttpStatus.UNAUTHORIZED);
    }

    // Check if user is active
    if (!user.isActive) {
      throw new AppError('Account is deactivated', HttpStatus.FORBIDDEN);
    }

    // Verify password
    const isValidPassword = await comparePassword(validatedData.password, user.password);
    if (!isValidPassword) {
      throw new AppError('Invalid email or password', HttpStatus.UNAUTHORIZED);
    }

    // Generate tokens
    const tokens = generateTokens(user);

    // Update refresh token and last login
    await prisma.user.update({
      where: { id: user.id },
      data: { 
        refreshToken: tokens.refreshToken,
      },
    });

    // Create user session record
    await prisma.userSession.create({
      data: {
        userId: user.id,
        token: tokens.accessToken,
        deviceType: req.get('User-Agent'),
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
    });

    logger.info('User logged in successfully', { 
      userId: user.id, 
      email: user.email 
    });

    const response: ApiResponse = {
      success: true,
      message: 'Login successful',
      data: {
        user: sanitizeUser(user),
        tokens,
      },
    };

    res.status(HttpStatus.OK).json(response);
  } catch (error) {
    logger.error('Login failed', { error: error.message });
    throw error;
  }
};

/**
 * Refresh access token
 */
export const refreshToken = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    const validatedData = refreshTokenSchema.parse(req.body);
    
    // Verify refresh token
    const payload = verifyRefreshToken(validatedData.refreshToken);
    
    const prisma = getPrismaClient();
    
    // Find user and verify refresh token
    const user = await prisma.user.findUnique({
      where: { 
        id: payload.userId,
        refreshToken: validatedData.refreshToken,
        isActive: true,
      },
      include: {
        preferences: true,
      },
    });

    if (!user) {
      throw new AppError('Invalid refresh token', HttpStatus.UNAUTHORIZED);
    }

    // Generate new tokens
    const tokens = generateTokens(user);

    // Update refresh token in database
    await prisma.user.update({
      where: { id: user.id },
      data: { refreshToken: tokens.refreshToken },
    });

    logger.info('Token refreshed successfully', { userId: user.id });

    const response: ApiResponse = {
      success: true,
      message: 'Token refreshed successfully',
      data: { tokens },
    };

    res.status(HttpStatus.OK).json(response);
  } catch (error) {
    logger.error('Token refresh failed', { error: error.message });
    throw error;
  }
};

/**
 * Logout user
 */
export const logout = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      throw new AppError('User not authenticated', HttpStatus.UNAUTHORIZED);
    }

    const prisma = getPrismaClient();

    // Clear refresh token
    await prisma.user.update({
      where: { id: userId },
      data: { refreshToken: null },
    });

    // Deactivate user sessions
    await prisma.userSession.updateMany({
      where: { 
        userId,
        isActive: true,
      },
      data: { isActive: false },
    });

    logger.info('User logged out successfully', { userId });

    const response: ApiResponse = {
      success: true,
      message: 'Logout successful',
    };

    res.status(HttpStatus.OK).json(response);
  } catch (error) {
    logger.error('Logout failed', { error: error.message });
    throw error;
  }
};

/**
 * Get current user profile
 */
export const getMe = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    const user = req.user;
    
    if (!user) {
      throw new AppError('User not authenticated', HttpStatus.UNAUTHORIZED);
    }

    const response: ApiResponse = {
      success: true,
      data: { user: sanitizeUser(user) },
    };

    res.status(HttpStatus.OK).json(response);
  } catch (error) {
    logger.error('Get user profile failed', { error: error.message });
    throw error;
  }
};

/**
 * Send password reset email
 */
export const forgotPassword = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    const validatedData = forgotPasswordSchema.parse(req.body);
    const prisma = getPrismaClient();

    const user = await prisma.user.findUnique({
      where: { email: validatedData.email },
    });

    // Always return success for security reasons
    if (!user) {
      const response: ApiResponse = {
        success: true,
        message: 'If the email exists, a password reset link has been sent',
      };
      return res.status(HttpStatus.OK).json(response);
    }

    // Generate password reset token
    const { token, expires } = generatePasswordResetToken();

    // Update user with reset token
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetToken: token,
        passwordResetExpires: expires,
      },
    });

    // TODO: Send password reset email
    logger.info('Password reset token generated', { 
      userId: user.id, 
      email: user.email,
      token 
    });

    const response: ApiResponse = {
      success: true,
      message: 'If the email exists, a password reset link has been sent',
    };

    res.status(HttpStatus.OK).json(response);
  } catch (error) {
    logger.error('Forgot password failed', { error: error.message });
    throw error;
  }
};

/**
 * Reset password with token
 */
export const resetPassword = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    const validatedData = resetPasswordSchema.parse(req.body);
    
    // Validate password strength
    const passwordValidation = validatePasswordStrength(validatedData.password);
    if (!passwordValidation.isValid) {
      throw new AppError(
        `Password validation failed: ${passwordValidation.errors.join(', ')}`,
        HttpStatus.BAD_REQUEST,
      );
    }

    const prisma = getPrismaClient();

    // Find user with valid reset token
    const user = await prisma.user.findFirst({
      where: {
        passwordResetToken: validatedData.token,
        passwordResetExpires: {
          gt: new Date(),
        },
        isActive: true,
      },
    });

    if (!user) {
      throw new AppError('Invalid or expired reset token', HttpStatus.BAD_REQUEST);
    }

    // Hash new password
    const hashedPassword = await hashPassword(validatedData.password);

    // Update user password and clear reset token
    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        passwordResetToken: null,
        passwordResetExpires: null,
        refreshToken: null, // Invalidate existing sessions
      },
    });

    // Deactivate all user sessions
    await prisma.userSession.updateMany({
      where: { userId: user.id },
      data: { isActive: false },
    });

    logger.info('Password reset successfully', { userId: user.id });

    const response: ApiResponse = {
      success: true,
      message: 'Password reset successful',
    };

    res.status(HttpStatus.OK).json(response);
  } catch (error) {
    logger.error('Password reset failed', { error: error.message });
    throw error;
  }
};