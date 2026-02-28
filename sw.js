/**
 * sw.js - Service Worker para CuidaDiario
 * by EDEN SoftWork
 *
 * Gestiona:
 *  - Cache de assets (soporte offline básico)
 *  - Push Notifications (recordatorios aunque la app esté cerrada)
 *  - Notification click (abre la app o enfoca la pestaña)
 *  - Modo offline completo (v6):
 *      · Assets: network-first con fallback a cache
 *      · API GETs: stale-while-revalidate (muestra datos cacheados, actualiza en background)
 *      · API escrituras (POST/PUT/DELETE): cola de sincronización offline
 */

const CACHE_NAME     = 'cuidadiario-v7';
const API_CACHE_NAME = 'cuidadiario-api-v7';

const ASSETS = [
    '/',
    '/index.html',
    '/css/styles.css',
    '/js/api.js',
    '/js/storage.js',
    '/js/notifications.js',
    '/js/payments.js',
    '/js/reports.js',
    '/js/app.js',
    '/manifest.json',
    '/icon.svg',
    '/badge.svg'
];

// Endpoints de API cuyas respuestas deben cachearse para modo offline
// Solo GETs de datos del usuario (pacientes, medicamentos, citas, tareas, síntomas, contactos, signos, historial)
const CACHEABLE_API_PATTERNS = [
    /\/api\/pacientes(\?|$)/,
    /\/api\/medicamentos(\?|$)/,
    /\/api\/citas(\?|$)/,
    /\/api\/tareas(\?|$)/,
    /\/api\/sintomas(\?|$)/,
    /\/api\/contactos(\?|$)/,
    /\/api\/signos-vitales(\?|$)/,
    /\/api\/historial-medicamentos(\?|$)/,
    // NOTA: /api/me NO se cachea — el estado premium debe ser siempre fresco
    /\/api\/push\/vapid-key(\?|$)/
];

// Cola de solicitudes fallidas por falta de conexión (escrituras)
const OFFLINE_QUEUE_KEY = 'cuidadiario-offline-queue';

// ===== INSTALL: pre-cachear assets =====
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(ASSETS))
            .then(() => self.skipWaiting())
            .catch(err => console.warn('[SW] Error cacheando assets:', err))
    );
});

// ===== ACTIVATE: limpiar caches viejos =====
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then(keys => Promise.all(
                keys.filter(k => k !== CACHE_NAME && k !== API_CACHE_NAME)
                    .map(k => caches.delete(k))
            ))
            .then(() => self.clients.claim())
    );
});

// ===== FETCH =====
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = request.url;

    // Ignorar peticiones de terceros (MercadoPago, PayPal, Google, etc.)
    if (!url.startsWith(self.location.origin) && !url.includes('railway.app')) return;

    // Ignorar chrome-extension y otras URL no http
    if (!url.startsWith('http')) return;

    // ── API GETs: stale-while-revalidate ──────────────────────────────────────
    if (request.method === 'GET' && isCacheableApi(url)) {
        event.respondWith(staleWhileRevalidate(request));
        return;
    }

    // ── API no-GET (POST, PUT, DELETE): intentar red, encolar si offline ──────
    if (request.method !== 'GET' && isApiRequest(url)) {
        event.respondWith(networkWithOfflineQueue(request));
        return;
    }

    // ── Assets estáticos: network-first con fallback a cache ──────────────────
    if (request.method === 'GET') {
        event.respondWith(networkFirstAsset(request));
    }
});

// ── Helpers ──────────────────────────────────────────────────────────────────

function isApiRequest(url) {
    return url.includes('/api/') || url.includes('railway.app');
}

function isCacheableApi(url) {
    return CACHEABLE_API_PATTERNS.some(p => p.test(url)) || (url.includes('railway.app') && CACHEABLE_API_PATTERNS.some(p => p.test(url)));
}

