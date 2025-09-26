/**
 * Remote Configuration Service
 * Manages dynamic app configuration without requiring app updates
 */

export interface RemoteConfig {
  [key: string]: string | number | boolean | object;
}

export interface ConfigSegment {
  id: string;
  name: string;
  conditions: {
    userId?: string[];
    userType?: string[];
    location?: string[];
    platform?: string[];
    version?: string[];
    custom?: Record<string, any>;
  };
  config: RemoteConfig;
  priority: number;
}

export interface ConfigTemplate {
  id: string;
  name: string;
  description: string;
  schema: Record<string, {
    type: 'string' | 'number' | 'boolean' | 'object';
    default: any;
    required?: boolean;
    validation?: {
      min?: number;
      max?: number;
      pattern?: string;
      enum?: any[];
    };
  }>;
}

export interface ConfigHistory {
  timestamp: number;
  version: string;
  changes: {
    key: string;
    oldValue: any;
    newValue: any;
    reason?: string;
  }[];
  author?: string;
}

class RemoteConfigurationService {
  private config: RemoteConfig = {};
  private segments: ConfigSegment[] = [];
  private templates: ConfigTemplate[] = [];
  private history: ConfigHistory[] = [];
  private listeners: Map<string, Set<(value: any) => void>> = new Map();
  private refreshInterval: number | null = null;
  private lastFetch: number = 0;
  private userId: string = '';
  private userContext: Record<string, any> = {};

  private readonly STORAGE_KEY = 'remote_config_cache';
  private readonly SEGMENTS_KEY = 'config_segments_cache';
  private readonly HISTORY_KEY = 'config_history_cache';
  private readonly REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes
  private readonly CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

  constructor() {
    this.loadFromCache();
    this.setupDefaultTemplates();
    this.startPeriodicRefresh();
  }

  /**
   * Initialize with user context
   */
  async initialize(userId: string, userContext: Record<string, any> = {}): Promise<void> {
    this.userId = userId;
    this.userContext = userContext;
    await this.fetchConfig();
  }

  /**
   * Get configuration value with fallback
   */
  getValue<T = any>(key: string, defaultValue?: T): T {
    // Check if value exists in resolved config
    if (key in this.config) {
      return this.config[key] as T;
    }

    // Check templates for default value
    const template = this.templates.find(t => key.startsWith(t.id));
    if (template) {
      const subKey = key.replace(`${template.id}.`, '');
      if (subKey in template.schema) {
        return template.schema[subKey].default as T;
      }
    }

    return defaultValue as T;
  }

  /**
   * Get all configuration values
   */
  getAllValues(): RemoteConfig {
    return { ...this.config };
  }

  /**
   * Check if configuration key exists
   */
  hasValue(key: string): boolean {
    return key in this.config;
  }

  /**
   * Subscribe to configuration changes
   */
  subscribe(key: string, callback: (value: any) => void): () => void {
    if (!this.listeners.has(key)) {
      this.listeners.set(key, new Set());
    }
    this.listeners.get(key)!.add(callback);

    // Return unsubscribe function
    return () => {
      const keyListeners = this.listeners.get(key);
      if (keyListeners) {
        keyListeners.delete(callback);
        if (keyListeners.size === 0) {
          this.listeners.delete(key);
        }
      }
    };
  }

  /**
   * Fetch configuration from remote server
   */
  async fetchConfig(): Promise<void> {
    try {
      const now = Date.now();
      
      // Skip if recently fetched
      if (now - this.lastFetch < this.CACHE_DURATION) {
        return;
      }

      // In a real implementation, this would fetch from your config server
      const response = await this.mockRemoteFetch();
      
      if (response.segments) {
        this.segments = response.segments;
        this.saveSegmentsToCache();
      }

      // Resolve configuration based on user context
      const newConfig = this.resolveConfig();
      
      // Track changes
      this.trackConfigChanges(this.config, newConfig);
      
      // Update config
      this.config = newConfig;
      this.lastFetch = now;
      
      // Save to cache
      this.saveToCache();
      
      // Notify listeners
      this.notifyListeners();
      
      console.log('Remote configuration updated successfully');
    } catch (error) {
      console.error('Failed to fetch remote configuration:', error);
      // Continue with cached configuration
    }
  }

  /**
   * Force refresh configuration
   */
  async refresh(): Promise<void> {
    this.lastFetch = 0;
    await this.fetchConfig();
  }

  /**
   * Add configuration segment
   */
  addSegment(segment: ConfigSegment): void {
    const existingIndex = this.segments.findIndex(s => s.id === segment.id);
    if (existingIndex >= 0) {
      this.segments[existingIndex] = segment;
    } else {
      this.segments.push(segment);
    }
    
    // Sort by priority (higher priority first)
    this.segments.sort((a, b) => b.priority - a.priority);
    
    // Re-resolve configuration
    const newConfig = this.resolveConfig();
    this.trackConfigChanges(this.config, newConfig);
    this.config = newConfig;
    
    this.saveSegmentsToCache();
    this.saveToCache();
    this.notifyListeners();
  }

