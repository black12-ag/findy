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
import { useLocation } from '../contexts/LocationContext';
import { useNavigation } from '../contexts/NavigationContext';
import { aiPredictionsService } from '../services/aiPredictionsService';

interface ParkingSpot {
  id: string;
  placeId?: string;
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

interface ParkingFinderProps {
  onBack: () => void;
  destination?: string;
  map?: google.maps.Map;
  onNavigateToParking?: (spot: ParkingSpot) => void;
  onParkingResults?: (spots: ParkingSpot[]) => void;
}

export function ParkingFinder({ onBack, destination, map, onNavigateToParking, onParkingResults }: ParkingFinderProps) {
  const { currentLocation } = useLocation();
  const { setSelectedLocation, calculateRoute } = useNavigation();
  const [searchQuery, setSearchQuery] = useState(destination || '');
  const [selectedSpot, setSelectedSpot] = useState<ParkingSpot | null>(null);
  const [filterType, setFilterType] = useState<'all' | 'street' | 'garage' | 'lot'>('all');
  const [sortBy, setSortBy] = useState<'distance' | 'price' | 'availability'>('distance');
  const [showPayment, setShowPayment] = useState(false);
  const [parkingSpots, setParkingSpots] = useState<ParkingSpot[]>([]);
  const [loading, setLoading] = useState(false);
  const [parkingMarkers, setParkingMarkers] = useState<google.maps.Marker[]>([]);
  const [isShowingRealData, setIsShowingRealData] = useState(true);

  // Initialize map service
  useEffect(() => {
    if (map && window.google) {
      aiPredictionsService.initialize(map);
    }
  }, [map]);

  // Clear markers on unmount
  useEffect(() => {
    return () => {
      parkingMarkers.forEach(marker => marker.setMap(null));
    };
  }, [parkingMarkers]);

  // Trigger search on mount and whenever query, filters, or location changes
  useEffect(() => {
    searchParkingSpots();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterType, sortBy, searchQuery, currentLocation?.lat, currentLocation?.lng]);

  const calculateDistance = (from: { lat: number; lng: number }, to: { lat: number; lng: number }) => {
    if (!window.google || !window.google.maps.geometry) return 0;
    const fromLatLng = new google.maps.LatLng(from.lat, from.lng);
    const toLatLng = new google.maps.LatLng(to.lat, to.lng);
    return google.maps.geometry.spherical.computeDistanceBetween(fromLatLng, toLatLng);
  };

  const searchParkingSpots = async () => {
    if (!currentLocation) return;
    setLoading(true);
    
    try {
      // Clear existing markers
      parkingMarkers.forEach(marker => marker.setMap(null));
      setParkingMarkers([]);

      // Search for destination if provided, otherwise use current location
      const searchLocation = destination && searchQuery 
        ? await searchForDestination(searchQuery)
        : currentLocation;

      if (!searchLocation) {
        throw new Error('Could not determine search location');
      }

      // Use Google Maps Places API to find parking
      logger.info('Attempting to find parking spots via Google Places API', { searchLocation });
      const parkingPrediction = await aiPredictionsService.predictParking(searchLocation);
      
      logger.info('Parking prediction result:', { 
        spotsFound: parkingPrediction.nearbySpots.length,
        spots: parkingPrediction.nearbySpots.map(s => ({ name: s.name, placeId: s.placeId }))
      });
      
      if (parkingPrediction.nearbySpots.length > 0) {
        // Convert to ParkingSpot format
        const spots: ParkingSpot[] = parkingPrediction.nearbySpots.map(spot => {
          const distanceMeters = calculateDistance(currentLocation, spot.location);
          const distanceMiles = distanceMeters * 0.000621371;
          const walkMinutes = Math.round((spot.walkingDistance || distanceMeters) / 80); // ~80m/min walking
          
          // Determine type based on Google Places types
          let type: ParkingSpot['type'] = 'garage';
          if (spot.type === 'street') type = 'street';
          else if (spot.type === 'lot') type = 'lot';
          
          return {
            id: spot.placeId,
            placeId: spot.placeId,
            name: spot.name,
            type,
            distance: `${distanceMiles.toFixed(1)} mi`,
            walkTime: `${walkMinutes} min`,
            price: spot.pricing,
            availability: spot.availability,
            rating: 4.0 + (spot.availability / 100), // Estimate rating from availability
            features: type === 'garage' ? ['Covered', 'Security'] : ['Metered'],
            hours: '24/7',
            address: spot.name,
            location: spot.location
          };
        });

        // Apply filters
        let filtered = spots;
        if (filterType !== 'all') {
          filtered = filtered.filter(s => s.type === filterType);
        }

        // Apply sorting
        if (sortBy === 'distance') {
          filtered.sort((a, b) => parseFloat(a.distance) - parseFloat(b.distance));
        } else if (sortBy === 'price') {
          const priceToNum = (p: string) => parseFloat(p.replace(/[^0-9.]/g, '') || '0');
          filtered.sort((a, b) => priceToNum(a.price) - priceToNum(b.price));
        } else if (sortBy === 'availability') {
          filtered.sort((a, b) => b.availability - a.availability);
        }

        setParkingSpots(filtered);
        setIsShowingRealData(true);
        
        // Call parent callback with results
        if (onParkingResults) {
          onParkingResults(filtered);
        }
        
        // Add markers to map if available
        if (map && filtered.length > 0) {
          const spotsWithLocation = filtered.filter(s => s.location);
          const markers = aiPredictionsService.addParkingMarkers(
            spotsWithLocation.map(s => ({
              placeId: s.placeId || s.id,
              location: s.location!,
              name: s.name,
              pricing: s.price,
              availability: s.availability,
              walkingDistance: parseInt(s.walkTime) * 80,
              type: s.type === 'garage' ? 'garage' : s.type === 'lot' ? 'lot' : 'street'
            })),
            map
          );
          setParkingMarkers(markers);
          
          // Center map on parking area
          if (spotsWithLocation[0]?.location) {
            map.setCenter(spotsWithLocation[0].location);
            map.setZoom(15);
          }
        }
      } else {
        // Fallback to mock data if no results
        logger.warn('No real parking spots found, using mock data');
        toast.info('Using sample parking data for your area');
        const mockSpots = getMockParkingSpots();
        setParkingSpots(mockSpots);
        setIsShowingRealData(false);
        if (onParkingResults) {
          onParkingResults(mockSpots);
        }
      }
    } catch (error) {
      logger.error('Failed to search parking spots', { error: error.message });
      toast.error('Google Places API error. Showing sample data.');
      const mockSpots = getMockParkingSpots();
      setParkingSpots(mockSpots);
      setIsShowingRealData(false);
      if (onParkingResults) {
        onParkingResults(mockSpots);
      }
    } finally {
      setLoading(false);
    }
  };

  const searchForDestination = async (query: string): Promise<{ lat: number; lng: number } | null> => {
    if (!window.google) return null;
    
    return new Promise((resolve) => {
      const geocoder = new google.maps.Geocoder();
      geocoder.geocode({ address: query }, (results, status) => {
        if (status === 'OK' && results && results[0]) {
          const location = results[0].geometry.location;
          resolve({ lat: location.lat(), lng: location.lng() });
        } else {
          resolve(null);
        }
      });
    });
  };

  const getMockParkingSpots = (): ParkingSpot[] => [
    {
      id: 'mock1',
      name: 'City Center Garage',
      type: 'garage',
      distance: '0.2 mi',
      walkTime: '3 min',
      price: '$4/hr',
      availability: 85,
      rating: 4.5,
      features: ['Covered', 'Security', 'EV Charging'],
      hours: '24/7',
      address: '123 Main St',
      location: currentLocation ? 
        { lat: currentLocation.lat + 0.002, lng: currentLocation.lng + 0.001 } : undefined
    },
    {
      id: 'mock2',
      name: 'Street Parking - Oak Ave',
      type: 'street',
      distance: '0.1 mi',
      walkTime: '2 min',
      price: '$2/hr',
      availability: 45,
      rating: 4.0,
      features: ['Metered', '2hr Max'],
      hours: '8AM-6PM',
      address: 'Oak Ave',
      location: currentLocation ?
        { lat: currentLocation.lat + 0.001, lng: currentLocation.lng } : undefined
    },
    {
      id: 'mock3',
      name: 'Park & Ride Lot',
      type: 'lot',
      distance: '0.5 mi',
      walkTime: '7 min',
      price: '$10/day',
      availability: 92,
      rating: 4.3,
      features: ['Shuttle Service', 'Security'],
      hours: '5AM-12AM',
      address: '456 Park Rd',
      location: currentLocation ?
        { lat: currentLocation.lat - 0.003, lng: currentLocation.lng + 0.002 } : undefined
    }
  ];

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

  const handleNavigateToSpot = (spot: ParkingSpot) => {
    if (spot.location) {
      // Set the parking spot as destination
      setSelectedLocation({
        lat: spot.location.lat,
        lng: spot.location.lng,
        name: spot.name,
        address: spot.address
      });
      
      // Trigger route calculation
      if (currentLocation) {
        calculateRoute(currentLocation, {
          lat: spot.location.lat,
          lng: spot.location.lng,
          name: spot.name,
          address: spot.address
        }, 'driving');
      }
      
      toast.success(`Navigation started to ${spot.name}`);
      logger.info('Navigation started to parking spot', { spot });
      
      // Call parent navigation handler if provided
      if (onNavigateToParking) {
        onNavigateToParking(spot);
      }
    } else {
      // Fallback to external maps
      window.location.href = `https://maps.google.com/?q=${encodeURIComponent(spot.address)}`;
    }
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
            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
              Find Parking
              {!isShowingRealData && (
                <Badge variant="outline" className="text-xs text-orange-600 border-orange-300">
                  Demo Data
                </Badge>
              )}
            </h2>
            <p className="text-sm text-gray-500">
              {isShowingRealData ? 'Live parking data from Google Places' : 'Sample parking data for your area'}
            </p>
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
                    onClick={() => handleNavigateToSpot(spot)}
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