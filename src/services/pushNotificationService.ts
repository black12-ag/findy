import React from 'react';
import { logger } from '../utils/logger';

export interface NotificationPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  data?: any;
  actions?: {
    action: string;
    title: string;
    icon?: string;
  }[];
  requireInteraction?: boolean;
  silent?: boolean;
  timestamp?: number;
}

export interface PushSubscriptionData {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export type NotificationPermission = 'default' | 'granted' | 'denied';

class PushNotificationService {
  private registration: ServiceWorkerRegistration | null = null;
  private subscription: PushSubscription | null = null;
  private vapidPublicKey: string | null = null;

  constructor() {
    this.init();
  }

  private async init() {
    if ('serviceWorker' in navigator) {
      try {
        // First register the service worker if not already registered
        await this.registerServiceWorker();
        
        // Wait for service worker to be ready
        this.registration = await navigator.serviceWorker.ready;
        logger.info('Service worker ready for push notifications');
        
        // Check if user is already subscribed
        const subscribed = await this.isUserSubscribed();
        if (subscribed) {
          this.subscription = await this.registration.pushManager.getSubscription();
        }
      } catch (error) {
        console.error('[Push] Service worker not available:', error);
      }
    }
  }

  /**
   * Register service worker for push notifications
   */
  private async registerServiceWorker(): Promise<void> {
    try {
      const existingRegistration = await navigator.serviceWorker.getRegistration();
      
      if (existingRegistration) {
        this.registration = existingRegistration;
        logger.debug('Using existing service worker registration');
        return;
      }

      // Register new service worker
      this.registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/'
      });

      logger.info('Service worker registered successfully');

