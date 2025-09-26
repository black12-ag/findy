import React from 'react';
import { geolocationService } from './geolocationService';
import { storageService } from './storageService';

export interface LocationPoint {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
  altitude?: number;
  heading?: number;
  speed?: number;
}

export interface TrackingSession {
  id: string;
  startTime: number;
  endTime?: number;
  points: LocationPoint[];
  distance: number;
  duration: number;
  averageSpeed: number;
  maxSpeed: number;
  purpose?: 'navigation' | 'tracking' | 'fitness' | 'work';
  name?: string;
}

export interface TrackingStats {
  totalSessions: number;
  totalDistance: number;
  totalTime: number;
  averageSpeed: number;
  sessionsThisWeek: number;
  distanceThisWeek: number;
}

class BackgroundLocationService {
  private isTracking = false;
  private currentSession: TrackingSession | null = null;
  private trackingInterval: number | null = null;
  private minDistance = 5; // Minimum distance in meters between points
  private trackingFrequency = 5000; // Track every 5 seconds
  private listeners: ((session: TrackingSession) => void)[] = [];

  constructor() {
    this.setupServiceWorkerMessaging();
  }

  /**
   * Setup communication with service worker for background tracking
   */
  private setupServiceWorkerMessaging(): void {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data?.type === 'BACKGROUND_LOCATION_UPDATE') {
          this.handleBackgroundLocationUpdate(event.data.location);
        }
      });
    }
  }

  /**
   * Start location tracking
   */
  async startTracking(purpose: 'navigation' | 'tracking' | 'fitness' | 'work' = 'tracking', name?: string): Promise<boolean> {
    if (this.isTracking) {
      console.log('[BackgroundLocation] Tracking already active');
      return true;
    }

    try {
      // Request location permissions
      const hasPermission = await geolocationService.requestPermission();
      if (!hasPermission) {
        throw new Error('Location permission denied');
      }

      // Create new tracking session
      this.currentSession = {
        id: this.generateSessionId(),
        startTime: Date.now(),
        points: [],
        distance: 0,
        duration: 0,
        averageSpeed: 0,
        maxSpeed: 0,
        purpose,
        name
      };

      // Get initial position
      const initialPosition = await geolocationService.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 10000
      });

      if (initialPosition) {
        const firstPoint: LocationPoint = {
          latitude: initialPosition.latitude,
          longitude: initialPosition.longitude,
          accuracy: initialPosition.accuracy,
          timestamp: Date.now(),
          altitude: initialPosition.altitude || undefined,
          heading: initialPosition.heading || undefined,
          speed: initialPosition.speed || undefined
        };

        this.currentSession.points.push(firstPoint);
      }

      // Start periodic tracking
      this.trackingInterval = window.setInterval(() => {
        this.trackLocation();
      }, this.trackingFrequency);

      // Register for background tracking if available
      await this.registerBackgroundTracking();

      this.isTracking = true;
      console.log('[BackgroundLocation] Tracking started with session ID:', this.currentSession.id);
      
      return true;
    } catch (error) {
      console.error('[BackgroundLocation] Failed to start tracking:', error);
      return false;
    }
  }

  /**
   * Stop location tracking
   */
  async stopTracking(): Promise<TrackingSession | null> {
    if (!this.isTracking || !this.currentSession) {
      return null;
    }

    // Clear tracking interval
    if (this.trackingInterval) {
      clearInterval(this.trackingInterval);
      this.trackingInterval = null;
    }

    // Finalize session
    const now = Date.now();
    this.currentSession.endTime = now;
    this.currentSession.duration = now - this.currentSession.startTime;

    // Calculate final statistics
    this.calculateSessionStats(this.currentSession);

    // Save session to storage
    await this.saveSession(this.currentSession);

    const completedSession = { ...this.currentSession };
    
    // Notify listeners
    this.listeners.forEach(listener => listener(completedSession));

    // Cleanup
    this.currentSession = null;
    this.isTracking = false;
    
    // Unregister background tracking
    await this.unregisterBackgroundTracking();

    console.log('[BackgroundLocation] Tracking stopped. Session saved:', completedSession.id);
    
    return completedSession;
  }

  /**
   * Track current location
   */
  private async trackLocation(): Promise<void> {
    if (!this.isTracking || !this.currentSession) {
      return;
    }

    try {
      const position = await geolocationService.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 5000,
        maximumAge: 1000
      });

      if (!position) {
        return;
      }

      const newPoint: LocationPoint = {
        latitude: position.latitude,
        longitude: position.longitude,
        accuracy: position.accuracy,
        timestamp: Date.now(),
        altitude: position.altitude || undefined,
        heading: position.heading || undefined,
        speed: position.speed || undefined
      };

      // Check if we should add this point (minimum distance filter)
      const lastPoint = this.currentSession.points[this.currentSession.points.length - 1];
      if (lastPoint) {
        const distance = this.calculateDistance(lastPoint, newPoint);
        if (distance < this.minDistance && position.accuracy > 20) {
          return; // Skip this point - too close and not accurate enough
        }

        // Update session distance
        this.currentSession.distance += distance;
      }

      // Add the point
      this.currentSession.points.push(newPoint);

      // Update session stats
      this.updateSessionStats(this.currentSession);

      // Save progress periodically (every 10 points)
      if (this.currentSession.points.length % 10 === 0) {
        await this.saveSession(this.currentSession);
      }

    } catch (error) {
      console.error('[BackgroundLocation] Failed to track location:', error);
    }
  }

  /**
   * Handle location updates from service worker
   */
  private handleBackgroundLocationUpdate(location: GeolocationPosition): void {
    if (!this.isTracking || !this.currentSession) {
      return;
    }

    const point: LocationPoint = {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      accuracy: location.coords.accuracy,
      timestamp: Date.now(),
      altitude: location.coords.altitude || undefined,
      heading: location.coords.heading || undefined,
      speed: location.coords.speed || undefined
    };

    // Apply the same filtering as regular tracking
    const lastPoint = this.currentSession.points[this.currentSession.points.length - 1];
    if (lastPoint) {
      const distance = this.calculateDistance(lastPoint, point);
      if (distance < this.minDistance && point.accuracy > 20) {
        return;
      }
      this.currentSession.distance += distance;
    }

    this.currentSession.points.push(point);
    this.updateSessionStats(this.currentSession);
  }

  /**
   * Calculate distance between two points using Haversine formula
   */
  private calculateDistance(point1: LocationPoint, point2: LocationPoint): number {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = point1.latitude * Math.PI / 180;
    const φ2 = point2.latitude * Math.PI / 180;
    const Δφ = (point2.latitude - point1.latitude) * Math.PI / 180;
    const Δλ = (point2.longitude - point1.longitude) * Math.PI / 180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c;
  }

  /**
   * Update session statistics
   */
  private updateSessionStats(session: TrackingSession): void {
    if (session.points.length < 2) {
      return;
    }

    const now = Date.now();
    session.duration = now - session.startTime;

    // Calculate speeds
    const speeds = session.points
      .filter(p => p.speed !== undefined && p.speed !== null)
      .map(p => p.speed!);

    if (speeds.length > 0) {
      session.maxSpeed = Math.max(...speeds);
      session.averageSpeed = speeds.reduce((sum, speed) => sum + speed, 0) / speeds.length;
    } else if (session.duration > 0) {
      // Calculate average speed from distance and time
      const hours = session.duration / (1000 * 60 * 60);
      const kilometers = session.distance / 1000;
      session.averageSpeed = kilometers / hours;
    }
  }

  /**
   * Calculate final session statistics
   */
  private calculateSessionStats(session: TrackingSession): void {
    this.updateSessionStats(session);

    // Additional final calculations
    if (session.points.length > 1) {
      // Smooth out any GPS noise in distance calculation
      let totalDistance = 0;
      for (let i = 1; i < session.points.length; i++) {
        const dist = this.calculateDistance(session.points[i-1], session.points[i]);
        // Ignore unrealistic jumps (GPS errors)
        if (dist < 1000) { // Less than 1km between points
          totalDistance += dist;
        }
      }
      session.distance = totalDistance;
    }
  }

  /**
   * Save tracking session to storage
   */
  private async saveSession(session: TrackingSession): Promise<void> {
    try {
      await storageService.setUserData(`tracking_session_${session.id}`, session, 'high');
      console.log('[BackgroundLocation] Session saved:', session.id);
    } catch (error) {
      console.error('[BackgroundLocation] Failed to save session:', error);
    }
  }

  /**
   * Register for background location tracking
   */
  private async registerBackgroundTracking(): Promise<void> {
    if ('serviceWorker' in navigator && 'sync' in window.ServiceWorkerRegistration.prototype) {
      try {
        const registration = await navigator.serviceWorker.ready;
        
        // Send message to service worker to start background tracking
        if (registration.active) {
          registration.active.postMessage({
            type: 'START_BACKGROUND_LOCATION',
            sessionId: this.currentSession?.id,
            frequency: this.trackingFrequency
          });
        }
      } catch (error) {
        console.error('[BackgroundLocation] Failed to register background tracking:', error);
      }
    }
  }

  /**
   * Unregister background location tracking
   */
  private async unregisterBackgroundTracking(): Promise<void> {
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.ready;
        
        if (registration.active) {
          registration.active.postMessage({
            type: 'STOP_BACKGROUND_LOCATION'
          });
        }
      } catch (error) {
        console.error('[BackgroundLocation] Failed to unregister background tracking:', error);
      }
    }
  }

  /**
   * Get all saved tracking sessions
   */
  async getSessions(): Promise<TrackingSession[]> {
    try {
      const exportedData = await storageService.exportData();
      const sessions: TrackingSession[] = [];

      if (exportedData.userData) {
        for (const entry of exportedData.userData) {
          if (entry.key.startsWith('tracking_session_')) {
            sessions.push(entry.data);
          }
        }
      }

      // Sort by start time (newest first)
      sessions.sort((a, b) => b.startTime - a.startTime);
      
      return sessions;
    } catch (error) {
      console.error('[BackgroundLocation] Failed to get sessions:', error);
      return [];
    }
  }

  /**
   * Get tracking statistics
   */
  async getTrackingStats(): Promise<TrackingStats> {
    const sessions = await this.getSessions();
    
    const now = Date.now();
    const weekAgo = now - (7 * 24 * 60 * 60 * 1000);
    
    const thisWeekSessions = sessions.filter(s => s.startTime > weekAgo);
    
    const totalDistance = sessions.reduce((sum, s) => sum + s.distance, 0);
    const totalTime = sessions.reduce((sum, s) => sum + s.duration, 0);
    const distanceThisWeek = thisWeekSessions.reduce((sum, s) => sum + s.distance, 0);
    
    return {
      totalSessions: sessions.length,
      totalDistance: totalDistance,
      totalTime: totalTime,
      averageSpeed: totalTime > 0 ? totalDistance / (totalTime / (1000 * 60 * 60)) : 0,
      sessionsThisWeek: thisWeekSessions.length,
      distanceThisWeek: distanceThisWeek
    };
  }

  /**
   * Delete a tracking session
   */
  async deleteSession(sessionId: string): Promise<boolean> {
    try {
      await storageService.setUserData(`tracking_session_${sessionId}`, null);
      return true;
    } catch (error) {
      console.error('[BackgroundLocation] Failed to delete session:', error);
      return false;
    }
  }

  /**
   * Export session data as GPX
   */
  exportSessionAsGPX(session: TrackingSession): string {
    const gpxContent = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="PathFinder Pro">
  <metadata>
    <name>${session.name || `Session ${session.id}`}</name>
    <desc>Tracking session from ${new Date(session.startTime).toLocaleString()}</desc>
    <time>${new Date(session.startTime).toISOString()}</time>
  </metadata>
  <trk>
    <name>${session.name || `Track ${session.id}`}</name>
    <type>${session.purpose}</type>
    <trkseg>
${session.points.map(point => `      <trkpt lat="${point.latitude}" lon="${point.longitude}">
        ${point.altitude ? `<ele>${point.altitude}</ele>` : ''}
        <time>${new Date(point.timestamp).toISOString()}</time>
      </trkpt>`).join('\n')}
    </trkseg>
  </trk>
</gpx>`;
    
    return gpxContent;
  }

  /**
   * Generate unique session ID
   */
  private generateSessionId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  /**
   * Add listener for tracking session updates
   */
  addListener(listener: (session: TrackingSession) => void): void {
    this.listeners.push(listener);
  }

  /**
   * Remove listener
   */
  removeListener(listener: (session: TrackingSession) => void): void {
    const index = this.listeners.indexOf(listener);
    if (index > -1) {
      this.listeners.splice(index, 1);
    }
  }

  /**
   * Get current tracking status
   */
  getTrackingStatus(): {
    isTracking: boolean;
    currentSession: TrackingSession | null;
    duration: number;
    distance: number;
    pointCount: number;
  } {
    return {
      isTracking: this.isTracking,
      currentSession: this.currentSession,
      duration: this.currentSession ? Date.now() - this.currentSession.startTime : 0,
      distance: this.currentSession ? this.currentSession.distance : 0,
      pointCount: this.currentSession ? this.currentSession.points.length : 0
    };
  }

  /**
   * Update tracking settings
   */
  updateSettings(settings: {
    minDistance?: number;
    trackingFrequency?: number;
  }): void {
    if (settings.minDistance !== undefined) {
      this.minDistance = settings.minDistance;
    }
    if (settings.trackingFrequency !== undefined) {
      this.trackingFrequency = settings.trackingFrequency;
      
      // Restart interval if tracking
      if (this.isTracking && this.trackingInterval) {
        clearInterval(this.trackingInterval);
        this.trackingInterval = window.setInterval(() => {
          this.trackLocation();
        }, this.trackingFrequency);
      }
    }
  }
}

// React hook for background location tracking
export const useBackgroundLocation = () => {
  const [isTracking, setIsTracking] = React.useState(false);
  const [currentSession, setCurrentSession] = React.useState<TrackingSession | null>(null);
  const [sessions, setSessions] = React.useState<TrackingSession[]>([]);
  const [stats, setStats] = React.useState<TrackingStats | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);

  React.useEffect(() => {
    const updateStatus = () => {
      const status = backgroundLocationService.getTrackingStatus();
      setIsTracking(status.isTracking);
      setCurrentSession(status.currentSession);
    };

    // Update status initially
    updateStatus();

    // Update status every second while tracking
    const interval = setInterval(updateStatus, 1000);

    // Add session listener
    const handleSession = (session: TrackingSession) => {
      setSessions(prev => [session, ...prev]);
    };
    backgroundLocationService.addListener(handleSession);

    // Load existing sessions
    loadSessions();

    return () => {
      clearInterval(interval);
      backgroundLocationService.removeListener(handleSession);
    };
  }, []);

  const loadSessions = async () => {
    setIsLoading(true);
    try {
      const [sessionData, statsData] = await Promise.all([
        backgroundLocationService.getSessions(),
        backgroundLocationService.getTrackingStats()
      ]);
      setSessions(sessionData);
      setStats(statsData);
    } catch (error) {
      console.error('Failed to load tracking data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const startTracking = async (purpose?: 'navigation' | 'tracking' | 'fitness' | 'work', name?: string) => {
    setIsLoading(true);
    try {
      const result = await backgroundLocationService.startTracking(purpose, name);
      return result;
    } finally {
      setIsLoading(false);
    }
  };

  const stopTracking = async () => {
    setIsLoading(true);
    try {
      const session = await backgroundLocationService.stopTracking();
      if (session) {
        await loadSessions(); // Refresh data
      }
      return session;
    } finally {
      setIsLoading(false);
    }
  };

  const deleteSession = async (sessionId: string) => {
    setIsLoading(true);
    try {
      const result = await backgroundLocationService.deleteSession(sessionId);
      if (result) {
        setSessions(prev => prev.filter(s => s.id !== sessionId));
        await loadSessions(); // Refresh stats
      }
      return result;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    isTracking,
    currentSession,
    sessions,
    stats,
    isLoading,
    startTracking,
    stopTracking,
    deleteSession,
    exportSessionAsGPX: backgroundLocationService.exportSessionAsGPX.bind(backgroundLocationService),
    updateSettings: backgroundLocationService.updateSettings.bind(backgroundLocationService),
    refreshData: loadSessions
  };
};

export const backgroundLocationService = new BackgroundLocationService();
export default backgroundLocationService;