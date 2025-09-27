import React, { useState, useEffect } from 'react';
import { 
  Plus,
  X,
  GripVertical,
  MapPin,
  Clock,
  Route,
  Save,
  Share2,
  ArrowUp,
  ArrowDown,
  Navigation,
  Calendar,
  Leaf
} from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card } from './ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Switch } from './ui/switch';
import { Badge } from './ui/badge';
import { directionsService } from '../services/directionsService';
import { geocodingService } from '../services/geocodingService';
import { ORSDirectionsService, setORSApiKey } from '../services/googleUnifiedService';
import tspSolver, { TSPLocation, TSPConstraints, TSPOptimizationOptions } from '../services/tspSolver';

interface Location {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
}

interface RouteStop {
  id: string;
  location: Location | null;
  stopDuration: number; // minutes
  timeWindow?: {
    earliest: string; // HH:MM format
    latest: string; // HH:MM format
  };
  priority?: 'low' | 'medium' | 'high' | 'critical';
  deliverySize?: number; // for capacity planning
  serviceTime?: number; // additional service time in minutes
}

interface MultiStopRoutePlannerProps {
  onRouteCalculated: (route: any) => void;
  onBack: () => void;
}

export function MultiStopRoutePlanner({ onRouteCalculated, onBack }: MultiStopRoutePlannerProps) {
  const [stops, setStops] = useState<RouteStop[]>([
    { id: '1', location: null, stopDuration: 0 },
    { id: '2', location: null, stopDuration: 0 }
  ]);
  
  const [routeOptions, setRouteOptions] = useState({
    optimize: 'time', // 'time', 'distance', 'fuel', 'cost'
    avoidTolls: false,
    avoidHighways: false,
    departureTime: '',
    isRoundTrip: false,
    vehicleCapacity: 1000, // kg or units
    maxDrivingTime: 480, // minutes (8 hours)
    considerTraffic: true,
    prioritizeHighPriority: true
  });
  
  const [calculatedRoute, setCalculatedRoute] = useState<any>(null);
  const [isCalculating, setIsCalculating] = useState(false);

  const [searchResults, setSearchResults] = useState<Location[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchQueries, setSearchQueries] = useState<{[key: string]: string}>({});
  
  // Search for locations using real geocoding service
  const searchLocations = async (query: string, stopId: string) => {
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }
    
    setIsSearching(true);
    try {
      const results = await geocodingService.searchPlaces(query, { size: 8 });
      const locations: Location[] = results.map(result => ({
        id: result.id,
        name: result.name,
        address: result.address,
        lat: result.lat,
        lng: result.lng
      }));
      setSearchResults(locations);
    } catch (error) {
      // Fallback to empty results
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };
  
  // Debounced search
  useEffect(() => {
    const timeouts: {[key: string]: NodeJS.Timeout} = {};
    
    Object.entries(searchQueries).forEach(([stopId, query]) => {
      if (timeouts[stopId]) clearTimeout(timeouts[stopId]);
      timeouts[stopId] = setTimeout(() => {
        searchLocations(query, stopId);
      }, 300);
    });
    
    return () => {
      Object.values(timeouts).forEach(timeout => clearTimeout(timeout));
    };
  }, [searchQueries]);

  const addStop = () => {
    if (stops.length < 10) {
      setStops([...stops, { id: Date.now().toString(), location: null, stopDuration: 0 }]);
    }
  };

  const removeStop = (stopId: string) => {
    if (stops.length > 2) {
      setStops(stops.filter(stop => stop.id !== stopId));
    }
  };

  const updateStopLocation = (stopId: string, location: Location) => {
    setStops(stops.map(stop => 
      stop.id === stopId ? { ...stop, location } : stop
    ));
  };

  const updateStopDuration = (stopId: string, duration: number) => {
    setStops(stops.map(stop => 
      stop.id === stopId ? { ...stop, stopDuration: duration } : stop
    ));
  };

  const moveStop = (stopId: string, direction: 'up' | 'down') => {
    const index = stops.findIndex(stop => stop.id === stopId);
    if (
      (direction === 'up' && index > 0) ||
      (direction === 'down' && index < stops.length - 1)
    ) {
      const newStops = [...stops];
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      [newStops[index], newStops[targetIndex]] = [newStops[targetIndex], newStops[index]];
      setStops(newStops);
    }
  };

  const calculateRoute = async () => {
    const validStops = stops.filter(stop => stop.location);
    if (validStops.length < 2) return;

    setIsCalculating(true);
    
    try {
      let optimizedStops = validStops;
      
      // If more than 2 stops, optimize the order (except start and end)
      if (validStops.length > 2 && routeOptions.optimize !== 'none') {
        optimizedStops = await optimizeStopOrder(validStops);
      }
      
      // Calculate the actual route
      const routeData = await calculateOptimizedRoute(optimizedStops);
      
      setCalculatedRoute({
        id: Date.now().toString(),
        stops: routeData.stops,
        totalDistance: routeData.totalDistance,
        totalTime: routeData.totalTime,
        estimatedFuel: routeData.estimatedFuel,
        co2Emissions: routeData.co2Emissions,
        routeOptions,
        geometry: routeData.geometry
      });
    } catch (error) {
      // Fallback to simple route without optimization
      console.error('Route optimization failed:', error);
      const fallbackRoute = await calculateSimpleRoute(validStops);
      setCalculatedRoute(fallbackRoute);
    } finally {
      setIsCalculating(false);
    }
  };
  
  // Advanced TSP solver using the dedicated service
  const optimizeStopOrder = async (stops: RouteStop[]): Promise<RouteStop[]> => {
    if (stops.length <= 2) return stops;
    
    try {
      // Convert stops to TSP locations
      const tspLocations: TSPLocation[] = stops.map((stop, index) => ({
        id: stop.id,
        name: stop.location?.name || `Stop ${index + 1}`,
        lat: stop.location!.lat,
        lng: stop.location!.lng,
        timeWindow: stop.timeWindow ? {
          earliestArrival: parseTimeToMinutes(stop.timeWindow.earliest),
          latestDeparture: parseTimeToMinutes(stop.timeWindow.latest)
        } : undefined,
        serviceTime: stop.stopDuration,
        priority: stop.priority === 'critical' ? 10 : stop.priority === 'high' ? 7 : stop.priority === 'medium' ? 5 : 2,
        vehicleCapacityRequired: stop.deliverySize || 0
      }));
      
      // Set up constraints
      const constraints: TSPConstraints = {
        maxTime: routeOptions.maxDrivingTime,
        vehicleCapacity: routeOptions.vehicleCapacity,
        timeWindows: hasTimeWindows(stops),
        startLocation: routeOptions.isRoundTrip ? tspLocations[0] : undefined,
        endLocation: routeOptions.isRoundTrip ? tspLocations[0] : tspLocations[tspLocations.length - 1],
        avoidTolls: routeOptions.avoidTolls,
        avoidHighways: routeOptions.avoidHighways
      };
      
      // Optimization options based on route preferences
      const options: TSPOptimizationOptions = {
        algorithm: stops.length <= 8 ? 'hybrid' : 'simulated_annealing',
        maxIterations: stops.length <= 10 ? 1000 : 500,
        timeLimit: 30, // 30 seconds max
        populationSize: Math.min(50, stops.length * 10)
      };
      
      // Solve TSP using the advanced service
      const solution = await tspSolverService.solveTSP(tspLocations, constraints, options);
      
      // Convert back to RouteStop format
      const optimizedStops = solution.route.map(location => 
        stops.find(stop => stop.id === location.id)!
      );
      
      return optimizedStops;
    } catch (error) {
      console.warn('Advanced TSP optimization failed, using fallback:', error);
      return await optimizeStopOrderFallback(stops);
    }
  };
  
  // Helper function to parse time strings to minutes
  const parseTimeToMinutes = (timeStr: string): number => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
  };
  
  // Advanced TSP Optimization Algorithms
  
  /**
   * 2-opt optimization algorithm for small-medium routes
   */
  const optimizeTSPWith2Opt = async (matrix: number[][], isRoundTrip: boolean): Promise<number[]> => {
    const n = matrix.length;
    if (n <= 2) return Array.from({length: n}, (_, i) => i);
    
    // Generate multiple starting solutions and pick the best after 2-opt
    const startingSolutions = [
      nearestNeighborSolution(matrix, isRoundTrip),
      randomInsertionSolution(matrix, isRoundTrip),
      farthestInsertionSolution(matrix, isRoundTrip)
    ];
    
    let bestSolution = startingSolutions[0];
    let bestDistance = calculateTotalDistance(bestSolution, matrix, isRoundTrip);
    
    for (const solution of startingSolutions) {
      const optimized = twoOptImprovement(solution, matrix, isRoundTrip);
      const distance = calculateTotalDistance(optimized, matrix, isRoundTrip);
      
      if (distance < bestDistance) {
        bestSolution = optimized;
        bestDistance = distance;
      }
    }
    
    return bestSolution;
  };
  
  /**
   * Simulated annealing for large routes (8+ stops)
   */
  const optimizeTSPWithSimulatedAnnealing = async (matrix: number[][], isRoundTrip: boolean): Promise<number[]> => {
    const n = matrix.length;
    if (n <= 2) return Array.from({length: n}, (_, i) => i);
    
    // Start with nearest neighbor solution
    let currentSolution = nearestNeighborSolution(matrix, isRoundTrip);
    let currentDistance = calculateTotalDistance(currentSolution, matrix, isRoundTrip);
    
    let bestSolution = [...currentSolution];
    let bestDistance = currentDistance;
    
    // Simulated annealing parameters
    const initialTemp = 1000;
    const finalTemp = 1;
    const coolingRate = 0.995;
    const iterationsPerTemp = Math.max(100, n * 5);
    
    let temperature = initialTemp;
    
    while (temperature > finalTemp) {
      for (let iteration = 0; iteration < iterationsPerTemp; iteration++) {
        // Generate neighbor solution using 2-opt or swap
        const neighborSolution = Math.random() < 0.8 
          ? generate2OptNeighbor(currentSolution, isRoundTrip)
          : generateSwapNeighbor(currentSolution, isRoundTrip);
          
        const neighborDistance = calculateTotalDistance(neighborSolution, matrix, isRoundTrip);
        
        // Accept or reject the neighbor
        const deltaDistance = neighborDistance - currentDistance;
        
        if (deltaDistance < 0 || Math.random() < Math.exp(-deltaDistance / temperature)) {
          currentSolution = neighborSolution;
          currentDistance = neighborDistance;
          
          // Update best solution if improved
          if (neighborDistance < bestDistance) {
            bestSolution = [...neighborSolution];
            bestDistance = neighborDistance;
          }
        }
      }
      
      temperature *= coolingRate;
    }
    
    return bestSolution;
  };
  
  /**
   * Apply time window constraints to optimized route
   */
  const applyTimeWindowConstraints = async (
    route: number[], 
    stops: RouteStop[], 
    matrix: number[][]
  ): Promise<number[]> => {
    // For delivery routes with time windows, we need to ensure stops are visited within their time windows
    // This is a simplified implementation - real-world would use more sophisticated constraint programming
    
    const constrainedRoute = [...route];
    const timeWindows = stops.map(stop => ({
      earliest: 0, // Would come from stop data
      latest: 24 * 60, // Would come from stop data
      serviceTime: stop.stopDuration || 0
    }));
    
    // Sort intermediate stops by earliest time window (excluding start and end)
    const intermediateStops = constrainedRoute.slice(1, -1);
    const sortedByTime = intermediateStops.sort((a, b) => {
      return timeWindows[a].earliest - timeWindows[b].earliest;
    });
    
    return [constrainedRoute[0], ...sortedByTime, constrainedRoute[constrainedRoute.length - 1]];
  };
  
  /**
   * Check if stops have time window constraints
   */
  const hasTimeWindows = (stops: RouteStop[]): boolean => {
    return stops.some(stop => stop.stopDuration && stop.stopDuration > 0);
  };
  
  /**
   * Fallback to simpler optimization
   */
  const optimizeStopOrderFallback = async (stops: RouteStop[]): Promise<RouteStop[]> => {
    // Use the original nearest neighbor as fallback
    const coordinates: ORSCoordinate[] = stops.map(stop => ({
      lat: stop.location!.lat,
      lng: stop.location!.lng
    }));
    
    try {
      const matrixResult = await ORSDirectionsService.getMatrix(coordinates, 'driving-car');
      const optimizedOrder = nearestNeighborOptimization(matrixResult.distances, routeOptions.isRoundTrip);
      return optimizedOrder.map(index => stops[index]);
    } catch (error) {
      return stops; // Keep original order if everything fails
    }
  };
  
  // Helper algorithms
  
  const nearestNeighborSolution = (matrix: number[][], isRoundTrip: boolean): number[] => {
    const n = matrix.length;
    if (n <= 2) return Array.from({length: n}, (_, i) => i);
    
    const visited = new Set<number>();
    const route = [0]; // Start at first location
    visited.add(0);
    
    let current = 0;
    
    // Find nearest unvisited neighbor for intermediate stops
    while (visited.size < (isRoundTrip ? n : n - 1)) {
      let nearestIndex = -1;
      let nearestDistance = Infinity;
      
      const endIndex = isRoundTrip ? n : n - 1;
      for (let i = 1; i < endIndex; i++) {
        if (!visited.has(i) && matrix[current][i] < nearestDistance) {
          nearestDistance = matrix[current][i];
          nearestIndex = i;
        }
      }
      
      if (nearestIndex !== -1) {
        route.push(nearestIndex);
        visited.add(nearestIndex);
        current = nearestIndex;
      } else {
        break;
      }
    }
    
    // Add final destination if not round trip
    if (!isRoundTrip && route[route.length - 1] !== n - 1) {
      route.push(n - 1);
    }
    
    return route;
  };
  
  const randomInsertionSolution = (matrix: number[][], isRoundTrip: boolean): number[] => {
    const n = matrix.length;
    if (n <= 2) return Array.from({length: n}, (_, i) => i);
    
    const route = [0]; // Start with first location
    const unvisited = Array.from({length: n - 1}, (_, i) => i + 1);
    
    // If not round trip, remove last location from unvisited and handle separately
    if (!isRoundTrip) {
      unvisited.pop();
    }
    
    while (unvisited.length > 0) {
      const randomIndex = Math.floor(Math.random() * unvisited.length);
      const city = unvisited.splice(randomIndex, 1)[0];
      
      // Find best insertion position
      let bestCost = Infinity;
      let bestPosition = 1;
      
      for (let i = 1; i <= route.length; i++) {
        const insertionCost = calculateInsertionCost(route, city, i, matrix);
        if (insertionCost < bestCost) {
          bestCost = insertionCost;
          bestPosition = i;
        }
      }
      
      route.splice(bestPosition, 0, city);
    }
    
    // Add final destination if not round trip
    if (!isRoundTrip) {
      route.push(n - 1);
    }
    
    return route;
  };
  
  const farthestInsertionSolution = (matrix: number[][], isRoundTrip: boolean): number[] => {
    const n = matrix.length;
    if (n <= 2) return Array.from({length: n}, (_, i) => i);
    
    const route = [0]; // Start with first location
    const unvisited = Array.from({length: n - 1}, (_, i) => i + 1);
    
    if (!isRoundTrip) {
      unvisited.pop();
    }
    
    while (unvisited.length > 0) {
      // Find the city farthest from the current route
      let farthestCity = -1;
      let maxMinDistance = -1;
      
      for (const city of unvisited) {
        let minDistanceToRoute = Infinity;
        for (const routeCity of route) {
          minDistanceToRoute = Math.min(minDistanceToRoute, matrix[routeCity][city]);
        }
        if (minDistanceToRoute > maxMinDistance) {
          maxMinDistance = minDistanceToRoute;
          farthestCity = city;
        }
      }
      
      // Remove the farthest city from unvisited
      const index = unvisited.indexOf(farthestCity);
      unvisited.splice(index, 1);
      
      // Find best insertion position
      let bestCost = Infinity;
      let bestPosition = 1;
      
      for (let i = 1; i <= route.length; i++) {
        const insertionCost = calculateInsertionCost(route, farthestCity, i, matrix);
        if (insertionCost < bestCost) {
          bestCost = insertionCost;
          bestPosition = i;
        }
      }
      
      route.splice(bestPosition, 0, farthestCity);
    }
    
    if (!isRoundTrip) {
      route.push(n - 1);
    }
    
    return route;
  };
  
  const twoOptImprovement = (route: number[], matrix: number[][], isRoundTrip: boolean): number[] => {
    const n = route.length;
    let improved = true;
    let bestRoute = [...route];
    
    while (improved) {
      improved = false;
      
      for (let i = 1; i < n - 2; i++) {
        for (let j = i + 1; j < n - 1; j++) {
          if (j - i === 1) continue; // Skip adjacent edges
          
          const newRoute = twoOptSwap(bestRoute, i, j);
          const newDistance = calculateTotalDistance(newRoute, matrix, isRoundTrip);
          const currentDistance = calculateTotalDistance(bestRoute, matrix, isRoundTrip);
          
          if (newDistance < currentDistance) {
            bestRoute = newRoute;
            improved = true;
          }
        }
      }
    }
    
    return bestRoute;
  };
  
  const twoOptSwap = (route: number[], i: number, j: number): number[] => {
    const newRoute = [...route];
    // Reverse the segment between i and j
    while (i < j) {
      [newRoute[i], newRoute[j]] = [newRoute[j], newRoute[i]];
      i++;
      j--;
    }
    return newRoute;
  };
  
  const generate2OptNeighbor = (route: number[], isRoundTrip: boolean): number[] => {
    const n = route.length;
    const maxIndex = isRoundTrip ? n - 1 : n - 2;
    
    const i = 1 + Math.floor(Math.random() * (maxIndex - 1));
    const j = i + 1 + Math.floor(Math.random() * (maxIndex - i));
    
    return twoOptSwap(route, i, j);
  };
  
  const generateSwapNeighbor = (route: number[], isRoundTrip: boolean): number[] => {
    const n = route.length;
    const maxIndex = isRoundTrip ? n - 1 : n - 2;
    
    const i = 1 + Math.floor(Math.random() * (maxIndex - 1));
    let j = 1 + Math.floor(Math.random() * (maxIndex - 1));
    while (j === i) {
      j = 1 + Math.floor(Math.random() * (maxIndex - 1));
    }
    
    const newRoute = [...route];
    [newRoute[i], newRoute[j]] = [newRoute[j], newRoute[i]];
    return newRoute;
  };
  
  const calculateTotalDistance = (route: number[], matrix: number[][], isRoundTrip: boolean): number => {
    let totalDistance = 0;
    
    for (let i = 0; i < route.length - 1; i++) {
      totalDistance += matrix[route[i]][route[i + 1]];
    }
    
    // Add return to start if round trip
    if (isRoundTrip && route.length > 2) {
      totalDistance += matrix[route[route.length - 1]][route[0]];
    }
    
    return totalDistance;
  };
  
  const calculateInsertionCost = (route: number[], city: number, position: number, matrix: number[][]): number => {
    if (position === 0) {
      return matrix[city][route[0]];
    } else if (position === route.length) {
      return matrix[route[route.length - 1]][city];
    } else {
      const before = route[position - 1];
      const after = route[position];
      return matrix[before][city] + matrix[city][after] - matrix[before][after];
    }
  };
  
  // Original nearest neighbor for backward compatibility
  const nearestNeighborOptimization = (matrix: number[][], isRoundTrip: boolean): number[] => {
    return nearestNeighborSolution(matrix, isRoundTrip);
  };
  
  // Calculate route details for optimized stops
  const calculateOptimizedRoute = async (stops: RouteStop[]) => {
    const legs: Array<{ distance: string; duration: string; geometry?: string }> = [];
    let totalDistanceMeters = 0;
    let totalDurationSeconds = 0;
    
    // Calculate route for each leg
    for (let i = 0; i < stops.length - 1; i++) {
      try {
        const from = { lat: stops[i].location!.lat, lng: stops[i].location!.lng };
        const to = { lat: stops[i + 1].location!.lat, lng: stops[i + 1].location!.lng };
        
        const legRoute = await directionsService.getRouteWithORS(from, to, 'driving', {
          avoidTolls: routeOptions.avoidTolls,
          avoidHighways: routeOptions.avoidHighways
        });
        
        legs.push(legRoute);
        
        // Parse distance and duration (assuming format like "2.5 km" and "8 min")
        const distanceKm = parseFloat(legRoute.distance.replace(/[^0-9.]/g, ''));
        const durationMin = parseFloat(legRoute.duration.replace(/[^0-9.]/g, ''));
        
        totalDistanceMeters += distanceKm * 1000;
        totalDurationSeconds += durationMin * 60;
      } catch (error) {
        // Use approximation if API fails
        const distance = calculateHaversineDistance(
          stops[i].location!.lat, stops[i].location!.lng,
          stops[i + 1].location!.lat, stops[i + 1].location!.lng
        );
        totalDistanceMeters += distance;
        totalDurationSeconds += (distance / 1000) * 120; // Assume 30 km/h average
      }
    }
    
    // Add stop durations
    const totalStopTime = stops.reduce((sum, stop) => sum + (stop.stopDuration || 0), 0) * 60;
    totalDurationSeconds += totalStopTime;
    
    return {
      stops: stops.map((stop, index) => ({
        order: index + 1,
        location: stop.location,
        arrivalTime: calculateArrivalTime(index, totalDurationSeconds, stops.length),
        stopDuration: stop.stopDuration,
        distanceToNext: index < stops.length - 1 ? formatDistance(legs[index]?.distance || '0 km') : null
      })),
      totalDistance: formatDistance(`${(totalDistanceMeters / 1000).toFixed(1)} km`),
      totalTime: formatDuration(totalDurationSeconds),
      estimatedFuel: calculateFuelCost(totalDistanceMeters),
      co2Emissions: calculateCO2Emissions(totalDistanceMeters),
      geometry: legs.map(leg => leg.geometry).filter(Boolean)
    };
  };
  
  // Simple route calculation fallback
  const calculateSimpleRoute = async (stops: RouteStop[]) => {
    let totalDistance = 0;
    
    for (let i = 0; i < stops.length - 1; i++) {
      const distance = calculateHaversineDistance(
        stops[i].location!.lat, stops[i].location!.lng,
        stops[i + 1].location!.lat, stops[i + 1].location!.lng
      );
      totalDistance += distance;
    }
    
    const totalTime = totalDistance / 1000 * 2 + stops.reduce((sum, stop) => sum + (stop.stopDuration || 0), 0); // Assume 30 km/h
    
    return {
      id: Date.now().toString(),
      stops: stops.map((stop, index) => ({
        order: index + 1,
        location: stop.location,
        arrivalTime: `${9 + Math.floor(index * 0.5)}:${(index * 15) % 60}0 AM`,
        stopDuration: stop.stopDuration,
        distanceToNext: index < stops.length - 1 ? `${(totalDistance / stops.length / 1000).toFixed(1)} km` : null
      })),
      totalDistance: `${(totalDistance / 1000).toFixed(1)} km`,
      totalTime: `${Math.round(totalTime)} min`,
      estimatedFuel: calculateFuelCost(totalDistance),
      co2Emissions: calculateCO2Emissions(totalDistance),
      routeOptions
    };
  };
  
  // Helper functions
  const calculateHaversineDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
    const R = 6371000; // Earth's radius in meters
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };
  
  const formatDistance = (distance: string): string => {
    return distance.replace('km', ' km').replace('mi', ' mi');
  };
  
  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };
  
  const calculateArrivalTime = (index: number, totalSeconds: number, totalStops: number): string => {
    const avgTimePerStop = totalSeconds / totalStops;
    const arrivalSeconds = index * avgTimePerStop;
    const baseTime = new Date();
    baseTime.setHours(9, 0, 0, 0); // Start at 9 AM
    baseTime.setSeconds(baseTime.getSeconds() + arrivalSeconds);
    return baseTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };
  
  const calculateFuelCost = (distanceMeters: number): string => {
    const distanceKm = distanceMeters / 1000;
    const fuelEfficiency = 8; // km per liter
    const fuelPrice = 1.5; // $ per liter
    const cost = (distanceKm / fuelEfficiency) * fuelPrice;
    return `$${cost.toFixed(2)}`;
  };
  
  const calculateCO2Emissions = (distanceMeters: number): string => {
    const distanceKm = distanceMeters / 1000;
    const co2PerKm = 0.2; // kg CO2 per km
    return `${(distanceKm * co2PerKm).toFixed(1)}kg`;
  };

  const startNavigation = () => {
    if (calculatedRoute) {
      onRouteCalculated(calculatedRoute);
    }
  };

  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  
  const saveRoute = async () => {
    if (!calculatedRoute) return;
    
    setIsSaving(true);
    try {
      const savedRoutes = JSON.parse(localStorage.getItem('savedRoutes') || '[]');
      savedRoutes.push({
        ...calculatedRoute,
        name: `Multi-Stop Route - ${new Date().toLocaleDateString()}`,
        createdAt: new Date().toISOString()
      });
      localStorage.setItem('savedRoutes', JSON.stringify(savedRoutes));
      
      setSaveMessage('Route saved successfully!');
      setTimeout(() => setSaveMessage(''), 3000);
    } catch (error) {
      setSaveMessage('Failed to save route');
      setTimeout(() => setSaveMessage(''), 3000);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="h-full bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 bg-white px-4 py-4 border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={onBack}>
              <X className="w-5 h-5" />
            </Button>
            <div>
              <h2 className="font-semibold">Multi-Stop Route</h2>
              <p className="text-sm text-gray-500">Plan up to 10 stops</p>
            </div>
          </div>
          <Badge variant="outline">{stops.length}/10 stops</Badge>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="p-4 space-y-6">
          {/* Route Stops */}
          <Card className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Route Stops</h3>
              <Button
                size="sm"
                onClick={addStop}
                disabled={stops.length >= 10}
                className="text-xs"
              >
                <Plus className="w-3 h-3 mr-1" />
                Add Stop
              </Button>
            </div>
            
            <div className="space-y-3">
              {stops.map((stop, index) => (
                <div key={stop.id} className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg">
                  <div className="flex flex-col items-center">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-medium ${
                      index === 0 ? 'bg-green-500' : 
                      index === stops.length - 1 ? 'bg-red-500' : 
                      'bg-blue-500'
                    }`}>
                      {index === 0 ? 'A' : index === stops.length - 1 ? 'B' : index + 1}
                    </div>
                    {index < stops.length - 1 && (
                      <div className="w-0.5 h-4 bg-gray-300 mt-1" />
                    )}
                  </div>
                  
                  <div className="flex-1">
                    <div className="relative">
                      <Input
                        placeholder={`Stop ${index + 1} destination`}
                        value={searchQueries[stop.id] || stop.location?.name || ''}
                        onChange={(e) => {
                          const value = e.target.value;
                          setSearchQueries(prev => ({ ...prev, [stop.id]: value }));
                          if (!value) {
                            updateStopLocation(stop.id, null as any);
                          }
                        }}
                      />
                      
                      {/* Search Results Dropdown */}
                      {searchQueries[stop.id] && searchResults.length > 0 && (
                        <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-md shadow-lg z-10 max-h-48 overflow-y-auto">
                          {searchResults.map(location => (
                            <div
                              key={location.id}
                              className="p-2 hover:bg-gray-50 cursor-pointer text-sm"
                              onClick={() => {
                                updateStopLocation(stop.id, location);
                                setSearchQueries(prev => ({ ...prev, [stop.id]: location.name }));
                                setSearchResults([]);
                              }}
                            >
                              <div className="font-medium">{location.name}</div>
                              <div className="text-gray-500 text-xs">{location.address}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    
                    {stop.location && index > 0 && index < stops.length - 1 && (
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-xs text-gray-500">Stop for:</span>
                        <Input
                          type="number"
                          value={stop.stopDuration}
                          onChange={(e) => updateStopDuration(stop.id, parseInt(e.target.value) || 0)}
                          className="w-16 h-6 text-xs"
                          min="0"
                          max="480"
                        />
                        <span className="text-xs text-gray-500">min</span>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex flex-col gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="w-6 h-6"
                      onClick={() => moveStop(stop.id, 'up')}
                      disabled={index === 0}
                    >
                      <ArrowUp className="w-3 h-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="w-6 h-6"
                      onClick={() => moveStop(stop.id, 'down')}
                      disabled={index === stops.length - 1}
                    >
                      <ArrowDown className="w-3 h-3" />
                    </Button>
                    {stops.length > 2 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="w-6 h-6 text-red-500"
                        onClick={() => removeStop(stop.id)}
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Route Options */}
          <Card className="p-4">
            <h3 className="font-semibold mb-4">Route Options</h3>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Optimize for</label>
                <Select value={routeOptions.optimize} onValueChange={(value: string) => 
                  setRouteOptions(prev => ({ ...prev, optimize: value }))
                }>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="time">Fastest Time</SelectItem>
                    <SelectItem value="distance">Shortest Distance</SelectItem>
                    <SelectItem value="fuel">Fuel Efficiency</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm">Avoid tolls</span>
                <Switch 
                  checked={routeOptions.avoidTolls}
                  onCheckedChange={(checked: boolean) => setRouteOptions(prev => ({ ...prev, avoidTolls: checked }))}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm">Avoid highways</span>
                <Switch 
                  checked={routeOptions.avoidHighways}
                  onCheckedChange={(checked: boolean) => setRouteOptions(prev => ({ ...prev, avoidHighways: checked }))}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm">Round trip</span>
                <Switch 
                  checked={routeOptions.isRoundTrip}
                  onCheckedChange={(checked: boolean) => setRouteOptions(prev => ({ ...prev, isRoundTrip: checked }))}
                />
              </div>
              
              <div>
                <label className="text-sm font-medium mb-2 block">Departure time (optional)</label>
                <Input
                  type="datetime-local"
                  value={routeOptions.departureTime}
                  onChange={(e) => setRouteOptions(prev => ({ ...prev, departureTime: e.target.value }))}
                />
              </div>
            </div>
          </Card>

          {/* Calculate Button */}
          <Button 
            onClick={calculateRoute}
            disabled={isCalculating || stops.filter(s => s.location).length < 2}
            className="w-full"
            size="lg"
          >
            {isCalculating ? (
              <>Calculating...</>
            ) : (
              <>
                <Route className="w-4 h-4 mr-2" />
                Calculate Route
              </>
            )}
          </Button>

          {/* Route Results */}
          {calculatedRoute && (
            <Card className="p-4">
              <h3 className="font-semibold mb-4">Route Summary</h3>
              
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div className="text-center">
                  <div className="text-lg font-bold text-blue-600">{calculatedRoute.totalDistance}</div>
                  <div className="text-xs text-gray-500">Distance</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-green-600">{calculatedRoute.totalTime}</div>
                  <div className="text-xs text-gray-500">Time</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-purple-600">{calculatedRoute.estimatedFuel}</div>
                  <div className="text-xs text-gray-500">Est. Fuel</div>
                </div>
              </div>
              
              <div className="flex items-center justify-center mb-4 text-sm text-gray-600">
                <Leaf className="w-4 h-4 mr-1 text-green-500" />
                CO2 emissions: {calculatedRoute.co2Emissions}
              </div>

              <div className="flex gap-2">
                <Button onClick={startNavigation} className="flex-1">
                  <Navigation className="w-4 h-4 mr-2" />
                  Start Navigation
                </Button>
                <Button 
                  variant="outline" 
                  onClick={saveRoute}
                  disabled={isSaving}
                >
                  <Save className="w-4 h-4" />
                  {isSaving && <span className="ml-1 text-xs">Saving...</span>}
                </Button>
                <Button variant="outline">
                  <Share2 className="w-4 h-4" />
                </Button>
              </div>
              
              {/* Save Message */}
              {saveMessage && (
                <div className={`text-center text-sm mt-2 ${
                  saveMessage.includes('successfully') ? 'text-green-600' : 'text-red-600'
                }`}>
                  {saveMessage}
                </div>
              )}
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
