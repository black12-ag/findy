/**
 * Traffic API Service
 * Integrates with traffic data providers for real-time traffic information
 */

import { logger } from '../utils/logger';

export interface TrafficIncident {
  id: string;
  type: 'accident' | 'construction' | 'closure' | 'congestion' | 'weather' | 'event';
  severity: 'low' | 'medium' | 'high' | 'critical';
  location: {
    lat: number;
    lng: number;
    address?: string;
  };
  description: string;
  startTime: Date;
  estimatedEndTime?: Date;
  affectedRoads: string[];
  detourAvailable: boolean;
  source: string;
}

export interface TrafficCondition {
  roadName: string;
  segmentId: string;
  speedLimit: number;
  currentSpeed: number;
  congestionLevel: 'free' | 'light' | 'moderate' | 'heavy' | 'standstill';
  travelTime: number;
  distance: number;
  coordinates: Array<{lat: number; lng: number}>;
  lastUpdated: Date;
}

export interface TrafficRoute {
  routeId: string;
  distance: number;
  duration: number;
  durationInTraffic: number;
  conditions: TrafficCondition[];
  incidents: TrafficIncident[];
  alternativeRoutes?: TrafficRoute[];
}

export interface TrafficAlert {
  id: string;
  title: string;
  message: string;
  priority: 'low' | 'medium' | 'high';
  affectedArea: {
    center: {lat: number; lng: number};
    radius: number;
  };
  createdAt: Date;
  expiresAt?: Date;
}

class TrafficService {
  private apiKey: string;
  private baseUrl: string;
  private subscribers: ((incidents: TrafficIncident[]) => void)[] = [];
  private alertSubscribers: ((alerts: TrafficAlert[]) => void)[] = [];
  private updateInterval: number = 300000; // 5 minutes
  private intervalId: NodeJS.Timeout | null = null;
  private lastUpdate: Date | null = null;

  constructor() {
    // In production, these would come from environment variables
    this.apiKey = (typeof window !== 'undefined' && (window as any).__ENV__?.REACT_APP_TRAFFIC_API_KEY) || '';
    this.baseUrl = (typeof window !== 'undefined' && (window as any).__ENV__?.REACT_APP_TRAFFIC_API_URL) || 'https://api.traffic-service.com/v1';
  }

  /**
   * Get traffic incidents in a specific area
   */
  async getTrafficIncidents(
    bounds: {
      north: number;
      south: number;
      east: number;
      west: number;
    }
  ): Promise<TrafficIncident[]> {
    try {
      const params = new URLSearchParams({
        bbox: `${bounds.west},${bounds.south},${bounds.east},${bounds.north}`,
        api_key: this.apiKey,
        format: 'json'
      });

      const response = await fetch(`${this.baseUrl}/incidents?${params}`);
      
      if (!response.ok) {
        throw new Error(`Traffic API error: ${response.status}`);
      }

      const data = await response.json();
      return this.mapIncidents(data.incidents || []);
    } catch (error) {
      logger.error('Failed to fetch traffic incidents', error);
      
      // Return mock data for demo purposes
      return this.getMockIncidents(bounds);
    }
  }

  /**
   * Get traffic conditions for a route
   */
  async getRouteTraffic(
    origin: {lat: number; lng: number},
    destination: {lat: number; lng: number},
    waypoints?: Array<{lat: number; lng: number}>
  ): Promise<TrafficRoute> {
    try {
      const params = new URLSearchParams({
        origin: `${origin.lat},${origin.lng}`,
        destination: `${destination.lat},${destination.lng}`,
        traffic: 'true',
        api_key: this.apiKey
      });

      if (waypoints && waypoints.length > 0) {
        params.set('waypoints', waypoints.map(w => `${w.lat},${w.lng}`).join('|'));
      }

      const response = await fetch(`${this.baseUrl}/route-traffic?${params}`);
      
      if (!response.ok) {
        throw new Error(`Traffic API error: ${response.status}`);
      }

      const data = await response.json();
      return this.mapRouteTraffic(data);
    } catch (error) {
      logger.error('Failed to fetch route traffic', error);
      
      // Return mock data for demo purposes
      return this.getMockRouteTraffic(origin, destination);
    }
  }

  /**
   * Get live traffic conditions in an area
   */
  async getLiveTraffic(
    center: {lat: number; lng: number},
    radius: number = 5000 // meters
  ): Promise<TrafficCondition[]> {
    try {
      const params = new URLSearchParams({
        center: `${center.lat},${center.lng}`,
        radius: radius.toString(),
        api_key: this.apiKey
      });

      const response = await fetch(`${this.baseUrl}/live-traffic?${params}`);
      
      if (!response.ok) {
        throw new Error(`Traffic API error: ${response.status}`);
      }

      const data = await response.json();
      return this.mapTrafficConditions(data.conditions || []);
    } catch (error) {
      logger.error('Failed to fetch live traffic', error);
      
      // Return mock data for demo purposes
      return this.getMockTrafficConditions(center, radius);
    }
  }

