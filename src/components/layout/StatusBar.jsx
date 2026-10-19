import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';

function useClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  return now;
}

export default function StatusBar({ notification }) {
  const { user } = useAuth();
  const now = useClock();
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const timeStr = now.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const dateStr = now.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });

  return (
    <div style={styles.bar} id="statusbar">
      <span style={{ display: 'flex', alignItems: 'center', minWidth: 0, overflow: 'hidden' }}>
        {notification ? (
          <span style={{
            ...styles.notif,
            ...(notification.type === 'danger' || notification.type === 'error'
              ? styles.notifDanger
              : notification.type === 'success'
              ? styles.notifSuccess
              : notification.type === 'warning'
              ? styles.notifWarning
              : styles.notifInfo)
          }}>
            {notification.type === 'success' ? '✓ ' : notification.type === 'danger' || notification.type === 'error' ? '✕ ' : '● '}
            {notification.message}
          </span>
        ) : (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#34d399', boxShadow: '0 0 6px #34d399', flexShrink: 0 }} />
            <span style={{ opacity: 0.8, fontSize: 11 }}>{isMobile ? 'Aktif' : 'Sistem çalışıyor'}</span>
          </span>
        )}
      </span>

      <span style={styles.right}>
        <span style={{ ...styles.item, opacity: 0.85 }}>
          {isMobile ? '' : 'Created by '}<strong style={{ color: 'var(--color-primary, #60a5fa)' }}>Bitrox</strong>
        </span>
        {!isMobile && user?.full_name && (
          <>
            <span style={styles.sep}>|</span>
            <span style={{ ...styles.item, maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user.full_name}
            </span>
          </>
        )}
        <span style={styles.sep}>|</span>
        <span style={styles.item}>
          ⏰ {isMobile ? timeStr : `${dateStr} ${timeStr}`}
        </span>
      </span>
    </div>
  );
}

const styles = {
  bar: {
    height: 'var(--statusbar-height, 26px)', background: 'var(--statusbar-bg, #0b1120)',
    color: 'var(--statusbar-text, #94a3b8)', fontSize: 11,
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '0 10px', flexShrink: 0,
    borderTop: '1px solid rgba(255,255,255,0.06)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
  },
  right: { display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 },
  item: { fontSize: 11, whiteSpace: 'nowrap' },
  sep: { opacity: 0.3 },
  notif: { fontWeight: 600, padding: '2px 10px', borderRadius: 999, background: 'rgba(255,255,255,0.06)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden', maxWidth: '70vw' },
  notifInfo:    { color: '#7dd3fc' },
  notifSuccess: { color: '#86efac' },
  notifDanger:  { color: '#fca5a5' },
  notifWarning: { color: '#fcd34d' },
};