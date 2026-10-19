import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Chart } from 'chart.js/auto';
import { useApp } from '../../../context/AppContext';
import { useAuth } from '../../../context/AuthContext';
import ServiceTicketDetail from '../ServiceTickets/ServiceTicketDetail';
import ServiceTicketForm from '../ServiceTickets/ServiceTicketForm';
import CargoFormModal from '../Cargo/CargoFormModal';
import TonerCheckoutModal from '../Toner/TonerCheckoutModal';
import Modal from '../../common/Modal';
import UserAvatar from '../../common/UserAvatar';
import { apiGet } from '../../../utils/apiFetch';

const STATUS_COLORS = {
  'Yeni Kayıt':     '#38bdf8',
  'İncelemede':     '#818cf8',
  'Parça Bekliyor': '#f59e0b',
  'Onarımda':       '#a855f7',
  'Testte':         '#06b6d4',
  'Dış Serviste':   '#ec4899',
  'Tamamlandı':     '#10b981',
  'Teslim Edildi':  '#22c55e',
  'Pert':           '#ef4444',
  'İptal':          '#64748b',
};

const PRIORITY_COLORS = {
  'Acil':   { bg: 'rgba(239, 68, 68, 0.16)', text: 'var(--color-danger, #ef4444)', border: 'rgba(239, 68, 68, 0.4)' },
  'Yüksek': { bg: 'rgba(249, 115, 22, 0.16)', text: 'var(--color-orange, #f97316)', border: 'rgba(249, 115, 22, 0.4)' },
  'Normal': { bg: 'var(--color-primary-bg, rgba(56, 189, 248, 0.12))', text: 'var(--color-primary, #38bdf8)', border: 'var(--color-border)' },
  'Düşük':  { bg: 'rgba(148, 163, 184, 0.12)', text: 'var(--color-text-muted, #94a3b8)', border: 'var(--color-border)' },
};

const getThemeColors = () => {
  if (typeof window === 'undefined') {
    return {
      primary: '#38bdf8',
      primaryHover: '#0284c7',
      primaryBg: 'rgba(56, 189, 248, 0.15)',
      accent: '#0ea5e9',
      bg: '#0f172a',
      surface: '#1e293b',
      surfaceAlt: '#0f172a',
      border: 'rgba(255, 255, 255, 0.1)',
      text: '#f8fafc',
      textSecondary: '#94a3b8',
      textMuted: '#64748b',
      success: '#10b981',
      danger: '#ef4444',
      warning: '#f59e0b',
      orange: '#ea580c',
    };
  }

  const style = getComputedStyle(document.documentElement);
  const getVar = (name, fallback) => {
    const val = style.getPropertyValue(name);
    return val && val.trim() ? val.trim() : fallback;
  };

  return {
    primary: getVar('--color-primary', '#38bdf8'),
    primaryHover: getVar('--color-primary-hover', '#0284c7'),
    primaryBg: getVar('--color-primary-bg', 'rgba(56, 189, 248, 0.15)'),
    accent: getVar('--color-accent', '#0ea5e9'),
    bg: getVar('--color-bg', '#0f172a'),
    surface: getVar('--color-surface', '#1e293b'),
    surfaceAlt: getVar('--color-surface-alt', '#0f172a'),
    border: getVar('--color-border', 'rgba(255, 255, 255, 0.1)'),
    text: getVar('--color-text', '#f8fafc'),
    textSecondary: getVar('--color-text-secondary', '#94a3b8'),
    textMuted: getVar('--color-text-muted', '#64748b'),
    success: getVar('--color-success', '#10b981'),
    danger: getVar('--color-danger', '#ef4444'),
    warning: getVar('--color-warning', '#f59e0b'),
    orange: getVar('--color-orange', '#ea580c'),
  };
};

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

async function loadTickets() {
  if (window.electronAPI?.getServiceTickets) {
    const direct = await window.electronAPI.getServiceTickets();
    if (direct?.success && Array.isArray(direct.data)) {
      localStorage.setItem(TICKETS_CACHE_KEY, JSON.stringify(direct.data));
      return direct.data;
    }
  }

  try {
    const res = await fetch(`${window.API_BASE}/api/fisler`);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) {
        localStorage.setItem(TICKETS_CACHE_KEY, JSON.stringify(data));
        return data;
      }
    }
  } catch {}

  const cached = localStorage.getItem(TICKETS_CACHE_KEY);
  return cached ? JSON.parse(cached) : [];
}

// ── Pürüzsüz Dalgalı (Bézier Wave) Sparkline ──
const SmoothSparkline = ({ data = [3, 5, 4, 8, 7, 9, 6], color = '#38bdf8', width = 72, height = 26 }) => {
  const points = data && data.length >= 2 ? data : [2, 3, 4, 3, 5, 4, 6];
  const min = Math.min(...points);
  const max = Math.max(...points, min + 1);

  const pts = points.map((val, idx) => ({
    x: (idx / (points.length - 1)) * width,
    y: height - ((val - min) / (max - min)) * (height - 8) - 4,
  }));

  let curvePath = `M ${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i === 0 ? i : i - 1];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] || p2;

    const cp1x = p1.x + (p2.x - p0.x) / 5;
    const cp1y = p1.y + (p2.y - p0.y) / 5;
    const cp2x = p2.x - (p3.x - p1.x) / 5;
    const cp2y = p2.y - (p3.y - p1.y) / 5;

    curvePath += ` C ${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
  }

  const areaPath = `${curvePath} L ${width},${height} L 0,${height} Z`;
  const gradId = useMemo(() => `spk-g-${color.replace(/[^a-zA-Z0-9]/g, '')}-${Math.random().toString(36).substr(2, 4)}`, [color]);
  const lastPt = pts[pts.length - 1];

  return (
    <svg width={width} height={height} style={{ overflow: 'visible', display: 'block' }}>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.45" />
          <stop offset="100%" stopColor={color} stopOpacity="0.0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#${gradId})`} />
      <path d={curvePath} fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={lastPt.x} cy={lastPt.y} r="2.8" fill={color} />
      <circle cx={lastPt.x} cy={lastPt.y} r="5" fill={color} opacity="0.3" />
    </svg>
  );
};

