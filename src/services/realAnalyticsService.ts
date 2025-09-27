/**
 * Real Analytics Service - Calculate actual user metrics from route history
 */

interface TripData {
  id: string;
  from: { name: string; lat: number; lng: number };
  to: { name: string; lat: number; lng: number };
  distance: number; // meters
  duration: number; // seconds
  mode: 'driving' | 'walking' | 'cycling' | 'transit';
  startTime: string;
  endTime: string;
  fuelUsed?: number; // liters
  co2Emissions?: number; // kg
}

interface AnalyticsData {
  totalDistance: string;
  totalTime: string;
  avgSpeed: string;
  co2Saved: string;
  fuelSaved: string;
  ecoScore: number;
  weeklyData: Array<{ day: string; miles: number; trips: number }>;
  transportModes: Array<{ mode: string; percentage: number; color: string }>;
  achievements: Array<{ id: number; name: string; description: string; icon: string; unlocked: boolean }>;
  recentTrips: Array<{ from: string; to: string; distance: string; time: string; mode: string }>;
}

class RealAnalyticsService {
  private storageKey = 'findy_trip_history';

  /**
   * Get comprehensive analytics from actual trip data
   */
  getAnalytics(timeRange: 'week' | 'month' | 'year' | 'all' = 'all'): AnalyticsData {
    const trips = this.getTripsForTimeRange(timeRange);
    
    if (trips.length === 0) {
      return this.getEmptyAnalytics();
    }

    return {
      totalDistance: this.calculateTotalDistance(trips),
      totalTime: this.calculateTotalTime(trips),
      avgSpeed: this.calculateAverageSpeed(trips),
      co2Saved: this.calculateCO2Saved(trips),
      fuelSaved: this.calculateFuelSaved(trips),
      ecoScore: this.calculateEcoScore(trips),
      weeklyData: this.getWeeklyData(trips),
      transportModes: this.getTransportModeDistribution(trips),
      achievements: this.calculateAchievements(trips),
      recentTrips: this.getRecentTrips(trips, 10)
    };
  }

