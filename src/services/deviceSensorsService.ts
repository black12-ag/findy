import React from 'react';
import { logger } from '../utils/logger';

export interface DeviceOrientationData {
  alpha: number | null; // Z axis (compass heading) 0-360 degrees
  beta: number | null;  // X axis (front-back tilt) -180 to 180 degrees
  gamma: number | null; // Y axis (left-right tilt) -90 to 90 degrees
  absolute: boolean;    // True if compass is calibrated
  timestamp: number;
}

export interface DeviceMotionData {
  acceleration: {
    x: number | null;
    y: number | null;
    z: number | null;
  };
  accelerationIncludingGravity: {
    x: number | null;
    y: number | null;
    z: number | null;
  };
  rotationRate: {
    alpha: number | null;
    beta: number | null;
    gamma: number | null;
  };
  interval: number;
  timestamp: number;
}

export interface CompassData {
  heading: number; // 0-360 degrees, 0 = North
  accuracy: number; // Accuracy estimate in degrees
  timestamp: number;
}

export interface DeviceAttitude {
  pitch: number;  // Front-back tilt
  roll: number;   // Left-right tilt
  yaw: number;    // Compass direction
  timestamp: number;
}

export interface BatteryStatus {
  level: number; // 0-1
  charging: boolean;
  chargingTime: number; // seconds
  dischargingTime: number; // seconds
  timestamp: number;
}

export interface NetworkStatus {
  online: boolean;
  effectiveType: '2g' | '3g' | '4g' | 'slow-2g';
  downlink: number; // Mbps
  rtt: number; // milliseconds
  saveData: boolean;
  timestamp: number;
}

export type SensorPermissionStatus = 'granted' | 'denied' | 'prompt' | 'unsupported';

class DeviceSensorsService {
  private orientationSubscribers: ((data: DeviceOrientationData) => void)[] = [];
  private motionSubscribers: ((data: DeviceMotionData) => void)[] = [];
  private compassSubscribers: ((data: CompassData) => void)[] = [];
  private batterySubscribers: ((data: BatteryStatus) => void)[] = [];
  private networkSubscribers: ((data: NetworkStatus) => void)[] = [];
  
  private isOrientationActive: boolean = false;
  private isMotionActive: boolean = false;
  private lastOrientation: DeviceOrientationData | null = null;
  private lastMotion: DeviceMotionData | null = null;
  private lastBattery: BatteryStatus | null = null;
  private lastNetwork: NetworkStatus | null = null;
  
  private orientationHandler?: (event: DeviceOrientationEvent) => void;
  private motionHandler?: (event: DeviceMotionEvent) => void;
  private battery: any = null; // BatteryManager

  /**
   * Check if device sensors are supported
   */
  isSupported(): {
    orientation: boolean;
    motion: boolean;
    compass: boolean;
    battery: boolean;
    network: boolean;
    vibration: boolean;
  } {
    return {
      orientation: 'DeviceOrientationEvent' in window,
      motion: 'DeviceMotionEvent' in window,
      compass: 'DeviceOrientationEvent' in window && 'webkitCompassHeading' in DeviceOrientationEvent.prototype,
      battery: 'getBattery' in navigator || 'battery' in navigator,
      network: 'connection' in navigator || 'mozConnection' in navigator || 'webkitConnection' in navigator,
      vibration: 'vibrate' in navigator
    };
  }

  /**
   * Request device sensors permission (iOS 13+)
   */
  async requestPermission(): Promise<SensorPermissionStatus> {
    // Check if permission API is available (iOS 13+)
    if (typeof DeviceOrientationEvent !== 'undefined' && 
        'requestPermission' in DeviceOrientationEvent) {
      try {
        const permission = await (DeviceOrientationEvent as any).requestPermission();
        return permission as SensorPermissionStatus;
    } catch (error) {
        logger.error('Device orientation permission request failed:', error);
        return 'denied';
      }
    }

    // For other browsers, assume permission is granted if supported
    const support = this.isSupported();
    if (support.orientation || support.motion) {
      return 'granted';
    }

    return 'unsupported';
  }

