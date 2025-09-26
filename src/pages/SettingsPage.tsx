/**
 * ⚙️ Settings Page
 * 
 * App preferences, API usage monitoring, and cache management
 * Connected to: Quota Manager for API usage display
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Switch,
  Platform,
  ActivityIndicator
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Services
import { quotaManager } from '../services/quotaManager';
import type { QuotaStatus } from '../services/quotaManager';

// Config
import { API_ENDPOINTS, APIEndpointType } from '../config/apiConfig';

interface AppSettings {
  units: 'metric' | 'imperial';
  mapStyle: 'standard' | 'satellite' | 'hybrid';
  voiceGuidance: boolean;
  autoReroute: boolean;
  avoidTolls: boolean;
  avoidHighways: boolean;
  showTraffic: boolean;
  nightMode: boolean;
  cachingEnabled: boolean;
}

const STORAGE_KEYS = {
  SETTINGS: '@findy_settings',
  CACHE: '@findy_cache',
  FAVORITES: '@findy_favorites'
};

export default function SettingsPage() {
  const navigation = useNavigation();
  
  // State
  const [settings, setSettings] = useState<AppSettings>({
    units: 'metric',
    mapStyle: 'standard',
    voiceGuidance: true,
    autoReroute: true,
    avoidTolls: false,
    avoidHighways: false,
    showTraffic: true,
    nightMode: false,
    cachingEnabled: true
  });
  const [quotaStatuses, setQuotaStatuses] = useState<Record<APIEndpointType, QuotaStatus> | null>(null);
  const [isLoadingQuotas, setIsLoadingQuotas] = useState(true);
  const [cacheSize, setCacheSize] = useState<string>('0 MB');

  // Load settings and quotas on mount
  useEffect(() => {
    loadSettings();
    loadQuotaStatuses();
    calculateCacheSize();
  }, []);

  /**
   * Load app settings from storage
   */
  const loadSettings = async () => {
    try {
      const savedSettings = await AsyncStorage.getItem(STORAGE_KEYS.SETTINGS);
      if (savedSettings) {
        setSettings(JSON.parse(savedSettings));
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  /**
   * Save settings to storage
   */
  const saveSettings = async (newSettings: AppSettings) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(newSettings));
      setSettings(newSettings);
    } catch (error) {
      console.error('Error saving settings:', error);
      Alert.alert('Error', 'Unable to save settings');
    }
  };

  /**
   * Load API quota statuses - Connected to Quota Manager
   */
  const loadQuotaStatuses = async () => {
    try {
      setIsLoadingQuotas(true);
      const statuses = quotaManager.getAllQuotaStatus();
      setQuotaStatuses(statuses);
    } catch (error) {
      console.error('Error loading quota statuses:', error);
    } finally {
      setIsLoadingQuotas(false);
    }
  };

  /**
   * Calculate total cache size
   */
  const calculateCacheSize = async () => {
    try {
      const cacheData = await AsyncStorage.getItem(STORAGE_KEYS.CACHE);
      const favoritesData = await AsyncStorage.getItem(STORAGE_KEYS.FAVORITES);
      
      let totalSize = 0;
      if (cacheData) totalSize += JSON.stringify(cacheData).length;
      if (favoritesData) totalSize += JSON.stringify(favoritesData).length;
      
      // Convert to MB
      const sizeInMB = (totalSize / (1024 * 1024)).toFixed(2);
      setCacheSize(`${sizeInMB} MB`);
    } catch (error) {
      console.error('Error calculating cache size:', error);
      setCacheSize('Unknown');
    }
  };

  /**
   * Clear all app cache - IndexedDB cleanup
   */
  const handleClearCache = () => {
    Alert.alert(
      'Clear Cache',
      'This will remove all cached data including search history and route cache. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            try {
              await AsyncStorage.removeItem(STORAGE_KEYS.CACHE);
              setCacheSize('0 MB');
              Alert.alert('Success', 'Cache cleared successfully');
            } catch (error) {
              console.error('Error clearing cache:', error);
              Alert.alert('Error', 'Unable to clear cache');
            }
          }
        }
      ]
    );
  };

  /**
   * Handle setting change
   */
  const handleSettingChange = <K extends keyof AppSettings>(
    key: K,
    value: AppSettings[K]
  ) => {
    const newSettings = { ...settings, [key]: value };
    saveSettings(newSettings);
  };

  /**
   * Check API usage - Shows current quotas
   */
  const handleCheckAPIUsage = () => {
    if (!quotaStatuses) {
      loadQuotaStatuses();
      return;
    }

    const quotaDetails = Object.entries(quotaStatuses)
      .map(([endpoint, status]) => {
        const percentage = ((status.dailyUsed / status.dailyLimit) * 100).toFixed(1);
        return `${endpoint}: ${status.dailyUsed}/${status.dailyLimit} (${percentage}%)`;
      })
      .join('\n');

    Alert.alert(
      'API Usage Status',
      `Daily Quota Usage:\n\n${quotaDetails}`,
      [
        { text: 'Refresh', onPress: loadQuotaStatuses },
        { text: 'Close' }
      ]
    );
  };

  /**
   * Format quota percentage for display
   */
  const getQuotaPercentage = (status: QuotaStatus): number => {
    return (status.dailyUsed / status.dailyLimit) * 100;
  };

  /**
   * Get quota status color
   */
  const getQuotaColor = (percentage: number): string => {
    if (percentage >= 90) return '#F44336';
    if (percentage >= 70) return '#FF9800';
    return '#4CAF50';
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* API Usage Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>API Usage</Text>
          
          <TouchableOpacity 
            style={styles.settingItem}
            onPress={handleCheckAPIUsage}
          >
            <View style={styles.settingInfo}>
              <Ionicons name="analytics" size={20} color="#2196F3" />
              <View style={styles.settingTextContainer}>
                <Text style={styles.settingText}>Check API Usage</Text>
                <Text style={styles.settingSubtext}>View current quota status</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#666" />
          </TouchableOpacity>

          {/* Quota Display */}
          {isLoadingQuotas ? (
            <View style={styles.quotaLoading}>
              <ActivityIndicator size="small" color="#2196F3" />
              <Text style={styles.quotaLoadingText}>Loading quota status...</Text>
            </View>
          ) : quotaStatuses && (
            <View style={styles.quotaContainer}>
              {Object.entries(quotaStatuses).map(([endpoint, status]) => {
                const percentage = getQuotaPercentage(status);
                const color = getQuotaColor(percentage);
                
                return (
                  <View key={endpoint} style={styles.quotaItem}>
                    <View style={styles.quotaHeader}>
                      <Text style={styles.quotaEndpoint}>{endpoint}</Text>
                      <Text style={[styles.quotaPercentage, { color }]}>
                        {percentage.toFixed(1)}%
                      </Text>
                    </View>
                    <View style={styles.quotaBar}>
                      <View 
                        style={[
                          styles.quotaProgress, 
                          { width: `${Math.min(percentage, 100)}%`, backgroundColor: color }
                        ]} 
                      />
                    </View>
                    <Text style={styles.quotaDetails}>
                      {status.dailyUsed} / {status.dailyLimit} requests today
                    </Text>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        {/* Navigation Preferences */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Navigation</Text>
          
          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Ionicons name="speedometer" size={20} color="#4CAF50" />
              <View style={styles.settingTextContainer}>
                <Text style={styles.settingText}>Units</Text>
                <Text style={styles.settingSubtext}>Distance and speed units</Text>
              </View>
            </View>
            <TouchableOpacity 
              style={styles.unitSelector}
              onPress={() => {
                const newUnits = settings.units === 'metric' ? 'imperial' : 'metric';
                handleSettingChange('units', newUnits);
              }}
            >
              <Text style={styles.unitText}>
                {settings.units === 'metric' ? 'km/h' : 'mph'}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Ionicons name="volume-high" size={20} color="#9C27B0" />
              <View style={styles.settingTextContainer}>
                <Text style={styles.settingText}>Voice Guidance</Text>
                <Text style={styles.settingSubtext}>Turn-by-turn audio instructions</Text>
              </View>
            </View>
            <Switch
              value={settings.voiceGuidance}
              onValueChange={(value) => handleSettingChange('voiceGuidance', value)}
              trackColor={{ false: '#ccc', true: '#4CAF50' }}
            />
          </View>

          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Ionicons name="refresh" size={20} color="#FF9800" />
              <View style={styles.settingTextContainer}>
                <Text style={styles.settingText}>Auto-Reroute</Text>
                <Text style={styles.settingSubtext}>Automatically find new routes when off-course</Text>
              </View>
            </View>
            <Switch
              value={settings.autoReroute}
              onValueChange={(value) => handleSettingChange('autoReroute', value)}
              trackColor={{ false: '#ccc', true: '#4CAF50' }}
            />
          </View>

          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Ionicons name="cash-outline" size={20} color="#F44336" />
              <View style={styles.settingTextContainer}>
                <Text style={styles.settingText}>Avoid Tolls</Text>
                <Text style={styles.settingSubtext}>Prefer routes without tolls</Text>
              </View>
            </View>
            <Switch
              value={settings.avoidTolls}
              onValueChange={(value) => handleSettingChange('avoidTolls', value)}
              trackColor={{ false: '#ccc', true: '#4CAF50' }}
            />
          </View>

          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Ionicons name="car-sport" size={20} color="#2196F3" />
              <View style={styles.settingTextContainer}>
                <Text style={styles.settingText}>Avoid Highways</Text>
                <Text style={styles.settingSubtext}>Prefer local roads over highways</Text>
              </View>
            </View>
            <Switch
              value={settings.avoidHighways}
              onValueChange={(value) => handleSettingChange('avoidHighways', value)}
              trackColor={{ false: '#ccc', true: '#4CAF50' }}
            />
          </View>
        </View>

        {/* Map Preferences */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Map</Text>
          
          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Ionicons name="map" size={20} color="#795548" />
              <View style={styles.settingTextContainer}>
                <Text style={styles.settingText}>Map Style</Text>
                <Text style={styles.settingSubtext}>{settings.mapStyle}</Text>
              </View>
            </View>
            <TouchableOpacity 
              style={styles.styleSelector}
              onPress={() => {
                const styles_array: Array<'standard' | 'satellite' | 'hybrid'> = ['standard', 'satellite', 'hybrid'];
                const currentIndex = styles_array.indexOf(settings.mapStyle);
                const nextStyle = styles_array[(currentIndex + 1) % styles_array.length];
                handleSettingChange('mapStyle', nextStyle);
              }}
            >
              <Text style={styles.styleText}>{settings.mapStyle}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Ionicons name="car" size={20} color="#E91E63" />
              <View style={styles.settingTextContainer}>
                <Text style={styles.settingText}>Show Traffic</Text>
                <Text style={styles.settingSubtext}>Display real-time traffic conditions</Text>
              </View>
            </View>
            <Switch
              value={settings.showTraffic}
              onValueChange={(value) => handleSettingChange('showTraffic', value)}
              trackColor={{ false: '#ccc', true: '#4CAF50' }}
            />
          </View>

          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Ionicons name="moon" size={20} color="#607D8B" />
              <View style={styles.settingTextContainer}>
                <Text style={styles.settingText}>Night Mode</Text>
                <Text style={styles.settingSubtext}>Dark theme for low-light conditions</Text>
              </View>
            </View>
            <Switch
              value={settings.nightMode}
              onValueChange={(value) => handleSettingChange('nightMode', value)}
              trackColor={{ false: '#ccc', true: '#4CAF50' }}
            />
          </View>
        </View>

        {/* Cache & Storage */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Cache & Storage</Text>
          
          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Ionicons name="save" size={20} color="#3F51B5" />
              <View style={styles.settingTextContainer}>
                <Text style={styles.settingText}>Enable Caching</Text>
                <Text style={styles.settingSubtext}>Store data offline to reduce API usage</Text>
              </View>
            </View>
            <Switch
              value={settings.cachingEnabled}
              onValueChange={(value) => handleSettingChange('cachingEnabled', value)}
              trackColor={{ false: '#ccc', true: '#4CAF50' }}
            />
          </View>

          <TouchableOpacity 
            style={styles.settingItem}
            onPress={handleClearCache}
          >
            <View style={styles.settingInfo}>
              <Ionicons name="trash" size={20} color="#F44336" />
              <View style={styles.settingTextContainer}>
                <Text style={styles.settingText}>Clear Cache</Text>
                <Text style={styles.settingSubtext}>Cache size: {cacheSize}</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#666" />
          </TouchableOpacity>
        </View>

        {/* About */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About</Text>
          
          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Ionicons name="information-circle" size={20} color="#666" />
              <View style={styles.settingTextContainer}>
                <Text style={styles.settingText}>FINDY Navigation</Text>
                <Text style={styles.settingSubtext}>Version 1.0.0</Text>
              </View>
            </View>
          </View>

          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Ionicons name="globe" size={20} color="#666" />
              <View style={styles.settingTextContainer}>
                <Text style={styles.settingText}>Powered by OpenRouteService</Text>
                <Text style={styles.settingSubtext}>Real-time navigation and routing</Text>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    paddingBottom: 15,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    padding: 5,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  headerRight: {
    width: 34,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  section: {
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
    marginBottom: 15,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  settingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingTextContainer: {
    marginLeft: 15,
    flex: 1,
  },
  settingText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  settingSubtext: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  unitSelector: {
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  unitText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  styleSelector: {
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  styleText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    textTransform: 'capitalize',
  },
  quotaLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
  },
  quotaLoadingText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 10,
  },
  quotaContainer: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 15,
    marginTop: 10,
  },
  quotaItem: {
    marginBottom: 15,
  },
  quotaHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  quotaEndpoint: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  quotaPercentage: {
    fontSize: 14,
    fontWeight: '600',
  },
  quotaBar: {
    height: 8,
    backgroundColor: '#e0e0e0',
    borderRadius: 4,
    marginBottom: 5,
    overflow: 'hidden',
  },
  quotaProgress: {
    height: '100%',
    borderRadius: 4,
  },
  quotaDetails: {
    fontSize: 12,
    color: '#666',
  },
});