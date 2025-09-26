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
declare class WeatherService {
    private readonly baseUrl;
    private readonly apiKey;
    private readonly cachePrefix;
    private readonly cacheDuration;
    getCurrentWeather(location: Location): Promise<WeatherData>;
    getWeatherForecast(location: Location, hours?: number): Promise<ForecastItem[]>;
    getWeatherAlerts(location: Location): Promise<WeatherAlert[]>;
    getRouteWeatherConditions(origin: Location, destination: Location, waypoints?: Location[]): Promise<RouteWeatherConditions>;
    isTravelSafe(location: Location, travelMode?: string): Promise<{
        safe: boolean;
        level: 'good' | 'moderate' | 'poor' | 'dangerous';
        reasons: string[];
        recommendations: string[];
    }>;
    private generateTravelRecommendations;
    private mapAlertSeverity;
    getWeatherSummary(location: Location): Promise<{
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
    }>;
}
export declare const weatherService: WeatherService;
export {};
//# sourceMappingURL=weather.d.ts.map