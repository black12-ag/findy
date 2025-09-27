import React from 'react';
import { MapPin, Navigation, Clock, Star, X } from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Card } from './ui/card';
import { cn } from '../lib/utils';

interface SearchResult {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  category?: string;
  rating?: number;
  distance?: string;
  duration?: string;
  isOpen?: boolean;
}

interface SearchResultsOverlayProps {
  results: SearchResult[];
  searchQuery: string;
  onResultSelect: (result: SearchResult) => void;
  onClose: () => void;
  className?: string;
}

const getCategoryIcon = (category?: string) => {
  switch (category?.toLowerCase()) {
    case 'restaurant':
    case 'food':
      return '🍽️';
    case 'gas_station':
    case 'fuel':
      return '⛽';
    case 'hospital':
    case 'health':
      return '🏥';
    case 'school':
    case 'university':
      return '🏫';
    case 'bank':
      return '🏦';
    case 'store':
    case 'shopping_mall':
      return '🛍️';
    case 'park':
      return '🌳';
    case 'hotel':
    case 'lodging':
      return '🏨';
    case 'airport':
      return '✈️';
    case 'subway_station':
    case 'transit_station':
      return '🚇';
    default:
      return '📍';
  }
};

const getCategoryColor = (category?: string) => {
  switch (category?.toLowerCase()) {
    case 'restaurant':
    case 'food':
      return 'bg-orange-100 text-orange-800 border-orange-200';
    case 'gas_station':
    case 'fuel':
      return 'bg-red-100 text-red-800 border-red-200';
    case 'hospital':
    case 'health':
      return 'bg-red-100 text-red-800 border-red-200';
    case 'school':
    case 'university':
      return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'bank':
      return 'bg-green-100 text-green-800 border-green-200';
    case 'store':
    case 'shopping_mall':
      return 'bg-purple-100 text-purple-800 border-purple-200';
    case 'park':
      return 'bg-green-100 text-green-800 border-green-200';
    case 'hotel':
    case 'lodging':
      return 'bg-indigo-100 text-indigo-800 border-indigo-200';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200';
  }
};

export function SearchResultsOverlay({
  results,
  searchQuery,
  onResultSelect,
  onClose,
  className
}: SearchResultsOverlayProps) {
  if (results.length === 0) return null;

  return (
    <div className={cn('absolute top-4 left-4 right-4 z-30', className)}>
      <Card className="bg-white shadow-lg max-h-96 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <div>
            <h3 className="font-semibold text-gray-900">
              Search Results
            </h3>
            <p className="text-sm text-gray-600">
              {results.length} result{results.length !== 1 ? 's' : ''} for "{searchQuery}"
            </p>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Results List */}
        <div className="max-h-80 overflow-y-auto">
          {results.map((result, index) => (
            <div
              key={result.id}
              className={cn(
                'p-4 hover:bg-gray-50 cursor-pointer transition-colors',
                index < results.length - 1 && 'border-b border-gray-100'
              )}
              onClick={() => onResultSelect(result)}
            >
              <div className="flex items-start gap-3">
                {/* Category Icon */}
                <div className="flex-shrink-0">
                  <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                    <span className="text-lg">
                      {getCategoryIcon(result.category)}
                    </span>
                  </div>
                </div>

                {/* Result Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900 truncate">
                        {result.name}
                      </h4>
                      <p className="text-sm text-gray-600 mt-1">
                        {result.address}
                      </p>
                      
                      {/* Additional Info */}
                      <div className="flex items-center gap-3 mt-2">
                        {result.category && (
                          <Badge 
                            variant="outline" 
                            className={cn('text-xs', getCategoryColor(result.category))}
                          >
                            {result.category.replace('_', ' ')}
                          </Badge>
                        )}
                        
                        {result.rating && (
                          <div className="flex items-center gap-1">
                            <Star className="w-3 h-3 text-yellow-500 fill-current" />
                            <span className="text-xs text-gray-600">
                              {result.rating.toFixed(1)}
                            </span>
                          </div>
                        )}
                        
                        {result.isOpen !== undefined && (
                          <div className="flex items-center gap-1">
                            <div className={cn(
                              'w-2 h-2 rounded-full',
                              result.isOpen ? 'bg-green-500' : 'bg-red-500'
                            )} />
                            <span className="text-xs text-gray-600">
                              {result.isOpen ? 'Open' : 'Closed'}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Distance & Action */}
                    <div className="flex flex-col items-end gap-1">
                      {result.distance && (
                        <span className="text-xs text-gray-500">
                          {result.distance}
                        </span>
                      )}
                      {result.duration && (
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-gray-400" />
                          <span className="text-xs text-gray-500">
                            {result.duration}
                          </span>
                        </div>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-6 px-2 text-xs"
                        onClick={(e) => {
                          e.stopPropagation();
                          onResultSelect(result);
                        }}
                      >
                        <Navigation className="w-3 h-3 mr-1" />
                        Go
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="p-3 bg-gray-50 border-t border-gray-100">
          <p className="text-xs text-gray-500 text-center">
            Tap any result to get directions
          </p>
        </div>
      </Card>
    </div>
  );
}