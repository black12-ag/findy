import React from 'react';
import { 
  Home, 
  Navigation2, 
  Search, 
  MapPin, 
  Settings, 
  BarChart3, 
  Route, 
  Eye,
  Menu,
  X
} from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Card } from './ui/card';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from './ui/sheet';
import { getAllRoutes, PageRoute } from './AdvancedRouter';

interface NavigationMenuProps {
  onNavigateToPage: (route: PageRoute, params?: any) => void;
  onNavigateToScreen: (screen: string) => void;
}

export const NavigationMenu: React.FC<NavigationMenuProps> = ({
  onNavigateToPage,
  onNavigateToScreen
}) => {
  const routes = getAllRoutes();

  const pageRoutes = Object.entries(routes).map(([key, config]) => ({
    id: key as PageRoute,
    ...config
  }));

  const screenRoutes = [
    { id: 'search', icon: Search, title: 'Search', category: 'core' },
    { id: 'saved', icon: MapPin, title: 'Saved Places', category: 'core' },
    { id: 'social', icon: Settings, title: 'Social', category: 'social' },
    { id: 'settings', icon: Settings, title: 'Settings', category: 'core' },
    { id: 'analytics', icon: BarChart3, title: 'Analytics', category: 'advanced' },
    { id: 'parking', icon: MapPin, title: 'Parking', category: 'utilities' },
    { id: 'gamification', icon: BarChart3, title: 'Rewards', category: 'social' },
    { id: 'developer', icon: Settings, title: 'Developer Tools', category: 'advanced' },
  ];

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'navigation': return 'bg-blue-100 text-blue-800';
      case 'search': return 'bg-green-100 text-green-800';
      case 'settings': return 'bg-gray-100 text-gray-800';
      case 'analysis': return 'bg-purple-100 text-purple-800';
      case 'core': return 'bg-blue-100 text-blue-800';
      case 'social': return 'bg-pink-100 text-pink-800';
      case 'advanced': return 'bg-orange-100 text-orange-800';
      case 'utilities': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getRouteIcon = (route: any) => {
    switch (route.category) {
      case 'navigation': return <Navigation2 className="w-4 h-4" />;
      case 'search': return <Search className="w-4 h-4" />;
      case 'settings': return <Settings className="w-4 h-4" />;
      case 'analysis': return <BarChart3 className="w-4 h-4" />;
      default: return <Home className="w-4 h-4" />;
    }
  };

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          size="icon"
          className="bg-white text-gray-700 shadow-lg border border-gray-200 hover:bg-gray-50"
        >
          <Menu className="w-5 h-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:w-96">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Navigation2 className="w-5 h-5" />
            Navigation Menu
          </SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Full Page Routes */}
          <div>
            <h3 className="text-sm font-medium text-gray-900 mb-3">Full Pages</h3>
            <div className="space-y-2">
              {pageRoutes.map((route) => (
                <Card key={route.id} className="p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      {getRouteIcon(route)}
                      <div className="flex-1">
                        <h4 className="text-sm font-medium">{route.title}</h4>
                        <p className="text-xs text-gray-500">{route.description}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge 
                        variant="outline" 
                        className={`text-xs ${getCategoryColor(route.category)}`}
                      >
                        {route.category}
                      </Badge>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          if (route.requiresData) {
                            // Provide mock data for demo
                            onNavigateToPage(route.id, {
                              data: {
                                location: { name: 'Demo Location', lat: 37.7749, lng: -122.4194 },
                                query: 'coffee shops',
                                results: []
                              }
                            });
                          } else {
                            onNavigateToPage(route.id);
                          }
                        }}
                      >
                        Open
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>

          {/* Screen Components */}
          <div>
            <h3 className="text-sm font-medium text-gray-900 mb-3">App Screens</h3>
            <div className="grid grid-cols-1 gap-2">
              {screenRoutes.map((screen) => {
                const Icon = screen.icon;
                return (
                  <Button
                    key={screen.id}
                    variant="outline"
                    className="justify-between h-auto p-3"
                    onClick={() => onNavigateToScreen(screen.id)}
                  >
                    <div className="flex items-center space-x-2">
                      <Icon className="w-4 h-4" />
                      <span>{screen.title}</span>
                    </div>
                    <Badge 
                      variant="outline" 
                      className={`text-xs ${getCategoryColor(screen.category)}`}
                    >
                      {screen.category}
                    </Badge>
                  </Button>
                );
              })}
            </div>
          </div>

          {/* Quick Actions */}
          <div>
            <h3 className="text-sm font-medium text-gray-900 mb-3">Quick Actions</h3>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                onClick={() => onNavigateToScreen('voice')}
                className="h-auto p-3 flex-col"
              >
                <Settings className="w-4 h-4 mb-1" />
                <span className="text-xs">Voice Command</span>
              </Button>
              <Button
                variant="outline"
                onClick={() => onNavigateToScreen('ar')}
                className="h-auto p-3 flex-col"
              >
                <Eye className="w-4 h-4 mb-1" />
                <span className="text-xs">AR Navigation</span>
              </Button>
              <Button
                variant="outline"
                onClick={() => onNavigateToScreen('fleet')}
                className="h-auto p-3 flex-col"
              >
                <Navigation2 className="w-4 h-4 mb-1" />
                <span className="text-xs">Fleet Mgmt</span>
              </Button>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};