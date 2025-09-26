import React from 'react';
import { PerformanceMetrics } from '../utils/performance';

// Error tracking interfaces
export interface ErrorReport {
  id: string;
  message: string;
  stack?: string;
  url: string;
  lineNumber?: number;
  columnNumber?: number;
  timestamp: number;
  userAgent: string;
  userId?: string;
  sessionId: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: 'javascript' | 'network' | 'render' | 'security' | 'custom';
  metadata?: Record<string, any>;
  breadcrumbs: Breadcrumb[];
}

export interface Breadcrumb {
  timestamp: number;
  category: 'navigation' | 'user' | 'network' | 'console' | 'custom';
  message: string;
  level: 'info' | 'warning' | 'error';
  data?: Record<string, any>;
}

export interface UserSession {
  id: string;
  userId?: string;
  startTime: number;
  endTime?: number;
  pageViews: PageView[];
  userAgent: string;
  platform: string;
  referrer: string;
  location?: GeolocationCoordinates;
  customProperties?: Record<string, any>;
}

export interface PageView {
  url: string;
  title: string;
  timestamp: number;
  duration?: number;
  exitType?: 'navigation' | 'close' | 'refresh' | 'unload';
}

export interface CustomEvent {
  name: string;
  properties?: Record<string, any>;
  timestamp: number;
  sessionId: string;
  userId?: string;
}

export interface NetworkRequest {
  id: string;
  url: string;
  method: string;
  status: number;
  duration: number;
  size?: number;
  timestamp: number;
  error?: string;
}

// Analytics configuration
interface AnalyticsConfig {
  enabled: boolean;
  endpoint?: string;
  apiKey?: string;
  sampleRate: number;
  enablePerformanceTracking: boolean;
  enableErrorTracking: boolean;
  enableUserTracking: boolean;
  enableNetworkTracking: boolean;
}

class MonitoringService {
  private config: AnalyticsConfig;
  private sessionId: string;
  private userId?: string;
  private breadcrumbs: Breadcrumb[] = [];
  private session: UserSession;
  private networkRequests: NetworkRequest[] = [];
  private maxBreadcrumbs = 50;
  private performanceObserver?: PerformanceObserver;

  constructor(config: Partial<AnalyticsConfig> = {}) {
    this.config = {
      enabled: true,
      sampleRate: 1.0,
      enablePerformanceTracking: true,
      enableErrorTracking: true,
      enableUserTracking: true,
      enableNetworkTracking: true,
      ...config
    };

    this.sessionId = this.generateId();
    this.session = this.initializeSession();
    
    if (this.config.enabled) {
      this.initializeMonitoring();
    }
  }

  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  private initializeSession(): UserSession {
    return {
      id: this.sessionId,
      userId: this.userId,
      startTime: Date.now(),
      pageViews: [],
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      referrer: document.referrer
    };
  }

  private initializeMonitoring(): void {
    // Error tracking
    if (this.config.enableErrorTracking) {
      this.setupErrorTracking();
    }

    // Performance tracking
    if (this.config.enablePerformanceTracking) {
      this.setupPerformanceTracking();
    }

    // User tracking
    if (this.config.enableUserTracking) {
      this.setupUserTracking();
    }

    // Network tracking
    if (this.config.enableNetworkTracking) {
      this.setupNetworkTracking();
    }

    // Page visibility tracking
    this.setupVisibilityTracking();

    console.log('[Monitoring] Initialized with session ID:', this.sessionId);
  }

