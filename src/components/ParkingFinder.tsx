import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft,
  Car,
  Clock,
  DollarSign,
  MapPin,
  Navigation,
  Star,
  Filter,
  CreditCard,
  Timer,
  Info,
  CheckCircle,
  AlertCircle,
  TrendingUp,
  Search
} from 'lucide-react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Progress } from './ui/progress';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './ui/tabs';
import { Alert, AlertDescription } from './ui/alert';
import { logger } from '../utils/logger';
import { toast } from 'sonner';

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
}

interface ParkingFinderProps {
  onBack: () => void;
  destination?: string;
}

export function ParkingFinder({ onBack, destination }: ParkingFinderProps) {
  const [searchQuery, setSearchQuery] = useState(destination || '');
  const [selectedSpot, setSelectedSpot] = useState<ParkingSpot | null>(null);
  const [filterType, setFilterType] = useState<'all' | 'street' | 'garage' | 'lot'>('all');
  const [sortBy, setSortBy] = useState<'distance' | 'price' | 'availability'>('distance');
  const [showPayment, setShowPayment] = useState(false);
  const [parkingSpots, setParkingSpots] = useState<ParkingSpot[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (searchQuery) {
      searchParkingSpots();
    }
  }, [filterType, sortBy]);

  const searchParkingSpots = () => {
    setLoading(true);
    // Simulate API call
    setTimeout(() => {
      setParkingSpots([
        {
          id: '1',
          name: 'Downtown Garage',
          type: 'garage',
          distance: '0.2 mi',
          walkTime: '3 min',
          price: '$4/hr',
          availability: 85,
          rating: 4.5,
          features: ['Covered', 'EV Charging', 'Security', 'Wheelchair Access'],
          hours: '24/7',
          address: '123 Main St'
        },
        {
          id: '2',
          name: 'Street Parking - 5th Ave',
          type: 'street',
          distance: '0.1 mi',
          walkTime: '2 min',
          price: '$2/hr',
          availability: 30,
          rating: 3.8,
          features: ['Metered', '2hr Max'],
          hours: '8am-6pm',
          address: '5th Avenue'
        },
        {
          id: '3',
          name: 'Plaza Parking Lot',
          type: 'lot',
          distance: '0.4 mi',
          walkTime: '6 min',
          price: '$3/hr',
          availability: 60,
          rating: 4.2,
          features: ['Open Air', 'Security Cameras'],
          hours: '6am-11pm',
          address: '789 Plaza Dr'
        },
        {
          id: '4',
          name: 'Valet Service - Hotel Grand',
          type: 'valet',
          distance: '0.3 mi',
          walkTime: '4 min',
          price: '$20 flat',
          availability: 95,
          rating: 4.8,
          features: ['Full Service', 'Indoor Parking'],
          hours: '24/7',
          address: '456 Hotel Ave'
        }
      ]);
      setLoading(false);
    }, 1000);
  };

  const getAvailabilityColor = (availability: number) => {
    if (availability > 70) return 'text-green-600';
    if (availability > 30) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'street': return '🚗';
      case 'garage': return '🏢';
      case 'lot': return '🅿️';
      case 'valet': return '🎩';
      default: return '🚗';
    }
  };

  const handleReserveSpot = (spot: ParkingSpot) => {
    setSelectedSpot(spot);
    setShowPayment(true);
  };

  return (
    <div className="h-full bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 bg-white px-4 py-4 border-b border-gray-200">
        <div className="flex items-center gap-3 mb-3">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <h2 className="font-semibold text-gray-900">Find Parking</h2>
            <p className="text-sm text-gray-500">Near your destination</p>
          </div>
          <Button variant="outline" size="icon">
            <Filter className="w-4 h-4" />
          </Button>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search destination for parking"
            className="pl-10"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Filters */}
        <div className="px-4 py-3 bg-white border-b">
          <div className="flex gap-2 overflow-x-auto">
            {(['all', 'street', 'garage', 'lot'] as const).map((type) => (
              <Button
                key={type}
                variant={filterType === type ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilterType(type)}
                className="whitespace-nowrap"
              >
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </Button>
            ))}
          </div>
        </div>

        {/* Sort Options */}
        <div className="px-4 py-2 flex items-center justify-between bg-gray-100">
          <span className="text-sm text-gray-600">Sort by:</span>
          <div className="flex gap-2">
            {(['distance', 'price', 'availability'] as const).map((sort) => (
              <Badge
                key={sort}
                variant={sortBy === sort ? 'default' : 'outline'}
                className="cursor-pointer"
                onClick={() => setSortBy(sort)}
              >
                {sort.charAt(0).toUpperCase() + sort.slice(1)}
              </Badge>
            ))}
          </div>
        </div>

        {/* Parking Spots List */}
        {loading ? (
          <div className="p-4">
            <div className="animate-pulse space-y-3">
              {[1, 2, 3].map(i => (
                <Card key={i} className="p-4">
                  <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
                  <div className="h-3 bg-gray-100 rounded w-1/2" />
                </Card>
              ))}
            </div>
          </div>
        ) : (
          <div className="p-4 space-y-3">
            {parkingSpots.map((spot) => (
              <Card key={spot.id} className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-start gap-3">
                    <div className="text-2xl">{getTypeIcon(spot.type)}</div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{spot.name}</h3>
                      <p className="text-sm text-gray-500">{spot.address}</p>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-xs text-gray-600 flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {spot.distance}
                        </span>
                        <span className="text-xs text-gray-600 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {spot.walkTime} walk
                        </span>
                        <span className="text-xs text-gray-600 flex items-center gap-1">
                          <Timer className="w-3 h-3" />
                          {spot.hours}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-gray-900">{spot.price}</div>
                    <div className="flex items-center gap-1 mt-1">
                      <Star className="w-3 h-3 text-yellow-500 fill-current" />
                      <span className="text-xs text-gray-600">{spot.rating}</span>
                    </div>
                  </div>
                </div>

                {/* Availability Bar */}
                <div className="mb-3">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-600">Availability</span>
                    <span className={`font-medium ${getAvailabilityColor(spot.availability)}`}>
                      {spot.availability}% available
                    </span>
                  </div>
                  <Progress value={spot.availability} className="h-2" />
                </div>

                {/* Features */}
                <div className="flex flex-wrap gap-1 mb-3">
                  {spot.features.map((feature, idx) => (
                    <Badge key={idx} variant="secondary" className="text-xs">
                      {feature}
                    </Badge>
                  ))}
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <Button 
                    className="flex-1" 
                    variant="outline"
                    onClick={() => {
                      // Start navigation to the selected parking spot
                      window.location.href = `https://maps.apple.com/?daddr=${encodeURIComponent(spot.address)}`;
                      // Alternative for Android: window.location.href = `geo:0,0?q=${encodeURIComponent(spot.address)}`;
                      logger.info(`Navigation started to parking spot: ${spot.name}`);
                      toast.success(`Starting navigation to ${spot.name}`);
                    }}
                  >
                    <Navigation className="w-4 h-4 mr-1" />
                    Navigate
                  </Button>
                  <Button 
                    className="flex-1"
                    onClick={() => handleReserveSpot(spot)}
                  >
                    Reserve Spot
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Parking History */}
        <div className="px-4 pb-4">
          <h3 className="font-semibold text-gray-900 mb-3">Recent Parking</h3>
          <Card className="p-3">
            <div className="space-y-2">
              {[
                { place: 'Downtown Garage', date: 'Yesterday', cost: '$12' },
                { place: 'Street - Main St', date: '3 days ago', cost: '$6' },
                { place: 'Airport Lot B', date: 'Last week', cost: '$45' }
              ].map((history, idx) => (
                <div key={idx} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div>
                    <div className="font-medium text-sm">{history.place}</div>
                    <div className="text-xs text-gray-500">{history.date}</div>
                  </div>
                  <span className="text-sm font-medium">{history.cost}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Tips */}
        <Alert className="mx-4 mb-4">
          <Info className="w-4 h-4" />
          <AlertDescription>
            💡 Tip: Book parking in advance during events to save up to 50% and guarantee a spot!
          </AlertDescription>
        </Alert>
      </div>

      {/* Payment Modal */}
      {showPayment && selectedSpot && (
        <div className="absolute inset-0 bg-black/50 flex items-end">
          <Card className="w-full rounded-t-2xl p-6">
            <h3 className="font-semibold text-lg mb-4">Reserve Parking</h3>
            
            <div className="space-y-4">
              <div className="p-3 bg-gray-50 rounded-lg">
                <div className="font-medium">{selectedSpot.name}</div>
                <div className="text-sm text-gray-500">{selectedSpot.address}</div>
                <div className="mt-2 flex justify-between">
                  <span className="text-sm">Duration:</span>
                  <span className="font-medium">2 hours</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Total:</span>
                  <span className="font-bold text-lg">$8.00</span>
                </div>
              </div>

              <div className="space-y-3">
                <Button 
                  className="w-full" 
                  size="lg"
                  onClick={() => {
                    // Simulate card payment processing
                    logger.info(`Processing card payment for parking spot: ${selectedSpot.name}`);
                    toast.loading('Processing payment...');
                    
                    setTimeout(() => {
                      toast.success('Parking reserved successfully!');
                      logger.info(`Parking reservation confirmed: ${selectedSpot.name}`);
                      setShowPayment(false);
                      setSelectedSpot(null);
                    }, 2000);
                  }}
                >
                  <CreditCard className="w-4 h-4 mr-2" />
                  Pay with Card
                </Button>
                <Button 
                  className="w-full" 
                  variant="outline" 
                  size="lg"
                  onClick={() => {
                    // Simulate Apple Pay processing
                    logger.info(`Processing Apple Pay for parking spot: ${selectedSpot.name}`);
                    
                    if ('PaymentRequest' in window) {
                      // Real Apple Pay integration would go here
                      toast.success('Apple Pay not available in demo');
                    } else {
                      toast.info('Apple Pay not supported on this device');
                    }
                  }}
                >
                  Pay with Apple Pay
                </Button>
                <Button 
                  className="w-full" 
                  variant="ghost"
                  onClick={() => setShowPayment(false)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}