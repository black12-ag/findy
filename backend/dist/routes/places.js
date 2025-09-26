"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("@/middleware/auth");
const error_1 = require("@/middleware/error");
const places_1 = require("@/controllers/places");
const router = (0, express_1.Router)();
router.post('/search', auth_1.optionalAuthenticate, (0, error_1.asyncHandler)(places_1.searchPlaces));
router.get('/:placeId', auth_1.optionalAuthenticate, (0, error_1.asyncHandler)(places_1.getPlaceDetails));
router.post('/', auth_1.authenticate, (0, error_1.asyncHandler)(places_1.savePlace));
router.delete('/:placeId', auth_1.authenticate, (0, error_1.asyncHandler)(places_1.deletePlace));
router.get('/', auth_1.authenticate, (0, error_1.asyncHandler)(places_1.getUserPlaces));
router.patch('/:placeId/favorite', auth_1.authenticate, (0, error_1.asyncHandler)(places_1.toggleFavorite));
exports.default = router;
//# sourceMappingURL=places.js.map