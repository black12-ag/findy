/**
 * 🧠 Navigation Intelligence Service
 * Advanced ML-powered navigation features with traffic prediction and personalization
 */

import { logger } from '../utils/logger';

export interface TrafficPrediction {
  routeId: string;
  predictions: Array<{
    timeWindow: string; // e.g., "08:00-09:00"
    predictedDuration: number; // seconds
    confidenceLevel: number; // 0-1
    factors: string[]; // ["rush_hour", "weather", "events"]
  }>;
  updatedAt: string;
}

export interface WeatherImpact {
  condition: 'clear' | 'rain' | 'snow' | 'fog' | 'ice' | 'wind';
  severity: 'light' | 'moderate' | 'heavy' | 'severe';
  speedReduction: number; // percentage
  visibilityReduction: number; // percentage
  routeRisk: 'low' | 'medium' | 'high' | 'dangerous';
  recommendations: string[];
}

export interface UserPreference {
  userId: string;
  preferredModes: string[];
  avoidancePreferences: string[];
  timePreferences: {
    departureFlexibility: number; // minutes
    arrivalImportance: number; // 0-1
  };
  routeHistory: Array<{
    from: { lat: number; lng: number };
    to: { lat: number; lng: number };
    selectedRoute: string;
    alternatives: string[];
    timestamp: string;
  }>;
}

export interface SmartRouteRecommendation {
  route: any;
  score: number;
  reasoning: string[];
  personalizedFactors: string[];
  predictedIssues: Array<{
    type: string;
    severity: number;
    timeframe: string;
    mitigation: string;
  }>;
}

class NavigationIntelligenceService {
  private trafficPatterns = new Map<string, any[]>();
  private weatherCache = new Map<string, WeatherImpact>();
  private userPreferences = new Map<string, UserPreference>();
  private mlModels = new Map<string, any>();
  private historicalData = new Map<string, any[]>();
  
  private readonly cacheTimeout = 15 * 60 * 1000; // 15 minutes
  private readonly maxHistorySize = 1000;

  /**
   * Initialize the service and load ML models
   */
  async initialize(): Promise<void> {
    try {
      // Initialize traffic pattern analysis
      await this.initializeTrafficModels();
      
      // Load historical data
      await this.loadHistoricalData();
      
      // Initialize weather integration
      await this.initializeWeatherService();
      
      logger.info('Navigation Intelligence Service initialized');
    } catch (error) {
      logger.error('Failed to initialize Navigation Intelligence Service', error);
    }
  }

  /**
   * Get smart route recommendations based on ML predictions
   */
  async getSmartRouteRecommendations(
    from: { lat: number; lng: number },
    to: { lat: number; lng: number },
    options: {
      userId?: string;
      departureTime?: string;
      transportMode?: string;
      maxAlternatives?: number;
    }
  ): Promise<SmartRouteRecommendation[]> {
    const recommendations: SmartRouteRecommendation[] = [];
    
    try {
      // Get base routes from routing service
      const baseRoutes = await this.getBaseRoutes(from, to, options);
      
      // Apply ML predictions and personalization
      for (const route of baseRoutes) {
        const prediction = await this.analyzeRoute(route, options);
        const personalization = await this.personalizeRoute(route, options.userId);
        const weatherImpact = await this.getWeatherImpact(route);
        
        const recommendation = this.buildRecommendation(
          route, 
          prediction, 
          personalization, 
          weatherImpact
        );
        
        recommendations.push(recommendation);
      }
      
      // Sort by score and return top recommendations
      return recommendations
        .sort((a, b) => b.score - a.score)
        .slice(0, options.maxAlternatives || 3);
      
    } catch (error) {
      logger.error('Failed to generate smart route recommendations', error);
      return [];
    }
  }

