import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { ArrowLeft, Key, Check, AlertTriangle, ExternalLink, MapPin, Route, Search } from 'lucide-react';
import { setORSApiKey, ORSGeocodingService, ORSDirectionsService, ORSPOIService } from '../services/openRouteService';
import { useLoadingState } from '../contexts/LoadingContext';
import { logger } from '../utils/logger';
import { toast } from 'sonner';

interface ORSConfigPanelProps {
  onBack: () => void;
}

export const ORSConfigPanel: React.FC<ORSConfigPanelProps> = ({ onBack }) => {
  const [apiKey, setApiKey] = useState('');
  const [savedApiKey, setSavedApiKey] = useState('');
  const [testResults, setTestResults] = useState<{
    geocoding: 'idle' | 'testing' | 'success' | 'error';
    directions: 'idle' | 'testing' | 'success' | 'error';
    pois: 'idle' | 'testing' | 'success' | 'error';
  }>({
    geocoding: 'idle',
    directions: 'idle',
    pois: 'idle'
  });
  
  const { isLoading, startLoading, stopLoading } = useLoadingState('ors-config');

  useEffect(() => {
    // Check if API key is already configured
    const existingKey = import.meta.env?.VITE_ORS_API_KEY || localStorage.getItem('ors_api_key');
    if (existingKey) {
      setSavedApiKey('••••••••••••••••' + existingKey.slice(-4));
      setORSApiKey(existingKey);
    }
  }, []);

  const handleSaveApiKey = () => {
    if (apiKey.trim()) {
      localStorage.setItem('ors_api_key', apiKey.trim());
      setORSApiKey(apiKey.trim());
      setSavedApiKey('••••••••••••••••' + apiKey.slice(-4));
      setApiKey('');
      // Reset test results
      setTestResults({
        geocoding: 'idle',
        directions: 'idle', 
        pois: 'idle'
      });
    }
  };

  const testGeocodingAPI = async () => {
    if (!savedApiKey) return;
    
    setTestResults(prev => ({ ...prev, geocoding: 'testing' }));
    startLoading();
    
    try {
      const results = await ORSGeocodingService.search('San Francisco', { limit: 1 });
      if (results && results.length > 0) {
        setTestResults(prev => ({ ...prev, geocoding: 'success' }));
      } else {
        setTestResults(prev => ({ ...prev, geocoding: 'error' }));
      }
    } catch (error) {
      logger.error('Geocoding test failed:', error);
      toast.error('Geocoding API test failed. Check your key and network.');
      setTestResults(prev => ({ ...prev, geocoding: 'error' }));
    } finally {
      stopLoading();
    }
  };

  const testDirectionsAPI = async () => {
    if (!savedApiKey) return;
    
    setTestResults(prev => ({ ...prev, directions: 'testing' }));
    startLoading();
    
    try {
      const result = await ORSDirectionsService.getDirections(
        { lat: 37.7749, lng: -122.4194 }, // San Francisco
        { lat: 37.7849, lng: -122.4094 }, // Nearby point
        'driving-car'
      );
      
      if (result && result.features && result.features.length > 0) {
        setTestResults(prev => ({ ...prev, directions: 'success' }));
      } else {
        setTestResults(prev => ({ ...prev, directions: 'error' }));
      }
    } catch (error) {
      logger.error('Directions test failed:', error);
      toast.error('Directions API test failed.');
      setTestResults(prev => ({ ...prev, directions: 'error' }));
    } finally {
      stopLoading();
    }
  };

  const testPOIsAPI = async () => {
    if (!savedApiKey) return;
    
    setTestResults(prev => ({ ...prev, pois: 'testing' }));
    startLoading();
    
    try {
      const results = await ORSPOIService.searchPOIs(
        { lat: 37.7749, lng: -122.4194 }, // San Francisco
        1000,
        'restaurants',
        5
      );
      
      if (results && results.length > 0) {
        setTestResults(prev => ({ ...prev, pois: 'success' }));
      } else {
        setTestResults(prev => ({ ...prev, pois: 'error' }));
      }
    } catch (error) {
      logger.error('POIs test failed:', error);
      toast.error('POI API test failed.');
      setTestResults(prev => ({ ...prev, pois: 'error' }));
    } finally {
      stopLoading();
    }
  };

  const testAllAPIs = async () => {
    await testGeocodingAPI();
    setTimeout(async () => {
      await testDirectionsAPI();
      setTimeout(async () => {
        await testPOIsAPI();
      }, 500);
    }, 500);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'testing':
        return <Badge className="bg-yellow-100 text-yellow-800">Testing...</Badge>;
      case 'success':
        return <Badge className="bg-green-100 text-green-800"><Check className="w-3 h-3 mr-1" />Success</Badge>;
      case 'error':
        return <Badge className="bg-red-100 text-red-800"><AlertTriangle className="w-3 h-3 mr-1" />Error</Badge>;
      default:
        return <Badge className="bg-gray-100 text-gray-800">Not Tested</Badge>;
    }
  };

  return (
    <div className="h-full bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200 p-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-2">
            <Key className="w-5 h-5 text-blue-600" />
            <h1 className="text-lg font-semibold">OpenRouteService Configuration</h1>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 p-4 space-y-6">
        {/* API Key Setup */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">API Key Setup</h2>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-gray-600 mb-4">
                To use live OpenRouteService APIs, you need to configure your API key. 
                Get one for free from{' '}
                <a 
                  href="https://openrouteservice.org" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline inline-flex items-center gap-1"
                >
                  openrouteservice.org
                  <ExternalLink className="w-3 h-3" />
                </a>
              </p>
              
              {savedApiKey ? (
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center gap-2 text-green-800">
                    <Check className="w-4 h-4" />
                    <span className="font-medium">API Key Configured</span>
                  </div>
                  <p className="text-sm text-green-600 mt-1">
                    Current key: {savedApiKey}
                  </p>
                </div>
              ) : (
                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <div className="flex items-center gap-2 text-yellow-800">
                    <AlertTriangle className="w-4 h-4" />
                    <span className="font-medium">No API Key Configured</span>
                  </div>
                  <p className="text-sm text-yellow-600 mt-1">
                    The app will use mock data until you configure an API key.
                  </p>
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <Input
                type="password"
                placeholder="Enter your OpenRouteService API key"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="flex-1"
              />
              <Button 
                onClick={handleSaveApiKey}
                disabled={!apiKey.trim()}
              >
                Save Key
              </Button>
            </div>
          </div>
        </Card>

        {/* API Testing */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">API Testing</h2>
            <Button 
              onClick={testAllAPIs}
              disabled={!savedApiKey || isLoading}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              Test All APIs
            </Button>
          </div>

          <div className="space-y-4">
            {/* Geocoding Test */}
            <div className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
              <div className="flex items-center gap-3">
                <MapPin className="w-5 h-5 text-gray-600" />
                <div>
                  <h3 className="font-medium">Geocoding API</h3>
                  <p className="text-sm text-gray-600">Search for places and addresses</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {getStatusBadge(testResults.geocoding)}
                <Button 
                  size="sm"
                  variant="outline"
                  onClick={testGeocodingAPI}
                  disabled={!savedApiKey || testResults.geocoding === 'testing'}
                >
                  Test
                </Button>
              </div>
            </div>

            {/* Directions Test */}
            <div className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
              <div className="flex items-center gap-3">
                <Route className="w-5 h-5 text-gray-600" />
                <div>
                  <h3 className="font-medium">Directions API</h3>
                  <p className="text-sm text-gray-600">Calculate routes and navigation</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {getStatusBadge(testResults.directions)}
                <Button 
                  size="sm"
                  variant="outline"
                  onClick={testDirectionsAPI}
                  disabled={!savedApiKey || testResults.directions === 'testing'}
                >
                  Test
                </Button>
              </div>
            </div>

            {/* POIs Test */}
            <div className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
              <div className="flex items-center gap-3">
                <Search className="w-5 h-5 text-gray-600" />
                <div>
                  <h3 className="font-medium">Points of Interest API</h3>
                  <p className="text-sm text-gray-600">Find nearby restaurants, shops, etc.</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {getStatusBadge(testResults.pois)}
                <Button 
                  size="sm"
                  variant="outline"
                  onClick={testPOIsAPI}
                  disabled={!savedApiKey || testResults.pois === 'testing'}
                >
                  Test
                </Button>
              </div>
            </div>
          </div>
        </Card>

        {/* Features Info */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Available Features</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <h3 className="font-medium mb-2">✅ Currently Integrated</h3>
              <ul className="space-y-1 text-gray-600">
                <li>• Geocoding (search addresses)</li>
                <li>• Reverse geocoding</li>
                <li>• Turn-by-turn directions</li>
                <li>• Multiple transport modes</li>
                <li>• Points of interest search</li>
                <li>• Route optimization</li>
              </ul>
            </div>
            <div>
              <h3 className="font-medium mb-2">🚀 Benefits over Mock Data</h3>
              <ul className="space-y-1 text-gray-600">
                <li>• Real-world accurate routes</li>
                <li>• Live traffic considerations</li>
                <li>• Actual POI data from OSM</li>
                <li>• Multiple route alternatives</li>
                <li>• Precise distance/time estimates</li>
                <li>• Global coverage</li>
              </ul>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default ORSConfigPanel;