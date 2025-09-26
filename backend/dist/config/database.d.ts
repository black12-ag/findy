import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
export declare const getPrismaClient: () => PrismaClient;
export declare const getRedisClient: () => Redis;
export declare const checkDatabaseHealth: () => Promise<{
    postgres: boolean;
    redis: boolean;
}>;
export declare const initializeDatabases: () => Promise<void>;
export declare const prisma: PrismaClient<import(".prisma/client").Prisma.PrismaClientOptions, never, import("@prisma/client/runtime/library").DefaultArgs>;
export declare const connectDatabase: () => Promise<void>;
//# sourceMappingURL=database.d.ts.map