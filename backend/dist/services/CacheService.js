"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CacheService = void 0;
const redis_1 = require("@/config/redis");
const logger_1 = require("@/config/logger");
const error_1 = require("@/utils/error");
class CacheService {
    constructor() {
        this.defaultTTL = 3600;
        this.defaultPrefix = 'pathfinder:';
        this.stats = {
            hits: 0,
            misses: 0,
        };
    }
    async get(key, options = {}) {
        try {
            const fullKey = this.buildKey(key, options.prefix);
            const value = await redis_1.redisClient.get(fullKey);
            if (value === null) {
                this.stats.misses++;
                logger_1.logger.debug('Cache miss', { key: fullKey });
                return null;
            }
            this.stats.hits++;
            logger_1.logger.debug('Cache hit', { key: fullKey });
            try {
                return JSON.parse(value);
            }
            catch {
                return value;
            }
        }
        catch (error) {
            logger_1.logger.error('Cache get error', {
                key,
                error: error instanceof Error ? error.message : 'Unknown error',
            });
            return null;
        }
    }
    async set(key, value, options = {}) {
        try {
            const fullKey = this.buildKey(key, options.prefix);
            const ttl = options.ttl || this.defaultTTL;
            let serializedValue;
            if (typeof value === 'string') {
                serializedValue = value;
            }
            else {
                serializedValue = JSON.stringify(value);
            }
            if (ttl > 0) {
                await redis_1.redisClient.setex(fullKey, ttl, serializedValue);
            }
            else {
                await redis_1.redisClient.set(fullKey, serializedValue);
            }
            if (options.tags && options.tags.length > 0) {
                await this.setTags(fullKey, options.tags);
            }
            logger_1.logger.debug('Cache set', {
                key: fullKey,
                ttl,
                size: serializedValue.length,
                tags: options.tags,
            });
        }
        catch (error) {
            logger_1.logger.error('Cache set error', {
                key,
                error: error instanceof Error ? error.message : 'Unknown error',
            });
            throw new error_1.AppError('Failed to set cache value', 500);
        }
    }
    async delete(key, options = {}) {
        try {
            const fullKey = this.buildKey(key, options.prefix);
            const result = await redis_1.redisClient.del(fullKey);
            logger_1.logger.debug('Cache delete', { key: fullKey, deleted: result > 0 });
            return result > 0;
        }
        catch (error) {
            logger_1.logger.error('Cache delete error', {
                key,
                error: error instanceof Error ? error.message : 'Unknown error',
            });
            return false;
        }
    }
    async exists(key, options = {}) {
        try {
            const fullKey = this.buildKey(key, options.prefix);
            const result = await redis_1.redisClient.exists(fullKey);
            return result === 1;
        }
        catch (error) {
            logger_1.logger.error('Cache exists error', {
                key,
                error: error instanceof Error ? error.message : 'Unknown error',
            });
            return false;
        }
    }
    async expire(key, ttl, options = {}) {
        try {
            const fullKey = this.buildKey(key, options.prefix);
            const result = await redis_1.redisClient.expire(fullKey, ttl);
            return result === 1;
        }
        catch (error) {
            logger_1.logger.error('Cache expire error', {
                key,
                ttl,
                error: error instanceof Error ? error.message : 'Unknown error',
            });
            return false;
        }
    }
    async mget(keys, options = {}) {
        try {
            const fullKeys = keys.map(key => this.buildKey(key, options.prefix));
            const values = await redis_1.redisClient.mget(...fullKeys);
            return values.map((value, index) => {
                if (value === null) {
                    this.stats.misses++;
                    return null;
                }
                this.stats.hits++;
                try {
                    return JSON.parse(value);
                }
                catch {
                    return value;
                }
            });
        }
        catch (error) {
            logger_1.logger.error('Cache mget error', {
                keys,
                error: error instanceof Error ? error.message : 'Unknown error',
            });
            return keys.map(() => null);
        }
    }
    async mset(keyValuePairs, options = {}) {
        try {
            const serializedPairs = [];
            Object.entries(keyValuePairs).forEach(([key, value]) => {
                const fullKey = this.buildKey(key, options.prefix);
                const serializedValue = typeof value === 'string' ? value : JSON.stringify(value);
                serializedPairs.push(fullKey, serializedValue);
            });
            await redis_1.redisClient.mset(...serializedPairs);
            if (options.ttl && options.ttl > 0) {
                const expirePromises = Object.keys(keyValuePairs).map(key => this.expire(key, options.ttl, options));
                await Promise.all(expirePromises);
            }
            logger_1.logger.debug('Cache mset', {
                count: Object.keys(keyValuePairs).length,
                ttl: options.ttl,
            });
        }
        catch (error) {
            logger_1.logger.error('Cache mset error', {
                error: error instanceof Error ? error.message : 'Unknown error',
            });
            throw new error_1.AppError('Failed to set multiple cache values', 500);
        }
    }
    async increment(key, amount = 1, options = {}) {
        try {
            const fullKey = this.buildKey(key, options.prefix);
            const result = await redis_1.redisClient.incrby(fullKey, amount);
            if (options.ttl && options.ttl > 0 && result === amount) {
                await redis_1.redisClient.expire(fullKey, options.ttl);
            }
            return result;
        }
        catch (error) {
            logger_1.logger.error('Cache increment error', {
                key,
                amount,
                error: error instanceof Error ? error.message : 'Unknown error',
            });
            throw new error_1.AppError('Failed to increment cache value', 500);
        }
    }
    async decrement(key, amount = 1, options = {}) {
        try {
            const fullKey = this.buildKey(key, options.prefix);
            const result = await redis_1.redisClient.decrby(fullKey, amount);
            return result;
        }
        catch (error) {
            logger_1.logger.error('Cache decrement error', {
                key,
                amount,
                error: error instanceof Error ? error.message : 'Unknown error',
            });
            throw new error_1.AppError('Failed to decrement cache value', 500);
        }
    }
    async sadd(key, members, options = {}) {
        try {
            const fullKey = this.buildKey(key, options.prefix);
            const result = await redis_1.redisClient.sadd(fullKey, ...members);
            if (options.ttl && options.ttl > 0) {
                await redis_1.redisClient.expire(fullKey, options.ttl);
            }
            return result;
        }
        catch (error) {
            logger_1.logger.error('Cache sadd error', {
                key,
                members,
                error: error instanceof Error ? error.message : 'Unknown error',
            });
            throw new error_1.AppError('Failed to add to set', 500);
        }
    }
    async smembers(key, options = {}) {
        try {
            const fullKey = this.buildKey(key, options.prefix);
            const result = await redis_1.redisClient.smembers(fullKey);
            return result;
        }
        catch (error) {
            logger_1.logger.error('Cache smembers error', {
                key,
                error: error instanceof Error ? error.message : 'Unknown error',
            });
            return [];
        }
    }
    async srem(key, members, options = {}) {
        try {
            const fullKey = this.buildKey(key, options.prefix);
            const result = await redis_1.redisClient.srem(fullKey, ...members);
            return result;
        }
        catch (error) {
            logger_1.logger.error('Cache srem error', {
                key,
                members,
                error: error instanceof Error ? error.message : 'Unknown error',
            });
            return 0;
        }
    }
    async getStats() {
        try {
            const info = await redis_1.redisClient.info('memory');
            const keyspace = await redis_1.redisClient.info('keyspace');
            const usedMemoryMatch = info.match(/used_memory:(\d+)/);
            const usedMemory = usedMemoryMatch ? parseInt(usedMemoryMatch[1]) : 0;
            const keysMatch = keyspace.match(/keys=(\d+)/);
            const keys = keysMatch ? parseInt(keysMatch[1]) : 0;
            return {
                keys,
                usedMemory,
                hits: this.stats.hits,
                misses: this.stats.misses,
                evictions: 0,
            };
        }
        catch (error) {
            logger_1.logger.error('Cache stats error', {
                error: error instanceof Error ? error.message : 'Unknown error',
            });
            return {
                keys: 0,
                usedMemory: 0,
                hits: this.stats.hits,
                misses: this.stats.misses,
                evictions: 0,
            };
        }
    }
    async clear(prefix) {
        try {
            const searchPrefix = prefix || this.defaultPrefix;
            const keys = await redis_1.redisClient.keys(`${searchPrefix}*`);
            if (keys.length === 0) {
                return 0;
            }
            const result = await redis_1.redisClient.del(...keys);
            logger_1.logger.info('Cache cleared', { prefix: searchPrefix, deletedKeys: result });
            return result;
        }
        catch (error) {
            logger_1.logger.error('Cache clear error', {
                prefix,
                error: error instanceof Error ? error.message : 'Unknown error',
            });
            throw new error_1.AppError('Failed to clear cache', 500);
        }
    }
    async keys(pattern, options = {}) {
        try {
            const fullPattern = this.buildKey(pattern, options.prefix);
            const keys = await redis_1.redisClient.keys(fullPattern);
            return keys.map(key => key.replace(options.prefix || this.defaultPrefix, ''));
        }
        catch (error) {
            logger_1.logger.error('Cache keys error', {
                pattern,
                error: error instanceof Error ? error.message : 'Unknown error',
            });
            return [];
        }
    }
    async cleanupExpired(maxAge) {
        try {
            const allKeys = await redis_1.redisClient.keys(`${this.defaultPrefix}*`);
            const expiredKeys = [];
            for (const key of allKeys) {
                const ttl = await redis_1.redisClient.ttl(key);
                if (ttl === -1 || (ttl > 0 && ttl < maxAge)) {
                    expiredKeys.push(key);
                }
            }
            if (expiredKeys.length > 0) {
                await redis_1.redisClient.del(...expiredKeys);
                logger_1.logger.info('Cleaned up expired cache keys', {
                    count: expiredKeys.length,
                    maxAge,
                });
            }
            return expiredKeys;
        }
        catch (error) {
            logger_1.logger.error('Cache cleanup error', {
                maxAge,
                error: error instanceof Error ? error.message : 'Unknown error',
            });
            return [];
        }
    }
    async invalidateByTags(tags) {
        try {
            let deletedCount = 0;
            for (const tag of tags) {
                const tagKey = `${this.defaultPrefix}tag:${tag}`;
                const keys = await redis_1.redisClient.smembers(tagKey);
                if (keys.length > 0) {
                    const deleted = await redis_1.redisClient.del(...keys);
                    deletedCount += deleted;
                    await redis_1.redisClient.del(tagKey);
                }
            }
            logger_1.logger.info('Cache invalidated by tags', {
                tags,
                deletedKeys: deletedCount
            });
            return deletedCount;
        }
        catch (error) {
            logger_1.logger.error('Cache invalidate by tags error', {
                tags,
                error: error instanceof Error ? error.message : 'Unknown error',
            });
            return 0;
        }
    }
    buildKey(key, prefix) {
        return `${prefix || this.defaultPrefix}${key}`;
    }
    async setTags(key, tags) {
        try {
            const tagPromises = tags.map(tag => {
                const tagKey = `${this.defaultPrefix}tag:${tag}`;
                return redis_1.redisClient.sadd(tagKey, key);
            });
            await Promise.all(tagPromises);
        }
        catch (error) {
            logger_1.logger.warn('Failed to set cache tags', {
                key,
                tags,
                error: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    }
    cache(key, options = {}) {
        return (target, propertyKey, descriptor) => {
            const originalMethod = descriptor.value;
            descriptor.value = async function (...args) {
                const cacheKey = typeof key === 'function' ? key(args) : key;
                const cached = await this.get(cacheKey, options);
                if (cached !== null) {
                    return cached;
                }
                const result = await originalMethod.apply(this, args);
                await this.set(cacheKey, result, options);
                return result;
            };
            return descriptor;
        };
    }
    async warm(data, options = {}) {
        try {
            await this.mset(data, options);
            logger_1.logger.info('Cache warmed', {
                keyCount: Object.keys(data).length,
                ttl: options.ttl,
            });
        }
        catch (error) {
            logger_1.logger.error('Cache warm error', {
                error: error instanceof Error ? error.message : 'Unknown error',
            });
            throw new error_1.AppError('Failed to warm cache', 500);
        }
    }
}
exports.CacheService = CacheService;
//# sourceMappingURL=CacheService.js.map