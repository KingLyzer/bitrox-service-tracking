import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { AgGridReact } from 'ag-grid-react';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-quartz.css';
import { useAuth } from '../../../context/AuthContext';
import { useApp } from '../../../context/AppContext';
import ConfirmDialog from '../../common/ConfirmDialog';
import BitlockerFormModal from './BitlockerFormModal';
import BitlockerRawModal from './BitlockerRawModal';
import '../../../styles/bitlocker.css';

export default function BitlockerModule() {
  const { user, hasPermission } = useAuth();
  const { showNotification, theme } = useApp();

  const [keys, setKeys] = useState(() => {
    try {
      const saved = localStorage.getItem('cached_bitlocker_keys');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [stats, setStats] = useState({ total: 0, active: 0, trash: 0, recent: 0, devices: 0 });
  const [loading, setLoading] = useState(false);

  // Tab & Filtreler
  const [activeTab, setActiveTab] = useState('active'); // 'active' | 'trash'
  const [search, setSearch] = useState('');
  const [pageSize, setPageSize] = useState(100);

  // Kurtarma Anahtarı Maskeleme & Kopyalama Durumu
  const [unmaskedKeys, setUnmaskedKeys] = useState(new Set());
  const [copiedKeyId, setCopiedKeyId] = useState(null);

  // Modallar
  const [showFormModal, setShowFormModal] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [showRawModal, setShowRawModal] = useState(false);
  const [rawItem, setRawItem] = useState(null);

  // Silme / Geri Yükleme Onay Dialog
  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    title: '',
    message: '',
    action: null,
    isDanger: true,
  });

  const gridRef = useRef(null);

  // ── Verileri Çek ──────────────────────────────────────────
  const fetchKeys = useCallback(async () => {
    setLoading(true);
    try {
      let resKeys, resStats;
      if (window.electronAPI?.getBitlockerKeys) {
        [resKeys, resStats] = await Promise.all([
          window.electronAPI.getBitlockerKeys({ status: activeTab, search }),
          window.electronAPI.getBitlockerStats()
        ]);
      } else {
        const [kRes, sRes] = await Promise.all([
          fetch(`${window.API_BASE}/api/bitlocker?status=${activeTab}&search=${encodeURIComponent(search)}`),
          fetch(`${window.API_BASE}/api/bitlocker/stats`)
        ]);
        resKeys = await kRes.json();
        resStats = await sRes.json();
      }

      if (resKeys?.success) {
        const data = resKeys.data || [];
        setKeys(data);
        if (activeTab === 'active' && !search) {
          try { localStorage.setItem('cached_bitlocker_keys', JSON.stringify(data)); } catch {}
        }
      }
      if (resStats?.success) {
        setStats(resStats.stats || {});
      }
    } catch (err) {
      showNotification('Veriler alınamadı: ' + err.message, 'danger');
    } finally {
      setLoading(false);
    }
  }, [activeTab, search, showNotification]);

  useEffect(() => {
    fetchKeys();
  }, [fetchKeys]);

  // ── Kurtarma Anahtarı Kopyalama ───────────────────────────
  const handleCopyKey = useCallback((recoveryKey, id = null) => {
    if (!recoveryKey) return;
    navigator.clipboard.writeText(recoveryKey);
    if (id) {
      setCopiedKeyId(id);
      setTimeout(() => setCopiedKeyId(null), 2000);
    }
    showNotification('BitLocker kurtarma anahtarı panoya kopyalandı.', 'success');
  }, [showNotification]);

  // ── Maskeleme Aç/Kapa ─────────────────────────────────────
  const toggleKeyMask = useCallback((id) => {
    setUnmaskedKeys(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  // ── Kaydet / Güncelle ─────────────────────────────────────
  const handleSaveKey = async (formData) => {
    let res;
    if (window.electronAPI?.saveBitlockerKey) {
      res = await window.electronAPI.saveBitlockerKey(formData);
    } else {
      const url = formData.id 
        ? `${window.API_BASE}/api/bitlocker/${formData.id}` 
        : `${window.API_BASE}/api/bitlocker`;
      const response = await fetch(url, {
        method: formData.id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      res = await response.json();
    }

    if (res?.success) {
      showNotification(res.message || 'Kayıt başarıyla tamamlandı.', 'success');
      fetchKeys();
    } else {
      throw new Error(res?.message || 'Kaydedilemedi');
    }
  };

  // ── Sil (Çöp Kutusu) ──────────────────────────────────────
  const handleDelete = (item) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Çöp Kutusuna Taşı',
      message: `"${item.full_name}" kullanıcısına ait BitLocker anahtarı çöp kutusuna taşınacak. Onaylıyor musunuz?`,
      isDanger: true,
      action: async () => {
        try {
          let res;
          if (window.electronAPI?.deleteBitlockerKey) {
            res = await window.electronAPI.deleteBitlockerKey(item.id, false);
          } else {
            const response = await fetch(`${window.API_BASE}/api/bitlocker/${item.id}`, { method: 'DELETE' });
            res = await response.json();
          }
          if (res?.success) {
            showNotification('Kayıt çöp kutusuna taşındı.', 'info');
            fetchKeys();
          } else {
            showNotification(res?.message || 'Hata oluştu', 'danger');
          }
        } catch (e) {
          showNotification(e.message, 'danger');
        }
      }
    });
  };

  // ── Geri Yükle ────────────────────────────────────────────
  const handleRestore = (item) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Geri Yükle',
      message: `"${item.full_name}" kullanıcısına ait BitLocker anahtarı aktif listeye geri yüklensin mi?`,
      isDanger: false,
      action: async () => {
        try {
          let res;
          if (window.electronAPI?.restoreBitlockerKey) {
            res = await window.electronAPI.restoreBitlockerKey(item.id);
          } else {
            const response = await fetch(`${window.API_BASE}/api/bitlocker/${item.id}/restore`, { method: 'POST' });
            res = await response.json();
          }
          if (res?.success) {
            showNotification('Kayıt geri yüklendi.', 'success');
            fetchKeys();
          } else {
            showNotification(res?.message || 'Hata oluştu', 'danger');
          }
        } catch (e) {
          showNotification(e.message, 'danger');
        }
      }
    });
  };

  // ── Kalıcı Sil ────────────────────────────────────────────
  const handlePermanentDelete = (item) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Kalıcı Olarak Sil',
      message: `DİKKAT! "${item.full_name}" kaydı ve kurtarma anahtarı veritabanından kalıcı olarak silinecektir. Bu işlem geri alınamaz!`,
      isDanger: true,
      action: async () => {
        try {
          let res;
          if (window.electronAPI?.deleteBitlockerKey) {
            res = await window.electronAPI.deleteBitlockerKey(item.id, true);
          } else {
            const response = await fetch(`${window.API_BASE}/api/bitlocker/${item.id}/permanent`, { method: 'DELETE' });
            res = await response.json();
          }
          if (res?.success) {
            showNotification('Kayıt kalıcı olarak silindi.', 'warning');
            fetchKeys();
          } else {
            showNotification(res?.message || 'Hata oluştu', 'danger');
          }
        } catch (e) {
          showNotification(e.message, 'danger');
        }
      }
    });
  };

  // ── CSV Dışa Aktar ────────────────────────────────────────
  const handleExportCsv = () => {
    if (gridRef.current?.api) {
      gridRef.current.api.exportDataAsCsv({
        fileName: `BitLocker_Kurtarma_Anahtarlari_${new Date().toISOString().slice(0, 10)}.csv`
      });
    }
  };

  // ── AG-Grid Sütun Tanımları ───────────────────────────────
  const columnDefs = useMemo(() => [
    {
      headerName: '#',
      valueGetter: params => (params.node ? params.node.rowIndex + 1 : ''),
      width: 65,
      pinned: 'left',
      sortable: false,
      cellRenderer: params => (
        <span style={{ color: 'var(--color-text-secondary, #94a3b8)', fontSize: 11, fontWeight: 700 }}>
          {params.value}
        </span>
      )
    },
    {
      headerName: 'Personel (Ad Soyad)',
      field: 'full_name',
      minWidth: 190,
      flex: 1.1,
      pinned: 'left',
      sortable: true,
      cellRenderer: params => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700 }}>
          <span style={{ fontSize: 14 }}>👤</span>
          <span style={{ color: 'var(--color-text, #f8fafc)' }}>{params.value}</span>
        </div>
      )
    },
    {
      headerName: 'Cihaz Adı',
      field: 'device_name',
      width: 150,
      sortable: true,
      cellRenderer: params => params.value ? (
        <span style={{ fontWeight: 600, color: '#38bdf8' }}>💻 {params.value}</span>
      ) : (
        <span style={{ opacity: 0.35 }}>—</span>
      )
    },
    {
      headerName: 'Tanımlayıcı (GUID)',
      field: 'identifier',
      width: 320,
      sortable: true,
      cellRenderer: params => params.value ? (
        <span className="bitlocker-guid-badge" title={params.value}>
          {params.value}
        </span>
      ) : (
        <span style={{ opacity: 0.35 }}>—</span>
      )
    },
    {
      headerName: 'Kurtarma Anahtarı',
      field: 'recovery_key',
      minWidth: 420,
      flex: 1.6,
      sortable: false,
      cellRenderer: params => {
        const row = params.data;
        if (!row?.recovery_key) return <span style={{ opacity: 0.35 }}>—</span>;

        const isUnmasked = unmaskedKeys.has(row.id);
        const isCopied = copiedKeyId === row.id;
        const displayText = isUnmasked
          ? row.recovery_key
          : row.recovery_key.replace(/\d{6}/g, '••••••');

        return (
          <div className="bitlocker-key-cell">
            <span
              className={`bitlocker-key-text ${!isUnmasked ? 'masked' : ''}`}
              style={{ color: isUnmasked ? '#38bdf8' : 'inherit' }}
            >
              {displayText}
            </span>
            <div className="bitlocker-key-actions">
              <button
                type="button"
                className="bitlocker-icon-btn"
                onClick={() => toggleKeyMask(row.id)}
                title={isUnmasked ? 'Anahtarı Gizle' : 'Anahtarı Göster'}
              >
                {isUnmasked ? '🔒' : '👁️'}
              </button>
              <button
                type="button"
                className={`bitlocker-icon-btn ${isCopied ? 'copied' : ''}`}
                onClick={() => handleCopyKey(row.recovery_key, row.id)}
                title="Panoya Kopyala"
              >
                {isCopied ? '✓' : '📋'}
              </button>
            </div>
          </div>
        );
      }
    },
    {
      headerName: 'Kaynak / Tarih',
      field: 'source_filename',
      width: 200,
      sortable: true,
      cellRenderer: params => {
        const row = params.data;
        const dateStr = row.source_file_date || row.uploaded_at;
        const formattedDate = dateStr ? new Date(dateStr).toLocaleDateString('tr-TR') : '—';

        return (
          <div style={{ display: 'flex', flexDirection: 'column', fontSize: 11, lineHeight: 1.3 }}>
            <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }} title={row.source_filename}>
              {row.source_filename ? `📄 ${row.source_filename}` : 'Manuel Giriş'}
            </span>
            <span style={{ color: 'var(--color-text-secondary, #94a3b8)', fontSize: 10 }}>
              {formattedDate}
            </span>
          </div>
        );
      }
    },
    {
      headerName: 'İşlemler',
      width: 140,
      pinned: 'right',
      sortable: false,
      cellRenderer: params => {
        const row = params.data;
        if (!row) return null;

        const isTrash = Boolean(row.deleted_at);

        if (isTrash) {
          return (
            <div className="bitlocker-actions-cell">
              {hasPermission('bitlocker', 'can_delete') && (
                <>
                  <button
                    type="button"
                    className="btn btn-success btn-sm"
                    onClick={() => handleRestore(row)}
                    title="Geri Yükle"
                    style={{ padding: '3px 7px', fontSize: 11 }}
                  >
                    ↩️ Geri
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger btn-sm"
                    onClick={() => handlePermanentDelete(row)}
                    title="Kalıcı Olarak Sil"
                    style={{ padding: '3px 7px', fontSize: 11 }}
                  >
                    ❌ Sil
                  </button>
                </>
              )}
            </div>
          );
        }

        return (
          <div className="bitlocker-actions-cell">
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => {
                setRawItem(row);
                setShowRawModal(true);
              }}
              title="Ham Metin / Detay"
              style={{ padding: '3px 6px', fontSize: 11 }}
            >
              📄
            </button>
            {hasPermission('bitlocker', 'can_edit') && (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  setEditItem(row);
                  setShowFormModal(true);
                }}
                title="Düzenle"
                style={{ padding: '3px 6px', fontSize: 11 }}
              >
                ✏️
              </button>
            )}
            {hasPermission('bitlocker', 'can_delete') && (
              <button
                type="button"
                className="btn btn-danger btn-sm"
                onClick={() => handleDelete(row)}
                title="Çöp Kutusuna Taşı"
                style={{ padding: '3px 6px', fontSize: 11 }}
              >
                🗑️
              </button>
            )}
          </div>
        );
      }
    }
  ], [unmaskedKeys, copiedKeyId, toggleKeyMask, handleCopyKey, hasPermission]);

  return (
    <div className="bitlocker-container">
      {/* ── ÜST BAŞLIK & BUTONLAR ── */}
      <div className="bitlocker-header">
        <div className="bitlocker-title-area">
          <div className="bitlocker-icon-badge">🔐</div>
          <div className="bitlocker-title-text">
            <h2>
              BitLocker Key Vault
              <span className="bitlocker-count-pill">
                {activeTab === 'trash' ? `${stats.trash} Çöp` : `${stats.active} Aktif`}
              </span>
            </h2>
            <p>Şirket personeli ve cihazlarına ait BitLocker kurtarma anahtarlarının merkezi yönetimi.</p>
          </div>
        </div>

        <div className="bitlocker-top-actions">
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={fetchKeys}
            title="Yenile"
          >
            🔄 Yenile
          </button>

          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={handleExportCsv}
            title="CSV Olarak İndir"
          >
            📥 Dışa Aktar
          </button>

          {hasPermission('bitlocker', 'can_create') && (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => {
                setEditItem(null);
                setShowFormModal(true);
              }}
              style={{ fontWeight: 700 }}
            >
              ➕ Yeni Anahtar Ekle
            </button>
          )}
        </div>
      </div>

      {/* ── İSTATİSTİK KARTLARI ── */}
      <div className="bitlocker-stats-grid">
        <div className="bitlocker-stat-card">
          <div className="bitlocker-stat-icon" style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6' }}>
            🔑
          </div>
          <div className="bitlocker-stat-info">
            <span className="bitlocker-stat-value">{stats.active}</span>
            <span className="bitlocker-stat-label">Aktif Kurtarma Anahtarı</span>
          </div>
        </div>

        <div className="bitlocker-stat-card">
          <div className="bitlocker-stat-icon" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981' }}>
            💻
          </div>
          <div className="bitlocker-stat-info">
            <span className="bitlocker-stat-value">{stats.devices}</span>
            <span className="bitlocker-stat-label">Kayıtlı Cihaz Adı</span>
          </div>
        </div>

        <div className="bitlocker-stat-card">
          <div className="bitlocker-stat-icon" style={{ background: 'rgba(168, 85, 247, 0.15)', color: '#a855f7' }}>
            ⏱️
          </div>
          <div className="bitlocker-stat-info">
            <span className="bitlocker-stat-value">{stats.recent}</span>
            <span className="bitlocker-stat-label">Son 30 Günde Eklenen</span>
          </div>
        </div>

        <div className="bitlocker-stat-card" style={{ cursor: 'pointer' }} onClick={() => setActiveTab('trash')}>
          <div className="bitlocker-stat-icon" style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444' }}>
            🗑️
          </div>
          <div className="bitlocker-stat-info">
            <span className="bitlocker-stat-value">{stats.trash}</span>
            <span className="bitlocker-stat-label">Çöp Kutusundaki Kayıtlar</span>
          </div>
        </div>
      </div>

      {/* ── FİLTRE VE ARAMA ÇUBUĞU ── */}
      <div className="bitlocker-filter-bar">
        <div className="bitlocker-tabs">
          <button
            type="button"
            className={`bitlocker-tab-btn ${activeTab === 'active' ? 'active' : ''}`}
            onClick={() => setActiveTab('active')}
          >
            🔑 Aktif Anahtarlar ({stats.active})
          </button>

          <button
            type="button"
            className={`bitlocker-tab-btn trash ${activeTab === 'trash' ? 'active' : ''}`}
            onClick={() => setActiveTab('trash')}
          >
            🗑️ Çöp Kutusu ({stats.trash})
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div className="bitlocker-search-box">
            <input
              type="text"
              className="bitlocker-search-input"
              placeholder="Personel adı, cihaz, tanımlayıcı veya anahtar ara..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button
                type="button"
                className="bitlocker-search-clear"
                onClick={() => setSearch('')}
                title="Aramayı Temizle"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── AG-GRID TABLO ALANI ── */}
      <div className="bitlocker-grid-wrapper">
        <div
          className={theme === 'light' || theme === 'sakura' ? 'ag-theme-quartz' : 'ag-theme-quartz-dark'}
          style={{ height: '100%', width: '100%' }}
        >
          <AgGridReact
            ref={gridRef}
            theme="legacy"
            rowData={keys}
            columnDefs={columnDefs}
            rowHeight={46}
            headerHeight={40}
            pagination={true}
            paginationPageSize={pageSize}
            paginationPageSizeSelector={[25, 50, 100, 200, 500]}
            popupParent={typeof document !== 'undefined' ? document.body : undefined}
            onPaginationChanged={(e) => {
              if (e.api) {
                const s = e.api.getGridOption('paginationPageSize');
                if (s && Number(s) !== pageSize) {
                  setPageSize(Number(s));
                }
              }
            }}
            animateRows={true}
            loading={loading && keys.length === 0}
            overlayLoadingTemplate={'<span class="ag-overlay-loading-center">BitLocker anahtarları yükleniyor...</span>'}
            overlayNoRowsTemplate={'<span class="ag-overlay-no-rows-center">🔐 Kayıt bulunamadı.</span>'}
          />
        </div>
      </div>

      {/* ── MODALLAR ── */}
      <BitlockerFormModal
        isOpen={showFormModal}
        onClose={() => {
          setShowFormModal(false);
          setEditItem(null);
        }}
        onSave={handleSaveKey}
        onUploadSuccess={fetchKeys}
        item={editItem}
      />

      <BitlockerRawModal
        isOpen={showRawModal}
        onClose={() => {
          setShowRawModal(false);
          setRawItem(null);
        }}
        item={rawItem}
        onCopyKey={(key) => handleCopyKey(key, rawItem?.id)}
      />

      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
        onConfirm={confirmDialog.action}
        title={confirmDialog.title}
        message={confirmDialog.message}
        isDanger={confirmDialog.isDanger}
      />
    </div>
  );
}
