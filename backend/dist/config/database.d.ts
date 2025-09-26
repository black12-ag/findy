import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
declare let prismaClient: PrismaClient;
export declare const getPrismaClient: () => PrismaClient;
declare let redisClient: Redis;
export declare const getRedisClient: () => Redis;
export declare const checkDatabaseHealth: () => Promise<{
    postgres: boolean;
    redis: boolean;
}>;
export declare const initializeDatabases: () => Promise<void>;
export { prismaClient, redisClient };
//# sourceMappingURL=database.d.ts.map