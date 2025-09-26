import React, { useState } from 'react';
import { Search, MapPin, Clock, Star, Navigation, ArrowLeft, Mic, QrCode, Camera, Filter, SlidersHorizontal, DollarSign, Accessibility } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogClose } from './ui/dialog';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from './ui/sheet';
import { Switch } from './ui/switch';
import { Slider } from './ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';

interface Location {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  category?: string;
}

interface SearchPanelProps {
  query: string;
  onSearch: (query: string) => void;
  onLocationSelect: (location: Location) => void;
  transportMode: string;
  onBack: () => void;
  onOpenVoicePanel: () => void;
}

export function SearchPanel({ query, onSearch, onLocationSelect, transportMode, onBack, onOpenVoicePanel }: SearchPanelProps) {
  const [searchInput, setSearchInput] = useState(query);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState({
    openNow: false,
    rating: 0, // 0 = any rating, 4 = 4+ stars
    priceRange: [1, 4], // 1-4 price levels
    distance: 10, // miles
    accessibility: false
  });

  // Mock search results
  const recentSearches = [
    { id: '1', name: 'Starbucks', address: '123 Market St', lat: 37.7749, lng: -122.4194, category: 'coffee' },
    { id: '2', name: 'Whole Foods', address: '456 Mission St', lat: 37.7849, lng: -122.4094, category: 'grocery' },
    { id: '3', name: 'Golden Gate Park', address: 'San Francisco, CA', lat: 37.7694, lng: -122.4862, category: 'park' },
  ];

  const allSearchResults = [
    { id: '4', name: 'Blue Bottle Coffee', address: '315 Linden St', lat: 37.7849, lng: -122.4094, category: 'coffee', rating: 4.5, distance: '0.3 mi', priceLevel: 2, openNow: true, accessible: true },
    { id: '5', name: 'SFMOMA', address: '151 3rd St', lat: 37.7856, lng: -122.4011, category: 'museum', rating: 4.7, distance: '0.8 mi', priceLevel: 3, openNow: true, accessible: true },
    { id: '6', name: 'Ferry Building', address: '1 Ferry Building', lat: 37.7956, lng: -122.3943, category: 'landmark', rating: 4.6, distance: '1.2 mi', priceLevel: 1, openNow: true, accessible: false },
    { id: '7', name: 'Budget Restaurant', address: '789 Cheap St', lat: 37.7749, lng: -122.4194, category: 'restaurant', rating: 3.8, distance: '0.5 mi', priceLevel: 1, openNow: false, accessible: false },
    { id: '8', name: 'High-end Bistro', address: '321 Luxury Ave', lat: 37.7649, lng: -122.4294, category: 'restaurant', rating: 4.9, distance: '1.5 mi', priceLevel: 4, openNow: true, accessible: true },
  ];

  // Filter results based on current filters
  const searchResults = allSearchResults.filter(result => {
    if (filters.openNow && !result.openNow) return false;
    if (filters.rating > 0 && result.rating < filters.rating) return false;
    if (result.priceLevel < filters.priceRange[0] || result.priceLevel > filters.priceRange[1]) return false;
    if (parseFloat(result.distance) > filters.distance) return false;
    if (filters.accessibility && !result.accessible) return false;
    return true;
  });

  const categories = [
    { id: 'restaurant', name: 'Restaurants', icon: '🍽️' },
    { id: 'gas', name: 'Gas Stations', icon: '⛽' },
    { id: 'parking', name: 'Parking', icon: '🅿️' },
    { id: 'atm', name: 'ATMs', icon: '💵' },
    { id: 'hospital', name: 'Hospitals', icon: '🏥' },
    { id: 'shopping', name: 'Shopping', icon: '🛍️' },
    { id: 'hotel', name: 'Hotels', icon: '🏨' },
    { id: 'entertainment', name: 'Entertainment', icon: '🎭' },
  ];

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'coffee': return '☕';
      case 'grocery': return '🛒';
      case 'park': return '🌳';
      case 'museum': return '🏛️';
      case 'landmark': return '🏛️';
      default: return '📍';
    }
  };

  const performSearch = (value: string) => {
    setSearchInput(value);
    onSearch(value);
  };

  return (
    <div className="h-full bg-white flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 px-4 py-4 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={onBack}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <Input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  performSearch(searchInput);
                }
              }}
              placeholder="Where to?"
              className="pl-10 pr-12"
              autoFocus
            />
            <div className="absolute right-1 top-1/2 transform -translate-y-1/2 flex gap-1">
              <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
                <SheetTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="w-8 h-8"
                  >
                    <Filter className="w-4 h-4" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="bottom" className="h-[600px]">
                  <SheetHeader>
                    <SheetTitle>Search Filters</SheetTitle>
                    <SheetDescription>
                      Refine your search results
                    </SheetDescription>
                  </SheetHeader>
                  <div className="py-6 space-y-6">
                    {/* Open Now Filter */}
                    <div className="flex items-center justify-between">
                      <div>
                        <label className="text-sm font-medium">Open now</label>
                        <p className="text-xs text-gray-500">Only show places currently open</p>
                      </div>
                      <Switch
                        checked={filters.openNow}
                        onCheckedChange={(checked) => setFilters(prev => ({ ...prev, openNow: checked }))}
                      />
                    </div>

                    {/* Rating Filter */}
                    <div>
                      <label className="text-sm font-medium mb-2 block">Minimum rating</label>
                      <Select value={filters.rating.toString()} onValueChange={(value) => setFilters(prev => ({ ...prev, rating: parseInt(value) }))}>
                        <SelectTrigger>
                          <SelectValue placeholder="Any rating" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="0">Any rating</SelectItem>
                          <SelectItem value="3">3+ stars</SelectItem>
                          <SelectItem value="4">4+ stars</SelectItem>
                          <SelectItem value="4.5">4.5+ stars</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Price Range */}
                    <div>
                      <label className="text-sm font-medium mb-3 block">Price range</label>
                      <div className="px-3">
                        <Slider
                          value={filters.priceRange}
                          onValueChange={(value) => setFilters(prev => ({ ...prev, priceRange: value }))}
                          max={4}
                          min={1}
                          step={1}
                          className="w-full"
                        />
                        <div className="flex justify-between text-xs text-gray-500 mt-1">
                          <span>$</span>
                          <span>$$</span>
                          <span>$$$</span>
                          <span>$$$$</span>
                        </div>
                      </div>
                    </div>

                    {/* Distance */}
                    <div>
                      <label className="text-sm font-medium mb-3 block">Maximum distance: {filters.distance} miles</label>
                      <div className="px-3">
                        <Slider
                          value={[filters.distance]}
                          onValueChange={(value) => setFilters(prev => ({ ...prev, distance: value[0] }))}
                          max={25}
                          min={1}
                          step={1}
                          className="w-full"
                        />
                      </div>
                    </div>

                    {/* Accessibility */}
                    <div className="flex items-center justify-between">
                      <div>
                        <label className="text-sm font-medium">Wheelchair accessible</label>
                        <p className="text-xs text-gray-500">Only show accessible locations</p>
                      </div>
                      <Switch
                        checked={filters.accessibility}
                        onCheckedChange={(checked) => setFilters(prev => ({ ...prev, accessibility: checked }))}
                      />
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-3 pt-4">
                      <Button
                        variant="outline"
                        className="flex-1"
                        onClick={() => {
                          setFilters({
                            openNow: false,
                            rating: 0,
                            priceRange: [1, 4],
                            distance: 10,
                            accessibility: false
                          });
                        }}
                      >
                        Clear Filters
                      </Button>
                      <Button className="flex-1" onClick={() => setFiltersOpen(false)}>
                        Apply Filters
                      </Button>
                    </div>
                  </div>
                </SheetContent>
              </Sheet>
              <Button
                variant="ghost"
                size="icon"
                className="w-8 h-8"
                onClick={() => setScannerOpen(true)}
              >
                <QrCode className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="w-8 h-8"
                onClick={onOpenVoicePanel}
              >
                <Mic className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
        
        {/* Scanner Info */}
        <div className="px-4 py-2 bg-blue-50 border-b border-blue-200">
          <div className="flex items-center gap-2 text-sm text-blue-800">
            <Camera className="w-4 h-4" />
            <span>Tap the QR code icon to scan location codes or business cards</span>
          </div>
        </div>
      </div>

      {/* QR Scanner Dialog */}
      <Dialog open={scannerOpen} onOpenChange={setScannerOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Scan a QR code</DialogTitle>
            <DialogDescription>
              This is a simulated scanner. Paste or type a location code below to populate the search.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              placeholder="e.g. Blue Bottle Coffee"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const value = (e.target as HTMLInputElement).value.trim();
                  if (value) {
                    performSearch(value);
                    setScannerOpen(false);
                  }
                }
              }}
            />
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" onClick={() => setScannerOpen(false)}>Cancel</Button>
              <Button
                onClick={() => {
                  performSearch('Blue Bottle Coffee');
                  setScannerOpen(false);
                }}
              >
                Scan sample
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <div className="flex-1 overflow-y-auto scroll-y hide-scrollbar scroll-smooth">
        {/* Quick Categories */}
        <div className="px-4 py-4 border-b border-gray-100">
          <h3 className="font-medium text-gray-900 mb-3">Quick Search</h3>
          <div className="grid grid-cols-3 gap-3">
            {categories.map((category) => (
              <button
                key={category.id}
                className="flex flex-col items-center p-3 rounded-lg hover:bg-gray-50 transition-colors"
                onClick={() => performSearch(category.name)}
              >
                <span className="text-2xl mb-1">{category.icon}</span>
                <span className="text-xs text-gray-600 text-center">{category.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Recent Searches */}
        {!searchInput && (
          <div className="px-4 py-4 border-b border-gray-100">
            <h3 className="font-medium text-gray-900 mb-3">Recent</h3>
            <div className="space-y-3">
              {recentSearches.map((place) => (
                <button
                  key={place.id}
                  className="flex items-center gap-3 w-full p-2 rounded-lg hover:bg-gray-50 transition-colors"
                  onClick={() => onLocationSelect(place)}
                >
                  <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                    <span className="text-lg">{getCategoryIcon(place.category || '')}</span>
                  </div>
                  <div className="flex-1 text-left">
                    <div className="font-medium text-gray-900">{place.name}</div>
                    <div className="text-sm text-gray-500">{place.address}</div>
                  </div>
                  <Clock className="w-4 h-4 text-gray-400" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Search Results */}
        {searchInput && (
          <div className="px-4 py-4">
            <h3 className="font-medium text-gray-900 mb-3">Results</h3>
            <div className="space-y-3">
              {searchResults.map((place) => (
                <button
                  key={place.id}
                  className="flex items-center gap-3 w-full p-2 rounded-lg hover:bg-gray-50 transition-colors"
                  onClick={() => onLocationSelect(place)}
                >
                  <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                    <span className="text-lg">{getCategoryIcon(place.category || '')}</span>
                  </div>
                  <div className="flex-1 text-left">
                    <div className="font-medium text-gray-900">{place.name}</div>
                    <div className="text-sm text-gray-500">{place.address}</div>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex items-center gap-1">
                        <Star className="w-3 h-3 text-yellow-400 fill-current" />
                        <span className="text-xs text-gray-600">{place.rating}</span>
                      </div>
                      <span className="w-1 h-1 bg-gray-300 rounded-full" />
                      <span className="text-xs text-gray-600">{place.distance}</span>
                      {'priceLevel' in place && (
                        <>
                          <span className="w-1 h-1 bg-gray-300 rounded-full" />
                          <span className="text-xs text-gray-600">
                            {'$'.repeat(place.priceLevel)}
                          </span>
                        </>
                      )}
                      {'openNow' in place && place.openNow && (
                        <>
                          <span className="w-1 h-1 bg-gray-300 rounded-full" />
                          <span className="text-xs text-green-600">Open</span>
                        </>
                      )}
                      {'accessible' in place && place.accessible && (
                        <Accessibility className="w-3 h-3 text-blue-500" />
                      )}
                    </div>
                  </div>
                  <Navigation className="w-4 h-4 text-gray-400" />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}