  /**
   * Remove configuration segment
   */
  removeSegment(segmentId: string): void {
    this.segments = this.segments.filter(s => s.id !== segmentId);
    
    // Re-resolve configuration
    const newConfig = this.resolveConfig();
    this.trackConfigChanges(this.config, newConfig);
    this.config = newConfig;
    
    this.saveSegmentsToCache();
    this.saveToCache();
    this.notifyListeners();
  }

  /**
   * Get all segments
   */
  getSegments(): ConfigSegment[] {
    return [...this.segments];
  }

  /**
   * Add configuration template
   */
  addTemplate(template: ConfigTemplate): void {
    const existingIndex = this.templates.findIndex(t => t.id === template.id);
    if (existingIndex >= 0) {
      this.templates[existingIndex] = template;
    } else {
      this.templates.push(template);
    }
  }

  /**
   * Get all templates
   */
  getTemplates(): ConfigTemplate[] {
    return [...this.templates];
  }

  /**
   * Get configuration history
   */
  getHistory(): ConfigHistory[] {
    return [...this.history];
  }

  /**
   * Validate configuration against template
   */
  validateConfig(templateId: string, config: Record<string, any>): {
    valid: boolean;
    errors: string[];
  } {
    const template = this.templates.find(t => t.id === templateId);
    if (!template) {
      return { valid: false, errors: ['Template not found'] };
    }

    const errors: string[] = [];

    // Check required fields
    Object.entries(template.schema).forEach(([key, schema]) => {
      if (schema.required && !(key in config)) {
        errors.push(`Required field '${key}' is missing`);
      }
    });

    // Validate field types and constraints
    Object.entries(config).forEach(([key, value]) => {
      const schema = template.schema[key];
      if (!schema) {
        errors.push(`Unknown field '${key}'`);
        return;
      }

      // Type validation
      if (typeof value !== schema.type) {
        errors.push(`Field '${key}' must be of type ${schema.type}`);
        return;
      }

      // Validation rules
      if (schema.validation) {
        const { min, max, pattern, enum: enumValues } = schema.validation;

        if (typeof value === 'number') {
          if (min !== undefined && value < min) {
            errors.push(`Field '${key}' must be >= ${min}`);
          }
          if (max !== undefined && value > max) {
            errors.push(`Field '${key}' must be <= ${max}`);
          }
        }

        if (typeof value === 'string') {
          if (pattern && !new RegExp(pattern).test(value)) {
            errors.push(`Field '${key}' does not match required pattern`);
          }
        }

        if (enumValues && !enumValues.includes(value)) {
          errors.push(`Field '${key}' must be one of: ${enumValues.join(', ')}`);
        }
      }
    });

    return { valid: errors.length === 0, errors };
  }

  /**
   * Export configuration
   */
  exportConfig(): {
    config: RemoteConfig;
    segments: ConfigSegment[];
    templates: ConfigTemplate[];
    metadata: {
      exportedAt: number;
      userId: string;
      version: string;
    };
  } {
    return {
      config: this.config,
      segments: this.segments,
      templates: this.templates,
      metadata: {
        exportedAt: Date.now(),
        userId: this.userId,
        version: '1.0.0'
      }
    };
  }

  /**
   * Import configuration
   */
  importConfig(data: {
    config?: RemoteConfig;
    segments?: ConfigSegment[];
    templates?: ConfigTemplate[];
  }): void {
    if (data.config) {
      const oldConfig = { ...this.config };
      this.config = data.config;
      this.trackConfigChanges(oldConfig, this.config);
      this.saveToCache();
    }

    if (data.segments) {
      this.segments = data.segments;
      this.saveSegmentsToCache();
    }

    if (data.templates) {
      this.templates = data.templates;
    }

    this.notifyListeners();
  }

  /**
   * Cleanup
   */
  destroy(): void {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
    this.listeners.clear();
  }

  /**
   * Private methods
   */

  private resolveConfig(): RemoteConfig {
    const resolved: RemoteConfig = {};

    // Apply segments in priority order
    for (const segment of this.segments) {
      if (this.matchesSegmentConditions(segment)) {
        Object.assign(resolved, segment.config);
      }
    }

    return resolved;
  }

  private matchesSegmentConditions(segment: ConfigSegment): boolean {
    const { conditions } = segment;

    // Check user ID
    if (conditions.userId && !conditions.userId.includes(this.userId)) {
      return false;
    }

    // Check user type
    if (conditions.userType && this.userContext.userType) {
      if (!conditions.userType.includes(this.userContext.userType)) {
        return false;
      }
    }

    // Check location
    if (conditions.location && this.userContext.location) {
      if (!conditions.location.includes(this.userContext.location)) {
        return false;
      }
    }

    // Check platform
    if (conditions.platform) {
      const platform = navigator.platform.toLowerCase();
      const matchesPlatform = conditions.platform.some(p => 
        platform.includes(p.toLowerCase())
      );
      if (!matchesPlatform) {
        return false;
      }
    }

    // Check version
    if (conditions.version && this.userContext.appVersion) {
      if (!conditions.version.includes(this.userContext.appVersion)) {
        return false;
      }
    }

    // Check custom conditions
    if (conditions.custom) {
      for (const [key, expectedValue] of Object.entries(conditions.custom)) {
        if (this.userContext[key] !== expectedValue) {
          return false;
        }
      }
    }

    return true;
  }