/**
 * Stale-while-revalidate para API GETs:
 * 1. Devuelve la respuesta cacheada inmediatamente si existe (modo offline: datos frescos del último uso)
 * 2. Lanza la petición a la red en paralelo
 * 3. Si la red responde OK, actualiza el cache en background
 * 4. Si no hay cache y la red falla, devuelve un JSON de error apropiado
 */
async function staleWhileRevalidate(request) {
    const cache = await caches.open(API_CACHE_NAME);
    const cached = await cache.match(request);

    const networkPromise = fetch(request.clone())
        .then(response => {
            if (response.ok) {
                cache.put(request, response.clone()).catch(() => {});
            }
            return response;
        })
        .catch(() => null);

    if (cached) {
        // Tenemos cache: devolver inmediatamente y actualizar en background
        networkPromise.catch(() => {}); // fire-and-forget
        // Clonar la respuesta cacheada añadiendo header indicando que viene del cache
        const headers = new Headers(cached.headers);
        headers.set('X-SW-Cache', 'stale');
        return new Response(cached.body, {
            status: cached.status,
            statusText: cached.statusText,
            headers
        });
    }

    // Sin cache: esperar a la red
    const networkResponse = await networkPromise;
    if (networkResponse) return networkResponse;

    // Sin cache y sin red: respuesta de error offline
    return new Response(
        JSON.stringify({ error: 'Sin conexión. Los datos se mostrarán cuando vuelvas a conectarte.', offline: true }),
        { status: 503, headers: { 'Content-Type': 'application/json', 'X-SW-Cache': 'offline' } }
    );
}

/**
 * Network-first para assets estáticos: red → cache → offline fallback
 */
async function networkFirstAsset(request) {
    const cache = await caches.open(CACHE_NAME);
    try {
        const response = await fetch(request);
        if (response.ok) cache.put(request, response.clone()).catch(() => {});
        return response;
    } catch {
        const cached = await cache.match(request);
        if (cached) return cached;
        // Fallback para navegación: devolver index.html desde cache (SPA offline)
        if (request.mode === 'navigate') {
            const root = await cache.match('/index.html') || await cache.match('/');
            if (root) return root;
        }
        return new Response('Sin conexión', { status: 503 });
    }
}

/**
 * Borra del caché de API todas las entradas que correspondan al mismo recurso
 * que acaba de ser mutado (POST/PUT/DELETE exitoso), forzando un fetch fresco
 * en el próximo GET de esa sección.
 */
async function invalidateApiCache(url) {
    // Mapeo: patrón de URL mutada → patrón a limpiar del caché
    const RESOURCE_GROUPS = [
        /\/api\/medicamentos/,
        /\/api\/citas/,
        /\/api\/tareas/,
        /\/api\/sintomas/,
        /\/api\/contactos/,
        /\/api\/signos-vitales/,
        /\/api\/historial-medicamentos/,
        /\/api\/pacientes/,
        /\/api\/me/,
        /\/api\/share/,
    ];
    const matched = RESOURCE_GROUPS.find(p => p.test(url));
    if (!matched) return;
    try {
        const cache = await caches.open(API_CACHE_NAME);
        const keys = await cache.keys();
        await Promise.all(
            keys.filter(req => matched.test(req.url)).map(req => cache.delete(req))
        );
    } catch { /* OK */ }
}

/**
 * Para escrituras (POST/PUT/DELETE): intentar red.
 * Si la escritura tiene éxito, invalidar el caché GET del recurso afectado
 * para que el próximo loadXxx() obtenga datos frescos del servidor.
 * Si falla por offline, encolar en IndexedDB para reintento cuando vuelva la conexión.
 */