      // Handle service worker updates
      this.registration.addEventListener('updatefound', () => {
        logger.info('New service worker version found');
        const newWorker = this.registration!.installing;
        
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              logger.info('New service worker installed, page refresh recommended');
              // You could show a notification to refresh the page here
            }
          });
        }
      });

    } catch (error) {
      console.error('[Push] Service worker registration failed:', error);
      throw error;
    }
  }

  /**
   * Check if push notifications are supported
   */
  isSupported(): boolean {
    return 'serviceWorker' in navigator && 
           'PushManager' in window && 
           'Notification' in window;
  }

  /**
   * Get current notification permission status
   */
  getPermissionStatus(): NotificationPermission {
    if (!this.isSupported()) {
      return 'denied';
    }
    return Notification.permission;
  }

  /**
   * Request notification permission
   */
  async requestPermission(): Promise<NotificationPermission> {
    if (!this.isSupported()) {
      throw new Error('Push notifications are not supported');
    }

    const permission = await Notification.requestPermission();
    
    if (permission === 'granted') {
      logger.info('Notification permission granted');
      await this.subscribeUser();
    } else {
      logger.warn('Notification permission denied');
    }
    
    return permission;
  }

  /**
   * Set VAPID public key for push subscription
   */
  setVapidKey(vapidKey: string): void {
    this.vapidPublicKey = vapidKey;
  }

  /**
   * Subscribe user to push notifications
   */
  async subscribeUser(): Promise<PushSubscriptionData | null> {
    if (!this.registration) {
      throw new Error('Service worker not available');
    }

    if (this.getPermissionStatus() !== 'granted') {
      throw new Error('Notification permission not granted');
    }

    try {
      const options: PushSubscriptionOptions = {
        userVisibleOnly: true
      };

      // Add VAPID key if available
      if (this.vapidPublicKey) {
        options.applicationServerKey = this.urlBase64ToUint8Array(this.vapidPublicKey);
      }

      this.subscription = await this.registration.pushManager.subscribe(options);

      const subscriptionData = this.getSubscriptionData();
      logger.info('User subscribed to push notifications');
      
      // Here you would typically send the subscription to your backend
      await this.sendSubscriptionToBackend(subscriptionData);
      
      return subscriptionData;
    } catch (error) {
      console.error('[Push] Failed to subscribe user:', error);
      throw error;
    }
  }

  /**
   * Unsubscribe user from push notifications
   */
  async unsubscribeUser(): Promise<boolean> {
    if (!this.subscription) {
      logger.debug('No subscription to unsubscribe from');
      return true;
    }

    try {
      const result = await this.subscription.unsubscribe();
      this.subscription = null;
      logger.info('User unsubscribed from push notifications');
      
      // Notify backend about unsubscription
      await this.removeSubscriptionFromBackend();
      
      return result;
    } catch (error) {
      console.error('[Push] Failed to unsubscribe user:', error);
      return false;
    }
  }

  /**
   * Get current push subscription data
   */
  getSubscriptionData(): PushSubscriptionData | null {
    if (!this.subscription) {
      return null;
    }

    const keys = this.subscription.getKey ? {
      p256dh: this.arrayBufferToBase64(this.subscription.getKey('p256dh')),
      auth: this.arrayBufferToBase64(this.subscription.getKey('auth'))
    } : { p256dh: '', auth: '' };

    return {
      endpoint: this.subscription.endpoint,
      keys
    };
  }

  /**
   * Check if user is currently subscribed
   */
  async isUserSubscribed(): Promise<boolean> {
    if (!this.registration) {
      return false;
    }

    try {
      this.subscription = await this.registration.pushManager.getSubscription();
      return !!this.subscription;
    } catch (error) {
      console.error('[Push] Failed to check subscription status:', error);
      return false;
    }
  }

  /**
   * Show local notification (doesn't require push)
   */
  async showLocalNotification(payload: NotificationPayload): Promise<void> {
    if (this.getPermissionStatus() !== 'granted') {
      throw new Error('Notification permission not granted');
    }

    if (!this.registration) {
      // Fallback to browser notification if service worker not available
      const notification = new Notification(payload.title, {
        body: payload.body,
        icon: payload.icon || '/icons/icon-192x192.png',
        badge: payload.badge || '/icons/icon-96x96.png',
        tag: payload.tag,
        data: payload.data,
        requireInteraction: payload.requireInteraction || false,
        silent: payload.silent || false
      });

      // Auto-close after 5 seconds if not requiring interaction
      if (!payload.requireInteraction) {
        setTimeout(() => notification.close(), 5000);
      }

      return;
    }

    // Use service worker to show notification
    await this.registration.showNotification(payload.title, {
      body: payload.body,
      icon: payload.icon || '/icons/icon-192x192.png',
      badge: payload.badge || '/icons/icon-96x96.png',
      tag: payload.tag,
      data: payload.data,
      actions: payload.actions,
      requireInteraction: payload.requireInteraction || false,
      silent: payload.silent || false,
      timestamp: payload.timestamp || Date.now()
    });
  }

  /**
   * Navigation-specific notifications
   */
  async showNavigationAlert(type: 'traffic' | 'route_change' | 'arrival' | 'departure', data: any): Promise<void> {
    const notifications = {
      traffic: {
        title: '🚨 Traffic Alert',
        body: `Heavy traffic ahead. ${data.delay} min delay expected.`,
        tag: 'traffic-alert',
        requireInteraction: true,
        actions: [
          { action: 'reroute', title: 'Find Alternative Route' },
          { action: 'dismiss', title: 'Continue' }
        ]
      },
      route_change: {
        title: '📍 Route Updated',
        body: `New route found. Save ${data.timeSaved} minutes.`,
        tag: 'route-update',
        actions: [
          { action: 'accept', title: 'Use New Route' },
          { action: 'decline', title: 'Keep Current' }
        ]
      },
      arrival: {
        title: '🏁 Arrived at Destination',
        body: `You have arrived at ${data.destination}.`,
        tag: 'arrival',
        actions: [
          { action: 'rate', title: 'Rate Trip' },
          { action: 'share', title: 'Share Location' }
        ]
      },
      departure: {
        title: '🚀 Ready to Navigate',
        body: `Route to ${data.destination} is ready. Estimated time: ${data.eta}.`,
        tag: 'departure',
        actions: [
          { action: 'start', title: 'Start Navigation' },
          { action: 'review', title: 'Review Route' }
        ]
      }
    };

    const notification = notifications[type];
    if (notification) {
      await this.showLocalNotification({
        ...notification,
        data
      });
    }
  }

  /**
   * Send subscription to backend (implement based on your backend)
   */
  private async sendSubscriptionToBackend(subscription: PushSubscriptionData | null): Promise<void> {
    if (!subscription) return;

    try {
      // Replace with your actual backend endpoint
      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(subscription),
      });
      console.log('[Push] Subscription sent to backend');
    } catch (error) {
      console.error('[Push] Failed to send subscription to backend:', error);
      // Don't throw here - subscription still works locally
    }
  }

  /**
   * Remove subscription from backend
   */
  private async removeSubscriptionFromBackend(): Promise<void> {
    try {
      await fetch('/api/push/unsubscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      console.log('[Push] Subscription removed from backend');
    } catch (error) {
      console.error('[Push] Failed to remove subscription from backend:', error);
    }
  }

  /**
   * Utility: Convert VAPID key to Uint8Array
   */
  private urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  /**
   * Utility: Convert ArrayBuffer to Base64
   */
  private arrayBufferToBase64(buffer: ArrayBuffer | null): string {
    if (!buffer) return '';
    
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  }
}

