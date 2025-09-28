import React from 'react';
import { useLoadingState } from '../contexts/LoadingContext';

export interface GeolocationPosition {
  lat: number;
  lng: number;
  accuracy: number;
  altitude?: number;
  altitudeAccuracy?: number;
  heading?: number;
  speed?: number;
  timestamp: number;
}

export interface GeolocationOptions {
  enableHighAccuracy?: boolean;
  timeout?: number;
  maximumAge?: number;
  trackLocation?: boolean;
}

export type LocationPermissionStatus = 'granted' | 'denied' | 'prompt' | 'unsupported';

class GeolocationService {
  private watchId: number | null = null;
  private lastKnownPosition: GeolocationPosition | null = null;
  private subscribers: ((position: GeolocationPosition) => void)[] = [];
  private errorSubscribers: ((error: GeolocationPositionError) => void)[] = [];
  private isTracking: boolean = false;
  private trackingOptions: GeolocationOptions = {};

  /**
   * Check if geolocation is supported
   */
  isSupported(): boolean {
    return 'geolocation' in navigator;
  }

  /**
   * Check current permission status
   */
  async getPermissionStatus(): Promise<LocationPermissionStatus> {
    if (!this.isSupported()) {
      return 'unsupported';
    }

    // Try to use Permissions API if available
    if ('permissions' in navigator) {
      try {
        const permission = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
        return permission.state as LocationPermissionStatus;
      } catch (error) {
        // Permissions API not fully supported, fall back to direct geolocation check
      }
    }

    // Fallback: Try to get position with minimal timeout to check permission
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        () => resolve('granted'),
        (error) => {
          switch (error.code) {
            case error.PERMISSION_DENIED:
              resolve('denied');
              break;
            case error.POSITION_UNAVAILABLE:
            case error.TIMEOUT:
              resolve('granted'); // Permission granted but couldn't get position
              break;
            default:
              resolve('prompt');
          }
        },
        { timeout: 1000, maximumAge: 60000 }
      );
    });
  }

  /**
   * Request location permission
   */
  async requestPermission(): Promise<LocationPermissionStatus> {
    if (!this.isSupported()) {
      throw new Error('Geolocation is not supported by this browser');
    }

    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          this.lastKnownPosition = this.convertPosition(position);
          resolve('granted');
        },
        (error) => {
          switch (error.code) {
            case error.PERMISSION_DENIED:
              resolve('denied');
              break;
            case error.POSITION_UNAVAILABLE:
              reject(new Error('Location information is unavailable'));
              break;
            case error.TIMEOUT:
              reject(new Error('Location request timed out'));
              break;
            default:
              reject(new Error('An unknown error occurred'));
          }
        },
        {
          enableHighAccuracy: true,
          timeout: 15000, // Longer timeout for permission request
          maximumAge: 60000
        }
      );
    });
  }

  /**
   * Force get fresh current position, ignoring cache
   */
  async getFreshCurrentPosition(options: GeolocationOptions = {}): Promise<GeolocationPosition> {
    if (!this.isSupported()) {
      throw new Error('Geolocation is not supported');
    }

    const geoOptions: PositionOptions = {
      enableHighAccuracy: options.enableHighAccuracy ?? true,
      timeout: options.timeout ?? 20000, // Extra long timeout for fresh position
      maximumAge: 0 // Force fresh position
    };

    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const convertedPosition = this.convertPosition(position);
          this.lastKnownPosition = convertedPosition;
          resolve(convertedPosition);
        },
        (error) => {
          reject(this.createLocationError(error));
        },
        geoOptions
      );
    });
  }

  /**
   * Get current position once
   */
  async getCurrentPosition(options: GeolocationOptions = {}): Promise<GeolocationPosition> {
    if (!this.isSupported()) {
      throw new Error('Geolocation is not supported');
    }

    // Use last known position if available and recent enough
    if (this.lastKnownPosition && options.maximumAge) {
      const age = Date.now() - this.lastKnownPosition.timestamp;
      if (age < options.maximumAge) {
        return this.lastKnownPosition;
      }
    }

    const geoOptions: PositionOptions = {
      enableHighAccuracy: options.enableHighAccuracy ?? true, // Enable high accuracy by default
      timeout: options.timeout ?? 15000, // Longer timeout to allow GPS to work
      maximumAge: options.maximumAge ?? 300000 // 5 minutes default
    };

    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const convertedPosition = this.convertPosition(position);
          this.lastKnownPosition = convertedPosition;
          resolve(convertedPosition);
        },
        (error) => {
          // If in development mode and we have a last known position, use it
          if (import.meta.env?.DEV && this.lastKnownPosition) {
            const age = Date.now() - this.lastKnownPosition.timestamp;
            if (age < 600000) { // 10 minutes
              resolve(this.lastKnownPosition);
              return;
            }
          }
          
          // If in development mode and no last known position, provide a sane default (Addis Ababa, Ethiopia)
          if (import.meta.env?.DEV && error.code === error.TIMEOUT) {
            const defaultPosition: GeolocationPosition = {
              lat: 9.0320,
              lng: 38.7469,
              accuracy: 1000,
              altitude: 2355, // Addis Ababa elevation
              altitudeAccuracy: undefined,
              heading: undefined,
              speed: undefined,
              timestamp: Date.now()
            };
            this.lastKnownPosition = defaultPosition;
            resolve(defaultPosition);
            return;
          }
          
          reject(this.createLocationError(error));
        },
        geoOptions
      );
    });
  }

  /**
   * Start tracking user location
   */
  async startTracking(options: GeolocationOptions = {}): Promise<void> {
    if (!this.isSupported()) {
      throw new Error('Geolocation is not supported');
    }

    if (this.isTracking) {
      // Location tracking is already active
      return;
    }

    const permissionStatus = await this.getPermissionStatus();
    if (permissionStatus === 'denied') {
      throw new Error('Location permission denied');
    }

    this.trackingOptions = options;
    this.isTracking = true;

    const geoOptions: PositionOptions = {
      enableHighAccuracy: options.enableHighAccuracy ?? true,
      timeout: options.timeout ?? 15000,
      maximumAge: options.maximumAge ?? 5000 // More frequent updates for tracking
    };

    this.watchId = navigator.geolocation.watchPosition(
      (position) => {
        const convertedPosition = this.convertPosition(position);
        this.lastKnownPosition = convertedPosition;
        
        // Notify all subscribers
        this.subscribers.forEach(callback => {
          try {
            callback(convertedPosition);
          } catch (error) {
            // Error in location subscriber, skip this callback
          }
        });
      },
      (error) => {
        const locationError = this.createLocationError(error);
        
        // Notify error subscribers
        this.errorSubscribers.forEach(callback => {
          try {
            callback(error);
          } catch (err) {
            // Error in location error subscriber, skip this callback
          }
        });
      },
      geoOptions
    );
  }

  /**
   * Stop tracking user location
   */
  stopTracking(): void {
    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
    this.isTracking = false;
    this.subscribers = [];
    this.errorSubscribers = [];
  }

  /**
   * Subscribe to location updates
   */
  subscribe(callback: (position: GeolocationPosition) => void): () => void {
    this.subscribers.push(callback);
    
    // Return unsubscribe function
    return () => {
      const index = this.subscribers.indexOf(callback);
      if (index > -1) {
        this.subscribers.splice(index, 1);
      }
    };
  }

  /**
   * Subscribe to location errors
   */
  subscribeToErrors(callback: (error: GeolocationPositionError) => void): () => void {
    this.errorSubscribers.push(callback);
    
    return () => {
      const index = this.errorSubscribers.indexOf(callback);
      if (index > -1) {
        this.errorSubscribers.splice(index, 1);
      }
    };
  }

  /**
   * Get last known position
   */
  getLastKnownPosition(): GeolocationPosition | null {
    return this.lastKnownPosition;
  }

  /**
   * Check if currently tracking
   */
  getTrackingStatus(): boolean {
    return this.isTracking;
  }

  /**
   * Calculate distance between two positions (Haversine formula)
   */
  calculateDistance(pos1: GeolocationPosition, pos2: GeolocationPosition): number {
    const R = 6371; // Earth's radius in kilometers
    const dLat = this.toRadians(pos2.lat - pos1.lat);
    const dLng = this.toRadians(pos2.lng - pos1.lng);
    
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(this.toRadians(pos1.lat)) * Math.cos(this.toRadians(pos2.lat)) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c * 1000; // Return distance in meters
  }

  /**
   * Calculate bearing between two positions
   */
  calculateBearing(from: GeolocationPosition, to: GeolocationPosition): number {
    const dLng = this.toRadians(to.lng - from.lng);
    const fromLat = this.toRadians(from.lat);
    const toLat = this.toRadians(to.lat);
    
    const y = Math.sin(dLng) * Math.cos(toLat);
    const x = Math.cos(fromLat) * Math.sin(toLat) - 
              Math.sin(fromLat) * Math.cos(toLat) * Math.cos(dLng);
    
    const bearing = Math.atan2(y, x);
    return (this.toDegrees(bearing) + 360) % 360;
  }

  /**
   * Check if position is accurate enough for navigation
   */
  isAccurateEnoughForNavigation(position: GeolocationPosition): boolean {
    // Consider position accurate enough if accuracy is better than 50 meters
    return position.accuracy <= 50;
  }

  /**
   * Get accuracy status description
   */
  getAccuracyStatus(position: GeolocationPosition): 'excellent' | 'good' | 'fair' | 'poor' {
    if (position.accuracy <= 5) return 'excellent';
    if (position.accuracy <= 15) return 'good';
    if (position.accuracy <= 50) return 'fair';
    return 'poor';
  }

  /**
   * Convert native GeolocationPosition to our format
   */
  private convertPosition(position: globalThis.GeolocationPosition): GeolocationPosition {
    return {
      lat: position.coords.latitude,
      lng: position.coords.longitude,
      accuracy: position.coords.accuracy,
      altitude: position.coords.altitude ?? undefined,
      altitudeAccuracy: position.coords.altitudeAccuracy ?? undefined,
      heading: position.coords.heading ?? undefined,
      speed: position.coords.speed ?? undefined,
      timestamp: position.timestamp
    };
  }

  /**
   * Create standardized error from GeolocationPositionError
   */
  private createLocationError(error: GeolocationPositionError): Error {
    switch (error.code) {
      case error.PERMISSION_DENIED:
        return new Error('Location access denied by user');
      case error.POSITION_UNAVAILABLE:
        return new Error('Location information is unavailable');
      case error.TIMEOUT:
        return new Error('Location request timed out');
      default:
        return new Error(`Location error: ${error.message}`);
    }
  }

  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  private toDegrees(radians: number): number {
    return radians * (180 / Math.PI);
  }
}

