"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RouteService = void 0;
const axios_1 = __importDefault(require("axios"));
const error_1 = require("@/utils/error");
const logger_1 = require("@/config/logger");
const redis_1 = require("@/config/redis");
const database_1 = require("@/config/database");
const env_1 = require("@/config/env");
class RouteService {
    constructor() {
        this.CACHE_TTL = 3600;
        this.GOOGLE_MAPS_API_KEY = env_1.config.api.googleMaps.key || '';
        this.MAPBOX_API_KEY = env_1.config.api.mapbox.key || '';
    }
    async calculateRoute(waypoints, preferences, options = {}) {
        try {
            if (waypoints.length < 2) {
                throw new error_1.AppError('At least 2 waypoints are required', 400);
            }
            const cacheKey = this.generateCacheKey(waypoints, preferences, options);
            const cachedRoute = await this.getCachedRoute(cacheKey);
            if (cachedRoute) {
                logger_1.logger.debug('Route served from cache', { cacheKey });
                return cachedRoute;
            }
            const route = await this.calculateGoogleRoute(waypoints, preferences, options);
            await this.cacheRoute(cacheKey, route);
            logger_1.logger.info('Route calculated successfully', {
                waypointCount: waypoints.length,
                distance: route.distance,
                duration: route.duration,
                mode: preferences.mode,
            });
            return route;
        }
        catch (error) {
            logger_1.logger.error('Route calculation failed', {
                error: error instanceof Error ? error.message : 'Unknown error',
                waypoints: waypoints.length,
                mode: preferences.mode,
            });
            throw error;
        }
    }
    async getAlternativeRoutes(waypoints, preferences, maxAlternatives = 3) {
        try {
            const routes = await this.calculateGoogleRoute(waypoints, preferences, {
                alternatives: true,
            });
            return [routes].slice(0, maxAlternatives);
        }
        catch (error) {
            logger_1.logger.error('Alternative routes calculation failed', {
                error: error instanceof Error ? error.message : 'Unknown error',
            });
            return [];
        }
    }
    async optimizeWaypointOrder(waypoints, preferences) {
        try {
            if (waypoints.length <= 2) {
                return this.calculateRoute(waypoints, preferences);
            }
            const optimizedPreferences = {
                ...preferences,
                optimize: true,
            };
            return this.calculateRoute(waypoints, optimizedPreferences);
        }
        catch (error) {
            logger_1.logger.error('Waypoint optimization failed', {
                error: error instanceof Error ? error.message : 'Unknown error',
            });
            return this.calculateRoute(waypoints, preferences);
        }
    }
    async updateRoute(routeId, route) {
        try {
            await database_1.prisma.route.update({
                where: { id: routeId },
                data: {
                    distance: route.distance,
                    duration: route.duration,
                    routeGeometry: route.geometry,
                    updatedAt: new Date(),
                },
            });
            logger_1.logger.info('Route updated in database', { routeId });
        }
        catch (error) {
            logger_1.logger.error('Failed to update route in database', {
                routeId,
                error: error instanceof Error ? error.message : 'Unknown error',
            });
            throw new error_1.AppError('Failed to update route', 500);
        }
    }
    async getCachedRoute(cacheKey) {
        try {
            const cachedData = await redis_1.redisClient.get(cacheKey);
            return cachedData ? JSON.parse(cachedData) : null;
        }
        catch (error) {
            logger_1.logger.warn('Cache lookup failed', {
                cacheKey,
                error: error instanceof Error ? error.message : 'Unknown error',
            });
            return null;
        }
    }
    async cacheRoute(cacheKey, route) {
        try {
            await redis_1.redisClient.setex(cacheKey, this.CACHE_TTL, JSON.stringify(route));
        }
        catch (error) {
            logger_1.logger.warn('Route caching failed', {
                cacheKey,
                error: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    }
    generateCacheKey(waypoints, preferences, options) {
        const waypointString = waypoints
            .map(w => `${w.lat.toFixed(6)},${w.lng.toFixed(6)}`)
            .join('|');
        const prefsString = `${preferences.mode}_${preferences.avoidTolls}_${preferences.avoidHighways}_${preferences.avoidFerries}`;
        const optsString = `${options.alternatives}_${options.traffic}`;
        return `route:${Buffer.from(`${waypointString}_${prefsString}_${optsString}`).toString('base64')}`;
    }
    async calculateGoogleRoute(waypoints, preferences, options = {}) {
        try {
            const origin = waypoints[0];
            const destination = waypoints[waypoints.length - 1];
            const intermediateWaypoints = waypoints.slice(1, -1);
            const params = {
                origin: `${origin.lat},${origin.lng}`,
                destination: `${destination.lat},${destination.lng}`,
                mode: preferences.mode,
                key: this.GOOGLE_MAPS_API_KEY,
                language: options.language || 'en',
                units: options.units || 'metric',
                alternatives: options.alternatives || false,
            };
            if (intermediateWaypoints.length > 0) {
                const waypointString = intermediateWaypoints
                    .map(w => `${w.lat},${w.lng}`)
                    .join('|');
                params.waypoints = preferences.optimize
                    ? `optimize:true|${waypointString}`
                    : waypointString;
            }
            const avoid = [];
            if (preferences.avoidTolls)
                avoid.push('tolls');
            if (preferences.avoidHighways)
                avoid.push('highways');
            if (preferences.avoidFerries)
                avoid.push('ferries');
            if (avoid.length > 0) {
                params.avoid = avoid.join('|');
            }
            if (options.traffic) {
                params.departure_time = 'now';
            }
            const response = await axios_1.default.get('https://maps.googleapis.com/maps/api/directions/json', {
                params,
                timeout: 10000,
            });
            if (response.data.status !== 'OK') {
                throw new error_1.AppError(`Google Directions API error: ${response.data.status}`, 400);
            }
            const route = response.data.routes[0];
            const leg = route.legs[0];
            return this.parseGoogleRoute(route, leg);
        }
        catch (error) {
            if (axios_1.default.isAxiosError(error)) {
                logger_1.logger.error('Google Directions API request failed', {
                    status: error.response?.status,
                    message: error.message,
                });
                throw new error_1.AppError('Route calculation service unavailable', 503);
            }
            throw error;
        }
    }
    parseGoogleRoute(route, leg) {
        const steps = leg.steps.map((step) => ({
            instruction: step.html_instructions.replace(/<[^>]*>/g, ''),
            distance: step.distance.value,
            duration: step.duration.value,
            startLocation: {
                lat: step.start_location.lat,
                lng: step.start_location.lng,
            },
            endLocation: {
                lat: step.end_location.lat,
                lng: step.end_location.lng,
            },
            maneuver: step.maneuver,
            polyline: step.polyline.points,
        }));
        return {
            distance: leg.distance.value,
            duration: leg.duration.value,
            geometry: route.overview_polyline.points,
            bounds: {
                north: route.bounds.northeast.lat,
                south: route.bounds.southwest.lat,
                east: route.bounds.northeast.lng,
                west: route.bounds.southwest.lng,
            },
            steps,
            warnings: route.warnings || [],
            trafficMultiplier: leg.duration_in_traffic
                ? leg.duration_in_traffic.value / leg.duration.value
                : undefined,
        };
    }
    async estimateFuelConsumption(distance, vehicleType = 'car') {
        const distanceKm = distance / 1000;
        const fuelConsumptionRates = {
            car: 8.5,
            motorcycle: 4.5,
            truck: 25.0,
        };
        const rate = fuelConsumptionRates[vehicleType];
        return (distanceKm * rate) / 100;
    }
    async estimateRouteCost(route, fuelPricePerLiter = 1.5, vehicleType = 'car') {
        const fuelNeeded = await this.estimateFuelConsumption(route.distance, vehicleType);
        const fuelCost = fuelNeeded * fuelPricePerLiter;
        const estimatedTollCost = route.warnings?.some(w => w.includes('toll')) ? 5.0 : 0;
        return fuelCost + estimatedTollCost;
    }
    async getETAWithTraffic(waypoints, preferences) {
        try {
            const route = await this.calculateRoute(waypoints, preferences, {
                traffic: true,
            });
            const durationInTraffic = route.trafficMultiplier
                ? route.duration * route.trafficMultiplier
                : route.duration;
            const eta = new Date(Date.now() + durationInTraffic * 1000);
            return {
                duration: route.duration,
                durationInTraffic,
                eta,
            };
        }
        catch (error) {
            logger_1.logger.error('ETA calculation failed', {
                error: error instanceof Error ? error.message : 'Unknown error',
            });
            throw new error_1.AppError('Failed to calculate ETA', 500);
        }
    }
}
exports.RouteService = RouteService;
//# sourceMappingURL=RouteService.js.map