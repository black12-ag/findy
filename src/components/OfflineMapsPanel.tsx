/**
 * 🗺️ Offline Maps Panel
 * 
 * Complete UI for managing offline map downloads
 * Integrates with the offline maps service
 */

import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { 
  MapPin, 
  Download, 
  Trash2, 
  Search, 
  Globe, 
  Wifi, 
  WifiOff,
  HardDrive,
  Clock,
  X,
  CheckCircle,
  AlertCircle,
  Loader,
  ArrowLeft
} from 'lucide-react';
import offlineMapsService, { 
  type CityInfo, 
  type OfflineMapData, 
  type DownloadProgress 
} from '../services/offlineMapsService';
import { logger } from '../utils/logger';

interface OfflineMapsPanelProps {
  isOpen?: boolean;
  onBack?: () => void;
  onClose?: () => void;
}

export function OfflineMapsPanel({ isOpen = true, onBack, onClose }: OfflineMapsPanelProps) {
  const [currentTab, setCurrentTab] = useState<'discover' | 'downloads' | 'manage'>('discover');
  const [userCity, setUserCity] = useState<CityInfo | null>(null);
  const [popularCities, setPopularCities] = useState<CityInfo[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<CityInfo[]>([]);
  const [offlineMaps, setOfflineMaps] = useState<OfflineMapData[]>([]);
  const [downloadProgress, setDownloadProgress] = useState<Map<string, DownloadProgress>>(new Map());
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  // Load data on component mount
  useEffect(() => {
    if (isOpen) {
      loadPopularCities();
      loadOfflineMaps();
    }
  }, [isOpen]);

  // Handle ESC key to close modal
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        handleClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  const loadPopularCities = async () => {
    try {
      const cities = await offlineMapsService.getPopularCities();
      setPopularCities(cities);
    } catch (error) {
      logger.error('Failed to load popular cities:', error);
    }
  };

  const loadOfflineMaps = async () => {
    try {
      const maps = await offlineMapsService.getOfflineMaps();
      setOfflineMaps(maps);
    } catch (error) {
      logger.error('Failed to load offline maps:', error);
    }
  };

  const detectUserLocation = async () => {
    setIsDetectingLocation(true);
    try {
      const city = await offlineMapsService.detectUserCity();
      if (city) {
        setUserCity(city);
        toast.success(`Detected your location: ${city.name}, ${city.country}`);
      } else {
        toast.error('Could not detect your location. Please select a city manually.');
      }
    } catch (error) {
      logger.error('Location detection failed:', error);
      toast.error('Failed to detect location. Please try again.');
    } finally {
      setIsDetectingLocation(false);
    }
  };

  const searchCities = async () => {
    if (!searchQuery.trim()) return;
    
    setIsSearching(true);
    try {
      logger.info('Starting city search:', { query: searchQuery });
      const results = await offlineMapsService.searchCities(searchQuery);
      setSearchResults(results);
      
      if (results.length === 0) {
        toast.info(`No cities found for "${searchQuery}". Try a different search term.`);
        logger.warn('No search results found:', { query: searchQuery });
      } else {
        toast.success(`Found ${results.length} cities for "${searchQuery}"`);
        logger.info('Search successful:', { query: searchQuery, count: results.length });
      }
    } catch (error) {
      logger.error('City search failed:', error);
      
      // Provide more specific error messages
      const errorMessage = error.message || error.toString();
      if (errorMessage.includes('Google Maps') || errorMessage.includes('not loaded')) {
        toast.error('Google Maps is still loading. Please wait a moment and try again.');
      } else if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
        toast.error('Network error. Please check your internet connection.');
      } else {
        toast.error('Search failed. Please try again.');
      }
    } finally {
      setIsSearching(false);
    }
  };

  const downloadCity = async (city: CityInfo) => {
    try {
      // Check if already downloading
      if (downloadProgress.has(city.id)) {
        toast.info('Download already in progress for this city');
        return;
      }

      // Check if already downloaded
      const hasOfflineMap = await offlineMapsService.hasOfflineMap(city.id);
      if (hasOfflineMap) {
        toast.info('This city is already downloaded');
        return;
      }

      await offlineMapsService.downloadCityMaps(city.id, {
        onProgress: (progress) => {
          setDownloadProgress(prev => {
            const newMap = new Map(prev);
            newMap.set(city.id, progress);
            return newMap;
          });

          // Remove from progress when completed
          if (progress.status === 'completed' || progress.status === 'failed' || progress.status === 'cancelled') {
            setTimeout(() => {
              setDownloadProgress(prev => {
                const newMap = new Map(prev);
                newMap.delete(city.id);
                return newMap;
              });
            }, 3000);

            // Refresh offline maps list
            if (progress.status === 'completed') {
              loadOfflineMaps();
            }
          }
        }
      });
    } catch (error) {
      logger.error('Download failed:', error);
      toast.error(`Failed to download maps for ${city.name}`);
    }
  };

  const cancelDownload = async (cityId: string) => {
    try {
      await offlineMapsService.cancelDownload(cityId);
      setDownloadProgress(prev => {
        const newMap = new Map(prev);
        newMap.delete(cityId);
        return newMap;
      });
    } catch (error) {
      logger.error('Failed to cancel download:', error);
    }
  };

  const deleteOfflineMap = async (cityId: string) => {
    if (!confirm('Are you sure you want to delete this offline map?')) return;
    
    try {
      await offlineMapsService.deleteOfflineMap(cityId);
      setOfflineMaps(prev => prev.filter(map => map.cityId !== cityId));
      toast.success('Offline map deleted successfully');
    } catch (error) {
      logger.error('Failed to delete offline map:', error);
      toast.error('Failed to delete offline map');
    }
  };

  const formatFileSize = (bytes: number) => {
    const sizes = ['B', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 B';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  const formatTimeRemaining = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  };

  const handleClose = () => {
    if (onClose) onClose();
    if (onBack) onBack();
  };

  // City Card Component
  const CityCard: React.FC<{ city: CityInfo; showDownload?: boolean }> = ({ 
    city, 
    showDownload = true 
  }) => {
    const progress = downloadProgress.get(city.id);
    const hasOfflineMap = offlineMaps.some(map => map.cityId === city.id);

    return (
      <div className="border rounded-lg p-3 space-y-2 bg-white shadow-sm hover:shadow-md transition-all duration-200 hover:scale-105 cursor-pointer group">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-sm text-gray-900 truncate group-hover:text-blue-600 transition-colors">{city.name}</h3>
            <p className="text-xs text-gray-600 truncate">{city.country}</p>
            {city.population && (
              <p className="text-xs text-gray-500">
                Pop: {(city.population / 1000000).toFixed(1)}M
              </p>
            )}
          </div>
          <MapPin className="w-4 h-4 text-gray-400 flex-shrink-0 group-hover:text-blue-500 transition-colors" />
        </div>

        {progress && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2">
                {progress.status === 'downloading' ? (
                  <Loader className="w-4 h-4 animate-spin text-blue-500" />
                ) : progress.status === 'completed' ? (
                  <CheckCircle className="w-4 h-4 text-green-500" />
                ) : progress.status === 'failed' ? (
                  <AlertCircle className="w-4 h-4 text-red-500" />
                ) : null}
                {progress.status}
              </span>
              <span className="font-medium">{progress.progress.toFixed(0)}%</span>
            </div>
            
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progress.progress}%` }}
              />
            </div>
            
            <div className="flex justify-between text-xs text-gray-500">
              <span>
                {progress.downloadedTiles}/{progress.totalTiles} tiles
              </span>
              <span>
                {formatFileSize(progress.downloadedSize)}
              </span>
            </div>
          </div>
        )}

        {showDownload && (
          <div className="flex gap-1.5">
            {progress ? (
              <button
                onClick={() => cancelDownload(city.id)}
                disabled={progress.status !== 'downloading'}
                className="flex-1 px-2 py-1.5 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1 font-medium"
              >
                <X className="w-3 h-3" />
                Cancel
              </button>
            ) : hasOfflineMap ? (
              <div className="flex-1 px-2 py-1.5 text-xs bg-green-100 text-green-700 rounded flex items-center justify-center gap-1 font-medium">
                <CheckCircle className="w-3 h-3" />
                Ready
              </div>
            ) : (
              <button
                onClick={() => downloadCity(city)}
                className="flex-1 px-2 py-1.5 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 flex items-center justify-center gap-1 font-medium group-hover:bg-blue-600"
              >
                <Download className="w-3 h-3" />
                Get
              </button>
            )}
          </div>
        )}
      </div>
    );
  };

  // Offline Map Card Component
  const OfflineMapCard: React.FC<{ map: OfflineMapData }> = ({ map }) => (
    <div className="border rounded p-3 space-y-2 bg-white shadow-sm">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-gray-900 text-sm truncate">{map.cityName}</h3>
          <p className="text-xs text-gray-600">
            Downloaded {new Date(map.downloadDate).toLocaleDateString()}
          </p>
          <div className="flex gap-2 text-xs text-gray-500 mt-1">
            <span>{(map.tileCount / 1000).toFixed(0)}K tiles</span>
            <span>{formatFileSize(map.sizeBytes)}</span>
          </div>
        </div>
        <WifiOff className="w-4 h-4 text-green-500 flex-shrink-0" />
      </div>

      <div className="flex gap-1">
        <button
          onClick={() => deleteOfflineMap(map.cityId)}
          className="px-2 py-1.5 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200 flex items-center gap-1"
        >
          <Trash2 className="w-3 h-3" />
          Delete
        </button>
      </div>
    </div>
  );

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
      onClick={handleClose}
    >
      <div 
        className="bg-white rounded-lg w-[90vw] max-w-4xl h-[85vh] max-h-[600px] flex flex-col overflow-hidden shadow-2xl mx-4 my-8"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with visible close buttons */}
        <div className="flex items-center justify-between p-4 border-b bg-white flex-shrink-0">
          <div className="flex items-center gap-3">
            <button 
              onClick={handleClose} 
              className="flex items-center justify-center w-10 h-10 bg-gray-100 hover:bg-gray-200 rounded-full transition-colors border-2 border-gray-300"
              title="Go Back"
            >
              <ArrowLeft className="w-5 h-5 text-gray-700" />
            </button>
            <div className="flex items-center gap-2">
              <WifiOff className="w-6 h-6 text-blue-500" />
              <h2 className="text-lg font-semibold text-gray-900">Offline Maps</h2>
            </div>
          </div>
          <button 
            onClick={handleClose} 
            className="flex items-center justify-center w-10 h-10 bg-red-100 hover:bg-red-200 rounded-full transition-colors border-2 border-red-300"
            title="Close"
          >
            <X className="w-5 h-5 text-red-600" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b bg-white flex-shrink-0">
          <button
            onClick={() => setCurrentTab('discover')}
            className={`px-6 py-3 font-medium border-b-2 transition-colors ${
              currentTab === 'discover'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-800'
            }`}
          >
            <div className="flex items-center gap-2">
              <Search className="w-4 h-4" />
              Discover
            </div>
          </button>
          <button
            onClick={() => setCurrentTab('downloads')}
            className={`px-6 py-3 font-medium border-b-2 transition-colors ${
              currentTab === 'downloads'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-800'
            }`}
          >
            <div className="flex items-center gap-2">
              <Download className="w-4 h-4" />
              Downloads
              {downloadProgress.size > 0 && (
                <span className="bg-blue-500 text-white text-xs px-2 py-1 rounded-full min-w-[18px] text-center">
                  {downloadProgress.size}
                </span>
              )}
            </div>
          </button>
          <button
            onClick={() => setCurrentTab('manage')}
            className={`px-6 py-3 font-medium border-b-2 transition-colors ${
              currentTab === 'manage'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-800'
            }`}
          >
            <div className="flex items-center gap-2">
              <HardDrive className="w-4 h-4" />
              Manage
              {offlineMaps.length > 0 && (
                <span className="bg-green-500 text-white text-xs px-2 py-1 rounded-full min-w-[18px] text-center">
                  {offlineMaps.length}
                </span>
              )}
            </div>
          </button>
        </div>

        {/* Scrollable Content */}
        <div 
          className="flex-1 overflow-y-auto overscroll-contain p-4 min-h-0 bg-gray-50"
          style={{
            scrollbarWidth: 'thin',
            scrollbarColor: '#9ca3af #f3f4f6',
            maxHeight: 'calc(85vh - 200px)',
            minHeight: '400px'
          }}
        >
          {currentTab === 'discover' && (
            <div className="space-y-4">
              {/* Location Detection */}
              <div className="bg-blue-50 rounded-lg p-4">
                <h3 className="font-medium mb-2 flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-blue-500" />
                  Your Location
                </h3>
                
                {userCity ? (
                  <div className="mb-4">
                    <CityCard city={userCity} />
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <p className="text-gray-600 mb-4">
                      Detect your current location to download maps for your area
                    </p>
                    <button
                      onClick={detectUserLocation}
                      disabled={isDetectingLocation}
                      className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 flex items-center gap-2 mx-auto"
                    >
                      {isDetectingLocation ? (
                        <Loader className="w-4 h-4 animate-spin" />
                      ) : (
                        <MapPin className="w-4 h-4" />
                      )}
                      {isDetectingLocation ? 'Detecting...' : 'Detect My Location'}
                    </button>
                  </div>
                )}
              </div>

              {/* City Search */}
              <div>
                <h3 className="font-medium mb-2 flex items-center gap-2">
                  <Search className="w-4 h-4 text-gray-700" />
                  Search Cities
                </h3>
                
                <div className="flex gap-2 mb-3">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && searchCities()}
                    placeholder="Search for any city worldwide..."
                    className="flex-1 px-3 py-2 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    onClick={searchCities}
                    disabled={isSearching || !searchQuery.trim()}
                    className="px-3 py-2 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 flex items-center gap-1"
                  >
                    {isSearching ? (
                      <Loader className="w-4 h-4 animate-spin" />
                    ) : (
                      <Search className="w-4 h-4" />
                    )}
                    Search
                  </button>
                </div>

                {searchResults.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs text-gray-600 font-medium">Search Results ({searchResults.length}):</p>
                    <div className="relative">
                      <div 
                        className="grid gap-2 md:grid-cols-2 h-60 overflow-y-auto scrollbar-thin scrollbar-thumb-green-300 scrollbar-track-gray-100 hover:scrollbar-thumb-green-400 transition-all duration-200 rounded-md border border-green-200 p-2 bg-green-50/30"
                        style={{
                          scrollBehavior: 'smooth',
                          scrollbarWidth: 'thin',
                          scrollbarColor: '#86efac #f3f4f6',
                          overscrollBehavior: 'contain'
                        }}
                      >
                        {searchResults.map((city, index) => (
                          <div
                            key={city.id}
                            className="animate-fade-in"
                            style={{ animationDelay: `${index * 30}ms` }}
                          >
                            <CityCard city={city} />
                          </div>
                        ))}
                      </div>
                      
                      {/* Search result indicators */}
                      {searchResults.length > 3 && (
                        <div className="mt-1 text-center">
                          <div className="inline-flex items-center gap-1 text-xs text-green-600 bg-green-100 px-2 py-1 rounded-full">
                            <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-bounce"></div>
                            <span>Found {searchResults.length} cities</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Popular Cities */}
              <div>
                <h3 className="font-medium mb-2 flex items-center gap-2">
                  <Globe className="w-4 h-4 text-gray-700" />
                  Popular Cities ({popularCities.length})
                </h3>
                
                <div className="relative">
                  <div 
                    className="grid gap-2 md:grid-cols-2 h-80 overflow-y-auto scrollbar-thin scrollbar-thumb-blue-300 scrollbar-track-gray-100 hover:scrollbar-thumb-blue-400 transition-all duration-200 rounded-md border border-gray-200 p-3"
                    style={{
                      scrollBehavior: 'smooth',
                      scrollbarWidth: 'thin',
                      scrollbarColor: '#93c5fd #f3f4f6',
                      overscrollBehavior: 'contain'
                    }}
                  >
                    {popularCities.map((city, index) => (
                      <div
                        key={city.id}
                        className="animate-fade-in"
                        style={{ animationDelay: `${index * 50}ms` }}
                      >
                        <CityCard city={city} />
                      </div>
                    ))}
                  </div>
                  
                  {/* Scrolling indicators */}
                  {popularCities.length > 4 && (
                    <div className="mt-2 flex items-center justify-center gap-2 text-xs text-gray-500">
                      <div className="flex items-center gap-1">
                        <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
                        <span>Scroll for more cities</span>
                        <div className="flex gap-0.5">
                          <div className="w-1 h-1 bg-gray-300 rounded-full"></div>
                          <div className="w-1 h-1 bg-blue-400 rounded-full"></div>
                          <div className="w-1 h-1 bg-gray-300 rounded-full"></div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {currentTab === 'downloads' && (
            <div className="space-y-3 pb-4">
              <div className="text-center">
                <h3 className="font-medium mb-1 text-sm">Active Downloads</h3>
                <p className="text-gray-600 text-xs">
                  Monitor your map download progress
                </p>
              </div>

              {downloadProgress.size > 0 ? (
                <div className="grid gap-2">
                  {Array.from(downloadProgress.entries()).map(([cityId, progress]) => {
                    const city = [...popularCities, ...searchResults, userCity].find(c => c?.id === cityId);
                    return city ? (
                      <CityCard key={cityId} city={city} showDownload={false} />
                    ) : (
                      <div key={cityId} className="border rounded p-3 bg-white shadow-sm">
                        <div className="font-medium text-sm">{progress.cityName}</div>
                        <div className="text-xs text-gray-600">Downloading...</div>
                        <div className="mt-1 w-full bg-gray-200 rounded-full h-1.5">
                          <div 
                            className="bg-blue-500 h-1.5 rounded-full transition-all"
                            style={{ width: `${progress.progress}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Download className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-600">No active downloads</p>
                  <p className="text-xs text-gray-500">
                    Go to Discover tab to download maps
                  </p>
                </div>
              )}
            </div>
          )}

          {currentTab === 'manage' && (
            <div className="space-y-3 pb-4">
              <div className="text-center">
                <h3 className="font-medium mb-1 text-sm">Downloaded Maps</h3>
                <p className="text-gray-600 text-xs">
                  Manage your offline map storage
                </p>
              </div>

              {offlineMaps.length > 0 ? (
                <>
                  <div className="bg-green-50 rounded p-3 mb-3">
                    <div className="flex items-center gap-2 mb-2">
                      <HardDrive className="w-4 h-4 text-green-600" />
                      <span className="font-medium text-green-800 text-sm">Storage Summary</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <span className="text-green-700">Cities:</span>
                        <span className="font-semibold ml-1">{offlineMaps.length}</span>
                      </div>
                      <div>
                        <span className="text-green-700">Total Size:</span>
                        <span className="font-semibold ml-1">
                          {formatFileSize(offlineMaps.reduce((sum, map) => sum + map.sizeBytes, 0))}
                        </span>
                      </div>
                      <div>
                        <span className="text-green-700">Total Tiles:</span>
                        <span className="font-semibold ml-1">
                          {offlineMaps.reduce((sum, map) => sum + map.tileCount, 0).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-2">
                    {offlineMaps.map((map) => (
                      <OfflineMapCard key={map.id} map={map} />
                    ))}
                  </div>
                </>
              ) : (
                <div className="text-center py-8">
                  <WifiOff className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-600">No offline maps downloaded</p>
                  <p className="text-xs text-gray-500">
                    Download maps from the Discover tab
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}