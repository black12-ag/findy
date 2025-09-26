/**
 * 🧮 Advanced TSP (Traveling Salesman Problem) Solver Service
 * 
 * Implements multiple algorithms for optimizing multi-stop routes:
 * - Nearest Neighbor Algorithm (fast, good approximation)
 * - Genetic Algorithm (better optimization for large sets)
 * - Simulated Annealing (good balance of speed and quality)
 * - 2-Opt Improvement (local optimization)
 */

import { logger } from '../utils/logger';

export interface TSPLocation {
  id: string;
  name: string;
  lat: number;
  lng: number;
  timeWindow?: {
    earliestArrival: number; // Unix timestamp
    latestDeparture: number; // Unix timestamp
  };
  serviceTime?: number; // Time to spend at location (minutes)
  priority?: number; // Higher numbers = higher priority (1-10)
  vehicleCapacityRequired?: number; // For delivery optimization
}

export interface TSPConstraints {
  maxDistance?: number; // Maximum total route distance (meters)
  maxTime?: number; // Maximum total route time (minutes)
  vehicleCapacity?: number; // Total vehicle capacity
  timeWindows?: boolean; // Whether to respect time windows
  startLocation?: TSPLocation; // Fixed start point
  endLocation?: TSPLocation; // Fixed end point (can be same as start)
  avoidTolls?: boolean;
  avoidHighways?: boolean;
}

export interface TSPSolution {
  route: TSPLocation[];
  totalDistance: number; // meters
  totalTime: number; // minutes
  totalCost: number; // estimated cost
  violations: string[]; // Constraint violations
  algorithm: string;
  optimizationScore: number; // 0-100, higher is better
}

export interface TSPOptimizationOptions {
  algorithm?: 'nearest_neighbor' | 'genetic' | 'simulated_annealing' | 'hybrid';
  maxIterations?: number;
  timeLimit?: number; // seconds
  populationSize?: number; // for genetic algorithm
  temperature?: number; // for simulated annealing
  improvementThreshold?: number; // Stop if no improvement after N iterations
}

class TSPSolverService {
  private distanceCache: Map<string, number> = new Map();
  private timeCache: Map<string, number> = new Map();

  /**
   * Solve TSP with multiple algorithms and return the best solution
   */
  async solveTSP(
    locations: TSPLocation[],
    constraints: TSPConstraints = {},
    options: TSPOptimizationOptions = {}
  ): Promise<TSPSolution> {
    if (locations.length < 2) {
      throw new Error('TSP requires at least 2 locations');
    }

    if (locations.length > 50) {
      logger.warn('TSP solving with large number of locations', { count: locations.length });
    }

    const startTime = Date.now();
    
    try {
      // Pre-compute distance matrix for all algorithms
      await this.precomputeDistances(locations);

      let bestSolution: TSPSolution;
      const algorithm = options.algorithm || 'hybrid';

      switch (algorithm) {
        case 'nearest_neighbor':
          bestSolution = await this.nearestNeighborTSP(locations, constraints, options);
          break;
        case 'genetic':
          bestSolution = await this.geneticAlgorithmTSP(locations, constraints, options);
          break;
        case 'simulated_annealing':
          bestSolution = await this.simulatedAnnealingTSP(locations, constraints, options);
          break;
        case 'hybrid':
        default:
          bestSolution = await this.hybridTSP(locations, constraints, options);
          break;
      }

      // Apply 2-opt local optimization to improve the solution
      bestSolution = await this.twoOptImprovement(bestSolution, constraints);

      // Validate constraints and log violations
      bestSolution = this.validateConstraints(bestSolution, constraints);

      const solvingTime = Date.now() - startTime;
      logger.info('TSP solved', {
        locations: locations.length,
        algorithm: bestSolution.algorithm,
        solvingTime,
        totalDistance: bestSolution.totalDistance,
        totalTime: bestSolution.totalTime,
        violations: bestSolution.violations.length
      });

      return bestSolution;

    } catch (error) {
      logger.error('TSP solving failed', { error, locations: locations.length });
      
      // Fallback to simple nearest neighbor
      return this.nearestNeighborTSP(locations, constraints, options);
    }
  }

