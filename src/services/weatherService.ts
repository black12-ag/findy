import React from 'react';
import { logger } from '../utils/logger';

export interface WeatherCondition {
  id: number;
  main: string; // Rain, Snow, Clear, etc.
  description: string; // light rain, broken clouds, etc.
  icon: string; // Weather icon ID
}

export interface WeatherData {
  location: {
    name: string;
    country: string;
    lat: number;
    lon: number;
  };
  current: {
    temp: number; // Temperature in Celsius
    feels_like: number;
    humidity: number; // Percentage
    pressure: number; // hPa
    visibility: number; // meters
    uv_index?: number;
    wind: {
      speed: number; // m/s
      deg: number; // degrees
      gust?: number; // m/s
    };
    weather: WeatherCondition[];
    timestamp: number;
  };
  forecast?: {
    hourly: Array<{
      timestamp: number;
      temp: number;
      weather: WeatherCondition[];
      precipitation: number; // mm/h
      wind_speed: number; // m/s
    }>;
    daily: Array<{
      date: string;
      temp_min: number;
      temp_max: number;
      weather: WeatherCondition[];
      precipitation: number; // mm
    }>;
  };
}

export interface DrivingConditions {
  safety_level: 'safe' | 'caution' | 'dangerous';
  visibility: 'excellent' | 'good' | 'poor' | 'very_poor';
  road_conditions: 'dry' | 'wet' | 'icy' | 'snow';
  recommendations: string[];
  alerts: Array<{
    type: 'rain' | 'snow' | 'wind' | 'fog' | 'heat' | 'cold';
    severity: 'low' | 'medium' | 'high';
    message: string;
  }>;
}

class WeatherService {
  private apiKey: string | null = null;
  private baseUrl = 'https://api.openweathermap.org/data/2.5';
  private lastFetch: { [key: string]: { data: WeatherData; timestamp: number } } = {};
  private cacheDuration = 10 * 60 * 1000; // 10 minutes

  constructor() {
    // Try to get API key from environment or localStorage
    this.apiKey = import.meta.env?.VITE_OPENWEATHER_API_KEY || 
                  localStorage.getItem('openweather_api_key') ||
                  null;
  }

  /**
   * Set OpenWeather API key
   */
  setApiKey(apiKey: string): void {
    this.apiKey = apiKey;
    localStorage.setItem('openweather_api_key', apiKey);
  }

  /**
   * Check if weather service is available
   */
  isAvailable(): boolean {
    return this.apiKey !== null;
  }

  /**
   * Get current weather for coordinates
   */
  async getCurrentWeather(lat: number, lon: number): Promise<WeatherData> {
    if (!this.apiKey) {
      throw new Error('OpenWeather API key not configured');
    }

    const cacheKey = `${lat.toFixed(2)},${lon.toFixed(2)}`;
    const cached = this.lastFetch[cacheKey];
    
    // Return cached data if recent
    if (cached && (Date.now() - cached.timestamp) < this.cacheDuration) {
      return cached.data;
    }

    try {
      const response = await fetch(
        `${this.baseUrl}/weather?lat=${lat}&lon=${lon}&appid=${this.apiKey}&units=metric`
      );

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Invalid OpenWeather API key');
        }
        throw new Error(`Weather API error: ${response.statusText}`);
      }

      const data = await response.json();
      
      const weatherData: WeatherData = {
        location: {
          name: data.name,
          country: data.sys.country,
          lat: data.coord.lat,
          lon: data.coord.lon
        },
        current: {
          temp: Math.round(data.main.temp),
          feels_like: Math.round(data.main.feels_like),
          humidity: data.main.humidity,
          pressure: data.main.pressure,
          visibility: data.visibility,
          wind: {
            speed: data.wind.speed,
            deg: data.wind.deg,
            gust: data.wind.gust
          },
          weather: data.weather,
          timestamp: Date.now()
        }
      };

      // Cache the result
      this.lastFetch[cacheKey] = {
        data: weatherData,
        timestamp: Date.now()
      };

