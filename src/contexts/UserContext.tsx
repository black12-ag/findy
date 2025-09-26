/**
 * UserContext - Global user state management
 * Handles authentication, user data, and user preferences
 */

import React, { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';
import { logger } from '../utils/logger';

interface User {
  id: string;
  email: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  avatar?: string;
  phoneNumber?: string;
  isVerified: boolean;
  isActive: boolean;
  role: 'USER' | 'ADMIN' | 'MODERATOR';
  createdAt: string;
  updatedAt: string;
}

interface UserPreferences {
  defaultTransportMode: 'driving' | 'walking' | 'transit' | 'cycling';
  voiceGuidance: boolean;
  avoidTolls: boolean;
  avoidHighways: boolean;
  avoidFerries: boolean;
  mapStyle: string;
  darkMode: boolean;
  language: string;
  units: 'metric' | 'imperial';
  shareLocation: boolean;
  shareActivity: boolean;
  allowFriendRequests: boolean;
  trafficAlerts: boolean;
  weatherAlerts: boolean;
  socialNotifications: boolean;
}

interface UserState {
  user: User | null;
  preferences: UserPreferences;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

type UserAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_USER'; payload: User | null }
  | { type: 'SET_PREFERENCES'; payload: Partial<UserPreferences> }
  | { type: 'LOGIN_SUCCESS'; payload: { user: User; preferences: UserPreferences } }
  | { type: 'LOGOUT' }
  | { type: 'UPDATE_PROFILE'; payload: Partial<User> }
  | { type: 'UPDATE_PREFERENCE'; payload: { key: keyof UserPreferences; value: any } };

const initialPreferences: UserPreferences = {
  defaultTransportMode: 'driving',
  voiceGuidance: true,
  avoidTolls: false,
  avoidHighways: false,
  avoidFerries: false,
  mapStyle: 'standard',
  darkMode: false,
  language: 'en',
  units: 'metric',
  shareLocation: false,
  shareActivity: true,
  allowFriendRequests: true,
  trafficAlerts: true,
  weatherAlerts: true,
  socialNotifications: true,
};

const initialState: UserState = {
  user: null,
  preferences: initialPreferences,
  isAuthenticated: false,
  isLoading: true,
  error: null,
};

const userReducer = (state: UserState, action: UserAction): UserState => {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };

    case 'SET_ERROR':
      return { ...state, error: action.payload };

    case 'SET_USER':
      return {
        ...state,
        user: action.payload,
        isAuthenticated: !!action.payload,
      };

    case 'SET_PREFERENCES':
      return {
        ...state,
        preferences: { ...state.preferences, ...action.payload },
      };

    case 'LOGIN_SUCCESS':
      return {
        ...state,
        user: action.payload.user,
        preferences: { ...state.preferences, ...action.payload.preferences },
        isAuthenticated: true,
        isLoading: false,
        error: null,
      };

    case 'LOGOUT':
      return {
        ...state,
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
        preferences: initialPreferences,
      };

    case 'UPDATE_PROFILE':
      if (!state.user) return state;
      return {
        ...state,
        user: { ...state.user, ...action.payload },
      };

    case 'UPDATE_PREFERENCE':
      return {
        ...state,
        preferences: {
          ...state.preferences,
          [action.payload.key]: action.payload.value,
        },
      };

    default:
      return state;
  }
};

