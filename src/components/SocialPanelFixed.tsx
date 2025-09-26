import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  Camera,
  Star,
  MessageCircle,
  AlertTriangle,
  Car,
  MapPin,
  Share,
  Heart,
  Flag,
  Navigation,
  TrendingUp,
  Award,
} from 'lucide-react';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Avatar, AvatarFallback } from './ui/avatar';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { useAuth } from '../hooks/useAuth';
import { socialService } from '../services/social';
import { logger } from '../utils/logger';

interface SocialPanelProps {
  onBack: () => void;
  onLocationSelect?: (location: { id: string; name: string; address: string; lat: number; lng: number; category?: string }) => void;
}

interface SocialPost {
  id: string;
  user: {
    name: string;
    avatar: string;
    level: string;
  };
  type: 'checkin' | 'review' | 'incident' | 'photo';
  content: string;
  location: string;
  timestamp: string;
  likes: number;
  comments: number;
  rating?: number;
  photos?: string[];
  severity?: 'low' | 'medium' | 'high';
}

interface IncidentReport {
  id: string;
  type: 'traffic' | 'police' | 'accident' | 'hazard' | 'closure';
  location: string;
  description: string;
  timestamp: string;
  reporter: string;
  confirmations: number;
  severity: 'low' | 'medium' | 'high';
}

