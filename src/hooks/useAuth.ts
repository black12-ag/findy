import { useState, useEffect, useCallback } from 'react';
import type { User, LoginRequest, RegisterRequest } from '../types/api';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    isAuthenticated: true,
    isLoading: false,
    error: null,
  });

  // In free mode, there is no real auth; treat everyone as authenticated guest
  useEffect(() => {
    setState({ user: null, isAuthenticated: true, isLoading: false, error: null });
  }, []);

  const login = useCallback(async (_credentials: LoginRequest) => {
    // No-op in free mode; ensure state reflects authenticated guest
    setState({ user: null, isAuthenticated: true, isLoading: false, error: null });
    return { user: null } as any;
  }, []);

  const register = useCallback(async (_userData: RegisterRequest) => {
    // No-op in free mode; ensure state reflects authenticated guest
    setState({ user: null, isAuthenticated: true, isLoading: false, error: null });
    return { user: null } as any;
  }, []);

  const logout = useCallback(async () => {
    // In free mode, there is no session to clear; remain in guest mode
    setState({ user: null, isAuthenticated: true, isLoading: false, error: null });
  }, []);

  const updateProfile = useCallback(async (_updates: any) => {
    // No-op in free mode
    return null as any;
  }, []);

  const changePassword = useCallback(async (_currentPassword: string, _newPassword: string) => {
    // No-op in free mode
    return;
  }, []);

  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  return {
    user: state.user,
    isAuthenticated: state.isAuthenticated,
    isLoading: state.isLoading,
    error: state.error,
    login,
    register,
    logout,
    updateProfile,
    changePassword,
    clearError,
  };
}

export type AuthHook = ReturnType<typeof useAuth>;