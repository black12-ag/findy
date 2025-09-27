import React, { useState, useEffect } from 'react';
import { MapPin, Home, Briefcase, Dumbbell, Coffee, ShoppingBag, Heart, Star, Navigation, Save, X } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Label } from './ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Badge } from './ui/badge';
import { placesService } from '../services/places';
import { logger } from '../utils/logger';
import { toast } from 'sonner';

interface Location {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  category?: string;
  notes?: string;
  tags?: string[];
}

interface SaveLocationModalProps {
  location: Location | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (location: Location) => void;
  existingSavedPlaces?: Location[];
}

const CATEGORIES = [
  { value: 'home', label: 'Home', icon: Home, color: '#10B981' },
  { value: 'work', label: 'Work', icon: Briefcase, color: '#3B82F6' },
  { value: 'gym', label: 'Gym', icon: Dumbbell, color: '#8B5CF6' },
  { value: 'restaurant', label: 'Restaurant', icon: Coffee, color: '#F59E0B' },
  { value: 'shopping', label: 'Shopping', icon: ShoppingBag, color: '#EC4899' },
  { value: 'favorite', label: 'Favorite', icon: Heart, color: '#EF4444' },
  { value: 'other', label: 'Other', icon: MapPin, color: '#6B7280' },
];

const SUGGESTED_TAGS = [
  'parking available',
  'wheelchair accessible',
  'good wifi',
  'quiet',
  'open late',
  'family friendly',
  'outdoor seating',
  'pet friendly',
];