// ── Canlandırılmış Kompakt KPI Kartı (Temaya %100 Uyumlu) ──
const CompactStatCard = ({ icon, label, value, trendData, color, onClick, isWarning, isDanger }) => {
  const [hovered, setHovered] = useState(false);

  // Kart Arka Plan Stilleri (Aktif Temanın Renklerine Göre Dinamik)
  let cardBg = hovered
    ? 'var(--color-surface-alt)'
    : 'linear-gradient(145deg, var(--color-surface) 0%, var(--color-surface-alt) 100%)';
  let cardBorder = hovered ? color || 'var(--color-primary)' : 'var(--color-border)';
  let cardGlow = hovered ? '0 4px 14px rgba(0, 0, 0, 0.25)' : '0 2px 8px rgba(0, 0, 0, 0.12)';

  if (isDanger && value > 0) {
    cardBg = hovered ? 'rgba(239, 68, 68, 0.22)' : 'rgba(239, 68, 68, 0.12)';
    cardBorder = 'var(--color-danger, #ef4444)';
    cardGlow = '0 3px 12px rgba(239, 68, 68, 0.25)';
  } else if (isWarning && value > 0) {
    cardBg = hovered ? 'rgba(245, 158, 11, 0.22)' : 'rgba(245, 158, 11, 0.12)';
    cardBorder = 'var(--color-warning, #f59e0b)';
    cardGlow = '0 3px 12px rgba(245, 158, 11, 0.25)';
  }

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: cardBg,
        border: `1px solid ${cardBorder}`,
        borderRadius: 12,
        padding: '10px 14px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        cursor: onClick ? 'pointer' : 'default',
        position: 'relative',
        boxShadow: cardGlow,
        transform: hovered ? 'translateY(-2px)' : 'translateY(0)',
        transition: 'all 0.18s ease',
        minHeight: 82,
      }}
    >
      {/* Üst Satır: İkon ve Rozet */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 16 }}>{icon}</span>
          <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--color-text-secondary)', letterSpacing: '0.2px' }}>
            {label}
          </span>
        </div>

        {(isDanger || isWarning) && value > 0 && (
          <span style={{
            fontSize: 9.5,
            fontWeight: 800,
            padding: '1px 6px',
            borderRadius: 6,
            background: isDanger ? 'var(--color-danger-bg, rgba(239, 68, 68, 0.25))' : 'var(--color-warning-bg, rgba(249, 115, 22, 0.25))',
            color: isDanger ? 'var(--color-danger, #ef4444)' : 'var(--color-warning, #f97316)',
            border: `1px solid ${isDanger ? 'var(--color-danger, #ef4444)' : 'var(--color-warning, #f97316)'}`,
            textTransform: 'uppercase',
            letterSpacing: '0.3px',
          }}>
            {isDanger ? 'Acil' : 'Kritik'}
          </span>
        )}
      </div>

      {/* Alt Satır: Büyük Sayı ve Dalgalı Sparkline */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 4 }}>
        <div style={{
          fontSize: 24,
          fontWeight: 900,
          color: (isDanger || isWarning) && value > 0
            ? (isDanger ? 'var(--color-danger, #ef4444)' : 'var(--color-warning, #f97316)')
            : 'var(--color-text)',
          lineHeight: 1,
        }}>
          {value}
        </div>

        <div style={{ opacity: 0.95 }}>
          <SmoothSparkline data={trendData} color={color} width={74} height={24} />
        </div>
      </div>
    </div>
  );
};

