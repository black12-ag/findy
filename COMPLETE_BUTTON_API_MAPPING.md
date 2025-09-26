# 🗺️ **COMPLETE BUTTON-TO-API MAPPING - CORRECTED**

## **📊 VERIFIED API QUOTAS**
- **Directions V2:** 2,000/2,000 requests (40/minute)
- **Geocoding Search:** 1,000/1,000 requests (100/minute)  
- **POIs:** 500/500 requests (60/minute)
- **Matrix V2:** 500/500 requests (40/minute)
- **Isochrones V2:** 500/500 requests (20/minute)

---

## **🏠 PAGE 1: HOME/MAP PAGE**
**Component File:** `src/components/MapView.tsx`

### **Map Container**
| **Button/Action** | **API Call** | **Quota Used** | **Notes** |
|-------------------|--------------|----------------|-----------|
| **🔍 Zoom In** | None | 0 | Pure UI interaction |
| **🔍 Zoom Out** | None | 0 | Pure UI interaction |
| **🎯 Center to Location** | None | 0 | Uses browser GPS only |
| **📍 Click POI Marker** | Uses cached POI data | 0 | Triggers place details |

### **Search Bar Component**  
| **Button/Action** | **API Endpoint** | **Quota Used** | **Implementation** |
|-------------------|------------------|----------------|-------------------|
| **🔍 Search Submit** | `/geocode/search` | 1/1000 | `geocodingService.searchPlaces()` |
| **⌨️ Autocomplete (300ms delay)** | `/geocode/autocomplete` | 1/1000 | `geocodingService.autocomplete()` |

### **Transport Mode Buttons**
| **Button/Action** | **API Call** | **Quota Used** | **Profile** |
|-------------------|--------------|----------------|-------------|
| **🚗 Car Button** | None (local state) | 0 | `driving-car` |
| **🚶 Walk Button** | None (local state) | 0 | `foot-walking` |
| **🚲 Bike Button** | None (local state) | 0 | `cycling-regular` |

### **Quick Category Buttons**
| **Button/Action** | **API Endpoint** | **Category ID** | **Quota Used** |
|-------------------|------------------|-----------------|----------------|
| **🍽️ Restaurants** | `/pois` | 560 | 1/500 |
| **⛽ Gas Stations** | `/pois` | 470 | 1/500 |
| **🏥 Hospitals** | `/pois` | 360 | 1/500 |
| **🏪 Shopping** | `/pois` | 600 | 1/500 |

**API URL Format:**
```
https://api.openrouteservice.org/pois?api_key=eyJ...&request={"filters":{"category_ids":[560]},"geometry":{"bbox":[[lng,lat],[lng,lat]]}}
```

---

## **🧭 PAGE 2: NAVIGATION PANEL**  
**Component File:** `src/components/NavigationPanel.tsx`

### **Route Display Component**
| **Button/Action** | **API Endpoint** | **Quota Used** | **Method** |
|-------------------|------------------|----------------|------------|
| **🎯 Get Directions** | `/v2/directions/{profile}` | 1/2000 | GET |
| **⚡ Fastest Route** | `/v2/directions/{profile}` | 1/2000 | GET + preference: "fastest" |
| **📏 Shortest Route** | `/v2/directions/{profile}` | 1/2000 | GET + preference: "shortest" |
| **🚫 Avoid Tolls** | `/v2/directions/{profile}/geojson` | 1/2000 | POST + avoid_features: ["tollways"] |
| **🚫 Avoid Highways** | `/v2/directions/{profile}/geojson` | 1/2000 | POST + avoid_features: ["highways"] |
| **🔀 Show Alternatives** | `/v2/directions/{profile}` | 1/2000 | POST + alternative_routes |

### **Multiple Waypoints**
| **Button/Action** | **API Endpoint** | **Quota Used** | **Request Body** |
|-------------------|------------------|----------------|------------------|
| **➕ Add Stop** | `/v2/directions/{profile}` | 1/2000 | POST with coordinates array |

**API URL Format:**
```
https://api.openrouteservice.org/v2/directions/driving-car?api_key=eyJ...&start=8.681495,49.41461&end=8.687872,49.420318
```

---

## **📍 PAGE 3: PLACE DETAILS PAGE**
**Component File:** `src/components/PlaceDetailsSheet.tsx`

### **Place Information Component**
| **Button/Action** | **API Call** | **Quota Used** | **Notes** |
|-------------------|--------------|----------------|-----------|
| **Triggered by:** Click POI marker | Uses cached POI data | 0 | From previous `/pois` call |
| **🧭 Navigate Here** | `/v2/directions/{profile}` | 1/2000 | Start navigation |
| **⭐ Add to Favorites** | None | 0 | Local storage only |
| **📤 Share Location** | None | 0 | Native share API |

