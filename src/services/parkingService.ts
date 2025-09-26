/**
 * Parking API Service
 * Integrates with parking providers for real-time parking availability and booking
 */

import { logger } from '../utils/logger';

export interface ParkingSpot {
  id: string;
  name: string;
  type: 'street' | 'garage' | 'lot' | 'private' | 'ev_charging' | 'handicap';
  location: {
    lat: number;
    lng: number;
    address: string;
    city: string;
    zipCode?: string;
  };
  availability: {
    total: number;
    available: number;
    occupied: number;
    reserved: number;
    lastUpdated: Date;
  };
  pricing: {
    hourly?: number;
    daily?: number;
    monthly?: number;
    currency: string;
    freeMinutes?: number;
  };
  features: string[];
  restrictions: {
    maxHeight?: number;
    timeLimit?: number;
    permitRequired?: boolean;
    paymentMethods: string[];
  };
  hours: {
    [day: string]: {
      open: string;
      close: string;
    };
  };
  distance?: number;
  walkingTime?: number;
  rating?: number;
  reviews?: number;
}

export interface ParkingReservation {
  id: string;
  spotId: string;
  userId: string;
  startTime: Date;
  endTime: Date;
  status: 'pending' | 'confirmed' | 'active' | 'completed' | 'cancelled';
  totalCost: number;
  currency: string;
  paymentMethod: string;
  confirmationCode?: string;
  createdAt: Date;
}

export interface ParkingSearch {
  location: {
    lat: number;
    lng: number;
  };
  radius?: number;
  startTime?: Date;
  duration?: number; // in minutes
  type?: string[];
  features?: string[];
  maxPrice?: number;
  sortBy?: 'distance' | 'price' | 'availability' | 'rating';
}

export interface ParkingAlert {
  id: string;
  type: 'spot_available' | 'price_drop' | 'time_expiring' | 'payment_due';
  message: string;
  spotId?: string;
  reservationId?: string;
  expiresAt?: Date;
  priority: 'low' | 'medium' | 'high';
  createdAt: Date;
}

class ParkingService {
  private apiKey: string;
  private baseUrl: string;
  private subscribers: ((spots: ParkingSpot[]) => void)[] = [];
  private alertSubscribers: ((alerts: ParkingAlert[]) => void)[] = [];
  private reservations: Map<string, ParkingReservation> = new Map();
  private watchedSpots: Set<string> = new Set();
  private updateInterval: number = 60000; // 1 minute
  private intervalId: NodeJS.Timeout | null = null;

  constructor() {
    // In production, these would come from environment variables
    this.apiKey = (typeof window !== 'undefined' && (window as any).__ENV__?.REACT_APP_PARKING_API_KEY) || '';
    this.baseUrl = (typeof window !== 'undefined' && (window as any).__ENV__?.REACT_APP_PARKING_API_URL) || 'https://api.parking-service.com/v1';
  }

  /**
   * Search for parking spots
   */
  async searchParkingSpots(searchParams: ParkingSearch): Promise<ParkingSpot[]> {
    try {
      const params = new URLSearchParams({
        lat: searchParams.location.lat.toString(),
        lng: searchParams.location.lng.toString(),
        radius: (searchParams.radius || 1000).toString(),
        api_key: this.apiKey
      });

      if (searchParams.startTime) {
        params.set('start_time', searchParams.startTime.toISOString());
      }

      if (searchParams.duration) {
        params.set('duration', searchParams.duration.toString());
      }

      if (searchParams.type && searchParams.type.length > 0) {
        params.set('types', searchParams.type.join(','));
      }

      if (searchParams.features && searchParams.features.length > 0) {
        params.set('features', searchParams.features.join(','));
      }

      if (searchParams.maxPrice) {
        params.set('max_price', searchParams.maxPrice.toString());
      }

      if (searchParams.sortBy) {
        params.set('sort_by', searchParams.sortBy);
      }

      const response = await fetch(`${this.baseUrl}/search?${params}`);
      
      if (!response.ok) {
        throw new Error(`Parking API error: ${response.status}`);
      }

      const data = await response.json();
      return this.mapParkingSpots(data.spots || [], searchParams.location);
    } catch (error) {
      logger.error('Failed to search parking spots', error);
      
      // Return mock data for demo purposes
      return this.getMockParkingSpots(searchParams);
    }
  }

