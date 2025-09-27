# 🗺️ **FINDY Navigation App - Complete API Integration Plan**

Based on your OpenRouteService API quota and endpoints, here's the **exact plan** connecting each page/button to specific APIs:

---

## **📊 YOUR API LIMITS** (from screenshots)
- **Directions V2:** 2000/2000 requests (40/minute)
- **Geocoding Search:** 1000/1000 requests (100/minute) 
- **POIs:** 500/500 requests (60/minute)
- **Matrix V2:** 500/500 requests (40/minute)
- **Isochrones V2:** 500/500 requests (20/minute)

---

## **🏠 PAGE 1: HOME/MAP PAGE**

### **Components & Button Connections:**

#### **Map Container**
- **Technology:** React Leaflet + OpenStreetMap tiles
- **API:** Free OpenStreetMap tiles (no quota limit)
- **Buttons:**
  - **Zoom In/Out:** No API call
  - **Center to Location:** Uses browser GPS only

#### **Search Bar Component**
- **Button:** Search icon (🔍)
- **API Endpoint:** `/geocode/search`
- **Your Quota:** 1000 requests (100/minute)
- **URL Format:**
```
https://api.openrouteservice.org/geocode/search?api_key=eyJ...&text=restaurant&size=5
```

#### **Transport Mode Buttons**
- **🚗 Car Button** → Profile: `driving-car`
- **🚶 Walk Button** → Profile: `foot-walking`  
- **🚲 Bike Button** → Profile: `cycling-regular`
- **No API call** - just changes routing profile

#### **Quick Category Buttons**
- **🍽️ Restaurants** → **API:** `/pois` → Category ID: 560
- **⛽ Gas Stations** → **API:** `/pois` → Category ID: 470
- **🏥 Hospitals** → **API:** `/pois` → Category ID: 360
- **🏪 Shopping** → **API:** `/pois` → Category ID: 600
- **Your Quota:** 500 requests (60/minute)

---

## **🧭 PAGE 2: NAVIGATION PAGE**

### **Route Display Component**
- **"Get Directions" Button**
- **API Endpoint:** `/v2/directions/{profile}`
- **Method:** GET (for simple routes)
- **Your Quota:** 2000 requests (40/minute)
- **URL Format:**
```
https://api.openrouteservice.org/v2/directions/driving-car?api_key=eyJ...&start=8.681495,49.41461&end=8.687872,49.420318
```

### **Advanced Route Options**
- **"Fastest Route" Button** → Same API, `preference: "fastest"`
- **"Shortest Route" Button** → Same API, `preference: "shortest"`
- **"Avoid Tolls" Toggle** → Uses POST method with options
- **API Endpoint:** `/v2/directions/{profile}/geojson` (POST)

### **Multiple Waypoints**
- **"Add Stop" Button**
- **API Endpoint:** `/v2/directions/{profile}` (POST)
- **Coordinates array:** `[[start], [waypoint1], [waypoint2], [end]]`

---

## **📍 PAGE 3: PLACE DETAILS PAGE**

### **Place Information Component**
- **Triggered by:** Clicking any POI marker
- **API:** Uses data from previous `/pois` call
- **Buttons:**
  - **"Navigate Here"** → Calls `/v2/directions/{profile}`
  - **"Add to Favorites"** → Local storage only
  - **"Share Location"** → No API call

### **Nearby Places**
- **"Find Similar" Button**
- **API Endpoint:** `/pois`
- **Uses same category ID as current place**

---

## **⚡ PAGE 4: REAL-TIME NAVIGATION**

### **Live Route Component**
- **"Start Navigation" Button**
- **API Endpoint:** `/v2/directions/{profile}/geojson` (POST)
- **Request Body:**
```json
{
  "coordinates": [[start_lon, start_lat], [end_lon, end_lat]],
  "format": "geojson",
  "instructions": true
}
```

### **Route Recalculation**
- **"Recalculate" Button** (when off-route)
- **API:** Same as above with new current location
- **Triggered automatically** when user deviates

### **ETA Updates**
- **No additional API calls**
- **Uses duration from route response + elapsed time**

---

## **🎯 PAGE 5: SEARCH RESULTS PAGE**

### **Search Results List**
- **Triggered by:** Search bar submission
- **API Endpoint:** `/geocode/search`
- **Each Result Button:** "Navigate Here"
- **Connects to:** `/v2/directions/{profile}`

