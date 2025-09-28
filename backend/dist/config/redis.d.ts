import Redis from 'ioredis';
declare let redisClient: Redis;
export declare const getRedisClient: () => Redis;
export declare const connectRedis: () => Promise<Redis>;
export declare const checkRedisHealth: () => Promise<boolean>;
export { redisClient };
declare const _default: Redis;
export default _default;
//# sourceMappingURL=redis.d.ts.map