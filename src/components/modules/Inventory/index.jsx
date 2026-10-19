import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { AgGridReact } from 'ag-grid-react';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-quartz.css';
import { useAuth } from '../../../context/AuthContext';
import { useApp } from '../../../context/AppContext';
import AssetDetailModal from './AssetDetailModal';
import { exportInventoryCsv, exportInventoryExcel } from './exportHelpers';

export const getCategoryBadgeConfig = (category) => {
  const cat = String(category || '').trim();
  const lower = cat.toLowerCase();
  let icon = '📦';
  let color = '#94a3b8';
  let bg = 'rgba(148, 163, 184, 0.1)';
  let border = 'rgba(148, 163, 184, 0.25)';

  if (lower.includes('mini pc') || lower.includes('masaüstü') || lower.includes('kasa') || lower.includes('bilgisayar') || lower.includes('desktop')) {
    icon = '🖥️';
    color = '#38bdf8';
    bg = 'rgba(14, 165, 233, 0.12)';
    border = 'rgba(14, 165, 233, 0.3)';
  } else if (lower.includes('laptop') || lower.includes('dizüstü') || lower.includes('notebook')) {
    icon = '💻';
    color = '#818cf8';
    bg = 'rgba(99, 102, 241, 0.12)';
    border = 'rgba(99, 102, 241, 0.3)';
  } else if (lower.includes('yazıcı') || lower.includes('printer')) {
    icon = '🖨️';
    color = '#fbbf24';
    bg = 'rgba(245, 158, 11, 0.12)';
    border = 'rgba(245, 158, 11, 0.3)';
  } else if (lower.includes('barkod') || lower.includes('okuyucu') || lower.includes('scanner')) {
    icon = '🏷️';
    color = '#fb923c';
    bg = 'rgba(249, 115, 22, 0.12)';
    border = 'rgba(249, 115, 22, 0.3)';
  } else if (lower.includes('monitör') || lower.includes('ekran') || lower.includes('display')) {
    icon = '🖥️';
    color = '#a78bfa';
    bg = 'rgba(167, 139, 250, 0.12)';
    border = 'rgba(167, 139, 250, 0.3)';
  } else if (lower.includes('telefon') || lower.includes('tablet') || lower.includes('mobil')) {
    icon = '📱';
    color = '#34d399';
    bg = 'rgba(52, 211, 153, 0.12)';
    border = 'rgba(52, 211, 153, 0.3)';
  } else if (lower.includes('sunucu') || lower.includes('server')) {
    icon = '🗄️';
    color = '#e879f9';
    bg = 'rgba(232, 121, 249, 0.12)';
    border = 'rgba(232, 121, 249, 0.3)';
  } else if (lower.includes('ağ') || lower.includes('network') || lower.includes('switch') || lower.includes('modem')) {
    icon = '🌐';
    color = '#2dd4bf';
    bg = 'rgba(45, 212, 191, 0.12)';
    border = 'rgba(45, 212, 191, 0.3)';
  }

  return { icon, label: cat || 'Kategorisiz', color, bg, border };
};

export const getAssetStatusBadgeConfig = (statusName, assignedUser) => {
  const name = String(statusName || '').trim();
  const lower = name.toLowerCase();

  if (assignedUser || lower.includes('atanmış') || lower.includes('kullanıcı')) {
    return {
      label: name || 'Kullanıcı Atanmış',
      icon: '👤',
      dot: '#38bdf8',
      color: '#60a5fa',
      bg: 'rgba(59, 130, 246, 0.12)',
      border: 'rgba(59, 130, 246, 0.3)'
    };
  }
  if (lower.includes('hazır') || lower.includes('depo') || lower.includes('sıfır') || lower.includes('boşta')) {
    return {
      label: name || 'Dağıtıma Hazır',
      icon: '📦',
      dot: '#22c55e',
      color: '#4ade80',
      bg: 'rgba(34, 197, 94, 0.12)',
      border: 'rgba(34, 197, 94, 0.3)'
    };
  }
  if (lower.includes('arıza') || lower.includes('tamir') || lower.includes('servis')) {
    return {
      label: name || 'Serviste / Arızalı',
      icon: '⚠️',
      dot: '#f59e0b',
      color: '#fbbf24',
      bg: 'rgba(245, 158, 11, 0.12)',
      border: 'rgba(245, 158, 11, 0.3)'
    };
  }
  if (lower.includes('hurda') || lower.includes('pert') || lower.includes('dışı') || lower.includes('iptal')) {
    return {
      label: name || 'Kullanım Dışı',
      icon: '🚫',
      dot: '#ef4444',
      color: '#f87171',
      bg: 'rgba(239, 68, 68, 0.12)',
      border: 'rgba(239, 68, 68, 0.3)'
    };
  }

  return {
    label: name || 'Durum Belirtilmedi',
    icon: '▫️',
    dot: '#94a3b8',
    color: '#94a3b8',
    bg: 'rgba(148, 163, 184, 0.12)',
    border: 'rgba(148, 163, 184, 0.25)'
  };
};

