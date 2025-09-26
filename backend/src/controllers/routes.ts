import { Response } from 'express';
import { AuthenticatedRequest } from '@/types';
import { z } from 'zod';
import { prisma } from '@/config/database';
import { AppError } from '@/utils/error';
import { sanitizeInput } from '@/utils/security';
import { logger } from '@/config/logger';
import { mapsService } from '@/services/maps';
import { analyticsService } from "@/services/analytics-simple";
import type {
  RouteCalculationRequest,
  SaveRouteRequest,
  GetUserRoutesRequest,
  RouteCalculationResponse,
  SaveRouteResponse,
  UserRoutesResponse,
  OptimizeRouteRequest,
} from '@/types/api';

// Validation schemas
const calculateRouteSchema = z.object({
  origin: z.object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
    address: z.string().optional(),
  }),
  destination: z.object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
    address: z.string().optional(),
  }),
  waypoints: z.array(z.object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
    address: z.string().optional(),
  })).optional(),
  travelMode: z.enum(['DRIVING', 'WALKING', 'CYCLING', 'TRANSIT']).default('DRIVING'),
  optimize: z.boolean().default(false),
  avoidTolls: z.boolean().default(false),
  avoidHighways: z.boolean().default(false),
});

const saveRouteSchema = z.object({
  name: z.string().min(1).max(255),
  origin: z.object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
    address: z.string(),
  }),
  destination: z.object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
    address: z.string(),
  }),
  waypoints: z.array(z.object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
    address: z.string(),
  })).optional(),
  travelMode: z.enum(['DRIVING', 'WALKING', 'CYCLING', 'TRANSIT']),
  distance: z.number(),
  duration: z.number(),
});

/**
 * Calculate route between origin and destination
 */