      return weatherData;
    } catch (error) {
      logger.error('Failed to fetch weather data', error);
      throw error;
    }
  }

  /**
   * Get weather forecast for coordinates
   */
  async getForecast(lat: number, lon: number): Promise<WeatherData> {
    if (!this.apiKey) {
      throw new Error('OpenWeather API key not configured');
    }

    try {
      // Get current weather first
      const currentWeather = await this.getCurrentWeather(lat, lon);

      // Get 5-day forecast
      const forecastResponse = await fetch(
        `${this.baseUrl}/forecast?lat=${lat}&lon=${lon}&appid=${this.apiKey}&units=metric`
      );

      if (!forecastResponse.ok) {
        throw new Error(`Forecast API error: ${forecastResponse.statusText}`);
      }

      const forecastData = await forecastResponse.json();

      // Process hourly forecast (next 24 hours)
      const hourly = forecastData.list.slice(0, 8).map((item: any) => ({
        timestamp: item.dt * 1000,
        temp: Math.round(item.main.temp),
        weather: item.weather,
        precipitation: item.rain?.['3h'] || item.snow?.['3h'] || 0,
        wind_speed: item.wind.speed
      }));

      // Process daily forecast (next 5 days)
      const daily: any[] = [];
      const dailyMap = new Map();

      forecastData.list.forEach((item: any) => {
        const date = new Date(item.dt * 1000).toDateString();
        
        if (!dailyMap.has(date)) {
          dailyMap.set(date, {
            date,
            temps: [item.main.temp],
            weather: item.weather,
            precipitation: item.rain?.['3h'] || item.snow?.['3h'] || 0
          });
        } else {
          const day = dailyMap.get(date);
          day.temps.push(item.main.temp);
          day.precipitation += item.rain?.['3h'] || item.snow?.['3h'] || 0;
        }
      });

      dailyMap.forEach((day) => {
        daily.push({
          date: day.date,
          temp_min: Math.round(Math.min(...day.temps)),
          temp_max: Math.round(Math.max(...day.temps)),
          weather: day.weather,
          precipitation: Math.round(day.precipitation * 10) / 10
        });
      });

      return {
        ...currentWeather,
        forecast: {
          hourly,
          daily: daily.slice(0, 5)
        }
      };
    } catch (error) {
      logger.error('Failed to fetch forecast data', error);
      throw error;
    }
  }

  /**
   * Analyze driving conditions based on weather
   */
  analyzeDrivingConditions(weather: WeatherData): DrivingConditions {
    const current = weather.current;
    const conditions: DrivingConditions = {
      safety_level: 'safe',
      visibility: 'excellent',
      road_conditions: 'dry',
      recommendations: [],
      alerts: []
    };

    // Analyze weather conditions
    const mainWeather = current.weather[0]?.main.toLowerCase();
    const description = current.weather[0]?.description.toLowerCase();

    // Rain conditions
    if (mainWeather.includes('rain') || description.includes('rain')) {
      conditions.road_conditions = 'wet';
      conditions.safety_level = 'caution';
      conditions.recommendations.push('Reduce speed and increase following distance');
      conditions.recommendations.push('Use headlights and windshield wipers');
      
      if (description.includes('heavy')) {
        conditions.visibility = 'poor';
        conditions.safety_level = 'dangerous';
        conditions.alerts.push({
          type: 'rain',
          severity: 'high',
          message: 'Heavy rain - exercise extreme caution'
        });
      } else {
        conditions.alerts.push({
          type: 'rain',
          severity: 'medium',
          message: 'Rain detected - drive carefully'
        });
      }
    }

    // Snow conditions
    if (mainWeather.includes('snow') || description.includes('snow')) {
      conditions.road_conditions = 'snow';
      conditions.safety_level = 'dangerous';
      conditions.visibility = 'poor';
      conditions.recommendations.push('Use snow tires or chains');
      conditions.recommendations.push('Drive slowly and avoid sudden movements');
      conditions.recommendations.push('Keep extra distance between vehicles');
      
      conditions.alerts.push({
        type: 'snow',
        severity: 'high',
        message: 'Snow conditions - drive with extreme caution'
      });
    }

    // Ice conditions (freezing rain or very low temp with precipitation)
    if (current.temp <= 0 && (description.includes('rain') || current.humidity > 80)) {
      conditions.road_conditions = 'icy';
      conditions.safety_level = 'dangerous';
      conditions.recommendations.push('Consider postponing travel if possible');
      conditions.recommendations.push('Use tire chains and drive extremely slowly');
      
      conditions.alerts.push({
        type: 'snow',
        severity: 'high',
        message: 'Icy conditions likely - roads may be very slippery'
      });
    }

    // Wind conditions
    if (current.wind.speed > 10 || (current.wind.gust && current.wind.gust > 15)) {
      conditions.safety_level = conditions.safety_level === 'safe' ? 'caution' : conditions.safety_level;
      conditions.recommendations.push('Be alert for strong crosswinds');
      
      if (current.wind.speed > 15) {
        conditions.alerts.push({
          type: 'wind',
          severity: 'high',
          message: 'Strong winds - grip steering wheel firmly'
        });
      }
    }

    // Fog/visibility conditions
    if (description.includes('fog') || description.includes('mist') || current.visibility < 1000) {
      conditions.visibility = current.visibility < 200 ? 'very_poor' : 'poor';
      conditions.safety_level = 'dangerous';
      conditions.recommendations.push('Use fog lights and reduce speed significantly');
      conditions.recommendations.push('Use road markings to guide you');
      
      conditions.alerts.push({
        type: 'fog',
        severity: 'high',
        message: 'Low visibility conditions'
      });
    }

    // Temperature-based conditions
    if (current.temp > 35) {
      conditions.recommendations.push('Stay hydrated and use air conditioning');
      conditions.alerts.push({
        type: 'heat',
        severity: 'medium',
        message: 'High temperature - ensure vehicle cooling system is working'
      });
    } else if (current.temp < -10) {
      conditions.recommendations.push('Allow extra time for vehicle warm-up');
      conditions.recommendations.push('Check tire pressure and battery');
      conditions.alerts.push({
        type: 'cold',
        severity: 'medium',
        message: 'Very cold conditions - check vehicle readiness'
      });
    }

    return conditions;
  }

  /**
   * Get weather icon URL
   */
  getIconUrl(iconCode: string, size: '2x' | '4x' = '2x'): string {
    return `https://openweathermap.org/img/wn/${iconCode}@${size}.png`;
  }

  /**
   * Get weather emoji for condition
   */
  getWeatherEmoji(condition: WeatherCondition): string {
    const main = condition.main.toLowerCase();
    const description = condition.description.toLowerCase();

    if (main === 'clear') return '☀️';
    if (main === 'clouds') {
      if (description.includes('few')) return '🌤️';
      if (description.includes('scattered') || description.includes('broken')) return '⛅';
      return '☁️';
    }
    if (main === 'rain') {
      if (description.includes('light')) return '🌦️';
      if (description.includes('heavy')) return '🌧️';
      return '🌧️';
    }
    if (main === 'thunderstorm') return '⛈️';
    if (main === 'snow') return '🌨️';
    if (main === 'mist' || main === 'fog') return '🌫️';
    if (main === 'drizzle') return '🌦️';
    
    return '🌤️'; // Default
  }

  /**
   * Format temperature with units
   */
  formatTemperature(temp: number, unit: 'C' | 'F' = 'C'): string {
    if (unit === 'F') {
      return `${Math.round((temp * 9/5) + 32)}°F`;
    }
    return `${temp}°C`;
  }

  /**
   * Format wind speed with units
   */
  formatWindSpeed(speed: number, unit: 'ms' | 'kmh' | 'mph' = 'kmh'): string {
    switch (unit) {
      case 'ms':
        return `${speed.toFixed(1)} m/s`;
      case 'mph':
        return `${(speed * 2.237).toFixed(1)} mph`;
      case 'kmh':
      default:
        return `${(speed * 3.6).toFixed(1)} km/h`;
    }
  }
}

