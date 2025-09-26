import React, { useState } from 'react';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { logger } from '../utils/logger';

// Import all page components
import HomePage from '../pages/HomePage';
import NavigationPage from '../pages/NavigationPage';
import ReachabilityPage from '../pages/ReachabilityPage';
import PlaceDetailsPage from '../pages/PlaceDetailsPage';
import SearchResultsPage from '../pages/SearchResultsPage';
import RouteOptionsPage from '../pages/RouteOptionsPage';
import SettingsPage from '../pages/SettingsPage';

export type PageRoute = 
  | 'home'
  | 'navigation-page'
  | 'reachability'
  | 'place-details-page'
  | 'search-results-page'
  | 'route-options-page'
  | 'settings-page';

interface AdvancedRouterProps {
  currentRoute: PageRoute | null;
  onNavigateBack: () => void;
  routeParams?: Record<string, any>;
}

interface RouteConfig {
  component: React.ComponentType<any>;
  title: string;
  description: string;
  category: 'navigation' | 'search' | 'settings' | 'analysis';
  requiresData?: boolean;
  fullscreen?: boolean;
}

const routes: Record<PageRoute, RouteConfig> = {
  'home': {
    component: HomePage,
    title: 'Home',
    description: 'Main homepage with map and search',
    category: 'navigation',
    fullscreen: true
  },
  'navigation-page': {
    component: NavigationPage,
    title: 'Turn-by-Turn Navigation',
    description: 'Full-screen navigation with voice guidance',
    category: 'navigation',
    requiresData: true,
    fullscreen: true
  },
  'reachability': {
    component: ReachabilityPage,
    title: 'Reachability Analysis',
    description: 'Analyze what locations you can reach within a time/distance',
    category: 'analysis'
  },
  'place-details-page': {
    component: PlaceDetailsPage,
    title: 'Place Details',
    description: 'Detailed information about a specific location',
    category: 'search',
    requiresData: true
  },
  'search-results-page': {
    component: SearchResultsPage,
    title: 'Search Results',
    description: 'Results from location or POI search',
    category: 'search',
    requiresData: true
  },
  'route-options-page': {
    component: RouteOptionsPage,
    title: 'Route Options',
    description: 'Compare different route options and preferences',
    category: 'navigation',
    requiresData: true
  },
  'settings-page': {
    component: SettingsPage,
    title: 'Advanced Settings',
    description: 'Detailed app settings and preferences',
    category: 'settings'
  }
};

export const AdvancedRouter: React.FC<AdvancedRouterProps> = ({
  currentRoute,
  onNavigateBack,
  routeParams = {}
}) => {
  const [pageError, setPageError] = useState<string | null>(null);

  if (!currentRoute) {
    return null;
  }

  const routeConfig = routes[currentRoute];
  
  if (!routeConfig) {
    return (
      <div className="h-full bg-white flex flex-col">
        <div className="flex items-center p-4 border-b">
          <Button variant="ghost" size="sm" onClick={onNavigateBack}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <h1 className="ml-4 text-lg font-semibold text-red-600">Route Not Found</h1>
        </div>
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="text-center">
            <p className="text-gray-600">The requested page "{currentRoute}" could not be found.</p>
            <Button className="mt-4" onClick={onNavigateBack}>
              Go Back
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Check if route requires data but none is provided
  if (routeConfig.requiresData && !routeParams?.data) {
    return (
      <div className="h-full bg-white flex flex-col">
        <div className="flex items-center p-4 border-b">
          <Button variant="ghost" size="sm" onClick={onNavigateBack}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <h1 className="ml-4 text-lg font-semibold">Missing Data</h1>
        </div>
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="text-center">
            <p className="text-gray-600 mb-2">
              This page requires data to display properly.
            </p>
            <p className="text-sm text-gray-500 mb-4">
              Route: {routeConfig.title}
            </p>
            <Button onClick={onNavigateBack}>
              Go Back
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const PageComponent = routeConfig.component;

  if (pageError) {
    return (
      <div className="h-full bg-white flex flex-col">
        <div className="flex items-center p-4 border-b">
          <Button variant="ghost" size="sm" onClick={onNavigateBack}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <h1 className="ml-4 text-lg font-semibold text-red-600">Page Error</h1>
        </div>
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="text-center">
            <p className="text-gray-600 mb-2">An error occurred while loading this page:</p>
            <p className="text-red-600 text-sm mb-4">{pageError}</p>
            <div className="space-x-2">
              <Button variant="outline" onClick={() => setPageError(null)}>
                Try Again
              </Button>
              <Button onClick={onNavigateBack}>
                Go Back
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  try {
    return (
      <div className={`bg-white ${routeConfig.fullscreen ? 'fixed inset-0 z-50' : 'h-full'} flex flex-col`}>
        {/* Header for non-fullscreen pages */}
        {!routeConfig.fullscreen && (
          <div className="flex items-center justify-between p-4 border-b bg-gray-50">
            <div className="flex items-center space-x-3">
              <Button variant="ghost" size="sm" onClick={onNavigateBack}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              <div>
                <h1 className="text-lg font-semibold">{routeConfig.title}</h1>
                <p className="text-sm text-gray-600">{routeConfig.description}</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Badge variant="outline">
                {routeConfig.category}
              </Badge>
              <Button variant="ghost" size="sm">
                <ExternalLink className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Page Content */}
        <div className={`flex-1 ${routeConfig.fullscreen ? '' : 'overflow-auto'}`}>
          <ErrorBoundary onError={setPageError}>
            <PageComponent 
              {...routeParams}
              onNavigateBack={onNavigateBack}
              isFullscreen={routeConfig.fullscreen}
            />
          </ErrorBoundary>
        </div>
      </div>
    );
  } catch (error) {
    logger.error('Error rendering page:', error);
    setPageError(error instanceof Error ? error.message : 'Unknown error');
    return null;
  }
};

// Error boundary for page components
class ErrorBoundary extends React.Component<
  { children: React.ReactNode; onError: (error: string) => void },
  { hasError: boolean }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    logger.error('Page error:', error, errorInfo);
    this.props.onError(error.message);
  }

  render() {
    if (this.state.hasError) {
      return null; // Let parent handle error display
    }

    return this.props.children;
  }
}

// Helper hook for page routing
export const usePageRouter = () => {
  const [currentRoute, setCurrentRoute] = useState<PageRoute | null>(null);
  const [routeParams, setRouteParams] = useState<Record<string, any>>({});

  const navigateTo = (route: PageRoute, params?: Record<string, any>) => {
    setCurrentRoute(route);
    setRouteParams(params || {});
  };

  const navigateBack = () => {
    setCurrentRoute(null);
    setRouteParams({});
  };

  const isActive = (route: PageRoute) => currentRoute === route;

  return {
    currentRoute,
    routeParams,
    navigateTo,
    navigateBack,
    isActive,
    routeConfig: currentRoute ? routes[currentRoute] : null
  };
};

// Get all available routes for navigation menus
export const getAllRoutes = () => routes;

export default AdvancedRouter;