  /**
   * Start listening to device orientation with fallbacks
   */
  async startOrientationTracking(): Promise<void> {
    if (this.isOrientationActive) {
      logger.warn('Orientation tracking is already active');
      return;
    }

    // Check support first
    const support = this.isSupported();
    if (!support.orientation) {
      logger.warn('Device orientation is not supported, providing mock data');
      this.provideMockOrientationData();
      return;
    }

    // Request permission for iOS 13+
    try {
      const permission = await this.requestPermission();
      if (permission !== 'granted') {
        logger.warn(`Device sensors permission ${permission}, providing mock data`);
        this.provideMockOrientationData();
        return;
      }
    } catch (error) {
      logger.error('Permission request failed:', error);
      this.provideMockOrientationData();
      return;
    }

    this.orientationHandler = (event: DeviceOrientationEvent) => {
      const orientationData: DeviceOrientationData = {
        alpha: event.alpha,
        beta: event.beta,
        gamma: event.gamma,
        absolute: event.absolute || false,
        timestamp: Date.now()
      };

      this.lastOrientation = orientationData;

      // Notify subscribers
      this.orientationSubscribers.forEach(callback => {
        try {
          callback(orientationData);
        } catch (error) {
          logger.error('Error in orientation subscriber:', error);
        }
      });

      // Also update compass subscribers with derived compass data
      if (orientationData.alpha !== null) {
        const compassData: CompassData = {
          heading: this.normalizeHeading(orientationData.alpha),
          accuracy: orientationData.absolute ? 5 : 15, // Estimated accuracy
          timestamp: orientationData.timestamp
        };

        this.compassSubscribers.forEach(callback => {
          try {
            callback(compassData);
          } catch (error) {
            logger.error('Error in compass subscriber:', error);
          }
        });
      }
    };

    window.addEventListener('deviceorientation', this.orientationHandler);
    this.isOrientationActive = true;
  }

  /**
   * Start listening to device motion
   */
  async startMotionTracking(): Promise<void> {
    if (this.isMotionActive) {
      logger.warn('Motion tracking is already active');
      return;
    }

    const permission = await this.requestPermission();
    if (permission !== 'granted') {
      throw new Error(`Device sensors permission: ${permission}`);
    }

    if (!this.isSupported().motion) {
      throw new Error('Device motion is not supported');
    }

    this.motionHandler = (event: DeviceMotionEvent) => {
      const motionData: DeviceMotionData = {
        acceleration: {
          x: event.acceleration?.x || null,
          y: event.acceleration?.y || null,
          z: event.acceleration?.z || null
        },
        accelerationIncludingGravity: {
          x: event.accelerationIncludingGravity?.x || null,
          y: event.accelerationIncludingGravity?.y || null,
          z: event.accelerationIncludingGravity?.z || null
        },
        rotationRate: {
          alpha: event.rotationRate?.alpha || null,
          beta: event.rotationRate?.beta || null,
          gamma: event.rotationRate?.gamma || null
        },
        interval: event.interval || 0,
        timestamp: Date.now()
      };

      this.lastMotion = motionData;

      // Notify subscribers
      this.motionSubscribers.forEach(callback => {
        try {
          callback(motionData);
        } catch (error) {
          logger.error('Error in motion subscriber:', error);
        }
      });
    };

    window.addEventListener('devicemotion', this.motionHandler);
    this.isMotionActive = true;
  }

  /**
   * Stop orientation tracking
   */
  stopOrientationTracking(): void {
    if (this.orientationHandler) {
      window.removeEventListener('deviceorientation', this.orientationHandler);
      this.orientationHandler = undefined;
    }
    this.isOrientationActive = false;
    this.orientationSubscribers = [];
    this.compassSubscribers = [];
  }

  /**
   * Stop motion tracking
   */
  stopMotionTracking(): void {
    if (this.motionHandler) {
      window.removeEventListener('devicemotion', this.motionHandler);
      this.motionHandler = undefined;
    }
    this.isMotionActive = false;
    this.motionSubscribers = [];
  }

  /**
   * Stop all sensor tracking
   */
  stopAllTracking(): void {
    this.stopOrientationTracking();
    this.stopMotionTracking();
  }

