"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.weatherService = void 0;
const axios_1 = __importDefault(require("axios"));
const env_1 = require("@/config/env");
const logger_1 = require("@/config/logger");
const redis_1 = require("@/config/redis");
const error_1 = require("@/utils/error");
class WeatherService {
    constructor() {
        this.baseUrl = 'https://api.openweathermap.org/data/2.5';
        this.apiKey = env_1.config.weather.apiKey;
        this.cachePrefix = 'weather:';
        this.cacheDuration = 600;
    }
    async getCurrentWeather(location) {
        try {
            const cacheKey = `${this.cachePrefix}current:${location.lat}:${location.lng}`;
            const cached = await redis_1.redisClient.get(cacheKey);
            if (cached) {
                return JSON.parse(cached);
            }
            const response = await axios_1.default.get(`${this.baseUrl}/weather`, {
                params: {
                    lat: location.lat,
                    lon: location.lng,
                    appid: this.apiKey,
                    units: 'metric',
                },
                timeout: 5000,
            });
            const data = response.data;
            const weatherData = {
                temperature: Math.round(data.main.temp),
                feelsLike: Math.round(data.main.feels_like),
                humidity: data.main.humidity,
                pressure: data.main.pressure,
                visibility: data.visibility / 1000,
                windSpeed: data.wind.speed * 3.6,
                windDirection: data.wind.deg,
                cloudCover: data.clouds.all,
                conditions: data.weather.map((w) => ({
                    id: w.id,
                    main: w.main,
                    description: w.description,
                    icon: w.icon,
                })),
                timestamp: Date.now(),
            };
            await redis_1.redisClient.setex(cacheKey, this.cacheDuration, JSON.stringify(weatherData));
            return weatherData;
        }
        catch (error) {
            logger_1.logger.error('Error fetching current weather:', error);
            throw new error_1.AppError('Failed to fetch weather data', 500);
        }
    }
    async getWeatherForecast(location, hours = 24) {
        try {
            const cacheKey = `${this.cachePrefix}forecast:${location.lat}:${location.lng}:${hours}`;
            const cached = await redis_1.redisClient.get(cacheKey);
            if (cached) {
                return JSON.parse(cached);
            }
            const response = await axios_1.default.get(`${this.baseUrl}/forecast`, {
                params: {
                    lat: location.lat,
                    lon: location.lng,
                    appid: this.apiKey,
                    units: 'metric',
                    cnt: Math.min(40, Math.ceil(hours / 3)),
                },
                timeout: 5000,
            });
            const forecast = response.data.list.map((item) => ({
                timestamp: item.dt * 1000,
                temperature: Math.round(item.main.temp),
                conditions: item.weather.map((w) => ({
                    id: w.id,
                    main: w.main,
                    description: w.description,
                    icon: w.icon,
                })),
                windSpeed: item.wind.speed * 3.6,
                precipitationChance: Math.round((item.pop || 0) * 100),
                precipitationType: item.rain ? 'rain' : item.snow ? 'snow' : undefined,
            }));
            await redis_1.redisClient.setex(cacheKey, this.cacheDuration, JSON.stringify(forecast));
            return forecast;
        }
        catch (error) {
            logger_1.logger.error('Error fetching weather forecast:', error);
            throw new error_1.AppError('Failed to fetch weather forecast', 500);
        }
    }
    async getWeatherAlerts(location) {
        try {
            const cacheKey = `${this.cachePrefix}alerts:${location.lat}:${location.lng}`;
            const cached = await redis_1.redisClient.get(cacheKey);
            if (cached) {
                return JSON.parse(cached);
            }
            const response = await axios_1.default.get(`${this.baseUrl}/onecall`, {
                params: {
                    lat: location.lat,
                    lon: location.lng,
                    appid: this.apiKey,
                    exclude: 'minutely,daily',
                },
                timeout: 5000,
            });
            const alerts = (response.data.alerts || []).map((alert) => ({
                id: `${alert.sender_name}_${alert.start}`,
                title: alert.event,
                description: alert.description,
                severity: this.mapAlertSeverity(alert.tags),
                startTime: alert.start * 1000,
                endTime: alert.end * 1000,
                areas: alert.tags || [],
            }));
            await redis_1.redisClient.setex(cacheKey, this.cacheDuration, JSON.stringify(alerts));
            return alerts;
        }
        catch (error) {
            logger_1.logger.warn('Weather alerts not available:', error.response?.status);
            return [];
        }
    }
    async getRouteWeatherConditions(origin, destination, waypoints = []) {
        try {
            const allLocations = [origin, ...waypoints, destination];
            const [weatherData, alerts] = await Promise.all([
                Promise.all(allLocations.map(location => this.getCurrentWeather(location))),
                this.getWeatherAlerts(origin),
            ]);
            const [originWeather, ...waypointWeather] = weatherData;
            const destinationWeather = waypointWeather.pop();
            const routeConditions = {
                origin: originWeather,
                destination: destinationWeather,
                waypoints: waypointWeather,
                alerts,
                travelRecommendations: this.generateTravelRecommendations(weatherData, alerts),
            };
            return routeConditions;
        }
        catch (error) {
            logger_1.logger.error('Error fetching route weather conditions:', error);
            throw new error_1.AppError('Failed to fetch route weather conditions', 500);
        }
    }
    async isTravelSafe(location, travelMode = 'DRIVING') {
        try {
            const [weather, alerts] = await Promise.all([
                this.getCurrentWeather(location),
                this.getWeatherAlerts(location),
            ]);
            const reasons = [];
            const recommendations = [];
            let safetyLevel = 'good';
            const severeAlerts = alerts.filter(alert => ['severe', 'extreme'].includes(alert.severity));
            if (severeAlerts.length > 0) {
                safetyLevel = 'dangerous';
                reasons.push('Severe weather alerts in effect');
                recommendations.push('Consider postponing travel until alerts are lifted');
            }
            if (weather.visibility < 1) {
                safetyLevel = 'dangerous';
                reasons.push('Very poor visibility (less than 1km)');
                recommendations.push('Avoid travel due to extremely poor visibility');
            }
            else if (weather.visibility < 5) {
                if (safetyLevel === 'good')
                    safetyLevel = 'poor';
                reasons.push('Poor visibility');
                recommendations.push('Use headlights and reduce speed');
            }
            if (weather.windSpeed > 80) {
                safetyLevel = 'dangerous';
                reasons.push('Extremely high winds');
                recommendations.push('Avoid travel due to dangerous wind conditions');
            }
            else if (weather.windSpeed > 50) {
                if (safetyLevel === 'good')
                    safetyLevel = 'poor';
                reasons.push('High winds');
                recommendations.push('Exercise caution, especially in high-profile vehicles');
            }
            const severeConditions = weather.conditions.some(condition => ['Thunderstorm', 'Snow', 'Fog'].includes(condition.main));
            if (severeConditions) {
                const thunderstorm = weather.conditions.find(c => c.main === 'Thunderstorm');
                const snow = weather.conditions.find(c => c.main === 'Snow');
                const fog = weather.conditions.find(c => c.main === 'Fog');
                if (thunderstorm) {
                    if (safetyLevel === 'good')
                        safetyLevel = 'moderate';
                    reasons.push('Thunderstorm conditions');
                    recommendations.push('Avoid parking under trees, reduce speed');
                }
                if (snow) {
                    if (safetyLevel === 'good')
                        safetyLevel = 'moderate';
                    reasons.push('Snow conditions');
                    recommendations.push('Use winter tires, carry emergency supplies');
                }
                if (fog) {
                    if (safetyLevel === 'good')
                        safetyLevel = 'moderate';
                    reasons.push('Foggy conditions');
                    recommendations.push('Use low-beam headlights, maintain safe distance');
                }
            }
            if (travelMode === 'WALKING' || travelMode === 'BICYCLING') {
                if (weather.temperature < -10) {
                    if (safetyLevel === 'good')
                        safetyLevel = 'moderate';
                    reasons.push('Very cold temperatures');
                    recommendations.push('Dress warmly, limit exposure time');
                }
                else if (weather.temperature > 35) {
                    if (safetyLevel === 'good')
                        safetyLevel = 'moderate';
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
        }
        catch (error) {
            logger_1.logger.error('Error checking travel safety:', error);
            throw new error_1.AppError('Failed to check travel safety', 500);
        }
    }
    generateTravelRecommendations(weatherData, alerts) {
        const recommendations = [];
        let safetyLevel = 'good';
        const severeAlerts = alerts.filter(alert => ['severe', 'extreme'].includes(alert.severity));
        if (severeAlerts.length > 0) {
            safetyLevel = 'dangerous';
            recommendations.push('Severe weather alerts are in effect - consider postponing travel');
        }
        const minVisibility = Math.min(...weatherData.map(w => w.visibility));
        const maxWindSpeed = Math.max(...weatherData.map(w => w.windSpeed));
        const hasThunderstorm = weatherData.some(w => w.conditions.some(c => c.main === 'Thunderstorm'));
        const hasSnow = weatherData.some(w => w.conditions.some(c => c.main === 'Snow'));
        if (minVisibility < 1) {
            safetyLevel = 'dangerous';
            recommendations.push('Extremely poor visibility along route - avoid travel');
        }
        else if (minVisibility < 5) {
            if (safetyLevel === 'good')
                safetyLevel = 'poor';
            recommendations.push('Reduced visibility expected - use headlights and drive slowly');
        }
        if (maxWindSpeed > 80) {
            safetyLevel = 'dangerous';
            recommendations.push('Dangerous wind conditions - postpone travel');
        }
        else if (maxWindSpeed > 50) {
            if (safetyLevel === 'good')
                safetyLevel = 'poor';
            recommendations.push('High winds expected - exercise extreme caution');
        }
        if (hasThunderstorm) {
            if (safetyLevel === 'good')
                safetyLevel = 'moderate';
            recommendations.push('Thunderstorms along route - avoid stopping under trees');
        }
        if (hasSnow) {
            if (safetyLevel === 'good')
                safetyLevel = 'moderate';
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
    mapAlertSeverity(tags) {
        if (!tags || tags.length === 0)
            return 'minor';
        const tagStr = tags.join(' ').toLowerCase();
        if (tagStr.includes('extreme') || tagStr.includes('emergency')) {
            return 'extreme';
        }
        else if (tagStr.includes('severe') || tagStr.includes('warning')) {
            return 'severe';
        }
        else if (tagStr.includes('moderate') || tagStr.includes('watch')) {
            return 'moderate';
        }
        return 'minor';
    }
    async getWeatherSummary(location) {
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
        }
        catch (error) {
            logger_1.logger.error('Error getting weather summary:', error);
            throw new error_1.AppError('Failed to get weather summary', 500);
        }
    }
}
exports.weatherService = new WeatherService();
//# sourceMappingURL=weather.js.map