// React hook for push notifications
export const usePushNotifications = () => {
  const [permission, setPermission] = React.useState<NotificationPermission>('default');
  const [isSubscribed, setIsSubscribed] = React.useState(false);
  const [subscription, setSubscription] = React.useState<PushSubscriptionData | null>(null);

  React.useEffect(() => {
    const checkStatus = async () => {
      if (pushNotificationService.isSupported()) {
        const currentPermission = pushNotificationService.getPermissionStatus();
        setPermission(currentPermission);

        if (currentPermission === 'granted') {
          const subscribed = await pushNotificationService.isUserSubscribed();
          setIsSubscribed(subscribed);
          
          if (subscribed) {
            const subData = pushNotificationService.getSubscriptionData();
            setSubscription(subData);
          }
        }
      }
    };

    checkStatus();
  }, []);

  const requestPermission = async () => {
    try {
      const newPermission = await pushNotificationService.requestPermission();
      setPermission(newPermission);
      
      if (newPermission === 'granted') {
        const subscribed = await pushNotificationService.isUserSubscribed();
        setIsSubscribed(subscribed);
        
        if (subscribed) {
          const subData = pushNotificationService.getSubscriptionData();
          setSubscription(subData);
        }
      }
      
      return newPermission;
    } catch (error) {
      console.error('Failed to request notification permission:', error);
      throw error;
    }
  };

  const subscribe = async () => {
    try {
      const subData = await pushNotificationService.subscribeUser();
      setIsSubscribed(true);
      setSubscription(subData);
      return subData;
    } catch (error) {
      console.error('Failed to subscribe to push notifications:', error);
      throw error;
    }
  };

  const unsubscribe = async () => {
    try {
      const result = await pushNotificationService.unsubscribeUser();
      if (result) {
        setIsSubscribed(false);
        setSubscription(null);
      }
      return result;
    } catch (error) {
      console.error('Failed to unsubscribe from push notifications:', error);
      throw error;
    }
  };

  const showNotification = async (payload: NotificationPayload) => {
    try {
      await pushNotificationService.showLocalNotification(payload);
    } catch (error) {
      console.error('Failed to show notification:', error);
      throw error;
    }
  };

  const showNavigationAlert = async (type: 'traffic' | 'route_change' | 'arrival' | 'departure', data: any) => {
    try {
      await pushNotificationService.showNavigationAlert(type, data);
    } catch (error) {
      console.error('Failed to show navigation alert:', error);
      throw error;
    }
  };

  return {
    permission,
    isSubscribed,
    subscription,
    isSupported: pushNotificationService.isSupported(),
    requestPermission,
    subscribe,
    unsubscribe,
    showNotification,
    showNavigationAlert
  };
};

export const pushNotificationService = new PushNotificationService();
export default pushNotificationService;