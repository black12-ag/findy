import { Response } from 'express';
import { AuthenticatedRequest } from '@/types';
import type { SendFriendRequestRequest, FriendRequestResponse, GetFriendsRequest, FriendsResponse, ShareRouteRequest, SharePlaceRequest, SharedItemResponse } from '@/types/api';
export declare const sendFriendRequest: (req: AuthenticatedRequest & {
    body: SendFriendRequestRequest;
}, res: Response<FriendRequestResponse>) => Promise<void>;
export declare const respondToFriendRequest: (req: AuthenticatedRequest & {
    params: {
        requestId: string;
    };
    body: {
        action: "ACCEPT" | "REJECT";
    };
}, res: Response) => Promise<void>;
export declare const getFriends: (req: AuthenticatedRequest & {
    query: GetFriendsRequest;
}, res: Response<FriendsResponse>) => Promise<void>;
export declare const removeFriend: (req: AuthenticatedRequest & {
    params: {
        friendshipId: string;
    };
}, res: Response) => Promise<void>;
export declare const shareRoute: (req: AuthenticatedRequest & {
    body: ShareRouteRequest;
}, res: Response<SharedItemResponse>) => Promise<void>;
export declare const sharePlace: (req: AuthenticatedRequest & {
    body: SharePlaceRequest;
}, res: Response<SharedItemResponse>) => Promise<void>;
export declare const getSharedContent: (req: AuthenticatedRequest & {
    query: {
        type?: "route" | "place";
        page?: number;
        limit?: number;
    };
}, res: Response) => Promise<void>;
//# sourceMappingURL=social.d.ts.map