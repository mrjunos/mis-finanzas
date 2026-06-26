import { useState, useEffect, useCallback, useRef } from 'react';
import { doc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import {
    db,
    getMessagingIfSupported,
    getToken,
    onMessage,
    VAPID_PUBLIC_KEY,
} from '../firebase';
import { useAuth } from '../context/AuthContext';

const SW_URL = '/firebase-messaging-sw.js';

// Gestiona el ciclo de vida de las notificaciones push (Web Push + FCM):
// soporte del navegador, permiso, obtención del token y su persistencia en
// Firestore (colección `fcm_tokens`, doc id = token → idempotente).
export function usePushNotifications(onForegroundMessage) {
    const { currentUser } = useAuth();
    const [supported, setSupported] = useState(false);
    const [permission, setPermission] = useState(
        typeof Notification !== 'undefined' ? Notification.permission : 'denied'
    );
    const [token, setToken] = useState(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    const onForegroundRef = useRef(onForegroundMessage);
    onForegroundRef.current = onForegroundMessage;

    // ¿El navegador soporta FCM? (iOS exige PWA instalada; jsdom no soporta)
    useEffect(() => {
        let active = true;
        getMessagingIfSupported().then(m => { if (active) setSupported(!!m); });
        return () => { active = false; };
    }, []);

    const enable = useCallback(async () => {
        setError(null);
        const messaging = await getMessagingIfSupported();
        if (!messaging) { setError('unsupported'); return; }
        if (!currentUser) { setError('no-user'); return; }
        if (!VAPID_PUBLIC_KEY) { setError('no-vapid'); return; }

        setBusy(true);
        try {
            const perm = await Notification.requestPermission();
            setPermission(perm);
            if (perm !== 'granted') { setError('denied'); return; }

            const swReg = await navigator.serviceWorker.register(SW_URL);
            const fcmToken = await getToken(messaging, {
                vapidKey: VAPID_PUBLIC_KEY,
                serviceWorkerRegistration: swReg,
            });
            if (!fcmToken) { setError('no-token'); return; }

            // doc id = token → reactivar no duplica; Python borra por token.
            await setDoc(
                doc(db, 'fcm_tokens', fcmToken),
                {
                    token: fcmToken,
                    uid: currentUser.uid,
                    email: currentUser.email,
                    userAgent: navigator.userAgent,
                    updatedAt: serverTimestamp(),
                },
                { merge: true }
            );
            setToken(fcmToken);
        } catch (e) {
            console.error('Error activando notificaciones:', e);
            setError('failed');
        } finally {
            setBusy(false);
        }
    }, [currentUser]);

    const disable = useCallback(async () => {
        setBusy(true);
        try {
            if (token) await deleteDoc(doc(db, 'fcm_tokens', token));
            setToken(null);
        } catch (e) {
            console.error('Error desactivando notificaciones:', e);
        } finally {
            setBusy(false);
        }
    }, [token]);

    // Mensajes en primer plano (app abierta): los entrega onMessage, no el SW.
    useEffect(() => {
        let unsub;
        getMessagingIfSupported().then(m => {
            if (!m) return;
            unsub = onMessage(m, payload => onForegroundRef.current?.(payload));
        });
        return () => { unsub?.(); };
    }, []);

    return { supported, permission, token, enabled: !!token, busy, error, enable, disable };
}
