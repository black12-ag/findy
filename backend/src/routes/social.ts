import { Router } from 'express';
import { authenticate } from '@/middleware/auth';
import { asyncHandler } from '@/middleware/error';
import {
  sendFriendRequest,
  respondToFriendRequest,
  getFriends,
  removeFriend,
  shareRoute,
  sharePlace,
  getSharedContent,
} from '@/controllers/social';

const router = Router();

/**
 * @route   POST /api/v1/social/friends/request
 * @desc    Send friend request
 * @access  Private
 */
router.post('/friends/request', authenticate, asyncHandler(sendFriendRequest));

/**
 * @route   PUT /api/v1/social/friends/request/:requestId
 * @desc    Respond to friend request (accept/reject)
 * @access  Private
 */
router.put('/friends/request/:requestId', authenticate, asyncHandler(respondToFriendRequest));

/**
 * @route   GET /api/v1/social/friends
 * @desc    Get user's friends
 * @access  Private
 */
router.get('/friends', authenticate, asyncHandler(getFriends));

/**
 * @route   DELETE /api/v1/social/friends/:friendshipId
 * @desc    Remove friend
 * @access  Private
 */
router.delete('/friends/:friendshipId', authenticate, asyncHandler(removeFriend));

/**
 * @route   POST /api/v1/social/share/route
 * @desc    Share a route with friends
 * @access  Private
 */
router.post('/share/route', authenticate, asyncHandler(shareRoute));

/**
 * @route   POST /api/v1/social/share/place
 * @desc    Share a place with friends
 * @access  Private
 */
router.post('/share/place', authenticate, asyncHandler(sharePlace));

/**
 * @route   GET /api/v1/social/shared
 * @desc    Get shared content received by user
 * @access  Private
 */
router.get('/shared', authenticate, asyncHandler(getSharedContent));

export default router;