import React from 'react';
import { cameraService } from './cameraService';
import { deviceSensorsService } from './deviceSensorsService';
import { geolocationService, GeolocationPosition } from './geolocationService';

export interface ARMarker {
  id: string;
  name: string;
  type: 'poi' | 'direction' | 'waypoint' | 'destination';
  position: {
    lat: number;
    lng: number;
    altitude?: number;
  };
  screenPosition?: {
    x: number;
    y: number;
    distance: number;
    bearing: number;
  };
  isVisible: boolean;
  color: string;
  icon?: string;
  description?: string;
}

export interface ARDirectionArrow {
  bearing: number; // 0-360 degrees from north
  distance: number; // in meters
  instruction: string;
  turnAngle?: number; // degrees to turn (-180 to 180)
}

export interface ARViewState {
  isActive: boolean;
  hasPermissions: boolean;
  cameraReady: boolean;
  sensorsReady: boolean;
  locationReady: boolean;
  calibrationStatus: 'uncalibrated' | 'calibrating' | 'calibrated';
}

class ARService {
  private currentLocation: GeolocationPosition | null = null;
  private deviceHeading: number | null = null;
  private devicePitch: number = 0;
  private deviceRoll: number = 0;
  
  private markers: ARMarker[] = [];
  private directionArrow: ARDirectionArrow | null = null;
  
  private isActive: boolean = false;
  private videoElement: HTMLVideoElement | null = null;
  private calibrationOffset: number = 0; // Compass calibration offset
  
  // Subscribers
  private stateSubscribers: ((state: ARViewState) => void)[] = [];
  private markersSubscribers: ((markers: ARMarker[]) => void)[] = [];
  private directionSubscribers: ((direction: ARDirectionArrow | null) => void)[] = [];

  constructor() {
    this.setupSensorListeners();
  }

  private setupSensorListeners() {
    // Listen to device orientation changes
    deviceSensorsService.subscribeToOrientation((orientation) => {
      this.deviceHeading = orientation.alpha;
      this.devicePitch = orientation.beta || 0;
      this.deviceRoll = orientation.gamma || 0;
      
      if (this.isActive) {
        this.updateARElements();
      }
    });

    // Listen to location updates
    geolocationService.subscribe((location) => {
      this.currentLocation = location;
      
      if (this.isActive) {
        this.updateARElements();
      }
    });
  }

  /**
   * Check if AR features are supported
   */
  isSupported(): {
    camera: boolean;
    sensors: boolean;
    location: boolean;
  } {
    return {
      camera: cameraService.isSupported(),
      sensors: deviceSensorsService.isSupported().orientation,
      location: geolocationService.isSupported()
    };
  }

  /**
   * Get current AR view state
   */
  getViewState(): ARViewState {
    const support = this.isSupported();
    
    return {
      isActive: this.isActive,
      hasPermissions: support.camera && support.sensors && support.location,
      cameraReady: cameraService.isActive(),
      sensorsReady: this.deviceHeading !== null,
      locationReady: this.currentLocation !== null,
      calibrationStatus: this.getCalibrationStatus()
    };
  }

  private getCalibrationStatus(): 'uncalibrated' | 'calibrating' | 'calibrated' {
    if (this.deviceHeading === null) return 'uncalibrated';
    if (this.calibrationOffset === 0 && this.isActive) return 'calibrating';
    return 'calibrated';
  }

  /**
   * Start AR navigation
   */
  async startAR(videoElement: HTMLVideoElement): Promise<void> {
    if (this.isActive) {
      console.warn('AR is already active');
      return;
    }

    try {
      // Start camera
      await cameraService.startCamera(videoElement, {
        facingMode: 'environment', // Use rear camera
        width: 1280,
        height: 720
      });

      // Start device sensors
      await deviceSensorsService.startOrientationTracking();

      // Start location tracking
      await geolocationService.startTracking({
        enableHighAccuracy: true,
        trackLocation: true
      });

      this.videoElement = videoElement;
      this.isActive = true;
      
      this.notifyStateChange();
      console.log('AR navigation started');
      
    } catch (error) {
      console.error('Failed to start AR:', error);
      throw error;
    }
  }

