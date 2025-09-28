import React, { useState, useEffect } from 'react';
import { 
  Bell, 
  X, 
  Clock, 
  MapPin, 
  AlertTriangle, 
  Car, 
  Fuel, 
  CloudRain, 
  Calendar,
  Navigation,
  Coffee,
  Zap,
  TrendingUp,
  Route
} from 'lucide-react';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { motion, AnimatePresence } from 'motion/react';

type NotificationType = 'departure' | 'traffic' | 'weather' | 'fuel' | 'suggestion' | 'event' | 'parking';

interface SmartNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  actionText?: string;
  actionData?: any;
  priority: 'low' | 'medium' | 'high';
  timestamp: string;
  location?: string;
  dismissed?: boolean;
  icon: React.ElementType;
  color: string;
}

interface SmartNotificationsProps {
  currentLocation?: {
    lat: number;
    lng: number;
  };
  onActionClick?: (notification: SmartNotification) => void;
}

export function SmartNotifications({ currentLocation, onActionClick }: SmartNotificationsProps) {
  const [notifications, setNotifications] = useState<SmartNotification[]>([]);
  const [showAll, setShowAll] = useState(false);
  const [dismissTimers, setDismissTimers] = useState<Map<string, NodeJS.Timeout>>(new Map());

  // Generate smart notifications
  useEffect(() => {
    const generateNotifications = () => {
      const now = new Date();
      const currentHour = now.getHours();
      
      const smartNotifications: SmartNotification[] = [];

      // Morning commute suggestion
      if (currentHour >= 7 && currentHour <= 9) {
        smartNotifications.push({
          id: 'morning-commute',
          type: 'departure',
          title: 'Leave Now for Work',
          message: 'Heavy traffic expected on your usual route. Leave 10 minutes early to arrive on time.',
          actionText: 'Start Navigation',
          priority: 'high',
          timestamp: '5 min ago',
          location: 'Home → Work',
          icon: Clock,
          color: '#F59E0B',
          actionData: { destination: 'work', mode: 'driving' }
        });
      }

      // Traffic alert
      if (Math.random() > 0.7) {
        smartNotifications.push({
          id: 'traffic-alert',
          type: 'traffic',
          title: 'Traffic Alert',
          message: 'Accident on Bay Bridge causing 15-minute delays. Alternative route available.',
          actionText: 'Avoid Area',
          priority: 'medium',
          timestamp: '12 min ago',
          location: 'Bay Bridge',
          icon: AlertTriangle,
          color: '#EF4444',
          actionData: { avoidArea: 'bay-bridge' }
        });
      }

      // Weather-based suggestion
      if (Math.random() > 0.6) {
        smartNotifications.push({
          id: 'weather-suggestion',
          type: 'weather',
          title: 'Rain Expected',
          message: 'Light rain starting in 30 minutes. Consider taking public transit.',
          actionText: 'View Transit',
          priority: 'medium',
          timestamp: '8 min ago',
          icon: CloudRain,
          color: '#0EA5E9',
          actionData: { mode: 'transit' }
        });
      }

      // Fuel suggestion
      if (Math.random() > 0.8) {
        smartNotifications.push({
          id: 'fuel-suggestion',
          type: 'fuel',
          title: 'Low Fuel Alert',
          message: 'Fuel level low. Cheapest gas station 0.3 miles ahead on your route.',
          actionText: 'Add Stop',
          priority: 'high',
          timestamp: '3 min ago',
          location: 'Shell Station - $3.89/gal',
          icon: Fuel,
          color: '#10B981',
          actionData: { stop: 'gas-station' }
        });
      }

      // Calendar-based suggestion
      if (currentHour >= 13 && currentHour <= 15) {
        smartNotifications.push({
          id: 'calendar-suggestion',
          type: 'event',
          title: 'Meeting Reminder',
          message: 'Client meeting at 3 PM. Leave now to arrive 10 minutes early.',
          actionText: 'Navigate',
          priority: 'high',
          timestamp: '2 min ago',
          location: 'Downtown Office',
          icon: Calendar,
          color: '#8B5CF6',
          actionData: { destination: 'client-meeting' }
        });
      }

      // Smart discovery suggestion
      smartNotifications.push({
        id: 'discovery-suggestion',
        type: 'suggestion',
        title: 'New Coffee Shop',
        message: 'Highly rated café just opened near your usual route. 4.8★ rating.',
        actionText: 'Check Out',
        priority: 'low',
        timestamp: '1 hour ago',
        location: 'Blue Sky Coffee',
        icon: Coffee,
        color: '#92400E',
        actionData: { destination: 'new-coffee-shop' }
      });

      // Parking suggestion
      if (currentHour >= 8 && currentHour <= 18) {
        smartNotifications.push({
          id: 'parking-suggestion',
          type: 'parking',
          title: 'Parking Reminder',
          message: 'Street cleaning starts at 4 PM on your street. Move your car by 3:45 PM.',
          actionText: 'Find Parking',
          priority: 'medium',
          timestamp: '45 min ago',
          location: 'Main Street',
          icon: Car,
          color: '#7C3AED',
          actionData: { findParking: true }
        });
      }

      // Route optimization
      smartNotifications.push({
        id: 'route-optimization',
        type: 'suggestion',
        title: 'Route Optimization',
        message: 'Based on your travel patterns, we found a route that saves 5 minutes daily.',
        actionText: 'Try Route',
        priority: 'low',
        timestamp: '2 hours ago',
        location: 'Home → Work',
        icon: TrendingUp,
        color: '#059669',
        actionData: { optimizedRoute: true }
      });

      setNotifications(smartNotifications);
      
      // Set auto-dismiss timers for new notifications
      smartNotifications.forEach(notification => {
        if (!dismissTimers.has(notification.id)) {
          const timer = setTimeout(() => {
            dismissNotification(notification.id);
          }, 2000); // Auto-dismiss after 2 seconds
          
          setDismissTimers(prev => new Map(prev).set(notification.id, timer));
        }
      });
    };

    generateNotifications();
    
    // Update notifications every 5 minutes
    const interval = setInterval(generateNotifications, 5 * 60 * 1000);
    return () => {
      clearInterval(interval);
      // Clear all timers on cleanup
      dismissTimers.forEach(timer => clearTimeout(timer));
    };
  }, [currentLocation, dismissTimers]);

  const dismissNotification = (id: string) => {
    setNotifications(prev =>
      prev.map(notification =>
        notification.id === id
          ? { ...notification, dismissed: true }
          : notification
      )
    );
    
    // Clear timer for this notification
    const timer = dismissTimers.get(id);
    if (timer) {
      clearTimeout(timer);
      setDismissTimers(prev => {
        const newMap = new Map(prev);
        newMap.delete(id);
        return newMap;
      });
    }
  };

  const handleActionClick = (notification: SmartNotification) => {
    if (onActionClick) {
      onActionClick(notification);
    }
    dismissNotification(notification.id);
  };

  const activeNotifications = notifications.filter(n => !n.dismissed);
  const displayNotifications = showAll ? activeNotifications : activeNotifications.slice(0, 2); // Show only 2 notifications max

  const getPriorityBadgeColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-700 border-red-200';
      case 'medium': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'low': return 'bg-blue-100 text-blue-700 border-blue-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  if (activeNotifications.length === 0) {
    return null;
  }

  return (
    <div className="space-y-1">
      <AnimatePresence>
        {displayNotifications.map((notification) => {
          const Icon = notification.icon;
          return (
            <motion.div
              key={notification.id}
              initial={{ opacity: 0, y: -14, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -14, scale: 0.95 }}
              transition={{ duration: 0.2 }}
            >
              <Card className="p-1.5 shadow-md border-l-2" style={{ borderLeftColor: notification.color }}>
                <div className="flex items-center gap-2">
                  <div 
                    className="w-4 h-4 rounded-full flex items-center justify-center text-white flex-shrink-0"
                    style={{ backgroundColor: notification.color }}
                  >
                    <Icon className="w-2.5 h-2.5" />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <h4 className="font-medium text-xs leading-tight truncate">{notification.title}</h4>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="w-3 h-3 text-gray-400 hover:text-gray-600 p-0"
                        onClick={() => dismissNotification(notification.id)}
                        aria-label="Dismiss"
                      >
                        <X className="w-2 h-2" />
                      </Button>
                    </div>
                    
                    <p className="text-[10px] text-muted-foreground truncate">{notification.message}</p>
                    
                    {notification.actionText && (
                      <Button
                        size="sm"
                        className="h-4 px-1.5 py-0 text-[9px] mt-1"
                        style={{ backgroundColor: notification.color }}
                        onClick={() => handleActionClick(notification)}
                      >
                        {notification.actionText}
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            </motion.div>
          );
        })}
      </AnimatePresence>

      {/* Show More/Less Button - Only for more than 2 */}
      {activeNotifications.length > 2 && (
        <div className="text-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowAll(!showAll)}
            className="text-gray-600 text-[9px] h-4 px-2"
          >
            {showAll ? (
              <>Less</>
            ) : (
              <>+{activeNotifications.length - 2}</>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}