  /**
   * Hybrid approach: try multiple algorithms and return the best
   */
  private async hybridTSP(
    locations: TSPLocation[],
    constraints: TSPConstraints,
    options: TSPOptimizationOptions
  ): Promise<TSPSolution> {
    const solutions: TSPSolution[] = [];
    
    // For small problems, try all algorithms
    if (locations.length <= 10) {
      solutions.push(await this.nearestNeighborTSP(locations, constraints, options));
      solutions.push(await this.simulatedAnnealingTSP(locations, constraints, options));
      
      if (locations.length <= 8) {
        solutions.push(await this.geneticAlgorithmTSP(locations, constraints, options));
      }
    } else {
      // For larger problems, use faster algorithms
      solutions.push(await this.nearestNeighborTSP(locations, constraints, options));
      solutions.push(await this.simulatedAnnealingTSP(locations, constraints, { 
        ...options, 
        maxIterations: Math.min(1000, options.maxIterations || 500)
      }));
    }

    // Return the solution with the best optimization score
    const bestSolution = solutions.reduce((best, current) => 
      current.optimizationScore > best.optimizationScore ? current : best
    );

    bestSolution.algorithm = 'hybrid';
    return bestSolution;
  }

  /**
   * Nearest Neighbor Algorithm - Fast approximation
   */
  private async nearestNeighborTSP(
    locations: TSPLocation[],
    constraints: TSPConstraints,
    options: TSPOptimizationOptions
  ): Promise<TSPSolution> {
    const unvisited = [...locations];
    const route: TSPLocation[] = [];
    
    // Start from the specified start location or the first one
    let current = constraints.startLocation || unvisited[0];
    route.push(current);
    unvisited.splice(unvisited.indexOf(current), 1);

    let totalDistance = 0;
    let totalTime = 0;

    while (unvisited.length > 0) {
      let nearestLocation: TSPLocation | null = null;
      let nearestDistance = Infinity;

      // Find nearest unvisited location considering constraints
      for (const location of unvisited) {
        const distance = await this.getDistance(current, location);
        const score = this.calculateLocationScore(location, distance, constraints);
        
        if (score < nearestDistance) {
          nearestDistance = score;
          nearestLocation = location;
        }
      }

      if (nearestLocation) {
        const distance = await this.getDistance(current, nearestLocation);
        const time = await this.getTravelTime(current, nearestLocation);
        
        route.push(nearestLocation);
        unvisited.splice(unvisited.indexOf(nearestLocation), 1);
        totalDistance += distance;
        totalTime += time + (nearestLocation.serviceTime || 0);
        current = nearestLocation;
      }
    }

    // Return to end location if specified and different from last location
    if (constraints.endLocation && constraints.endLocation !== route[route.length - 1]) {
      const distance = await this.getDistance(current, constraints.endLocation);
      const time = await this.getTravelTime(current, constraints.endLocation);
      route.push(constraints.endLocation);
      totalDistance += distance;
      totalTime += time;
    }

    return {
      route,
      totalDistance,
      totalTime,
      totalCost: this.calculateCost(totalDistance, totalTime, constraints),
      violations: [],
      algorithm: 'nearest_neighbor',
      optimizationScore: this.calculateOptimizationScore(totalDistance, totalTime, locations.length)
    };
  }