export const calculateRoute = async (
  req: AuthenticatedRequest & { body: RouteCalculationRequest },
  res: Response<RouteCalculationResponse>
): Promise<void> => {
  try {
    const { 
      origin, 
      destination, 
      waypoints, 
      travelMode, 
      optimize,
      avoidTolls,
      avoidHighways 
    } = calculateRouteSchema.parse(req.body);

    logger.info('Calculating route', {
      userId: req.user?.id,
      origin,
      destination,
      travelMode,
      waypointsCount: waypoints?.length || 0,
    });

    // Calculate route using Maps service
    const route = await mapsService.calculateRoute({
      origin,
      destination,
      waypoints,
      travelMode,
      optimize,
      avoidTolls,
      avoidHighways,
    });

    // Track analytics
    await analyticsService.trackEvent({
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
  } catch (error) {
    logger.error('Error calculating route:', error);
    throw new AppError('Failed to calculate route', 500);
  }
};

/**
 * Save a calculated route to user's collection
 */
export const saveRoute = async (
  req: AuthenticatedRequest & { body: SaveRouteRequest },
  res: Response<SaveRouteResponse>
): Promise<void> => {
  try {
    const {
      name,
      origin,
      destination,
      waypoints,
      travelMode,
      distance,
      duration,
    } = saveRouteSchema.parse(req.body);

    const userId = req.user!.id;

    logger.info('Saving route', {
      userId,
      name: sanitizeInput(name),
      travelMode,
      distance,
      duration,
    });

    // Check if route name already exists for user
    const existingRoute = await prisma.route.findFirst({
      where: {
        userId,
        name: sanitizeInput(name),
      },
    });

    if (existingRoute) {
      throw new AppError('Route name already exists', 409);
    }

    // Save the route
    const savedRoute = await prisma.route.create({
      data: {
        userId,
        name: sanitizeInput(name),
        startLatitude: origin.lat,
        startLongitude: origin.lng,
        startAddress: sanitizeInput(origin.address || ''),
        endLatitude: destination.lat,
        endLongitude: destination.lng,
        endAddress: sanitizeInput(destination.address || ''),
        transportMode: travelMode,
        distance,
        duration,
        // Note: waypoints will be handled separately as related records
        waypoints: waypoints ? {
          create: waypoints.map((waypoint, index) => ({
            order: index,
            latitude: waypoint.lat,
            longitude: waypoint.lng,
            address: sanitizeInput(waypoint.address || ''),
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

    // Track analytics
    await analyticsService.trackEvent({
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

    // Format savedRoute to handle null to undefined conversion
    const formattedRoute = {
      ...savedRoute,
      name: savedRoute.name || undefined,
    } as any;

    res.status(201).json({
      success: true,
      data: formattedRoute,
    });
  } catch (error) {
    logger.error('Error saving route:', error);
    throw new AppError('Failed to save route', 500);
  }
};

/**
 * Get user's saved routes
 */
export const getUserRoutes = async (
  req: AuthenticatedRequest & { query: GetUserRoutesRequest },
  res: Response<UserRoutesResponse>
): Promise<void> => {
  try {
    const { 
      status,
      transportMode, 
      sortBy = 'createdAt', 
      sortOrder = 'desc',
      page = 1, 
      limit = 20 
    } = req.query;
    const userId = req.user!.id;
    const skip = (page - 1) * limit;

    logger.info('Getting user routes', {
      userId,
      transportMode,
      status,
      sortBy,
      sortOrder,
      page,
      limit,
    });

    // Build where clause
    const where: any = { userId };
    
    if (transportMode) {
      where.transportMode = transportMode;
    }
    
    if (status) {
      where.status = status;
    }

    // Build orderBy clause
    const orderBy: any = {};
    if (sortBy === 'distance' || sortBy === 'duration') {
      orderBy[sortBy] = sortOrder;
    } else {
      orderBy.createdAt = sortOrder;
    }

    // Get routes with pagination
    const [routes, total] = await Promise.all([
      prisma.route.findMany({
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
      prisma.route.count({ where }),
    ]);

    // Format routes to handle null to undefined conversion
    const formattedRoutes = routes.map(route => ({
      ...route,
      name: route.name || undefined,
    })) as any[];

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
  } catch (error) {
    logger.error('Error getting user routes:', error);
    throw new AppError('Failed to get user routes', 500);
  }
};

/**
 * Delete a saved route
 */
export const deleteRoute = async (
  req: AuthenticatedRequest & { params: { routeId: string } },
  res: Response
): Promise<void> => {
  try {
    const { routeId } = req.params;
    const userId = req.user!.id;

    logger.info('Deleting route', {
      userId,
      routeId,
    });

    // Find and delete the route
    const deletedRoute = await prisma.route.deleteMany({
      where: {
        id: routeId,
        userId,
      },
    });

    if (deletedRoute.count === 0) {
      throw new AppError('Route not found', 404);
    }

    // Track analytics
    await analyticsService.trackEvent({
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
  } catch (error) {
    logger.error('Error deleting route:', error);
    throw new AppError('Failed to delete route', 500);
  }
};

/**
 * Toggle favorite status of a saved route
 * NOTE: Disabled because isFavorite field doesn't exist in simplified schema
 */
// export const toggleRouteFavorite = async (
//   req: AuthenticatedRequest & { params: { routeId: string } },
//   res: Response
// ): Promise<void> => {
//   try {
//     const { routeId } = req.params;
//     const userId = req.user!.id;

//     logger.info('Toggling route favorite', {
//       userId,
//       routeId,
//     });

//     // Find the route
//     const route = await prisma.route.findFirst({
//       where: {
//         id: routeId,
//         userId,
//       },
//     });

//     if (!route) {
//       throw new AppError('Route not found', 404);
//     }

//     // Toggle favorite status
//     const updatedRoute = await prisma.route.update({
//       where: {
//         id: routeId,
//       },
//       data: {
//         isFavorite: !route.isFavorite,
//       },
//     });

//     // Track analytics
//     await analyticsService.trackEvent({
//       userId,
//       event: 'route_favorite_toggled',
//       properties: {
//         routeId,
//         isFavorite: updatedRoute.isFavorite,
//       },
//     });

//     res.status(200).json({
//       success: true,
//       data: updatedRoute,
//     });
//   } catch (error) {
//     logger.error('Error toggling route favorite:', error);
//     throw new AppError('Failed to toggle favorite', 500);
//   }
// };

// Temporary replacement function for routes without favorite functionality
export const toggleRouteFavorite = async (
  req: AuthenticatedRequest & { params: { routeId: string } },
  res: Response
): Promise<void> => {
  res.status(501).json({
    success: false,
    message: 'Favorite functionality not available in current schema',
  });
};

/**
 * Optimize route with multiple waypoints
 */
export const optimizeRoute = async (
  req: AuthenticatedRequest & { body: OptimizeRouteRequest },
  res: Response<RouteCalculationResponse>
): Promise<void> => {
  try {
    const { waypoints, transportMode = 'DRIVING', avoidTolls, avoidHighways } = req.body;

    if (!waypoints || waypoints.length < 2) {
      throw new AppError('At least 2 waypoints required for optimization', 400);
    }

    logger.info('Optimizing route', {
      userId: req.user?.id,
      waypointsCount: waypoints.length,
    });

    // Calculate optimized route using first waypoint as origin and last as destination
    const origin = waypoints[0];
    const destination = waypoints[waypoints.length - 1];
    const intermediateWaypoints = waypoints.slice(1, -1);
    
    const route = await mapsService.calculateRoute({
      origin,
      destination,
      waypoints: intermediateWaypoints,
      travelMode: transportMode,
      optimize: true,
      avoidTolls,
      avoidHighways,
    });

    // Track analytics
    await analyticsService.trackEvent({
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
  } catch (error) {
    logger.error('Error optimizing route:', error);
    throw new AppError('Failed to optimize route', 500);
  }
};