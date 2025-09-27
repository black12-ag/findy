# Google Maps API Setup Guide

Your Findy project has been configured to use Google Maps APIs. Follow these steps to get your API key and enable all features.

## 1. Get Google Maps API Key

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the following APIs:
   - **Maps JavaScript API** (for map display)
   - **Directions API** (for routing)
   - **Places API** (for place search)
   - **Geocoding API** (for address lookup)
   - **Distance Matrix API** (optional, for advanced features)

4. Go to "Credentials" → "Create Credentials" → "API Key"
5. Copy your API key

## 2. Configure API Key

Replace the placeholder in your `.env` file:

```env
# Replace with your actual Google Maps API key
VITE_GOOGLE_MAPS_API_KEY=AIzaSyBu-916DdpKAjTmJNIgngS6HL_kDGCzOfw

# Google Maps Services
VITE_USE_GOOGLE_MAPS=true
```

## 3. Secure Your API Key (Important!)

1. In Google Cloud Console, go to your API key settings
2. Add **Application restrictions**:
   - For development: HTTP referrers → `http://localhost:3000/*`
   - For production: HTTP referrers → `https://yourdomain.com/*`

3. Add **API restrictions**:
   - Restrict key to: Maps JavaScript API, Directions API, Places API, Geocoding API

## 4. Features Enabled

With Google Maps API configured, you get:

✅ **Enhanced Map Display**: High-quality Google Maps with satellite, terrain views  
✅ **Accurate Directions**: Real-time traffic, multiple route options  
✅ **Rich Place Data**: Photos, ratings, hours, phone numbers  
✅ **Powerful Search**: Autocomplete, nearby places, detailed results  
✅ **Global Coverage**: Worldwide maps and routing  
✅ **Real-time Traffic**: Live traffic conditions and rerouting  

## 5. API Usage & Pricing

Google Maps has generous free tiers:
- **Maps JavaScript API**: 28,000 loads/month free
- **Directions API**: 2,500 requests/month free  
- **Places API**: 3,000 requests/month free
- **Geocoding API**: 2,500 requests/month free

[View current Google Maps pricing](https://cloud.google.com/maps-platform/pricing)

## 6. Fallback System

If Google Maps is unavailable, the app automatically falls back to:
- OpenRouteService for routing
- OpenStreetMap tiles for maps
- Nominatim for geocoding

## 7. Testing Your Setup

1. Replace the API key in `.env`
2. Restart your development server: `npm run dev`
3. Open the app - you should see Google Maps load
4. Test search, routing, and place details

## 8. Libraries Used

The project uses these Google Maps components from your screenshot:
- `@googlemaps/js-api-loader` - Core API loader
- Maps JavaScript API - Map display and interaction
- Places API - Location search and details
- Directions API - Route calculation
- Geocoding API - Address conversion

## Need Help?

Check the browser console for any errors. Common issues:
- Invalid API key
- APIs not enabled in Google Cloud Console  
- Incorrect domain restrictions
- Network connectivity issues

Your app will show helpful error messages and fallback gracefully to alternative services.