import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '@/config/database';
import { AppError } from '@/utils/error';
import { sanitizeInput } from '@/utils/security';
import { logger } from '@/config/logger';
import { mapsService } from '@/services/maps';
import { analyticsService } from '@/services/analytics';
import type {
  PlaceSearchRequest,
  PlaceDetailsRequest,
  SavePlaceRequest,
  DeletePlaceRequest,
  GetUserPlacesRequest,
  PlaceSearchResponse,
  PlaceDetailsResponse,
  SavePlaceResponse,
  UserPlacesResponse,
} from '@/types/api';

// Validation schemas
const searchPlacesSchema = z.object({
  query: z.string().min(1).max(200),
  location: z.object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
  }).optional(),
  radius: z.number().min(100).max(50000).default(5000),
  type: z.enum(['restaurant', 'gas_station', 'hospital', 'school', 'store', 'attraction']).optional(),
});

const placeDetailsSchema = z.object({
  placeId: z.string().min(1),
});

const savePlaceSchema = z.object({
  googlePlaceId: z.string().min(1),
  name: z.string().min(1).max(255),
  address: z.string().min(1).max(500),
  location: z.object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
  }),
  category: z.string().min(1).max(100),
  isFavorite: z.boolean().default(false),
});

/**
 * Search for places using Google Places API
 */
export const searchPlaces = async (
  req: Request<{}, PlaceSearchResponse, PlaceSearchRequest>,
  res: Response<PlaceSearchResponse>
): Promise<void> => {
  try {
    const { query, location, radius, type } = searchPlacesSchema.parse(req.body);
    const sanitizedQuery = sanitizeInput(query);
    
    logger.info('Searching places', {
      userId: req.user?.id,
      query: sanitizedQuery,
      location,
      type,
    });

    // Search places using Maps service
    const places = await mapsService.searchPlaces({
      query: sanitizedQuery,
      location,
      radius,
      type,
    });

    // Track search analytics
    await analyticsService.trackEvent({
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
      data: {
        places,
        count: places.length,
      },
    });
  } catch (error) {
    logger.error('Error searching places:', error);
    throw new AppError('Failed to search places', 500);
  }
};

/**
 * Get detailed information about a specific place
 */
export const getPlaceDetails = async (
  req: Request<{ placeId: string }, PlaceDetailsResponse, PlaceDetailsRequest>,
  res: Response<PlaceDetailsResponse>
): Promise<void> => {
  try {
    const { placeId } = placeDetailsSchema.parse(req.params);
    
    logger.info('Getting place details', {
      userId: req.user?.id,
      placeId,
    });

    // Get place details from Maps service
    const place = await mapsService.getPlaceDetails(placeId);
    
    if (!place) {
      throw new AppError('Place not found', 404);
    }

    // Check if user has saved this place
    let isSaved = false;
    if (req.user) {
      const savedPlace = await prisma.place.findFirst({
        where: {
          userId: req.user.id,
          googlePlaceId: placeId,
        },
      });
      isSaved = !!savedPlace;
    }

    // Track analytics
    await analyticsService.trackEvent({
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
  } catch (error) {
    logger.error('Error getting place details:', error);
    throw new AppError('Failed to get place details', 500);
  }
};

/**
 * Save a place to user's collection
 */
export const savePlace = async (
  req: Request<{}, SavePlaceResponse, SavePlaceRequest>,
  res: Response<SavePlaceResponse>
): Promise<void> => {
  try {
    const { googlePlaceId, name, address, location, category, isFavorite } = 
      savePlaceSchema.parse(req.body);
    
    const userId = req.user!.id;

    logger.info('Saving place', {
      userId,
      googlePlaceId,
      name: sanitizeInput(name),
    });

    // Check if place already saved by user
    const existingPlace = await prisma.place.findFirst({
      where: {
        userId,
        googlePlaceId,
      },
    });

    if (existingPlace) {
      throw new AppError('Place already saved', 409);
    }

    // Save the place
    const savedPlace = await prisma.place.create({
      data: {
        userId,
        googlePlaceId,
        name: sanitizeInput(name),
        address: sanitizeInput(address),
        latitude: location.lat,
        longitude: location.lng,
        category: sanitizeInput(category),
        isFavorite,
      },
    });

    // Track analytics
    await analyticsService.trackEvent({
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
  } catch (error) {
    logger.error('Error saving place:', error);
    throw new AppError('Failed to save place', 500);
  }
};

/**
 * Remove a saved place from user's collection
 */
export const deletePlace = async (
  req: Request<{ placeId: string }, {}, DeletePlaceRequest>,
  res: Response
): Promise<void> => {
  try {
    const { placeId } = req.params;
    const userId = req.user!.id;

    logger.info('Deleting saved place', {
      userId,
      placeId,
    });

    // Find and delete the place
    const deletedPlace = await prisma.place.deleteMany({
      where: {
        id: placeId,
        userId,
      },
    });

    if (deletedPlace.count === 0) {
      throw new AppError('Place not found', 404);
    }

    // Track analytics
    await analyticsService.trackEvent({
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
  } catch (error) {
    logger.error('Error deleting place:', error);
    throw new AppError('Failed to delete place', 500);
  }
};

/**
 * Get user's saved places
 */
export const getUserPlaces = async (
  req: Request<{}, UserPlacesResponse, {}, GetUserPlacesRequest>,
  res: Response<UserPlacesResponse>
): Promise<void> => {
  try {
    const { category, favorites, page = 1, limit = 20 } = req.query;
    const userId = req.user!.id;
    const skip = (page - 1) * limit;

    logger.info('Getting user places', {
      userId,
      category,
      favorites,
      page,
      limit,
    });

    // Build where clause
    const where: any = { userId };
    
    if (category) {
      where.category = category;
    }
    
    if (favorites === 'true') {
      where.isFavorite = true;
    }

    // Get places with pagination
    const [places, total] = await Promise.all([
      prisma.place.findMany({
        where,
        orderBy: [
          { isFavorite: 'desc' },
          { createdAt: 'desc' },
        ],
        skip,
        take: limit,
      }),
      prisma.place.count({ where }),
    ]);

    res.status(200).json({
      success: true,
      data: {
        places,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    logger.error('Error getting user places:', error);
    throw new AppError('Failed to get user places', 500);
  }
};

/**
 * Toggle favorite status of a saved place
 */
export const toggleFavorite = async (
  req: Request<{ placeId: string }>,
  res: Response
): Promise<void> => {
  try {
    const { placeId } = req.params;
    const userId = req.user!.id;

    logger.info('Toggling place favorite', {
      userId,
      placeId,
    });

    // Find the place
    const place = await prisma.place.findFirst({
      where: {
        id: placeId,
        userId,
      },
    });

    if (!place) {
      throw new AppError('Place not found', 404);
    }

    // Toggle favorite status
    const updatedPlace = await prisma.place.update({
      where: {
        id: placeId,
      },
      data: {
        isFavorite: !place.isFavorite,
      },
    });

    // Track analytics
    await analyticsService.trackEvent({
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
  } catch (error) {
    logger.error('Error toggling place favorite:', error);
    throw new AppError('Failed to toggle favorite', 500);
  }
};