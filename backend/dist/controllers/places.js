"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toggleFavorite = exports.getUserPlaces = exports.deletePlace = exports.savePlace = exports.getPlaceDetails = exports.searchPlaces = void 0;
const zod_1 = require("zod");
const database_1 = require("@/config/database");
const error_1 = require("@/utils/error");
const security_1 = require("@/utils/security");
const logger_1 = require("@/config/logger");
const maps_1 = require("@/services/maps");
const analytics_simple_1 = require("@/services/analytics-simple");
const searchPlacesSchema = zod_1.z.object({
    query: zod_1.z.string().min(1).max(200),
    location: zod_1.z.object({
        lat: zod_1.z.number().min(-90).max(90),
        lng: zod_1.z.number().min(-180).max(180),
    }).optional(),
    radius: zod_1.z.number().min(100).max(50000).default(5000),
    type: zod_1.z.enum(['restaurant', 'gas_station', 'hospital', 'school', 'store', 'attraction']).optional(),
});
const placeDetailsSchema = zod_1.z.object({
    placeId: zod_1.z.string().min(1),
});
const savePlaceSchema = zod_1.z.object({
    googlePlaceId: zod_1.z.string().min(1),
    name: zod_1.z.string().min(1).max(255),
    address: zod_1.z.string().min(1).max(500),
    location: zod_1.z.object({
        lat: zod_1.z.number().min(-90).max(90),
        lng: zod_1.z.number().min(-180).max(180),
    }),
    category: zod_1.z.string().min(1).max(100),
    isFavorite: zod_1.z.boolean().default(false),
});
const searchPlaces = async (req, res) => {
    try {
        const { query, location, radius, type } = searchPlacesSchema.parse(req.body);
        const sanitizedQuery = (0, security_1.sanitizeInput)(query);
        logger_1.logger.info('Searching places', {
            userId: req.user?.id,
            query: sanitizedQuery,
            location,
            type,
        });
        const places = await maps_1.mapsService.searchPlaces({
            query: sanitizedQuery,
            location,
            radius,
            type,
        });
        await analytics_simple_1.analyticsService.trackEvent({
            userId: req.user?.id,
            event: 'place_search',
            properties: {
                query: sanitizedQuery,
                resultCount: places.length,
                location,
                type,
            },
        });
        res.status(200).json({
            success: true,
            data: places,
            meta: {
                page: 1,
                limit: places.length,
                total: places.length,
                totalPages: 1,
            },
        });
    }
    catch (error) {
        logger_1.logger.error('Error searching places:', error);
        throw new error_1.AppError('Failed to search places', 500);
    }
};
exports.searchPlaces = searchPlaces;
const getPlaceDetails = async (req, res) => {
    try {
        const { placeId } = placeDetailsSchema.parse(req.params);
        logger_1.logger.info('Getting place details', {
            userId: req.user?.id,
            placeId,
        });
        const place = await maps_1.mapsService.getPlaceDetails(placeId);
        if (!place) {
            throw new error_1.AppError('Place not found', 404);
        }
        let isSaved = false;
        if (req.user) {
            const savedPlace = await database_1.prisma.place.findFirst({
                where: {
                    userId: req.user.id,
                    googlePlaceId: placeId,
                },
            });
            isSaved = !!savedPlace;
        }
        await analytics_simple_1.analyticsService.trackEvent({
            userId: req.user?.id,
            event: 'place_details_view',
            properties: {
                placeId,
                placeName: place.name,
                category: place.category,
            },
        });
        res.status(200).json({
            success: true,
            data: {
                place: {
                    ...place,
                    isSaved,
                },
            },
        });
    }
    catch (error) {
        logger_1.logger.error('Error getting place details:', error);
        throw new error_1.AppError('Failed to get place details', 500);
    }
};
exports.getPlaceDetails = getPlaceDetails;
const savePlace = async (req, res) => {
    try {
        const { googlePlaceId, name, address, location, category, isFavorite } = savePlaceSchema.parse(req.body);
        const userId = req.user.id;
        logger_1.logger.info('Saving place', {
            userId,
            googlePlaceId,
            name: (0, security_1.sanitizeInput)(name),
        });
        const existingPlace = await database_1.prisma.place.findFirst({
            where: {
                userId,
                googlePlaceId,
            },
        });
        if (existingPlace) {
            throw new error_1.AppError('Place already saved', 409);
        }
        const savedPlace = await database_1.prisma.place.create({
            data: {
                userId,
                googlePlaceId,
                name: (0, security_1.sanitizeInput)(name),
                address: (0, security_1.sanitizeInput)(address),
                latitude: location.lat,
                longitude: location.lng,
                category: (0, security_1.sanitizeInput)(category),
                isFavorite,
            },
        });
        await analytics_simple_1.analyticsService.trackEvent({
            userId,
            event: 'place_saved',
            properties: {
                placeId: googlePlaceId,
                placeName: name,
                category,
                isFavorite,
            },
        });
        res.status(201).json({
            success: true,
            data: {
                place: savedPlace,
            },
        });
    }
    catch (error) {
        logger_1.logger.error('Error saving place:', error);
        throw new error_1.AppError('Failed to save place', 500);
    }
};
exports.savePlace = savePlace;
const deletePlace = async (req, res) => {
    try {
        const { placeId } = req.params;
        const userId = req.user.id;
        logger_1.logger.info('Deleting saved place', {
            userId,
            placeId,
        });
        const deletedPlace = await database_1.prisma.place.deleteMany({
            where: {
                id: placeId,
                userId,
            },
        });
        if (deletedPlace.count === 0) {
            throw new error_1.AppError('Place not found', 404);
        }
        await analytics_simple_1.analyticsService.trackEvent({
            userId,
            event: 'place_deleted',
            properties: {
                placeId,
            },
        });
        res.status(200).json({
            success: true,
            message: 'Place deleted successfully',
        });
    }
    catch (error) {
        logger_1.logger.error('Error deleting place:', error);
        throw new error_1.AppError('Failed to delete place', 500);
    }
};
exports.deletePlace = deletePlace;
const getUserPlaces = async (req, res) => {
    try {
        const { category, favorites, page = 1, limit = 20 } = req.query;
        const userId = req.user.id;
        const skip = (page - 1) * limit;
        logger_1.logger.info('Getting user places', {
            userId,
            category,
            favorites,
            page,
            limit,
        });
        const where = { userId };
        if (category) {
            where.category = category;
        }
        if (favorites === 'true') {
            where.isFavorite = true;
        }
        const [places, total] = await Promise.all([
            database_1.prisma.savedPlace.findMany({
                where,
                include: {
                    place: true,
                },
                orderBy: [
                    { createdAt: 'desc' },
                ],
                skip,
                take: limit,
            }),
            database_1.prisma.savedPlace.count({ where }),
        ]);
        const formattedPlaces = places.map(place => ({
            ...place,
            notes: place.notes || undefined,
            category: place.category,
        }));
        res.status(200).json({
            success: true,
            data: formattedPlaces,
            meta: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        });
    }
    catch (error) {
        logger_1.logger.error('Error getting user places:', error);
        throw new error_1.AppError('Failed to get user places', 500);
    }
};
exports.getUserPlaces = getUserPlaces;
const toggleFavorite = async (req, res) => {
    try {
        const { placeId } = req.params;
        const userId = req.user.id;
        logger_1.logger.info('Toggling place favorite', {
            userId,
            placeId,
        });
        const place = await database_1.prisma.place.findFirst({
            where: {
                id: placeId,
                userId,
            },
        });
        if (!place) {
            throw new error_1.AppError('Place not found', 404);
        }
        const updatedPlace = await database_1.prisma.place.update({
            where: {
                id: placeId,
            },
            data: {
                isFavorite: !place.isFavorite,
            },
        });
        await analytics_simple_1.analyticsService.trackEvent({
            userId,
            event: 'place_favorite_toggled',
            properties: {
                placeId,
                isFavorite: updatedPlace.isFavorite,
            },
        });
        res.status(200).json({
            success: true,
            data: {
                place: updatedPlace,
            },
        });
    }
    catch (error) {
        logger_1.logger.error('Error toggling place favorite:', error);
        throw new error_1.AppError('Failed to toggle favorite', 500);
    }
};
exports.toggleFavorite = toggleFavorite;
//# sourceMappingURL=places.js.map