### **Autocomplete Dropdown**
- **API Endpoint:** `/geocode/autocomplete`
- **Your Quota:** 1000/1000 requests (100/minute)
- **Triggered:** On every keystroke (with 300ms delay)

---

## **📊 PAGE 6: ROUTE OPTIONS PAGE**

### **Route Comparison**
- **"Compare Routes" Button**
- **API Endpoint:** `/v2/matrix/{profile}`
- **Your Quota:** 500 requests (40/minute)
- **Shows:** Multiple route options with time/distance

### **Alternative Routes**
- **"Show Alternatives" Button**
- **API Endpoint:** `/v2/directions/{profile}` (POST)
- **Request Body:**
```json
{
  "coordinates": [[start], [end]],
  "alternative_routes": {
    "target_count": 3,
    "weight_factor": 1.4
  }
}
```

---

## **🕐 PAGE 7: REACHABILITY PAGE**

### **Isochrone Display**
- **"5 min reach" Button** → Range: [300] seconds
- **"10 min reach" Button** → Range: [600] seconds  
- **"15 min reach" Button** → Range: [900] seconds
- **API Endpoint:** `/v2/isochrones/{profile}`
- **Your Quota:** 500 requests (20/minute)
- **Request Body:**
```json
{
  "locations": [[longitude, latitude]],
  "range": [300, 600, 900],
  "range_type": "time"
}
```

---

## **⚙️ PAGE 8: SETTINGS PAGE**

### **Preferences (No API calls)**
- **Units Toggle** → Local storage
- **Map Style** → Changes tile layer URL
- **Voice Settings** → Local storage
- **Clear Cache** → IndexedDB cleanup

### **Account Management**
- **"Check API Usage" Button**
- **Shows your current quotas** (from screenshots)

---

## **📱 BUTTON-TO-API FLOW DIAGRAM**

```
USER ACTION → API ENDPOINT → QUOTA USED → UI UPDATE

Search "pizza" → /geocode/search → 1/1000 → Show results list
Click "Pizza Hut" → /v2/directions/driving-car → 1/2000 → Draw route
Click "🍽️ Restaurants" → /pois → 1/500 → Show restaurant markers  
"5 min reach" → /v2/isochrones/driving-car → 1/500 → Show coverage area
"Compare Routes" → /v2/matrix/driving-car → 1/500 → Show time matrix
```

---

## **🔄 API PRIORITY & FALLBACKS**

### **High Priority (Core Features)**
1. **Directions** (2000 quota) - Main navigation
2. **Geocoding** (1000 quota) - Search functionality  

### **Medium Priority (Enhanced Features)**
3. **POIs** (500 quota) - Find nearby places
4. **Matrix** (500 quota) - Route comparison

### **Low Priority (Premium Features)**  
5. **Isochrones** (500 quota) - Reachability analysis

### **Fallback Strategy**
- When quota exceeded → Show cached results
- POIs quota full → Use Overpass API (free alternative)
- Geocoding full → Use Nominatim (free alternative)

---

## **🗂️ FILE STRUCTURE FOR YOUR PROJECT**

```
src/
├── pages/
│   ├── HomePage.jsx → Map + Search + Categories
│   ├── NavigationPage.jsx → Active navigation
│   ├── SearchResultsPage.jsx → Search results list
│   ├── PlaceDetailsPage.jsx → Selected place info
│   ├── RouteOptionsPage.jsx → Route comparison
│   ├── ReachabilityPage.jsx → Isochrone display
│   └── SettingsPage.jsx → App preferences
├── components/
│   ├── MapContainer.jsx → Leaflet map
│   ├── SearchBar.jsx → /geocode/search
│   ├── CategoryButtons.jsx → /pois calls
│   ├── RouteDisplay.jsx → /directions calls
│   └── NavigationPanel.jsx → Turn instructions
├── services/
│   ├── directionsApi.js → All /v2/directions/* calls  
│   ├── geocodingApi.js → All /geocode/* calls
│   ├── poisApi.js → /pois calls
│   ├── matrixApi.js → /v2/matrix/* calls
│   └── isochronesApi.js → /v2/isochrones/* calls
└── config/
    └── apiConfig.js → Your API key & endpoints
```

This plan maps **every button** to **specific API endpoints** using **your actual quotas**. Each page has clear API connections and fallback strategies when limits are reached.
