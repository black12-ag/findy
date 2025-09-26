"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.optimizeRoute = exports.toggleRouteFavorite = exports.deleteRoute = exports.getUserRoutes = exports.saveRoute = exports.calculateRoute = void 0;
const zod_1 = require("zod");
const database_1 = require("@/config/database");
const error_1 = require("@/utils/error");
const security_1 = require("@/utils/security");
const logger_1 = require("@/config/logger");
const maps_1 = require("@/services/maps");
const analytics_simple_1 = require("@/services/analytics-simple");
const calculateRouteSchema = zod_1.z.object({
    origin: zod_1.z.object({
        lat: zod_1.z.number().min(-90).max(90),
        lng: zod_1.z.number().min(-180).max(180),
        address: zod_1.z.string().optional(),
    }),
    destination: zod_1.z.object({
        lat: zod_1.z.number().min(-90).max(90),
        lng: zod_1.z.number().min(-180).max(180),
        address: zod_1.z.string().optional(),
    }),
    waypoints: zod_1.z.array(zod_1.z.object({
        lat: zod_1.z.number().min(-90).max(90),
        lng: zod_1.z.number().min(-180).max(180),
        address: zod_1.z.string().optional(),
    })).optional(),
    travelMode: zod_1.z.enum(['DRIVING', 'WALKING', 'CYCLING', 'TRANSIT']).default('DRIVING'),
    optimize: zod_1.z.boolean().default(false),
    avoidTolls: zod_1.z.boolean().default(false),
    avoidHighways: zod_1.z.boolean().default(false),
});
const saveRouteSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(255),
    origin: zod_1.z.object({
        lat: zod_1.z.number().min(-90).max(90),
        lng: zod_1.z.number().min(-180).max(180),
        address: zod_1.z.string(),
    }),
    destination: zod_1.z.object({
        lat: zod_1.z.number().min(-90).max(90),
        lng: zod_1.z.number().min(-180).max(180),
        address: zod_1.z.string(),
    }),
    waypoints: zod_1.z.array(zod_1.z.object({
        lat: zod_1.z.number().min(-90).max(90),
        lng: zod_1.z.number().min(-180).max(180),
        address: zod_1.z.string(),
    })).optional(),
    travelMode: zod_1.z.enum(['DRIVING', 'WALKING', 'CYCLING', 'TRANSIT']),
    distance: zod_1.z.number(),
    duration: zod_1.z.number(),
});
const calculateRoute = async (req, res) => {
    try {
        const { origin, destination, waypoints, travelMode, optimize, avoidTolls, avoidHighways } = calculateRouteSchema.parse(req.body);
        logger_1.logger.info('Calculating route', {
            userId: req.user?.id,
            origin,
            destination,
            travelMode,
            waypointsCount: waypoints?.length || 0,
        });
        const route = await maps_1.mapsService.calculateRoute({
            origin,
            destination,
            waypoints,
            travelMode,
            optimize,
            avoidTolls,
            avoidHighways,
        });
        await analytics_simple_1.analyticsService.trackEvent({
            userId: req.user?.id,
            event: 'route_calculated',
            properties: {
                travelMode,
                distance: route.distance,
                duration: route.duration,
                waypointsCount: waypoints?.length || 0,
                optimized: optimize,
            },
        });
        res.status(200).json({
            success: true,
            data: route,
        });
    }
    catch (error) {
        logger_1.logger.error('Error calculating route:', error);
        throw new error_1.AppError('Failed to calculate route', 500);
    }
};
exports.calculateRoute = calculateRoute;
const saveRoute = async (req, res) => {
    try {
        const { name, origin, destination, waypoints, travelMode, distance, duration, } = saveRouteSchema.parse(req.body);
        const userId = req.user.id;
        logger_1.logger.info('Saving route', {
            userId,
            name: (0, security_1.sanitizeInput)(name),
            travelMode,
            distance,
            duration,
        });
        const existingRoute = await database_1.prisma.route.findFirst({
            where: {
                userId,
                name: (0, security_1.sanitizeInput)(name),
            },
        });
        if (existingRoute) {
            throw new error_1.AppError('Route name already exists', 409);
        }
        const savedRoute = await database_1.prisma.route.create({
            data: {
                userId,
                name: (0, security_1.sanitizeInput)(name),
                startLatitude: origin.lat,
                startLongitude: origin.lng,
                startAddress: (0, security_1.sanitizeInput)(origin.address || ''),
                endLatitude: destination.lat,
                endLongitude: destination.lng,
                endAddress: (0, security_1.sanitizeInput)(destination.address || ''),
                transportMode: travelMode,
                distance,
                duration,
                waypoints: waypoints ? {
                    create: waypoints.map((waypoint, index) => ({
                        order: index,
                        latitude: waypoint.lat,
                        longitude: waypoint.lng,
                        address: (0, security_1.sanitizeInput)(waypoint.address || ''),
                    }))
                } : undefined,
            },
            include: {
                waypoints: {
                    orderBy: { order: 'asc' },
                    include: {
                        place: true,
                    },
                },
            },
        });
        await analytics_simple_1.analyticsService.trackEvent({
            userId,
            event: 'route_saved',
            properties: {
                routeName: name,
                travelMode,
                distance,
                duration,
                waypointsCount: waypoints?.length || 0,
            },
        });
        const formattedRoute = {
            ...savedRoute,
            name: savedRoute.name || undefined,
        };
        res.status(201).json({
            success: true,
            data: formattedRoute,
        });
    }
    catch (error) {
        logger_1.logger.error('Error saving route:', error);
        throw new error_1.AppError('Failed to save route', 500);
    }
};
exports.saveRoute = saveRoute;
const getUserRoutes = async (req, res) => {
    try {
        const { status, transportMode, sortBy = 'createdAt', sortOrder = 'desc', page = 1, limit = 20 } = req.query;
        const userId = req.user.id;
        const skip = (page - 1) * limit;
        logger_1.logger.info('Getting user routes', {
            userId,
            transportMode,
            status,
            sortBy,
            sortOrder,
            page,
            limit,
        });
        const where = { userId };
        if (transportMode) {
            where.transportMode = transportMode;
        }
        if (status) {
            where.status = status;
        }
        const orderBy = {};
        if (sortBy === 'distance' || sortBy === 'duration') {
            orderBy[sortBy] = sortOrder;
        }
        else {
            orderBy.createdAt = sortOrder;
        }
        const [routes, total] = await Promise.all([
            database_1.prisma.route.findMany({
                where,
                include: {
                    waypoints: {
                        orderBy: { order: 'asc' },
                        include: {
                            place: true,
                        },
                    },
                },
                orderBy: [
                    orderBy,
                ],
                skip,
                take: limit,
            }),
            database_1.prisma.route.count({ where }),
        ]);
        const formattedRoutes = routes.map(route => ({
            ...route,
            name: route.name || undefined,
        }));
        res.status(200).json({
            success: true,
            data: formattedRoutes,
            meta: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
                hasNextPage: page < Math.ceil(total / limit),
                hasPrevPage: page > 1,
            },
        });
    }
    catch (error) {
        logger_1.logger.error('Error getting user routes:', error);
        throw new error_1.AppError('Failed to get user routes', 500);
    }
};
exports.getUserRoutes = getUserRoutes;
const deleteRoute = async (req, res) => {
    try {
        const { routeId } = req.params;
        const userId = req.user.id;
        logger_1.logger.info('Deleting route', {
            userId,
            routeId,
        });
        const deletedRoute = await database_1.prisma.route.deleteMany({
            where: {
                id: routeId,
                userId,
            },
        });
        if (deletedRoute.count === 0) {
            throw new error_1.AppError('Route not found', 404);
        }
        await analytics_simple_1.analyticsService.trackEvent({
            userId,
            event: 'route_deleted',
            properties: {
                routeId,
            },
        });
        res.status(200).json({
            success: true,
            message: 'Route deleted successfully',
        });
    }
    catch (error) {
        logger_1.logger.error('Error deleting route:', error);
        throw new error_1.AppError('Failed to delete route', 500);
    }
};
exports.deleteRoute = deleteRoute;
const toggleRouteFavorite = async (req, res) => {
    res.status(501).json({
        success: false,
        message: 'Favorite functionality not available in current schema',
    });
};
exports.toggleRouteFavorite = toggleRouteFavorite;
const optimizeRoute = async (req, res) => {
    try {
        const { waypoints, transportMode = 'DRIVING', avoidTolls, avoidHighways } = req.body;
        if (!waypoints || waypoints.length < 2) {
            throw new error_1.AppError('At least 2 waypoints required for optimization', 400);
        }
        logger_1.logger.info('Optimizing route', {
            userId: req.user?.id,
            waypointsCount: waypoints.length,
        });
        const origin = waypoints[0];
        const destination = waypoints[waypoints.length - 1];
        const intermediateWaypoints = waypoints.slice(1, -1);
        const route = await maps_1.mapsService.calculateRoute({
            origin,
            destination,
            waypoints: intermediateWaypoints,
            travelMode: transportMode,
            optimize: true,
            avoidTolls,
            avoidHighways,
        });
        await analytics_simple_1.analyticsService.trackEvent({
            userId: req.user?.id,
            event: 'route_optimized',
            properties: {
                waypointsCount: waypoints.length,
                distance: route.distance,
                duration: route.duration,
            },
        });
        res.status(200).json({
            success: true,
            data: route,
        });
    }
    catch (error) {
        logger_1.logger.error('Error optimizing route:', error);
        throw new error_1.AppError('Failed to optimize route', 500);
    }
};
exports.optimizeRoute = optimizeRoute;
//# sourceMappingURL=routes.js.map