  /**
   * Genetic Algorithm - Better for larger problems
   */
  private async geneticAlgorithmTSP(
    locations: TSPLocation[],
    constraints: TSPConstraints,
    options: TSPOptimizationOptions
  ): Promise<TSPSolution> {
    const populationSize = options.populationSize || Math.min(100, locations.length * 10);
    const maxGenerations = options.maxIterations || 500;
    const mutationRate = 0.02;
    const eliteSize = Math.floor(populationSize * 0.2);

    // Initialize population with random routes
    let population = await this.initializeGeneticPopulation(locations, populationSize, constraints);
    let bestSolution: TSPSolution = population[0];

    for (let generation = 0; generation < maxGenerations; generation++) {
      // Evaluate fitness for all individuals
      const evaluatedPopulation = await Promise.all(
        population.map(async (individual) => ({
          route: individual,
          fitness: await this.calculateRouteFitness(individual, constraints)
        }))
      );

      // Sort by fitness (lower is better)
      evaluatedPopulation.sort((a, b) => a.fitness - b.fitness);
      
      // Update best solution
      if (evaluatedPopulation[0].fitness < bestSolution.totalDistance + bestSolution.totalTime) {
        bestSolution = await this.routeToSolution(evaluatedPopulation[0].route, constraints, 'genetic');
      }

      // Create new generation
      const newPopulation: TSPLocation[][] = [];
      
      // Keep elite individuals
      for (let i = 0; i < eliteSize; i++) {
        newPopulation.push([...evaluatedPopulation[i].route]);
      }

      // Generate offspring through crossover and mutation
      while (newPopulation.length < populationSize) {
        const parent1 = this.tournamentSelection(evaluatedPopulation);
        const parent2 = this.tournamentSelection(evaluatedPopulation);
        
        let child = this.orderCrossover(parent1.route, parent2.route);
        
        if (Math.random() < mutationRate) {
          child = this.mutateTSPRoute(child);
        }
        
        newPopulation.push(child);
      }

      population = newPopulation;

      // Early termination if no improvement
      if (generation > 100 && generation % 50 === 0) {
        // Check if we've made progress recently
        const recentImprovement = true; // Implement improvement tracking
        if (!recentImprovement) break;
      }
    }

    return bestSolution;
  }

  /**
   * Simulated Annealing Algorithm
   */
  private async simulatedAnnealingTSP(
    locations: TSPLocation[],
    constraints: TSPConstraints,
    options: TSPOptimizationOptions
  ): Promise<TSPSolution> {
    let currentRoute = [...locations];
    if (constraints.startLocation) {
      // Ensure start location is first
      const startIndex = currentRoute.indexOf(constraints.startLocation);
      if (startIndex > 0) {
        currentRoute = [currentRoute[startIndex], ...currentRoute.slice(0, startIndex), ...currentRoute.slice(startIndex + 1)];
      }
    }

    let currentSolution = await this.routeToSolution(currentRoute, constraints, 'simulated_annealing');
    let bestSolution = { ...currentSolution };

    const initialTemperature = options.temperature || 10000;
    const coolingRate = 0.995;
    const minTemperature = 1;
    const maxIterations = options.maxIterations || 10000;

    let temperature = initialTemperature;
    let iteration = 0;

    while (temperature > minTemperature && iteration < maxIterations) {
      // Create neighbor by swapping two random locations
      const neighborRoute = [...currentRoute];
      const i = Math.floor(Math.random() * neighborRoute.length);
      const j = Math.floor(Math.random() * neighborRoute.length);
      [neighborRoute[i], neighborRoute[j]] = [neighborRoute[j], neighborRoute[i]];

      const neighborSolution = await this.routeToSolution(neighborRoute, constraints, 'simulated_annealing');
      
      // Calculate energy difference (cost difference)
      const energyDiff = (neighborSolution.totalDistance + neighborSolution.totalTime) - 
                        (currentSolution.totalDistance + currentSolution.totalTime);

      // Accept or reject the neighbor
      if (energyDiff < 0 || Math.random() < Math.exp(-energyDiff / temperature)) {
        currentRoute = neighborRoute;
        currentSolution = neighborSolution;

        // Update best solution if better
        if (currentSolution.optimizationScore > bestSolution.optimizationScore) {
          bestSolution = { ...currentSolution };
        }
      }

      temperature *= coolingRate;
      iteration++;
    }

    return bestSolution;
  }

