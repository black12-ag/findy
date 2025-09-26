/**
 * OSRM Web Worker for Client-Side Routing
 * Handles offline route calculation using OSRM engine
 */

// In a real implementation, this would load OSRM WebAssembly module
// For now, we'll simulate the routing with enhanced logic

let osrmEngine = null;
let routingData = new Map();

// Simulate OSRM engine initialization
function initializeOSRM() {
  // This would load the actual OSRM WASM module and routing data
  // For demo purposes, we'll create a mock engine
  return {
    route: (coordinates, options) => {
      return simulateOSRMRouting(coordinates, options);
    },
    match: (coordinates, options) => {
      return simulateMapMatching(coordinates, options);
    },
    nearest: (coordinate) => {
      return simulateNearestRoad(coordinate);
    }
  };
}

function simulateOSRMRouting(coordinates, options = {}) {
  const [start, end] = coordinates;
  
  // Calculate distance and estimate route
  const distance = calculateDistance(start[1], start[0], end[1], end[0]) * 1000; // meters
  const duration = estimateDuration(distance, options.mode || 'driving');
  
  // Generate realistic route geometry
  const geometry = generateRouteGeometry(start, end, Math.ceil(distance / 1000));
  
  // Generate turn-by-turn instructions
  const steps = generateRouteSteps(geometry, options.mode || 'driving');
  
  return {
    routes: [{
      distance: distance,
      duration: duration,
      geometry: {
        coordinates: geometry,
        type: 'LineString'
      },
      legs: [{
        distance: distance,
        duration: duration,
        steps: steps
      }]
    }],
    waypoints: [
      {
        location: start,
        name: 'Start'
      },
      {
        location: end,
        name: 'End'
      }
    ],
    code: 'Ok'
  };
}

function simulateMapMatching(coordinates, options = {}) {
  // Simulate map matching - snapping GPS points to roads
  const matchedCoordinates = coordinates.map(coord => {
    // Add small random offset to simulate road snapping
    return [
      coord[0] + (Math.random() - 0.5) * 0.0001,
      coord[1] + (Math.random() - 0.5) * 0.0001
    ];
  });
  
  return {
    matchings: [{
      confidence: 0.95,
      geometry: {
        coordinates: matchedCoordinates,
        type: 'LineString'
      },
      legs: [{
        distance: calculateTotalDistance(matchedCoordinates),
        duration: estimateDuration(calculateTotalDistance(matchedCoordinates), options.mode || 'driving')
      }]
    }],
    tracepoints: coordinates.map((coord, index) => ({
      location: matchedCoordinates[index],
      matchings_index: 0,
      waypoint_index: index,
      alternatives_count: 1
    }))
  };
}

function simulateNearestRoad(coordinate) {
  // Simulate finding nearest road point
  const offset = 0.0001;
  return {
    waypoints: [{
      location: [
        coordinate[0] + (Math.random() - 0.5) * offset,
        coordinate[1] + (Math.random() - 0.5) * offset
      ],
      distance: Math.random() * 50 // meters to nearest road
    }]
  };
}

function calculateDistance(lat1, lng1, lat2, lng2) {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

function calculateTotalDistance(coordinates) {
  let total = 0;
  for (let i = 1; i < coordinates.length; i++) {
    total += calculateDistance(
      coordinates[i-1][1], coordinates[i-1][0],
      coordinates[i][1], coordinates[i][0]
    );
  }
  return total * 1000; // Convert to meters
}

function estimateDuration(distanceMeters, mode) {
  const speeds = {
    driving: 50000, // 50 km/h in m/h
    walking: 5000,  // 5 km/h in m/h
    cycling: 15000  // 15 km/h in m/h
  };
  
  const speed = speeds[mode] || speeds.driving;
  return (distanceMeters / speed) * 3600; // seconds
}

function generateRouteGeometry(start, end, segments) {
  const geometry = [start];
  
  for (let i = 1; i < segments; i++) {
    const ratio = i / segments;
    const lat = start[1] + (end[1] - start[1]) * ratio;
    const lng = start[0] + (end[0] - start[0]) * ratio;
    
    // Add some variation to make route more realistic
    const variation = 0.0005;
    const latVariation = (Math.random() - 0.5) * variation;
    const lngVariation = (Math.random() - 0.5) * variation;
    
    geometry.push([lng + lngVariation, lat + latVariation]);
  }
  
  geometry.push(end);
  return geometry;
}

function generateRouteSteps(geometry, mode) {
  const steps = [];
  const verb = mode === 'walking' ? 'Walk' : mode === 'cycling' ? 'Cycle' : 'Drive';
  
  steps.push({
    distance: 0,
    duration: 0,
    geometry: geometry.slice(0, 2),
    maneuver: {
      instruction: `${verb} straight ahead`,
      type: 'depart',
      location: geometry[0]
    },
    mode: mode,
    name: 'Starting point'
  });
  
  for (let i = 1; i < geometry.length - 2; i++) {
    const segmentDistance = calculateDistance(
      geometry[i][1], geometry[i][0],
      geometry[i+1][1], geometry[i+1][0]
    ) * 1000;
    
    steps.push({
      distance: segmentDistance,
      duration: estimateDuration(segmentDistance, mode),
      geometry: geometry.slice(i, i + 2),
      maneuver: {
        instruction: 'Continue straight',
        type: 'continue',
        location: geometry[i]
      },
      mode: mode,
      name: 'Road segment'
    });
  }
  
  steps.push({
    distance: 0,
    duration: 0,
    geometry: geometry.slice(-2),
    maneuver: {
      instruction: 'You have arrived at your destination',
      type: 'arrive',
      location: geometry[geometry.length - 1]
    },
    mode: mode,
    name: 'Destination'
  });
  
  return steps;
}

// Web Worker message handling
self.onmessage = function(event) {
  const { type, from, to, mode, options } = event.data;
  
  try {
    // Initialize OSRM engine if not already done
    if (!osrmEngine) {
      osrmEngine = initializeOSRM();
    }
    
    switch (type) {
      case 'CALCULATE_ROUTE':
        const coordinates = [[from.lng, from.lat], [to.lng, to.lat]];
        const result = osrmEngine.route(coordinates, { ...options, mode });
        
        self.postMessage({
          type: 'ROUTE_CALCULATED',
          result: result
        });
        break;
        
      case 'MAP_MATCH':
        const matchResult = osrmEngine.match(event.data.coordinates, options);
        
        self.postMessage({
          type: 'MAP_MATCHED',
          result: matchResult
        });
        break;
        
      case 'FIND_NEAREST':
        const nearestResult = osrmEngine.nearest([from.lng, from.lat]);
        
        self.postMessage({
          type: 'NEAREST_FOUND',
          result: nearestResult
        });
        break;
        
      default:
        throw new Error(`Unknown message type: ${type}`);
    }
  } catch (error) {
    self.postMessage({
      type: 'ERROR',
      error: error.message
    });
  }
};

// Handle worker initialization
self.postMessage({
  type: 'WORKER_READY'
});