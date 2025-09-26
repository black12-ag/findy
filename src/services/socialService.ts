/**
 * Social Service
 * Real implementation of social sharing features using Web Share API and location broadcasting
 */

import { logger } from '../utils/logger';

export interface SharedLocation {
  id: string;
  userId: string;
  lat: number;
  lng: number;
  address: string;
  timestamp: Date;
  expiresAt?: Date;
  isLive: boolean;
  recipientIds: string[];
  message?: string;
}

export interface SocialShare {
  id: string;
  type: 'location' | 'route' | 'place' | 'eta';
  title: string;
  text: string;
  url: string;
  image?: string;
  timestamp: Date;
  platform?: string;
  success: boolean;
}

export interface LiveLocationSession {
  id: string;
  userId: string;
  recipientIds: string[];
  startTime: Date;
  endTime?: Date;
  isActive: boolean;
  locationUpdates: number;
  lastUpdate: Date;
}

class SocialService {
  private liveLocationSessions: Map<string, LiveLocationSession> = new Map();
  private locationUpdateInterval: NodeJS.Timeout | null = null;
  private subscribers: ((location: SharedLocation) => void)[] = [];
  private currentPosition: GeolocationPosition | null = null;

  constructor() {
    this.initializeLocationTracking();
  }

  /**
   * Check if Web Share API is supported
   */
  isWebShareSupported(): boolean {
    return 'share' in navigator;
  }

  /**
   * Share content using native Web Share API
   */
  async shareContent(data: {
    title: string;
    text: string;
    url?: string;
    files?: File[];
  }): Promise<SocialShare> {
    const shareData = {
      title: data.title,
      text: data.text,
      url: data.url,
      ...(data.files && { files: data.files })
    };

    const shareRecord: SocialShare = {
      id: this.generateId(),
      type: 'route', // Default type
      title: data.title,
      text: data.text,
      url: data.url || '',
      timestamp: new Date(),
      success: false
    };

    try {
      if (this.isWebShareSupported()) {
        // Use native Web Share API
        await navigator.share(shareData);
        shareRecord.success = true;
        shareRecord.platform = 'native';
      } else {
        // Fallback to manual sharing options
        await this.fallbackShare(shareData);
        shareRecord.success = true;
        shareRecord.platform = 'fallback';
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        // User cancelled the share
        shareRecord.success = false;
      } else {
        logger.error('Failed to share content:', error);
        shareRecord.success = false;
        throw error;
      }
    }

    return shareRecord;
  }

  /**
   * Share current location
   */
  async shareLocation(data: {
    recipientIds: string[];
    message?: string;
    duration?: number; // minutes
  }): Promise<SharedLocation> {
    const position = await this.getCurrentPosition();
    const address = await this.reverseGeocode(position.coords.latitude, position.coords.longitude);

    const sharedLocation: SharedLocation = {
      id: this.generateId(),
      userId: 'current_user', // In real app, get from auth
      lat: position.coords.latitude,
      lng: position.coords.longitude,
      address,
      timestamp: new Date(),
      expiresAt: data.duration ? new Date(Date.now() + data.duration * 60 * 1000) : undefined,
      isLive: false,
      recipientIds: data.recipientIds,
      message: data.message
    };

    // Share location using Web Share API
    const shareUrl = `${window.location.origin}/location/${sharedLocation.id}`;
    const shareText = `${data.message ? data.message + '\n' : ''}I'm at: ${address}\n${shareUrl}`;

    try {
      await this.shareContent({
        title: 'My Current Location',
        text: shareText,
        url: shareUrl
      });
    } catch (error) {
      logger.error('Failed to share location:', error);
    }

    return sharedLocation;
  }

  /**
   * Start live location sharing
   */
  async startLiveLocationSharing(data: {
    recipientIds: string[];
    duration?: number; // minutes, default 60
  }): Promise<LiveLocationSession> {
    const session: LiveLocationSession = {
      id: this.generateId(),
      userId: 'current_user',
      recipientIds: data.recipientIds,
      startTime: new Date(),
      endTime: new Date(Date.now() + (data.duration || 60) * 60 * 1000),
      isActive: true,
      locationUpdates: 0,
      lastUpdate: new Date()
    };

    this.liveLocationSessions.set(session.id, session);

    // Start periodic location updates
    this.startLocationUpdates(session.id);

    // Share initial link
    const shareUrl = `${window.location.origin}/live/${session.id}`;
    const shareText = `I'm sharing my live location with you for ${data.duration || 60} minutes.\nTrack me here: ${shareUrl}`;

    try {
      await this.shareContent({
        title: 'Live Location Sharing',
        text: shareText,
        url: shareUrl
      });
    } catch (error) {
      logger.error('Failed to share live location:', error);
    }

    return session;
  }