  /**
   * Predict traffic conditions for a specific time and route
   */
  async predictTraffic(
    routeId: string,
    departureTime: string,
    predictionHours: number = 4
  ): Promise<TrafficPrediction> {
    try {
      const model = this.mlModels.get('traffic_prediction');
      if (!model) {
        return this.generateFallbackTrafficPrediction(routeId, departureTime);
      }

      const historical = this.getHistoricalTrafficData(routeId);
      const predictions: any[] = [];
      
      const startTime = new Date(departureTime);
      
      for (let i = 0; i < predictionHours; i++) {
        const timeWindow = new Date(startTime.getTime() + i * 60 * 60 * 1000);
        const features = this.extractTrafficFeatures(timeWindow, historical);
        
        const prediction = await this.runTrafficPredictionModel(features);
        
        predictions.push({
          timeWindow: `${timeWindow.getHours().toString().padStart(2, '0')}:00-${(timeWindow.getHours() + 1).toString().padStart(2, '0')}:00`,
          predictedDuration: prediction.duration,
          confidenceLevel: prediction.confidence,
          factors: prediction.factors
        });
      }
      
      return {
        routeId,
        predictions,
        updatedAt: new Date().toISOString()
      };
      
    } catch (error) {
      logger.error('Traffic prediction failed', error);
      return this.generateFallbackTrafficPrediction(routeId, departureTime);
    }
  }

  /**
   * Analyze weather impact on navigation
   */
  async analyzeWeatherImpact(
    route: any,
    currentWeather?: any
  ): Promise<WeatherImpact> {
    const cacheKey = `weather_${route.id}_${Date.now().toString().slice(0, -5)}0000`;
    
    if (this.weatherCache.has(cacheKey)) {
      return this.weatherCache.get(cacheKey)!;
    }
    
    try {
      const weather = currentWeather || await this.getCurrentWeather(route);
      const impact = this.calculateWeatherImpact(weather, route);
      
      this.weatherCache.set(cacheKey, impact);
      
      // Clean old cache entries
      setTimeout(() => {
        this.weatherCache.delete(cacheKey);
      }, this.cacheTimeout);
      
      return impact;
      
    } catch (error) {
      logger.error('Weather analysis failed', error);
      return this.getDefaultWeatherImpact();
    }
  }

  /**
   * Learn from user's route selection patterns
   */
  async learnFromUserChoice(
    userId: string,
    selectedRoute: any,
    alternatives: any[],
    context: {
      departureTime: string;
      weather?: string;
      traffic?: string;
      purpose?: string;
    }
  ): Promise<void> {
    try {
      const preference = this.userPreferences.get(userId) || this.getDefaultUserPreference(userId);
      
      // Add to route history
      preference.routeHistory.push({
        from: selectedRoute.from,
        to: selectedRoute.to,
        selectedRoute: selectedRoute.id,
        alternatives: alternatives.map(alt => alt.id),
        timestamp: new Date().toISOString()
      });
      
      // Keep history size manageable
      if (preference.routeHistory.length > this.maxHistorySize) {
        preference.routeHistory = preference.routeHistory.slice(-this.maxHistorySize);
      }
      
      // Update preferences based on choice patterns
      await this.updatePreferencesFromHistory(preference, context);
      
      this.userPreferences.set(userId, preference);
      
      // Save to persistent storage
      await this.saveUserPreferences(userId, preference);
      
    } catch (error) {
      logger.error('Failed to learn from user choice', error);
    }
  }

  /**
   * Get personalized route scoring
   */
  async getPersonalizedRouteScore(
    route: any,
    userId?: string
  ): Promise<{
    score: number;
    factors: Array<{ factor: string; weight: number; contribution: number }>;
  }> {
    if (!userId) {
      return { score: 0.5, factors: [] };
    }
    
    const preferences = this.userPreferences.get(userId);
    if (!preferences) {
      return { score: 0.5, factors: [] };
    }
    
    const factors = [];
    let totalScore = 0;
    let totalWeight = 0;
    
    // Mode preference
    const modeWeight = 0.3;
    const modeScore = preferences.preferredModes.includes(route.mode) ? 1 : 0.3;
    factors.push({
      factor: 'mode_preference',
      weight: modeWeight,
      contribution: modeScore * modeWeight
    });
    totalScore += modeScore * modeWeight;
    totalWeight += modeWeight;
    
    // Historical route similarity
    const historyWeight = 0.25;
    const historyScore = this.calculateHistoricalSimilarity(route, preferences.routeHistory);
    factors.push({
      factor: 'historical_preference',
      weight: historyWeight,
      contribution: historyScore * historyWeight
    });
    totalScore += historyScore * historyWeight;
    totalWeight += historyWeight;
    
    // Time preferences
    const timeWeight = 0.2;
    const timeScore = this.calculateTimePreferenceScore(route, preferences.timePreferences);
    factors.push({
      factor: 'time_preference',
      weight: timeWeight,
      contribution: timeScore * timeWeight
    });
    totalScore += timeScore * timeWeight;
    totalWeight += timeWeight;
    
    // Avoidance preferences
    const avoidanceWeight = 0.25;
    const avoidanceScore = this.calculateAvoidanceScore(route, preferences.avoidancePreferences);
    factors.push({
      factor: 'avoidance_preference',
      weight: avoidanceWeight,
      contribution: avoidanceScore * avoidanceWeight
    });
    totalScore += avoidanceScore * avoidanceWeight;
    totalWeight += avoidanceWeight;
    
    return {
      score: totalWeight > 0 ? totalScore / totalWeight : 0.5,
      factors
    };
  }

