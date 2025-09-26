// Content Security Policy configuration
export const CSP_CONFIG = {
  defaultSrc: ["'self'"],
  scriptSrc: [
    "'self'", 
    "'unsafe-inline'", // For inline scripts - consider removing in production
    "https://www.googletagmanager.com",
    "https://www.google-analytics.com",
    "https://cdnjs.cloudflare.com"
  ],
  styleSrc: [
    "'self'", 
    "'unsafe-inline'", // For styled-components and CSS-in-JS
    "https://fonts.googleapis.com"
  ],
  imgSrc: [
    "'self'", 
    "data:", 
    "blob:",
    "https:",
    "https://tile.openstreetmap.org",
    "https://api.openrouteservice.org"
  ],
  fontSrc: [
    "'self'",
    "https://fonts.gstatic.com"
  ],
  connectSrc: [
    "'self'",
    "https://api.openrouteservice.org",
    "https://www.google-analytics.com",
    "https://nominatim.openstreetmap.org",
    "wss:",
    "ws:"
  ],
  mediaSrc: ["'self'", "blob:"],
  objectSrc: ["'none'"],
  frameSrc: ["'none'"],
  baseUri: ["'self'"],
  formAction: ["'self'"],
  frameAncestors: ["'none'"],
  upgradeInsecureRequests: []
};

// Generate CSP header string
export const generateCSPHeader = (config = CSP_CONFIG): string => {
  const directives = Object.entries(config)
    .filter(([_, value]) => Array.isArray(value) && value.length > 0)
    .map(([key, value]) => {
      const directive = key.replace(/([A-Z])/g, '-$1').toLowerCase();
      return `${directive} ${(value as string[]).join(' ')}`;
    });

  return directives.join('; ');
};

// API key management and encryption utilities
class APIKeyManager {
  private keys: Map<string, { value: string; encrypted: boolean }> = new Map();
  private encryptionKey: CryptoKey | null = null;

  async initialize(): Promise<void> {
    if (crypto.subtle) {
      this.encryptionKey = await this.generateEncryptionKey();
    }
  }

  private async generateEncryptionKey(): Promise<CryptoKey> {
    return await crypto.subtle.generateKey(
      {
        name: 'AES-GCM',
        length: 256
      },
      false, // not extractable
      ['encrypt', 'decrypt']
    );
  }

  async setApiKey(service: string, key: string, encrypt = true): Promise<void> {
    if (encrypt && this.encryptionKey) {
      const encryptedKey = await this.encryptData(key);
      this.keys.set(service, { value: encryptedKey, encrypted: true });
    } else {
      this.keys.set(service, { value: key, encrypted: false });
    }
  }

  async getApiKey(service: string): Promise<string | null> {
    const keyData = this.keys.get(service);
    if (!keyData) return null;

    if (keyData.encrypted && this.encryptionKey) {
      return await this.decryptData(keyData.value);
    }
    return keyData.value;
  }

  private async encryptData(data: string): Promise<string> {
    if (!this.encryptionKey) throw new Error('Encryption key not available');

    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);
    const iv = crypto.getRandomValues(new Uint8Array(12));

    const encryptedBuffer = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      this.encryptionKey,
      dataBuffer
    );

    // Combine IV and encrypted data
    const combined = new Uint8Array(iv.length + encryptedBuffer.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(encryptedBuffer), iv.length);

    return btoa(String.fromCharCode(...combined));
  }

  private async decryptData(encryptedData: string): Promise<string> {
    if (!this.encryptionKey) throw new Error('Encryption key not available');

    const combined = new Uint8Array(
      atob(encryptedData).split('').map(char => char.charCodeAt(0))
    );

    const iv = combined.slice(0, 12);
    const data = combined.slice(12);

    const decryptedBuffer = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      this.encryptionKey,
      data
    );

    const decoder = new TextDecoder();
    return decoder.decode(decryptedBuffer);
  }

  clearKeys(): void {
    this.keys.clear();
  }
}

