"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.resetPassword = exports.forgotPassword = exports.getMe = exports.logout = exports.refreshToken = exports.login = exports.register = void 0;
const zod_1 = require("zod");
const database_1 = require("@/config/database");
const auth_1 = require("@/utils/auth");
const types_1 = require("@/types");
const logger_1 = __importDefault(require("@/config/logger"));
const registerSchema = zod_1.z.object({
    email: zod_1.z.string().email('Invalid email format'),
    password: zod_1.z.string().min(8, 'Password must be at least 8 characters'),
    firstName: zod_1.z.string().min(1, 'First name is required').optional(),
    lastName: zod_1.z.string().min(1, 'Last name is required').optional(),
    username: zod_1.z.string().min(3, 'Username must be at least 3 characters').optional(),
});
const loginSchema = zod_1.z.object({
    email: zod_1.z.string().email('Invalid email format'),
    password: zod_1.z.string().min(1, 'Password is required'),
});
const refreshTokenSchema = zod_1.z.object({
    refreshToken: zod_1.z.string().min(1, 'Refresh token is required'),
});
const forgotPasswordSchema = zod_1.z.object({
    email: zod_1.z.string().email('Invalid email format'),
});
const resetPasswordSchema = zod_1.z.object({
    token: zod_1.z.string().min(1, 'Reset token is required'),
    password: zod_1.z.string().min(8, 'Password must be at least 8 characters'),
});
const register = async (req, res) => {
    try {
        const validatedData = registerSchema.parse(req.body);
        const passwordValidation = (0, auth_1.validatePasswordStrength)(validatedData.password);
        if (!passwordValidation.isValid) {
            throw new types_1.AppError(`Password validation failed: ${passwordValidation.errors.join(', ')}`, types_1.HttpStatus.BAD_REQUEST);
        }
        const prisma = (0, database_1.getPrismaClient)();
        const existingUser = await prisma.user.findUnique({
            where: { email: validatedData.email },
        });
        if (existingUser) {
            throw new types_1.AppError('User with this email already exists', types_1.HttpStatus.CONFLICT);
        }
        if (validatedData.username) {
            const existingUsername = await prisma.user.findUnique({
                where: { username: validatedData.username },
            });
            if (existingUsername) {
                throw new types_1.AppError('Username is already taken', types_1.HttpStatus.CONFLICT);
            }
        }
        const hashedPassword = await (0, auth_1.hashPassword)(validatedData.password);
        const emailVerifyToken = (0, auth_1.generateEmailVerificationToken)();
        const user = await prisma.user.create({
            data: {
                email: validatedData.email,
                password: hashedPassword,
                firstName: validatedData.firstName || null,
                lastName: validatedData.lastName || null,
                username: validatedData.username || null,
                emailVerifyToken,
                preferences: {
                    create: {},
                },
            },
            include: {
                preferences: true,
            },
        });
        const tokens = (0, auth_1.generateTokens)(user);
        await prisma.user.update({
            where: { id: user.id },
            data: { refreshToken: tokens.refreshToken },
        });
        logger_1.default.info('User registered successfully', {
            userId: user.id,
            email: user.email
        });
        logger_1.default.info('Email verification token generated', {
            userId: user.id,
            token: emailVerifyToken
        });
        const response = {
            success: true,
            message: 'User registered successfully',
            data: {
                user: (0, auth_1.sanitizeUser)(user),
                tokens,
            },
        };
        res.status(types_1.HttpStatus.CREATED).json(response);
    }
    catch (error) {
        logger_1.default.error('Registration failed', { error: error instanceof Error ? error.message : String(error) });
        throw error;
    }
};
exports.register = register;
const login = async (req, res) => {
    try {
        const validatedData = loginSchema.parse(req.body);
        const prisma = (0, database_1.getPrismaClient)();
        const user = await prisma.user.findUnique({
            where: { email: validatedData.email },
            include: {
                preferences: true,
            },
        });
        if (!user) {
            throw new types_1.AppError('Invalid email or password', types_1.HttpStatus.UNAUTHORIZED);
        }
        if (!user.isActive) {
            throw new types_1.AppError('Account is deactivated', types_1.HttpStatus.FORBIDDEN);
        }
        const isValidPassword = await (0, auth_1.comparePassword)(validatedData.password, user.password);
        if (!isValidPassword) {
            throw new types_1.AppError('Invalid email or password', types_1.HttpStatus.UNAUTHORIZED);
        }
        const tokens = (0, auth_1.generateTokens)(user);
        await prisma.user.update({
            where: { id: user.id },
            data: {
                refreshToken: tokens.refreshToken,
            },
        });
        await prisma.userSession.create({
            data: {
                userId: user.id,
                token: tokens.accessToken,
                deviceType: req.get('User-Agent') || null,
                ipAddress: req.ip || null,
                userAgent: req.get('User-Agent') || null,
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            },
        });
        logger_1.default.info('User logged in successfully', {
            userId: user.id,
            email: user.email
        });
        const response = {
            success: true,
            message: 'Login successful',
            data: {
                user: (0, auth_1.sanitizeUser)(user),
                tokens,
            },
        };
        res.status(types_1.HttpStatus.OK).json(response);
    }
    catch (error) {
        logger_1.default.error('Login failed', { error: error instanceof Error ? error.message : String(error) });
        throw error;
    }
};
exports.login = login;
const refreshToken = async (req, res) => {
    try {
        const validatedData = refreshTokenSchema.parse(req.body);
        const payload = (0, auth_1.verifyRefreshToken)(validatedData.refreshToken);
        const prisma = (0, database_1.getPrismaClient)();
        const user = await prisma.user.findUnique({
            where: {
                id: payload.userId,
                refreshToken: validatedData.refreshToken,
                isActive: true,
            },
            include: {
                preferences: true,
            },
        });
        if (!user) {
            throw new types_1.AppError('Invalid refresh token', types_1.HttpStatus.UNAUTHORIZED);
        }
        const tokens = (0, auth_1.generateTokens)(user);
        await prisma.user.update({
            where: { id: user.id },
            data: { refreshToken: tokens.refreshToken },
        });
        logger_1.default.info('Token refreshed successfully', { userId: user.id });
        const response = {
            success: true,
            message: 'Token refreshed successfully',
            data: { tokens },
        };
        res.status(types_1.HttpStatus.OK).json(response);
    }
    catch (error) {
        logger_1.default.error('Token refresh failed', { error: error instanceof Error ? error.message : String(error) });
        throw error;
    }
};
exports.refreshToken = refreshToken;
const logout = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            throw new types_1.AppError('User not authenticated', types_1.HttpStatus.UNAUTHORIZED);
        }
        const prisma = (0, database_1.getPrismaClient)();
        await prisma.user.update({
            where: { id: userId },
            data: { refreshToken: null },
        });
        await prisma.userSession.updateMany({
            where: {
                userId,
                isActive: true,
            },
            data: { isActive: false },
        });
        logger_1.default.info('User logged out successfully', { userId });
        const response = {
            success: true,
            message: 'Logout successful',
        };
        res.status(types_1.HttpStatus.OK).json(response);
    }
    catch (error) {
        logger_1.default.error('Logout failed', { error: error instanceof Error ? error.message : String(error) });
        throw error;
    }
};
exports.logout = logout;
const getMe = async (req, res) => {
    try {
        const user = req.user;
        if (!user) {
            throw new types_1.AppError('User not authenticated', types_1.HttpStatus.UNAUTHORIZED);
        }
        const response = {
            success: true,
            data: { user: (0, auth_1.sanitizeUser)(user) },
        };
        res.status(types_1.HttpStatus.OK).json(response);
    }
    catch (error) {
        logger_1.default.error('Get user profile failed', { error: error instanceof Error ? error.message : String(error) });
        throw error;
    }
};
exports.getMe = getMe;
const forgotPassword = async (req, res) => {
    try {
        const validatedData = forgotPasswordSchema.parse(req.body);
        const prisma = (0, database_1.getPrismaClient)();
        const user = await prisma.user.findUnique({
            where: { email: validatedData.email },
        });
        if (!user) {
            const response = {
                success: true,
                message: 'If the email exists, a password reset link has been sent',
            };
            res.status(types_1.HttpStatus.OK).json(response);
            return;
        }
        const { token, expires } = (0, auth_1.generatePasswordResetToken)();
        await prisma.user.update({
            where: { id: user.id },
            data: {
                passwordResetToken: token,
                passwordResetExpires: expires,
            },
        });
        logger_1.default.info('Password reset token generated', {
            userId: user.id,
            email: user.email,
            token
        });
        const response = {
            success: true,
            message: 'If the email exists, a password reset link has been sent',
        };
        res.status(types_1.HttpStatus.OK).json(response);
    }
    catch (error) {
        logger_1.default.error('Forgot password failed', { error: error instanceof Error ? error.message : String(error) });
        throw error;
    }
};
exports.forgotPassword = forgotPassword;
const resetPassword = async (req, res) => {
    try {
        const validatedData = resetPasswordSchema.parse(req.body);
        const passwordValidation = (0, auth_1.validatePasswordStrength)(validatedData.password);
        if (!passwordValidation.isValid) {
            throw new types_1.AppError(`Password validation failed: ${passwordValidation.errors.join(', ')}`, types_1.HttpStatus.BAD_REQUEST);
        }
        const prisma = (0, database_1.getPrismaClient)();
        const user = await prisma.user.findFirst({
            where: {
                passwordResetToken: validatedData.token,
                passwordResetExpires: {
                    gt: new Date(),
                },
                isActive: true,
            },
        });
        if (!user) {
            throw new types_1.AppError('Invalid or expired reset token', types_1.HttpStatus.BAD_REQUEST);
        }
        const hashedPassword = await (0, auth_1.hashPassword)(validatedData.password);
        await prisma.user.update({
            where: { id: user.id },
            data: {
                password: hashedPassword,
                passwordResetToken: null,
                passwordResetExpires: null,
                refreshToken: null,
            },
        });
        await prisma.userSession.updateMany({
            where: { userId: user.id },
            data: { isActive: false },
        });
        logger_1.default.info('Password reset successfully', { userId: user.id });
        const response = {
            success: true,
            message: 'Password reset successful',
        };
        res.status(types_1.HttpStatus.OK).json(response);
    }
    catch (error) {
        logger_1.default.error('Password reset failed', { error: error instanceof Error ? error.message : String(error) });
        throw error;
    }
};
exports.resetPassword = resetPassword;
//# sourceMappingURL=auth.js.map