  /**
   * 2-Opt Local Optimization
   */
  private async twoOptImprovement(
    solution: TSPSolution,
    constraints: TSPConstraints
  ): Promise<TSPSolution> {
    let route = [...solution.route];
    let improved = true;
    let iterations = 0;
    const maxIterations = 1000;

    while (improved && iterations < maxIterations) {
      improved = false;
      iterations++;

      for (let i = 1; i < route.length - 2; i++) {
        for (let j = i + 1; j < route.length - 1; j++) {
          // Skip if we would violate start/end constraints
          if ((i === 0 && constraints.startLocation) || 
              (j === route.length - 1 && constraints.endLocation)) {
            continue;
          }

          // Calculate current distance
          const currentDist = await this.getDistance(route[i], route[i + 1]) + 
                             await this.getDistance(route[j], route[j + 1]);
          
          // Calculate new distance after 2-opt swap
          const newDist = await this.getDistance(route[i], route[j]) + 
                         await this.getDistance(route[i + 1], route[j + 1]);

          if (newDist < currentDist) {
            // Perform 2-opt swap
            const newRoute = [
              ...route.slice(0, i + 1),
              ...route.slice(i + 1, j + 1).reverse(),
              ...route.slice(j + 1)
            ];
            route = newRoute;
            improved = true;
          }
        }
      }
    }

    // Recalculate solution metrics
    return this.routeToSolution(route, constraints, `${solution.algorithm}_2opt`);
  }

  /**
   * Pre-compute distance matrix for efficiency
   */
  private async precomputeDistances(locations: TSPLocation[]): Promise<void> {
    const computePromises: Promise<void>[] = [];

    for (let i = 0; i < locations.length; i++) {
      for (let j = i + 1; j < locations.length; j++) {
        const loc1 = locations[i];
        const loc2 = locations[j];
        
        computePromises.push(
          this.getDistance(loc1, loc2).then(() => {
            // Distance is cached in getDistance
          })
        );
      }
    }

    await Promise.all(computePromises);
  }

  /**
   * Calculate distance between two locations (cached)
   */
  private async getDistance(loc1: TSPLocation, loc2: TSPLocation): Promise<number> {
    const key = `${loc1.id}-${loc2.id}`;
    const reverseKey = `${loc2.id}-${loc1.id}`;
    
    if (this.distanceCache.has(key)) {
      return this.distanceCache.get(key)!;
    }
    if (this.distanceCache.has(reverseKey)) {
      return this.distanceCache.get(reverseKey)!;
    }

    // Haversine distance as fallback (should integrate with routing service)
    const R = 6371000; // Earth's radius in meters
    const φ1 = loc1.lat * Math.PI / 180;
    const φ2 = loc2.lat * Math.PI / 180;
    const Δφ = (loc2.lat - loc1.lat) * Math.PI / 180;
    const Δλ = (loc2.lng - loc1.lng) * Math.PI / 180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distance = R * c;

    this.distanceCache.set(key, distance);
    return distance;
  }

  /**
   * Calculate travel time between locations (cached)
   */
  private async getTravelTime(loc1: TSPLocation, loc2: TSPLocation): Promise<number> {
    const key = `${loc1.id}-${loc2.id}-time`;
    const reverseKey = `${loc2.id}-${loc1.id}-time`;
    
    if (this.timeCache.has(key)) {
      return this.timeCache.get(key)!;
    }
    if (this.timeCache.has(reverseKey)) {
      return this.timeCache.get(reverseKey)!;
    }

    // Estimate time based on distance (should integrate with routing service)
    const distance = await this.getDistance(loc1, loc2);
    const avgSpeed = 50; // km/h average speed
    const time = (distance / 1000) / avgSpeed * 60; // minutes

    this.timeCache.set(key, time);
    return time;
  }

