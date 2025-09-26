import { redisClient } from '@/config/redis';
import { logger } from '@/config/logger';
import { AppError } from '@/utils/error';

export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  prefix?: string;
  tags?: string[];
}

export interface CacheStats {
  keys: number;
  usedMemory: number;
  hits: number;
  misses: number;
  evictions: number;
}

export class CacheService {
  private readonly defaultTTL = 3600; // 1 hour
  private readonly defaultPrefix = 'pathfinder:';
  private stats = {
    hits: 0,
    misses: 0,
  };

  /**
   * Get value from cache
   */
  async get<T = any>(key: string, options: CacheOptions = {}): Promise<T | null> {
    try {
      const fullKey = this.buildKey(key, options.prefix);
      const value = await redisClient.get(fullKey);

      if (value === null) {
        this.stats.misses++;
        logger.debug('Cache miss', { key: fullKey });
        return null;
      }

      this.stats.hits++;
      logger.debug('Cache hit', { key: fullKey });
      
      try {
        return JSON.parse(value);
      } catch {
        // If parsing fails, return as string
        return value as T;
      }
    } catch (error) {
      logger.error('Cache get error', {
        key,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return null;
    }
  }

  /**
   * Set value in cache
   */
  async set(
    key: string,
    value: any,
    options: CacheOptions = {}
  ): Promise<void> {
    try {
      const fullKey = this.buildKey(key, options.prefix);
      const ttl = options.ttl || this.defaultTTL;
      
      let serializedValue: string;
      if (typeof value === 'string') {
        serializedValue = value;
      } else {
        serializedValue = JSON.stringify(value);
      }

      if (ttl > 0) {
        await redisClient.setex(fullKey, ttl, serializedValue);
      } else {
        await redisClient.set(fullKey, serializedValue);
      }

      // Set tags if provided
      if (options.tags && options.tags.length > 0) {
        await this.setTags(fullKey, options.tags);
      }

      logger.debug('Cache set', { 
        key: fullKey, 
        ttl,
        size: serializedValue.length,
        tags: options.tags,
      });
    } catch (error) {
      logger.error('Cache set error', {
        key,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw new AppError('Failed to set cache value', 500);
    }
  }

  /**
   * Delete value from cache
   */
  async delete(key: string, options: CacheOptions = {}): Promise<boolean> {
    try {
      const fullKey = this.buildKey(key, options.prefix);
      const result = await redisClient.del(fullKey);
      
      logger.debug('Cache delete', { key: fullKey, deleted: result > 0 });
      return result > 0;
    } catch (error) {
      logger.error('Cache delete error', {
        key,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }

  /**
   * Check if key exists in cache
   */
  async exists(key: string, options: CacheOptions = {}): Promise<boolean> {
    try {
      const fullKey = this.buildKey(key, options.prefix);
      const result = await redisClient.exists(fullKey);
      return result === 1;
    } catch (error) {
      logger.error('Cache exists error', {
        key,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }

  /**
   * Set TTL for existing key
   */
  async expire(key: string, ttl: number, options: CacheOptions = {}): Promise<boolean> {
    try {
      const fullKey = this.buildKey(key, options.prefix);
      const result = await redisClient.expire(fullKey, ttl);
      return result === 1;
    } catch (error) {
      logger.error('Cache expire error', {
        key,
        ttl,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }

  /**
   * Get multiple keys at once
   */
  async mget<T = any>(keys: string[], options: CacheOptions = {}): Promise<(T | null)[]> {
    try {
      const fullKeys = keys.map(key => this.buildKey(key, options.prefix));
      const values = await redisClient.mget(...fullKeys);

      return values.map((value, index) => {
        if (value === null) {
          this.stats.misses++;
          return null;
        }

        this.stats.hits++;
        try {
          return JSON.parse(value);
        } catch {
          return value as T;
        }
      });
    } catch (error) {
      logger.error('Cache mget error', {
        keys,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return keys.map(() => null);
    }
  }

  /**
   * Set multiple keys at once
   */
  async mset(keyValuePairs: Record<string, any>, options: CacheOptions = {}): Promise<void> {
    try {
      const serializedPairs: string[] = [];
      
      Object.entries(keyValuePairs).forEach(([key, value]) => {
        const fullKey = this.buildKey(key, options.prefix);
        const serializedValue = typeof value === 'string' ? value : JSON.stringify(value);
        serializedPairs.push(fullKey, serializedValue);
      });

      await redisClient.mset(...serializedPairs);

      // Set TTL for all keys if specified
      if (options.ttl && options.ttl > 0) {
        const expirePromises = Object.keys(keyValuePairs).map(key => 
          this.expire(key, options.ttl!, options)
        );
        await Promise.all(expirePromises);
      }

      logger.debug('Cache mset', { 
        count: Object.keys(keyValuePairs).length,
        ttl: options.ttl,
      });
    } catch (error) {
      logger.error('Cache mset error', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw new AppError('Failed to set multiple cache values', 500);
    }
  }

  /**
   * Increment numeric value
   */
  async increment(key: string, amount: number = 1, options: CacheOptions = {}): Promise<number> {
    try {
      const fullKey = this.buildKey(key, options.prefix);
      const result = await redisClient.incrby(fullKey, amount);

      // Set TTL if specified and this is a new key
      if (options.ttl && options.ttl > 0 && result === amount) {
        await redisClient.expire(fullKey, options.ttl);
      }

      return result;
    } catch (error) {
      logger.error('Cache increment error', {
        key,
        amount,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw new AppError('Failed to increment cache value', 500);
    }
  }

  /**
   * Decrement numeric value
   */
  async decrement(key: string, amount: number = 1, options: CacheOptions = {}): Promise<number> {
    try {
      const fullKey = this.buildKey(key, options.prefix);
      const result = await redisClient.decrby(fullKey, amount);
      return result;
    } catch (error) {
      logger.error('Cache decrement error', {
        key,
        amount,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw new AppError('Failed to decrement cache value', 500);
    }
  }

  /**
   * Add item to set
   */
  async sadd(key: string, members: string[], options: CacheOptions = {}): Promise<number> {
    try {
      const fullKey = this.buildKey(key, options.prefix);
      const result = await redisClient.sadd(fullKey, ...members);

      if (options.ttl && options.ttl > 0) {
        await redisClient.expire(fullKey, options.ttl);
      }

      return result;
    } catch (error) {
      logger.error('Cache sadd error', {
        key,
        members,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw new AppError('Failed to add to set', 500);
    }
  }

  /**
   * Get all members of set
   */
  async smembers(key: string, options: CacheOptions = {}): Promise<string[]> {
    try {
      const fullKey = this.buildKey(key, options.prefix);
      const result = await redisClient.smembers(fullKey);
      return result;
    } catch (error) {
      logger.error('Cache smembers error', {
        key,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return [];
    }
  }

  /**
   * Remove item from set
   */
  async srem(key: string, members: string[], options: CacheOptions = {}): Promise<number> {
    try {
      const fullKey = this.buildKey(key, options.prefix);
      const result = await redisClient.srem(fullKey, ...members);
      return result;
    } catch (error) {
      logger.error('Cache srem error', {
        key,
        members,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return 0;
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<CacheStats> {
    try {
      const info = await redisClient.info('memory');
      const keyspace = await redisClient.info('keyspace');
      
      // Parse memory info
      const usedMemoryMatch = info.match(/used_memory:(\d+)/);
      const usedMemory = usedMemoryMatch ? parseInt(usedMemoryMatch[1]) : 0;

      // Parse keyspace info to get key count
      const keysMatch = keyspace.match(/keys=(\d+)/);
      const keys = keysMatch ? parseInt(keysMatch[1]) : 0;

      return {
        keys,
        usedMemory,
        hits: this.stats.hits,
        misses: this.stats.misses,
        evictions: 0, // Would need to parse from Redis stats
      };
    } catch (error) {
      logger.error('Cache stats error', {
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

  /**
   * Clear all cache keys with prefix
   */
  async clear(prefix?: string): Promise<number> {
    try {
      const searchPrefix = prefix || this.defaultPrefix;
      const keys = await redisClient.keys(`${searchPrefix}*`);
      
      if (keys.length === 0) {
        return 0;
      }

      const result = await redisClient.del(...keys);
      logger.info('Cache cleared', { prefix: searchPrefix, deletedKeys: result });
      return result;
    } catch (error) {
      logger.error('Cache clear error', {
        prefix,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw new AppError('Failed to clear cache', 500);
    }
  }

  /**
   * Get keys matching pattern
   */
  async keys(pattern: string, options: CacheOptions = {}): Promise<string[]> {
    try {
      const fullPattern = this.buildKey(pattern, options.prefix);
      const keys = await redisClient.keys(fullPattern);
      return keys.map(key => key.replace(options.prefix || this.defaultPrefix, ''));
    } catch (error) {
      logger.error('Cache keys error', {
        pattern,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return [];
    }
  }

  /**
   * Clean up expired keys
   */
  async cleanupExpired(maxAge: number): Promise<string[]> {
    try {
      const allKeys = await redisClient.keys(`${this.defaultPrefix}*`);
      const expiredKeys: string[] = [];

      // Check each key's TTL
      for (const key of allKeys) {
        const ttl = await redisClient.ttl(key);
        if (ttl === -1 || (ttl > 0 && ttl < maxAge)) {
          expiredKeys.push(key);
        }
      }

      if (expiredKeys.length > 0) {
        await redisClient.del(...expiredKeys);
        logger.info('Cleaned up expired cache keys', { 
          count: expiredKeys.length,
          maxAge,
        });
      }

      return expiredKeys;
    } catch (error) {
      logger.error('Cache cleanup error', {
        maxAge,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return [];
    }
  }

  /**
   * Invalidate cache by tags
   */
  async invalidateByTags(tags: string[]): Promise<number> {
    try {
      let deletedCount = 0;

      for (const tag of tags) {
        const tagKey = `${this.defaultPrefix}tag:${tag}`;
        const keys = await redisClient.smembers(tagKey);
        
        if (keys.length > 0) {
          const deleted = await redisClient.del(...keys);
          deletedCount += deleted;
          
          // Clean up the tag set itself
          await redisClient.del(tagKey);
        }
      }

      logger.info('Cache invalidated by tags', { 
        tags, 
        deletedKeys: deletedCount 
      });
      
      return deletedCount;
    } catch (error) {
      logger.error('Cache invalidate by tags error', {
        tags,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return 0;
    }
  }

  /**
   * Build full cache key with prefix
   */
  private buildKey(key: string, prefix?: string): string {
    return `${prefix || this.defaultPrefix}${key}`;
  }

  /**
   * Set tags for a key
   */
  private async setTags(key: string, tags: string[]): Promise<void> {
    try {
      const tagPromises = tags.map(tag => {
        const tagKey = `${this.defaultPrefix}tag:${tag}`;
        return redisClient.sadd(tagKey, key);
      });

      await Promise.all(tagPromises);
    } catch (error) {
      logger.warn('Failed to set cache tags', {
        key,
        tags,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Cache decorator for methods
   */
  cache(key: string | ((args: any[]) => string), options: CacheOptions = {}) {
    return (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
      const originalMethod = descriptor.value;

      descriptor.value = async function (...args: any[]) {
        const cacheKey = typeof key === 'function' ? key(args) : key;
        
        // Try to get from cache first
        const cached = await this.get(cacheKey, options);
        if (cached !== null) {
          return cached;
        }

        // Execute original method
        const result = await originalMethod.apply(this, args);
        
        // Cache the result
        await this.set(cacheKey, result, options);
        
        return result;
      };

      return descriptor;
    };
  }

  /**
   * Warm cache with data
   */
  async warm(data: Record<string, any>, options: CacheOptions = {}): Promise<void> {
    try {
      await this.mset(data, options);
      logger.info('Cache warmed', { 
        keyCount: Object.keys(data).length,
        ttl: options.ttl,
      });
    } catch (error) {
      logger.error('Cache warm error', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw new AppError('Failed to warm cache', 500);
    }
  }
}