"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("@/middleware/auth");
const error_1 = require("@/middleware/error");
const social_1 = require("@/controllers/social");
const router = (0, express_1.Router)();
router.post('/friends/request', auth_1.authenticate, (0, error_1.asyncHandler)(social_1.sendFriendRequest));
router.put('/friends/request/:requestId', auth_1.authenticate, (0, error_1.asyncHandler)(social_1.respondToFriendRequest));
router.get('/friends', auth_1.authenticate, (0, error_1.asyncHandler)(social_1.getFriends));
router.delete('/friends/:friendshipId', auth_1.authenticate, (0, error_1.asyncHandler)(social_1.removeFriend));
router.post('/share/route', auth_1.authenticate, (0, error_1.asyncHandler)(social_1.shareRoute));
router.post('/share/place', auth_1.authenticate, (0, error_1.asyncHandler)(social_1.sharePlace));
router.get('/shared', auth_1.authenticate, (0, error_1.asyncHandler)(social_1.getSharedContent));
exports.default = router;
//# sourceMappingURL=social.js.map