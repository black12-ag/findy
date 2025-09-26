/**
 * Feature Flags Service
 * Provides feature flag management, remote configuration, and A/B testing capabilities
 */

export interface FeatureFlag {
  key: string;
  name: string;
  description: string;
  enabled: boolean;
  rolloutPercentage: number; // 0-100
  userTargeting?: {
    includedUsers?: string[];
    excludedUsers?: string[];
    userSegments?: string[];
  };
  conditions?: {
    platform?: string[];
    version?: string[];
    location?: string[];
    customAttributes?: Record<string, any>;
  };
  variants?: {
    [key: string]: {
      weight: number;
      value: any;
    };
  };
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
}

export interface RemoteConfig {
  key: string;
  value: any;
  type: 'string' | 'number' | 'boolean' | 'json';
  description: string;
  lastModified: Date;
  ttl?: number; // Time to live in seconds
}

export interface UserContext {
  userId?: string;
  email?: string;
  platform: string;
  version: string;
  location?: {
    country?: string;
    region?: string;
    city?: string;
  };
  customAttributes?: Record<string, any>;
}

export interface ExperimentVariant {
  name: string;
  weight: number;
  config: Record<string, any>;
}

export interface Experiment {
  id: string;
  name: string;
  description: string;
  hypothesis: string;
  variants: ExperimentVariant[];
  targetingRules: {
    userSegments?: string[];
    trafficAllocation: number; // 0-100
    conditions?: Record<string, any>;
  };
  metrics: {
    primary: string[];
    secondary: string[];
  };
  status: 'draft' | 'running' | 'paused' | 'completed';
  startDate?: Date;
  endDate?: Date;
  results?: {
    participantCount: number;
    conversionRate: Record<string, number>;
    confidence: number;
    winner?: string;
  };
}

class FeatureFlagsService {
  private flags: Map<string, FeatureFlag> = new Map();
  private remoteConfig: Map<string, RemoteConfig> = new Map();
  private experiments: Map<string, Experiment> = new Map();
  private userContext: UserContext;
  private apiEndpoint: string;
  private apiKey: string;
  private cache: {
    flags: string;
    config: string;
    experiments: string;
  };
  private refreshInterval: number = 30000; // 30 seconds
  private intervalId: NodeJS.Timeout | null = null;

  // Event subscribers
  private flagUpdateSubscribers: ((flag: FeatureFlag) => void)[] = [];
  private configUpdateSubscribers: ((config: RemoteConfig) => void)[] = [];
  private experimentUpdateSubscribers: ((experiment: Experiment) => void)[] = [];

  constructor() {
    this.apiEndpoint = (typeof window !== 'undefined' && (window as any).__ENV__?.REACT_APP_FEATURE_FLAGS_API_URL) || 'https://api.example.com/v1';
    this.apiKey = (typeof window !== 'undefined' && (window as any).__ENV__?.REACT_APP_FEATURE_FLAGS_API_KEY) || 'demo-key';
    
    this.cache = {
      flags: 'pathfinder_feature_flags',
      config: 'pathfinder_remote_config',
      experiments: 'pathfinder_experiments'
    };

    this.userContext = this.initializeUserContext();
    
    this.loadFromCache();
    this.startPeriodicRefresh();
  }

  private initializeUserContext(): UserContext {
    return {
      userId: localStorage.getItem('userId') || undefined,
      email: localStorage.getItem('userEmail') || undefined,
      platform: this.getPlatform(),
      version: (typeof window !== 'undefined' && (window as any).__ENV__?.REACT_APP_VERSION) || '1.0.0',
      location: this.getLocationInfo(),
      customAttributes: {}
    };
  }

  private getPlatform(): string {
    const userAgent = navigator.userAgent.toLowerCase();
    if (userAgent.includes('mobile')) return 'mobile';
    if (userAgent.includes('tablet') || userAgent.includes('ipad')) return 'tablet';
    return 'desktop';
  }

  private getLocationInfo() {
    // In a real app, this would come from geolocation or IP-based detection
    return {
      country: 'US',
      region: 'CA',
      city: 'San Francisco'
    };
  }

  /**
   * Initialize with user context
   */
  initialize(userContext: Partial<UserContext>): void {
    this.userContext = { ...this.userContext, ...userContext };
    this.refreshAll();
  }

