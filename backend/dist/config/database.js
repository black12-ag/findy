"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.redisClient = exports.prismaClient = exports.initializeDatabases = exports.checkDatabaseHealth = exports.getRedisClient = exports.getPrismaClient = void 0;
const client_1 = require("@prisma/client");
const ioredis_1 = __importDefault(require("ioredis"));
const config_1 = __importDefault(require("./config"));
const logger_1 = __importDefault(require("./logger"));
let prismaClient;
const getPrismaClient = () => {
    if (!prismaClient) {
        exports.prismaClient = prismaClient = new client_1.PrismaClient({
            log: config_1.default.server.isDevelopment
                ? ['query', 'info', 'warn', 'error']
                : ['error'],
            datasources: {
                db: {
                    url: config_1.default.database.url,
                },
            },
        });
        prismaClient.$on('error', (e) => {
            logger_1.default.error('Prisma error:', e);
        });
        process.on('beforeExit', async () => {
            await prismaClient.$disconnect();
        });
        logger_1.default.info('Prisma client initialized');
    }
    return prismaClient;
};
exports.getPrismaClient = getPrismaClient;
let redisClient;
const getRedisClient = () => {
    if (!redisClient) {
        exports.redisClient = redisClient = new ioredis_1.default(config_1.default.database.redis, {
            retryDelayOnFailover: 100,
            maxRetriesPerRequest: 3,
            lazyConnect: true,
            reconnectOnError: (err) => {
                logger_1.default.error('Redis reconnection error:', err);
                const targetError = 'READONLY';
                return err.message.includes(targetError);
            },
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
const checkDatabaseHealth = async () => {
    const results = {
        postgres: false,
        redis: false,
    };
    try {
        const prisma = (0, exports.getPrismaClient)();
        await prisma.$queryRaw `SELECT 1`;
        results.postgres = true;
        logger_1.default.debug('PostgreSQL health check passed');
    }
    catch (error) {
        logger_1.default.error('PostgreSQL health check failed:', error);
    }
    try {
        const redis = (0, exports.getRedisClient)();
        await redis.ping();
        results.redis = true;
        logger_1.default.debug('Redis health check passed');
    }
    catch (error) {
        logger_1.default.error('Redis health check failed:', error);
    }
    return results;
};
exports.checkDatabaseHealth = checkDatabaseHealth;
const initializeDatabases = async () => {
    try {
        const prisma = (0, exports.getPrismaClient)();
        await prisma.$connect();
        logger_1.default.info('PostgreSQL connected successfully');
        const redis = (0, exports.getRedisClient)();
        await redis.connect();
        logger_1.default.info('Redis connected successfully');
    }
    catch (error) {
        logger_1.default.error('Database initialization failed:', error);
        throw error;
    }
};
exports.initializeDatabases = initializeDatabases;
//# sourceMappingURL=database.js.map