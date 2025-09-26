import { get, post, del, patch, put } from '../lib/api';
import type { Friend, FriendRequest } from '../types/api';

class SocialService {
  /**
   * Send friend request
   */
  async sendFriendRequest(request: FriendRequest): Promise<{
    friendRequest: Friend;
  }> {
    return post('/social/friends/request', request);
  }

  /**
   * Respond to friend request
   */
  async respondToFriendRequest(requestId: string, action: 'ACCEPT' | 'REJECT'): Promise<{
    friendRequest: Friend;
  }> {
    return put(`/social/friends/request/${requestId}`, { action });
  }

  /**
   * Get user's friends
   */
  async getFriends(params: {
    status?: 'PENDING' | 'ACCEPTED' | 'REJECTED';
    page?: number;
    limit?: number;
  } = {}): Promise<{
    friends: Friend[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> {
    const searchParams = new URLSearchParams();
    
    if (params.status) searchParams.append('status', params.status);
    if (params.page) searchParams.append('page', params.page.toString());
    if (params.limit) searchParams.append('limit', params.limit.toString());

    return get(`/social/friends?${searchParams.toString()}`);
  }

  /**
   * Remove friend
   */
  async removeFriend(friendshipId: string): Promise<void> {
    await del(`/social/friends/${friendshipId}`);
  }

  /**
   * Share a route with friends
   */
  async shareRoute(data: {
    routeId: string;
    friendIds: string[];
    message?: string;
  }): Promise<{
    shares: any[];
  }> {
    return post('/social/share/route', data);
  }

  /**
   * Share a place with friends
   */
  async sharePlace(data: {
    placeId: string;
    friendIds: string[];
    message?: string;
  }): Promise<{
    shares: any[];
  }> {
    return post('/social/share/place', data);
  }

  /**
   * Get shared content received by user
   */
  async getSharedContent(params: {
    type?: 'ROUTE' | 'PLACE';
    page?: number;
    limit?: number;
  } = {}): Promise<{
    sharedContent: any[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> {
    const searchParams = new URLSearchParams();
    
    if (params.type) searchParams.append('type', params.type);
    if (params.page) searchParams.append('page', params.page.toString());
    if (params.limit) searchParams.append('limit', params.limit.toString());

    return get(`/social/shared?${searchParams.toString()}`);
  }

  /**
   * Get friend requests (pending)
   */
  async getFriendRequests(): Promise<Friend[]> {
    const result = await this.getFriends({ status: 'PENDING' });
    return result.friends;
  }

  /**
   * Get accepted friends
   */
  async getAcceptedFriends(): Promise<Friend[]> {
    const result = await this.getFriends({ status: 'ACCEPTED' });
    return result.friends;
  }

  /**
   * Search for users to add as friends
   */
  async searchUsers(query: string): Promise<{
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    avatar?: string;
  }[]> {
    // This would be implemented if we had a user search endpoint
    // For now, return empty array as fallback
    return [];
  }

  /**
   * Format friend for display
   */
  formatFriend(friend: Friend, currentUserId: string): {
    id: string;
    name: string;
    email: string;
    avatar?: string;
    status: string;
    isRequester: boolean;
  } {
    const friendUser = friend.requesterId === currentUserId ? friend.addressee : friend.requester;
    
    return {
      id: friendUser.id,
      name: `${friendUser.firstName} ${friendUser.lastName}`,
      email: friendUser.email,
      avatar: friendUser.avatar,
      status: friend.status,
      isRequester: friend.requesterId === currentUserId,
    };
  }

  /**
   * Get friend status with another user
   */
  async getFriendStatus(userId: string): Promise<'NONE' | 'PENDING' | 'ACCEPTED' | 'REJECTED'> {
    try {
      const friends = await this.getFriends();
      const friendship = friends.friends.find(f => 
        f.requesterId === userId || f.addresseeId === userId
      );
      
      return friendship ? friendship.status : 'NONE';
    } catch (error) {
      console.error('Error getting friend status:', error);
      return 'NONE';
    }
  }
}

export const socialService = new SocialService();
export default socialService;