// Input sanitization utilities
export const sanitizeInput = {
  html: (input: string): string => {
    const div = document.createElement('div');
    div.textContent = input;
    return div.innerHTML;
  },

  url: (input: string): string => {
    try {
      const url = new URL(input);
      // Only allow certain protocols
      if (!['http:', 'https:'].includes(url.protocol)) {
        throw new Error('Invalid protocol');
      }
      return url.toString();
    } catch {
      return '';
    }
  },

  sql: (input: string): string => {
    // Basic SQL injection prevention
    return input.replace(/['";\\]/g, '');
  },

  xss: (input: string): string => {
    return input
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;');
  }
};

// HTTPS enforcement utilities
export const enforceHTTPS = (): void => {
  if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
    location.replace(`https:${location.href.substring(location.protocol.length)}`);
  }
};

// Secure headers configuration
export const SECURITY_HEADERS = {
  'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'geolocation=(self), camera=(self), microphone=(), payment=()',
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate'
};

// Rate limiting for API calls
class RateLimiter {
  private limits: Map<string, { count: number; resetTime: number }> = new Map();

  checkLimit(key: string, maxRequests: number, windowMs: number): boolean {
    const now = Date.now();
    const limit = this.limits.get(key);

    if (!limit || now > limit.resetTime) {
      this.limits.set(key, { count: 1, resetTime: now + windowMs });
      return true;
    }

    if (limit.count >= maxRequests) {
      return false;
    }

    limit.count++;
    return true;
  }

  getRemainingRequests(key: string, maxRequests: number): number {
    const limit = this.limits.get(key);
    if (!limit) return maxRequests;
    return Math.max(0, maxRequests - limit.count);
  }

  getResetTime(key: string): number | null {
    const limit = this.limits.get(key);
    return limit ? limit.resetTime : null;
  }

  reset(key?: string): void {
    if (key) {
      this.limits.delete(key);
    } else {
      this.limits.clear();
    }
  }
}

// Secure fetch wrapper with rate limiting and validation
export class SecureHTTP {
  private rateLimiter = new RateLimiter();
  private apiKeyManager = new APIKeyManager();

  constructor() {
    this.apiKeyManager.initialize();
  }

  async request(url: string, options: RequestInit & {
    rateLimitKey?: string;
    maxRequests?: number;
    windowMs?: number;
    requiresAuth?: boolean;
    service?: string;
  } = {}): Promise<Response> {
    const {
      rateLimitKey,
      maxRequests = 100,
      windowMs = 60000, // 1 minute
      requiresAuth = false,
      service,
      ...fetchOptions
    } = options;

    // Rate limiting
    if (rateLimitKey && !this.rateLimiter.checkLimit(rateLimitKey, maxRequests, windowMs)) {
      const resetTime = this.rateLimiter.getResetTime(rateLimitKey);
      const waitTime = resetTime ? resetTime - Date.now() : 60000;
      throw new Error(`Rate limit exceeded. Try again in ${Math.ceil(waitTime / 1000)} seconds.`);
    }

    // URL validation
    const sanitizedUrl = sanitizeInput.url(url);
    if (!sanitizedUrl) {
      throw new Error('Invalid URL');
    }

    // Add API key if required
    const headers = new Headers(fetchOptions.headers);
    if (requiresAuth && service) {
      const apiKey = await this.apiKeyManager.getApiKey(service);
      if (apiKey) {
        headers.set('Authorization', `Bearer ${apiKey}`);
      }
    }

    // Add security headers
    headers.set('X-Requested-With', 'XMLHttpRequest');
    
    // CSRF protection for state-changing requests
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(fetchOptions.method?.toUpperCase() || 'GET')) {
      const csrfToken = this.getCSRFToken();
      if (csrfToken) {
        headers.set('X-CSRF-Token', csrfToken);
      }
    }

    const response = await fetch(sanitizedUrl, {
      ...fetchOptions,
      headers,
      credentials: 'same-origin' // Prevent CSRF
    });

    // Validate response
    if (!response.ok) {
      const error = new Error(`HTTP ${response.status}: ${response.statusText}`);
      (error as any).status = response.status;
      throw error;
    }

    return response;
  }

  private getCSRFToken(): string | null {
    // Get CSRF token from meta tag or cookie
    const metaTag = document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement;
    if (metaTag) {
      return metaTag.content;
    }

    // Fallback to cookie
    const match = document.cookie.match(/csrf_token=([^;]+)/);
    return match ? match[1] : null;
  }

  async setApiKey(service: string, key: string): Promise<void> {
    await this.apiKeyManager.setApiKey(service, key);
  }

  getRemainingRequests(key: string, maxRequests = 100): number {
    return this.rateLimiter.getRemainingRequests(key, maxRequests);
  }
}

// Secure local storage wrapper
export class SecureStorage {
  private prefix = 'pathfinder_';

  setItem(key: string, value: any, encrypt = false): void {
    const data = {
      value,
      timestamp: Date.now(),
      encrypted: encrypt
    };

    const serialized = JSON.stringify(data);
    
    if (encrypt) {
      // Simple obfuscation (not true encryption for localStorage)
      const obfuscated = btoa(serialized);
      localStorage.setItem(this.prefix + key, obfuscated);
    } else {
      localStorage.setItem(this.prefix + key, serialized);
    }
  }

