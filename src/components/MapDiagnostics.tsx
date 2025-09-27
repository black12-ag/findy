import React, { useEffect, useState } from 'react';
import { useLocation } from '../contexts/LocationContext';
import { useNavigation } from '../contexts/NavigationContext';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { toast } from 'sonner';

export function MapDiagnostics() {
  const location = useLocation();
  const navigation = useNavigation();
  const [diagnostics, setDiagnostics] = useState<any>({});
  const [refreshCount, setRefreshCount] = useState(0);

  useEffect(() => {
    const runDiagnostics = async () => {
      const diag: any = {
        timestamp: new Date().toISOString(),
        browser: {
          userAgent: navigator.userAgent,
          platform: navigator.platform,
          language: navigator.language,
        },
        location: {
          locationContext: {
            hasCurrentLocation: !!location.currentLocation,
            currentLocation: location.currentLocation,
            permissionStatus: location.permissionStatus,
            isTracking: location.isTrackingLocation,
            error: location.locationError,
          },
          navigationContext: {
            hasCurrentLocation: !!navigation.currentLocation,
            currentLocation: navigation.currentLocation,
          },
          geolocationAPI: {
            available: 'geolocation' in navigator,
            permissions: null,
          }
        },
        mapLibre: {
          loaded: typeof window !== 'undefined' && 'maplibregl' in window,
          version: (window as any).maplibregl?.version || 'not loaded',
        },
        environment: {
          mode: import.meta.env.MODE,
          dev: import.meta.env.DEV,
          prod: import.meta.env.PROD,
          base: import.meta.env.BASE_URL,
        },
        localStorage: {
          hasOnboarding: !!localStorage.getItem('pathfinder_onboarding_complete'),
          hasSavedPlaces: !!localStorage.getItem('saved_places'),
          hasRouteHistory: !!localStorage.getItem('route_history'),
        }
      };

      // Check geolocation permissions
      if ('permissions' in navigator) {
        try {
          const result = await navigator.permissions.query({ name: 'geolocation' });
          diag.location.geolocationAPI.permissions = result.state;
        } catch (e) {
          diag.location.geolocationAPI.permissions = 'error checking';
        }
      }

      setDiagnostics(diag);
    };

    runDiagnostics();
  }, [refreshCount]); // Run when refresh is triggered

  const testGeolocation = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation not supported');
      return;
    }

    toast.loading('Testing geolocation...');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        toast.success(`Location found: ${position.coords.latitude}, ${position.coords.longitude}`);
        console.log('Geolocation test success:', position);
      },
      (error) => {
        toast.error(`Geolocation error: ${error.message}`);
        console.error('Geolocation test error:', error);
      },
      {
        enableHighAccuracy: false,
        timeout: 10000,
        maximumAge: 30000
      }
    );
  };

  const forceDefaultLocation = () => {
    const defaultLoc = {
      id: 'forced',
      name: 'San Francisco (Default)',
      address: 'San Francisco, CA',
      lat: 37.7749,
      lng: -122.4194,
    };
    
    navigation.setCurrentLocation(defaultLoc);
    toast.success('Default location set');
  };

  return (
    <Card className="absolute top-4 right-4 p-4 w-96 max-h-[600px] overflow-auto bg-white/95 backdrop-blur z-50">
      <h3 className="font-bold mb-3">Map Diagnostics</h3>
      
      <div className="space-y-3 text-sm">
        <div>
          <h4 className="font-semibold">Location Status:</h4>
          <div className="pl-2 space-y-1">
            <div>LocationContext: {location.currentLocation ? '✅ Has location' : '❌ No location'}</div>
            <div>NavigationContext: {navigation.currentLocation ? '✅ Has location' : '❌ No location'}</div>
            <div>Permission: {location.permissionStatus}</div>
            <div>Tracking: {location.isTrackingLocation ? 'Yes' : 'No'}</div>
            {location.locationError && <div className="text-red-600">Error: {location.locationError}</div>}
          </div>
        </div>

        {location.currentLocation && (
          <div>
            <h4 className="font-semibold">Current Position:</h4>
            <div className="pl-2">
              <div>Lat: {location.currentLocation.lat.toFixed(6)}</div>
              <div>Lng: {location.currentLocation.lng.toFixed(6)}</div>
              <div>Accuracy: {location.currentLocation.accuracy}m</div>
            </div>
          </div>
        )}

        <div>
          <h4 className="font-semibold">MapLibre Status:</h4>
          <div className="pl-2">
            <div>Loaded: {diagnostics.mapLibre?.loaded ? '✅ Yes' : '❌ No'}</div>
            <div>Version: {diagnostics.mapLibre?.version}</div>
          </div>
        </div>

        <div>
          <h4 className="font-semibold">Environment:</h4>
          <div className="pl-2">
            <div>Mode: {diagnostics.environment?.mode}</div>
            <div>Dev Mode: {diagnostics.environment?.dev ? 'Yes' : 'No'}</div>
          </div>
        </div>

        <div>
          <h4 className="font-semibold">Browser:</h4>
          <div className="pl-2">
            <div>Geolocation API: {diagnostics.location?.geolocationAPI?.available ? '✅ Available' : '❌ Not available'}</div>
            <div>Permissions: {diagnostics.location?.geolocationAPI?.permissions}</div>
          </div>
        </div>

        <div className="pt-3 space-y-2">
          <Button 
            onClick={() => setRefreshCount(c => c + 1)}
            size="sm"
            variant="outline"
            className="w-full"
          >
            🔄 Refresh Diagnostics
          </Button>
          
          <Button 
            onClick={testGeolocation}
            size="sm"
            variant="outline"
            className="w-full"
          >
            Test Geolocation API
          </Button>
          
          <Button 
            onClick={forceDefaultLocation}
            size="sm"
            variant="outline"
            className="w-full"
          >
            Force Default Location
          </Button>
          
          <Button 
            onClick={() => location.startLocationTracking()}
            size="sm"
            variant="outline"
            className="w-full"
          >
            Start Location Tracking
          </Button>
          
          <Button 
            onClick={() => {
              console.log('Full diagnostics:', diagnostics);
              toast.info('Check console for full diagnostics');
            }}
            size="sm"
            variant="outline"
            className="w-full"
          >
            Log Full Diagnostics
          </Button>
        </div>
      </div>
    </Card>
  );
}