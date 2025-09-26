// PathFinder Pro Service Worker
const CACHE_NAME = 'pathfinder-pro-v1';
const STATIC_CACHE_NAME = 'pathfinder-static-v1';
const DYNAMIC_CACHE_NAME = 'pathfinder-dynamic-v1';
const MAP_CACHE_NAME = 'pathfinder-maps-v1';

// Define what to cache
const STATIC_ASSETS = [
  '/',
  '/static/js/bundle.js',
  '/static/css/main.css',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  // Add other static assets as needed
];

const CACHE_STRATEGIES = {
  // Cache first, then network for static assets
  CACHE_FIRST: 'cache-first',
  // Network first, then cache for dynamic content
  NETWORK_FIRST: 'network-first',
  // Network only for real-time data
  NETWORK_ONLY: 'network-only',
  // Cache only for offline resources
  CACHE_ONLY: 'cache-only'
};

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installing Service Worker...');
  
  event.waitUntil(
    caches.open(STATIC_CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Caching static assets...');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log('[SW] Static assets cached successfully');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('[SW] Failed to cache static assets:', error);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating Service Worker...');
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            // Delete old caches
            if (cacheName !== STATIC_CACHE_NAME && 
                cacheName !== DYNAMIC_CACHE_NAME && 
                cacheName !== MAP_CACHE_NAME) {
              console.log('[SW] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('[SW] Service Worker activated');
        return self.clients.claim();
      })
  );
});

// Fetch event - handle network requests
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // Handle different types of requests
  if (isStaticAsset(event.request)) {
    event.respondWith(handleStaticAsset(event.request));
  } else if (isApiRequest(event.request)) {
    event.respondWith(handleApiRequest(event.request));
  } else if (isMapTileRequest(event.request)) {
    event.respondWith(handleMapTile(event.request));
  } else if (isNavigationRequest(event.request)) {
    event.respondWith(handleNavigation(event.request));
  } else {
    event.respondWith(handleDefault(event.request));
  }
});

// Handle static assets (cache first)
async function handleStaticAsset(request) {
  try {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    const networkResponse = await fetch(request);
    const cache = await caches.open(STATIC_CACHE_NAME);
    cache.put(request, networkResponse.clone());
    return networkResponse;
  } catch (error) {
    console.error('[SW] Static asset fetch failed:', error);
    return new Response('Offline', { status: 503 });
  }
}

// Handle API requests (network first with fallback)
async function handleApiRequest(request) {
  try {
    const networkResponse = await fetch(request);
    
    // Cache successful GET requests
    if (request.method === 'GET' && networkResponse.ok) {
      const cache = await caches.open(DYNAMIC_CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.log('[SW] Network failed, trying cache for:', request.url);
    
    // Try to serve from cache
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // If it's a critical API request, queue for background sync
    if (request.method === 'POST' || request.method === 'PUT') {
      await queueRequestForSync(request);
    }
    
    return new Response(
      JSON.stringify({ 
        error: 'Offline',
        message: 'Request queued for when online'
      }),
      {
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

// Handle map tiles (cache with TTL)
async function handleMapTile(request) {
  const cache = await caches.open(MAP_CACHE_NAME);
  const cachedResponse = await cache.match(request);
  
  // Check if cached tile is still fresh (24 hours)
  if (cachedResponse) {
    const cachedDate = new Date(cachedResponse.headers.get('date'));
    const now = new Date();
    const age = (now.getTime() - cachedDate.getTime()) / (1000 * 60 * 60);
    
    if (age < 24) {
      return cachedResponse;
    }
  }
  
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    if (cachedResponse) {
      return cachedResponse;
    }
    return new Response('Map tile unavailable offline', { status: 503 });
  }
}

// Handle navigation requests
async function handleNavigation(request) {
  try {
    const networkResponse = await fetch(request);
    return networkResponse;
  } catch (error) {
    // Serve the main app shell for navigation requests
    const cache = await caches.open(STATIC_CACHE_NAME);
    const appShell = await cache.match('/');
    return appShell || new Response('App unavailable offline', { status: 503 });
  }
}

// Handle default requests
async function handleDefault(request) {
  try {
    return await fetch(request);
  } catch (error) {
    const cachedResponse = await caches.match(request);
    return cachedResponse || new Response('Resource unavailable offline', { status: 503 });
  }
}

// Background Sync for queued requests
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync triggered:', event.tag);
  
  if (event.tag === 'background-sync') {
    event.waitUntil(processQueuedRequests());
  }
});

// Push notifications
self.addEventListener('push', (event) => {
  console.log('[SW] Push notification received:', event);
  
  let notificationData = {
    title: 'PathFinder Pro',
    body: 'You have a new notification',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-96x96.png',
    tag: 'default',
    data: {}
  };
  
  if (event.data) {
    try {
      const data = event.data.json();
      notificationData = {
        ...notificationData,
        ...data
      };
    } catch (e) {
      console.error('[SW] Error parsing push data:', e);
      notificationData.body = event.data.text() || notificationData.body;
    }
  }
  
  event.waitUntil(
    self.registration.showNotification(notificationData.title, {
      body: notificationData.body,
      icon: notificationData.icon,
      badge: notificationData.badge,
      tag: notificationData.tag,
      data: notificationData.data,
      actions: notificationData.actions,
      requireInteraction: notificationData.requireInteraction || false,
      silent: notificationData.silent || false
    })
  );
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification click received:', event);
  
  event.notification.close();
  
  const action = event.action;
  const data = event.notification.data || {};
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Handle different notification actions
        switch (action) {
          case 'reroute':
            return handleRerouteAction(clientList, data);
          case 'accept':
            return handleAcceptRouteAction(clientList, data);
          case 'start':
            return handleStartNavigationAction(clientList, data);
          case 'rate':
            return handleRateAction(clientList, data);
          case 'share':
            return handleShareAction(clientList, data);
          case 'dismiss':
            return Promise.resolve(); // Just dismiss
          default:
            // Default action - focus or open app
            return focusOrOpenApp(clientList);
        }
      })
  );
});