// React hook for using geolocation
export const useGeolocation = (options: GeolocationOptions = {}) => {
  const [position, setPosition] = React.useState<GeolocationPosition | null>(null);
  const [error, setError] = React.useState<Error | null>(null);
  const [permissionStatus, setPermissionStatus] = React.useState<LocationPermissionStatus>('prompt');
  const { isLoading, startLoading, stopLoading } = useLoadingState('geolocation');

  React.useEffect(() => {
    let unsubscribe: (() => void) | null = null;
    let unsubscribeError: (() => void) | null = null;

    const initGeolocation = async () => {
      try {
        startLoading();
        const status = await geolocationService.getPermissionStatus();
        setPermissionStatus(status);

        if (status === 'granted' || status === 'prompt') {
          if (options.trackLocation) {
            await geolocationService.startTracking(options);
            
            unsubscribe = geolocationService.subscribe((pos) => {
              setPosition(pos);
              setError(null);
            });

            unsubscribeError = geolocationService.subscribeToErrors((err) => {
              // Use a safe public formatting instead of calling a private method
              const message = err?.message || 'Geolocation error occurred';
              setError(new Error(message));
            });
          } else {
            const pos = await geolocationService.getCurrentPosition(options);
            setPosition(pos);
            setError(null);
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Unknown geolocation error'));
      } finally {
        stopLoading();
      }
    };

    if (geolocationService.isSupported()) {
      initGeolocation();
    } else {
      setError(new Error('Geolocation is not supported'));
      setPermissionStatus('unsupported');
    }

    return () => {
      if (unsubscribe) unsubscribe();
      if (unsubscribeError) unsubscribeError();
      if (options.trackLocation) {
        geolocationService.stopTracking();
      }
    };
  }, [options.trackLocation, options.enableHighAccuracy]);

  const requestPermission = async () => {
    try {
      startLoading();
      const status = await geolocationService.requestPermission();
      setPermissionStatus(status);
      if (status === 'granted') {
        const pos = geolocationService.getLastKnownPosition();
        if (pos) setPosition(pos);
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Permission request failed'));
    } finally {
      stopLoading();
    }
  };

  return {
    position,
    error,
    permissionStatus,
    isLoading,
    requestPermission,
    isSupported: geolocationService.isSupported(),
    calculateDistance: geolocationService.calculateDistance,
    calculateBearing: geolocationService.calculateBearing,
    isAccurateEnoughForNavigation: geolocationService.isAccurateEnoughForNavigation,
    getAccuracyStatus: geolocationService.getAccuracyStatus,
    getFreshCurrentPosition: geolocationService.getFreshCurrentPosition
  };
};

export const geolocationService = new GeolocationService();
export default geolocationService;