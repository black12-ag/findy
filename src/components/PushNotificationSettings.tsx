import React, { useState, useEffect } from 'react';
import { usePushNotifications } from '../services/pushNotificationService';
import './PushNotificationSettings.css';

export const PushNotificationSettings: React.FC = () => {
  const {
    permission,
    isSubscribed,
    subscription,
    isSupported,
    requestPermission,
    subscribe,
    unsubscribe,
    showNotification,
    showNavigationAlert
  } = usePushNotifications();

  const [isLoading, setIsLoading] = useState(false);
  const [notificationTypes, setNotificationTypes] = useState({
    traffic: true,
    routeUpdates: true,
    arrival: true,
    departure: true,
    general: true
  });

  useEffect(() => {
    // Load saved notification preferences from localStorage
    const savedPrefs = localStorage.getItem('notification-preferences');
    if (savedPrefs) {
      try {
        setNotificationTypes(JSON.parse(savedPrefs));
      } catch (error) {
        console.error('Failed to parse notification preferences:', error);
      }
    }
  }, []);

  const savePreferences = (newTypes: typeof notificationTypes) => {
    setNotificationTypes(newTypes);
    localStorage.setItem('notification-preferences', JSON.stringify(newTypes));
  };

  const handleRequestPermission = async () => {
    if (!isSupported) {
      alert('Push notifications are not supported in this browser.');
      return;
    }

    setIsLoading(true);
    try {
      const result = await requestPermission();
      if (result === 'denied') {
        alert('Notification permission was denied. You can enable it in your browser settings.');
      }
    } catch (error) {
      console.error('Failed to request permission:', error);
      alert('Failed to request notification permission. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubscribe = async () => {
    setIsLoading(true);
    try {
      await subscribe();
    } catch (error) {
      console.error('Failed to subscribe:', error);
      alert('Failed to subscribe to push notifications. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUnsubscribe = async () => {
    setIsLoading(true);
    try {
      const result = await unsubscribe();
      if (result) {
        alert('Successfully unsubscribed from push notifications.');
      }
    } catch (error) {
      console.error('Failed to unsubscribe:', error);
      alert('Failed to unsubscribe. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const testNotification = async () => {
    try {
      await showNotification({
        title: '🧪 Test Notification',
        body: 'This is a test notification from PathFinder Pro!',
        tag: 'test',
        data: { test: true }
      });
    } catch (error) {
      console.error('Failed to show test notification:', error);
      alert('Failed to show test notification. Make sure notifications are enabled.');
    }
  };

  const testNavigationAlert = async () => {
    try {
      await showNavigationAlert('traffic', {
        delay: 15,
        location: 'Main Street'
      });
    } catch (error) {
      console.error('Failed to show navigation alert:', error);
      alert('Failed to show navigation alert. Make sure notifications are enabled.');
    }
  };

  const getPermissionStatusColor = () => {
    switch (permission) {
      case 'granted': return '#10b981'; // green
      case 'denied': return '#ef4444';  // red  
      case 'default': return '#f59e0b'; // amber
      default: return '#6b7280';        // gray
    }
  };

  const getPermissionStatusText = () => {
    switch (permission) {
      case 'granted': return 'Granted';
      case 'denied': return 'Denied';
      case 'default': return 'Not requested';
      default: return 'Unknown';
    }
  };

  if (!isSupported) {
    return (
      <div className="push-settings">
        <div className="settings-header">
          <h3>🔔 Push Notifications</h3>
        </div>
        <div className="settings-content">
          <div className="not-supported">
            <p>Push notifications are not supported in this browser.</p>
            <p>To receive navigation alerts, please use a modern browser like Chrome, Firefox, Safari, or Edge.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="push-settings">
      <div className="settings-header">
        <h3>🔔 Push Notifications</h3>
        <div className="status-indicator">
          <div 
            className="status-dot"
            style={{ backgroundColor: getPermissionStatusColor() }}
          />
          <span className="status-text">{getPermissionStatusText()}</span>
        </div>
      </div>

      <div className="settings-content">
        <div className="permission-section">
          <h4>Permission Status</h4>
          <p className="permission-description">
            Enable push notifications to receive real-time navigation alerts, traffic updates, 
            and route suggestions.
          </p>
          
          {permission === 'default' && (
            <button 
              onClick={handleRequestPermission}
              disabled={isLoading}
              className="btn btn-primary"
            >
              {isLoading ? 'Requesting...' : 'Enable Notifications'}
            </button>
          )}

          {permission === 'denied' && (
            <div className="denied-help">
              <p>Notifications are blocked. To enable:</p>
              <ol>
                <li>Click the lock icon in your browser's address bar</li>
                <li>Change notifications from "Block" to "Allow"</li>
                <li>Refresh the page</li>
              </ol>
            </div>
          )}

          {permission === 'granted' && !isSubscribed && (
            <button 
              onClick={handleSubscribe}
              disabled={isLoading}
              className="btn btn-primary"
            >
              {isLoading ? 'Subscribing...' : 'Subscribe to Notifications'}
            </button>
          )}

          {permission === 'granted' && isSubscribed && (
            <div className="subscription-info">
              <div className="subscription-status">
                <span className="status-badge status-active">Active</span>
                <span>Subscribed to push notifications</span>
              </div>
              <button 
                onClick={handleUnsubscribe}
                disabled={isLoading}
                className="btn btn-outline"
              >
                {isLoading ? 'Unsubscribing...' : 'Unsubscribe'}
              </button>
            </div>
          )}
        </div>

        {isSubscribed && (
          <>
            <div className="notification-types">
              <h4>Notification Types</h4>
              <div className="toggle-group">
                <label className="toggle-item">
                  <input
                    type="checkbox"
                    checked={notificationTypes.traffic}
                    onChange={(e) => savePreferences({
                      ...notificationTypes,
                      traffic: e.target.checked
                    })}
                  />
                  <span className="toggle-label">🚨 Traffic Alerts</span>
                  <small>Get notified about traffic delays and road conditions</small>
                </label>

                <label className="toggle-item">
                  <input
                    type="checkbox"
                    checked={notificationTypes.routeUpdates}
                    onChange={(e) => savePreferences({
                      ...notificationTypes,
                      routeUpdates: e.target.checked
                    })}
                  />
                  <span className="toggle-label">📍 Route Updates</span>
                  <small>Receive notifications when better routes are found</small>
                </label>

                <label className="toggle-item">
                  <input
                    type="checkbox"
                    checked={notificationTypes.arrival}
                    onChange={(e) => savePreferences({
                      ...notificationTypes,
                      arrival: e.target.checked
                    })}
                  />
                  <span className="toggle-label">🏁 Arrival Notifications</span>
                  <small>Get notified when you arrive at your destination</small>
                </label>

                <label className="toggle-item">
                  <input
                    type="checkbox"
                    checked={notificationTypes.departure}
                    onChange={(e) => savePreferences({
                      ...notificationTypes,
                      departure: e.target.checked
                    })}
                  />
                  <span className="toggle-label">🚀 Departure Reminders</span>
                  <small>Receive reminders when it's time to leave</small>
                </label>

                <label className="toggle-item">
                  <input
                    type="checkbox"
                    checked={notificationTypes.general}
                    onChange={(e) => savePreferences({
                      ...notificationTypes,
                      general: e.target.checked
                    })}
                  />
                  <span className="toggle-label">📢 General Updates</span>
                  <small>App updates, tips, and general information</small>
                </label>
              </div>
            </div>

            <div className="test-section">
              <h4>Test Notifications</h4>
              <div className="test-buttons">
                <button 
                  onClick={testNotification}
                  className="btn btn-outline btn-sm"
                >
                  📝 Test General
                </button>
                <button 
                  onClick={testNavigationAlert}
                  className="btn btn-outline btn-sm"
                >
                  🚨 Test Traffic Alert
                </button>
              </div>
            </div>

            {subscription && (
              <div className="subscription-details">
                <h4>Subscription Details</h4>
                <div className="details-content">
                  <div className="detail-item">
                    <span className="detail-label">Endpoint:</span>
                    <span className="detail-value endpoint">
                      {subscription.endpoint.substring(0, 50)}...
                    </span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Keys:</span>
                    <span className="detail-value">✅ Configured</span>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default PushNotificationSettings;