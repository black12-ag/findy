"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("@/middleware/auth");
const error_1 = require("@/middleware/error");
const auth_2 = require("@/controllers/auth");
const router = (0, express_1.Router)();
router.post('/register', (0, error_1.asyncHandler)(auth_2.register));
router.post('/login', (0, error_1.asyncHandler)(auth_2.login));
router.post('/refresh', (0, error_1.asyncHandler)(auth_2.refreshToken));
router.post('/logout', auth_1.authenticate, (0, error_1.asyncHandler)(auth_2.logout));
router.get('/me', auth_1.authenticate, (0, error_1.asyncHandler)(auth_2.getMe));
router.post('/forgot-password', (0, error_1.asyncHandler)(auth_2.forgotPassword));
router.post('/reset-password', (0, error_1.asyncHandler)(auth_2.resetPassword));
exports.default = router;
//# sourceMappingURL=auth.js.map