import React, { useState } from 'react';
import { 
  MapPin, 
  Star, 
  Phone, 
  Globe, 
  Clock, 
  Navigation, 
  Share2, 
  Heart,
  Camera,
  ThumbsUp,
  ThumbsDown,
  ChevronDown,
  ChevronUp,
  DollarSign,
  Accessibility,
  Wifi,
  Car,
  CreditCard
} from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Card } from './ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from './ui/sheet';

interface PlaceDetails {
  id: string;
  name: string;
  address: string;
  category: string;
  rating: number;
  reviewCount: number;
  priceLevel: number;
  isOpen: boolean;
  openHours: string;
  phone?: string;
  website?: string;
  photos: string[];
  amenities: string[];
  reviews: Review[];
}

interface Review {
  id: string;
  author: string;
  avatar: string;
  rating: number;
  text: string;
  date: string;
  helpful: number;
}

interface PlaceDetailsSheetProps {
  place: PlaceDetails | null;
  isOpen: boolean;
  onClose: () => void;
  onNavigate: () => void;
  onShare: () => void;
}

export function PlaceDetailsSheet({ 
  place, 
  isOpen, 
  onClose, 
  onNavigate, 
  onShare 
}: PlaceDetailsSheetProps) {
  const [activeTab, setActiveTab] = useState('overview');
  const [isFavorite, setIsFavorite] = useState(false);
  const [expandedReview, setExpandedReview] = useState<string | null>(null);

  if (!place) return null;

  const mockReviews: Review[] = [
    {
      id: '1',
      author: 'Sarah M.',
      avatar: 'SM',
      rating: 5,
      text: 'Amazing coffee and great atmosphere! The baristas are very knowledgeable and friendly. Perfect spot for remote work.',
      date: '2 days ago',
      helpful: 12
    },
    {
      id: '2', 
      author: 'Mike Chen',
      avatar: 'MC',
      rating: 4,
      text: 'Good coffee, but can get quite crowded during peak hours. Food options are limited but tasty.',
      date: '1 week ago',
      helpful: 8
    },
    {
      id: '3',
      author: 'Emma R.',
      avatar: 'ER', 
      rating: 5,
      text: 'Love this place! They have the best oat milk latte in the city. Parking can be tricky but worth it.',
      date: '2 weeks ago',
      helpful: 15
    }
  ];

  const getPriceDisplay = (level: number) => {
    return '$'.repeat(level) + '·'.repeat(4 - level);
  };

  const getAmenityIcon = (amenity: string) => {
    switch (amenity.toLowerCase()) {
      case 'wifi': return <Wifi className="w-4 h-4" />;
      case 'parking': return <Car className="w-4 h-4" />;
      case 'accessible': return <Accessibility className="w-4 h-4" />;
      case 'cards': return <CreditCard className="w-4 h-4" />;
      default: return null;
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="bottom" className="h-[90vh] sm:h-[85vh] p-0 sheet-mobile">
        <div className="flex flex-col h-full">
          {/* Header */}
          <SheetHeader className="p-3 sm:p-6 pb-3 sm:pb-4 border-b">
            <div className="flex items-start justify-between">
              <div className="flex-1 pr-2 sm:pr-4 min-w-0">
                <SheetTitle className="text-lg sm:text-xl font-bold mb-1 sm:mb-2 truncate">{place.name}</SheetTitle>
                <div className="flex items-center gap-2 sm:gap-3 mb-1 sm:mb-2 text-xs sm:text-sm">
                  <div className="flex items-center gap-1">
                    <Star className="w-3 h-3 sm:w-4 sm:h-4 text-yellow-400 fill-current" />
                    <span className="font-medium">{place.rating}</span>
                    <span className="text-gray-500">({place.reviewCount})</span>
                  </div>
                  <span className="text-gray-400">•</span>
                  <span className="text-gray-600">{getPriceDisplay(place.priceLevel)}</span>
                  <span className="text-gray-400 hidden sm:inline">•</span>
                  <Badge variant={place.isOpen ? "default" : "secondary"} className="text-xs">
                    {place.isOpen ? 'Open' : 'Closed'}
                  </Badge>
                </div>
                <div className="flex items-center gap-2 text-xs sm:text-sm text-gray-600">
                  <MapPin className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
                  <span className="truncate">{place.address}</span>
                </div>
              </div>
              
              <div className="flex sm:flex-col gap-1 sm:gap-2 flex-shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsFavorite(!isFavorite)}
                  className="h-8 w-8 sm:h-10 sm:w-10"
                >
                  <Heart className={`w-4 h-4 sm:w-5 sm:h-5 ${isFavorite ? 'fill-red-500 text-red-500' : 'text-gray-500'}`} />
                </Button>
                <Button variant="ghost" size="icon" onClick={onShare} className="h-8 w-8 sm:h-10 sm:w-10">
                  <Share2 className="w-3 h-3 sm:w-4 sm:h-4" />
                </Button>
              </div>
            </div>
          </SheetHeader>

          {/* Photos */}
          <div className="flex-shrink-0 px-3 sm:px-6 py-3 sm:py-4">
            <div className="flex gap-2 sm:gap-3 overflow-x-auto pb-2 hide-scrollbar">
              {[...Array(5)].map((_, i) => (
                <div
                  key={i}
                  className="relative w-20 h-20 sm:w-24 sm:h-24 bg-gray-200 rounded-lg flex-shrink-0 overflow-hidden"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-100 to-purple-100 flex items-center justify-center">
                    <Camera className="w-4 h-4 sm:w-6 sm:h-6 text-gray-400" />
                  </div>
                  {i === 4 && (
                    <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
                      <span className="text-white text-xs font-medium">+12</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex-shrink-0 px-3 sm:px-6 pb-3 sm:pb-4">
            <div className="grid grid-cols-2 gap-2 sm:gap-3">
              <Button onClick={onNavigate} className="flex items-center gap-2 touch-manipulation">
                <Navigation className="w-3 h-3 sm:w-4 sm:h-4" />
                <span className="text-sm sm:text-base">Directions</span>
              </Button>
              <Button variant="outline" className="flex items-center gap-2 touch-manipulation">
                <Phone className="w-3 h-3 sm:w-4 sm:h-4" />
                <span className="text-sm sm:text-base">Call</span>
              </Button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex-1 min-h-0">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col h-full">
              <div className="flex-shrink-0 px-6 border-b">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="reviews">Reviews</TabsTrigger>
                  <TabsTrigger value="photos">Photos</TabsTrigger>
                </TabsList>
              </div>

              <div className="flex-1 overflow-y-auto">
                <TabsContent value="overview" className="p-6 space-y-4">
                  {/* Hours */}
                  <Card className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-medium">Hours</h3>
                      <Badge variant={place.isOpen ? "default" : "secondary"}>
                        {place.isOpen ? 'Open Now' : 'Closed'}
                      </Badge>
                    </div>
                    <div className="text-sm text-gray-600">
                      {place.openHours}
                    </div>
                  </Card>

                  {/* Contact Info */}
                  <Card className="p-4">
                    <h3 className="font-medium mb-3">Contact</h3>
                    <div className="space-y-3">
                      {place.phone && (
                        <div className="flex items-center gap-3">
                          <Phone className="w-4 h-4 text-gray-500" />
                          <span className="text-gray-700">{place.phone}</span>
                        </div>
                      )}
                      {place.website && (
                        <div className="flex items-center gap-3">
                          <Globe className="w-4 h-4 text-gray-500" />
                          <span className="text-blue-600">{place.website}</span>
                        </div>
                      )}
                    </div>
                  </Card>

                  {/* Amenities */}
                  <Card className="p-4">
                    <h3 className="font-medium mb-3">Amenities</h3>
                    <div className="grid grid-cols-2 gap-2">
                      {['WiFi', 'Parking', 'Accessible', 'Cards'].map((amenity) => (
                        <div key={amenity} className="flex items-center gap-2 text-sm">
                          {getAmenityIcon(amenity)}
                          <span className="text-gray-700">{amenity}</span>
                        </div>
                      ))}
                    </div>
                  </Card>

                  {/* Popular Times */}
                  <Card className="p-4">
                    <h3 className="font-medium mb-3">Popular Times</h3>
                    <div className="space-y-2">
                      {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, idx) => (
                        <div key={day} className="flex items-center gap-3">
                          <span className="text-sm text-gray-600 w-8">{day}</span>
                          <div className="flex-1 bg-gray-200 rounded-full h-2">
                            <div 
                              className="bg-blue-500 rounded-full h-2"
                              style={{ width: `${20 + Math.random() * 60}%` }}
                            />
                          </div>
                          <span className="text-xs text-gray-500">
                            {8 + Math.floor(Math.random() * 4)}AM
                          </span>
                        </div>
                      ))}
                    </div>
                  </Card>
                </TabsContent>

                <TabsContent value="reviews" className="p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium">Reviews</h3>
                    <Button variant="outline" size="sm">Write Review</Button>
                  </div>

                  {mockReviews.map((review) => (
                    <Card key={review.id} className="p-4">
                      <div className="flex items-start gap-3">
                        <Avatar className="w-10 h-10">
                          <AvatarFallback>{review.avatar}</AvatarFallback>
                        </Avatar>
                        
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium">{review.author}</span>
                            <div className="flex items-center gap-1">
                              {[...Array(5)].map((_, i) => (
                                <Star 
                                  key={i}
                                  className={`w-3 h-3 ${
                                    i < review.rating 
                                      ? 'text-yellow-400 fill-current' 
                                      : 'text-gray-300'
                                  }`}
                                />
                              ))}
                            </div>
                            <span className="text-sm text-gray-500">{review.date}</span>
                          </div>
                          
                          <p className={`text-gray-700 text-sm ${
                            expandedReview === review.id ? '' : 'line-clamp-3'
                          }`}>
                            {review.text}
                          </p>
                          
                          {review.text.length > 100 && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="p-0 h-auto text-blue-600"
                              onClick={() => 
                                setExpandedReview(
                                  expandedReview === review.id ? null : review.id
                                )
                              }
                            >
                              {expandedReview === review.id ? (
                                <>Show less <ChevronUp className="w-3 h-3 ml-1" /></>
                              ) : (
                                <>Read more <ChevronDown className="w-3 h-3 ml-1" /></>
                              )}
                            </Button>
                          )}
                          
                          <div className="flex items-center gap-4 mt-3">
                            <Button variant="ghost" size="sm" className="p-0">
                              <ThumbsUp className="w-4 h-4 mr-1" />
                              Helpful ({review.helpful})
                            </Button>
                          </div>
                        </div>
                      </div>
                    </Card>
                  ))}
                </TabsContent>

                <TabsContent value="photos" className="p-6">
                  <div className="grid grid-cols-2 gap-3">
                    {[...Array(12)].map((_, i) => (
                      <div
                        key={i}
                        className="aspect-square bg-gray-200 rounded-lg overflow-hidden"
                      >
                        <div className="w-full h-full bg-gradient-to-br from-blue-100 to-purple-100 flex items-center justify-center">
                          <Camera className="w-8 h-8 text-gray-400" />
                        </div>
                      </div>
                    ))}
                  </div>
                </TabsContent>
              </div>
            </Tabs>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}