  /**
   * Check if a feature flag is enabled for the current user
   */
  isFeatureEnabled(flagKey: string): boolean {
    const flag = this.flags.get(flagKey);
    
    if (!flag || !flag.isActive) {
      return false;
    }

    // Check user targeting
    if (!this.isUserTargeted(flag)) {
      return false;
    }

    // Check rollout percentage
    if (flag.rolloutPercentage < 100) {
      const hash = this.hashString(flagKey + (this.userContext.userId || 'anonymous'));
      const bucket = hash % 100;
      if (bucket >= flag.rolloutPercentage) {
        return false;
      }
    }

    return flag.enabled;
  }

  /**
   * Get feature flag variant for A/B testing
   */
  getFeatureVariant(flagKey: string): string | null {
    const flag = this.flags.get(flagKey);
    
    if (!flag || !flag.isActive || !flag.variants) {
      return null;
    }

    if (!this.isFeatureEnabled(flagKey)) {
      return null;
    }

    // Use consistent bucketing based on user and flag
    const hash = this.hashString(flagKey + (this.userContext.userId || 'anonymous'));
    const bucket = hash % 100;

    let cumulativeWeight = 0;
    for (const [variantKey, variant] of Object.entries(flag.variants)) {
      cumulativeWeight += variant.weight;
      if (bucket < cumulativeWeight) {
        return variantKey;
      }
    }

    return null;
  }

  /**
   * Get feature flag variant value
   */
  getFeatureVariantValue(flagKey: string): any {
    const variant = this.getFeatureVariant(flagKey);
    if (!variant) return null;

    const flag = this.flags.get(flagKey);
    return flag?.variants?.[variant]?.value || null;
  }

  /**
   * Get remote configuration value
   */
  getRemoteConfig<T = any>(configKey: string, defaultValue: T): T {
    const config = this.remoteConfig.get(configKey);
    
    if (!config) {
      return defaultValue;
    }

    // Check TTL
    if (config.ttl && config.ttl > 0) {
      const expiryTime = config.lastModified.getTime() + (config.ttl * 1000);
      if (Date.now() > expiryTime) {
        return defaultValue;
      }
    }

    return config.value as T;
  }

  /**
   * Get all active feature flags
   */
  getAllFlags(): FeatureFlag[] {
    return Array.from(this.flags.values()).filter(flag => flag.isActive);
  }

  /**
   * Get all remote config values
   */
  getAllRemoteConfig(): RemoteConfig[] {
    return Array.from(this.remoteConfig.values());
  }

  /**
   * Track experiment participation
   */
  trackExperimentParticipation(experimentId: string, variant: string): void {
    const experiment = this.experiments.get(experimentId);
    if (!experiment || experiment.status !== 'running') {
      return;
    }

    // Track in analytics
    if (typeof window !== 'undefined' && (window as any).analytics) {
      (window as any).analytics.trackEvent('experiment_participation', 'experiments', {
        experimentId,
        experimentName: experiment.name,
        variant,
        userId: this.userContext.userId
      });
    }

    // Store local participation
    const participationKey = `experiment_${experimentId}`;
    localStorage.setItem(participationKey, JSON.stringify({
      variant,
      timestamp: Date.now()
    }));
  }

  /**
   * Get experiment variant for user
   */
  getExperimentVariant(experimentId: string): string | null {
    const experiment = this.experiments.get(experimentId);
    
    if (!experiment || experiment.status !== 'running') {
      return null;
    }

    // Check if user already participated
    const participationKey = `experiment_${experimentId}`;
    const existingParticipation = localStorage.getItem(participationKey);
    if (existingParticipation) {
      try {
        const participation = JSON.parse(existingParticipation);
        return participation.variant;
      } catch (error) {
        console.error('Error parsing experiment participation:', error);
      }
    }

    // Check traffic allocation
    const hash = this.hashString(experimentId + (this.userContext.userId || 'anonymous'));
    const trafficBucket = hash % 100;
    
    if (trafficBucket >= experiment.targetingRules.trafficAllocation) {
      return null;
    }

    // Assign variant based on weights
    const variantBucket = (hash >> 8) % 100;
    let cumulativeWeight = 0;
    
    for (const variant of experiment.variants) {
      cumulativeWeight += variant.weight;
      if (variantBucket < cumulativeWeight) {
        this.trackExperimentParticipation(experimentId, variant.name);
        return variant.name;
      }
    }

    return null;
  }

