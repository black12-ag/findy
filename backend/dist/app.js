"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startServer = void 0;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const compression_1 = __importDefault(require("compression"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const env_1 = require("@/config/env");
const logger_1 = require("@/config/logger");
const database_1 = require("@/config/database");
const redis_1 = require("@/config/redis");
const error_1 = require("@/middleware/error");
const auth_1 = __importDefault(require("@/routes/auth"));
const places_1 = __importDefault(require("@/routes/places"));
const routes_1 = __importDefault(require("@/routes/routes"));
const users_1 = __importDefault(require("@/routes/users"));
const social_1 = __importDefault(require("@/routes/social"));
const app = (0, express_1.default)();
app.set('trust proxy', 1);
app.use((0, helmet_1.default)({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", 'data:', 'https:'],
            connectSrc: ["'self'"],
            fontSrc: ["'self'"],
            objectSrc: ["'none'"],
            mediaSrc: ["'self'"],
            frameSrc: ["'none'"],
        },
    },
    crossOriginEmbedderPolicy: false,
}));
const corsOptions = {
    origin: function (origin, callback) {
        const allowedOrigins = env_1.config.cors.allowedOrigins;
        if (!origin)
            return callback(null, true);
        if (allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        }
        else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    optionsSuccessStatus: 200,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
        'Origin',
        'X-Requested-With',
        'Content-Type',
        'Accept',
        'Authorization',
        'X-API-Key',
    ],
};
app.use((0, cors_1.default)(corsOptions));
app.use((0, compression_1.default)());
const limiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    max: env_1.config.rateLimit.max,
    message: {
        error: 'Too many requests from this IP, please try again later.',
    },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => {
        return req.path === '/health';
    },
});
app.use(limiter);
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ extended: true, limit: '10mb' }));
app.use((req, res, next) => {
    logger_1.logger.info('HTTP Request', {
        method: req.method,
        url: req.url,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
    });
    next();
});
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: env_1.config.node.env,
    });
});
app.use('/api/v1/auth', auth_1.default);
app.use('/api/v1/places', places_1.default);
app.use('/api/v1/routes', routes_1.default);
app.use('/api/v1/users', users_1.default);
app.use('/api/v1/social', social_1.default);
app.get('/api/v1', (req, res) => {
    res.json({
        name: 'PathFinder Pro API',
        version: '1.0.0',
        description: 'Navigation and location services API',
        endpoints: {
            auth: '/api/v1/auth',
            places: '/api/v1/places',
            routes: '/api/v1/routes',
            users: '/api/v1/users',
            social: '/api/v1/social',
        },
        documentation: 'https://docs.pathfinderpro.com/api',
    });
});
app.use(error_1.notFound);
app.use(error_1.errorHandler);
const gracefulShutdown = async (signal) => {
    logger_1.logger.info(`Received ${signal}. Starting graceful shutdown...`);
    process.exit(0);
};
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
const startServer = async () => {
    try {
        await (0, database_1.connectDatabase)();
        logger_1.logger.info('Database connected successfully');
        await (0, redis_1.connectRedis)();
        logger_1.logger.info('Redis connected successfully');
        const PORT = env_1.config.server.port;
        app.listen(PORT, () => {
            logger_1.logger.info(`Server started on port ${PORT}`, {
                environment: env_1.config.node.env,
                port: PORT,
            });
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to start server:', error);
        process.exit(1);
    }
};
exports.startServer = startServer;
exports.default = app;
//# sourceMappingURL=app.js.map