import React from 'react';

// Storage quotas and limits
export const STORAGE_LIMITS = {
  MAP_TILES: 50 * 1024 * 1024,     // 50MB for map tiles
  USER_DATA: 10 * 1024 * 1024,     // 10MB for user data
  ROUTE_CACHE: 25 * 1024 * 1024,   // 25MB for route cache
  POI_DATA: 15 * 1024 * 1024,      // 15MB for POI data
  TOTAL_QUOTA: 100 * 1024 * 1024   // 100MB total
};

export interface StorageQuota {
  quota: number;
  usage: number;
  available: number;
  percentage: number;
}

export interface StorageStats {
  total: StorageQuota;
  mapTiles: StorageQuota;
  userData: StorageQuota;
  routeCache: StorageQuota;
  poiData: StorageQuota;
}

export interface CacheEntry {
  key: string;
  data: any;
  timestamp: number;
  size: number;
  expiry?: number;
  priority: 'high' | 'medium' | 'low';
}

export interface MapTile {
  x: number;
  y: number;
  z: number;
  url: string;
  data: Blob;
  timestamp: number;
}

export interface RouteData {
  id: string;
  origin: string;
  destination: string;
  waypoints?: string[];
  route: any;
  timestamp: number;
  frequency: number; // How often this route is used
}

class StorageService {
  private dbName = 'PathFinderStorage';
  private version = 1;
  private db: IDBDatabase | null = null;

  constructor() {
    this.initializeDB();
  }

