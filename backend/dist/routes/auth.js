"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const passport_1 = __importDefault(require("passport"));
const auth_1 = require("@/middleware/auth");
const error_1 = require("@/middleware/error");
const auth_2 = require("@/controllers/auth");
const oauth_1 = require("@/config/oauth");
const router = (0, express_1.Router)();
router.post('/register', (0, error_1.asyncHandler)(auth_2.register));
router.post('/login', (0, error_1.asyncHandler)(auth_2.login));
router.post('/refresh', (0, error_1.asyncHandler)(auth_2.refreshToken));
router.post('/logout', auth_1.authenticate, (0, error_1.asyncHandler)(auth_2.logout));
router.get('/me', auth_1.authenticate, (0, error_1.asyncHandler)(auth_2.getMe));
router.post('/forgot-password', (0, error_1.asyncHandler)(auth_2.forgotPassword));
router.post('/reset-password', (0, error_1.asyncHandler)(auth_2.resetPassword));
router.get('/google', passport_1.default.authenticate('google', { scope: ['profile', 'email'] }));
router.get('/google/callback', passport_1.default.authenticate('google', { failureRedirect: '/auth/oauth-error' }), (req, res) => {
    (0, oauth_1.handleOAuthSuccess)(req.user, req, res);
});
router.get('/apple', (req, res) => {
    res.status(501).json({ message: 'Apple Sign-In not implemented yet' });
});
router.post('/apple/callback', (req, res) => {
    res.status(501).json({ message: 'Apple Sign-In callback not implemented yet' });
});
exports.default = router;
//# sourceMappingURL=auth.js.map