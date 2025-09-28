"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isValidAPIKey = exports.generateAPIKey = exports.validateInput = exports.containsXSS = exports.containsSQLInjection = exports.maskSensitiveData = exports.generateRateLimitKey = exports.validatePasswordStrength = exports.isValidPhoneNumber = exports.isValidEmail = exports.hashData = exports.generateUUID = exports.generateSecureToken = exports.sanitizeInput = void 0;
const crypto_1 = __importDefault(require("crypto"));
const error_1 = require("./error");
const sanitizeInput = (input) => {
    if (typeof input === 'string') {
        return input
            .replace(/[<>]/g, '')
            .replace(/javascript:/gi, '')
            .replace(/on\w+=/gi, '')
            .trim();
    }
    if (Array.isArray(input)) {
        return input.map(exports.sanitizeInput);
    }
    if (typeof input === 'object' && input !== null) {
        const sanitized = {};
        for (const [key, value] of Object.entries(input)) {
            sanitized[(0, exports.sanitizeInput)(key)] = (0, exports.sanitizeInput)(value);
        }
        return sanitized;
    }
    return input;
};
exports.sanitizeInput = sanitizeInput;
const generateSecureToken = (length = 32) => {
    return crypto_1.default.randomBytes(length).toString('hex');
};
exports.generateSecureToken = generateSecureToken;
const generateUUID = () => {
    return crypto_1.default.randomUUID();
};
exports.generateUUID = generateUUID;
const hashData = (data) => {
    return crypto_1.default.createHash('sha256').update(data).digest('hex');
};
exports.hashData = hashData;
const isValidEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
};
exports.isValidEmail = isValidEmail;
const isValidPhoneNumber = (phone) => {
    const phoneRegex = /^\+?[1-9]\d{1,14}$/;
    return phoneRegex.test(phone.replace(/\s|-/g, ''));
};
exports.isValidPhoneNumber = isValidPhoneNumber;
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
const generateRateLimitKey = (identifier, endpoint) => {
    return `rate_limit:${endpoint}:${(0, exports.hashData)(identifier)}`;
};
exports.generateRateLimitKey = generateRateLimitKey;
const maskSensitiveData = (data) => {
    if (typeof data === 'string') {
        if ((0, exports.isValidEmail)(data)) {
            const [username, domain] = data.split('@');
            return `${username.substring(0, 2)}***@${domain}`;
        }
        if ((0, exports.isValidPhoneNumber)(data)) {
            return data.replace(/\d(?=\d{4})/g, '*');
        }
        if (data.length > 10 && /^[a-zA-Z0-9]+$/.test(data)) {
            return `${data.substring(0, 4)}***${data.substring(data.length - 4)}`;
        }
    }
    if (Array.isArray(data)) {
        return data.map(exports.maskSensitiveData);
    }
    if (typeof data === 'object' && data !== null) {
        const masked = {};
        const sensitiveFields = ['password', 'token', 'secret', 'key', 'auth'];
        for (const [key, value] of Object.entries(data)) {
            const lowerKey = key.toLowerCase();
            const isSensitive = sensitiveFields.some(field => lowerKey.includes(field));
            if (isSensitive) {
                masked[key] = '***REDACTED***';
            }
            else {
                masked[key] = (0, exports.maskSensitiveData)(value);
            }
        }
        return masked;
    }
    return data;
};
exports.maskSensitiveData = maskSensitiveData;
const containsSQLInjection = (input) => {
    const sqlPatterns = [
        /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC)\b)/i,
        /(\b(UNION|OR|AND)\s+\d+\s*=\s*\d+)/i,
        /(--|#|\/\*|\*\/)/,
        /(\bxp_\w+\b)/i,
        /(\bsp_\w+\b)/i,
    ];
    return sqlPatterns.some(pattern => pattern.test(input));
};
exports.containsSQLInjection = containsSQLInjection;
const containsXSS = (input) => {
    const xssPatterns = [
        /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
        /<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi,
        /javascript:/gi,
        /on\w+\s*=/gi,
        /<img[^>]*src\s*=\s*["']?javascript:/gi,
    ];
    return xssPatterns.some(pattern => pattern.test(input));
};
exports.containsXSS = containsXSS;
const validateInput = (input, fieldName = 'input') => {
    if ((0, exports.containsSQLInjection)(input)) {
        throw new error_1.AppError(`Invalid ${fieldName}: potential SQL injection detected`, 400, true, 'SECURITY_VIOLATION');
    }
    if ((0, exports.containsXSS)(input)) {
        throw new error_1.AppError(`Invalid ${fieldName}: potential XSS attack detected`, 400, true, 'SECURITY_VIOLATION');
    }
};
exports.validateInput = validateInput;
const generateAPIKey = () => {
    const prefix = 'pfp';
    const timestamp = Date.now().toString(36);
    const random = (0, exports.generateSecureToken)(16);
    return `${prefix}_${timestamp}_${random}`;
};
exports.generateAPIKey = generateAPIKey;
const isValidAPIKey = (apiKey) => {
    const pattern = /^pfp_[a-z0-9]+_[a-f0-9]{32}$/;
    return pattern.test(apiKey);
};
exports.isValidAPIKey = isValidAPIKey;
//# sourceMappingURL=security.js.map