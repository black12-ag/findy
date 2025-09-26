import { Request, Response } from 'express';
import type { SendFriendRequestRequest, FriendRequestResponse, GetFriendsRequest, FriendsResponse, ShareRouteRequest, SharePlaceRequest, SharedItemResponse } from '@/types/api';
export declare const sendFriendRequest: (req: Request<{}, FriendRequestResponse, SendFriendRequestRequest>, res: Response<FriendRequestResponse>) => Promise<void>;
export declare const respondToFriendRequest: (req: Request<{
    requestId: string;
}, {}, {
    action: "ACCEPT" | "REJECT";
}>, res: Response) => Promise<void>;
export declare const getFriends: (req: Request<{}, FriendsResponse, {}, GetFriendsRequest>, res: Response<FriendsResponse>) => Promise<void>;
export declare const removeFriend: (req: Request<{
    friendshipId: string;
}>, res: Response) => Promise<void>;
export declare const shareRoute: (req: Request<{}, SharedItemResponse, ShareRouteRequest>, res: Response<SharedItemResponse>) => Promise<void>;
export declare const sharePlace: (req: Request<{}, SharedItemResponse, SharePlaceRequest>, res: Response<SharedItemResponse>) => Promise<void>;
export declare const getSharedContent: (req: Request<{}, {}, {}, {
    type?: "ROUTE" | "PLACE";
    page?: number;
    limit?: number;
}>, res: Response) => Promise<void>;
//# sourceMappingURL=social.d.ts.map