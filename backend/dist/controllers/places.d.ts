import { Response } from 'express';
import { AuthenticatedRequest } from '@/types';
import type { DeletePlaceRequest, GetUserPlacesRequest, UserPlacesResponse } from '@/types/api';
export declare const searchPlaces: (req: AuthenticatedRequest, res: Response) => Promise<void>;
export declare const getPlaceDetails: (req: AuthenticatedRequest, res: Response) => Promise<void>;
export declare const savePlace: (req: AuthenticatedRequest, res: Response) => Promise<void>;
export declare const deletePlace: (req: AuthenticatedRequest & {
    params: {
        placeId: string;
    };
    body: DeletePlaceRequest;
}, res: Response) => Promise<void>;
export declare const getUserPlaces: (req: AuthenticatedRequest & {
    query: GetUserPlacesRequest;
}, res: Response<UserPlacesResponse>) => Promise<void>;
export declare const toggleFavorite: (req: AuthenticatedRequest & {
    params: {
        placeId: string;
    };
}, res: Response) => Promise<void>;
//# sourceMappingURL=places.d.ts.map