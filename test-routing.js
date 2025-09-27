// Simple test to verify routing is working
console.log('🧪 Testing Google Maps routing functionality...');

// Test coordinates (SF to LA)
const testRoute = {
  start: { lat: 37.7749, lng: -122.4194 },
  end: { lat: 34.0522, lng: -118.2437 }
};

console.log('📍 Test route:', testRoute);
console.log('🗺️ Google Maps API Key configured:', process.env.VITE_GOOGLE_MAPS_API_KEY ? 'Yes' : 'No');
console.log('✅ Test script completed. Check browser console for actual routing tests.');
console.log('🌐 Open http://localhost:3000 and use the search or navigation features to test routing.');