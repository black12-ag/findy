import React, { useState } from 'react';
import { 
  ArrowLeft,
  Trophy,
  Award,
  Target,
  TrendingUp,
  Users,
  Star,
  Zap,
  Gift,
  Lock,
  CheckCircle,
  Medal,
  Crown,
  Sparkles
} from 'lucide-react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Progress } from './ui/progress';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './ui/tabs';

interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  progress: number;
  total: number;
  points: number;
  unlocked: boolean;
  category: 'exploration' | 'eco' | 'social' | 'safety' | 'special';
}

interface LeaderboardEntry {
  rank: number;
  name: string;
  avatar: string;
  points: number;
  badges: number;
  trend: 'up' | 'down' | 'same';
}

interface GamificationProps {
  onBack: () => void;
}

export function Gamification({ onBack }: GamificationProps) {
  const [activeTab, setActiveTab] = useState('achievements');
  
  const userStats = {
    level: 12,
    points: 2450,
    nextLevelPoints: 3000,
    rank: 24,
    badges: 18,
    streak: 7
  };

  const achievements: Achievement[] = [
    {
      id: '1',
      name: 'Road Warrior',
      description: 'Travel 1000 miles',
      icon: '🛣️',
      progress: 856,
      total: 1000,
      points: 500,
      unlocked: false,
      category: 'exploration'
    },
    {
      id: '2',
      name: 'Eco Champion',
      description: 'Save 100kg of CO2',
      icon: '🌱',
      progress: 100,
      total: 100,
      points: 300,
      unlocked: true,
      category: 'eco'
    },
    {
      id: '3',
      name: 'Social Navigator',
      description: 'Share 50 locations',
      icon: '📍',
      progress: 32,
      total: 50,
      points: 200,
      unlocked: false,
      category: 'social'
    },
    {
      id: '4',
      name: 'Safety First',
      description: 'Complete 100 safe trips',
      icon: '🛡️',
      progress: 100,
      total: 100,
      points: 400,
      unlocked: true,
      category: 'safety'
    },
    {
      id: '5',
      name: 'Explorer',
      description: 'Visit 25 new places',
      icon: '🗺️',
      progress: 18,
      total: 25,
      points: 250,
      unlocked: false,
      category: 'exploration'
    },
    {
      id: '6',
      name: 'Transit Hero',
      description: 'Use public transit 30 times',
      icon: '🚇',
      progress: 22,
      total: 30,
      points: 350,
      unlocked: false,
      category: 'eco'
    }
  ];

  const leaderboard: LeaderboardEntry[] = [
    { rank: 1, name: 'Alex Chen', avatar: 'AC', points: 5420, badges: 42, trend: 'same' },
    { rank: 2, name: 'Sarah Kim', avatar: 'SK', points: 5180, badges: 38, trend: 'up' },
    { rank: 3, name: 'Mike Johnson', avatar: 'MJ', points: 4920, badges: 35, trend: 'down' },
    { rank: 23, name: 'You', avatar: 'JD', points: 2450, badges: 18, trend: 'up' },
    { rank: 24, name: 'Emma Davis', avatar: 'ED', points: 2420, badges: 17, trend: 'down' },
    { rank: 25, name: 'Tom Wilson', avatar: 'TW', points: 2380, badges: 16, trend: 'same' }
  ];

  const rewards = [
    { name: '10% Parking Discount', points: 500, icon: '🎫', available: true },
    { name: 'Premium Route Features', points: 1000, icon: '⭐', available: true },
    { name: 'Custom Map Theme', points: 750, icon: '🎨', available: true },
    { name: 'Ad-Free Experience', points: 2000, icon: '🚫', available: false },
    { name: 'VIP Support', points: 3000, icon: '👑', available: false }
  ];

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'exploration': return 'bg-blue-100 text-blue-700';
      case 'eco': return 'bg-green-100 text-green-700';
      case 'social': return 'bg-purple-100 text-purple-700';
      case 'safety': return 'bg-orange-100 text-orange-700';
      case 'special': return 'bg-yellow-100 text-yellow-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <div className="h-full bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 bg-gradient-to-r from-purple-600 to-blue-600 px-4 py-4">
        <div className="flex items-center gap-3 text-white mb-4">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={onBack}
            className="text-white hover:bg-white/20"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h2 className="font-semibold">Achievements & Rewards</h2>
            <p className="text-sm opacity-90">Level up your navigation</p>
          </div>
        </div>

        {/* User Stats Card */}
        <Card className="bg-white/10 backdrop-blur border-white/20 text-white p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center text-xl font-bold">
                {userStats.level}
              </div>
              <div>
                <div className="font-semibold">Level {userStats.level} Navigator</div>
                <div className="text-sm opacity-90">{userStats.points} points</div>
              </div>
            </div>
            <Badge className="bg-yellow-500 text-white">
              <Trophy className="w-3 h-3 mr-1" />
              Rank #{userStats.rank}
            </Badge>
          </div>
          
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span>Next Level</span>
              <span>{userStats.points} / {userStats.nextLevelPoints}</span>
            </div>
            <Progress 
              value={(userStats.points / userStats.nextLevelPoints) * 100} 
              className="h-2 bg-white/20"
            />
          </div>

          <div className="flex justify-around mt-4 pt-3 border-t border-white/20">
            <div className="text-center">
              <div className="text-xl font-bold">{userStats.badges}</div>
              <div className="text-xs opacity-90">Badges</div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold">#{userStats.rank}</div>
              <div className="text-xs opacity-90">Rank</div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold">{userStats.streak}🔥</div>
              <div className="text-xs opacity-90">Day Streak</div>
            </div>
          </div>
        </Card>
      </div>

      <div className="flex-1 overflow-y-auto">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full">
          <div className="bg-white border-b px-4">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="achievements">Achievements</TabsTrigger>
              <TabsTrigger value="leaderboard">Leaderboard</TabsTrigger>
              <TabsTrigger value="rewards">Rewards</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="achievements" className="p-4 space-y-3">
            {/* Categories Filter */}
            <div className="flex gap-2 overflow-x-auto pb-2">
              {['All', 'Exploration', 'Eco', 'Social', 'Safety'].map((cat) => (
                <Badge 
                  key={cat}
                  variant="outline"
                  className="cursor-pointer whitespace-nowrap"
                >
                  {cat}
                </Badge>
              ))}
            </div>

            {/* Achievements List */}
            {achievements.map((achievement) => (
              <Card 
                key={achievement.id}
                className={`p-4 ${achievement.unlocked ? '' : 'opacity-75'}`}
              >
                <div className="flex items-start gap-3">
                  <div className={`text-3xl p-2 rounded-lg ${achievement.unlocked ? 'bg-green-50' : 'bg-gray-100'}`}>
                    {achievement.unlocked ? achievement.icon : '🔒'}
                  </div>
                  
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold">{achievement.name}</h3>
                      {achievement.unlocked && (
                        <CheckCircle className="w-4 h-4 text-green-500" />
                      )}
                      <Badge className={`text-xs ${getCategoryColor(achievement.category)}`}>
                        {achievement.category}
                      </Badge>
                    </div>
                    
                    <p className="text-sm text-gray-600 mb-2">{achievement.description}</p>
                    
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-500">Progress</span>
                        <span className="font-medium">
                          {achievement.progress} / {achievement.total}
                        </span>
                      </div>
                      <Progress 
                        value={(achievement.progress / achievement.total) * 100}
                        className="h-2"
                      />
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <div className="text-lg font-bold text-purple-600">
                      +{achievement.points}
                    </div>
                    <div className="text-xs text-gray-500">points</div>
                  </div>
                </div>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="leaderboard" className="p-4 space-y-3">
            {/* Time Filter */}
            <div className="flex gap-2 justify-center mb-4">
              {['Daily', 'Weekly', 'Monthly', 'All Time'].map((period) => (
                <Button
                  key={period}
                  variant={period === 'Weekly' ? 'default' : 'outline'}
                  size="sm"
                >
                  {period}
                </Button>
              ))}
            </div>

            {/* Leaderboard List */}
            {leaderboard.map((entry) => (
              <Card 
                key={entry.rank}
                className={`p-3 ${entry.name === 'You' ? 'border-purple-500 bg-purple-50' : ''}`}
              >
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <div className={`font-bold text-lg w-8 text-center ${
                      entry.rank <= 3 ? 'text-yellow-600' : 'text-gray-600'
                    }`}>
                      {entry.rank === 1 && '🥇'}
                      {entry.rank === 2 && '🥈'}
                      {entry.rank === 3 && '🥉'}
                      {entry.rank > 3 && entry.rank}
                    </div>
                    
                    <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-blue-500 rounded-full flex items-center justify-center text-white text-sm font-medium">
                      {entry.avatar}
                    </div>
                  </div>
                  
                  <div className="flex-1">
                    <div className="font-medium">{entry.name}</div>
                    <div className="text-sm text-gray-500">
                      {entry.badges} badges earned
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <div className="font-bold text-lg">{entry.points}</div>
                    <div className="flex items-center gap-1">
                      {entry.trend === 'up' && <TrendingUp className="w-3 h-3 text-green-500" />}
                      {entry.trend === 'down' && <TrendingUp className="w-3 h-3 text-red-500 rotate-180" />}
                      {entry.trend === 'same' && <span className="w-3 h-3 text-gray-400">−</span>}
                      <span className="text-xs text-gray-500">vs last week</span>
                    </div>
                  </div>
                </div>
              </Card>
            ))}

            {/* Challenge Friends */}
            <Card className="p-4 bg-gradient-to-r from-purple-50 to-blue-50 border-purple-200">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-semibold text-purple-900">Challenge Friends</h4>
                  <p className="text-sm text-purple-700">Compete for bonus points!</p>
                </div>
                <Button size="sm" className="bg-purple-600 hover:bg-purple-700">
                  <Users className="w-4 h-4 mr-1" />
                  Invite
                </Button>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="rewards" className="p-4 space-y-3">
            <div className="mb-4 p-3 bg-gradient-to-r from-yellow-50 to-orange-50 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold text-orange-900">Your Points</div>
                  <div className="text-2xl font-bold text-orange-600">{userStats.points}</div>
                </div>
                <Gift className="w-8 h-8 text-orange-500" />
              </div>
            </div>

            {/* Available Rewards */}
            <div>
              <h3 className="font-semibold mb-3">Available Rewards</h3>
              {rewards.map((reward, idx) => (
                <Card key={idx} className="p-4 mb-3">
                  <div className="flex items-center gap-3">
                    <div className="text-2xl">{reward.icon}</div>
                    <div className="flex-1">
                      <h4 className="font-medium">{reward.name}</h4>
                      <div className="text-sm text-gray-500">{reward.points} points</div>
                    </div>
                    <Button
                      size="sm"
                      disabled={!reward.available || userStats.points < reward.points}
                      variant={reward.available ? 'default' : 'outline'}
                    >
                      {!reward.available ? (
                        <>
                          <Lock className="w-3 h-3 mr-1" />
                          Locked
                        </>
                      ) : userStats.points >= reward.points ? (
                        'Redeem'
                      ) : (
                        `Need ${reward.points - userStats.points} pts`
                      )}
                    </Button>
                  </div>
                </Card>
              ))}
            </div>

            {/* Special Offers */}
            <Card className="p-4 border-yellow-200 bg-yellow-50">
              <div className="flex items-start gap-2">
                <Sparkles className="w-5 h-5 text-yellow-600 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-yellow-900">Double Points Weekend!</h4>
                  <p className="text-sm text-yellow-700 mt-1">
                    Earn 2x points on all eco-friendly trips this weekend
                  </p>
                </div>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}