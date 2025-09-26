import React, { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';
import { logger } from '../utils/logger';

// Settings types
export interface AppSettings {
  // Navigation preferences
  defaultTransportMode: 'driving' | 'walking' | 'transit' | 'cycling';
  voiceGuidance: boolean;
  voiceVolume: number;
  avoidTolls: boolean;
  avoidHighways: boolean;
  avoidFerries: boolean;
  
  // Display preferences
  mapStyle: 'standard' | 'satellite' | 'terrain' | 'dark';
  darkMode: boolean;
  units: 'metric' | 'imperial';
  language: string;
  
  // Notification preferences
  pushNotifications: boolean;
  trafficAlerts: boolean;
  routeUpdates: boolean;
  arrivalNotifications: boolean;
  socialNotifications: boolean;
  
  // Accessibility preferences
  highContrast: boolean;
  largeText: boolean;
  screenReader: boolean;
  reduceMotion: boolean;
  colorBlindMode: 'none' | 'protanopia' | 'deuteranopia' | 'tritanopia';
  textSize: number;
  buttonSize: number;
  
  // Privacy preferences
  locationHistory: boolean;
  shareLocation: boolean;
  analytics: boolean;
  crashReporting: boolean;
}

// Default settings
const DEFAULT_SETTINGS: AppSettings = {
  // Navigation
  defaultTransportMode: 'driving',
  voiceGuidance: true,
  voiceVolume: 80,
  avoidTolls: false,
  avoidHighways: false,
  avoidFerries: false,
  
  // Display
  mapStyle: 'standard',
  darkMode: false,
  units: 'imperial',
  language: 'en-US',
  
  // Notifications
  pushNotifications: true,
  trafficAlerts: true,
  routeUpdates: true,
  arrivalNotifications: true,
  socialNotifications: false,
  
  // Accessibility
  highContrast: false,
  largeText: false,
  screenReader: false,
  reduceMotion: false,
  colorBlindMode: 'none',
  textSize: 100,
  buttonSize: 100,
  
  // Privacy
  locationHistory: true,
  shareLocation: false,
  analytics: true,
  crashReporting: true,
};

// Action types
type SettingsAction = 
  | { type: 'UPDATE_SETTING'; key: keyof AppSettings; value: any }
  | { type: 'UPDATE_MULTIPLE'; settings: Partial<AppSettings> }
  | { type: 'RESET_TO_DEFAULTS' }
  | { type: 'LOAD_FROM_STORAGE'; settings: AppSettings };

// Reducer
function settingsReducer(state: AppSettings, action: SettingsAction): AppSettings {
  switch (action.type) {
    case 'UPDATE_SETTING':
      return {
        ...state,
        [action.key]: action.value,
      };
    
    case 'UPDATE_MULTIPLE':
      return {
        ...state,
        ...action.settings,
      };
    
    case 'RESET_TO_DEFAULTS':
      return DEFAULT_SETTINGS;
    
    case 'LOAD_FROM_STORAGE':
      return action.settings;
    
    default:
      return state;
  }
}

// Context type
interface SettingsContextType {
  settings: AppSettings;
  updateSetting: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
  updateMultipleSettings: (settings: Partial<AppSettings>) => void;
  resetToDefaults: () => void;
  isLoading: boolean;
}

// Create context
const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

// Storage key
const STORAGE_KEY = 'comtion-app-settings';

// Provider component
interface SettingsProviderProps {
  children: ReactNode;
}

export function SettingsProvider({ children }: SettingsProviderProps) {
  const [settings, dispatch] = useReducer(settingsReducer, DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = React.useState(true);

  // Load settings from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsedSettings = JSON.parse(stored);
        
        // Merge with defaults to handle new settings
        const mergedSettings = {
          ...DEFAULT_SETTINGS,
          ...parsedSettings,
        };
        
        dispatch({ type: 'LOAD_FROM_STORAGE', settings: mergedSettings });
        logger.debug('Settings loaded from localStorage', { settings: mergedSettings });
      } else {
        logger.debug('No stored settings found, using defaults');
      }
    } catch (error) {
      logger.error('Failed to load settings from localStorage', { error });
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Save settings to localStorage whenever they change
  useEffect(() => {
    if (!isLoading) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
        logger.debug('Settings saved to localStorage', { settings });
      } catch (error) {
        logger.error('Failed to save settings to localStorage', { error });
      }
    }
  }, [settings, isLoading]);

  // Actions
  const updateSetting = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    dispatch({ type: 'UPDATE_SETTING', key, value });
    logger.debug('Setting updated', { key, value });
  };

  const updateMultipleSettings = (newSettings: Partial<AppSettings>) => {
    dispatch({ type: 'UPDATE_MULTIPLE', settings: newSettings });
    logger.debug('Multiple settings updated', { settings: newSettings });
  };

  const resetToDefaults = () => {
    dispatch({ type: 'RESET_TO_DEFAULTS' });
    logger.info('Settings reset to defaults');
  };

  const contextValue: SettingsContextType = {
    settings,
    updateSetting,
    updateMultipleSettings,
    resetToDefaults,
    isLoading,
  };

  return (
    <SettingsContext.Provider value={contextValue}>
      {children}
    </SettingsContext.Provider>
  );
}

// Hook to use settings context
export function useSettings() {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}

// Hook to get a specific setting
export function useSetting<K extends keyof AppSettings>(key: K) {
  const { settings, updateSetting } = useSettings();
  return [settings[key], (value: AppSettings[K]) => updateSetting(key, value)] as const;
}

// Utility function to get system preferences
export function getSystemPreferences(): Partial<AppSettings> {
  const preferences: Partial<AppSettings> = {};

  // Dark mode preference
  if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    preferences.darkMode = true;
  }

  // Reduced motion preference
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    preferences.reduceMotion = true;
  }

  // Language preference
  preferences.language = navigator.language || 'en-US';

  return preferences;
}