export default function SocialPanel({ onBack, onLocationSelect }: SocialPanelProps) {
  const { user, isAuthenticated } = useAuth();
  const [activeTab, setActiveTab] = useState<'feed' | 'incidents' | 'leaderboard'>('feed');
  const [isLoading, setIsLoading] = useState(false);
  const [friends, setFriends] = useState<any[]>([]);
  const [sharedContent, setSharedContent] = useState<any[]>([]);

  // Quick Action dialogs
  const [photoOpen, setPhotoOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [checkinOpen, setCheckinOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);

  // Forms
  const [photoCaption, setPhotoCaption] = useState('');
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [reportType, setReportType] = useState<'traffic' | 'police' | 'accident' | 'hazard' | 'closure'>('traffic');
  const [reportLocation, setReportLocation] = useState('');
  const [reportDescription, setReportDescription] = useState('');
  const [checkinLocation, setCheckinLocation] = useState('');
  const [reviewPlace, setReviewPlace] = useState('');
  const [reviewRating, setReviewRating] = useState<number>(5);
  const [reviewText, setReviewText] = useState('');

  // Scroll management
  const feedRef = useRef<HTMLDivElement | null>(null);
  const incidentsRef = useRef<HTMLDivElement | null>(null);
  const leaderboardRef = useRef<HTMLDivElement | null>(null);
  const [scrollPos, setScrollPos] = useState({ feed: 0, incidents: 0, leaderboard: 0 });
  const [showTop, setShowTop] = useState(false);

  const getActiveRef = () => {
    if (activeTab === 'feed') return feedRef.current;
    if (activeTab === 'incidents') return incidentsRef.current;
    return leaderboardRef.current;
  };

  // Attach scroll handlers per tab and restore previous positions
  useEffect(() => {
    const el = getActiveRef();
    if (!el) return;

    // Restore previous scroll position
    const saved = (scrollPos as any)[activeTab] as number | undefined;
    if (typeof saved === 'number') {
      el.scrollTop = saved;
    }

    const onScroll = () => {
      const top = el.scrollTop;
      setShowTop(top > 200);
      setScrollPos((prev) => ({
        ...prev,
        [activeTab]: top,
      }));

      // Light infinite-load for Feed
      if (activeTab === 'feed') {
        const nearBottom = el.scrollHeight - (el.scrollTop + el.clientHeight) < 120;
        if (nearBottom) {
          setSocialFeed((prev) =>
            prev.length >= 50
              ? prev
              : [
                  ...prev,
                  ...prev.slice(0, Math.min(2, prev.length)).map((p, i) => ({
                    ...p,
                    id: (Date.now() + i).toString(),
                    timestamp: 'just now',
                  })),
                ],
          );
        }
      }
    };

    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [activeTab, scrollPos]);

  // Fetch real social data when user is authenticated
  useEffect(() => {
    const fetchSocialData = async () => {
      if (!isAuthenticated || !user) return;
      
      setIsLoading(true);
      try {
        // Fetch friends
        const friendsData = await socialService.getAcceptedFriends();
        setFriends(friendsData);
        
        // Fetch shared content
        const contentData = await socialService.getSharedContent({ limit: 20 });
        setSharedContent(contentData.sharedContent);
      } catch (error) {
        logger.error('Failed to fetch social data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSocialData();
  }, [isAuthenticated, user]);

  // Mock social feed data (fallback when not authenticated)
  const [socialFeed, setSocialFeed] = useState<SocialPost[]>([
    {
      id: '1',
      user: { name: 'Sarah Chen', avatar: 'SC', level: 'Navigator Pro' },
      type: 'review',
      content: 'Amazing coffee and great parking! Perfect stop during morning commute.',
      location: 'Blue Bottle Coffee, SOMA',
      timestamp: '2 hours ago',
      likes: 12,
      comments: 3,
      rating: 5,
    },
    {
      id: '2',
      user: { name: 'Mike Rodriguez', avatar: 'MR', level: 'Road Warrior' },
      type: 'incident',
      content: 'Construction blocking right lane. Expect delays.',
      location: 'I-280 Southbound, Mile 15',
      timestamp: '1 hour ago',
      likes: 8,
      comments: 5,
      severity: 'medium',
    },
    {
      id: '3',
      user: { name: 'Emily Watson', avatar: 'EW', level: 'Explorer' },
      type: 'photo',
      content: 'Beautiful sunset view from Twin Peaks! Worth the drive.',
      location: 'Twin Peaks, San Francisco',
      timestamp: '3 hours ago',
      likes: 24,
      comments: 7,
      photos: ['sunset.jpg'],
    },
    {
      id: '4',
      user: { name: 'David Kim', avatar: 'DK', level: 'Local Guide' },
      type: 'checkin',
      content: 'Just arrived! The new charging station is working perfectly.',
      location: 'Tesla Supercharger - Downtown',
      timestamp: '4 hours ago',
      likes: 6,
      comments: 2,
    },
  ]);

  // Mock incident reports
  const [incidents, setIncidents] = useState<IncidentReport[]>([
    {
      id: '1',
      type: 'traffic',
      location: 'Bay Bridge, Eastbound',
      description: 'Heavy traffic due to earlier accident. Clear now but delays persist.',
      timestamp: '45 min ago',
      reporter: 'Alex Johnson',
      confirmations: 12,
      severity: 'medium',
    },
    {
      id: '2',
      type: 'police',
      location: 'Highway 101, Mile 25',
      description: 'Speed trap reported in right lane.',
      timestamp: '1 hour ago',
      reporter: 'Lisa Park',
      confirmations: 8,
      severity: 'low',
    },
    {
      id: '3',
      type: 'closure',
      location: 'Market St & 5th',
      description: 'Street festival causing closure until 6 PM.',
      timestamp: '2 hours ago',
      reporter: 'City Traffic',
      confirmations: 15,
      severity: 'high',
    },
  ]);

  const getIncidentIcon = (type: string) => {
    switch (type) {
      case 'traffic':
        return <Car className="w-4 h-4" />;
      case 'police':
        return <Flag className="w-4 h-4" />;
      case 'accident':
      case 'hazard':
        return <AlertTriangle className="w-4 h-4" />;
      case 'closure':
        return <Navigation className="w-4 h-4" />;
      default:
        return <MapPin className="w-4 h-4" />;
    }
  };

  const getIncidentColor = (type: string) => {
    switch (type) {
      case 'traffic':
        return '#F59E0B';
      case 'police':
        return '#3B82F6';
      case 'accident':
        return '#DC2626';
      case 'hazard':
        return '#EF4444';
      case 'closure':
        return '#7C3AED';
      default:
        return '#6B7280';
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high':
        return '#DC2626';
      case 'medium':
        return '#F59E0B';
      case 'low':
        return '#22C55E';
      default:
        return '#6B7280';
    }
  };

  const getPostIcon = (type: string) => {
    switch (type) {
      case 'checkin':
        return <MapPin className="w-4 h-4" />;
      case 'review':
        return <Star className="w-4 h-4" />;
      case 'incident':
        return <AlertTriangle className="w-4 h-4" />;
      case 'photo':
        return <Camera className="w-4 h-4" />;
      default:
        return <MessageCircle className="w-4 h-4" />;
    }
  };

  const scrollToTop = () => {
    const el = getActiveRef();
    if (el) el.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="h-full bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 bg-white px-4 py-4 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h2 className="font-medium text-gray-900">Community</h2>
            <p className="text-sm text-gray-500">Connect with fellow travelers</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="flex-1 flex flex-col">
        <div className="flex-shrink-0 px-4 py-2 bg-white">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="feed">Feed</TabsTrigger>
            <TabsTrigger value="incidents">
              Incidents
              <Badge variant="secondary" className="ml-2">
                {incidents.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="leaderboard">Rankings</TabsTrigger>
          </TabsList>
        </div>

        <div className="flex-1 overflow-hidden">
          {/* Feed Tab */}
          <TabsContent value="feed" ref={feedRef} className="h-full scroll-y hide-scrollbar scroll-smooth p-4 mt-0">
            <div className="space-y-4">
              {/* Quick Actions */}
              <Card className="p-4">
                <div className="grid grid-cols-2 gap-3">
                  <Button variant="outline" className="justify-start" onClick={() => setPhotoOpen(true)}>
                    <Camera className="w-4 h-4 mr-2" /> Share Photo
                  </Button>
                  <Button variant="outline" className="justify-start" onClick={() => setReportOpen(true)}>
                    <AlertTriangle className="w-4 h-4 mr-2" /> Report Issue
                  </Button>
                  <Button variant="outline" className="justify-start" onClick={() => setCheckinOpen(true)}>
                    <MapPin className="w-4 h-4 mr-2" /> Check In
                  </Button>
                  <Button variant="outline" className="justify-start" onClick={() => setReviewOpen(true)}>
                    <Star className="w-4 h-4 mr-2" /> Write Review
                  </Button>
                </div>
              </Card>

              {/* Social Feed */}
              {socialFeed.map((post) => (
                <Card key={post.id} className="p-4">
                  <div className="flex items-start gap-3">
                    <Avatar>
                      <AvatarFallback>{post.user.avatar}</AvatarFallback>
                    </Avatar>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-gray-900">{post.user.name}</span>
                        <Badge variant="outline" className="text-xs">
                          {post.user.level}
                        </Badge>
                        <div className="text-gray-400">•</div>
                        <span className="text-sm text-gray-500">{post.timestamp}</span>
                      </div>

                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-5 h-5 rounded-full flex items-center justify-center text-white" style={{ backgroundColor: '#5B4FE5' }}>
                          {getPostIcon(post.type)}
                        </div>
                        <span className="text-sm text-gray-600">{post.location}</span>
                        {post.rating && (
                          <div className="flex items-center gap-1">
                            {[...Array(5)].map((_, i) => (
                              <Star key={i} className={`w-3 h-3 ${i < post.rating! ? 'text-yellow-400 fill-current' : 'text-gray-300'}`} />
                            ))}
                          </div>
                        )}
                      </div>

                      <p className="text-gray-900 mb-3">{post.content}</p>

                      {post.photos && (
                        <div className="mb-3">
                          <div className="w-full h-32 bg-gradient-to-br from-orange-400 to-pink-400 rounded-lg" />
                        </div>
                      )}

                      <div className="flex items-center gap-4">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-gray-600 hover:text-red-600"
                          onClick={() => {
                            setSocialFeed((prev) => prev.map((p) => (p.id === post.id ? { ...p, likes: p.likes + 1 } : p)));
                          }}
                        >
                          <Heart className="w-4 h-4 mr-1" /> {post.likes}
                        </Button>
                        <Button variant="ghost" size="sm" className="text-gray-600" onClick={() => alert('Comments coming soon')}>
                          <MessageCircle className="w-4 h-4 mr-1" /> {post.comments}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-gray-600"
                          onClick={async () => {
                            const shareData = { title: 'PathFinder Pro', text: post.content, url: window.location.origin };
                            if ((navigator as any).share) {
                              try {
                                await (navigator as any).share(shareData);
                              } catch {}
                            } else if (navigator.clipboard) {
                              await navigator.clipboard.writeText(shareData.url);
                              alert('Link copied');
                            }
                          }}
                        >
                          <Share className="w-4 h-4 mr-1" /> Share
                        </Button>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Incidents Tab */}
          <TabsContent value="incidents" ref={incidentsRef} className="h-full scroll-y hide-scrollbar scroll-smooth p-4 mt-0">
            <div className="space-y-3">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-medium text-gray-900">Live Incidents</h3>
                <Button size="sm" onClick={() => setReportOpen(true)}>
                  <AlertTriangle className="w-4 h-4 mr-2" /> Report
                </Button>
              </div>

              {incidents.map((incident) => (
                <Card key={incident.id} className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center text-white" style={{ backgroundColor: getIncidentColor(incident.type) }}>
                      {getIncidentIcon(incident.type)}
                    </div>

                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-gray-900 capitalize">{incident.type}</span>
                        <Badge
                          style={{
                            backgroundColor: `${getSeverityColor(incident.severity)}20`,
                            color: getSeverityColor(incident.severity),
                            border: `1px solid ${getSeverityColor(incident.severity)}40`,
                          }}
                        >
                          {incident.severity}
                        </Badge>
                        <span className="text-sm text-gray-500">{incident.timestamp}</span>
                      </div>

                      <p className="text-sm text-gray-600 mb-2">{incident.location}</p>
                      <p className="text-gray-900 mb-3">{incident.description}</p>

                      <div className="flex items-center justify-between">
                        <div className="text-sm text-gray-500">Reported by {incident.reporter} • {incident.confirmations} confirmations</div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setIncidents((prev) => prev.map((i) => (i.id === incident.id ? { ...i, confirmations: i.confirmations + 1 } : i)));
                            }}
                          >
                            Confirm
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              if (!onLocationSelect) return;
                              onLocationSelect({
                                id: `incident-${incident.id}`,
                                name: `${incident.type} near ${incident.location}`,
                                address: incident.location,
                                lat: 37.7749,
                                lng: -122.4194,
                              });
                            }}
                          >
                            Navigate Around
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Leaderboard Tab */}
          <TabsContent value="leaderboard" ref={leaderboardRef} className="h-full scroll-y hide-scrollbar scroll-smooth p-4 mt-0">
            <div className="space-y-4">
              <Card className="p-4 bg-gradient-to-r from-purple-500 to-blue-500 text-white">
                <div className="flex items-center gap-3">
                  <Award className="w-8 h-8" />
                  <div>
                    <h3 className="font-medium">Your Ranking</h3>
                    <p className="text-sm opacity-90">#47 this month • Explorer Level</p>
                  </div>
                  <div className="ml-auto text-right">
                    <div className="text-2xl font-bold">2,840</div>
                    <div className="text-sm opacity-90">points</div>
                  </div>
                </div>
              </Card>

              <div className="grid grid-cols-3 gap-3">
                <Card className="p-3 text-center">
                  <Camera className="w-6 h-6 mx-auto mb-2 text-blue-600" />
                  <div className="text-lg font-medium">24</div>
                  <div className="text-sm text-gray-600">Photos</div>
                </Card>
                <Card className="p-3 text-center">
                  <Star className="w-6 h-6 mx-auto mb-2 text-yellow-600" />
                  <div className="text-lg font-medium">18</div>
                  <div className="text-sm text-gray-600">Reviews</div>
                </Card>
                <Card className="p-3 text-center">
                  <AlertTriangle className="w-6 h-6 mx-auto mb-2 text-red-600" />
                  <div className="text-lg font-medium">12</div>
                  <div className="text-sm text-gray-600">Reports</div>
                </Card>
              </div>

              <Card className="p-4">
                <h3 className="font-medium text-gray-900 mb-3">Top Contributors</h3>
                <div className="space-y-3">
                  {[
                    { name: 'Alex Thompson', level: 'Road Master', points: 8540, avatar: 'AT' },
                    { name: 'Maria Garcia', level: 'Navigator Pro', points: 7220, avatar: 'MG' },
                    { name: 'Jordan Lee', level: 'Explorer Elite', points: 6890, avatar: 'JL' },
                    { name: 'Sam Wilson', level: 'Local Guide', points: 5430, avatar: 'SW' },
                  ].map((user, index) => (
                    <div key={index} className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center text-purple-600 font-medium text-sm">#{index + 1}</div>
                      <Avatar>
                        <AvatarFallback>{user.avatar}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <div className="font-medium text-gray-900">{user.name}</div>
                        <div className="text-sm text-gray-500">{user.level}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-medium text-gray-900">{user.points.toLocaleString()}</div>
                        <div className="text-sm text-gray-500">points</div>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>

              <Card className="p-4 bg-blue-50 border-blue-200">
                <div className="flex items-center gap-3">
                  <TrendingUp className="w-5 h-5 text-blue-600" />
                  <div>
                    <h4 className="font-medium text-blue-900">Level Up!</h4>
                    <p className="text-sm text-blue-800">160 more points to reach Navigator Pro</p>
                  </div>
                </div>
              </Card>
            </div>
          </TabsContent>
        </div>
      </Tabs>

      {showTop && (
        <Button
          size="sm"
          className="fixed right-4 bottom-24 z-50 bg-white text-gray-700 shadow-lg border border-gray-200 hover:bg-gray-50"
          onClick={scrollToTop}
        >
          Top
        </Button>
      )}

      {/* Share Photo Dialog */}
      <Dialog open={photoOpen} onOpenChange={setPhotoOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Share a Photo</DialogTitle>
            <DialogDescription>Post a photo with a caption to the community feed.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) setPhotoUrl(URL.createObjectURL(file));
              }}
            />
            <Input placeholder="Caption" value={photoCaption} onChange={(e) => setPhotoCaption(e.target.value)} />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setPhotoOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (!photoCaption.trim()) return;
                  setSocialFeed((prev) => [
                    {
                      id: Date.now().toString(),
                      user: { name: 'You', avatar: 'YY', level: 'Explorer' },
                      type: 'photo',
                      content: photoCaption.trim(),
                      location: 'Current location',
                      timestamp: 'just now',
                      likes: 0,
                      comments: 0,
                      photos: photoUrl ? [photoUrl] : undefined,
                    },
                    ...prev,
                  ]);
                  setPhotoCaption('');
                  setPhotoUrl(null);
                  setPhotoOpen(false);
                }}
              >
                Post
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Report Issue Dialog */}
      <Dialog open={reportOpen} onOpenChange={setReportOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Report an Issue</DialogTitle>
            <DialogDescription>Help others by reporting traffic, hazards, or closures.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Select value={reportType} onValueChange={(v) => setReportType(v as any)}>
              <SelectTrigger>
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="traffic">Traffic</SelectItem>
                <SelectItem value="police">Police</SelectItem>
                <SelectItem value="accident">Accident</SelectItem>
                <SelectItem value="hazard">Hazard</SelectItem>
                <SelectItem value="closure">Closure</SelectItem>
              </SelectContent>
            </Select>
            <Input placeholder="Location" value={reportLocation} onChange={(e) => setReportLocation(e.target.value)} />
            <textarea
              className="w-full p-3 border rounded-md text-sm"
              rows={3}
              placeholder="Description"
              value={reportDescription}
              onChange={(e) => setReportDescription(e.target.value)}
            />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setReportOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (!reportLocation.trim() || !reportDescription.trim()) return;
                  setIncidents((prev) => [
                    {
                      id: Date.now().toString(),
                      type: reportType,
                      location: reportLocation.trim(),
                      description: reportDescription.trim(),
                      timestamp: 'just now',
                      reporter: 'You',
                      confirmations: 0,
                      severity: 'low',
                    },
                    ...prev,
                  ]);
                  setActiveTab('incidents');
                  setReportLocation('');
                  setReportDescription('');
                  setReportType('traffic');
                  setReportOpen(false);
                }}
              >
                Submit
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Check In Dialog */}
      <Dialog open={checkinOpen} onOpenChange={setCheckinOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Check In</DialogTitle>
            <DialogDescription>Let others know where you are.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Place name" value={checkinLocation} onChange={(e) => setCheckinLocation(e.target.value)} />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setCheckinOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (!checkinLocation.trim()) return;
                  setSocialFeed((prev) => [
                    {
                      id: Date.now().toString(),
                      user: { name: 'You', avatar: 'YY', level: 'Explorer' },
                      type: 'checkin',
                      content: 'Checked in',
                      location: checkinLocation.trim(),
                      timestamp: 'just now',
                      likes: 0,
                      comments: 0,
                    },
                    ...prev,
                  ]);
                  setCheckinLocation('');
                  setCheckinOpen(false);
                }}
              >
                Check In
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Write Review Dialog */}
      <Dialog open={reviewOpen} onOpenChange={setReviewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Write a Review</DialogTitle>
            <DialogDescription>Share your experience with others.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Place name" value={reviewPlace} onChange={(e) => setReviewPlace(e.target.value)} />
            <Select value={String(reviewRating)} onValueChange={(v) => setReviewRating(parseInt(v))}>
              <SelectTrigger>
                <SelectValue placeholder="Rating" />
              </SelectTrigger>
              <SelectContent>
                {[5, 4, 3, 2, 1].map((r) => (
                  <SelectItem key={r} value={String(r)}>
                    {r} stars
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <textarea
              className="w-full p-3 border rounded-md text-sm"
              rows={3}
              placeholder="Your review"
              value={reviewText}
              onChange={(e) => setReviewText(e.target.value)}
            />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setReviewOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (!reviewPlace.trim() || !reviewText.trim()) return;
                  setSocialFeed((prev) => [
                    {
                      id: Date.now().toString(),
                      user: { name: 'You', avatar: 'YY', level: 'Explorer' },
                      type: 'review',
                      content: reviewText.trim(),
                      location: reviewPlace.trim(),
                      timestamp: 'just now',
                      likes: 0,
                      comments: 0,
                      rating: reviewRating,
                    },
                    ...prev,
                  ]);
                  setReviewPlace('');
                  setReviewText('');
                  setReviewRating(5);
                  setReviewOpen(false);
                }}
              >
                Post Review
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
