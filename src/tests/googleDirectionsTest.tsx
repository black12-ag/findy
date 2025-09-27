import React, { useEffect, useState } from 'react';
import { GoogleMapView } from '../components/GoogleMapView';
import { Location } from '../types/location';
import { logger } from '../utils/logger';
import { Button } from '../components/ui/button';
import { toast } from 'sonner';

/**
 * Test component to verify Google Maps Directions rendering
 * This component tests the route display functionality in GoogleMapView
 */
export function GoogleDirectionsTest() {
  const [currentLocation, setCurrentLocation] = useState<Location | null>(null);
  const [destinationLocation, setDestinationLocation] = useState<Location | null>(null);
  const [route, setRoute] = useState<any>(null);
  const [transportMode, setTransportMode] = useState<'driving' | 'walking' | 'cycling' | 'transit'>('driving');
  const [testStatus, setTestStatus] = useState<string>('initializing');

  // Initialize test locations
  useEffect(() => {
    // Set test locations (San Francisco area)
    const testCurrent: Location = {
      id: 'test_current',
      name: 'Golden Gate Bridge',
      address: 'Golden Gate Bridge, San Francisco, CA',
      lat: 37.8199,
      lng: -122.4783,
    };

    const testDestination: Location = {
      id: 'test_dest',
      name: 'Fisherman\'s Wharf',
      address: 'Fisherman\'s Wharf, San Francisco, CA',
      lat: 37.8080,
      lng: -122.4177,
    };

    setCurrentLocation(testCurrent);
    setDestinationLocation(testDestination);
    setTestStatus('locations_set');

    logger.info('Test locations initialized', {
      current: testCurrent,
      destination: testDestination
    });
  }, []);

  // Handle route calculation from GoogleMapView
  const handleRouteCalculated = (directionsResult: any) => {
    logger.info('Route calculated in test component', {
      hasResult: !!directionsResult,
      routeCount: directionsResult?.routes?.length,
      firstRoute: directionsResult?.routes?.[0],
    });

    if (directionsResult && directionsResult.routes && directionsResult.routes.length > 0) {
      setRoute({
        googleDirectionsResult: directionsResult,
        distance: directionsResult.routes[0].legs[0].distance?.text,
        duration: directionsResult.routes[0].legs[0].duration?.text,
      });
      setTestStatus('route_calculated');
      toast.success('Route calculated successfully!');
    } else {
      setTestStatus('route_failed');
      toast.error('Failed to calculate route');
    }
  };

  // Trigger route calculation
  const requestRoute = () => {
    if (currentLocation && destinationLocation) {
      setTestStatus('requesting_route');
      logger.info('Requesting route calculation', {
        from: currentLocation,
        to: destinationLocation,
        mode: transportMode
      });
    }
  };

  // Change transport mode
  const changeTransportMode = (mode: 'driving' | 'walking' | 'cycling' | 'transit') => {
    setTransportMode(mode);
    setRoute(null);
    setTestStatus('mode_changed');
    logger.info('Transport mode changed to', mode);
  };

  return (
    <div className="h-screen w-full flex flex-col">
      {/* Test Controls */}
      <div className="bg-white border-b p-4">
        <h2 className="text-lg font-semibold mb-3">Google Directions Test</h2>
        
        <div className="space-y-3">
          {/* Status Display */}
          <div className="p-3 bg-gray-50 rounded">
            <p className="text-sm font-medium">Test Status: <span className="text-blue-600">{testStatus}</span></p>
            {route && (
              <div className="mt-2">
                <p className="text-sm">Route: {route.distance} in {route.duration}</p>
              </div>
            )}
          </div>

          {/* Transport Mode Selector */}
          <div className="flex gap-2">
            {(['driving', 'walking', 'cycling', 'transit'] as const).map(mode => (
              <Button
                key={mode}
                size="sm"
                variant={transportMode === mode ? 'default' : 'outline'}
                onClick={() => changeTransportMode(mode)}
              >
                {mode}
              </Button>
            ))}
          </div>

          {/* Route Actions */}
          <div className="flex gap-2">
            <Button
              onClick={requestRoute}
              disabled={!currentLocation || !destinationLocation}
            >
              Calculate Test Route
            </Button>
            
            <Button
              variant="outline"
              onClick={() => {
                setRoute(null);
                setTestStatus('route_cleared');
                toast.info('Route cleared');
              }}
            >
              Clear Route
            </Button>
          </div>

          {/* Test Locations Info */}
          <div className="text-xs text-gray-600">
            <p>From: {currentLocation?.name || 'Not set'}</p>
            <p>To: {destinationLocation?.name || 'Not set'}</p>
          </div>
        </div>
      </div>

      {/* Map Container */}
      <div className="flex-1">
        <GoogleMapView
          currentLocation={currentLocation}
          selectedLocation={destinationLocation}
          route={route}
          transportMode={transportMode}
          isNavigating={false}
          centerSignal={0}
          onLocationSelect={(location) => {
            logger.info('Location selected in test', location);
            setDestinationLocation(location);
          }}
          onRouteRequest={(from, to) => {
            logger.info('Route requested in test', { from, to });
            // The GoogleMapView will handle the actual route calculation
          }}
          onRouteCalculated={handleRouteCalculated}
          onMapReady={(map) => {
            logger.info('Map ready in test component');
            setTestStatus('map_ready');
            
            // Auto-trigger route calculation after map loads
            setTimeout(() => {
              if (currentLocation && destinationLocation) {
                requestRoute();
              }
            }, 2000);
          }}
        />
      </div>
    </div>
  );
}

export default GoogleDirectionsTest;