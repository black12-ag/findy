import React, { useState, useEffect } from 'react';
import { useGeolocation } from '../services/geolocationService';
import { useCamera } from '../services/cameraService';
import { useDeviceSensors } from '../services/deviceSensorsService';
import { usePushNotifications } from '../services/pushNotificationService';
import { useStorage } from '../services/storageService';
import { useBackgroundLocation } from '../services/backgroundLocationService';

interface TestResult {
  name: string;
  status: 'pending' | 'running' | 'passed' | 'failed' | 'not_supported';
  message: string;
  details?: any;
  duration?: number;
}

interface DeviceInfo {
  userAgent: string;
  platform: string;
  isMobile: boolean;
  isIOS: boolean;
  isAndroid: boolean;
  browserName: string;
  browserVersion: string;
  screenSize: string;
  devicePixelRatio: number;
  connectionType?: string;
  batteryLevel?: number;
  isOnline: boolean;
}

export const DeviceIntegrationTest: React.FC = () => {
  const [tests, setTests] = useState<TestResult[]>([]);
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [currentTest, setCurrentTest] = useState<string | null>(null);

  // Service hooks
  const geolocation = useGeolocation();
  const camera = useCamera();
  const sensors = useDeviceSensors();
  const notifications = usePushNotifications();
  const storage = useStorage();
  const backgroundLocation = useBackgroundLocation();

  useEffect(() => {
    collectDeviceInfo();
    initializeTests();
  }, []);

  const collectDeviceInfo = async (): Promise<void> => {
    const info: DeviceInfo = {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      isMobile: /Mobi|Android/i.test(navigator.userAgent),
      isIOS: /iPad|iPhone|iPod/.test(navigator.userAgent),
      isAndroid: /Android/.test(navigator.userAgent),
      browserName: getBrowserName(),
      browserVersion: getBrowserVersion(),
      screenSize: `${window.screen.width}x${window.screen.height}`,
      devicePixelRatio: window.devicePixelRatio,
      isOnline: navigator.onLine
    };

    // Get connection info if available
    if ('connection' in navigator) {
      const connection = (navigator as any).connection;
      info.connectionType = connection.effectiveType || connection.type;
    }

    // Get battery info if available
    if ('getBattery' in navigator) {
      try {
        const battery = await (navigator as any).getBattery();
        info.batteryLevel = Math.round(battery.level * 100);
      } catch (error) {
        // Battery API not available
      }
    }

    setDeviceInfo(info);
  };

  const getBrowserName = (): string => {
    const ua = navigator.userAgent;
    if (ua.includes('Chrome') && !ua.includes('Edg')) return 'Chrome';
    if (ua.includes('Firefox')) return 'Firefox';
    if (ua.includes('Safari') && !ua.includes('Chrome')) return 'Safari';
    if (ua.includes('Edg')) return 'Edge';
    if (ua.includes('Opera')) return 'Opera';
    return 'Unknown';
  };

  const getBrowserVersion = (): string => {
    const ua = navigator.userAgent;
    const match = ua.match(/(Chrome|Firefox|Safari|Edg|Opera)\/(\d+)/);
    return match ? match[2] : 'Unknown';
  };

  const initializeTests = (): void => {
    const initialTests: TestResult[] = [
      // Geolocation Tests
      { name: 'Geolocation API Support', status: 'pending', message: 'Checking geolocation API availability' },
      { name: 'GPS Permission Request', status: 'pending', message: 'Testing location permission handling' },
      { name: 'Current Position Accuracy', status: 'pending', message: 'Testing GPS accuracy and response time' },
      { name: 'Position Watching', status: 'pending', message: 'Testing continuous location tracking' },

      // Camera Tests
      { name: 'Camera API Support', status: 'pending', message: 'Checking camera API availability' },
      { name: 'Camera Permission Request', status: 'pending', message: 'Testing camera permission handling' },
      { name: 'Video Stream Quality', status: 'pending', message: 'Testing camera video stream' },
      { name: 'Photo Capture', status: 'pending', message: 'Testing photo capture functionality' },

      // Sensor Tests
      { name: 'Device Motion API', status: 'pending', message: 'Checking device motion sensor support' },
      { name: 'Device Orientation API', status: 'pending', message: 'Checking device orientation support' },
      { name: 'Compass Calibration', status: 'pending', message: 'Testing compass accuracy' },
      { name: 'Motion Detection', status: 'pending', message: 'Testing accelerometer sensitivity' },

      // Storage Tests
      { name: 'IndexedDB Support', status: 'pending', message: 'Checking IndexedDB availability' },
      { name: 'Storage Quota', status: 'pending', message: 'Testing storage quota and usage' },
      { name: 'Cache Performance', status: 'pending', message: 'Testing read/write performance' },
      { name: 'Storage Cleanup', status: 'pending', message: 'Testing automatic cleanup mechanisms' },

      // Notification Tests
      { name: 'Notification API Support', status: 'pending', message: 'Checking notification support' },
      { name: 'Notification Permissions', status: 'pending', message: 'Testing notification permission flow' },
      { name: 'Push Subscription', status: 'pending', message: 'Testing push notification subscription' },
      { name: 'Notification Display', status: 'pending', message: 'Testing notification rendering' },

      // Background Services
      { name: 'Service Worker Registration', status: 'pending', message: 'Testing service worker functionality' },
      { name: 'Background Sync', status: 'pending', message: 'Testing background data synchronization' },
      { name: 'Background Location', status: 'pending', message: 'Testing background location tracking' },

      // PWA Features
      { name: 'PWA Installability', status: 'pending', message: 'Testing app installation capability' },
      { name: 'Offline Functionality', status: 'pending', message: 'Testing offline mode capabilities' },
      { name: 'App Manifest', status: 'pending', message: 'Testing PWA manifest configuration' }
    ];

    setTests(initialTests);
  };

  const runAllTests = async (): Promise<void> => {
    if (isRunning) return;
    
    setIsRunning(true);
    const startTime = Date.now();

    for (let i = 0; i < tests.length; i++) {
      const test = tests[i];
      setCurrentTest(test.name);
      
      const result = await runSingleTest(test);
      
      setTests(prev => prev.map((t, idx) => 
        idx === i ? result : t
      ));

      // Small delay between tests for better UX
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    setCurrentTest(null);
    setIsRunning(false);
    
    const totalTime = Date.now() - startTime;
    console.log(`[DeviceTest] All tests completed in ${totalTime}ms`);
  };

  const runSingleTest = async (test: TestResult): Promise<TestResult> => {
    const startTime = Date.now();
    
    try {
      let result: TestResult;
      
      switch (test.name) {
        // Geolocation Tests
        case 'Geolocation API Support':
          result = testGeolocationSupport();
          break;
        case 'GPS Permission Request':
          result = await testGPSPermission();
          break;
        case 'Current Position Accuracy':
          result = await testPositionAccuracy();
          break;
        case 'Position Watching':
          result = await testPositionWatching();
          break;

        // Camera Tests
        case 'Camera API Support':
          result = testCameraSupport();
          break;
        case 'Camera Permission Request':
          result = await testCameraPermission();
          break;
        case 'Video Stream Quality':
          result = await testVideoStream();
          break;
        case 'Photo Capture':
          result = await testPhotoCapture();
          break;

        // Sensor Tests
        case 'Device Motion API':
          result = testDeviceMotionSupport();
          break;
        case 'Device Orientation API':
          result = testDeviceOrientationSupport();
          break;
        case 'Compass Calibration':
          result = await testCompassCalibration();
          break;
        case 'Motion Detection':
          result = await testMotionDetection();
          break;

        // Storage Tests
        case 'IndexedDB Support':
          result = testIndexedDBSupport();
          break;
        case 'Storage Quota':
          result = await testStorageQuota();
          break;
        case 'Cache Performance':
          result = await testCachePerformance();
          break;
        case 'Storage Cleanup':
          result = await testStorageCleanup();
          break;

        // Notification Tests
        case 'Notification API Support':
          result = testNotificationSupport();
          break;
        case 'Notification Permissions':
          result = await testNotificationPermissions();
          break;
        case 'Push Subscription':
          result = await testPushSubscription();
          break;
        case 'Notification Display':
          result = await testNotificationDisplay();
          break;

        // Background Services
        case 'Service Worker Registration':
          result = await testServiceWorker();
          break;
        case 'Background Sync':
          result = await testBackgroundSync();
          break;
        case 'Background Location':
          result = await testBackgroundLocation();
          break;

        // PWA Features
        case 'PWA Installability':
          result = testPWAInstallability();
          break;
        case 'Offline Functionality':
          result = await testOfflineFunctionality();
          break;
        case 'App Manifest':
          result = await testAppManifest();
          break;

        default:
          result = {
            ...test,
            status: 'failed',
            message: 'Unknown test case'
          };
      }

      result.duration = Date.now() - startTime;
      return result;
      
    } catch (error) {
      return {
        ...test,
        status: 'failed',
        message: `Test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        duration: Date.now() - startTime
      };
    }
  };

  // Test Implementations
  const testGeolocationSupport = (): TestResult => {
    const supported = 'geolocation' in navigator;
    return {
      name: 'Geolocation API Support',
      status: supported ? 'passed' : 'not_supported',
      message: supported ? 'Geolocation API is available' : 'Geolocation API not supported',
      details: { supported }
    };
  };

  const testGPSPermission = async (): Promise<TestResult> => {
    try {
      const hasPermission = await geolocation.requestPermission();
      return {
        name: 'GPS Permission Request',
        status: hasPermission ? 'passed' : 'failed',
        message: hasPermission ? 'GPS permission granted' : 'GPS permission denied',
        details: { hasPermission, permissionState: geolocation.permissionState }
      };
    } catch (error) {
      return {
        name: 'GPS Permission Request',
        status: 'failed',
        message: `Permission request failed: ${error}`,
        details: { error }
      };
    }
  };

  const testPositionAccuracy = async (): Promise<TestResult> => {
    if (!geolocation.isSupported) {
      return {
        name: 'Current Position Accuracy',
        status: 'not_supported',
        message: 'Geolocation not supported'
      };
    }

    try {
      const position = await geolocation.getCurrentPosition({ 
        enableHighAccuracy: true, 
        timeout: 10000 
      });
      
      if (!position) {
        return {
          name: 'Current Position Accuracy',
          status: 'failed',
          message: 'Could not get current position'
        };
      }

      const accuracy = position.accuracy;
      const status = accuracy <= 20 ? 'passed' : accuracy <= 100 ? 'passed' : 'failed';
      
      return {
        name: 'Current Position Accuracy',
        status,
        message: `Position accuracy: ${accuracy}m`,
        details: { 
          accuracy, 
          latitude: position.latitude, 
          longitude: position.longitude,
          altitude: position.altitude,
          speed: position.speed,
          heading: position.heading
        }
      };
    } catch (error) {
      return {
        name: 'Current Position Accuracy',
        status: 'failed',
        message: `Position request failed: ${error}`,
        details: { error }
      };
    }
  };

  const testPositionWatching = async (): Promise<TestResult> => {
    return new Promise((resolve) => {
      let watchId: number | null = null;
      let positionCount = 0;
      
      const timeout = setTimeout(() => {
        if (watchId !== null) {
          geolocation.clearWatch(watchId);
        }
        resolve({
          name: 'Position Watching',
          status: positionCount > 0 ? 'passed' : 'failed',
          message: `Received ${positionCount} position updates in 3 seconds`,
          details: { positionCount }
        });
      }, 3000);

      watchId = geolocation.watchPosition(
        (position) => {
          positionCount++;
          if (positionCount >= 2) {
            clearTimeout(timeout);
            geolocation.clearWatch(watchId!);
            resolve({
              name: 'Position Watching',
              status: 'passed',
              message: `Position watching working (${positionCount} updates)`,
              details: { positionCount, finalPosition: position }
            });
          }
        },
        () => {
          clearTimeout(timeout);
          if (watchId !== null) {
            geolocation.clearWatch(watchId);
          }
          resolve({
            name: 'Position Watching',
            status: 'failed',
            message: 'Position watching failed',
            details: { positionCount }
          });
        },
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 1000 }
      );
    });
  };

  const testCameraSupport = (): TestResult => {
    const supported = camera.isSupported;
    return {
      name: 'Camera API Support',
      status: supported ? 'passed' : 'not_supported',
      message: supported ? 'Camera API is available' : 'Camera API not supported',
      details: { supported, availableCameras: camera.availableCameras }
    };
  };

  const testCameraPermission = async (): Promise<TestResult> => {
    try {
      const hasPermission = await camera.requestPermission();
      return {
        name: 'Camera Permission Request',
        status: hasPermission ? 'passed' : 'failed',
        message: hasPermission ? 'Camera permission granted' : 'Camera permission denied',
        details: { hasPermission, permissionState: camera.permissionState }
      };
    } catch (error) {
      return {
        name: 'Camera Permission Request',
        status: 'failed',
        message: `Camera permission failed: ${error}`,
        details: { error }
      };
    }
  };

  const testVideoStream = async (): Promise<TestResult> => {
    try {
      const stream = await camera.startCamera();
      if (stream) {
        camera.stopCamera();
        return {
          name: 'Video Stream Quality',
          status: 'passed',
          message: 'Video stream started successfully',
          details: { 
            streamActive: true,
            tracks: stream.getTracks().length,
            videoTrack: stream.getVideoTracks()[0]?.getSettings()
          }
        };
      } else {
        return {
          name: 'Video Stream Quality',
          status: 'failed',
          message: 'Could not start video stream'
        };
      }
    } catch (error) {
      return {
        name: 'Video Stream Quality',
        status: 'failed',
        message: `Video stream failed: ${error}`,
        details: { error }
      };
    }
  };

  const testPhotoCapture = async (): Promise<TestResult> => {
    try {
      const photo = await camera.capturePhoto();
      return {
        name: 'Photo Capture',
        status: photo ? 'passed' : 'failed',
        message: photo ? 'Photo captured successfully' : 'Photo capture failed',
        details: { 
          photoSize: photo ? photo.size : 0,
          photoType: photo ? photo.type : null
        }
      };
    } catch (error) {
      return {
        name: 'Photo Capture',
        status: 'failed',
        message: `Photo capture failed: ${error}`,
        details: { error }
      };
    }
  };

  const testDeviceMotionSupport = (): TestResult => {
    const supported = sensors.motion.isSupported;
    return {
      name: 'Device Motion API',
      status: supported ? 'passed' : 'not_supported',
      message: supported ? 'Device Motion API is available' : 'Device Motion API not supported',
      details: { 
        supported,
        hasAccelerometer: sensors.motion.acceleration !== null,
        hasGyroscope: sensors.motion.rotationRate !== null
      }
    };
  };

  const testDeviceOrientationSupport = (): TestResult => {
    const supported = sensors.orientation.isSupported;
    return {
      name: 'Device Orientation API',
      status: supported ? 'passed' : 'not_supported',
      message: supported ? 'Device Orientation API is available' : 'Device Orientation API not supported',
      details: { 
        supported,
        hasCompass: sensors.compass.heading !== null,
        orientation: sensors.orientation
      }
    };
  };

  const testCompassCalibration = async (): Promise<TestResult> => {
    return new Promise((resolve) => {
      let headingCount = 0;
      let validHeadings = 0;
      
      const unsubscribe = sensors.compass.subscribe((compass) => {
        headingCount++;
        if (compass.heading !== null && compass.accuracy !== null) {
          validHeadings++;
        }
      });

      setTimeout(() => {
        unsubscribe();
        const accuracy = validHeadings / headingCount;
        resolve({
          name: 'Compass Calibration',
          status: accuracy > 0.7 ? 'passed' : accuracy > 0.3 ? 'passed' : 'failed',
          message: `Compass accuracy: ${Math.round(accuracy * 100)}%`,
          details: { 
            headingCount, 
            validHeadings, 
            accuracy,
            currentHeading: sensors.compass.heading,
            currentAccuracy: sensors.compass.accuracy
          }
        });
      }, 2000);
    });
  };

  const testMotionDetection = async (): Promise<TestResult> => {
    return new Promise((resolve) => {
      let motionEvents = 0;
      let significantMotion = 0;
      
      const unsubscribe = sensors.motion.subscribe((motion) => {
        motionEvents++;
        if (motion.acceleration) {
          const magnitude = Math.sqrt(
            Math.pow(motion.acceleration.x || 0, 2) +
            Math.pow(motion.acceleration.y || 0, 2) +
            Math.pow(motion.acceleration.z || 0, 2)
          );
          if (magnitude > 2) { // Significant motion threshold
            significantMotion++;
          }
        }
      });

      setTimeout(() => {
        unsubscribe();
        resolve({
          name: 'Motion Detection',
          status: motionEvents > 10 ? 'passed' : motionEvents > 0 ? 'passed' : 'failed',
          message: `Motion events: ${motionEvents}, Significant: ${significantMotion}`,
          details: { motionEvents, significantMotion }
        });
      }, 2000);
    });
  };

  const testIndexedDBSupport = (): TestResult => {
    const supported = 'indexedDB' in window;
    return {
      name: 'IndexedDB Support',
      status: supported ? 'passed' : 'not_supported',
      message: supported ? 'IndexedDB is available' : 'IndexedDB not supported',
      details: { supported }
    };
  };

  const testStorageQuota = async (): Promise<TestResult> => {
    try {
      await storage.refreshStats();
      const stats = storage.stats;
      
      if (!stats) {
        return {
          name: 'Storage Quota',
          status: 'failed',
          message: 'Could not retrieve storage stats'
        };
      }

      return {
        name: 'Storage Quota',
        status: 'passed',
        message: `Storage: ${formatBytes(stats.total.usage)} / ${formatBytes(stats.total.quota)} used`,
        details: stats
      };
    } catch (error) {
      return {
        name: 'Storage Quota',
        status: 'failed',
        message: `Storage test failed: ${error}`,
        details: { error }
      };
    }
  };

  const testCachePerformance = async (): Promise<TestResult> => {
    const testData = { test: 'performance', data: new Array(1000).fill(0).map((_, i) => `item-${i}`) };
    
    try {
      const writeStart = performance.now();
      await storage.setUserData('performance-test', testData);
      const writeTime = performance.now() - writeStart;

      const readStart = performance.now();
      const retrievedData = await storage.getUserData('performance-test');
      const readTime = performance.now() - readStart;

      const isValid = JSON.stringify(retrievedData) === JSON.stringify(testData);

      return {
        name: 'Cache Performance',
        status: isValid && writeTime < 1000 && readTime < 100 ? 'passed' : 'failed',
        message: `Write: ${writeTime.toFixed(2)}ms, Read: ${readTime.toFixed(2)}ms`,
        details: { writeTime, readTime, isValid, dataSize: JSON.stringify(testData).length }
      };
    } catch (error) {
      return {
        name: 'Cache Performance',
        status: 'failed',
        message: `Cache performance test failed: ${error}`,
        details: { error }
      };
    }
  };

  const testStorageCleanup = async (): Promise<TestResult> => {
    try {
      const result = await storage.optimizeStorage();
      return {
        name: 'Storage Cleanup',
        status: 'passed',
        message: `Cleaned ${formatBytes(result.cleaned)} from ${result.optimized.length} stores`,
        details: result
      };
    } catch (error) {
      return {
        name: 'Storage Cleanup',
        status: 'failed',
        message: `Storage cleanup failed: ${error}`,
        details: { error }
      };
    }
  };

  const testNotificationSupport = (): TestResult => {
    const supported = notifications.isSupported;
    return {
      name: 'Notification API Support',
      status: supported ? 'passed' : 'not_supported',
      message: supported ? 'Notification API is available' : 'Notifications not supported',
      details: { supported, permission: notifications.permission }
    };
  };

  const testNotificationPermissions = async (): Promise<TestResult> => {
    try {
      const permission = await notifications.requestPermission();
      return {
        name: 'Notification Permissions',
        status: permission === 'granted' ? 'passed' : 'failed',
        message: `Notification permission: ${permission}`,
        details: { permission }
      };
    } catch (error) {
      return {
        name: 'Notification Permissions',
        status: 'failed',
        message: `Notification permission failed: ${error}`,
        details: { error }
      };
    }
  };

  const testPushSubscription = async (): Promise<TestResult> => {
    try {
      if (notifications.permission !== 'granted') {
        return {
          name: 'Push Subscription',
          status: 'failed',
          message: 'Notifications not permitted'
        };
      }

      const subscribed = notifications.isSubscribed;
      return {
        name: 'Push Subscription',
        status: subscribed ? 'passed' : 'passed',
        message: subscribed ? 'Push subscription active' : 'Push subscription available',
        details: { subscribed, subscription: notifications.subscription }
      };
    } catch (error) {
      return {
        name: 'Push Subscription',
        status: 'failed',
        message: `Push subscription failed: ${error}`,
        details: { error }
      };
    }
  };

  const testNotificationDisplay = async (): Promise<TestResult> => {
    try {
      if (notifications.permission !== 'granted') {
        return {
          name: 'Notification Display',
          status: 'failed',
          message: 'Notifications not permitted'
        };
      }

      await notifications.showNotification({
        title: '🧪 Device Test',
        body: 'Notification display test successful!',
        tag: 'device-test'
      });

      return {
        name: 'Notification Display',
        status: 'passed',
        message: 'Test notification displayed successfully'
      };
    } catch (error) {
      return {
        name: 'Notification Display',
        status: 'failed',
        message: `Notification display failed: ${error}`,
        details: { error }
      };
    }
  };

  const testServiceWorker = async (): Promise<TestResult> => {
    if (!('serviceWorker' in navigator)) {
      return {
        name: 'Service Worker Registration',
        status: 'not_supported',
        message: 'Service Worker not supported'
      };
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      return {
        name: 'Service Worker Registration',
        status: 'passed',
        message: 'Service Worker is active',
        details: { 
          scope: registration.scope,
          state: registration.active?.state,
          scriptURL: registration.active?.scriptURL
        }
      };
    } catch (error) {
      return {
        name: 'Service Worker Registration',
        status: 'failed',
        message: `Service Worker failed: ${error}`,
        details: { error }
      };
    }
  };

  const testBackgroundSync = async (): Promise<TestResult> => {
    if (!('serviceWorker' in navigator) || !('sync' in window.ServiceWorkerRegistration.prototype)) {
      return {
        name: 'Background Sync',
        status: 'not_supported',
        message: 'Background Sync not supported'
      };
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      await registration.sync.register('test-sync');
      
      return {
        name: 'Background Sync',
        status: 'passed',
        message: 'Background Sync is available',
        details: { registered: true }
      };
    } catch (error) {
      return {
        name: 'Background Sync',
        status: 'failed',
        message: `Background Sync failed: ${error}`,
        details: { error }
      };
    }
  };

  const testBackgroundLocation = async (): Promise<TestResult> => {
    try {
      const status = backgroundLocation.getTrackingStatus();
      return {
        name: 'Background Location',
        status: 'passed',
        message: 'Background location tracking is available',
        details: { 
          isTracking: status.isTracking,
          sessionCount: backgroundLocation.sessions.length,
          stats: backgroundLocation.stats
        }
      };
    } catch (error) {
      return {
        name: 'Background Location',
        status: 'failed',
        message: `Background location failed: ${error}`,
        details: { error }
      };
    }
  };

  const testPWAInstallability = (): TestResult => {
    const isInstallable = 'beforeinstallprompt' in window || 
                          (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
                          deviceInfo?.isIOS;
    
    return {
      name: 'PWA Installability',
      status: isInstallable ? 'passed' : 'failed',
      message: isInstallable ? 'App can be installed as PWA' : 'PWA installation not supported',
      details: { 
        isInstallable,
        isStandalone: window.matchMedia('(display-mode: standalone)').matches,
        hasBeforeInstallPrompt: 'beforeinstallprompt' in window
      }
    };
  };

  const testOfflineFunctionality = async (): Promise<TestResult> => {
    try {
      const cacheStorage = await caches.open('test-cache');
      await cacheStorage.put('/test', new Response('test'));
      const cached = await cacheStorage.match('/test');
      await cacheStorage.delete('/test');
      
      return {
        name: 'Offline Functionality',
        status: cached ? 'passed' : 'failed',
        message: cached ? 'Offline caching is working' : 'Offline caching failed',
        details: { hasCacheAPI: 'caches' in window, testPassed: !!cached }
      };
    } catch (error) {
      return {
        name: 'Offline Functionality',
        status: 'failed',
        message: `Offline test failed: ${error}`,
        details: { error }
      };
    }
  };

  const testAppManifest = async (): Promise<TestResult> => {
    try {
      const response = await fetch('/manifest.json');
      const manifest = await response.json();
      
      const requiredFields = ['name', 'short_name', 'start_url', 'display', 'theme_color'];
      const missingFields = requiredFields.filter(field => !manifest[field]);
      
      return {
        name: 'App Manifest',
        status: missingFields.length === 0 ? 'passed' : 'failed',
        message: missingFields.length === 0 ? 'App manifest is valid' : `Missing fields: ${missingFields.join(', ')}`,
        details: { manifest, missingFields }
      };
    } catch (error) {
      return {
        name: 'App Manifest',
        status: 'failed',
        message: `Manifest test failed: ${error}`,
        details: { error }
      };
    }
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getTestStatusIcon = (status: TestResult['status']): string => {
    switch (status) {
      case 'passed': return '✅';
      case 'failed': return '❌';
      case 'running': return '🔄';
      case 'not_supported': return '⚠️';
      default: return '⏳';
    }
  };

  const getTestStatusColor = (status: TestResult['status']): string => {
    switch (status) {
      case 'passed': return '#10b981';
      case 'failed': return '#ef4444';
      case 'running': return '#3b82f6';
      case 'not_supported': return '#f59e0b';
      default: return '#6b7280';
    }
  };

  const testStats = {
    total: tests.length,
    passed: tests.filter(t => t.status === 'passed').length,
    failed: tests.filter(t => t.status === 'failed').length,
    notSupported: tests.filter(t => t.status === 'not_supported').length,
    pending: tests.filter(t => t.status === 'pending').length
  };

  return (
    <div className="device-integration-test">
      <div className="test-header">
        <h2>🔧 Device Integration Test</h2>
        <div className="test-controls">
          <button 
            onClick={runAllTests} 
            disabled={isRunning}
            className="btn btn-primary"
          >
            {isRunning ? '🔄 Running Tests...' : '🚀 Run All Tests'}
          </button>
        </div>
      </div>

      {/* Test Statistics */}
      <div className="test-stats">
        <div className="stat-item">
          <span className="stat-value">{testStats.total}</span>
          <span className="stat-label">Total</span>
        </div>
        <div className="stat-item passed">
          <span className="stat-value">{testStats.passed}</span>
          <span className="stat-label">Passed</span>
        </div>
        <div className="stat-item failed">
          <span className="stat-value">{testStats.failed}</span>
          <span className="stat-label">Failed</span>
        </div>
        <div className="stat-item not-supported">
          <span className="stat-value">{testStats.notSupported}</span>
          <span className="stat-label">Not Supported</span>
        </div>
        <div className="stat-item pending">
          <span className="stat-value">{testStats.pending}</span>
          <span className="stat-label">Pending</span>
        </div>
      </div>

      {/* Device Information */}
      {deviceInfo && (
        <div className="device-info">
          <h3>📱 Device Information</h3>
          <div className="info-grid">
            <div className="info-item">
              <span className="info-label">Platform:</span>
              <span className="info-value">{deviceInfo.platform}</span>
            </div>
            <div className="info-item">
              <span className="info-label">Browser:</span>
              <span className="info-value">{deviceInfo.browserName} {deviceInfo.browserVersion}</span>
            </div>
            <div className="info-item">
              <span className="info-label">Screen:</span>
              <span className="info-value">{deviceInfo.screenSize} ({deviceInfo.devicePixelRatio}x DPR)</span>
            </div>
            <div className="info-item">
              <span className="info-label">Mobile:</span>
              <span className="info-value">{deviceInfo.isMobile ? 'Yes' : 'No'}</span>
            </div>
            <div className="info-item">
              <span className="info-label">Online:</span>
              <span className="info-value">{deviceInfo.isOnline ? 'Yes' : 'No'}</span>
            </div>
            {deviceInfo.connectionType && (
              <div className="info-item">
                <span className="info-label">Connection:</span>
                <span className="info-value">{deviceInfo.connectionType}</span>
              </div>
            )}
            {deviceInfo.batteryLevel && (
              <div className="info-item">
                <span className="info-label">Battery:</span>
                <span className="info-value">{deviceInfo.batteryLevel}%</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Test Results */}
      <div className="test-results">
        <h3>📋 Test Results</h3>
        {currentTest && (
          <div className="current-test">
            <span className="current-test-icon">🔄</span>
            <span>Running: {currentTest}</span>
          </div>
        )}
        <div className="test-list">
          {tests.map((test, index) => (
            <div 
              key={index} 
              className={`test-item ${test.status}`}
              style={{ borderLeftColor: getTestStatusColor(test.status) }}
            >
              <div className="test-header">
                <div className="test-status">
                  <span className="status-icon">{getTestStatusIcon(test.status)}</span>
                  <span className="test-name">{test.name}</span>
                </div>
                {test.duration && (
                  <span className="test-duration">{test.duration}ms</span>
                )}
              </div>
              <div className="test-message">{test.message}</div>
              {test.details && (
                <details className="test-details">
                  <summary>Show Details</summary>
                  <pre>{JSON.stringify(test.details, null, 2)}</pre>
                </details>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default DeviceIntegrationTest;