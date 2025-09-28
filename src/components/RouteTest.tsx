import React, { useState } from 'react';
import { Button } from './ui/button';
import directionsService from '../services/directionsService';
import { logger } from '../utils/logger';
import { toast } from 'sonner';

export function RouteTest() {
  const [isTestingRoute, setIsTestingRoute] = useState(false);
  const [routeResult, setRouteResult] = useState<any>(null);

  const testSimpleRoute = async () => {
    setIsTestingRoute(true);
    setRouteResult(null);

    try {
      // Test route from San Francisco to Los Angeles
      const start = { lat: 37.7749, lng: -122.4194 }; // San Francisco
      const end = { lat: 34.0522, lng: -118.2437 };   // Los Angeles

      logger.info('Starting route test');
      toast.info('Testing route calculation...');

      const result = await directionsService.testRouting(start, end, 'driving');

      setRouteResult(result);
      logger.info('Route test completed', result);
      toast.success(`Route calculated! ${result.distance} in ${result.duration}`);

    } catch (error) {
      logger.error('Route test failed', error);
      toast.error('Route test failed: ' + error.message);
    } finally {
      setIsTestingRoute(false);
    }
  };

  return (
    <div className="p-4 bg-white rounded-lg shadow-lg max-w-md">
      <h3 className="text-lg font-semibold mb-4">Route Testing</h3>
      
      <Button 
        onClick={testSimpleRoute}
        disabled={isTestingRoute}
        className="w-full mb-4"
      >
        {isTestingRoute ? 'Testing Route...' : 'Test SF to LA Route'}
      </Button>

      {routeResult && (
        <div className="bg-gray-50 p-3 rounded">
          <h4 className="font-medium mb-2">Route Result:</h4>
          <p><strong>Distance:</strong> {routeResult.distance}</p>
          <p><strong>Duration:</strong> {routeResult.duration}</p>
          <p><strong>Mode:</strong> {routeResult.mode}</p>
          {routeResult.steps && (
            <div className="mt-2">
              <strong>Steps:</strong>
              <ul className="text-sm mt-1">
                {routeResult.steps.slice(0, 3).map((step: string, index: number) => (
                  <li key={index} className="truncate">• {step}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}