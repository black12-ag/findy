import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '@/types';
export declare const authenticate: (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const optionalAuthenticate: (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const authorize: (requiredRole?: string) => (req: AuthenticatedRequest, res: Response, next: NextFunction) => void;
export declare const checkResourceOwnership: (userIdField?: string) => (req: AuthenticatedRequest, res: Response, next: NextFunction) => void;
export declare const validateApiKey: (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const userRateLimit: (maxRequests?: number, windowMs?: number) => (req: AuthenticatedRequest, res: Response, next: NextFunction) => void;
//# sourceMappingURL=auth.d.ts.map