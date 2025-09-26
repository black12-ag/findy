import React, { useState } from 'react';
import { 
  Music, 
  UtensilsCrossed, 
  Car, 
  Zap, 
  Plane,
  Hotel,
  ArrowLeft,
  ChevronRight,
  Check,
  Link2,
  Link2Off,
  Smartphone,
  CreditCard,
  Navigation,
  Calendar
} from 'lucide-react';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { Switch } from '../ui/switch';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../ui/tabs';

interface IntegrationsHubProps {
  onBack: () => void;
}

interface Integration {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: React.ElementType;
  connected: boolean;
  color: string;
  features: string[];
}

export function IntegrationsHub({ onBack }: IntegrationsHubProps) {
  const [activeTab, setActiveTab] = useState('all');
  const [integrations, setIntegrations] = useState<Integration[]>([
    {
      id: 'spotify',
      name: 'Spotify',
      description: 'Control music playback during navigation',
      category: 'music',
      icon: Music,
      connected: false,
      color: '#1DB954',
      features: ['Playback controls', 'Playlist sync', 'Voice commands']
    },
    {
      id: 'apple-music',
      name: 'Apple Music',
      description: 'Seamless music control while driving',
      category: 'music',
      icon: Music,
      connected: true,
      color: '#FC3C44',
      features: ['CarPlay integration', 'Siri control', 'Offline playback']
    },
    {
      id: 'doordash',
      name: 'DoorDash',
      description: 'Order food to your destination',
      category: 'food',
      icon: UtensilsCrossed,
      connected: false,
      color: '#FF3008',
      features: ['Pre-arrival ordering', 'Pickup on route', 'Group orders']
    },
    {
      id: 'uber-eats',
      name: 'Uber Eats',
      description: 'Food delivery coordination',
      category: 'food',
      icon: UtensilsCrossed,
      connected: false,
      color: '#06C167',
      features: ['ETA-based ordering', 'Favorites sync', 'Quick reorder']
    },
    {
      id: 'parkwhiz',
      name: 'ParkWhiz',
      description: 'Reserve and pay for parking',
      category: 'parking',
      icon: Car,
      connected: true,
      color: '#4A90E2',
      features: ['Spot reservation', 'Price comparison', 'Garage navigation']
    },
    {
      id: 'spothero',
      name: 'SpotHero',
      description: 'Find and book parking spots',
      category: 'parking',
      icon: Car,
      connected: false,
      color: '#FF6B35',
      features: ['Hourly/daily rates', 'Covered parking', 'Event parking']
    },
    {
      id: 'tesla',
      name: 'Tesla Superchargers',
      description: 'Find Tesla charging stations',
      category: 'ev',
      icon: Zap,
      connected: false,
      color: '#CC0000',
      features: ['Real-time availability', 'Route planning', 'Charging speed']
    },
    {
      id: 'chargepoint',
      name: 'ChargePoint',
      description: 'Universal EV charging network',
      category: 'ev',
      icon: Zap,
      connected: false,
      color: '#00A859',
      features: ['Network coverage', 'Payment integration', 'Charging history']
    },
    {
      id: 'uber',
      name: 'Uber',
      description: 'Ride-sharing integration',
      category: 'transport',
      icon: Car,
      connected: false,
      color: '#000000',
      features: ['Price comparison', 'Wait time', 'Ride scheduling']
    },
    {
      id: 'booking',
      name: 'Booking.com',
      description: 'Hotel reservations on the go',
      category: 'travel',
      icon: Hotel,
      connected: false,
      color: '#003580',
      features: ['Last-minute deals', 'Loyalty points', 'Free cancellation']
    },
    {
      id: 'opentable',
      name: 'OpenTable',
      description: 'Restaurant reservations',
      category: 'travel',
      icon: UtensilsCrossed,
      connected: false,
      color: '#DA3743',
      features: ['Real-time availability', 'Special requests', 'Points earning']
    }
  ]);

  const toggleConnection = (id: string) => {
    setIntegrations(prev => prev.map(integration => 
      integration.id === id 
        ? { ...integration, connected: !integration.connected }
        : integration
    ));
  };

  const categories = [
    { id: 'all', name: 'All', count: integrations.length },
    { id: 'music', name: 'Music', count: integrations.filter(i => i.category === 'music').length },
    { id: 'food', name: 'Food', count: integrations.filter(i => i.category === 'food').length },
    { id: 'parking', name: 'Parking', count: integrations.filter(i => i.category === 'parking').length },
    { id: 'ev', name: 'EV Charging', count: integrations.filter(i => i.category === 'ev').length },
    { id: 'transport', name: 'Transport', count: integrations.filter(i => i.category === 'transport').length },
    { id: 'travel', name: 'Travel', count: integrations.filter(i => i.category === 'travel').length },
  ];

  const filteredIntegrations = activeTab === 'all' 
    ? integrations 
    : integrations.filter(i => i.category === activeTab);

  const connectedCount = integrations.filter(i => i.connected).length;

  return (
    <div className="h-full bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 bg-white px-4 py-4 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <h2 className="font-medium text-gray-900">Connected Services</h2>
            <p className="text-sm text-gray-500">{connectedCount} of {integrations.length} connected</p>
          </div>
          <Link2 className="w-6 h-6 text-blue-500" />
        </div>
      </div>

      {/* Connection Status */}
      <div className="px-4 py-3 bg-blue-50 border-b border-blue-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-sm text-blue-900">{connectedCount} active integrations</span>
          </div>
          <Button variant="ghost" size="sm" className="text-blue-600">
            Manage All
          </Button>
        </div>
      </div>

      {/* Category Tabs */}
      <div className="px-4 py-3 bg-white border-b border-gray-200">
        <div className="flex gap-2 overflow-x-auto scroll-y hide-scrollbar">
          {categories.map(category => (
            <Button
              key={category.id}
              variant={activeTab === category.id ? "default" : "ghost"}
              size="sm"
              onClick={() => setActiveTab(category.id)}
              className="flex-shrink-0"
            >
              {category.name}
              <Badge variant="secondary" className="ml-2">
                {category.count}
              </Badge>
            </Button>
          ))}
        </div>
      </div>

      {/* Integrations List */}
      <div className="flex-1 overflow-y-auto scroll-y hide-scrollbar scroll-smooth p-4">
        <div className="space-y-3">
          {filteredIntegrations.map(integration => {
            const Icon = integration.icon;
            return (
              <Card key={integration.id} className="p-4">
                <div className="flex items-start gap-4">
                  <div 
                    className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: `${integration.color}20` }}
                  >
                    <Icon className="w-6 h-6" style={{ color: integration.color }} />
                  </div>
                  
                  <div className="flex-1">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h3 className="font-medium text-gray-900 flex items-center gap-2">
                          {integration.name}
                          {integration.connected && (
                            <Badge variant="secondary" className="bg-green-100 text-green-700">
                              <Check className="w-3 h-3 mr-1" />
                              Connected
                            </Badge>
                          )}
                        </h3>
                        <p className="text-sm text-gray-500 mt-1">{integration.description}</p>
                      </div>
                      <Switch 
                        checked={integration.connected}
                        onCheckedChange={() => toggleConnection(integration.id)}
                      />
                    </div>
                    
                    <div className="flex flex-wrap gap-2 mt-3">
                      {integration.features.map((feature, index) => (
                        <Badge key={index} variant="outline" className="text-xs">
                          {feature}
                        </Badge>
                      ))}
                    </div>
                    
                    {integration.connected && (
                      <div className="mt-3 pt-3 border-t border-gray-100">
                        <button className="text-sm text-blue-600 hover:text-blue-700 font-medium">
                          Configure settings →
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>

        {/* Quick Actions */}
        <Card className="mt-6 p-4 bg-gradient-to-br from-purple-50 to-blue-50 border-purple-200">
          <h3 className="font-medium text-gray-900 mb-3">Popular Combinations</h3>
          <div className="space-y-2">
            <div className="flex items-center justify-between p-3 bg-white rounded-lg">
              <div className="flex items-center gap-3">
                <div className="flex -space-x-2">
                  <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center text-white text-xs">S</div>
                  <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white text-xs">P</div>
                </div>
                <div>
                  <p className="font-medium text-gray-900 text-sm">Music + Parking</p>
                  <p className="text-xs text-gray-500">Perfect for concerts</p>
                </div>
              </div>
              <Button size="sm" variant="outline">Setup</Button>
            </div>
            
            <div className="flex items-center justify-between p-3 bg-white rounded-lg">
              <div className="flex items-center gap-3">
                <div className="flex -space-x-2">
                  <div className="w-8 h-8 bg-red-500 rounded-full flex items-center justify-center text-white text-xs">D</div>
                  <div className="w-8 h-8 bg-yellow-500 rounded-full flex items-center justify-center text-white text-xs">T</div>
                </div>
                <div>
                  <p className="font-medium text-gray-900 text-sm">Food + EV Charging</p>
                  <p className="text-xs text-gray-500">Dine while charging</p>
                </div>
              </div>
              <Button size="sm" variant="outline">Setup</Button>
            </div>
          </div>
        </Card>

        {/* Help Card */}
        <Card className="mt-4 p-4 bg-gray-50 border-gray-200">
          <div className="flex items-start gap-3">
            <Smartphone className="w-5 h-5 text-gray-600 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-medium text-gray-900 mb-1">Need help connecting?</h4>
              <p className="text-sm text-gray-600 mb-3">
                Most integrations require you to sign in with your existing account.
              </p>
              <Button variant="outline" size="sm">
                View Setup Guide
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}