  /**
   * Get traffic alerts for an area
   */
  async getTrafficAlerts(
    bounds: {
      north: number;
      south: number;
      east: number;
      west: number;
    }
  ): Promise<TrafficAlert[]> {
    try {
      const params = new URLSearchParams({
        bbox: `${bounds.west},${bounds.south},${bounds.east},${bounds.north}`,
        api_key: this.apiKey
      });

      const response = await fetch(`${this.baseUrl}/alerts?${params}`);
      
      if (!response.ok) {
        throw new Error(`Traffic API error: ${response.status}`);
      }

      const data = await response.json();
      return this.mapTrafficAlerts(data.alerts || []);
    } catch (error) {
      logger.error('Failed to fetch traffic alerts', error);
      
      // Return mock data for demo purposes
      return this.getMockTrafficAlerts(bounds);
    }
  }

  /**
   * Start real-time traffic monitoring
   */
  startMonitoring(
    bounds: {
      north: number;
      south: number;
      east: number;
      west: number;
    }
  ): void {
    if (this.intervalId) {
      this.stopMonitoring();
    }

    const updateTraffic = async () => {
      try {
        const incidents = await this.getTrafficIncidents(bounds);
        const alerts = await this.getTrafficAlerts(bounds);
        
        this.lastUpdate = new Date();
        
        // Notify subscribers
        this.subscribers.forEach(callback => {
          try {
            callback(incidents);
          } catch (error) {
            logger.error('Error in traffic subscriber:', error);
          }
        });

        this.alertSubscribers.forEach(callback => {
          try {
            callback(alerts);
          } catch (error) {
            logger.error('Error in alert subscriber:', error);
          }
        });
      } catch (error) {
        logger.error('Traffic monitoring update failed:', error);
      }
    };

    // Initial update
    updateTraffic();
    
    // Set up periodic updates
    this.intervalId = setInterval(updateTraffic, this.updateInterval);
  }

