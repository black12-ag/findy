import React, { useRef, useState } from 'react';
import { 
  ArrowLeft, 
  Award, 
  Camera,
  Edit,
  Share,
  Download,
  Upload,
  Settings,
  Crown,
  MapPin,
  Clock,
  Route,
  Star,
  Car,
  Leaf,
  Target,
  Calendar,
  TrendingUp,
  CheckCircle,
  Shield,
  Activity,
  Trophy
} from 'lucide-react';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Progress } from './ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Avatar, AvatarImage, AvatarFallback } from './ui/avatar';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { Input } from './ui/input';

interface ProfilePanelProps {
  onBack: () => void;
  onOpenSettings?: () => void;
  onOpenSafety?: () => void;
  onOpenAnalytics?: () => void;
  onOpenGamification?: () => void;
}

interface UserStats {
  totalTrips: number;
  totalDistance: string;
  totalTime: string;
  co2Saved: string;
  placesVisited: number;
  reviewsWritten: number;
  photosShared: number;
  incidentsReported: number;
}

interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  earned: boolean;
  earnedDate?: string;
  progress?: number;
  maxProgress?: number;
}

export function ProfilePanel({ onBack, onOpenSettings, onOpenSafety, onOpenAnalytics, onOpenGamification }: ProfilePanelProps) {
  const [activeTab, setActiveTab] = useState('overview');
  const [editOpen, setEditOpen] = useState(false);
  const [activityOpen, setActivityOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const avatarFileInputRef = useRef<HTMLInputElement | null>(null);
  const importFileInputRef = useRef<HTMLInputElement | null>(null);
  
  // Mock user data
  const [userProfile, setUserProfile] = useState({
    name: 'Alex Thompson',
    email: 'alex.thompson@email.com',
    level: 'Navigator Pro',
    levelProgress: 75,
    nextLevel: 'Road Master',
    pointsToNext: 160,
    totalPoints: 8540,
    memberSince: 'January 2023',
    avatar: 'AT',
    verifiedContributor: true
  });

  const userStats: UserStats = {
    totalTrips: 247,
    totalDistance: '1,240 mi',
    totalTime: '52 hours',
    co2Saved: '89 kg',
    placesVisited: 156,
    reviewsWritten: 34,
    photosShared: 67,
    incidentsReported: 23
  };

  const achievements: Achievement[] = [
    {
      id: '1',
      name: 'First Steps',
      description: 'Complete your first navigation',
      icon: '🗺️',
      earned: true,
      earnedDate: '2023-01-15'
    },
    {
      id: '2',
      name: 'Local Explorer',
      description: 'Visit 50 different places',
      icon: '🏃‍♂️',
      earned: true,
      earnedDate: '2023-03-22'
    },
    {
      id: '3',
      name: 'Community Helper',
      description: 'Report 20 traffic incidents',
      icon: '🚨',
      earned: true,
      earnedDate: '2023-05-10'
    },
    {
      id: '4',
      name: 'Eco Warrior',
      description: 'Save 100kg of CO₂ emissions',
      icon: '🌱',
      earned: false,
      progress: 89,
      maxProgress: 100
    },
    {
      id: '5',
      name: 'Photo Pro',
      description: 'Share 100 photos',
      icon: '📸',
      earned: false,
      progress: 67,
      maxProgress: 100
    },
    {
      id: '6',
      name: 'Review Master',
      description: 'Write 50 reviews',
      icon: '⭐',
      earned: false,
      progress: 34,
      maxProgress: 50
    }
  ];

  const recentActivity = [
    {
      id: '1',
      type: 'trip',
      description: 'Completed trip to Golden Gate Park',
      time: '2 hours ago',
      icon: MapPin,
      color: '#5B4FE5'
    },
    {
      id: '2',
      type: 'review',
      description: 'Reviewed Blue Bottle Coffee',
      time: '1 day ago',
      icon: Star,
      color: '#F59E0B'
    },
    {
      id: '3',
      type: 'photo',
      description: 'Shared photo at Twin Peaks',
      time: '2 days ago',
      icon: Camera,
      color: '#10B981'
    },
    {
      id: '4',
      type: 'incident',
      description: 'Reported traffic on Bay Bridge',
      time: '3 days ago',
      icon: Car,
      color: '#EF4444'
    }
  ];

  const monthlyStats = [
    { month: 'Jan', trips: 18, distance: 89 },
    { month: 'Feb', trips: 22, distance: 112 },
    { month: 'Mar', trips: 20, distance: 98 },
    { month: 'Apr', trips: 25, distance: 134 },
    { month: 'May', trips: 28, distance: 142 },
    { month: 'Jun', trips: 31, distance: 156 }
  ];

  return (
    <div className="h-full bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 bg-white px-4 py-4 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={onBack}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <h2 className="font-medium text-gray-900">Profile</h2>
            <p className="text-sm text-gray-500">Manage your account and view stats</p>
          </div>
          <Button variant="ghost" size="icon" onClick={() => {
            if (onOpenSettings) onOpenSettings();
            else alert('Open Settings');
          }}>
            <Settings className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Profile Header */}
      <div className="flex-shrink-0 bg-gradient-to-r from-purple-500 to-blue-500 px-4 py-6 text-white">
        <div className="flex items-center gap-4">
          <div className="relative">
            <Avatar className="w-20 h-20 border-4 border-white">
              {avatarUrl ? (
                <AvatarImage src={avatarUrl} alt={userProfile.name} />
              ) : (
                <AvatarFallback className="text-2xl bg-white text-purple-600">
                  {userProfile.avatar}
                </AvatarFallback>
              )}
            </Avatar>
            <Button
              size="icon"
              className="absolute -bottom-2 -right-2 w-8 h-8 bg-white text-gray-700 hover:bg-gray-50"
              onClick={() => avatarFileInputRef.current?.click()}
            >
              <Camera className="w-4 h-4" />
            </Button>
            <input
              ref={avatarFileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  const url = URL.createObjectURL(file);
                  setAvatarUrl(url);
                }
              }}
            />
          </div>
          
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-xl font-medium">{userProfile.name}</h3>
              {userProfile.verifiedContributor && (
                <CheckCircle className="w-5 h-5 text-green-400" />
              )}
            </div>
            
            <div className="flex items-center gap-2 mb-2">
              <Crown className="w-4 h-4 text-yellow-400" />
              <span className="text-sm opacity-90">{userProfile.level}</span>
            </div>
            
            <div className="flex items-center gap-3 text-sm opacity-90">
              <span>{userProfile.totalPoints.toLocaleString()} points</span>
              <span>•</span>
              <span>Member since {userProfile.memberSince}</span>
            </div>
            
            {/* Level Progress */}
            <div className="mt-3">
              <div className="flex items-center justify-between text-sm mb-1">
                <span className="opacity-90">Progress to {userProfile.nextLevel}</span>
                <span className="opacity-90">{userProfile.pointsToNext} more points</span>
              </div>
              <Progress value={userProfile.levelProgress} className="h-2 bg-white/20" />
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <div className="flex-shrink-0 px-4 py-2 bg-white">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="achievements">Achievements</TabsTrigger>
            <TabsTrigger value="activity">Activity</TabsTrigger>
          </TabsList>
        </div>

        <div className="flex-1 overflow-hidden min-h-0">
          {/* Overview Tab */}
          <TabsContent value="overview" className="h-full overflow-y-auto scroll-y hide-scrollbar scroll-smooth p-4 mt-0">
            <div className="space-y-4">
              {/* Quick Actions */}
              <Card className="p-4">
                <h3 className="font-medium text-gray-900 mb-3">Quick Actions</h3>
                <div className="grid grid-cols-2 gap-3">
                  <Button variant="outline" className="justify-start" onClick={() => setEditOpen(true)}>
                    <Edit className="w-4 h-4 mr-2" />
                    Edit Profile
                  </Button>
                  <Button
                    variant="outline"
                    className="justify-start"
                    onClick={async () => {
                      const shareData = {
                        title: 'PathFinder Pro Profile',
                        text: `${userProfile.name} on PathFinder Pro`,
                        url: window.location.origin,
                      };
                      if (navigator.share) {
                        try { await navigator.share(shareData); } catch {}
                      } else if (navigator.clipboard) {
                        await navigator.clipboard.writeText(shareData.url);
                        setShareOpen(true);
                      } else {
                        alert('Share URL copied:\n' + shareData.url);
                      }
                    }}
                  >
                    <Share className="w-4 h-4 mr-2" />
                    Share Profile
                  </Button>
                  <Button
                    variant="outline"
                    className="justify-start"
                    onClick={() => {
                      const data = {
                        profile: userProfile,
                        stats: userStats,
                        achievements,
                        recentActivity,
                      };
                      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = 'pathfinder_profile_export.json';
                      document.body.appendChild(a);
                      a.click();
                      a.remove();
                      URL.revokeObjectURL(url);
                    }}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Export Data
                  </Button>
                  <Button
                    variant="outline"
                    className="justify-start"
                    onClick={() => importFileInputRef.current?.click()}
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    Import Data
                  </Button>
                  {onOpenSafety && (
                    <Button
                      variant="outline"
                      className="justify-start"
                      onClick={onOpenSafety}
                    >
                      <Shield className="w-4 h-4 mr-2" />
                      Safety Center
                    </Button>
                  )}
                  {onOpenAnalytics && (
                    <Button
                      variant="outline"
                      className="justify-start"
                      onClick={onOpenAnalytics}
                    >
                      <Activity className="w-4 h-4 mr-2" />
                      Analytics
                    </Button>
                  )}
                  {onOpenGamification && (
                    <Button
                      variant="outline"
                      className="justify-start"
                      onClick={onOpenGamification}
                    >
                      <Trophy className="w-4 h-4 mr-2" />
                      Achievements
                    </Button>
                  )}
                </div>
              </Card>

              {/* Travel Statistics */}
              <Card className="p-4">
                <h3 className="font-medium text-gray-900 mb-4">Travel Statistics</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center">
                    <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-2">
                      <Route className="w-6 h-6 text-blue-600" />
                    </div>
                    <div className="text-2xl font-bold text-gray-900">{userStats.totalTrips}</div>
                    <div className="text-sm text-gray-500">Total Trips</div>
                  </div>
                  
                  <div className="text-center">
                    <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-2">
                      <Target className="w-6 h-6 text-green-600" />
                    </div>
                    <div className="text-2xl font-bold text-gray-900">{userStats.totalDistance}</div>
                    <div className="text-sm text-gray-500">Distance Traveled</div>
                  </div>
                  
                  <div className="text-center">
                    <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-2">
                      <Clock className="w-6 h-6 text-purple-600" />
                    </div>
                    <div className="text-2xl font-bold text-gray-900">{userStats.totalTime}</div>
                    <div className="text-sm text-gray-500">Time Navigating</div>
                  </div>
                  
                  <div className="text-center">
                    <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-2">
                      <Leaf className="w-6 h-6 text-green-600" />
                    </div>
                    <div className="text-2xl font-bold text-gray-900">{userStats.co2Saved}</div>
                    <div className="text-sm text-gray-500">CO₂ Saved</div>
                  </div>
                </div>
              </Card>

              {/* Community Contributions */}
              <Card className="p-4">
                <h3 className="font-medium text-gray-900 mb-4">Community Contributions</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <MapPin className="w-5 h-5 text-blue-600" />
                      <span className="text-gray-700">Places Visited</span>
                    </div>
                    <span className="font-medium text-gray-900">{userStats.placesVisited}</span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Star className="w-5 h-5 text-yellow-600" />
                      <span className="text-gray-700">Reviews Written</span>
                    </div>
                    <span className="font-medium text-gray-900">{userStats.reviewsWritten}</span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Camera className="w-5 h-5 text-green-600" />
                      <span className="text-gray-700">Photos Shared</span>
                    </div>
                    <span className="font-medium text-gray-900">{userStats.photosShared}</span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Car className="w-5 h-5 text-red-600" />
                      <span className="text-gray-700">Incidents Reported</span>
                    </div>
                    <span className="font-medium text-gray-900">{userStats.incidentsReported}</span>
                  </div>
                </div>
              </Card>

              {/* Monthly Activity Chart */}
              <Card className="p-4">
                <h3 className="font-medium text-gray-900 mb-4">Monthly Activity</h3>
                <div className="space-y-3">
                  {monthlyStats.map((stat) => (
                    <div key={stat.month} className="flex items-center gap-3">
                      <div className="w-12 text-sm text-gray-600">{stat.month}</div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between text-sm mb-1">
                          <span>{stat.trips} trips</span>
                          <span>{stat.distance} mi</span>
                        </div>
                        <Progress value={(stat.distance / 200) * 100} className="h-2" />
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          </TabsContent>

          {/* Achievements Tab */}
          <TabsContent value="achievements" className="h-full overflow-y-auto scroll-y hide-scrollbar scroll-smooth p-4 mt-0">
            <div className="space-y-4">
              <div className="text-center mb-6">
                <Award className="w-12 h-12 text-yellow-500 mx-auto mb-2" />
                <h3 className="font-medium text-gray-900">Your Achievements</h3>
                <p className="text-sm text-gray-500">
                  {achievements.filter(a => a.earned).length} of {achievements.length} earned
                </p>
              </div>

              {achievements.map((achievement) => (
                <Card key={achievement.id} className={`p-4 ${
                  achievement.earned ? 'border-green-200 bg-green-50' : 'border-gray-200'
                }`}>
                  <div className="flex items-start gap-4">
                    <div className={`text-3xl ${achievement.earned ? '' : 'grayscale opacity-50'}`}>
                      {achievement.icon}
                    </div>
                    
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-medium text-gray-900">{achievement.name}</h4>
                        {achievement.earned && (
                          <CheckCircle className="w-4 h-4 text-green-600" />
                        )}
                      </div>
                      
                      <p className="text-sm text-gray-600 mb-2">{achievement.description}</p>
                      
                      {achievement.earned ? (
                        <div className="text-xs text-green-600">
                          Earned on {achievement.earnedDate}
                        </div>
                      ) : achievement.progress ? (
                        <div>
                          <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                            <span>Progress</span>
                            <span>{achievement.progress}/{achievement.maxProgress}</span>
                          </div>
                          <Progress 
                            value={(achievement.progress / achievement.maxProgress!) * 100} 
                            className="h-2" 
                          />
                        </div>
                      ) : (
                        <div className="text-xs text-gray-500">Not started</div>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Activity Tab */}
          <TabsContent value="activity" className="h-full overflow-y-auto scroll-y hide-scrollbar scroll-smooth p-4 mt-0">
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-medium text-gray-900">Recent Activity</h3>
                <Button variant="outline" size="sm" onClick={() => setActivityOpen(true)}>
                  <Calendar className="w-4 h-4 mr-2" />
                  View All
                </Button>
              </div>

              {recentActivity.map((activity) => {
                const Icon = activity.icon;
                return (
                  <Card key={activity.id} className="p-4">
                    <div className="flex items-start gap-3">
                      <div 
                        className="w-10 h-10 rounded-full flex items-center justify-center text-white"
                        style={{ backgroundColor: activity.color }}
                      >
                        <Icon className="w-5 h-5" />
                      </div>
                      
                      <div className="flex-1">
                        <p className="text-gray-900">{activity.description}</p>
                        <p className="text-sm text-gray-500">{activity.time}</p>
                      </div>
                      
                      <Button variant="ghost" size="sm">
                        View
                      </Button>
                    </div>
                  </Card>
                );
              })}

              {/* Activity Summary */}
              <Card className="p-4 bg-blue-50 border-blue-200">
                <div className="flex items-center gap-3">
                  <TrendingUp className="w-5 h-5 text-blue-600" />
                  <div>
                    <h4 className="font-medium text-blue-900">This Week's Summary</h4>
                    <p className="text-sm text-blue-800">
                      5 trips completed • 2 reviews written • 1 photo shared
                    </p>
                  </div>
                </div>
              </Card>
            </div>
          </TabsContent>
        </div>
      </Tabs>
      {/* Hidden input for importing JSON data */}
      <input
        ref={importFileInputRef}
        type="file"
        accept="application/json"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = () => {
            try {
              const data = JSON.parse(reader.result as string);
              if (data.profile) {
                setUserProfile((p) => ({
                  ...p,
                  name: data.profile.name ?? p.name,
                  email: data.profile.email ?? p.email,
                  level: data.profile.level ?? p.level,
                }));
              }
              alert('Import successful');
            } catch {
              alert('Invalid file');
            }
          };
          reader.readAsText(file);
          e.currentTarget.value = '';
        }}
      />

      {/* Edit Profile Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Profile</DialogTitle>
            <DialogDescription>Update your personal information.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              placeholder="Name"
              value={userProfile.name}
              onChange={(e) => setUserProfile((p) => ({ ...p, name: e.target.value }))}
            />
            <Input
              placeholder="Email"
              type="email"
              value={userProfile.email}
              onChange={(e) => setUserProfile((p) => ({ ...p, email: e.target.value }))}
            />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setEditOpen(false)}>Cancel</Button>
              <Button onClick={() => {
                setEditOpen(false);
                setUserProfile((p) => ({ ...p, name: userProfile.name, email: userProfile.email }));
              }}>Save</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Share fallback Dialog */}
      <Dialog open={shareOpen} onOpenChange={setShareOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Profile link copied</DialogTitle>
            <DialogDescription>Share it with your friends.</DialogDescription>
          </DialogHeader>
          <div className="text-sm text-gray-600">{window.location.origin}</div>
          <div className="flex justify-end">
            <Button onClick={() => setShareOpen(false)}>Close</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Activity Dialog */}
      <Dialog open={activityOpen} onOpenChange={setActivityOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>All Activity</DialogTitle>
            <DialogDescription>Your recent actions in PathFinder Pro</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 max-h-[60vh] overflow-y-auto scroll-y hide-scrollbar scroll-smooth">
            {recentActivity.map((activity) => {
              const Icon = activity.icon;
              return (
                <Card key={activity.id} className="p-3">
                  <div className="flex items-start gap-3">
                    <div 
                      className="w-8 h-8 rounded-full flex items-center justify-center text-white"
                      style={{ backgroundColor: activity.color }}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1">
                      <div className="text-sm text-gray-900">{activity.description}</div>
                      <div className="text-xs text-gray-500">{activity.time}</div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
          <div className="flex justify-end">
            <Button onClick={() => setActivityOpen(false)}>Close</Button>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}