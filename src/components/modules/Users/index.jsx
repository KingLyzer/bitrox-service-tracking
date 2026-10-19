import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { AgGridReact } from 'ag-grid-react';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-quartz.css';
import { useApp } from '../../../context/AppContext';
import { getApiBase } from '../../../utils/apiConfig';
import Modal from '../../common/Modal';
import ServiceTicketDetail from '../ServiceTickets/ServiceTicketDetail';

// Servis fişinin kullanıcı veya cihaz ile eşleşip eşleşmediğini kontrol eden kapsamlı fonksiyon
const isTicketMatchingUser = (ticket, userObj, userAssets = []) => {
  if (!ticket || !userObj) return false;
  const uid = String(userObj.id || '');
  const uName = (userObj.name || userObj.full_name || '').toLowerCase().trim();
  const uUsername = (userObj.username || '').toLowerCase().trim();
  const uEmail = (userObj.email || '').toLowerCase().trim();

  // 1. Doğrudan user_id eşleşmesi (gevşek string karşılaştırması)
  if (ticket.user_id && String(ticket.user_id) === uid) return true;

  // 2. Kullanıcının zimmetli cihazları ile eşleşme (asset_id, asset_tag, serial_no)
  const userAssetIds = new Set(userAssets.map(a => String(a.id || '')));
  const userAssetTags = new Set(userAssets.map(a => (a.asset_tag || '').toLowerCase().trim()).filter(Boolean));
  const userSerials = new Set(userAssets.map(a => (a.serial || '').toLowerCase().trim()).filter(Boolean));

  if (ticket.asset_id && userAssetIds.has(String(ticket.asset_id))) return true;
  if (ticket.asset_tag && userAssetTags.has(String(ticket.asset_tag).toLowerCase().trim())) return true;
  if (ticket.serial_no && userSerials.has(String(ticket.serial_no).toLowerCase().trim())) return true;

  // 3. İsim, kullanıcı adı, teslim eden / alan eşleşmesi
  const ticketNames = [
    ticket.user_name,
    ticket.delivered_to,
    ticket.teslim_eden,
    ticket.customer_name
  ].filter(Boolean).map(n => String(n).toLowerCase().trim());

  for (const tn of ticketNames) {
    if (uName && (tn === uName || tn.includes(uName) || uName.includes(tn))) return true;
    if (uUsername && (tn === uUsername || tn.includes(uUsername) || uUsername.includes(tn))) return true;
    if (uEmail && tn.includes(uEmail)) return true;
  }

  return false;
};

const isTicketMatchingAsset = (ticket, assetObj) => {
  if (!ticket || !assetObj) return false;
  if (ticket.asset_id && String(ticket.asset_id) === String(assetObj.id)) return true;
  if (ticket.asset_tag && assetObj.asset_tag && String(ticket.asset_tag).toLowerCase().trim() === String(assetObj.asset_tag).toLowerCase().trim()) return true;
  if (ticket.serial_no && assetObj.serial && String(ticket.serial_no).toLowerCase().trim() === String(assetObj.serial).toLowerCase().trim()) return true;
  return false;
};

