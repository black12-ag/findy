import { Response } from 'express';
import { AuthenticatedRequest } from '@/types';
export declare const register: (req: AuthenticatedRequest, res: Response) => Promise<void>;
export declare const login: (req: AuthenticatedRequest, res: Response) => Promise<void>;
export declare const refreshToken: (req: AuthenticatedRequest, res: Response) => Promise<void>;
export declare const logout: (req: AuthenticatedRequest, res: Response) => Promise<void>;
export declare const getMe: (req: AuthenticatedRequest, res: Response) => Promise<void>;
export declare const forgotPassword: (req: AuthenticatedRequest, res: Response) => Promise<void>;
export declare const resetPassword: (req: AuthenticatedRequest, res: Response) => Promise<void>;
//# sourceMappingURL=auth.d.ts.map