  private trackConfigChanges(oldConfig: RemoteConfig, newConfig: RemoteConfig): void {
    const changes: ConfigHistory['changes'] = [];
    const allKeys = new Set([...Object.keys(oldConfig), ...Object.keys(newConfig)]);

    for (const key of allKeys) {
      const oldValue = oldConfig[key];
      const newValue = newConfig[key];

      if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
        changes.push({
          key,
          oldValue,
          newValue
        });
      }
    }

    if (changes.length > 0) {
      const historyEntry: ConfigHistory = {
        timestamp: Date.now(),
        version: `v${Date.now()}`,
        changes,
        author: this.userId
      };

      this.history.unshift(historyEntry);
      
      // Keep only last 100 entries
      if (this.history.length > 100) {
        this.history = this.history.slice(0, 100);
      }

      this.saveHistoryToCache();
    }
  }

  private notifyListeners(): void {
    for (const [key, callbacks] of this.listeners) {
      const value = this.getValue(key);
      callbacks.forEach(callback => {
        try {
          callback(value);
        } catch (error) {
          console.error(`Error in config listener for key '${key}':`, error);
        }
      });
    }
  }

  private startPeriodicRefresh(): void {
    this.refreshInterval = window.setInterval(() => {
      this.fetchConfig().catch(error => {
        console.error('Periodic config refresh failed:', error);
      });
    }, this.REFRESH_INTERVAL);
  }

  private async mockRemoteFetch(): Promise<{ segments: ConfigSegment[] }> {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 100));

    // Mock configuration segments
    return {
      segments: [
        {
          id: 'default',
          name: 'Default Configuration',
          conditions: {},
          config: {
            'app.theme': 'light',
            'app.language': 'en',
            'features.voiceCommands': true,
            'features.arNavigation': true,
            'features.pushNotifications': true,
            'navigation.defaultZoom': 15,
            'navigation.trafficEnabled': true,
            'social.shareEnabled': true,
            'performance.cacheDuration': 300000,
            'api.timeout': 30000
          },
          priority: 0
        },
        {
          id: 'premium_users',
          name: 'Premium User Configuration',
          conditions: {
            userType: ['premium', 'enterprise']
          },
          config: {
            'features.advancedAnalytics': true,
            'features.customThemes': true,
            'navigation.offlineMaps': true,
            'api.rateLimit': 1000
          },
          priority: 10
        }
      ]
    };
  }

  private setupDefaultTemplates(): void {
    this.templates = [
      {
        id: 'app',
        name: 'Application Settings',
        description: 'Core application configuration',
        schema: {
          theme: {
            type: 'string',
            default: 'light',
            validation: {
              enum: ['light', 'dark', 'auto']
            }
          },
          language: {
            type: 'string',
            default: 'en',
            validation: {
              pattern: '^[a-z]{2}$'
            }
          }
        }
      },
      {
        id: 'features',
        name: 'Feature Flags',
        description: 'Enable/disable application features',
        schema: {
          voiceCommands: { type: 'boolean', default: true },
          arNavigation: { type: 'boolean', default: true },
          pushNotifications: { type: 'boolean', default: true },
          advancedAnalytics: { type: 'boolean', default: false },
          customThemes: { type: 'boolean', default: false }
        }
      },
      {
        id: 'navigation',
        name: 'Navigation Settings',
        description: 'Navigation and map configuration',
        schema: {
          defaultZoom: {
            type: 'number',
            default: 15,
            validation: { min: 1, max: 20 }
          },
          trafficEnabled: { type: 'boolean', default: true },
          offlineMaps: { type: 'boolean', default: false }
        }
      }
    ];
  }

  private loadFromCache(): void {
    try {
      const cached = localStorage.getItem(this.STORAGE_KEY);
      if (cached) {
        this.config = JSON.parse(cached);
      }

      const cachedSegments = localStorage.getItem(this.SEGMENTS_KEY);
      if (cachedSegments) {
        this.segments = JSON.parse(cachedSegments);
      }

      const cachedHistory = localStorage.getItem(this.HISTORY_KEY);
      if (cachedHistory) {
        this.history = JSON.parse(cachedHistory);
      }
    } catch (error) {
      console.error('Failed to load remote config from cache:', error);
    }
  }

  private saveToCache(): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.config));
    } catch (error) {
      console.error('Failed to save remote config to cache:', error);
    }
  }

  private saveSegmentsToCache(): void {
    try {
      localStorage.setItem(this.SEGMENTS_KEY, JSON.stringify(this.segments));
    } catch (error) {
      console.error('Failed to save config segments to cache:', error);
    }
  }

  private saveHistoryToCache(): void {
    try {
      localStorage.setItem(this.HISTORY_KEY, JSON.stringify(this.history));
    } catch (error) {
      console.error('Failed to save config history to cache:', error);
    }
  }
}

// Export singleton instance
export const remoteConfigService = new RemoteConfigurationService();
export default remoteConfigService;