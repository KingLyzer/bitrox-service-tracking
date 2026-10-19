import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { AgGridReact } from 'ag-grid-react';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-quartz.css';
import { useAuth } from '../../../context/AuthContext';
import { useApp } from '../../../context/AppContext';
import ServiceTicketForm from './ServiceTicketForm';
import ServiceTicketDetail from './ServiceTicketDetail';
import Modal from '../../common/Modal';
import ConfirmDialog from '../../common/ConfirmDialog';
import ExcelFilterHeader from './ExcelFilterHeader';
import ColumnFilterPopover from './ColumnFilterPopover';
import { getApiBase, API_BASE } from '../../../utils/apiConfig';
const TICKETS_CACHE_KEY = 'serviceTickets:lastSuccessfulList';

const formatDateTime = (value) => {
  if (!value) return '';
  if (value instanceof Date) {
    const yyyy = value.getFullYear();
    const mm = String(value.getMonth() + 1).padStart(2, '0');
    const dd = String(value.getDate()).padStart(2, '0');
    const hh = String(value.getHours()).padStart(2, '0');
    const min = String(value.getMinutes()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
  }
  return String(value).slice(0, 16).replace('T', ' ');
};

const formatDate = (value) => formatDateTime(value).slice(0, 10);

export const getStatusBadgeConfig = (status) => {
  const statusConfig = {
    'Yeni Kayıt':      { bg: 'rgba(14, 165, 233, 0.12)', color: '#38bdf8', border: 'rgba(14, 165, 233, 0.35)', dot: '#0ea5e9', icon: '🆕' },
    'İncelemede':     { bg: 'rgba(245, 158, 11, 0.12)', color: '#fbbf24', border: 'rgba(245, 158, 11, 0.35)', dot: '#f59e0b', icon: '🔍' },
    'Parça Bekliyor': { bg: 'rgba(249, 115, 22, 0.12)', color: '#fb923c', border: 'rgba(249, 115, 22, 0.35)', dot: '#ea580c', icon: '⏳' },
    'Onarımda':       { bg: 'rgba(168, 85, 247, 0.12)', color: '#c084fc', border: 'rgba(168, 85, 247, 0.35)', dot: '#a855f7', icon: '⚙️' },
    'Testte':         { bg: 'rgba(20, 184, 166, 0.12)', color: '#2dd4bf', border: 'rgba(20, 184, 166, 0.35)', dot: '#14b8a6', icon: '🧪' },
    'Dış Serviste':   { bg: 'rgba(99, 102, 241, 0.12)', color: '#818cf8', border: 'rgba(99, 102, 241, 0.35)', dot: '#6366f1', icon: '🚚' },
    'Tamamlandı':     { bg: 'rgba(16, 185, 129, 0.12)', color: '#34d399', border: 'rgba(16, 185, 129, 0.35)', dot: '#10b981', icon: '✅' },
    'Teslim Edildi':  { bg: 'rgba(34, 197, 94, 0.12)',  color: '#4ade80', border: 'rgba(34, 197, 94, 0.35)',  dot: '#22c55e', icon: '🤝' },
    'Pert':           { bg: 'rgba(239, 68, 68, 0.15)',  color: '#f87171', border: 'rgba(239, 68, 68, 0.35)', dot: '#ef4444', icon: '💥' },
    'İptal':          { bg: 'rgba(100, 116, 139, 0.12)', color: '#94a3b8', border: 'rgba(100, 116, 139, 0.3)', dot: '#64748b', icon: '✖️' },
  };
  return statusConfig[status] || { bg: 'rgba(148, 163, 184, 0.12)', color: '#94a3b8', border: 'rgba(148, 163, 184, 0.3)', dot: '#94a3b8', icon: '📋' };
};

export const getPriorityBadgeConfig = (priority) => {
  const prioMap = {
    'Acil':   { bg: 'rgba(239, 68, 68, 0.15)', color: '#f87171', border: 'rgba(239, 68, 68, 0.35)', icon: '🔥' },
    'Kritik': { bg: 'rgba(239, 68, 68, 0.15)', color: '#f87171', border: 'rgba(239, 68, 68, 0.35)', icon: '🔥' },
    'Yüksek': { bg: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24', border: 'rgba(245, 158, 11, 0.35)', icon: '⚡' },
    'Orta':   { bg: 'rgba(14, 165, 233, 0.12)', color: '#38bdf8', border: 'rgba(14, 165, 233, 0.25)', icon: '🔹' },
    'Normal': { bg: 'rgba(14, 165, 233, 0.12)', color: '#38bdf8', border: 'rgba(14, 165, 233, 0.25)', icon: '🔹' },
    'Düşük':  { bg: 'rgba(100, 116, 139, 0.12)', color: '#94a3b8', border: 'rgba(100, 116, 139, 0.2)', icon: '▫️' }
  };
  return prioMap[priority] || prioMap['Normal'];
};

async function loadTicketsFallback() {
  const cached = localStorage.getItem(TICKETS_CACHE_KEY);
  if (cached) return JSON.parse(cached);
  return [];
}

export default function ServiceTickets({ tabData }) {
  const { user, hasPermission, auditLog } = useAuth();
  const { showNotification, theme, refreshToggle, tableRefreshVersions = {}, closeTab, activeTab, openTab, targetTicketToOpen, setTargetTicketToOpen } = useApp();
  const [tickets, setTickets] = useState(() => {
    try {
      const cached = localStorage.getItem(TICKETS_CACHE_KEY);
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editTicket, setEditTicket] = useState(null);
  const [detailTicket, setDetailTicket] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [selectedTicketRow, setSelectedTicketRow] = useState(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [viewMode, setViewMode] = useState(window.innerWidth < 768 ? 'cards' : 'table');

  // Excel Sütun Filtreleri: { [field]: ['val1', 'val2'] }
  const [columnFilters, setColumnFilters] = useState({});
  const [activeFilterDropdown, setActiveFilterDropdown] = useState(null); // { field, title, rect }

  // Dashboard KPI Preset Filtresi
  const [activePreset, setActivePreset] = useState(() => {
    if (tabData?.presetFilter) {
      return { id: tabData.presetFilter, title: tabData.title || tabData.presetFilter };
    }
    return null;
  });

  useEffect(() => {
    const handlePresetEvent = (e) => {
      if (e.detail?.targetTab === 'service-tickets' && e.detail?.presetFilter) {
        setActivePreset({ id: e.detail.presetFilter, title: e.detail.title || e.detail.presetFilter });
        setColumnFilters({});
        setStatusFilter('all');
        setSearchText('');
      }
    };
    window.addEventListener('service-tracker-preset', handlePresetEvent);
    return () => window.removeEventListener('service-tracker-preset', handlePresetEvent);
  }, []);

  useEffect(() => {
    if (tabData?.presetFilter) {
      setActivePreset({ id: tabData.presetFilter, title: tabData.title || tabData.presetFilter });
      setColumnFilters({});
      setStatusFilter('all');
      setSearchText('');
    }
  }, [tabData?.presetFilter, tabData?.timestamp, tabData]);

  const handleOpenFilter = useCallback((field, title, rect) => {
    setActiveFilterDropdown({ field, title, rect });
  }, []);

  const handleApplyColumnFilter = useCallback((field, values) => {
    setColumnFilters(prev => ({
      ...prev,
      [field]: values
    }));
  }, []);

  const handleClearColumnFilter = useCallback((field) => {
    setColumnFilters(prev => {
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }, []);

  const clearAllFilters = useCallback(() => {
    setColumnFilters({});
    setActivePreset(null);
    setStatusFilter('all');
    setSearchText('');
  }, []);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) {
        setViewMode('cards');
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Hedef Servis Fişi Otomatik Pop-Up Açma (Kargo veya diğer modüllerden yönlendirilince)
  useEffect(() => {
    if (!targetTicketToOpen || !tickets || tickets.length === 0) return;
    const target = tickets.find(t =>
      (targetTicketToOpen.id && String(t.id) === String(targetTicketToOpen.id)) ||
      (targetTicketToOpen.ticket_no && String(t.ticket_no).toLowerCase() === String(targetTicketToOpen.ticket_no).toLowerCase())
    );
    if (target) {
      setDetailTicket(target);
      if (typeof setTargetTicketToOpen === 'function') {
        setTargetTicketToOpen(null);
      }
    }
  }, [targetTicketToOpen, tickets, setTargetTicketToOpen]);

  // AbortController ref: aktif fetch isteğini iptal etmek için (Race Condition önlemi)
  const fetchAbortRef = useRef(null);
  // showNotification ref: load callback'inin stale closure oluşturmaması için
  const showNotificationRef = useRef(showNotification);
  useEffect(() => { showNotificationRef.current = showNotification; }, [showNotification]);

  // FIX #1 & #2: load artık stale closure oluşturmuyor (ref üzerinden notification çağrısı)
  // ve AbortController ile race condition'a karşı korumalı.
  const load = useCallback(async () => {
    // Önceki devam eden fetch'i iptal et
    if (fetchAbortRef.current) fetchAbortRef.current.abort();
    const controller = new AbortController();
    fetchAbortRef.current = controller;

    setLoading(true);
    try {
      if (window.electronAPI?.getServiceTickets) {
        const direct = await window.electronAPI.getServiceTickets();
        if (direct?.success && Array.isArray(direct.data)) {
          setTickets(direct.data);
          localStorage.setItem(TICKETS_CACHE_KEY, JSON.stringify(direct.data));
          return;
        }
      }

      const res = await fetch(`${API_BASE}/api/fisler`, { signal: controller.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const filteredData = data.filter(t => t.record_type !== 'standalone_task');
      setTickets(filteredData);
      localStorage.setItem(TICKETS_CACHE_KEY, JSON.stringify(filteredData));
    } catch (err) {
      // AbortError beklenen bir durum — kullanıcıya gösterme
      if (err.name !== 'AbortError') {
        try {
          const fallbackTickets = await loadTicketsFallback();
          const filteredFallback = fallbackTickets.filter(t => t.record_type !== 'standalone_task');
          setTickets(filteredFallback);
          if (filteredFallback.length) {
            localStorage.setItem(TICKETS_CACHE_KEY, JSON.stringify(filteredFallback));
            showNotificationRef.current('API kapalı. Servis fişleri MySQL/önbellekten yüklendi.', 'warning', 6000);
          } else {
            showNotificationRef.current('Bağlantı hatası: ' + err.message, 'danger');
          }
        } catch (fallbackErr) {
          showNotificationRef.current('Bağlantı hatası: ' + (fallbackErr.message || err.message), 'danger');
        }
      }
    } finally {
      // Yalnızca bu controller hâlâ aktifse loading'i kapat
      if (fetchAbortRef.current === controller) {
        setLoading(false);
      }
    }
  }, []); // Bağımlılık yok — ref üzerinden notification alıyor

  const serviceRefreshVersion = [
    tableRefreshVersions.service_tickets || 0,
    tableRefreshVersions.cached_assets || 0,
    tableRefreshVersions.cached_users || 0,
    tableRefreshVersions.cached_locations || 0,
  ].join('|');

  useEffect(() => {
    return () => {
      if (fetchAbortRef.current) fetchAbortRef.current.abort();
    };
  }, []);

  useEffect(() => { load(); }, [load, refreshToggle, serviceRefreshVersion]);

  // FIX: Socket.io vb. sebeplerle tickets dizisi güncellendiğinde açık olan modal'daki bileti de güncelle
  useEffect(() => {
    if (detailTicket) {
      const updated = tickets.find(t => t.id === detailTicket.id);
      if (updated && updated !== detailTicket) {
        setDetailTicket(updated);
      }
    }
  }, [tickets]);

  const columnDefs = useMemo(() => [
    {
      field: 'ticket_no',
      headerName: 'Form No',
      width: 155,
      pinned: 'left',
      sortable: true,
      headerComponent: ExcelFilterHeader,
      headerComponentParams: {
        field: 'ticket_no',
        displayName: 'Form No',
        isFiltered: Boolean(columnFilters.ticket_no?.length),
        onOpenFilter: handleOpenFilter,
      },
      cellRenderer: params => (
        <div 
          onClick={() => setDetailTicket(params.data)}
          title="Detay Görüntüle"
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
          <span style={{ fontSize: 13 }}>🎫</span>
          <span style={{ textDecoration: 'underline', textUnderlineOffset: 3, textDecorationColor: 'rgba(96, 165, 250, 0.4)' }}>{params.value || '—'}</span>
        </div>
      )
    },
    {
      field: 'created_at',
      headerName: 'Kayıt Tarihi',
      width: 150,
      sortable: true,
      headerComponent: ExcelFilterHeader,
      headerComponentParams: {
        field: 'created_at',
        displayName: 'Kayıt Tarihi',
        isFiltered: Boolean(columnFilters.created_at?.length),
        onOpenFilter: handleOpenFilter,
      },
      cellRenderer: params => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--color-text-secondary)' }}>
          <span style={{ fontSize: 11, opacity: 0.6 }}>📅</span>
          <span>{formatDateTime(params.value)}</span>
        </div>
      )
    },
    {
      field: 'asset_tag',
      headerName: 'Envanter Tag',
      width: 145,
      sortable: true,
      headerComponent: ExcelFilterHeader,
      headerComponentParams: {
        field: 'asset_tag',
        displayName: 'Envanter Tag',
        isFiltered: Boolean(columnFilters.asset_tag?.length),
        onOpenFilter: handleOpenFilter,
      },
      cellRenderer: params => params.value ? (
        <div style={{ display: 'flex', alignItems: 'center', height: '100%' }}>
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: '2px 8px',
            borderRadius: 6,
            fontSize: 11,
            fontWeight: 600,
            fontFamily: 'monospace',
            background: 'rgba(99, 102, 241, 0.12)',
            color: 'var(--color-primary-light, #818cf8)',
            border: '1px solid rgba(99, 102, 241, 0.3)'
          }}>
            <span>🏷️</span>
            <span>{params.value}</span>
          </span>
        </div>
      ) : <span style={{ color: 'var(--color-text-muted)' }}>—</span>
    },
    {
      field: 'user_name',
      headerName: 'Kullanıcı',
      width: 190,
      sortable: true,
      headerComponent: ExcelFilterHeader,
      headerComponentParams: {
        field: 'user_name',
        displayName: 'Kullanıcı',
        isFiltered: Boolean(columnFilters.user_name?.length),
        onOpenFilter: handleOpenFilter,
      },
      cellRenderer: params => {
        if (!params.value) return <span style={{ color: 'var(--color-text-muted)' }}>—</span>;
        const initials = params.value.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, height: '100%' }}>
            <div style={{
              width: 22, height: 22, borderRadius: 6,
              background: 'linear-gradient(135deg, #4f46e5, #0ea5e9)',
              color: '#fff', fontSize: 10, fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0
            }}>{initials}</div>
            <span style={{ fontWeight: 600, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{params.value}</span>
          </div>
        );
      }
    },
    {
      field: 'location_name',
      headerName: 'Lokasyon',
      width: 150,
      sortable: true,
      headerComponent: ExcelFilterHeader,
      headerComponentParams: {
        field: 'location_name',
        displayName: 'Lokasyon',
        isFiltered: Boolean(columnFilters.location_name?.length),
        onOpenFilter: handleOpenFilter,
      },
      cellRenderer: params => params.value ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11.5, color: 'var(--color-text-secondary)', height: '100%' }}>
          <span style={{ color: '#ef4444', fontSize: 12 }}>📍</span>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 500 }}>{params.value}</span>
        </div>
      ) : <span style={{ color: 'var(--color-text-muted)' }}>—</span>
    },
    {
      field: 'asset_name',
      headerName: 'Envanter',
      flex: 1,
      minWidth: 180,
      sortable: true,
      headerComponent: ExcelFilterHeader,
      headerComponentParams: {
        field: 'asset_name',
        displayName: 'Envanter',
        isFiltered: Boolean(columnFilters.asset_name?.length),
        onOpenFilter: handleOpenFilter,
      },
      cellRenderer: params => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 500, height: '100%' }}>
          <span style={{ fontSize: 13, opacity: 0.85 }}>💻</span>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--color-text)' }}>{params.value || params.data?.model_name || '—'}</span>
        </div>
      )
    },
    {
      field: 'status',
      headerName: 'Servis Durumu',
      width: 180,
      sortable: true,
      headerComponent: ExcelFilterHeader,
      headerComponentParams: {
        field: 'status',
        displayName: 'Servis Durumu',
        isFiltered: Boolean(columnFilters.status?.length),
        onOpenFilter: handleOpenFilter,
      },
      cellRenderer: params => {
        const cfg = getStatusBadgeConfig(params.value);
        return (
          <div style={{ display: 'flex', alignItems: 'center', height: '100%' }}>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '3px 9px',
              borderRadius: 6,
              fontSize: 11.5,
              fontWeight: 600,
              letterSpacing: '0.2px',
              background: cfg.bg,
              border: `1px solid ${cfg.border}`,
              color: cfg.color,
              lineHeight: 1.3,
              boxShadow: '0 1px 3px rgba(0,0,0,0.06)'
            }}>
              <span style={{ fontSize: 11 }}>{cfg.icon}</span>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: cfg.dot, boxShadow: `0 0 6px ${cfg.dot}` }} />
              <span>{params.value}</span>
            </span>
          </div>
        );
      }
    },
    {
      field: 'priority',
      headerName: 'Öncelik',
      width: 130,
      sortable: true,
      headerComponent: ExcelFilterHeader,
      headerComponentParams: {
        field: 'priority',
        displayName: 'Öncelik',
        isFiltered: Boolean(columnFilters.priority?.length),
        onOpenFilter: handleOpenFilter,
      },
      cellRenderer: params => {
        const cfg = getPriorityBadgeConfig(params.value);
        return (
          <div style={{ display: 'flex', alignItems: 'center', height: '100%' }}>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              padding: '3px 8px',
              borderRadius: 6,
              fontSize: 11.5,
              fontWeight: 600,
              background: cfg.bg,
              color: cfg.color,
              border: `1px solid ${cfg.border}`,
              lineHeight: 1.3
            }}>
              <span style={{ fontSize: 12 }}>{cfg.icon}</span>
              <span>{params.value || 'Normal'}</span>
            </span>
          </div>
        );
      }
    },
    {
      field: 'serial_no',
      headerName: 'Seri No',
      width: 160,
      sortable: true,
      headerComponent: ExcelFilterHeader,
      headerComponentParams: {
        field: 'serial_no',
        displayName: 'Seri No',
        isFiltered: Boolean(columnFilters.serial_no?.length),
        onOpenFilter: handleOpenFilter,
      },
      cellRenderer: params => params.value ? (
        <span style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--color-text-secondary)', background: 'var(--color-surface-alt)', padding: '2px 6px', borderRadius: 4, border: '1px solid var(--color-border)' }}>
          {params.value}
        </span>
      ) : <span style={{ color: 'var(--color-text-muted)' }}>—</span>
    },
    {
      headerName: 'İşlemler',
      width: 130,
      pinned: 'right',
      cellRenderer: params => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, height: '100%' }}>
          <button
            onClick={() => setDetailTicket(params.data)}
            title="Detay Görüntüle"
            style={{
              width: 28, height: 28, borderRadius: 6,
              border: '1px solid rgba(59, 130, 246, 0.35)',
              background: 'rgba(59, 130, 246, 0.12)',
              color: '#60a5fa',
              display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
              fontSize: 12, transition: 'all 0.15s ease'
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(59, 130, 246, 0.25)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(59, 130, 246, 0.12)'; }}
          >
            👁️
          </button>
          {hasPermission('service', 'can_edit') && (
            <button
              onClick={() => { setEditTicket(params.data); setShowForm(true); }}
              title="Düzenle"
              style={{
                width: 28, height: 28, borderRadius: 6,
                border: '1px solid rgba(245, 158, 11, 0.35)',
                background: 'rgba(245, 158, 11, 0.12)',
                color: '#fbbf24',
                display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                fontSize: 12, transition: 'all 0.15s ease'
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(245, 158, 11, 0.25)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(245, 158, 11, 0.12)'; }}
            >
              ✏️
            </button>
          )}
          {hasPermission('service', 'can_delete') && (
            <button
              onClick={() => setDeleteTarget(params.data)}
              title="Sil"
              style={{
                width: 28, height: 28, borderRadius: 6,
                border: '1px solid rgba(239, 68, 68, 0.35)',
                background: 'rgba(239, 68, 68, 0.12)',
                color: '#f87171',
                display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                fontSize: 12, transition: 'all 0.15s ease'
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.25)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.12)'; }}
            >
              🗑️
            </button>
          )}
        </div>
      )
    }
  ], [hasPermission, columnFilters, handleOpenFilter]);

  const defaultColDef = useMemo(() => ({
    resizable: true,
    sortable: true,
  }), []);

  const filteredTickets = useMemo(() => {
    let list = tickets;

    // 1. Dashboard preset filtresi
    if (activePreset) {
      if (activePreset.id === 'today') {
        const now = new Date();
        const todayDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        list = list.filter(t => t.created_at && (formatDate(t.created_at) === todayDate || String(t.created_at).slice(0, 10) === todayDate));
      } else if (activePreset.id === 'open') {
        const closed = ['Teslim Edildi', 'Tamamlandı', 'Pert', 'İptal'];
        list = list.filter(t => !closed.includes(t.status));
      } else if (activePreset.id === 'waiting') {
        list = list.filter(t => t.status === 'Parça Bekliyor');
      } else if (activePreset.id === 'overdue') {
        const closed = ['Teslim Edildi', 'Tamamlandı', 'Pert', 'İptal'];
        const now = new Date();
        const sevenDaysAgo = new Date(now);
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        list = list.filter(t => {
          if (closed.includes(t.status)) return false;
          if (!t.created_at) return false;
          return new Date(t.created_at) < sevenDaysAgo;
        });
      }
    }

    // 2. Legacy statusFilter (all değilse)
    if (statusFilter !== 'all') {
      list = list.filter(t => (t.status || '').toLowerCase() === statusFilter.toLowerCase());
    }

    // 3. Excel Sütun Filtreleri
    Object.entries(columnFilters).forEach(([field, selectedVals]) => {
      if (!selectedVals || selectedVals.length === 0) return;

      list = list.filter(t => {
        let val;
        if (field === 'created_at') {
          val = t.created_at ? String(t.created_at).slice(0, 10) : '—';
        } else if (field === 'asset_name') {
          val = (t.asset_name || t.model_name || '').trim() || '—';
        } else {
          val = (t[field] !== undefined && t[field] !== null && String(t[field]).trim() !== '') ? String(t[field]).trim() : '—';
        }
        return selectedVals.includes(val);
      });
    });

    // 4. Genel Arama Metni
    const term = searchText.trim().toLocaleLowerCase('tr-TR');
    if (!term) return list;
    const fields = ['ticket_no', 'created_at', 'asset_tag', 'user_name', 'location_name', 'asset_name', 'model_name', 'status', 'priority', 'serial_no', 'fault_desc', 'notes'];
    return list.filter(ticket => fields.some(field => String(ticket[field] || '').toLocaleLowerCase('tr-TR').includes(term)));
  }, [tickets, activePreset, statusFilter, columnFilters, searchText]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const res = await fetch(`${API_BASE}/api/fis-sil/${deleteTarget.id}`, { method: 'DELETE' });
      if (res.ok) {
        await auditLog({
          action: 'DELETE',
          module: 'service',
          refId: deleteTarget.id,
          description: `${deleteTarget.ticket_no || deleteTarget.id} servis fişi silindi.`,
          oldValue: deleteTarget
        });
        showNotification(`${deleteTarget.ticket_no} silindi.`, 'success');
        setDeleteTarget(null);
        load();
      } else {
        const errText = await res.text().catch(() => '');
        showNotification('Silme işlemi başarısız: ' + errText, 'danger');
        setDeleteTarget(null);
      }
    } catch (err) {
      showNotification('Silme işlemi sırasında hata: ' + err.message, 'danger');
      setDeleteTarget(null);
    }
  };

  const selected = selectedTicketRow || tickets[0] || {};
  const openNew = () => { setEditTicket(null); setShowForm(true); };
  const openSelectedDetail = () => {
    if (!selected?.id) return;
    setDetailTicket(selected);
  };
  const openSelectedEdit = () => {
    if (!selected?.id) return;
    setEditTicket(selected);
    setShowForm(true);
  };

  const activeColumnsCount = useMemo(() => {
    return Object.keys(columnFilters).filter(k => columnFilters[k]?.length > 0).length;
  }, [columnFilters]);

  const hasAnyFilter = useMemo(() => {
    return activeColumnsCount > 0 || Boolean(activePreset) || statusFilter !== 'all' || Boolean(searchText.trim());
  }, [activeColumnsCount, activePreset, statusFilter, searchText]);

  return (
    <div className="legacy-erp">
      <div className="legacy-workspace">
        <div className="legacy-titlebar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
          <div style={{ fontWeight: 800, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
            🛠️ Teknik Servis Fişleri
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>
              {hasAnyFilter ? `Filtrelenen: ${filteredTickets.length} / ${tickets.length}` : `Toplam: ${tickets.length}`}
            </span>
            <div style={{ display: 'flex', border: '1px solid var(--color-border)', borderRadius: 4, overflow: 'hidden' }}>
              <button
                type="button"
                onClick={() => setViewMode('cards')}
                className={`btn btn-xs ${viewMode === 'cards' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ borderRadius: 0, padding: '3px 8px', fontSize: 10, fontWeight: 700 }}
              >
                📱 Kart
              </button>
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`btn btn-xs ${viewMode === 'table' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ borderRadius: 0, padding: '3px 8px', fontSize: 10, fontWeight: 700 }}
              >
                📊 Tablo
              </button>
            </div>
          </div>
        </div>

        <div className="legacy-ribbon" style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', padding: '8px 14px', background: 'var(--color-surface)', borderBottom: '1px solid var(--color-border)' }}>
          {/* Ana İşlem Butonları */}
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            {hasPermission('service', 'can_create') && (
              <button
                type="button"
                className="btn btn-sm btn-primary"
                onClick={openNew}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 14px', fontWeight: 700, fontSize: 12, borderRadius: 8 }}
              >
                <span>➕</span>
                <span>Yeni Fiş</span>
              </button>
            )}
            {hasPermission('service', 'can_edit') && (
              <button
                type="button"
                className="btn btn-sm btn-secondary"
                onClick={openSelectedEdit}
                disabled={!selected?.id}
                style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', fontSize: 12, borderRadius: 8, opacity: selected?.id ? 1 : 0.5 }}
              >
                <span>✏️</span>
                <span>Düzenle</span>
              </button>
            )}
            {hasPermission('service', 'can_delete') && (
              <button
                type="button"
                className="btn btn-sm btn-danger"
                onClick={() => selected?.id && setDeleteTarget(selected)}
                disabled={!selected?.id}
                style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', fontSize: 12, borderRadius: 8, opacity: selected?.id ? 1 : 0.5 }}
              >
                <span>🗑️</span>
                <span>Sil</span>
              </button>
            )}
          </div>

          {/* Dikey Ayrıcı Çizgi */}
          <div style={{ width: 1, height: 22, background: 'var(--color-border)', margin: '0 2px' }} />

          {/* Araçlar: Belirgin Yenile & Görevler & Tüm Filtreleri Temizle Butonları */}
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn-sm btn-secondary"
              onClick={load}
              disabled={loading}
              title="Tüm servis fişlerini ve canlı verileri yenile"
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

            {hasPermission('tasks', 'can_view') && (
              <button
                type="button"
                className="btn btn-sm btn-secondary"
                onClick={() => openTab({ id: 'tasks', label: 'Kurulum Görevleri', icon: '📋', module: 'TasksModule' })}
                title="Kurulum ve Görev Takibi Modülünü Aç"
                style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', fontSize: 12, borderRadius: 8 }}
              >
                <span>📋</span>
                <span>Görevler</span>
              </button>
            )}

            {/* Tüm Filtreleri Temizle Butonu (Filtre aktifse belirginleşir) */}
            {hasAnyFilter && (
              <button
                type="button"
                className="btn btn-sm"
                onClick={clearAllFilters}
                title="Tüm sütun filtrelerini ve özel filtreleri temizle"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '5px 12px',
                  fontSize: 12,
                  fontWeight: 700,
                  borderRadius: 8,
                  background: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid rgba(239, 68, 68, 0.4)',
                  color: '#f87171',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                <span>✕</span>
                <span>Tüm Filtreleri Temizle</span>
                {(activeColumnsCount + (activePreset ? 1 : 0)) > 0 && (
                  <span style={{
                    background: '#ef4444',
                    color: '#fff',
                    fontSize: 10,
                    fontWeight: 800,
                    padding: '1px 6px',
                    borderRadius: 10,
                    marginLeft: 2
                  }}>
                    {activeColumnsCount + (activePreset ? 1 : 0)}
                  </span>
                )}
              </button>
            )}
          </div>

          {/* Hızlı Arama Çubuğu (Sağ Tarafta Doğrudan Açık) */}
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ position: 'relative', width: 320 }}>
              <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 13, color: 'var(--color-text-muted)', pointerEvents: 'none' }}>🔍</span>
              <input
                type="text"
                className="form-control"
                value={searchText}
                onChange={e => setSearchText(e.target.value)}
                placeholder="Fiş no, personel, cihaz, seri no veya arıza..."
                style={{
                  paddingLeft: 30,
                  paddingRight: searchText ? 26 : 10,
                  height: 32,
                  borderRadius: 8,
                  fontSize: 12,
                  background: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                  color: 'var(--color-text)'
                }}
              />
              {searchText && (
                <button
                  type="button"
                  onClick={() => setSearchText('')}
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
          </div>
        </div>

        {/* ── Aktif Filtreler Gösterge Şeridi ── */}
        {hasAnyFilter && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '6px 14px',
            background: 'rgba(249, 115, 22, 0.08)',
            borderBottom: '1px solid rgba(249, 115, 22, 0.2)',
            flexWrap: 'wrap',
            fontSize: 11.5,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontWeight: 700, color: '#f97316' }}>
              <span>🌪️</span>
              <span>Aktif Filtreler:</span>
            </div>

            {/* Dashboard Preset Rozeti */}
            {activePreset && (
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '2px 8px',
                borderRadius: 6,
                background: 'rgba(59, 130, 246, 0.2)',
                border: '1px solid rgba(59, 130, 246, 0.4)',
                color: '#60a5fa',
                fontWeight: 700
              }}>
                <span>{activePreset.title || activePreset.id}</span>
                <button
                  type="button"
                  onClick={() => setActivePreset(null)}
                  style={{ background: 'none', border: 'none', color: '#60a5fa', cursor: 'pointer', padding: 0, fontWeight: 900, fontSize: 11 }}
                  title="Ön tanımlı filtreyi kaldır"
                >
                  ✕
                </button>
              </span>
            )}

            {/* Sütun Bazlı Filtre Rozetleri */}
            {Object.entries(columnFilters).map(([field, vals]) => {
              if (!vals || vals.length === 0) return null;
              const colTitleMap = {
                ticket_no: 'Form No',
                created_at: 'Kayıt Tarihi',
                asset_tag: 'Envanter Tag',
                user_name: 'Kullanıcı',
                location_name: 'Lokasyon',
                asset_name: 'Envanter',
                status: 'Servis Durumu',
                priority: 'Öncelik',
                serial_no: 'Seri No',
              };
              const title = colTitleMap[field] || field;
              const displayVals = vals.length > 2 ? `${vals.slice(0, 2).join(', ')} (+${vals.length - 2})` : vals.join(', ');

              return (
                <span
                  key={field}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '2px 8px',
                    borderRadius: 6,
                    background: 'rgba(249, 115, 22, 0.16)',
                    border: '1px solid rgba(249, 115, 22, 0.45)',
                    color: '#fb923c',
                    fontWeight: 600
                  }}
                >
                  <span><b>{title}:</b> {displayVals}</span>
                  <button
                    type="button"
                    onClick={() => handleClearColumnFilter(field)}
                    style={{ background: 'none', border: 'none', color: '#fb923c', cursor: 'pointer', padding: 0, fontWeight: 900, fontSize: 11 }}
                    title={`${title} filtresini kaldır`}
                  >
                    ✕
                  </button>
                </span>
              );
            })}

            {/* Arama Metni Rozeti */}
            {searchText && (
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '2px 8px',
                borderRadius: 6,
                background: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid var(--color-border)',
                color: 'var(--color-text-secondary)',
                fontWeight: 600
              }}>
                <span>Arama: "{searchText}"</span>
                <button
                  type="button"
                  onClick={() => setSearchText('')}
                  style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: 0, fontWeight: 900, fontSize: 11 }}
                  title="Aramayı temizle"
                >
                  ✕
                </button>
              </span>
            )}

            <button
              type="button"
              onClick={clearAllFilters}
              style={{
                marginLeft: 'auto',
                background: 'none',
                border: 'none',
                color: '#f87171',
                textDecoration: 'underline',
                cursor: 'pointer',
                fontSize: 11,
                fontWeight: 700
              }}
            >
              Filtreleri Sıfırla
            </button>
          </div>
        )}

        {/* Seçili Fiş Bilgi Paneli (Gözü Yormayan Modern Kart Yapısı) */}
        {viewMode !== 'cards' && selected?.id && (() => {
          const sCfg = getStatusBadgeConfig(selected.status);
          const pCfg = getPriorityBadgeConfig(selected.priority);
          return (
            <div style={{
              background: 'var(--color-surface)',
              borderBottom: '1px solid var(--color-border)',
              padding: '10px 16px',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
            }}>
              {/* Üst Satır: Fiş No, Tarih, Durum ve Öncelik */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontWeight: 800, fontSize: 13, fontFamily: 'monospace', color: 'var(--color-primary-light, #60a5fa)', display: 'flex', alignItems: 'center', gap: 5 }}>
                    <span>🎫</span>
                    <span>{selected.ticket_no || 'Seçim Yok'}</span>
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span>📅</span>
                    <span>{formatDateTime(selected.created_at) || '—'}</span>
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '3px 9px',
                    borderRadius: 6,
                    fontSize: 11.5,
                    fontWeight: 600,
                    background: sCfg.bg,
                    border: `1px solid ${sCfg.border}`,
                    color: sCfg.color
                  }}>
                    <span style={{ fontSize: 11 }}>{sCfg.icon}</span>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: sCfg.dot }} />
                    <span>{selected.status || 'Yeni Kayıt'}</span>
                  </span>
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    padding: '3px 8px',
                    borderRadius: 6,
                    fontSize: 11.5,
                    fontWeight: 600,
                    background: pCfg.bg,
                    border: `1px solid ${pCfg.border}`,
                    color: pCfg.color
                  }}>
                    <span style={{ fontSize: 12 }}>{pCfg.icon}</span>
                    <span>{selected.priority || 'Normal'}</span>
                  </span>
                </div>
              </div>

              {/* Orta Alan: Kullanıcı, Konum, Cihaz, Seri No */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: 8,
                background: 'var(--color-surface-alt)',
                padding: '8px 12px',
                borderRadius: 6,
                border: '1px solid var(--color-border)',
                fontSize: 11.5
              }}>
                <div><span style={{ color: 'var(--color-text-muted)' }}>👤 Kullanıcı:</span> <strong style={{ color: 'var(--color-text)' }}>{selected.user_name || '—'}</strong></div>
                <div><span style={{ color: 'var(--color-text-muted)' }}>🏢 Konum:</span> <strong style={{ color: 'var(--color-text)' }}>{selected.location_name || '—'}</strong></div>
                <div><span style={{ color: 'var(--color-text-muted)' }}>💻 Cihaz:</span> <strong style={{ color: 'var(--color-text)' }}>{selected.asset_name || selected.model_name || '—'}</strong></div>
                <div><span style={{ color: 'var(--color-text-muted)' }}>🔢 Seri No:</span> <strong style={{ color: 'var(--color-text)' }}>{selected.serial_no || '—'}</strong></div>
              </div>

              {/* Alt Alan: Arıza ve Tespit/Not */}
              {(selected.fault_desc || selected.notes) && (
                <div style={{ display: 'grid', gridTemplateColumns: selected.fault_desc && selected.notes ? '1fr 1fr' : '1fr', gap: 8 }}>
                  {selected.fault_desc && (
                    <div style={{ fontSize: 11.5, background: 'rgba(239, 68, 68, 0.08)', padding: '6px 10px', borderRadius: 6, borderLeft: '3px solid #ef4444', color: 'var(--color-text)' }}>
                      <strong style={{ color: '#ef4444' }}>Arıza:</strong> {selected.fault_desc}
                    </div>
                  )}
                  {selected.notes && (
                    <div style={{ fontSize: 11.5, background: 'rgba(59, 130, 246, 0.08)', padding: '6px 10px', borderRadius: 6, borderLeft: '3px solid #3b82f6', color: 'var(--color-text)' }}>
                      <strong style={{ color: '#38bdf8' }}>Tespit / Not:</strong> {selected.notes}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })()}

        {viewMode === 'cards' ? (
          <div style={{ flex: 1, overflowY: 'auto', padding: 12, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 12, maxHeight: 'calc(100vh - 260px)' }}>
            {filteredTickets.length === 0 ? (
              <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: 40, color: 'var(--color-text-muted)', fontSize: 13 }}>
                Kriterlere uygun servis kaydı bulunamadı.
              </div>
            ) : (
              filteredTickets.map(t => {
                const sCfg = getStatusBadgeConfig(t.status);
                const pCfg = getPriorityBadgeConfig(t.priority);
                const isSelected = selectedTicketRow?.id === t.id;
                return (
                  <div
                    key={t.id}
                    onClick={() => setSelectedTicketRow(t)}
                    style={{
                      background: isSelected ? 'var(--color-surface)' : 'var(--color-surface-alt)',
                      border: `1px solid ${isSelected ? 'var(--color-primary-light, #60a5fa)' : 'var(--color-border)'}`,
                      borderRadius: 8,
                      padding: 14,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 10,
                      boxShadow: isSelected ? '0 4px 14px rgba(0,0,0,0.1)' : '0 1px 4px rgba(0,0,0,0.04)',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontWeight: 800, fontSize: 13, fontFamily: 'monospace', color: 'var(--color-primary-light, #60a5fa)' }}>{t.ticket_no}</span>
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            padding: '2px 6px',
                            borderRadius: 6,
                            fontSize: 10.5,
                            fontWeight: 600,
                            background: pCfg.bg,
                            border: `1px solid ${pCfg.border}`,
                            color: pCfg.color
                          }}>
                            <span>{pCfg.icon}</span>
                            <span>{t.priority || 'Normal'}</span>
                          </span>
                        </div>
                        <div style={{ fontSize: 10.5, color: 'var(--color-text-muted)', marginTop: 3 }}>📅 {formatDateTime(t.created_at)}</div>
                      </div>
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 5,
                        padding: '3px 8px',
                        borderRadius: 6,
                        fontSize: 11,
                        fontWeight: 600,
                        background: sCfg.bg,
                        border: `1px solid ${sCfg.border}`,
                        color: sCfg.color
                      }}>
                        <span style={{ fontSize: 10 }}>{sCfg.icon}</span>
                        <span>{t.status || 'Yeni Kayıt'}</span>
                      </span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, fontSize: 11, color: 'var(--color-text-secondary)', background: 'var(--color-surface)', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--color-border)' }}>
                      <div>👤 <b>Kullanıcı:</b> {t.user_name || '—'}</div>
                      <div>🏢 <b>Konum:</b> {t.location_name || '—'}</div>
                      <div>💻 <b>Cihaz:</b> {t.asset_name || t.model_name || '—'}</div>
                      <div>🔢 <b>Seri No:</b> {t.serial_no || '—'}</div>
                    </div>

                    {t.fault_desc && (
                      <div style={{ fontSize: 11.5, background: 'rgba(239, 68, 68, 0.08)', padding: '6px 10px', borderRadius: 6, borderLeft: '3px solid var(--color-danger)', color: 'var(--color-text)' }}>
                        <b>Arıza:</b> {t.fault_desc}
                      </div>
                    )}

                    <div style={{ display: 'flex', gap: 6, marginTop: 2 }} onClick={e => e.stopPropagation()}>
                      <button
                        className="btn btn-sm"
                        onClick={() => setDetailTicket(t)}
                        style={{
                          flex: 1,
                          fontSize: 11.5,
                          fontWeight: 600,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 5,
                          padding: '5px 8px',
                          borderRadius: 6,
                          background: 'rgba(59, 130, 246, 0.12)',
                          border: '1px solid rgba(59, 130, 246, 0.35)',
                          color: '#60a5fa'
                        }}
                      >
                        👁️ Detay
                      </button>
                      {hasPermission('service', 'can_edit') && (
                        <button
                          className="btn btn-sm"
                          onClick={() => { setEditTicket(t); setShowForm(true); }}
                          style={{
                            padding: '5px 10px',
                            fontSize: 12,
                            borderRadius: 6,
                            background: 'rgba(245, 158, 11, 0.12)',
                            border: '1px solid rgba(245, 158, 11, 0.35)',
                            color: '#fbbf24'
                          }}
                          title="Düzenle"
                        >
                          ✏️
                        </button>
                      )}
                      {hasPermission('service', 'can_delete') && (
                        <button
                          className="btn btn-sm"
                          onClick={() => setDeleteTarget(t)}
                          style={{
                            padding: '5px 10px',
                            fontSize: 12,
                            borderRadius: 6,
                            background: 'rgba(239, 68, 68, 0.12)',
                            border: '1px solid rgba(239, 68, 68, 0.35)',
                            color: '#f87171'
                          }}
                          title="Sil"
                        >
                          🗑️
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        ) : (
          <div className="legacy-grid-wrap">
            <div 
              className={theme === 'light' || theme === 'sakura' ? 'ag-theme-quartz' : 'ag-theme-quartz-dark'} 
              style={{ height: '100%', width: '100%' }}
            >
              <AgGridReact
                theme="legacy"
                rowData={loading && tickets.length === 0 ? undefined : filteredTickets}
                columnDefs={columnDefs}
                defaultColDef={defaultColDef}
                loadingOverlayComponent={() => <span>Yükleniyor...</span>}
                noRowsOverlayComponent={() => (
                  <div style={{ padding: 28, textAlign: 'center', color: 'var(--color-text-muted)' }}>
                    <div style={{ fontSize: 32, marginBottom: 8 }}>🔍</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text)' }}>
                      Aramanıza uygun kayıt bulunamadı.
                    </div>
                    <div style={{ fontSize: 11.5, marginTop: 4, color: 'var(--color-text-secondary)' }}>
                      Filtreleri temizleyerek tüm kayıtları yeniden görüntüleyebilirsiniz.
                    </div>
                    {hasAnyFilter && (
                      <button
                        type="button"
                        onClick={clearAllFilters}
                        className="btn btn-sm"
                        style={{
                          marginTop: 12,
                          padding: '5px 14px',
                          borderRadius: 6,
                          fontSize: 11.5,
                          fontWeight: 700,
                          background: 'rgba(239, 68, 68, 0.15)',
                          border: '1px solid rgba(239, 68, 68, 0.4)',
                          color: '#f87171',
                          cursor: 'pointer'
                        }}
                      >
                        ✕ Filtreleri Temizle
                      </button>
                    )}
                  </div>
                )}
                onRowClicked={params => setSelectedTicketRow(params.data)}
                onRowDoubleClicked={params => setDetailTicket(params.data)}
                rowHeight={36}
                headerHeight={40}
                suppressDragLeaveHidesColumns={true}
                pagination={true}
                paginationPageSize={50}
              />
            </div>
          </div>
        )}
      </div>

      {showForm && (
        <Modal isOpen title={editTicket ? 'Servis Fişini Düzenle' : 'Yeni Servis Kaydı'} size="xl" onClose={() => setShowForm(false)}>
          <ServiceTicketForm 
            ticket={editTicket} 
            onSave={() => { setShowForm(false); load(); }} 
            onCancel={() => setShowForm(false)} 
          />
        </Modal>
      )}

      {detailTicket && (
        <Modal isOpen title={`Servis Detayı: ${detailTicket.ticket_no}`} size="xl" onClose={() => setDetailTicket(null)}>
          <ServiceTicketDetail 
            ticket={detailTicket} 
            onUpdate={() => { load(); }} 
            onEdit={() => { setEditTicket(detailTicket); setDetailTicket(null); setShowForm(true); }}
          />
        </Modal>
      )}

      {deleteTarget && (
        <ConfirmDialog
          title="Kaydı Sil"
          message={`${deleteTarget.ticket_no} numaralı servis kaydı tamamen silinecek. Emin misiniz?`}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
          confirmText="Evet, Sil"
          type="danger"
        />
      )}

      {/* ── Excel Sütun Filtre Popover Menüsü ── */}
      {activeFilterDropdown && (
        <ColumnFilterPopover
          field={activeFilterDropdown.field}
          title={activeFilterDropdown.title}
          anchorRect={activeFilterDropdown.rect}
          allTickets={tickets}
          selectedValues={columnFilters[activeFilterDropdown.field] || []}
          onApply={(vals) => handleApplyColumnFilter(activeFilterDropdown.field, vals)}
          onClear={() => handleClearColumnFilter(activeFilterDropdown.field)}
          onClose={() => setActiveFilterDropdown(null)}
        />
      )}
    </div>
  );
}
