import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import { AppError, HttpStatus, ApiResponse } from '@/types';
import config from '@/config/config';
import logger from '@/config/logger';

/**
 * Global error handling middleware
 */
export const errorHandler = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
  let message = 'Internal server error';
  let details: any = null;

  // Log error with context
  logger.error('Error occurred', {
    error: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
  });

  // Handle custom AppError
  if (error instanceof AppError) {
    statusCode = error.statusCode;
    message = error.message;
  }
  
  // Handle Prisma errors
  else if (error instanceof Prisma.PrismaClientKnownRequestError) {
    const prismaError = handlePrismaError(error);
    statusCode = prismaError.statusCode;
    message = prismaError.message;
    details = prismaError.details;
  }
  
  // Handle Zod validation errors
  else if (error instanceof ZodError) {
    statusCode = HttpStatus.BAD_REQUEST;
    message = 'Validation failed';
    details = error.errors.map(err => ({
      field: err.path.join('.'),
      message: err.message,
      code: err.code,
    }));
  }
  
  // Handle JWT errors
  else if (error.name === 'JsonWebTokenError') {
    statusCode = HttpStatus.UNAUTHORIZED;
    message = 'Invalid token';
  }
  
  else if (error.name === 'TokenExpiredError') {
    statusCode = HttpStatus.UNAUTHORIZED;
    message = 'Token expired';
  }
  
  // Handle Multer errors (file upload)
  else if (error.name === 'MulterError') {
    statusCode = HttpStatus.BAD_REQUEST;
    switch ((error as any).code) {
      case 'LIMIT_FILE_SIZE':
        message = 'File too large';
        break;
      case 'LIMIT_FILE_COUNT':
        message = 'Too many files';
        break;
      case 'LIMIT_UNEXPECTED_FILE':
        message = 'Unexpected file field';
        break;
      default:
        message = 'File upload error';
    }
  }
  
  // Handle MongoDB errors (if using MongoDB)
  else if (error.name === 'ValidationError') {
    statusCode = HttpStatus.BAD_REQUEST;
    message = 'Validation error';
    details = Object.values((error as any).errors).map((err: any) => ({
      field: err.path,
      message: err.message,
    }));
  }
  
  // Handle syntax errors
  else if (error instanceof SyntaxError && 'body' in error) {
    statusCode = HttpStatus.BAD_REQUEST;
    message = 'Invalid JSON in request body';
  }
  
  // Handle other common errors
  else if (error.name === 'CastError') {
    statusCode = HttpStatus.BAD_REQUEST;
    message = 'Invalid ID format';
  }

  // Prepare error response
  const errorResponse: ApiResponse = {
    success: false,
    message,
    error: config.server.isDevelopment ? error.stack : undefined,
  };

  if (details) {
    errorResponse.data = details;
  }

  // Send error response
  res.status(statusCode).json(errorResponse);
};

/**
 * Handle Prisma-specific errors
 */
function handlePrismaError(error: Prisma.PrismaClientKnownRequestError): {
  statusCode: number;
  message: string;
  details?: any;
} {
  switch (error.code) {
    case 'P2002':
      // Unique constraint failed
      const field = error.meta?.target as string[];
      return {
        statusCode: HttpStatus.CONFLICT,
        message: `${field?.join(', ') || 'Field'} already exists`,
        details: { field: field?.[0] },
      };

    case 'P2025':
      // Record not found
      return {
        statusCode: HttpStatus.NOT_FOUND,
        message: 'Record not found',
      };

    case 'P2003':
      // Foreign key constraint failed
      return {
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'Invalid reference to related record',
      };

    case 'P2014':
      // Required relation is missing
      return {
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'Required relation is missing',
      };

    case 'P2021':
      // Table does not exist
      return {
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Database table not found',
      };

    case 'P2022':
      // Column does not exist
      return {
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Database column not found',
      };

    default:
      return {
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Database error occurred',
        details: config.server.isDevelopment ? { code: error.code } : undefined,
      };
  }
}

/**
 * Handle 404 errors for undefined routes
 */
export const notFoundHandler = (req: Request, res: Response, next: NextFunction): void => {
  const error = new AppError(`Route ${req.originalUrl} not found`, HttpStatus.NOT_FOUND);
  next(error);
};

// Alias for backward compatibility
export const notFound = notFoundHandler;

/**
 * Async error wrapper for route handlers
 */
export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Validation error handler
 */
export const validationError = (message: string, field?: string): AppError => {
  const error = new AppError(message, HttpStatus.BAD_REQUEST);
  if (field) {
    (error as any).field = field;
  }
  return error;
};

/**
 * Database connection error handler
 */
export const handleDatabaseConnection = (error: Error): void => {
  logger.error('Database connection error', { error: error.message });
  
  if (error.message.includes('ECONNREFUSED')) {
    logger.error('Database connection refused. Please check if the database is running.');
  } else if (error.message.includes('ENOTFOUND')) {
    logger.error('Database host not found. Please check the connection URL.');
  } else if (error.message.includes('authentication failed')) {
    logger.error('Database authentication failed. Please check credentials.');
  }
};

/**
 * Graceful shutdown handler
 */
export const gracefulShutdown = (signal: string) => {
  return () => {
    logger.info(`Received ${signal}. Starting graceful shutdown...`);
    
    // Close database connections
    // Close server
    // Clean up resources
    
    process.exit(0);
  };
};