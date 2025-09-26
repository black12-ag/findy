import React, { useState } from 'react';
import { 
  ArrowLeft,
  TrendingUp,
  Car,
  MapPin,
  Clock,
  Fuel,
  Leaf,
  Award,
  Calendar,
  BarChart3,
  PieChart,
  Activity,
  Download,
  Filter,
  ChevronDown
} from 'lucide-react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Progress } from './ui/progress';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './ui/tabs';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from './ui/select';

interface AnalyticsDashboardProps {
  onBack: () => void;
}

export function AnalyticsDashboard({ onBack }: AnalyticsDashboardProps) {
  const [timeRange, setTimeRange] = useState('week');
  const [selectedMetric, setSelectedMetric] = useState('all');

  const stats = {
    totalDistance: '1,234 mi',
    totalTime: '48h 32m',
    avgSpeed: '28 mph',
    co2Saved: '124 kg',
    fuelSaved: '$89',
    ecoScore: 82
  };

  const weeklyData = [
    { day: 'Mon', miles: 45, trips: 3 },
    { day: 'Tue', miles: 32, trips: 2 },
    { day: 'Wed', miles: 67, trips: 4 },
    { day: 'Thu', miles: 28, trips: 2 },
    { day: 'Fri', miles: 89, trips: 5 },
    { day: 'Sat', miles: 120, trips: 6 },
    { day: 'Sun', miles: 56, trips: 3 }
  ];

  const transportModes = [
    { mode: 'Car', percentage: 45, color: 'bg-blue-500' },
    { mode: 'Transit', percentage: 30, color: 'bg-green-500' },
    { mode: 'Walking', percentage: 15, color: 'bg-yellow-500' },
    { mode: 'Cycling', percentage: 10, color: 'bg-purple-500' }
  ];

  const achievements = [
    { id: 1, name: 'Eco Warrior', description: 'Saved 100kg CO2', icon: '🌱', unlocked: true },
    { id: 2, name: 'Explorer', description: '1000 miles traveled', icon: '🗺️', unlocked: true },
    { id: 3, name: 'Transit Hero', description: '50 transit trips', icon: '🚇', unlocked: false },
    { id: 4, name: 'Early Bird', description: '20 morning commutes', icon: '🌅', unlocked: true }
  ];

  return (
    <div className="h-full bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 bg-white px-4 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={onBack}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h2 className="font-semibold text-gray-900">Analytics</h2>
              <p className="text-sm text-gray-500">Your driving insights</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Select value={timeRange} onValueChange={setTimeRange}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="week">This Week</SelectItem>
                <SelectItem value="month">This Month</SelectItem>
                <SelectItem value="year">This Year</SelectItem>
                <SelectItem value="all">All Time</SelectItem>
              </SelectContent>
            </Select>
            
            <Button variant="outline" size="icon">
              <Download className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Quick Stats */}
        <div className="p-4 grid grid-cols-2 gap-3">
          <Card className="p-4">
            <div className="flex items-center justify-between mb-2">
              <MapPin className="w-4 h-4 text-gray-500" />
              <TrendingUp className="w-3 h-3 text-green-500" />
            </div>
            <div className="text-2xl font-bold text-gray-900">{stats.totalDistance}</div>
            <div className="text-sm text-gray-500">Total Distance</div>
          </Card>
          
          <Card className="p-4">
            <div className="flex items-center justify-between mb-2">
              <Clock className="w-4 h-4 text-gray-500" />
              <TrendingUp className="w-3 h-3 text-green-500" />
            </div>
            <div className="text-2xl font-bold text-gray-900">{stats.totalTime}</div>
            <div className="text-sm text-gray-500">Travel Time</div>
          </Card>
          
          <Card className="p-4">
            <div className="flex items-center justify-between mb-2">
              <Leaf className="w-4 h-4 text-green-500" />
              <Badge variant="secondary" className="text-xs">Eco</Badge>
            </div>
            <div className="text-2xl font-bold text-gray-900">{stats.co2Saved}</div>
            <div className="text-sm text-gray-500">CO2 Saved</div>
          </Card>
          
          <Card className="p-4">
            <div className="flex items-center justify-between mb-2">
              <Fuel className="w-4 h-4 text-gray-500" />
              <span className="text-xs text-green-600 font-medium">+12%</span>
            </div>
            <div className="text-2xl font-bold text-gray-900">{stats.fuelSaved}</div>
            <div className="text-sm text-gray-500">Fuel Saved</div>
          </Card>
        </div>

        {/* Tabs for different views */}
        <Tabs defaultValue="overview" className="px-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="trips">Trips</TabsTrigger>
            <TabsTrigger value="eco">Eco Impact</TabsTrigger>
          </TabsList>
          
          <TabsContent value="overview" className="space-y-4">
            {/* Weekly Activity Chart */}
            <Card className="p-4">
              <h3 className="font-medium text-gray-900 mb-4">Weekly Activity</h3>
              <div className="space-y-3">
                {weeklyData.map((day) => (
                  <div key={day.day} className="flex items-center gap-3">
                    <span className="text-sm text-gray-600 w-12">{day.day}</span>
                    <div className="flex-1 bg-gray-200 rounded-full h-6 relative overflow-hidden">
                      <div 
                        className="absolute left-0 top-0 h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full"
                        style={{ width: `${(day.miles / 120) * 100}%` }}
                      />
                      <span className="absolute inset-0 flex items-center px-2 text-xs font-medium text-gray-700">
                        {day.miles} mi
                      </span>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {day.trips} trips
                    </Badge>
                  </div>
                ))}
              </div>
            </Card>

            {/* Transport Mode Distribution */}
            <Card className="p-4">
              <h3 className="font-medium text-gray-900 mb-4">Transport Modes</h3>
              <div className="space-y-3">
                {transportModes.map((mode) => (
                  <div key={mode.mode}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-700">{mode.mode}</span>
                      <span className="text-gray-500">{mode.percentage}%</span>
                    </div>
                    <Progress value={mode.percentage} className="h-2" />
                  </div>
                ))}
              </div>
            </Card>
          </TabsContent>
          
          <TabsContent value="trips" className="space-y-4">
            {/* Recent Trips */}
            <Card className="p-4">
              <h3 className="font-medium text-gray-900 mb-4">Recent Trips</h3>
              <div className="space-y-3">
                {[
                  { from: 'Home', to: 'Office', distance: '12 mi', time: '35 min', mode: 'Car' },
                  { from: 'Office', to: 'Gym', distance: '3 mi', time: '15 min', mode: 'Bike' },
                  { from: 'Gym', to: 'Grocery Store', distance: '2 mi', time: '8 min', mode: 'Walk' },
                  { from: 'Store', to: 'Home', distance: '5 mi', time: '12 min', mode: 'Transit' }
                ].map((trip, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50">
                    <div>
                      <div className="font-medium text-gray-900">{trip.from} → {trip.to}</div>
                      <div className="text-sm text-gray-500">{trip.distance} • {trip.time}</div>
                    </div>
                    <Badge variant="secondary">{trip.mode}</Badge>
                  </div>
                ))}
              </div>
            </Card>

            {/* Trip Statistics */}
            <Card className="p-4">
              <h3 className="font-medium text-gray-900 mb-4">Trip Patterns</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-gray-600 mb-1">Most Common Route</div>
                  <div className="font-medium">Home ↔ Office</div>
                  <div className="text-xs text-gray-500">42 trips this month</div>
                </div>
                <div>
                  <div className="text-sm text-gray-600 mb-1">Peak Travel Time</div>
                  <div className="font-medium">8:00 AM - 9:00 AM</div>
                  <div className="text-xs text-gray-500">Weekdays</div>
                </div>
                <div>
                  <div className="text-sm text-gray-600 mb-1">Avg Trip Length</div>
                  <div className="font-medium">8.5 miles</div>
                  <div className="text-xs text-gray-500">28 minutes</div>
                </div>
                <div>
                  <div className="text-sm text-gray-600 mb-1">Preferred Mode</div>
                  <div className="font-medium">Car (45%)</div>
                  <div className="text-xs text-gray-500">Most used</div>
                </div>
              </div>
            </Card>
          </TabsContent>
          
          <TabsContent value="eco" className="space-y-4">
            {/* Eco Score */}
            <Card className="p-4">
              <h3 className="font-medium text-gray-900 mb-4">Eco Score</h3>
              <div className="flex items-center justify-center py-4">
                <div className="relative">
                  <div className="w-32 h-32 rounded-full bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center">
                    <div className="text-4xl font-bold text-white">{stats.ecoScore}</div>
                  </div>
                  <Leaf className="absolute -bottom-2 -right-2 w-8 h-8 text-green-600 bg-white rounded-full p-1" />
                </div>
              </div>
              <p className="text-center text-gray-600 mt-4">
                Great job! You're in the top 20% of eco-friendly drivers
              </p>
            </Card>

            {/* Environmental Impact */}
            <Card className="p-4">
              <h3 className="font-medium text-gray-900 mb-4">Environmental Impact</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                      🌳
                    </div>
                    <div>
                      <div className="font-medium">Trees Saved</div>
                      <div className="text-sm text-gray-500">Equivalent CO2 offset</div>
                    </div>
                  </div>
                  <div className="text-xl font-bold text-green-600">12</div>
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                      💧
                    </div>
                    <div>
                      <div className="font-medium">Gallons Saved</div>
                      <div className="text-sm text-gray-500">Fuel conservation</div>
                    </div>
                  </div>
                  <div className="text-xl font-bold text-blue-600">34</div>
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                      🚶
                    </div>
                    <div>
                      <div className="font-medium">Green Miles</div>
                      <div className="text-sm text-gray-500">Walking/Cycling</div>
                    </div>
                  </div>
                  <div className="text-xl font-bold text-purple-600">156</div>
                </div>
              </div>
            </Card>

            {/* Achievements */}
            <Card className="p-4">
              <h3 className="font-medium text-gray-900 mb-4">Eco Achievements</h3>
              <div className="grid grid-cols-2 gap-3">
                {achievements.map((achievement) => (
                  <div 
                    key={achievement.id}
                    className={`p-3 rounded-lg border ${
                      achievement.unlocked 
                        ? 'bg-white border-green-200' 
                        : 'bg-gray-50 border-gray-200 opacity-60'
                    }`}
                  >
                    <div className="text-2xl mb-1">{achievement.icon}</div>
                    <div className="font-medium text-sm">{achievement.name}</div>
                    <div className="text-xs text-gray-500">{achievement.description}</div>
                    {achievement.unlocked && (
                      <Award className="w-3 h-3 text-green-500 mt-1" />
                    )}
                  </div>
                ))}
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}