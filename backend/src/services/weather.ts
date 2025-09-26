import axios from 'axios';
import { config } from '@/config/env';
import { logger } from '@/config/logger';
import { redisClient } from '@/config/redis';
import { AppError } from '@/utils/error';
import type { Location } from '@/types/maps';

interface WeatherCondition {
  id: number;
  main: string;
  description: string;
  icon: string;
}

interface WeatherData {
  temperature: number;
  feelsLike: number;
  humidity: number;
  pressure: number;
  visibility: number;
  windSpeed: number;
  windDirection: number;
  cloudCover: number;
  uvIndex?: number;
  conditions: WeatherCondition[];
  timestamp: number;
}

interface ForecastItem {
  timestamp: number;
  temperature: number;
  conditions: WeatherCondition[];
  windSpeed: number;
  precipitationChance: number;
  precipitationType?: string;
}

interface WeatherAlert {
  id: string;
  title: string;
  description: string;
  severity: 'minor' | 'moderate' | 'severe' | 'extreme';
  startTime: number;
  endTime: number;
  areas: string[];
}

interface RouteWeatherConditions {
  origin: WeatherData;
  destination: WeatherData;
  waypoints: WeatherData[];
  alerts: WeatherAlert[];
  travelRecommendations: {
    safetyLevel: 'good' | 'moderate' | 'poor' | 'dangerous';
    recommendations: string[];
    alternativeTimes?: number[];
  };
}

class WeatherService {
  private readonly baseUrl = 'https://api.openweathermap.org/data/2.5';
  private readonly apiKey = config.weather.apiKey;
  private readonly cachePrefix = 'weather:';
  private readonly cacheDuration = 600; // 10 minutes

