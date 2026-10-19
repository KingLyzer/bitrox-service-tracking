import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { AgGridReact } from 'ag-grid-react';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-quartz.css';
import { useAuth } from '../../../context/AuthContext';
import { useApp } from '../../../context/AppContext';
import { apiGet, apiDelete } from '../../../utils/apiFetch';
import ConfirmDialog from '../../common/ConfirmDialog';
import CargoFormModal from './CargoFormModal';
import CargoDetailModal from './CargoDetailModal';
import CargoLabelModal from './CargoLabelModal';
import '../../../styles/cargo.css';

const CARRIER_OPTIONS = [
  { value: 'all', label: 'Tüm Kargo Firmaları' },
  { value: 'Yurtiçi Kargo', label: 'Yurtiçi Kargo' },
  { value: 'Aras Kargo', label: 'Aras Kargo' },
  { value: 'MNG Kargo', label: 'MNG Kargo' },
  { value: 'Sürat Kargo', label: 'Sürat Kargo' },
  { value: 'PTT Kargo', label: 'PTT Kargo' },
  { value: 'UPS Kargo', label: 'UPS Kargo' },
  { value: 'DHL', label: 'DHL' },
  { value: 'Kolay Gelsin', label: 'Kolay Gelsin' },
  { value: 'Hepsijet', label: 'Hepsijet' },
  { value: 'Trendyol Express', label: 'Trendyol Express' },
  { value: 'FedEx', label: 'FedEx' },
  { value: 'Özel Kurye', label: 'Özel Kurye' },
  { value: 'Diğer', label: 'Diğer' }
];

function getCargoStatusDisplay(status, direction) {
  const s = String(status || '').toLowerCase().trim();
  if (s === 'received' || s === 'received_by_it' || (!status && direction !== 'outgoing')) {
    return 'Teslim Alındı';
  }
  if (s === 'sent' || s === 'shipped' || (!status && direction === 'outgoing')) {
    return 'Gönderildi';
  }
  if (s === 'delivered') return 'Teslim Edildi';
  if (s === 'in_transit') return 'Yolda / Dağıtımda';
  if (s === 'preparing') return 'Hazırlanıyor / Paketlendi';
  return status || (direction === 'outgoing' ? 'Gönderildi' : 'Teslim Alındı');
}