async function networkWithOfflineQueue(request) {
    try {
        const response = await fetch(request.clone());
        // Invalidar caché GET del recurso afectado para que el próximo load sea fresco
        if (response.ok) {
            invalidateApiCache(request.url).catch(() => {});
        }
        return response;
    } catch (err) {
        // Encolar la solicitud para sync posterior
        try {
            const body = await request.clone().text().catch(() => '');
            const queued = {
                url: request.url,
                method: request.method,
                headers: Object.fromEntries(request.headers.entries()),
                body,
                timestamp: Date.now()
            };
            // Guardar en localStorage vía cliente (IDB no está disponible directamente en SW sin lib)
            // Notificar a los clientes para que encolen
            const clientList = await self.clients.matchAll({ includeUncontrolled: true });
            clientList.forEach(client => client.postMessage({ type: 'OFFLINE_REQUEST_QUEUED', request: queued }));
        } catch { /* OK */ }

        return new Response(
            JSON.stringify({ error: 'Sin conexión. El cambio se guardará cuando vuelvas a conectarte.', offline: true, queued: true }),
            { status: 503, headers: { 'Content-Type': 'application/json' } }
        );
    }
}

// ===== BACKGROUND SYNC: reintentar escrituras encoladas =====
self.addEventListener('sync', (event) => {
    if (event.tag === 'offline-queue-sync') {
        event.waitUntil(
            self.clients.matchAll({ includeUncontrolled: true }).then(clientList => {
                clientList.forEach(client => client.postMessage({ type: 'PROCESS_OFFLINE_QUEUE' }));
            })
        );
    }
});


// ===== PUSH: recibir notificación del backend =====
self.addEventListener('push', (event) => {
    let payload = {
        title: 'CuidaDiario',
        body: 'Tienes un recordatorio pendiente.',
        icon: '/icon.svg',
        tag: 'cuidadiario-general',
        url: '/'
    };

    try {
        if (event.data) {
            const parsed = event.data.json();
            payload = { ...payload, ...parsed };
        }
    } catch (e) {
        if (event.data) payload.body = event.data.text();
    }

    const options = {
        body: payload.body,
        icon: payload.icon || '/icon.svg',
        badge: '/badge.svg',  // monocromo blanco — Android lo muestra bien en barra de notif
        vibrate: [200, 100, 200, 100, 300, 100, 300],
        tag: payload.tag || 'cuidadiario-notif',
        renotify: true,
        requireInteraction: true,   // ← CRÍTICO: la notificación persiste hasta que el usuario la descarte
        silent: false,              // ← Asegura que reproduzca sonido/vibración
        data: { url: payload.url || '/' },
        actions: [
            { action: 'abrir', title: '📋 Abrir app' },
            { action: 'cerrar', title: 'Cerrar' }
        ]
    };

    event.waitUntil(
        self.registration.showNotification(payload.title, options)
    );
});

// ===== NOTIFICATION CLICK: abrir/enfocar la app =====
self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    if (event.action === 'cerrar') return;

    const targetUrl = event.notification.data?.url || '/';

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then(clientList => {
                // Si ya hay una pestaña de la app abierta, enfocarla
                for (const client of clientList) {
                    if (client.url.startsWith(self.location.origin) && 'focus' in client) {
                        return client.focus();
                    }
                }
                // Si no, abrir nueva pestaña
                return clients.openWindow(targetUrl);
            })
    );
});

// ===== PUSH SUBSCRIPTION CHANGE: re-suscribir automáticamente =====
// Se dispara cuando el browser rota la clave de suscripción (ej: actualización de Chrome)
// CRÍTICO: usar event.oldSubscription.options para preservar la applicationServerKey (VAPID)
self.addEventListener('pushsubscriptionchange', (event) => {
    event.waitUntil(
        (async () => {
            try {
                // Reutilizar las opciones originales (incluye applicationServerKey con VAPID)
                const options = event.oldSubscription?.options || { userVisibleOnly: true };
                const subscription = await self.registration.pushManager.subscribe(options);
                // Notificar a todos los tabs abiertos para que guarden la nueva suscripción en el backend
                const clientList = await self.clients.matchAll({ includeUncontrolled: true });
                clientList.forEach(client => client.postMessage({
                    type: 'PUSH_SUBSCRIPTION_CHANGED',
                    subscription: subscription.toJSON()
                }));
                console.log('[SW] Suscripción push renovada automáticamente ✅');
            } catch (err) {
                console.warn('[SW] Error renovando suscripción push:', err.message);
            }
        })()
    );
});
