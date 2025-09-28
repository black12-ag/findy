/**
 * 🌐 Centralized Google Maps Loader
 * 
 * Single source of truth for Google Maps API initialization
 * Prevents loader conflicts between different services
 */

import { Loader } from '@googlemaps/js-api-loader';
import { logger } from '../utils/logger';

class GoogleMapsLoader {
  private static instance: GoogleMapsLoader | null = null;
  private loader: Loader | null = null;
  private isLoaded = false;
  private loadPromise: Promise<void> | null = null;

  private constructor() {
    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    if (!apiKey || apiKey === 'YOUR_GOOGLE_MAPS_API_KEY_HERE') {
      logger.warn('Google Maps API key not configured');
      return;
    }

    // Single loader configuration with all needed libraries
    this.loader = new Loader({
      apiKey,
      version: 'weekly',
      libraries: ['places', 'geometry', 'geocoding', 'drawing', 'marker']
    });
  }

  public static getInstance(): GoogleMapsLoader {
    if (!GoogleMapsLoader.instance) {
      GoogleMapsLoader.instance = new GoogleMapsLoader();
    }
    return GoogleMapsLoader.instance;
  }

  /**
   * Load Google Maps API (singleton pattern)
   */
  public async load(): Promise<void> {
    if (this.isLoaded) {
      return Promise.resolve();
    }

    if (this.loadPromise) {
      return this.loadPromise;
    }

    if (!this.loader) {
      throw new Error('Google Maps loader not initialized');
    }

    this.loadPromise = this.loader.load().then(() => {
      this.isLoaded = true;
      logger.info('Google Maps API loaded successfully');
    }).catch((error) => {
      logger.error('Failed to load Google Maps API:', error);
      this.loadPromise = null; // Reset so we can try again
      throw error;
    });

    return this.loadPromise;
  }

  /**
   * Check if Google Maps API is loaded
   */
  public isGoogleMapsLoaded(): boolean {
    return this.isLoaded && typeof google !== 'undefined' && !!google.maps;
  }

  /**
   * Wait for Google Maps to be loaded with timeout
   */
  public async waitForGoogleMaps(timeout = 10000): Promise<boolean> {
    if (this.isGoogleMapsLoaded()) {
      return true;
    }

    try {
      // Try to load if not already loaded
      await this.load();
      
      // Wait for global google object with timeout
      const startTime = Date.now();
      while (!this.isGoogleMapsLoaded() && Date.now() - startTime < timeout) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      return this.isGoogleMapsLoaded();
    } catch (error) {
      logger.error('Failed to wait for Google Maps:', error);
      return false;
    }
  }
}

// Export singleton instance
export const googleMapsLoader = GoogleMapsLoader.getInstance();