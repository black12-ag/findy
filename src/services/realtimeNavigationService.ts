import { logger } from '../utils/logger';
import { toast } from 'sonner';
import { geolocationService, GeolocationPosition } from './geolocationService';

export interface NavigationState {
  isNavigating: boolean;
  currentLocation: GeolocationPosition | null;
  currentHeading: number; // Device compass heading (0-360°)
  movementHeading: number; // Actual movement direction based on GPS
  speed: number; // m/s
  transportMode: 'walking' | 'cycling' | 'driving' | 'transit';
  routeDirection: number | null; // Expected direction based on route
  isOnRoute: boolean;
  distanceFromRoute: number; // meters
  wrongWayDetected: boolean;
  hasAlternativeRoutes: boolean;
  accuracy: number;
}

export interface RouteDeviation {
  deviationDistance: number;
  deviationDuration: number; // seconds
  suggestedAction: 'return' | 'recalculate' | 'alternative';
  alternativeRoutes?: google.maps.DirectionsRoute[];
}

interface NavigationCallbacks {
  onLocationUpdate: (state: NavigationState) => void;
  onWrongWayDetected: (deviation: RouteDeviation) => void;
  onRouteDeviationDetected: (deviation: RouteDeviation) => void;
  onAlternativeRouteFound: (routes: google.maps.DirectionsRoute[]) => void;
  onBackOnRoute: () => void;
}

class RealtimeNavigationService {
  private navigationState: NavigationState = {
    isNavigating: false,
    currentLocation: null,
    currentHeading: 0,
    movementHeading: 0,
    speed: 0,
    transportMode: 'walking',
    routeDirection: null,
    isOnRoute: true,
    distanceFromRoute: 0,
    wrongWayDetected: false,
    hasAlternativeRoutes: false,
    accuracy: 0
  };

  private callbacks: Partial<NavigationCallbacks> = {};
  private watchId: number | null = null;
  private compassWatchId: number | null = null;
  private currentRoute: google.maps.DirectionsRoute | null = null;
  private lastLocation: GeolocationPosition | null = null;
  private deviationStartTime: number | null = null;
  private wrongWayStartTime: number | null = null;
  private locationHistory: GeolocationPosition[] = [];
  private maxHistorySize = 10;

  // Thresholds for different transport modes
  private readonly TRANSPORT_THRESHOLDS = {
    walking: {
      minSpeed: 0.5, // m/s
      maxSpeed: 3.0,
      routeDeviationDistance: 20, // meters
      wrongWayThreshold: 120, // degrees difference
      recalculateDistance: 50
    },
    cycling: {
      minSpeed: 1.0,
      maxSpeed: 15.0,
      routeDeviationDistance: 30,
      wrongWayThreshold: 90,
      recalculateDistance: 100
    },
    driving: {
      minSpeed: 2.0,
      maxSpeed: 50.0,
      routeDeviationDistance: 50,
      wrongWayThreshold: 90,
      recalculateDistance: 200
    },
    transit: {
      minSpeed: 0.0,
      maxSpeed: 30.0,
      routeDeviationDistance: 100,
      wrongWayThreshold: 180,
      recalculateDistance: 300
    }
  };

  /**
   * Start real-time navigation tracking
   */
  async startNavigation(
    route: google.maps.DirectionsRoute,
    transportMode: NavigationState['transportMode'],
    callbacks: Partial<NavigationCallbacks>
  ): Promise<void> {
    try {
      // Check if geolocation is supported
      if (!navigator.geolocation) {
        throw new Error('Geolocation is not supported on this device');
      }

      this.currentRoute = route;
      this.callbacks = callbacks;
      this.navigationState.transportMode = transportMode;
      this.navigationState.isNavigating = true;
      this.navigationState.wrongWayDetected = false;
      this.locationHistory = [];
      
      logger.info('🚀 Starting real-time navigation', { transportMode, routeLegs: route.legs?.length });

      // Start location tracking with high accuracy
      await this.startLocationTracking();
      
      // Start compass/heading tracking if available (optional)
      try {
        this.startCompassTracking();
      } catch (compassError) {
        logger.warn('Compass not available, using GPS heading only:', compassError);
      }

      // Navigation started - logging only
      logger.info(`Smart navigation started in ${transportMode} mode`);
      
    } catch (error) {
      logger.error('Failed to start real-time navigation:', error);
      
      // Provide user-friendly error messages
      if (error instanceof GeolocationPositionError) {
        switch (error.code) {
          case error.PERMISSION_DENIED:
            toast.error('Location permission denied. Please enable location access in browser settings.');
            break;
          case error.POSITION_UNAVAILABLE:
            toast.error('GPS signal not available. Please try again when you have better signal.');
            break;
          case error.TIMEOUT:
            toast.error('GPS timeout. Please try again or check your connection.');
            break;
        }
      } else {
        toast.error('Unable to start navigation. Please try again.');
      }
      
      throw error;
    }
  }

