/**
 * 📊 API Quota Management System
 * 
 * Tracks API usage, enforces limits, and manages fallback strategies
 * for Google Maps APIs with your specific quotas
 */

import { API_SERVICES, APIServiceType } from '../config/apiConfig';

export interface QuotaStatus {
  endpoint: APIServiceType;
  dailyLimit: number;
  dailyUsed: number;
  dailyRemaining: number;
  minuteLimit: number;
  minuteUsed: number;
  minuteRemaining: number;
  quotaExceeded: boolean;
  resetTime: Date | null;
  lastReset: Date;
}

export interface QuotaUsage {
  timestamp: number;
  endpoint: APIServiceType;
  successful: boolean;
  cached: boolean;
  fallback: boolean;
}

class QuotaManager {
  private usage: Map<APIServiceType, QuotaUsage[]> = new Map();
  private quotaStatus: Map<APIServiceType, QuotaStatus> = new Map();
  private resetIntervals: Map<APIServiceType, NodeJS.Timeout> = new Map();

  constructor() {
    this.initializeQuotas();
    this.startDailyResetTimer();
  }

  /**
   * Initialize quota tracking for all endpoints
   */
  private initializeQuotas(): void {
    Object.entries(API_SERVICES).forEach(([key, config]) => {
      const endpoint = key as APIServiceType;
      
      this.usage.set(endpoint, []);
      this.quotaStatus.set(endpoint, {
        endpoint,
        dailyLimit: config.quota.daily,
        dailyUsed: 0,
        dailyRemaining: config.quota.daily,
        minuteLimit: config.quota.perMinute,
        minuteUsed: 0,
        minuteRemaining: config.quota.perMinute,
        quotaExceeded: false,
        resetTime: this.getNextDayReset(),
        lastReset: new Date()
      });
    });

    // Load saved usage from localStorage
    this.loadSavedUsage();
  }

  /**
   * Check if API call is allowed based on current quotas
   */
  public canMakeRequest(endpoint: APIServiceType): {
    allowed: boolean;
    reason?: string;
    fallbackAvailable: boolean;
    status: QuotaStatus;
  } {
    const status = this.getQuotaStatus(endpoint);
    
    // Check daily limit
    if (status.dailyRemaining <= 0) {
      return {
        allowed: false,
        reason: `Daily quota exceeded (${status.dailyLimit}/${status.dailyLimit})`,
        fallbackAvailable: this.hasFallback(endpoint),
        status
      };
    }

    // Check per-minute limit
    const minuteUsage = this.getMinuteUsage(endpoint);
    if (minuteUsage >= status.minuteLimit) {
      return {
        allowed: false,
        reason: `Per-minute quota exceeded (${minuteUsage}/${status.minuteLimit})`,
        fallbackAvailable: this.hasFallback(endpoint),
        status
      };
    }

    return {
      allowed: true,
      fallbackAvailable: this.hasFallback(endpoint),
      status
    };
  }

  /**
   * Record API usage
   */
  public recordUsage(
    endpoint: APIServiceType, 
    successful: boolean = true, 
    cached: boolean = false,
    fallback: boolean = false
  ): void {
    const now = Date.now();
    const usage: QuotaUsage = {
      timestamp: now,
      endpoint,
      successful,
      cached,
      fallback
    };

    // Add to usage history
    const endpointUsage = this.usage.get(endpoint) || [];
    endpointUsage.push(usage);
    this.usage.set(endpoint, endpointUsage);

    // Update quota status if it was a real API call
    if (successful && !cached && !fallback) {
      this.updateQuotaStatus(endpoint);
    }

    // Clean old usage data (keep only last 24 hours)
    this.cleanOldUsage(endpoint);
    
    // Save to localStorage
    this.saveUsage();
  }

  /**
   * Get current quota status for an endpoint
   */
  public getQuotaStatus(endpoint: APIServiceType): QuotaStatus {
    const status = this.quotaStatus.get(endpoint);
    if (!status) {
      throw new Error(`Quota status not found for endpoint: ${endpoint}`);
    }

    // Update minute usage in real-time
    const minuteUsage = this.getMinuteUsage(endpoint);
    const dailyUsage = this.getDailyUsage(endpoint);

    return {
      ...status,
      dailyUsed: dailyUsage,
      dailyRemaining: Math.max(0, status.dailyLimit - dailyUsage),
      minuteUsed: minuteUsage,
      minuteRemaining: Math.max(0, status.minuteLimit - minuteUsage),
      quotaExceeded: dailyUsage >= status.dailyLimit || minuteUsage >= status.minuteLimit
    };
  }

  /**
   * Get usage statistics for all endpoints
   */
  public getAllQuotaStatus(): Record<APIServiceType, QuotaStatus> {
    const result = {} as Record<APIServiceType, QuotaStatus>;
    
    Object.keys(API_SERVICES).forEach(key => {
      const endpoint = key as APIServiceType;
      result[endpoint] = this.getQuotaStatus(endpoint);
    });

    return result;
  }

  /**
   * Get usage in the last minute
   */
  private getMinuteUsage(endpoint: APIServiceType): number {
    const now = Date.now();
    const oneMinuteAgo = now - (60 * 1000);
    
    const endpointUsage = this.usage.get(endpoint) || [];
    return endpointUsage.filter(
      usage => usage.timestamp > oneMinuteAgo && 
               usage.successful && 
               !usage.cached && 
               !usage.fallback
    ).length;
  }

