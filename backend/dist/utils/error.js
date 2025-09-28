"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createErrorResponse = exports.isOperationalError = exports.ExternalServiceError = exports.DatabaseError = exports.InternalServerError = exports.RateLimitError = exports.ConflictError = exports.NotFoundError = exports.AuthorizationError = exports.AuthenticationError = exports.ValidationError = exports.AppError = void 0;
class AppError extends Error {
    constructor(message, statusCode = 500, isOperational = true, code) {
        super(message);
        this.statusCode = statusCode;
        this.isOperational = isOperational;
        this.code = code;
        Error.captureStackTrace(this, this.constructor);
    }
}
exports.AppError = AppError;
class ValidationError extends AppError {
    constructor(message = 'Validation failed') {
        super(message, 400, true, 'VALIDATION_ERROR');
    }
}
exports.ValidationError = ValidationError;
class AuthenticationError extends AppError {
    constructor(message = 'Authentication failed') {
        super(message, 401, true, 'AUTHENTICATION_ERROR');
    }
}
exports.AuthenticationError = AuthenticationError;
class AuthorizationError extends AppError {
    constructor(message = 'Authorization failed') {
        super(message, 403, true, 'AUTHORIZATION_ERROR');
    }
}
exports.AuthorizationError = AuthorizationError;
class NotFoundError extends AppError {
    constructor(message = 'Resource not found') {
        super(message, 404, true, 'NOT_FOUND_ERROR');
    }
}
exports.NotFoundError = NotFoundError;
class ConflictError extends AppError {
    constructor(message = 'Resource conflict') {
        super(message, 409, true, 'CONFLICT_ERROR');
    }
}
exports.ConflictError = ConflictError;
class RateLimitError extends AppError {
    constructor(message = 'Rate limit exceeded') {
        super(message, 429, true, 'RATE_LIMIT_ERROR');
    }
}
exports.RateLimitError = RateLimitError;
class InternalServerError extends AppError {
    constructor(message = 'Internal server error') {
        super(message, 500, true, 'INTERNAL_SERVER_ERROR');
    }
}
exports.InternalServerError = InternalServerError;
class DatabaseError extends AppError {
    constructor(message = 'Database error') {
        super(message, 500, true, 'DATABASE_ERROR');
    }
}
exports.DatabaseError = DatabaseError;
class ExternalServiceError extends AppError {
    constructor(message = 'External service error') {
        super(message, 502, true, 'EXTERNAL_SERVICE_ERROR');
    }
}
exports.ExternalServiceError = ExternalServiceError;
const isOperationalError = (error) => {
    if (error instanceof AppError) {
        return error.isOperational;
    }
    return false;
};
exports.isOperationalError = isOperationalError;
const createErrorResponse = (error, includeStack = false) => {
    const response = {
        success: false,
        message: error.message,
    };
    if (error instanceof AppError) {
        response.code = error.code;
        response.statusCode = error.statusCode;
    }
    else {
        response.code = 'INTERNAL_SERVER_ERROR';
        response.statusCode = 500;
    }
    if (includeStack && error.stack) {
        response.stack = error.stack;
    }
    return response;
};
exports.createErrorResponse = createErrorResponse;
//# sourceMappingURL=error.js.map