  /**
   * Stop navigation tracking
   */
  stopNavigation(): void {
    try {
      // Clear geolocation tracking
      if (this.watchId) {
        navigator.geolocation.clearWatch(this.watchId);
        this.watchId = null;
      }
      
      // Clear compass tracking
      if (this.compassWatchId && 'DeviceOrientationEvent' in window) {
        window.removeEventListener('deviceorientation', this.handleDeviceOrientation);
        this.compassWatchId = null;
      }

      // Reset all state
      this.navigationState = {
        isNavigating: false,
        currentLocation: null,
        currentHeading: 0,
        movementHeading: 0,
        speed: 0,
        transportMode: 'walking',
        routeDirection: null,
        isOnRoute: true,
        distanceFromRoute: 0,
        wrongWayDetected: false,
        hasAlternativeRoutes: false,
        accuracy: 0
      };
      
      // Clear references
      this.currentRoute = null;
      this.lastLocation = null;
      this.deviationStartTime = null;
      this.wrongWayStartTime = null;
      this.locationHistory = [];
      this.callbacks = {};
      
      logger.info('Real-time navigation stopped and cleaned up');
      // Navigation stopped - no toast needed
      
    } catch (error) {
      logger.error('Error stopping navigation:', error);
    }
  }

  /**
   * Get current navigation state
   */
  getNavigationState(): NavigationState {
    return { ...this.navigationState };
  }

  /**
   * Start location tracking with optimal settings
   */
  private async startLocationTracking(): Promise<void> {
    const options: PositionOptions = {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 1000 // 1 second cache max for real-time tracking
    };

    this.watchId = navigator.geolocation.watchPosition(
      (position) => this.handleLocationUpdate(position),
      (error) => this.handleLocationError(error),
      options
    );
  }

  /**
   * Start compass/device orientation tracking
   */
  private startCompassTracking(): void {
    if ('DeviceOrientationEvent' in window) {
      // Check if permission is needed (iOS 13+)
      if (typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
        (DeviceOrientationEvent as any).requestPermission()
          .then((permission: string) => {
            if (permission === 'granted') {
              window.addEventListener('deviceorientation', this.handleDeviceOrientation);
              this.compassWatchId = 1;
              logger.info('📱 Device compass tracking enabled');
            }
          })
          .catch((error: Error) => {
            logger.warn('Device orientation permission denied:', error);
          });
      } else {
        // For Android and older iOS
        window.addEventListener('deviceorientation', this.handleDeviceOrientation);
        this.compassWatchId = 1;
        logger.info('📱 Device compass tracking enabled');
      }
    } else {
      logger.warn('Device orientation not supported');
    }
  }

  /**
   * Handle device orientation change
   */
  private handleDeviceOrientation = (event: DeviceOrientationEvent): void => {
    if (event.alpha !== null) {
      // Convert compass heading (0° = North, clockwise)
      this.navigationState.currentHeading = (360 - event.alpha) % 360;
    }
  };

  /**
   * Handle location updates
   */
  private handleLocationUpdate(position: globalThis.GeolocationPosition): void {
    const currentPos: GeolocationPosition = {
      lat: position.coords.latitude,
      lng: position.coords.longitude,
      accuracy: position.coords.accuracy,
      altitude: position.coords.altitude || undefined,
      speed: position.coords.speed || 0,
      heading: position.coords.heading || undefined,
      timestamp: position.timestamp
    };

    this.navigationState.currentLocation = currentPos;
    this.navigationState.speed = currentPos.speed || 0;
    this.navigationState.accuracy = currentPos.accuracy;

    // Add to location history
    this.locationHistory.push(currentPos);
    if (this.locationHistory.length > this.maxHistorySize) {
      this.locationHistory.shift();
    }

    // Calculate movement heading from GPS
    if (this.lastLocation) {
      this.navigationState.movementHeading = this.calculateBearing(this.lastLocation, currentPos);
      
      // If device orientation is not available, use GPS movement heading as device heading
      if (this.navigationState.currentHeading === 0 && this.navigationState.speed > 1) {
        this.navigationState.currentHeading = this.navigationState.movementHeading;
      }
    }

    // Use GPS heading from device if available (Android)
    if (currentPos.heading !== undefined && currentPos.heading !== null) {
      this.navigationState.currentHeading = currentPos.heading;
    }

    // Analyze navigation state
    this.analyzeNavigationState(currentPos);

    // Update transport mode based on speed if auto-detection is enabled
    this.updateTransportModeFromSpeed();

    this.lastLocation = currentPos;

    // Notify callbacks
    if (this.callbacks.onLocationUpdate) {
      this.callbacks.onLocationUpdate(this.navigationState);
    }

    logger.debug('📍 Location updated', {
      location: `${currentPos.lat.toFixed(6)}, ${currentPos.lng.toFixed(6)}`,
      accuracy: Math.round(currentPos.accuracy),
      speed: this.navigationState.speed.toFixed(1),
      deviceHeading: Math.round(this.navigationState.currentHeading),
      movementHeading: Math.round(this.navigationState.movementHeading),
      gpsHeading: currentPos.heading ? Math.round(currentPos.heading) : 'N/A'
    });
  }