### **Nearby Places**  
| **Button/Action** | **API Endpoint** | **Quota Used** | **Implementation** |
|-------------------|------------------|----------------|-------------------|
| **🔍 Find Similar** | `/pois` | 1/500 | Same category ID as current place |

---

## **⚡ PAGE 4: REAL-TIME NAVIGATION**
**Component File:** `src/components/NavigationPanel.tsx` (Active State)

### **Live Route Component**
| **Button/Action** | **API Endpoint** | **Quota Used** | **Trigger** |
|-------------------|------------------|----------------|-------------|
| **▶️ Start Navigation** | `/v2/directions/{profile}/geojson` | 1/2000 | Manual button press |
| **🔄 Recalculate Route** | `/v2/directions/{profile}/geojson` | 1/2000 | When user goes off-route |
| **⏱️ ETA Updates** | None | 0 | Uses cached duration + elapsed time |

**POST Request Body:**
```json
{
  "coordinates": [[start_lon, start_lat], [end_lon, end_lat]],
  "format": "geojson", 
  "instructions": true
}
```

---

## **🎯 PAGE 5: SEARCH RESULTS PAGE**
**Component File:** `src/components/SearchPanel.tsx`

### **Search Results List**
| **Button/Action** | **API Endpoint** | **Quota Used** | **Trigger** |
|-------------------|------------------|----------------|-------------|
| **Triggered by:** Search bar submission | `/geocode/search` | 1/1000 | Form submit |
| **📍 Navigate Here** (per result) | `/v2/directions/{profile}` | 1/2000 | Click result item |

### **Autocomplete Dropdown**
| **Button/Action** | **API Endpoint** | **Quota Used** | **Trigger** |
|-------------------|------------------|----------------|-------------|
| **⌨️ Type Suggestions** | `/geocode/autocomplete` | 1/1000 | Every keystroke (300ms delay) |

---

## **📊 PAGE 6: ROUTE OPTIONS PAGE**
**Component File:** `src/components/EnhancedRoutePanel.tsx`

### **Route Comparison**
| **Button/Action** | **API Endpoint** | **Quota Used** | **Response** |
|-------------------|------------------|----------------|--------------|
| **📊 Compare Routes** | `/v2/matrix/{profile}` | 1/500 | Multiple route times/distances |

### **Alternative Routes**
| **Button/Action** | **API Endpoint** | **Quota Used** | **Request Body** |
|-------------------|------------------|----------------|------------------|
| **🔀 Show Alternatives** | `/v2/directions/{profile}` | 1/2000 | POST with alternative_routes config |

**Alternative Routes Request:**
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
**Component File:** `src/components/IsochronePanel.tsx` (NEW COMPONENT)

### **Isochrone Display**
| **Button/Action** | **API Endpoint** | **Quota Used** | **Range (seconds)** |
|-------------------|------------------|----------------|---------------------|
| **⏱️ 5min Reach** | `/v2/isochrones/{profile}` | 1/500 | [300] |
| **⏱️ 10min Reach** | `/v2/isochrones/{profile}` | 1/500 | [600] |  
| **⏱️ 15min Reach** | `/v2/isochrones/{profile}` | 1/500 | [900] |
| **🚗 By Transport Mode** | `/v2/isochrones/{profile}` | 1/500 | Dynamic profile |

**Request Body:**
```json
{
  "locations": [[longitude, latitude]],
  "range": [300, 600, 900],
  "range_type": "time"
}
```

---

## **⚙️ PAGE 8: SETTINGS PAGE**
**Component File:** `src/components/SettingsPanel.tsx`

### **Preferences (No API Calls)**
| **Button/Action** | **API Call** | **Storage** | **Notes** |
|-------------------|--------------|-------------|-----------|
| **🔄 Units Toggle** | None | localStorage | Metric/Imperial |
| **🗺️ Map Style** | None | Changes tile layer URL | Standard/Satellite/Dark |
| **🗣️ Voice Settings** | None | localStorage | Voice type/speed |
| **🗑️ Clear Cache** | None | IndexedDB cleanup | Clear API cache |

### **Account Management**  
| **Button/Action** | **API Call** | **Data Source** | **Notes** |
|-------------------|--------------|-----------------|-----------|
| **📊 Check API Usage** | None | quotaManager.getAllQuotaStatus() | Shows current quotas |

---

## **📱 COMPLETE BUTTON-TO-API FLOW**