  /**
   * Initialize IndexedDB database
   */
  private async initializeDB(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onerror = () => {
        console.error('[Storage] Failed to open database:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        console.log('[Storage] Database opened successfully');
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        this.createObjectStores(db);
      };
    });
  }

  /**
   * Create object stores for different data types
   */
  private createObjectStores(db: IDBDatabase): void {
    // Map tiles store
    if (!db.objectStoreNames.contains('mapTiles')) {
      const tileStore = db.createObjectStore('mapTiles', { keyPath: 'key' });
      tileStore.createIndex('timestamp', 'timestamp', { unique: false });
      tileStore.createIndex('z', 'z', { unique: false });
    }

    // User data store
    if (!db.objectStoreNames.contains('userData')) {
      const userStore = db.createObjectStore('userData', { keyPath: 'key' });
      userStore.createIndex('timestamp', 'timestamp', { unique: false });
    }

    // Route cache store
    if (!db.objectStoreNames.contains('routeCache')) {
      const routeStore = db.createObjectStore('routeCache', { keyPath: 'id' });
      routeStore.createIndex('timestamp', 'timestamp', { unique: false });
      routeStore.createIndex('frequency', 'frequency', { unique: false });
    }

    // POI data store
    if (!db.objectStoreNames.contains('poiData')) {
      const poiStore = db.createObjectStore('poiData', { keyPath: 'key' });
      poiStore.createIndex('timestamp', 'timestamp', { unique: false });
      poiStore.createIndex('category', 'category', { unique: false });
    }

    console.log('[Storage] Object stores created');
  }

  /**
   * Get current storage quota and usage
   */
  async getStorageStats(): Promise<StorageStats> {
    if (!this.db) await this.initializeDB();

    const [totalQuota, mapTilesUsage, userDataUsage, routeCacheUsage, poiDataUsage] = await Promise.all([
      this.getStorageQuota(),
      this.getStoreSize('mapTiles'),
      this.getStoreSize('userData'), 
      this.getStoreSize('routeCache'),
      this.getStoreSize('poiData')
    ]);

    const totalUsage = mapTilesUsage + userDataUsage + routeCacheUsage + poiDataUsage;

    return {
      total: {
        quota: totalQuota,
        usage: totalUsage,
        available: totalQuota - totalUsage,
        percentage: Math.round((totalUsage / totalQuota) * 100)
      },
      mapTiles: {
        quota: STORAGE_LIMITS.MAP_TILES,
        usage: mapTilesUsage,
        available: STORAGE_LIMITS.MAP_TILES - mapTilesUsage,
        percentage: Math.round((mapTilesUsage / STORAGE_LIMITS.MAP_TILES) * 100)
      },
      userData: {
        quota: STORAGE_LIMITS.USER_DATA,
        usage: userDataUsage,
        available: STORAGE_LIMITS.USER_DATA - userDataUsage,
        percentage: Math.round((userDataUsage / STORAGE_LIMITS.USER_DATA) * 100)
      },
      routeCache: {
        quota: STORAGE_LIMITS.ROUTE_CACHE,
        usage: routeCacheUsage,
        available: STORAGE_LIMITS.ROUTE_CACHE - routeCacheUsage,
        percentage: Math.round((routeCacheUsage / STORAGE_LIMITS.ROUTE_CACHE) * 100)
      },
      poiData: {
        quota: STORAGE_LIMITS.POI_DATA,
        usage: poiDataUsage,
        available: STORAGE_LIMITS.POI_DATA - poiDataUsage,
        percentage: Math.round((poiDataUsage / STORAGE_LIMITS.POI_DATA) * 100)
      }
    };
  }

  /**
   * Get storage quota from browser
   */
  private async getStorageQuota(): Promise<number> {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      try {
        const estimate = await navigator.storage.estimate();
        return estimate.quota || STORAGE_LIMITS.TOTAL_QUOTA;
      } catch (error) {
        console.warn('[Storage] Could not get storage estimate:', error);
      }
    }
    return STORAGE_LIMITS.TOTAL_QUOTA;
  }

  /**
   * Get the size of a specific object store
   */
  private async getStoreSize(storeName: string): Promise<number> {
    if (!this.db) return 0;

    return new Promise((resolve) => {
      const transaction = this.db!.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.getAll();

      request.onsuccess = () => {
        const items = request.result;
        const totalSize = items.reduce((size, item) => {
          return size + this.calculateItemSize(item);
        }, 0);
        resolve(totalSize);
      };

      request.onerror = () => {
        console.error(`[Storage] Failed to get size for store ${storeName}`);
        resolve(0);
      };
    });
  }

  /**
   * Calculate approximate size of an item
   */
  private calculateItemSize(item: any): number {
    const jsonString = JSON.stringify(item);
    return new Blob([jsonString]).size;
  }

  /**
   * Cache map tile
   */
  async cacheMapTile(x: number, y: number, z: number, url: string, data: Blob): Promise<void> {
    if (!this.db) await this.initializeDB();

    const key = `${z}-${x}-${y}`;
    const tileData: MapTile & { key: string; size: number } = {
      key,
      x,
      y,
      z,
      url,
      data,
      timestamp: Date.now(),
      size: data.size
    };

    // Check if we need to cleanup before adding
    await this.ensureStorageSpace('mapTiles', data.size);

    return this.putItem('mapTiles', tileData);
  }

  /**
   * Get cached map tile
   */
  async getCachedMapTile(x: number, y: number, z: number): Promise<MapTile | null> {
    if (!this.db) return null;

    const key = `${z}-${x}-${y}`;
    const tile = await this.getItem('mapTiles', key);
    
    if (tile) {
      // Update access time for LRU
      tile.timestamp = Date.now();
      await this.putItem('mapTiles', tile);
      return tile;
    }

    return null;
  }

  /**
   * Cache route data
   */
  async cacheRoute(routeData: RouteData): Promise<void> {
    if (!this.db) await this.initializeDB();

    const size = this.calculateItemSize(routeData);
    await this.ensureStorageSpace('routeCache', size);
    
    return this.putItem('routeCache', { ...routeData, size });
  }

  /**
   * Get cached route
   */
  async getCachedRoute(id: string): Promise<RouteData | null> {
    const route = await this.getItem('routeCache', id);
    
    if (route) {
      // Increment frequency counter
      route.frequency = (route.frequency || 0) + 1;
      route.timestamp = Date.now();
      await this.putItem('routeCache', route);
    }
    
    return route;
  }

  /**
   * Store user data
   */
  async setUserData(key: string, data: any, priority: 'high' | 'medium' | 'low' = 'medium'): Promise<void> {
    if (!this.db) await this.initializeDB();

    const entry: CacheEntry = {
      key,
      data,
      timestamp: Date.now(),
      size: this.calculateItemSize(data),
      priority
    };

    await this.ensureStorageSpace('userData', entry.size);
    return this.putItem('userData', entry);
  }

  /**
   * Get user data
   */
  async getUserData(key: string): Promise<any> {
    const entry = await this.getItem('userData', key);
    return entry ? entry.data : null;
  }

  /**
   * Cache POI data
   */
  async cachePOIData(key: string, data: any, category: string): Promise<void> {
    if (!this.db) await this.initializeDB();

    const entry = {
      key,
      data,
      category,
      timestamp: Date.now(),
      size: this.calculateItemSize(data)
    };

    await this.ensureStorageSpace('poiData', entry.size);
    return this.putItem('poiData', entry);
  }

  /**
   * Generic get item from store
   */
  private async getItem(storeName: string, key: string): Promise<any> {
    if (!this.db) return null;

    return new Promise((resolve) => {
      const transaction = this.db!.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.get(key);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => {
        console.error(`[Storage] Failed to get item ${key} from ${storeName}`);
        resolve(null);
      };
    });
  }

  /**
   * Generic put item to store
   */
  private async putItem(storeName: string, item: any): Promise<void> {
    if (!this.db) await this.initializeDB();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.put(item);

      request.onsuccess = () => resolve();
      request.onerror = () => {
        console.error(`[Storage] Failed to store item in ${storeName}:`, request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Ensure enough storage space by cleaning up old items
   */
  private async ensureStorageSpace(storeName: string, requiredSize: number): Promise<void> {
    const storeLimit = STORAGE_LIMITS[storeName.toUpperCase() as keyof typeof STORAGE_LIMITS] || STORAGE_LIMITS.TOTAL_QUOTA;
    const currentSize = await this.getStoreSize(storeName);

    if (currentSize + requiredSize <= storeLimit) {
      return; // Enough space available
    }

    const spaceToFree = (currentSize + requiredSize) - storeLimit;
    await this.cleanupStorage(storeName, spaceToFree);
  }

  /**
   * Clean up storage using LRU strategy
   */
  private async cleanupStorage(storeName: string, spaceToFree: number): Promise<void> {
    if (!this.db) return;

    return new Promise((resolve) => {
      const transaction = this.db!.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const index = store.index('timestamp');
      const request = index.openCursor(); // Opens cursor in ascending order (oldest first)

      let freedSpace = 0;

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        
        if (cursor && freedSpace < spaceToFree) {
          const item = cursor.value;
          const itemSize = item.size || this.calculateItemSize(item);
          
          // Skip high-priority items
          if (item.priority !== 'high') {
            cursor.delete();
            freedSpace += itemSize;
            console.log(`[Storage] Cleaned up ${itemSize} bytes from ${storeName}`);
          }
          
          cursor.continue();
        } else {
          console.log(`[Storage] Cleanup completed. Freed ${freedSpace} bytes from ${storeName}`);
          resolve();
        }
      };

      request.onerror = () => {
        console.error(`[Storage] Cleanup failed for ${storeName}`);
        resolve();
      };
    });
  }

  /**
   * Clear specific store
   */
  async clearStore(storeName: string): Promise<void> {
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.clear();

      request.onsuccess = () => {
        console.log(`[Storage] Cleared store ${storeName}`);
        resolve();
      };

      request.onerror = () => {
        console.error(`[Storage] Failed to clear store ${storeName}:`, request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Clear all data
   */
  async clearAllData(): Promise<void> {
    const stores = ['mapTiles', 'userData', 'routeCache', 'poiData'];
    await Promise.all(stores.map(store => this.clearStore(store)));
  }

  /**
   * Export data for backup
   */
  async exportData(): Promise<{ [storeName: string]: any[] }> {
    if (!this.db) return {};

    const stores = ['mapTiles', 'userData', 'routeCache', 'poiData'];
    const exportData: { [storeName: string]: any[] } = {};

    for (const storeName of stores) {
      exportData[storeName] = await this.getAllFromStore(storeName);
    }

    return exportData;
  }

  /**
   * Get all items from a store
   */
  private async getAllFromStore(storeName: string): Promise<any[]> {
    if (!this.db) return [];

    return new Promise((resolve) => {
      const transaction = this.db!.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => {
        console.error(`[Storage] Failed to get all items from ${storeName}`);
        resolve([]);
      };
    });
  }

  /**
   * Optimize storage by removing expired and least-used items
   */
  async optimizeStorage(): Promise<{ cleaned: number; optimized: string[] }> {
    const stats = await this.getStorageStats();
    const optimized: string[] = [];
    let totalCleaned = 0;

    // Clean up each store if over 80% capacity
    const stores = [
      { name: 'mapTiles', stats: stats.mapTiles },
      { name: 'userData', stats: stats.userData },
      { name: 'routeCache', stats: stats.routeCache },
      { name: 'poiData', stats: stats.poiData }
    ];

    for (const { name, stats: storeStats } of stores) {
      if (storeStats.percentage > 80) {
        const sizeBefore = storeStats.usage;
        await this.cleanupStorage(name, storeStats.usage * 0.2); // Clean 20%
        const sizeAfter = await this.getStoreSize(name);
        const cleaned = sizeBefore - sizeAfter;
        
        if (cleaned > 0) {
          totalCleaned += cleaned;
          optimized.push(name);
        }
      }
    }

    console.log(`[Storage] Optimization completed. Cleaned ${totalCleaned} bytes from stores: ${optimized.join(', ')}`);
    
    return {
      cleaned: totalCleaned,
      optimized
    };
  }
}

// React hook for storage management
export const useStorage = () => {
  const [stats, setStats] = React.useState<StorageStats | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);

  const refreshStats = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const newStats = await storageService.getStorageStats();
      setStats(newStats);
    } catch (error) {
      console.error('Failed to get storage stats:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    refreshStats();
  }, [refreshStats]);

  const clearStore = async (storeName: string) => {
    setIsLoading(true);
    try {
      await storageService.clearStore(storeName);
      await refreshStats();
    } catch (error) {
      console.error(`Failed to clear store ${storeName}:`, error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const optimizeStorage = async () => {
    setIsLoading(true);
    try {
      const result = await storageService.optimizeStorage();
      await refreshStats();
      return result;
    } catch (error) {
      console.error('Failed to optimize storage:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const exportData = async () => {
    setIsLoading(true);
    try {
      return await storageService.exportData();
    } catch (error) {
      console.error('Failed to export data:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    stats,
    isLoading,
    refreshStats,
    clearStore,
    optimizeStorage,
    exportData,
    
    // Direct service methods
    cacheMapTile: storageService.cacheMapTile.bind(storageService),
    getCachedMapTile: storageService.getCachedMapTile.bind(storageService),
    cacheRoute: storageService.cacheRoute.bind(storageService),
    getCachedRoute: storageService.getCachedRoute.bind(storageService),
    setUserData: storageService.setUserData.bind(storageService),
    getUserData: storageService.getUserData.bind(storageService),
    cachePOIData: storageService.cachePOIData.bind(storageService)
  };
};

export const storageService = new StorageService();
export default storageService;