  /**
   * Analyze current navigation state
   */
  private analyzeNavigationState(currentPos: GeolocationPosition): void {
    if (!this.currentRoute) return;

    const thresholds = this.TRANSPORT_THRESHOLDS[this.navigationState.transportMode];
    
    // Check if user is on route
    const distanceFromRoute = this.calculateDistanceFromRoute(currentPos);
    this.navigationState.distanceFromRoute = distanceFromRoute;
    this.navigationState.isOnRoute = distanceFromRoute <= thresholds.routeDeviationDistance;

    // Get expected direction from route
    this.navigationState.routeDirection = this.getExpectedRouteDirection(currentPos);

    // Check for wrong-way detection
    this.checkWrongWayDetection();

    // Check for route deviation
    if (!this.navigationState.isOnRoute) {
      this.handleRouteDeviation(distanceFromRoute);
    } else {
      // Back on route
      if (this.deviationStartTime) {
        this.deviationStartTime = null;
        if (this.callbacks.onBackOnRoute) {
          this.callbacks.onBackOnRoute();
        }
      }
    }
  }

  /**
   * Check if user is going in wrong direction
   */
  private checkWrongWayDetection(): void {
    if (!this.navigationState.routeDirection || this.navigationState.speed < 0.5) {
      return; // Not moving fast enough to determine direction
    }

    const directionDifference = Math.abs(
      this.getAngleDifference(this.navigationState.movementHeading, this.navigationState.routeDirection)
    );
    
    const thresholds = this.TRANSPORT_THRESHOLDS[this.navigationState.transportMode];
    const isWrongWay = directionDifference > thresholds.wrongWayThreshold;

    if (isWrongWay && !this.navigationState.wrongWayDetected) {
      // Started going wrong way
      this.navigationState.wrongWayDetected = true;
      this.wrongWayStartTime = Date.now();
      
      const deviation: RouteDeviation = {
        deviationDistance: this.navigationState.distanceFromRoute,
        deviationDuration: 0,
        suggestedAction: 'return'
      };
      
      if (this.callbacks.onWrongWayDetected) {
        this.callbacks.onWrongWayDetected(deviation);
      }
      
      logger.warn('⚠️ Wrong way detected!', {
        movement: Math.round(this.navigationState.movementHeading),
        expected: Math.round(this.navigationState.routeDirection),
        difference: Math.round(directionDifference)
      });
      
    } else if (!isWrongWay && this.navigationState.wrongWayDetected) {
      // Back on track
      this.navigationState.wrongWayDetected = false;
      this.wrongWayStartTime = null;
      
      logger.info('✅ Back on correct direction');
    }
  }

  /**
   * Handle route deviation
   */
  private handleRouteDeviation(distanceFromRoute: number): void {
    const now = Date.now();
    
    if (!this.deviationStartTime) {
      this.deviationStartTime = now;
    }
    
    const deviationDuration = (now - this.deviationStartTime) / 1000;
    const thresholds = this.TRANSPORT_THRESHOLDS[this.navigationState.transportMode];
    
    // Determine suggested action based on deviation
    let suggestedAction: RouteDeviation['suggestedAction'] = 'return';
    
    if (distanceFromRoute > thresholds.recalculateDistance || deviationDuration > 60) {
      suggestedAction = 'recalculate';
    } else if (deviationDuration > 30) {
      suggestedAction = 'alternative';
    }
    
    const deviation: RouteDeviation = {
      deviationDistance: distanceFromRoute,
      deviationDuration,
      suggestedAction
    };
    
    // Check for alternative routes if significantly off course
    if (suggestedAction === 'alternative' || suggestedAction === 'recalculate') {
      this.findAlternativeRoutes(deviation);
    }
    
    if (this.callbacks.onRouteDeviationDetected) {
      this.callbacks.onRouteDeviationDetected(deviation);
    }
  }

