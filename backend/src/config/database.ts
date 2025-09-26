import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import config from './config';
import logger from './logger';

// Prisma Client singleton
let prismaClient: PrismaClient;

export const getPrismaClient = (): PrismaClient => {
  if (!prismaClient) {
    prismaClient = new PrismaClient({
      log: config.server.isDevelopment
        ? ['query', 'info', 'warn', 'error']
        : ['error'],
      datasources: {
        db: {
          url: config.database.url,
        },
      },
    });

    // Handle Prisma connection events
    prismaClient.$on('error' as never, (e: any) => {
      logger.error('Prisma error:', e);
    });

    // Graceful shutdown
    process.on('beforeExit', async () => {
      await prismaClient.$disconnect();
    });

    logger.info('Prisma client initialized');
  }

  return prismaClient;
};

// Redis Client singleton
let redisClient: Redis;

export const getRedisClient = (): Redis => {
  if (!redisClient) {
    redisClient = new Redis(config.database.redis, {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    });

    // Redis event handlers
    redisClient.on('connect', () => {
      logger.info('Redis client connected');
    });

    redisClient.on('ready', () => {
      logger.info('Redis client ready');
    });

    redisClient.on('error', (error) => {
      logger.error('Redis client error:', error);
    });

    redisClient.on('close', () => {
      logger.info('Redis client connection closed');
    });

    redisClient.on('reconnecting', () => {
      logger.info('Redis client reconnecting...');
    });

    // Graceful shutdown
    process.on('SIGINT', async () => {
      await redisClient.quit();
    });

    process.on('SIGTERM', async () => {
      await redisClient.quit();
    });
  }

  return redisClient;
};

// Database health check
export const checkDatabaseHealth = async (): Promise<{
  postgres: boolean;
  redis: boolean;
}> => {
  const results = {
    postgres: false,
    redis: false,
  };

  try {
    // Check PostgreSQL connection
    const prisma = getPrismaClient();
    await prisma.$queryRaw`SELECT 1`;
    results.postgres = true;
    logger.debug('PostgreSQL health check passed');
  } catch (error) {
    logger.error('PostgreSQL health check failed:', error);
  }

  try {
    // Check Redis connection
    const redis = getRedisClient();
    await redis.ping();
    results.redis = true;
    logger.debug('Redis health check passed');
  } catch (error) {
    logger.error('Redis health check failed:', error);
  }

  return results;
};

// Initialize database connections
export const initializeDatabases = async (): Promise<void> => {
  try {
    // Initialize Prisma
    const prisma = getPrismaClient();
    await prisma.$connect();
    logger.info('PostgreSQL connected successfully');

    // Initialize Redis
    const redis = getRedisClient();
    await redis.connect();
    logger.info('Redis connected successfully');

  } catch (error) {
    logger.error('Database initialization failed:', error);
    throw error;
  }
};

// Export instances for backward compatibility
export const prisma = getPrismaClient();

// Export functions
export const connectDatabase = initializeDatabases;
