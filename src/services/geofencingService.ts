/**
 * 📍 Geofencing Service
 * 
 * Provides location-based triggers, boundary management, and enter/exit event detection
 * Integrates with notification system for location-aware alerts
 */

import { logger } from '../utils/logger';
import { geolocationService } from './geolocationService';
import { backgroundLocationService } from './backgroundLocationService';

export interface GeofenceRegion {
  id: string;
  name: string;
  description?: string;
  center: {
    lat: number;
    lng: number;
  };
  radius: number; // in meters for circular geofences
  polygon?: Array<{ lat: number; lng: number }>; // for complex shapes
  type: 'circle' | 'polygon';
  triggers: GeofenceTrigger[];
  isActive: boolean;
  createdAt: number;
  updatedAt: number;
  userId?: string;
  metadata?: Record<string, any>;
}

export interface GeofenceTrigger {
  id: string;
  event: 'enter' | 'exit' | 'dwell' | 'approach';
  action: 'notification' | 'webhook' | 'log' | 'custom';
  dwellTime?: number; // for dwell triggers (minutes)
  approachDistance?: number; // for approach triggers (meters)
  cooldownPeriod?: number; // minimum time between triggers (minutes)
  conditions?: {
    timeOfDay?: { start: string; end: string }; // HH:MM format
    daysOfWeek?: number[]; // 0-6, Sunday = 0
    weather?: string[]; // weather conditions
    speed?: { min?: number; max?: number }; // km/h
    transportMode?: string[];
  };
  payload: {
    title: string;
    message: string;
    priority: 'low' | 'normal' | 'high' | 'critical';
    sound?: string;
    category?: string;
    data?: Record<string, any>;
  };
  webhookUrl?: string;
  customFunction?: string; // function name to call
  lastTriggered?: number;
  triggerCount: number;
  isEnabled: boolean;
}

export interface GeofenceEvent {
  id: string;
  geofenceId: string;
  triggerId: string;
  event: 'enter' | 'exit' | 'dwell' | 'approach';
  timestamp: number;
  location: {
    lat: number;
    lng: number;
    accuracy: number;
    speed?: number;
    heading?: number;
  };
  userId?: string;
  transportMode?: string;
  confidence: number; // 0-1, confidence in the trigger
  processed: boolean;
  result?: {
    success: boolean;
    error?: string;
    responseTime: number;
  };
}

export interface GeofenceStatistics {
  totalGeofences: number;
  activeGeofences: number;
  totalTriggers: number;
  triggersToday: number;
  triggersThisWeek: number;
  mostTriggeredGeofence: {
    id: string;
    name: string;
    triggerCount: number;
  };
  averageResponseTime: number;
  errorRate: number;
}

class GeofencingService {
  private geofences: Map<string, GeofenceRegion> = new Map();
  private events: GeofenceEvent[] = [];
  private watchId: number | null = null;
  private isMonitoring = false;
  private lastKnownLocation: { lat: number; lng: number; timestamp: number } | null = null;
  private readonly CHECK_INTERVAL = 5000; // 5 seconds
  private readonly MAX_EVENTS_STORED = 1000;
  private readonly MIN_ACCURACY_THRESHOLD = 100; // meters
  private checkInterval: number | null = null;

  constructor() {
    this.initializeFromStorage();
    this.setupBackgroundLocationListener();
  }

  /**
   * Initialize geofences from local storage
   */
  private async initializeFromStorage(): Promise<void> {
    try {
      const storedGeofences = localStorage.getItem('geofences');
      if (storedGeofences) {
        const geofencesData = JSON.parse(storedGeofences);
        geofencesData.forEach((geofence: GeofenceRegion) => {
          this.geofences.set(geofence.id, geofence);
        });
      }

      const storedEvents = localStorage.getItem('geofence_events');
      if (storedEvents) {
        this.events = JSON.parse(storedEvents).slice(-this.MAX_EVENTS_STORED);
      }

      logger.info('Geofencing service initialized', {
        geofenceCount: this.geofences.size,
        eventCount: this.events.length
      });
    } catch (error) {
      logger.error('Failed to initialize geofencing from storage:', error);
    }
  }