  /**
   * Record a new trip
   */
  recordTrip(trip: Omit<TripData, 'id'>): void {
    const trips = this.getAllTrips();
    const newTrip: TripData = {
      ...trip,
      id: `trip_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };

    trips.push(newTrip);
    localStorage.setItem(this.storageKey, JSON.stringify(trips));
  }

  /**
   * Get all trips from storage
   */
  private getAllTrips(): TripData[] {
    try {
      const stored = localStorage.getItem(this.storageKey);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }

  /**
   * Filter trips by time range
   */
  private getTripsForTimeRange(timeRange: string): TripData[] {
    const trips = this.getAllTrips();
    const now = new Date();
    let cutoffDate: Date;

    switch (timeRange) {
      case 'week':
        cutoffDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        cutoffDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case 'year':
        cutoffDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        break;
      default:
        return trips;
    }

    return trips.filter(trip => new Date(trip.startTime) >= cutoffDate);
  }

  /**
   * Calculate total distance traveled
   */
  private calculateTotalDistance(trips: TripData[]): string {
    const totalMeters = trips.reduce((sum, trip) => sum + trip.distance, 0);
    const miles = totalMeters * 0.000621371;
    
    if (miles > 1000) {
      return `${(miles / 1000).toFixed(1)}k mi`;
    }
    return `${Math.round(miles)} mi`;
  }

  /**
   * Calculate total time spent traveling
   */
  private calculateTotalTime(trips: TripData[]): string {
    const totalSeconds = trips.reduce((sum, trip) => sum + trip.duration, 0);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  }

  /**
   * Calculate average speed
   */
  private calculateAverageSpeed(trips: TripData[]): string {
    const totalDistance = trips.reduce((sum, trip) => sum + trip.distance, 0);
    const totalTime = trips.reduce((sum, trip) => sum + trip.duration, 0);
    
    if (totalTime === 0) return '0 mph';
    
    const metersPerSecond = totalDistance / totalTime;
    const mph = metersPerSecond * 2.23694;
    
    return `${Math.round(mph)} mph`;
  }

  /**
   * Calculate CO2 saved by using alternative transport
   */
  private calculateCO2Saved(trips: TripData[]): string {
    let co2Saved = 0;
    
    trips.forEach(trip => {
      const distanceKm = trip.distance / 1000;
      const carEmissions = distanceKm * 0.21; // kg CO2 per km for average car
      
      switch (trip.mode) {
        case 'walking':
        case 'cycling':
          co2Saved += carEmissions; // Full savings
          break;
        case 'transit':
          co2Saved += carEmissions * 0.6; // 60% savings vs car
          break;
        case 'driving':
          // No savings for driving
          break;
      }
    });
    
    return `${Math.round(co2Saved)} kg`;
  }

  /**
   * Calculate fuel savings
   */
  private calculateFuelSaved(trips: TripData[]): string {
    let litersSaved = 0;
    
    trips.forEach(trip => {
      const distanceKm = trip.distance / 1000;
      const fuelConsumption = distanceKm * 0.08; // 8L/100km average
      
      switch (trip.mode) {
        case 'walking':
        case 'cycling':
          litersSaved += fuelConsumption;
          break;
        case 'transit':
          litersSaved += fuelConsumption * 0.7; // 70% savings
          break;
      }
    });
    
    const dollarsSaved = litersSaved * 1.50; // $1.50 per liter average
    return `$${Math.round(dollarsSaved)}`;
  }

  /**
   * Calculate eco-friendliness score (0-100)
   */
  private calculateEcoScore(trips: TripData[]): number {
    if (trips.length === 0) return 0;
    
    let ecoPoints = 0;
    
    trips.forEach(trip => {
      switch (trip.mode) {
        case 'walking':
          ecoPoints += 100;
          break;
        case 'cycling':
          ecoPoints += 90;
          break;
        case 'transit':
          ecoPoints += 70;
          break;
        case 'driving':
          ecoPoints += 20;
          break;
      }
    });
    
    return Math.round(ecoPoints / trips.length);
  }

  /**
   * Get weekly activity data
   */
  private getWeeklyData(trips: TripData[]): Array<{ day: string; miles: number; trips: number }> {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const weekData = days.map(day => ({ day, miles: 0, trips: 0 }));
    
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const recentTrips = trips.filter(trip => new Date(trip.startTime) >= oneWeekAgo);
    
    recentTrips.forEach(trip => {
      const dayIndex = new Date(trip.startTime).getDay();
      const miles = trip.distance * 0.000621371;
      
      weekData[dayIndex].miles += miles;
      weekData[dayIndex].trips += 1;
    });
    
    return weekData.map(data => ({
      ...data,
      miles: Math.round(data.miles)
    }));
  }

  /**
   * Get transport mode distribution
   */
  private getTransportModeDistribution(trips: TripData[]): Array<{ mode: string; percentage: number; color: string }> {
    const modeCounts = {
      driving: 0,
      walking: 0,
      cycling: 0,
      transit: 0
    };
    
    trips.forEach(trip => {
      modeCounts[trip.mode]++;
    });
    
    const total = trips.length;
    
    return [
      { 
        mode: 'Driving', 
        percentage: Math.round((modeCounts.driving / total) * 100) || 0,
        color: 'bg-blue-500' 
      },
      { 
        mode: 'Transit', 
        percentage: Math.round((modeCounts.transit / total) * 100) || 0,
        color: 'bg-green-500' 
      },
      { 
        mode: 'Walking', 
        percentage: Math.round((modeCounts.walking / total) * 100) || 0,
        color: 'bg-yellow-500' 
      },
      { 
        mode: 'Cycling', 
        percentage: Math.round((modeCounts.cycling / total) * 100) || 0,
        color: 'bg-purple-500' 
      }
    ].filter(mode => mode.percentage > 0);
  }

  /**
   * Calculate achievements based on actual usage
   */
  private calculateAchievements(trips: TripData[]): Array<{ id: number; name: string; description: string; icon: string; unlocked: boolean }> {
    const totalDistance = trips.reduce((sum, trip) => sum + trip.distance, 0) * 0.000621371; // miles
    const ecoTrips = trips.filter(trip => trip.mode === 'walking' || trip.mode === 'cycling' || trip.mode === 'transit').length;
    const morningTrips = trips.filter(trip => new Date(trip.startTime).getHours() < 8).length;
    const transitTrips = trips.filter(trip => trip.mode === 'transit').length;
    
    return [
      {
        id: 1,
        name: 'First Steps',
        description: 'Complete your first trip',
        icon: '👣',
        unlocked: trips.length >= 1
      },
      {
        id: 2,
        name: 'Explorer',
        description: 'Travel 100 miles',
        icon: '🗺️',
        unlocked: totalDistance >= 100
      },
      {
        id: 3,
        name: 'Eco Warrior',
        description: 'Take 25 eco-friendly trips',
        icon: '🌱',
        unlocked: ecoTrips >= 25
      },
      {
        id: 4,
        name: 'Early Bird',
        description: 'Take 10 trips before 8 AM',
        icon: '🌅',
        unlocked: morningTrips >= 10
      },
      {
        id: 5,
        name: 'Transit Hero',
        description: 'Take 20 public transit trips',
        icon: '🚇',
        unlocked: transitTrips >= 20
      },
      {
        id: 6,
        name: 'Road Warrior',
        description: 'Travel 1,000 miles',
        icon: '🛣️',
        unlocked: totalDistance >= 1000
      }
    ];
  }

  /**
   * Get recent trips for display
   */
  private getRecentTrips(trips: TripData[], limit: number): Array<{ from: string; to: string; distance: string; time: string; mode: string }> {
    return trips
      .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
      .slice(0, limit)
      .map(trip => ({
        from: trip.from.name,
        to: trip.to.name,
        distance: `${Math.round(trip.distance * 0.000621371)} mi`,
        time: `${Math.round(trip.duration / 60)} min`,
        mode: trip.mode.charAt(0).toUpperCase() + trip.mode.slice(1)
      }));
  }

  /**
   * Return empty analytics for new users
   */
  private getEmptyAnalytics(): AnalyticsData {
    return {
      totalDistance: '0 mi',
      totalTime: '0m',
      avgSpeed: '0 mph',
      co2Saved: '0 kg',
      fuelSaved: '$0',
      ecoScore: 0,
      weeklyData: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => ({ day, miles: 0, trips: 0 })),
      transportModes: [],
      achievements: [
        { id: 1, name: 'First Steps', description: 'Complete your first trip', icon: '👣', unlocked: false }
      ],
      recentTrips: []
    };
  }
}

export const realAnalyticsService = new RealAnalyticsService();
export default realAnalyticsService;