export default function CargoModule({ tabData }) {
  const { user, hasPermission } = useAuth();
  const { showNotification, theme, settings, triggerTableRefresh, openTab } = useApp();

  const [shipments, setShipments] = useState(() => {
    try {
      const saved = localStorage.getItem('cached_cargo_shipments');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [stats, setStats] = useState({ 
    total: 0, 
    incoming_count: 0, 
    outgoing_count: 0, 
    today: 0, 
    service_count: 0, 
    waybill_count: 0, 
    asset_count: 0 
  });
  const [cachedUsers, setCachedUsers] = useState([]);
  const [loading, setLoading] = useState(false);

  // Filtreler
  const [directionFilter, setDirectionFilter] = useState('all'); // 'all', 'incoming', 'outgoing'
  const [search, setSearch] = useState('');
  const [carrierFilter, setCarrierFilter] = useState('all');

  // Modallar
  const [showFormModal, setShowFormModal] = useState(() => Boolean(tabData?.openIncoming || tabData?.openOutgoing || tabData?.action === 'new_incoming'));
  const [formInitialDirection, setFormInitialDirection] = useState(() => tabData?.direction || 'incoming');
  const [editCargo, setEditCargo] = useState(null);
  const [detailCargo, setDetailCargo] = useState(null);
  const [labelCargo, setLabelCargo] = useState(null);
  const [deleteCargoId, setDeleteCargoId] = useState(null);

  useEffect(() => {
    if (tabData?.openIncoming || tabData?.action === 'new_incoming') {
      setEditCargo(null);
      setFormInitialDirection('incoming');
      setShowFormModal(true);
    } else if (tabData?.openOutgoing || tabData?.action === 'new_outgoing') {
      setEditCargo(null);
      setFormInitialDirection('outgoing');
      setShowFormModal(true);
    }
  }, [tabData]);

  const gridRef = useRef(null);

  // Servis Fişleri Sekmesine Yönlendir ve İlgili Fişi Pop-Up Olarak Aç
  const handleOpenServiceTickets = (ticketId, ticketNo) => {
    openTab({
      id: 'service-tickets',
      label: 'Servis Fişleri',
      icon: '🔧',
      module: 'ServiceTickets',
      initialTicketNo: ticketNo,
      initialTicketId: ticketId
    });
  };

  // Verileri çek
  const fetchShipments = useCallback(async () => {
    setLoading(true);
    try {
      const [resCargo, resStats] = await Promise.all([
        apiGet('/api/cargo', { direction: directionFilter, carrier: carrierFilter, search }),
        apiGet('/api/cargo/stats')
      ]);

      if (resCargo?.success) {
        const data = resCargo.data || [];
        setShipments(data);
        try { localStorage.setItem('cached_cargo_shipments', JSON.stringify(data)); } catch {}
      }
      if (resStats?.success) {
        setStats(resStats.data || { 
          total: 0, 
          incoming_count: 0, 
          outgoing_count: 0, 
          today: 0, 
          service_count: 0, 
          waybill_count: 0, 
          asset_count: 0 
        });
      }
    } catch (err) {
      console.warn('[Cargo Fetch Error]:', err);
      showNotification('Kargo verileri alınamadı: ' + err.message, 'danger');
    } finally {
      setLoading(false);
    }
  }, [directionFilter, carrierFilter, search, showNotification]);

  // Snipe-IT Personel Listesini Çek
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const res = await apiGet('/api/cached/users');
        if (res?.success && Array.isArray(res.data)) {
          setCachedUsers(res.data);
        }
      } catch (err) {
        console.warn('[Cached Users Fetch Error]:', err);
      }
    };
    fetchUsers();
  }, []);

  useEffect(() => {
    fetchShipments();
  }, [fetchShipments]);

  // Silme işlemi
  const handleDeleteConfirm = async () => {
    if (!deleteCargoId) return;
    try {
      const res = await apiDelete(`/api/cargo/${deleteCargoId}`);
      if (res?.success) {
        showNotification('Kargo kaydı silindi.', 'success');
        fetchShipments();
        triggerTableRefresh(['cargo_shipments']);
      } else {
        showNotification(res?.message || 'Silme işlemi başarısız.', 'danger');
      }
    } catch (err) {
      showNotification('Hata: ' + err.message, 'danger');
    } finally {
      setDeleteCargoId(null);
    }
  };

  // Excel Dışa Aktar
  const handleExportExcel = () => {
    if (gridRef.current?.api) {
      const prefix = directionFilter === 'outgoing' ? 'Giden_Kargolar' : directionFilter === 'incoming' ? 'Gelen_Kargolar' : 'Tum_Kargolar';
      gridRef.current.api.exportDataAsCsv({
        fileName: `${prefix}_${new Date().toISOString().slice(0, 10)}.csv`
      });
      showNotification('Kargo listesi CSV/Excel olarak indirildi.', 'info');
    }
  };

  const handleOpenNewModal = (dir = 'incoming') => {
    setEditCargo(null);
    setFormInitialDirection(dir);
    setShowFormModal(true);
  };

  // AG-Grid Sütun Tanımları
  const columnDefs = useMemo(() => [
    {
      headerName: '#',
      field: 'id',
      width: 70,
      pinned: 'left',
      sortable: true,
      cellRenderer: params => <strong>#{params.value}</strong>
    },
    {
      headerName: 'Yön',
      field: 'direction',
      width: 105,
      pinned: 'left',
      sortable: true,
      cellRenderer: params => {
        const isOut = params.value === 'outgoing';
        return (
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: '2px 8px',
            borderRadius: 6,
            fontSize: 11,
            fontWeight: 800,
            background: isOut ? 'rgba(245, 158, 11, 0.18)' : 'rgba(59, 130, 246, 0.18)',
            color: isOut ? '#f59e0b' : '#3b82f6',
            border: isOut ? '1px solid rgba(245, 158, 11, 0.35)' : '1px solid rgba(59, 130, 246, 0.35)'
          }}>
            {isOut ? '📤 Giden' : '📥 Gelen'}
          </span>
        );
      }
    },
    {
      headerName: 'Durum',
      field: 'status',
      width: 145,
      sortable: true,
      cellRenderer: params => {
        const st = getCargoStatusDisplay(params.value, params.data?.direction);
        const isCompleted = st.includes('Teslim Edildi') || st.includes('Teslim Alındı') || st.includes('Kullanıma Hazır');
        const isWarning = st.includes('Gönderildi') || st.includes('Yolda') || st.includes('Hazırlanıyor');
        const isInfo = st.includes('İşlemde') || st.includes('Serviste');
        
        let bg = 'rgba(245, 158, 11, 0.15)';
        let color = '#f59e0b';
        let border = '1px solid rgba(245, 158, 11, 0.3)';

        if (isCompleted) {
          bg = 'rgba(16, 185, 129, 0.15)';
          color = '#10b981';
          border = '1px solid rgba(16, 185, 129, 0.3)';
        } else if (isInfo) {
          bg = 'rgba(56, 189, 248, 0.15)';
          color = '#38bdf8';
          border = '1px solid rgba(56, 189, 248, 0.3)';
        }

        return (
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: '2px 8px',
            borderRadius: 6,
            fontSize: 11,
            fontWeight: 700,
            background: bg,
            color: color,
            border: border
          }}>
            ● {st}
          </span>
        );
      }
    },
    {
      headerName: 'Kargo Firması & Takip',
      field: 'carrier',
      width: 180,
      sortable: true,
      cellRenderer: params => {
        const row = params.data;
        if (row.carrier_tracking_url) {
          return (
            <a
              href={row.carrier_tracking_url}
              target="_blank"
              rel="noopener noreferrer"
              className="carrier-link"
              title="Kargo Firmasında Doğrudan Sorgula"
            >
              🚚 {row.carrier} ↗
            </a>
          );
        }
        return <span>🚚 {row.carrier || '—'}</span>;
      }
    },
    {
      headerName: 'Takip No / Barkod',
      field: 'tracking_number',
      width: 165,
      sortable: true,
      cellRenderer: params => params.value ? <code>{params.value}</code> : <span style={{ opacity: 0.4 }}>—</span>
    },
    {
      headerName: 'İrsaliye No (16 Hane)',
      field: 'waybill_no',
      width: 175,
      sortable: true,
      cellRenderer: params => params.value ? <strong style={{ color: '#38bdf8', letterSpacing: 0.5 }}>{params.value}</strong> : <span style={{ opacity: 0.4 }}>—</span>
    },
    {
      headerName: 'Alıcı (Personel / Firma)',
      field: 'recipient_name',
      width: 190,
      sortable: true,
      cellRenderer: params => {
        const isOut = params.data?.direction === 'outgoing';
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600 }}>
            <span>{isOut ? '🏢' : '🧑‍💻'}</span>
            <span>{params.value}</span>
          </div>
        );
      }
    },
    {
      headerName: 'Gönderen',
      field: 'sender',
      width: 170,
      sortable: true,
      cellRenderer: params => params.value || (params.data?.direction === 'outgoing' ? 'IT Ekibi' : <span style={{ opacity: 0.4 }}>—</span>)
    },
    {
      headerName: 'Departman / Şube',
      field: 'department',
      width: 170,
      cellRenderer: params => params.value || <span style={{ opacity: 0.4 }}>—</span>
    },
    {
      headerName: 'Paket / İçerik Türü',
      field: 'package_type',
      width: 175,
      sortable: true,
      cellRenderer: params => {
        const row = params.data;
        return `${params.value || 'Laptop'} (${row.package_count || 1} Adet)`;
      }
    },
    {
      headerName: 'Cihaz & Servis Fişi',
      field: 'service_ticket_no',
      width: 190,
      sortable: true,
      cellRenderer: params => {
        const row = params.data;
        if (row.service_ticket_no) {
          return (
            <button
              className="btn btn-xs btn-primary"
              onClick={(e) => { e.stopPropagation(); handleOpenServiceTickets(row.service_ticket_id, row.service_ticket_no); }}
              title="Servis Fişlerine Git & Fişi Aç"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', fontSize: 11 }}
            >
              <span>🔧</span>
              <span>{row.service_ticket_no}</span>
            </button>
          );
        }
        if (row.asset_tag) {
          return (
            <span style={{ fontSize: 11, color: '#818cf8', fontWeight: 600 }}>
              🖥️ {row.asset_tag}
            </span>
          );
        }
        return <span style={{ opacity: 0.4 }}>—</span>;
      }
    },
    {
      headerName: 'İşlem Tarihi',
      field: 'received_date',
      width: 155,
      sortable: true,
      cellRenderer: params => {
        if (!params.value) return '—';
        return new Date(params.value).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' });
      }
    },
    {
      headerName: 'İşlem Yapan IT',
      field: 'received_by',
      width: 140,
      cellRenderer: params => params.value || 'IT Ekibi'
    },
    {
      headerName: 'Notlar & Adres',
      field: 'notes',
      width: 220,
      cellRenderer: params => {
        const row = params.data;
        const text = row.receiver_address ? `[Adres: ${row.receiver_address}] ${row.notes || ''}` : (row.notes || '');
        return text ? <span>{text}</span> : <span style={{ opacity: 0.4 }}>—</span>;
      }
    },
    {
      headerName: 'İşlemler',
      pinned: 'right',
      width: 175,
      minWidth: 165,
      cellRenderer: params => {
        const row = params.data;
        return (
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', height: '100%' }}>
            <button
              className="btn btn-sm btn-secondary"
              onClick={() => setLabelCargo(row)}
              title="Kargo Etiketi Yazdır"
              style={{ padding: '2px 8px', fontSize: 11 }}
            >
              🏷️ Etiket
            </button>
            {hasPermission('cargo', 'can_edit') && (
              <button
                className="btn btn-sm btn-secondary"
                onClick={() => { setEditCargo(row); setShowFormModal(true); }}
                title="Düzenle"
                style={{ padding: '2px 8px', fontSize: 11 }}
              >
                ✏️
              </button>
            )}
            {hasPermission('cargo', 'can_delete') && (
              <button
                className="btn btn-sm btn-danger"
                onClick={() => setDeleteCargoId(row.id)}
                title="Sil"
                style={{ padding: '2px 8px', fontSize: 11 }}
              >
                🗑️
              </button>
            )}
          </div>
        );
      }
    }
  ], [hasPermission]);

  const defaultColDef = useMemo(() => ({
    resizable: true,
    sortable: true,
    filter: true
  }), []);

  const rowSelection = useMemo(() => ({
    mode: 'singleRow',
    enableClickSelection: true
  }), []);

  return (
    <div className="cargo-container">
      {/* ── Üst İstatistik Sayaçları ─────────────────────────────── */}
      <div className="cargo-stats-grid">
        <div className="cargo-stat-card">
          <div className="cargo-stat-icon" style={{ color: '#6366f1' }}>📦</div>
          <div className="cargo-stat-info">
            <div className="cargo-stat-label">Toplam Kargo</div>
            <div className="cargo-stat-val">{stats.total}</div>
          </div>
        </div>

        <div className="cargo-stat-card" style={{ borderColor: 'rgba(59, 130, 246, 0.3)' }}>
          <div className="cargo-stat-icon" style={{ color: '#3b82f6', background: 'rgba(59, 130, 246, 0.1)' }}>📥</div>
          <div className="cargo-stat-info">
            <div className="cargo-stat-label" style={{ color: '#3b82f6' }}>Gelen Kargolar</div>
            <div className="cargo-stat-val" style={{ color: '#3b82f6' }}>{stats.incoming_count}</div>
          </div>
        </div>

        <div className="cargo-stat-card" style={{ borderColor: 'rgba(245, 158, 11, 0.3)' }}>
          <div className="cargo-stat-icon" style={{ color: '#f59e0b', background: 'rgba(245, 158, 11, 0.1)' }}>📤</div>
          <div className="cargo-stat-info">
            <div className="cargo-stat-label" style={{ color: '#f59e0b' }}>Giden / Gönderilen</div>
            <div className="cargo-stat-val" style={{ color: '#f59e0b' }}>{stats.outgoing_count}</div>
          </div>
        </div>

        <div className="cargo-stat-card" style={{ borderColor: 'rgba(56, 189, 248, 0.3)' }}>
          <div className="cargo-stat-icon" style={{ color: '#38bdf8', background: 'rgba(56, 189, 248, 0.1)' }}>🕒</div>
          <div className="cargo-stat-info">
            <div className="cargo-stat-label" style={{ color: '#38bdf8' }}>Bugün İşlem Gören</div>
            <div className="cargo-stat-val" style={{ color: '#38bdf8' }}>{stats.today}</div>
          </div>
        </div>

        <div className="cargo-stat-card" style={{ borderColor: 'rgba(34, 197, 94, 0.3)' }}>
          <div className="cargo-stat-icon" style={{ color: '#22c55e', background: 'rgba(34, 197, 94, 0.1)' }}>🔧</div>
          <div className="cargo-stat-info">
            <div className="cargo-stat-label" style={{ color: '#22c55e' }}>Servis Fişli</div>
            <div className="cargo-stat-val" style={{ color: '#22c55e' }}>{stats.service_count}</div>
          </div>
        </div>

        <div className="cargo-stat-card">
          <div className="cargo-stat-icon" style={{ color: '#eab308' }}>📄</div>
          <div className="cargo-stat-info">
            <div className="cargo-stat-label">İrsaliyeli Gönderiler</div>
            <div className="cargo-stat-val">{stats.waybill_count}</div>
          </div>
        </div>
      </div>

      {/* ── Toolbar & Filtreler ──────────────────────────────────── */}
      <div className="cargo-header-actions" style={{ flexWrap: 'wrap', gap: 12 }}>
        <div className="cargo-filter-group" style={{ flexWrap: 'wrap', gap: 8 }}>
          
          {/* Yön Sekmeleri (Tümü / Gelen / Giden) */}
          <div style={{
            display: 'inline-flex',
            background: 'var(--color-surface-alt, rgba(0,0,0,0.15))',
            padding: 3,
            borderRadius: 8,
            border: '1px solid var(--color-border)'
          }}>
            <button
              type="button"
              onClick={() => setDirectionFilter('all')}
              style={{
                padding: '6px 12px',
                borderRadius: 6,
                border: 'none',
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: directionFilter === 'all' ? 800 : 600,
                background: directionFilter === 'all' ? 'var(--color-primary)' : 'transparent',
                color: directionFilter === 'all' ? '#ffffff' : 'var(--color-text-secondary)',
                transition: 'all 0.15s ease'
              }}
            >
              📦 Tümü ({stats.total})
            </button>
            <button
              type="button"
              onClick={() => setDirectionFilter('incoming')}
              style={{
                padding: '6px 12px',
                borderRadius: 6,
                border: 'none',
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: directionFilter === 'incoming' ? 800 : 600,
                background: directionFilter === 'incoming' ? '#2563eb' : 'transparent',
                color: directionFilter === 'incoming' ? '#ffffff' : 'var(--color-text-secondary)',
                transition: 'all 0.15s ease'
              }}
            >
              📥 Gelen ({stats.incoming_count})
            </button>
            <button
              type="button"
              onClick={() => setDirectionFilter('outgoing')}
              style={{
                padding: '6px 12px',
                borderRadius: 6,
                border: 'none',
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: directionFilter === 'outgoing' ? 800 : 600,
                background: directionFilter === 'outgoing' ? '#d97706' : 'transparent',
                color: directionFilter === 'outgoing' ? '#ffffff' : 'var(--color-text-secondary)',
                transition: 'all 0.15s ease'
              }}
            >
              📤 Giden ({stats.outgoing_count})
            </button>
          </div>

          {/* Arama */}
          <div style={{ position: 'relative' }}>
            <input
              type="text"
              placeholder="Kargo no, irsaliye, alıcı, adres veya demirbaş ara..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="form-control cargo-search-input"
              style={{ paddingLeft: 32, minWidth: 260 }}
            />
            <span style={{ position: 'absolute', left: 10, top: 9, opacity: 0.5 }}>🔍</span>
          </div>

          {/* Kargo Firması Filtresi */}
          <select
            value={carrierFilter}
            onChange={e => setCarrierFilter(e.target.value)}
            className="form-control"
            style={{ width: 175 }}
          >
            {CARRIER_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>

          {/* Yenile */}
          <button className="btn btn-secondary" onClick={fetchShipments} title="Yenile">
            🔄
          </button>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button className="btn btn-secondary" onClick={handleExportExcel} title="CSV / Excel Dışa Aktar" style={{ fontSize: 12 }}>
            📤 Excel İndir
          </button>
          {hasPermission('cargo', 'can_create') && (
            <>
              <button
                className="btn btn-primary"
                onClick={() => handleOpenNewModal('incoming')}
                style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: 12.5 }}
              >
                <span>📥</span>
                <span>+ Gelen Kargo</span>
              </button>
              <button
                className="btn"
                onClick={() => handleOpenNewModal('outgoing')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  fontWeight: 800,
                  fontSize: 12.5,
                  background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: 8,
                  padding: '8px 14px',
                  boxShadow: '0 2px 8px rgba(245, 158, 11, 0.35)',
                  cursor: 'pointer'
                }}
              >
                <span>📤</span>
                <span>+ Giden Kargo</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── AG-Grid Tablosu (Çift Tıklama ile Detay Açma) ────────── */}
      <div className="cargo-grid-wrap">
        <div
          className={theme === 'light' || theme === 'sakura' ? 'ag-theme-quartz' : 'ag-theme-quartz-dark'}
          style={{ height: '100%', width: '100%' }}
        >
          <AgGridReact
            ref={gridRef}
            theme="legacy"
            rowData={shipments}
            columnDefs={columnDefs}
            defaultColDef={defaultColDef}
            animateRows={true}
            rowSelection={rowSelection}
            onRowDoubleClicked={params => setDetailCargo(params.data)}
            pagination={true}
            paginationPageSize={50}
            rowHeight={38}
            headerHeight={40}
            loadingOverlayComponent={() => (
              <div className="flex-center" style={{ gap: 8, height: '100%' }}>
                <div className="spinner" />
                <span>Kargo verileri yükleniyor...</span>
              </div>
            )}
            noRowsOverlayComponent={() => (
              <div style={{ padding: 32, textAlign: 'center', color: 'var(--color-text-muted)' }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>📭</div>
                <div>Kayıtlı kargo bulunamadı.</div>
              </div>
            )}
          />
        </div>
      </div>

      {/* ── Modallar ────────────────────────────────────────────── */}
      {showFormModal && (
        <CargoFormModal
          isOpen={showFormModal}
          onClose={() => { setShowFormModal(false); setEditCargo(null); }}
          onSaved={(savedId) => {
            fetchShipments();
            showNotification(editCargo ? 'Kargo güncellendi.' : 'Kargo kaydı başarıyla oluşturuldu.', 'success');
            triggerTableRefresh(['cargo_shipments', 'service_tickets']);
          }}
          editCargo={editCargo}
          initialDirection={formInitialDirection}
          cachedUsers={cachedUsers}
          currentUser={user}
        />
      )}

      {detailCargo && (
        <CargoDetailModal
          isOpen={Boolean(detailCargo)}
          onClose={() => setDetailCargo(null)}
          cargo={detailCargo}
          onPrintLabel={(c) => { setDetailCargo(null); setLabelCargo(c); }}
          onEdit={(c) => { setDetailCargo(null); setEditCargo(c); setShowFormModal(true); }}
        />
      )}

      {labelCargo && (
        <CargoLabelModal
          isOpen={Boolean(labelCargo)}
          onClose={() => setLabelCargo(null)}
          cargo={labelCargo}
          settings={settings}
        />
      )}

      <ConfirmDialog
        isOpen={Boolean(deleteCargoId)}
        title="Kargo Kaydını Sil"
        message="Bu kargo kaydını silmek istediğinize emin misiniz? Bu işlem geri alınamaz."
        confirmText="Evet, Sil"
        cancelText="İptal"
        type="danger"
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteCargoId(null)}
      />
    </div>
  );
}
