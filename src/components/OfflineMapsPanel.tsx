import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, 
  Download, 
  Trash2, 
  MapPin, 
  Wifi, 
  WifiOff,
  HardDrive,
  Settings,
  Plus,
  Check,
  AlertTriangle,
  RefreshCw
} from 'lucide-react';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Progress } from './ui/progress';
import { Switch } from './ui/switch';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { offlineMapsService, OfflineRegion, StorageInfo } from '../services/offlineMapsService';
import { enhancedOfflineMapsService, EnhancedOfflineRoute, StorageQuotaInfo, DownloadStrategy } from '../services/enhancedOfflineMapsService';

// Using OfflineRegion from offlineMapsService

interface OfflineMapsPanelProps {
  onBack: () => void;
}

export function OfflineMapsPanel({ onBack }: OfflineMapsPanelProps) {
  const [activeTab, setActiveTab] = useState('downloaded');
  const [autoUpdate, setAutoUpdate] = useState(true);
  const [wifiOnly, setWifiOnly] = useState(true);
  const [offlineRegions, setOfflineRegions] = useState<OfflineRegion[]>([]);
  const [storageInfo, setStorageInfo] = useState<StorageInfo>({
    totalUsed: 0,
    totalAvailable: 0,
    tilesCount: 0,
    regionsCount: 0,
    routesCount: 0
  });
  const [isInitialized, setIsInitialized] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<{[key: string]: number}>({});

  // Available regions for download
  const availableRegions = [
    { 
      id: 'sf-bay-area',
      name: 'San Francisco Bay Area',
      region: 'California',
      bounds: { north: 37.9, south: 37.6, east: -122.2, west: -122.6 },
      center: { lat: 37.7749, lng: -122.4194 },
      size: '486 MB',
      coverage: '50 mi radius'
    },
    { 
      id: 'nyc',
      name: 'New York City',
      region: 'New York',
      bounds: { north: 40.9, south: 40.5, east: -73.7, west: -74.3 },
      center: { lat: 40.7128, lng: -74.0060 },
      size: '652 MB',
      coverage: 'All 5 boroughs'
    },
    { 
      id: 'la-metro',
      name: 'Los Angeles Metro',
      region: 'California',
      bounds: { north: 34.3, south: 33.9, east: -117.9, west: -118.5 },
      center: { lat: 34.0522, lng: -118.2437 },
      size: '324 MB',
      coverage: '30 mi radius'
    },
    { 
      id: 'chicago',
      name: 'Chicago',
      region: 'Illinois',
      bounds: { north: 42.0, south: 41.6, east: -87.5, west: -87.9 },
      center: { lat: 41.8781, lng: -87.6298 },
      size: '445 MB',
      coverage: 'Metro area'
    }
  ];

  // Initialize service and load data
  useEffect(() => {
    initializeOfflineMaps();
  }, []);

  const initializeOfflineMaps = async () => {
    try {
      // Initialize both basic and enhanced services
      await Promise.all([
        offlineMapsService.initialize(),
        enhancedOfflineMapsService.initialize()
      ]);
      await loadData();
      setIsInitialized(true);
    } catch (error) {
      console.error('Failed to initialize offline maps:', error);
    }
  };

  const loadData = async () => {
    try {
      const [regions, storage] = await Promise.all([
        offlineMapsService.getOfflineRegions(),
        offlineMapsService.getStorageInfo()
      ]);
      setOfflineRegions(regions);
      setStorageInfo(storage);
    } catch (error) {
      console.error('Failed to load offline maps data:', error);
    }
  };

  const handleDownloadMap = async (regionId: string) => {
    const region = availableRegions.find(r => r.id === regionId);
    if (!region) return;

    setIsDownloading(true);
    try {
      const downloadId = await offlineMapsService.downloadRegion(
        {
          name: region.name,
          bounds: region.bounds,
          center: region.center,
          minZoom: 10,
          maxZoom: 16,
          mapProvider: 'osm'
        },
        (progress, downloaded, total) => {
          setDownloadProgress(prev => ({
            ...prev,
            [region.name]: progress
          }));
        }
      );

      // Refresh data after starting download
      await loadData();
    } catch (error) {
      console.error('Failed to start download:', error);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleDeleteMap = async (regionId: string) => {
    setIsDownloading(true);
    try {
      await offlineMapsService.deleteOfflineRegion(regionId);
      await loadData();
    } catch (error) {
      console.error('Failed to delete region:', error);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleUpdateMap = async (regionId: string) => {
    // For updates, we would re-download the region
    // This is a simplified implementation
    setIsDownloading(true);
    try {
      const region = offlineRegions.find(r => r.id === regionId);
      if (region) {
        await offlineMapsService.downloadRegion(
          {
            name: region.name,
            bounds: region.bounds,
            center: region.center,
            minZoom: region.minZoom,
            maxZoom: region.maxZoom,
            mapProvider: region.mapProvider
          },
          (progress) => {
            setDownloadProgress(prev => ({
              ...prev,
              [region.name]: progress
            }));
          }
        );
        await loadData();
      }
    } catch (error) {
      console.error('Failed to update region:', error);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleClearAllData = async () => {
    try {
      await offlineMapsService.clearAllData();
      await loadData();
    } catch (error) {
      console.error('Failed to clear data:', error);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'downloaded': return <Check className="w-4 h-4 text-green-600" />;
      case 'downloading': return <Download className="w-4 h-4 text-blue-600 animate-pulse" />;
      case 'updating': return <RefreshCw className="w-4 h-4 text-orange-600 animate-spin" />;
      case 'error': return <AlertTriangle className="w-4 h-4 text-red-600" />;
      default: return <MapPin className="w-4 h-4 text-gray-400" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'downloaded': return 'Downloaded';
      case 'downloading': return 'Downloading...';
      case 'updating': return 'Updating...';
      case 'error': return 'Error';
      default: return 'Unknown';
    }
  };

  return (
    <div className="h-full bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 bg-white px-4 py-4 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={onBack}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h2 className="font-medium text-gray-900">Offline Maps</h2>
            <p className="text-sm text-gray-500">Download maps for offline use</p>
          </div>
        </div>
      </div>

      {/* Storage Info */}
      <div className="flex-shrink-0 bg-white mx-4 mt-4 rounded-lg border border-gray-200 p-4">
        <div className="flex items-center gap-3 mb-3">
          <HardDrive className="w-5 h-5 text-gray-600" />
          <div className="flex-1">
            <div className="flex items-center justify-between mb-1">
              <span className="font-medium text-gray-900">Storage Used</span>
              <span className="text-sm text-gray-600">
                {(storageInfo.totalUsed / (1024 * 1024 * 1024)).toFixed(1)} GB of {(storageInfo.totalAvailable / (1024 * 1024 * 1024)).toFixed(1)} GB
              </span>
            </div>
            <Progress value={storageInfo.totalAvailable > 0 ? (storageInfo.totalUsed / storageInfo.totalAvailable) * 100 : 0} className="h-2" />
          </div>
        </div>
        
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Wifi className="w-4 h-4 text-green-600" />
              <span className="text-sm text-gray-700">Auto-update on WiFi</span>
            </div>
            <Switch
              checked={autoUpdate}
              onCheckedChange={setAutoUpdate}
            />
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <WifiOff className="w-4 h-4 text-orange-600" />
              <span className="text-sm text-gray-700">WiFi only downloads</span>
            </div>
            <Switch
              checked={wifiOnly}
              onCheckedChange={setWifiOnly}
            />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col mt-4">
        <div className="flex-shrink-0 px-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="downloaded">Downloaded ({offlineRegions.length})</TabsTrigger>
            <TabsTrigger value="available">Available</TabsTrigger>
          </TabsList>
        </div>

        <div className="flex-1 overflow-hidden min-h-0 mt-4">
          {/* Downloaded Maps Tab */}
          <TabsContent value="downloaded" className="h-full px-4 scroll-y hide-scrollbar scroll-smooth mt-0">
            <div className="space-y-3">
              {!isInitialized && (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="w-6 h-6 animate-spin text-gray-400 mr-2" />
                  <span className="text-gray-500">Loading offline maps...</span>
                </div>
              )}
              
              {isInitialized && offlineRegions.map((region) => (
                <Card key={region.id} className="p-4">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                      <MapPin className="w-6 h-6 text-blue-600" />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h3 className="font-medium text-gray-900">{region.name}</h3>
                          <p className="text-sm text-gray-600">
                            {region.center.lat.toFixed(4)}, {region.center.lng.toFixed(4)}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {getStatusIcon(region.status)}
                          <Badge 
                            variant="outline" 
                            className="border-green-200 text-green-700"
                          >
                            {region.mapProvider.toUpperCase()}
                          </Badge>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-4 text-sm text-gray-600 mb-2">
                        <span>{(region.totalSize / (1024 * 1024)).toFixed(0)} MB</span>
                        <span>{region.downloadedTiles} / {region.tileCount} tiles</span>
                        <span>Z{region.minZoom}-{region.maxZoom}</span>
                      </div>

                      {(region.status === 'downloading' || region.status === 'updating') && (
                        <div className="mb-3">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm text-gray-600">
                              {region.status === 'downloading' ? 'Downloading...' : 'Updating...'}
                            </span>
                            <span className="text-sm text-gray-600">
                              {Math.round((region.downloadedTiles / region.tileCount) * 100)}%
                            </span>
                          </div>
                          <Progress value={(region.downloadedTiles / region.tileCount) * 100} className="h-2" />
                        </div>
                      )}

                      <div className="flex items-center gap-2">
                        {region.status === 'downloaded' && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleUpdateMap(region.id)}
                              disabled={isDownloading}
                            >
                              <RefreshCw className={`w-4 h-4 mr-2 ${isDownloading ? 'animate-spin' : ''}`} />
                              Update
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDeleteMap(region.id)}
                              disabled={isDownloading}
                              className="text-red-600 hover:text-red-700"
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Delete
                            </Button>
                          </>
                        )}
                        {region.status === 'error' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleUpdateMap(region.id)}
                            disabled={isDownloading}
                          >
                            <RefreshCw className={`w-4 h-4 mr-2 ${isDownloading ? 'animate-spin' : ''}`} />
                            Retry
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </Card>
              ))}

              {isInitialized && offlineRegions.length === 0 && (
                <div className="text-center py-12">
                  <MapPin className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="font-medium text-gray-900 mb-2">No offline maps</h3>
                  <p className="text-gray-500 mb-4">Download maps to use PathFinder offline</p>
                  <Button onClick={() => setActiveTab('available')}>
                    <Plus className="w-4 h-4 mr-2" />
                    Browse Available Maps
                  </Button>
                </div>
              )}
            </div>
          </TabsContent>

          {/* Available Maps Tab */}
          <TabsContent value="available" className="h-full px-4 scroll-y hide-scrollbar scroll-smooth mt-0">
            <div className="space-y-3">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-medium text-gray-900">Popular Regions</h3>
                <Button variant="ghost" size="sm">
                  <Settings className="w-4 h-4 mr-2" />
                  Custom Area
                </Button>
              </div>

              {availableRegions.map((region) => {
                const existingRegion = offlineRegions.find(r => r.id === region.id);
                const isDownloaded = existingRegion?.status === 'downloaded';
                const isRegionDownloading = existingRegion?.status === 'downloading';
                
                return (
                  <Card key={region.id} className="p-4">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
                        <MapPin className="w-6 h-6 text-gray-600" />
                      </div>
                      
                      <div className="flex-1">
                        <h3 className="font-medium text-gray-900">{region.name}</h3>
                        <p className="text-sm text-gray-600">{region.region}</p>
                        <div className="flex items-center gap-4 text-sm text-gray-500 mt-1">
                          <span>{region.size}</span>
                          <span>{region.coverage}</span>
                        </div>
                      </div>
                      
                      <div className="flex flex-col items-end gap-2">
                        {isDownloaded ? (
                          <Badge className="bg-green-100 text-green-700">
                            <Check className="w-3 h-3 mr-1" />
                            Downloaded
                          </Badge>
                        ) : isRegionDownloading ? (
                          <div className="flex items-center gap-2">
                            <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
                            <span className="text-sm text-gray-600">
                              {Math.round((existingRegion.downloadedTiles / existingRegion.tileCount) * 100)}%
                            </span>
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            onClick={() => handleDownloadMap(region.id)}
                            disabled={isDownloading || isRegionDownloading || (!wifiOnly && navigator?.connection?.effectiveType !== 'wifi')}
                          >
                            <Download className="w-4 h-4 mr-2" />
                            Download
                          </Button>
                        )}
                      </div>
                    </div>
                  </Card>
                );
              })}

              {/* Custom Area Download */}
              <Card className="p-4 border-dashed border-2 border-gray-300">
                <div className="text-center py-4">
                  <Plus className="w-8 h-8 text-gray-400 mx-auto mb-3" />
                  <h3 className="font-medium text-gray-900 mb-2">Custom Area</h3>
                  <p className="text-sm text-gray-600 mb-4">
                    Select a custom area on the map to download
                  </p>
                  <Button variant="outline">
                    <MapPin className="w-4 h-4 mr-2" />
                    Select on Map
                  </Button>
                </div>
              </Card>

              {/* Download Tips */}
              <Card className="p-4 bg-blue-50 border-blue-200">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <Wifi className="w-4 h-4 text-blue-600" />
                  </div>
                  <div>
                    <h4 className="font-medium text-blue-900 mb-1">Download Tips</h4>
                    <ul className="text-sm text-blue-800 space-y-1">
                      <li>• Download on WiFi to save mobile data</li>
                      <li>• Detailed maps include building footprints and POIs</li>
                      <li>• Maps auto-update weekly when connected</li>
                      <li>• Offline routing works without internet</li>
                    </ul>
                  </div>
                </div>
              </Card>
            </div>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}