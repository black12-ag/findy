"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("@/middleware/auth");
const error_1 = require("@/middleware/error");
const routes_1 = require("@/controllers/routes");
const router = (0, express_1.Router)();
router.post('/calculate', auth_1.optionalAuthenticate, (0, error_1.asyncHandler)(routes_1.calculateRoute));
router.post('/optimize', auth_1.optionalAuthenticate, (0, error_1.asyncHandler)(routes_1.optimizeRoute));
router.post('/', auth_1.authenticate, (0, error_1.asyncHandler)(routes_1.saveRoute));
router.get('/', auth_1.authenticate, (0, error_1.asyncHandler)(routes_1.getUserRoutes));
router.delete('/:routeId', auth_1.authenticate, (0, error_1.asyncHandler)(routes_1.deleteRoute));
router.patch('/:routeId/favorite', auth_1.authenticate, (0, error_1.asyncHandler)(routes_1.toggleRouteFavorite));
exports.default = router;
//# sourceMappingURL=routes.js.map