  /**
   * Subscribe to orientation updates
   */
  subscribeToOrientation(callback: (data: DeviceOrientationData) => void): () => void {
    this.orientationSubscribers.push(callback);
    
    return () => {
      const index = this.orientationSubscribers.indexOf(callback);
      if (index > -1) {
        this.orientationSubscribers.splice(index, 1);
      }
    };
  }

  /**
   * Subscribe to motion updates
   */
  subscribeToMotion(callback: (data: DeviceMotionData) => void): () => void {
    this.motionSubscribers.push(callback);
    
    return () => {
      const index = this.motionSubscribers.indexOf(callback);
      if (index > -1) {
        this.motionSubscribers.splice(index, 1);
      }
    };
  }

  /**
   * Subscribe to compass updates
   */
  subscribeToCompass(callback: (data: CompassData) => void): () => void {
    this.compassSubscribers.push(callback);
    
    return () => {
      const index = this.compassSubscribers.indexOf(callback);
      if (index > -1) {
        this.compassSubscribers.splice(index, 1);
      }
    };
  }

  /**
   * Get current device attitude (pitch, roll, yaw)
   */
  getDeviceAttitude(): DeviceAttitude | null {
    if (!this.lastOrientation) {
      return null;
    }

    const { alpha, beta, gamma } = this.lastOrientation;
    
    if (alpha === null || beta === null || gamma === null) {
      return null;
    }

    return {
      pitch: beta,
      roll: gamma,
      yaw: alpha,
      timestamp: this.lastOrientation.timestamp
    };
  }

  /**
   * Get compass heading (0-360, 0 = North)
   */
  getCompassHeading(): number | null {
    if (!this.lastOrientation || this.lastOrientation.alpha === null) {
      return null;
    }

    return this.normalizeHeading(this.lastOrientation.alpha);
  }

  /**
   * Check if device is in portrait or landscape orientation
   */
  getScreenOrientation(): 'portrait' | 'landscape' | 'unknown' {
    if (!this.lastOrientation) {
      return 'unknown';
    }

    const { gamma } = this.lastOrientation;
    if (gamma === null) {
      return 'unknown';
    }

    // Simple orientation detection based on gamma (left-right tilt)
    if (Math.abs(gamma) < 45) {
      return 'portrait';
    } else {
      return 'landscape';
    }
  }

  /**
   * Calculate magnetic declination adjustment (rough estimation)
   */
  getMagneticDeclination(lat: number, lng: number): number {
    // This is a very rough approximation
    // In a real app, you'd use a proper magnetic declination service
    
    // Rough magnetic declination for major regions (in degrees)
    const declinations: { [key: string]: number } = {
      'north_america_west': 15,
      'north_america_east': -15,
      'europe': 2,
      'asia': -5,
      'australia': 10,
      'africa': -3,
      'south_america': -8
    };

    // Very rough region detection
    if (lat > 30 && lng > -180 && lng < -50) return declinations.north_america_west;
    if (lat > 30 && lng > -50 && lng < 20) return declinations.north_america_east;
    if (lat > 35 && lng > -10 && lng < 40) return declinations.europe;
    if (lat > 20 && lng > 40 && lng < 180) return declinations.asia;
    if (lat > -50 && lat < -10 && lng > 110 && lng < 180) return declinations.australia;
    if (lat > -40 && lat < 40 && lng > -20 && lng < 50) return declinations.africa;
    if (lat > -60 && lat < 15 && lng > -85 && lng < -30) return declinations.south_america;

    return 0; // Default if no region matches
  }

  /**
   * Get true north heading (adjusted for magnetic declination)
   */
  getTrueNorthHeading(lat?: number, lng?: number): number | null {
    const magneticHeading = this.getCompassHeading();
    if (magneticHeading === null) {
      return null;
    }

    if (lat !== undefined && lng !== undefined) {
      const declination = this.getMagneticDeclination(lat, lng);
      return this.normalizeHeading(magneticHeading + declination);
    }

    return magneticHeading;
  }

  /**
   * Detect if device is being shaken
   */
  isShaking(): boolean {
    if (!this.lastMotion) {
      return false;
    }

    const { acceleration } = this.lastMotion;
    if (!acceleration.x || !acceleration.y || !acceleration.z) {
      return false;
    }

    const totalAcceleration = Math.sqrt(
      acceleration.x ** 2 + acceleration.y ** 2 + acceleration.z ** 2
    );

    // Threshold for shake detection (adjust as needed)
    return totalAcceleration > 20;
  }