  /**
   * Stop AR navigation
   */
  stopAR(): void {
    if (!this.isActive) return;

    // Stop camera
    cameraService.stopCamera();

    // Stop sensors (but keep them running for other features)
    // deviceSensorsService.stopOrientationTracking();

    // Stop location tracking (but keep it running for other features)  
    // geolocationService.stopTracking();

    this.videoElement = null;
    this.isActive = false;
    this.markers = [];
    this.directionArrow = null;
    
    this.notifyStateChange();
    this.notifyMarkersChange();
    this.notifyDirectionChange();
    
    console.log('AR navigation stopped');
  }

  /**
   * Set navigation direction
   */
  setDirection(bearing: number, distance: number, instruction: string, turnAngle?: number): void {
    this.directionArrow = {
      bearing,
      distance,
      instruction,
      turnAngle
    };
    
    this.notifyDirectionChange();
  }

  /**
   * Add POI marker
   */
  addMarker(marker: Omit<ARMarker, 'screenPosition' | 'isVisible'>): void {
    const newMarker: ARMarker = {
      ...marker,
      isVisible: false,
      screenPosition: undefined
    };
    
    this.markers.push(newMarker);
    this.updateARElements();
  }

  /**
   * Remove marker
   */
  removeMarker(markerId: string): void {
    this.markers = this.markers.filter(m => m.id !== markerId);
    this.notifyMarkersChange();
  }

  /**
   * Clear all markers
   */
  clearMarkers(): void {
    this.markers = [];
    this.notifyMarkersChange();
  }

  /**
   * Update AR elements positions based on current orientation and location
   */
  private updateARElements(): void {
    if (!this.isActive || !this.currentLocation || this.deviceHeading === null) {
      return;
    }

    // Update marker positions
    this.markers.forEach(marker => {
      const screenPos = this.calculateScreenPosition(
        marker.position,
        this.currentLocation!,
        this.deviceHeading! + this.calibrationOffset,
        this.devicePitch,
        this.deviceRoll
      );
      
      marker.screenPosition = screenPos;
      marker.isVisible = screenPos.distance < 1000; // Show markers within 1km
    });

    this.notifyMarkersChange();
  }

  /**
   * Calculate screen position for a 3D world position
   */
  private calculateScreenPosition(
    worldPos: { lat: number; lng: number; altitude?: number },
    currentPos: GeolocationPosition,
    deviceHeading: number,
    devicePitch: number,
    deviceRoll: number
  ): { x: number; y: number; distance: number; bearing: number } {
    
    // Calculate distance and bearing
    const distance = geolocationService.calculateDistance(currentPos, {
      ...currentPos,
      lat: worldPos.lat,
      lng: worldPos.lng
    });
    
    const bearing = geolocationService.calculateBearing(currentPos, {
      ...currentPos,
      lat: worldPos.lat,
      lng: worldPos.lng
    });

    // Calculate relative bearing (how much to turn from current heading)
    let relativeBearing = bearing - deviceHeading;
    while (relativeBearing > 180) relativeBearing -= 360;
    while (relativeBearing < -180) relativeBearing += 360;

    // Convert to screen coordinates
    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;
    
    // Horizontal position based on bearing (center = 0 degrees relative)
    const x = screenWidth / 2 + (relativeBearing / 90) * (screenWidth / 2);
    
    // Vertical position based on pitch and altitude difference
    const altitudeDiff = (worldPos.altitude || 0) - (currentPos.altitude || 0);
    const verticalAngle = Math.atan2(altitudeDiff, distance) * (180 / Math.PI);
    const adjustedPitch = devicePitch + verticalAngle;
    const y = screenHeight / 2 - (adjustedPitch / 45) * (screenHeight / 4);

    return {
      x: Math.max(0, Math.min(screenWidth, x)),
      y: Math.max(0, Math.min(screenHeight, y)),
      distance,
      bearing
    };
  }

  /**
   * Calibrate compass with known direction
   */
  calibrateCompass(trueBearing: number): void {
    if (this.deviceHeading !== null) {
      this.calibrationOffset = trueBearing - this.deviceHeading;
      console.log(`Compass calibrated with offset: ${this.calibrationOffset} degrees`);
    }
  }

  /**
   * Get current markers
   */
  getMarkers(): ARMarker[] {
    return this.markers;
  }

  /**
   * Get current direction arrow
   */
  getDirection(): ARDirectionArrow | null {
    return this.directionArrow;
  }

  /**
   * Check if device orientation is level enough for AR
   */
  isDeviceStable(): boolean {
    return Math.abs(this.devicePitch) < 30 && Math.abs(this.deviceRoll) < 30;
  }

