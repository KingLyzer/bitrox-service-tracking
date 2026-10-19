import React, { useState, useEffect, useCallback } from 'react';
import { useApp } from '../../../context/AppContext';

export default function Reports() {
  const { showNotification } = useApp();
  const [activeTab, setActiveTab] = useState('open_tickets');
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);

  const TABS = [
    { id: 'open_tickets',    label: 'Açık Servis Kayıtları',    icon: '🛠️' },
    { id: 'waiting_parts',   label: 'Bekleyen Cihazlar',         icon: '📦' },
    { id: 'frequent_faults', label: 'En Sık Arızalar',           icon: '🔍' },
    { id: 'toner_usage',     label: 'Toner Tüketimi',            icon: '🖨️' },
    { id: 'used_parts',      label: 'Kullanılan Parçalar',       icon: '🔩' },
    { id: 'overdue_tickets', label: 'Uzun Süreli Açık Fişler',   icon: '⏰' },
    { id: 'stock_critical',  label: 'Kritik Stok Seviyeleri',    icon: '⚠️' },
  ];

  const loadData = useCallback(async (tabId) => {
    setLoading(true);
    let query = '';
    
    // API'den çekilecek raporlar
    const apiReports = ['open_tickets', 'waiting_parts', 'frequent_faults', 'overdue_tickets', 'used_parts'];

    // Toner Tüketimi — yerel DB'den JS tarafında gruplama ile hesaplanır
    if (tabId === 'toner_usage') {
      try {
        const [changesRes, tonersRes] = await Promise.all([
          window.electronAPI.query('SELECT * FROM toner_changes', []),
          window.electronAPI.query('SELECT * FROM toner_items', []),
        ]);

        const changes = changesRes.success ? (changesRes.data || []) : [];
        const toners  = tonersRes.success  ? (tonersRes.data  || []) : [];
        const tonerMap = Object.fromEntries(toners.map(t => [String(t.id), t]));

        // Sadece gerçek kullanıcılara verilen tonerler (asset/bilgisayar adları hariç)
        // Asset adları genellikle "#" içerir (örn. "K00NTB047A #K00NTB047A - HP EliteBook 650 G9")
        const userChanges = changes.filter(tc => {
          const name = tc.assigned_user_name || '';
          return !name.includes('#');   // asset formatı: "ASSET_TAG #ASSET_TAG - Model"
        });

        const grouped = {};
        userChanges.forEach(tc => {
          const tid = String(tc.toner_id);
          if (!grouped[tid]) {
            const ti = tonerMap[tid] || {};
            grouped[tid] = {
              'Toner Modeli': ti.toner_model || `Toner #${tid}`,
              'Renk': ti.color || '—',
              'Toplam Kullanım': 0,
              'Mevcut Stok': ti.qty ?? 0,
            };
          }
          grouped[tid]['Toplam Kullanım'] += (Number(tc.qty) || 1);
        });

        const reportData = Object.values(grouped)
          .sort((a, b) => b['Toplam Kullanım'] - a['Toplam Kullanım']);

        setData(reportData);
      } catch (err) {
        showNotification('Toner raporu yüklenemedi: ' + err.message, 'danger');
      } finally {
        setLoading(false);
      }
      return;
    }
    
    if (apiReports.includes(tabId)) {
      try {
        const res = await fetch(`${window.API_BASE}/api/fisler`);
        const json = await res.json();
        const allTickets = Array.isArray(json) ? json : [];
        
        let reportData = [];
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        if (tabId === 'open_tickets') {
          const openStatuses = ['Tamamlandı', 'Teslim Edildi', 'Pert', 'İptal'];
          reportData = allTickets
            .filter(t => !openStatuses.includes(t.status))
            .map(t => ({
              'Fiş No': t.ticket_no,
              'Oluşturulma': t.created_at?.slice(0, 16).replace('T', ' '),
              'Asset Tag': t.asset_tag || '—',
              'Cihaz': t.asset_name || t.model_name || '—',
              'Kullanıcı': t.user_name || '—',
              'Öncelik': t.priority,
              'Durum': t.status
            }));
        } else if (tabId === 'waiting_parts') {
          reportData = allTickets
            .filter(t => t.status === 'Parça Bekliyor')
            .map(t => ({
              'Fiş No': t.ticket_no,
              'Oluşturulma': t.created_at?.slice(0, 16).replace('T', ' '),
              'Asset Tag': t.asset_tag || '—',
              'Cihaz': t.asset_name || t.model_name || '—',
              'Kullanıcı': t.user_name || '—',
              'Lokasyon': t.location_name || '—'
            }));
        } else if (tabId === 'frequent_faults') {
          const counts = {};
          allTickets.forEach(t => {
            const desc = t.fault_desc?.trim() || 'Belirtilmemiş';
            counts[desc] = (counts[desc] || 0) + 1;
          });
          reportData = Object.entries(counts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 20)
            .map(([desc, count]) => ({
              'Arıza Açıklaması': desc,
              'Tekrar Sayısı': count
            }));
        } else if (tabId === 'overdue_tickets') {
          const openStatuses = ['Tamamlandı', 'Teslim Edildi', 'Pert', 'İptal'];
          reportData = allTickets
            .filter(t => {
              if (openStatuses.includes(t.status)) return false;
              if (!t.created_at) return false;
              return new Date(t.created_at) < sevenDaysAgo;
            })
            .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
            .map(t => {
              const diffTime = Math.abs(new Date() - new Date(t.created_at));
              const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
              return {
                'Fiş No': t.ticket_no,
                'Oluşturulma': t.created_at?.slice(0, 10),
                'Asset Tag': t.asset_tag || '—',
                'Cihaz': t.asset_name || t.model_name || '—',
                'Kullanıcı': t.user_name || '—',
                'Durum': t.status,
                'Gün': diffDays
              };
            });
        } else if (tabId === 'used_parts') {
          const partStats = {};
          allTickets.forEach(t => {
            if (t.used_parts && Array.isArray(t.used_parts)) {
              t.used_parts.forEach(p => {
                const name = p.part_name?.trim() || 'Bilinmeyen Parça';
                if (!partStats[name]) {
                  partStats[name] = { totalQty: 0, totalPrice: 0, count: 0 };
                }
                partStats[name].totalQty += (p.qty || 0);
                partStats[name].totalPrice += (p.total_price || 0);
                partStats[name].count += 1;
              });
            }
          });
          reportData = Object.entries(partStats)
            .sort((a, b) => b[1].totalQty - a[1].totalQty)
            .map(([name, stats]) => ({
              'Parça Adı': name,
              'Toplam Adet': stats.totalQty,
              'Toplam Tutar (₺)': stats.totalPrice,
              'Kullanım Sayısı': stats.count
            }));
        }
        setData(reportData);
      } catch (err) {
        showNotification('API verisi çekilemedi: ' + err.message, 'danger');
      } finally {
        setLoading(false);
      }
      return;
    }

    // SQLite bazlı raporlar
    switch (tabId) {
      case 'stock_critical':
        query = "SELECT si.name AS 'Parça Adı', sc.name AS 'Kategori', si.qty AS 'Mevcut', si.critical_qty AS 'Kritik Seviye', si.unit AS 'Birim', si.location AS 'Konum' FROM stock_items si LEFT JOIN stock_categories sc ON si.category_id=sc.id WHERE si.qty <= si.critical_qty AND si.is_active=1 ORDER BY si.qty ASC";
        break;
      default:
        setLoading(false);
        return;
    }
    try {
      const res = await window.electronAPI.query(query, []);
      if (res.success) setData(res.data);
      else showNotification('Rapor yüklenemedi: ' + (res.message || ''), 'danger');
    } catch (err) {
      showNotification('Rapor yüklenemedi: ' + err.message, 'danger');
    } finally {
      setLoading(false);
    }
  }, [showNotification]);

  useEffect(() => {
    loadData(activeTab);
  }, [activeTab, loadData]);

  const handleExportExcel = async () => {
    if (data.length === 0) { showNotification('Dışa aktarılacak veri yok.', 'warning'); return; }
    try {
      // Simple CSV export using BOM for Excel Turkish character support
      const headers = Object.keys(data[0]);
      const csvRows = [
        '\uFEFF' + headers.join(';'),  // BOM for Turkish chars
        ...data.map(row => headers.map(h => {
          const val = row[h] === null || row[h] === undefined ? '' : String(row[h]);
          return val.includes(';') || val.includes('"') ? `"${val.replace(/"/g, '""')}"` : val;
        }).join(';'))
      ];
      const csvContent = csvRows.join('\r\n');
      const buffer = Array.from(new TextEncoder().encode(csvContent));
      const tabLabel = TABS.find(t => t.id === activeTab)?.label || 'rapor';
      await window.electronAPI.saveExcel(`${tabLabel}.csv`, buffer);
    } catch (err) {
      showNotification('Dışa aktarma hatası: ' + err.message, 'danger');
    }
  };

  const renderTable = () => {
    if (data.length === 0) return (
      <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-muted)' }}>
        <div style={{ fontSize: 32, marginBottom: 10 }}>📋</div>
        <div>Sonuç bulunamadı.</div>
      </div>
    );

    const headers = Object.keys(data[0]);

    return (
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr style={{ background: 'var(--grid-header-bg)', color: 'var(--grid-header-text)' }}>
            {headers.map(h => (
              <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.3px', whiteSpace: 'nowrap' }}>
                {/* Fixed: replace all underscores using regex */}
                {h.replace(/_/g, ' ')}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={i} style={{
              borderBottom: '1px solid var(--color-border)',
              background: i % 2 ? 'var(--color-surface-alt)' : 'var(--color-surface)',
              transition: 'background 0.15s',
            }}>
              {headers.map(h => (
                <td key={h} style={{ padding: '8px 12px', color: 'var(--color-text)', whiteSpace: 'nowrap' }}>
                  {typeof row[h] === 'number' && h.toLowerCase().includes('tutar')
                    ? row[h].toFixed(2) + ' ₺'
                    : typeof row[h] === 'number' && h.toLowerCase().includes('gün')
                    ? Math.floor(row[h]) + ' gün'
                    : String(row[h] ?? '—')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    );
  };

  const activeTabInfo = TABS.find(t => t.id === activeTab);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div style={{
      display: 'flex',
      flexDirection: isMobile ? 'column' : 'row',
      height: '100%',
      background: 'var(--color-bg)',
      overflow: 'hidden'
    }}>
      {/* Yan Menü (Masaüstü) veya Üst Seçim Menüsü (Mobil) */}
      {isMobile ? (
        <div style={{
          padding: '10px 12px',
          background: 'var(--color-surface)',
          borderBottom: '1px solid var(--color-border)',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          flexShrink: 0
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            📊 Rapor Türü Seçin
          </div>
          <select
            className="form-control"
            value={activeTab}
            onChange={e => setActiveTab(e.target.value)}
            style={{
              background: 'var(--color-surface-alt)',
              color: 'var(--color-text)',
              border: '1.5px solid var(--color-primary)',
              fontWeight: 700,
              fontSize: 13,
              padding: '6px 10px',
              borderRadius: 6
            }}
          >
            {TABS.map(tab => (
              <option key={tab.id} value={tab.id} style={{ background: 'var(--color-surface)', color: 'var(--color-text)' }}>
                {tab.icon} {tab.label}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <div style={{ width: 240, flexShrink: 0, borderRight: '1px solid var(--color-border)', background: 'var(--color-bg-dark)', padding: '10px 0', overflowY: 'auto' }}>
          <div style={{ padding: '12px 20px 8px', fontSize: 11, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>
            Rapor Türleri
          </div>
          {TABS.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
              display: 'flex', alignItems: 'center', gap: 10, width: '100%',
              textAlign: 'left', padding: '11px 20px',
              background: activeTab === tab.id ? 'var(--color-surface)' : 'transparent',
              border: 'none', borderLeft: `4px solid ${activeTab === tab.id ? 'var(--color-primary)' : 'transparent'}`,
              color: activeTab === tab.id ? 'var(--color-primary)' : 'var(--color-text-secondary)',
              fontWeight: activeTab === tab.id ? 700 : 500, cursor: 'pointer', fontSize: 13,
              transition: 'all 0.15s', fontFamily: 'var(--font-family)',
            }}>
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* İçerik */}
      <div style={{ flex: 1, overflow: 'auto', padding: isMobile ? '12px 10px' : 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
          <h2 style={{ fontSize: 16, color: 'var(--color-text)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}>
            {activeTabInfo?.icon} {activeTabInfo?.label}
          </h2>
          <div className="flex-gap" style={{ flexWrap: 'wrap' }}>
            <span className="badge badge-secondary" style={{ fontSize: 11 }}>
              {data.length > 0 ? `${data.length} kayıt` : '0 kayıt'}
            </span>
            <button className="btn btn-secondary btn-sm" onClick={() => loadData(activeTab)} title="Yenile">
              🔄 Yenile
            </button>
            <button className="btn btn-success btn-sm" onClick={handleExportExcel} disabled={data.length === 0} title="CSV İndir">
              📥 CSV
            </button>
            <button className="btn btn-secondary btn-sm" onClick={() => window.electronAPI.print()} title="Yazdır">
              🖨️ Yazdır
            </button>
          </div>
        </div>

        {loading && (!data || data.length === 0) ? (
          <div className="flex-center" style={{ height: 200, flexDirection: 'column', gap: 12 }}>
            <div className="spinner" />
            <span style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>Yükleniyor...</span>
          </div>
        ) : (
          <div className="card" style={{ overflowX: 'auto', padding: 0 }}>
            {renderTable()}
          </div>
        )}
      </div>
    </div>
  );
}
