import React, { useEffect, useState } from 'react';
import { ArrowLeft, MapPin, Home, Briefcase, Dumbbell, Plus, Star, Clock, Navigation, Trash2 } from 'lucide-react';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Input } from './ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { placesService } from '../services/places';

interface Location {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  category?: string;
}

interface SavedPlacesPanelProps {
  places: Location[];
  onLocationSelect: (location: Location) => void;
  onBack: () => void;
  onAddPlace: (place: Location) => void;
}

export function SavedPlacesPanel({ places, onLocationSelect, onBack, onAddPlace }: SavedPlacesPanelProps) {
  const [activeTab, setActiveTab] = useState('favorites');
  const [addPlaceOpen, setAddPlaceOpen] = useState(false);
  const [newPlaceName, setNewPlaceName] = useState('');
  const [newPlaceAddress, setNewPlaceAddress] = useState('');
  const [newPlaceCategory, setNewPlaceCategory] = useState<string>('home');

  // Local state synced with backend
  const [saved, setSaved] = useState<Location[]>(places);

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'home': return <Home className="w-5 h-5" />;
      case 'work': return <Briefcase className="w-5 h-5" />;
      case 'gym': return <Dumbbell className="w-5 h-5" />;
      default: return <MapPin className="w-5 h-5" />;
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'home': return '#10B981'; // Green
      case 'work': return '#3B82F6'; // Blue
      case 'gym': return '#8B5CF6'; // Violet
      default: return '#6B7280'; // Gray
    }
  };

  // Fetch saved places from backend on mount
  useEffect(() => {
    const fetchSaved = async () => {
      try {
        const res = await placesService.getUserPlaces();
        const mapped: Location[] = res.places.map((p) => {
          const fp = placesService.formatPlace(p);
          return {
            id: fp.id,
            name: fp.name,
            address: fp.address,
            lat: fp.location.lat,
            lng: fp.location.lng,
            category: fp.category,
          };
        });
        setSaved(mapped);
      } catch (err) {
        // Fallback to provided props if API fails
        setSaved(places);
      }
    };
    fetchSaved();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Mock data for different tabs
  const recentPlaces = [
    { id: '4', name: 'Starbucks Coffee', address: '123 Market St, SF', lat: 37.7749, lng: -122.4194, category: 'coffee' },
    { id: '5', name: 'Golden Gate Park', address: 'San Francisco, CA', lat: 37.7694, lng: -122.4862, category: 'park' },
    { id: '6', name: 'Pier 39', address: 'Pier 39, San Francisco, CA', lat: 37.8085, lng: -122.4096, category: 'tourist' },
  ];

  const [lists, setLists] = useState([
    {
      id: 'restaurants',
      name: 'Favorite Restaurants',
      count: 12,
      places: [
        { id: '7', name: 'The French Laundry', address: 'Yountville, CA', lat: 38.4024, lng: -122.3618 },
        { id: '8', name: 'Atelier Crenn', address: 'San Francisco, CA', lat: 37.7849, lng: -122.4194 },
      ]
    },
    {
      id: 'travel',
      name: 'Travel Wishlist',
      count: 8,
      places: [
        { id: '9', name: 'Tokyo Tower', address: 'Tokyo, Japan', lat: 35.6586, lng: 139.7454 },
        { id: '10', name: 'Eiffel Tower', address: 'Paris, France', lat: 48.8584, lng: 2.2945 },
      ]
    }
  ]);
  const [addListOpen, setAddListOpen] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [activeListId, setActiveListId] = useState<string | null>(null);

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
          <div>
            <h2 className="font-medium text-gray-900">Saved Places</h2>
            <p className="text-sm text-gray-500">Your favorite locations</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <div className="flex-shrink-0 px-4 py-2">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="favorites">Favorites</TabsTrigger>
            <TabsTrigger value="recent">Recent</TabsTrigger>
            <TabsTrigger value="lists">Lists</TabsTrigger>
          </TabsList>
        </div>

        <div className="flex-1 overflow-hidden min-h-0">
          {/* Favorites Tab */}
          <TabsContent value="favorites" className="h-full p-4 overflow-y-auto scroll-y hide-scrollbar scroll-smooth mt-0">
            <div className="space-y-3">
              {/* Add New Place Button */}
              <Card className="p-4 border-dashed border-2 border-gray-200 hover:border-gray-300 cursor-pointer transition-colors" onClick={() => setAddPlaceOpen(true)}>
                <div className="flex items-center justify-center gap-3 text-gray-500 hover:text-gray-700">
                  <Plus className="w-5 h-5" />
                  <span>Add a new place</span>
                </div>
              </Card>

              {/* Saved Places */}
              {saved.map((place) => (
                <Card key={place.id} className="p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-4">
                    <div 
                      className="w-12 h-12 rounded-full flex items-center justify-center text-white"
                      style={{ backgroundColor: getCategoryColor(place.category || '') }}
                    >
                      {getCategoryIcon(place.category || '')}
                    </div>
                    
                    <div className="flex-1">
                      <h3 className="font-medium text-gray-900">{place.name}</h3>
                      <p className="text-sm text-gray-500">{place.address}</p>
                    </div>
                    
                    <Button
                      size="icon"
                      variant="ghost"
                      className="text-gray-400 hover:text-gray-600"
                      onClick={() => onLocationSelect(place)}
                    >
                      <Navigation className="w-5 h-5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="text-gray-400 hover:text-red-600"
                      onClick={async () => {
                        try {
                          await placesService.deletePlace(place.id);
                          setSaved((prev) => prev.filter((p) => p.id !== place.id));
                        } catch (e) {
                          alert('Failed to delete place');
                        }
                      }}
                    >
                      <Trash2 className="w-5 h-5" />
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Recent Tab */}
          <TabsContent value="recent" className="h-full p-4 overflow-y-auto scroll-y hide-scrollbar scroll-smooth mt-0">
            <div className="space-y-3">
              {recentPlaces.map((place) => (
                <Card key={place.id} className="p-4 hover:shadow-md transition-shadow cursor-pointer"
                      onClick={() => onLocationSelect(place)}>
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
                      <Clock className="w-5 h-5 text-gray-500" />
                    </div>
                    
                    <div className="flex-1">
                      <h3 className="font-medium text-gray-900">{place.name}</h3>
                      <p className="text-sm text-gray-500">{place.address}</p>
                      <p className="text-xs text-gray-400 mt-1">Visited 2 hours ago</p>
                    </div>
                    
                    <Button
                      size="icon"
                      variant="ghost"
                      className="text-gray-400 hover:text-gray-600"
                      onClick={(e: React.MouseEvent<HTMLButtonElement>) => { e.stopPropagation(); onLocationSelect(place); }}
                    >
                      <Navigation className="w-5 h-5" />
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Lists Tab */}
          <TabsContent value="lists" className="h-full p-4 overflow-y-auto scroll-y hide-scrollbar scroll-smooth mt-0">
            <div className="space-y-4">
              {/* Create New List Button */}
              <Card className="p-4 border-dashed border-2 border-gray-200 hover:border-gray-300 cursor-pointer transition-colors" onClick={() => setAddListOpen(true)}>
                <div className="flex items-center justify-center gap-3 text-gray-500 hover:text-gray-700">
                  <Plus className="w-5 h-5" />
                  <span>Create a new list</span>
                </div>
              </Card>

              {/* Custom Lists */}
              {lists.map((list) => (
                <Card key={list.id} className="p-4 hover:shadow-md transition-shadow cursor-pointer" onClick={() => setActiveListId(list.id)}>
                  <div className="flex items-center gap-4 mb-3">
                    <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                      <Star className="w-5 h-5 text-purple-600" />
                    </div>
                    
                    <div className="flex-1">
                      <h3 className="font-medium text-gray-900">{list.name}</h3>
                      <p className="text-sm text-gray-500">{list.count} places</p>
                    </div>
                  </div>
                  
                  {/* Preview places */}
                  <div className="space-y-2 ml-16">
                    {list.places.slice(0, 2).map((place) => (
                      <div key={place.id} className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-700">{place.name}</p>
                          <p className="text-xs text-gray-500">{place.address}</p>
                        </div>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="w-8 h-8 text-gray-400 hover:text-gray-600"
                          onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                            e.stopPropagation();
                            onLocationSelect(place);
                          }}
                        >
                          <Navigation className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                    {list.count > 2 && (
                      <p className="text-xs text-gray-400">+{list.count - 2} more places</p>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          </TabsContent>
        </div>
      </Tabs>

      {/* Add Place Dialog */}
      <Dialog open={addPlaceOpen} onOpenChange={setAddPlaceOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add a new place</DialogTitle>
            <DialogDescription>Save a place for quick access later.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Place name" value={newPlaceName} onChange={(e) => setNewPlaceName(e.target.value)} />
            <Input placeholder="Address" value={newPlaceAddress} onChange={(e) => setNewPlaceAddress(e.target.value)} />
            <Select value={newPlaceCategory} onValueChange={setNewPlaceCategory}>
              <SelectTrigger>
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="home">Home</SelectItem>
                <SelectItem value="work">Work</SelectItem>
                <SelectItem value="gym">Gym</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setAddPlaceOpen(false)}>Cancel</Button>
              <Button
                onClick={async () => {
                  if (!newPlaceName.trim() || !newPlaceAddress.trim()) return;
                  try {
                    const resp = await placesService.savePlace({
                      googlePlaceId: `manual_${Date.now()}`,
                      name: newPlaceName.trim(),
                      address: newPlaceAddress.trim(),
                      location: { lat: 0, lng: 0 },
                      category: newPlaceCategory,
                    });
                    const fp = placesService.formatPlace(resp.place);
                    const mapped: Location = {
                      id: fp.id,
                      name: fp.name,
                      address: fp.address,
                      lat: fp.location.lat,
                      lng: fp.location.lng,
                      category: fp.category,
                    };
                    setSaved((prev) => [mapped, ...prev]);
                  } catch (e) {
                    // Fallback to local add if API fails
                    const place: Location = {
                      id: Date.now().toString(),
                      name: newPlaceName.trim(),
                      address: newPlaceAddress.trim(),
                      lat: 0,
                      lng: 0,
                      category: newPlaceCategory === 'other' ? undefined : (newPlaceCategory as any),
                    };
                    onAddPlace(place);
                    setSaved((prev) => [place, ...prev]);
                    alert('Saved locally. Will sync later.');
                  } finally {
                    setNewPlaceName('');
                    setNewPlaceAddress('');
                    setNewPlaceCategory('home');
                    setAddPlaceOpen(false);
                  }
                }}
              >
                Save Place
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create List Dialog */}
      <Dialog open={addListOpen} onOpenChange={setAddListOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create a new list</DialogTitle>
            <DialogDescription>Organize places into custom lists.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input placeholder="List name" value={newListName} onChange={(e) => setNewListName(e.target.value)} />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setAddListOpen(false)}>Cancel</Button>
              <Button
                onClick={() => {
                  if (!newListName.trim()) return;
                  const id = newListName.trim().toLowerCase().replace(/\s+/g, '-');
                  setLists((prev) => [
                    ...prev,
                    { id, name: newListName.trim(), count: 0, places: [] },
                  ]);
                  setNewListName('');
                  setAddListOpen(false);
                }}
              >
                Create List
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* List Details Dialog */}
      <Dialog open={!!activeListId} onOpenChange={(open: boolean) => !open && setActiveListId(null)}>
        <DialogContent>
          {(() => {
            const list = lists.find((l) => l.id === activeListId);
            if (!list) return null;
            return (
              <>
                <DialogHeader>
                  <DialogTitle>{list.name}</DialogTitle>
                  <DialogDescription>{list.count} places</DialogDescription>
                </DialogHeader>
                <div className="space-y-3">
                  {list.places.map((p) => (
                    <div key={p.id} className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{p.name}</p>
                        <p className="text-xs text-gray-500">{p.address}</p>
                      </div>
                      <Button size="sm" variant="outline" onClick={() => onLocationSelect(p)}>
                        <Navigation className="w-4 h-4 mr-2" /> Navigate
                      </Button>
                    </div>
                  ))}
                  {list.places.length === 0 && (
                    <p className="text-sm text-gray-500">No places yet.</p>
                  )}
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}