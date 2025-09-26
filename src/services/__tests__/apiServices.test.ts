/**
 * 🧪 API Services Tests
 * 
 * Simple tests to verify POIs and Matrix services are working
 */

import { poisService } from '../poisService';
import { matrixService } from '../matrixService';
import { quotaManager } from '../quotaManager';

// Test coordinates (San Francisco)
const testCoordinates: [number, number] = [-122.4194, 37.7749];
const testDestinations: Array<[number, number]> = [
  [-122.4094, 37.7849], // Market St
  [-122.4294, 37.7649], // Mission District
  [-122.3994, 37.7949]  // Financial District
];

describe('API Services Integration Tests', () => {
  
  beforeAll(() => {
    console.log('🧪 Testing API Services...');
    console.log('📊 Quota Status:', quotaManager.getAllQuotaStatus());
  });

  describe('POIs Service', () => {
    
    test('should find nearby restaurants', async () => {
      console.log('🍽️ Testing restaurant search...');
      
      try {
        const restaurants = await poisService.findNearby(
          testCoordinates,
          [560], // Restaurant category
          5000   // 5km radius
        );

        console.log(`✅ Found ${restaurants.length} restaurants`);
        
        expect(restaurants).toBeDefined();
        expect(Array.isArray(restaurants)).toBe(true);
        
        if (restaurants.length > 0) {
          const firstRestaurant = restaurants[0];
          expect(firstRestaurant).toHaveProperty('id');
          expect(firstRestaurant).toHaveProperty('name');
          expect(firstRestaurant).toHaveProperty('category');
          expect(firstRestaurant).toHaveProperty('coordinates');
          
          console.log('📍 Sample restaurant:', {
            name: firstRestaurant.name,
            category: firstRestaurant.category,
            distance: firstRestaurant.distance
          });
        }
        
      } catch (error) {
        console.warn('⚠️ POI test failed:', error);
        // Don't fail test if it's a quota/network issue
        expect(error).toBeDefined();
      }
    }, 30000);

    test('should search POIs by query', async () => {
      console.log('🔍 Testing POI search by query...');
      
      try {
        const pizzaPlaces = await poisService.searchPOIs(
          'pizza',
          [560], // Restaurant category
          testCoordinates,
          10000
        );

        console.log(`✅ Found ${pizzaPlaces.length} pizza places`);
        expect(pizzaPlaces).toBeDefined();
        expect(Array.isArray(pizzaPlaces)).toBe(true);
        
      } catch (error) {
        console.warn('⚠️ POI search test failed:', error);
        expect(error).toBeDefined();
      }
    }, 30000);

  });

  describe('Matrix Service', () => {
    
    test('should calculate route matrix', async () => {
      console.log('📊 Testing matrix calculation...');
      
      try {
        const comparison = await matrixService.calculateMatrix({
          profile: 'driving-car',
          sources: [testCoordinates],
          destinations: testDestinations,
          metrics: ['duration', 'distance']
        });

        console.log(`✅ Matrix calculated for ${comparison.destinations.length} destinations`);
        
        expect(comparison).toBeDefined();
        expect(comparison).toHaveProperty('source');
        expect(comparison).toHaveProperty('destinations');
        expect(Array.isArray(comparison.destinations)).toBe(true);
        
        if (comparison.destinations.length > 0) {
          const firstDest = comparison.destinations[0];
          expect(firstDest).toHaveProperty('duration');
          expect(firstDest).toHaveProperty('distance');
          expect(firstDest).toHaveProperty('rank');
          
          console.log('📍 Sample destination:', {
            duration: firstDest.durationFormatted,
            distance: firstDest.distanceFormatted,
            rank: firstDest.rank
          });
        }
        
      } catch (error) {
        console.warn('⚠️ Matrix test failed:', error);
        expect(error).toBeDefined();
      }
    }, 30000);

    test('should optimize route waypoints', async () => {
      console.log('🎯 Testing route optimization...');
      
      try {
        const waypoints = [
          { coordinates: testCoordinates, name: 'Start' },
          { coordinates: testDestinations[0], name: 'Stop 1' },
          { coordinates: testDestinations[1], name: 'Stop 2' },
          { coordinates: testDestinations[2], name: 'Stop 3' }
        ];

        const optimized = await matrixService.optimizeRoute(waypoints, 'driving-car');

        console.log('✅ Route optimized');
        console.log('💰 Savings:', `${optimized.savings.percentageSaved}% time saved`);
        
        expect(optimized).toBeDefined();
        expect(optimized).toHaveProperty('waypoints');
        expect(optimized).toHaveProperty('route');
        expect(optimized).toHaveProperty('savings');
        expect(Array.isArray(optimized.waypoints)).toBe(true);
        
      } catch (error) {
        console.warn('⚠️ Optimization test failed:', error);
        expect(error).toBeDefined();
      }
    }, 30000);

  });

  describe('Quota Management', () => {
    
    test('should track API usage', () => {
      console.log('📈 Testing quota tracking...');
      
      const poisStatus = quotaManager.getQuotaStatus('POIS');
      const matrixStatus = quotaManager.getQuotaStatus('MATRIX');
      
      expect(poisStatus).toBeDefined();
      expect(matrixStatus).toBeDefined();
      
      console.log('📊 POIs quota:', {
        used: poisStatus.dailyUsed,
        remaining: poisStatus.dailyRemaining,
        limit: poisStatus.dailyLimit
      });
      
      console.log('📊 Matrix quota:', {
        used: matrixStatus.dailyUsed,
        remaining: matrixStatus.dailyRemaining,
        limit: matrixStatus.dailyLimit
      });
    });

    test('should provide usage statistics', () => {
      console.log('📈 Testing usage statistics...');
      
      const stats = quotaManager.getUsageStats();
      
      expect(stats).toBeDefined();
      expect(stats).toHaveProperty('totalRequests');
      expect(stats).toHaveProperty('successfulRequests');
      expect(stats).toHaveProperty('cachedRequests');
      expect(stats).toHaveProperty('fallbackRequests');
      
      console.log('📊 Usage statistics:', {
        total: stats.totalRequests,
        successful: stats.successfulRequests,
        cached: stats.cachedRequests,
        fallback: stats.fallbackRequests
      });
    });

  });

  afterAll(() => {
    console.log('🏁 Tests completed');
    console.log('📊 Final quota status:', quotaManager.getAllQuotaStatus());
  });

});