// Mock data and handlers for all components that need them

export const mockTransitRoutes = [
  {
    id: '1',
    from: { name: 'Union Station', address: '800 N Alameda St' },
    to: { name: 'Hollywood & Highland', address: '6801 Hollywood Blvd' },
    duration: '35 min',
    departureTime: '3:15 PM',
    arrivalTime: '3:50 PM',
    steps: [
      { type: 'walk', duration: '5 min', instruction: 'Walk to Metro Red Line' },
      { type: 'metro', line: 'Red Line', duration: '25 min', stops: 5 },
      { type: 'walk', duration: '5 min', instruction: 'Walk to destination' }
    ],
    cost: '$1.75'
  },
  {
    id: '2',
    from: { name: 'LAX Airport', address: '1 World Way' },
    to: { name: 'Downtown LA', address: 'Downtown Los Angeles' },
    duration: '45 min',
    departureTime: '3:30 PM',
    arrivalTime: '4:15 PM',
    steps: [
      { type: 'bus', line: 'FlyAway', duration: '35 min', stops: 2 },
      { type: 'walk', duration: '10 min', instruction: 'Walk to destination' }
    ],
    cost: '$9.75'
  }
];

export const mockOfflineMaps = [
  {
    id: '1',
    name: 'Los Angeles',
    size: '285 MB',
    lastUpdated: '2024-01-15',
    status: 'downloaded',
    coverage: 'City + Metro Area'
  },
  {
    id: '2',
    name: 'San Francisco',
    size: '195 MB',
    lastUpdated: '2024-01-10',
    status: 'downloading',
    progress: 65,
    coverage: 'Bay Area'
  },
  {
    id: '3',
    name: 'New York City',
    size: '450 MB',
    lastUpdated: null,
    status: 'available',
    coverage: 'All Boroughs'
  }
];

export const mockSafetyAlerts = [
  {
    id: '1',
    type: 'accident',
    severity: 'high',
    location: 'I-405 N near Sunset Blvd',
    time: '10 minutes ago',
    description: 'Multi-vehicle accident blocking 2 lanes'
  },
  {
    id: '2',
    type: 'weather',
    severity: 'medium',
    location: 'Pacific Coast Highway',
    time: '1 hour ago',
    description: 'Heavy fog reducing visibility'
  },
  {
    id: '3',
    type: 'roadwork',
    severity: 'low',
    location: 'Wilshire Blvd',
    time: '2 hours ago',
    description: 'Lane closure for maintenance'
  }
];

export const mockIntegrations = [
  {
    id: 'spotify',
    name: 'Spotify',
    icon: '🎵',
    connected: true,
    description: 'Control music during navigation'
  },
  {
    id: 'calendar',
    name: 'Google Calendar',
    icon: '📅',
    connected: true,
    description: 'Navigate to calendar events'
  },
  {
    id: 'slack',
    name: 'Slack',
    icon: '💬',
    connected: false,
    description: 'Share location with team'
  },
  {
    id: 'tesla',
    name: 'Tesla',
    icon: '🚗',
    connected: false,
    description: 'Send routes to vehicle'
  }
];

export const mockAnalyticsData = {
  totalDistance: '1,247 km',
  totalTime: '42 hours',
  totalTrips: 156,
  averageSpeed: '29.7 km/h',
  co2Saved: '45.2 kg',
  monthlyStats: [
    { month: 'Jan', trips: 45, distance: 320 },
    { month: 'Feb', trips: 38, distance: 285 },
    { month: 'Mar', trips: 52, distance: 410 },
    { month: 'Apr', trips: 21, distance: 232 }
  ],
  topRoutes: [
    { route: 'Home → Work', count: 42 },
    { route: 'Work → Gym', count: 18 },
    { route: 'Home → Grocery Store', count: 15 }
  ]
};

export const mockAchievements = [
  {
    id: '1',
    title: 'Early Bird',
    description: 'Complete 10 morning commutes before 7 AM',
    icon: '🌅',
    progress: 8,
    maxProgress: 10,
    points: 100,
    unlocked: false
  },
  {
    id: '2',
    title: 'Eco Warrior',
    description: 'Save 50kg of CO2 by using public transit',
    icon: '🌱',
    progress: 45,
    maxProgress: 50,
    points: 200,
    unlocked: false
  },
  {
    id: '3',
    title: 'Explorer',
    description: 'Visit 100 different places',
    icon: '🗺️',
    progress: 100,
    maxProgress: 100,
    points: 150,
    unlocked: true,
    unlockedDate: '2024-01-15'
  }
];

