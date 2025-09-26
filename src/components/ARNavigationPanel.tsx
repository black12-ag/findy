import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Camera, 
  Navigation, 
  MapPin, 
  Battery, 
  AlertTriangle,
  Zap,
  Eye,
  EyeOff,
  Settings,
  Compass,
  Target,
  Bookmark
} from 'lucide-react';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Switch } from './ui/switch';
import { useAR } from '../services/arService';
import { enhancedARService, ARTrackingState, RecognizedObject } from '../services/enhancedARService';
import { logger } from '../utils/logger';
import { toast } from 'sonner';
import { useLoading } from '../contexts/LoadingContext';

interface Location {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  category?: string;
}

interface Route {
  id: string;
  from: Location;
  to: Location;
  distance: string;
  duration: string;
  mode: string;
  steps: string[];
}

interface ARNavigationPanelProps {
  route: Route | null;
  onClose: () => void;
}

export function ARNavigationPanel({ route, onClose }: ARNavigationPanelProps) {
  const {
    viewState,
    markers,
    direction,
    deviceOrientation,
    isSupported,
    startAR,
    stopAR,
    addMarker,
    setNavigationDirection,
    calibrateCompass
  } = useAR();
  
  const { startLoading, stopLoading } = useLoading();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [batteryLevel, setBatteryLevel] = useState(78);
  const [showCalibration, setShowCalibration] = useState(false);
  const [enhancedFeaturesEnabled, setEnhancedFeaturesEnabled] = useState(false);
  const [trackingState, setTrackingState] = useState<ARTrackingState>({
    confidence: 0,
    stabilityScore: 0,
    trackingLost: false,
    relocalizationProgress: 0
  });
  const [recognizedObjects, setRecognizedObjects] = useState<RecognizedObject[]>([]);

  // Initialize AR when component mounts and route is available
  useEffect(() => {
    const initAR = async () => {
      if (route && videoRef.current && !viewState.isActive) {
        startLoading('Starting AR camera...');
        try {
          await startAR(videoRef.current);
          
          // Initialize enhanced AR features
          try {
            await enhancedARService.initialize();
            setEnhancedFeaturesEnabled(true);
            toast.success('Enhanced AR features enabled');
            logger.info('Enhanced AR features initialized');
          } catch (error) {
            logger.warn('Enhanced AR features unavailable, using basic AR:', error);
          }
          
          // Set up navigation direction
          setNavigationDirection(
            45, // bearing to destination
            150, // distance in meters
            'Turn right on Market St',
            90 // turn angle
          );
          
          // Add some sample POI markers
          addMarker({
            id: 'poi-1',
            name: 'Starbucks',
            type: 'poi',
            position: { lat: 37.7849, lng: -122.4194 },
            color: '#10B981',
            description: 'Coffee shop'
          });
          
          addMarker({
            id: 'poi-2', 
            name: 'ATM',
            type: 'poi',
            position: { lat: 37.7849, lng: -122.4184 },
            color: '#3B82F6',
            description: 'ATM machine'
          });
        } catch (error) {
          logger.error('Failed to initialize AR:', error);
          toast.error('Failed to initialize AR camera. Please check permissions.');
        } finally {
          stopLoading();
        }
      }
    };

    if (isSupported.camera && isSupported.sensors && isSupported.location) {
      initAR();
    }

    return () => {
      if (viewState.isActive) {
        stopAR();
      }
      if (enhancedFeaturesEnabled) {
        enhancedARService.cleanup();
      }
    };
  }, [route, isSupported]);

  // Enhanced AR processing loop
  useEffect(() => {
    if (enhancedFeaturesEnabled && viewState.isActive && videoRef.current && canvasRef.current) {
      const processFrames = async () => {
        try {
          // Process frame for object recognition
          const objects = await enhancedARService.processFrame(
            videoRef.current!,
            canvasRef.current!
          );
          setRecognizedObjects(objects);
          
          // Update tracking state
          const tracking = enhancedARService.getTrackingState();
          setTrackingState(tracking);
        } catch (error) {
          logger.error('Enhanced AR processing error:', error);
        }
      };
      
      const interval = setInterval(processFrames, 100); // 10 FPS
      return () => clearInterval(interval);
    }
  }, [enhancedFeaturesEnabled, viewState.isActive]);
  
  // Simulate battery drain
  useEffect(() => {
    const interval = setInterval(() => {
      setBatteryLevel(prev => Math.max(prev - 0.1, 0));
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Show calibration dialog if needed
  useEffect(() => {
    if (viewState.calibrationStatus === 'calibrating' && !showCalibration) {
      setShowCalibration(true);
    }
  }, [viewState.calibrationStatus, showCalibration]);

  if (!route) {
    return (
      <div className="h-full bg-black flex items-center justify-center">
        <div className="text-center text-white">
          <Camera className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p className="opacity-75">No active route for AR navigation</p>
        </div>
      </div>
    );
  }

  if (!isSupported.camera || !isSupported.sensors || !isSupported.location) {
    return (
      <div className="h-full bg-black flex items-center justify-center">
        <div className="text-center text-white max-w-md mx-auto p-6">
          <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-red-400" />
          <h3 className="text-lg font-medium mb-2">AR Not Supported</h3>
          <p className="opacity-75 mb-4">
            AR navigation requires camera, device sensors, and location access.
          </p>
          <div className="text-sm space-y-1">
            <div className={`flex items-center justify-between ${
              isSupported.camera ? 'text-green-400' : 'text-red-400'
            }`}>
              <span>Camera</span>
              <span>{isSupported.camera ? '✓' : '✗'}</span>
            </div>
            <div className={`flex items-center justify-between ${
              isSupported.sensors ? 'text-green-400' : 'text-red-400'
            }`}>
              <span>Device Sensors</span>
              <span>{isSupported.sensors ? '✓' : '✗'}</span>
            </div>
            <div className={`flex items-center justify-between ${
              isSupported.location ? 'text-green-400' : 'text-red-400'
            }`}>
              <span>Location</span>
              <span>{isSupported.location ? '✓' : '✗'}</span>
            </div>
          </div>
          <Button
            className="mt-4"
            onClick={onClose}
            variant="outline"
          >
            Back to Map
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-black relative overflow-hidden">
      {/* Real Camera Feed */}
      <video
        ref={videoRef}
        className="absolute inset-0 w-full h-full object-cover"
        playsInline
        muted
        autoPlay
      />
      
      {/* Hidden canvas for enhanced AR processing */}
      <canvas
        ref={canvasRef}
        className="hidden"
        width={640}
        height={480}
      />
      
      {/* Loading overlay when camera is not ready */}
      {!viewState.cameraReady && (
        <div className="absolute inset-0 bg-black flex items-center justify-center">
          <div className="text-center text-white">
            <Camera className="w-12 h-12 mx-auto mb-4 animate-pulse" />
            <p>Starting camera...</p>
          </div>
        </div>
      )}
      
      {/* Calibration overlay */}
      {showCalibration && (
        <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-40">
          <Card className="p-6 bg-white text-black max-w-sm">
            <div className="text-center">
              <Compass className="w-12 h-12 mx-auto mb-4 text-blue-600" />
              <h3 className="text-lg font-medium mb-2">Compass Calibration</h3>
              <p className="text-sm text-gray-600 mb-4">
                Move your device in a figure-8 pattern to calibrate the compass for accurate AR navigation.
              </p>
              <div className="space-y-2">
                <div className="text-sm">
                  <span>Heading: {deviceOrientation.heading?.toFixed(0) || '--'}°</span>
                </div>
                <div className="text-sm">
                  <span>Status: {viewState.calibrationStatus}</span>
                </div>
              </div>
              <Button
                className="mt-4 w-full"
                onClick={() => {
                  calibrateCompass(0); // Assume north for now
                  setShowCalibration(false);
                }}
              >
                Skip Calibration
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Top Status Bar */}
      <div className="absolute top-0 left-0 right-0 z-50 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/20"
              onClick={onClose}
            >
              <X className="w-5 h-5" />
            </Button>
            <div className="text-white">
              <div className="text-sm font-medium">AR Walking</div>
              <div className="text-xs opacity-75">{route.to.name}</div>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {/* Enhanced AR Status */}
            {enhancedFeaturesEnabled && (
              <div className={`flex items-center gap-1 text-xs px-2 py-1 rounded ${
                trackingState.trackingLost ? 'bg-red-500/80' : 'bg-green-500/80'
              }`}>
                <Target className="w-3 h-3" />
                <span>{trackingState.trackingLost ? 'Lost' : Math.round(trackingState.confidence * 100) + '%'}</span>
              </div>
            )}
            
            <div className={`flex items-center gap-1 text-white text-sm ${
              batteryLevel < 20 ? 'text-red-400' : ''
            }`}>
              <Battery className="w-4 h-4" />
              <span>{Math.round(batteryLevel)}%</span>
            </div>
            
            <Button
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/20"
              onClick={() => setIsARActive(!isARActive)}
            >
              {isARActive ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
            </Button>
          </div>
        </div>
      </div>

      {/* AR Direction Arrow */}
      {viewState.isActive && direction && (
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-40">
          <div className="relative">
            {/* Large directional arrow */}
            <div className="w-20 h-20 bg-blue-500 rounded-full flex items-center justify-center shadow-lg animate-pulse">
              <Navigation 
                className="w-10 h-10 text-white" 
                style={{ transform: `rotate(${direction.turnAngle || 0}deg)` }}
              />
            </div>
            
            {/* Distance indicator */}
            <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 bg-black/80 rounded-lg px-3 py-1">
              <span className="text-white text-sm font-medium">
                {direction.distance < 1000 
                  ? `${Math.round(direction.distance)}m`
                  : `${(direction.distance / 1000).toFixed(1)}km`
                }
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Direction Instructions */}
      {direction && (
        <Card className="absolute top-20 left-4 right-4 bg-black/80 border-gray-600 text-white z-30">
          <div className="p-4">
            <div className="flex items-center gap-3">
              <Navigation className="w-6 h-6 text-blue-400" />
              <div>
                <div className="font-medium">{direction.instruction}</div>
                <div className="text-sm opacity-75">
                  in {direction.distance < 1000 
                    ? `${Math.round(direction.distance)}m`
                    : `${(direction.distance / 1000).toFixed(1)}km`
                  }
                </div>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Recognized Objects Overlay */}
      {enhancedFeaturesEnabled && viewState.isActive && (
        <div className="absolute inset-0 z-25">
          {recognizedObjects.map((obj) => (
            <div
              key={obj.id}
              className="absolute pointer-events-none"
              style={{
                left: obj.boundingBox.x,
                top: obj.boundingBox.y,
                width: obj.boundingBox.width,
                height: obj.boundingBox.height,
              }}
            >
              {/* Bounding box */}
              <div className={`absolute inset-0 border-2 rounded ${
                obj.type === 'traffic_sign' ? 'border-red-400' :
                obj.type === 'landmark' ? 'border-blue-400' :
                obj.type === 'vehicle' ? 'border-yellow-400' :
                'border-green-400'
              }`} />
              
              {/* Object label */}
              <div className={`absolute -top-6 left-0 px-2 py-1 text-xs rounded ${
                obj.type === 'traffic_sign' ? 'bg-red-500/80' :
                obj.type === 'landmark' ? 'bg-blue-500/80' :
                obj.type === 'vehicle' ? 'bg-yellow-500/80' :
                'bg-green-500/80'
              } text-white`}>
                {obj.type === 'traffic_sign' && obj.metadata?.signType && (
                  <span>🚦 {obj.metadata.signType.replace('_', ' ')}</span>
                )}
                {obj.type === 'landmark' && (
                  <span>🏗️ {obj.metadata?.text || 'Landmark'}</span>
                )}
                {obj.type === 'vehicle' && (
                  <span>🚗 Vehicle</span>
                )}
                <span className="ml-1">({Math.round(obj.confidence * 100)}%)</span>
              </div>
            </div>
          ))}
        </div>
      )}
      
      {/* AR POI Markers */}
      {viewState.isActive && (
        <div className="absolute inset-0 z-20">
          {markers
            .filter(marker => marker.isVisible && marker.screenPosition)
            .map((marker) => (
              <div
                key={marker.id}
                className="absolute pointer-events-none"
                style={{
                  left: `${marker.screenPosition!.x}px`,
                  top: `${marker.screenPosition!.y}px`,
                  transform: 'translate(-50%, -50%)'
                }}
              >
                <div className="bg-white/90 rounded-lg px-3 py-2 shadow-lg">
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: marker.color }}
                    ></div>
                    <div>
                      <div className="text-sm font-medium text-gray-900">{marker.name}</div>
                      <div className="text-xs text-gray-600">
                        {marker.screenPosition!.distance < 1000
                          ? `${Math.round(marker.screenPosition!.distance)}m`
                          : `${(marker.screenPosition!.distance / 1000).toFixed(1)}km`
                        }
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Line connecting to POI */}
                <div className="absolute top-full left-1/2 w-px h-8 bg-white/50"></div>
              </div>
            ))
          }
        </div>
      )}

      {/* Status indicators for device stability */}
      {viewState.isActive && !deviceOrientation.isStable && (
        <Card className="absolute top-1/4 left-4 right-4 bg-yellow-900/90 border-yellow-600 text-white z-40">
          <div className="p-3">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-yellow-400" />
              <div>
                <div className="font-medium">Hold Device Steady</div>
                <div className="text-sm opacity-75">Keep your device level for better AR tracking</div>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Bottom Controls */}
      <div className="absolute bottom-0 left-0 right-0 z-30">
        <Card className="m-4 bg-black/80 border-gray-600 text-white">
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="font-medium">AR Walking Navigation</div>
                <div className="text-sm opacity-75">3 min remaining • 0.2 mi</div>
              </div>
              <div className="flex gap-2">
                {enhancedFeaturesEnabled && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-white hover:bg-white/20"
                    onClick={async () => {
                      try {
                        const anchorId = await enhancedARService.createPersistentAnchor(
                          'waypoint',
                          { x: 0, y: 0, z: -100 }
                        );
                        toast.success('Waypoint saved');
                        logger.info('Created waypoint anchor:', anchorId);
                      } catch (error) {
                        toast.error('Failed to save waypoint');
                        logger.error('Failed to create anchor:', error);
                      }
                    }}
                    title="Save Waypoint"
                  >
                    <Bookmark className="w-5 h-5" />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-white hover:bg-white/20"
                >
                  <Settings className="w-5 h-5" />
                </Button>
              </div>
            </div>
            
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-yellow-400" />
                  <span className="text-sm">Low Battery Mode</span>
                </div>
                <Switch
                  checked={batteryLevel < 20}
                  onCheckedChange={() => {}}
                  disabled
                />
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Eye className="w-4 h-4 text-blue-400" />
                  <span className="text-sm">AR Overlays</span>
                </div>
                <Switch
                  checked={viewState.isActive}
                  onCheckedChange={(checked) => {
                    if (!checked) {
                      stopAR();
                    }
                  }}
                />
              </div>
              
              {enhancedFeaturesEnabled && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Target className="w-4 h-4 text-green-400" />
                      <span className="text-sm">Object Recognition</span>
                    </div>
                    <Switch
                      checked={recognizedObjects.length > 0}
                      onCheckedChange={() => {}}
                      disabled
                    />
                  </div>
                  
                  <div className="text-xs text-gray-400">
                    <div>Tracking: {trackingState.trackingLost ? '❌' : '✅'} {Math.round(trackingState.confidence * 100)}%</div>
                    <div>Objects: {recognizedObjects.length} detected</div>
                    <div>Stability: {Math.round(trackingState.stabilityScore * 100)}%</div>
                  </div>
                </div>
              )}
            </div>
            
            <div className="mt-4 pt-3 border-t border-gray-600">
              <Button
                variant="outline"
                size="sm"
                className="w-full border-gray-600 text-white hover:bg-white/10"
              >
                Switch to Map View
              </Button>
            </div>
          </div>
        </Card>
      </div>

      {/* Safety Warning */}
      {batteryLevel < 15 && (
        <Card className="absolute bottom-48 left-4 right-4 bg-red-900/90 border-red-600 text-white z-40">
          <div className="p-3">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-red-400" />
              <div>
                <div className="font-medium">Low Battery Warning</div>
                <div className="text-sm opacity-75">AR mode will disable soon to save power</div>
              </div>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}