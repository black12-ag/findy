import { Request, Response, NextFunction } from 'express';
import logger from './logger';

// Simplified Sentry configuration to resolve build issues
// This will be updated with proper Sentry v7+ integration later

export const initSentry = (): void => {
  logger.info('Sentry integration temporarily disabled');
};

export const sentryRequestHandler = () => {
  return (req: Request, res: Response, next: NextFunction): void => {
    next();
  };
};

export const sentryErrorHandler = () => {
  return (error: any, req: Request, res: Response, next: NextFunction): void => {
    logger.error('Error handled by simplified Sentry middleware', {
      error: error.message,
      path: req.path,
      method: req.method,
    });
    next(error);
  };
};

export const sentryTracingHandler = () => {
  return (req: Request, res: Response, next: NextFunction): void => {
    next();
  };
};

export const captureException = (error: Error): void => {
  logger.error('Exception captured by simplified Sentry', {
    error: error.message,
    stack: error.stack,
  });
};

export const captureMessage = (message: string, level: string = 'info'): void => {
  logger.info('Message captured by simplified Sentry', {
    message,
    level,
  });
};

export const addBreadcrumb = (breadcrumb: any): void => {
  logger.debug('Breadcrumb added', breadcrumb);
};

export const setUser = (user: any): void => {
  logger.debug('User context set', { userId: user?.id });
};

export const setTag = (key: string, value: string): void => {
  logger.debug('Tag set', { key, value });
};

export const setContext = (name: string, context: any): void => {
  logger.debug('Context set', { name, context });
};

export const withScope = (callback: (scope: any) => void): void => {
  callback({});
};

export const startTransaction = (transactionContext: any): any => {
  logger.debug('Transaction started', transactionContext);
  return {
    setName: (name: string) => logger.debug('Transaction name set', { name }),
    setTag: (key: string, value: string) => logger.debug('Transaction tag set', { key, value }),
    finish: () => logger.debug('Transaction finished'),
  };
};

export const getCurrentHub = (): any => {
  return {
    configureScope: (callback: (scope: any) => void) => callback({}),
  };
};

export { initSentry as init };
