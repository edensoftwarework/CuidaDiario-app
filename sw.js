/**
 * sw.js - Service Worker para CuidaDiario
 * by EDEN SoftWork
 *
 * Gestiona:
 *  - Cache de assets (soporte offline básico)
 *  - Push Notifications (recordatorios aunque la app esté cerrada)
 *  - Notification click (abre la app o enfoca la pestaña)
 */

const CACHE_NAME = 'cuidadiario-v4';
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
    '/icon.svg'
];

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
                keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
            ))
            .then(() => self.clients.claim())
    );
});

// ===== FETCH: Network first, fallback a cache =====
self.addEventListener('fetch', (event) => {
    // No interceptar peticiones no-GET ni llamadas a la API
    if (event.request.method !== 'GET') return;
    if (event.request.url.includes('/api/')) return;
    if (event.request.url.includes('railway.app')) return;
    if (event.request.url.includes('paypal.com')) return;
    if (event.request.url.includes('mercadopago.com')) return;

    event.respondWith(
        fetch(event.request)
            .then(response => {
                // Guardar copia fresca en cache
                if (response.ok) {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
                }
                return response;
            })
            .catch(() => caches.match(event.request))
    );
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
        badge: '/icon.svg',
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