export const mockFleetVehicles = [
  {
    id: 'v1',
    name: 'Delivery Van #001',
    status: 'active',
    location: { lat: 34.0522, lng: -118.2437 },
    driver: 'John Smith',
    route: 'Downtown Route A',
    deliveries: 12,
    completed: 7,
    fuel: 65,
    nextStop: '123 Main St'
  },
  {
    id: 'v2',
    name: 'Delivery Van #002',
    status: 'idle',
    location: { lat: 34.0622, lng: -118.2537 },
    driver: 'Jane Doe',
    route: null,
    deliveries: 0,
    completed: 0,
    fuel: 89,
    nextStop: null
  },
  {
    id: 'v3',
    name: 'Service Truck #003',
    status: 'maintenance',
    location: { lat: 34.0422, lng: -118.2337 },
    driver: null,
    route: null,
    deliveries: 0,
    completed: 0,
    fuel: 45,
    nextStop: null
  }
];

export const mockAPIEndpoints = [
  {
    method: 'GET',
    endpoint: '/api/routes/calculate',
    description: 'Calculate optimal route between points',
    parameters: ['origin', 'destination', 'mode', 'alternatives'],
    example: '{ origin: [34.05, -118.24], destination: [34.06, -118.25] }'
  },
  {
    method: 'POST',
    endpoint: '/api/places/search',
    description: 'Search for places by query',
    parameters: ['query', 'location', 'radius', 'type'],
    example: '{ query: "coffee", radius: 1000 }'
  },
  {
    method: 'GET',
    endpoint: '/api/traffic/incidents',
    description: 'Get real-time traffic incidents',
    parameters: ['bounds', 'severity', 'type'],
    example: '{ bounds: [[34.0, -118.3], [34.1, -118.2]] }'
  }
];

// Helper functions for button actions
export const mockButtonActions = {
  handleDemoClick: (message: string = 'Demo action') => {
    console.log(`Button clicked: ${message}`);
    // You can add toast notifications here
  },
  
  handleShare: (content: any) => {
    if (navigator.share) {
      navigator.share({
        title: 'Shared from PathFinder',
        text: JSON.stringify(content),
        url: window.location.href
      });
    } else {
      console.log('Share:', content);
    }
  },
  
  handleDownload: (item: any) => {
    console.log('Downloading:', item);
    // Simulate download
    return new Promise(resolve => {
      setTimeout(() => {
        console.log('Download complete:', item);
        resolve(true);
      }, 2000);
    });
  },
  
  handleConnect: (service: string) => {
    console.log('Connecting to:', service);
    // Simulate connection
    return new Promise(resolve => {
      setTimeout(() => {
        console.log('Connected to:', service);
        resolve(true);
      }, 1500);
    });
  },
  
  handleSave: (data: any) => {
    console.log('Saving:', data);
    localStorage.setItem('app_data', JSON.stringify(data));
    return true;
  },
  
  handleExport: (data: any, format: string = 'json') => {
    console.log(`Exporting as ${format}:`, data);
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `export.${format}`;
    a.click();
  }
};

// Sample place data for empty states
export const samplePlaceData = {
  id: 'sample-place',
  name: 'Central Park Coffee',
  address: '123 Park Ave, New York, NY 10001',
  category: 'cafe',
  rating: 4.5,
  reviewCount: 234,
  priceLevel: 2,
  isOpen: true,
  openHours: 'Open until 9 PM',
  phone: '(555) 123-4567',
  website: 'centralparkcoffee.com',
  distance: '0.5 km',
  photos: [
    'https://via.placeholder.com/400x300/4F46E5/ffffff?text=Coffee+Shop'
  ],
  amenities: ['WiFi', 'Parking', 'Outdoor Seating', 'Pet Friendly'],
  reviews: [
    {
      id: '1',
      author: 'Alice Johnson',
      rating: 5,
      text: 'Great coffee and atmosphere!',
      date: '2 days ago'
    },
    {
      id: '2',
      author: 'Bob Smith',
      rating: 4,
      text: 'Nice place to work from',
      date: '1 week ago'
    }
  ]
};

// ETA sharing data
export const mockETAData = {
  currentLocation: 'Downtown Station',
  destination: 'Airport Terminal 2',
  estimatedArrival: '4:30 PM',
  currentTime: '3:45 PM',
  remainingTime: '45 minutes',
  remainingDistance: '18.5 km',
  trafficCondition: 'Moderate',
  shareLink: 'https://pathfinder.app/track/abc123',
  contacts: [
    { id: '1', name: 'Mom', phone: '+1234567890' },
    { id: '2', name: 'John', phone: '+0987654321' },
    { id: '3', name: 'Work', phone: '+1122334455' }
  ]
};