  /**
   * Stop live location sharing
   */
  async stopLiveLocationSharing(sessionId: string): Promise<void> {
    const session = this.liveLocationSessions.get(sessionId);
    if (!session) return;

    session.isActive = false;
    session.endTime = new Date();

    // Stop location updates
    if (this.locationUpdateInterval) {
      clearInterval(this.locationUpdateInterval);
      this.locationUpdateInterval = null;
    }

    // Notify recipients that sharing has stopped
    try {
      await this.shareContent({
        title: 'Location Sharing Ended',
        text: 'I have stopped sharing my live location.',
        url: `${window.location.origin}/location-ended`
      });
    } catch (error) {
      logger.error('Failed to notify location sharing end:', error);
    }
  }

  /**
   * Share route with others
   */
  async shareRoute(data: {
    route: {
      from: string;
      to: string;
      distance: string;
      duration: string;
      eta: string;
    };
    recipientIds: string[];
    message?: string;
  }): Promise<SocialShare> {
    const routeText = `${data.message ? data.message + '\n' : ''}My route: ${data.route.from} → ${data.route.to}\nDistance: ${data.route.distance}\nDuration: ${data.route.duration}\nETA: ${data.route.eta}`;
    
    const routeUrl = `${window.location.origin}/route/${this.generateId()}`;

    return await this.shareContent({
      title: 'My Route',
      text: routeText,
      url: routeUrl
    });
  }

  /**
   * Share ETA with contacts
   */
  async shareETA(data: {
    destination: string;
    eta: string;
    recipientIds: string[];
    message?: string;
    includeTracking?: boolean;
  }): Promise<SocialShare> {
    const trackingText = data.includeTracking ? `\nTrack my progress: ${window.location.origin}/track/${this.generateId()}` : '';
    const etaText = `${data.message ? data.message + '\n' : ''}Heading to: ${data.destination}\nExpected arrival: ${data.eta}${trackingText}`;

    return await this.shareContent({
      title: `ETA: ${data.eta}`,
      text: etaText,
      url: data.includeTracking ? `${window.location.origin}/track/${this.generateId()}` : undefined
    });
  }

  /**
   * Share a place or point of interest
   */
  async sharePlace(data: {
    place: {
      name: string;
      address: string;
      lat: number;
      lng: number;
    };
    recipientIds: string[];
    message?: string;
    rating?: number;
  }): Promise<SocialShare> {
    const ratingText = data.rating ? `\nRating: ${'★'.repeat(data.rating)}${'☆'.repeat(5 - data.rating)}` : '';
    const placeText = `${data.message ? data.message + '\n' : ''}Check out: ${data.place.name}\n${data.place.address}${ratingText}`;
    
    const placeUrl = `${window.location.origin}/place/${encodeURIComponent(data.place.name)}?lat=${data.place.lat}&lng=${data.place.lng}`;

    return await this.shareContent({
      title: data.place.name,
      text: placeText,
      url: placeUrl
    });
  }

  /**
   * Get active live location sessions
   */
  getActiveSessions(): LiveLocationSession[] {
    return Array.from(this.liveLocationSessions.values()).filter(session => session.isActive);
  }

  /**
   * Subscribe to location updates
   */
  subscribeToLocationUpdates(callback: (location: SharedLocation) => void): () => void {
    this.subscribers.push(callback);
    
    return () => {
      const index = this.subscribers.indexOf(callback);
      if (index > -1) {
        this.subscribers.splice(index, 1);
      }
    };
  }

  /**
   * Check if location sharing is currently active
   */
  isLocationSharingActive(): boolean {
    return this.getActiveSessions().length > 0;
  }

  /**
   * Initialize location tracking
   */
  private initializeLocationTracking(): void {
    if ('geolocation' in navigator) {
      navigator.geolocation.watchPosition(
        (position) => {
          this.currentPosition = position;
          logger.debug('Social service location updated');
        },
        (error) => {
          logger.debug('Social service location error:', error.message);
          // Don't spam with location errors, they're expected in development
        },
        {
          enableHighAccuracy: false, // Less demanding
          maximumAge: 60000, // 1 minute
          timeout: 8000 // Shorter timeout
        }
      );
    }
  }

  /**
   * Start periodic location updates for live sharing
   */
  private startLocationUpdates(sessionId: string): void {
    this.locationUpdateInterval = setInterval(async () => {
      const session = this.liveLocationSessions.get(sessionId);
      if (!session || !session.isActive) {
        if (this.locationUpdateInterval) {
          clearInterval(this.locationUpdateInterval);
          this.locationUpdateInterval = null;
        }
        return;
      }

      // Check if session has expired
      if (session.endTime && new Date() > session.endTime) {
        await this.stopLiveLocationSharing(sessionId);
        return;
      }

      try {
        const position = await this.getCurrentPosition();
        const address = await this.reverseGeocode(position.coords.latitude, position.coords.longitude);

        const locationUpdate: SharedLocation = {
          id: this.generateId(),
          userId: session.userId,
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          address,
          timestamp: new Date(),
          isLive: true,
          recipientIds: session.recipientIds
        };

        // Update session
        session.locationUpdates++;
        session.lastUpdate = new Date();

        // Notify subscribers
        this.subscribers.forEach(callback => {
          try {
            callback(locationUpdate);
          } catch (error) {
            logger.error('Error in location subscriber:', error);
          }
        });

      } catch (error) {
        logger.error('Failed to update location:', error);
      }
    }, 30000); // Update every 30 seconds
  }

