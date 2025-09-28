/**
 * 🔄 Findy Navigation App - Advanced Service Worker
 * 
 * Provides comprehensive offline functionality including:
 * - App shell caching
 * - Dynamic content caching
 * - Map tiles caching
 * - API response caching
 * - Background sync
 * - Push notifications
 */

const CACHE_VERSION = 'findy-v2.0.0';
const STATIC_CACHE_NAME = `${CACHE_VERSION}-static`;
const DYNAMIC_CACHE_NAME = `${CACHE_VERSION}-dynamic`;
const MAPS_CACHE_NAME = `${CACHE_VERSION}-maps`;
const API_CACHE_NAME = `${CACHE_VERSION}-api`;
const ROUTES_CACHE_NAME = `${CACHE_VERSION}-routes`;

// App Shell - Critical resources for offline functionality
const STATIC_RESOURCES = [
  '/',
  '/index.html',
  '/manifest.json',
  '/assets/index.css',
  '/assets/index.js',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/favicon.ico'
];

// Google Maps specific resources
const MAPS_RESOURCES = [
  'https://maps.googleapis.com/maps/api/js',
  'https://fonts.googleapis.com/css',
  'https://fonts.gstatic.com'
];

// Maximum cache sizes to prevent storage overflow
const MAX_CACHE_SIZE = {
  dynamic: 100,
  maps: 1000,
  api: 500,
  routes: 50
};

// Cache duration for different resource types
const CACHE_DURATION = {
  maps: 7 * 24 * 60 * 60 * 1000,      // 7 days
  api: 24 * 60 * 60 * 1000,           // 24 hours
  routes: 24 * 60 * 60 * 1000,        // 24 hours
  dynamic: 60 * 60 * 1000             // 1 hour
};

/**
 * Service Worker Installation
 */
self.addEventListener('install', event => {
  console.log('[SW] Installing service worker...');
  
  event.waitUntil(
    Promise.all([
      caches.open(STATIC_CACHE_NAME).then(cache => {
        console.log('[SW] Caching app shell');
        return cache.addAll(STATIC_RESOURCES);
      }),
      caches.open(MAPS_CACHE_NAME).then(cache => {
        console.log('[SW] Caching maps resources');
        return cache.addAll(MAPS_RESOURCES);
      }),
      initializeOfflineDB()
    ]).then(() => {
      console.log('[SW] Installation complete');
      self.skipWaiting();
    })
  );
});

/**
 * Service Worker Activation
 */
self.addEventListener('activate', event => {
  console.log('[SW] Activating service worker...');
  
  event.waitUntil(
    Promise.all([
      cleanupOldCaches(),
      self.clients.claim(),
      initializeBackgroundSync()
    ]).then(() => {
      console.log('[SW] Activation complete');
    })
  );
});

/**
 * Fetch Event Handler
 */
self.addEventListener('fetch', event => {
  const { request } = event;
  const { url, method } = request;
  
  if (method !== 'GET') {
    return;
  }
  
  if (isMapTileRequest(url)) {
    event.respondWith(handleMapTileRequest(request));
  } else if (isGoogleMapsAPI(url)) {
    event.respondWith(handleGoogleMapsAPI(request));
  } else if (isAPIRequest(url)) {
    event.respondWith(handleAPIRequest(request));
  } else if (isStaticResource(url)) {
    event.respondWith(handleStaticResource(request));
  } else {
    event.respondWith(handleDynamicResource(request));
  }
});

/**
 * Background Sync
 */
self.addEventListener('sync', event => {
  console.log('[SW] Background sync triggered:', event.tag);
  
  switch (event.tag) {
    case 'sync-routes':
      event.waitUntil(syncOfflineRoutes());
      break;
    case 'sync-places':
      event.waitUntil(syncOfflinePlaces());
      break;
    case 'sync-analytics':
      event.waitUntil(syncAnalytics());
      break;
  }
});

/**
 * Push Notifications
 */
