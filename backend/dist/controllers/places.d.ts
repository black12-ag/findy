import { Request, Response } from 'express';
import type { PlaceSearchRequest, PlaceDetailsRequest, SavePlaceRequest, DeletePlaceRequest, GetUserPlacesRequest, PlaceSearchResponse, PlaceDetailsResponse, SavePlaceResponse, UserPlacesResponse } from '@/types/api';
export declare const searchPlaces: (req: Request<{}, PlaceSearchResponse, PlaceSearchRequest>, res: Response<PlaceSearchResponse>) => Promise<void>;
export declare const getPlaceDetails: (req: Request<{
    placeId: string;
}, PlaceDetailsResponse, PlaceDetailsRequest>, res: Response<PlaceDetailsResponse>) => Promise<void>;
export declare const savePlace: (req: Request<{}, SavePlaceResponse, SavePlaceRequest>, res: Response<SavePlaceResponse>) => Promise<void>;
export declare const deletePlace: (req: Request<{
    placeId: string;
}, {}, DeletePlaceRequest>, res: Response) => Promise<void>;
export declare const getUserPlaces: (req: Request<{}, UserPlacesResponse, {}, GetUserPlacesRequest>, res: Response<UserPlacesResponse>) => Promise<void>;
export declare const toggleFavorite: (req: Request<{
    placeId: string;
}>, res: Response) => Promise<void>;
//# sourceMappingURL=places.d.ts.map