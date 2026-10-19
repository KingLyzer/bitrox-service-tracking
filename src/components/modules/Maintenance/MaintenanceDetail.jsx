import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { AgGridReact } from 'ag-grid-react';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-quartz.css';
import { useAuth } from '../../../context/AuthContext';
import DeviceCheckModal from './DeviceCheckModal';
import { exportMaintenanceCsv, exportMaintenanceExcel, exportMaintenanceHandoverExcel } from './exportHelpers';
import ConfirmDialog from '../../common/ConfirmDialog';

export default function MaintenanceDetail({ planId, onBack, currentUser, showNotification, theme }) {
  const { hasPermission } = useAuth();
  const [plan, setPlan] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeItem, setActiveItem] = useState(null);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all'); // 'all' | 'pending' | 'completed'
  const [showCompleteConfirm, setShowCompleteConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
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

  const canDelete = currentUser?.role_id === 1 || currentUser?.is_admin || hasPermission('maintenance', 'can_delete') || hasPermission('settings', 'can_admin');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await window.electronAPI.getMaintenancePlanDetail(planId);
      if (res?.success) {
        setPlan(res.plan);
        setItems(res.items || []);
      } else {
        showNotification('Plan yüklenemedi: ' + (res?.message || ''), 'danger');
      }
    } catch (err) {
      showNotification('Hata: ' + err.message, 'danger');
    } finally {
      setLoading(false);
    }
  }, [planId, showNotification]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSaveItem = async (payload) => {
    if (!activeItem) return;
    try {
      const res = await window.electronAPI.saveMaintenanceItemCheck(activeItem.id, payload);
      if (res?.success) {
        showNotification(`${activeItem.asset_tag || 'Cihaz'} bakımı tamamlandı olarak kaydedildi.`, 'success');
        setActiveItem(null);
        loadData();
      } else {
        showNotification('Kaydetme hatası: ' + (res?.message || ''), 'danger');
      }
    } catch (e) {
      showNotification('Hata: ' + e.message, 'danger');
    }
  };

  const handleCompletePlan = async () => {
    try {
      const res = await window.electronAPI.completeMaintenancePlan(planId, currentUser);
      if (res?.success) {
        showNotification('İşletme periyodik bakımı başarıyla tamamlandı olarak onaylandı! 🎉', 'success');
        setShowCompleteConfirm(false);
        loadData();
      } else {
        showNotification('İşlem başarısız: ' + (res?.message || ''), 'danger');
      }
    } catch (e) {
      showNotification('Hata: ' + e.message, 'danger');
    }
  };

  const handleDeletePlan = async () => {
    setDeleting(true);
    try {
      const res = await window.electronAPI.deleteMaintenancePlan(planId, currentUser);
      if (res?.success) {
        showNotification(`"${plan?.title}" bakım planı başarıyla silindi.`, 'success');
        setShowDeleteConfirm(false);
        onBack();
      } else {
        showNotification('Silme hatası: ' + (res?.message || ''), 'danger');
      }
    } catch (e) {
      showNotification('Hata: ' + e.message, 'danger');
    } finally {
      setDeleting(false);
    }
  };

  // Filter items
  const filteredItems = useMemo(() => {
    return items.filter(it => {
      if (filterStatus === 'pending' && it.status === 'Tamamlandı') return false;
      if (filterStatus === 'completed' && it.status !== 'Tamamlandı') return false;
      if (search.trim()) {
        const s = search.toLowerCase();
        const matchTag = (it.asset_tag || '').toLowerCase().includes(s);
        const matchName = (it.asset_name || '').toLowerCase().includes(s);
        const matchModel = (it.model_name || '').toLowerCase().includes(s);
        const matchSerial = (it.serial_no || '').toLowerCase().includes(s);
        const matchUser = (it.assigned_user || '').toLowerCase().includes(s);
        const matchLoc = (it.location_name || '').toLowerCase().includes(s);
        return matchTag || matchName || matchModel || matchSerial || matchUser || matchLoc;
      }
      return true;
    });
  }, [items, filterStatus, search]);

  const total = items.length;
  const completed = items.filter(i => i.status === 'Tamamlandı').length;
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

  // Clean AG Grid columns with separate Model & Serial columns
  const columnDefs = useMemo(() => [
    {
      field: 'asset_tag',
      headerName: 'Envanter Tag',
      width: 145,
      pinned: 'left',
      cellRenderer: p => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, fontFamily: 'monospace', fontSize: 12, color: 'var(--color-primary)' }}>
          <span>💻</span>
          <span>{p.value || '—'}</span>
        </div>
      )
    },
    {
      field: 'model_name',
      headerName: 'Model / Tanım',
      flex: 1,
      minWidth: 160,
      cellRenderer: p => (
        <span style={{ fontWeight: 600, color: 'var(--color-text)', fontSize: 12 }}>
          {p.value || p.data.asset_name || '—'}
        </span>
      )
    },
    {
      field: 'serial_no',
      headerName: 'Seri No',
      width: 135,
      cellRenderer: p => (
        <span style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--color-text-secondary)' }}>
          {p.value || '—'}
        </span>
      )
    },
    {
      field: 'assigned_user',
      headerName: 'Zimmetli Personel',
      width: 165,
      cellRenderer: p => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
          <span>👤</span>
          <span style={{ fontWeight: 500 }}>{p.value || '— (Ortak Alan)'}</span>
        </div>
      )
    },
    {
      field: 'location_name',
      headerName: 'Lokasyon / Birim',
      width: 140,
      cellRenderer: p => p.value ? `📍 ${p.value}` : '—'
    },
    {
      headerName: 'Kontroller (Özet)',
      width: 155,
      cellRenderer: p => {
        const d = p.data;
        const requiredChecks = [
          d.check_dust, d.check_fan, d.check_visual_audio, d.check_performance,
          d.check_ports, d.check_antivirus, d.check_license, d.check_network,
          d.check_standard_software
        ];
        const doneReq = requiredChecks.filter(Boolean).length;
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{
              fontSize: 10.5,
              fontWeight: 700,
              padding: '2px 8px',
              borderRadius: 4,
              background: doneReq === 9 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
              color: doneReq === 9 ? '#10b981' : '#d97706'
            }}>
              {doneReq}/9 Zorunlu
            </span>
            {d.notes && (
              <span title={d.notes} style={{ fontSize: 12, cursor: 'help' }}>📝</span>
            )}
          </div>
        );
      }
    },
    {
      field: 'tech_name',
      headerName: 'Teknisyen / Yönetici',
      width: 160,
      cellRenderer: p => p.value ? `👔 ${p.value}` : '—'
    },
    {
      field: 'status',
      headerName: 'Bakım Durumu',
      width: 125,
      cellRenderer: p => {
        const isDone = p.value === 'Tamamlandı';
        return (
          <span className={`badge ${isDone ? 'badge-success' : 'badge-warning'}`} style={{ fontWeight: 700, fontSize: 11 }}>
            {isDone ? '✓ Tamamlandı' : '⏳ Bekliyor'}
          </span>
        );
      }
    },
    {
      headerName: 'İşlemler',
      width: 125,
      pinned: 'right',
      cellRenderer: p => (
        <button
          className={`btn btn-sm ${p.data.status === 'Tamamlandı' ? 'btn-secondary' : 'btn-primary'}`}
          onClick={() => setActiveItem(p.data)}
          style={{ fontSize: 11, padding: '3px 8px', width: '100%' }}
        >
          {p.data.status === 'Tamamlandı' ? '👁️ Düzenle' : '⚡ Bakımı Yap'}
        </button>
      )
    }
  ], []);

  if (loading && !plan) {
    return (
      <div className="flex-center flex-column" style={{ height: 400, gap: 14 }}>
        <div className="spinner" />
        <div style={{ color: 'var(--color-text-muted)' }}>Bakım planı yükleniyor...</div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '10px 12px', gap: 10, overflow: 'hidden' }}>
      {/* Top Header Card */}
      <div style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 8,
        padding: '10px 14px',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        flexShrink: 0
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 240 }}>
            <button
              className="btn btn-secondary btn-sm"
              onClick={onBack}
              style={{ fontSize: 11.5, display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px' }}
            >
              ← Geri
            </button>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <h2 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: 'var(--color-text)', lineHeight: 1.2 }}>
                  {plan?.title || 'Periyodik Bakım'}
                </h2>
                <span className={`badge ${plan?.status === 'Tamamlandı' ? 'badge-success' : plan?.status === 'Devam Ediyor' ? 'badge-primary' : 'badge-warning'}`} style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px' }}>
                  {plan?.status || 'Planlandı'}
                </span>
              </div>
              <div style={{ fontSize: 10.5, color: 'var(--color-text-secondary)', marginTop: 3, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <span>🏢 <b>{plan?.company_name}</b></span>
                <span>🗓️ <b>{plan?.period}</b></span>
                <span>📅 <b>{plan?.planned_date}</b></span>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => exportMaintenanceHandoverExcel(plan, items)}
              title="İşletme Müdürü ve Teknisyen İmzalı Excel Tutanağı"
              style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10.5, fontWeight: 700, padding: '4px 8px' }}
            >
              📝 İmza Tutanağı
            </button>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => exportMaintenanceExcel(plan, items)}
              title="11 Madde Detaylı Teknik Kontrol Raporu"
              style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10.5, padding: '4px 8px' }}
            >
              📊 Rapor (.xls)
            </button>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => exportMaintenanceCsv(plan, items)}
              title="CSV Olarak İndir"
              style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10.5, padding: '4px 8px' }}
            >
              📄 CSV
            </button>
            <button
              className="btn btn-secondary btn-sm"
              onClick={loadData}
              title="Yenile"
              style={{ padding: '4px 7px', fontSize: 11 }}
            >
              🔄
            </button>

            {plan?.status !== 'Tamamlandı' && (
              <button
                className="btn btn-success btn-sm"
                onClick={() => setShowCompleteConfirm(true)}
                style={{ display: 'flex', alignItems: 'center', gap: 4, fontWeight: 700, fontSize: 10.5, padding: '4px 8px' }}
              >
                🏁 Tamamla
              </button>
            )}

            {canDelete && (
              <button
                className="btn btn-danger btn-sm"
                onClick={() => setShowDeleteConfirm(true)}
                style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10.5, padding: '4px 8px' }}
                title="Bakım Planını Sil"
              >
                🗑️ Sil
              </button>
            )}
          </div>
        </div>

        {/* Progress Bar */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5, fontWeight: 700, marginBottom: 3 }}>
            <span style={{ color: 'var(--color-text)' }}>
              Genel İlerleme: {completed} / {total} Cihaz
            </span>
            <span style={{ color: percent === 100 ? '#10b981' : 'var(--color-primary)' }}>
              %{percent}
            </span>
          </div>
          <div style={{
            height: 8,
            background: 'var(--color-surface-alt, rgba(255,255,255,0.06))',
            borderRadius: 999,
            overflow: 'hidden',
            border: '1px solid var(--color-border)'
          }}>
            <div style={{
              height: '100%',
              width: `${percent}%`,
              background: percent === 100 
                ? 'linear-gradient(90deg, #10b981, #059669)' 
                : 'linear-gradient(90deg, #3b82f6, #6366f1)',
              transition: 'width 0.4s ease'
            }} />
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 8,
        flexWrap: 'wrap'
      }}>
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
          <button
            className={`btn btn-sm ${filterStatus === 'all' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setFilterStatus('all')}
            style={{ fontSize: 10.5, padding: '3px 8px' }}
          >
            Tümü ({total})
          </button>
          <button
            className={`btn btn-sm ${filterStatus === 'pending' ? 'btn-warning' : 'btn-secondary'}`}
            onClick={() => setFilterStatus('pending')}
            style={{ fontSize: 10.5, padding: '3px 8px' }}
          >
            ⏳ Bekleyen ({total - completed})
          </button>
          <button
            className={`btn btn-sm ${filterStatus === 'completed' ? 'btn-success' : 'btn-secondary'}`}
            onClick={() => setFilterStatus('completed')}
            style={{ fontSize: 10.5, padding: '3px 8px' }}
          >
            ✅ Tamamlanan ({completed})
          </button>
        </div>

        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flex: 1, minWidth: 200, justifyContent: 'flex-end' }}>
          <input
            type="text"
            className="form-control"
            placeholder="🔍 Cihaz, Seri no, Kullanıcı, Lokasyon..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ background: 'var(--color-surface)', color: 'var(--color-text)', border: '1px solid var(--color-border)', fontSize: 11.5, padding: '4px 8px', maxWidth: 220, height: 28 }}
          />

          <div style={{ display: 'flex', border: '1px solid var(--color-border)', borderRadius: 6, overflow: 'hidden' }}>
            <button
              onClick={() => setViewMode('cards')}
              className={`btn btn-sm ${viewMode === 'cards' ? 'btn-primary' : 'btn-secondary'}`}
              title="Kart Görünümü"
              style={{ borderRadius: 0, padding: '3px 7px', fontSize: 11 }}
            >
              📱 Kart
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`btn btn-sm ${viewMode === 'table' ? 'btn-primary' : 'btn-secondary'}`}
              title="Tablo Görünümü"
              style={{ borderRadius: 0, padding: '3px 7px', fontSize: 11 }}
            >
              📊 Tablo
            </button>
          </div>
        </div>
      </div>

      {/* Devices View: Card View (Mobile Friendly) or AG Grid Table */}
      {viewMode === 'cards' ? (
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8, paddingRight: 2 }}>
          {filteredItems.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 32, color: 'var(--color-text-muted)', background: 'var(--color-surface)', borderRadius: 8, border: '1px solid var(--color-border)' }}>
              🔍 Kriterlere uygun cihaz bulunamadı.
            </div>
          ) : (
            filteredItems.map(item => (
              <div
                key={item.id}
                style={{
                  background: 'var(--color-surface)',
                  border: `1px solid ${item.status === 'Tamamlandı' ? 'rgba(16, 185, 129, 0.4)' : 'var(--color-border)'}`,
                  borderRadius: 8,
                  padding: '10px 12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                  boxShadow: '0 1px 4px rgba(0,0,0,0.06)'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontWeight: 800, fontSize: 13, color: 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span>💻</span>
                    <span>{item.asset_tag}</span>
                  </div>
                  <span className={`badge ${item.status === 'Tamamlandı' ? 'badge-success' : 'badge-warning'}`} style={{ fontSize: 9.5, fontWeight: 700, padding: '2px 7px' }}>
                    {item.status === 'Tamamlandı' ? '✓ Tamamlandı' : 'Bekliyor'}
                  </span>
                </div>

                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text)' }}>
                  {item.model_name || item.asset_name || 'Standart PC'}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 2, fontSize: 11, color: 'var(--color-text-secondary)' }}>
                  <div>👤 <b>{item.assigned_user || '— (Ortak Alan / Boşta)'}</b></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 10.5 }}>
                    <span>🏢 {item.location_name || 'Belirtilmedi'}</span>
                    <span>SN: {item.serial_no || '—'}</span>
                  </div>
                </div>

                <div style={{ marginTop: 4, display: 'flex', gap: 6 }}>
                  <button
                    className={`btn ${item.status === 'Tamamlandı' ? 'btn-secondary' : 'btn-primary'} btn-sm`}
                    onClick={() => setActiveItem(item)}
                    style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 11.5, fontWeight: 700, padding: '7px 10px' }}
                  >
                    {item.status === 'Tamamlandı' ? '✏️ Kontrolleri İncele / Düzenle' : '⚡ Bakımı Yap'}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        <div style={{ flex: 1, minHeight: 280, border: '1px solid var(--color-border)', borderRadius: 8, overflow: 'hidden' }}>
          <div className={theme === 'light' || theme === 'sakura' ? 'ag-theme-quartz' : 'ag-theme-quartz-dark'} style={{ height: '100%', width: '100%' }}>
            <AgGridReact
              theme="legacy"
              rowData={filteredItems}
              columnDefs={columnDefs}
              defaultColDef={{ resizable: true, sortable: true, filter: true }}
              onRowDoubleClicked={p => p.data && setActiveItem(p.data)}
              pagination
              paginationPageSize={50}
              rowHeight={36}
              headerHeight={36}
              suppressDragLeaveHidesColumns={true}
              overlayNoRowsTemplate='<span class="ag-overlay-no-rows-center">Kriterlere uygun cihaz bulunamadı.</span>'
            />
          </div>
        </div>
      )}

      {/* Single Device Check Modal */}
      {activeItem && (
        <DeviceCheckModal
          item={activeItem}
          currentUser={currentUser}
          onClose={() => setActiveItem(null)}
          onSave={handleSaveItem}
        />
      )}

      {/* Complete Plan Confirmation Dialog */}
      {showCompleteConfirm && (
        <ConfirmDialog
          title="Tüm İşletme Bakımını Tamamla"
          message={`"${plan?.title}" periyodik bakımını tümüyle 'Tamamlandı' olarak onaylamak istiyor musunuz? (${completed}/${total} cihaz bakımı tamamlanmış durumda).`}
          onConfirm={handleCompletePlan}
          onCancel={() => setShowCompleteConfirm(false)}
          confirmText="Evet, Bakımı Tamamla"
          type="success"
        />
      )}

      {/* Delete Plan Confirmation Dialog */}
      {showDeleteConfirm && (
        <ConfirmDialog
          title="Bakım Planını Sil"
          message={`"${plan?.title}" (${plan?.company_name}) bakım planı ve tüm cihaz kayıtları tamamen silinecektir. Bu işlem geri alınamaz. Emin misiniz?`}
          onConfirm={handleDeletePlan}
          onCancel={() => setShowDeleteConfirm(false)}
          confirmText={deleting ? "Siliniyor..." : "Evet, Planı Sil"}
          type="danger"
        />
      )}
    </div>
  );
}
