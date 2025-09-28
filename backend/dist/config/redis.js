"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.redisClient = exports.checkRedisHealth = exports.connectRedis = exports.getRedisClient = void 0;
const ioredis_1 = __importDefault(require("ioredis"));
const config_1 = __importDefault(require("./config"));
const logger_1 = __importDefault(require("./logger"));
let redisClient;
const getRedisClient = () => {
    if (!redisClient) {
        exports.redisClient = redisClient = new ioredis_1.default(config_1.default.database.redis, {
            maxRetriesPerRequest: 3,
            lazyConnect: true,
        });
        redisClient.on('connect', () => {
            logger_1.default.info('Redis client connected');
        });
        redisClient.on('ready', () => {
            logger_1.default.info('Redis client ready');
        });
        redisClient.on('error', (error) => {
            logger_1.default.error('Redis client error:', error);
        });
        redisClient.on('close', () => {
            logger_1.default.info('Redis client connection closed');
        });
        redisClient.on('reconnecting', () => {
            logger_1.default.info('Redis client reconnecting...');
        });
        process.on('SIGINT', async () => {
            await redisClient.quit();
        });
        process.on('SIGTERM', async () => {
            await redisClient.quit();
        });
    }
    return redisClient;
};
exports.getRedisClient = getRedisClient;
const connectRedis = async () => {
    try {
        const redis = (0, exports.getRedisClient)();
        await redis.connect();
        logger_1.default.info('Redis connected successfully');
        return redis;
    }
    catch (error) {
        logger_1.default.error('Redis connection failed:', error);
        throw error;
    }
};
exports.connectRedis = connectRedis;
const checkRedisHealth = async () => {
    try {
        const redis = (0, exports.getRedisClient)();
        await redis.ping();
        logger_1.default.debug('Redis health check passed');
        return true;
    }
    catch (error) {
        logger_1.default.error('Redis health check failed:', error);
        return false;
    }
};
exports.checkRedisHealth = checkRedisHealth;
exports.default = (0, exports.getRedisClient)();
//# sourceMappingURL=redis.js.map