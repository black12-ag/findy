import { User } from '@prisma/client';
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
export declare const generateTokens: (user: User) => TokenPair;
export declare const verifyAccessToken: (token: string) => JwtPayload;
export declare const verifyRefreshToken: (token: string) => {
    userId: string;
    type: string;
};
export declare const hashPassword: (password: string) => Promise<string>;
export declare const comparePassword: (password: string, hash: string) => Promise<boolean>;
export declare const generateSecureToken: (length?: number) => string;
export declare const generateEmailVerificationToken: () => string;
export declare const generatePasswordResetToken: () => {
    token: string;
    expires: Date;
};
export declare const extractTokenFromHeader: (authHeader?: string) => string | null;
export declare const generateApiKey: () => string;
export declare const validatePasswordStrength: (password: string) => {
    isValid: boolean;
    errors: string[];
};
export declare const createSessionFingerprint: (userAgent?: string, ipAddress?: string) => string;
export declare const hasRole: (userRole: string, requiredRole: string) => boolean;
export declare const sanitizeUser: (user: User) => {
    id: string;
    email: string;
    username: string | null;
    firstName: string | null;
    lastName: string | null;
    avatar: string | null;
    phoneNumber: string | null;
    isVerified: boolean;
    isActive: boolean;
    role: string;
    createdAt: Date;
    updatedAt: Date;
};
//# sourceMappingURL=auth.d.ts.map