/* global firebase, importScripts, clients */
/* Service Worker de Firebase Cloud Messaging.
 * Servido desde la raíz (/firebase-messaging-sw.js) con scope "/".
 * Usa la build "compat" desde gstatic; la versión DEBE coincidir con la del
 * paquete npm `firebase` (ver package.json). Si se actualiza firebase, hay que
 * actualizar estas URLs.
 */
importScripts('https://www.gstatic.com/firebasejs/12.9.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/12.9.0/firebase-messaging-compat.js');

firebase.initializeApp({
    apiKey: 'AIzaSyB8ugTqPfTgMMneMY8_Jmacwf91dsINTjk',
    authDomain: 'brewbooks-mvp.firebaseapp.com',
    projectId: 'brewbooks-mvp',
    storageBucket: 'brewbooks-mvp.firebasestorage.app',
    messagingSenderId: '495427564009',
    appId: '1:495427564009:web:607ffc73ff70cc70191b78',
});

const messaging = firebase.messaging();

// Mensajes data-only en segundo plano: el SW controla 100% la presentación
// (evita la notificación duplicada de Chrome cuando llega un bloque `notification`).
messaging.onBackgroundMessage((payload) => {
    const data = payload.data || {};
    const txId = data.txId;
    const title = data.title || 'Pendiente de revisión';
    const body = data.body || 'Nuevo movimiento por revisar';
    const url = data.url || (txId ? `/?editTx=${txId}` : '/');

    self.registration.showNotification(title, {
        body,
        icon: '/icons/icon-192.png',
        badge: '/icons/badge-72.png',
        tag: txId ? `tx-${txId}` : undefined,
        data: { url },
    });
});

// Al tocar la notificación: enfocar una ventana abierta (y navegarla al deep
// link sin recargar vía postMessage) o abrir una nueva.
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const url = (event.notification.data && event.notification.data.url) || '/';

    event.waitUntil((async () => {
        const all = await clients.matchAll({ type: 'window', includeUncontrolled: true });
        for (const client of all) {
            if ('focus' in client) {
                await client.focus();
                client.postMessage({ type: 'OPEN_EDIT_TX', url });
                return;
            }
        }
        if (clients.openWindow) await clients.openWindow(url);
    })());
});