export default function Inventory() {
  const { user: currentUser, hasPermission } = useAuth();
  const { showNotification, theme, triggerRefresh } = useApp();

  const isRestricted = useMemo(() => {
    if (!currentUser) return false;
    const roleId = Number(currentUser.role_id);
    const roleName = String(currentUser.role_name || currentUser.role || '').toLowerCase();
    if (roleId === 1 || roleName === 'admin' || roleName === 'yönetici' || currentUser.username === 'admin') return false;
    return !!(currentUser.allowed_locations && currentUser.allowed_locations.trim() && currentUser.allowed_locations.trim().toLowerCase() !== 'all');
  }, [currentUser]);

  const allowedLocationsList = useMemo(() => {
    if (!isRestricted || !currentUser?.allowed_locations) return [];
    return currentUser.allowed_locations.split(',').map(s => s.trim()).filter(Boolean);
  }, [isRestricted, currentUser]);

  const [assets, setAssets] = useState(() => {
    try {
      const saved = localStorage.getItem('cached_inventory_assets');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [stats, setStats] = useState({ total: 0, assigned: 0, ready: 0, categories: [], locations: [], statuses: [] });
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedLocation, setSelectedLocation] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [activeAsset, setActiveAsset] = useState(null);
  const [viewMode, setViewMode] = useState(window.innerWidth < 768 ? 'cards' : 'table');

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) {
        setViewMode('cards');
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      let rawAssets = [];
      let rawStats = null;
      const userParam = currentUser?.id ? `user_id=${currentUser.id}` : '';

      // 1. Try dedicated inventory endpoint
      try {
        const [statsRes, assetsRes] = await Promise.all([
          window.electronAPI.getInventoryStats ? window.electronAPI.getInventoryStats(userParam).catch(() => ({ success: false })) : Promise.resolve({ success: false }),
          window.electronAPI.getInventoryAssets ? window.electronAPI.getInventoryAssets(userParam).catch(() => ({ success: false })) : Promise.resolve({ success: false })
        ]);
        if (assetsRes?.success && Array.isArray(assetsRes.data) && assetsRes.data.length > 0) {
          rawAssets = assetsRes.data;
        }
        if (statsRes?.success && statsRes.stats) {
          rawStats = statsRes.stats;
        }
      } catch (e) {}

      // 2. Fallback to /api/cached/assets
      if (!rawAssets || rawAssets.length === 0) {
        try {
          const cachedRes = await fetch(`${window.API_BASE}/api/cached/assets`).then(r => r.json()).catch(() => null);
          if (cachedRes?.success && Array.isArray(cachedRes.data)) {
            rawAssets = cachedRes.data;
          }
        } catch (e) {}
      }

      // 3. Fallback to direct query
      if (!rawAssets || rawAssets.length === 0) {
        if (window.electronAPI?.query) {
          const qRes = await window.electronAPI.query('SELECT * FROM cached_assets ORDER BY id DESC').catch(() => null);
          if (qRes?.success && Array.isArray(qRes.data)) {
            rawAssets = qRes.data;
          }
        }
      }

      setAssets(rawAssets);
      if (rawAssets && rawAssets.length > 0) {
        try { localStorage.setItem('cached_inventory_assets', JSON.stringify(rawAssets)); } catch {}
      }

      // Compute stats automatically if rawStats was not returned by server
      if (rawStats && rawStats.total > 0) {
        setStats(rawStats);
      } else {
        const total = rawAssets.length;
        const assigned = rawAssets.filter(i => i.assigned_to_user_name || (i.status_name && (i.status_name.includes('Atanmış') || i.status_name.includes('Kullanıcı')))).length;
        const ready = Math.max(0, total - assigned);

        const catMap = {};
        const locMap = {};
        const statusMap = {};
        rawAssets.forEach(i => {
          if (i.category_name) catMap[i.category_name] = (catMap[i.category_name] || 0) + 1;
          if (i.location_name) locMap[i.location_name] = (locMap[i.location_name] || 0) + 1;
          if (i.status_name) statusMap[i.status_name] = (statusMap[i.status_name] || 0) + 1;
        });

        setStats({
          total,
          assigned,
          ready,
          categories: Object.entries(catMap).map(([category_name, count]) => ({ category_name, count })).sort((a, b) => b.count - a.count),
          locations: Object.entries(locMap).map(([location_name, count]) => ({ location_name, count })).sort((a, b) => b.count - a.count),
          statuses: Object.entries(statusMap).map(([status_name, count]) => ({ status_name, count })).sort((a, b) => b.count - a.count),
        });
      }
    } catch (err) {
      showNotification('Envanter yüklenemedi: ' + err.message, 'danger');
    } finally {
      setLoading(false);
    }
  }, [showNotification]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSync = async () => {
    setSyncing(true);
    showNotification('Snipe-IT ile senkronizasyon başlatıldı...', 'info');
    try {
      const res = await window.electronAPI.snipeitSync();
      if (res?.success) {
        showNotification('Snipe-IT verileri başarıyla senkronize edildi.', 'success');
        triggerRefresh();
        loadData();
      } else {
        showNotification('Senkronizasyon hatası: ' + (res?.message || ''), 'danger');
      }
    } catch (e) {
      showNotification('Hata: ' + e.message, 'danger');
    } finally {
      setSyncing(false);
    }
  };

  // Base assets scoped to user's allowed locations (or all if unrestricted)
  const scopedAssets = useMemo(() => {
    if (!assets || assets.length === 0) return [];
    if (allowedLocationsList.length > 0) {
      return assets.filter(item => allowedLocationsList.includes(item.location_name));
    }
    return assets;
  }, [assets, allowedLocationsList]);

  // Derived stats, categories, and statuses strictly from scopedAssets
  const { displayStats, displayCategories, displayLocations, displayStatuses } = useMemo(() => {
    const total = scopedAssets.length;
    const assigned = scopedAssets.filter(i => i.assigned_to_user_name || (i.status_name && (i.status_name.includes('Atanmış') || i.status_name.includes('Kullanıcı')))).length;
    const ready = Math.max(0, total - assigned);

    const catMap = {};
    const locMap = {};
    const statusMap = {};
    scopedAssets.forEach(i => {
      if (i.category_name) catMap[i.category_name] = (catMap[i.category_name] || 0) + 1;
      if (i.location_name) locMap[i.location_name] = (locMap[i.location_name] || 0) + 1;
      if (i.status_name) statusMap[i.status_name] = (statusMap[i.status_name] || 0) + 1;
    });

    const displayCategories = Object.entries(catMap).map(([category_name, count]) => ({ category_name, count })).sort((a, b) => b.count - a.count);
    const displayLocations = Object.entries(locMap).map(([location_name, count]) => ({ location_name, count })).sort((a, b) => b.count - a.count);
    const displayStatuses = Object.entries(statusMap).map(([status_name, count]) => ({ status_name, count })).sort((a, b) => b.count - a.count);

    return {
      displayStats: {
        total,
        assigned,
        ready,
        categories: displayCategories,
        locations: displayLocations,
        statuses: displayStatuses
      },
      displayCategories,
      displayLocations,
      displayStatuses
    };
  }, [scopedAssets]);

  const filteredAssets = useMemo(() => {
    return scopedAssets.filter(item => {
      if (selectedCategory !== 'all' && item.category_name !== selectedCategory) return false;
      if (selectedLocation !== 'all' && item.location_name !== selectedLocation) return false;
      if (selectedStatus !== 'all' && item.status_name !== selectedStatus) return false;

      if (search && search.trim()) {
        const q = search.toLowerCase();
        const tag = (item.asset_tag || '').toLowerCase();
        const name = (item.name || '').toLowerCase();
        const serial = (item.serial || '').toLowerCase();
        const model = (item.model_name || '').toLowerCase();
        const user = (item.assigned_to_user_name || '').toLowerCase();
        const loc = (item.location_name || '').toLowerCase();
        const cat = (item.category_name || '').toLowerCase();
        if (!tag.includes(q) && !name.includes(q) && !serial.includes(q) && !model.includes(q) && !user.includes(q) && !loc.includes(q) && !cat.includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [scopedAssets, selectedCategory, selectedLocation, selectedStatus, search]);

  const columnDefs = useMemo(() => [
    {
      headerName: '#',
      valueGetter: 'node.rowIndex + 1',
      width: 50,
      minWidth: 45,
      maxWidth: 55,
      pinned: 'left',
      cellStyle: { textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '11px', display: 'flex', alignItems: 'center', justifyContent: 'center' }
    },
    {
      headerName: 'Envanter Tag (Barkod)',
      field: 'asset_tag',
      minWidth: 150,
      flex: 1.2,
      pinned: 'left',
      cellRenderer: p => (
        <div
          onClick={() => setActiveAsset(p.data)}
          title="Demirbaş Detayını Gör"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            fontWeight: 700,
            fontFamily: 'monospace',
            fontSize: 12,
            color: 'var(--color-primary-light, #60a5fa)',
            cursor: 'pointer',
            padding: '2px 6px',
            borderRadius: 6,
            transition: 'background 0.15s ease'
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(96, 165, 250, 0.12)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
        >
          <span style={{ fontSize: 13 }}>💻</span>
          <span style={{ textDecoration: 'underline', textUnderlineOffset: 3, textDecorationColor: 'rgba(96, 165, 250, 0.4)' }}>{p.value}</span>
        </div>
      )
    },
    {
      headerName: 'Cihaz Tanımı',
      field: 'name',
      minWidth: 130,
      flex: 1,
      cellStyle: { fontWeight: 600, color: 'var(--color-text)' }
    },
    {
      headerName: 'Kategori',
      field: 'category_name',
      minWidth: 130,
      flex: 1,
      cellRenderer: p => {
        const cfg = getCategoryBadgeConfig(p.value);
        return (
          <div style={{ display: 'flex', alignItems: 'center', height: '100%' }}>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              padding: '3px 8px',
              borderRadius: 6,
              fontSize: 11,
              fontWeight: 600,
              background: cfg.bg,
              border: `1px solid ${cfg.border}`,
              color: cfg.color,
              lineHeight: 1.3
            }}>
              <span style={{ fontSize: 11 }}>{cfg.icon}</span>
              <span>{cfg.label}</span>
            </span>
          </div>
        );
      }
    },
    {
      headerName: 'Model & Marka',
      field: 'model_name',
      minWidth: 165,
      flex: 1.5,
      cellRenderer: p => (
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', height: '100%' }}>
          <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>{p.value || '—'}</span>
          {p.data?.manufacturer_name && (
            <span style={{
              fontSize: 10,
              padding: '1px 5px',
              borderRadius: 4,
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid var(--color-border)',
              color: 'var(--color-text-secondary)',
              fontWeight: 500
            }}>
              {p.data.manufacturer_name}
            </span>
          )}
        </div>
      )
    },
    {
      headerName: 'Seri Numarası',
      field: 'serial',
      minWidth: 135,
      flex: 1.2,
      cellRenderer: p => p.value ? (
        <div style={{ display: 'flex', alignItems: 'center', height: '100%' }}>
          <span style={{
            fontFamily: 'monospace',
            fontSize: 11,
            color: 'var(--color-text-secondary)',
            background: 'var(--color-surface-alt)',
            padding: '2px 6px',
            borderRadius: 4,
            border: '1px solid var(--color-border)'
          }}>
            {p.value}
          </span>
        </div>
      ) : <span style={{ color: 'var(--color-text-muted)' }}>—</span>
    },
    {
      headerName: 'Zimmetli Personel',
      field: 'assigned_to_user_name',
      minWidth: 180,
      flex: 1.6,
      cellRenderer: p => {
        if (!p.value) {
          return (
            <div style={{ display: 'flex', alignItems: 'center', height: '100%' }}>
              <span style={{ color: 'var(--color-text-muted)', fontSize: 11.5, opacity: 0.7 }}>
                — Boşta (Atanmamış)
              </span>
            </div>
          );
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, height: '100%' }}>
            <span style={{ fontSize: 13 }}>👤</span>
            <span style={{ fontWeight: 600, color: 'var(--color-text)', fontSize: 12 }}>{p.value}</span>
          </div>
        );
      }
    },
    {
      headerName: 'Lokasyon / Birim',
      field: 'location_name',
      minWidth: 125,
      flex: 1,
      cellRenderer: p => p.value ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11.5, color: 'var(--color-text-secondary)', height: '100%' }}>
          <span style={{ color: '#ef4444', fontSize: 12 }}>📍</span>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 500 }}>{p.value}</span>
        </div>
      ) : <span style={{ color: 'var(--color-text-muted)' }}>—</span>
    },
    {
      headerName: 'Durum',
      field: 'status_name',
      minWidth: 140,
      flex: 1.1,
      cellRenderer: p => {
        const cfg = getAssetStatusBadgeConfig(p.value, p.data?.assigned_to_user_name);
        return (
          <div style={{ display: 'flex', alignItems: 'center', height: '100%' }}>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '3px 9px',
              borderRadius: 6,
              fontSize: 11,
              fontWeight: 600,
              background: cfg.bg,
              border: `1px solid ${cfg.border}`,
              color: cfg.color,
              lineHeight: 1.3
            }}>
              <span style={{ fontSize: 10 }}>{cfg.icon}</span>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: cfg.dot }} />
              <span>{cfg.label}</span>
            </span>
          </div>
        );
      }
    },
    {
      headerName: 'İşlem',
      width: 90,
      minWidth: 85,
      maxWidth: 95,
      pinned: 'right',
      cellRenderer: p => (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
          <button
            onClick={() => setActiveAsset(p.data)}
            title="Demirbaş Detayını Gör"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 4,
              padding: '3px 10px',
              borderRadius: 6,
              fontSize: 11,
              fontWeight: 600,
              background: 'rgba(59, 130, 246, 0.12)',
              border: '1px solid rgba(59, 130, 246, 0.35)',
              color: '#60a5fa',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(59, 130, 246, 0.25)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(59, 130, 246, 0.12)'; }}
          >
            <span>👁️</span>
            <span>Detay</span>
          </button>
        </div>
      )
    }
  ], []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '10px 14px', gap: 10, overflow: 'hidden' }}>
      {/* 4'lü Canlı KPI Özet Kartları */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: 10,
        flexShrink: 0
      }}>
        {/* Toplam Demirbaş */}
        <div style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 10,
          padding: '10px 14px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          boxShadow: '0 1px 4px rgba(0,0,0,0.05)'
        }}>
          <div style={{
            width: 38, height: 38, borderRadius: 8,
            background: 'rgba(59, 130, 246, 0.12)', color: '#3b82f6',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18
          }}>
            💻
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--color-text-muted)', fontWeight: 600 }}>{isRestricted ? 'YETKİLİ DEMİRBAŞ' : 'TOPLAM DEMİRBAŞ'}</div>
            <div style={{ fontSize: 16, fontWeight: 900, color: 'var(--color-text)' }}>
              {displayStats.total} <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--color-text-muted)' }}>Cihaz</span>
            </div>
          </div>
        </div>

        {/* Zimmetli Cihazlar */}
        <div style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 10,
          padding: '10px 14px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          boxShadow: '0 1px 4px rgba(0,0,0,0.05)'
        }}>
          <div style={{
            width: 38, height: 38, borderRadius: 8,
            background: 'rgba(139, 92, 246, 0.12)', color: '#8b5cf6',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18
          }}>
            👤
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--color-text-muted)', fontWeight: 600 }}>ZİMMETLİ CİHAZLAR</div>
            <div style={{ fontSize: 16, fontWeight: 900, color: '#8b5cf6' }}>
              {displayStats.assigned} <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--color-text-muted)' }}>Adet</span>
            </div>
          </div>
        </div>

        {/* Boşta / Depoda */}
        <div style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 10,
          padding: '10px 14px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          boxShadow: '0 1px 4px rgba(0,0,0,0.05)'
        }}>
          <div style={{
            width: 38, height: 38, borderRadius: 8,
            background: 'rgba(16, 185, 129, 0.12)', color: '#10b981',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18
          }}>
            📦
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--color-text-muted)', fontWeight: 600 }}>BOŞTA / DEPODA</div>
            <div style={{ fontSize: 16, fontWeight: 900, color: '#10b981' }}>
              {displayStats.ready} <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--color-text-muted)' }}>Adet</span>
            </div>
          </div>
        </div>

        {/* Kategori Sayısı */}
        <div style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 10,
          padding: '10px 14px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          boxShadow: '0 1px 4px rgba(0,0,0,0.05)'
        }}>
          <div style={{
            width: 38, height: 38, borderRadius: 8,
            background: 'rgba(245, 158, 11, 0.12)', color: '#f59e0b',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18
          }}>
            🏷️
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--color-text-muted)', fontWeight: 600 }}>FARKLI KATEGORİ</div>
            <div style={{ fontSize: 16, fontWeight: 900, color: '#f59e0b' }}>
              {displayCategories.length} <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--color-text-muted)' }}>Kategori</span>
            </div>
          </div>
        </div>
      </div>

      {/* Ana İşlem & Filtreleme Ribbon Çubuğu */}
      <div className="legacy-ribbon" style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 10,
        alignItems: 'center',
        padding: '8px 14px',
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 10,
        flexShrink: 0
      }}>
        {/* Sol Taraf: Dışa Aktar & Senkronize */}
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <button
            type="button"
            className="btn btn-sm btn-secondary"
            onClick={() => exportInventoryExcel(filteredAssets)}
            title="Excel Formatında İndir"
            style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, padding: '5px 12px', borderRadius: 8 }}
          >
            <span>📊</span>
            <span>Excel (.xls)</span>
          </button>
          <button
            type="button"
            className="btn btn-sm btn-secondary"
            onClick={() => exportInventoryCsv(filteredAssets)}
            title="CSV Olarak İndir"
            style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, padding: '5px 12px', borderRadius: 8 }}
          >
            <span>📄</span>
            <span>CSV</span>
          </button>
        </div>

        {/* Dikey Ayrıcı Çizgi */}
        <div style={{ width: 1, height: 22, background: 'var(--color-border)', margin: '0 2px' }} />

        {/* Araçlar: Yenile */}
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <button
            type="button"
            className="btn btn-sm btn-secondary"
            onClick={loadData}
            disabled={loading}
            title="Tüm demirbaş verilerini yenile"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '5px 14px',
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 700,
              background: 'rgba(59, 130, 246, 0.12)',
              border: '1px solid rgba(59, 130, 246, 0.3)',
              color: '#38bdf8'
            }}
          >
            <span style={{ fontSize: 14, display: 'inline-block', transform: loading ? 'rotate(180deg)' : 'none', transition: 'transform 0.3s ease' }}>
              🔄
            </span>
            <span>{loading ? 'Yenileniyor...' : 'Yenile'}</span>
          </button>
        </div>

        {/* Dikey Ayrıcı Çizgi */}
        <div style={{ width: 1, height: 22, background: 'var(--color-border)', margin: '0 2px' }} />

        {/* Filtre Dropdownları */}
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'nowrap' }}>
          <select
            className="form-control"
            value={selectedCategory}
            onChange={e => setSelectedCategory(e.target.value)}
            style={{ width: 'auto', minWidth: 130, maxWidth: 175, fontSize: 11.5, padding: '4px 8px', height: 32, borderRadius: 8, background: 'var(--color-surface-alt)', color: 'var(--color-text)', border: '1px solid var(--color-border)' }}
          >
            <option value="all">Tüm Kategoriler ({displayCategories.length})</option>
            {displayCategories.map(c => (
              <option key={c.category_name} value={c.category_name}>{c.category_name} ({c.count})</option>
            ))}
          </select>

          {!isRestricted ? (
            <select
              className="form-control"
              value={selectedLocation}
              onChange={e => setSelectedLocation(e.target.value)}
              style={{ width: 'auto', minWidth: 130, maxWidth: 175, fontSize: 11.5, padding: '4px 8px', height: 32, borderRadius: 8, background: 'var(--color-surface-alt)', color: 'var(--color-text)', border: '1px solid var(--color-border)' }}
            >
              <option value="all">Tüm Lokasyonlar ({displayLocations.length})</option>
              {displayLocations.map(l => (
                <option key={l.location_name} value={l.location_name}>{l.location_name} ({l.count})</option>
              ))}
            </select>
          ) : (
            <div style={{ fontSize: 11.5, padding: '4px 10px', background: 'var(--color-surface-alt)', border: '1px solid var(--color-border)', borderRadius: 8, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: 4, height: 32, whiteSpace: 'nowrap' }}>
              🏢 <b>{allowedLocationsList.join(', ')}</b>
            </div>
          )}

          <select
            className="form-control"
            value={selectedStatus}
            onChange={e => setSelectedStatus(e.target.value)}
            style={{ width: 'auto', minWidth: 120, maxWidth: 165, fontSize: 11.5, padding: '4px 8px', height: 32, borderRadius: 8, background: 'var(--color-surface-alt)', color: 'var(--color-text)', border: '1px solid var(--color-border)' }}
          >
            <option value="all">Tüm Durumlar ({displayStatuses.length})</option>
            {displayStatuses.map(s => (
              <option key={s.status_name} value={s.status_name}>{s.status_name} ({s.count})</option>
            ))}
          </select>

          {(selectedCategory !== 'all' || selectedLocation !== 'all' || selectedStatus !== 'all' || search) && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => { setSelectedCategory('all'); setSelectedLocation('all'); setSelectedStatus('all'); setSearch(''); }}
              style={{ fontSize: 11, padding: '4px 8px', borderRadius: 8, whiteSpace: 'nowrap' }}
              title="Filtreleri Temizle"
            >
              ✕ Temizle
            </button>
          )}
        </div>

        {/* Sağ Taraf: Canlı Arama & Görünüm Değiştirici */}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ position: 'relative', width: 260 }}>
            <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 13, color: 'var(--color-text-muted)', pointerEvents: 'none' }}>🔍</span>
            <input
              type="text"
              className="form-control"
              placeholder="Tag, model, seri no, personel..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                paddingLeft: 30,
                paddingRight: search ? 26 : 10,
                height: 32,
                borderRadius: 8,
                fontSize: 12,
                background: 'var(--color-surface-alt)',
                border: '1px solid var(--color-border)',
                color: 'var(--color-text)'
              }}
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                style={{
                  position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer', fontSize: 11
                }}
                title="Aramayı Temizle"
              >
                ✕
              </button>
            )}
          </div>

          <div style={{ display: 'flex', border: '1px solid var(--color-border)', borderRadius: 8, overflow: 'hidden' }}>
            <button
              type="button"
              onClick={() => setViewMode('cards')}
              className={`btn btn-xs ${viewMode === 'cards' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ borderRadius: 0, padding: '4px 8px', fontSize: 11, fontWeight: 700 }}
              title="Kart Görünümü"
            >
              📱 Kart
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`btn btn-xs ${viewMode === 'table' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ borderRadius: 0, padding: '4px 8px', fontSize: 11, fontWeight: 700 }}
              title="Tablo Görünümü"
            >
              📊 Tablo
            </button>
          </div>
        </div>
      </div>

      {/* Main Content: Card View (Mobile) or AG Grid Table (Desktop) */}
      {loading && assets.length === 0 ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 10 }}>
          <div className="spinner" />
          <span style={{ color: 'var(--color-text-muted)', fontSize: 12 }}>Demirbaşlar yükleniyor...</span>
        </div>
      ) : viewMode === 'cards' ? (
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8, paddingRight: 2 }}>
          {filteredAssets.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 32, color: 'var(--color-text-muted)', background: 'var(--color-surface)', borderRadius: 8, border: '1px solid var(--color-border)' }}>
              🔍 Kriterlere uygun demirbaş bulunamadı.
            </div>
          ) : (
            filteredAssets.map(item => {
              const catCfg = getCategoryBadgeConfig(item.category_name);
              const statusCfg = getAssetStatusBadgeConfig(item.status_name, item.assigned_to_user_name);
              return (
                <div
                  key={item.id}
                  style={{
                    background: 'var(--color-surface)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 8,
                    padding: '12px 14px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                    boxShadow: '0 1px 4px rgba(0,0,0,0.06)'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontWeight: 800, fontSize: 13, fontFamily: 'monospace', color: 'var(--color-primary-light, #60a5fa)', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span>💻</span>
                      <span>{item.asset_tag}</span>
                      <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--color-text-secondary)', fontFamily: 'sans-serif' }}>({item.name})</span>
                    </div>
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 5,
                      padding: '3px 8px',
                      borderRadius: 6,
                      fontSize: 10.5,
                      fontWeight: 600,
                      background: statusCfg.bg,
                      border: `1px solid ${statusCfg.border}`,
                      color: statusCfg.color
                    }}>
                      <span style={{ fontSize: 10 }}>{statusCfg.icon}</span>
                      <span>{statusCfg.label}</span>
                    </span>
                  </div>

                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                    <span>{item.model_name || 'Model Belirtilmedi'}</span>
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      padding: '2px 7px',
                      borderRadius: 6,
                      fontSize: 10.5,
                      fontWeight: 600,
                      background: catCfg.bg,
                      border: `1px solid ${catCfg.border}`,
                      color: catCfg.color
                    }}>
                      <span>{catCfg.icon}</span>
                      <span>{catCfg.label}</span>
                    </span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 11, color: 'var(--color-text-secondary)', background: 'var(--color-surface-alt)', padding: '6px 10px', borderRadius: 6, border: '1px solid var(--color-border)' }}>
                    <div>👤 <b>{item.assigned_to_user_name || '— (Boşta / Atanmamış)'}</b></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 10.5 }}>
                      <span>🏢 {item.location_name || 'Lokasyon Yok'}</span>
                      <span>SN: {item.serial || '—'}</span>
                    </div>
                  </div>

                  <div style={{ marginTop: 2, display: 'flex', gap: 6 }}>
                    <button
                      onClick={() => setActiveAsset(item)}
                      style={{
                        flex: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                        fontSize: 11.5,
                        fontWeight: 600,
                        padding: '6px 10px',
                        borderRadius: 6,
                        background: 'rgba(59, 130, 246, 0.12)',
                        border: '1px solid rgba(59, 130, 246, 0.35)',
                        color: '#60a5fa',
                        cursor: 'pointer'
                      }}
                    >
                      👁️ Demirbaş Detayını Gör
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      ) : (
        <div style={{ flex: 1, minHeight: 280, border: '1px solid var(--color-border)', borderRadius: 8, overflow: 'hidden' }}>
          <div className={theme === 'light' || theme === 'sakura' ? 'ag-theme-quartz' : 'ag-theme-quartz-dark'} style={{ height: '100%', width: '100%' }}>
            <AgGridReact
              theme="legacy"
              rowData={filteredAssets}
              columnDefs={columnDefs}
              defaultColDef={{ resizable: true, sortable: true, filter: true, flex: 1, minWidth: 100 }}
              onRowDoubleClicked={p => p.data && setActiveAsset(p.data)}
              pagination
              paginationPageSize={50}
              rowHeight={36}
              headerHeight={36}
              suppressDragLeaveHidesColumns={true}
              overlayNoRowsTemplate='<span class="ag-overlay-no-rows-center">Kriterlere uygun demirbaş bulunamadı.</span>'
            />
          </div>
        </div>
      )}

      {/* Asset Detail Modal */}
      {activeAsset && (
        <AssetDetailModal
          asset={activeAsset}
          onClose={() => setActiveAsset(null)}
        />
      )}
    </div>
  );
}