export function SaveLocationModal({ 
  location, 
  isOpen, 
  onClose, 
  onSave,
  existingSavedPlaces = []
}: SaveLocationModalProps) {
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [category, setCategory] = useState('other');
  const [notes, setNotes] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [customTag, setCustomTag] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isExistingPlace, setIsExistingPlace] = useState(false);

  useEffect(() => {
    if (location && isOpen) {
      setName(location.name || '');
      setAddress(location.address || '');
      setCategory(location.category || 'other');
      setNotes(location.notes || '');
      setTags(location.tags || []);
      
      // Check if this place already exists
      const exists = existingSavedPlaces.some(
        p => Math.abs(p.lat - location.lat) < 0.0001 && Math.abs(p.lng - location.lng) < 0.0001
      );
      setIsExistingPlace(exists);
    }
  }, [location, isOpen, existingSavedPlaces]);

  const getCategoryIcon = (categoryValue: string) => {
    const cat = CATEGORIES.find(c => c.value === categoryValue);
    const Icon = cat?.icon || MapPin;
    return <Icon className="w-5 h-5" />;
  };

  const getCategoryColor = (categoryValue: string) => {
    const cat = CATEGORIES.find(c => c.value === categoryValue);
    return cat?.color || '#6B7280';
  };

  const handleAddTag = (tag: string) => {
    if (tag && !tags.includes(tag)) {
      setTags([...tags, tag]);
    }
  };

  const handleRemoveTag = (tag: string) => {
    setTags(tags.filter(t => t !== tag));
  };

  const handleAddCustomTag = () => {
    if (customTag.trim()) {
      handleAddTag(customTag.trim());
      setCustomTag('');
    }
  };

  const handleSave = async () => {
    if (!location || !name.trim()) {
      toast.error('Please provide a name for this location');
      return;
    }

    setIsSaving(true);

    try {
      const savedLocation: Location = {
        ...location,
        id: location.id || `saved_${Date.now()}`,
        name: name.trim(),
        address: address.trim() || location.address,
        category,
        notes: notes.trim(),
        tags,
      };

      // Save to backend
      try {
        const response = await placesService.savePlace({
          googlePlaceId: savedLocation.id,
          name: savedLocation.name,
          address: savedLocation.address,
          location: { lat: savedLocation.lat, lng: savedLocation.lng },
          category: savedLocation.category,
          notes: savedLocation.notes,
          tags: savedLocation.tags,
        });
        
        logger.info('Place saved to backend:', response);
        toast.success(`${savedLocation.name} saved to your places!`);
      } catch (error) {
        logger.warn('Failed to save to backend, saving locally:', error);
        toast.info('Saved locally (will sync when online)');
      }

      // Save to local storage as backup
      const savedPlaces = JSON.parse(localStorage.getItem('saved_places') || '[]');
      const updatedPlaces = [savedLocation, ...savedPlaces.filter((p: Location) => p.id !== savedLocation.id)];
      localStorage.setItem('saved_places', JSON.stringify(updatedPlaces.slice(0, 50))); // Keep last 50

      onSave(savedLocation);
      onClose();
      
      // Reset form
      setName('');
      setAddress('');
      setCategory('other');
      setNotes('');
      setTags([]);
      setCustomTag('');
    } catch (error) {
      logger.error('Failed to save location:', error);
      toast.error('Failed to save location. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Save className="w-5 h-5 text-blue-600" />
            {isExistingPlace ? 'Update Saved Place' : 'Save This Location'}
          </DialogTitle>
          <DialogDescription>
            Add this location to your saved places for quick access
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Location preview */}
          <div className="bg-gray-50 rounded-lg p-3 flex items-center gap-3">
            <div 
              className="w-10 h-10 rounded-full flex items-center justify-center text-white"
              style={{ backgroundColor: getCategoryColor(category) }}
            >
              {getCategoryIcon(category)}
            </div>
            <div className="flex-1">
              <p className="text-sm text-gray-600">
                {location ? `${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}` : 'No location'}
              </p>
            </div>
          </div>

          {/* Name field */}
          <div className="space-y-2">
            <Label htmlFor="place-name">Name *</Label>
            <Input
              id="place-name"
              placeholder="e.g., My favorite coffee shop"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>

          {/* Address field */}
          <div className="space-y-2">
            <Label htmlFor="place-address">Address</Label>
            <Input
              id="place-address"
              placeholder="Enter address or leave blank for GPS coordinates"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
          </div>

          {/* Category selector */}
          <div className="space-y-2">
            <Label htmlFor="place-category">Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger id="place-category">
                <div className="flex items-center gap-2">
                  <div 
                    className="w-5 h-5 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: getCategoryColor(category) }}
                  >
                    {getCategoryIcon(category)}
                  </div>
                  <SelectValue />
                </div>
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((cat) => {
                  const Icon = cat.icon;
                  return (
                    <SelectItem key={cat.value} value={cat.value}>
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-5 h-5 rounded-full flex items-center justify-center"
                          style={{ backgroundColor: cat.color }}
                        >
                          <Icon className="w-3 h-3 text-white" />
                        </div>
                        <span>{cat.label}</span>
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          {/* Notes field */}
          <div className="space-y-2">
            <Label htmlFor="place-notes">Notes</Label>
            <Textarea
              id="place-notes"
              placeholder="Add any notes about this place..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>

          {/* Tags */}
          <div className="space-y-2">
            <Label>Tags</Label>
            
            {/* Selected tags */}
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-2">
                {tags.map((tag) => (
                  <Badge
                    key={tag}
                    variant="secondary"
                    className="cursor-pointer"
                    onClick={() => handleRemoveTag(tag)}
                  >
                    {tag}
                    <X className="w-3 h-3 ml-1" />
                  </Badge>
                ))}
              </div>
            )}

            {/* Suggested tags */}
            <div className="flex flex-wrap gap-1">
              {SUGGESTED_TAGS.filter(t => !tags.includes(t)).map((tag) => (
                <Badge
                  key={tag}
                  variant="outline"
                  className="cursor-pointer hover:bg-gray-100"
                  onClick={() => handleAddTag(tag)}
                >
                  + {tag}
                </Badge>
              ))}
            </div>

            {/* Custom tag input */}
            <div className="flex gap-2 mt-2">
              <Input
                placeholder="Add custom tag"
                value={customTag}
                onChange={(e) => setCustomTag(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleAddCustomTag()}
                className="flex-1"
              />
              <Button
                type="button"
                variant="outline"
                onClick={handleAddCustomTag}
                disabled={!customTag.trim()}
              >
                Add
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving || !name.trim()}>
            {isSaving ? (
              <>
                <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                {isExistingPlace ? 'Update Place' : 'Save Place'}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}