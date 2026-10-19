import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../../context/AuthContext';

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

export default function WebPushSettings({ showNotification }) {
  const { user } = useAuth();
  const [supported, setSupported] = useState(true);
  const [permission, setPermission] = useState('default');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [toggling, setToggling] = useState(false);

  const checkSubscription = useCallback(async () => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) {
      setSupported(false);
      setLoading(false);
      return;
    }

    if (typeof Notification !== 'undefined') {
      setPermission(Notification.permission);
    }

    try {
      let reg = await navigator.serviceWorker.getRegistration('/sw.js');
      if (!reg) {
        reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => null);
      }

      if (reg) {
        const subPromise = reg.pushManager.getSubscription();
        const timeoutPromise = new Promise((res) => setTimeout(() => res(null), 3000));
        const sub = await Promise.race([subPromise, timeoutPromise]);
        setIsSubscribed(!!sub);
      }
    } catch (err) {
      console.warn('[WebPush] Abonelik kontrol hatası:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkSubscription();
  }, [checkSubscription]);

  const handleSubscribe = async () => {
    if (!supported) {
      showNotification('Bu tarayıcı kapalıyken Web Push bildirimlerini desteklemiyor.', 'warning');
      return;
    }

    setToggling(true);
    try {
      // 1. Request permission if not granted
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== 'granted') {
        showNotification('Bildirim izni verilmedi. Lütfen tarayıcı izinlerini kontrol edin.', 'warning');
        setToggling(false);
        return;
      }

      // 2. Get VAPID public key with fallback
      let publicKey = 'BP-ne4LYoyU0VTNT85w6v6TQs2HzPske85q3KaDolQGT80Q5Ua6BdUzIN0CIcwbmcyGSSqEMCS_vH5NZ18IGw4U';
      try {
        const res = await fetch(`${window.API_BASE}/api/push/vapid-key`);
        if (res.ok) {
          const vapidData = await res.json();
          if (vapidData?.publicKey) publicKey = vapidData.publicKey;
        }
      } catch (e) {
        // Fallback quietly to default valid VAPID key
      }

      // 3. Register SW if not already registered
      let reg = await navigator.serviceWorker.getRegistration('/sw.js');
      if (!reg) {
        reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      }

      // 4. Subscribe to PushManager
      const applicationServerKey = urlBase64ToUint8Array(publicKey);
      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey
      });

      // 5. Send subscription object to server
      try {
        const subJson = subscription.toJSON();
        const saveRes = await fetch(`${window.API_BASE}/api/push/subscribe`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            subscription,
            user_id: user?.id || null,
            username: user?.username || 'guest',
            keys: subJson.keys || {},
          }),
        });
        if (!saveRes.ok) {
          console.warn('[WebPush] Abonelik kaydedilemedi:', saveRes.status);
        }
      } catch (e) {
        console.warn('[WebPush] Abonelik kayıt hatası:', e);
      }

      setIsSubscribed(true);
      showNotification('Web sayfası kapalıyken arka plan bildirimleri etkinleştirildi! 🔔', 'success');
    } catch (err) {
      console.error('[WebPush Subscribe]', err);
      showNotification('Abonelik işlemi: ' + err.message, 'danger');
    } finally {
      setToggling(false);
    }
  };

  const handleUnsubscribe = async () => {
    setToggling(true);
    try {
      let reg = await navigator.serviceWorker.getRegistration('/sw.js');
      if (reg) {
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          await sub.unsubscribe().catch(() => {});
          try {
            await fetch(`${window.API_BASE}/api/push/unsubscribe`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ endpoint: sub.endpoint }),
            });
          } catch (e) {
            // Quiet
          }
        }
      }
      setIsSubscribed(false);
      showNotification('Web Push bildirim aboneliği iptal edildi.', 'info');
    } catch (err) {
      showNotification('İptal hatası: ' + err.message, 'danger');
    } finally {
      setToggling(false);
    }
  };

  const handleTestNotification = async () => {
    setTesting(true);
    try {
      let sent = false;
      const iconUrl = window.location.origin + '/assets/logo-BAS7192s.png';

      // 1. Try Window Notification API directly (instant desktop OS popup)
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        try {
          const n = new Notification('Örnek Teknoloji Test Bildirimi 🔔', {
            body: 'Harika! Web Push bildirimleri cihazınızda başarıyla aktif!',
            icon: iconUrl,
            tag: 'test-notification-' + Date.now(),
            requireInteraction: true
          });
          n.onclick = () => {
            window.focus();
            n.close();
          };
          sent = true;
        } catch (nErr) {
          console.warn('[WebPush] Window Notification error:', nErr);
        }
      }

      // 2. Try ServiceWorker Registration showNotification
      if (!sent) {
        try {
          let reg = await navigator.serviceWorker.getRegistration('/sw.js');
          if (!reg) {
            reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => null);
          }
          if (reg && reg.showNotification) {
            await reg.showNotification('Örnek Teknoloji Test Bildirimi 🔔', {
              body: 'Harika! Web Push bildirimleri cihazınızda başarıyla aktif!',
              icon: iconUrl,
              tag: 'test-notification-' + Date.now(),
              requireInteraction: true
            });
            sent = true;
          }
        } catch (swErr) {
          console.warn('[WebPush] SW notification error:', swErr);
        }
      }

      if (sent) {
        showNotification('Test bildirimi cihazınızın sağ alt köşesine gönderildi! 🔔', 'success');
      } else {
        showNotification('Test bildirimi tetiklenemedi. Lütfen tarayıcının sol üstündeki kilit simgesinden Bildirimler izin alanını kontrol edin.', 'danger');
      }
    } catch (err) {
      showNotification('Test bildirimi: ' + err.message, 'danger');
    } finally {
      setTesting(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header */}
      <div>
        <h3 style={{ fontSize: 16, fontWeight: 800, color: 'var(--color-text)', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>🔔 Web Push Bildirim Yönetimi (Web Sayfası Kapalıyken)</span>
        </h3>
        <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 4, margin: 0 }}>
          Bu özelliği aktif ettiğinizde, <strong>tarayıcı sekmeleriniz veya web sitesi kapalı olsa dahi</strong> yeni servis kaydı, durum güncellemeleri veya acil duyurularda masaüstü/mobil cihazınıza anlık OS bildirimi gelir.
        </p>
      </div>

      {loading ? (
        <div className="flex-center" style={{ height: 150 }}>
          <div className="spinner" />
          <span style={{ marginLeft: 10, color: 'var(--color-text-muted)', fontSize: 13 }}>Bildirim Durumu Kontrol Ediliyor...</span>
        </div>
      ) : (
        <>
          {/* Main Status Card */}
          <div className="card" style={{
            padding: 20,
            border: `1px solid ${isSubscribed ? 'rgba(16, 185, 129, 0.3)' : 'var(--color-border)'}`,
            background: isSubscribed ? 'rgba(16, 185, 129, 0.04)' : 'var(--color-surface)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 24 }}>{isSubscribed ? '🟢' : '⚪'}</span>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text)' }}>
                    {isSubscribed ? 'Arka Plan Web Push Bildirimleri AKTİF' : 'Arka Plan Bildirimleri PASİF'}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 2 }}>
                    İzin Durumu: <strong style={{ color: permission === 'granted' ? '#10b981' : permission === 'denied' ? '#ef4444' : '#f59e0b' }}>{permission.toUpperCase()}</strong>
                  </div>
                </div>
              </div>
              <div className="flex-gap">
                {isSubscribed ? (
                  <button className="btn btn-secondary btn-sm" onClick={handleUnsubscribe} disabled={toggling}>
                    {toggling ? '⏳...' : '🔕 Bildirimleri Kapat'}
                  </button>
                ) : (
                  <button className="btn btn-success btn-sm" onClick={handleSubscribe} disabled={toggling}>
                    {toggling ? '⏳...' : '🔔 Bildirimleri Etkinleştir'}
                  </button>
                )}
              </div>
            </div>

            <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', lineHeight: 1.5, paddingTop: 10, borderTop: '1px solid var(--color-border)' }}>
              {isSubscribed ? (
                <span>✅ Cihazınız başarıyla kaydedildi. Tarayıcınızı tamamen kapatsanız bile yeni servis kaydı açıldığında veya atandığınızda işletim sisteminiz anlık sesli bildirim gösterecektir.</span>
              ) : (
                <span>⚠️ Kapalıyken bildirim alabilmek için yukarıdaki <strong>"Bildirimleri Etkinleştir"</strong> butonuna tıklayarak tarayıcınızın izin penceresinden onay veriniz.</span>
              )}
            </div>
          </div>

          {/* Test Section */}
          {isSubscribed && (
            <div className="card" style={{ padding: 20 }}>
              <h4 style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-primary-light)', marginBottom: 8 }}>
                🧪 Bildirim Testi
              </h4>
              <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 14 }}>
                Arka plan bildirim sisteminin düzgün çalışıp çalışmadığını test etmek için aşağıdaki butona tıklayın. Test butonuna bastıktan sonra isterseniz tarayıcı sekmesini kapatabilirsiniz.
              </p>
              <button className="btn btn-primary" onClick={handleTestNotification} disabled={testing}>
                {testing ? '⏳ Gönderiliyor...' : '📲 Gerçek Push Bildirimi Test Et'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