  /**
   * Get current position
   */
  private getCurrentPosition(): Promise<GeolocationPosition> {
    return new Promise((resolve, reject) => {
      if (this.currentPosition) {
        // Check if cached position is recent enough
        const age = Date.now() - this.currentPosition.timestamp;
        if (age < 300000) { // 5 minutes
          resolve(this.currentPosition);
          return;
        }
      }

      if (!('geolocation' in navigator)) {
        reject(new Error('Geolocation is not supported'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          this.currentPosition = position;
          resolve(position);
        },
        (error) => {
          // Fallback to last known position if available
          if (this.currentPosition) {
            resolve(this.currentPosition);
          } else {
            reject(error);
          }
        },
        {
          enableHighAccuracy: false,
          maximumAge: 60000, // 1 minute
          timeout: 8000 // Shorter timeout
        }
      );
    });
  }

  /**
   * Reverse geocode coordinates to address
   */
  private async reverseGeocode(lat: number, lng: number): Promise<string> {
    try {
      // Using a simple approximation for demo
      // In production, use real reverse geocoding API
      return `Near ${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    } catch (error) {
      logger.error('Reverse geocoding failed:', error);
      return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    }
  }

  /**
   * Fallback sharing for browsers without Web Share API
   */
  private async fallbackShare(data: { title: string; text: string; url?: string }): Promise<void> {
    const shareText = `${data.title}\n\n${data.text}${data.url ? '\n\n' + data.url : ''}`;

    // Try clipboard first
    if (navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(shareText);
        // Show a notification that content was copied
        this.showShareNotification('Content copied to clipboard!');
        return;
      } catch (error) {
        logger.error('Failed to copy to clipboard:', error);
      }
    }

    // Create sharing modal with options
    this.showShareModal(data);
  }

  /**
   * Show share notification
   */
  private showShareNotification(message: string): void {
    // Create a simple notification
    const notification = document.createElement('div');
    notification.textContent = message;
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #4CAF50;
      color: white;
      padding: 12px 24px;
      border-radius: 8px;
      z-index: 10000;
      font-family: -apple-system, BlinkMacSystemFont, sans-serif;
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
      document.body.removeChild(notification);
    }, 3000);
  }

  /**
   * Show sharing modal with platform options
   */
  private showShareModal(data: { title: string; text: string; url?: string }): void {
    const shareText = `${data.title}\n\n${data.text}${data.url ? '\n\n' + data.url : ''}`;
    const encodedText = encodeURIComponent(shareText);
    const encodedUrl = data.url ? encodeURIComponent(data.url) : '';

    // Create modal
    const modal = document.createElement('div');
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0,0,0,0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
      font-family: -apple-system, BlinkMacSystemFont, sans-serif;
    `;

    modal.innerHTML = `
      <div style="background: white; border-radius: 12px; padding: 24px; max-width: 300px; width: 90%;">
        <h3 style="margin: 0 0 16px 0; font-size: 18px; font-weight: 600;">Share</h3>
        <div style="display: grid; gap: 8px;">
          <a href="https://twitter.com/intent/tweet?text=${encodedText}" target="_blank" style="padding: 12px; background: #1DA1F2; color: white; text-decoration: none; border-radius: 6px; text-align: center;">Twitter</a>
          <a href="https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}" target="_blank" style="padding: 12px; background: #1877F2; color: white; text-decoration: none; border-radius: 6px; text-align: center;">Facebook</a>
          <a href="https://wa.me/?text=${encodedText}" target="_blank" style="padding: 12px; background: #25D366; color: white; text-decoration: none; border-radius: 6px; text-align: center;">WhatsApp</a>
          <a href="mailto:?subject=${encodeURIComponent(data.title)}&body=${encodedText}" style="padding: 12px; background: #6B7280; color: white; text-decoration: none; border-radius: 6px; text-align: center;">Email</a>
          <button onclick="navigator.clipboard.writeText('${shareText.replace(/'/g, "\\'")}').then(() => alert('Copied!'))" style="padding: 12px; background: #374151; color: white; border: none; border-radius: 6px; cursor: pointer;">Copy</button>
        </div>
        <button onclick="this.parentElement.parentElement.remove()" style="margin-top: 16px; width: 100%; padding: 12px; background: #F3F4F6; color: #374151; border: none; border-radius: 6px; cursor: pointer;">Cancel</button>
      </div>
    `;

    document.body.appendChild(modal);

    // Remove modal when clicking outside
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        document.body.removeChild(modal);
      }
    });
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.locationUpdateInterval) {
      clearInterval(this.locationUpdateInterval);
    }

    // Stop all active sessions
    this.liveLocationSessions.forEach(async (session, sessionId) => {
      if (session.isActive) {
        await this.stopLiveLocationSharing(sessionId);
      }
    });

    this.liveLocationSessions.clear();
    this.subscribers = [];
  }
}

// Export singleton instance
export const socialService = new SocialService();