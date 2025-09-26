import { Request, Response, NextFunction } from 'express';
import { AppError } from '@/types';
export declare const errorHandler: (error: Error, req: Request, res: Response, next: NextFunction) => void;
export declare const notFoundHandler: (req: Request, res: Response, next: NextFunction) => void;
export declare const notFound: (req: Request, res: Response, next: NextFunction) => void;
export declare const asyncHandler: (fn: Function) => (req: Request, res: Response, next: NextFunction) => void;
export declare const validationError: (message: string, field?: string) => AppError;
export declare const handleDatabaseConnection: (error: Error) => void;
export declare const gracefulShutdown: (signal: string) => () => never;
//# sourceMappingURL=error.d.ts.map