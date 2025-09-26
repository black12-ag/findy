import React, { useState } from 'react';
import { 
  ArrowLeft,
  Truck,
  Users,
  MapPin,
  Activity,
  AlertTriangle,
  CheckCircle,
  Clock,
  Fuel,
  DollarSign,
  TrendingUp,
  Settings,
  Filter,
  Download,
  Plus
} from 'lucide-react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Progress } from './ui/progress';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './ui/tabs';
import { Alert, AlertDescription } from './ui/alert';

interface Vehicle {
  id: string;
  name: string;
  type: string;
  driver: string;
  status: 'active' | 'idle' | 'maintenance' | 'offline';
  location: string;
  speed: number;
  fuel: number;
  mileage: number;
  lastUpdate: string;
}

interface Driver {
  id: string;
  name: string;
  avatar: string;
  vehicle: string;
  status: 'driving' | 'available' | 'break' | 'offline';
  rating: number;
  trips: number;
  hours: number;
  violations: number;
}

interface FleetManagementProps {
  onBack: () => void;
}

export function FleetManagement({ onBack }: FleetManagementProps) {
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);

  const fleetStats = {
    totalVehicles: 24,
    activeVehicles: 18,
    totalDrivers: 32,
    activeDrivers: 19,
    avgFuelEfficiency: '28 mpg',
    totalMileage: '45,230 mi',
    maintenanceDue: 3,
    alerts: 5
  };

  const vehicles: Vehicle[] = [
    {
      id: 'V001',
      name: 'Delivery Van 01',
      type: 'Van',
      driver: 'John Smith',
      status: 'active',
      location: '5th Avenue, Downtown',
      speed: 35,
      fuel: 75,
      mileage: 12453,
      lastUpdate: '2 min ago'
    },
    {
      id: 'V002',
      name: 'Truck 05',
      type: 'Truck',
      driver: 'Sarah Johnson',
      status: 'active',
      location: 'Highway I-95 North',
      speed: 65,
      fuel: 60,
      mileage: 45678,
      lastUpdate: '1 min ago'
    },
    {
      id: 'V003',
      name: 'Service Car 12',
      type: 'Sedan',
      driver: 'Mike Chen',
      status: 'idle',
      location: 'Office Parking',
      speed: 0,
      fuel: 90,
      mileage: 8234,
      lastUpdate: '15 min ago'
    },
    {
      id: 'V004',
      name: 'Delivery Van 03',
      type: 'Van',
      driver: 'Unassigned',
      status: 'maintenance',
      location: 'Service Center',
      speed: 0,
      fuel: 45,
      mileage: 34567,
      lastUpdate: '1 hour ago'
    }
  ];

  const drivers: Driver[] = [
    {
      id: 'D001',
      name: 'John Smith',
      avatar: 'JS',
      vehicle: 'Delivery Van 01',
      status: 'driving',
      rating: 4.8,
      trips: 234,
      hours: 42,
      violations: 0
    },
    {
      id: 'D002',
      name: 'Sarah Johnson',
      avatar: 'SJ',
      vehicle: 'Truck 05',
      status: 'driving',
      rating: 4.9,
      trips: 189,
      hours: 38,
      violations: 1
    },
    {
      id: 'D003',
      name: 'Mike Chen',
      avatar: 'MC',
      vehicle: 'Service Car 12',
      status: 'break',
      rating: 4.7,
      trips: 156,
      hours: 35,
      violations: 0
    },
    {
      id: 'D004',
      name: 'Emma Davis',
      avatar: 'ED',
      vehicle: 'Unassigned',
      status: 'available',
      rating: 4.6,
      trips: 98,
      hours: 28,
      violations: 2
    }
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
      case 'driving': return 'bg-green-100 text-green-700';
      case 'idle':
      case 'available': return 'bg-yellow-100 text-yellow-700';
      case 'maintenance':
      case 'break': return 'bg-orange-100 text-orange-700';
      case 'offline': return 'bg-gray-100 text-gray-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getFuelColor = (fuel: number) => {
    if (fuel > 50) return 'text-green-600';
    if (fuel > 25) return 'text-yellow-600';
    return 'text-red-600';
  };

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
              <h2 className="font-semibold text-gray-900">Fleet Management</h2>
              <p className="text-sm text-gray-500">Monitor and manage your fleet</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon">
              <Filter className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="icon">
              <Download className="w-4 h-4" />
            </Button>
            <Button size="sm">
              <Plus className="w-4 h-4 mr-1" />
              Add Vehicle
            </Button>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="p-4 grid grid-cols-2 gap-3 bg-white border-b">
        <Card className="p-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-2xl font-bold">{fleetStats.activeVehicles}/{fleetStats.totalVehicles}</div>
              <div className="text-sm text-gray-500">Active Vehicles</div>
            </div>
            <Truck className="w-8 h-8 text-blue-500" />
          </div>
        </Card>
        
        <Card className="p-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-2xl font-bold">{fleetStats.activeDrivers}/{fleetStats.totalDrivers}</div>
              <div className="text-sm text-gray-500">Active Drivers</div>
            </div>
            <Users className="w-8 h-8 text-green-500" />
          </div>
        </Card>
        
        <Card className="p-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-2xl font-bold">{fleetStats.avgFuelEfficiency}</div>
              <div className="text-sm text-gray-500">Avg Efficiency</div>
            </div>
            <Fuel className="w-8 h-8 text-yellow-500" />
          </div>
        </Card>
        
        <Card className="p-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-2xl font-bold">{fleetStats.alerts}</div>
              <div className="text-sm text-gray-500">Active Alerts</div>
            </div>
            <AlertTriangle className="w-8 h-8 text-red-500" />
          </div>
        </Card>
      </div>

      <div className="flex-1 overflow-y-auto">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="bg-white border-b px-4">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="vehicles">Vehicles</TabsTrigger>
              <TabsTrigger value="drivers">Drivers</TabsTrigger>
              <TabsTrigger value="analytics">Analytics</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="overview" className="p-4 space-y-4">
            {/* Live Map Preview */}
            <Card className="p-4">
              <h3 className="font-semibold mb-3">Live Fleet Map</h3>
              <div className="h-48 bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg flex items-center justify-center">
                <div className="text-center">
                  <MapPin className="w-12 h-12 text-blue-500 mx-auto mb-2" />
                  <p className="text-sm text-gray-600">18 vehicles active</p>
                  <p className="text-xs text-gray-500">Across 5 regions</p>
                </div>
              </div>
            </Card>

            {/* Active Alerts */}
            <Card className="p-4">
              <h3 className="font-semibold mb-3">Active Alerts</h3>
              <div className="space-y-2">
                <Alert className="border-red-200 bg-red-50">
                  <AlertTriangle className="w-4 h-4 text-red-600" />
                  <AlertDescription className="text-red-700">
                    Vehicle V004 - Maintenance overdue by 500 miles
                  </AlertDescription>
                </Alert>
                <Alert className="border-yellow-200 bg-yellow-50">
                  <AlertTriangle className="w-4 h-4 text-yellow-600" />
                  <AlertDescription className="text-yellow-700">
                    Driver D002 - Approaching weekly hour limit (38/40 hours)
                  </AlertDescription>
                </Alert>
                <Alert className="border-orange-200 bg-orange-50">
                  <Fuel className="w-4 h-4 text-orange-600" />
                  <AlertDescription className="text-orange-700">
                    Vehicle V002 - Low fuel alert (15% remaining)
                  </AlertDescription>
                </Alert>
              </div>
            </Card>

            {/* Today's Performance */}
            <Card className="p-4">
              <h3 className="font-semibold mb-3">Today's Performance</h3>
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Deliveries Completed</span>
                    <span className="font-medium">42/50</span>
                  </div>
                  <Progress value={84} className="h-2" />
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>On-Time Rate</span>
                    <span className="font-medium">92%</span>
                  </div>
                  <Progress value={92} className="h-2" />
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Fleet Utilization</span>
                    <span className="font-medium">75%</span>
                  </div>
                  <Progress value={75} className="h-2" />
                </div>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="vehicles" className="p-4 space-y-3">
            {vehicles.map((vehicle) => (
              <Card 
                key={vehicle.id} 
                className="p-4 cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => setSelectedVehicle(vehicle)}
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold">{vehicle.name}</h4>
                      <Badge className={getStatusColor(vehicle.status)}>
                        {vehicle.status}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-500 mt-1">ID: {vehicle.id} • {vehicle.type}</p>
                    <p className="text-sm text-gray-600 mt-1">
                      Driver: {vehicle.driver}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-gray-500">{vehicle.lastUpdate}</div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 mb-3">
                  <div>
                    <div className="text-xs text-gray-500">Location</div>
                    <div className="text-sm font-medium truncate">{vehicle.location}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Speed</div>
                    <div className="text-sm font-medium">{vehicle.speed} mph</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Mileage</div>
                    <div className="text-sm font-medium">{vehicle.mileage.toLocaleString()} mi</div>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-500">Fuel Level</span>
                    <span className={`font-medium ${getFuelColor(vehicle.fuel)}`}>
                      {vehicle.fuel}%
                    </span>
                  </div>
                  <Progress value={vehicle.fuel} className="h-2" />
                </div>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="drivers" className="p-4 space-y-3">
            {drivers.map((driver) => (
              <Card key={driver.id} className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white font-medium">
                      {driver.avatar}
                    </div>
                    <div>
                      <h4 className="font-semibold">{driver.name}</h4>
                      <p className="text-sm text-gray-500">
                        {driver.vehicle !== 'Unassigned' ? driver.vehicle : 'No vehicle assigned'}
                      </p>
                    </div>
                  </div>
                  <Badge className={getStatusColor(driver.status)}>
                    {driver.status}
                  </Badge>
                </div>

                <div className="grid grid-cols-4 gap-3 mt-4">
                  <div className="text-center">
                    <div className="text-lg font-semibold">{driver.rating}</div>
                    <div className="text-xs text-gray-500">Rating</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-semibold">{driver.trips}</div>
                    <div className="text-xs text-gray-500">Trips</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-semibold">{driver.hours}h</div>
                    <div className="text-xs text-gray-500">This Week</div>
                  </div>
                  <div className="text-center">
                    <div className={`text-lg font-semibold ${driver.violations > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {driver.violations}
                    </div>
                    <div className="text-xs text-gray-500">Violations</div>
                  </div>
                </div>

                <div className="flex gap-2 mt-3">
                  <Button variant="outline" size="sm" className="flex-1">
                    View Details
                  </Button>
                  <Button variant="outline" size="sm" className="flex-1">
                    Assign Vehicle
                  </Button>
                </div>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="analytics" className="p-4 space-y-4">
            {/* Cost Analysis */}
            <Card className="p-4">
              <h3 className="font-semibold mb-3">Cost Analysis (This Month)</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Fuel Costs</span>
                  <span className="font-semibold">$4,250</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Maintenance</span>
                  <span className="font-semibold">$1,890</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Insurance</span>
                  <span className="font-semibold">$2,100</span>
                </div>
                <Separator />
                <div className="flex justify-between items-center">
                  <span className="font-medium">Total Expenses</span>
                  <span className="font-bold text-lg">$8,240</span>
                </div>
              </div>
            </Card>

            {/* Efficiency Metrics */}
            <Card className="p-4">
              <h3 className="font-semibold mb-3">Efficiency Metrics</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-gray-600">Avg Delivery Time</div>
                  <div className="text-xl font-bold">32 min</div>
                  <div className="text-xs text-green-600">↓ 5% from last month</div>
                </div>
                <div>
                  <div className="text-sm text-gray-600">Fuel Efficiency</div>
                  <div className="text-xl font-bold">28 mpg</div>
                  <div className="text-xs text-green-600">↑ 3% from last month</div>
                </div>
                <div>
                  <div className="text-sm text-gray-600">Vehicle Downtime</div>
                  <div className="text-xl font-bold">4.2%</div>
                  <div className="text-xs text-red-600">↑ 1% from last month</div>
                </div>
                <div>
                  <div className="text-sm text-gray-600">Route Optimization</div>
                  <div className="text-xl font-bold">87%</div>
                  <div className="text-xs text-green-600">↑ 8% from last month</div>
                </div>
              </div>
            </Card>

            {/* Revenue Impact */}
            <Card className="p-4 bg-green-50 border-green-200">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-green-900">Revenue Impact</h3>
                  <p className="text-2xl font-bold text-green-700 mt-2">+$12,450</p>
                  <p className="text-sm text-green-600">Saved through optimization</p>
                </div>
                <TrendingUp className="w-12 h-12 text-green-500" />
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function Separator() {
  return <div className="h-px bg-gray-200 my-3" />;
}