  // Private helper methods

  private async initializeTrafficModels(): Promise<void> {
    // In a real implementation, this would load TensorFlow.js models
    // For demo, we'll create mock models
    this.mlModels.set('traffic_prediction', {
      predict: (features: number[]) => {
        // Simple heuristic-based prediction
        const hour = features[0];
        const dayOfWeek = features[1];
        const weather = features[2];
        
        let baseMultiplier = 1.0;
        
        // Rush hour impact
        if ((hour >= 7 && hour <= 9) || (hour >= 17 && hour <= 19)) {
          baseMultiplier *= 1.6;
        } else if (hour >= 22 || hour <= 6) {
          baseMultiplier *= 0.7;
        }
        
        // Weekend impact
        if (dayOfWeek === 0 || dayOfWeek === 6) {
          baseMultiplier *= 0.8;
        }
        
        // Weather impact
        if (weather > 0.5) { // Bad weather
          baseMultiplier *= 1.3;
        }
        
        return {
          duration: Math.round(baseMultiplier * 1000), // Base 1000 seconds
          confidence: Math.max(0.6, Math.random()),
          factors: this.identifyTrafficFactors(hour, dayOfWeek, weather)
        };
      }
    });
  }

  private async loadHistoricalData(): Promise<void> {
    // Load historical traffic and route data
    // In a real app, this would come from a database
    try {
      const storedData = localStorage.getItem('navigation_historical_data');
      if (storedData) {
        const data = JSON.parse(storedData);
        Object.entries(data).forEach(([key, value]) => {
          this.historicalData.set(key, value as any[]);
        });
      }
    } catch (error) {
      logger.warn('Failed to load historical data', error);
    }
  }

  private async initializeWeatherService(): Promise<void> {
    // Initialize weather API integration
    // This would typically involve API key setup and endpoint configuration
  }

  private async getBaseRoutes(from: any, to: any, options: any): Promise<any[]> {
    // This would integrate with the existing routing services
    // For demo, return mock routes
    return [
      {
        id: 'route_1',
        from,
        to,
        mode: options.transportMode || 'driving',
        distance: Math.random() * 20 + 5, // 5-25 km
        duration: Math.random() * 1800 + 600, // 10-40 minutes
        tolls: Math.random() > 0.7,
        highways: Math.random() > 0.5
      },
      {
        id: 'route_2', 
        from,
        to,
        mode: options.transportMode || 'driving',
        distance: Math.random() * 25 + 8,
        duration: Math.random() * 2100 + 900,
        tolls: Math.random() > 0.8,
        highways: Math.random() > 0.3
      }
    ];
  }

  private async analyzeRoute(route: any, options: any): Promise<any> {
    // Run ML analysis on the route
    return {
      trafficPrediction: await this.predictTraffic(route.id, options.departureTime || new Date().toISOString()),
      congestionRisk: Math.random(),
      alternativeAvailability: Math.random(),
      reliability: Math.random()
    };
  }

  private async personalizeRoute(route: any, userId?: string): Promise<any> {
    if (!userId) return { score: 0.5, factors: [] };
    
    return await this.getPersonalizedRouteScore(route, userId);
  }

  private async getWeatherImpact(route: any): Promise<WeatherImpact> {
    return await this.analyzeWeatherImpact(route);
  }

