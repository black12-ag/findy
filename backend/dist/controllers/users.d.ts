import { AuthenticatedRequest } from '@/types';
import { Response } from 'express';
import type { UserProfileResponse, UserPreferencesResponse, UserAnalyticsResponse } from '@/types/api';
export declare const getUserProfile: (req: AuthenticatedRequest, res: Response<UserProfileResponse>) => Promise<void>;
export declare const updateProfile: (req: AuthenticatedRequest, res: Response<UserProfileResponse>) => Promise<void>;
export declare const getUserPreferences: (req: AuthenticatedRequest, res: Response<UserPreferencesResponse>) => Promise<void>;
export declare const updatePreferences: (req: AuthenticatedRequest, res: Response<UserPreferencesResponse>) => Promise<void>;
export declare const changePassword: (req: AuthenticatedRequest, res: Response) => Promise<void>;
export declare const getUserAnalytics: (req: AuthenticatedRequest, res: Response<UserAnalyticsResponse>) => Promise<void>;
export declare const deleteAccount: (req: AuthenticatedRequest, res: Response) => Promise<void>;
//# sourceMappingURL=users.d.ts.map