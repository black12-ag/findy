import { get, post, put, delWithBody } from '../lib/api';
import type { 
  User, 
  LoginRequest, 
  RegisterRequest, 
  AuthResponse,
  UserPreferences 
} from '../types/api';

class AuthService {
  /**
   * Login user
   */
  async login(credentials: LoginRequest): Promise<AuthResponse> {
    const response = await post<AuthResponse>('/auth/login', credentials);
    
    // Store tokens and user data
    localStorage.setItem('accessToken', response.accessToken);
    localStorage.setItem('refreshToken', response.refreshToken);
    localStorage.setItem('user', JSON.stringify(response.user));
    
    return response;
  }

  /**
   * Register new user
   */
  async register(userData: RegisterRequest): Promise<AuthResponse> {
    const response = await post<AuthResponse>('/auth/register', userData);
    
    // Store tokens and user data
    localStorage.setItem('accessToken', response.accessToken);
    localStorage.setItem('refreshToken', response.refreshToken);
    localStorage.setItem('user', JSON.stringify(response.user));
    
    return response;
  }

  /**
   * Logout user
   */
  async logout(): Promise<void> {
    try {
      await post('/auth/logout');
    } catch (error) {
      console.warn('Logout API call failed:', error);
    } finally {
      // Clear local storage regardless of API success
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('user');
    }
  }

  /**
   * Get current user profile
   */
  async getProfile(): Promise<User> {
    return get<User>('/auth/me');
  }

  /**
   * Refresh access token
   */
  async refreshToken(): Promise<{ accessToken: string; refreshToken: string }> {
    const refreshToken = localStorage.getItem('refreshToken');
    if (!refreshToken) {
      throw new Error('No refresh token available');
    }

    const response = await post<{ accessToken: string; refreshToken: string }>(
      '/auth/refresh',
      { refreshToken }
    );

    localStorage.setItem('accessToken', response.accessToken);
    localStorage.setItem('refreshToken', response.refreshToken);

    return response;
  }

  /**
   * Request password reset
   */
  async forgotPassword(email: string): Promise<void> {
    await post('/auth/forgot-password', { email });
  }

  /**
   * Reset password with token
   */
  async resetPassword(token: string, password: string): Promise<void> {
    await post('/auth/reset-password', { token, password });
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    const token = localStorage.getItem('accessToken');
    const user = localStorage.getItem('user');
    return !!(token && user);
  }

  /**
   * Get current user from localStorage
   */
  getCurrentUser(): User | null {
    try {
      const userStr = localStorage.getItem('user');
      return userStr ? JSON.parse(userStr) : null;
    } catch (error) {
      console.error('Error parsing user data:', error);
      return null;
    }
  }

  /**
   * Update user profile
   */
  async updateProfile(updates: Partial<{
    firstName: string;
    lastName: string;
    phone: string;
    dateOfBirth: string;
    bio: string;
    avatar: string;
  }>): Promise<User> {
    const user = await put<{ user: User }>('/users/profile', updates);
    
    // Update local storage
    localStorage.setItem('user', JSON.stringify(user.user));
    
    return user.user;
  }

  /**
   * Get user preferences
   */
  async getPreferences(): Promise<UserPreferences> {
    const response = await get<{ preferences: UserPreferences }>('/users/preferences');
    return response.preferences;
  }

  /**
   * Update user preferences
   */
  async updatePreferences(preferences: Partial<Omit<UserPreferences, 'id' | 'userId' | 'createdAt' | 'updatedAt'>>): Promise<UserPreferences> {
    const response = await put<{ preferences: UserPreferences }>('/users/preferences', preferences);
    return response.preferences;
  }

  /**
   * Change password
   */
  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    await post('/users/change-password', {
      currentPassword,
      newPassword,
    });
  }

  /**
   * Delete account
   */
  async deleteAccount(password: string, confirmationText: string, reason?: string): Promise<void> {
    await delWithBody('/users/account', {
      password,
      confirmationText,
      reason,
    });

    // Clear local storage after successful deletion
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
  }

  /**
   * Get user analytics
   */
  async getUserAnalytics(days: number = 30) {
    return get(`/users/analytics?days=${days}`);
  }
}

export const authService = new AuthService();
export default authService;