  /**
   * Calculate location score for nearest neighbor algorithm
   */
  private calculateLocationScore(
    location: TSPLocation,
    distance: number,
    constraints: TSPConstraints
  ): number {
    let score = distance;

    // Apply priority weighting
    if (location.priority) {
      score = score / Math.pow(location.priority, 0.5);
    }

    // Consider time windows if enabled
    if (constraints.timeWindows && location.timeWindow) {
      const now = Date.now();
      if (now < location.timeWindow.earliestArrival) {
        score += 10000; // Penalty for arriving too early
      }
      if (now > location.timeWindow.latestDeparture) {
        score += 50000; // High penalty for missing time window
      }
    }

    return score;
  }

  /**
   * Calculate route fitness for genetic algorithm
   */
  private async calculateRouteFitness(
    route: TSPLocation[],
    constraints: TSPConstraints
  ): Promise<number> {
    let totalDistance = 0;
    let totalTime = 0;
    let penalties = 0;

    for (let i = 0; i < route.length - 1; i++) {
      totalDistance += await this.getDistance(route[i], route[i + 1]);
      totalTime += await this.getTravelTime(route[i], route[i + 1]);
      totalTime += route[i + 1].serviceTime || 0;
    }

    // Add constraint violation penalties
    if (constraints.maxDistance && totalDistance > constraints.maxDistance) {
      penalties += (totalDistance - constraints.maxDistance) * 10;
    }
    if (constraints.maxTime && totalTime > constraints.maxTime) {
      penalties += (totalTime - constraints.maxTime) * 100;
    }

    return totalDistance + totalTime + penalties;
  }

  /**
   * Convert route to solution object
   */
  private async routeToSolution(
    route: TSPLocation[],
    constraints: TSPConstraints,
    algorithm: string
  ): Promise<TSPSolution> {
    let totalDistance = 0;
    let totalTime = 0;

    for (let i = 0; i < route.length - 1; i++) {
      totalDistance += await this.getDistance(route[i], route[i + 1]);
      totalTime += await this.getTravelTime(route[i], route[i + 1]);
      totalTime += route[i + 1].serviceTime || 0;
    }

    return {
      route,
      totalDistance,
      totalTime,
      totalCost: this.calculateCost(totalDistance, totalTime, constraints),
      violations: [],
      algorithm,
      optimizationScore: this.calculateOptimizationScore(totalDistance, totalTime, route.length)
    };
  }

  /**
   * Calculate estimated cost of route
   */
  private calculateCost(
    distance: number,
    time: number,
    constraints: TSPConstraints
  ): number {
    const fuelCostPerKm = 0.15; // $0.15 per km
    const timeCostPerHour = 25; // $25 per hour
    
    const fuelCost = (distance / 1000) * fuelCostPerKm;
    const timeCost = (time / 60) * timeCostPerHour;
    
    return fuelCost + timeCost;
  }

  /**
   * Calculate optimization score (0-100)
   */
  private calculateOptimizationScore(
    distance: number,
    time: number,
    locationCount: number
  ): number {
    // This is a simplified scoring system
    // In practice, you'd want to compare against known benchmarks
    const baseScore = 100;
    const distancePenalty = Math.min(50, distance / (locationCount * 10000));
    const timePenalty = Math.min(30, time / (locationCount * 60));
    
    return Math.max(0, baseScore - distancePenalty - timePenalty);
  }

