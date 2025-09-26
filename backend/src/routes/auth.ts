import { Router } from 'express';
import passport from 'passport';
import { authenticate } from '@/middleware/auth';
import { asyncHandler } from '@/middleware/error';
import {
  register,
  login,
  refreshToken,
  logout,
  getMe,
  forgotPassword,
  resetPassword,
} from '@/controllers/auth';
import { handleOAuthSuccess, handleOAuthError } from '@/config/oauth';

const router = Router();

/**
 * @route   POST /api/v1/auth/register
 * @desc    Register a new user
 * @access  Public
 */
router.post('/register', asyncHandler(register));

/**
 * @route   POST /api/v1/auth/login
 * @desc    Login user
 * @access  Public
 */
router.post('/login', asyncHandler(login));

/**
 * @route   POST /api/v1/auth/refresh
 * @desc    Refresh access token
 * @access  Public
 */
router.post('/refresh', asyncHandler(refreshToken));

/**
 * @route   POST /api/v1/auth/logout
 * @desc    Logout user
 * @access  Private
 */
router.post('/logout', authenticate, asyncHandler(logout));

/**
 * @route   GET /api/v1/auth/me
 * @desc    Get current user profile
 * @access  Private
 */
router.get('/me', authenticate, asyncHandler(getMe));

/**
 * @route   POST /api/v1/auth/forgot-password
 * @desc    Send password reset email
 * @access  Public
 */
router.post('/forgot-password', asyncHandler(forgotPassword));

/**
 * @route   POST /api/v1/auth/reset-password
 * @desc    Reset password with token
 * @access  Public
 */
router.post('/reset-password', asyncHandler(resetPassword));

/**
 * @route   GET /api/v1/auth/google
 * @desc    Google OAuth login
 * @access  Public
 */
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

/**
 * @route   GET /api/v1/auth/google/callback
 * @desc    Google OAuth callback
 * @access  Public
 */
router.get(
  '/google/callback',
  passport.authenticate('google', { failureRedirect: '/auth/oauth-error' }),
  (req, res) => {
    handleOAuthSuccess(req.user, req, res);
  }
);

/**
 * @route   GET /api/v1/auth/apple
 * @desc    Apple Sign-In (placeholder)
 * @access  Public
 */
router.get('/apple', (req, res) => {
  // Apple Sign-In implementation would go here
  // This requires custom JWT verification and Apple's REST API
  res.status(501).json({ message: 'Apple Sign-In not implemented yet' });
});

/**
 * @route   POST /api/v1/auth/apple/callback
 * @desc    Apple Sign-In callback (placeholder)
 * @access  Public
 */
router.post('/apple/callback', (req, res) => {
  // Apple Sign-In callback implementation would go here
  res.status(501).json({ message: 'Apple Sign-In callback not implemented yet' });
});

export default router;
