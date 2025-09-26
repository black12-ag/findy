import React, { Suspense, ComponentType } from 'react';
import { logger } from './logger';

// Performance metrics tracking
export interface PerformanceMetrics {
  pageLoadTime: number;
  firstContentfulPaint: number;
  largestContentfulPaint: number;
  cumulativeLayoutShift: number;
  firstInputDelay: number;
  timeToInteractive: number;
  memoryUsage?: number;
  bundleSize?: number;
}

// Lazy loading wrapper with error boundary
export const lazy = <T extends ComponentType<any>>(
  importFunc: () => Promise<{ default: T }>,
  chunkName?: string
) => {
  const LazyComponent = React.lazy(importFunc);
  
  const WrappedComponent: React.FC<any> = (props) => (
    <Suspense 
      fallback={
        <div className="lazy-loading">
          <div className="loading-spinner">
            <div className="spinner"></div>
            <span>Loading...</span>
          </div>
        </div>
      }
    >
      <ErrorBoundary>
        <LazyComponent {...props} />
      </ErrorBoundary>
    </Suspense>
  );

  WrappedComponent.displayName = chunkName || 'LazyComponent';
  return WrappedComponent;
};

// Error Boundary for lazy components
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error?: Error }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    logger.error('Lazy component error:', error, errorInfo);
    // Here you could send error to monitoring service
    if (window.gtag) {
      window.gtag('event', 'exception', {
        description: error.message,
        fatal: false
      });
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-fallback">
          <h3>⚠️ Something went wrong</h3>
          <p>Failed to load component. Please try refreshing the page.</p>
          <button onClick={() => window.location.reload()}>
            Refresh Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

// Performance monitoring class
class PerformanceMonitor {
  private metrics: Partial<PerformanceMetrics> = {};
  private observers: PerformanceObserver[] = [];

  constructor() {
    this.initializeObservers();
    this.measurePageLoad();
  }

  private initializeObservers() {
    // Largest Contentful Paint
    if ('PerformanceObserver' in window) {
      try {
        const lcpObserver = new PerformanceObserver((entryList) => {
          const entries = entryList.getEntries();
          const lastEntry = entries[entries.length - 1];
          this.metrics.largestContentfulPaint = lastEntry.startTime;
        });
        lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
        this.observers.push(lcpObserver);
      } catch (e) {
        logger.warn('LCP observer not supported');
      }

      // First Input Delay
      try {
        const fidObserver = new PerformanceObserver((entryList) => {
          const entries = entryList.getEntries();
          entries.forEach((entry: any) => {
            if (entry.name === 'first-input') {
              this.metrics.firstInputDelay = entry.processingStart - entry.startTime;
            }
          });
        });
        fidObserver.observe({ entryTypes: ['first-input'] });
        this.observers.push(fidObserver);
      } catch (e) {
        logger.warn('FID observer not supported');
      }

      // Cumulative Layout Shift
      try {
        const clsObserver = new PerformanceObserver((entryList) => {
          let clsValue = 0;
          entryList.getEntries().forEach((entry: any) => {
            if (!entry.hadRecentInput) {
              clsValue += entry.value;
            }
          });
          this.metrics.cumulativeLayoutShift = clsValue;
        });
        clsObserver.observe({ entryTypes: ['layout-shift'] });
        this.observers.push(clsObserver);
      } catch (e) {
        logger.warn('CLS observer not supported');
      }
    }
  }

  private measurePageLoad() {
    window.addEventListener('load', () => {
      // Page Load Time
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      if (navigation) {
        this.metrics.pageLoadTime = navigation.loadEventEnd - navigation.fetchStart;
      }

      // First Contentful Paint
      const paintEntries = performance.getEntriesByType('paint');
      const fcpEntry = paintEntries.find(entry => entry.name === 'first-contentful-paint');
      if (fcpEntry) {
        this.metrics.firstContentfulPaint = fcpEntry.startTime;
      }

      // Memory Usage
      if ('memory' in performance) {
        const memInfo = (performance as any).memory;
        this.metrics.memoryUsage = memInfo.usedJSHeapSize;
      }

      setTimeout(() => {
        this.calculateTTI();
        this.reportMetrics();
      }, 1000);
    });
  }

  private calculateTTI() {
    // Simplified TTI calculation
    // In practice, you'd use a more sophisticated algorithm
    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    if (navigation) {
      this.metrics.timeToInteractive = navigation.domInteractive - navigation.fetchStart;
    }
  }

  public getMetrics(): PerformanceMetrics {
    return this.metrics as PerformanceMetrics;
  }

  private reportMetrics() {
    logger.info('[Performance] Core Web Vitals:', this.metrics);
    
    // Send to analytics
    if (window.gtag) {
      window.gtag('event', 'page_performance', {
        page_load_time: this.metrics.pageLoadTime,
        first_contentful_paint: this.metrics.firstContentfulPaint,
        largest_contentful_paint: this.metrics.largestContentfulPaint,
        first_input_delay: this.metrics.firstInputDelay,
        cumulative_layout_shift: this.metrics.cumulativeLayoutShift
      });
    }

    // Check for performance issues
    this.checkPerformanceThresholds();
  }

  private checkPerformanceThresholds() {
    const issues: string[] = [];

    if (this.metrics.firstContentfulPaint && this.metrics.firstContentfulPaint > 2000) {
      issues.push('Slow First Contentful Paint');
    }
    
    if (this.metrics.largestContentfulPaint && this.metrics.largestContentfulPaint > 2500) {
      issues.push('Slow Largest Contentful Paint');
    }
    
    if (this.metrics.firstInputDelay && this.metrics.firstInputDelay > 100) {
      issues.push('High First Input Delay');
    }
    
    if (this.metrics.cumulativeLayoutShift && this.metrics.cumulativeLayoutShift > 0.1) {
      issues.push('High Cumulative Layout Shift');
    }

    if (issues.length > 0) {
      logger.warn('[Performance] Issues detected:', issues);
    }
  }

  public cleanup() {
    this.observers.forEach(observer => observer.disconnect());
    this.observers = [];
  }
}

// Bundle analyzer utility
export const analyzeBundleSize = () => {
  if (import.meta.env?.MODE === 'development') {
    import('webpack-bundle-analyzer').then(({ BundleAnalyzerPlugin }) => {
      // This would be configured in build tools
      logger.info('Bundle analysis available in production build');
    }).catch(() => {
      logger.info('Bundle analyzer not available');
    });
  }
};

// Resource preloading utilities
export const preloadResource = (href: string, as: string, crossorigin?: string) => {
  if (typeof document === 'undefined') return;

  const link = document.createElement('link');
  link.rel = 'preload';
  link.href = href;
  link.as = as;
  if (crossorigin) link.crossOrigin = crossorigin;
  
  document.head.appendChild(link);
};

export const preloadImage = (src: string) => {
  if (typeof document === 'undefined') return;
  
  const link = document.createElement('link');
  link.rel = 'preload';
  link.href = src;
  link.as = 'image';
  
  document.head.appendChild(link);
};

// Critical CSS inlining helper
export const inlineCriticalCSS = (css: string) => {
  if (typeof document === 'undefined') return;

  const style = document.createElement('style');
  style.textContent = css;
  document.head.insertBefore(style, document.head.firstChild);
};

// Image optimization utilities
export const generateSrcSet = (baseUrl: string, sizes: number[]) => {
  return sizes.map(size => `${baseUrl}?w=${size} ${size}w`).join(', ');
};

export const generateSizes = (breakpoints: { [key: string]: string }) => {
  return Object.entries(breakpoints)
    .map(([media, size]) => `${media} ${size}`)
    .join(', ');
};

// Web Worker utilities for heavy computations
export const createWebWorker = (workerFunction: Function) => {
  const workerCode = `
    self.onmessage = function(e) {
      const result = (${workerFunction.toString()})(e.data);
      self.postMessage(result);
    };
  `;
  
  const blob = new Blob([workerCode], { type: 'application/javascript' });
  return new Worker(URL.createObjectURL(blob));
};

// Debounce utility for performance
export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  wait: number,
  immediate = false
): T => {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  
  return ((...args: Parameters<T>) => {
    const later = () => {
      timeout = null;
      if (!immediate) func(...args);
    };
    
    const callNow = immediate && !timeout;
    
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(later, wait);
    
    if (callNow) func(...args);
  }) as T;
};

