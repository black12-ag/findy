import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { User } from '@prisma/client';
import config from '@/config/config';
import { AppError, HttpStatus } from '@/types';

export interface JwtPayload {
  userId: string;
  email: string;
  role: string;
  iat?: number;
  exp?: number;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

/**
 * Generate JWT access and refresh tokens
 */
export const generateTokens = (user: User): TokenPair => {
  const payload: JwtPayload = {
    userId: user.id,
    email: user.email,
    role: user.role,
  };

  const accessToken = jwt.sign(payload, config.auth.jwtSecret, {
    expiresIn: config.auth.jwtExpiresIn,
    issuer: 'pathfinder-pro',
    audience: 'pathfinder-pro-client',
  });

  const refreshToken = jwt.sign(
    { userId: user.id, type: 'refresh' },
    config.auth.refreshTokenSecret,
    {
      expiresIn: config.auth.refreshTokenExpiresIn,
      issuer: 'pathfinder-pro',
      audience: 'pathfinder-pro-client',
    },
  );

  // Extract expiration time from token
  const decoded = jwt.decode(accessToken) as any;
  const expiresIn = decoded.exp - Math.floor(Date.now() / 1000);

  return {
    accessToken,
    refreshToken,
    expiresIn,
  };
};

/**
 * Verify JWT access token
 */
export const verifyAccessToken = (token: string): JwtPayload => {
  try {
    const payload = jwt.verify(token, config.auth.jwtSecret, {
      issuer: 'pathfinder-pro',
      audience: 'pathfinder-pro-client',
    }) as JwtPayload;

    return payload;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new AppError('Token expired', HttpStatus.UNAUTHORIZED);
    }
    if (error instanceof jwt.JsonWebTokenError) {
      throw new AppError('Invalid token', HttpStatus.UNAUTHORIZED);
    }
    throw new AppError('Token verification failed', HttpStatus.UNAUTHORIZED);
  }
};

/**
 * Verify JWT refresh token
 */
export const verifyRefreshToken = (token: string): { userId: string; type: string } => {
  try {
    const payload = jwt.verify(token, config.auth.refreshTokenSecret, {
      issuer: 'pathfinder-pro',
      audience: 'pathfinder-pro-client',
    }) as { userId: string; type: string };

    if (payload.type !== 'refresh') {
      throw new AppError('Invalid refresh token', HttpStatus.UNAUTHORIZED);
    }

    return payload;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new AppError('Refresh token expired', HttpStatus.UNAUTHORIZED);
    }
    if (error instanceof jwt.JsonWebTokenError) {
      throw new AppError('Invalid refresh token', HttpStatus.UNAUTHORIZED);
    }
    throw new AppError('Refresh token verification failed', HttpStatus.UNAUTHORIZED);
  }
};

/**
 * Hash password using bcrypt
 */
export const hashPassword = async (password: string): Promise<string> => {
  return bcrypt.hash(password, config.auth.bcryptRounds);
};

/**
 * Compare password with hash
 */
export const comparePassword = async (password: string, hash: string): Promise<boolean> => {
  return bcrypt.compare(password, hash);
};

/**
 * Generate secure random token
 */
export const generateSecureToken = (length: number = 32): string => {
  return crypto.randomBytes(length).toString('hex');
};

/**
 * Generate email verification token
 */
export const generateEmailVerificationToken = (): string => {
  return generateSecureToken(32);
};

/**
 * Generate password reset token
 */
export const generatePasswordResetToken = (): {
  token: string;
  expires: Date;
} => {
  const token = generateSecureToken(32);
  const expires = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes

  return { token, expires };
};

/**
 * Extract token from Authorization header
 */
export const extractTokenFromHeader = (authHeader?: string): string | null => {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.substring(7);
};

/**
 * Generate API key
 */
export const generateApiKey = (): string => {
  const prefix = 'pk_';
  const randomPart = crypto.randomBytes(24).toString('hex');
  return `${prefix}${randomPart}`;
};

/**
 * Validate password strength
 */
export const validatePasswordStrength = (password: string): {
  isValid: boolean;
  errors: string[];
} => {
  const errors: string[] = [];

  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }

  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }

  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }

  if (!/\d/.test(password)) {
    errors.push('Password must contain at least one number');
  }

  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

/**
 * Create session fingerprint for additional security
 */
export const createSessionFingerprint = (userAgent?: string, ipAddress?: string): string => {
  const data = `${userAgent || 'unknown'}-${ipAddress || 'unknown'}`;
  return crypto.createHash('sha256').update(data).digest('hex');
};

/**
 * Check if user is authorized for specific role
 */
export const hasRole = (userRole: string, requiredRole: string): boolean => {
  const roleHierarchy = {
    USER: 1,
    MODERATOR: 2,
    ADMIN: 3,
  };

  const userLevel = roleHierarchy[userRole as keyof typeof roleHierarchy] || 0;
  const requiredLevel = roleHierarchy[requiredRole as keyof typeof roleHierarchy] || 0;

  return userLevel >= requiredLevel;
};

/**
 * Sanitize user data for client response
 */
export const sanitizeUser = (user: User) => {
  const {
    password,
    refreshToken,
    emailVerifyToken,
    passwordResetToken,
    passwordResetExpires,
    ...sanitizedUser
  } = user;

  return sanitizedUser;
};