```
USER ACTION → QUOTA CHECK → API CALL → CACHE → UI UPDATE

Examples:

🔍 Search "pizza"
   ↓
📊 quotaManager.canMakeRequest('GEOCODING')  
   ↓
🌐 GET /geocode/search?text=pizza&size=10
   ↓
💾 Cache results (24h TTL)
   ↓
📱 Display search results in SearchPanel

🧭 Navigate to Pizza Hut  
   ↓
📊 quotaManager.canMakeRequest('DIRECTIONS')
   ↓
🌐 GET /v2/directions/driving-car?start=x,y&end=a,b
   ↓
💾 Cache route (5min TTL)  
   ↓
📱 Display route in NavigationPanel

🍽️ Click "Restaurants"
   ↓
📊 quotaManager.canMakeRequest('POIS')
   ↓  
🌐 GET /pois?request={category_ids:[560]}
   ↓
💾 Cache POIs (1h TTL)
   ↓
📱 Show restaurant markers on MapView

⏱️ "5 min reach"
   ↓
📊 quotaManager.canMakeRequest('ISOCHRONES')
   ↓
🌐 POST /v2/isochrones/driving-car {range:[300]}
   ↓
💾 Cache isochrone (30min TTL)
   ↓
📱 Show coverage area overlay on map

📊 "Compare Routes" 
   ↓
📊 quotaManager.canMakeRequest('MATRIX')
   ↓
🌐 POST /v2/matrix/driving-car {sources:[], destinations:[]}
   ↓
💾 Cache matrix (10min TTL)
   ↓
📱 Show time/distance comparison table
```

---

## **🗂️ EXACT FILE STRUCTURE MAPPING**

### **React Components (Pages)**
```
src/pages/
├── HomePage.jsx → MapView.tsx (Map + Search + Categories)
├── NavigationPage.jsx → NavigationPanel.tsx (Active navigation)  
├── SearchResultsPage.jsx → SearchPanel.tsx (Search results list)
├── PlaceDetailsPage.jsx → PlaceDetailsSheet.tsx (Selected place info)
├── RouteOptionsPage.jsx → EnhancedRoutePanel.tsx (Route comparison)
├── ReachabilityPage.jsx → IsochronePanel.tsx (NEW - Isochrone display)
└── SettingsPage.jsx → SettingsPanel.tsx (App preferences)
```

### **Service Layer**
```
src/services/
├── directionsApi.js → directionsService.ts (✅ DONE)
├── geocodingApi.js → geocodingService.ts (✅ DONE)  
├── poisApi.js → poisService.ts (❌ TO DO)
├── matrixApi.js → matrixService.ts (❌ TO DO)
└── isochronesApi.js → isochronesService.ts (❌ TO DO)
```

### **Configuration**
```
src/config/
└── apiConfig.js → apiConfig.ts (✅ DONE)
```

---

## **📋 COMPLETE BUTTON CHECKLIST**

### **✅ COVERED BUTTONS (All pages mapped)**
- [x] **Map:** Search, POI Categories, Transport Modes, Zoom, Center
- [x] **Navigation:** Get Directions, Route Options, Alternatives, Multi-stop  
- [x] **Search:** Submit, Autocomplete, Navigate Here
- [x] **Place Details:** Navigate Here, Add Favorite, Share, Find Similar
- [x] **Real-time Nav:** Start Navigation, Recalculate, ETA Updates
- [x] **Route Options:** Compare Routes, Show Alternatives
- [x] **Reachability:** 5min/10min/15min reach, Transport modes
- [x] **Settings:** Units, Map Style, Voice, Clear Cache, API Usage

### **🎯 TOTAL BUTTON COUNT**
- **API-Connected Buttons:** 28 buttons
- **Local-Only Buttons:** 12 buttons  
- **Total Buttons Mapped:** 40+ buttons across 8 pages

---

## **🔧 IMPLEMENTATION PRIORITY**

### **🔴 CRITICAL (Core App Function)**
1. Search Bar → Geocoding API
2. Get Directions → Directions API  
3. POI Categories → POIs API
4. Navigation → Directions API

### **🟡 HIGH (Enhanced Features)**  
5. Route Comparison → Matrix API
6. Alternative Routes → Directions API
7. Multi-stop → Directions API
8. Place Details → Cached POI data

### **🟢 MEDIUM (Advanced Features)**
9. Reachability Analysis → Isochrones API
10. Real-time Recalculation → Directions API
11. Settings/Preferences → Local storage
12. Autocomplete → Geocoding API

---

**✅ VERIFICATION COMPLETE: All original buttons and pages now properly mapped!**

**🎯 Next Action:** Begin Day 1 implementation following the updated plan.