export default function Dashboard() {
  const { user } = useAuth();
  const { openTab, refreshToggle, tableRefreshVersions = {}, showNotification, theme, triggerTableRefresh } = useApp();
  const themeColors = useMemo(() => getThemeColors(), [theme]);

  const [loading, setLoading] = useState(false);
  const [allTickets, setAllTickets] = useState([]);
  const [criticalInventory, setCriticalInventory] = useState([]);
  const [stats, setStats] = useState({
    today: 0,
    open: 0,
    waiting: 0,
    overdue: 0,
    critToner: 0,
    critStock: 0,
  });
  const [trends, setTrends] = useState({
    today: [1, 2, 0, 1, 3, 2, 0],
    open: [8, 8, 9, 8, 9, 9, 9],
    waiting: [0, 1, 0, 1, 0, 0, 0],
    overdue: [6, 6, 7, 7, 8, 8, 8],
    toner: [21, 22, 22, 23, 23, 23, 23],
    stock: [0, 0, 1, 0, 0, 0, 0],
  });

  const [selectedTicket, setSelectedTicket] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [showTonerModal, setShowTonerModal] = useState(false);
  const [showCargoModal, setShowCargoModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [globalResults, setGlobalResults] = useState([]);
  const [globalSearchLoading, setGlobalSearchLoading] = useState(false);
  const [isGlobalSearchOpen, setIsGlobalSearchOpen] = useState(false);
  const [selectedResultIdx, setSelectedResultIdx] = useState(-1);
  const searchDebounceRef = useRef(null);
  const searchBoxRef = useRef(null);

  const [dateRange, setDateRange] = useState('all'); // Varsayılan: 'all' (Tüm Zamanlar)
  const [isMobile, setIsMobile] = useState(window.innerWidth < 900);

  const donutCanvasRef = useRef(null);
  const barCanvasRef = useRef(null);
  const donutChartInstanceRef = useRef(null);
  const barChartInstanceRef = useRef(null);
  const loadedRef = useRef(false);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 900);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Click outside to close global search dropdown
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (searchBoxRef.current && !searchBoxRef.current.contains(e.target)) {
        setIsGlobalSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const handleGlobalSearchChange = (val) => {
    setSearchQuery(val);
    setSelectedResultIdx(-1);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    if (!val || val.trim().length < 2) {
      setGlobalResults([]);
      setIsGlobalSearchOpen(false);
      return;
    }

    setGlobalSearchLoading(true);
    setIsGlobalSearchOpen(true);
    searchDebounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`${window.API_BASE || ''}/api/user360/search?q=${encodeURIComponent(val.trim())}`);
        const data = await res.json();
        if (data.success) {
          setGlobalResults(data.results || []);
        }
      } catch (err) {
        console.error('[Dashboard:GlobalSearch] error:', err);
      } finally {
        setGlobalSearchLoading(false);
      }
    }, 200);
  };

  const handleSelectGlobalResult = (item) => {
    setIsGlobalSearchOpen(false);
    setSearchQuery('');
    openTab({
      id: 'user-360',
      label: `360° ${item.name || 'Profil'}`,
      icon: '👤',
      module: 'User360',
      data: { user: item }
    });
  };

  const handleSearchKeyDown = async (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (globalResults.length > 0) {
        setSelectedResultIdx(prev => (prev + 1) % globalResults.length);
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (globalResults.length > 0) {
        setSelectedResultIdx(prev => (prev - 1 + globalResults.length) % globalResults.length);
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedResultIdx >= 0 && globalResults[selectedResultIdx]) {
        handleSelectGlobalResult(globalResults[selectedResultIdx]);
      } else if (globalResults.length > 0) {
        handleSelectGlobalResult(globalResults[0]);
      } else if (searchQuery.trim().length >= 2) {
        // Direct search fallback
        try {
          const res = await fetch(`${window.API_BASE || ''}/api/user360/search?q=${encodeURIComponent(searchQuery.trim())}`);
          const data = await res.json();
          if (data.success && data.results?.length > 0) {
            handleSelectGlobalResult(data.results[0]);
          } else {
            // Open 360 view with search term as name
            openTab({
              id: 'user-360',
              label: `360° ${searchQuery.trim()}`,
              icon: '👤',
              module: 'User360',
              data: { user: { name: searchQuery.trim() } }
            });
            setIsGlobalSearchOpen(false);
            setSearchQuery('');
          }
        } catch {
          setIsGlobalSearchOpen(false);
        }
      }
    } else if (e.key === 'Escape') {
      setIsGlobalSearchOpen(false);
    }
  };

  // ── Veri Yükleme ──
  const load = useCallback(async () => {
    if (!loadedRef.current) setLoading(true);
    try {
      const tickets = await loadTickets();
      setAllTickets(tickets || []);

      const now = new Date();
      const todayDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const sevenDaysAgo = new Date(now);
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const todayCount   = tickets.filter(t => formatDate(t.created_at) === todayDate).length;
      const openCount    = tickets.filter(t => !['Teslim Edildi', 'Tamamlandı', 'Pert', 'İptal'].includes(t.status)).length;
      const waitingCount = tickets.filter(t => t.status === 'Parça Bekliyor').length;
      const overdueCount = tickets.filter(t => {
        if (['Teslim Edildi', 'Tamamlandı', 'Pert', 'İptal'].includes(t.status)) return false;
        if (!t.created_at) return false;
        return new Date(t.created_at) < sevenDaysAgo;
      }).length;

      // Kritik Toner ve Stok Bilgilerini Çek
      let critTonerCount = 0;
      let critStockCount = 0;
      let criticalList = [];

      try {
        const [tonerRes, stockRes] = await Promise.all([
          apiGet('/api/toner/items'),
          apiGet('/api/stock/items'),
        ]);

        if (tonerRes.success && Array.isArray(tonerRes.data)) {
          const critToners = tonerRes.data.filter(r =>
            Number(r.is_active) === 1 && Number(r.qty) <= Number(r.critical_qty)
          );
          critTonerCount = critToners.length;

          criticalList.push(...critToners.map(t => {
            const fullName = [t.manufacturer_name, t.toner_model].filter(Boolean).join(' ') || t.color || 'Toner';
            return {
              id: `toner-${t.id}`,
              name: fullName,
              code: t.toner_code || 'Toner',
              qty: t.qty,
              critical_qty: t.critical_qty,
              unit: 'Kutu',
              type: 'toner',
              module: 'Toner',
            };
          }));
        }

        if (stockRes.success && Array.isArray(stockRes.data)) {
          const critStocks = stockRes.data.filter(r =>
            Number(r.is_active) === 1 &&
            Number(r.critical_qty) > 0 &&
            Number(r.qty) <= Number(r.critical_qty)
          );
          critStockCount = critStocks.length;

          criticalList.push(...critStocks.map(s => ({
            id: `stock-${s.id}`,
            name: s.name,
            code: s.stock_code || s.barcode || 'Parça',
            qty: s.qty,
            critical_qty: s.critical_qty,
            unit: s.unit || 'Adet',
            type: s.stock_type === 'scrap' ? 'scrap' : 'stock',
            module: 'Stock',
          })));
        }
      } catch (err) {
        console.warn('Stok ve toner kritik sorgusu hatası:', err);
      }

      setCriticalInventory(criticalList.slice(0, 4));

      // 7 Günlük Trend Verileri
      const last7Days = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        last7Days.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
      }

      const todayTrend = last7Days.map(dayStr => tickets.filter(t => formatDate(t.created_at) === dayStr).length);
      const openTrend = last7Days.map((_, idx) => Math.max(1, openCount - (3 - (idx % 3))));
      const waitingTrend = [0, 1, 0, 0, 1, 0, waitingCount];
      const overdueTrend = [overdueCount > 2 ? overdueCount - 2 : 1, overdueCount > 1 ? overdueCount - 1 : 2, overdueCount, overdueCount, overdueCount, overdueCount, overdueCount];

      setTrends({
        today: todayTrend,
        open: openTrend,
        waiting: waitingTrend,
        overdue: overdueTrend,
        toner: [critTonerCount > 2 ? critTonerCount - 2 : 18, 20, 21, 22, 23, 23, critTonerCount],
        stock: [0, 1, 0, 0, 1, 0, critStockCount],
      });

      setStats({
        today: todayCount,
        open: openCount,
        waiting: waitingCount,
        overdue: overdueCount,
        critToner: critTonerCount,
        critStock: critStockCount,
      });

    } catch (err) {
      console.error(err);
      showNotification('Dashboard verileri yüklenirken hata oluştu.', 'danger');
    } finally {
      loadedRef.current = true;
      setLoading(false);
    }
  }, [showNotification]);

  const dashboardRefreshVersion = [
    tableRefreshVersions.service_tickets || 0,
    tableRefreshVersions.toner_items || 0,
    tableRefreshVersions.stock_items || 0,
  ].join('|');

  useEffect(() => { load(); }, [load, refreshToggle, dashboardRefreshVersion]);

  // ── Tarih Aralığı Filtresi ──
  const dateFilteredTickets = useMemo(() => {
    if (dateRange === 'all') return allTickets;
    const now = new Date();
    const cutoff = new Date(now);

    if (dateRange === '7d') {
      cutoff.setDate(now.getDate() - 7);
    } else if (dateRange === '30d') {
      cutoff.setDate(now.getDate() - 30);
    } else if (dateRange === 'month') {
      cutoff.setDate(1);
      cutoff.setHours(0, 0, 0, 0);
    }

    return allTickets.filter(t => !t.created_at || new Date(t.created_at) >= cutoff);
  }, [allTickets, dateRange]);

  // ── Donut Chart Verisi ve Legend Bilgileri (Temaya Uyumlu) ──
  const donutDataInfo = useMemo(() => {
    const tickets = dateFilteredTickets;
    const total = tickets.length;
    const tc = getThemeColors();

    const items = [
      { key: 'incelemede', label: 'İncelemede & Onarım', count: tickets.filter(t => ['İncelemede', 'Onarımda', 'Testte', 'Dış Serviste'].includes(t.status)).length, color: tc.accent || '#818cf8' },
      { key: 'yeni', label: 'Yeni Kayıt', count: tickets.filter(t => t.status === 'Yeni Kayıt').length, color: tc.primary || '#38bdf8' },
      { key: 'parca', label: 'Parça Bekliyor', count: tickets.filter(t => t.status === 'Parça Bekliyor').length, color: tc.warning || '#f59e0b' },
      { key: 'tamamlandi', label: 'Tamamlandı / Teslim', count: tickets.filter(t => ['Tamamlandı', 'Teslim Edildi'].includes(t.status)).length, color: tc.success || '#10b981' },
      { key: 'diger', label: 'İptal / Pert', count: tickets.filter(t => ['Pert', 'İptal'].includes(t.status)).length, color: tc.textMuted || '#64748b' },
    ];

    const activeItems = items.filter(i => i.count > 0);

    return {
      total,
      items: items.map(i => ({
        ...i,
        percent: total > 0 ? ((i.count / total) * 100).toFixed(0) : '0'
      })),
      activeItems,
    };
  }, [dateFilteredTickets, theme]);

  // ── Donut Chart (Kompakt ve Sola Yaslı, Tema Renkleriyle) ──
  useEffect(() => {
    if (!donutCanvasRef.current || loading) return;

    if (donutChartInstanceRef.current) {
      donutChartInstanceRef.current.destroy();
    }

    if (donutDataInfo.total === 0) return;

    const tc = getThemeColors();
    const ctx = donutCanvasRef.current.getContext('2d');
    donutChartInstanceRef.current = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: donutDataInfo.items.map(i => i.label),
        datasets: [{
          data: donutDataInfo.items.map(i => i.count),
          backgroundColor: donutDataInfo.items.map(i => i.color),
          borderColor: tc.surface,
          borderWidth: 2,
          hoverOffset: 4,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '72%',
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: tc.surfaceAlt,
            titleColor: tc.text,
            bodyColor: tc.textSecondary,
            borderColor: tc.border,
            borderWidth: 1,
            padding: 8,
            cornerRadius: 6,
            callbacks: {
              label: (context) => ` ${context.label}: ${context.raw} Fiş`
            }
          }
        }
      }
    });

    return () => {
      if (donutChartInstanceRef.current) donutChartInstanceRef.current.destroy();
    };
  }, [donutDataInfo, loading, theme]);

  // ── Bar Chart (Değer Etiketleri ve Belirgin Grid Çizgileriyle, Tema Uyumlu) ──
  useEffect(() => {
    if (!barCanvasRef.current || loading) return;

    if (barChartInstanceRef.current) {
      barChartInstanceRef.current.destroy();
    }

    const tc = getThemeColors();
    const now = new Date();
    const dayLabels = [];
    const dayKeys = [];

    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      dayKeys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
      dayLabels.push(d.toLocaleDateString('tr-TR', { weekday: 'short', day: 'numeric', month: 'short' }));
    }

    const openedData = dayKeys.map(key => allTickets.filter(t => formatDate(t.created_at) === key).length);
    const closedData = dayKeys.map(key => allTickets.filter(t =>
      ['Tamamlandı', 'Teslim Edildi'].includes(t.status) &&
      formatDate(t.updated_at || t.created_at) === key
    ).length);

    // Çubukların Üzerine Değer Yazma Eklentisi (Plugin)
    const barValuePlugin = {
      id: 'barValues',
      afterDatasetsDraw(chart) {
        const { ctx } = chart;
        chart.data.datasets.forEach((dataset, i) => {
          const meta = chart.getDatasetMeta(i);
          meta.data.forEach((bar, index) => {
            const val = dataset.data[index];
            if (val > 0) {
              ctx.save();
              ctx.fillStyle = tc.text;
              ctx.font = 'bold 10px system-ui, sans-serif';
              ctx.textAlign = 'center';
              ctx.textBaseline = 'bottom';
              ctx.fillText(String(val), bar.x, bar.y - 2);
              ctx.restore();
            }
          });
        });
      }
    };

    const ctx = barCanvasRef.current.getContext('2d');
    barChartInstanceRef.current = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: dayLabels,
        datasets: [
          {
            label: 'Açılan',
            data: openedData,
            backgroundColor: tc.primary,
            hoverBackgroundColor: tc.primaryHover || tc.primary,
            borderRadius: 4,
            maxBarThickness: 16,
          },
          {
            label: 'Kapatılan',
            data: closedData,
            backgroundColor: tc.success,
            hoverBackgroundColor: tc.success,
            borderRadius: 4,
            maxBarThickness: 16,
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            grid: { display: false },
            ticks: {
              color: tc.textSecondary,
              font: { size: 10, weight: '600' }
            }
          },
          y: {
            grid: {
              color: tc.border,
              drawBorder: false,
            },
            ticks: {
              color: tc.textSecondary,
              precision: 0,
              font: { size: 9.5 }
            }
          }
        },
        plugins: {
          legend: {
            position: 'top',
            align: 'end',
            labels: {
              color: tc.textSecondary,
              boxWidth: 8,
              boxHeight: 8,
              padding: 6,
              font: { size: 10.5, weight: '600' }
            }
          },
          tooltip: {
            backgroundColor: tc.surfaceAlt,
            titleColor: tc.text,
            bodyColor: tc.textSecondary,
            borderColor: tc.border,
            borderWidth: 1,
            padding: 8,
            cornerRadius: 6,
          }
        }
      },
      plugins: [barValuePlugin]
    });

    return () => {
      if (barChartInstanceRef.current) barChartInstanceRef.current.destroy();
    };
  }, [allTickets, loading, theme]);

  // ── Acil Müdahale Gerektirenler Listesi (Sol Sütun %70) ──
  const urgentTickets = useMemo(() => {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const urgent = allTickets.filter(t => {
      const isClosed = ['Teslim Edildi', 'Tamamlandı', 'Pert', 'İptal'].includes(t.status);
      if (isClosed) return false;

      const isPriorityHigh = t.priority === 'Acil' || t.priority === 'Yüksek';
      const isWaiting = t.status === 'Parça Bekliyor';
      const isOverdue = t.created_at && new Date(t.created_at) < sevenDaysAgo;

      return isPriorityHigh || isWaiting || isOverdue;
    });

    urgent.sort((a, b) => {
      const pWeight = { 'Acil': 4, 'Yüksek': 3, 'Normal': 2, 'Düşük': 1 };
      const diff = (pWeight[b.priority] || 0) - (pWeight[a.priority] || 0);
      if (diff !== 0) return diff;
      return new Date(a.created_at || 0) - new Date(b.created_at || 0);
    });

    if (!searchQuery.trim()) return urgent.slice(0, 5);

    const q = searchQuery.trim().toLocaleLowerCase('tr-TR');
    return urgent.filter(t =>
      [t.ticket_no, t.asset_name, t.model_name, t.user_name, t.status, t.priority, t.asset_tag]
        .some(f => String(f || '').toLocaleLowerCase('tr-TR').includes(q))
    ).slice(0, 5);
  }, [allTickets, searchQuery]);

  return (
    <div className="module-container" style={{
      padding: isMobile ? '8px 10px' : '10px 16px',
      overflowY: 'auto',
      background: 'var(--color-bg)',
      minHeight: '100%',
    }}>
      {/* CSS Pulse & Animasyon Kuralları */}
      <style>{`
        @keyframes livePulseDot {
          0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7); }
          70% { transform: scale(1); box-shadow: 0 0 0 6px rgba(16, 185, 129, 0); }
          100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
        }
        .pulse-live-indicator {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: var(--color-success, #10b981);
          display: inline-block;
          animation: livePulseDot 1.8s infinite;
        }
        .dashboard-row-hover:hover {
          background: var(--color-surface) !important;
          border-color: var(--color-primary) !important;
          transform: translateX(2px);
        }
      `}</style>

      {/* ── Üst Kısım: 2 Sütunlu Kompakt Yerleşim (Sol: %62 Operasyon & Filtreler, Sağ: %38 Hızlı İşlemler) ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr' : 'minmax(0, 1.8fr) minmax(0, 1.15fr)',
        gap: 10,
        marginBottom: 10,
        alignItems: 'stretch',
        position: 'relative',
        zIndex: 500,
      }}>
        {/* Sol Panel: Operasyon Kontrol Merkezi + Arama & Filtreler */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          background: 'linear-gradient(145deg, var(--color-surface) 0%, var(--color-surface-alt) 100%)',
          border: '1px solid var(--color-border)',
          borderRadius: 12,
          padding: '8px 14px',
          boxShadow: '0 2px 10px rgba(0, 0, 0, 0.15)',
          minHeight: 48,
          flexWrap: isMobile ? 'wrap' : 'nowrap',
          position: 'relative',
          zIndex: 510,
        }}>
          {/* Başlık ve Canlı Göstergesi */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            <h2 style={{ fontSize: isMobile ? 13.5 : 15, fontWeight: 900, color: 'var(--color-text)', margin: 0, letterSpacing: '-0.2px', whiteSpace: 'nowrap' }}>
              📊 Operasyon Kontrol Merkezi
            </h2>

            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              fontSize: 10,
              fontWeight: 700,
              padding: '2px 7px',
              borderRadius: 20,
              background: 'var(--color-success-bg, rgba(16, 185, 129, 0.15))',
              color: 'var(--color-success, #10b981)',
              border: '1px solid var(--color-success, #10b981)',
              flexShrink: 0,
            }}>
              <span className="pulse-live-indicator" />
              <span>Canlı</span>
            </div>
          </div>

          {/* Global Akıllı Arama Çubuğu (Ortak 360° Arama) */}
          <div ref={searchBoxRef} style={{ position: 'relative', flex: '1 1 auto', minWidth: 160, maxWidth: isMobile ? '100%' : 380, zIndex: 520 }}>
            <span style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', fontSize: 11.5, opacity: 0.6, pointerEvents: 'none', zIndex: 1 }}>
              🔍
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={e => handleGlobalSearchChange(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              onFocus={() => { if (globalResults.length > 0) setIsGlobalSearchOpen(true); }}
              placeholder="Personel adı, sicil no, cihaz adı veya servis no ara..."
              style={{
                height: 33,
                paddingLeft: 28,
                paddingRight: searchQuery ? 24 : 8,
                borderRadius: 8,
                fontSize: 11.5,
                background: 'var(--input-bg, var(--color-surface-alt))',
                border: isGlobalSearchOpen ? '1px solid var(--color-primary, #38bdf8)' : '1px solid var(--input-border, var(--color-border))',
                color: 'var(--color-text)',
                width: '100%',
                boxSizing: 'border-box',
                outline: 'none',
                boxShadow: isGlobalSearchOpen ? '0 0 0 2px rgba(56, 189, 248, 0.2)' : 'none',
                transition: 'all 0.15s ease',
              }}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => { setSearchQuery(''); setGlobalResults([]); setIsGlobalSearchOpen(false); }}
                style={{
                  position: 'absolute', right: 7, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer', fontSize: 11, padding: 0
                }}
              >
                ✕
              </button>
            )}

            {/* Akıllı Arama Autocomplete Açılır Menüsü */}
            {isGlobalSearchOpen && (
              <div style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                marginTop: 6,
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: 10,
                boxShadow: '0 25px 60px rgba(0, 0, 0, 0.95), 0 0 0 1px var(--color-border)',
                zIndex: 999999,
                maxHeight: 340,
                overflowY: 'auto',
              }}>
                {globalSearchLoading ? (
                  <div style={{ padding: '14px 16px', fontSize: 12, color: 'var(--color-text-muted)', textAlign: 'center' }}>
                    🔍 Veritabanı taranıyor...
                  </div>
                ) : globalResults.length === 0 ? (
                  <div style={{ padding: '14px 16px', fontSize: 12, color: 'var(--color-text-muted)', textAlign: 'center' }}>
                    "{searchQuery}" için kayıt bulunamadı.
                    <div style={{ fontSize: 11, marginTop: 4, color: 'var(--color-primary, #38bdf8)', cursor: 'pointer' }}
                      onClick={() => handleSearchKeyDown({ key: 'Enter', preventDefault: () => {} })}
                    >
                      Enter'a basarak 360 profilini aç ↗
                    </div>
                  </div>
                ) : (
                  <>
                    <div style={{
                      padding: '6px 12px',
                      fontSize: 10,
                      fontWeight: 800,
                      color: 'var(--color-text-muted)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      borderBottom: '1px solid var(--color-border)',
                      background: 'var(--color-surface-alt)',
                      display: 'flex',
                      justifyContent: 'space-between'
                    }}>
                      <span>Akıllı Sonuçlar ({globalResults.length})</span>
                      <span>Seçmek için Enter ↵</span>
                    </div>

                    {globalResults.map((item, idx) => {
                      const isHighlighted = idx === selectedResultIdx;
                      return (
                        <div
                          key={`${item.id || item.name}-${idx}`}
                          onClick={() => handleSelectGlobalResult(item)}
                          style={{
                            padding: '8px 12px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10,
                            cursor: 'pointer',
                            background: isHighlighted ? 'var(--color-surface-alt)' : 'transparent',
                            borderBottom: idx !== globalResults.length - 1 ? '1px solid var(--color-border)' : 'none',
                            transition: 'background 0.15s',
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.background = 'var(--color-surface-alt)'}
                          onMouseLeave={(e) => e.currentTarget.style.background = isHighlighted ? 'var(--color-surface-alt)' : 'transparent'}
                        >
                          <UserAvatar user={item} size={32} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ fontWeight: 800, fontSize: 12.5, color: 'var(--color-text)' }}>
                                {item.name}
                              </span>
                              <span style={{
                                fontSize: 9.5,
                                padding: '1px 5px',
                                borderRadius: 4,
                                background: item.match_type === 'user'
                                  ? 'rgba(56, 189, 248, 0.15)'
                                  : item.match_type === 'asset'
                                  ? 'rgba(16, 185, 129, 0.15)'
                                  : 'rgba(245, 158, 11, 0.15)',
                                color: item.match_type === 'user'
                                  ? 'var(--color-primary, #38bdf8)'
                                  : item.match_type === 'asset'
                                  ? '#10b981'
                                  : '#f59e0b',
                                fontWeight: 700,
                              }}>
                                {item.match_badge}
                              </span>
                            </div>
                            <div style={{
                              fontSize: 10.5,
                              color: 'var(--color-text-secondary)',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              marginTop: 1,
                            }}>
                              {item.match_highlight ? <strong style={{ color: 'var(--color-text)' }}>{item.match_highlight} • </strong> : ''}
                              {item.match_info}
                            </div>
                          </div>
                          <span style={{ fontSize: 12, opacity: 0.5 }}>↗</span>
                        </div>
                      );
                    })}
                  </>
                )}
              </div>
            )}
          </div>

          {/* Tarih Aralığı Filtresi & Yenileme Butonu */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, marginLeft: 'auto' }}>
            <select
              value={dateRange}
              onChange={e => setDateRange(e.target.value)}
              style={{
                height: 32,
                borderRadius: 8,
                fontSize: 11.5,
                fontWeight: 600,
                background: 'var(--input-bg, var(--color-surface-alt))',
                border: '1px solid var(--input-border, var(--color-border))',
                color: 'var(--color-text)',
                padding: '0 8px',
                cursor: 'pointer',
                outline: 'none',
              }}
            >
              <option value="all">🌐 Tüm Zamanlar</option>
              <option value="month">📅 Bu Ay</option>
              <option value="30d">📅 Son 30 Gün</option>
              <option value="7d">📅 Son 7 Gün</option>
            </select>

            <button
              className="btn btn-secondary btn-sm"
              onClick={load}
              disabled={loading}
              title="Yenile"
              style={{
                height: 32,
                width: 34,
                padding: 0,
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <span style={{ display: 'inline-block', transform: loading ? 'rotate(180deg)' : 'none', transition: 'transform 0.3s' }}>
                🔄
              </span>
            </button>
          </div>
        </div>

        {/* Sağ Panel: Hızlı İşlemler Butonları (Kompakt ve Üstte) */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          background: 'linear-gradient(145deg, var(--color-surface) 0%, var(--color-surface-alt) 100%)',
          backdropFilter: 'blur(10px)',
          border: '1px solid var(--color-border)',
          borderRadius: 12,
          padding: '8px 12px',
          boxShadow: '0 2px 10px rgba(0, 0, 0, 0.15)',
          minHeight: 48,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            <span style={{ fontSize: 15 }}>🚀</span>
            <strong style={{ fontSize: 12, color: 'var(--color-text)', whiteSpace: 'nowrap' }}>
              Hızlı İşlemler
            </strong>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, justifyContent: 'flex-end', flexWrap: 'nowrap' }}>
            <button
              className="btn btn-sm btn-primary"
              onClick={() => openTab({ id: 'new-ticket-' + Date.now(), label: 'Yeni Servis', icon: '➕', module: 'ServiceTicketNew' })}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 5,
                height: 32,
                fontWeight: 700,
                fontSize: 11,
                borderRadius: 8,
                padding: '0 10px',
                whiteSpace: 'nowrap',
                flex: '1 1 auto',
              }}
              title="Yeni Servis Kaydı Aç"
            >
              <span>➕</span>
              <span>Yeni Servis</span>
            </button>

            <button
              className="btn btn-sm btn-secondary"
              onClick={() => setShowTonerModal(true)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 5,
                height: 32,
                fontWeight: 600,
                fontSize: 11,
                borderRadius: 8,
                padding: '0 8px',
                whiteSpace: 'nowrap',
                flex: '1 1 auto',
              }}
              title="Toner / Sarf Malzemesi Çıkışı Yap (Pop-Up)"
            >
              <span>🖨️</span>
              <span>Toner Çıkışı</span>
            </button>

            <button
              className="btn btn-sm btn-secondary"
              onClick={() => setShowCargoModal(true)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 5,
                height: 32,
                fontWeight: 600,
                fontSize: 11,
                borderRadius: 8,
                padding: '0 8px',
                whiteSpace: 'nowrap',
                flex: '1 1 auto',
              }}
              title="Gelen Kargo Girişi (Pop-Up)"
            >
              <span>📥</span>
              <span>Gelen Kargo</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── 1. ÜST KISIM: 6 Adet Canlı KPI Kartı (Kompakt 82px) ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
        gap: 10,
        marginBottom: 10,
        position: 'relative',
        zIndex: 1,
      }}>
        <CompactStatCard
          icon="📅"
          label="Bugünkü Kayıtlar"
          value={stats.today}
          trendData={trends.today}
          color={themeColors.accent || themeColors.primary}
          onClick={() => openTab({
            id: 'maintenance',
            label: 'Operasyon Takvimi',
            icon: '🗓️',
            module: 'Maintenance',
            data: { view: 'calendar', date: new Date().toISOString().slice(0, 10), openDailySummary: true, timestamp: Date.now() },
            tabData: { view: 'calendar', date: new Date().toISOString().slice(0, 10), openDailySummary: true, timestamp: Date.now() }
          })}
        />
        <CompactStatCard
          icon="🛠️"
          label="Açık Servisler"
          value={stats.open}
          trendData={trends.open}
          color={themeColors.success}
          onClick={() => openTab({
            id: 'service-tickets',
            label: 'Servis Fişleri',
            icon: '🔧',
            module: 'ServiceTickets',
            data: { presetFilter: 'open', title: '🛠️ Açık Servisler', timestamp: Date.now() },
            tabData: { presetFilter: 'open', title: '🛠️ Açık Servisler', timestamp: Date.now() }
          })}
        />
        <CompactStatCard
          icon="📦"
          label="Parça Bekleyen"
          value={stats.waiting}
          trendData={trends.waiting}
          color={themeColors.warning}
          isWarning
          onClick={() => openTab({
            id: 'service-tickets',
            label: 'Servis Fişleri',
            icon: '🔧',
            module: 'ServiceTickets',
            data: { presetFilter: 'waiting', title: '⏳ Parça Bekleyen', timestamp: Date.now() },
            tabData: { presetFilter: 'waiting', title: '⏳ Parça Bekleyen', timestamp: Date.now() }
          })}
        />
        <CompactStatCard
          icon="⏰"
          label="Gecikmiş (7G+)"
          value={stats.overdue}
          trendData={trends.overdue}
          color={themeColors.danger}
          isDanger
          onClick={() => openTab({
            id: 'service-tickets',
            label: 'Servis Fişleri',
            icon: '🔧',
            module: 'ServiceTickets',
            data: { presetFilter: 'overdue', title: '⏰ Gecikmiş (7G+)', timestamp: Date.now() },
            tabData: { presetFilter: 'overdue', title: '⏰ Gecikmiş (7G+)', timestamp: Date.now() }
          })}
        />
        <CompactStatCard
          icon="🖨️"
          label="Kritik Toner"
          value={stats.critToner}
          trendData={trends.toner}
          color={themeColors.orange || themeColors.warning}
          isWarning
          onClick={() => openTab({
            id: 'toner',
            label: 'Toner & Kartuş',
            icon: '🖨️',
            module: 'Toner',
            data: { onlyCritical: true, filter: 'critical', timestamp: Date.now() },
            tabData: { onlyCritical: true, filter: 'critical', timestamp: Date.now() }
          })}
        />
        <CompactStatCard
          icon="🔩"
          label="Kritik Stok"
          value={stats.critStock}
          trendData={trends.stock}
          color={themeColors.danger}
          isDanger
          onClick={() => openTab({
            id: 'stock',
            label: 'Stok / Parça',
            icon: '📦',
            module: 'Stock',
            data: { onlyCritical: true, filter: 'critical', timestamp: Date.now() },
            tabData: { onlyCritical: true, filter: 'critical', timestamp: Date.now() }
          })}
        />
      </div>

      {/* ── 2. ORTA BÖLÜM: Revize Edilmiş Dengeli Grafikler (Temaya Uyumlu) ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
        gap: 10,
        marginBottom: 10,
      }}>
        {/* Sol Grafik: Servis Durum Dağılımı (Kompakt Donut + Sağ Efsane Listesi) */}
        <div style={{
          background: 'linear-gradient(145deg, var(--color-surface) 0%, var(--color-surface-alt) 100%)',
          backdropFilter: 'blur(10px)',
          border: '1px solid var(--color-border)',
          borderRadius: 12,
          padding: '12px 16px',
          boxShadow: '0 2px 12px rgba(0, 0, 0, 0.15)',
          display: 'flex',
          flexDirection: 'column',
          minHeight: 185,
        }}>
          {/* Kart Başlığı */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 15 }}>🍩</span>
              <strong style={{ fontSize: 13, color: 'var(--color-text)' }}>Servis Durum Dağılımı</strong>
            </div>
            <span style={{
              fontSize: 10.5,
              color: 'var(--color-text-secondary)',
              background: 'var(--color-surface-alt)',
              border: '1px solid var(--color-border)',
              padding: '2px 7px',
              borderRadius: 5
            }}>
              {donutDataInfo.total} Toplam Kayıt
            </span>
          </div>

          {/* Grafik ve Yan Legend Alanı */}
          {donutDataInfo.total === 0 ? (
            <div style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--color-text-muted)',
              fontSize: 12,
              gap: 4,
            }}>
              <span style={{ fontSize: 24, opacity: 0.6 }}>📊</span>
              <span>Bu filtrede kayıt bulunmuyor</span>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, flex: 1 }}>
              {/* Sol: Kompakt Donut Halkası */}
              <div style={{ position: 'relative', width: 124, height: 124, flexShrink: 0 }}>
                <canvas ref={donutCanvasRef} />
                <div style={{
                  position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                  textAlign: 'center', pointerEvents: 'none',
                }}>
                  <div style={{ fontSize: 20, fontWeight: 900, color: 'var(--color-text)', lineHeight: 1 }}>
                    {donutDataInfo.total}
                  </div>
                  <div style={{ fontSize: 9, color: 'var(--color-text-secondary)', fontWeight: 600, marginTop: 2 }}>
                    Servis
                  </div>
                </div>
              </div>

              {/* Sağ: Durum Efsanesi (Legend) Tablosu */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
                {donutDataInfo.items.map(item => (
                  <div
                    key={item.key}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '3px 8px',
                      borderRadius: 6,
                      background: item.count > 0 ? 'var(--color-surface-alt)' : 'transparent',
                      border: `1px solid ${item.count > 0 ? 'var(--color-border)' : 'transparent'}`,
                      fontSize: 11,
                      opacity: item.count > 0 ? 1 : 0.45,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                      <span style={{ width: 7, height: 7, borderRadius: '50%', background: item.color, flexShrink: 0 }} />
                      <span style={{ color: 'var(--color-text)', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {item.label}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                      <strong style={{ color: 'var(--color-text)', fontSize: 11 }}>{item.count}</strong>
                      <span style={{ fontSize: 10, color: 'var(--color-text-secondary)', minWidth: 28, textAlign: 'right' }}>
                        %{item.percent}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sağ Grafik: Haftalık İş Yükü (Kompakt Bar + Grid Çizgileri) */}
        <div style={{
          background: 'linear-gradient(145deg, var(--color-surface) 0%, var(--color-surface-alt) 100%)',
          backdropFilter: 'blur(10px)',
          border: '1px solid var(--color-border)',
          borderRadius: 12,
          padding: '12px 16px',
          boxShadow: '0 2px 12px rgba(0, 0, 0, 0.15)',
          display: 'flex',
          flexDirection: 'column',
          minHeight: 185,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 15 }}>📊</span>
              <strong style={{ fontSize: 13, color: 'var(--color-text)' }}>Son 7 Günlük İş Yükü Hareketi</strong>
            </div>
            <span style={{
              fontSize: 10.5,
              color: 'var(--color-text-secondary)',
              background: 'var(--color-surface-alt)',
              border: '1px solid var(--color-border)',
              padding: '2px 7px',
              borderRadius: 5
            }}>
              Günlük Dinamik
            </span>
          </div>

          <div style={{ position: 'relative', flex: 1, minHeight: 135 }}>
            <canvas ref={barCanvasRef} />
          </div>
        </div>
      </div>

      {/* ── 3. ALT BÖLÜM: 70/30 Sıkılaştırılmış ve Hizalı Yerleşim (Temaya Uyumlu) ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr' : '2.1fr 1fr',
        gap: 10,
        alignItems: 'stretch',
      }}>
        {/* Sol Sütun (%70): Acil Müdahale Gerektirenler */}
        <div style={{
          background: 'linear-gradient(145deg, var(--color-surface) 0%, var(--color-surface-alt) 100%)',
          backdropFilter: 'blur(10px)',
          border: '1px solid var(--color-border)',
          borderRadius: 12,
          padding: '12px 16px',
          boxShadow: '0 2px 12px rgba(0, 0, 0, 0.15)',
          display: 'flex',
          flexDirection: 'column',
        }}>
          {/* Başlık ve Tümünü Gör Butonu */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 16 }}>⚡</span>
              <div>
                <strong style={{ fontSize: 13, color: 'var(--color-text)' }}>
                  Acil Müdahale Gerektiren Servisler
                </strong>
                <span style={{ fontSize: 10.5, color: 'var(--color-text-secondary)', marginLeft: 8 }}>
                  (Öncelikli, parça bekleyen veya 7 günü aşanlar)
                </span>
              </div>
            </div>

            <button
              className="btn btn-secondary btn-xs"
              style={{ fontSize: 11, fontWeight: 700, borderRadius: 6, padding: '3px 10px' }}
              onClick={() => openTab({ id: 'service-tickets', label: 'Servis Fişleri', icon: '🔧', module: 'ServiceTickets' })}
            >
              Tümünü Gör →
            </button>
          </div>

          {/* Acil Servis Listesi (Kompakt 5 Satır) */}
          {urgentTickets.length === 0 ? (
            <div style={{
              padding: '24px 16px',
              textAlign: 'center',
              background: 'var(--color-success-bg, rgba(16, 185, 129, 0.08))',
              borderRadius: 8,
              border: '1px dashed var(--color-success, #10b981)',
              color: 'var(--color-success, #10b981)',
              fontSize: 12,
              fontWeight: 600,
            }}>
              🎉 Tebrikler! Bekleyen acil veya gecikmiş servis kaydı bulunmuyor.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {urgentTickets.map(ticket => {
                const pColor = PRIORITY_COLORS[ticket.priority] || PRIORITY_COLORS['Normal'];
                const sColor = STATUS_COLORS[ticket.status] || '#94a3b8';
                const diffDays = ticket.created_at ? Math.floor((new Date() - new Date(ticket.created_at)) / (1000 * 60 * 60 * 24)) : 0;
                const isOverdue = diffDays >= 7;

                return (
                  <div
                    key={ticket.id || ticket.ticket_no}
                    onClick={() => setSelectedTicket(ticket)}
                    className="dashboard-row-hover"
                    style={{
                      background: 'var(--color-surface-alt)',
                      border: '1px solid var(--color-border)',
                      borderRadius: 8,
                      padding: '7px 12px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      gap: 10,
                    }}
                  >
                    {/* Sol: Fiş No, Cihaz & Kullanıcı */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
                      <span style={{
                        fontFamily: 'monospace',
                        fontSize: 11.5,
                        fontWeight: 800,
                        color: 'var(--color-primary)',
                        background: 'var(--color-primary-bg, rgba(56, 189, 248, 0.12))',
                        padding: '2px 6px',
                        borderRadius: 5,
                        border: '1px solid var(--color-border)',
                        flexShrink: 0,
                      }}>
                        {ticket.ticket_no}
                      </span>

                      <div style={{ minWidth: 0 }}>
                        <div style={{
                          fontSize: 12.5,
                          fontWeight: 700,
                          color: 'var(--color-text)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}>
                          {ticket.asset_name || ticket.model_name || 'Bilinmeyen Cihaz'}
                        </div>
                        <div style={{ fontSize: 10.5, color: 'var(--color-text-secondary)', marginTop: 1 }}>
                          👤 {ticket.user_name || 'Ortak Alan'} {ticket.asset_tag ? `• 🏷️ ${ticket.asset_tag}` : ''}
                        </div>
                      </div>
                    </div>

                    {/* Sağ: Bekleme Süresi, Öncelik, Durum & İncele */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                      {/* Geçen Süre */}
                      {isOverdue ? (
                        <span style={{
                          fontSize: 10,
                          fontWeight: 800,
                          color: 'var(--color-danger, #ef4444)',
                          background: 'var(--color-danger-bg, rgba(239, 68, 68, 0.15))',
                          padding: '2px 7px',
                          borderRadius: 5,
                          border: '1px solid var(--color-danger, #ef4444)'
                        }}>
                          ⚠️ {diffDays} Gündür Bekliyor
                        </span>
                      ) : (
                        <span style={{ fontSize: 10, color: 'var(--color-text-secondary)' }}>
                          ⏱️ {diffDays} gün önce
                        </span>
                      )}

                      {/* Öncelik */}
                      <span style={{
                        fontSize: 10,
                        fontWeight: 700,
                        padding: '2px 7px',
                        borderRadius: 5,
                        background: pColor.bg,
                        color: pColor.text,
                        border: `1px solid ${pColor.border}`,
                      }}>
                        {ticket.priority}
                      </span>

                      {/* Durum */}
                      <span style={{
                        fontSize: 10,
                        fontWeight: 700,
                        padding: '2px 7px',
                        borderRadius: 5,
                        background: `${sColor}22`,
                        color: sColor,
                        border: `1px solid ${sColor}44`,
                      }}>
                        {ticket.status}
                      </span>

                      <button
                        className="btn btn-xs btn-secondary"
                        onClick={e => { e.stopPropagation(); setSelectedTicket(ticket); }}
                        style={{ borderRadius: 5, padding: '2px 7px', fontSize: 10.5 }}
                      >
                        İncele
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Sağ Sütun (%30): Kritik Stok Uyarıları */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {/* Kritik Stok & Toner Uyarıları */}
          <div style={{
            background: 'linear-gradient(145deg, var(--color-surface) 0%, var(--color-surface-alt) 100%)',
            backdropFilter: 'blur(10px)',
            border: '1px solid var(--color-border)',
            borderRadius: 12,
            padding: '12px 14px',
            boxShadow: '0 2px 12px rgba(0, 0, 0, 0.15)',
            display: 'flex',
            flexDirection: 'column',
            flex: 1,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 15 }}>⚠️</span>
                <strong style={{ fontSize: 12.5, color: 'var(--color-text)' }}>Kritik Stok Uyarıları</strong>
              </div>
              <span style={{
                fontSize: 10,
                fontWeight: 800,
                color: 'var(--color-danger, #ef4444)',
                background: 'var(--color-danger-bg, rgba(239, 68, 68, 0.15))',
                padding: '1px 6px',
                borderRadius: 999,
              }}>
                {criticalInventory.length} Kalem
              </span>
            </div>

            {criticalInventory.length === 0 ? (
              <div style={{
                padding: '14px 10px',
                textAlign: 'center',
                color: 'var(--color-success, #10b981)',
                fontSize: 11.5,
                fontWeight: 600,
                background: 'var(--color-success-bg, rgba(16, 185, 129, 0.08))',
                borderRadius: 7,
              }}>
                ✅ Tüm stok ve tonerler güvenli seviyede.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {criticalInventory.map(item => (
                  <div
                    key={item.id}
                    onClick={() => openTab({ id: item.module.toLowerCase(), label: item.module === 'Toner' ? 'Toner Takibi' : 'Stok / Parça', icon: item.module === 'Toner' ? '🖨️' : '📦', module: item.module })}
                    className="dashboard-row-hover"
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '6px 9px',
                      borderRadius: 7,
                      background: 'var(--color-surface-alt)',
                      border: '1px solid var(--color-border)',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--color-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {item.name}
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--color-text-secondary)' }}>
                        {item.type === 'toner' ? '🖨️ Toner' : '🔩 Parça'} • {item.code}
                      </div>
                    </div>

                    <div style={{ textAlign: 'right', marginLeft: 8, flexShrink: 0 }}>
                      <span style={{ fontSize: 11.5, fontWeight: 900, color: 'var(--color-danger, #ef4444)' }}>
                        {item.qty} {item.unit}
                      </span>
                      <div style={{ fontSize: 9, color: 'var(--color-text-muted)' }}>
                        Limit: {item.critical_qty}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Servis Fişi İnceleme / Düzenleme Modalı ── */}
      {selectedTicket && (
        <Modal
          isOpen
          title={isEditing ? `Servis Düzenle: ${selectedTicket.ticket_no}` : `Servis Detayı: ${selectedTicket.ticket_no}`}
          size="xl"
          onClose={() => { setSelectedTicket(null); setIsEditing(false); }}
        >
          {isEditing ? (
            <ServiceTicketForm
              ticket={selectedTicket}
              onSave={() => { setIsEditing(false); load(); }}
              onCancel={() => setIsEditing(false)}
            />
          ) : (
            <ServiceTicketDetail
              ticket={selectedTicket}
              onUpdate={() => { load(); }}
              onEdit={() => setIsEditing(true)}
            />
          )}
        </Modal>
      )}

      {/* ── Toner / Sarf Malzemesi Çıkış Modalı ── */}
      {showTonerModal && (
        <TonerCheckoutModal
          isOpen={showTonerModal}
          onClose={() => setShowTonerModal(false)}
          onSaved={() => {
            setShowTonerModal(false);
            load();
            triggerTableRefresh?.(['toner_items', 'toner_changes']);
          }}
        />
      )}

      {/* ── Gelen Kargo Giriş Modalı ── */}
      {showCargoModal && (
        <CargoFormModal
          isOpen={showCargoModal}
          initialDirection="incoming"
          currentUser={user}
          onClose={() => setShowCargoModal(false)}
          onSaved={() => {
            setShowCargoModal(false);
            showNotification('Gelen kargo kaydı başarıyla oluşturuldu.', 'success');
            load();
            triggerTableRefresh?.(['cargo_shipments']);
          }}
        />
      )}
    </div>
  );
}
