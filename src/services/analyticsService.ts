/**
 * Analytics Service
 * Handles crash reporting, performance monitoring, and user analytics
 */

export interface AnalyticsEvent {
  name: string;
  category: string;
  properties?: Record<string, any>;
  timestamp: Date;
  userId?: string;
  sessionId: string;
}

export interface CrashReport {
  id: string;
  error: Error;
  stack?: string;
  userAgent: string;
  url: string;
  timestamp: Date;
  userId?: string;
  sessionId: string;
  context?: Record<string, any>;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface PerformanceMetric {
  name: string;
  value: number;
  unit: string;
  timestamp: Date;
  tags?: Record<string, string>;
  context?: Record<string, any>;
  threshold?: {
    warning: number;
    critical: number;
  };
  category: 'core_web_vitals' | 'network' | 'memory' | 'navigation' | 'custom';
}

export interface PerformanceBudget {
  metric: string;
  budget: number;
  unit: string;
  severity: 'info' | 'warning' | 'error';
  description: string;
}

export interface ResourceTiming {
  name: string;
  type: string;
  startTime: number;
  duration: number;
  transferSize: number;
  encodedBodySize: number;
  decodedBodySize: number;
}

export interface WebVitalMetric {
  name: 'FCP' | 'LCP' | 'FID' | 'CLS' | 'TTFB';
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  delta: number;
  id: string;
  timestamp: Date;
}

export interface UserSession {
  id: string;
  userId?: string;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  pageViews: number;
  events: number;
  crashes: number;
  userAgent: string;
  referrer?: string;
}

class AnalyticsService {
  private apiKey: string;
  private baseUrl: string;
  private sessionId: string;
  private userId?: string;
  private session: UserSession;
  private eventQueue: AnalyticsEvent[] = [];
  private crashQueue: CrashReport[] = [];
  private metricsQueue: PerformanceMetric[] = [];
  private webVitalsQueue: WebVitalMetric[] = [];
  private resourceTimings: ResourceTiming[] = [];
  private flushInterval: number = 30000; // 30 seconds
  private maxQueueSize: number = 100;
  private intervalId: NodeJS.Timeout | null = null;
  private isOnline: boolean = navigator.onLine;
  private performanceBudgets: PerformanceBudget[] = [];
  private performanceObservers: PerformanceObserver[] = [];

  constructor() {
    // Browser-compatible environment variable access
    this.apiKey = (typeof window !== 'undefined' && (window as any).__ENV__?.REACT_APP_ANALYTICS_API_KEY) || 'demo-key';
    this.baseUrl = (typeof window !== 'undefined' && (window as any).__ENV__?.REACT_APP_ANALYTICS_API_URL) || 'https://analytics.example.com/v1';
    this.sessionId = this.generateSessionId();
    
    this.session = {
      id: this.sessionId,
      startTime: new Date(),
      pageViews: 0,
      events: 0,
      crashes: 0,
      userAgent: navigator.userAgent,
      referrer: document.referrer
    };

    this.initializeErrorHandling();
    this.initializePerformanceMonitoring();
    this.initializeAdvancedPerformanceMonitoring();
    this.initializeNetworkMonitoring();
    this.initializePerformanceBudgets();
    this.startAutoFlush();

    // Track initial page view
    this.trackPageView();
  }

  /**
   * Track a custom event
   */
  trackEvent(name: string, category: string, properties?: Record<string, any>): void {
    const event: AnalyticsEvent = {
      name,
      category,
      properties,
      timestamp: new Date(),
      userId: this.userId,
      sessionId: this.sessionId
    };

    this.eventQueue.push(event);
    this.session.events++;

    // Flush immediately for critical events
    if (category === 'error' || category === 'crash') {
      this.flush();
    } else if (this.eventQueue.length >= this.maxQueueSize) {
      this.flush();
    }
  }

  /**
   * Track a page view
   */
  trackPageView(page?: string): void {
    this.session.pageViews++;
    
    this.trackEvent('page_view', 'navigation', {
      page: page || window.location.pathname,
      title: document.title,
      referrer: document.referrer,
      timestamp: Date.now()
    });
  }

