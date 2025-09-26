/**
 * 🔐 API Key Manager - Secure API key handling for production
 * 
 * Manages API keys, tokens, and credentials securely with encryption and rotation
 */

interface APIKeyConfig {
  key: string;
  encrypted: boolean;
  expires?: number;
  domain?: string;
  rateLimit?: {
    requests: number;
    period: number; // milliseconds
  };
}

interface ServiceCredentials {
  [service: string]: APIKeyConfig;
}

class APIKeyManager {
  private credentials: ServiceCredentials = {};
  private encryptionKey: string | null = null;
  private readonly STORAGE_KEY = 'encrypted_api_keys';

  /**
   * Initialize API key manager with environment variables
   */
  async initialize(): Promise<void> {
    // Load from environment variables
    this.loadFromEnvironment();
    
    // Load encrypted keys from secure storage
    await this.loadFromSecureStorage();
    
    // Set up automatic key rotation
    this.setupKeyRotation();
  }

  /**
   * Load API keys from environment variables
   */
  private loadFromEnvironment(): void {
    const envKeys = {
      'google_maps': import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
      'openroute': import.meta.env.VITE_ORS_API_KEY,
      'mapbox': import.meta.env.VITE_MAPBOX_API_KEY,
      'weather': import.meta.env.VITE_WEATHER_API_KEY,
      'spotify': import.meta.env.VITE_SPOTIFY_CLIENT_ID,
      'apple_music': import.meta.env.VITE_APPLE_MUSIC_TOKEN,
      'google_calendar': import.meta.env.VITE_GOOGLE_CALENDAR_API_KEY,
      'outlook_calendar': import.meta.env.VITE_OUTLOOK_CLIENT_ID,
      'uber': import.meta.env.VITE_UBER_CLIENT_ID,
      'doordash': import.meta.env.VITE_DOORDASH_API_KEY,
      'parkwhiz': import.meta.env.VITE_PARKWHIZ_API_KEY,
      'tesla': import.meta.env.VITE_TESLA_API_TOKEN,
      'chargepoint': import.meta.env.VITE_CHARGEPOINT_API_KEY,
      'push_notification_vapid': import.meta.env.VITE_VAPID_PUBLIC_KEY
    };

    Object.entries(envKeys).forEach(([service, key]) => {
      if (key) {
        this.credentials[service] = {
          key,
          encrypted: false,
          domain: window.location.hostname
        };
      }
    });
  }

  /**
   * Load encrypted keys from secure storage
   */
  private async loadFromSecureStorage(): Promise<void> {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored && this.encryptionKey) {
        const encrypted = JSON.parse(stored);
        const decrypted = await this.decrypt(encrypted);
        Object.assign(this.credentials, decrypted);
      }
    } catch (error) {
      console.error('Failed to load encrypted API keys:', error);
    }
  }

  /**
   * Get API key for a service
   */
  getApiKey(service: string): string | null {
    const config = this.credentials[service];
    if (!config) return null;
    
    // Check if key is expired
    if (config.expires && Date.now() > config.expires) {
      this.removeKey(service);
      return null;
    }

    return config.key;
  }

  /**
   * Set API key for a service
   */
  async setApiKey(service: string, key: string, options: Partial<APIKeyConfig> = {}): Promise<void> {
    this.credentials[service] = {
      key,
      encrypted: options.encrypted || false,
      expires: options.expires,
      domain: options.domain || window.location.hostname,
      rateLimit: options.rateLimit
    };

    if (options.encrypted) {
      await this.saveToSecureStorage();
    }
  }

  /**
   * Remove API key
   */
  removeKey(service: string): void {
    delete this.credentials[service];
  }

  /**
   * Check if service has valid API key
   */
  hasValidKey(service: string): boolean {
    const config = this.credentials[service];
    if (!config) return false;
    
    // Check expiration
    if (config.expires && Date.now() > config.expires) {
      return false;
    }

    return true;
  }

  /**
   * Get all configured services
   */
  getConfiguredServices(): string[] {
    return Object.keys(this.credentials);
  }

  /**
   * Get service status
   */
  getServiceStatus(): { [service: string]: { configured: boolean; expired: boolean } } {
    const status: { [service: string]: { configured: boolean; expired: boolean } } = {};
    
    Object.entries(this.credentials).forEach(([service, config]) => {
      status[service] = {
        configured: true,
        expired: config.expires ? Date.now() > config.expires : false
      };
    });

    return status;
  }

  /**
   * Validate API key format
   */
  validateKeyFormat(service: string, key: string): boolean {
    const patterns: { [service: string]: RegExp } = {
      'google_maps': /^AIza[0-9A-Za-z-_]{35}$/,
      'openroute': /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      'mapbox': /^pk\.[a-zA-Z0-9]{60,}$/,
      'spotify': /^[0-9a-f]{32}$/,
      'uber': /^[A-Za-z0-9_-]{40,}$/
    };

    const pattern = patterns[service];
    return pattern ? pattern.test(key) : true; // Allow unknown formats
  }

  /**
   * Rotate API keys
   */
  private setupKeyRotation(): void {
    setInterval(async () => {
      await this.checkAndRotateKeys();
    }, 24 * 60 * 60 * 1000); // Daily check
  }

  /**
   * Check and rotate expired keys
   */
  private async checkAndRotateKeys(): Promise<void> {
    const now = Date.now();
    const toRotate = Object.entries(this.credentials)
      .filter(([_, config]) => config.expires && (now + 7 * 24 * 60 * 60 * 1000) > config.expires) // 7 days before expiry
      .map(([service, _]) => service);

    for (const service of toRotate) {
      await this.rotateKey(service);
    }
  }

  /**
   * Rotate a specific key
   */
  private async rotateKey(service: string): Promise<void> {
    // This would integrate with service-specific key rotation APIs
    console.log(`Rotating key for service: ${service}`);
    
    // Emit event for UI notification
    window.dispatchEvent(new CustomEvent('keyRotation', { 
      detail: { service, status: 'rotating' }
    }));
  }

  /**
   * Encrypt data
   */
  private async encrypt(data: any): Promise<string> {
    if (!this.encryptionKey) {
      throw new Error('Encryption key not set');
    }
    
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(this.encryptionKey),
      { name: 'AES-GCM' },
      false,
      ['encrypt']
    );

    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      encoder.encode(JSON.stringify(data))
    );

    return btoa(JSON.stringify({
      data: Array.from(new Uint8Array(encrypted)),
      iv: Array.from(iv)
    }));
  }

  /**
   * Decrypt data
   */
  private async decrypt(encryptedData: string): Promise<any> {
    if (!this.encryptionKey) {
      throw new Error('Encryption key not set');
    }

    const { data, iv } = JSON.parse(atob(encryptedData));
    
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(this.encryptionKey),
      { name: 'AES-GCM' },
      false,
      ['decrypt']
    );

    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: new Uint8Array(iv) },
      key,
      new Uint8Array(data)
    );

    return JSON.parse(decoder.decode(decrypted));
  }

  /**
   * Save encrypted keys to storage
   */
  private async saveToSecureStorage(): Promise<void> {
    if (!this.encryptionKey) return;

    try {
      const encrypted = await this.encrypt(this.credentials);
      localStorage.setItem(this.STORAGE_KEY, encrypted);
    } catch (error) {
      console.error('Failed to save encrypted keys:', error);
    }
  }

  /**
   * Set encryption key (should be derived from user input or secure source)
   */
  setEncryptionKey(key: string): void {
    this.encryptionKey = key;
  }
}

export const apiKeyManager = new APIKeyManager();
export default apiKeyManager;