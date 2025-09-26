import { Router } from 'express';
import { authenticate } from '@/middleware/auth';
import { asyncHandler } from '@/middleware/error';
import {
  getUserProfile,
  updateProfile,
  getUserPreferences,
  updatePreferences,
  changePassword,
  getUserAnalytics,
  deleteAccount,
} from '@/controllers/users';

const router = Router();

/**
 * @route   GET /api/v1/users/profile
 * @desc    Get user profile
 * @access  Private
 */
router.get('/profile', authenticate, asyncHandler(getUserProfile));

/**
 * @route   PUT /api/v1/users/profile
 * @desc    Update user profile
 * @access  Private
 */
router.put('/profile', authenticate, asyncHandler(updateProfile));

/**
 * @route   GET /api/v1/users/preferences
 * @desc    Get user preferences
 * @access  Private
 */
router.get('/preferences', authenticate, asyncHandler(getUserPreferences));

/**
 * @route   PUT /api/v1/users/preferences
 * @desc    Update user preferences
 * @access  Private
 */
router.put('/preferences', authenticate, asyncHandler(updatePreferences));

/**
 * @route   POST /api/v1/users/change-password
 * @desc    Change user password
 * @access  Private
 */
router.post('/change-password', authenticate, asyncHandler(changePassword));

/**
 * @route   GET /api/v1/users/analytics
 * @desc    Get user analytics
 * @access  Private
 */
router.get('/analytics', authenticate, asyncHandler(getUserAnalytics));

/**
 * @route   DELETE /api/v1/users/account
 * @desc    Delete user account
 * @access  Private
 */
router.delete('/account', authenticate, asyncHandler(deleteAccount));

export default router;