  /**
   * Track user interaction
   */
  trackUserAction(action: string, element?: string, properties?: Record<string, any>): void {
    this.trackEvent(action, 'user_interaction', {
      element,
      ...properties
    });
  }

  /**
   * Track performance metric
   */
  trackPerformance(name: string, value: number, unit: string = 'ms', tags?: Record<string, string>, category: 'core_web_vitals' | 'network' | 'memory' | 'navigation' | 'custom' = 'custom'): void {
    const metric: PerformanceMetric = {
      name,
      value,
      unit,
      timestamp: new Date(),
      tags,
      category,
      context: {
        sessionId: this.sessionId,
        userId: this.userId
      }
    };

    this.metricsQueue.push(metric);
    this.checkPerformanceBudgets(name, value);

    if (this.metricsQueue.length >= this.maxQueueSize) {
      this.flushMetrics();
    }
  }

  /**
   * Report a crash/error
   */
  reportCrash(error: Error, severity: 'low' | 'medium' | 'high' | 'critical' = 'medium', context?: Record<string, any>): void {
    const crashReport: CrashReport = {
      id: this.generateId(),
      error,
      stack: error.stack,
      userAgent: navigator.userAgent,
      url: window.location.href,
      timestamp: new Date(),
      userId: this.userId,
      sessionId: this.sessionId,
      context,
      severity
    };

    this.crashQueue.push(crashReport);
    this.session.crashes++;

    // Immediately flush critical errors
    if (severity === 'critical' || severity === 'high') {
      this.flushCrashes();
    }

    // Also track as an event
    this.trackEvent('crash_reported', 'error', {
      errorMessage: error.message,
      errorName: error.name,
      severity,
      context
    });
  }

  /**
   * Set user ID for tracking
   */
  setUserId(userId: string): void {
    this.userId = userId;
    this.session.userId = userId;
    
    this.trackEvent('user_identified', 'user', {
      userId
    });
  }

  /**
   * Set user properties
   */
  setUserProperties(properties: Record<string, any>): void {
    this.trackEvent('user_properties_updated', 'user', properties);
  }

  /**
   * Start timing an operation
   */
  startTiming(name: string): () => void {
    const startTime = performance.now();
    
    return () => {
      const duration = performance.now() - startTime;
      this.trackPerformance(`timing.${name}`, duration, 'ms');
    };
  }

  /**
   * Track API call performance
   */
  trackApiCall(endpoint: string, method: string, duration: number, status: number): void {
    this.trackPerformance('api_call', duration, 'ms', {
      endpoint,
      method,
      status: status.toString()
    });

    this.trackEvent('api_call', 'network', {
      endpoint,
      method,
      duration,
      status,
      success: status >= 200 && status < 400
    });
  }

  /**
   * Flush all queued data
   */
  async flush(): Promise<void> {
    if (!this.isOnline) {
      // Queue data for background sync when offline
      await this.queueForBackgroundSync();
      return;
    }

    await Promise.all([
      this.flushEvents(),
      this.flushCrashes(),
      this.flushMetrics(),
      this.flushWebVitals(),
      this.flushSession()
    ]);
  }

  /**
   * Queue analytics data for background sync
   */
  private async queueForBackgroundSync(): Promise<void> {
    if (!('serviceWorker' in navigator)) {
      return;
    }

    try {
      // Register for background sync
      const registration = await navigator.serviceWorker.ready;
      
      if ('sync' in registration) {
        // Queue current analytics data
        const analyticsData = {
          events: [...this.eventQueue],
          crashes: this.crashQueue.map(crash => ({
            ...crash,
            error: {
              name: crash.error.name,
              message: crash.error.message,
              stack: crash.stack
            }
          })),
          metrics: [...this.metricsQueue],
          session: this.session,
          timestamp: Date.now()
        };

        // Store in IndexedDB for service worker access
        await this.storeDataForSync(analyticsData);
        
        // Register background sync
        await registration.sync.register('analytics-sync');
        
        console.debug('Analytics data queued for background sync');
      }
    } catch (error) {
      console.error('Failed to queue analytics for background sync:', error);
    }
  }