  /**
   * Calculate device tilt angle
   */
  getTiltAngle(): number | null {
    if (!this.lastOrientation || this.lastOrientation.beta === null) {
      return null;
    }

    return Math.abs(this.lastOrientation.beta);
  }

  /**
   * Check if device is roughly level (for AR features)
   */
  isDeviceLevel(tolerance: number = 10): boolean {
    const tilt = this.getTiltAngle();
    return tilt !== null && tilt < tolerance;
  }

  /**
   * Get last known sensor data
   */
  getLastKnownData(): {
    orientation: DeviceOrientationData | null;
    motion: DeviceMotionData | null;
  } {
    return {
      orientation: this.lastOrientation,
      motion: this.lastMotion
    };
  }

  /**
   * Normalize heading to 0-360 range
   */
  private normalizeHeading(heading: number): number {
    let normalized = heading;
    while (normalized < 0) normalized += 360;
    while (normalized >= 360) normalized -= 360;
    return normalized;
  }

  /**
   * Get cardinal direction from heading
   */
  getCardinalDirection(heading?: number): string {
    const h = heading || this.getCompassHeading();
    if (h === null) return 'Unknown';

    const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 
                       'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
    const index = Math.round(h / 22.5) % 16;
    return directions[index];
  }

  /**
   * Start battery monitoring
   */
  async startBatteryMonitoring(): Promise<void> {
    if (!this.isSupported().battery) {
      throw new Error('Battery API is not supported');
    }

    try {
      // Try modern getBattery API
      if ('getBattery' in navigator) {
        this.battery = await (navigator as any).getBattery();
      } else if ('battery' in navigator) {
        // Fallback for older browsers
        this.battery = (navigator as any).battery;
      }

      if (this.battery) {
        const updateBattery = () => {
          const batteryStatus: BatteryStatus = {
            level: this.battery.level,
            charging: this.battery.charging,
            chargingTime: this.battery.chargingTime,
            dischargingTime: this.battery.dischargingTime,
            timestamp: Date.now()
          };

          this.lastBattery = batteryStatus;
          this.batterySubscribers.forEach(callback => {
            try {
              callback(batteryStatus);
            } catch (error) {
              console.error('Error in battery subscriber:', error);
            }
          });
        };

        // Set up event listeners
        this.battery.addEventListener('chargingchange', updateBattery);
        this.battery.addEventListener('levelchange', updateBattery);
        this.battery.addEventListener('chargingtimechange', updateBattery);
        this.battery.addEventListener('dischargingtimechange', updateBattery);

        // Initial update
        updateBattery();
      }
    } catch (error) {
      console.error('Failed to start battery monitoring:', error);
      throw error;
    }
  }

  /**
   * Start network monitoring
   */
  startNetworkMonitoring(): void {
    if (!this.isSupported().network) {
      throw new Error('Network Information API is not supported');
    }

    const connection = (navigator as any).connection || 
                      (navigator as any).mozConnection || 
                      (navigator as any).webkitConnection;

    if (connection) {
      const updateNetwork = () => {
        const networkStatus: NetworkStatus = {
          online: navigator.onLine,
          effectiveType: connection.effectiveType || '4g',
          downlink: connection.downlink || 0,
          rtt: connection.rtt || 0,
          saveData: connection.saveData || false,
          timestamp: Date.now()
        };

        this.lastNetwork = networkStatus;
        this.networkSubscribers.forEach(callback => {
          try {
            callback(networkStatus);
          } catch (error) {
            console.error('Error in network subscriber:', error);
          }
        });
      };

      // Set up event listeners
      connection.addEventListener('change', updateNetwork);
      window.addEventListener('online', updateNetwork);
      window.addEventListener('offline', updateNetwork);

      // Initial update
      updateNetwork();
    }
  }

