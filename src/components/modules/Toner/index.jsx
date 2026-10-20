import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { AgGridReact } from 'ag-grid-react';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-quartz.css';
import { useAuth } from '../../../context/AuthContext';
import { useApp } from '../../../context/AppContext';
import Modal from '../../common/Modal';
import ConfirmDialog from '../../common/ConfirmDialog';
import ExcelFilterHeader from '../ServiceTickets/ExcelFilterHeader';
import ColumnFilterPopover from '../ServiceTickets/ColumnFilterPopover';

export default function Toner({ tabData }) {
  const { user, hasPermission, auditLog } = useAuth();
  const { showNotification, theme, refreshToggle, tableRefreshVersions = {}, triggerRefresh, closeTab, activeTab: currentAppTab, isSnipeItEnabled } = useApp();
  const [activeTab, setActiveTab] = useState('stock');
  const [toners, setToners] = useState(() => {
    try {
      const saved = localStorage.getItem('cached_toner_items');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [changes, setChanges] = useState(() => {
    try {
      const saved = localStorage.getItem('cached_toner_changes');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [snipeUsers, setSnipeUsers] = useState(() => {
    try {
      const saved = localStorage.getItem('cached_snipeit_users');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [refs, setRefs] = useState(() => {
    try {
      const saved = localStorage.getItem('cached_toner_refs');
      return saved ? JSON.parse(saved) : { companies: [], categories: [], suppliers: [], manufacturers: [], locations: [] };
    } catch {
      return { companies: [], categories: [], suppliers: [], manufacturers: [], locations: [] };
    }
  });
  const [selectedToner, setSelectedToner] = useState(null);
  const [selectedChange, setSelectedChange] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncingHistory, setSyncingHistory] = useState(false);
  const loadedRef = useRef(false);
  
  // Forms
  const [showTonerForm, setShowTonerForm] = useState(false);
  const [showChangeForm, setShowChangeForm] = useState(() => Boolean(tabData?.openCheckout || tabData?.action === 'checkout'));

  useEffect(() => {
    if (tabData?.openCheckout || tabData?.action === 'checkout') {
      setShowChangeForm(true);
    }
  }, [tabData]);
  const [editToner, setEditToner] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteChangeTarget, setDeleteChangeTarget] = useState(null);
  const [viewMode, setViewMode] = useState(window.innerWidth < 768 ? 'cards' : 'table');
  const [searchText, setSearchText] = useState('');

  // Excel Sütun Filtreleri State
  const [columnFilters, setColumnFilters] = useState({});
  const [activeFilterDropdown, setActiveFilterDropdown] = useState(null);

  const handleOpenFilter = useCallback((field, displayName, rect) => {
    setActiveFilterDropdown({ field, displayName, rect });
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
    setOnlyCritical(false);
    setSearchText('');
  }, []);

  const activeColumnsCount = useMemo(() => {
    return Object.keys(columnFilters).filter(k => columnFilters[k]?.length > 0).length;
  }, [columnFilters]);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) {
        setViewMode('cards');
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const [onlyCritical, setOnlyCritical] = useState(() => Boolean(tabData?.onlyCritical || tabData?.filter === 'critical'));

  useEffect(() => {
    const handlePresetEvent = (e) => {
      if (e.detail?.targetTab === 'toner' && (e.detail?.onlyCritical || e.detail?.filter === 'critical')) {
        setOnlyCritical(true);
        setActiveTab('stock');
      }
    };
    window.addEventListener('service-tracker-preset', handlePresetEvent);
    return () => window.removeEventListener('service-tracker-preset', handlePresetEvent);
  }, []);

  useEffect(() => {
    if (tabData?.onlyCritical || tabData?.filter === 'critical') {
      setOnlyCritical(true);
      setActiveTab('stock');
    }
  }, [tabData?.onlyCritical, tabData?.timestamp, tabData]);

  const filteredToners = useMemo(() => {
    let list = toners;
    if (onlyCritical) {
      list = list.filter(t => (Number(t.qty) || 0) <= (Number(t.critical_qty || t.min_amt || 2)));
    }
    // Sütun filtreleri
    Object.entries(columnFilters).forEach(([field, selectedVals]) => {
      if (!selectedVals || selectedVals.length === 0) return;
      list = list.filter(t => {
        const val = (t[field] !== undefined && t[field] !== null && String(t[field]).trim() !== '') ? String(t[field]).trim() : '—';
        return selectedVals.includes(val);
      });
    });
    if (!searchText.trim()) return list;
    const q = searchText.toLowerCase().trim();
    return list.filter(t => 
      (t.toner_model || '').toLowerCase().includes(q) ||
      (t.toner_code || '').toLowerCase().includes(q) ||
      (t.company_name || '').toLowerCase().includes(q) ||
      (t.location_name || '').toLowerCase().includes(q) ||
      (t.model_number || '').toLowerCase().includes(q) ||
      (t.notes || '').toLowerCase().includes(q)
    );
  }, [toners, searchText, onlyCritical, columnFilters]);

  const filteredChanges = useMemo(() => {
    if (!searchText.trim()) return changes;
    const q = searchText.toLowerCase().trim();
    return changes.filter(c => 
      (c.toner_model || '').toLowerCase().includes(q) ||
      (c.target_name || '').toLowerCase().includes(q) ||
      (c.assigned_user_name || '').toLowerCase().includes(q) ||
      (c.asset_name || '').toLowerCase().includes(q) ||
      (c.notes || '').toLowerCase().includes(q) ||
      (c.change_date || '').toLowerCase().includes(q)
    );
  }, [changes, searchText]);

  const [tonerForm, setTonerForm] = useState({
    toner_code: '', toner_model: '', company_id: '', category_id: '',
    total_qty: 0, qty: 0, critical_qty: 2, supplier_id: '',
    manufacturer_id: '', location_id: '', model_number: '', item_no: '',
    order_number: '', purchase_date: '', unit_price: 0, notes: '',
  });
  const [changeForm, setChangeForm] = useState({ assigned_user_id: '', assigned_user_name: '', toner_id: '', change_date: new Date().toISOString().slice(0,10), qty: 1, notes: '' });

  const load = useCallback(async () => {
    if (!loadedRef.current) setLoading(true);
    try {
      const [t, c, u, companies, categories, suppliers, manufacturers, locations] = await Promise.all([
        window.electronAPI.query('SELECT * FROM toner_items WHERE is_active=1 ORDER BY toner_model', []),
        window.electronAPI.query(`
          SELECT tc.*,
            ti.toner_model,
            COALESCE(tc.assigned_user_name, cu.name, tc.asset_name, '—') AS target_name
          FROM toner_changes tc
          LEFT JOIN toner_items ti ON tc.toner_id = ti.id
          LEFT JOIN cached_users cu ON tc.assigned_user_id = cu.id
          ORDER BY tc.change_date DESC, tc.id DESC
        `, []),
        window.electronAPI.query('SELECT * FROM cached_users ORDER BY name ASC', []),
        window.electronAPI.query('SELECT * FROM cached_companies ORDER BY name ASC', []),
        window.electronAPI.query("SELECT * FROM cached_categories WHERE LOWER(category_type) LIKE '%sarf%' OR LOWER(category_type) LIKE '%consum%' ORDER BY name ASC", []),
        window.electronAPI.query('SELECT * FROM cached_suppliers ORDER BY name ASC', []),
        window.electronAPI.query('SELECT * FROM cached_manufacturers ORDER BY name ASC', []),
        window.electronAPI.query('SELECT * FROM cached_locations ORDER BY name ASC', []),
      ]);
      if (t.success) {
        setToners(t.data);
        try { localStorage.setItem('cached_toner_items', JSON.stringify(t.data)); } catch {}
      }
      if (c.success) {
        setChanges(c.data);
        try { localStorage.setItem('cached_toner_changes', JSON.stringify(c.data)); } catch {}
      }
      if (u.success) {
        setSnipeUsers(u.data);
      }
      const newRefs = {
        companies: companies.success ? companies.data : [],
        categories: categories.success ? categories.data : [],
        suppliers: suppliers.success ? suppliers.data : [],
        manufacturers: manufacturers.success ? manufacturers.data : [],
        locations: locations.success ? locations.data : [],
      };
      setRefs(newRefs);
      try { localStorage.setItem('cached_toner_refs', JSON.stringify(newRefs)); } catch {}
    } catch (err) {
      console.error('Toner verileri yüklenemedi:', err);
    } finally {
      loadedRef.current = true;
      setLoading(false);
    }
  }, []);

  const tonerRefreshVersion = [
    tableRefreshVersions.toner_items || 0,
    tableRefreshVersions.toner_changes || 0,
    tableRefreshVersions.cached_users || 0,
    tableRefreshVersions.cached_companies || 0,
    tableRefreshVersions.cached_categories || 0,
    tableRefreshVersions.cached_suppliers || 0,
    tableRefreshVersions.cached_manufacturers || 0,
    tableRefreshVersions.cached_locations || 0,
  ].join('|');

  useEffect(() => { load(); }, [load, refreshToggle, tonerRefreshVersion]);

  const syncSnipe = async () => {
    setSyncing(true);
    try {
      const res = await window.electronAPI.snipeitSync();
      if (res.success) {
        showNotification('Snipe-IT sarf malzemeleri senkronize edildi.', 'success');
        load();
      } else {
        showNotification('Senkronizasyon hatası: ' + (res.message || 'Bilinmeyen hata'), 'danger');
      }
    } catch (err) {
      showNotification('Senkronizasyon hatası: ' + err.message, 'danger');
    } finally {
      setSyncing(false);
    }
  };

  const syncHistory = async () => {
    setSyncingHistory(true);
    try {
      const res = await window.electronAPI.snipeitSyncCheckedout();
      if (res.success) {
        showNotification(`Snipe-IT checkout geçmişi senkronize edildi. ${res.synced} yeni kayıt eklendi.`, 'success');
        load();
      } else {
        showNotification('Geçmiş senkronizasyon hatası: ' + (res.message || 'Bilinmeyen hata'), 'danger');
      }
    } catch (err) {
      showNotification('Geçmiş senkronizasyon hatası: ' + err.message, 'danger');
    } finally {
      setSyncingHistory(false);
    }
  };

  const tonerColumns = useMemo(() => [
    {
      field: 'toner_code',
      headerName: 'Stok Kodu',
      width: 140,
      sortable: true,
      headerComponent: ExcelFilterHeader,
      headerComponentParams: {
        field: 'toner_code',
        displayName: 'Stok Kodu',
        isFiltered: Boolean(columnFilters.toner_code?.length),
        onOpenFilter: handleOpenFilter,
      },
      cellRenderer: params => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, fontFamily: 'monospace', fontSize: 11, color: 'var(--color-primary)' }}>
          <span style={{ opacity: 0.7 }}>🏷️</span>
          <span>{params.value || '—'}</span>
        </div>
      )
    },
    {
      field: 'toner_model',
      headerName: 'Adı',
      flex: 1,
      minWidth: 180,
      sortable: true,
      headerComponent: ExcelFilterHeader,
      headerComponentParams: {
        field: 'toner_model',
        displayName: 'Adı',
        isFiltered: Boolean(columnFilters.toner_model?.length),
        onOpenFilter: handleOpenFilter,
      },
      cellRenderer: params => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600, fontSize: 12 }}>
          <span style={{ fontSize: 13 }}>🖨️</span>
          <span style={{ color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{params.value || '—'}</span>
        </div>
      )
    },
    {
      field: 'category_name',
      headerName: 'Kategori',
      width: 140,
      sortable: true,
      headerComponent: ExcelFilterHeader,
      headerComponentParams: {
        field: 'category_name',
        displayName: 'Kategori',
        isFiltered: Boolean(columnFilters.category_name?.length),
        onOpenFilter: handleOpenFilter,
      },
      cellRenderer: params => params.value ? (
        <span style={{
          display: 'inline-block', padding: '2px 8px', borderRadius: 4, fontSize: 11,
          background: 'var(--color-surface-alt)', color: 'var(--color-text-secondary)',
          border: '1px solid var(--color-border)'
        }}>
          {params.value}
        </span>
      ) : <span style={{ color: 'var(--color-text-muted)' }}>—</span>
    },
    {
      field: 'item_no',
      headerName: 'Nesne No',
      width: 135,
      sortable: true,
      headerComponent: ExcelFilterHeader,
      headerComponentParams: {
        field: 'item_no',
        displayName: 'Nesne No',
        isFiltered: Boolean(columnFilters.item_no?.length),
        onOpenFilter: handleOpenFilter,
      },
      cellRenderer: params => params.value ? (
        <span style={{
          display: 'inline-block', padding: '2px 8px', borderRadius: 4, fontSize: 11,
          fontWeight: 600, fontFamily: 'monospace',
          background: 'rgba(14, 165, 233, 0.12)', color: '#0ea5e9', border: '1px solid rgba(14, 165, 233, 0.25)'
        }}>
          #{params.value}
        </span>
      ) : <span style={{ color: 'var(--color-text-muted)' }}>—</span>
    },
    {
      field: 'model_number',
      headerName: 'Model No',
      width: 135,
      sortable: true,
      headerComponent: ExcelFilterHeader,
      headerComponentParams: {
        field: 'model_number',
        displayName: 'Model No',
        isFiltered: Boolean(columnFilters.model_number?.length),
        onOpenFilter: handleOpenFilter,
      },
      cellRenderer: params => params.value ? (
        <span style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--color-text-secondary)' }}>
          {params.value}
        </span>
      ) : <span style={{ color: 'var(--color-text-muted)' }}>—</span>
    },
    {
      field: 'qty',
      headerName: 'Stok',
      width: 130,
      sortable: true,
      headerComponent: ExcelFilterHeader,
      headerComponentParams: {
        field: 'qty',
        displayName: 'Stok',
        isFiltered: Boolean(columnFilters.qty?.length),
        onOpenFilter: handleOpenFilter,
      },
      cellRenderer: params => {
        const isCritical = Number(params.data?.qty || 0) <= Number(params.data?.critical_qty || 0);
        return (
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            padding: '2px 9px', borderRadius: 20,
            background: isCritical ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
            color: isCritical ? '#dc2626' : '#10b981',
            border: `1px solid ${isCritical ? 'rgba(239, 68, 68, 0.3)' : 'rgba(16, 185, 129, 0.3)'}`,
            fontWeight: 800, fontSize: 11
          }}>
            <span>{isCritical ? '⚠️' : '✅'}</span>
            <span>{params.value} Adet</span>
          </div>
        );
      }
    },
    {
      field: 'critical_qty',
      headerName: 'Kritik',
      width: 110,
      sortable: true,
      headerComponent: ExcelFilterHeader,
      headerComponentParams: {
        field: 'critical_qty',
        displayName: 'Kritik',
        isFiltered: Boolean(columnFilters.critical_qty?.length),
        onOpenFilter: handleOpenFilter,
      },
      cellRenderer: params => (
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          padding: '2px 8px', borderRadius: 6,
          background: 'rgba(245, 158, 11, 0.12)', color: '#d97706',
          border: '1px solid rgba(245, 158, 11, 0.25)',
          fontWeight: 700, fontSize: 11
        }}>
          <span>🎯 {params.value}</span>
        </div>
      )
    },
    {
      field: 'location_name',
      headerName: 'Konum',
      width: 145,
      sortable: true,
      headerComponent: ExcelFilterHeader,
      headerComponentParams: {
        field: 'location_name',
        displayName: 'Konum',
        isFiltered: Boolean(columnFilters.location_name?.length),
        onOpenFilter: handleOpenFilter,
      },
      cellRenderer: params => params.value ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--color-text-secondary)' }}>
          <span style={{ color: '#ef4444' }}>📍</span>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{params.value}</span>
        </div>
      ) : <span style={{ color: 'var(--color-text-muted)' }}>—</span>
    },
    {
      field: 'unit_price',
      headerName: 'Birim TL',
      width: 125,
      sortable: true,
      headerComponent: ExcelFilterHeader,
      headerComponentParams: {
        field: 'unit_price',
        displayName: 'Birim TL',
        isFiltered: Boolean(columnFilters.unit_price?.length),
        onOpenFilter: handleOpenFilter,
      },
      cellRenderer: params => {
        const price = Number(params.value || 0);
        return (
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 3,
            padding: '2px 8px', borderRadius: 6,
            background: 'rgba(16, 185, 129, 0.12)', color: '#059669',
            border: '1px solid rgba(16, 185, 129, 0.25)',
            fontWeight: 700, fontSize: 11, fontFamily: 'monospace'
          }}>
            <span>₺</span>
            <span>{price.toFixed(2)}</span>
          </div>
        );
      }
    },
    {
      headerName: 'İşlem',
      width: 130,
      pinned: 'right',
      cellRenderer: params => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, height: '100%' }}>
          <button
            onClick={() => { setEditToner(params.data); setTonerForm(params.data); setShowTonerForm(true); }}
            title="Düzenle"
            style={{
              width: 28, height: 28, borderRadius: 6, border: '1px solid var(--color-border)',
              background: 'var(--color-surface)', color: 'var(--color-warning)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
              fontSize: 12, transition: 'all 0.15s ease'
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--color-warning-bg)'; e.currentTarget.style.borderColor = 'var(--color-warning)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'var(--color-surface)'; e.currentTarget.style.borderColor = 'var(--color-border)'; }}
          >
            ✏️
          </button>
          <button
            onClick={() => { setChangeForm(f => ({ ...f, toner_id: params.data.id })); setShowChangeForm(true); }}
            title="Toner Değişimi Yap"
            style={{
              width: 28, height: 28, borderRadius: 6, border: '1px solid var(--color-border)',
              background: 'var(--color-surface)', color: 'var(--color-accent)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
              fontSize: 12, transition: 'all 0.15s ease'
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--color-accent-bg)'; e.currentTarget.style.borderColor = 'var(--color-accent)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'var(--color-surface)'; e.currentTarget.style.borderColor = 'var(--color-border)'; }}
          >
            🔄
          </button>
          {user?.role === 'admin' && (
            <button
              onClick={() => setDeleteTarget(params.data)}
              title="Sil"
              style={{
                width: 28, height: 28, borderRadius: 6, border: '1px solid var(--color-border)',
                background: 'var(--color-surface)', color: 'var(--color-danger)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                fontSize: 12, transition: 'all 0.15s ease'
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--color-danger-bg)'; e.currentTarget.style.borderColor = 'var(--color-danger)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'var(--color-surface)'; e.currentTarget.style.borderColor = 'var(--color-border)'; }}
            >
              🗑️
            </button>
          )}
        </div>
      )
    }
  ], [user, columnFilters, handleOpenFilter]);

  const changeColumns = useMemo(() => [
    {
      field: 'change_date',
      headerName: 'Tarih',
      width: 130,
      cellRenderer: params => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--color-text-secondary)' }}>
          <span style={{ opacity: 0.7 }}>📅</span>
          <span>{params.value || '—'}</span>
        </div>
      )
    },
    {
      field: 'target_name',
      headerName: 'Kullanıcı / Hedef',
      flex: 1,
      minWidth: 160,
      cellRenderer: params => {
        if (!params.value || params.value === '—') return <span style={{ color: 'var(--color-text-muted)' }}>—</span>;
        const initials = params.value.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 22, height: 22, borderRadius: '50%',
              background: 'linear-gradient(135deg, #10b981, #0ea5e9)',
              color: '#fff', fontSize: 10, fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
            }}>{initials}</div>
            <span style={{ fontWeight: 500, fontSize: 12 }}>{params.value}</span>
          </div>
        );
      }
    },
    {
      field: 'toner_model',
      headerName: 'Sarf Malzemesi',
      width: 220,
      cellRenderer: params => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, fontSize: 12, color: 'var(--color-primary)' }}>
          <span>🖨️</span>
          <span>{params.value || '—'}</span>
        </div>
      )
    },
    {
      field: 'asset_name',
      headerName: 'Eski Yazıcı Kaydı',
      width: 200,
      cellRenderer: params => params.value ? (
        <span style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>{params.value}</span>
      ) : <span style={{ color: 'var(--color-text-muted)' }}>—</span>
    },
    {
      field: 'qty',
      headerName: 'Adet',
      width: 100,
      cellRenderer: params => (
        <span style={{
          display: 'inline-block', padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 700,
          background: 'rgba(99, 102, 241, 0.12)', color: 'var(--color-primary)', border: '1px solid rgba(99, 102, 241, 0.25)'
        }}>
          📦 {params.value || 1} Adet
        </span>
      )
    },
    { field: 'notes', headerName: 'Not', flex: 1 },
    {
      headerName: 'İşlem',
      width: 80,
      pinned: 'right',
      cellRenderer: params => (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
          <button
            onClick={() => setDeleteChangeTarget(params.data)}
            title="Sil"
            style={{
              width: 28, height: 28, borderRadius: 6, border: '1px solid var(--color-border)',
              background: 'var(--color-surface)', color: 'var(--color-danger)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
              fontSize: 12, transition: 'all 0.15s ease'
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--color-danger-bg)'; e.currentTarget.style.borderColor = 'var(--color-danger)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'var(--color-surface)'; e.currentTarget.style.borderColor = 'var(--color-border)'; }}
          >
            🗑️
          </button>
        </div>
      )
    }
  ], []);

  const saveToner = async () => {
    if (!tonerForm.toner_model?.trim()) {
      showNotification('Lütfen sarf malzemesi adı giriniz.', 'danger');
      return;
    }
    if (isSnipeItEnabled && !tonerForm.category_id) {
      showNotification('Snipe-IT için kategori seçimi zorunludur.', 'warning');
      return;
    }
    if (Number(tonerForm.total_qty) < 0 || Number(tonerForm.critical_qty) < 0 || Number(tonerForm.unit_price) < 0) {
      showNotification('Stok, kritik seviye ve fiyat negatif olamaz.', 'warning');
      return;
    }
    setSaving(true);
    if (!isSnipeItEnabled) {
      let res;
      if (editToner?.id || tonerForm.id) {
        const tId = editToner?.id || tonerForm.id;
        res = await window.electronAPI.run(
          'UPDATE toner_items SET toner_model=?, qty=?, critical_qty=?, model_number=?, item_no=?, order_number=?, purchase_date=?, unit_price=?, notes=? WHERE id=?',
          [tonerForm.toner_model, Number(tonerForm.total_qty || tonerForm.qty) || 0, Number(tonerForm.critical_qty) || 0, tonerForm.model_number || null, tonerForm.item_no || null, tonerForm.order_number || null, tonerForm.purchase_date || null, Number(tonerForm.unit_price) || 0, tonerForm.notes || null, tId]
        );
      } else {
        const qtyVal = Number(tonerForm.total_qty || tonerForm.qty) || 0;
        res = await window.electronAPI.run(
          'INSERT INTO toner_items (toner_model, qty, available_qty, critical_qty, model_number, item_no, order_number, purchase_date, unit_price, notes, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)',
          [tonerForm.toner_model, qtyVal, qtyVal, Number(tonerForm.critical_qty) || 0, tonerForm.model_number || null, tonerForm.item_no || null, tonerForm.order_number || null, tonerForm.purchase_date || null, Number(tonerForm.unit_price) || 0, tonerForm.notes || null]
        );
      }
      setSaving(false);
      if (res?.success) {
        setShowTonerForm(false);
        showNotification('Sarf malzemesi başarıyla kaydedildi.', 'success');
        triggerRefresh();
        load();
      } else {
        showNotification('Kayıt hatası: ' + (res?.message || 'Bilinmeyen hata'), 'danger');
      }
      return;
    }

    const res = await window.electronAPI.snipeitSaveConsumable({
      id: tonerForm.snipeit_consumable_id || null,
      name: tonerForm.toner_model,
      company_id: tonerForm.company_id || null,
      category_id: tonerForm.category_id,
      qty: Number(tonerForm.total_qty || tonerForm.qty) || 0,
      min_amt: Number(tonerForm.critical_qty) || 0,
      supplier_id: tonerForm.supplier_id || null,
      manufacturer_id: tonerForm.manufacturer_id || null,
      location_id: tonerForm.location_id || null,
      model_number: tonerForm.model_number || null,
      item_no: tonerForm.item_no || null,
      order_number: tonerForm.order_number || null,
      purchase_date: tonerForm.purchase_date || null,
      purchase_cost: Number(tonerForm.unit_price) || 0,
      notes: tonerForm.notes || null,
    });
    setSaving(false);
    if (res.success) {
      setShowTonerForm(false);
      showNotification('Sarf malzemesi Snipe-IT üzerinde kaydedildi ve senkronize edildi.', 'success');
      triggerRefresh();
      load();
    } else {
      showNotification('Snipe-IT kayıt hatası: ' + (res.message || 'Bilinmeyen hata'), 'danger');
    }
  };

  const deleteToner = async () => {
    if (!deleteTarget) return;
    const res = await window.electronAPI.run('UPDATE toner_items SET is_active=0 WHERE id=?', [deleteTarget.id]);
    setDeleteTarget(null);
    if (res.success) {
      await auditLog({
        action: 'DELETE',
        module: 'toner',
        refId: deleteTarget.id,
        description: `${deleteTarget.toner_model || deleteTarget.toner_code || 'Sarf malzemesi'} stoktan kaldırıldı.`,
        oldValue: deleteTarget
      });
      showNotification('Sarf malzemesi stoktan kaldırıldı.', 'success');
      load();
    } else {
      showNotification('Silme işlemi başarısız: ' + (res.message || 'Bilinmeyen hata'), 'danger');
    }
  };

  const deleteChange = async () => {
    if (!deleteChangeTarget) return;
    const qty = Number(deleteChangeTarget.qty || 1);
    const res = await window.electronAPI.transaction([
      {
        sql: 'UPDATE toner_items SET qty = qty + ?, available_qty = COALESCE(available_qty, 0) + ? WHERE id=?',
        params: [qty, qty, deleteChangeTarget.toner_id],
      },
      {
        sql: 'DELETE FROM toner_changes WHERE id=?',
        params: [deleteChangeTarget.id],
      },
    ]);
    setDeleteChangeTarget(null);
    if (res.success) {
      await auditLog({
        action: 'DELETE',
        module: 'toner',
        refId: deleteChangeTarget.id,
        description: `${deleteChangeTarget.toner_model || 'Sarf malzemesi'} çıkış kaydı silindi; stok geri alındı.`,
        oldValue: deleteChangeTarget
      });
      showNotification('Çıkış kaydı silindi ve yerel stok geri alındı.', 'success');
      load();
    } else {
      showNotification('Çıkış kaydı silinemedi: ' + (res.message || 'Bilinmeyen hata'), 'danger');
    }
  };

  const saveChange = async () => {
    const selectedUser = snipeUsers.find(u => u.id == changeForm.assigned_user_id);
    const recipientName = (changeForm.assigned_user_name || '').trim() || selectedUser?.name || '';

    if (!changeForm.toner_id) {
      showNotification('Lütfen sarf malzemesi seçiniz.', 'warning');
      return;
    }
    if (!recipientName && (!isSnipeItEnabled || !changeForm.assigned_user_id)) {
      showNotification('Lütfen sarf malzemesi teslim edilecek personel adını giriniz.', 'warning');
      return;
    }
    const qty = Number(changeForm.qty || 0);
    if (!Number.isFinite(qty) || qty <= 0) {
      showNotification('Lütfen geçerli bir adet giriniz.', 'warning');
      return;
    }
    setSaving(true);
    const toner = toners.find(t => t.id == changeForm.toner_id);
    if (!toner || Number(toner.qty) < qty) {
      showNotification('Seçilen sarf malzemesinde yeterli stok yok.', 'warning');
      setSaving(false);
      return;
    }
    if (isSnipeItEnabled && toner.snipeit_consumable_id && selectedUser) {
      const checkoutRes = await window.electronAPI.snipeitCheckoutConsumable({
        consumableId: toner.snipeit_consumable_id,
        assignedTo: selectedUser.id,
        qty,
        notes: changeForm.notes || null,
      });
      if (!checkoutRes.success) {
        showNotification('Snipe-IT çıkış hatası: ' + (checkoutRes.message || 'Bilinmeyen hata'), 'danger');
        setSaving(false);
        return;
      }
    }
    const stockRes = await window.electronAPI.run(
      'UPDATE toner_items SET qty = qty - ?, available_qty = CASE WHEN COALESCE(available_qty, qty) - ? < 0 THEN 0 ELSE COALESCE(available_qty, qty) - ? END WHERE id=? AND qty >= ?',
      [qty, qty, qty, changeForm.toner_id, qty]
    );
    if (!stockRes.success || stockRes.changes === 0) {
      showNotification('Sarf malzemesi stok güncellemesi yapılamadı.', 'danger');
      setSaving(false);
      return;
    }
    const res1 = await window.electronAPI.run(
      'INSERT INTO toner_changes (asset_id, asset_name, toner_id, change_date, user_id, assigned_user_id, assigned_user_name, page_count, qty, notes) VALUES (?,?,?,?,?,?,?,?,?,?)',
      [null, null, changeForm.toner_id, changeForm.change_date, user?.id || null, selectedUser?.id || null, recipientName, null, qty, changeForm.notes || null]
    );
    if (!res1.success) {
      await window.electronAPI.run('UPDATE toner_items SET qty = qty + ?, available_qty = COALESCE(available_qty, 0) + ? WHERE id=?', [qty, qty, changeForm.toner_id]);
      showNotification('Değişim kaydedilemedi: ' + res1.message, 'danger');
      setSaving(false);
      return;
    }
    setShowChangeForm(false);
    setChangeForm({ assigned_user_id: '', assigned_user_name: '', toner_id: '', change_date: new Date().toISOString().slice(0,10), qty: 1, notes: '' });
    showNotification(`${recipientName} personeline ${qty} adet ${toner.toner_model} çıkışı yapıldı.`, 'success');
    setSaving(false);
    triggerRefresh();
    if (auditLog && res1.lastInsertRowid) {
      await auditLog({
        action: 'CREATE',
        module: 'toner',
        refId: res1.lastInsertRowid,
        description: `${recipientName} kullanıcısına ${qty} adet ${toner.toner_model || 'sarf malzemesi'} çıkışı yapıldı.`
      });
    }
  };

  const selected = activeTab === 'stock'
    ? (selectedToner || toners[0] || {})
    : (selectedChange || changes[0] || {});
  const totalQty = toners.reduce((sum, toner) => sum + Number(toner.qty || 0), 0);
  const criticalCount = toners.filter(toner => Number(toner.qty || 0) <= Number(toner.critical_qty || 0)).length;
  const tonerValue = toners.reduce((sum, toner) => sum + (Number(toner.qty || 0) * Number(toner.unit_price || 0)), 0);

  return (
    <div className="legacy-erp">
      <div className="legacy-workspace">
        <div className="legacy-titlebar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
          <div style={{ fontWeight: 800, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
            🖨️ Sarf Malzeme & Toner Takip
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>
              {activeTab === 'stock' ? `${toners.length} sarf` : `${changes.length} kayıt`}
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

        {/* Sekme ve Senkronizasyon Başlık Çubuğu */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 10,
          padding: '8px 14px',
          background: 'var(--color-surface)',
          borderBottom: '1px solid var(--color-border)'
        }}>
          {/* Sekme Butonları */}
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              type="button"
              className={`btn btn-sm ${activeTab === 'stock' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setActiveTab('stock')}
              style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, borderRadius: 8, padding: '5px 14px' }}
            >
              <span>📦</span>
              <span>Sarf Stok ({toners.length})</span>
            </button>
            <button
              type="button"
              className={`btn btn-sm ${activeTab === 'history' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setActiveTab('history')}
              style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, borderRadius: 8, padding: '5px 14px' }}
            >
              <span>🕒</span>
              <span>Değişim Geçmişi ({changes.length})</span>
            </button>
          </div>
        </div>

        {/* Ana İşlem & Hızlı Arama Ribbon Çubuğu */}
        <div className="legacy-ribbon" style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', padding: '8px 14px', background: 'var(--color-surface)', borderBottom: '1px solid var(--color-border)' }}>
          {/* Sol Taraf: Ekleme, Düzenleme & Çıkış */}
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            {hasPermission('toner', 'can_create') && (
              <button
                type="button"
                className="btn btn-sm btn-primary"
                onClick={() => {
                  setEditToner(null);
                  setTonerForm({
                    toner_code: '',
                    toner_model: '',
                    company_id: '',
                    category_id: refs.categories.find(c => c.name?.toLocaleLowerCase('tr-TR') === 'toner')?.id || '',
                    total_qty: 0,
                    qty: 0,
                    critical_qty: 2,
                    supplier_id: '',
                    manufacturer_id: '',
                    location_id: '',
                    model_number: '',
                    item_no: '',
                    order_number: '',
                    purchase_date: '',
                    unit_price: 0,
                    notes: '',
                  });
                  setShowTonerForm(true);
                }}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 14px', fontWeight: 700, fontSize: 12, borderRadius: 8 }}
              >
                <span>➕</span>
                <span>Yeni Sarf</span>
              </button>
            )}

            {hasPermission('toner', 'can_edit') && (
              <button
                type="button"
                className="btn btn-sm btn-secondary"
                onClick={() => selectedToner?.id && (setEditToner(selectedToner), setTonerForm(selectedToner), setShowTonerForm(true))}
                disabled={!selectedToner?.id}
                style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', fontSize: 12, borderRadius: 8, opacity: selectedToner?.id ? 1 : 0.5 }}
              >
                <span>✏️</span>
                <span>Düzenle</span>
              </button>
            )}

            {hasPermission('toner', 'can_create') && (
              <button
                type="button"
                className="btn btn-sm btn-success"
                onClick={() => setShowChangeForm(true)}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 14px', fontWeight: 700, fontSize: 12, borderRadius: 8 }}
              >
                <span>🔄</span>
                <span>Toner Çıkışı Yap</span>
              </button>
            )}
          </div>

          {/* Dikey Ayrıcı Çizgi */}
          <div style={{ width: 1, height: 22, background: 'var(--color-border)', margin: '0 2px' }} />

          {/* Araçlar: Yenile */}
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <button
              type="button"
              className="btn btn-sm btn-secondary"
              onClick={load}
              disabled={loading}
              title="Tüm toner ve sarf stoğunu canlı yenile"
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

            {activeTab === 'stock' && (
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => setOnlyCritical(prev => !prev)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '5px 12px',
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 600,
                  background: onlyCritical ? 'rgba(239, 68, 68, 0.2)' : 'var(--color-surface-hover)',
                  border: `1px solid ${onlyCritical ? '#ef4444' : 'var(--color-border)'}`,
                  color: onlyCritical ? '#ef4444' : 'var(--color-text)',
                  cursor: 'pointer'
                }}
                title="Yalnızca kritik stok seviyesindeki tonerleri listele"
              >
                <span>🚨</span>
                <span>{onlyCritical ? 'Kritik Filtresi Aktif' : 'Sadece Kritik'}</span>
              </button>
            )}

            {(activeColumnsCount > 0 || onlyCritical) && activeTab === 'stock' && (
              <button
                type="button"
                className="btn btn-sm"
                onClick={clearAllFilters}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '5px 12px',
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 600,
                  background: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid rgba(239, 68, 68, 0.4)',
                  color: '#ef4444',
                  cursor: 'pointer'
                }}
                title="Tüm sütun ve kritik filtrelerini sıfırla"
              >
                <span>✕ Tüm Filtreleri Temizle</span>
                {activeColumnsCount > 0 && (
                  <span style={{
                    background: '#ef4444',
                    color: '#fff',
                    borderRadius: 10,
                    padding: '1px 6px',
                    fontSize: 10,
                    fontWeight: 700
                  }}>
                    {activeColumnsCount}
                  </span>
                )}
              </button>
            )}
          </div>

          {/* Hızlı Arama Kutusu (Sağ Tarafta Doğrudan Açık) */}
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ position: 'relative', width: 300 }}>
              <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 13, color: 'var(--color-text-muted)', pointerEvents: 'none' }}>🔍</span>
              <input
                type="text"
                className="form-control"
                value={searchText}
                onChange={e => setSearchText(e.target.value)}
                placeholder={activeTab === 'stock' ? "Sarf adı, stok kodu, şirket ara..." : "Personel, sarf adı veya not ara..."}
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

        {/* Aktif Filtre Bilgi Çubuğu */}
        {(onlyCritical || activeColumnsCount > 0) && activeTab === 'stock' && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
            padding: '6px 14px',
            background: 'rgba(249, 115, 22, 0.08)',
            borderBottom: '1px solid rgba(249, 115, 22, 0.25)',
            fontSize: 12,
            flexWrap: 'wrap'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ color: 'var(--color-text-secondary)', fontWeight: 600 }}>Aktif Filtreler:</span>
              {onlyCritical && (
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  padding: '2px 8px',
                  borderRadius: 6,
                  background: 'rgba(239, 68, 68, 0.18)',
                  border: '1px solid rgba(239, 68, 68, 0.35)',
                  color: '#ef4444',
                  fontSize: 11,
                  fontWeight: 700
                }}>
                  <span>🚨 Sadece Kritik</span>
                  <span
                    onClick={() => setOnlyCritical(false)}
                    style={{ cursor: 'pointer', padding: '0 2px', fontWeight: 800 }}
                    title="Filtreyi Kaldır"
                  >✕</span>
                </span>
              )}
              {Object.entries(columnFilters).map(([field, vals]) => {
                if (!vals || vals.length === 0) return null;
                const fieldNames = {
                  toner_code: 'Stok Kodu',
                  toner_model: 'Adı',
                  category_name: 'Kategori',
                  item_no: 'Nesne No',
                  model_number: 'Model No',
                  qty: 'Stok',
                  critical_qty: 'Kritik',
                  location_name: 'Konum',
                  unit_price: 'Birim TL'
                };
                const label = fieldNames[field] || field;
                return (
                  <span
                    key={field}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 5,
                      padding: '2px 8px',
                      borderRadius: 6,
                      background: 'rgba(249, 115, 22, 0.18)',
                      border: '1px solid rgba(249, 115, 22, 0.35)',
                      color: '#f97316',
                      fontSize: 11,
                      fontWeight: 700
                    }}
                  >
                    <span>{label}: {vals.length === 1 ? vals[0] : `${vals.length} değer`}</span>
                    <span
                      onClick={() => handleClearColumnFilter(field)}
                      style={{ cursor: 'pointer', padding: '0 2px', fontWeight: 800 }}
                      title={`${label} filtresini kaldır`}
                    >✕</span>
                  </span>
                );
              })}
            </div>
            <button
              type="button"
              className="btn btn-xs"
              onClick={clearAllFilters}
              style={{
                background: '#ef4444',
                color: '#fff',
                border: 'none',
                borderRadius: 4,
                padding: '3px 10px',
                cursor: 'pointer',
                fontSize: 11,
                fontWeight: 600
              }}
            >
              ✕ Tümünü Temizle
            </button>
          </div>
        )}

        {/* Seçili Sarf / Kayıt Önizleme Paneli (Modern ve Gözü Yormayan Kart) */}
        {viewMode !== 'cards' && (
          <div style={{
            background: 'var(--color-surface)',
            borderBottom: '1px solid var(--color-border)',
            padding: '8px 14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 10,
            fontSize: 12
          }}>
            {activeTab === 'stock' ? (
              selectedToner?.id ? (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 14 }}>🖨️</span>
                      <strong style={{ fontSize: 13, color: 'var(--color-primary)' }}>{selectedToner.toner_model}</strong>
                    </div>
                    {selectedToner.toner_code && (
                      <span style={{ fontFamily: 'monospace', color: 'var(--color-text-muted)', background: 'var(--color-surface-alt)', padding: '2px 6px', borderRadius: 4, border: '1px solid var(--color-border)' }}>
                        🏷️ {selectedToner.toner_code}
                      </span>
                    )}
                    {selectedToner.company_name && (
                      <span style={{ color: 'var(--color-text-secondary)' }}>🏢 {selectedToner.company_name}</span>
                    )}
                    {selectedToner.location_name && (
                      <span style={{ color: 'var(--color-text-muted)' }}>📍 {selectedToner.location_name}</span>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className={`badge ${Number(selectedToner.qty || 0) <= Number(selectedToner.critical_qty || 0) ? 'badge-danger' : 'badge-success'}`} style={{ fontSize: 11.5, fontWeight: 700 }}>
                      📦 Mevcut: {selectedToner.qty || 0} Adet
                    </span>
                    <span className="badge badge-secondary" style={{ fontSize: 11 }}>
                      ⚠️ Kritik: {selectedToner.critical_qty || 2} Adet
                    </span>
                    {selectedToner.unit_price > 0 && (
                      <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>
                        💰 ₺{Number(selectedToner.unit_price).toFixed(2)}
                      </span>
                    )}
                  </div>
                </>
              ) : (
                <div style={{ color: 'var(--color-text-muted)' }}>Bir sarf malzemesi seçerek detaylarını görebilirsiniz.</div>
              )
            ) : (
              selectedChange?.id ? (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 14 }}>👤</span>
                      <strong style={{ fontSize: 13, color: 'var(--color-primary)' }}>{selectedChange.target_name || selectedChange.assigned_user_name || '—'}</strong>
                    </div>
                    <span style={{ color: 'var(--color-text)' }}>🖨️ {selectedChange.toner_model || 'Sarf Malzemesi'}</span>
                    <span style={{ color: 'var(--color-text-muted)' }}>📅 {selectedChange.change_date || '—'}</span>
                    {selectedChange.notes && <span style={{ color: 'var(--color-text-secondary)', fontStyle: 'italic' }}>📝 {selectedChange.notes}</span>}
                  </div>
                  <span className="badge badge-primary" style={{ fontSize: 11.5, fontWeight: 700 }}>
                    📦 Çıkış: {selectedChange.qty || 1} Adet
                  </span>
                </>
              ) : (
                <div style={{ color: 'var(--color-text-muted)' }}>Bir değişim kaydı seçerek detaylarını görebilirsiniz.</div>
              )
            )}
          </div>
        )}

        {viewMode === 'cards' ? (
          <div style={{ flex: 1, overflowY: 'auto', padding: 10, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10, maxHeight: 'calc(100vh - 280px)' }}>
            {activeTab === 'stock' ? (
              filteredToners.length === 0 ? (
                <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: 40, color: 'var(--color-text-muted)', fontSize: 13 }}>
                  Kriterlere uygun sarf malzemesi bulunamadı.
                </div>
              ) : (
                filteredToners.map(t => {
                  const isCrit = Number(t.qty || 0) <= Number(t.critical_qty || 0);
                  return (
                    <div
                      key={t.id}
                      onClick={() => setSelectedToner(t)}
                      style={{
                        background: selectedToner?.id === t.id ? 'var(--color-surface)' : 'var(--color-surface-alt)',
                        border: `1px solid ${selectedToner?.id === t.id ? 'var(--color-primary)' : isCrit ? 'rgba(239, 68, 68, 0.4)' : 'var(--color-border)'}`,
                        borderRadius: 8,
                        padding: 12,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 8,
                        boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                        cursor: 'pointer'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--color-primary)' }}>🖨️ {t.toner_model}</div>
                          {t.model_number && <div style={{ fontSize: 10.5, color: 'var(--color-text-muted)', marginTop: 2 }}>Model No: {t.model_number}</div>}
                        </div>
                        <span className={`badge ${isCrit ? 'badge-danger' : 'badge-success'}`} style={{ fontSize: 11, fontWeight: 700 }}>
                          {t.qty || 0} Adet
                        </span>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, fontSize: 11, color: 'var(--color-text-secondary)', background: 'var(--color-surface)', padding: '6px 8px', borderRadius: 6, border: '1px solid var(--color-border)' }}>
                        <div>🏢 <b>Şirket:</b> {t.company_name || '—'}</div>
                        <div>📍 <b>Konum:</b> {t.location_name || '—'}</div>
                        <div>⚠️ <b>Kritik:</b> {t.critical_qty || 2} Adet</div>
                        <div>💰 <b>Fiyat:</b> {t.unit_price ? `₺${Number(t.unit_price).toFixed(2)}` : '—'}</div>
                      </div>

                      <div style={{ display: 'flex', gap: 6, marginTop: 2 }} onClick={e => e.stopPropagation()}>
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => {
                            setChangeForm({ assigned_user_id: '', toner_id: String(t.id), change_date: new Date().toISOString().slice(0,10), qty: 1, notes: '' });
                            setShowChangeForm(true);
                          }}
                          style={{ flex: 1, fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, padding: '5px 8px' }}
                        >
                          🔄 Değişim Yap
                        </button>
                        {hasPermission('toner', 'can_edit') && (
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => { setEditToner(t); setTonerForm(t); setShowTonerForm(true); }}
                            style={{ padding: '5px 10px', fontSize: 12 }}
                            title="Düzenle"
                          >
                            ✏️
                          </button>
                        )}
                        {hasPermission('toner', 'can_delete') && (
                          <button
                            className="btn btn-danger btn-sm"
                            onClick={() => setDeleteTarget(t)}
                            style={{ padding: '5px 10px', fontSize: 12 }}
                            title="Sil"
                          >
                            🗑️
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )
            ) : (
              filteredChanges.length === 0 ? (
                <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: 40, color: 'var(--color-text-muted)', fontSize: 13 }}>
                  Kriterlere uygun değişim kaydı bulunamadı.
                </div>
              ) : (
                filteredChanges.map(c => (
                  <div
                    key={c.id}
                    onClick={() => setSelectedChange(c)}
                    style={{
                      background: selectedChange?.id === c.id ? 'var(--color-surface)' : 'var(--color-surface-alt)',
                      border: `1px solid ${selectedChange?.id === c.id ? 'var(--color-primary)' : 'var(--color-border)'}`,
                      borderRadius: 8,
                      padding: 12,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                      boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                      cursor: 'pointer'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--color-primary)' }}>🖨️ {c.toner_model || 'Sarf Malzemesi'}</div>
                        <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 2 }}>👤 {c.target_name || c.assigned_user_name || '—'}</div>
                      </div>
                      <span className="badge badge-primary" style={{ fontSize: 11, fontWeight: 700 }}>
                        {c.qty || 1} Adet
                      </span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--color-text-muted)', background: 'var(--color-surface)', padding: '5px 8px', borderRadius: 4, border: '1px solid var(--color-border)' }}>
                      <span>📅 <b>Tarih:</b> {c.change_date || '—'}</span>
                      {c.notes && <span>📝 {c.notes}</span>}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 2 }} onClick={e => e.stopPropagation()}>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => setDeleteChangeTarget(c)}
                        style={{ padding: '4px 10px', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}
                      >
                        🗑️ Kaydı Sil
                      </button>
                    </div>
                  </div>
                ))
              )
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
                rowData={activeTab === 'stock' ? filteredToners : filteredChanges}
                columnDefs={activeTab === 'stock' ? tonerColumns : changeColumns}
                defaultColDef={{ resizable: true, sortable: true }}
                noRowsOverlayComponent={() => (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, padding: 30, color: 'var(--color-text-muted)' }}>
                    <span style={{ fontSize: 32 }}>🔍</span>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>Aramanıza uygun sarf malzemesi bulunamadı.</span>
                    {(activeColumnsCount > 0 || onlyCritical || searchText) && (
                      <button
                        onClick={clearAllFilters}
                        className="btn btn-secondary btn-sm"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, borderRadius: 6, fontSize: 11, padding: '4px 12px' }}
                      >
                        <span>✕</span>
                        <span>Filtreleri Temizle</span>
                      </button>
                    )}
                  </div>
                )}
                rowHeight={36}
                headerHeight={40}
                suppressDragLeaveHidesColumns={true}
                onRowClicked={params => activeTab === 'stock' ? setSelectedToner(params.data) : setSelectedChange(params.data)}
              />
            </div>
          </div>
        )}

        <div className="legacy-summary-strip">
          <span className="legacy-summary-box">Listelenen <b>{activeTab === 'stock' ? filteredToners.length : filteredChanges.length}</b></span>
          <span className="legacy-summary-box">Stokta <b>{totalQty} Adet</b></span>
          <span className="legacy-summary-box">Kritik <b>{criticalCount} Kalem</b></span>
          <span className="legacy-summary-box">Stok Değeri <b>₺{tonerValue.toFixed(2)}</b></span>
        </div>
      </div>

      {/* Sarf Malzemesi Modal */}
      {showTonerForm && (
        <Modal isOpen title={editToner ? 'Sarf Malzemesi Düzenle' : 'Yeni Sarf Malzemesi'} size="lg" onClose={() => setShowTonerForm(false)}>
          <div className="form-grid-2" style={{ padding: 10 }}>
            {isSnipeItEnabled && (
              <div className="form-group form-col-span-2"><label>Şirket</label>
                <select value={tonerForm.company_id || ''} onChange={e => setTonerForm(f => ({ ...f, company_id: e.target.value }))}>
                  <option value="">— Seçin —</option>
                  {refs.companies.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}
                </select>
              </div>
            )}
            <div className="form-group form-col-span-2"><label className="required">Adı / Modeli</label><input value={tonerForm.toner_model || ''} onChange={e => setTonerForm(f => ({ ...f, toner_model: e.target.value }))} placeholder="Örn: HP 85A Siyah Toner" /></div>
            <div className="form-group form-col-span-2"><label className={isSnipeItEnabled ? "required" : ""}>Kategori</label>
              <select value={tonerForm.category_id || ''} onChange={e => setTonerForm(f => ({ ...f, category_id: e.target.value }))}>
                <option value="">— Seçin —</option>
                {refs.categories.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}
              </select>
            </div>
            <div className="form-group"><label>Miktar</label><input type="number" min="0" value={tonerForm.total_qty ?? tonerForm.qty ?? 0} onChange={e => setTonerForm(f => ({ ...f, total_qty: e.target.value }))} /></div>
            <div className="form-group"><label>Min. Miktar</label><input type="number" min="0" value={tonerForm.critical_qty || 0} onChange={e => setTonerForm(f => ({ ...f, critical_qty: e.target.value }))} /></div>
            <div className="form-group form-col-span-2"><label>Tedarikçi</label>
              <select value={tonerForm.supplier_id || ''} onChange={e => setTonerForm(f => ({ ...f, supplier_id: e.target.value }))}>
                <option value="">— Seçin —</option>
                {refs.suppliers.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}
              </select>
            </div>
            <div className="form-group form-col-span-2"><label>Üretici</label>
              <select value={tonerForm.manufacturer_id || ''} onChange={e => setTonerForm(f => ({ ...f, manufacturer_id: e.target.value }))}>
                <option value="">— Seçin —</option>
                {refs.manufacturers.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}
              </select>
            </div>
            <div className="form-group form-col-span-2"><label>Konum</label>
              <select value={tonerForm.location_id || ''} onChange={e => setTonerForm(f => ({ ...f, location_id: e.target.value }))}>
                <option value="">— Seçin —</option>
                {refs.locations.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}
              </select>
            </div>
            <div className="form-group"><label>Model No.</label><input value={tonerForm.model_number || ''} onChange={e => setTonerForm(f => ({ ...f, model_number: e.target.value }))} /></div>
            <div className="form-group"><label>Nesne Numarası</label><input value={tonerForm.item_no || ''} onChange={e => setTonerForm(f => ({ ...f, item_no: e.target.value, toner_code: e.target.value }))} /></div>
            <div className="form-group"><label>Sipariş Numarası</label><input value={tonerForm.order_number || ''} onChange={e => setTonerForm(f => ({ ...f, order_number: e.target.value }))} /></div>
            <div className="form-group"><label>Satın Alma Tarihi</label><input type="date" value={tonerForm.purchase_date || ''} onChange={e => setTonerForm(f => ({ ...f, purchase_date: e.target.value }))} /></div>
            <div className="form-group"><label>Birim Maliyeti (₺)</label><input type="number" min="0" step="0.01" value={tonerForm.unit_price || 0} onChange={e => setTonerForm(f => ({ ...f, unit_price: e.target.value }))} /></div>
            {isSnipeItEnabled && (
              <div className="form-group"><label>Snipe ID</label><input value={tonerForm.snipeit_consumable_id || ''} readOnly /></div>
            )}
            <div className="form-group form-col-span-2"><label>Notlar</label><textarea value={tonerForm.notes || ''} onChange={e => setTonerForm(f => ({ ...f, notes: e.target.value }))} rows={3} /></div>
          </div>
          <div className="flex-gap" style={{ justifyContent: 'flex-end', padding: 15 }}>
            <button className="btn btn-secondary" onClick={() => setShowTonerForm(false)}>İptal</button>
            <button className="btn btn-primary" onClick={saveToner} disabled={saving}>Kaydet</button>
          </div>
        </Modal>
      )}

      {/* Değişim Modal */}
      {showChangeForm && (
        <Modal isOpen title="Sarf Malzemesi Çıkışı Kaydet" size="md" onClose={() => setShowChangeForm(false)}>
          <div className="form-grid-2" style={{ padding: 10 }}>
            {isSnipeItEnabled ? (
              <div className="form-group form-col-span-2">
                <label>Kullanıcı Seçiniz (Snipe-IT)</label>
                <select value={changeForm.assigned_user_id} onChange={e => setChangeForm(f => ({ ...f, assigned_user_id: e.target.value }))}>
                  <option value="">— Kullanıcı Seçin —</option>
                  {snipeUsers.map(u => (
                    <option key={u.id} value={u.id}>
                      {u.name}{u.department_name ? ` — ${u.department_name}` : ''}{u.location_name ? ` / ${u.location_name}` : ''}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="form-group form-col-span-2">
                <label>Kime Verildi (Personel Adı) *</label>
                <input
                  type="text"
                  placeholder="Personel adı ve soyadını giriniz..."
                  value={changeForm.assigned_user_name}
                  onChange={e => setChangeForm(f => ({ ...f, assigned_user_name: e.target.value }))}
                  required
                />
              </div>
            )}
            <div className="form-group form-col-span-2">
              <label>Sarf Malzemesi Seçiniz</label>
              <select value={changeForm.toner_id} onChange={e => setChangeForm(f => ({ ...f, toner_id: e.target.value }))}>
                <option value="">— Sarf Malzemesi Seçin —</option>
                {toners.map(t => <option key={t.id} value={t.id}>{t.toner_model} (Stok: {t.qty})</option>)}
              </select>
            </div>
            <div className="form-group"><label>Tarih</label><input type="date" value={changeForm.change_date} onChange={e => setChangeForm(f => ({ ...f, change_date: e.target.value }))} /></div>
            <div className="form-group"><label>Adet</label><input type="number" min="1" value={changeForm.qty} onChange={e => setChangeForm(f => ({ ...f, qty: e.target.value }))} /></div>
            <div className="form-group form-col-span-2"><label>Notlar</label><textarea value={changeForm.notes} onChange={e => setChangeForm(f => ({ ...f, notes: e.target.value }))} rows={2} /></div>
          </div>
          <div className="flex-gap" style={{ justifyContent: 'flex-end', padding: 15 }}>
            <button className="btn btn-secondary" onClick={() => setShowChangeForm(false)}>İptal</button>
            <button className="btn btn-primary" onClick={saveChange} disabled={saving}>Kaydı Tamamla</button>
          </div>
        </Modal>
      )}

      {deleteTarget && (
        <ConfirmDialog
          title="Sarf Malzemesini Sil"
          message={`"${deleteTarget.toner_model}" sarf malzemesi stoktan kaldırılacak. Emin misiniz?`}
          onConfirm={deleteToner}
          onCancel={() => setDeleteTarget(null)}
          confirmText="Evet, Sil"
          type="danger"
        />
      )}

      {deleteChangeTarget && (
        <ConfirmDialog
          title="Çıkış Kaydını Sil"
          message={`"${deleteChangeTarget.toner_model}" için ${deleteChangeTarget.qty || 1} adetlik çıkış kaydı silinecek. Emin misiniz?`}
          onConfirm={deleteChange}
          onCancel={() => setDeleteChangeTarget(null)}
          confirmText="Evet, Sil"
          type="danger"
        />
      )}

      {/* Excel Sütun Filtresi Popover */}
      {activeFilterDropdown && (
        <ColumnFilterPopover
          field={activeFilterDropdown.field}
          title={activeFilterDropdown.displayName || activeFilterDropdown.field}
          anchorRect={activeFilterDropdown.rect}
          allTickets={activeTab === 'stock' ? toners : changes}
          selectedValues={columnFilters[activeFilterDropdown.field] || []}
          onApply={(vals) => handleApplyColumnFilter(activeFilterDropdown.field, vals)}
          onClear={() => handleClearColumnFilter(activeFilterDropdown.field)}
          onClose={() => setActiveFilterDropdown(null)}
        />
      )}
    </div>
  );
}
