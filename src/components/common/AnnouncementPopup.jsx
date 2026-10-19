import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { io } from 'socket.io-client';
import { getApiBase } from '../../utils/apiConfig';
import Modal from './Modal';
import notificationSound from '../../assets/bildirim.mp3';

export default function AnnouncementPopup() {
  const { user } = useAuth();
  const [queue, setQueue] = useState([]);
  const [currentAnn, setCurrentAnn] = useState(null);

  // Aktif duyuruları veritabanından çek
  const fetchActiveAnnouncements = async () => {
    if (!user) return;
    try {
      const res = await window.electronAPI.getActiveAnnouncements(user.username, user.role_name || user.role);
      if (res.success && Array.isArray(res.data)) {
        // Oturum bazında kapatılanları filtrele
        const filtered = res.data.filter(ann => {
          try {
            const dismissedVal = sessionStorage.getItem(`dismissed_ann_${ann.id}`);
            if (dismissedVal) {
              // Eğer günlük ve saatli bir duyuruysa, son kapatma saatinden sonra yeni bir saat dilimi geldi mi kontrol et
              if (ann.frequency === 'daily' && ann.daily_time) {
                const times = ann.daily_time.split(',').map(t => t.trim().slice(0, 5)).filter(Boolean);
                const nowTimeStr = new Date().toLocaleTimeString('tr-TR', { timeZone: 'Europe/Istanbul', hour12: false, hour: '2-digit', minute: '2-digit' });
                const passedTimes = times.filter(t => t <= nowTimeStr);
                if (passedTimes.length > 0) {
                  const latestPassed = passedTimes.sort()[passedTimes.length - 1];
                  if (dismissedVal < latestPassed) {
                    sessionStorage.removeItem(`dismissed_ann_${ann.id}`);
                    return true;
                  }
                }
              }
              return false;
            }
          } catch (e) {}
          return true;
        });
        setQueue(filtered);
      }
    } catch (err) {
      console.error('Aktif duyurular çekilemedi:', err);
    }
  };

  useEffect(() => {
    if (user) {
      fetchActiveAnnouncements();
      const interval = setInterval(() => {
        fetchActiveAnnouncements();
      }, 30000); // Her 30 saniyede bir kontrol et
      return () => clearInterval(interval);
    } else {
      setQueue([]);
      setCurrentAnn(null);
    }
  }, [user]);

  // Socket.io Gerçek zamanlı bildirim dinleyici
  useEffect(() => {
    if (!user) return;

    const socketUrl = getApiBase();
    const isHttps = socketUrl.startsWith('https');

    const socket = io(socketUrl, {
      path: '/socket.io',
      transports: ['polling'],
      secure: isHttps,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 5000,
    });

    socket.on('yeni-duyuru', (data) => {
      // 1. Duyurunun aktiflik kontrolü
      if (!data.is_active) return;

      // 2. Rol hedeflemesi kontrolü
      if (data.target_roles !== 'all') {
        const roles = data.target_roles.split(',').map(r => r.trim().toLowerCase());
        if (!roles.includes(String(user.role_name || user.role || '').toLowerCase())) {
          return;
        }
      }

      // 3. Kullanıcı hedeflemesi kontrolü
      if (data.target_users) {
        const users = data.target_users.split(',').map(u => u.trim().toLowerCase());
        if (!users.includes(String(user.username || '').toLowerCase())) {
          return;
        }
      }

      // 4. Tarih Aralığı Kontrolü
      const todayStr = new Date().toISOString().slice(0, 10);
      if (data.start_date && data.start_date.substring(0, 10) > todayStr) return;
      if (data.end_date && data.end_date.substring(0, 10) < todayStr) return;

      // 5. Günlük saat kontrolü
      if (data.frequency === 'daily' && data.daily_time) {
        const rawTimes = data.daily_time.split(',').map(t => t.trim().slice(0, 5)).filter(Boolean);
        if (rawTimes.length > 0) {
          const nowTimeStr = new Date().toLocaleTimeString('tr-TR', { timeZone: 'Europe/Istanbul', hour12: false, hour: '2-digit', minute: '2-digit' });
          if (!rawTimes.some(t => nowTimeStr >= t)) return;
        }
      }

      // 6. Oturum kapatma kontrolü (yeni fırlatıldıysa oturum engelini kaldır)
      try {
        sessionStorage.removeItem(`dismissed_ann_${data.id}`);
      } catch (e) {}

      // Bildirim sesi çal
      try {
        const audio = new Audio(notificationSound);
        audio.volume = 0.5;
        audio.play().catch(() => {});
      } catch (e) {}

      // Kuyruğa ekle
      setQueue(prev => {
        if (prev.some(ann => ann.id === data.id) || (currentAnn && currentAnn.id === data.id)) {
          return prev;
        }
        return [...prev, data];
      });
    });

    return () => {
      socket.disconnect();
    };
  }, [user, currentAnn]);

  // Kuyruktaki ilk elemanı ekrana ver
  useEffect(() => {
    if (queue.length > 0 && !currentAnn) {
      setCurrentAnn(queue[0]);
    }
  }, [queue, currentAnn]);

  const handleDismiss = async () => {
    if (!currentAnn) return;

    const ann = currentAnn;
    setCurrentAnn(null);
    setQueue(prev => prev.filter(item => item.id !== ann.id));
    
    // Oturum (sessionStorage) düzeyinde kapatıldı olarak işaretle
    try {
      if (ann.frequency === 'daily' && ann.daily_time) {
        const nowTimeStr = new Date().toLocaleTimeString('tr-TR', { timeZone: 'Europe/Istanbul', hour12: false, hour: '2-digit', minute: '2-digit' });
        sessionStorage.setItem(`dismissed_ann_${ann.id}`, nowTimeStr);
      } else {
        sessionStorage.setItem(`dismissed_ann_${ann.id}`, 'true');
      }
    } catch (e) {}

    // Eğer tek seferlik ya da her günlük ise veritabanına okundu olarak kaydet
    if (ann.frequency === 'once' || ann.frequency === 'daily') {
      try {
        await window.electronAPI.markAnnouncementRead(ann.id, user.username);
      } catch (err) {
        console.error('Okundu işaretleme hatası:', err);
      }
    }
  };

  const [btnHover, setBtnHover] = useState(false);

  if (!currentAnn) return null;

  return (
    <>
      <style>{`
        @keyframes announcementPopIn {
          0% { transform: scale(0.9) translateY(20px); opacity: 0; }
          100% { transform: scale(1) translateY(0); opacity: 1; }
        }
        @keyframes pulseGlow {
          0% { box-shadow: 0 0 0 0 var(--color-primary-bg); }
          70% { box-shadow: 0 0 0 12px transparent; }
          100% { box-shadow: 0 0 0 0 transparent; }
        }
        .announcement-glow-ring {
          animation: pulseGlow 2s infinite;
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.02);
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: var(--color-border);
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: var(--color-primary);
        }
      `}</style>

      <div 
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 99999,
          background: 'var(--modal-overlay, rgba(10, 15, 30, 0.8))',
          backdropFilter: 'blur(12px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px'
        }}
      >
        <div 
          style={{
            background: 'var(--modal-bg, var(--color-surface))',
            border: '1px solid var(--color-border)',
            boxShadow: 'var(--modal-shadow, 0 25px 60px rgba(0, 0, 0, 0.6))',
            borderRadius: '16px',
            width: 'min(480px, calc(100vw - 40px))',
            position: 'relative',
            overflow: 'hidden',
            padding: '32px',
            textAlign: 'center',
            animation: 'announcementPopIn 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) forwards'
          }}
        >
          {/* Top Decorative Accent Line */}
          <div 
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: '4px',
              background: 'linear-gradient(90deg, var(--color-primary), var(--color-accent), var(--color-primary))'
            }}
          />

          {/* Icon Header */}
          <div 
            className="announcement-glow-ring"
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              background: 'var(--color-primary-bg)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 20px',
              border: '1px solid var(--color-primary)'
            }}
          >
            <span style={{ fontSize: '28px', transform: 'rotate(-10deg)', display: 'inline-block' }}>📢</span>
          </div>

          {/* Announcement Title */}
          <h3 
            style={{
              margin: '0 0 6px 0',
              fontSize: '20px',
              fontWeight: '800',
              color: 'var(--color-text)',
              letterSpacing: '-0.5px'
            }}
          >
            {currentAnn.title}
          </h3>

          <div style={{ fontSize: '11px', color: 'var(--color-primary)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '20px' }}>
            Yeni Duyuru / Bildirim
          </div>

          {/* Content Body */}
          <div 
            className="custom-scrollbar"
            style={{
              background: 'var(--color-surface-alt)',
              borderRadius: '12px',
              border: '1px solid var(--color-border)',
              padding: '18px 20px',
              color: 'var(--color-text)',
              fontSize: '13.5px',
              lineHeight: '1.6',
              whiteSpace: 'pre-wrap',
              maxHeight: '220px',
              overflowY: 'auto',
              marginBottom: '26px',
              textAlign: 'left',
              boxShadow: 'inset 0 2px 8px rgba(0, 0, 0, 0.15)'
            }}
          >
            {currentAnn.content}
          </div>

          {/* Actions */}
          <button 
            style={{
              width: '100%',
              background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-hover) 100%)',
              color: '#ffffff',
              border: 'none',
              borderRadius: '10px',
              padding: '12px 24px',
              fontSize: '14px',
              fontWeight: '700',
              cursor: 'pointer',
              boxShadow: btnHover ? '0 6px 22px var(--color-primary)' : '0 4px 14px var(--color-primary-bg)',
              transition: 'all 0.2s ease',
              transform: btnHover ? 'translateY(-1px)' : 'none',
              filter: btnHover ? 'brightness(1.1)' : 'none'
            }}
            onMouseEnter={() => setBtnHover(true)}
            onMouseLeave={() => setBtnHover(false)}
            onClick={handleDismiss}
          >
            Anladım, Tamam
          </button>
        </div>
      </div>
    </>
  );
}