  /**
   * Get experiment configuration for user's variant
   */
  getExperimentConfig(experimentId: string): Record<string, any> | null {
    const variant = this.getExperimentVariant(experimentId);
    if (!variant) return null;

    const experiment = this.experiments.get(experimentId);
    const variantConfig = experiment?.variants.find(v => v.name === variant);
    
    return variantConfig?.config || null;
  }

  /**
   * Check if user matches targeting rules
   */
  private isUserTargeted(flag: FeatureFlag): boolean {
    if (!flag.userTargeting) return true;

    const { includedUsers, excludedUsers, userSegments } = flag.userTargeting;
    const userId = this.userContext.userId;

    // Check excluded users first
    if (excludedUsers && userId && excludedUsers.includes(userId)) {
      return false;
    }

    // Check included users
    if (includedUsers && includedUsers.length > 0) {
      if (!userId || !includedUsers.includes(userId)) {
        return false;
      }
    }

    // Check user segments (simplified - would normally be more complex)
    if (userSegments && userSegments.length > 0) {
      // This would typically involve more complex segmentation logic
      return true;
    }

    // Check conditions
    if (flag.conditions) {
      if (flag.conditions.platform && 
          !flag.conditions.platform.includes(this.userContext.platform)) {
        return false;
      }

      if (flag.conditions.version && 
          !flag.conditions.version.includes(this.userContext.version)) {
        return false;
      }

      if (flag.conditions.location && this.userContext.location) {
        const locationMatch = flag.conditions.location.some(loc => 
          loc === this.userContext.location?.country ||
          loc === this.userContext.location?.region ||
          loc === this.userContext.location?.city
        );
        if (!locationMatch) {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Simple hash function for consistent bucketing
   */
  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
  }

  /**
   * Load cached data from localStorage
   */
  private loadFromCache(): void {
    try {
      // Load feature flags
      const cachedFlags = localStorage.getItem(this.cache.flags);
      if (cachedFlags) {
        const flagsData = JSON.parse(cachedFlags);
        flagsData.forEach((flag: any) => {
          this.flags.set(flag.key, {
            ...flag,
            createdAt: new Date(flag.createdAt),
            updatedAt: new Date(flag.updatedAt)
          });
        });
      }

      // Load remote config
      const cachedConfig = localStorage.getItem(this.cache.config);
      if (cachedConfig) {
        const configData = JSON.parse(cachedConfig);
        configData.forEach((config: any) => {
          this.remoteConfig.set(config.key, {
            ...config,
            lastModified: new Date(config.lastModified)
          });
        });
      }

      // Load experiments
      const cachedExperiments = localStorage.getItem(this.cache.experiments);
      if (cachedExperiments) {
        const experimentsData = JSON.parse(cachedExperiments);
        experimentsData.forEach((experiment: any) => {
          this.experiments.set(experiment.id, {
            ...experiment,
            startDate: experiment.startDate ? new Date(experiment.startDate) : undefined,
            endDate: experiment.endDate ? new Date(experiment.endDate) : undefined
          });
        });
      }
    } catch (error) {
      console.error('Error loading feature flags from cache:', error);
      this.initializeDefaults();
    }

    // If no cached data, initialize defaults
    if (this.flags.size === 0) {
      this.initializeDefaults();
    }
  }

  /**
   * Initialize default feature flags and config
   */
  private initializeDefaults(): void {
    const defaultFlags: FeatureFlag[] = [
      {
        key: 'enable_ar_navigation',
        name: 'AR Navigation',
        description: 'Enable augmented reality navigation features',
        enabled: true,
        rolloutPercentage: 50,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        key: 'enable_voice_commands',
        name: 'Voice Commands',
        description: 'Enable voice command functionality',
        enabled: true,
        rolloutPercentage: 100,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        key: 'enable_offline_maps',
        name: 'Offline Maps',
        description: 'Enable offline map downloads',
        enabled: true,
        rolloutPercentage: 75,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        key: 'new_ui_design',
        name: 'New UI Design',
        description: 'A/B test for new user interface design',
        enabled: true,
        rolloutPercentage: 50,
        variants: {
          'control': { weight: 50, value: 'original' },
          'treatment': { weight: 50, value: 'new_design' }
        },
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];

    const defaultConfig: RemoteConfig[] = [
      {
        key: 'max_route_waypoints',
        value: 10,
        type: 'number',
        description: 'Maximum number of waypoints allowed in a route',
        lastModified: new Date()
      },
      {
        key: 'api_timeout_ms',
        value: 30000,
        type: 'number',
        description: 'API request timeout in milliseconds',
        lastModified: new Date()
      },
      {
        key: 'enable_crash_reporting',
        value: true,
        type: 'boolean',
        description: 'Enable automatic crash reporting',
        lastModified: new Date()
      },
      {
        key: 'map_tile_cache_size_mb',
        value: 100,
        type: 'number',
        description: 'Map tile cache size in megabytes',
        lastModified: new Date(),
        ttl: 3600 // 1 hour
      }
    ];

    // Store defaults
    defaultFlags.forEach(flag => this.flags.set(flag.key, flag));
    defaultConfig.forEach(config => this.remoteConfig.set(config.key, config));

    this.saveToCache();
  }

  /**
   * Save current data to cache
   */
  private saveToCache(): void {
    try {
      localStorage.setItem(this.cache.flags, JSON.stringify(Array.from(this.flags.values())));
      localStorage.setItem(this.cache.config, JSON.stringify(Array.from(this.remoteConfig.values())));
      localStorage.setItem(this.cache.experiments, JSON.stringify(Array.from(this.experiments.values())));
    } catch (error) {
      console.error('Error saving feature flags to cache:', error);
    }
  }

  /**
   * Refresh all data from remote
   */
  async refreshAll(): Promise<void> {
    try {
      await Promise.all([
        this.fetchFlags(),
        this.fetchRemoteConfig(),
        this.fetchExperiments()
      ]);
    } catch (error) {
      console.error('Error refreshing feature flags:', error);
    }
  }

  /**
   * Fetch feature flags from remote API
   */
  private async fetchFlags(): Promise<void> {
    try {
      const response = await fetch(`${this.apiEndpoint}/flags`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const flags: FeatureFlag[] = await response.json();
        
        flags.forEach(flag => {
          const existingFlag = this.flags.get(flag.key);
          this.flags.set(flag.key, {
            ...flag,
            createdAt: new Date(flag.createdAt),
            updatedAt: new Date(flag.updatedAt)
          });

          // Notify subscribers if flag changed
          if (!existingFlag || existingFlag.updatedAt < new Date(flag.updatedAt)) {
            this.notifyFlagUpdate(flag);
          }
        });

        this.saveToCache();
      }
    } catch (error) {
      console.debug('Failed to fetch remote flags, using cached version:', error);
    }
  }

  /**
   * Fetch remote configuration
   */
  private async fetchRemoteConfig(): Promise<void> {
    try {
      const response = await fetch(`${this.apiEndpoint}/config`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const configs: RemoteConfig[] = await response.json();
        
        configs.forEach(config => {
          const existingConfig = this.remoteConfig.get(config.key);
          this.remoteConfig.set(config.key, {
            ...config,
            lastModified: new Date(config.lastModified)
          });

          // Notify subscribers if config changed
          if (!existingConfig || existingConfig.lastModified < new Date(config.lastModified)) {
            this.notifyConfigUpdate(config);
          }
        });

        this.saveToCache();
      }
    } catch (error) {
      console.debug('Failed to fetch remote config, using cached version:', error);
    }
  }

  /**
   * Fetch experiments
   */
  private async fetchExperiments(): Promise<void> {
    try {
      const response = await fetch(`${this.apiEndpoint}/experiments`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const experiments: Experiment[] = await response.json();
        
        experiments.forEach(experiment => {
          const existingExperiment = this.experiments.get(experiment.id);
          this.experiments.set(experiment.id, {
            ...experiment,
            startDate: experiment.startDate ? new Date(experiment.startDate) : undefined,
            endDate: experiment.endDate ? new Date(experiment.endDate) : undefined
          });

          // Notify subscribers if experiment changed
          if (!existingExperiment) {
            this.notifyExperimentUpdate(experiment);
          }
        });

        this.saveToCache();
      }
    } catch (error) {
      console.debug('Failed to fetch experiments, using cached version:', error);
    }
  }

  /**
   * Start periodic refresh
   */
  private startPeriodicRefresh(): void {
    this.intervalId = setInterval(() => {
      this.refreshAll();
    }, this.refreshInterval);
  }

  /**
   * Subscribe to feature flag updates
   */
  subscribeToFlagUpdates(callback: (flag: FeatureFlag) => void): () => void {
    this.flagUpdateSubscribers.push(callback);
    
    return () => {
      const index = this.flagUpdateSubscribers.indexOf(callback);
      if (index > -1) {
        this.flagUpdateSubscribers.splice(index, 1);
      }
    };
  }

  /**
   * Subscribe to config updates
   */
  subscribeToConfigUpdates(callback: (config: RemoteConfig) => void): () => void {
    this.configUpdateSubscribers.push(callback);
    
    return () => {
      const index = this.configUpdateSubscribers.indexOf(callback);
      if (index > -1) {
        this.configUpdateSubscribers.splice(index, 1);
      }
    };
  }

  /**
   * Subscribe to experiment updates
   */
  subscribeToExperimentUpdates(callback: (experiment: Experiment) => void): () => void {
    this.experimentUpdateSubscribers.push(callback);
    
    return () => {
      const index = this.experimentUpdateSubscribers.indexOf(callback);
      if (index > -1) {
        this.experimentUpdateSubscribers.splice(index, 1);
      }
    };
  }

  private notifyFlagUpdate(flag: FeatureFlag): void {
    this.flagUpdateSubscribers.forEach(callback => {
      try {
        callback(flag);
      } catch (error) {
        console.error('Error in flag update subscriber:', error);
      }
    });
  }

  private notifyConfigUpdate(config: RemoteConfig): void {
    this.configUpdateSubscribers.forEach(callback => {
      try {
        callback(config);
      } catch (error) {
        console.error('Error in config update subscriber:', error);
      }
    });
  }

  private notifyExperimentUpdate(experiment: Experiment): void {
    this.experimentUpdateSubscribers.forEach(callback => {
      try {
        callback(experiment);
      } catch (error) {
        console.error('Error in experiment update subscriber:', error);
      }
    });
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
    
    this.flagUpdateSubscribers = [];
    this.configUpdateSubscribers = [];
    this.experimentUpdateSubscribers = [];
  }
}

// React hook for feature flags
export const useFeatureFlags = () => {
  const [flags, setFlags] = React.useState<FeatureFlag[]>([]);
  const [remoteConfig, setRemoteConfig] = React.useState<RemoteConfig[]>([]);

  React.useEffect(() => {
    setFlags(featureFlagsService.getAllFlags());
    setRemoteConfig(featureFlagsService.getAllRemoteConfig());

    const unsubscribeFlags = featureFlagsService.subscribeToFlagUpdates(() => {
      setFlags(featureFlagsService.getAllFlags());
    });

    const unsubscribeConfig = featureFlagsService.subscribeToConfigUpdates(() => {
      setRemoteConfig(featureFlagsService.getAllRemoteConfig());
    });

    return () => {
      unsubscribeFlags();
      unsubscribeConfig();
    };
  }, []);

  return {
    flags,
    remoteConfig,
    isFeatureEnabled: featureFlagsService.isFeatureEnabled.bind(featureFlagsService),
    getFeatureVariant: featureFlagsService.getFeatureVariant.bind(featureFlagsService),
    getFeatureVariantValue: featureFlagsService.getFeatureVariantValue.bind(featureFlagsService),
    getRemoteConfig: featureFlagsService.getRemoteConfig.bind(featureFlagsService),
    getExperimentVariant: featureFlagsService.getExperimentVariant.bind(featureFlagsService),
    getExperimentConfig: featureFlagsService.getExperimentConfig.bind(featureFlagsService)
  };
};

export const featureFlagsService = new FeatureFlagsService();
export default featureFlagsService;