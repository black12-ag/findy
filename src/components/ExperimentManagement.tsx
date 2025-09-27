import React, { useState, useEffect } from 'react';
import { 
  TestTube, 
  ToggleLeft, 
  ToggleRight, 
  Settings, 
  BarChart3, 
  Users, 
  Target, 
  Play, 
  Pause, 
  StopCircle, 
  TrendingUp, 
  AlertTriangle,
  CheckCircle,
  XCircle,
  Eye,
  EyeOff,
  Save,
  Plus,
  Trash2
} from 'lucide-react';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { useFeatureFlags } from '../services/featureFlagsService';
import { analyticsService } from '../services/analyticsService';
import type { 
  FeatureFlag, 
  RemoteConfig, 
  Experiment, 
  PerformanceBudget,
  WebVitalMetric
} from '../services/featureFlagsService';

interface ExperimentResults {
  experimentId: string;
  variants: {
    [variantName: string]: {
      participants: number;
      conversions: number;
      conversionRate: number;
      confidence: number;
    };
  };
  winner?: string;
  isSignificant: boolean;
}

const ExperimentManagement: React.FC = () => {
  const { flags, remoteConfig, isFeatureEnabled, getRemoteConfig } = useFeatureFlags();
  const [activeTab, setActiveTab] = useState<'flags' | 'config' | 'experiments' | 'performance'>('flags');
  const [selectedFlag, setSelectedFlag] = useState<FeatureFlag | null>(null);
  const [selectedConfig, setSelectedConfig] = useState<RemoteConfig | null>(null);
  const [experimentResults, setExperimentResults] = useState<ExperimentResults[]>([]);
  const [performanceSummary, setPerformanceSummary] = useState<any>(null);
  const [isEditMode, setIsEditMode] = useState(false);

  useEffect(() => {
    // Load performance summary
    const summary = analyticsService.getPerformanceSummary();
    setPerformanceSummary(summary);

    // Simulate experiment results (in real app, this would come from analytics)
    setExperimentResults([
      {
        experimentId: 'new_ui_design',
        variants: {
          control: {
            participants: 1250,
            conversions: 87,
            conversionRate: 6.96,
            confidence: 95
          },
          treatment: {
            participants: 1233,
            conversions: 156,
            conversionRate: 12.65,
            confidence: 99
          }
        },
        winner: 'treatment',
        isSignificant: true
      }
    ]);
  }, []);

  const handleFlagToggle = (flagKey: string) => {
    // In a real app, this would call the API to update the flag
    // Toggle flag: flagKey
  };

  const handleConfigUpdate = (configKey: string, value: any) => {
    // In a real app, this would call the API to update the config
    // Update config: configKey, value
  };

  const renderFlags = () => (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Feature Flags</h3>
        <Button size="sm">
          <Plus className="w-4 h-4 mr-2" />
          Add Flag
        </Button>
      </div>
      
      <div className="grid gap-4">
        {flags.map((flag) => (
          <Card key={flag.key} className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center space-x-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleFlagToggle(flag.key)}
                  >
                    {flag.enabled ? (
                      <ToggleRight className="w-5 h-5 text-green-600" />
                    ) : (
                      <ToggleLeft className="w-5 h-5 text-gray-400" />
                    )}
                  </Button>
                  <div>
                    <h4 className="font-medium">{flag.name}</h4>
                    <p className="text-sm text-gray-600">{flag.description}</p>
                  </div>
                </div>
                
                <div className="mt-2 flex items-center space-x-4 text-sm">
                  <span className="flex items-center space-x-1">
                    <Target className="w-4 h-4" />
                    <span>{flag.rolloutPercentage}% rollout</span>
                  </span>
                  
                  {flag.variants && (
                    <Badge variant="secondary">
                      A/B Test ({Object.keys(flag.variants).length} variants)
                    </Badge>
                  )}
                  
                  <Badge variant={flag.isActive ? 'default' : 'secondary'}>
                    {flag.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
              </div>
              
              <div className="flex items-center space-x-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedFlag(flag)}
                >
                  <Settings className="w-4 h-4" />
                </Button>
                
                {flag.variants && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setActiveTab('experiments');
                      // Show experiment details
                    }}
                  >
                    <BarChart3 className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );

  const renderRemoteConfig = () => (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Remote Configuration</h3>
        <Button size="sm">
          <Plus className="w-4 h-4 mr-2" />
          Add Config
        </Button>
      </div>
      
      <div className="grid gap-4">
        {remoteConfig.map((config) => (
          <Card key={config.key} className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <h4 className="font-medium">{config.key}</h4>
                <p className="text-sm text-gray-600 mb-2">{config.description}</p>
                
                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-medium">Value:</span>
                    <Badge variant="outline">
                      {config.type === 'boolean' 
                        ? (config.value ? 'true' : 'false')
                        : String(config.value)
                      }
                    </Badge>
                  </div>
                  
                  <Badge variant="secondary">{config.type}</Badge>
                  
                  {config.ttl && (
                    <span className="text-xs text-gray-500">
                      TTL: {config.ttl}s
                    </span>
                  )}
                </div>
              </div>
              
              <div className="flex items-center space-x-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedConfig(config)}
                >
                  <Settings className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );

  const renderExperiments = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">A/B Test Results</h3>
        <Button size="sm">
          <TestTube className="w-4 h-4 mr-2" />
          New Experiment
        </Button>
      </div>
      
      {experimentResults.map((result) => (
        <Card key={result.experimentId} className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h4 className="font-semibold text-lg capitalize">
                {result.experimentId.replace(/_/g, ' ')}
              </h4>
              <p className="text-sm text-gray-600">
                Total participants: {Object.values(result.variants).reduce((sum, v) => sum + v.participants, 0)}
              </p>
            </div>
            
            <div className="flex items-center space-x-2">
              {result.isSignificant && (
                <Badge className="bg-green-100 text-green-800">
                  <CheckCircle className="w-3 h-3 mr-1" />
                  Significant
                </Badge>
              )}
              {result.winner && (
                <Badge variant="default">
                  Winner: {result.winner}
                </Badge>
              )}
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(result.variants).map(([variantName, data]) => (
              <Card 
                key={variantName} 
                className={`p-4 ${result.winner === variantName ? 'ring-2 ring-green-500 bg-green-50' : ''}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <h5 className="font-medium capitalize">{variantName}</h5>
                  {result.winner === variantName && (
                    <Badge className="bg-green-100 text-green-800 text-xs">
                      Winner
                    </Badge>
                  )}
                </div>
                
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Participants:</span>
                    <span className="font-medium">{data.participants.toLocaleString()}</span>
                  </div>
                  
                  <div className="flex justify-between">
                    <span>Conversions:</span>
                    <span className="font-medium">{data.conversions}</span>
                  </div>
                  
                  <div className="flex justify-between">
                    <span>Conversion Rate:</span>
                    <span className="font-medium text-blue-600">
                      {data.conversionRate.toFixed(2)}%
                    </span>
                  </div>
                  
                  <div className="flex justify-between">
                    <span>Confidence:</span>
                    <span className="font-medium">
                      {data.confidence}%
                    </span>
                  </div>
                </div>
                
                {/* Progress bar for conversion rate */}
                <div className="mt-3">
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full" 
                      style={{ width: `${Math.min(data.conversionRate, 20)}%` }}
                    ></div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
          
          <div className="mt-4 flex justify-end space-x-2">
            <Button variant="outline" size="sm">
              <Eye className="w-4 h-4 mr-2" />
              View Details
            </Button>
            
            <Button variant="outline" size="sm">
              <Pause className="w-4 h-4 mr-2" />
              Pause
            </Button>
            
            <Button variant="outline" size="sm">
              <StopCircle className="w-4 h-4 mr-2" />
              End Test
            </Button>
          </div>
        </Card>
      ))}
    </div>
  );

  const renderPerformanceMonitoring = () => (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold">Performance Monitoring</h3>
      
      {/* Web Vitals */}
      <Card className="p-6">
        <h4 className="font-semibold mb-4">Core Web Vitals</h4>
        
        {performanceSummary?.webVitals.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {performanceSummary.webVitals.map((vital: WebVitalMetric) => (
              <div key={vital.id} className="text-center">
                <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium mb-2 ${
                  vital.rating === 'good' 
                    ? 'bg-green-100 text-green-800'
                    : vital.rating === 'needs-improvement'
                    ? 'bg-yellow-100 text-yellow-800'
                    : 'bg-red-100 text-red-800'
                }`}>
                  {vital.name}
                </div>
                <div className="text-lg font-semibold">
                  {vital.name === 'CLS' 
                    ? vital.value.toFixed(3)
                    : Math.round(vital.value) + 'ms'
                  }
                </div>
                <div className="text-xs text-gray-500 capitalize">
                  {vital.rating.replace('-', ' ')}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <TrendingUp className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>Web Vitals data will appear as users interact with the app</p>
          </div>
        )}
      </Card>
      
      {/* Performance Budgets */}
      <Card className="p-6">
        <div className="flex justify-between items-center mb-4">
          <h4 className="font-semibold">Performance Budgets</h4>
          <div className="flex items-center space-x-2">
            <Badge variant={performanceSummary?.budgetViolations > 0 ? 'destructive' : 'default'}>
              {performanceSummary?.budgetViolations || 0} violations
            </Badge>
          </div>
        </div>
        
        <div className="space-y-3">
          {analyticsService.getPerformanceBudgets().map((budget: PerformanceBudget) => (
            <div key={budget.metric} className="flex items-center justify-between p-3 border rounded">
              <div className="flex-1">
                <div className="flex items-center space-x-2">
                  <span className="font-medium">{budget.metric}</span>
                  <Badge variant="outline" className="text-xs">
                    {budget.unit}
                  </Badge>
                </div>
                <p className="text-sm text-gray-600">{budget.description}</p>
              </div>
              
              <div className="text-right">
                <div className="font-mono text-sm">
                  Budget: {budget.budget}{budget.unit}
                </div>
                <Badge 
                  variant={budget.severity === 'error' ? 'destructive' : 
                          budget.severity === 'warning' ? 'secondary' : 'outline'}
                  className="text-xs"
                >
                  {budget.severity}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      </Card>
      
      {/* Memory Usage */}
      {performanceSummary?.memoryUsage && (
        <Card className="p-6">
          <h4 className="font-semibold mb-4">Memory Usage</h4>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {(performanceSummary.memoryUsage.used / 1024 / 1024).toFixed(1)}MB
              </div>
              <div className="text-sm text-gray-600">Used</div>
            </div>
            
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {(performanceSummary.memoryUsage.total / 1024 / 1024).toFixed(1)}MB
              </div>
              <div className="text-sm text-gray-600">Total</div>
            </div>
            
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">
                {(performanceSummary.memoryUsage.limit / 1024 / 1024).toFixed(1)}MB
              </div>
              <div className="text-sm text-gray-600">Limit</div>
            </div>
            
            <div className="text-center">
              <div className={`text-2xl font-bold ${
                performanceSummary.memoryUsage.percentage > 80 
                  ? 'text-red-600' 
                  : performanceSummary.memoryUsage.percentage > 60
                  ? 'text-yellow-600'
                  : 'text-green-600'
              }`}>
                {performanceSummary.memoryUsage.percentage.toFixed(1)}%
              </div>
              <div className="text-sm text-gray-600">Usage</div>
            </div>
          </div>
          
          <div className="mt-4">
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div 
                className={`h-3 rounded-full ${
                  performanceSummary.memoryUsage.percentage > 80 
                    ? 'bg-red-500' 
                    : performanceSummary.memoryUsage.percentage > 60
                    ? 'bg-yellow-500'
                    : 'bg-green-500'
                }`}
                style={{ width: `${Math.min(performanceSummary.memoryUsage.percentage, 100)}%` }}
              ></div>
            </div>
          </div>
        </Card>
      )}
      
      {/* Resource Timings */}
      <Card className="p-6">
        <h4 className="font-semibold mb-4">Resource Performance</h4>
        
        {performanceSummary?.resourceTimings.length > 0 ? (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {performanceSummary.resourceTimings
              .sort((a: any, b: any) => b.duration - a.duration)
              .slice(0, 10)
              .map((resource: any, index: number) => (
              <div key={index} className="flex items-center justify-between p-2 border rounded text-sm">
                <div className="flex-1 min-w-0">
                  <div className="font-mono text-xs truncate">
                    {resource.name.split('/').pop()}
                  </div>
                  <div className="flex items-center space-x-2 text-xs text-gray-500">
                    <Badge variant="outline" className="text-xs">
                      {resource.type}
                    </Badge>
                    {resource.transferSize > 0 && (
                      <span>{(resource.transferSize / 1024).toFixed(1)}KB</span>
                    )}
                  </div>
                </div>
                
                <div className="text-right">
                  <div className={`font-medium ${
                    resource.duration > 2000 
                      ? 'text-red-600' 
                      : resource.duration > 1000
                      ? 'text-yellow-600'
                      : 'text-green-600'
                  }`}>
                    {Math.round(resource.duration)}ms
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <BarChart3 className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>Resource timing data will appear as resources load</p>
          </div>
        )}
      </Card>
    </div>
  );

  const tabs = [
    { id: 'flags', label: 'Feature Flags', icon: ToggleLeft, count: flags.length },
    { id: 'config', label: 'Remote Config', icon: Settings, count: remoteConfig.length },
    { id: 'experiments', label: 'Experiments', icon: TestTube, count: experimentResults.length },
    { id: 'performance', label: 'Performance', icon: TrendingUp, count: performanceSummary?.budgetViolations || 0 }
  ];

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Experiment Management</h1>
        <p className="text-gray-600 mt-1">
          Manage feature flags, remote configuration, A/B tests, and performance monitoring
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center space-x-2 py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              <span>{tab.label}</span>
              {tab.count > 0 && (
                <Badge variant="secondary" className="ml-1">
                  {tab.count}
                </Badge>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === 'flags' && renderFlags()}
        {activeTab === 'config' && renderRemoteConfig()}
        {activeTab === 'experiments' && renderExperiments()}
        {activeTab === 'performance' && renderPerformanceMonitoring()}
      </div>
    </div>
  );
};

export default ExperimentManagement;