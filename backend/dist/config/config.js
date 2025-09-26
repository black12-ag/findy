"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
const zod_1 = require("zod");
dotenv_1.default.config();
const envSchema = zod_1.z.object({
    NODE_ENV: zod_1.z.enum(['development', 'production', 'test']).default('development'),
    PORT: zod_1.z.string().transform(Number).default('5000'),
    API_VERSION: zod_1.z.string().default('v1'),
    DATABASE_URL: zod_1.z.string(),
    REDIS_URL: zod_1.z.string().default('redis://localhost:6379'),
    JWT_SECRET: zod_1.z.string(),
    JWT_EXPIRES_IN: zod_1.z.string().default('7d'),
    REFRESH_TOKEN_SECRET: zod_1.z.string(),
    REFRESH_TOKEN_EXPIRES_IN: zod_1.z.string().default('30d'),
    GOOGLE_MAPS_API_KEY: zod_1.z.string().optional(),
    MAPBOX_ACCESS_TOKEN: zod_1.z.string().optional(),
    OPENWEATHER_API_KEY: zod_1.z.string().optional(),
    FIREBASE_SERVER_KEY: zod_1.z.string().optional(),
    SMTP_HOST: zod_1.z.string().optional(),
    SMTP_PORT: zod_1.z.string().transform(Number).default('587'),
    SMTP_USER: zod_1.z.string().optional(),
    SMTP_PASS: zod_1.z.string().optional(),
    MAX_FILE_SIZE: zod_1.z.string().transform(Number).default('5242880'),
    UPLOAD_PATH: zod_1.z.string().default('uploads/'),
    RATE_LIMIT_WINDOW_MS: zod_1.z.string().transform(Number).default('900000'),
    RATE_LIMIT_MAX_REQUESTS: zod_1.z.string().transform(Number).default('100'),
    BCRYPT_ROUNDS: zod_1.z.string().transform(Number).default('12'),
    CORS_ORIGIN: zod_1.z.string().default('http://localhost:3000'),
    LOG_LEVEL: zod_1.z.string().default('info'),
    ENABLE_DOCS: zod_1.z.string().transform(Boolean).default('false'),
});
const env = envSchema.parse(process.env);
exports.config = {
    server: {
        port: env.PORT,
        apiVersion: env.API_VERSION,
        nodeEnv: env.NODE_ENV,
        isDevelopment: env.NODE_ENV === 'development',
        isProduction: env.NODE_ENV === 'production',
        isTest: env.NODE_ENV === 'test',
    },
    database: {
        url: env.DATABASE_URL,
        redis: env.REDIS_URL,
    },
    auth: {
        jwtSecret: env.JWT_SECRET,
        jwtExpiresIn: env.JWT_EXPIRES_IN,
        refreshTokenSecret: env.REFRESH_TOKEN_SECRET,
        refreshTokenExpiresIn: env.REFRESH_TOKEN_EXPIRES_IN,
        bcryptRounds: env.BCRYPT_ROUNDS,
    },
    apis: {
        googleMaps: env.GOOGLE_MAPS_API_KEY,
        mapbox: env.MAPBOX_ACCESS_TOKEN,
        openWeather: env.OPENWEATHER_API_KEY,
        firebase: env.FIREBASE_SERVER_KEY,
    },
    email: {
        host: env.SMTP_HOST,
        port: env.SMTP_PORT,
        user: env.SMTP_USER,
        pass: env.SMTP_PASS,
    },
    upload: {
        maxFileSize: env.MAX_FILE_SIZE,
        uploadPath: env.UPLOAD_PATH,
    },
    security: {
        corsOrigin: env.CORS_ORIGIN,
        rateLimitWindowMs: env.RATE_LIMIT_WINDOW_MS,
        rateLimitMaxRequests: env.RATE_LIMIT_MAX_REQUESTS,
    },
    cors: {
        allowedOrigins: [env.CORS_ORIGIN, 'http://localhost:3000'],
    },
    rateLimit: {
        windowMs: env.RATE_LIMIT_WINDOW_MS,
        max: env.RATE_LIMIT_MAX_REQUESTS,
    },
    node: {
        env: env.NODE_ENV,
    },
    logging: {
        level: env.LOG_LEVEL,
    },
    features: {
        enableDocs: env.ENABLE_DOCS,
    },
};
exports.default = exports.config;
//# sourceMappingURL=config.js.map