  /**
   * Find alternative routes from current position
   */
  private async findAlternativeRoutes(deviation: RouteDeviation): Promise<void> {
    if (!this.currentRoute || !this.navigationState.currentLocation) return;

    try {
      const destination = this.currentRoute.legs[this.currentRoute.legs.length - 1].end_location;
      const directionsService = new google.maps.DirectionsService();
      
      const request: google.maps.DirectionsRequest = {
        origin: new google.maps.LatLng(
          this.navigationState.currentLocation.lat,
          this.navigationState.currentLocation.lng
        ),
        destination: destination,
        travelMode: this.getTravelMode(),
        provideRouteAlternatives: true,
        avoidHighways: false,
        avoidTolls: false
      };

      const result = await directionsService.route(request);
      
      if (result.routes.length > 1) {
        deviation.alternativeRoutes = result.routes;
        this.navigationState.hasAlternativeRoutes = true;
        
        if (this.callbacks.onAlternativeRouteFound) {
          this.callbacks.onAlternativeRouteFound(result.routes);
        }
        
        logger.info('🛤️ Found alternative routes:', result.routes.length);
      }
    } catch (error) {
      logger.warn('Failed to find alternative routes:', error);
    }
  }

  /**
   * Update transport mode based on current speed
   */
  private updateTransportModeFromSpeed(): void {
    const speed = this.navigationState.speed;
    
    // Auto-detect transport mode based on sustained speed
    if (this.locationHistory.length < 5) return; // Need enough data points
    
    const avgSpeed = this.locationHistory
      .slice(-5)
      .reduce((sum, pos) => sum + (pos.speed || 0), 0) / 5;

    let detectedMode: NavigationState['transportMode'] | null = null;
    
    if (avgSpeed < 2) detectedMode = 'walking';
    else if (avgSpeed < 8) detectedMode = 'cycling';
    else if (avgSpeed > 10) detectedMode = 'driving';
    
    // Only update if different and speed is sustained
    if (detectedMode && detectedMode !== this.navigationState.transportMode) {
      logger.info(`🚶➡️🚴➡️🚗 Transport mode auto-detected: ${detectedMode} (speed: ${avgSpeed.toFixed(1)}m/s)`);
    }
  }

  /**
   * Calculate distance from current position to route
   */
  private calculateDistanceFromRoute(position: GeolocationPosition): number {
    if (!this.currentRoute) return 0;

    let minDistance = Infinity;
    
    // Check distance to all route legs
    for (const leg of this.currentRoute.legs) {
      for (const step of leg.steps) {
        if (step.path) {
          for (const point of step.path) {
            const distance = google.maps.geometry.spherical.computeDistanceBetween(
              new google.maps.LatLng(position.lat, position.lng),
              point
            );
            minDistance = Math.min(minDistance, distance);
          }
        }
      }
    }
    
    return minDistance === Infinity ? 0 : minDistance;
  }

  /**
   * Get expected direction based on current position and route
   */
  private getExpectedRouteDirection(position: GeolocationPosition): number | null {
    if (!this.currentRoute) return null;

    // Find closest point on route and get direction to next point
    // This is a simplified version - in production, you'd want more sophisticated route matching
    const legs = this.currentRoute.legs;
    if (legs.length === 0) return null;

    // For simplicity, get direction from current position to destination
    const destination = legs[legs.length - 1].end_location;
    return this.calculateBearing(position, {
      lat: destination.lat(),
      lng: destination.lng(),
      accuracy: 0,
      timestamp: Date.now()
    });
  }

  /**
   * Calculate bearing between two positions
   */
  private calculateBearing(from: GeolocationPosition, to: GeolocationPosition): number {
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
   * Get angle difference between two bearings
   */
  private getAngleDifference(angle1: number, angle2: number): number {
    let diff = Math.abs(angle1 - angle2);
    if (diff > 180) diff = 360 - diff;
    return diff;
  }

  /**
   * Convert Google Maps travel mode
   */
  private getTravelMode(): google.maps.TravelMode {
    switch (this.navigationState.transportMode) {
      case 'walking': return google.maps.TravelMode.WALKING;
      case 'cycling': return google.maps.TravelMode.BICYCLING;
      case 'driving': return google.maps.TravelMode.DRIVING;
      case 'transit': return google.maps.TravelMode.TRANSIT;
      default: return google.maps.TravelMode.WALKING;
    }
  }

  /**
   * Handle location tracking errors
   */
  private handleLocationError(error: GeolocationPositionError): void {
    logger.error('Location tracking error:', error);
    
    switch (error.code) {
      case error.PERMISSION_DENIED:
        toast.error('Location permission denied. Navigation stopped.');
        this.stopNavigation();
        break;
      case error.POSITION_UNAVAILABLE:
        toast.warning('GPS signal lost. Trying to reconnect...');
        break;
      case error.TIMEOUT:
        toast.warning('GPS timeout. Check your signal...');
        break;
    }
  }

  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  private toDegrees(radians: number): number {
    return radians * (180 / Math.PI);
  }
}

export const realtimeNavigationService = new RealtimeNavigationService();
export default realtimeNavigationService;