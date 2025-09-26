import { Request, Response } from 'express';
import type { UpdateProfileRequest, UpdatePreferencesRequest, ChangePasswordRequest, DeleteAccountRequest, UserProfileResponse, UserPreferencesResponse, UserAnalyticsResponse } from '@/types/api';
export declare const getUserProfile: (req: Request, res: Response<UserProfileResponse>) => Promise<void>;
export declare const updateProfile: (req: Request<{}, UserProfileResponse, UpdateProfileRequest>, res: Response<UserProfileResponse>) => Promise<void>;
export declare const getUserPreferences: (req: Request, res: Response<UserPreferencesResponse>) => Promise<void>;
export declare const updatePreferences: (req: Request<{}, UserPreferencesResponse, UpdatePreferencesRequest>, res: Response<UserPreferencesResponse>) => Promise<void>;
export declare const changePassword: (req: Request<{}, {}, ChangePasswordRequest>, res: Response) => Promise<void>;
export declare const getUserAnalytics: (req: Request<{}, UserAnalyticsResponse, {}, {
    days?: string;
}>, res: Response<UserAnalyticsResponse>) => Promise<void>;
export declare const deleteAccount: (req: Request<{}, {}, DeleteAccountRequest>, res: Response) => Promise<void>;
//# sourceMappingURL=users.d.ts.map