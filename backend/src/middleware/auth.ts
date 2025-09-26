import { Response, NextFunction } from 'express';
import { getPrismaClient } from '@/config/database';
import { verifyAccessToken, extractTokenFromHeader, hasRole } from '@/utils/auth';
import { AuthenticatedRequest, AppError, HttpStatus } from '@/types';
import logger from '@/config/logger';

/**
 * Authentication middleware to verify JWT tokens
 */
export const authenticate = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const token = extractTokenFromHeader(req.headers.authorization);
    
    if (!token) {
      throw new AppError('Access token is required', HttpStatus.UNAUTHORIZED);
    }

    // Verify the JWT token
    const payload = verifyAccessToken(token);
    
    // Get user from database
    const prisma = getPrismaClient();
    const user = await prisma.user.findUnique({
      where: { 
        id: payload.userId,
        isActive: true,
      },
      include: {
        preferences: true,
      },
    });

    if (!user) {
      throw new AppError('User not found or inactive', HttpStatus.UNAUTHORIZED);
    }

    // Check if user is verified (optional based on requirements)
    if (!user.isVerified) {
      throw new AppError('Email verification required', HttpStatus.FORBIDDEN);
    }

    // Attach user to request
    req.user = user;
    
    logger.debug('User authenticated successfully', { 
      userId: user.id, 
      email: user.email 
    });
    
    next();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error('Authentication failed', { error: message });
    next(error);
  }
};

/**
 * Optional authentication middleware - doesn't fail if no token provided
 */
export const optionalAuthenticate = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const token = extractTokenFromHeader(req.headers.authorization);
    
    if (!token) {
      return next();
    }

    const payload = verifyAccessToken(token);
    const prisma = getPrismaClient();
    const user = await prisma.user.findUnique({
      where: { 
        id: payload.userId,
        isActive: true,
      },
      include: {
        preferences: true,
      },
    });

    if (user && user.isVerified) {
      req.user = user;
    }
    
    next();
  } catch (error) {
    // Don't fail - just continue without user
    const message = error instanceof Error ? error.message : String(error);
    logger.debug('Optional authentication failed', { error: message });
    next();
  }
};

/**
 * Authorization middleware to check user roles
 */
export const authorize = (requiredRole: string = 'USER') => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    try {
      if (!req.user) {
        throw new AppError('Authentication required', HttpStatus.UNAUTHORIZED);
      }

      if (!hasRole(req.user.role, requiredRole)) {
        throw new AppError(
          `Insufficient permissions. ${requiredRole} role required`,
          HttpStatus.FORBIDDEN,
        );
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Middleware to check if user owns the resource
 */
export const checkResourceOwnership = (userIdField: string = 'userId') => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    try {
      if (!req.user) {
        throw new AppError('Authentication required', HttpStatus.UNAUTHORIZED);
      }

      const resourceUserId = req.params[userIdField] || req.body[userIdField];
      
      if (!resourceUserId) {
        throw new AppError(`${userIdField} not found in request`, HttpStatus.BAD_REQUEST);
      }

      // Admin users can access any resource
      if (req.user.role === 'ADMIN') {
        return next();
      }

      if (req.user.id !== resourceUserId) {
        throw new AppError('Access denied. You can only access your own resources', HttpStatus.FORBIDDEN);
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Middleware to validate API key (for external integrations)
 */
export const validateApiKey = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const apiKey = req.headers['x-api-key'] as string;
    
    if (!apiKey) {
      throw new AppError('API key is required', HttpStatus.UNAUTHORIZED);
    }

    // In a real implementation, you'd validate against stored API keys
    // For now, we'll just check the format
    if (!apiKey.startsWith('pk_') || apiKey.length < 32) {
      throw new AppError('Invalid API key format', HttpStatus.UNAUTHORIZED);
    }

    // TODO: Implement actual API key validation against database
    logger.debug('API key validated', { apiKey: apiKey.substring(0, 10) + '...' });
    
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Rate limiting middleware based on user
 */
export const userRateLimit = (maxRequests: number = 100, windowMs: number = 15 * 60 * 1000) => {
  const requests = new Map<string, { count: number; resetTime: number }>();

  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    try {
      const userId = (req.user?.id ?? req.ip) as string;
      const now = Date.now();
      
      const userRequests = requests.get(String(userId));
      
      if (!userRequests || now > userRequests.resetTime) {
        requests.set(String(userId), {
          count: 1,
          resetTime: now + windowMs,
        });
        return next();
      }

      if (userRequests.count >= maxRequests) {
        const resetTimeSeconds = Math.ceil((userRequests.resetTime - now) / 1000);
        
        res.set({
          'X-RateLimit-Limit': maxRequests.toString(),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': userRequests.resetTime.toString(),
        });

        throw new AppError(
          `Rate limit exceeded. Try again in ${resetTimeSeconds} seconds`,
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      userRequests.count += 1;
      
      res.set({
        'X-RateLimit-Limit': maxRequests.toString(),
        'X-RateLimit-Remaining': (maxRequests - userRequests.count).toString(),
        'X-RateLimit-Reset': userRequests.resetTime.toString(),
      });

      next();
    } catch (error) {
      next(error);
    }
  };
};