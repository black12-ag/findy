"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.userRateLimit = exports.validateApiKey = exports.checkResourceOwnership = exports.authorize = exports.optionalAuthenticate = exports.authenticate = void 0;
const database_1 = require("@/config/database");
const auth_1 = require("@/utils/auth");
const types_1 = require("@/types");
const logger_1 = __importDefault(require("@/config/logger"));
const authenticate = async (req, res, next) => {
    try {
        const token = (0, auth_1.extractTokenFromHeader)(req.headers.authorization);
        if (!token) {
            throw new types_1.AppError('Access token is required', types_1.HttpStatus.UNAUTHORIZED);
        }
        const payload = (0, auth_1.verifyAccessToken)(token);
        const prisma = (0, database_1.getPrismaClient)();
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
            throw new types_1.AppError('User not found or inactive', types_1.HttpStatus.UNAUTHORIZED);
        }
        if (!user.isVerified) {
            throw new types_1.AppError('Email verification required', types_1.HttpStatus.FORBIDDEN);
        }
        req.user = user;
        logger_1.default.debug('User authenticated successfully', {
            userId: user.id,
            email: user.email
        });
        next();
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger_1.default.error('Authentication failed', { error: message });
        next(error);
    }
};
exports.authenticate = authenticate;
const optionalAuthenticate = async (req, res, next) => {
    try {
        const token = (0, auth_1.extractTokenFromHeader)(req.headers.authorization);
        if (!token) {
            return next();
        }
        const payload = (0, auth_1.verifyAccessToken)(token);
        const prisma = (0, database_1.getPrismaClient)();
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
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger_1.default.debug('Optional authentication failed', { error: message });
        next();
    }
};
exports.optionalAuthenticate = optionalAuthenticate;
const authorize = (requiredRole = 'USER') => {
    return (req, res, next) => {
        try {
            if (!req.user) {
                throw new types_1.AppError('Authentication required', types_1.HttpStatus.UNAUTHORIZED);
            }
            if (!(0, auth_1.hasRole)(req.user.role, requiredRole)) {
                throw new types_1.AppError(`Insufficient permissions. ${requiredRole} role required`, types_1.HttpStatus.FORBIDDEN);
            }
            next();
        }
        catch (error) {
            next(error);
        }
    };
};
exports.authorize = authorize;
const checkResourceOwnership = (userIdField = 'userId') => {
    return (req, res, next) => {
        try {
            if (!req.user) {
                throw new types_1.AppError('Authentication required', types_1.HttpStatus.UNAUTHORIZED);
            }
            const resourceUserId = req.params[userIdField] || req.body[userIdField];
            if (!resourceUserId) {
                throw new types_1.AppError(`${userIdField} not found in request`, types_1.HttpStatus.BAD_REQUEST);
            }
            if (req.user.role === 'ADMIN') {
                return next();
            }
            if (req.user.id !== resourceUserId) {
                throw new types_1.AppError('Access denied. You can only access your own resources', types_1.HttpStatus.FORBIDDEN);
            }
            next();
        }
        catch (error) {
            next(error);
        }
    };
};
exports.checkResourceOwnership = checkResourceOwnership;
const validateApiKey = async (req, res, next) => {
    try {
        const apiKey = req.headers['x-api-key'];
        if (!apiKey) {
            throw new types_1.AppError('API key is required', types_1.HttpStatus.UNAUTHORIZED);
        }
        if (!apiKey.startsWith('pk_') || apiKey.length < 32) {
            throw new types_1.AppError('Invalid API key format', types_1.HttpStatus.UNAUTHORIZED);
        }
        logger_1.default.debug('API key validated', { apiKey: apiKey.substring(0, 10) + '...' });
        next();
    }
    catch (error) {
        next(error);
    }
};
exports.validateApiKey = validateApiKey;
const userRateLimit = (maxRequests = 100, windowMs = 15 * 60 * 1000) => {
    const requests = new Map();
    return (req, res, next) => {
        try {
            const userId = (req.user?.id ?? req.ip);
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
                throw new types_1.AppError(`Rate limit exceeded. Try again in ${resetTimeSeconds} seconds`, types_1.HttpStatus.TOO_MANY_REQUESTS);
            }
            userRequests.count += 1;
            res.set({
                'X-RateLimit-Limit': maxRequests.toString(),
                'X-RateLimit-Remaining': (maxRequests - userRequests.count).toString(),
                'X-RateLimit-Reset': userRequests.resetTime.toString(),
            });
            next();
        }
        catch (error) {
            next(error);
        }
    };
};
exports.userRateLimit = userRateLimit;
//# sourceMappingURL=auth.js.map