  /**
   * Vibrate device with fallback
   */
  vibrate(pattern: number | number[]): boolean {
    if (!this.isSupported().vibration) {
      console.warn('Vibration not supported, providing visual feedback');
      this.provideVisualFeedback(pattern);
      return false;
    }

    try {
      const result = navigator.vibrate(pattern);
      if (!result) {
        // Fallback to visual feedback if vibration fails
        this.provideVisualFeedback(pattern);
      }
      return result;
    } catch (error) {
      console.error('Vibration failed:', error);
      this.provideVisualFeedback(pattern);
      return false;
    }
  }

  /**
   * Provide mock orientation data when real sensors unavailable
   */
  private provideMockOrientationData(): void {
    this.isOrientationActive = true;
    
    // Simulate device orientation changes
    const interval = setInterval(() => {
      if (!this.isOrientationActive) {
        clearInterval(interval);
        return;
      }

      const mockData: DeviceOrientationData = {
        alpha: Math.sin(Date.now() / 10000) * 360, // Slow compass rotation
        beta: Math.sin(Date.now() / 5000) * 30,   // Tilt forward/backward
        gamma: Math.sin(Date.now() / 7000) * 30,  // Tilt left/right
        absolute: false,
        timestamp: Date.now()
      };

      this.lastOrientation = mockData;
      
      this.orientationSubscribers.forEach(callback => {
        try {
          callback(mockData);
        } catch (error) {
          console.error('Error in mock orientation subscriber:', error);
        }
      });

      // Also provide mock compass data
      const compassData: CompassData = {
        heading: this.normalizeHeading(mockData.alpha!),
        accuracy: 15,
        timestamp: mockData.timestamp
      };

      this.compassSubscribers.forEach(callback => {
        try {
          callback(compassData);
        } catch (error) {
          console.error('Error in mock compass subscriber:', error);
        }
      });
    }, 100); // 10fps
  }

  /**
   * Provide mock motion data when real sensors unavailable
   */
  private provideMockMotionData(): void {
    this.isMotionActive = true;
    
    const interval = setInterval(() => {
      if (!this.isMotionActive) {
        clearInterval(interval);
        return;
      }

      const mockData: DeviceMotionData = {
        acceleration: {
          x: (Math.random() - 0.5) * 2,
          y: (Math.random() - 0.5) * 2,
          z: (Math.random() - 0.5) * 2
        },
        accelerationIncludingGravity: {
          x: (Math.random() - 0.5) * 20,
          y: (Math.random() - 0.5) * 20,
          z: 9.8 + (Math.random() - 0.5) * 2 // Include gravity
        },
        rotationRate: {
          alpha: (Math.random() - 0.5) * 10,
          beta: (Math.random() - 0.5) * 10,
          gamma: (Math.random() - 0.5) * 10
        },
        interval: 16, // ~60fps
        timestamp: Date.now()
      };

      this.lastMotion = mockData;
      
      this.motionSubscribers.forEach(callback => {
        try {
          callback(mockData);
        } catch (error) {
          console.error('Error in mock motion subscriber:', error);
        }
      });
    }, 16); // ~60fps
  }

  /**
   * Provide visual feedback when vibration is not available
   */
  private provideVisualFeedback(pattern: number | number[]): void {
    const patternArray = Array.isArray(pattern) ? pattern : [pattern];
    let index = 0;
    
    const processPattern = () => {
      if (index >= patternArray.length) return;
      
      const duration = patternArray[index];
      
      if (index % 2 === 0) {
        // Vibration phase - flash the screen
        this.flashScreen(duration);
      }
      
      index++;
      if (index < patternArray.length) {
        setTimeout(processPattern, duration);
      }
    };
    
    processPattern();
  }

