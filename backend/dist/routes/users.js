"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("@/middleware/auth");
const error_1 = require("@/middleware/error");
const users_1 = require("@/controllers/users");
const router = (0, express_1.Router)();
router.get('/profile', auth_1.authenticate, (0, error_1.asyncHandler)(users_1.getUserProfile));
router.put('/profile', auth_1.authenticate, (0, error_1.asyncHandler)(users_1.updateProfile));
router.get('/preferences', auth_1.authenticate, (0, error_1.asyncHandler)(users_1.getUserPreferences));
router.put('/preferences', auth_1.authenticate, (0, error_1.asyncHandler)(users_1.updatePreferences));
router.post('/change-password', auth_1.authenticate, (0, error_1.asyncHandler)(users_1.changePassword));
router.get('/analytics', auth_1.authenticate, (0, error_1.asyncHandler)(users_1.getUserAnalytics));
router.delete('/account', auth_1.authenticate, (0, error_1.asyncHandler)(users_1.deleteAccount));
exports.default = router;
//# sourceMappingURL=users.js.map