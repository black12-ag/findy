import Redis from 'ioredis';
import config from './config';
import logger from './logger';

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

// Initialize Redis connection
export const connectRedis = async (): Promise<Redis> => {
  try {
    const redis = getRedisClient();
    await redis.connect();
    logger.info('Redis connected successfully');
    return redis;
  } catch (error) {
    logger.error('Redis connection failed:', error);
    throw error;
  }
};

// Redis health check
export const checkRedisHealth = async (): Promise<boolean> => {
  try {
    const redis = getRedisClient();
    await redis.ping();
    logger.debug('Redis health check passed');
    return true;
  } catch (error) {
    logger.error('Redis health check failed:', error);
    return false;
  }
};

// Export the client instance
export { redisClient };
export default getRedisClient();