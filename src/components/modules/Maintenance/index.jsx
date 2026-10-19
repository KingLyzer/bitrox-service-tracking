import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { useApp } from '../../../context/AppContext';
import NewPlanModal from './NewPlanModal';
import MaintenanceDetail from './MaintenanceDetail';
import MasterCalendar from './MasterCalendar';
import ConfirmDialog from '../../common/ConfirmDialog';

export default function Maintenance({ tabData }) {
  const { user: currentUser, hasPermission } = useAuth();
  const { showNotification, theme, refreshToggle } = useApp();

  const [currentView, setCurrentView] = useState(() => {
    if (tabData?.view === 'plans') return 'plans';
    return 'calendar'; // Varsayılan olarak Master Operasyon Takvimi
  });

  useEffect(() => {
    if (tabData?.view) {
      setCurrentView(tabData.view);
    }
  }, [tabData?.view, tabData?.timestamp]);

  const [plans, setPlans] = useState(() => {
    try {
      const saved = localStorage.getItem('cached_maintenance_plans');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [loading, setLoading] = useState(false);
  const [activePlanId, setActivePlanId] = useState(null);
  const [showNewModal, setShowNewModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const loadPlans = useCallback(async () => {
    setLoading(true);
    try {
      const res = await window.electronAPI.getMaintenancePlans();
      if (res?.success) {
        const data = res.data || [];
        setPlans(data);
        try { localStorage.setItem('cached_maintenance_plans', JSON.stringify(data)); } catch {}
      } else {
        showNotification('Bakım planları yüklenemedi: ' + (res?.message || ''), 'danger');
      }
    } catch (err) {
      showNotification('Hata: ' + err.message, 'danger');
    } finally {
      setLoading(false);
    }
  }, [showNotification]);

  useEffect(() => {
    loadPlans();
  }, [loadPlans, refreshToggle]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const res = await window.electronAPI.deleteMaintenancePlan(deleteTarget.id, currentUser);
      if (res?.success) {
        showNotification(`"${deleteTarget.title}" bakım planı silindi.`, 'success');
        setDeleteTarget(null);
        loadPlans();
      } else {
        showNotification('Silme hatası: ' + (res?.message || ''), 'danger');
      }
    } catch (e) {
      showNotification('Hata: ' + e.message, 'danger');
    }
  };

  const filteredPlans = useMemo(() => {
    return plans.filter(p => {
      if (statusFilter !== 'all' && p.status !== statusFilter) return false;
      if (search.trim()) {
        const s = search.toLowerCase();
        const matchTitle = (p.title || '').toLowerCase().includes(s);
        const matchComp = (p.company_name || '').toLowerCase().includes(s);
        const matchPeriod = (p.period || '').toLowerCase().includes(s);
        return matchTitle || matchComp || matchPeriod;
      }
      return true;
    });
  }, [plans, statusFilter, search]);

  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Overall Statistics
  const stats = useMemo(() => {
    const totalPlans = plans.length;
    const activePlans = plans.filter(p => p.status === 'Devam Ediyor' || p.status === 'Planlandı').length;
    const completedPlans = plans.filter(p => p.status === 'Tamamlandı').length;
    const totalDevices = plans.reduce((sum, p) => sum + Number(p.total_devices || 0), 0);
    const completedDevices = plans.reduce((sum, p) => sum + Number(p.completed_devices || 0), 0);
    return { totalPlans, activePlans, completedPlans, totalDevices, completedDevices };
  }, [plans]);

  // If a plan is selected, show detail view
  if (activePlanId) {
    return (
      <MaintenanceDetail
        planId={activePlanId}
        onBack={() => {
          setActivePlanId(null);
          loadPlans();
        }}
        currentUser={currentUser}
        showNotification={showNotification}
        theme={theme}
      />
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Top Header & View Switcher */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 10,
        padding: isMobile ? '8px 10px' : '10px 18px',
        background: 'var(--color-surface)',
        borderBottom: '1px solid var(--color-border)',
        flexShrink: 0
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: isMobile ? 16 : 18, fontWeight: 800, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>{currentView === 'calendar' ? '🗓️' : '🛡️'}</span>
              <span>{currentView === 'calendar' ? 'Master Operasyon Takvimi' : 'Periyodik Bakım Yönetimi'}</span>
            </h2>
            <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--color-text-muted)' }}>
              {currentView === 'calendar'
                ? 'Tüm servis fişleri, kargolar, toner teslimatları ve periyodik bakımların merkezi IT takvimi'
                : 'Snipe-IT şirketlerine ait 6 aylık periyodik cihaz bakım planları ve kontrol takibi'}
            </p>
          </div>

          {/* Görünüm Değiştirici (Master Takvim / Bakım Planları) */}
          <div style={{
            display: 'flex',
            gap: 4,
            background: 'var(--color-surface-alt, rgba(255,255,255,0.05))',
            padding: 3,
            borderRadius: 8,
            border: '1px solid var(--color-border)'
          }}>
            <button
              className={`btn btn-xs ${currentView === 'calendar' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setCurrentView('calendar')}
              style={{ fontWeight: 700, fontSize: 11.5, display: 'flex', alignItems: 'center', gap: 5, padding: '4px 12px' }}
            >
              <span>🗓️</span> Master Takvim
            </button>
            <button
              className={`btn btn-xs ${currentView === 'plans' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setCurrentView('plans')}
              style={{ fontWeight: 700, fontSize: 11.5, display: 'flex', alignItems: 'center', gap: 5, padding: '4px 12px' }}
            >
              <span>🛡️</span> Bakım Planları ({plans.length})
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {currentView === 'plans' && hasPermission('maintenance', 'can_create') && (
            <button
              className="btn btn-primary btn-sm"
              onClick={() => setShowNewModal(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, padding: '5px 12px', fontSize: 11.5 }}
            >
              ➕ Yeni Bakım Planla
            </button>
          )}
          <button className="btn btn-secondary btn-sm" onClick={loadPlans} title="Yenile">
            🔄
          </button>
        </div>
      </div>

      {/* ── 1. MASTER OPERASYON TAKVİMİ ───────────────────────────── */}
      {currentView === 'calendar' && (
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <MasterCalendar
            initialDate={tabData?.date}
            autoOpenSummary={tabData?.openDailySummary}
            onSelectPlan={(id) => {
              setActivePlanId(id);
              setCurrentView('plans');
            }}
            currentUser={currentUser}
          />
        </div>
      )}

      {/* ── 2. PERİYODİK BAKIM PLANLARI LİSTESİ ───────────────────── */}
      {currentView === 'plans' && (
        <div style={{ flex: 1, overflowY: 'auto', padding: isMobile ? '12px 10px' : '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: isMobile ? 8 : 12 }}>
        <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, padding: '10px 14px' }}>
          <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', fontWeight: 600 }}>Toplam Plan</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--color-text)', marginTop: 2 }}>
            {stats.totalPlans}
          </div>
        </div>

        <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, padding: '10px 14px' }}>
          <div style={{ fontSize: 11, color: '#3b82f6', fontWeight: 600 }}>Aktif / Devam Eden</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#3b82f6', marginTop: 2 }}>
            {stats.activePlans}
          </div>
        </div>

        <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, padding: '10px 14px' }}>
          <div style={{ fontSize: 11, color: '#10b981', fontWeight: 600 }}>Tamamlanan</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#10b981', marginTop: 2 }}>
            {stats.completedPlans}
          </div>
        </div>

        <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, padding: '10px 14px' }}>
          <div style={{ fontSize: 11, color: 'var(--color-primary)', fontWeight: 600 }}>Biten Cihazlar</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--color-primary)', marginTop: 2 }}>
            {stats.completedDevices} <span style={{ fontSize: 11, color: 'var(--color-text-muted)', fontWeight: 500 }}>/ {stats.totalDevices}</span>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button
            className={`btn btn-xs ${statusFilter === 'all' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setStatusFilter('all')}
            style={{ padding: '4px 8px', fontSize: 11 }}
          >
            Tüm Planlar
          </button>
          <button
            className={`btn btn-xs ${statusFilter === 'Devam Ediyor' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setStatusFilter('Devam Ediyor')}
            style={{ padding: '4px 8px', fontSize: 11 }}
          >
            Devam Edenler
          </button>
          <button
            className={`btn btn-xs ${statusFilter === 'Planlandı' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setStatusFilter('Planlandı')}
            style={{ padding: '4px 8px', fontSize: 11 }}
          >
            Planlananlar
          </button>
          <button
            className={`btn btn-xs ${statusFilter === 'Tamamlandı' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setStatusFilter('Tamamlandı')}
            style={{ padding: '4px 8px', fontSize: 11 }}
          >
            Tamamlananlar
          </button>
        </div>

        <div style={{ flex: '1 1 200px', minWidth: 160 }}>
          <input
            type="text"
            className="form-control"
            placeholder="🔍 Şirket veya plan ara..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ background: 'var(--color-surface)', color: 'var(--color-text)', border: '1px solid var(--color-border)', fontSize: 11.5, padding: '4px 8px', height: 30 }}
          />
        </div>
      </div>

      {/* Plans List Cards */}
      {loading && plans.length === 0 ? (
        <div className="flex-center flex-column" style={{ height: 250, gap: 12 }}>
          <div className="spinner" />
          <div style={{ color: 'var(--color-text-muted)' }}>Yükleniyor...</div>
        </div>
      ) : filteredPlans.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '60px 20px',
          background: 'var(--color-surface)',
          border: '1px dashed var(--color-border)',
          borderRadius: 8,
          color: 'var(--color-text-muted)'
        }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>🛡️</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text)' }}>Henüz Bakım Planı Bulunmuyor</div>
          <p style={{ fontSize: 12, marginTop: 4 }}>
            "Yeni Bakım Planla" butonuna basarak Snipe-IT şirketlerinden biri için 6 aylık periyodik bakım başlatabilirsiniz.
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
          {filteredPlans.map(p => {
            const totalDev = Number(p.total_devices || 0);
            const compDev = Number(p.completed_devices || 0);
            const pct = totalDev > 0 ? Math.round((compDev / totalDev) * 100) : 0;
            const isDone = p.status === 'Tamamlandı';

            return (
              <div
                key={p.id}
                style={{
                  background: 'var(--color-surface)',
                  border: isDone ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid var(--color-border)',
                  borderRadius: 8,
                  padding: 16,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                  boxShadow: isDone ? '0 2px 8px rgba(16, 185, 129, 0.05)' : 'none',
                  transition: 'all 0.2s ease',
                  cursor: 'pointer'
                }}
                onClick={() => setActivePlanId(p.id)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                  <div>
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-primary)' }}>
                      🏢 {p.company_name}
                    </span>
                    <h3 style={{ margin: '4px 0 0', fontSize: 15, fontWeight: 800, color: 'var(--color-text)' }}>
                      {p.title}
                    </h3>
                  </div>

                  <span className={`badge ${isDone ? 'badge-success' : p.status === 'Devam Ediyor' ? 'badge-primary' : 'badge-warning'}`} style={{ fontSize: 10.5, fontWeight: 700 }}>
                    {p.status}
                  </span>
                </div>

                <div style={{ fontSize: 11.5, color: 'var(--color-text-secondary)', display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div>🗓️ Dönem: <b>{p.period}</b></div>
                  <div>📅 Başlangıç: <b>{p.planned_date || '—'}</b></div>
                  {p.notes && <div style={{ color: 'var(--color-text-muted)', fontSize: 11 }}>📝 {p.notes}</div>}
                </div>

                {/* Progress bar */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 600, marginBottom: 4 }}>
                    <span style={{ color: 'var(--color-text-muted)' }}>Cihaz İlerlemesi</span>
                    <span style={{ color: pct === 100 ? '#10b981' : 'var(--color-primary)', fontWeight: 700 }}>
                      {compDev} / {totalDev} (%{pct})
                    </span>
                  </div>
                  <div style={{
                    height: 6,
                    background: 'var(--color-surface-alt, rgba(255,255,255,0.06))',
                    borderRadius: 999,
                    overflow: 'hidden'
                  }}>
                    <div style={{
                      height: '100%',
                      width: `${pct}%`,
                      background: pct === 100 ? '#10b981' : 'var(--color-primary)',
                      transition: 'width 0.3s'
                    }} />
                  </div>
                </div>

                {/* Card footer buttons */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--color-border)', paddingTop: 10, marginTop: 4 }} onClick={e => e.stopPropagation()}>
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => setActivePlanId(p.id)}
                    style={{ fontSize: 11, padding: '4px 12px' }}
                  >
                    🔍 Cihaz Listesi ({totalDev})
                  </button>

                  {hasPermission('maintenance', 'can_delete') && (
                    <button
                      className="btn btn-icon btn-sm btn-danger"
                      title="Planı Sil"
                      onClick={() => setDeleteTarget(p)}
                    >
                      🗑️
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* New Plan Modal */}
      {showNewModal && (
        <NewPlanModal
          currentUser={currentUser}
          showNotification={showNotification}
          onClose={() => setShowNewModal(false)}
          onCreated={(newId) => {
            setShowNewModal(false);
            loadPlans();
            if (newId) setActivePlanId(newId);
          }}
        />
      )}

      {/* Delete Confirmation */}
      {deleteTarget && (
        <ConfirmDialog
          title="Bakım Planını Sil"
          message={`"${deleteTarget.title}" (${deleteTarget.company_name}) bakım planı ve bu plana bağlı tüm cihaz kayıtları tamamen silinecektir. Emin misiniz?`}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
          confirmText="Evet, Sil"
          type="danger"
        />
      )}
        </div>
      )}
    </div>
  );
}