  /**
   * Flash screen as visual feedback
   */
  private flashScreen(duration: number): void {
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(255, 255, 255, 0.3);
      z-index: 10000;
      pointer-events: none;
      animation: flash ${duration}ms ease-out;
    `;
    
    // Add flash animation
    const style = document.createElement('style');
    style.textContent = `
      @keyframes flash {
        0% { opacity: 1; }
        100% { opacity: 0; }
      }
    `;
    
    document.head.appendChild(style);
    document.body.appendChild(overlay);
    
    setTimeout(() => {
      document.body.removeChild(overlay);
      document.head.removeChild(style);
    }, duration);
  }

  /**
   * Subscribe to battery status updates
   */
  subscribeToBattery(callback: (data: BatteryStatus) => void): () => void {
    this.batterySubscribers.push(callback);
    
    return () => {
      const index = this.batterySubscribers.indexOf(callback);
      if (index > -1) {
        this.batterySubscribers.splice(index, 1);
      }
    };
  }

  /**
   * Subscribe to network status updates
   */
  subscribeToNetwork(callback: (data: NetworkStatus) => void): () => void {
    this.networkSubscribers.push(callback);
    
    return () => {
      const index = this.networkSubscribers.indexOf(callback);
      if (index > -1) {
        this.networkSubscribers.splice(index, 1);
      }
    };
  }

  /**
   * Get last known battery status
   */
  getLastBatteryStatus(): BatteryStatus | null {
    return this.lastBattery;
  }

  /**
   * Get last known network status
   */
  getLastNetworkStatus(): NetworkStatus | null {
    return this.lastNetwork;
  }

  /**
   * Get tracking status
   */
  getTrackingStatus(): {
    orientation: boolean;
    motion: boolean;
  } {
    return {
      orientation: this.isOrientationActive,
      motion: this.isMotionActive
    };
  }
}

// React hook for device sensors
export const useDeviceSensors = (options: {
  trackOrientation?: boolean;
  trackMotion?: boolean;
} = {}) => {
  const [orientation, setOrientation] = React.useState<DeviceOrientationData | null>(null);
  const [motion, setMotion] = React.useState<DeviceMotionData | null>(null);
  const [compass, setCompass] = React.useState<CompassData | null>(null);
  const [permissionStatus, setPermissionStatus] = React.useState<SensorPermissionStatus>('prompt');
  const [error, setError] = React.useState<Error | null>(null);

  React.useEffect(() => {
    let unsubscribeOrientation: (() => void) | null = null;
    let unsubscribeMotion: (() => void) | null = null;
    let unsubscribeCompass: (() => void) | null = null;

    const initSensors = async () => {
      try {
        const permission = await deviceSensorsService.requestPermission();
        setPermissionStatus(permission);

        if (permission === 'granted') {
          if (options.trackOrientation) {
            await deviceSensorsService.startOrientationTracking();
            
            unsubscribeOrientation = deviceSensorsService.subscribeToOrientation((data) => {
              setOrientation(data);
            });

            unsubscribeCompass = deviceSensorsService.subscribeToCompass((data) => {
              setCompass(data);
            });
          }

          if (options.trackMotion) {
            await deviceSensorsService.startMotionTracking();
            
            unsubscribeMotion = deviceSensorsService.subscribeToMotion((data) => {
              setMotion(data);
            });
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Sensors initialization failed'));
      }
    };

    const support = deviceSensorsService.isSupported();
    if (support.orientation || support.motion) {
      initSensors();
    } else {
      setPermissionStatus('unsupported');
    }

    return () => {
      if (unsubscribeOrientation) unsubscribeOrientation();
      if (unsubscribeMotion) unsubscribeMotion();
      if (unsubscribeCompass) unsubscribeCompass();
      
      if (options.trackOrientation) {
        deviceSensorsService.stopOrientationTracking();
      }
      if (options.trackMotion) {
        deviceSensorsService.stopMotionTracking();
      }
    };
  }, [options.trackOrientation, options.trackMotion]);

  return {
    orientation,
    motion,
    compass,
    permissionStatus,
    error,
    isSupported: deviceSensorsService.isSupported(),
    getCompassHeading: deviceSensorsService.getCompassHeading.bind(deviceSensorsService),
    getTrueNorthHeading: deviceSensorsService.getTrueNorthHeading.bind(deviceSensorsService),
    getCardinalDirection: deviceSensorsService.getCardinalDirection.bind(deviceSensorsService),
    getDeviceAttitude: deviceSensorsService.getDeviceAttitude.bind(deviceSensorsService),
    isShaking: deviceSensorsService.isShaking.bind(deviceSensorsService),
    isDeviceLevel: deviceSensorsService.isDeviceLevel.bind(deviceSensorsService),
    getScreenOrientation: deviceSensorsService.getScreenOrientation.bind(deviceSensorsService)
  };
};

export const deviceSensorsService = new DeviceSensorsService();
export default deviceSensorsService;