  /**
   * Store analytics data for background sync
   */
  private async storeDataForSync(data: any): Promise<void> {
    try {
      // Store in localStorage as fallback
      const existingData = JSON.parse(localStorage.getItem('analytics_sync_queue') || '[]');
      existingData.push(data);
      localStorage.setItem('analytics_sync_queue', JSON.stringify(existingData));

      // Use IndexedDB for better reliability and service worker access
      if ('indexedDB' in window) {
        await this.storeInIndexedDB('analytics_sync_queue', data);
      }
    } catch (error) {
      console.error('Failed to store analytics data for sync:', error);
    }
  }

  /**
   * Store data in IndexedDB for service worker access
   */
  private async storeInIndexedDB(storeName: string, data: any): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('AnalyticsDB', 1);
      
      request.onerror = () => reject(request.error);
      
      request.onsuccess = () => {
        const db = request.result;
        const transaction = db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        
        const addRequest = store.add({ ...data, id: Date.now() });
        addRequest.onsuccess = () => resolve();
        addRequest.onerror = () => reject(addRequest.error);
      };
      
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(storeName)) {
          db.createObjectStore(storeName, { keyPath: 'id' });
        }
      };
    });
  }

  /**
   * Initialize error handling
   */
  private initializeErrorHandling(): void {
    // Handle unhandled errors
    window.addEventListener('error', (event) => {
      this.reportCrash(
        new Error(event.message || 'Unknown error'),
        'high',
        {
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
          type: 'javascript_error'
        }
      );
    });

    // Handle unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      const error = event.reason instanceof Error ? event.reason : new Error(String(event.reason));
      this.reportCrash(error, 'medium', {
        type: 'unhandled_promise_rejection'
      });
    });

    // Handle React error boundaries (if applicable)
    if (typeof window !== 'undefined' && (window as any).__REACT_ERROR_OVERLAY_GLOBAL_HOOK__) {
      const originalHandler = (window as any).__REACT_ERROR_OVERLAY_GLOBAL_HOOK__;
      (window as any).__REACT_ERROR_OVERLAY_GLOBAL_HOOK__ = (...args: any[]) => {
        if (args[0] && args[0].error) {
          this.reportCrash(args[0].error, 'high', {
            type: 'react_error',
            componentStack: args[0].componentStack
          });
        }
        return originalHandler(...args);
      };
    }
  }

  /**
   * Initialize performance monitoring
   */
  private initializePerformanceMonitoring(): void {
    // Track page load performance
    window.addEventListener('load', () => {
      setTimeout(() => {
        const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
        
        if (navigation) {
          this.trackPerformance('page_load_time', navigation.loadEventEnd - navigation.fetchStart);
          this.trackPerformance('dom_content_loaded', navigation.domContentLoadedEventEnd - navigation.fetchStart);
          this.trackPerformance('first_contentful_paint', navigation.responseEnd - navigation.fetchStart);
        }

        // Track resource loading
        const resources = performance.getEntriesByType('resource');
        resources.forEach((resource: PerformanceResourceTiming) => {
          this.trackPerformance('resource_load_time', resource.responseEnd - resource.fetchStart, 'ms', {
            resource_type: resource.initiatorType,
            resource_name: resource.name.split('/').pop() || 'unknown'
          });
        });
      }, 1000);
    });

    // Track Core Web Vitals if available
    if ('web-vitals' in window || typeof window !== 'undefined') {
      // This would typically use the web-vitals library
      // For now, we'll monitor basic metrics
      this.monitorWebVitals();
    }
  }

  /**
   * Monitor Core Web Vitals
   */
  private monitorWebVitals(): void {
    // First Input Delay (FID)
    if ('PerformanceObserver' in window) {
      try {
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.entryType === 'first-input') {
              const fid = (entry as any).processingStart - entry.startTime;
              this.trackWebVital('FID', fid, this.getFIDRating(fid));
            }
          }
        });
        observer.observe({ entryTypes: ['first-input'] });
        this.performanceObservers.push(observer);
      } catch (error) {
        console.debug('PerformanceObserver not supported for first-input');
      }
    }

    // Track layout shifts
    if ('PerformanceObserver' in window) {
      try {
        let clsValue = 0;
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (!(entry as any).hadRecentInput) {
              clsValue += (entry as any).value;
            }
          }
          this.trackWebVital('CLS', clsValue, this.getCLSRating(clsValue));
        });
        observer.observe({ entryTypes: ['layout-shift'] });
        this.performanceObservers.push(observer);
      } catch (error) {
        console.debug('PerformanceObserver not supported for layout-shift');
      }
    }
  }

  /**
   * Initialize Advanced Performance Monitoring
   */
  private initializeAdvancedPerformanceMonitoring(): void {
    this.monitorResourceTimings();
    this.monitorMemoryUsage();
    this.monitorLongTasks();
    this.trackCoreWebVitals();
  }

  /**
   * Initialize Performance Budgets
   */
  private initializePerformanceBudgets(): void {
    this.performanceBudgets = [
      {
        metric: 'LCP',
        budget: 2500, // 2.5 seconds
        unit: 'ms',
        severity: 'warning',
        description: 'Largest Contentful Paint should be under 2.5s'
      },
      {
        metric: 'FID',
        budget: 100, // 100ms
        unit: 'ms',
        severity: 'warning',
        description: 'First Input Delay should be under 100ms'
      },
      {
        metric: 'CLS',
        budget: 0.1, // 0.1 score
        unit: 'score',
        severity: 'warning',
        description: 'Cumulative Layout Shift should be under 0.1'
      },
      {
        metric: 'TTFB',
        budget: 600, // 600ms
        unit: 'ms',
        severity: 'warning',
        description: 'Time to First Byte should be under 600ms'
      },
      {
        metric: 'resource_load_time',
        budget: 2000, // 2 seconds
        unit: 'ms',
        severity: 'info',
        description: 'Resources should load in under 2 seconds'
      },
      {
        metric: 'memory_usage_percent',
        budget: 80, // 80%
        unit: 'percent',
        severity: 'error',
        description: 'Memory usage should stay below 80%'
      },
      {
        metric: 'long_task',
        budget: 100, // 100ms
        unit: 'ms',
        severity: 'info',
        description: 'Main thread should not be blocked for more than 100ms'
      }
    ];
  }

  /**
   * Track Web Vital metric with rating
   */
  private trackWebVital(name: 'FCP' | 'LCP' | 'FID' | 'CLS' | 'TTFB', value: number, rating: 'good' | 'needs-improvement' | 'poor'): void {
    // Create web vital metric
    const webVital: WebVitalMetric = {
      name,
      value,
      rating,
      delta: 0, // Calculate if we had previous value
      id: this.generateId(),
      timestamp: new Date()
    };
    
    this.webVitalsQueue.push(webVital);
    
    // Also track as regular performance metric
    this.trackPerformance(name.toLowerCase(), value, name === 'CLS' ? 'score' : 'ms', {
      rating
    }, 'core_web_vitals');
    
    // Track as event for important metrics
    if (rating === 'poor') {
      this.trackEvent('web_vital_poor', 'performance', {
        metric: name,
        value,
        rating
      });
    }
  }

  /**
   * Check Performance Budgets
   */
  private checkPerformanceBudgets(metricName: string, value: number): void {
    const budget = this.performanceBudgets.find(b => 
      b.metric.toLowerCase() === metricName.toLowerCase());
    
    if (budget && value > budget.budget) {
      // Track as event
      this.trackEvent('performance_budget_exceeded', 'performance', {
        metric: metricName,
        value,
        budget: budget.budget,
        unit: budget.unit,
        severity: budget.severity
      });
      
      // Log it
      if (budget.severity === 'error') {
        console.error(
          `Performance budget exceeded: ${metricName} is ${value}${budget.unit} (budget: ${budget.budget}${budget.unit})`
        );
      } else if (budget.severity === 'warning') {
        console.warn(
          `Performance budget exceeded: ${metricName} is ${value}${budget.unit} (budget: ${budget.budget}${budget.unit})`
        );
      }
    }
  }

  /**
   * Get FCP Rating
   */
  private getFCPRating(fcp: number): 'good' | 'needs-improvement' | 'poor' {
    if (fcp <= 1800) return 'good';
    if (fcp <= 3000) return 'needs-improvement';
    return 'poor';
  }

  /**
   * Get LCP Rating
   */
  private getLCPRating(lcp: number): 'good' | 'needs-improvement' | 'poor' {
    if (lcp <= 2500) return 'good';
    if (lcp <= 4000) return 'needs-improvement';
    return 'poor';
  }

  /**
   * Get FID Rating
   */
  private getFIDRating(fid: number): 'good' | 'needs-improvement' | 'poor' {
    if (fid <= 100) return 'good';
    if (fid <= 300) return 'needs-improvement';
    return 'poor';
  }

  /**
   * Get CLS Rating
   */
  private getCLSRating(cls: number): 'good' | 'needs-improvement' | 'poor' {
    if (cls <= 0.1) return 'good';
    if (cls <= 0.25) return 'needs-improvement';
    return 'poor';
  }

  /**
   * Get TTFB Rating
   */
  private getTTFBRating(ttfb: number): 'good' | 'needs-improvement' | 'poor' {
    if (ttfb <= 600) return 'good';
    if (ttfb <= 1000) return 'needs-improvement';
    return 'poor';
  }
  

  /**
   * Track Core Web Vitals with proper ratings
   */
  private trackCoreWebVitals(): void {
    if ('PerformanceObserver' in window) {
      // Largest Contentful Paint (LCP)
      try {
        const lcpObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const lastEntry = entries[entries.length - 1] as any;
          const lcp = lastEntry.startTime;
          this.trackWebVital('LCP', lcp, this.getLCPRating(lcp));
        });
        lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
        this.performanceObservers.push(lcpObserver);
      } catch (error) {
        console.debug('LCP observation failed:', error);
      }

      // First Contentful Paint (FCP)
      try {
        const fcpObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.name === 'first-contentful-paint') {
              const fcp = entry.startTime;
              this.trackWebVital('FCP', fcp, this.getFCPRating(fcp));
            }
          }
        });
        fcpObserver.observe({ entryTypes: ['paint'] });
        this.performanceObservers.push(fcpObserver);
      } catch (error) {
        console.debug('FCP observation failed:', error);
      }

      // Time to First Byte (TTFB)
      const navigationEntry = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      if (navigationEntry) {
        const ttfb = navigationEntry.responseStart - navigationEntry.fetchStart;
        this.trackWebVital('TTFB', ttfb, this.getTTFBRating(ttfb));
      }
    }
  }

  /**
   * Monitor Resource Loading Performance
   */
  private monitorResourceTimings(): void {
    if ('PerformanceObserver' in window) {
      try {
        const resourceObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            const resource = entry as PerformanceResourceTiming;
            
            const resourceTiming: ResourceTiming = {
              name: resource.name,
              type: resource.initiatorType,
              startTime: resource.startTime,
              duration: resource.responseEnd - resource.fetchStart,
              transferSize: resource.transferSize || 0,
              encodedBodySize: resource.encodedBodySize || 0,
              decodedBodySize: resource.decodedBodySize || 0
            };
            
            this.resourceTimings.push(resourceTiming);
            
            // Track slow resources
            if (resourceTiming.duration > 2000) { // 2 seconds
              this.trackPerformance('slow_resource', resourceTiming.duration, 'ms', {
                resource_name: resourceTiming.name,
                resource_type: resourceTiming.type,
                transfer_size: resourceTiming.transferSize.toString()
              }, 'network');
            }
            
            // Check performance budgets
            this.checkPerformanceBudgets('resource_load_time', resourceTiming.duration);
          }
        });
        
        resourceObserver.observe({ entryTypes: ['resource'] });
        this.performanceObservers.push(resourceObserver);
      } catch (error) {
        console.debug('Resource timing observation failed:', error);
      }
    }
  }

  /**
   * Monitor Memory Usage
   */
  private monitorMemoryUsage(): void {
    // Monitor memory usage every 30 seconds
    setInterval(() => {
      if ('memory' in performance) {
        const memory = (performance as any).memory;
        
        this.trackPerformance('memory_used_js_heap', memory.usedJSHeapSize, 'bytes', {}, 'memory');
        this.trackPerformance('memory_total_js_heap', memory.totalJSHeapSize, 'bytes', {}, 'memory');
        this.trackPerformance('memory_heap_limit', memory.jsHeapSizeLimit, 'bytes', {}, 'memory');
        
        // Check memory usage percentage
        const memoryUsagePercent = (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100;
        this.trackPerformance('memory_usage_percent', memoryUsagePercent, 'percent', {}, 'memory');
        
        // Alert on high memory usage
        if (memoryUsagePercent > 80) {
          this.reportCrash(new Error(`High memory usage: ${memoryUsagePercent.toFixed(2)}%`), 'medium', {
            type: 'memory_warning',
            memoryUsagePercent,
            usedHeapSize: memory.usedJSHeapSize,
            totalHeapSize: memory.totalJSHeapSize
          });
        }
      }
    }, 30000);
  }

  /**
   * Monitor Long Tasks (blocking main thread)
   */
  private monitorLongTasks(): void {
    if ('PerformanceObserver' in window) {
      try {
        const longTaskObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            const task = entry as any;
            
            this.trackPerformance('long_task', task.duration, 'ms', {
              task_name: task.name,
              attribution: task.attribution?.[0]?.name || 'unknown'
            }, 'navigation');
            
            // Report long tasks as potential issues
            if (task.duration > 100) { // Tasks over 100ms
              this.trackEvent('long_task_detected', 'performance', {
                duration: task.duration,
                name: task.name,
                attribution: task.attribution?.[0]?.name
              });
            }
          }
        });
        
        longTaskObserver.observe({ entryTypes: ['longtask'] });
        this.performanceObservers.push(longTaskObserver);
      } catch (error) {
        console.debug('Long task observation failed:', error);
      }
    }
  }

  /**
   * Initialize network monitoring
   */
  private initializeNetworkMonitoring(): void {
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.trackEvent('network_online', 'connectivity');
      // Flush queued data when back online
      this.flush();
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
      this.trackEvent('network_offline', 'connectivity');
    });
  }

  /**
   * Start automatic flushing
   */
  private startAutoFlush(): void {
    this.intervalId = setInterval(() => {
      this.flush();
    }, this.flushInterval);

    // Flush on page unload
    window.addEventListener('beforeunload', () => {
      this.endSession();
      // Use sendBeacon for reliable data sending on unload
      this.sendBeacon();
    });

    // Flush on visibility change (when tab becomes hidden)
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.flush();
      }
    });
  }

  /**
   * Flush events to server
   */
  private async flushEvents(): Promise<void> {
    if (this.eventQueue.length === 0) return;

    const events = [...this.eventQueue];
    this.eventQueue = [];

    try {
      await fetch(`${this.baseUrl}/events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({ events })
      });
    } catch (error) {
      // Re-queue events on failure
      this.eventQueue.unshift(...events);
      console.debug('Failed to flush events:', error);
    }
  }

  /**
   * Flush crash reports to server
   */
  private async flushCrashes(): Promise<void> {
    if (this.crashQueue.length === 0) return;

    const crashes = this.crashQueue.map(crash => ({
      ...crash,
      error: {
        name: crash.error.name,
        message: crash.error.message,
        stack: crash.stack
      }
    }));
    
    this.crashQueue = [];

    try {
      await fetch(`${this.baseUrl}/crashes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({ crashes })
      });
    } catch (error) {
      console.debug('Failed to flush crash reports:', error);
    }
  }

  /**
   * Flush performance metrics to server
   */
  private async flushMetrics(): Promise<void> {
    if (this.metricsQueue.length === 0) return;

    const metrics = [...this.metricsQueue];
    this.metricsQueue = [];

    try {
      await fetch(`${this.baseUrl}/metrics`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({ metrics })
      });
    } catch (error) {
      // Re-queue metrics on failure
      this.metricsQueue.unshift(...metrics);
      console.debug('Failed to flush metrics:', error);
    }
  }

  /**
   * Flush web vitals to server
   */
  private async flushWebVitals(): Promise<void> {
    if (this.webVitalsQueue.length === 0) return;

    const webVitals = [...this.webVitalsQueue];
    this.webVitalsQueue = [];

    try {
      await fetch(`${this.baseUrl}/web-vitals`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({ webVitals })
      });
    } catch (error) {
      // Re-queue web vitals on failure
      this.webVitalsQueue.unshift(...webVitals);
      console.debug('Failed to flush web vitals:', error);
    }
  }

  /**
   * Flush session data to server
   */
  private async flushSession(): Promise<void> {
    try {
      await fetch(`${this.baseUrl}/sessions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({ session: this.session })
      });
    } catch (error) {
      console.debug('Failed to flush session:', error);
    }
  }

  /**
   * Get performance summary
   */
  getPerformanceSummary(): {
    webVitals: WebVitalMetric[];
    resourceTimings: ResourceTiming[];
    budgetViolations: number;
    memoryUsage?: {
      used: number;
      total: number;
      limit: number;
      percentage: number;
    };
  } {
    let memoryUsage;
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      memoryUsage = {
        used: memory.usedJSHeapSize,
        total: memory.totalJSHeapSize,
        limit: memory.jsHeapSizeLimit,
        percentage: (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100
      };
    }

    const budgetViolations = this.eventQueue.filter(e => 
      e.name === 'performance_budget_exceeded').length;

    return {
      webVitals: [...this.webVitalsQueue],
      resourceTimings: [...this.resourceTimings],
      budgetViolations,
      memoryUsage
    };
  }

  /**
   * Get current performance budgets
   */
  getPerformanceBudgets(): PerformanceBudget[] {
    return [...this.performanceBudgets];
  }

  /**
   * Add custom performance budget
   */
  addPerformanceBudget(budget: PerformanceBudget): void {
    this.performanceBudgets.push(budget);
  }

  /**
   * Remove performance budget
   */
  removePerformanceBudget(metric: string): void {
    this.performanceBudgets = this.performanceBudgets.filter(
      b => b.metric !== metric
    );
  }

  /**
   * End current session
   */
  private endSession(): void {
    this.session.endTime = new Date();
    this.session.duration = this.session.endTime.getTime() - this.session.startTime.getTime();
  }

  /**
   * Send beacon for critical data on page unload
   */
  private sendBeacon(): void {
    if (!navigator.sendBeacon) return;

    const criticalData = {
      session: this.session,
      events: this.eventQueue,
      crashes: this.crashQueue.map(crash => ({
        ...crash,
        error: {
          name: crash.error.name,
          message: crash.error.message,
          stack: crash.stack
        }
      }))
    };

    try {
      navigator.sendBeacon(
        `${this.baseUrl}/beacon`,
        JSON.stringify(criticalData)
      );
    } catch (error) {
      console.debug('Failed to send beacon:', error);
    }
  }

  /**
   * Generate a unique session ID
   */
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate a unique ID
   */
  private generateId(): string {
    return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
    
    // Disconnect all performance observers
    this.performanceObservers.forEach(observer => {
      try {
        observer.disconnect();
      } catch (error) {
        console.debug('Error disconnecting performance observer:', error);
      }
    });
    this.performanceObservers = [];
    
    this.endSession();
    this.flush();
  }
}

// Export singleton instance
export const analyticsService = new AnalyticsService();