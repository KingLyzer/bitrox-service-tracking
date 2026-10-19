import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useApp } from '../../context/AppContext';
import { enableWebPushNotifications } from '../../utils/webPushHelper';

export default function PushPermissionPrompt() {
  const { user } = useAuth();
  const { showNotification } = useApp();
  const [showPrompt, setShowPrompt] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) return;

    if (typeof window !== 'undefined' && 'Notification' in window) {
      const dismissed = sessionStorage.getItem('push_prompt_dismissed');
      if (Notification.permission === 'default' && !dismissed) {
        const timer = setTimeout(() => setShowPrompt(true), 1500);
        return () => clearTimeout(timer);
      }
    }
  }, [user]);

  if (!showPrompt) return null;

  const handleEnable = async () => {
    setLoading(true);
    try {
      const success = await enableWebPushNotifications(user);
      if (success) {
        showNotification('Arka plan Web Push bildirimleri başarıyla etkinleştirildi! 🔔', 'success');
      } else {
        showNotification('Bildirim izni alınamadı veya reddedildi.', 'warning');
      }
    } catch (err) {
      console.error('Push error:', err);
    } finally {
      setLoading(false);
      setShowPrompt(false);
    }
  };

  const handleDismiss = () => {
    sessionStorage.setItem('push_prompt_dismissed', '1');
    setShowPrompt(false);
  };

  return (
    <div style={{
      position: 'fixed',
      top: 20,
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 10000,
      background: 'var(--color-surface)',
      border: '1px solid var(--color-primary)',
      boxShadow: '0 8px 30px rgba(0,0,0,0.4)',
      borderRadius: 12,
      padding: '14px 20px',
      display: 'flex',
      alignItems: 'center',
      gap: 16,
      maxWidth: 560,
      width: '90%'
    }}>
      <div style={{
        fontSize: 26,
        background: 'rgba(99, 102, 241, 0.15)',
        width: 44,
        height: 44,
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0
      }}>
        🔔
      </div>

      <div style={{ flex: 1 }}>
        <h4 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: 'var(--color-text)' }}>
          Bildirimleri Etkinleştirin
        </h4>
        <p style={{ margin: '3px 0 0 0', fontSize: 12, color: 'var(--color-text-secondary)', lineHeight: 1.4 }}>
          Yeni servis kayıtları, mesajlar ve duyurulardan sekmeniz kapalı olsa dahi sesli haberiniz olsun.
        </p>
      </div>

      <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
        <button
          onClick={handleEnable}
          disabled={loading}
          style={{
            background: 'var(--color-primary)',
            color: 'white',
            border: 'none',
            borderRadius: 8,
            padding: '8px 14px',
            fontSize: 12,
            fontWeight: 600,
            cursor: loading ? 'default' : 'pointer',
            opacity: loading ? 0.7 : 1
          }}
        >
          {loading ? 'Açılıyor...' : '🔔 İzin Ver'}
        </button>
        <button
          onClick={handleDismiss}
          style={{
            background: 'transparent',
            color: 'var(--color-text-muted)',
            border: '1px solid var(--color-border)',
            borderRadius: 8,
            padding: '8px 10px',
            fontSize: 12,
            cursor: 'pointer'
          }}
        >
          Daha Sonra
        </button>
      </div>
    </div>
  );
}
