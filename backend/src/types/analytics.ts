// Analytics event types
export interface AnalyticsEvent {
  id: string;
  userId?: string;
  sessionId: string;
  event: string;
  category: 'user' | 'navigation' | 'search' | 'social' | 'system';
  properties: Record<string, any>;
  timestamp: Date;
  ipAddress?: string;
  userAgent?: string;
  deviceType?: string;
  platform?: string;
  appVersion?: string;
}

// User analytics data
export interface UserAnalytics {
  userId: string;
  totalEvents: number;
  eventsByType: Record<string, number>;
  dailyActivity: Array<{
    date: string;
    eventCount: number;
  }>;
  topCategories: Array<{
    category: string;
    count: number;
  }>;
  sessionStats: {
    averageSessionDuration: number;
    totalSessions: number;
    uniqueDays: number;
  };
  devices: Array<{
    deviceType: string;
    count: number;
    lastUsed: Date;
  }>;
}

// System-wide analytics
export interface SystemAnalytics {
  totalUsers: number;
  activeUsers: {
    daily: number;
    weekly: number;
    monthly: number;
  };
  totalEvents: number;
  eventsByType: Record<string, number>;
  topCategories: Array<{
    category: string;
    count: number;
  }>;
  userGrowth: Array<{
    date: string;
    newUsers: number;
    totalUsers: number;
  }>;
  sessionStats: {
    averageDuration: number;
    totalSessions: number;
    bounceRate: number;
  };
  deviceBreakdown: Array<{
    deviceType: string;
    count: number;
    percentage: number;
  }>;
  geographicData: Array<{
    country: string;
    userCount: number;
    eventCount: number;
  }>;
}

// Navigation analytics
export interface NavigationAnalytics {
  totalRoutes: number;
  routesByMode: Record<string, number>;
  averageDistance: number;
  averageDuration: number;
  popularStartPoints: Array<{
    location: string;
    count: number;
    coordinates: [number, number];
  }>;
  popularDestinations: Array<{
    location: string;
    count: number;
    coordinates: [number, number];
  }>;
  routeCompletionRate: number;
  offlineUsage: {
    totalOfflineRoutes: number;
    offlineTime: number;
  };
}

// Search analytics
export interface SearchAnalytics {
  totalSearches: number;
  topSearchTerms: Array<{
    term: string;
    count: number;
  }>;
  searchesByCategory: Record<string, number>;
  averageResultsClicked: number;
  noResultsSearches: number;
  searchToNavigationConversion: number;
}

// Performance metrics
export interface PerformanceMetrics {
  responseTime: {
    average: number;
    p95: number;
    p99: number;
  };
  errorRate: number;
  throughput: number;
  availability: number;
  errorsByType: Record<string, number>;
  slowQueries: Array<{
    query: string;
    averageTime: number;
    count: number;
  }>;
}

// Real-time metrics
export interface RealTimeMetrics {
  activeUsers: number;
  currentSessions: number;
  requestsPerSecond: number;
  errorRate: number;
  averageResponseTime: number;
  queueDepth: number;
  memoryUsage: number;
  cpuUsage: number;
}

// Analytics query parameters
export interface AnalyticsQuery {
  userId?: string;
  startDate?: Date;
  endDate?: Date;
  event?: string;
  category?: string;
  limit?: number;
  offset?: number;
  groupBy?: 'day' | 'week' | 'month' | 'year';
  filters?: Record<string, any>;
}

// Analytics export
export interface AnalyticsExport {
  format: 'json' | 'csv' | 'excel';
  data: any[];
  filename: string;
  generatedAt: Date;
  query: AnalyticsQuery;
}

// Custom event tracking
export interface CustomEvent {
  name: string;
  properties?: Record<string, any>;
  userId?: string;
  sessionId?: string;
  timestamp?: Date;
}

// Funnel analysis
export interface FunnelStep {
  name: string;
  event: string;
  userCount: number;
  conversionRate: number;
  dropoffRate: number;
}

export interface FunnelAnalysis {
  name: string;
  steps: FunnelStep[];
  totalUsers: number;
  overallConversionRate: number;
  timeframe: {
    start: Date;
    end: Date;
  };
}

// Cohort analysis
export interface CohortData {
  cohortDate: string;
  userCount: number;
  retention: Record<string, number>; // period -> retention rate
}

export interface CohortAnalysis {
  cohorts: CohortData[];
  timeframe: {
    start: Date;
    end: Date;
  };
  metric: 'retention' | 'revenue' | 'activity';
}