import React, { useState } from 'react';
import { Settings, Bug, TestTube, Smartphone, AlertTriangle, Zap, Database, Wifi } from 'lucide-react';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Badge } from './ui/badge';
import { Switch } from './ui/switch';
import CrashReporting from './CrashReporting';
import DeviceIntegrationTest from './DeviceIntegrationTest';
import ErrorTestComponent from './ErrorTestComponent';
import PushNotificationSettings from './PushNotificationSettings';
import { logger } from '../utils/logger';
import { toast } from 'sonner';
import ExperimentManagement from './ExperimentManagement';
import { Agent2ServiceIntegrationTest } from './Agent2ServiceIntegrationTest';
import { RoutePanel } from './RoutePanel';

interface DeveloperPanelProps {
  onBack: () => void;
}

export const DeveloperPanel: React.FC<DeveloperPanelProps> = ({ onBack }) => {
  const [isDeveloperMode, setIsDeveloperMode] = useState(
    localStorage.getItem('developer_mode') === 'true'
  );
  const [debugLevel, setDebugLevel] = useState(
    localStorage.getItem('debug_level') || 'info'
  );

  const toggleDeveloperMode = (enabled: boolean) => {
    setIsDeveloperMode(enabled);
    localStorage.setItem('developer_mode', enabled.toString());
    if (enabled) {
      logger.info('Developer mode enabled');
      toast.success('Developer mode enabled');
    } else {
      logger.info('Developer mode disabled');
      toast.info('Developer mode disabled');
    }
  };

  const setDebugLevelHandler = (level: string) => {
    setDebugLevel(level);
    localStorage.setItem('debug_level', level);
    logger.info(`Debug level set to: ${level}`);
    toast.success(`Debug level changed to ${level}`);
  };

  const clearAllData = () => {
    if (confirm('Are you sure you want to clear all app data? This action cannot be undone.')) {
      localStorage.clear();
      sessionStorage.clear();
      if ('caches' in window) {
        caches.keys().then(names => {
          names.forEach(name => caches.delete(name));
        });
      }
      toast.success('All data cleared. The page will now reload');
      logger.info('All app data cleared by developer');
      window.location.reload();
    }
  };

  const exportLogs = () => {
    const logs = {
      crashReports: JSON.parse(localStorage.getItem('crashReports') || '[]'),
      crashFeedback: JSON.parse(localStorage.getItem('crashFeedback') || '[]'),
      debugLogs: JSON.parse(localStorage.getItem('debug_logs') || '[]'),
      userSettings: JSON.parse(localStorage.getItem('user_settings') || '{}'),
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href
    };

    const blob = new Blob([JSON.stringify(logs, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pathfinder-logs-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const triggerTestError = () => {
    throw new Error('Test error triggered from Developer Panel');
  };

  return (
    <div className="h-full bg-white flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b bg-gray-50">
        <div className="flex items-center space-x-3">
          <Button variant="ghost" size="sm" onClick={onBack}>
            ← Back
          </Button>
          <div className="flex items-center space-x-2">
            <Settings className="w-5 h-5 text-gray-600" />
            <h1 className="text-lg font-semibold">Developer Panel</h1>
            {isDeveloperMode && (
              <Badge variant="secondary" className="bg-green-100 text-green-800">
                DEV MODE
              </Badge>
            )}
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <span className="text-sm text-gray-600">Developer Mode</span>
          <Switch
            checked={isDeveloperMode}
            onCheckedChange={toggleDeveloperMode}
          />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {!isDeveloperMode ? (
          <Card className="p-6 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Settings className="w-8 h-8 text-gray-400" />
            </div>
            <h2 className="text-lg font-semibold mb-2">Developer Mode Disabled</h2>
            <p className="text-gray-600 mb-4">
              Enable developer mode to access debugging tools and test features.
            </p>
            <Button onClick={() => toggleDeveloperMode(true)}>
              Enable Developer Mode
            </Button>
          </Card>
        ) : (
          <Tabs defaultValue="crash-reports" className="w-full">
<TabsList className="grid w-full grid-cols-8">
              <TabsTrigger value="crash-reports" className="flex items-center gap-1">
                <Bug className="w-4 h-4" />
                Crashes
              </TabsTrigger>
              <TabsTrigger value="device-tests" className="flex items-center gap-1">
                <Smartphone className="w-4 h-4" />
                Device
              </TabsTrigger>
              <TabsTrigger value="error-tests" className="flex items-center gap-1">
                <AlertTriangle className="w-4 h-4" />
                Errors
              </TabsTrigger>
              <TabsTrigger value="notifications" className="flex items-center gap-1">
                <Zap className="w-4 h-4" />
                Notifications
              </TabsTrigger>
              <TabsTrigger value="system" className="flex items-center gap-1">
                <Database className="w-4 h-4" />
                System
              </TabsTrigger>
              <TabsTrigger value="experiments" className="flex items-center gap-1">
                <TestTube className="w-4 h-4" />
                Experiments
              </TabsTrigger>
              <TabsTrigger value="integration-tests" className="flex items-center gap-1">
                <Wifi className="w-4 h-4" />
                Integrations
              </TabsTrigger>
              <TabsTrigger value="legacy-ui" className="flex items-center gap-1">
                <AlertTriangle className="w-4 h-4" />
                Legacy UI
              </TabsTrigger>
            </TabsList>

            <TabsContent value="crash-reports" className="mt-4">
              <CrashReporting />
            </TabsContent>

            <TabsContent value="device-tests" className="mt-4">
              <DeviceIntegrationTest />
            </TabsContent>

            <TabsContent value="error-tests" className="mt-4">
              <Card className="p-6">
                <h3 className="text-lg font-semibold mb-4">Error Testing</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                    <div>
                      <h4 className="font-medium text-yellow-800">Test Error Boundary</h4>
                      <p className="text-sm text-yellow-700">
                        Triggers an error to test the error boundary functionality
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      className="text-yellow-800 border-yellow-300 hover:bg-yellow-100"
                      onClick={triggerTestError}
                    >
                      Trigger Error
                    </Button>
                  </div>
                  <ErrorTestComponent />
                </div>
              </Card>
            </TabsContent>

            <TabsContent value="notifications" className="mt-4">
              <PushNotificationSettings />
            </TabsContent>

            <TabsContent value="system" className="mt-4">
              <div className="space-y-6">
                {/* System Info */}
                <Card className="p-6">
                  <h3 className="text-lg font-semibold mb-4">System Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <strong>User Agent:</strong>
                      <p className="break-all text-gray-600">{navigator.userAgent}</p>
                    </div>
                    <div>
                      <strong>Language:</strong>
                      <p className="text-gray-600">{navigator.language}</p>
                    </div>
                    <div>
                      <strong>Online:</strong>
                      <p className="text-gray-600">{navigator.onLine ? 'Yes' : 'No'}</p>
                    </div>
                    <div>
                      <strong>Screen Resolution:</strong>
                      <p className="text-gray-600">{screen.width}x{screen.height}</p>
                    </div>
                    <div>
                      <strong>Viewport:</strong>
                      <p className="text-gray-600">{window.innerWidth}x{window.innerHeight}</p>
                    </div>
                    <div>
                      <strong>Local Storage:</strong>
                      <p className="text-gray-600">
                        {Object.keys(localStorage).length} items
                      </p>
                    </div>
                  </div>
                </Card>

                {/* Debug Settings */}
                <Card className="p-6">
                  <h3 className="text-lg font-semibold mb-4">Debug Settings</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Debug Level
                      </label>
                      <div className="flex space-x-2">
                        {['error', 'warn', 'info', 'debug'].map(level => (
                          <Button
                            key={level}
                            variant={debugLevel === level ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setDebugLevelHandler(level)}
                          >
                            {level.toUpperCase()}
                          </Button>
                        ))}
                      </div>
                    </div>
                  </div>
                </Card>

                {/* Actions */}
                <Card className="p-6">
                  <h3 className="text-lg font-semibold mb-4">Actions</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Button onClick={exportLogs} variant="outline">
                      <Database className="w-4 h-4 mr-2" />
                      Export Logs
                    </Button>
                    <Button onClick={clearAllData} variant="outline" className="text-red-600 hover:text-red-700">
                      <AlertTriangle className="w-4 h-4 mr-2" />
                      Clear All Data
                    </Button>
                  </div>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="experiments" className="mt-4">
              <ExperimentManagement />
            </TabsContent>

            <TabsContent value="integration-tests" className="mt-4">
              <Agent2ServiceIntegrationTest />
            </TabsContent>

            <TabsContent value="legacy-ui" className="mt-4">
              <Card className="p-6">
                <h3 className="text-lg font-semibold mb-4">Legacy Route Panel</h3>
                <RoutePanel
                  from={{ id: 'from', name: 'Demo Start', address: '1 Market St, San Francisco', lat: 37.7946, lng: -122.3950 }}
                  to={{ id: 'to', name: 'Ferry Building', address: '1 Ferry Building, San Francisco', lat: 37.7955, lng: -122.3937 }}
                  transportMode="driving"
                  onBack={() => {}}
                  onStartNavigation={() => {}}
                />
              </Card>
            </TabsContent>
          </Tabs>
)}
      </div>
    </div>
  );
};