  private buildRecommendation(
    route: any,
    prediction: any,
    personalization: any,
    weather: WeatherImpact
  ): SmartRouteRecommendation {
    // Combine all factors into a final score
    let score = 0.5; // Base score
    const reasoning: string[] = [];
    const personalizedFactors: string[] = [];
    
    // Traffic prediction impact
    if (prediction.trafficPrediction.predictions.length > 0) {
      const avgConfidence = prediction.trafficPrediction.predictions.reduce((sum: number, p: any) => 
        sum + p.confidenceLevel, 0) / prediction.trafficPrediction.predictions.length;
      score += (avgConfidence - 0.5) * 0.3;
      reasoning.push(`Traffic prediction confidence: ${Math.round(avgConfidence * 100)}%`);
    }
    
    // Personalization impact
    score += (personalization.score - 0.5) * 0.4;
    personalizedFactors.push(...personalization.factors.map((f: any) => f.factor));
    
    // Weather impact
    const weatherMultiplier = this.getWeatherScoreMultiplier(weather);
    score *= weatherMultiplier;
    if (weather.routeRisk !== 'low') {
      reasoning.push(`Weather conditions may affect travel (${weather.condition})`);
    }
    
    // Ensure score is within bounds
    score = Math.max(0, Math.min(1, score));
    
    return {
      route,
      score,
      reasoning,
      personalizedFactors,
      predictedIssues: this.identifyPredictedIssues(prediction, weather)
    };
  }

  private getWeatherScoreMultiplier(weather: WeatherImpact): number {
    switch (weather.routeRisk) {
      case 'low': return 1.0;
      case 'medium': return 0.9;
      case 'high': return 0.7;
      case 'dangerous': return 0.4;
      default: return 1.0;
    }
  }

  private identifyPredictedIssues(prediction: any, weather: WeatherImpact): any[] {
    const issues = [];
    
    // Traffic-based issues
    if (prediction.congestionRisk > 0.7) {
      issues.push({
        type: 'traffic_congestion',
        severity: prediction.congestionRisk,
        timeframe: 'next 2 hours',
        mitigation: 'Consider departing 30 minutes earlier or later'
      });
    }
    
    // Weather-based issues
    if (weather.routeRisk !== 'low') {
      issues.push({
        type: 'weather_hazard',
        severity: weather.severity === 'severe' ? 0.9 : weather.severity === 'heavy' ? 0.7 : 0.5,
        timeframe: 'current conditions',
        mitigation: weather.recommendations[0] || 'Drive carefully and allow extra time'
      });
    }
    
    return issues;
  }

  private generateFallbackTrafficPrediction(routeId: string, departureTime: string): TrafficPrediction {
    const predictions = [];
    const startHour = new Date(departureTime).getHours();
    
    for (let i = 0; i < 4; i++) {
      const hour = (startHour + i) % 24;
      let multiplier = 1.0;
      
      if ((hour >= 7 && hour <= 9) || (hour >= 17 && hour <= 19)) {
        multiplier = 1.5; // Rush hour
      }
      
      predictions.push({
        timeWindow: `${hour.toString().padStart(2, '0')}:00-${((hour + 1) % 24).toString().padStart(2, '0')}:00`,
        predictedDuration: Math.round(multiplier * 1200), // Base 20 minutes
        confidenceLevel: 0.7,
        factors: hour >= 7 && hour <= 9 || hour >= 17 && hour <= 19 ? ['rush_hour'] : []
      });
    }
    
    return {
      routeId,
      predictions,
      updatedAt: new Date().toISOString()
    };
  }

  private calculateWeatherImpact(weather: any, route: any): WeatherImpact {
    // Simplified weather impact calculation
    const condition = weather.condition || 'clear';
    const severity = weather.severity || 'light';
    
    let speedReduction = 0;
    let visibilityReduction = 0;
    let routeRisk: WeatherImpact['routeRisk'] = 'low';
    const recommendations: string[] = [];
    
    switch (condition) {
      case 'rain':
        speedReduction = severity === 'heavy' ? 30 : severity === 'moderate' ? 20 : 10;
        visibilityReduction = severity === 'heavy' ? 40 : 20;
        routeRisk = severity === 'heavy' ? 'medium' : 'low';
        recommendations.push('Reduce speed and increase following distance');
        break;
      case 'snow':
        speedReduction = severity === 'heavy' ? 50 : 35;
        visibilityReduction = severity === 'heavy' ? 60 : 40;
        routeRisk = severity === 'heavy' ? 'high' : 'medium';
        recommendations.push('Use winter tires and drive slowly');
        break;
      case 'ice':
        speedReduction = 60;
        routeRisk = 'dangerous';
        recommendations.push('Avoid travel if possible, use extreme caution');
        break;
      case 'fog':
        visibilityReduction = severity === 'heavy' ? 80 : 50;
        routeRisk = severity === 'heavy' ? 'high' : 'medium';
        recommendations.push('Use fog lights and reduce speed significantly');
        break;
      default:
        // Clear conditions
        break;
    }
    
    return {
      condition: condition as WeatherImpact['condition'],
      severity: severity as WeatherImpact['severity'],
      speedReduction,
      visibilityReduction,
      routeRisk,
      recommendations
    };
  }