  /**
   * Stop real-time traffic monitoring
   */
  stopMonitoring(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  /**
   * Subscribe to traffic incident updates
   */
  subscribeToIncidents(callback: (incidents: TrafficIncident[]) => void): () => void {
    this.subscribers.push(callback);
    
    return () => {
      const index = this.subscribers.indexOf(callback);
      if (index > -1) {
        this.subscribers.splice(index, 1);
      }
    };
  }

  /**
   * Subscribe to traffic alert updates
   */
  subscribeToAlerts(callback: (alerts: TrafficAlert[]) => void): () => void {
    this.alertSubscribers.push(callback);
    
    return () => {
      const index = this.alertSubscribers.indexOf(callback);
      if (index > -1) {
        this.alertSubscribers.splice(index, 1);
      }
    };
  }

  /**
   * Get last update timestamp
   */
  getLastUpdate(): Date | null {
    return this.lastUpdate;
  }

  /**
   * Map API incidents to internal format
   */
  private mapIncidents(apiIncidents: any[]): TrafficIncident[] {
    return apiIncidents.map(incident => ({
      id: incident.id || `incident_${Date.now()}`,
      type: incident.type || 'congestion',
      severity: incident.severity || 'medium',
      location: {
        lat: incident.location?.lat || incident.lat,
        lng: incident.location?.lng || incident.lng,
        address: incident.address
      },
      description: incident.description || 'Traffic incident',
      startTime: new Date(incident.startTime || Date.now()),
      estimatedEndTime: incident.endTime ? new Date(incident.endTime) : undefined,
      affectedRoads: incident.affectedRoads || [],
      detourAvailable: incident.detourAvailable || false,
      source: incident.source || 'traffic-api'
    }));
  }

  /**
   * Map API route traffic data to internal format
   */
  private mapRouteTraffic(data: any): TrafficRoute {
    return {
      routeId: data.routeId || `route_${Date.now()}`,
      distance: data.distance || 0,
      duration: data.duration || 0,
      durationInTraffic: data.durationInTraffic || data.duration,
      conditions: this.mapTrafficConditions(data.conditions || []),
      incidents: this.mapIncidents(data.incidents || []),
      alternativeRoutes: data.alternatives?.map((alt: any) => this.mapRouteTraffic(alt))
    };
  }

  /**
   * Map API traffic conditions to internal format
   */
  private mapTrafficConditions(apiConditions: any[]): TrafficCondition[] {
    return apiConditions.map(condition => ({
      roadName: condition.roadName || 'Unknown Road',
      segmentId: condition.segmentId || `segment_${Date.now()}`,
      speedLimit: condition.speedLimit || 50,
      currentSpeed: condition.currentSpeed || condition.speedLimit,
      congestionLevel: condition.congestionLevel || 'free',
      travelTime: condition.travelTime || 0,
      distance: condition.distance || 0,
      coordinates: condition.coordinates || [],
      lastUpdated: new Date(condition.lastUpdated || Date.now())
    }));
  }

  /**
   * Map API traffic alerts to internal format
   */
  private mapTrafficAlerts(apiAlerts: any[]): TrafficAlert[] {
    return apiAlerts.map(alert => ({
      id: alert.id || `alert_${Date.now()}`,
      title: alert.title || 'Traffic Alert',
      message: alert.message || 'Traffic condition reported',
      priority: alert.priority || 'medium',
      affectedArea: {
        center: alert.center || {lat: 0, lng: 0},
        radius: alert.radius || 1000
      },
      createdAt: new Date(alert.createdAt || Date.now()),
      expiresAt: alert.expiresAt ? new Date(alert.expiresAt) : undefined
    }));
  }

  /**
   * Mock traffic incidents for demo/fallback
   */
  private getMockIncidents(bounds: any): TrafficIncident[] {
    const centerLat = (bounds.north + bounds.south) / 2;
    const centerLng = (bounds.east + bounds.west) / 2;

    return [
      {
        id: 'mock_incident_1',
        type: 'accident',
        severity: 'high',
        location: {
          lat: centerLat + 0.01,
          lng: centerLng + 0.01,
          address: 'Main St & 1st Ave'
        },
        description: 'Multi-vehicle accident blocking two lanes',
        startTime: new Date(Date.now() - 30 * 60 * 1000), // 30 minutes ago
        estimatedEndTime: new Date(Date.now() + 60 * 60 * 1000), // 1 hour from now
        affectedRoads: ['Main St', '1st Ave'],
        detourAvailable: true,
        source: 'mock-data'
      },
      {
        id: 'mock_incident_2',
        type: 'construction',
        severity: 'medium',
        location: {
          lat: centerLat - 0.02,
          lng: centerLng + 0.02,
          address: 'Highway 101 Southbound'
        },
        description: 'Lane closure for road maintenance',
        startTime: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
        estimatedEndTime: new Date(Date.now() + 4 * 60 * 60 * 1000), // 4 hours from now
        affectedRoads: ['Highway 101'],
        detourAvailable: false,
        source: 'mock-data'
      }
    ];
  }

  /**
   * Mock route traffic for demo/fallback
   */
  private getMockRouteTraffic(
    origin: {lat: number; lng: number},
    destination: {lat: number; lng: number}
  ): TrafficRoute {
    const distance = this.calculateDistance(origin, destination);
    const baseDuration = (distance / 50) * 3600; // Assuming 50 km/h average
    const trafficFactor = 1.3; // 30% longer due to traffic

    return {
      routeId: 'mock_route_1',
      distance: distance * 1000, // Convert to meters
      duration: baseDuration,
      durationInTraffic: baseDuration * trafficFactor,
      conditions: this.getMockTrafficConditions(origin, 5000),
      incidents: [
        {
          id: 'route_incident_1',
          type: 'congestion',
          severity: 'medium',
          location: {
            lat: (origin.lat + destination.lat) / 2,
            lng: (origin.lng + destination.lng) / 2
          },
          description: 'Heavy traffic due to rush hour',
          startTime: new Date(Date.now() - 60 * 60 * 1000),
          affectedRoads: ['Main Route'],
          detourAvailable: true,
          source: 'mock-data'
        }
      ]
    };
  }

  /**
   * Mock traffic conditions for demo/fallback
   */
  private getMockTrafficConditions(
    center: {lat: number; lng: number},
    radius: number
  ): TrafficCondition[] {
    return [
      {
        roadName: 'Main Street',
        segmentId: 'main_st_1',
        speedLimit: 50,
        currentSpeed: 35,
        congestionLevel: 'moderate',
        travelTime: 300,
        distance: 1000,
        coordinates: [
          {lat: center.lat, lng: center.lng},
          {lat: center.lat + 0.01, lng: center.lng + 0.01}
        ],
        lastUpdated: new Date()
      },
      {
        roadName: 'Highway 101',
        segmentId: 'hwy_101_1',
        speedLimit: 65,
        currentSpeed: 25,
        congestionLevel: 'heavy',
        travelTime: 600,
        distance: 2000,
        coordinates: [
          {lat: center.lat + 0.02, lng: center.lng},
          {lat: center.lat + 0.02, lng: center.lng + 0.02}
        ],
        lastUpdated: new Date()
      }
    ];
  }

  /**
   * Mock traffic alerts for demo/fallback
   */
  private getMockTrafficAlerts(bounds: any): TrafficAlert[] {
    const centerLat = (bounds.north + bounds.south) / 2;
    const centerLng = (bounds.east + bounds.west) / 2;

    return [
      {
        id: 'mock_alert_1',
        title: 'Traffic Congestion Alert',
        message: 'Heavy traffic reported on Main Street due to ongoing construction work',
        priority: 'high',
        affectedArea: {
          center: {lat: centerLat, lng: centerLng},
          radius: 2000
        },
        createdAt: new Date(Date.now() - 15 * 60 * 1000),
        expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000)
      }
    ];
  }

  /**
   * Calculate distance between two points (rough estimation)
   */
  private calculateDistance(
    point1: {lat: number; lng: number},
    point2: {lat: number; lng: number}
  ): number {
    const R = 6371; // Earth's radius in kilometers
    const dLat = (point2.lat - point1.lat) * Math.PI / 180;
    const dLng = (point2.lng - point1.lng) * Math.PI / 180;
    
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(point1.lat * Math.PI / 180) * Math.cos(point2.lat * Math.PI / 180) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }
}

// Export singleton instance
export const trafficService = new TrafficService();