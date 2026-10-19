import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { getApiBase } from '../utils/apiConfig';

import { apiGet } from '../utils/apiFetch';

const AppContext = createContext(null);
const DEFAULT_TABS = [{ id: 'dashboard', label: 'Dashboard', icon: '🏠', module: 'Dashboard', closable: false }];

export function AppProvider({ children }) {
  const [tabs, setTabs] = useState(DEFAULT_TABS);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [notifications, setNotifications] = useState([]);
  const [theme, setThemeState] = useState(localStorage.getItem('theme') || 'dark');
  const [effectsEnabled, setEffectsEnabledState] = useState(localStorage.getItem('theme_effects_enabled') !== 'false');
  const [customWallpaper, setCustomWallpaperState] = useState(localStorage.getItem('custom_wallpaper') || '');
  const [wallpaperBlur, setWallpaperBlurState] = useState(Number(localStorage.getItem('wallpaper_blur') || 6));
  const [wallpaperOpacity, setWallpaperOpacityState] = useState(Number(localStorage.getItem('wallpaper_opacity') || 0.85));
  const [themeModalOpen, setThemeModalOpen] = useState(false);

  const setTheme = useCallback((newTheme) => {
    setThemeState(newTheme);
    localStorage.setItem('theme', newTheme);
  }, []);

  const setEffectsEnabled = useCallback((val) => {
    setEffectsEnabledState(val);
    localStorage.setItem('theme_effects_enabled', String(val));
  }, []);

  const setCustomWallpaper = useCallback((val) => {
    setCustomWallpaperState(val);
    localStorage.setItem('custom_wallpaper', val);
  }, []);

  const setWallpaperBlur = useCallback((val) => {
    setWallpaperBlurState(val);
    localStorage.setItem('wallpaper_blur', String(val));
  }, []);

  const setWallpaperOpacity = useCallback((val) => {
    setWallpaperOpacityState(val);
    localStorage.setItem('wallpaper_opacity', String(val));
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState(prev => {
      const next = prev === 'light' ? 'dark' : 'light';
      localStorage.setItem('theme', next);
      return next;
    });
  }, []);
  const [settings, setSettings] = useState(() => {
    try {
      const cached = localStorage.getItem('app_settings');
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (e) {}
    return {
      brand_title: 'Örnek Teknoloji A.Ş.',
      brand_subtitle: 'Servis Takip',
    };
  });
  const [refreshToggle, setRefreshToggle] = useState(0);
  const [tableRefreshVersions, setTableRefreshVersions] = useState({});
  const [syncStatus, setSyncStatus] = useState({ running: false, lastTables: [], lastAt: null });
  const snipeSyncRef = useRef({ running: false });

  const triggerRefresh = useCallback(() => {
    setRefreshToggle(prev => prev + 1);
  }, []);

  const triggerTableRefresh = useCallback((tables = []) => {
    const normalized = Array.from(new Set((tables || []).filter(Boolean)));
    if (normalized.length === 0) return;
    setTableRefreshVersions(prev => {
      const next = { ...prev };
      normalized.forEach(table => {
        next[table] = (next[table] || 0) + 1;
      });
      return next;
    });
    setSyncStatus({ running: false, lastTables: normalized, lastAt: new Date().toISOString() });
  }, []);

  const loadSettings = useCallback(async () => {
    const s = {};
    try {
      if (window.electronAPI?.query) {
        const res = await window.electronAPI.query('SELECT * FROM settings', []);
        if (res.success && Array.isArray(res.data)) {
          res.data.forEach(item => { s[item.key] = item.value; });
        }
      } else {
        const res = await apiGet('/api/settings');
        if (res?.success && Array.isArray(res?.data)) {
          res.data.forEach(item => { s[item.key] = item.value; });
        }
      }
    } catch (e) {
      console.error('Settings query failed in AppContext:', e);
    }

    if (Object.keys(s).length > 0) {
      setSettings(prev => ({ ...prev, ...s }));
      try {
        localStorage.setItem('app_settings', JSON.stringify(s));
      } catch (e) {}
    }
    if (s.theme && !localStorage.getItem('theme')) {
      setTheme(s.theme);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  useEffect(() => {
    const socketUrl = getApiBase();
    const isHttps = socketUrl.startsWith('https');
    const socket = io(socketUrl, {
      path: '/socket.io',
      transports: ['polling'],
      secure: isHttps,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 5000,
    });

    socket.on('veritabanini-yenile', (data) => {
      if (data && Array.isArray(data.changedTables)) {
        triggerTableRefresh(data.changedTables);
      }
    });

    socket.on('veriler-guncellendi', () => {
      triggerRefresh();
    });

    return () => {
      socket.disconnect();
    };
  }, [triggerTableRefresh, triggerRefresh]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  // MySQL sync polling removed — web modunda sunucu zaten doğrudan MySQL kullanıyor.


  // Snipe-IT senkronizasyonu artık istemci tarayıcılar tarafından arka planda otomatik tetiklenmez.
  // Manuel butonlardan veya sunucu tarafından cooldown ile güvenli şekilde çalıştırılır.

  const [targetTicketToOpen, setTargetTicketToOpen] = useState(null);

  const openTab = useCallback((tab) => {
    const payloadData = tab.tabData || tab.data || (tab.presetFilter ? { presetFilter: tab.presetFilter, title: tab.title } : null);
    setTabs(prev => {
      const idx = prev.findIndex(t => t.id === tab.id);
      if (idx !== -1) {
        const copy = [...prev];
        copy[idx] = { 
          ...copy[idx], 
          ...tab,
          data: payloadData,
          tabData: payloadData
        };
        return copy;
      }
      return [...prev, { ...tab, data: payloadData, tabData: payloadData }];
    });
    if (tab.initialTicketNo || tab.initialTicketId) {
      setTargetTicketToOpen({ id: tab.initialTicketId, ticket_no: tab.initialTicketNo, timestamp: Date.now() });
    }
    if (payloadData) {
      window.dispatchEvent(new CustomEvent('service-tracker-preset', {
        detail: {
          targetTab: tab.id,
          ...payloadData,
          timestamp: payloadData.timestamp || Date.now()
        }
      }));
    }
    setActiveTab(tab.id);
  }, []);

  // Fixed: use functional update to avoid stale closure
  const closeTab = useCallback((tabId) => {
    setTabs(prev => {
      const idx = prev.findIndex(t => t.id === tabId);
      const newTabs = prev.filter(t => t.id !== tabId);
      if (newTabs.length > 0) {
        setActiveTab(curr => {
          if (curr === tabId) {
            return newTabs[Math.max(0, idx - 1)].id;
          }
          return curr;
        });
      }
      return newTabs;
    });
  }, []);

  const resetWorkspace = useCallback(() => {
    setTabs(DEFAULT_TABS);
    setActiveTab('dashboard');
  }, []);

  const showNotification = useCallback((message, type = 'info', duration = 3500) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const normalizedType = type === 'error' ? 'danger' : type;
    setNotifications(prev => [...prev, { id, message, type: normalizedType }]);
    const timer = setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, duration);
    return () => clearTimeout(timer);
  }, []);

  const removeNotification = useCallback((id) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  // Keep legacy single notification for StatusBar compatibility
  const notification = notifications.length > 0 ? notifications[notifications.length - 1] : null;

  return (
    <AppContext.Provider value={{ 
      tabs, activeTab, openTab, closeTab, setActiveTab, 
      setTabs, resetWorkspace,
      notification, notifications, showNotification, removeNotification,
      theme, toggleTheme, setTheme,
      effectsEnabled, setEffectsEnabled,
      customWallpaper, setCustomWallpaper,
      wallpaperBlur, setWallpaperBlur,
      wallpaperOpacity, setWallpaperOpacity,
      themeModalOpen, setThemeModalOpen,
      openThemeModal: () => setThemeModalOpen(true),
      closeThemeModal: () => setThemeModalOpen(false),
      settings, reloadSettings: loadSettings,
      refreshToggle, triggerRefresh,
      tableRefreshVersions, triggerTableRefresh, syncStatus,
      refreshData: tableRefreshVersions,
      targetTicketToOpen, setTargetTicketToOpen
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
