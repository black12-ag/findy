/**
 * 🍞 Toast Configuration
 * 
 * Centralized configuration for toast notifications
 * Controls which messages show and their duration/appearance
 */

import { toast as sonnerToast } from 'sonner';

// Toast levels - control what gets shown
export enum ToastLevel {
  SILENT = 0,      // No toasts
  ESSENTIAL = 1,   // Only critical messages (errors, important success)
  NORMAL = 2,      // Normal level (errors, success, warnings)
  VERBOSE = 3      // All messages including info
}

// Current toast level (can be changed based on environment or user preference)
export const CURRENT_TOAST_LEVEL = process.env.NODE_ENV === 'development' 
  ? ToastLevel.ESSENTIAL  // Less noise in development
  : ToastLevel.NORMAL;    // Normal for production

// Toast categories
export enum ToastCategory {
  NAVIGATION = 'navigation',
  LOCATION = 'location',
  MAP = 'map',
  SEARCH = 'search',
  DOWNLOAD = 'download',
  SYSTEM = 'system',
  ERROR = 'error'
}

// Which categories should be shown at different levels
const CATEGORY_LEVELS: Record<ToastCategory, ToastLevel> = {
  [ToastCategory.ERROR]: ToastLevel.ESSENTIAL,        // Always show errors
  [ToastCategory.DOWNLOAD]: ToastLevel.ESSENTIAL,     // Important: download progress
  [ToastCategory.SEARCH]: ToastLevel.NORMAL,          // Search results
  [ToastCategory.SYSTEM]: ToastLevel.NORMAL,          // System messages
  [ToastCategory.NAVIGATION]: ToastLevel.VERBOSE,     // Navigation updates (often annoying)
  [ToastCategory.LOCATION]: ToastLevel.VERBOSE,       // Location updates (often annoying)
  [ToastCategory.MAP]: ToastLevel.VERBOSE,            // Map interactions (often annoying)
};

// Custom toast durations (shorter than defaults)
const TOAST_DURATIONS = {
  error: 4000,      // 4 seconds for errors
  success: 2000,    // 2 seconds for success
  info: 1500,       // 1.5 seconds for info
  loading: Infinity  // Keep loading toasts until dismissed
};

// Enhanced toast functions with level checking
class ToastManager {
  private shouldShow(category: ToastCategory, level: 'error' | 'success' | 'info' | 'loading' = 'info'): boolean {
    // Always show errors regardless of level
    if (level === 'error') return true;
    
    // Check if category should be shown at current level
    return CURRENT_TOAST_LEVEL >= CATEGORY_LEVELS[category];
  }

  success(message: string, category: ToastCategory = ToastCategory.SYSTEM, options?: any) {
    if (!this.shouldShow(category, 'success')) return;
    
    return sonnerToast.success(message, {
      duration: TOAST_DURATIONS.success,
      ...options
    });
  }

  error(message: string, category: ToastCategory = ToastCategory.ERROR, options?: any) {
    if (!this.shouldShow(category, 'error')) return;
    
    return sonnerToast.error(message, {
      duration: TOAST_DURATIONS.error,
      ...options
    });
  }

  info(message: string, category: ToastCategory = ToastCategory.SYSTEM, options?: any) {
    if (!this.shouldShow(category, 'info')) return;
    
    return sonnerToast.info(message, {
      duration: TOAST_DURATIONS.info,
      ...options
    });
  }

  loading(message: string, category: ToastCategory = ToastCategory.SYSTEM, options?: any) {
    if (!this.shouldShow(category, 'loading')) return;
    
    return sonnerToast.loading(message, {
      duration: TOAST_DURATIONS.loading,
      ...options
    });
  }

  dismiss(id?: string | number) {
    return sonnerToast.dismiss(id);
  }

  // Quick methods for common patterns
  navigationSuccess(message: string, options?: any) {
    return this.success(message, ToastCategory.NAVIGATION, options);
  }

  navigationInfo(message: string, options?: any) {
    return this.info(message, ToastCategory.NAVIGATION, options);
  }

  locationUpdate(message: string, options?: any) {
    return this.info(message, ToastCategory.LOCATION, options);
  }

  mapInteraction(message: string, options?: any) {
    return this.info(message, ToastCategory.MAP, options);
  }

  searchResult(message: string, type: 'success' | 'info' = 'info', options?: any) {
    if (type === 'success') {
      return this.success(message, ToastCategory.SEARCH, options);
    }
    return this.info(message, ToastCategory.SEARCH, options);
  }

  downloadProgress(message: string, type: 'success' | 'info' | 'error' = 'info', options?: any) {
    if (type === 'success') {
      return this.success(message, ToastCategory.DOWNLOAD, options);
    } else if (type === 'error') {
      return this.error(message, ToastCategory.DOWNLOAD, options);
    }
    return this.info(message, ToastCategory.DOWNLOAD, options);
  }
}

// Export singleton instance
export const toast = new ToastManager();

// Export original sonner toast for cases where we need full control
export { sonnerToast };

// Helper to change toast level dynamically (for debugging or user preferences)
export function setToastLevel(level: ToastLevel) {
  // This would normally update a global state or localStorage
  console.log(`Toast level set to: ${ToastLevel[level]}`);
}