// Throttle utility for performance
export const throttle = <T extends (...args: any[]) => any>(
  func: T,
  limit: number
): T => {
  let inThrottle = false;
  
  return ((...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  }) as T;
};

// Memory usage monitoring
export const getMemoryUsage = () => {
  if ('memory' in performance) {
    const memory = (performance as any).memory;
    return {
      used: memory.usedJSHeapSize,
      total: memory.totalJSHeapSize,
      limit: memory.jsHeapSizeLimit,
      usagePercentage: Math.round((memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100)
    };
  }
  return null;
};

// Network quality detection
export const getNetworkQuality = () => {
  if ('connection' in navigator) {
    const connection = (navigator as any).connection;
    return {
      effectiveType: connection.effectiveType,
      downlink: connection.downlink,
      rtt: connection.rtt,
      saveData: connection.saveData
    };
  }
  return null;
};

// Adaptive loading based on network
export const shouldLoadHighQuality = () => {
  const network = getNetworkQuality();
  if (!network) return true; // Default to high quality if unknown
  
  // Load high quality on fast connections
  return ['4g', 'slow-2g'].includes(network.effectiveType) === false && 
         !network.saveData;
};

// React performance hooks
export const usePerformanceMetrics = () => {
  const [metrics, setMetrics] = React.useState<Partial<PerformanceMetrics>>({});
  
  React.useEffect(() => {
    const monitor = new PerformanceMonitor();
    
    const updateMetrics = () => {
      setMetrics(monitor.getMetrics());
    };
    
    const interval = setInterval(updateMetrics, 5000);
    
    return () => {
      clearInterval(interval);
      monitor.cleanup();
    };
  }, []);
  
  return metrics;
};

// Intersection Observer for lazy loading
export const useIntersectionObserver = (
  elementRef: React.RefObject<Element>,
  options: IntersectionObserverInit = {}
) => {
  const [isVisible, setIsVisible] = React.useState(false);
  
  React.useEffect(() => {
    const element = elementRef.current;
    if (!element) return;
    
    const observer = new IntersectionObserver(
      ([entry]) => setIsVisible(entry.isIntersecting),
      {
        threshold: 0.1,
        ...options
      }
    );
    
    observer.observe(element);
    
    return () => observer.disconnect();
  }, [elementRef, options]);
  
  return isVisible;
};

// Export performance monitor instance
export const performanceMonitor = new PerformanceMonitor();

// Global performance utilities
declare global {
  interface Window {
    gtag?: (...args: any[]) => void;
  }
}

export default {
  lazy,
  performanceMonitor,
  preloadResource,
  preloadImage,
  inlineCriticalCSS,
  generateSrcSet,
  generateSizes,
  createWebWorker,
  debounce,
  throttle,
  getMemoryUsage,
  getNetworkQuality,
  shouldLoadHighQuality,
  usePerformanceMetrics,
  useIntersectionObserver
};