  /**
   * Get detailed information about a specific parking spot
   */
  async getParkingSpotDetails(spotId: string): Promise<ParkingSpot | null> {
    try {
      const response = await fetch(`${this.baseUrl}/spots/${spotId}?api_key=${this.apiKey}`);
      
      if (!response.ok) {
        throw new Error(`Parking API error: ${response.status}`);
      }

      const data = await response.json();
      return this.mapParkingSpot(data);
    } catch (error) {
      logger.error('Failed to get parking spot details', error);
      
      // Return mock data for demo purposes
      return this.getMockParkingSpotDetails(spotId);
    }
  }

  /**
   * Check real-time availability for parking spots
   */
  async checkAvailability(spotIds: string[]): Promise<{ [spotId: string]: number }> {
    try {
      const params = new URLSearchParams({
        spot_ids: spotIds.join(','),
        api_key: this.apiKey
      });

      const response = await fetch(`${this.baseUrl}/availability?${params}`);
      
      if (!response.ok) {
        throw new Error(`Parking API error: ${response.status}`);
      }

      const data = await response.json();
      return data.availability || {};
    } catch (error) {
      logger.error('Failed to check parking availability', error);
      
      // Return mock data for demo purposes
      return this.getMockAvailability(spotIds);
    }
  }

  /**
   * Create a parking reservation
   */
  async createReservation(
    spotId: string,
    startTime: Date,
    duration: number, // in minutes
    paymentMethod: string
  ): Promise<ParkingReservation> {
    try {
      const reservationData = {
        spot_id: spotId,
        start_time: startTime.toISOString(),
        duration,
        payment_method: paymentMethod
      };

      const response = await fetch(`${this.baseUrl}/reservations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify(reservationData)
      });
      
      if (!response.ok) {
        throw new Error(`Parking API error: ${response.status}`);
      }

      const data = await response.json();
      const reservation = this.mapReservation(data);
      this.reservations.set(reservation.id, reservation);
      
      return reservation;
    } catch (error) {
      logger.error('Failed to create parking reservation:', error);
      
      // Return mock reservation for demo purposes
      return this.createMockReservation(spotId, startTime, duration, paymentMethod);
    }
  }

  /**
   * Get user's parking reservations
   */
  async getReservations(): Promise<ParkingReservation[]> {
    try {
      const response = await fetch(`${this.baseUrl}/reservations?api_key=${this.apiKey}`);
      
      if (!response.ok) {
        throw new Error(`Parking API error: ${response.status}`);
      }

      const data = await response.json();
      const reservations = data.reservations?.map((res: any) => this.mapReservation(res)) || [];
      
      // Update local cache
      reservations.forEach((res: ParkingReservation) => {
        this.reservations.set(res.id, res);
      });
      
      return reservations;
    } catch (error) {
      logger.error('Failed to get parking reservations:', error);
      
      // Return local reservations or mock data
      return Array.from(this.reservations.values());
    }
  }

  /**
   * Cancel a parking reservation
   */
  async cancelReservation(reservationId: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/reservations/${reservationId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
        }
      });
      
      if (!response.ok) {
        throw new Error(`Parking API error: ${response.status}`);
      }

      // Remove from local cache
      this.reservations.delete(reservationId);
      
      return true;
    } catch (error) {
      logger.error('Failed to cancel parking reservation:', error);
      return false;
    }
  }

  /**
   * Extend a parking reservation
   */
  async extendReservation(
    reservationId: string,
    additionalMinutes: number
  ): Promise<ParkingReservation | null> {
    try {
      const response = await fetch(`${this.baseUrl}/reservations/${reservationId}/extend`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          additional_minutes: additionalMinutes
        })
      });
      
      if (!response.ok) {
        throw new Error(`Parking API error: ${response.status}`);
      }

      const data = await response.json();
      const reservation = this.mapReservation(data);
      this.reservations.set(reservation.id, reservation);
      
      return reservation;
    } catch (error) {
      logger.error('Failed to extend parking reservation:', error);
      return null;
    }
  }

  /**
   * Start monitoring parking spots for availability changes
   */
  startMonitoring(spotIds: string[]): void {
    this.watchedSpots = new Set(spotIds);
    
    if (this.intervalId) {
      this.stopMonitoring();
    }

    const updateAvailability = async () => {
      try {
        const availability = await this.checkAvailability(Array.from(this.watchedSpots));
        
        // Here you would compare with previous values and trigger notifications
        // For now, just log the update
        logger.info('Parking availability updated', { availabilityCount: availability.length });
        
      } catch (error) {
        logger.error('Parking monitoring update failed:', error);
      }
    };

    // Initial update
    updateAvailability();
    
    // Set up periodic updates
    this.intervalId = setInterval(updateAvailability, this.updateInterval);
  }

  /**
   * Stop monitoring parking spots
   */
  stopMonitoring(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.watchedSpots.clear();
  }

  /**
   * Subscribe to parking spot updates
   */
  subscribe(callback: (spots: ParkingSpot[]) => void): () => void {
    this.subscribers.push(callback);
    
    return () => {
      const index = this.subscribers.indexOf(callback);
      if (index > -1) {
        this.subscribers.splice(index, 1);
      }
    };
  }

  /**
   * Subscribe to parking alerts
   */
  subscribeToAlerts(callback: (alerts: ParkingAlert[]) => void): () => void {
    this.alertSubscribers.push(callback);
    
    return () => {
      const index = this.alertSubscribers.indexOf(callback);
      if (index > -1) {
        this.alertSubscribers.splice(index, 1);
      }
    };
  }

  /**
   * Map API parking spots to internal format
   */
  private mapParkingSpots(apiSpots: any[], searchLocation: {lat: number; lng: number}): ParkingSpot[] {
    return apiSpots.map(spot => this.mapParkingSpot(spot, searchLocation));
  }

  /**
   * Map single API parking spot to internal format
   */
  private mapParkingSpot(apiSpot: any, searchLocation?: {lat: number; lng: number}): ParkingSpot {
    const spot: ParkingSpot = {
      id: apiSpot.id || `spot_${Date.now()}`,
      name: apiSpot.name || 'Parking Spot',
      type: apiSpot.type || 'street',
      location: {
        lat: apiSpot.location?.lat || apiSpot.lat,
        lng: apiSpot.location?.lng || apiSpot.lng,
        address: apiSpot.address || 'Unknown Address',
        city: apiSpot.city || 'Unknown City',
        zipCode: apiSpot.zipCode
      },
      availability: {
        total: apiSpot.availability?.total || 1,
        available: apiSpot.availability?.available ?? 1,
        occupied: apiSpot.availability?.occupied || 0,
        reserved: apiSpot.availability?.reserved || 0,
        lastUpdated: new Date(apiSpot.availability?.lastUpdated || Date.now())
      },
      pricing: {
        hourly: apiSpot.pricing?.hourly,
        daily: apiSpot.pricing?.daily,
        monthly: apiSpot.pricing?.monthly,
        currency: apiSpot.pricing?.currency || 'USD',
        freeMinutes: apiSpot.pricing?.freeMinutes
      },
      features: apiSpot.features || [],
      restrictions: {
        maxHeight: apiSpot.restrictions?.maxHeight,
        timeLimit: apiSpot.restrictions?.timeLimit,
        permitRequired: apiSpot.restrictions?.permitRequired || false,
        paymentMethods: apiSpot.restrictions?.paymentMethods || ['credit_card']
      },
      hours: apiSpot.hours || {},
      rating: apiSpot.rating,
      reviews: apiSpot.reviews
    };

    // Calculate distance if search location is provided
    if (searchLocation) {
      spot.distance = this.calculateDistance(searchLocation, spot.location);
      spot.walkingTime = Math.round((spot.distance / 83.33) * 60); // Assuming 5 km/h walking speed
    }

    return spot;
  }

  /**
   * Map API reservation to internal format
   */
  private mapReservation(apiReservation: any): ParkingReservation {
    return {
      id: apiReservation.id || `reservation_${Date.now()}`,
      spotId: apiReservation.spot_id || apiReservation.spotId,
      userId: apiReservation.user_id || 'current_user',
      startTime: new Date(apiReservation.start_time),
      endTime: new Date(apiReservation.end_time),
      status: apiReservation.status || 'pending',
      totalCost: apiReservation.total_cost || 0,
      currency: apiReservation.currency || 'USD',
      paymentMethod: apiReservation.payment_method || 'credit_card',
      confirmationCode: apiReservation.confirmation_code,
      createdAt: new Date(apiReservation.created_at || Date.now())
    };
  }

  /**
   * Mock parking spots for demo/fallback
   */
  private getMockParkingSpots(searchParams: ParkingSearch): ParkingSpot[] {
    const center = searchParams.location;
    
    return [
      {
        id: 'mock_spot_1',
        name: 'Downtown Parking Garage',
        type: 'garage',
        location: {
          lat: center.lat + 0.001,
          lng: center.lng + 0.001,
          address: '123 Main St',
          city: 'Downtown'
        },
        availability: {
          total: 200,
          available: 45,
          occupied: 155,
          reserved: 0,
          lastUpdated: new Date()
        },
        pricing: {
          hourly: 3.50,
          daily: 25.00,
          currency: 'USD',
          freeMinutes: 30
        },
        features: ['covered', '24/7', 'security', 'ev_charging'],
        restrictions: {
          maxHeight: 2.1,
          paymentMethods: ['credit_card', 'mobile_pay']
        },
        hours: {
          'monday': { open: '00:00', close: '23:59' },
          'tuesday': { open: '00:00', close: '23:59' }
        },
        distance: this.calculateDistance(center, { lat: center.lat + 0.001, lng: center.lng + 0.001 }),
        walkingTime: 2,
        rating: 4.2,
        reviews: 156
      },
      {
        id: 'mock_spot_2',
        name: 'Street Parking - Oak Ave',
        type: 'street',
        location: {
          lat: center.lat - 0.002,
          lng: center.lng + 0.003,
          address: 'Oak Ave',
          city: 'City Center'
        },
        availability: {
          total: 20,
          available: 3,
          occupied: 17,
          reserved: 0,
          lastUpdated: new Date()
        },
        pricing: {
          hourly: 2.00,
          currency: 'USD'
        },
        features: ['metered'],
        restrictions: {
          timeLimit: 120,
          paymentMethods: ['coin', 'credit_card']
        },
        hours: {
          'monday': { open: '08:00', close: '18:00' }
        },
        distance: this.calculateDistance(center, { lat: center.lat - 0.002, lng: center.lng + 0.003 }),
        walkingTime: 5,
        rating: 3.8,
        reviews: 42
      }
    ];
  }

  /**
   * Mock parking spot details for demo/fallback
   */
  private getMockParkingSpotDetails(spotId: string): ParkingSpot | null {
    const mockSpots = this.getMockParkingSpots({
      location: { lat: 37.7749, lng: -122.4194 }
    });
    
    return mockSpots.find(spot => spot.id === spotId) || mockSpots[0];
  }

  /**
   * Mock availability for demo/fallback
   */
  private getMockAvailability(spotIds: string[]): { [spotId: string]: number } {
    const availability: { [spotId: string]: number } = {};
    
    spotIds.forEach(spotId => {
      availability[spotId] = Math.floor(Math.random() * 50) + 1;
    });
    
    return availability;
  }

  /**
   * Create mock reservation for demo/fallback
   */
  private createMockReservation(
    spotId: string,
    startTime: Date,
    duration: number,
    paymentMethod: string
  ): ParkingReservation {
    const endTime = new Date(startTime.getTime() + duration * 60 * 1000);
    const hourlyRate = 3.50;
    const totalCost = (duration / 60) * hourlyRate;

    const reservation: ParkingReservation = {
      id: `mock_reservation_${Date.now()}`,
      spotId,
      userId: 'current_user',
      startTime,
      endTime,
      status: 'confirmed',
      totalCost: Math.round(totalCost * 100) / 100,
      currency: 'USD',
      paymentMethod,
      confirmationCode: `CONF${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
      createdAt: new Date()
    };

    this.reservations.set(reservation.id, reservation);
    return reservation;
  }

  /**
   * Calculate distance between two points (in meters)
   */
  private calculateDistance(
    point1: { lat: number; lng: number },
    point2: { lat: number; lng: number }
  ): number {
    const R = 6371000; // Earth's radius in meters
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
export const parkingService = new ParkingService();