  /**
   * Validate constraints and return violations
   */
  private validateConstraints(
    solution: TSPSolution,
    constraints: TSPConstraints
  ): TSPSolution {
    const violations: string[] = [];

    if (constraints.maxDistance && solution.totalDistance > constraints.maxDistance) {
      violations.push(`Exceeds maximum distance by ${Math.round(solution.totalDistance - constraints.maxDistance)}m`);
    }

    if (constraints.maxTime && solution.totalTime > constraints.maxTime) {
      violations.push(`Exceeds maximum time by ${Math.round(solution.totalTime - constraints.maxTime)} minutes`);
    }

    if (constraints.vehicleCapacity) {
      const totalCapacityRequired = solution.route.reduce(
        (sum, loc) => sum + (loc.vehicleCapacityRequired || 0), 0
      );
      if (totalCapacityRequired > constraints.vehicleCapacity) {
        violations.push(`Exceeds vehicle capacity by ${totalCapacityRequired - constraints.vehicleCapacity}`);
      }
    }

    return {
      ...solution,
      violations
    };
  }

  /**
   * Helper methods for genetic algorithm
   */
  private async initializeGeneticPopulation(
    locations: TSPLocation[],
    populationSize: number,
    constraints: TSPConstraints
  ): Promise<TSPLocation[][]> {
    const population: TSPLocation[][] = [];
    
    for (let i = 0; i < populationSize; i++) {
      let individual = [...locations];
      
      // Respect start location constraint
      if (constraints.startLocation) {
        const startIndex = individual.indexOf(constraints.startLocation);
        if (startIndex > 0) {
          individual = [individual[startIndex], ...individual.slice(0, startIndex), ...individual.slice(startIndex + 1)];
        }
      }
      
      // Shuffle remaining locations
      for (let j = constraints.startLocation ? 1 : 0; j < individual.length; j++) {
        const randomIndex = Math.floor(Math.random() * (individual.length - j)) + j;
        [individual[j], individual[randomIndex]] = [individual[randomIndex], individual[j]];
      }
      
      population.push(individual);
    }
    
    return population;
  }

  private tournamentSelection(population: { route: TSPLocation[]; fitness: number }[]): { route: TSPLocation[]; fitness: number } {
    const tournamentSize = 3;
    let best = population[Math.floor(Math.random() * population.length)];
    
    for (let i = 1; i < tournamentSize; i++) {
      const competitor = population[Math.floor(Math.random() * population.length)];
      if (competitor.fitness < best.fitness) {
        best = competitor;
      }
    }
    
    return best;
  }

  private orderCrossover(parent1: TSPLocation[], parent2: TSPLocation[]): TSPLocation[] {
    const start = Math.floor(Math.random() * parent1.length);
    const end = Math.floor(Math.random() * (parent1.length - start)) + start;
    
    const child: TSPLocation[] = new Array(parent1.length);
    
    // Copy segment from parent1
    for (let i = start; i <= end; i++) {
      child[i] = parent1[i];
    }
    
    // Fill remaining positions from parent2
    let childIndex = 0;
    for (let i = 0; i < parent2.length; i++) {
      if (childIndex === start) {
        childIndex = end + 1;
      }
      if (childIndex >= parent1.length) break;
      
      if (!child.includes(parent2[i])) {
        child[childIndex] = parent2[i];
        childIndex++;
      }
    }
    
    return child;
  }

  private mutateTSPRoute(route: TSPLocation[]): TSPLocation[] {
    const mutated = [...route];
    const i = Math.floor(Math.random() * mutated.length);
    const j = Math.floor(Math.random() * mutated.length);
    [mutated[i], mutated[j]] = [mutated[j], mutated[i]];
    return mutated;
  }

  /**
   * Clear distance and time caches to free memory
   */
  public clearCache(): void {
    this.distanceCache.clear();
    this.timeCache.clear();
  }

  /**
   * Get cache statistics
   */
  public getCacheStats(): { distances: number; times: number } {
    return {
      distances: this.distanceCache.size,
      times: this.timeCache.size
    };
  }
}

// Singleton instance
export const tspSolver = new TSPSolverService();
export const tspSolverService = tspSolver; // Backward compatibility
export default tspSolver;
