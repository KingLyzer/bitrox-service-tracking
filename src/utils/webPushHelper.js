/* Web Push Helper Utility */
import { getApiBase } from './apiConfig';

export async function enableWebPushNotifications(user) {
  if (typeof window === 'undefined' || !('Notification' in window) || !('serviceWorker' in navigator)) {
    return false;
  }

  const perm = await Notification.requestPermission();
  if (perm !== 'granted') return false;

  const publicKey = 'BP-ne4LYoyU0VTNT85w6v6TQs2HzPske85q3KaDolQGT80Q5Ua6BdUzIN0CIcwbmcyGSSqEMCS_vH5NZ18IGw4U';

  let reg = await navigator.serviceWorker.getRegistration('/sw.js');
  if (!reg) {
    reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
  }

  function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  const applicationServerKey = urlBase64ToUint8Array(publicKey);
  const subscription = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey
  });

  try {
    const subJson = subscription.toJSON();
    const res = await fetch(`${getApiBase()}/api/push/subscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subscription,
        user_id: user?.id || null,
        username: user?.username || 'guest',
        keys: subJson.keys || {},
      }),
    });
    if (!res.ok) {
      console.warn('[WebPush] Abonelik kaydedilemedi:', res.status);
    }
  } catch (e) {
    console.warn('[WebPush] Abonelik kayıt hatası:', e);
  }

  return true;
}