interface UserContextType extends UserState {
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  register: (userData: {
    email: string;
    password: string;
    firstName?: string;
    lastName?: string;
  }) => Promise<void>;
  updateProfile: (updates: Partial<User>) => Promise<void>;
  updatePreferences: (updates: Partial<UserPreferences>) => Promise<void>;
  updatePreference: (key: keyof UserPreferences, value: any) => void;
  loadUserData: () => Promise<void>;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

interface UserProviderProps {
  children: ReactNode;
}

export const UserProvider: React.FC<UserProviderProps> = ({ children }) => {
  const [state, dispatch] = useReducer(userReducer, initialState);

  // Load user data from localStorage on mount
  useEffect(() => {
    loadUserData();
  }, []);

  // Save preferences to localStorage whenever they change
  useEffect(() => {
    if (state.preferences !== initialPreferences) {
      localStorage.setItem('user_preferences', JSON.stringify(state.preferences));
    }
  }, [state.preferences]);

  const loadUserData = async () => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });

      // Load from localStorage first
      const savedUser = localStorage.getItem('user_data');
      const savedPreferences = localStorage.getItem('user_preferences');
      const authToken = localStorage.getItem('auth_token');

      if (savedUser && authToken) {
        const user = JSON.parse(savedUser);
        const preferences = savedPreferences 
          ? { ...initialPreferences, ...JSON.parse(savedPreferences) }
          : initialPreferences;

        dispatch({ type: 'LOGIN_SUCCESS', payload: { user, preferences } });
        
        // TODO: Validate token with backend and refresh user data
        logger.debug('User data loaded from localStorage', { userId: user.id });
      } else {
        // Load guest preferences if available
        if (savedPreferences) {
          dispatch({ type: 'SET_PREFERENCES', payload: JSON.parse(savedPreferences) });
        }
        dispatch({ type: 'SET_LOADING', payload: false });
      }
    } catch (error) {
      logger.error('Failed to load user data', { error });
      dispatch({ type: 'SET_ERROR', payload: 'Failed to load user data' });
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  const login = async (email: string, password: string) => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      dispatch({ type: 'SET_ERROR', payload: null });

      // TODO: Replace with actual API call
      const mockUser: User = {
        id: 'user_123',
        email,
        username: email.split('@')[0],
        firstName: 'Demo',
        lastName: 'User',
        isVerified: true,
        isActive: true,
        role: 'USER',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Save to localStorage
      localStorage.setItem('user_data', JSON.stringify(mockUser));
      localStorage.setItem('auth_token', 'demo_token_123');

      dispatch({ type: 'LOGIN_SUCCESS', payload: { user: mockUser, preferences: state.preferences } });
      logger.info('User logged in successfully');
    } catch (error) {
      logger.error('Login failed', { error, email });
      dispatch({ type: 'SET_ERROR', payload: 'Login failed. Please try again.' });
      throw error;
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  const logout = async () => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });

      // TODO: Call logout API endpoint

      // Clear localStorage
      localStorage.removeItem('user_data');
      localStorage.removeItem('auth_token');

      dispatch({ type: 'LOGOUT' });
      logger.info('User logged out successfully');
    } catch (error) {
      logger.error('Logout failed', { error });
      // Still logout locally even if API fails
      localStorage.removeItem('user_data');
      localStorage.removeItem('auth_token');
      dispatch({ type: 'LOGOUT' });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  const register = async (userData: {
    email: string;
    password: string;
    firstName?: string;
    lastName?: string;
  }) => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      dispatch({ type: 'SET_ERROR', payload: null });

      // TODO: Replace with actual API call
      const newUser: User = {
        id: `user_${Date.now()}`,
        email: userData.email,
        username: userData.email.split('@')[0],
        firstName: userData.firstName,
        lastName: userData.lastName,
        isVerified: false,
        isActive: true,
        role: 'USER',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Save to localStorage
      localStorage.setItem('user_data', JSON.stringify(newUser));
      localStorage.setItem('auth_token', `demo_token_${Date.now()}`);

      dispatch({ type: 'LOGIN_SUCCESS', payload: { user: newUser, preferences: state.preferences } });
      logger.info('User registered successfully');
    } catch (error) {
      logger.error('Registration failed', { error, email: userData.email });
      dispatch({ type: 'SET_ERROR', payload: 'Registration failed. Please try again.' });
      throw error;
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  const updateProfile = async (updates: Partial<User>) => {
    try {
      if (!state.user) throw new Error('No user logged in');

      dispatch({ type: 'SET_LOADING', payload: true });
      
      // TODO: Call API to update profile
      
      const updatedUser = { ...state.user, ...updates, updatedAt: new Date().toISOString() };
      localStorage.setItem('user_data', JSON.stringify(updatedUser));

      dispatch({ type: 'UPDATE_PROFILE', payload: { ...updates, updatedAt: new Date().toISOString() } });
      logger.info('Profile updated successfully', { updates });
    } catch (error) {
      logger.error('Profile update failed', { error, updates });
      dispatch({ type: 'SET_ERROR', payload: 'Failed to update profile' });
      throw error;
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  const updatePreferences = async (updates: Partial<UserPreferences>) => {
    try {
      // TODO: Call API to save preferences if user is authenticated
      
      dispatch({ type: 'SET_PREFERENCES', payload: updates });
      logger.debug('Preferences updated', { updates });
    } catch (error) {
      logger.error('Failed to update preferences', { error, updates });
      throw error;
    }
  };

  const updatePreference = (key: keyof UserPreferences, value: any) => {
    dispatch({ type: 'UPDATE_PREFERENCE', payload: { key, value } });
    logger.debug('Preference updated', { key, value });
  };

  const contextValue: UserContextType = {
    ...state,
    login,
    logout,
    register,
    updateProfile,
    updatePreferences,
    updatePreference,
    loadUserData,
  };

  return <UserContext.Provider value={contextValue}>{children}</UserContext.Provider>;
};

export const useUser = (): UserContextType => {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
};

export type { User, UserPreferences, UserState };