self.addEventListener('push', event => {
  const options = {
    body: 'New navigation update available!',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/badge-72x72.png',
    tag: 'navigation-update',
    requireInteraction: true,
    actions: [
      {
        action: 'view',
        title: 'View Update'
      },
      {
        action: 'dismiss',
        title: 'Dismiss'
      }
    ]
  };

  if (event.data) {
    const data = event.data.json();
    options.body = data.body || options.body;
    options.data = data;
  }

  event.waitUntil(
    self.registration.showNotification('Findy Navigation', options)
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  
  if (event.action === 'view') {
    event.waitUntil(clients.openWindow('/'));
  }
});

/**
 * Handle Map Tiles
 */
async function handleMapTileRequest(request) {
  const cacheName = MAPS_CACHE_NAME;
  const cachedResponse = await caches.match(request, { cacheName });
  
  if (cachedResponse && !isExpired(cachedResponse, CACHE_DURATION.maps)) {
    return cachedResponse;
  }
  
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(cacheName);
      await cache.put(request, networkResponse.clone());
      await limitCacheSize(cacheName, MAX_CACHE_SIZE.maps);
      return networkResponse;
    }
  } catch (error) {
    console.log('[SW] Network failed for map tile');
  }
  
  return cachedResponse || createOfflineMapResponse();
}

/**
 * Handle Google Maps API
 */
async function handleGoogleMapsAPI(request) {
  const cacheName = API_CACHE_NAME;
  
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(cacheName);
      await cache.put(request, networkResponse.clone());
      return networkResponse;
    }
  } catch (error) {
    console.log('[SW] Google Maps API failed');
  }
  
  const cachedResponse = await caches.match(request, { cacheName });
  return cachedResponse || createOfflineAPIResponse(request);
}

/**
 * Handle API Requests
 */
async function handleAPIRequest(request) {
  const cacheName = API_CACHE_NAME;
  
  if (await isNetworkSlow()) {
    const cachedResponse = await caches.match(request, { cacheName });
    if (cachedResponse && !isExpired(cachedResponse, CACHE_DURATION.api)) {
      return cachedResponse;
    }
  }
  
  try {
    const networkResponse = await fetch(request, { timeout: 10000 });
    
    if (networkResponse.ok) {
      const cache = await caches.open(cacheName);
      await cache.put(request, networkResponse.clone());
      await limitCacheSize(cacheName, MAX_CACHE_SIZE.api);
      return networkResponse;
    }
  } catch (error) {
    console.log('[SW] API request failed');
  }
  
  const cachedResponse = await caches.match(request, { cacheName });
  return cachedResponse || createOfflineResponse(request);
}

/**
 * Handle Static Resources
 */
async function handleStaticResource(request) {
  const cachedResponse = await caches.match(request, { 
    cacheName: STATIC_CACHE_NAME 
  });
  
  if (cachedResponse) {
    return cachedResponse;
  }
  
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(STATIC_CACHE_NAME);
      await cache.put(request, networkResponse.clone());
      return networkResponse;
    }
  } catch (error) {
    console.log('[SW] Static resource failed:', request.url);
  }
  
  if (request.headers.get('accept')?.includes('text/html')) {
    return caches.match('/index.html');
  }
  
  return new Response('Resource not available offline', { status: 503 });
}

/**
 * Handle Dynamic Resources
 */
async function handleDynamicResource(request) {
  const cacheName = DYNAMIC_CACHE_NAME;
  
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(cacheName);
      await cache.put(request, networkResponse.clone());
      await limitCacheSize(cacheName, MAX_CACHE_SIZE.dynamic);
      return networkResponse;
    }
  } catch (error) {
    console.log('[SW] Dynamic resource failed');
  }
  
  const cachedResponse = await caches.match(request, { cacheName });
  return cachedResponse || new Response('Content not available offline', { 
    status: 503,
    headers: { 'Content-Type': 'text/plain' }
  });
}

/**
 * Utility Functions
 */
function isMapTileRequest(url) {
  return url.includes('maps.googleapis.com/maps/vt') || 
         url.includes('khms') || 
         url.includes('tiles.googleapis.com');
}

function isGoogleMapsAPI(url) {
  return url.includes('maps.googleapis.com/maps/api') ||
         url.includes('places.googleapis.com') ||
         url.includes('directions.googleapis.com');
}

