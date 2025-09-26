import React, { useState } from 'react';
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

interface OfflineMap {
  id: string;
  name: string;
  region: string;
  size: string;
  downloadDate: string;
  lastUpdated: string;
  quality: 'basic' | 'detailed';
  status: 'downloaded' | 'downloading' | 'updating' | 'error';
  progress?: number;
  coverage: string;
}

interface OfflineMapsPanelProps {
  onBack: () => void;
}

export function OfflineMapsPanel({ onBack }: OfflineMapsPanelProps) {
  const [activeTab, setActiveTab] = useState('downloaded');
  const [autoUpdate, setAutoUpdate] = useState(true);
  const [wifiOnly, setWifiOnly] = useState(true);
  const [storageUsed] = useState(2.4); // GB
  const [storageLimit] = useState(5.0); // GB

  // Mock offline maps data
  const [offlineMaps, setOfflineMaps] = useState<OfflineMap[]>([
    {
      id: '1',
      name: 'San Francisco Bay Area',
      region: 'California, USA',
      size: '486 MB',
      downloadDate: '2024-01-15',
      lastUpdated: '2024-01-20',
      quality: 'detailed',
      status: 'downloaded',
      coverage: '50 mi radius'
    },
    {
      id: '2',
      name: 'New York City',
      region: 'New York, USA',
      size: '652 MB',
      downloadDate: '2024-01-10',
      lastUpdated: '2024-01-18',
      quality: 'detailed',
      status: 'downloaded',
      coverage: 'All 5 boroughs'
    },
    {
      id: '3',
      name: 'Los Angeles Metro',
      region: 'California, USA',
      size: '324 MB',
      downloadDate: '2024-01-12',
      lastUpdated: '2024-01-19',
      quality: 'basic',
      status: 'updating',
      progress: 65,
      coverage: '30 mi radius'
    }
  ]);

  // Mock available regions
  const availableRegions = [
    { id: '4', name: 'Chicago', region: 'Illinois, USA', size: '445 MB', coverage: 'Metro area' },
    { id: '5', name: 'Seattle', region: 'Washington, USA', size: '298 MB', coverage: '25 mi radius' },
    { id: '6', name: 'Boston', region: 'Massachusetts, USA', size: '267 MB', coverage: 'Greater Boston' },
    { id: '7', name: 'Austin', region: 'Texas, USA', size: '189 MB', coverage: 'City limits' },
  ];

  const handleDownload = (regionId: string) => {
    const region = availableRegions.find(r => r.id === regionId);
    if (region) {
      const newMap: OfflineMap = {
        id: regionId,
        name: region.name,
        region: region.region,
        size: region.size,
        downloadDate: new Date().toISOString().split('T')[0],
        lastUpdated: new Date().toISOString().split('T')[0],
        quality: 'detailed',
        status: 'downloading',
        progress: 0,
        coverage: region.coverage
      };
      setOfflineMaps(prev => [...prev, newMap]);
      
      // Simulate download progress
      let progress = 0;
      const interval = setInterval(() => {
        progress += Math.random() * 15;
        if (progress >= 100) {
          progress = 100;
          clearInterval(interval);
          setOfflineMaps(prev => prev.map(map => 
            map.id === regionId 
              ? { ...map, status: 'downloaded', progress: undefined }
              : map
          ));
        } else {
          setOfflineMaps(prev => prev.map(map => 
            map.id === regionId 
              ? { ...map, progress }
              : map
          ));
        }
      }, 500);
    }
  };

  const handleDelete = (mapId: string) => {
    setOfflineMaps(prev => prev.filter(map => map.id !== mapId));
  };

  const handleUpdate = (mapId: string) => {
    setOfflineMaps(prev => prev.map(map => 
      map.id === mapId 
        ? { ...map, status: 'updating', progress: 0 }
        : map
    ));
    
    // Simulate update progress
    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.random() * 12;
      if (progress >= 100) {
        progress = 100;
        clearInterval(interval);
        setOfflineMaps(prev => prev.map(map => 
          map.id === mapId 
            ? { 
                ...map, 
                status: 'downloaded', 
                progress: undefined,
                lastUpdated: new Date().toISOString().split('T')[0]
              }
            : map
        ));
      } else {
        setOfflineMaps(prev => prev.map(map => 
          map.id === mapId 
            ? { ...map, progress }
            : map
        ));
      }
    }, 400);
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
              <span className="text-sm text-gray-600">{storageUsed} GB of {storageLimit} GB</span>
            </div>
            <Progress value={(storageUsed / storageLimit) * 100} className="h-2" />
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
            <TabsTrigger value="downloaded">Downloaded ({offlineMaps.length})</TabsTrigger>
            <TabsTrigger value="available">Available</TabsTrigger>
          </TabsList>
        </div>

        <div className="flex-1 overflow-hidden min-h-0 mt-4">
          {/* Downloaded Maps Tab */}
          <TabsContent value="downloaded" className="h-full px-4 scroll-y hide-scrollbar scroll-smooth mt-0">
            <div className="space-y-3">
              {offlineMaps.map((map) => (
                <Card key={map.id} className="p-4">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                      <MapPin className="w-6 h-6 text-blue-600" />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h3 className="font-medium text-gray-900">{map.name}</h3>
                          <p className="text-sm text-gray-600">{map.region}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          {getStatusIcon(map.status)}
                          <Badge 
                            variant="outline" 
                            className={
                              map.quality === 'detailed' 
                                ? 'border-green-200 text-green-700' 
                                : 'border-gray-200 text-gray-700'
                            }
                          >
                            {map.quality}
                          </Badge>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-4 text-sm text-gray-600 mb-2">
                        <span>{map.size}</span>
                        <span>{map.coverage}</span>
                        <span>Updated {map.lastUpdated}</span>
                      </div>

                      {map.status === 'downloading' || map.status === 'updating' ? (
                        <div className="mb-3">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm text-gray-600">{getStatusText(map.status)}</span>
                            <span className="text-sm text-gray-600">{Math.round(map.progress || 0)}%</span>
                          </div>
                          <Progress value={map.progress || 0} className="h-2" />
                        </div>
                      ) : null}

                      <div className="flex items-center gap-2">
                        {map.status === 'downloaded' && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleUpdate(map.id)}
                            >
                              <RefreshCw className="w-4 h-4 mr-2" />
                              Update
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDelete(map.id)}
                              className="text-red-600 hover:text-red-700"
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Delete
                            </Button>
                          </>
                        )}
                        {map.status === 'error' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleUpdate(map.id)}
                          >
                            <RefreshCw className="w-4 h-4 mr-2" />
                            Retry
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </Card>
              ))}

              {offlineMaps.length === 0 && (
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
                const isDownloaded = offlineMaps.some(map => map.id === region.id);
                
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
                        ) : (
                          <Button
                            size="sm"
                            onClick={() => handleDownload(region.id)}
                            disabled={!wifiOnly && navigator.connection?.effectiveType !== 'wifi'}
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