  private getDefaultWeatherImpact(): WeatherImpact {
    return {
      condition: 'clear',
      severity: 'light',
      speedReduction: 0,
      visibilityReduction: 0,
      routeRisk: 'low',
      recommendations: []
    };
  }

  private getDefaultUserPreference(userId: string): UserPreference {
    return {
      userId,
      preferredModes: ['driving'],
      avoidancePreferences: [],
      timePreferences: {
        departureFlexibility: 15,
        arrivalImportance: 0.8
      },
      routeHistory: []
    };
  }

  private calculateHistoricalSimilarity(route: any, history: any[]): number {
    if (history.length === 0) return 0.5;
    
    // Simple similarity based on route characteristics
    const similarRoutes = history.filter(h => {
      const distanceSimilar = Math.abs(route.distance - (h.distance || 10)) < 5;
      const modeSimilar = route.mode === (h.mode || 'driving');
      return distanceSimilar && modeSimilar;
    });
    
    return Math.min(1, similarRoutes.length / Math.min(10, history.length));
  }

  private calculateTimePreferenceScore(route: any, timePrefs: any): number {
    // Simplified time preference scoring
    return 0.5 + (Math.random() - 0.5) * 0.4; // Random variation for demo
  }

  private calculateAvoidanceScore(route: any, avoidances: string[]): number {
    let score = 1.0;
    
    if (avoidances.includes('tolls') && route.tolls) {
      score -= 0.3;
    }
    if (avoidances.includes('highways') && route.highways) {
      score -= 0.2;
    }
    
    return Math.max(0, score);
  }

  private identifyTrafficFactors(hour: number, dayOfWeek: number, weather: number): string[] {
    const factors = [];
    
    if ((hour >= 7 && hour <= 9) || (hour >= 17 && hour <= 19)) {
      factors.push('rush_hour');
    }
    if (dayOfWeek === 1) { // Monday
      factors.push('monday_effect');
    }
    if (weather > 0.5) {
      factors.push('weather');
    }
    
    return factors;
  }

  private getHistoricalTrafficData(routeId: string): any[] {
    return this.historicalData.get(routeId) || [];
  }

  private extractTrafficFeatures(time: Date, historical: any[]): number[] {
    return [
      time.getHours(),
      time.getDay(),
      Math.random() // Weather placeholder
    ];
  }

  private async runTrafficPredictionModel(features: number[]): Promise<any> {
    const model = this.mlModels.get('traffic_prediction');
    return model ? model.predict(features) : { duration: 1000, confidence: 0.7, factors: [] };
  }

  private async updatePreferencesFromHistory(preference: UserPreference, context: any): Promise<void> {
    // Analyze route history to update preferences
    // This would use more sophisticated ML in a real implementation
    const recentHistory = preference.routeHistory.slice(-50); // Last 50 routes
    
    // Update mode preferences based on frequency
    const modeFreq = new Map<string, number>();
    recentHistory.forEach(h => {
      const mode = (h as any).mode || 'driving';
      modeFreq.set(mode, (modeFreq.get(mode) || 0) + 1);
    });
    
    const sortedModes = Array.from(modeFreq.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([mode]) => mode);
    
    preference.preferredModes = sortedModes.slice(0, 3);
  }

  private async saveUserPreferences(userId: string, preference: UserPreference): Promise<void> {
    try {
      const allPrefs = JSON.parse(localStorage.getItem('user_navigation_preferences') || '{}');
      allPrefs[userId] = preference;
      localStorage.setItem('user_navigation_preferences', JSON.stringify(allPrefs));
    } catch (error) {
      logger.warn('Failed to save user preferences', error);
    }
  }

  private async getCurrentWeather(route: any): Promise<any> {
    // Mock weather data - in real app would call weather API
    const conditions = ['clear', 'rain', 'snow', 'fog'];
    const severities = ['light', 'moderate', 'heavy'];
    
    return {
      condition: conditions[Math.floor(Math.random() * conditions.length)],
      severity: severities[Math.floor(Math.random() * severities.length)]
    };
  }
}

export const navigationIntelligenceService = new NavigationIntelligenceService();