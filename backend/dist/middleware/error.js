"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.gracefulShutdown = exports.handleDatabaseConnection = exports.validationError = exports.asyncHandler = exports.notFound = exports.notFoundHandler = exports.errorHandler = void 0;
const client_1 = require("@prisma/client");
const zod_1 = require("zod");
const types_1 = require("@/types");
const config_1 = __importDefault(require("@/config/config"));
const logger_1 = __importDefault(require("@/config/logger"));
const errorHandler = (error, req, res, next) => {
    let statusCode = types_1.HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let details = null;
    logger_1.default.error('Error occurred', {
        error: error.message,
        stack: error.stack,
        url: req.url,
        method: req.method,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
    });
    if (error instanceof types_1.AppError) {
        statusCode = error.statusCode;
        message = error.message;
    }
    else if (error instanceof client_1.Prisma.PrismaClientKnownRequestError) {
        const prismaError = handlePrismaError(error);
        statusCode = prismaError.statusCode;
        message = prismaError.message;
        details = prismaError.details;
    }
    else if (error instanceof zod_1.ZodError) {
        statusCode = types_1.HttpStatus.BAD_REQUEST;
        message = 'Validation failed';
        details = error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message,
            code: err.code,
        }));
    }
    else if (error.name === 'JsonWebTokenError') {
        statusCode = types_1.HttpStatus.UNAUTHORIZED;
        message = 'Invalid token';
    }
    else if (error.name === 'TokenExpiredError') {
        statusCode = types_1.HttpStatus.UNAUTHORIZED;
        message = 'Token expired';
    }
    else if (error.name === 'MulterError') {
        statusCode = types_1.HttpStatus.BAD_REQUEST;
        switch (error.code) {
            case 'LIMIT_FILE_SIZE':
                message = 'File too large';
                break;
            case 'LIMIT_FILE_COUNT':
                message = 'Too many files';
                break;
            case 'LIMIT_UNEXPECTED_FILE':
                message = 'Unexpected file field';
                break;
            default:
                message = 'File upload error';
        }
    }
    else if (error.name === 'ValidationError') {
        statusCode = types_1.HttpStatus.BAD_REQUEST;
        message = 'Validation error';
        details = Object.values(error.errors).map((err) => ({
            field: err.path,
            message: err.message,
        }));
    }
    else if (error instanceof SyntaxError && 'body' in error) {
        statusCode = types_1.HttpStatus.BAD_REQUEST;
        message = 'Invalid JSON in request body';
    }
    else if (error.name === 'CastError') {
        statusCode = types_1.HttpStatus.BAD_REQUEST;
        message = 'Invalid ID format';
    }
    const errorResponse = {
        success: false,
        message,
        error: config_1.default.server.isDevelopment ? error.stack : undefined,
    };
    if (details) {
        errorResponse.data = details;
    }
    res.status(statusCode).json(errorResponse);
};
exports.errorHandler = errorHandler;
function handlePrismaError(error) {
    switch (error.code) {
        case 'P2002':
            const field = error.meta?.target;
            return {
                statusCode: types_1.HttpStatus.CONFLICT,
                message: `${field?.join(', ') || 'Field'} already exists`,
                details: { field: field?.[0] },
            };
        case 'P2025':
            return {
                statusCode: types_1.HttpStatus.NOT_FOUND,
                message: 'Record not found',
            };
        case 'P2003':
            return {
                statusCode: types_1.HttpStatus.BAD_REQUEST,
                message: 'Invalid reference to related record',
            };
        case 'P2014':
            return {
                statusCode: types_1.HttpStatus.BAD_REQUEST,
                message: 'Required relation is missing',
            };
        case 'P2021':
            return {
                statusCode: types_1.HttpStatus.INTERNAL_SERVER_ERROR,
                message: 'Database table not found',
            };
        case 'P2022':
            return {
                statusCode: types_1.HttpStatus.INTERNAL_SERVER_ERROR,
                message: 'Database column not found',
            };
        default:
            return {
                statusCode: types_1.HttpStatus.INTERNAL_SERVER_ERROR,
                message: 'Database error occurred',
                details: config_1.default.server.isDevelopment ? { code: error.code } : undefined,
            };
    }
}
const notFoundHandler = (req, res, next) => {
    const error = new types_1.AppError(`Route ${req.originalUrl} not found`, types_1.HttpStatus.NOT_FOUND);
    next(error);
};
exports.notFoundHandler = notFoundHandler;
exports.notFound = exports.notFoundHandler;
const asyncHandler = (fn) => {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};
exports.asyncHandler = asyncHandler;
const validationError = (message, field) => {
    const error = new types_1.AppError(message, types_1.HttpStatus.BAD_REQUEST);
    if (field) {
        error.field = field;
    }
    return error;
};
exports.validationError = validationError;
const handleDatabaseConnection = (error) => {
    logger_1.default.error('Database connection error', { error: error.message });
    if (error.message.includes('ECONNREFUSED')) {
        logger_1.default.error('Database connection refused. Please check if the database is running.');
    }
    else if (error.message.includes('ENOTFOUND')) {
        logger_1.default.error('Database host not found. Please check the connection URL.');
    }
    else if (error.message.includes('authentication failed')) {
        logger_1.default.error('Database authentication failed. Please check credentials.');
    }
};
exports.handleDatabaseConnection = handleDatabaseConnection;
const gracefulShutdown = (signal) => {
    return () => {
        logger_1.default.info(`Received ${signal}. Starting graceful shutdown...`);
        process.exit(0);
    };
};
exports.gracefulShutdown = gracefulShutdown;
//# sourceMappingURL=error.js.map