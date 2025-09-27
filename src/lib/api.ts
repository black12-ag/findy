import axios, { AxiosResponse } from 'axios';

// API base URL - can be configured via environment variable
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

// Create axios instance with default config
export const api = axios.create({
  baseURL: `${API_BASE_URL}/api/v1`,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Remove auth headers/refresh handling: project is free/no-auth
// Keep a simple pass-through response handler.
api.interceptors.response.use((response) => response, (error) => Promise.reject(error));

// Generic API response type
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

// Helper function to handle API responses
export const handleApiResponse = <T>(response: AxiosResponse<ApiResponse<T>>): T => {
  if (response.data.success) {
    return response.data.data;
  }
  throw new Error(response.data.message || 'API request failed');
};

// Helper function for GET requests with fallback
export const get = async <T>(url: string, params?: any): Promise<T> => {
  try {
    const response = await api.get<ApiResponse<T>>(url, { params });
    return handleApiResponse(response);
  } catch (error) {
    console.warn(`API GET ${url} failed, using offline mode:`, error);
    throw new Error('Backend unavailable - using offline mode');
  }
};

// Helper function for POST requests with fallback
export const post = async <T>(url: string, data?: any): Promise<T> => {
  try {
    const response = await api.post<ApiResponse<T>>(url, data);
    return handleApiResponse(response);
  } catch (error) {
    console.warn(`API POST ${url} failed, using offline mode:`, error);
    throw new Error('Backend unavailable - using offline mode');
  }
};

// Helper function for PUT requests
export const put = async <T>(url: string, data?: any): Promise<T> => {
  const response = await api.put<ApiResponse<T>>(url, data);
  return handleApiResponse(response);
};

// Helper function for PATCH requests
export const patch = async <T>(url: string, data?: any): Promise<T> => {
  const response = await api.patch<ApiResponse<T>>(url, data);
  return handleApiResponse(response);
};

// Helper function for DELETE requests
export const del = async <T>(url: string): Promise<T> => {
  const response = await api.delete<ApiResponse<T>>(url);
  return handleApiResponse(response);
};

// Helper function for DELETE requests with a JSON body (some endpoints need payload)
export const delWithBody = async <T>(url: string, data?: any): Promise<T> => {
  const response = await api.delete<ApiResponse<T>>(url, { data });
  return handleApiResponse(response);
};

export default api;