import { Router } from 'express';
import { authenticate, optionalAuthenticate } from '@/middleware/auth';
import { asyncHandler } from '@/middleware/error';
import {
  calculateRoute,
  saveRoute,
  getUserRoutes,
  deleteRoute,
  toggleRouteFavorite,
  optimizeRoute,
} from '@/controllers/routes';

const router = Router();

/**
 * @route   POST /api/v1/routes/calculate
 * @desc    Calculate route between origin and destination
 * @access  Public (with optional auth for personalization)
 */
router.post('/calculate', optionalAuthenticate, asyncHandler(calculateRoute));

/**
 * @route   POST /api/v1/routes/optimize
 * @desc    Optimize route with multiple waypoints
 * @access  Public (with optional auth)
 */
router.post('/optimize', optionalAuthenticate, asyncHandler(optimizeRoute));

/**
 * @route   POST /api/v1/routes
 * @desc    Save a calculated route to user's collection
 * @access  Private
 */
router.post('/', authenticate, asyncHandler(saveRoute));

/**
 * @route   GET /api/v1/routes
 * @desc    Get user's saved routes
 * @access  Private
 */
router.get('/', authenticate, asyncHandler(getUserRoutes));

/**
 * @route   DELETE /api/v1/routes/:routeId
 * @desc    Delete a saved route
 * @access  Private
 */
router.delete('/:routeId', authenticate, asyncHandler(deleteRoute));

/**
 * @route   PATCH /api/v1/routes/:routeId/favorite
 * @desc    Toggle favorite status of a saved route
 * @access  Private
 */
router.patch('/:routeId/favorite', authenticate, asyncHandler(toggleRouteFavorite));

export default router;