function isAPIRequest(url) {
  return url.includes('/api/') || url.includes('localhost:8000');
}

function isStaticResource(url) {
  return STATIC_RESOURCES.some(resource => url.endsWith(resource)) ||
         url.includes('/static/') ||
         url.includes('/assets/') ||
         url.match(/\.(js|css|png|jpg|jpeg|svg|ico|woff|woff2)$/);
}

async function isNetworkSlow() {
  if ('connection' in navigator) {
    const connection = navigator.connection;
    return connection.effectiveType === 'slow-2g' || 
           connection.effectiveType === '2g' ||
           connection.downlink < 1.5;
  }
  return false;
}

function isExpired(response, maxAge) {
  if (!response.headers.has('date')) return false;
  
  const responseDate = new Date(response.headers.get('date'));
  const now = new Date();
  return (now.getTime() - responseDate.getTime()) > maxAge;
}

async function limitCacheSize(cacheName, maxSize) {
  const cache = await caches.open(cacheName);
  const requests = await cache.keys();
  
  if (requests.length > maxSize) {
    const toDelete = requests.slice(0, requests.length - maxSize);
    await Promise.all(toDelete.map(request => cache.delete(request)));
  }
}

async function cleanupOldCaches() {
  const cacheNames = await caches.keys();
  const oldCaches = cacheNames.filter(name => 
    name.startsWith('findy-') && !name.includes(CACHE_VERSION)
  );
  
  return Promise.all(oldCaches.map(name => caches.delete(name)));
}

function createOfflineMapResponse() {
  // Create a simple offline tile
  const svg = `<svg width="256" height="256" xmlns="http://www.w3.org/2000/svg">
    <rect width="256" height="256" fill="#f0f0f0"/>
    <text x="128" y="128" text-anchor="middle" font-family="Arial" font-size="16" fill="#999">Offline</text>
  </svg>`;
  
  return new Response(svg, { 
    headers: { 'Content-Type': 'image/svg+xml' }
  });
}

function createOfflineAPIResponse(request) {
  const url = new URL(request.url);
  
  if (url.pathname.includes('directions')) {
    return new Response(JSON.stringify({
      status: 'OFFLINE',
      routes: [],
      error_message: 'Offline mode - no routes available'
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  return new Response(JSON.stringify({
    status: 'offline',
    message: 'This feature is not available offline'
  }), {
    status: 503,
    headers: { 'Content-Type': 'application/json' }
  });
}

function createOfflineResponse(request) {
  return new Response(JSON.stringify({
    offline: true,
    message: 'You are currently offline. Some features may be limited.',
    timestamp: new Date().toISOString()
  }), {
    status: 503,
    headers: { 'Content-Type': 'application/json' }
  });
}

async function initializeOfflineDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('FindyOfflineDB', 2);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      
      if (!db.objectStoreNames.contains('maps')) {
        const mapsStore = db.createObjectStore('maps', { keyPath: 'id' });
        mapsStore.createIndex('city', 'city', { unique: false });
        mapsStore.createIndex('bounds', 'bounds', { unique: false });
      }
      
      if (!db.objectStoreNames.contains('routes')) {
        const routesStore = db.createObjectStore('routes', { keyPath: 'id' });
        routesStore.createIndex('fromTo', 'fromTo', { unique: false });
      }
      
      if (!db.objectStoreNames.contains('places')) {
        const placesStore = db.createObjectStore('places', { keyPath: 'id' });
        placesStore.createIndex('category', 'category', { unique: false });
      }
      
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'key' });
      }
    };
  });
}

async function initializeBackgroundSync() {
  if ('sync' in self.registration) {
    console.log('[SW] Background sync available');
  }
}

async function syncOfflineRoutes() {
  console.log('[SW] Syncing offline routes...');
}

async function syncOfflinePlaces() {
  console.log('[SW] Syncing offline places...');
}

async function syncAnalytics() {
  console.log('[SW] Syncing analytics data...');
}

console.log('[SW] Service worker script loaded');