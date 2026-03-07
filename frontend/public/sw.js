/**
 * IncludEd Service Worker
 * ========================
 * Offline-first PWA support for low-resource Rwandan school infrastructure.
 *
 * Strategy:
 *  - Static assets: Cache First (serve from cache, update in background)
 *  - API calls:     Network First with IndexedDB fallback queue
 *  - Literature content: Pre-cached on first load
 */

const CACHE_VERSION = "included-v3";
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const CONTENT_CACHE = `${CACHE_VERSION}-content`;
const API_CACHE = `${CACHE_VERSION}-api`;

const STATIC_ASSETS = [
    "/",
    "/index.html",
    "/manifest.json",
    "/favicon.ico",
];

// ── Install: pre-cache shell ───────────────────────────────────────────────────

self.addEventListener("install", (event) => {
    event.waitUntil(
        caches.open(STATIC_CACHE).then((cache) =>
            cache.addAll(STATIC_ASSETS).catch(() => { })
        ).then(() => self.skipWaiting())
    );
});

// ── Activate: clean old caches ─────────────────────────────────────────────────

self.addEventListener("activate", (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(
                keys
                    .filter((key) => key.startsWith("included-") && !key.startsWith(CACHE_VERSION))
                    .map((key) => caches.delete(key))
            )
        ).then(() => self.clients.claim())
    );
});

// ── Fetch ──────────────────────────────────────────────────────────────────────

self.addEventListener("fetch", (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Skip non-GET and chrome-extension
    if (request.method !== "GET" || url.protocol === "chrome-extension:") return;

    // API requests: network first, fall back to cache
    if (url.pathname.startsWith("/api/")) {
        event.respondWith(networkFirstWithCache(request, API_CACHE));
        return;
    }

    // Literature content (PDF/audio): cache first
    if (url.pathname.startsWith("/uploads/") || url.pathname.includes("/literature/")) {
        event.respondWith(cacheFirst(request, CONTENT_CACHE));
        return;
    }

    // 3. AI Service calls (port 8000): Network only
    if (url.port === "8000" || url.pathname.startsWith("/comprehension/")) {
        return; // Let it go to network normally
    }

    // Static assets: cache first with network refresh
    event.respondWith(cacheFirstWithRefresh(request, STATIC_CACHE));
});

// ── Strategies ─────────────────────────────────────────────────────────────────

async function cacheFirst(request, cacheName) {
    const cache = await caches.open(cacheName);
    const cached = await cache.match(request);
    if (cached) return cached;

    try {
        const response = await fetch(request);
        if (response.ok) cache.put(request, response.clone());
        return response;
    } catch {
        return new Response("Offline — content not cached", { status: 503 });
    }
}

async function cacheFirstWithRefresh(request, cacheName) {
    const cache = await caches.open(cacheName);
    const cached = await cache.match(request);

    // Refresh in background
    const fetchPromise = fetch(request).then((response) => {
        if (response.ok) cache.put(request, response.clone());
        return response;
    }).catch(() => new Response("Offline", { status: 503 }));

    if (cached) {
        // Return cached, but fetchPromise still runs to update cache
        return cached;
    }
    return fetchPromise;
}

async function networkFirstWithCache(request, cacheName) {
    const cache = await caches.open(cacheName);
    try {
        const response = await fetch(request);
        if (response.ok) cache.put(request, response.clone());
        return response;
    } catch {
        const cached = await cache.match(request);
        if (cached) return cached;
        return new Response(
            JSON.stringify({ error: "Offline", cached: false }),
            { status: 503, headers: { "Content-Type": "application/json" } }
        );
    }
}

// ── Background sync for telemetry ─────────────────────────────────────────────

self.addEventListener("sync", (event) => {
    if (event.tag === "telemetry-sync") {
        event.waitUntil(drainTelemetryQueue());
    }
});

async function drainTelemetryQueue() {
    // Open IDB and flush any pending telemetry
    const DB_NAME = "included_telemetry";
    const STORE_NAME = "pending_events";

    const db = await new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, 1);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });

    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const items = await new Promise((resolve) => {
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve([]);
    });

    for (const item of items) {
        try {
            // Each item has a batch and session context
            await fetch(`/api/sessions/${item.sessionId}/telemetry`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ events: item.batch }),
            });
        } catch {
            return; // Will retry on next sync
        }
    }

    store.clear();
}