  getItem(key: string): any {
    const item = localStorage.getItem(this.prefix + key);
    if (!item) return null;

    try {
      let data;
      try {
        // Try to decode if it's obfuscated
        data = JSON.parse(atob(item));
      } catch {
        // Fallback to regular JSON parse
        data = JSON.parse(item);
      }

      // Check if item has expired (optional TTL)
      if (data.ttl && Date.now() > data.timestamp + data.ttl) {
        this.removeItem(key);
        return null;
      }

      return data.value;
    } catch (error) {
      console.warn('Failed to parse stored data:', error);
      this.removeItem(key);
      return null;
    }
  }

  removeItem(key: string): void {
    localStorage.removeItem(this.prefix + key);
  }

  clear(): void {
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
      if (key.startsWith(this.prefix)) {
        localStorage.removeItem(key);
      }
    });
  }

  // Set item with TTL
  setItemWithTTL(key: string, value: any, ttlMs: number): void {
    const data = {
      value,
      timestamp: Date.now(),
      ttl: ttlMs
    };
    localStorage.setItem(this.prefix + key, JSON.stringify(data));
  }
}

// Permission validation utilities
export const validatePermissions = {
  geolocation: (): Promise<boolean> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve(false);
        return;
      }

      navigator.permissions.query({ name: 'geolocation' as PermissionName })
        .then(result => resolve(result.state === 'granted'))
        .catch(() => resolve(false));
    });
  },

  camera: (): Promise<boolean> => {
    return navigator.permissions.query({ name: 'camera' as PermissionName })
      .then(result => result.state === 'granted')
      .catch(() => false);
  },

  notifications: (): Promise<boolean> => {
    return navigator.permissions.query({ name: 'notifications' as PermissionName })
      .then(result => result.state === 'granted')
      .catch(() => false);
  }
};

// Security audit utilities
export const securityAudit = {
  checkHTTPS: (): boolean => {
    return location.protocol === 'https:' || location.hostname === 'localhost';
  },

  checkCSP: (): boolean => {
    // Check if CSP is properly configured
    const metaTag = document.querySelector('meta[http-equiv="Content-Security-Policy"]') as HTMLMetaElement;
    return metaTag && metaTag.content.length > 0;
  },

  checkMixedContent: (): string[] => {
    const issues: string[] = [];
    
    // Check for mixed content
    document.querySelectorAll('img, script, link').forEach(element => {
      const src = element.getAttribute('src') || element.getAttribute('href');
      if (src && src.startsWith('http:') && location.protocol === 'https:') {
        issues.push(`Mixed content: ${src}`);
      }
    });

    return issues;
  },

  checkSecureHeaders: (): { [key: string]: boolean } => {
    const results: { [key: string]: boolean } = {};
    
    // This would typically be checked server-side
    // Here we can only check what's available in the browser
    Object.keys(SECURITY_HEADERS).forEach(header => {
      results[header] = false; // Would need server-side validation
    });

    return results;
  },

  generateReport: () => {
    return {
      https: securityAudit.checkHTTPS(),
      csp: securityAudit.checkCSP(),
      mixedContent: securityAudit.checkMixedContent(),
      headers: securityAudit.checkSecureHeaders(),
      timestamp: Date.now()
    };
  }
};

// Initialize security features
export const initializeSecurity = () => {
  // Enforce HTTPS in production
  if (process.env.NODE_ENV === 'production') {
    enforceHTTPS();
  }

  // Add CSP meta tag if not present
  if (!document.querySelector('meta[http-equiv="Content-Security-Policy"]')) {
    const meta = document.createElement('meta');
    meta.httpEquiv = 'Content-Security-Policy';
    meta.content = generateCSPHeader();
    document.head.appendChild(meta);
  }

  // Disable right-click in production (optional)
  if (process.env.NODE_ENV === 'production') {
    document.addEventListener('contextmenu', (e) => {
      e.preventDefault();
    });
  }

  // Prevent iframe embedding
  if (window.self !== window.top) {
    window.top!.location = window.self.location;
  }

  console.log('[Security] Security features initialized');
};

// Export instances
export const apiKeyManager = new APIKeyManager();
export const secureHTTP = new SecureHTTP();
export const secureStorage = new SecureStorage();
export const rateLimiter = new RateLimiter();

export default {
  CSP_CONFIG,
  generateCSPHeader,
  APIKeyManager,
  sanitizeInput,
  enforceHTTPS,
  SECURITY_HEADERS,
  SecureHTTP,
  SecureStorage,
  RateLimiter,
  validatePermissions,
  securityAudit,
  initializeSecurity,
  secureHTTP,
  secureStorage,
  rateLimiter
};