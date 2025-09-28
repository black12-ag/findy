export interface CacheOptions {
    ttl?: number;
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
export declare class CacheService {
    private readonly defaultTTL;
    private readonly defaultPrefix;
    private stats;
    get<T = any>(key: string, options?: CacheOptions): Promise<T | null>;
    set(key: string, value: any, options?: CacheOptions): Promise<void>;
    delete(key: string, options?: CacheOptions): Promise<boolean>;
    exists(key: string, options?: CacheOptions): Promise<boolean>;
    expire(key: string, ttl: number, options?: CacheOptions): Promise<boolean>;
    mget<T = any>(keys: string[], options?: CacheOptions): Promise<(T | null)[]>;
    mset(keyValuePairs: Record<string, any>, options?: CacheOptions): Promise<void>;
    increment(key: string, amount?: number, options?: CacheOptions): Promise<number>;
    decrement(key: string, amount?: number, options?: CacheOptions): Promise<number>;
    sadd(key: string, members: string[], options?: CacheOptions): Promise<number>;
    smembers(key: string, options?: CacheOptions): Promise<string[]>;
    srem(key: string, members: string[], options?: CacheOptions): Promise<number>;
    getStats(): Promise<CacheStats>;
    clear(prefix?: string): Promise<number>;
    keys(pattern: string, options?: CacheOptions): Promise<string[]>;
    cleanupExpired(maxAge: number): Promise<string[]>;
    invalidateByTags(tags: string[]): Promise<number>;
    private buildKey;
    private setTags;
    cache(key: string | ((args: any[]) => string), options?: CacheOptions): (target: any, propertyKey: string, descriptor: PropertyDescriptor) => PropertyDescriptor;
    warm(data: Record<string, any>, options?: CacheOptions): Promise<void>;
}
//# sourceMappingURL=CacheService.d.ts.map