  /**
   * Setup background location listener
   */
  private setupBackgroundLocationListener(): void {
    backgroundLocationService.addListener((session) => {
      if (session.points && session.points.length > 0) {
        const latestPoint = session.points[session.points.length - 1];
        this.handleLocationUpdate({
          lat: latestPoint.latitude,
          lng: latestPoint.longitude,
          accuracy: latestPoint.accuracy,
          speed: latestPoint.speed,
          heading: latestPoint.heading,
          timestamp: latestPoint.timestamp
        });
      }
    });
  }

  /**
   * Start monitoring geofences
   */
  async startMonitoring(): Promise<boolean> {
    if (this.isMonitoring) {
      return true;
    }

    try {
      // Request location permission
      const hasPermission = await geolocationService.requestPermission();
      if (!hasPermission) {
        logger.warn('Location permission denied, geofencing will be limited');
        // Continue with limited functionality - using background service if available
        this.isMonitoring = true;
        return false; // Return false to indicate limited functionality
      }

      // Start location monitoring
      this.checkInterval = window.setInterval(() => {
        this.checkCurrentLocation();
      }, this.CHECK_INTERVAL);

      // Initial location check - don't fail if this doesn't work
      try {
        await this.checkCurrentLocation();
      } catch (locationError) {
        logger.warn('Initial location check failed, continuing with periodic checks:', locationError);
      }

      this.isMonitoring = true;
      logger.info('Geofence monitoring started');
      return true;
    } catch (error) {
      logger.error('Failed to start geofence monitoring:', error);
      
      // Try to start in limited mode using any available location data
      this.isMonitoring = true;
      logger.info('Started geofencing in limited mode');
      return false;
    }
  }

  /**
   * Stop monitoring geofences
   */
  stopMonitoring(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }

