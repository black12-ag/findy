import { Router } from 'express';
import { authenticate, optionalAuthenticate } from '@/middleware/auth';
import { asyncHandler } from '@/middleware/error';
import {
  searchPlaces,
  getPlaceDetails,
  savePlace,
  deletePlace,
  getUserPlaces,
  toggleFavorite,
} from '@/controllers/places';

const router = Router();

/**
 * @route   POST /api/v1/places/search
 * @desc    Search for places
 * @access  Public (with optional auth for personalization)
 */
router.post('/search', optionalAuthenticate, asyncHandler(searchPlaces));

/**
 * @route   GET /api/v1/places/:placeId
 * @desc    Get place details
 * @access  Public (with optional auth)
 */
router.get('/:placeId', optionalAuthenticate, asyncHandler(getPlaceDetails));

/**
 * @route   POST /api/v1/places
 * @desc    Save a place to user's collection
 * @access  Private
 */
router.post('/', authenticate, asyncHandler(savePlace));

/**
 * @route   DELETE /api/v1/places/:placeId
 * @desc    Remove a saved place
 * @access  Private
 */
router.delete('/:placeId', authenticate, asyncHandler(deletePlace));

/**
 * @route   GET /api/v1/places
 * @desc    Get user's saved places
 * @access  Private
 */
router.get('/', authenticate, asyncHandler(getUserPlaces));

/**
 * @route   PATCH /api/v1/places/:placeId/favorite
 * @desc    Toggle favorite status of a saved place
 * @access  Private
 */
router.patch('/:placeId/favorite', authenticate, asyncHandler(toggleFavorite));

export default router;