  private setupErrorTracking(): void {
    // Global error handler
    window.addEventListener('error', (event) => {
      this.reportError({
        message: event.message,
        stack: event.error?.stack,
        url: event.filename,
        lineNumber: event.lineno,
        columnNumber: event.colno,
        severity: 'high',
        category: 'javascript'
      });
    });

    // Unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.reportError({
        message: `Unhandled Promise Rejection: ${event.reason}`,
        stack: event.reason?.stack,
        severity: 'medium',
        category: 'javascript'
      });
    });

    // React error boundary integration would go here
    this.addBreadcrumb({
      category: 'custom',
      message: 'Error tracking initialized',
      level: 'info'
    });
  }

  private setupPerformanceTracking(): void {
    // Core Web Vitals tracking
    if ('PerformanceObserver' in window) {
      this.performanceObserver = new PerformanceObserver((list) => {
        list.getEntries().forEach((entry) => {
          this.trackPerformanceEntry(entry);
        });
      });

      try {
        this.performanceObserver.observe({ 
          entryTypes: ['measure', 'navigation', 'resource', 'paint'] 
        });
      } catch (e) {
        console.warn('[Monitoring] Performance Observer not fully supported');
      }
    }

    // Long task tracking
    if ('PerformanceObserver' in window) {
      try {
        const longTaskObserver = new PerformanceObserver((list) => {
          list.getEntries().forEach((entry) => {
            if (entry.duration > 50) { // Tasks longer than 50ms
              this.addBreadcrumb({
                category: 'custom',
                message: `Long task detected: ${entry.duration}ms`,
                level: 'warning',
                data: { duration: entry.duration, name: entry.name }
              });
            }
          });
        });
        longTaskObserver.observe({ entryTypes: ['longtask'] });
      } catch (e) {
        console.warn('[Monitoring] Long task observer not supported');
      }
    }
  }

  private setupUserTracking(): void {
    // Page view tracking
    this.trackPageView(window.location.pathname, document.title);

    // URL change tracking (for SPA)
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;

    history.pushState = (...args) => {
      originalPushState.apply(history, args);
      setTimeout(() => {
        this.trackPageView(window.location.pathname, document.title);
      }, 0);
    };

    history.replaceState = (...args) => {
      originalReplaceState.apply(history, args);
      setTimeout(() => {
        this.trackPageView(window.location.pathname, document.title);
      }, 0);
    };

    // User interaction tracking
    document.addEventListener('click', (event) => {
      const target = event.target as HTMLElement;
      if (target.tagName === 'BUTTON' || target.tagName === 'A') {
        this.addBreadcrumb({
          category: 'user',
          message: `Clicked ${target.tagName}: ${target.textContent?.slice(0, 50)}`,
          level: 'info',
          data: {
            element: target.tagName,
            text: target.textContent?.slice(0, 50),
            className: target.className
          }
        });
      }
    });
  }

  private setupNetworkTracking(): void {
    // Fetch API monitoring
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      const startTime = Date.now();
      const url = typeof args[0] === 'string' ? args[0] : args[0].url;
      const method = args[1]?.method || 'GET';

      try {
        const response = await originalFetch(...args);
        const duration = Date.now() - startTime;
        
        this.trackNetworkRequest({
          url,
          method,
          status: response.status,
          duration,
          timestamp: startTime
        });

        return response;
      } catch (error) {
        const duration = Date.now() - startTime;
        this.trackNetworkRequest({
          url,
          method,
          status: 0,
          duration,
          timestamp: startTime,
          error: error instanceof Error ? error.message : 'Network error'
        });
        throw error;
      }
    };

    // XMLHttpRequest monitoring
    const originalXHROpen = XMLHttpRequest.prototype.open;
    const originalXHRSend = XMLHttpRequest.prototype.send;

    XMLHttpRequest.prototype.open = function(method, url, ...args) {
      (this as any)._monitoringData = { method, url, startTime: Date.now() };
      return originalXHROpen.call(this, method, url, ...args);
    };

    XMLHttpRequest.prototype.send = function(...args) {
      const monitoringData = (this as any)._monitoringData;
      if (monitoringData) {
        this.addEventListener('loadend', () => {
          const duration = Date.now() - monitoringData.startTime;
          monitoringService.trackNetworkRequest({
            url: monitoringData.url,
            method: monitoringData.method,
            status: this.status,
            duration,
            timestamp: monitoringData.startTime,
            error: this.status === 0 ? 'Request failed' : undefined
          });
        });
      }
      return originalXHRSend.call(this, ...args);
    };
  }

  private setupVisibilityTracking(): void {
    document.addEventListener('visibilitychange', () => {
      this.addBreadcrumb({
        category: 'custom',
        message: `Page visibility changed: ${document.hidden ? 'hidden' : 'visible'}`,
        level: 'info'
      });
    });

    // Session end tracking
    window.addEventListener('beforeunload', () => {
      this.endSession();
    });
  }

  public reportError(errorData: Partial<ErrorReport>): void {
    if (!this.shouldSample()) return;

    const error: ErrorReport = {
      id: this.generateId(),
      message: errorData.message || 'Unknown error',
      stack: errorData.stack,
      url: errorData.url || window.location.href,
      lineNumber: errorData.lineNumber,
      columnNumber: errorData.columnNumber,
      timestamp: Date.now(),
      userAgent: navigator.userAgent,
      userId: this.userId,
      sessionId: this.sessionId,
      severity: errorData.severity || 'medium',
      category: errorData.category || 'javascript',
      metadata: errorData.metadata,
      breadcrumbs: [...this.breadcrumbs]
    };

    this.addBreadcrumb({
      category: 'custom',
      message: `Error reported: ${error.message}`,
      level: 'error'
    });

    this.sendToEndpoint('errors', error);
    console.error('[Monitoring] Error reported:', error);
  }

  public trackEvent(name: string, properties?: Record<string, any>): void {
    if (!this.shouldSample()) return;

    const event: CustomEvent = {
      name,
      properties,
      timestamp: Date.now(),
      sessionId: this.sessionId,
      userId: this.userId
    };

    this.addBreadcrumb({
      category: 'custom',
      message: `Event tracked: ${name}`,
      level: 'info',
      data: properties
    });

    this.sendToEndpoint('events', event);
  }

  public trackPerformanceMetrics(metrics: PerformanceMetrics): void {
    if (!this.shouldSample()) return;

    const performanceData = {
      ...metrics,
      sessionId: this.sessionId,
      userId: this.userId,
      timestamp: Date.now(),
      url: window.location.href
    };

    this.sendToEndpoint('performance', performanceData);
  }

  private trackPageView(url: string, title: string): void {
    const pageView: PageView = {
      url,
      title,
      timestamp: Date.now()
    };

    this.session.pageViews.push(pageView);

    this.addBreadcrumb({
      category: 'navigation',
      message: `Page view: ${url}`,
      level: 'info',
      data: { title }
    });

    this.trackEvent('page_view', { url, title });
  }

  private trackNetworkRequest(requestData: Omit<NetworkRequest, 'id'>): void {
    const request: NetworkRequest = {
      id: this.generateId(),
      ...requestData
    };

    this.networkRequests.push(request);

    // Keep only last 100 requests
    if (this.networkRequests.length > 100) {
      this.networkRequests = this.networkRequests.slice(-100);
    }

    // Track slow requests
    if (request.duration > 3000) {
      this.addBreadcrumb({
        category: 'network',
        message: `Slow request: ${request.url} (${request.duration}ms)`,
        level: 'warning',
        data: request
      });
    }

    // Track failed requests
    if (request.status >= 400 || request.error) {
      this.addBreadcrumb({
        category: 'network',
        message: `Failed request: ${request.url} (${request.status})`,
        level: 'error',
        data: request
      });
    }
  }

  private trackPerformanceEntry(entry: PerformanceEntry): void {
    // Track specific performance metrics
    if (entry.name === 'first-contentful-paint') {
      this.trackEvent('performance_metric', {
        metric: 'first-contentful-paint',
        value: entry.startTime
      });
    }

    if (entry.entryType === 'resource' && entry.duration > 1000) {
      this.addBreadcrumb({
        category: 'custom',
        message: `Slow resource load: ${entry.name} (${entry.duration}ms)`,
        level: 'warning',
        data: { duration: entry.duration, name: entry.name }
      });
    }
  }

  public addBreadcrumb(breadcrumb: Omit<Breadcrumb, 'timestamp'>): void {
    this.breadcrumbs.push({
      timestamp: Date.now(),
      ...breadcrumb
    });

    // Keep only the most recent breadcrumbs
    if (this.breadcrumbs.length > this.maxBreadcrumbs) {
      this.breadcrumbs = this.breadcrumbs.slice(-this.maxBreadcrumbs);
    }
  }

  public setUserId(userId: string): void {
    this.userId = userId;
    this.session.userId = userId;
    
    this.addBreadcrumb({
      category: 'custom',
      message: `User ID set: ${userId}`,
      level: 'info'
    });
  }

  public setCustomProperty(key: string, value: any): void {
    if (!this.session.customProperties) {
      this.session.customProperties = {};
    }
    this.session.customProperties[key] = value;
  }

  private endSession(): void {
    this.session.endTime = Date.now();
    this.sendToEndpoint('sessions', this.session);
  }

  private shouldSample(): boolean {
    return Math.random() < this.config.sampleRate;
  }

  private async sendToEndpoint(endpoint: string, data: any): Promise<void> {
    if (!this.config.enabled || !this.config.endpoint) {
      return;
    }

    try {
      await fetch(`${this.config.endpoint}/${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.config.apiKey && { 'Authorization': `Bearer ${this.config.apiKey}` })
        },
        body: JSON.stringify(data)
      });
    } catch (error) {
      console.warn('[Monitoring] Failed to send data to endpoint:', error);
    }
  }

  public getSessionData(): UserSession {
    return this.session;
  }

  public getBreadcrumbs(): Breadcrumb[] {
    return this.breadcrumbs;
  }

  public getNetworkRequests(): NetworkRequest[] {
    return this.networkRequests;
  }

  public updateConfig(newConfig: Partial<AnalyticsConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  public cleanup(): void {
    if (this.performanceObserver) {
      this.performanceObserver.disconnect();
    }
    this.endSession();
  }
}

// React hooks for monitoring
export const useErrorTracking = () => {
  const reportError = React.useCallback((error: Error | string, severity: ErrorReport['severity'] = 'medium') => {
    const errorData = typeof error === 'string' 
      ? { message: error } 
      : { message: error.message, stack: error.stack };

    monitoringService.reportError({
      ...errorData,
      severity,
      category: 'custom'
    });
  }, []);

  return { reportError };
};

export const useAnalytics = () => {
  const trackEvent = React.useCallback((name: string, properties?: Record<string, any>) => {
    monitoringService.trackEvent(name, properties);
  }, []);

  const setUserId = React.useCallback((userId: string) => {
    monitoringService.setUserId(userId);
  }, []);

  const setCustomProperty = React.useCallback((key: string, value: any) => {
    monitoringService.setCustomProperty(key, value);
  }, []);

  return {
    trackEvent,
    setUserId,
    setCustomProperty
  };
};

export const usePerformanceTracking = () => {
  const [metrics, setMetrics] = React.useState<Partial<PerformanceMetrics>>({});

  React.useEffect(() => {
    const updateMetrics = () => {
      // This would integrate with the performance monitor
      const performanceMetrics = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      if (performanceMetrics) {
        const newMetrics = {
          pageLoadTime: performanceMetrics.loadEventEnd - performanceMetrics.fetchStart,
          // Add other metrics...
        };
        setMetrics(newMetrics);
        monitoringService.trackPerformanceMetrics(newMetrics as PerformanceMetrics);
      }
    };

    window.addEventListener('load', updateMetrics);
    return () => window.removeEventListener('load', updateMetrics);
  }, []);

  return metrics;
};

// Enhanced error boundary with monitoring
export const MonitoringErrorBoundary: React.FC<{
  children: React.ReactNode;
  fallback?: React.ComponentType<{ error: Error; resetError: () => void }>;
}> = ({ children, fallback: Fallback }) => {
  const [error, setError] = React.useState<Error | null>(null);

  React.useEffect(() => {
    if (error) {
      monitoringService.reportError({
        message: error.message,
        stack: error.stack,
        severity: 'critical',
        category: 'javascript',
        metadata: { component: 'ErrorBoundary' }
      });
    }
  }, [error]);

  const resetError = React.useCallback(() => {
    setError(null);
  }, []);

  if (error) {
    if (Fallback) {
      return <Fallback error={error} resetError={resetError} />;
    }
    return (
      <div className="error-boundary">
        <h2>Something went wrong</h2>
        <button onClick={resetError}>Try again</button>
      </div>
    );
  }

  return (
    <React.Fragment>
      {children}
    </React.Fragment>
  );
};

// Create monitoring service instance
export const monitoringService = new MonitoringService({
  endpoint: process.env.REACT_APP_MONITORING_ENDPOINT,
  apiKey: process.env.REACT_APP_MONITORING_API_KEY,
  sampleRate: parseFloat(process.env.REACT_APP_MONITORING_SAMPLE_RATE || '1.0')
});

export default monitoringService;