  /**
   * Get current weather for a location
   */
  async getCurrentWeather(location: Location): Promise<WeatherData> {
    try {
      const cacheKey = `${this.cachePrefix}current:${location.lat}:${location.lng}`;
      
      // Try to get from cache
      const cached = await redisClient.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }

      // Fetch from OpenWeatherMap API
      const response = await axios.get(`${this.baseUrl}/weather`, {
        params: {
          lat: location.lat,
          lon: location.lng,
          appid: this.apiKey,
          units: 'metric',
        },
        timeout: 5000,
      });

      const data = response.data;
      const weatherData: WeatherData = {
        temperature: Math.round(data.main.temp),
        feelsLike: Math.round(data.main.feels_like),
        humidity: data.main.humidity,
        pressure: data.main.pressure,
        visibility: data.visibility / 1000, // Convert to km
        windSpeed: data.wind.speed * 3.6, // Convert m/s to km/h
        windDirection: data.wind.deg,
        cloudCover: data.clouds.all,
        conditions: data.weather.map((w: any) => ({
          id: w.id,
          main: w.main,
          description: w.description,
          icon: w.icon,
        })),
        timestamp: Date.now(),
      };

      // Cache the result
      await redisClient.setex(cacheKey, this.cacheDuration, JSON.stringify(weatherData));

      return weatherData;
    } catch (error) {
      logger.error('Error fetching current weather:', error);
      throw new AppError('Failed to fetch weather data', 500);
    }
  }

  /**
   * Get weather forecast for a location
   */
  async getWeatherForecast(location: Location, hours: number = 24): Promise<ForecastItem[]> {
    try {
      const cacheKey = `${this.cachePrefix}forecast:${location.lat}:${location.lng}:${hours}`;
      
      // Try to get from cache
      const cached = await redisClient.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }

      // Fetch from OpenWeatherMap API
      const response = await axios.get(`${this.baseUrl}/forecast`, {
        params: {
          lat: location.lat,
          lon: location.lng,
          appid: this.apiKey,
          units: 'metric',
          cnt: Math.min(40, Math.ceil(hours / 3)), // API returns 3-hour intervals
        },
        timeout: 5000,
      });

      const forecast: ForecastItem[] = response.data.list.map((item: any) => ({
        timestamp: item.dt * 1000,
        temperature: Math.round(item.main.temp),
        conditions: item.weather.map((w: any) => ({
          id: w.id,
          main: w.main,
          description: w.description,
          icon: w.icon,
        })),
        windSpeed: item.wind.speed * 3.6,
        precipitationChance: Math.round((item.pop || 0) * 100),
        precipitationType: item.rain ? 'rain' : item.snow ? 'snow' : undefined,
      }));

      // Cache the result
      await redisClient.setex(cacheKey, this.cacheDuration, JSON.stringify(forecast));

      return forecast;
    } catch (error) {
      logger.error('Error fetching weather forecast:', error);
      throw new AppError('Failed to fetch weather forecast', 500);
    }
  }

  /**
   * Get weather alerts for a location
   */
  async getWeatherAlerts(location: Location): Promise<WeatherAlert[]> {
    try {
      const cacheKey = `${this.cachePrefix}alerts:${location.lat}:${location.lng}`;
      
      // Try to get from cache
      const cached = await redisClient.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }

      // Fetch from OpenWeatherMap One Call API (if available)
      const response = await axios.get(`${this.baseUrl}/onecall`, {
        params: {
          lat: location.lat,
          lon: location.lng,
          appid: this.apiKey,
          exclude: 'minutely,daily',
        },
        timeout: 5000,
      });

      const alerts: WeatherAlert[] = (response.data.alerts || []).map((alert: any) => ({
        id: `${alert.sender_name}_${alert.start}`,
        title: alert.event,
        description: alert.description,
        severity: this.mapAlertSeverity(alert.tags),
        startTime: alert.start * 1000,
        endTime: alert.end * 1000,
        areas: alert.tags || [],
      }));

      // Cache the result
      await redisClient.setex(cacheKey, this.cacheDuration, JSON.stringify(alerts));

      return alerts;
    } catch (error) {
      // If One Call API is not available, return empty array
      logger.warn('Weather alerts not available:', error.response?.status);
      return [];
    }
  }

  /**
   * Get weather conditions along a route
   */
  async getRouteWeatherConditions(
    origin: Location,
    destination: Location,
    waypoints: Location[] = []
  ): Promise<RouteWeatherConditions> {
    try {
      const allLocations = [origin, ...waypoints, destination];
      
      // Fetch weather for all locations in parallel
      const [weatherData, alerts] = await Promise.all([
        Promise.all(allLocations.map(location => this.getCurrentWeather(location))),
        this.getWeatherAlerts(origin), // Primary alerts from origin
      ]);

      const [originWeather, ...waypointWeather] = weatherData;
      const destinationWeather = waypointWeather.pop()!;
      
      const routeConditions: RouteWeatherConditions = {
        origin: originWeather,
        destination: destinationWeather,
        waypoints: waypointWeather,
        alerts,
        travelRecommendations: this.generateTravelRecommendations(weatherData, alerts),
      };

      return routeConditions;
    } catch (error) {
      logger.error('Error fetching route weather conditions:', error);
      throw new AppError('Failed to fetch route weather conditions', 500);
    }
  }

  /**
   * Check if weather conditions are suitable for travel
   */
  async isTravelSafe(location: Location, travelMode: string = 'DRIVING'): Promise<{
    safe: boolean;
    level: 'good' | 'moderate' | 'poor' | 'dangerous';
    reasons: string[];
    recommendations: string[];
  }> {
    try {
      const [weather, alerts] = await Promise.all([
        this.getCurrentWeather(location),
        this.getWeatherAlerts(location),
      ]);

      const reasons: string[] = [];
      const recommendations: string[] = [];
      let safetyLevel: 'good' | 'moderate' | 'poor' | 'dangerous' = 'good';

      // Check for severe weather alerts
      const severeAlerts = alerts.filter(alert => 
        ['severe', 'extreme'].includes(alert.severity)
      );

      if (severeAlerts.length > 0) {
        safetyLevel = 'dangerous';
        reasons.push('Severe weather alerts in effect');
        recommendations.push('Consider postponing travel until alerts are lifted');
      }

      // Check visibility
      if (weather.visibility < 1) {
        safetyLevel = 'dangerous';
        reasons.push('Very poor visibility (less than 1km)');
        recommendations.push('Avoid travel due to extremely poor visibility');
      } else if (weather.visibility < 5) {
        if (safetyLevel === 'good') safetyLevel = 'poor';
        reasons.push('Poor visibility');
        recommendations.push('Use headlights and reduce speed');
      }

      // Check wind conditions
      if (weather.windSpeed > 80) {
        safetyLevel = 'dangerous';
        reasons.push('Extremely high winds');
        recommendations.push('Avoid travel due to dangerous wind conditions');
      } else if (weather.windSpeed > 50) {
        if (safetyLevel === 'good') safetyLevel = 'poor';
        reasons.push('High winds');
        recommendations.push('Exercise caution, especially in high-profile vehicles');
      }

      // Check for severe weather conditions
      const severeConditions = weather.conditions.some(condition => 
        ['Thunderstorm', 'Snow', 'Fog'].includes(condition.main)
      );

      if (severeConditions) {
        const thunderstorm = weather.conditions.find(c => c.main === 'Thunderstorm');
        const snow = weather.conditions.find(c => c.main === 'Snow');
        const fog = weather.conditions.find(c => c.main === 'Fog');

        if (thunderstorm) {
          if (safetyLevel === 'good') safetyLevel = 'moderate';
          reasons.push('Thunderstorm conditions');
          recommendations.push('Avoid parking under trees, reduce speed');
        }

        if (snow) {
          if (safetyLevel === 'good') safetyLevel = 'moderate';
          reasons.push('Snow conditions');
          recommendations.push('Use winter tires, carry emergency supplies');
        }

        if (fog) {
          if (safetyLevel === 'good') safetyLevel = 'moderate';
          reasons.push('Foggy conditions');
          recommendations.push('Use low-beam headlights, maintain safe distance');
        }
      }

      // Adjust recommendations based on travel mode
      if (travelMode === 'WALKING' || travelMode === 'BICYCLING') {
        if (weather.temperature < -10) {
          if (safetyLevel === 'good') safetyLevel = 'moderate';
          reasons.push('Very cold temperatures');
          recommendations.push('Dress warmly, limit exposure time');
        } else if (weather.temperature > 35) {
          if (safetyLevel === 'good') safetyLevel = 'moderate';
          reasons.push('Very hot temperatures');
          recommendations.push('Stay hydrated, seek shade when possible');
        }
      }

      const isSafe = !['dangerous', 'poor'].includes(safetyLevel);

      if (reasons.length === 0) {
        recommendations.push('Weather conditions are good for travel');
      }

      return {
        safe: isSafe,
        level: safetyLevel,
        reasons,
        recommendations,
      };
    } catch (error) {
      logger.error('Error checking travel safety:', error);
      throw new AppError('Failed to check travel safety', 500);
    }
  }

  /**
   * Generate travel recommendations based on weather data
   */
  private generateTravelRecommendations(
    weatherData: WeatherData[],
    alerts: WeatherAlert[]
  ): RouteWeatherConditions['travelRecommendations'] {
    const recommendations: string[] = [];
    let safetyLevel: 'good' | 'moderate' | 'poor' | 'dangerous' = 'good';

    // Check for severe alerts
    const severeAlerts = alerts.filter(alert => 
      ['severe', 'extreme'].includes(alert.severity)
    );

    if (severeAlerts.length > 0) {
      safetyLevel = 'dangerous';
      recommendations.push('Severe weather alerts are in effect - consider postponing travel');
    }

    // Analyze weather along the route
    const minVisibility = Math.min(...weatherData.map(w => w.visibility));
    const maxWindSpeed = Math.max(...weatherData.map(w => w.windSpeed));
    const hasThunderstorm = weatherData.some(w => 
      w.conditions.some(c => c.main === 'Thunderstorm')
    );
    const hasSnow = weatherData.some(w => 
      w.conditions.some(c => c.main === 'Snow')
    );

    if (minVisibility < 1) {
      safetyLevel = 'dangerous';
      recommendations.push('Extremely poor visibility along route - avoid travel');
    } else if (minVisibility < 5) {
      if (safetyLevel === 'good') safetyLevel = 'poor';
      recommendations.push('Reduced visibility expected - use headlights and drive slowly');
    }

    if (maxWindSpeed > 80) {
      safetyLevel = 'dangerous';
      recommendations.push('Dangerous wind conditions - postpone travel');
    } else if (maxWindSpeed > 50) {
      if (safetyLevel === 'good') safetyLevel = 'poor';
      recommendations.push('High winds expected - exercise extreme caution');
    }

    if (hasThunderstorm) {
      if (safetyLevel === 'good') safetyLevel = 'moderate';
      recommendations.push('Thunderstorms along route - avoid stopping under trees');
    }

    if (hasSnow) {
      if (safetyLevel === 'good') safetyLevel = 'moderate';
      recommendations.push('Snow conditions expected - use winter tires and carry emergency supplies');
    }

    if (recommendations.length === 0) {
      recommendations.push('Weather conditions are favorable for travel');
    }

    return {
      safetyLevel,
      recommendations,
    };
  }

  /**
   * Map alert severity from API tags
   */
  private mapAlertSeverity(tags: string[]): 'minor' | 'moderate' | 'severe' | 'extreme' {
    if (!tags || tags.length === 0) return 'minor';

    const tagStr = tags.join(' ').toLowerCase();
    
    if (tagStr.includes('extreme') || tagStr.includes('emergency')) {
      return 'extreme';
    } else if (tagStr.includes('severe') || tagStr.includes('warning')) {
      return 'severe';
    } else if (tagStr.includes('moderate') || tagStr.includes('watch')) {
      return 'moderate';
    }
    
    return 'minor';
  }

  /**
   * Get weather summary for display
   */
  async getWeatherSummary(location: Location): Promise<{
    current: {
      temperature: number;
      description: string;
      icon: string;
    };
    forecast: {
      time: string;
      temperature: number;
      icon: string;
      precipitationChance: number;
    }[];
    alerts: number;
  }> {
    try {
      const [current, forecast, alerts] = await Promise.all([
        this.getCurrentWeather(location),
        this.getWeatherForecast(location, 12),
        this.getWeatherAlerts(location),
      ]);

      return {
        current: {
          temperature: current.temperature,
          description: current.conditions[0]?.description || 'Unknown',
          icon: current.conditions[0]?.icon || '01d',
        },
        forecast: forecast.slice(0, 4).map(item => ({
          time: new Date(item.timestamp).toLocaleTimeString('en-US', {
            hour: 'numeric',
            hour12: true,
          }),
          temperature: item.temperature,
          icon: item.conditions[0]?.icon || '01d',
          precipitationChance: item.precipitationChance,
        })),
        alerts: alerts.length,
      };
    } catch (error) {
      logger.error('Error getting weather summary:', error);
      throw new AppError('Failed to get weather summary', 500);
    }
  }
}

export const weatherService = new WeatherService();