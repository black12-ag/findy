"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sanitizeUser = exports.hasRole = exports.createSessionFingerprint = exports.validatePasswordStrength = exports.generateApiKey = exports.extractTokenFromHeader = exports.generatePasswordResetToken = exports.generateEmailVerificationToken = exports.generateSecureToken = exports.comparePassword = exports.hashPassword = exports.verifyRefreshToken = exports.verifyAccessToken = exports.generateTokens = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const crypto_1 = __importDefault(require("crypto"));
const config_1 = __importDefault(require("@/config/config"));
const types_1 = require("@/types");
const generateTokens = (user) => {
    const payload = {
        userId: user.id,
        email: user.email,
        role: user.role,
    };
    const accessToken = jsonwebtoken_1.default.sign(payload, config_1.default.auth.jwtSecret, {
        expiresIn: config_1.default.auth.jwtExpiresIn,
        issuer: 'pathfinder-pro',
        audience: 'pathfinder-pro-client',
    });
    const refreshToken = jsonwebtoken_1.default.sign({ userId: user.id, type: 'refresh' }, config_1.default.auth.refreshTokenSecret, {
        expiresIn: config_1.default.auth.refreshTokenExpiresIn,
        issuer: 'pathfinder-pro',
        audience: 'pathfinder-pro-client',
    });
    const decoded = jsonwebtoken_1.default.decode(accessToken);
    const expiresIn = decoded.exp - Math.floor(Date.now() / 1000);
    return {
        accessToken,
        refreshToken,
        expiresIn,
    };
};
exports.generateTokens = generateTokens;
const verifyAccessToken = (token) => {
    try {
        const payload = jsonwebtoken_1.default.verify(token, config_1.default.auth.jwtSecret, {
            issuer: 'pathfinder-pro',
            audience: 'pathfinder-pro-client',
        });
        return payload;
    }
    catch (error) {
        if (error instanceof jsonwebtoken_1.default.TokenExpiredError) {
            throw new types_1.AppError('Token expired', types_1.HttpStatus.UNAUTHORIZED);
        }
        if (error instanceof jsonwebtoken_1.default.JsonWebTokenError) {
            throw new types_1.AppError('Invalid token', types_1.HttpStatus.UNAUTHORIZED);
        }
        throw new types_1.AppError('Token verification failed', types_1.HttpStatus.UNAUTHORIZED);
    }
};
exports.verifyAccessToken = verifyAccessToken;
const verifyRefreshToken = (token) => {
    try {
        const payload = jsonwebtoken_1.default.verify(token, config_1.default.auth.refreshTokenSecret, {
            issuer: 'pathfinder-pro',
            audience: 'pathfinder-pro-client',
        });
        if (payload.type !== 'refresh') {
            throw new types_1.AppError('Invalid refresh token', types_1.HttpStatus.UNAUTHORIZED);
        }
        return payload;
    }
    catch (error) {
        if (error instanceof jsonwebtoken_1.default.TokenExpiredError) {
            throw new types_1.AppError('Refresh token expired', types_1.HttpStatus.UNAUTHORIZED);
        }
        if (error instanceof jsonwebtoken_1.default.JsonWebTokenError) {
            throw new types_1.AppError('Invalid refresh token', types_1.HttpStatus.UNAUTHORIZED);
        }
        throw new types_1.AppError('Refresh token verification failed', types_1.HttpStatus.UNAUTHORIZED);
    }
};
exports.verifyRefreshToken = verifyRefreshToken;
const hashPassword = async (password) => {
    return bcryptjs_1.default.hash(password, config_1.default.auth.bcryptRounds);
};
exports.hashPassword = hashPassword;
const comparePassword = async (password, hash) => {
    return bcryptjs_1.default.compare(password, hash);
};
exports.comparePassword = comparePassword;
const generateSecureToken = (length = 32) => {
    return crypto_1.default.randomBytes(length).toString('hex');
};
exports.generateSecureToken = generateSecureToken;
const generateEmailVerificationToken = () => {
    return (0, exports.generateSecureToken)(32);
};
exports.generateEmailVerificationToken = generateEmailVerificationToken;
const generatePasswordResetToken = () => {
    const token = (0, exports.generateSecureToken)(32);
    const expires = new Date(Date.now() + 30 * 60 * 1000);
    return { token, expires };
};
exports.generatePasswordResetToken = generatePasswordResetToken;
const extractTokenFromHeader = (authHeader) => {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return null;
    }
    return authHeader.substring(7);
};
exports.extractTokenFromHeader = extractTokenFromHeader;
const generateApiKey = () => {
    const prefix = 'pk_';
    const randomPart = crypto_1.default.randomBytes(24).toString('hex');
    return `${prefix}${randomPart}`;
};
exports.generateApiKey = generateApiKey;
const validatePasswordStrength = (password) => {
    const errors = [];
    if (password.length < 8) {
        errors.push('Password must be at least 8 characters long');
    }
    if (!/[a-z]/.test(password)) {
        errors.push('Password must contain at least one lowercase letter');
    }
    if (!/[A-Z]/.test(password)) {
        errors.push('Password must contain at least one uppercase letter');
    }
    if (!/\d/.test(password)) {
        errors.push('Password must contain at least one number');
    }
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
        errors.push('Password must contain at least one special character');
    }
    return {
        isValid: errors.length === 0,
        errors,
    };
};
exports.validatePasswordStrength = validatePasswordStrength;
const createSessionFingerprint = (userAgent, ipAddress) => {
    const data = `${userAgent || 'unknown'}-${ipAddress || 'unknown'}`;
    return crypto_1.default.createHash('sha256').update(data).digest('hex');
};
exports.createSessionFingerprint = createSessionFingerprint;
const hasRole = (userRole, requiredRole) => {
    const roleHierarchy = {
        USER: 1,
        MODERATOR: 2,
        ADMIN: 3,
    };
    const userLevel = roleHierarchy[userRole] || 0;
    const requiredLevel = roleHierarchy[requiredRole] || 0;
    return userLevel >= requiredLevel;
};
exports.hasRole = hasRole;
const sanitizeUser = (user) => {
    const { password, refreshToken, emailVerifyToken, passwordResetToken, passwordResetExpires, ...sanitizedUser } = user;
    return sanitizedUser;
};
exports.sanitizeUser = sanitizeUser;
//# sourceMappingURL=auth.js.map