  /**
   * Get device orientation info
   */
  getDeviceOrientation(): {
    heading: number | null;
    pitch: number;
    roll: number;
    isStable: boolean;
  } {
    return {
      heading: this.deviceHeading ? this.deviceHeading + this.calibrationOffset : null,
      pitch: this.devicePitch,
      roll: this.deviceRoll,
      isStable: this.isDeviceStable()
    };
  }

  /**
   * Subscribe to AR state changes
   */
  subscribeToState(callback: (state: ARViewState) => void): () => void {
    this.stateSubscribers.push(callback);
    
    return () => {
      const index = this.stateSubscribers.indexOf(callback);
      if (index > -1) {
        this.stateSubscribers.splice(index, 1);
      }
    };
  }

  /**
   * Subscribe to markers changes
   */
  subscribeToMarkers(callback: (markers: ARMarker[]) => void): () => void {
    this.markersSubscribers.push(callback);
    
    return () => {
      const index = this.markersSubscribers.indexOf(callback);
      if (index > -1) {
        this.markersSubscribers.splice(index, 1);
      }
    };
  }

  /**
   * Subscribe to direction changes
   */
  subscribeToDirection(callback: (direction: ARDirectionArrow | null) => void): () => void {
    this.directionSubscribers.push(callback);
    
    return () => {
      const index = this.directionSubscribers.indexOf(callback);
      if (index > -1) {
        this.directionSubscribers.splice(index, 1);
      }
    };
  }

  private notifyStateChange(): void {
    const state = this.getViewState();
    this.stateSubscribers.forEach(callback => {
      try {
        callback(state);
      } catch (error) {
        console.error('Error in AR state subscriber:', error);
      }
    });
  }

  private notifyMarkersChange(): void {
    this.markersSubscribers.forEach(callback => {
      try {
        callback([...this.markers]);
      } catch (error) {
        console.error('Error in AR markers subscriber:', error);
      }
    });
  }

  private notifyDirectionChange(): void {
    this.directionSubscribers.forEach(callback => {
      try {
        callback(this.directionArrow);
      } catch (error) {
        console.error('Error in AR direction subscriber:', error);
      }
    });
  }
}

// React hook for AR functionality
export const useAR = () => {
  const [viewState, setViewState] = React.useState<ARViewState>({
    isActive: false,
    hasPermissions: false,
    cameraReady: false,
    sensorsReady: false,
    locationReady: false,
    calibrationStatus: 'uncalibrated'
  });
  
  const [markers, setMarkers] = React.useState<ARMarker[]>([]);
  const [direction, setDirection] = React.useState<ARDirectionArrow | null>(null);
  const [deviceOrientation, setDeviceOrientation] = React.useState({
    heading: null as number | null,
    pitch: 0,
    roll: 0,
    isStable: true
  });

  React.useEffect(() => {
    const unsubscribeState = arService.subscribeToState(setViewState);
    const unsubscribeMarkers = arService.subscribeToMarkers(setMarkers);
    const unsubscribeDirection = arService.subscribeToDirection(setDirection);

    // Update device orientation info periodically
    const orientationInterval = setInterval(() => {
      setDeviceOrientation(arService.getDeviceOrientation());
    }, 100);

    return () => {
      unsubscribeState();
      unsubscribeMarkers();
      unsubscribeDirection();
      clearInterval(orientationInterval);
    };
  }, []);

  const startAR = async (videoElement: HTMLVideoElement) => {
    try {
      await arService.startAR(videoElement);
    } catch (error) {
      console.error('Failed to start AR:', error);
      throw error;
    }
  };

  const stopAR = () => {
    arService.stopAR();
  };

  const addMarker = (marker: Omit<ARMarker, 'screenPosition' | 'isVisible'>) => {
    arService.addMarker(marker);
  };

  const removeMarker = (markerId: string) => {
    arService.removeMarker(markerId);
  };

  const setNavigationDirection = (bearing: number, distance: number, instruction: string, turnAngle?: number) => {
    arService.setDirection(bearing, distance, instruction, turnAngle);
  };

  const calibrateCompass = (trueBearing: number) => {
    arService.calibrateCompass(trueBearing);
  };

  return {
    viewState,
    markers,
    direction,
    deviceOrientation,
    isSupported: arService.isSupported(),
    startAR,
    stopAR,
    addMarker,
    removeMarker,
    clearMarkers: arService.clearMarkers.bind(arService),
    setNavigationDirection,
    calibrateCompass
  };
};

export const arService = new ARService();
export default arService;