// React hook for weather data
export const useWeather = () => {
  const [weather, setWeather] = React.useState<WeatherData | null>(null);
  const [forecast, setForecast] = React.useState<WeatherData | null>(null);
  const [drivingConditions, setDrivingConditions] = React.useState<DrivingConditions | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<Error | null>(null);

  const fetchWeather = async (lat: number, lon: number, includeForecast = false) => {
    if (!weatherService.isAvailable()) {
      setError(new Error('Weather service not configured'));
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      if (includeForecast) {
        const forecastData = await weatherService.getForecast(lat, lon);
        setForecast(forecastData);
        setWeather(forecastData);
        setDrivingConditions(weatherService.analyzeDrivingConditions(forecastData));
      } else {
        const weatherData = await weatherService.getCurrentWeather(lat, lon);
        setWeather(weatherData);
        setDrivingConditions(weatherService.analyzeDrivingConditions(weatherData));
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch weather'));
    } finally {
      setIsLoading(false);
    }
  };

  const clearWeather = () => {
    setWeather(null);
    setForecast(null);
    setDrivingConditions(null);
    setError(null);
  };

  return {
    weather,
    forecast,
    drivingConditions,
    isLoading,
    error,
    isAvailable: weatherService.isAvailable(),
    fetchWeather,
    clearWeather,
    setApiKey: weatherService.setApiKey.bind(weatherService),
    getIconUrl: weatherService.getIconUrl.bind(weatherService),
    getWeatherEmoji: weatherService.getWeatherEmoji.bind(weatherService),
    formatTemperature: weatherService.formatTemperature.bind(weatherService),
    formatWindSpeed: weatherService.formatWindSpeed.bind(weatherService)
  };
};

export const weatherService = new WeatherService();
export default weatherService;