export default function Users() {
  const { showNotification, theme, refreshToggle, tableRefreshVersions = {} } = useApp();
  const [users, setUsers] = useState(() => {
    try {
      const saved = localStorage.getItem('cached_snipeit_users');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [assets, setAssets] = useState([]);
  const [history, setHistory] = useState([]);
  const [allTickets, setAllTickets] = useState(() => {
    try {
      const saved = localStorage.getItem('cached_service_tickets');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [searchText, setSearchText] = useState('');
  
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [selectedTicket, setSelectedTicket] = useState(null);
  
  const [stats, setStats] = useState({ totalDevices: 0, totalTickets: 0, openTickets: 0, lastDate: '-', frequentFault: '-' });
  
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [loadingAssets, setLoadingAssets] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const gridRefUsers = useRef(null);
  const gridRefAssets = useRef(null);
  const gridRefHistory = useRef(null);
  const usersLoadedRef = useRef(false);

  // Tüm servis fişlerini getiren yardımcı fonksiyon
  const fetchAllTickets = useCallback(async () => {
    try {
      const res = await fetch(`${getApiBase()}/api/fisler`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) return data;
      }
    } catch (e) {
      console.warn('[Users] Servis fişleri getirilemedi:', e);
    }
    return [];
  }, []);

  // 1. Kullanıcıları Yükle
  const loadUsers = useCallback(async () => {
    if (!usersLoadedRef.current) setLoadingUsers(true);
    try {
      const res = await window.electronAPI.query('SELECT * FROM cached_users', []);
      if (!res.success) throw new Error(res.message || 'Sorgu hatası');
      const data = res.data;
      
      // Calculate local asset counts to populate 'asset_count' for each user
      let countsMap = {};
      try {
        const countsRes = await window.electronAPI.query(
          'SELECT assigned_to_user_id, COUNT(*) as count FROM cached_assets WHERE assigned_to_user_id IS NOT NULL GROUP BY assigned_to_user_id',
          []
        );
        if (countsRes.success && Array.isArray(countsRes.data)) {
          countsRes.data.forEach(item => {
            countsMap[item.assigned_to_user_id] = item.count;
          });
        }
      } catch (e) {
        console.error('Local asset counts could not be calculated:', e);
      }

      const mappedUsers = (Array.isArray(data) ? data : []).map(u => ({
        ...u,
        name: u.name || u.full_name || u.username || 'İsimsiz Kullanıcı',
        asset_count: u.asset_count !== undefined ? u.asset_count : (countsMap[u.id] || 0)
      }));

      // Sort users by name alphabetically (Turkish locale)
      mappedUsers.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'tr'));
      
      setUsers(mappedUsers);
      try { localStorage.setItem('cached_snipeit_users', JSON.stringify(mappedUsers)); } catch {}

      // Servis fişlerini yükle
      const tList = await fetchAllTickets();
      setAllTickets(tList);

    } catch (err) {
      console.error('Kullanıcılar yüklenemedi:', err);
    } finally {
      usersLoadedRef.current = true;
      setLoadingUsers(false);
    }
  }, [fetchAllTickets]);

  const usersRefreshVersion = [
    tableRefreshVersions.cached_users || 0,
    tableRefreshVersions.cached_assets || 0,
    tableRefreshVersions.cached_locations || 0,
    tableRefreshVersions.service_tickets || 0,
  ].join('|');

  useEffect(() => { loadUsers(); }, [loadUsers, refreshToggle, usersRefreshVersion]);

  // 2. Seçili Kullanıcının Cihazlarını ve İstatistiklerini Yükle
  const loadAssetsAndStats = useCallback(async (userObj) => {
    if (!userObj) {
      setAssets([]); setHistory([]); setStats({ totalDevices: 0, totalTickets: 0, openTickets: 0, lastDate: '-', frequentFault: '-' });
      return;
    }
    const userId = userObj.id;
    setLoadingAssets(true);
    try {
      const assetsRes = await window.electronAPI.query('SELECT * FROM cached_assets WHERE assigned_to_user_id = ? ORDER BY name ASC', [userId]);
      const assetsList = assetsRes.success ? assetsRes.data : [];
      setAssets(assetsList);

      let ticketsList = allTickets;
      if (!ticketsList || ticketsList.length === 0) {
        ticketsList = await fetchAllTickets();
        setAllTickets(ticketsList);
      }

      const userTickets = ticketsList.filter(t => isTicketMatchingUser(t, userObj, assetsList));

      const openStatuses = ['Tamamlandı', 'Teslim Edildi', 'Pert', 'İptal'];
      const openTickets = userTickets.filter(t => !openStatuses.includes(t.status)).length;
      
      const lastDate = userTickets.length > 0 
        ? userTickets.sort((a,b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))[0].created_at?.slice(0, 10) 
        : '-';

      const faultCounts = {};
      userTickets.forEach(t => {
        const f = t.fault_desc?.trim();
        if (f) faultCounts[f] = (faultCounts[f] || 0) + 1;
      });
      const frequentFault = Object.keys(faultCounts).length > 0 
        ? Object.entries(faultCounts).sort((a,b) => b[1] - a[1])[0][0] 
        : '-';

      setStats({
        totalDevices: assetsList.length,
        totalTickets: userTickets.length,
        openTickets,
        lastDate,
        frequentFault
      });

      // Otomatik olarak kullanıcının tüm servis geçmişini tabloya doldur
      const formattedHistory = userTickets.map(t => {
        const partsStr = Array.isArray(t.used_parts) 
          ? t.used_parts.map(p => p.part_name).join(', ') 
          : (t.used_parts || '');
        return {
          id: t.id,
          ticket_no: t.ticket_no,
          created_at: t.created_at,
          fault_desc: t.fault_desc,
          status: t.status,
          tech_name: t.assigned_user_name || t.user_name || t.teknisyen || 'Bilinmiyor',
          parts: partsStr
        };
      }).sort((a,b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));

      setHistory(formattedHistory);
      setSelectedAsset(null);
    } catch (err) {
      console.error('Kullanıcı cihazları yüklenemedi:', err);
    } finally {
      setLoadingAssets(false);
    }
  }, [allTickets, fetchAllTickets]);

  // 3. Seçili Cihazın Servis Geçmişini Yükle
  const loadHistory = useCallback(async (assetObj, userObj = selectedUser) => {
    setLoadingHistory(true);
    try {
      let ticketsList = allTickets;
      if (!ticketsList || ticketsList.length === 0) {
        ticketsList = await fetchAllTickets();
        setAllTickets(ticketsList);
      }
      
      let filtered = [];
      if (assetObj) {
        filtered = ticketsList.filter(t => isTicketMatchingAsset(t, assetObj));
      } else if (userObj) {
        filtered = ticketsList.filter(t => isTicketMatchingUser(t, userObj, assets));
      }

      const formattedHistory = filtered.map(t => {
        const partsStr = Array.isArray(t.used_parts) 
          ? t.used_parts.map(p => p.part_name).join(', ') 
          : (t.used_parts || '');
        return {
          id: t.id,
          ticket_no: t.ticket_no,
          created_at: t.created_at,
          fault_desc: t.fault_desc,
          status: t.status,
          tech_name: t.assigned_user_name || t.user_name || t.teknisyen || 'Bilinmiyor',
          parts: partsStr
        };
      }).sort((a,b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));

      setHistory(formattedHistory);
    } catch (err) {
      console.error('Servis geçmişi yüklenemedi:', err);
    } finally {
      setLoadingHistory(false);
    }
  }, [allTickets, fetchAllTickets, selectedUser, assets]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await window.electronAPI.snipeitSync();
      if (res.success) {
        showNotification('Snipe-IT senkronizasyonu tamamlandı.', 'success');
        loadUsers();
      } else {
        showNotification('Senkronizasyon hatası: ' + res.message, 'danger');
      }
    } catch (err) {
      showNotification('Hata: ' + err.message, 'danger');
    }
    setSyncing(false);
  };

  const handleExportCSV = () => {
    if (gridRefUsers.current) {
      gridRefUsers.current.api.exportDataAsCsv({ fileName: 'personel_listesi.csv' });
    }
  };

  const printHistory = () => {
    if (!selectedAsset || history.length === 0) {
      showNotification('Yazdırılacak servis geçmişi bulunamadı.', 'warning');
      return;
    }
    window.electronAPI.print();
  };

  // Filtrelenmiş kullanıcı listesi (Canlı Arama)
  const visibleUsers = useMemo(() => {
    const term = searchText.trim().toLocaleLowerCase('tr-TR');
    if (!term) return users;
    return users.filter(u => [u.name, u.username, u.department_name, u.location_name, u.email]
      .some(f => String(f || '').toLocaleLowerCase('tr-TR').includes(term)));
  }, [users, searchText]);

  // Üst KPI İstatistikleri
  const totalAssignedAssets = useMemo(() => users.reduce((s, u) => s + Number(u.asset_count || 0), 0), [users]);
  const uniqueLocations = useMemo(() => new Set(users.map(u => u.location_name).filter(Boolean)).size, [users]);

  // AG Grid Sütun Tanımları
  const userCols = useMemo(() => [
    { field: 'name', headerName: 'Ad Soyad', flex: 1.2, minWidth: 150, filter: 'agTextColumnFilter', cellRenderer: p => (
      <span style={{ fontWeight: 600 }}>👤 {p.value}</span>
    )},
    { field: 'username', headerName: 'Kullanıcı Adı', width: 110, filter: 'agTextColumnFilter', cellClass: 'cell-muted' },
    { field: 'department_name', headerName: 'Departman', width: 120, filter: 'agTextColumnFilter' },
    { field: 'location_name', headerName: 'Lokasyon', width: 115, filter: 'agTextColumnFilter' },
    { field: 'asset_count', headerName: 'Cihaz', width: 75, filter: 'agNumberColumnFilter', cellRenderer: p => (
      <span className={`badge ${Number(p.value) > 0 ? 'badge-primary' : 'badge-secondary'}`} style={{ fontSize: 10.5, fontWeight: 700 }}>
        {p.value || 0}
      </span>
    )},
  ], []);

  const assetCols = useMemo(() => [
    { field: 'asset_tag', headerName: 'Asset Tag', width: 140, cellRenderer: p => (
      <span style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--color-primary)' }}>🏷️ {p.value}</span>
    )},
    { field: 'name', headerName: 'Cihaz Adı', width: 130 },
    { field: 'model_name', headerName: 'Model', flex: 1, minWidth: 170 },
    { field: 'category_name', headerName: 'Kategori', width: 130 },
    { field: 'serial', headerName: 'Seri No', width: 140, cellClass: 'cell-muted' },
    { field: 'status_name', headerName: 'Durum', width: 140, cellRenderer: p => (
      <span className="badge badge-success" style={{ fontSize: 10 }}>{p.value || 'Aktif'}</span>
    )},
  ], []);

  const historyCols = useMemo(() => [
    { field: 'ticket_no', headerName: 'Servis No', width: 110, cellRenderer: p => (
      <span style={{ fontWeight: 700, color: 'var(--color-primary)' }}>🔧 {p.value}</span>
    )},
    { field: 'created_at', headerName: 'Tarih', width: 120, valueFormatter: p => p.value ? p.value.slice(0, 16).replace('T', ' ') : '' },
    { field: 'fault_desc', headerName: 'Arıza / Talep', flex: 1.2, minWidth: 150 },
    { field: 'parts', headerName: 'Değişen Parçalar', width: 140 },
    { field: 'tech_name', headerName: 'Teknisyen', width: 115 },
    { field: 'status', headerName: 'Durum', width: 105, cellRenderer: p => (
        <span className="badge badge-secondary" style={{ fontSize: 10 }}>
          {p.value}
        </span>
      )
    },
  ], []);

  const compactGridOptions = {
    theme: "legacy",
    rowHeight: 28,
    headerHeight: 28,
    defaultColDef: { resizable: true, sortable: true },
    suppressCellFocus: true,
    enableCellTextSelection: false, // Metin seçme engellendi
    suppressDragLeaveHidesColumns: true,
  };

  // Tek tık veya çift tıkta kullanıcı seçimi
  const handleUserSelect = useCallback((userData) => {
    if (!userData) return;
    setSelectedUser(userData);
    loadAssetsAndStats(userData);
  }, [loadAssetsAndStats]);

  // Tek tık veya çift tıkta cihaz seçimi (cihaza göre filtrele veya kaldır)
  const handleAssetSelect = useCallback((assetData) => {
    if (!assetData) return;
    setSelectedAsset(assetData);
    loadHistory(assetData, selectedUser);
  }, [selectedUser, loadHistory]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '8px 10px', gap: 8, overflow: 'hidden', userSelect: 'none' }}>
      
      {/* 4'lü Üst Canlı KPI Özet Kartları */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
        gap: 8,
        flexShrink: 0
      }}>
        {/* Toplam Personel */}
        <div style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 8,
          padding: '6px 12px',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
        }}>
          <div style={{
            width: 32, height: 32, borderRadius: 6,
            background: 'rgba(59, 130, 246, 0.12)', color: '#3b82f6',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15
          }}>
            👥
          </div>
          <div>
            <div style={{ fontSize: 10, color: 'var(--color-text-muted)', fontWeight: 600 }}>TOPLAM PERSONEL</div>
            <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--color-text)' }}>
              {users.length} <span style={{ fontSize: 10.5, fontWeight: 500, color: 'var(--color-text-muted)' }}>Kişi</span>
            </div>
          </div>
        </div>

        {/* Zimmetli Cihazlar */}
        <div style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 8,
          padding: '6px 12px',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
        }}>
          <div style={{
            width: 32, height: 32, borderRadius: 6,
            background: 'rgba(139, 92, 246, 0.12)', color: '#8b5cf6',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15
          }}>
            💻
          </div>
          <div>
            <div style={{ fontSize: 10, color: 'var(--color-text-muted)', fontWeight: 600 }}>ZİMMETLİ CİHAZ</div>
            <div style={{ fontSize: 14, fontWeight: 800, color: '#8b5cf6' }}>
              {totalAssignedAssets} <span style={{ fontSize: 10.5, fontWeight: 500, color: 'var(--color-text-muted)' }}>Cihaz</span>
            </div>
          </div>
        </div>

        {/* Kayıtlı Lokasyon */}
        <div style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 8,
          padding: '6px 12px',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
        }}>
          <div style={{
            width: 32, height: 32, borderRadius: 6,
            background: 'rgba(16, 185, 129, 0.12)', color: '#10b981',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15
          }}>
            🏢
          </div>
          <div>
            <div style={{ fontSize: 10, color: 'var(--color-text-muted)', fontWeight: 600 }}>LOKASYON / ŞİRKET</div>
            <div style={{ fontSize: 14, fontWeight: 800, color: '#10b981' }}>
              {uniqueLocations} <span style={{ fontSize: 10.5, fontWeight: 500, color: 'var(--color-text-muted)' }}>Birim</span>
            </div>
          </div>
        </div>

        {/* Toplam Servis Kaydı */}
        <div style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 8,
          padding: '6px 12px',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
        }}>
          <div style={{
            width: 32, height: 32, borderRadius: 6,
            background: 'rgba(245, 158, 11, 0.12)', color: '#f59e0b',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15
          }}>
            🛠️
          </div>
          <div>
            <div style={{ fontSize: 10, color: 'var(--color-text-muted)', fontWeight: 600 }}>TOPLAM SERVİS KAYDI</div>
            <div style={{ fontSize: 14, fontWeight: 800, color: '#f59e0b' }}>
              {allTickets.length} <span style={{ fontSize: 10.5, fontWeight: 500, color: 'var(--color-text-muted)' }}>Kayıt</span>
            </div>
          </div>
        </div>
      </div>

      {/* Ana İşlem & Canlı Arama Ribbon Çubuğu */}
      <div className="legacy-ribbon" style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 8,
        alignItems: 'center',
        padding: '5px 12px',
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 8,
        flexShrink: 0
      }}>
        {/* Sol Taraf: Butonlar */}
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <button
            type="button"
            className="btn btn-sm btn-secondary"
            onClick={loadUsers}
            disabled={loadingUsers}
            title="Tüm personel ve cihaz verilerini yenile"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              padding: '4px 12px',
              borderRadius: 6,
              fontSize: 11.5,
              fontWeight: 700,
              background: 'rgba(59, 130, 246, 0.12)',
              border: '1px solid rgba(59, 130, 246, 0.3)',
              color: '#38bdf8'
            }}
          >
            <span style={{ fontSize: 13, display: 'inline-block', transform: loadingUsers ? 'rotate(180deg)' : 'none', transition: 'transform 0.3s ease' }}>
              🔄
            </span>
            <span>{loadingUsers ? 'Yenileniyor...' : 'Yenile'}</span>
          </button>

          <button
            type="button"
            className="btn btn-sm btn-secondary"
            onClick={handleExportCSV}
            style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11.5, padding: '4px 10px', borderRadius: 6 }}
            title="Personel Listesini CSV olarak indir"
          >
            <span>📄</span>
            <span>CSV İndir</span>
          </button>

          <button
            type="button"
            className="btn btn-sm btn-secondary"
            onClick={printHistory}
            disabled={!selectedAsset || history.length === 0}
            style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11.5, padding: '4px 10px', borderRadius: 6, opacity: (!selectedAsset || history.length === 0) ? 0.5 : 1 }}
            title="Seçili cihazın servis geçmişini yazdır"
          >
            <span>🖨️</span>
            <span>Geçmişi Yazdır</span>
          </button>
        </div>

        {/* Sağ Taraf: Canlı Personel Arama */}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ position: 'relative', width: 260 }}>
            <span style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: 'var(--color-text-muted)', pointerEvents: 'none' }}>🔍</span>
            <input
              type="text"
              className="form-control"
              placeholder="Personel adı, kullanıcı adı, departman..."
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
              style={{
                paddingLeft: 26,
                paddingRight: searchText ? 24 : 8,
                height: 28,
                borderRadius: 6,
                fontSize: 11.5,
                background: 'var(--color-surface-alt)',
                border: '1px solid var(--color-border)',
                color: 'var(--color-text)'
              }}
            />
            {searchText && (
              <button
                type="button"
                onClick={() => setSearchText('')}
                style={{
                  position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer', fontSize: 10
                }}
                title="Aramayı Temizle"
              >
                ✕
              </button>
            )}
          </div>
          <span className="badge badge-secondary" style={{ fontSize: 10.5, padding: '2px 6px' }}>
            {visibleUsers.length} / {users.length} Personel
          </span>
        </div>
      </div>

      {/* 2'li Esnek Çalışma Alanı (Sol: Personel Listesi, Sağ: Cihazlar & Geçmiş) */}
      <div style={{ display: 'flex', flex: 1, gap: 8, overflow: 'hidden' }}>
        
        {/* SOL PANEL: PERSONEL LİSTESİ */}
        <div style={{
          width: '38%',
          minWidth: 300,
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 8,
          overflow: 'hidden',
          boxShadow: '0 1px 4px rgba(0,0,0,0.04)'
        }}>
          <div style={{
            padding: '6px 10px',
            background: 'var(--color-surface-alt)',
            borderBottom: '1px solid var(--color-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <div style={{ fontWeight: 700, fontSize: 11.5, color: 'var(--color-text)' }}>
              👥 Personel Listesi
            </div>
            <span style={{ fontSize: 10.5, color: 'var(--color-text-muted)' }}>
              Seçmek için tek veya çift tıklayın
            </span>
          </div>

          <div className={theme === 'light' || theme === 'sakura' ? 'ag-theme-quartz' : 'ag-theme-quartz-dark'} style={{ flex: 1, width: '100%' }}>
            <AgGridReact
              ref={gridRefUsers}
              rowData={visibleUsers}
              columnDefs={userCols}
              {...compactGridOptions}
              rowSelection={{ mode: 'singleRow' }}
              onSelectionChanged={(e) => {
                const selected = e.api.getSelectedRows()[0];
                handleUserSelect(selected);
              }}
              onRowClicked={(e) => {
                handleUserSelect(e.data);
              }}
              onRowDoubleClicked={(e) => {
                handleUserSelect(e.data);
              }}
              noRowsOverlayComponent={() => <span style={{ fontSize: 11 }}>Kullanıcı bulunamadı.</span>}
            />
          </div>
        </div>

        {/* SAĞ PANEL: CİHAZLAR, İSTATİSTİK VE SERVİS GEÇMİŞİ */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8, overflow: 'hidden' }}>
          
          {/* SAĞ ÜST: SEÇİLİ PERSONELİN CİHAZLARI */}
          <div style={{
            flex: 5,
            display: 'flex',
            flexDirection: 'column',
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 8,
            overflow: 'hidden',
            boxShadow: '0 1px 4px rgba(0,0,0,0.04)'
          }}>
            <div style={{
              padding: '6px 10px',
              background: 'var(--color-surface-alt)',
              borderBottom: '1px solid var(--color-border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8
            }}>
              <div style={{ fontWeight: 700, fontSize: 11.5, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>💻</span>
                <span>{selectedUser ? `${selectedUser.name} Üzerindeki Cihazlar` : 'Zimmetli Cihazlar'}</span>
                <span className="badge badge-primary" style={{ fontSize: 10 }}>{assets.length}</span>
              </div>
              <span style={{ fontSize: 10.5, color: 'var(--color-text-muted)' }}>
                {selectedUser ? `${selectedUser.location_name || ''} ${selectedUser.department_name ? '• ' + selectedUser.department_name : ''}` : 'Listeden bir personel seçin'}
              </span>
            </div>

            <div className={theme === 'light' || theme === 'sakura' ? 'ag-theme-quartz' : 'ag-theme-quartz-dark'} style={{ flex: 1, width: '100%' }}>
              <AgGridReact
                ref={gridRefAssets}
                rowData={assets}
                columnDefs={assetCols}
                {...compactGridOptions}
                rowSelection={{ mode: 'singleRow' }}
                onSelectionChanged={(e) => {
                  const selected = e.api.getSelectedRows()[0];
                  handleAssetSelect(selected);
                }}
                onRowClicked={(e) => {
                  handleAssetSelect(e.data);
                }}
                onRowDoubleClicked={(e) => {
                  handleAssetSelect(e.data);
                }}
                noRowsOverlayComponent={() => (
                  <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                    {selectedUser ? 'Bu kullanıcıya atanmış cihaz bulunmuyor.' : 'Cihazları listelemek için soldan personel seçin.'}
                  </span>
                )}
              />
            </div>
          </div>

          {/* SAĞ ORTA: SEÇİLİ PERSONEL İSTATİSTİK ŞERİDİ */}
          <div style={{
            display: 'flex',
            padding: '5px 12px',
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 6,
            gap: 14,
            alignItems: 'center',
            flexWrap: 'wrap',
            fontSize: 11,
            boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
          }}>
            <div style={{ fontWeight: 700, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: 5 }}>
              <span>👤</span>
              <span>{selectedUser ? selectedUser.name : 'Seçim Yapılmadı'}</span>
            </div>
            <div style={{ width: 1, height: 14, background: 'var(--color-border)' }} />
            <div><span style={{ color: 'var(--color-text-muted)' }}>Cihaz Sayısı:</span> <b>{stats.totalDevices}</b></div>
            <div><span style={{ color: 'var(--color-text-muted)' }}>Toplam Servis:</span> <b>{stats.totalTickets}</b></div>
            <div><span style={{ color: 'var(--color-text-muted)' }}>Açık Talep:</span> <b style={{ color: stats.openTickets > 0 ? '#ef4444' : '#10b981' }}>{stats.openTickets}</b></div>
            <div><span style={{ color: 'var(--color-text-muted)' }}>Son Servis:</span> <b>{stats.lastDate}</b></div>
            <div><span style={{ color: 'var(--color-text-muted)' }}>Sık Arıza:</span> <b>{stats.frequentFault}</b></div>
          </div>

          {/* SAĞ ALT: CİHAZ SERVİS GEÇMİŞİ */}
          <div style={{
            flex: 5,
            display: 'flex',
            flexDirection: 'column',
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 8,
            overflow: 'hidden',
            boxShadow: '0 1px 4px rgba(0,0,0,0.04)'
          }}>
            <div style={{
              padding: '6px 10px',
              background: 'var(--color-surface-alt)',
              borderBottom: '1px solid var(--color-border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8
            }}>
              <div style={{ fontWeight: 700, fontSize: 11.5, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>🔧</span>
                <span>{selectedAsset ? `${selectedAsset.asset_tag || ''} (${selectedAsset.name || selectedAsset.model_name || 'Cihaz'}) Servis Geçmişi` : selectedUser ? `${selectedUser.name} — Servis Geçmişi` : 'Cihaz / Personel Servis Geçmişi'}</span>
                <span className="badge badge-secondary" style={{ fontSize: 10 }}>{history.length}</span>
              </div>
              <span style={{ fontSize: 10.5, color: 'var(--color-text-muted)' }}>
                Detayı açmak için kayda çift tıklayın
              </span>
            </div>

            <div className={theme === 'light' || theme === 'sakura' ? 'ag-theme-quartz' : 'ag-theme-quartz-dark'} style={{ flex: 1, width: '100%' }}>
              <AgGridReact
                ref={gridRefHistory}
                rowData={history}
                columnDefs={historyCols}
                {...compactGridOptions}
                onRowDoubleClicked={async (e) => {
                  if (e.data) {
                    try {
                      let ticketsList = allTickets;
                      if (!ticketsList || ticketsList.length === 0) {
                        ticketsList = await fetchAllTickets();
                      }
                      const t = ticketsList.find(item => item.id === e.data.id || item.ticket_no === e.data.ticket_no);
                      if (t) setSelectedTicket(t);
                      else setSelectedTicket({ id: e.data.id, ticket_no: e.data.ticket_no });
                    } catch (err) {
                      setSelectedTicket({ id: e.data.id, ticket_no: e.data.ticket_no });
                    }
                  }
                }}
                noRowsOverlayComponent={() => (
                  <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                    {selectedAsset ? 'Bu cihaza ait servis kaydı bulunmuyor.' : selectedUser ? 'Bu personele ait servis kaydı bulunmuyor.' : 'Servis geçmişini görmek için bir personel veya cihaz seçin.'}
                  </span>
                )}
              />
            </div>
          </div>

        </div>
      </div>

      {/* SERVİS FİŞİ DETAY MODALI */}
      {selectedTicket && (
        <Modal 
          isOpen 
          title={`Servis Detayı: ${selectedTicket.ticket_no}`} 
          size="xl" 
          onClose={() => setSelectedTicket(null)}
        >
          <ServiceTicketDetail 
            ticket={selectedTicket} 
            onUpdate={() => {
              if (selectedAsset) loadHistory(selectedAsset, selectedUser);
              else loadAssetsAndStats(selectedUser);
            }} 
            onEdit={() => {}} 
          />
        </Modal>
      )}

      {/* TEMA VE SEÇİM CSS'LERİ */}
      <style>{`
        .ag-theme-quartz, .ag-theme-quartz-dark {
          --ag-font-size: 11px;
          --ag-header-height: 28px;
          --ag-row-height: 28px;
          user-select: none !important;
          -webkit-user-select: none !important;
        }
        .ag-cell {
          font-size: 11px;
          line-height: 26px;
          user-select: none !important;
          -webkit-user-select: none !important;
        }
        .ag-header-cell-text {
          font-size: 11px;
        }
      `}</style>

    </div>
  );
}
