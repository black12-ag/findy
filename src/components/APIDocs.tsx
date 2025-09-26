import React, { useState } from 'react';
import { 
  ArrowLeft,
  Code,
  Key,
  Book,
  Zap,
  Shield,
  Globe,
  Copy,
  CheckCircle,
  ExternalLink,
  Play,
  Download,
  Settings
} from 'lucide-react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './ui/tabs';
import { Alert, AlertDescription } from './ui/alert';

interface APIEndpoint {
  method: string;
  path: string;
  description: string;
  category: string;
  auth: boolean;
  rate_limit: string;
}

interface APIDocsProps {
  onBack: () => void;
}

export function APIDocs({ onBack }: APIDocsProps) {
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('overview');

  const apiEndpoints: APIEndpoint[] = [
    {
      method: 'GET',
      path: '/api/v1/routes',
      description: 'Get optimal route between two points',
      category: 'Navigation',
      auth: true,
      rate_limit: '1000/hour'
    },
    {
      method: 'POST',
      path: '/api/v1/routes/calculate',
      description: 'Calculate route with custom preferences',
      category: 'Navigation',
      auth: true,
      rate_limit: '500/hour'
    },
    {
      method: 'GET',
      path: '/api/v1/traffic',
      description: 'Get real-time traffic information',
      category: 'Traffic',
      auth: true,
      rate_limit: '2000/hour'
    },
    {
      method: 'GET',
      path: '/api/v1/places/search',
      description: 'Search for places and points of interest',
      category: 'Places',
      auth: true,
      rate_limit: '1500/hour'
    },
    {
      method: 'GET',
      path: '/api/v1/geocode',
      description: 'Convert addresses to coordinates',
      category: 'Geocoding',
      auth: true,
      rate_limit: '1000/hour'
    },
    {
      method: 'GET',
      path: '/api/v1/fleet/vehicles',
      description: 'Get fleet vehicle information',
      category: 'Fleet',
      auth: true,
      rate_limit: '500/hour'
    },
    {
      method: 'POST',
      path: '/api/v1/fleet/track',
      description: 'Update vehicle location and status',
      category: 'Fleet',
      auth: true,
      rate_limit: '5000/hour'
    }
  ];

  const sampleCode = {
    javascript: `// PathFinder Pro API Example
const pathfinder = require('@pathfinderpro/api');

// Initialize client
const client = new pathfinder.Client({
  apiKey: 'your-api-key',
  baseUrl: 'https://api.pathfinderpro.com/v1'
});

// Get route
async function getRoute() {
  try {
    const route = await client.routes.calculate({
      origin: '37.7749,-122.4194',
      destination: '37.7849,-122.4094',
      mode: 'driving',
      optimize: 'time'
    });
    
    // Route data available in route object
    // route.distance, route.duration, route.steps
  } catch (error) {
    console.error('Error:', error.message);
  }
}

getRoute();`,

    python: `# PathFinder Pro API Example
import pathfinderpro

# Initialize client
client = pathfinderpro.Client(
    api_key='your-api-key',
    base_url='https://api.pathfinderpro.com/v1'
)

# Get route
def get_route():
    try:
        route = client.routes.calculate(
            origin='37.7749,-122.4194',
            destination='37.7849,-122.4094',
            mode='driving',
            optimize='time'
        )
        
        print(f'Route distance: {route.distance}')
        print(f'Estimated time: {route.duration}')
        print(f'Steps: {route.steps}')
    except pathfinderpro.APIError as e:
        print(f'Error: {e.message}')

get_route()`,

    curl: `# PathFinder Pro API Example
curl -X POST https://api.pathfinderpro.com/v1/routes/calculate \\
  -H "Authorization: Bearer your-api-key" \\
  -H "Content-Type: application/json" \\
  -d '{
    "origin": "37.7749,-122.4194",
    "destination": "37.7849,-122.4094",
    "mode": "driving",
    "optimize": "time"
  }'`
  };

  const handleCopyCode = (code: string, type: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(type);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const getMethodColor = (method: string) => {
    switch (method) {
      case 'GET': return 'bg-green-100 text-green-700';
      case 'POST': return 'bg-blue-100 text-blue-700';
      case 'PUT': return 'bg-yellow-100 text-yellow-700';
      case 'DELETE': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <div className="h-full bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 bg-gradient-to-r from-blue-600 to-purple-600 px-4 py-4">
        <div className="flex items-center gap-3 text-white mb-4">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={onBack}
            className="text-white hover:bg-white/20"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h2 className="font-semibold">API Documentation</h2>
            <p className="text-sm opacity-90">PathFinder Pro Developer Portal</p>
          </div>
        </div>

        {/* API Stats */}
        <div className="grid grid-cols-3 gap-4">
          <Card className="bg-white/10 backdrop-blur border-white/20 text-white p-3">
            <div className="flex items-center gap-2">
              <Globe className="w-5 h-5" />
              <div>
                <div className="text-lg font-bold">v1.2.0</div>
                <div className="text-xs opacity-90">API Version</div>
              </div>
            </div>
          </Card>
          <Card className="bg-white/10 backdrop-blur border-white/20 text-white p-3">
            <div className="flex items-center gap-2">
              <Zap className="w-5 h-5" />
              <div>
                <div className="text-lg font-bold">99.9%</div>
                <div className="text-xs opacity-90">Uptime</div>
              </div>
            </div>
          </Card>
          <Card className="bg-white/10 backdrop-blur border-white/20 text-white p-3">
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5" />
              <div>
                <div className="text-lg font-bold">256-bit</div>
                <div className="text-xs opacity-90">SSL Encryption</div>
              </div>
            </div>
          </Card>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="bg-white border-b px-4">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="endpoints">Endpoints</TabsTrigger>
              <TabsTrigger value="examples">Examples</TabsTrigger>
              <TabsTrigger value="auth">Authentication</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="overview" className="p-4 space-y-4">
            {/* Quick Start */}
            <Card className="p-4">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Play className="w-5 h-5 text-green-500" />
                Quick Start
              </h3>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center text-xs font-bold text-blue-600">
                    1
                  </div>
                  <div>
                    <div className="font-medium">Get API Key</div>
                    <div className="text-sm text-gray-600">Sign up for a developer account and generate your API key</div>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center text-xs font-bold text-blue-600">
                    2
                  </div>
                  <div>
                    <div className="font-medium">Install SDK</div>
                    <div className="text-sm text-gray-600">Choose from our JavaScript, Python, or REST API options</div>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center text-xs font-bold text-blue-600">
                    3
                  </div>
                  <div>
                    <div className="font-medium">Make Your First Call</div>
                    <div className="text-sm text-gray-600">Start with our route calculation endpoint</div>
                  </div>
                </div>
              </div>
              <Button className="mt-4">
                <ExternalLink className="w-4 h-4 mr-2" />
                Get Started
              </Button>
            </Card>

            {/* Features */}
            <Card className="p-4">
              <h3 className="font-semibold mb-3">Key Features</h3>
              <div className="grid grid-cols-1 gap-3">
                {[
                  { icon: '🗺️', title: 'Route Optimization', desc: 'Multi-modal route planning with real-time traffic' },
                  { icon: '📍', title: 'Place Search', desc: 'Comprehensive POI and address lookup' },
                  { icon: '🚛', title: 'Fleet Management', desc: 'Track and manage vehicle fleets' },
                  { icon: '⚡', title: 'Real-time Data', desc: 'Live traffic, incidents, and conditions' },
                  { icon: '🔒', title: 'Enterprise Security', desc: 'SOC 2 compliant with rate limiting' },
                  { icon: '📊', title: 'Analytics', desc: 'Detailed usage metrics and reporting' }
                ].map((feature, idx) => (
                  <div key={idx} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                    <div className="text-2xl">{feature.icon}</div>
                    <div>
                      <div className="font-medium">{feature.title}</div>
                      <div className="text-sm text-gray-600">{feature.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            {/* Rate Limits */}
            <Alert>
              <Shield className="w-4 h-4" />
              <AlertDescription>
                <strong>Rate Limits:</strong> All endpoints have rate limits to ensure fair usage. 
                Enterprise plans include higher limits and priority support.
              </AlertDescription>
            </Alert>
          </TabsContent>

          <TabsContent value="endpoints" className="p-4 space-y-3">
            {apiEndpoints.map((endpoint, idx) => (
              <Card key={idx} className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <Badge className={getMethodColor(endpoint.method)}>
                      {endpoint.method}
                    </Badge>
                    <code className="bg-gray-100 px-2 py-1 rounded text-sm font-mono">
                      {endpoint.path}
                    </code>
                  </div>
                  <Badge variant="outline">{endpoint.category}</Badge>
                </div>
                
                <p className="text-sm text-gray-600 mb-3">{endpoint.description}</p>
                
                <div className="flex items-center gap-4 text-xs text-gray-500">
                  <span className="flex items-center gap-1">
                    {endpoint.auth ? <Shield className="w-3 h-3" /> : <Globe className="w-3 h-3" />}
                    {endpoint.auth ? 'Auth Required' : 'Public'}
                  </span>
                  <span className="flex items-center gap-1">
                    <Zap className="w-3 h-3" />
                    {endpoint.rate_limit}
                  </span>
                </div>
                
                <div className="flex gap-2 mt-3">
                  <Button variant="outline" size="sm">
                    <Book className="w-3 h-3 mr-1" />
                    View Docs
                  </Button>
                  <Button variant="outline" size="sm">
                    <Play className="w-3 h-3 mr-1" />
                    Try It
                  </Button>
                </div>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="examples" className="p-4 space-y-4">
            {Object.entries(sampleCode).map(([language, code]) => (
              <Card key={language} className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold capitalize flex items-center gap-2">
                    <Code className="w-4 h-4" />
                    {language}
                  </h4>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleCopyCode(code, language)}
                  >
                    {copiedCode === language ? (
                      <CheckCircle className="w-3 h-3 mr-1 text-green-500" />
                    ) : (
                      <Copy className="w-3 h-3 mr-1" />
                    )}
                    {copiedCode === language ? 'Copied!' : 'Copy'}
                  </Button>
                </div>
                
                <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
                  <code>{code}</code>
                </pre>
              </Card>
            ))}

            {/* SDK Downloads */}
            <Card className="p-4 bg-blue-50 border-blue-200">
              <h4 className="font-semibold mb-3">SDK Downloads</h4>
              <div className="grid grid-cols-1 gap-2">
                {[
                  { name: 'JavaScript SDK', version: 'v2.1.0', downloads: '45K' },
                  { name: 'Python SDK', version: 'v1.8.2', downloads: '32K' },
                  { name: 'Java SDK', version: 'v1.5.1', downloads: '28K' }
                ].map((sdk, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-white rounded-lg">
                    <div>
                      <div className="font-medium">{sdk.name}</div>
                      <div className="text-sm text-gray-500">{sdk.version} • {sdk.downloads} downloads</div>
                    </div>
                    <Button size="sm">
                      <Download className="w-3 h-3 mr-1" />
                      Download
                    </Button>
                  </div>
                ))}
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="auth" className="p-4 space-y-4">
            {/* API Key Setup */}
            <Card className="p-4">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Key className="w-5 h-5 text-yellow-500" />
                API Key Authentication
              </h3>
              <div className="space-y-3">
                <p className="text-sm text-gray-600">
                  All API requests require authentication using your API key. Include it in the Authorization header:
                </p>
                
                <div className="bg-gray-100 p-3 rounded-lg font-mono text-sm">
                  Authorization: Bearer your-api-key-here
                </div>
                
                <Alert>
                  <Shield className="w-4 h-4" />
                  <AlertDescription>
                    Keep your API key secure and never expose it in client-side code.
                    Use environment variables or secure key management systems.
                  </AlertDescription>
                </Alert>
              </div>
            </Card>

            {/* Rate Limiting */}
            <Card className="p-4">
              <h3 className="font-semibold mb-3">Rate Limiting</h3>
              <div className="space-y-3">
                <p className="text-sm text-gray-600">
                  API requests are rate-limited per API key. Limits depend on your plan:
                </p>
                
                <div className="space-y-2">
                  {[
                    { plan: 'Free', limit: '1,000 requests/day', price: '$0' },
                    { plan: 'Pro', limit: '50,000 requests/day', price: '$99/month' },
                    { plan: 'Enterprise', limit: 'Custom limits', price: 'Contact us' }
                  ].map((tier, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div>
                        <div className="font-medium">{tier.plan}</div>
                        <div className="text-sm text-gray-600">{tier.limit}</div>
                      </div>
                      <div className="font-semibold">{tier.price}</div>
                    </div>
                  ))}
                </div>
              </div>
            </Card>

            {/* Error Handling */}
            <Card className="p-4">
              <h3 className="font-semibold mb-3">Error Handling</h3>
              <div className="space-y-3">
                <p className="text-sm text-gray-600">
                  The API uses standard HTTP status codes and returns detailed error messages:
                </p>
                
                <div className="space-y-2">
                  {[
                    { code: '400', message: 'Bad Request - Invalid parameters' },
                    { code: '401', message: 'Unauthorized - Invalid API key' },
                    { code: '429', message: 'Rate limit exceeded' },
                    { code: '500', message: 'Internal server error' }
                  ].map((error, idx) => (
                    <div key={idx} className="flex gap-3 p-2 text-sm">
                      <Badge variant="outline" className="font-mono">{error.code}</Badge>
                      <span className="text-gray-600">{error.message}</span>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}