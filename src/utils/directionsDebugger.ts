/**
 * Debugging utility for Google Maps Directions rendering
 * Helps diagnose issues with route display
 */

import { logger } from './logger';

export class DirectionsDebugger {
  /**
   * Validate DirectionsResult structure
   */
  static validateDirectionsResult(result: any): { valid: boolean; issues: string[] } {
    const issues: string[] = [];

    if (!result) {
      issues.push('DirectionsResult is null or undefined');
      return { valid: false, issues };
    }

    if (!result.routes) {
      issues.push('DirectionsResult has no routes array');
    } else if (!Array.isArray(result.routes)) {
      issues.push('DirectionsResult.routes is not an array');
    } else if (result.routes.length === 0) {
      issues.push('DirectionsResult.routes array is empty');
    } else {
      // Check first route
      const route = result.routes[0];
      
      if (!route.legs) {
        issues.push('First route has no legs array');
      } else if (!Array.isArray(route.legs)) {
        issues.push('Route.legs is not an array');
      } else if (route.legs.length === 0) {
        issues.push('Route.legs array is empty');
      }

      if (!route.overview_polyline) {
        issues.push('Route missing overview_polyline');
      }

      if (!route.bounds) {
        issues.push('Route missing bounds');
      }
    }

    return {
      valid: issues.length === 0,
      issues
    };
  }

  /**
   * Validate DirectionsRenderer state
   */
  static validateRenderer(renderer: google.maps.DirectionsRenderer | null): { valid: boolean; issues: string[] } {
    const issues: string[] = [];

    if (!renderer) {
      issues.push('DirectionsRenderer is null');
      return { valid: false, issues };
    }

    try {
      const map = renderer.getMap();
      if (!map) {
        issues.push('DirectionsRenderer not attached to map');
      }

      const directions = renderer.getDirections();
      if (!directions) {
        issues.push('DirectionsRenderer has no directions set');
      }
    } catch (error) {
      issues.push(`Error accessing renderer properties: ${error}`);
    }

    return {
      valid: issues.length === 0,
      issues
    };
  }

  /**
   * Log complete diagnostic information
   */
  static logDiagnostics(
    renderer: google.maps.DirectionsRenderer | null,
    result: any,
    map: google.maps.Map | null
  ): void {
    logger.group('🔍 Directions Rendering Diagnostics');

    // Check map
    if (map) {
      logger.info('✅ Map instance exists', {
        center: map.getCenter()?.toJSON(),
        zoom: map.getZoom(),
        mapTypeId: map.getMapTypeId()
      });
    } else {
      logger.error('❌ Map instance is null');
    }

    // Check DirectionsResult
    const resultValidation = this.validateDirectionsResult(result);
    if (resultValidation.valid) {
      logger.info('✅ DirectionsResult is valid', {
        routeCount: result.routes.length,
        firstRouteLegCount: result.routes[0].legs.length,
        distance: result.routes[0].legs[0].distance?.text,
        duration: result.routes[0].legs[0].duration?.text
      });
    } else {
      logger.error('❌ DirectionsResult validation failed', resultValidation.issues);
    }

    // Check DirectionsRenderer
    const rendererValidation = this.validateRenderer(renderer);
    if (rendererValidation.valid) {
      logger.info('✅ DirectionsRenderer is valid and attached');
      
      // Additional renderer info
      try {
        const rendererMap = renderer!.getMap();
        const rendererDirections = renderer!.getDirections();
        
        logger.info('Renderer state:', {
          hasMap: !!rendererMap,
          mapsMatch: rendererMap === map,
          hasDirections: !!rendererDirections,
          directionsMatch: rendererDirections === result
        });
      } catch (error) {
        logger.error('Error getting renderer state:', error);
      }
    } else {
      logger.error('❌ DirectionsRenderer validation failed', rendererValidation.issues);
    }

    // Check for common issues
    this.checkCommonIssues(renderer, result, map);

    logger.groupEnd();
  }

  /**
   * Check for common issues that prevent route display
   */
  private static checkCommonIssues(
    renderer: google.maps.DirectionsRenderer | null,
    result: any,
    map: google.maps.Map | null
  ): void {
    logger.group('Common Issues Check');

    // Issue 1: Renderer created but not attached to map
    if (renderer && !renderer.getMap() && map) {
      logger.warn('⚠️ Issue detected: Renderer exists but not attached to map');
      logger.info('Fix: Call renderer.setMap(map)');
    }

    // Issue 2: Directions set before map attachment
    if (renderer && renderer.getDirections() && !renderer.getMap()) {
      logger.warn('⚠️ Issue detected: Directions set but renderer not on map');
      logger.info('Fix: Attach renderer to map first, then set directions');
    }

    // Issue 3: Multiple renderers created
    if (window._directionsRendererCount && window._directionsRendererCount > 1) {
      logger.warn('⚠️ Issue detected: Multiple DirectionsRenderer instances created');
      logger.info('Fix: Reuse the same renderer instance');
    }

    // Issue 4: Route polyline options issue
    if (renderer) {
      try {
        // @ts-ignore - accessing private property for debugging
        const options = renderer.polylineOptions || renderer.options?.polylineOptions;
        if (!options || !options.strokeColor) {
          logger.warn('⚠️ Issue detected: Polyline options might not be set');
          logger.info('Fix: Set polylineOptions when creating renderer');
        }
      } catch (e) {
        // Ignore access errors
      }
    }

    // Issue 5: Map bounds not fitting route
    if (result && result.routes?.length > 0 && map) {
      const bounds = new google.maps.LatLngBounds();
      result.routes[0].legs.forEach((leg: any) => {
        bounds.extend(leg.start_location);
        bounds.extend(leg.end_location);
      });
      
      const mapBounds = map.getBounds();
      if (mapBounds && !mapBounds.contains(bounds.getCenter())) {
        logger.warn('⚠️ Issue detected: Map not centered on route');
        logger.info('Fix: Call map.fitBounds(routeBounds)');
      }
    }

    logger.groupEnd();
  }

  /**
   * Try to fix common issues automatically
   */
  static attemptAutoFix(
    renderer: google.maps.DirectionsRenderer | null,
    result: any,
    map: google.maps.Map | null
  ): boolean {
    logger.info('🔧 Attempting auto-fix for directions display issues...');

    if (!renderer || !result || !map) {
      logger.error('Cannot auto-fix: Missing required objects');
      return false;
    }

    try {
      // Ensure renderer is attached to map
      if (renderer.getMap() !== map) {
        logger.info('Attaching renderer to map...');
        renderer.setMap(map);
      }

      // Re-set directions
      logger.info('Re-setting directions on renderer...');
      renderer.setDirections(result);

      // Fit bounds
      if (result.routes?.length > 0) {
        const bounds = new google.maps.LatLngBounds();
        result.routes[0].legs.forEach((leg: any) => {
          bounds.extend(leg.start_location);
          bounds.extend(leg.end_location);
        });
        
        logger.info('Fitting map bounds to route...');
        map.fitBounds(bounds, { top: 50, right: 50, bottom: 50, left: 50 });
      }

      logger.info('✅ Auto-fix completed successfully');
      return true;
    } catch (error) {
      logger.error('❌ Auto-fix failed:', error);
      return false;
    }
  }
}

// Track renderer instances for debugging
declare global {
  interface Window {
    _directionsRendererCount?: number;
  }
}

// Hook to track renderer creation
if (typeof window !== 'undefined') {
  window._directionsRendererCount = 0;
}

export default DirectionsDebugger;