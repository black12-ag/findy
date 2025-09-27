import React, { useState } from 'react';
import { X, Navigation, Star, Clock, DollarSign, MapPin, Car } from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Card } from './ui/card';
import { ScrollArea } from './ui/scroll-area';
import { Progress } from './ui/progress';

interface ParkingSpot {
  id: string;
  name: string;
  type: 'street' | 'garage' | 'lot' | 'valet';
  distance: string;
  walkTime: string;
  price: string;
  availability: number;
  rating: number;
  features: string[];
  hours: string;
  address: string;
  location?: { lat: number; lng: number };
}

interface ParkingResultsOverlayProps {
  parkingSpots: ParkingSpot[];
  onClose: () => void;
  onSpotSelect: (spot: ParkingSpot) => void;
  onNavigateToSpot: (spot: ParkingSpot) => void;
  className?: string;
}

export function ParkingResultsOverlay({
  parkingSpots,
  onClose,
  onSpotSelect,
  onNavigateToSpot,
  className = ''
}: ParkingResultsOverlayProps) {
  const [selectedSpotId, setSelectedSpotId] = useState<string | null>(null);

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'street': return '🚗';
      case 'garage': return '🏢';
      case 'lot': return '🅿️';
      case 'valet': return '🎩';
      default: return '🚗';
    }
  };

  const getAvailabilityColor = (availability: number) => {
    if (availability > 70) return 'text-green-600';
    if (availability > 30) return 'text-yellow-600';
    return 'text-red-600';
  };

  const handleSpotClick = (spot: ParkingSpot) => {
    setSelectedSpotId(spot.id);
    onSpotSelect(spot);
  };

  return (
    <div className={`absolute top-4 left-4 w-96 max-h-[calc(100vh-8rem)] bg-white rounded-xl shadow-lg border z-40 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div>
          <h3 className="font-semibold text-gray-900">Parking Spots</h3>
          <p className="text-sm text-gray-500">{parkingSpots.length} spots found</p>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Results List */}
      <ScrollArea className="max-h-[60vh]">
        <div className="p-4 space-y-3">
          {parkingSpots.map((spot) => (
            <Card 
              key={spot.id} 
              className={`p-3 cursor-pointer transition-all hover:shadow-md ${
                selectedSpotId === spot.id ? 'ring-2 ring-blue-500 bg-blue-50' : ''
              }`}
              onClick={() => handleSpotClick(spot)}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-start gap-3">
                  <div className="text-2xl">{getTypeIcon(spot.type)}</div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-gray-900 text-sm">{spot.name}</h4>
                    <p className="text-xs text-gray-500">{spot.address}</p>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-xs text-gray-600 flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {spot.distance}
                      </span>
                      <span className="text-xs text-gray-600 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {spot.walkTime} walk
                      </span>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold text-gray-900">{spot.price}</div>
                  <div className="flex items-center gap-1 mt-1">
                    <Star className="w-3 h-3 text-yellow-500 fill-current" />
                    <span className="text-xs text-gray-600">{spot.rating}</span>
                  </div>
                </div>
              </div>

              {/* Availability Bar */}
              <div className="mb-2">
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-gray-600">Availability</span>
                  <span className={`font-medium ${getAvailabilityColor(spot.availability)}`}>
                    {spot.availability}% available
                  </span>
                </div>
                <Progress value={spot.availability} className="h-1.5" />
              </div>

              {/* Features */}
              <div className="flex flex-wrap gap-1 mb-3">
                {spot.features.map((feature, idx) => (
                  <Badge key={idx} variant="secondary" className="text-xs px-2 py-0.5">
                    {feature}
                  </Badge>
                ))}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2">
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="flex-1 h-8 text-xs"
                  onClick={(e) => {
                    e.stopPropagation();
                    onNavigateToSpot(spot);
                  }}
                >
                  <Navigation className="w-3 h-3 mr-1" />
                  Navigate
                </Button>
                <Button 
                  size="sm"
                  className="flex-1 h-8 text-xs bg-blue-600 hover:bg-blue-700"
                  onClick={(e) => {
                    e.stopPropagation();
                    // Handle parking reservation
                    console.log('Reserve parking:', spot);
                  }}
                >
                  Reserve
                </Button>
              </div>
            </Card>
          ))}
        </div>
      </ScrollArea>

      {/* Footer */}
      <div className="p-4 border-t bg-gray-50 rounded-b-xl">
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>🟢 High availability • 🟡 Medium • 🔴 Low</span>
          <Button 
            variant="link" 
            size="sm" 
            className="text-xs h-auto p-0"
            onClick={onClose}
          >
            View on map
          </Button>
        </div>
      </div>
    </div>
  );
}