// Notification action handlers
function handleRerouteAction(clientList, data) {
  const client = clientList.find(c => c.url.includes('/navigation') && c.focused) || clientList[0];
  if (client) {
    client.focus();
    client.postMessage({
      type: 'NAVIGATION_ACTION',
      action: 'reroute',
      data
    });
  } else {
    return clients.openWindow('/navigation?action=reroute');
  }
}

function handleAcceptRouteAction(clientList, data) {
  const client = clientList.find(c => c.url.includes('/navigation') && c.focused) || clientList[0];
  if (client) {
    client.focus();
    client.postMessage({
      type: 'NAVIGATION_ACTION',
      action: 'accept_route',
      data
    });
  } else {
    return clients.openWindow('/navigation?action=accept_route');
  }
}

function handleStartNavigationAction(clientList, data) {
  const client = clientList.find(c => c.url.includes('/navigation') && c.focused) || clientList[0];
  if (client) {
    client.focus();
    client.postMessage({
      type: 'NAVIGATION_ACTION',
      action: 'start',
      data
    });
  } else {
    return clients.openWindow('/navigation?action=start');
  }
}

function handleRateAction(clientList, data) {
  const client = clientList.find(c => c.focused) || clientList[0];
  if (client) {
    client.focus();
    client.postMessage({
      type: 'APP_ACTION',
      action: 'rate_trip',
      data
    });
  } else {
    return clients.openWindow('/rate-trip');
  }
}

function handleShareAction(clientList, data) {
  const client = clientList.find(c => c.focused) || clientList[0];
  if (client) {
    client.focus();
    client.postMessage({
      type: 'APP_ACTION',
      action: 'share_location',
      data
    });
  } else {
    return clients.openWindow('/');
  }
}

function focusOrOpenApp(clientList) {
  const client = clientList.find(c => c.focused) || clientList[0];
  if (client) {
    return client.focus();
  } else {
    return clients.openWindow('/');
  }
}

// Utility functions
function isStaticAsset(request) {
  return request.url.includes('/static/') || 
         request.url.includes('/icons/') ||
         request.url.includes('/manifest.json');
}

function isApiRequest(request) {
  return request.url.includes('/api/') ||
         request.url.includes('openrouteservice.org') ||
         request.url.includes('/geocode/') ||
         request.url.includes('/directions/');
}

function isMapTileRequest(request) {
  return request.url.includes('tile') ||
         request.url.includes('maps') ||
         request.url.match(/\.(png|jpg|jpeg)(\?|$)/) ||
         request.url.includes('openstreetmap');
}

function isNavigationRequest(request) {
  return request.mode === 'navigate' ||
         (request.method === 'GET' && request.headers.get('accept').includes('text/html'));
}

// Queue requests for background sync
async function queueRequestForSync(request) {
  try {
    const requestData = {
      url: request.url,
      method: request.method,
      headers: Object.fromEntries(request.headers.entries()),
      body: request.method !== 'GET' ? await request.text() : null,
      timestamp: Date.now()
    };
    
    // Store in IndexedDB for persistence
    const db = await openDB();
    const transaction = db.transaction(['sync_queue'], 'readwrite');
    const store = transaction.objectStore('sync_queue');
    await store.add(requestData);
    
    // Register for background sync
    await self.registration.sync.register('background-sync');
    
    console.log('[SW] Request queued for sync:', request.url);
  } catch (error) {
    console.error('[SW] Failed to queue request:', error);
  }
}

// Process queued requests during background sync
async function processQueuedRequests() {
  try {
    const db = await openDB();
    const transaction = db.transaction(['sync_queue'], 'readwrite');
    const store = transaction.objectStore('sync_queue');
    const requests = await store.getAll();
    
    for (const requestData of requests) {
      try {
        const response = await fetch(requestData.url, {
          method: requestData.method,
          headers: requestData.headers,
          body: requestData.body
        });
        
        if (response.ok) {
          await store.delete(requestData.id);
          console.log('[SW] Synced queued request:', requestData.url);
        }
      } catch (error) {
        console.error('[SW] Failed to sync request:', error);
        // Keep in queue for retry
      }
    }
  } catch (error) {
    console.error('[SW] Background sync failed:', error);
  }
}

// IndexedDB helper
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('PathFinderSW', 1);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('sync_queue')) {
        const store = db.createObjectStore('sync_queue', { keyPath: 'id', autoIncrement: true });
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };
  });
}

// Cache management - cleanup old entries
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  } else if (event.data && event.data.type === 'CACHE_CLEANUP') {
    event.waitUntil(cleanupCaches());
  }
});

async function cleanupCaches() {
  const cacheNames = await caches.keys();
  
  for (const cacheName of cacheNames) {
    const cache = await caches.open(cacheName);
    const requests = await cache.keys();
    
    // Remove entries older than 7 days
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    
    for (const request of requests) {
      const response = await cache.match(request);
      if (response) {
        const responseDate = new Date(response.headers.get('date'));
        if (responseDate < oneWeekAgo) {
          await cache.delete(request);
        }
      }
    }
  }
  
  console.log('[SW] Cache cleanup completed');
}