  /**
   * Get usage in the last 24 hours
   */
  private getDailyUsage(endpoint: APIEndpointType): number {
    const now = Date.now();
    const oneDayAgo = now - (24 * 60 * 60 * 1000);
    
    const endpointUsage = this.usage.get(endpoint) || [];
    return endpointUsage.filter(
      usage => usage.timestamp > oneDayAgo && 
               usage.successful && 
               !usage.cached && 
               !usage.fallback
    ).length;
  }

  /**
   * Update quota status after API call
   */
  private updateQuotaStatus(endpoint: APIEndpointType): void {
    const status = this.quotaStatus.get(endpoint);
    if (!status) return;

    const dailyUsage = this.getDailyUsage(endpoint);
    const minuteUsage = this.getMinuteUsage(endpoint);

    this.quotaStatus.set(endpoint, {
      ...status,
      dailyUsed: dailyUsage,
      dailyRemaining: Math.max(0, status.dailyLimit - dailyUsage),
      minuteUsed: minuteUsage,
      minuteRemaining: Math.max(0, status.minuteLimit - minuteUsage),
      quotaExceeded: dailyUsage >= status.dailyLimit || minuteUsage >= status.minuteLimit
    });
  }

  /**
   * Check if fallback is available for endpoint
   */
  private hasFallback(endpoint: APIEndpointType): boolean {
    return endpoint === 'GEOCODING' || endpoint === 'POIS';
  }

  /**
   * Clean usage data older than 24 hours
   */
  private cleanOldUsage(endpoint: APIEndpointType): void {
    const now = Date.now();
    const oneDayAgo = now - (24 * 60 * 60 * 1000);
    
    const endpointUsage = this.usage.get(endpoint) || [];
    const cleanedUsage = endpointUsage.filter(usage => usage.timestamp > oneDayAgo);
    this.usage.set(endpoint, cleanedUsage);
  }

  /**
   * Get next day reset time (midnight)
   */
  private getNextDayReset(): Date {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    return tomorrow;
  }

  /**
   * Start daily reset timer
   */
  private startDailyResetTimer(): void {
    const now = new Date();
    const tomorrow = this.getNextDayReset();
    const msUntilReset = tomorrow.getTime() - now.getTime();

    setTimeout(() => {
      this.resetDailyQuotas();
      // Set up recurring daily reset
      setInterval(() => this.resetDailyQuotas(), 24 * 60 * 60 * 1000);
    }, msUntilReset);
  }

  /**
   * Reset daily quotas (called at midnight)
   */
  private resetDailyQuotas(): void {
    console.log('🔄 Resetting daily API quotas...');
    
    this.quotaStatus.forEach((status, endpoint) => {
      this.quotaStatus.set(endpoint, {
        ...status,
        dailyUsed: 0,
        dailyRemaining: status.dailyLimit,
        quotaExceeded: false,
        lastReset: new Date(),
        resetTime: this.getNextDayReset()
      });
    });

    // Clear old usage data
    this.usage.clear();
    this.initializeQuotas();
  }

  /**
   * Save usage to localStorage
   */
  private saveUsage(): void {
    try {
      const data = {
        usage: Array.from(this.usage.entries()),
        quotaStatus: Array.from(this.quotaStatus.entries()),
        timestamp: Date.now()
      };
      localStorage.setItem('api_quota_data', JSON.stringify(data));
    } catch (error) {
      console.warn('Failed to save quota data:', error);
    }
  }

  /**
   * Load saved usage from localStorage
   */
  private loadSavedUsage(): void {
    try {
      const saved = localStorage.getItem('api_quota_data');
      if (!saved) return;

      const data = JSON.parse(saved);
      const now = Date.now();
      
      // Only load data from today
      if (now - data.timestamp < 24 * 60 * 60 * 1000) {
        this.usage = new Map(data.usage);
        
        // Update quota status based on loaded usage
        Object.keys(API_ENDPOINTS).forEach(key => {
          const endpoint = key as APIEndpointType;
          this.updateQuotaStatus(endpoint);
        });
      }
    } catch (error) {
      console.warn('Failed to load saved quota data:', error);
    }
  }

  /**
   * Get usage statistics for analytics
   */
  public getUsageStats(): {
    totalRequests: number;
    successfulRequests: number;
    cachedRequests: number;
    fallbackRequests: number;
    endpointBreakdown: Record<APIEndpointType, {
      total: number;
      successful: number;
      cached: number;
      fallback: number;
    }>;
  } {
    let totalRequests = 0;
    let successfulRequests = 0;
    let cachedRequests = 0;
    let fallbackRequests = 0;
    
    const endpointBreakdown = {} as any;

    this.usage.forEach((usageArray, endpoint) => {
      const stats = {
        total: usageArray.length,
        successful: usageArray.filter(u => u.successful && !u.cached && !u.fallback).length,
        cached: usageArray.filter(u => u.cached).length,
        fallback: usageArray.filter(u => u.fallback).length
      };

      endpointBreakdown[endpoint] = stats;
      
      totalRequests += stats.total;
      successfulRequests += stats.successful;
      cachedRequests += stats.cached;
      fallbackRequests += stats.fallback;
    });

    return {
      totalRequests,
      successfulRequests,
      cachedRequests,
      fallbackRequests,
      endpointBreakdown
    };
  }
}

// Singleton instance
export const quotaManager = new QuotaManager();
export default quotaManager;