    this.isMonitoring = false;
    logger.info('Geofence monitoring stopped');
  }

  /**
   * Add a new geofence region
   */
  async addGeofence(geofence: Omit<GeofenceRegion, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const geofenceId = `geofence_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const newGeofence: GeofenceRegion = {
      ...geofence,
      id: geofenceId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      triggers: geofence.triggers.map(trigger => ({
        ...trigger,
        id: `trigger_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        triggerCount: 0,
        isEnabled: true
      }))
    };

    this.geofences.set(geofenceId, newGeofence);
    await this.saveToStorage();

    logger.info('Geofence added', { geofenceId, name: geofence.name });
    return geofenceId;
  }

  /**
   * Update an existing geofence
   */
  async updateGeofence(geofenceId: string, updates: Partial<GeofenceRegion>): Promise<boolean> {
    const geofence = this.geofences.get(geofenceId);
    if (!geofence) {
      return false;
    }

    const updatedGeofence = {
      ...geofence,
      ...updates,
      id: geofenceId,
      updatedAt: Date.now()
    };

    this.geofences.set(geofenceId, updatedGeofence);
    await this.saveToStorage();

    logger.info('Geofence updated', { geofenceId });
    return true;
  }

  /**
   * Remove a geofence
   */
  async removeGeofence(geofenceId: string): Promise<boolean> {
    const deleted = this.geofences.delete(geofenceId);
    if (deleted) {
      await this.saveToStorage();
      logger.info('Geofence removed', { geofenceId });
    }
    return deleted;
  }

  /**
   * Get all geofences
   */
  getAllGeofences(): GeofenceRegion[] {
    return Array.from(this.geofences.values());
  }

  /**
   * Get active geofences
   */
  getActiveGeofences(): GeofenceRegion[] {
    return Array.from(this.geofences.values()).filter(g => g.isActive);
  }

  /**
   * Get a specific geofence by ID
   */
  getGeofence(geofenceId: string): GeofenceRegion | null {
    return this.geofences.get(geofenceId) || null;
  }

  /**
   * Check current location against all geofences
   */
  private async checkCurrentLocation(): Promise<void> {
    try {
      const position = await geolocationService.getCurrentPosition({
        enableHighAccuracy: false, // Use less battery intensive mode
        timeout: 8000, // Shorter timeout to fail faster
        maximumAge: 60000 // Allow older cached positions
      });

      if (!position) {
        // Try to use last known location if available
        if (this.lastKnownLocation && Date.now() - this.lastKnownLocation.timestamp < 300000) { // 5 minutes
          logger.debug('Using last known location for geofence check');
          await this.handleLocationUpdate({
            ...this.lastKnownLocation,
            accuracy: 500, // Assume poor accuracy
            timestamp: Date.now()
          });
        }
        return;
      }

      if (position.accuracy > this.MIN_ACCURACY_THRESHOLD) {
        logger.debug('Location accuracy too poor, skipping geofence check', { accuracy: position.accuracy });
        return; // Skip if location is not accurate enough
      }

      await this.handleLocationUpdate({
        lat: position.latitude,
        lng: position.longitude,
        accuracy: position.accuracy,
        speed: position.speed || undefined,
        heading: position.heading || undefined,
        timestamp: Date.now()
      });

    } catch (error) {
      // Try fallback strategies
      if (error.message.includes('timeout') || error.message.includes('unavailable')) {
        // Use last known location if recent enough
        if (this.lastKnownLocation && Date.now() - this.lastKnownLocation.timestamp < 600000) { // 10 minutes
          logger.debug('Location timeout, using last known location');
          await this.handleLocationUpdate({
            ...this.lastKnownLocation,
            accuracy: 1000, // Assume very poor accuracy
            timestamp: Date.now()
          });
        } else {
          logger.debug('Location check failed and no recent location available:', error.message);
        }
      } else {
        logger.debug('Location check failed:', error.message);
      }
    }
  }

  /**
   * Handle location update and check geofences
   */
  private async handleLocationUpdate(location: {
    lat: number;
    lng: number;
    accuracy: number;
    speed?: number;
    heading?: number;
    timestamp: number;
  }): Promise<void> {
    const currentTime = Date.now();
    const activeGeofences = this.getActiveGeofences();

    for (const geofence of activeGeofences) {
      const wasInside = this.wasLocationInsideGeofence(geofence.id);
      const isInside = this.isLocationInsideGeofence(location, geofence);

      // Check for enter/exit events
      if (!wasInside && isInside) {
        await this.triggerGeofenceEvent(geofence, 'enter', location);
      } else if (wasInside && !isInside) {
        await this.triggerGeofenceEvent(geofence, 'exit', location);
      }

      // Check for approach events
      if (!isInside) {
        const distance = this.calculateDistance(location, geofence.center);
        const approachTriggers = geofence.triggers.filter(t => 
          t.event === 'approach' && 
          t.isEnabled &&
          t.approachDistance &&
          distance <= t.approachDistance &&
          this.canTrigger(t, currentTime)
        );

        for (const trigger of approachTriggers) {
          await this.executeGeofenceTrigger(geofence, trigger, 'approach', location);
        }
      }

      // Check for dwell events (if inside and has been for specified time)
      if (isInside) {
        const dwellTriggers = geofence.triggers.filter(t => 
          t.event === 'dwell' && 
          t.isEnabled &&
          t.dwellTime &&
          this.hasDwelledLongEnough(geofence.id, t.dwellTime, currentTime) &&
          this.canTrigger(t, currentTime)
        );

        for (const trigger of dwellTriggers) {
          await this.executeGeofenceTrigger(geofence, trigger, 'dwell', location);
        }
      }
    }

    // Update last known location
    this.lastKnownLocation = {
      lat: location.lat,
      lng: location.lng,
      timestamp: currentTime
    };
  }

  /**
   * Trigger a geofence event
   */
  private async triggerGeofenceEvent(
    geofence: GeofenceRegion,
    event: 'enter' | 'exit' | 'dwell' | 'approach',
    location: { lat: number; lng: number; accuracy: number; speed?: number; heading?: number; timestamp: number }
  ): Promise<void> {
    const currentTime = Date.now();
    const relevantTriggers = geofence.triggers.filter(t => 
      t.event === event && 
      t.isEnabled &&
      this.canTrigger(t, currentTime) &&
      this.meetsConditions(t, location)
    );

    for (const trigger of relevantTriggers) {
      await this.executeGeofenceTrigger(geofence, trigger, event, location);
    }
  }

  /**
   * Execute a geofence trigger
   */
  private async executeGeofenceTrigger(
    geofence: GeofenceRegion,
    trigger: GeofenceTrigger,
    event: 'enter' | 'exit' | 'dwell' | 'approach',
    location: { lat: number; lng: number; accuracy: number; speed?: number; heading?: number; timestamp: number }
  ): Promise<void> {
    const eventId = `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const startTime = Date.now();

    const geofenceEvent: GeofenceEvent = {
      id: eventId,
      geofenceId: geofence.id,
      triggerId: trigger.id,
      event,
      timestamp: location.timestamp,
      location,
      confidence: this.calculateTriggerConfidence(geofence, location),
      processed: false
    };

    try {
      let success = false;
      let error: string | undefined;

      switch (trigger.action) {
        case 'notification':
          success = await this.sendNotification(trigger.payload);
          break;
        case 'webhook':
          success = await this.callWebhook(trigger.webhookUrl!, geofenceEvent);
          break;
        case 'log':
          logger.info('Geofence triggered', { geofence: geofence.name, event, location });
          success = true;
          break;
        case 'custom':
          success = await this.executeCustomFunction(trigger.customFunction!, geofenceEvent);
          break;
        default:
          error = `Unknown trigger action: ${trigger.action}`;
          break;
      }

      geofenceEvent.processed = true;
      geofenceEvent.result = {
        success,
        error,
        responseTime: Date.now() - startTime
      };

      // Update trigger statistics
      trigger.lastTriggered = Date.now();
      trigger.triggerCount++;

      logger.info('Geofence trigger executed', {
        geofenceId: geofence.id,
        geofenceName: geofence.name,
        triggerId: trigger.id,
        event,
        success,
        responseTime: geofenceEvent.result.responseTime
      });

    } catch (executionError) {
      geofenceEvent.processed = true;
      geofenceEvent.result = {
        success: false,
        error: executionError instanceof Error ? executionError.message : 'Unknown error',
        responseTime: Date.now() - startTime
      };

      logger.error('Geofence trigger failed', {
        geofenceId: geofence.id,
        triggerId: trigger.id,
        event,
        error: executionError
      });
    }

    // Store event
    this.events.push(geofenceEvent);
    if (this.events.length > this.MAX_EVENTS_STORED) {
      this.events = this.events.slice(-this.MAX_EVENTS_STORED);
    }

    // Save updated data
    await this.saveToStorage();
  }

  /**
   * Send notification for geofence trigger
   */
  private async sendNotification(payload: GeofenceTrigger['payload']): Promise<boolean> {
    try {
      // Check if notifications are supported
      if (!('Notification' in window)) {
        return false;
      }

      // Request permission if not granted
      if (Notification.permission === 'default') {
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
          return false;
        }
      }

      if (Notification.permission === 'granted') {
        const notification = new Notification(payload.title, {
          body: payload.message,
          icon: '/app-icon.png',
          badge: '/badge-icon.png',
          tag: payload.category || 'geofence',
          requireInteraction: payload.priority === 'critical',
          data: payload.data
        });

        notification.onclick = () => {
          window.focus();
          notification.close();
        };

        return true;
      }

      return false;
    } catch (error) {
      logger.error('Failed to send notification:', error);
      return false;
    }
  }

  /**
   * Call webhook for geofence trigger
   */
  private async callWebhook(webhookUrl: string, event: GeofenceEvent): Promise<boolean> {
    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(event)
      });

      return response.ok;
    } catch (error) {
      logger.error('Webhook call failed:', error);
      return false;
    }
  }

  /**
   * Execute custom function for geofence trigger
   */
  private async executeCustomFunction(functionName: string, event: GeofenceEvent): Promise<boolean> {
    try {
      // In a real implementation, you would have a registry of custom functions
      // For now, just log the function call
      logger.info('Custom function called', { functionName, event });
      return true;
    } catch (error) {
      logger.error('Custom function execution failed:', error);
      return false;
    }
  }

  /**
   * Check if location is inside geofence
   */
  private isLocationInsideGeofence(
    location: { lat: number; lng: number },
    geofence: GeofenceRegion
  ): boolean {
    if (geofence.type === 'circle') {
      const distance = this.calculateDistance(location, geofence.center);
      return distance <= geofence.radius;
    } else if (geofence.type === 'polygon' && geofence.polygon) {
      return this.isPointInPolygon(location, geofence.polygon);
    }
    return false;
  }

  /**
   * Check if location was previously inside geofence
   */
  private wasLocationInsideGeofence(geofenceId: string): boolean {
    if (!this.lastKnownLocation) {
      return false;
    }

    const geofence = this.geofences.get(geofenceId);
    if (!geofence) {
      return false;
    }

    return this.isLocationInsideGeofence(this.lastKnownLocation, geofence);
  }

  /**
   * Check if has dwelled long enough
   */
  private hasDwelledLongEnough(geofenceId: string, dwellTime: number, currentTime: number): boolean {
    // Get recent events for this geofence
    const recentEnterEvents = this.events.filter(e => 
      e.geofenceId === geofenceId && 
      e.event === 'enter' &&
      currentTime - e.timestamp <= dwellTime * 60 * 1000 // convert minutes to milliseconds
    );

    return recentEnterEvents.length > 0;
  }

  /**
   * Check if trigger can fire (considering cooldown)
   */
  private canTrigger(trigger: GeofenceTrigger, currentTime: number): boolean {
    if (!trigger.cooldownPeriod || !trigger.lastTriggered) {
      return true;
    }

    const cooldownMs = trigger.cooldownPeriod * 60 * 1000;
    return currentTime - trigger.lastTriggered > cooldownMs;
  }

  /**
   * Check if conditions are met for trigger
   */
  private meetsConditions(
    trigger: GeofenceTrigger,
    location: { lat: number; lng: number; speed?: number; timestamp: number }
  ): boolean {
    if (!trigger.conditions) {
      return true;
    }

    // Check time of day
    if (trigger.conditions.timeOfDay) {
      const now = new Date();
      const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
      const { start, end } = trigger.conditions.timeOfDay;
      
      if (start <= end) {
        if (currentTime < start || currentTime > end) {
          return false;
        }
      } else {
        // Handles cases like 22:00 to 06:00
        if (currentTime < start && currentTime > end) {
          return false;
        }
      }
    }

    // Check day of week
    if (trigger.conditions.daysOfWeek) {
      const dayOfWeek = new Date().getDay();
      if (!trigger.conditions.daysOfWeek.includes(dayOfWeek)) {
        return false;
      }
    }

    // Check speed
    if (trigger.conditions.speed && location.speed !== undefined) {
      const speedKmh = location.speed * 3.6; // Convert m/s to km/h
      const { min, max } = trigger.conditions.speed;
      
      if (min !== undefined && speedKmh < min) {
        return false;
      }
      if (max !== undefined && speedKmh > max) {
        return false;
      }
    }

    return true;
  }

  /**
   * Calculate trigger confidence
   */
  private calculateTriggerConfidence(
    geofence: GeofenceRegion,
    location: { lat: number; lng: number; accuracy: number }
  ): number {
    // Base confidence on location accuracy relative to geofence size
    const locationAccuracy = location.accuracy;
    const geofenceSize = geofence.type === 'circle' ? geofence.radius : this.calculatePolygonArea(geofence.polygon || []);
    
    // Higher confidence for more accurate locations and larger geofences
    const accuracyScore = Math.max(0, 1 - locationAccuracy / 100);
    const sizeScore = Math.min(1, geofenceSize / 100);
    
    return (accuracyScore * 0.7 + sizeScore * 0.3);
  }

  /**
   * Calculate distance between two points
   */
  private calculateDistance(
    point1: { lat: number; lng: number },
    point2: { lat: number; lng: number }
  ): number {
    const R = 6371000; // Earth's radius in meters
    const φ1 = point1.lat * Math.PI / 180;
    const φ2 = point2.lat * Math.PI / 180;
    const Δφ = (point2.lat - point1.lat) * Math.PI / 180;
    const Δλ = (point2.lng - point1.lng) * Math.PI / 180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c;
  }

  /**
   * Check if point is inside polygon using ray casting algorithm
   */
  private isPointInPolygon(
    point: { lat: number; lng: number },
    polygon: Array<{ lat: number; lng: number }>
  ): boolean {
    let inside = false;
    const x = point.lng;
    const y = point.lat;

    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i].lng;
      const yi = polygon[i].lat;
      const xj = polygon[j].lng;
      const yj = polygon[j].lat;

      if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
        inside = !inside;
      }
    }

    return inside;
  }

  /**
   * Calculate polygon area (simplified)
   */
  private calculatePolygonArea(polygon: Array<{ lat: number; lng: number }>): number {
    if (polygon.length < 3) return 0;
    
    // Simplified area calculation - in reality you'd use proper geodetic calculations
    let area = 0;
    for (let i = 0; i < polygon.length; i++) {
      const j = (i + 1) % polygon.length;
      area += polygon[i].lng * polygon[j].lat;
      area -= polygon[j].lng * polygon[i].lat;
    }
    return Math.abs(area) / 2 * 111320 * 111320; // Rough conversion to square meters
  }

  /**
   * Get geofencing statistics
   */
  getStatistics(): GeofenceStatistics {
    const allGeofences = this.getAllGeofences();
    const activeGeofences = this.getActiveGeofences();
    const totalTriggers = this.events.length;
    
    const now = Date.now();
    const oneDayAgo = now - 24 * 60 * 60 * 1000;
    const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000;
    
    const triggersToday = this.events.filter(e => e.timestamp > oneDayAgo).length;
    const triggersThisWeek = this.events.filter(e => e.timestamp > oneWeekAgo).length;
    
    // Find most triggered geofence
    const triggerCounts: { [key: string]: number } = {};
    allGeofences.forEach(g => {
      triggerCounts[g.id] = g.triggers.reduce((sum, t) => sum + t.triggerCount, 0);
    });
    
    const mostTriggeredId = Object.keys(triggerCounts).reduce((a, b) => 
      triggerCounts[a] > triggerCounts[b] ? a : b, ''
    );
    
    const mostTriggeredGeofence = allGeofences.find(g => g.id === mostTriggeredId);
    
    // Calculate average response time
    const successfulEvents = this.events.filter(e => e.result?.success);
    const averageResponseTime = successfulEvents.length > 0 ? 
      successfulEvents.reduce((sum, e) => sum + (e.result?.responseTime || 0), 0) / successfulEvents.length : 0;
    
    // Calculate error rate
    const processedEvents = this.events.filter(e => e.processed);
    const errorRate = processedEvents.length > 0 ?
      processedEvents.filter(e => !e.result?.success).length / processedEvents.length : 0;

    return {
      totalGeofences: allGeofences.length,
      activeGeofences: activeGeofences.length,
      totalTriggers,
      triggersToday,
      triggersThisWeek,
      mostTriggeredGeofence: {
        id: mostTriggeredId,
        name: mostTriggeredGeofence?.name || 'Unknown',
        triggerCount: triggerCounts[mostTriggeredId] || 0
      },
      averageResponseTime,
      errorRate
    };
  }

  /**
   * Get recent events
   */
  getRecentEvents(limit: number = 50): GeofenceEvent[] {
    return this.events
      .slice(-limit)
      .sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Clear old events
   */
  clearOldEvents(olderThanDays: number = 30): void {
    const cutoff = Date.now() - olderThanDays * 24 * 60 * 60 * 1000;
    this.events = this.events.filter(e => e.timestamp > cutoff);
    this.saveToStorage();
  }

  /**
   * Save data to local storage
   */
  private async saveToStorage(): Promise<void> {
    try {
      localStorage.setItem('geofences', JSON.stringify(Array.from(this.geofences.values())));
      localStorage.setItem('geofence_events', JSON.stringify(this.events));
    } catch (error) {
      logger.error('Failed to save geofencing data to storage:', error);
    }
  }

  /**
   * Export geofencing data
   */
  exportData(): {
    geofences: GeofenceRegion[];
    events: GeofenceEvent[];
    statistics: GeofenceStatistics;
  } {
    return {
      geofences: this.getAllGeofences(),
      events: this.events,
      statistics: this.getStatistics()
    };
  }

  /**
   * Import geofencing data
   */
  async importData(data: {
    geofences: GeofenceRegion[];
    events?: GeofenceEvent[];
  }): Promise<boolean> {
    try {
      // Clear existing data
      this.geofences.clear();
      
      // Import geofences
      data.geofences.forEach(geofence => {
        this.geofences.set(geofence.id, geofence);
      });
      
      // Import events if provided
      if (data.events) {
        this.events = data.events.slice(-this.MAX_EVENTS_STORED);
      }
      
      await this.saveToStorage();
      logger.info('Geofencing data imported successfully');
      return true;
    } catch (error) {
      logger.error('Failed to import geofencing data:', error);
      return false;
    }
  }

  /**
   * Get monitoring status
   */
  getMonitoringStatus(): {
    isMonitoring: boolean;
    lastLocationUpdate: number | null;
    activeGeofenceCount: number;
    locationAccuracy: number | null;
  } {
    return {
      isMonitoring: this.isMonitoring,
      lastLocationUpdate: this.lastKnownLocation?.timestamp || null,
      activeGeofenceCount: this.getActiveGeofences().length,
      locationAccuracy: this.lastKnownLocation ? 50 : null // Simulated accuracy
    };
  }
}

export const geofencingService = new GeofencingService();
export default geofencingService;