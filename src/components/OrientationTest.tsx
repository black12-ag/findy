import React, { useState, useEffect } from 'react';
import { DirectionalTransportIcon } from './DirectionalTransportIcon';

interface OrientationTestProps {
  isVisible?: boolean;
  onClose?: () => void;
}

export function OrientationTest({ isVisible = false, onClose }: OrientationTestProps) {
  const [orientation, setOrientation] = useState<{
    alpha: number | null; // compass heading
    beta: number | null;  // front-to-back tilt
    gamma: number | null; // left-to-right tilt
    absolute: boolean;
  }>({
    alpha: null,
    beta: null,
    gamma: null,
    absolute: false
  });
  
  const [permission, setPermission] = useState<string>('unknown');
  const [isSupported, setIsSupported] = useState(false);
  const [mockSpeed, setMockSpeed] = useState(0);
  const [transportMode, setTransportMode] = useState<'walking' | 'cycling' | 'driving' | 'transit'>('walking');

  useEffect(() => {
    // Check if device orientation is supported
    if ('DeviceOrientationEvent' in window) {
      setIsSupported(true);
      
      // Check if permission is needed (iOS 13+)
      if (typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
        setPermission('required');
      } else {
        setPermission('granted');
        startOrientationTracking();
      }
    }
  }, []);

  const requestPermission = async () => {
    try {
      const permissionState = await (DeviceOrientationEvent as any).requestPermission();
      setPermission(permissionState);
      
      if (permissionState === 'granted') {
        startOrientationTracking();
      }
    } catch (error) {
      console.error('Error requesting device orientation permission:', error);
      setPermission('denied');
    }
  };

  const startOrientationTracking = () => {
    const handleOrientation = (event: DeviceOrientationEvent) => {
      setOrientation({
        alpha: event.alpha, // compass heading (0-360°)
        beta: event.beta,   // front-to-back tilt (-180 to 180°)
        gamma: event.gamma, // left-to-right tilt (-90 to 90°)
        absolute: event.absolute || false
      });
    };

    window.addEventListener('deviceorientation', handleOrientation);
    
    return () => {
      window.removeEventListener('deviceorientation', handleOrientation);
    };
  };

  // Calculate compass heading (0° = North, clockwise)
  const compassHeading = orientation.alpha !== null 
    ? (360 - orientation.alpha) % 360 
    : 0;

  const getCompassDirection = (heading: number): string => {
    const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    const index = Math.round(heading / 45) % 8;
    return directions[index];
  };

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg p-6 max-w-md w-full max-h-[90vh] overflow-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">🧭 Orientation & Compass Test</h2>
          {onClose && (
            <button 
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 text-2xl leading-none"
            >
              ×
            </button>
          )}
        </div>
        
        {!isSupported && (
          <div className="bg-red-100 border border-red-300 rounded p-3 mb-4">
            <p className="text-red-700">Device orientation is not supported on this device/browser.</p>
          </div>
        )}
        
        {permission === 'required' && (
          <div className="mb-4">
            <p className="text-gray-600 mb-2">
              This app needs permission to access device orientation for compass functionality.
            </p>
            <button 
              onClick={requestPermission}
              className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
            >
              Grant Permission
            </button>
          </div>
        )}
        
        {permission === 'denied' && (
          <div className="bg-orange-100 border border-orange-300 rounded p-3 mb-4">
            <p className="text-orange-700">
              Permission denied. Some features may not work. Check your browser settings.
            </p>
          </div>
        )}
        
        {orientation.alpha !== null && (
          <div className="space-y-4">
            {/* Live directional icon */}
            <div className="flex justify-center">
              <DirectionalTransportIcon
                transportMode={transportMode}
                heading={compassHeading}
                size={120}
                showCompass={true}
                isMoving={mockSpeed > 0.5}
                speed={mockSpeed}
              />
            </div>
            
            {/* Transport mode selector */}
            <div className="flex gap-2 justify-center">
              {(['walking', 'cycling', 'driving', 'transit'] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setTransportMode(mode)}
                  className={`px-3 py-1 rounded text-sm ${
                    transportMode === mode
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>
            
            {/* Speed simulator */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Mock Speed: {mockSpeed.toFixed(1)} m/s ({(mockSpeed * 3.6).toFixed(1)} km/h)
              </label>
              <input
                type="range"
                min="0"
                max="20"
                step="0.5"
                value={mockSpeed}
                onChange={(e) => setMockSpeed(parseFloat(e.target.value))}
                className="w-full"
              />
            </div>
            
            {/* Orientation data */}
            <div className="bg-gray-50 rounded p-3 text-sm space-y-2">
              <div className="font-semibold">Compass Data:</div>
              <div>Heading: <span className="font-mono">{Math.round(compassHeading)}°</span> ({getCompassDirection(compassHeading)})</div>
              <div>Alpha (compass): <span className="font-mono">{orientation.alpha?.toFixed(1)}°</span></div>
              <div>Beta (tilt front/back): <span className="font-mono">{orientation.beta?.toFixed(1)}°</span></div>
              <div>Gamma (tilt left/right): <span className="font-mono">{orientation.gamma?.toFixed(1)}°</span></div>
              <div>Absolute: <span className="font-mono">{orientation.absolute.toString()}</span></div>
            </div>
            
            {/* Instructions */}
            <div className="text-xs text-gray-600">
              <p className="font-semibold mb-1">Instructions:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Hold your device flat and rotate to test compass</li>
                <li>The arrow should point in your facing direction</li>
                <li>Try different transport modes and speeds</li>
                <li>If heading doesn't change, compass may not be available</li>
              </ul>
            </div>
          </div>
        )}
        
        {permission === 'granted' && orientation.alpha === null && (
          <div className="bg-yellow-100 border border-yellow-300 rounded p-3">
            <p className="text-yellow-700">
              Permission granted but no orientation data received. This may be normal on desktop browsers.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default OrientationTest;