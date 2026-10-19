import React, { useState, useEffect, useCallback } from 'react';
import { useApp } from '../../../context/AppContext';
import { useAuth } from '../../../context/AuthContext';
import ConfirmDialog from '../../common/ConfirmDialog';
import { getApiBase } from '../../../utils/apiConfig';
import { apiGet, apiPost } from '../../../utils/apiFetch';
import SystemUsers from '../SystemUsers';
import TemplateSettings from './TemplateSettings';
import AnnouncementsSettings from './AnnouncementsSettings';
import CategorySettings from './CategorySettings';
import WebPushSettings from './WebPushSettings';
import GeneralSettings from './GeneralSettings';
import AiMemoryPanel from './AiMemoryPanel';
import Reports from '../Reports';

// ─── Bölüm tanımları (Sadeleştirilmiş Ana Başlıklar) ─────────────────────
const SECTION_GROUPS = [
  {
    title: 'GENEL AYARLAR',
    items: [
      { key: 'general',                     icon: '⚙️', label: 'Genel & API Ayarları' },
    ]
  },
  {
    title: 'RAPORLAMA & ANALİZ',
    items: [
      { key: 'reports',                     icon: '📈', label: 'Raporlar & İstatistikler' },
    ]
  },
  {
    title: 'OPERASYONEL TANIMLAR',
    items: [
      { key: 'stock_templates',            icon: '📦', label: 'Stok & Kurulum Şablonları' },
      { key: 'announcements',               icon: '📢', label: 'Duyuru Yönetimi' },
    ]
  },
  {
    title: 'KULLANICI & GÜVENLİK',
    items: [
      { key: 'auth',                         icon: '🔐', label: 'Yetkilendirme & Kullanıcılar' },
    ]
  },
  {
    title: 'SİSTEM & BAKIM',
    items: [
      { key: 'db_backup',                  icon: '💾', label: 'Veritabanı & Yedekleme' },
      { key: 'logs_clean',                 icon: '🧹', label: 'Loglar & Veri Temizliği' },
    ]
  }
];

const ALL_SECTIONS = SECTION_GROUPS.flatMap(g => g.items);

const SERVER_KEYS = ['db_type', 'db_host', 'db_port', 'db_user', 'db_pass', 'db_name', 'db_network_path'];

const LABELS = {
  company_name:          'Firma / Departman Adı',
  currency:              'Para Birimi',
  ticket_prefix:         'Servis Fiş Öneki',
  stock_prefix:          'Stok Kodu Öneki',
  toner_prefix:          'Toner Kodu Öneki',
  db_type:               'Veritabanı Türü',
  db_host:               'Sunucu IP / Host',
  db_port:               'MySQL Port',
  db_user:               'MySQL Kullanıcı Adı',
  db_pass:               'MySQL Şifresi',
  db_name:               'Veritabanı Adı',
  db_network_path:       'Ağ Klasörü Yolu',
};

// ─── Şık Sub-Tab Navigasyon Bileşeni ───────────────────────────────
const SubTabHeader = ({ tabs, activeKey, onChange }) => (
  <div style={{
    display: 'inline-flex',
    gap: 4,
    background: 'var(--color-surface-alt)',
    padding: '4px',
    borderRadius: 8,
    border: '1px solid var(--color-border)',
    marginBottom: 20
  }}>
    {tabs.map(t => {
      const active = activeKey === t.key;
      return (
        <button
          key={t.key}
          type="button"
          onClick={() => onChange(t.key)}
          style={{
            padding: '8px 18px',
            borderRadius: 6,
            border: 'none',
            cursor: 'pointer',
            fontSize: 13,
            fontWeight: active ? 700 : 500,
            background: active ? 'var(--color-primary)' : 'transparent',
            color: active ? '#ffffff' : 'var(--color-text-secondary)',
            transition: 'all 0.15s ease',
            display: 'flex',
            alignItems: 'center',
            gap: 6
          }}
        >
          <span style={{ fontSize: 14 }}>{t.icon}</span>
          <span>{t.label}</span>
        </button>
      );
    })}
  </div>
);

// ─── Yedekleme paneli ───────────────────────────────────────────────
function BackupPanel({ showNotification, auditLog }) {
  const [backupPath, setBackupPath] = useState('');
  const [loading, setLoading]       = useState(false);
  const [logs, setLogs]             = useState([]);
  const [backupFiles, setBackupFiles] = useState([]);
  const [confirmRestore, setConfirmRestore] = useState(null);

  const loadLogs = useCallback(async () => {
    const r = await apiGet('/api/backup/settings');
    if (r.success) {
      setBackupPath(r.backupPath || '');
      setLogs(r.logs || []);
    }
  }, []);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  const chooseDir = async () => {
    const pathValue = (backupPath || '').trim();
    if (!pathValue) {
      showNotification('Lütfen sunucu üzerindeki yedekleme klasörünün tam yolunu girin.', 'warning');
      return;
    }
    const r = await apiPost('/api/backup/settings', { backupPath: pathValue });
    if (r.success) {
      showNotification('Yedekleme klasörü güncellendi.', 'success');
    } else {
      showNotification('Klasör kaydedilemedi: ' + (r.message || ''), 'danger');
    }
  };

  const doBackup = async () => {
    if (!backupPath) { showNotification('Lütfen önce yedekleme klasörü belirleyin.', 'warning'); return; }
    setLoading(true);
    const r = await apiPost('/api/backup/run', { backupPath });
    setLoading(false);
    if (r.success) {
      await auditLog({ action: 'BACKUP', module: 'system', description: `Yedekleme alındı: ${r.path}` });
      showNotification(`✓ Yedekleme tamamlandı: ${r.path}`, 'success', 5000); loadLogs();
    }
    else showNotification(`Hata: ${r.message}`, 'danger');
  };

  const initiateRestore = async () => {
    const r = await apiGet('/api/backup/files');
    if (r.success && Array.isArray(r.files) && r.files.length > 0) {
      setBackupFiles(r.files);
      setConfirmRestore({ files: r.files });
    } else {
      showNotification('Sunucuda restore edilebilecek yedek dosyası bulunamadı.', 'warning');
    }
  };

  const doRestore = async () => {
    if (!confirmRestore?.fileName) return;
    setLoading(true);
    const res = await apiPost('/api/backup/restore', { fileName: confirmRestore.fileName });
    setLoading(false);
    setConfirmRestore(null);
    if (res.success) {
      await auditLog({ action: 'RESTORE', module: 'system', description: `Yedekten geri yükleme yapıldı: ${confirmRestore.fileName}` });
      showNotification('Geri yükleme tamamlandı.', 'success', 8000);
    }
    else showNotification(`Hata: ${res.message}`, 'danger');
  };

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
        <div className="card" style={{ padding: 20 }}>
          <h4 style={{ fontSize: 13, marginBottom: 6, color: 'var(--color-primary-light)', fontWeight: 700 }}>💾 Manuel Yedekleme</h4>
          <p style={{ fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 14 }}>Mevcut veritabanını sunucudaki seçilen klasöre kopyalar.</p>
          <div className="form-group">
            <label>Yedekleme Klasörü (sunucu yolu)</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input type="text" value={backupPath} onChange={e => setBackupPath(e.target.value)} style={{ flex: 1, fontSize: 11 }} placeholder="örn: /home/admin/Documents/Yedek" />
              <button className="btn btn-secondary btn-sm" onClick={chooseDir}>💾 Kaydet</button>
            </div>
          </div>
          <button className="btn btn-primary" style={{ width: '100%', marginTop: 8 }} onClick={doBackup} disabled={loading || !backupPath}>
            {loading ? '⏳ İşlem Yapılıyor...' : '💾 Şimdi Yedek Oluştur'}
          </button>
        </div>

        <div className="card" style={{ padding: 20 }}>
          <h4 style={{ fontSize: 13, marginBottom: 6, color: 'var(--color-danger)', fontWeight: 700 }}>⚠️ Veri Geri Yükleme</h4>
          <p style={{ fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 14 }}>Sunucudaki yedek dosyalarından birini seçerek verileri geri yükler.</p>
          <div className="alert alert-danger" style={{ fontSize: 11, padding: '8px 12px', marginBottom: 14 }}>
            DİKKAT: Bu işlem mevcut TÜM verilerin üzerine yazar ve geri alınamaz!
          </div>
          <button className="btn btn-danger" style={{ width: '100%' }} onClick={initiateRestore} disabled={loading}>
            📥 Yedekten Geri Yükle
          </button>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <span>📋 Son Yedekleme İşlemleri</span>
          <button className="btn btn-secondary btn-sm" onClick={loadLogs}>🔄</button>
        </div>
        {logs.length === 0 ? (
          <div style={{ padding: 30, textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 12 }}>Henüz yedekleme kaydı bulunmuyor.</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: 'var(--grid-header-bg)', color: 'var(--grid-header-text)' }}>
                <th style={{ padding: '8px 15px', textAlign: 'left', fontSize: 11 }}>Tarih</th>
                <th style={{ padding: '8px 15px', textAlign: 'left', fontSize: 11 }}>Açıklama</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log, i) => (
                <tr key={log.id || i} style={{ borderBottom: '1px solid var(--color-border)', background: i % 2 ? 'var(--color-surface-alt)' : 'var(--color-surface)' }}>
                  <td style={{ padding: '8px 15px', color: 'var(--color-text-secondary)', whiteSpace: 'nowrap' }}>{log.created_at?.replace('T', ' ').slice(0, 16)}</td>
                  <td style={{ padding: '8px 15px', color: 'var(--color-text)', fontSize: 11 }}>{log.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {confirmRestore && (
        <ConfirmDialog
          title="Geri Yükleme Onayı"
          message={`UYARI: Mevcut veriler silinecek.\n\nSunucudaki yedek dosyalarından birini seçin.`}
          confirmText="Geri Yükle" type="danger"
          onConfirm={doRestore}
          onCancel={() => setConfirmRestore(null)}
        >
          <div style={{ marginTop: 10 }}>
            <select
              value={confirmRestore.fileName || ''}
              onChange={e => setConfirmRestore(r => ({ ...r, fileName: e.target.value }))}
              style={{ width: '100%', padding: 8, borderRadius: 4, border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)' }}
            >
              <option value="">— Yedek dosyası seçin —</option>
              {(confirmRestore.files || []).map(f => (
                <option key={f.name} value={f.name}>{f.name} ({new Date(f.mtime).toLocaleString('tr-TR')})</option>
              ))}
            </select>
          </div>
        </ConfirmDialog>
      )}
    </div>
  );
}

// ─── Veri Temizliği paneli ──────────────────────────────────────────
function DataCleanPanel({ showNotification, auditLog }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [confirmClean, setConfirmClean] = useState(null);

  const loadStats = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${getApiBase()}/api/db/stats`);
      if (res.ok) {
        const data = await res.json();
        if (data.success) setStats(data.stats);
      }
    } catch (e) {
      console.error('Stats query failed:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const handleClean = async (target) => {
    setConfirmClean(null);
    setLoading(true);
    try {
      const res = await fetch(`${getApiBase()}/api/db/cleanup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          showNotification(data.message, 'success');
          await auditLog({
            action: 'DELETE',
            module: 'system',
            description: `Veri temizliği çalıştırıldı: ${target}`
          });
          loadStats();
        } else {
          showNotification('Temizleme hatası: ' + data.message, 'danger');
        }
      }
    } catch (e) {
      showNotification('Temizleme hatası: ' + e.message, 'danger');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="card" style={{ padding: 20 }}>
        <h4 style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text)', marginBottom: 12 }}>📊 Veritabanı İstatistikleri</h4>
        {loading ? (
          <div style={{ color: 'var(--color-text-muted)', fontSize: 12 }}>İstatistikler yükleniyor...</div>
        ) : stats ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            <div style={{ background: 'var(--color-surface-alt)', padding: 12, borderRadius: 6, border: '1px solid var(--color-border)' }}>
              <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>Sohbet Mesajları</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--color-text)', marginTop: 2 }}>{stats.chat_messages || 0}</div>
            </div>
            <div style={{ background: 'var(--color-surface-alt)', padding: 12, borderRadius: 6, border: '1px solid var(--color-border)' }}>
              <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>Sohbet Odaları</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--color-text)', marginTop: 2 }}>{stats.chat_rooms || 0}</div>
            </div>
            <div style={{ background: 'var(--color-surface-alt)', padding: 12, borderRadius: 6, border: '1px solid var(--color-border)' }}>
              <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>İşlem Logları</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--color-text)', marginTop: 2 }}>{stats.audit_logs || 0}</div>
            </div>
            <div style={{ background: 'var(--color-surface-alt)', padding: 12, borderRadius: 6, border: '1px solid var(--color-border)' }}>
              <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>Kullanıcı Sayısı</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--color-text)', marginTop: 2 }}>{stats.users || 0}</div>
            </div>
            <div style={{ background: 'var(--color-surface-alt)', padding: 12, borderRadius: 6, border: '1px solid var(--color-border)' }}>
              <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>🧠 AI Hafıza Notu</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#60a5fa', marginTop: 2 }}>{stats.ai_memories || 0}</div>
            </div>
          </div>
        ) : (
          <div style={{ color: 'var(--color-danger)', fontSize: 12 }}>İstatistikler alınamadı.</div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
        <div className="card" style={{ padding: 20 }}>
          <h4 style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-danger)', marginBottom: 6 }}>💬 Sohbet Geçmişini Temizle</h4>
          <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 14 }}>Tüm sohbet odalarını ve mesaj geçmişini kalıcı olarak siler.</p>
          <button className="btn btn-danger" style={{ width: '100%' }} onClick={() => setConfirmClean('chat')}>
            💬 Sohbet Verilerini Temizle
          </button>
        </div>

        <div className="card" style={{ padding: 20 }}>
          <h4 style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-danger)', marginBottom: 6 }}>📋 İşlem Loglarını Temizle</h4>
          <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 14 }}>Tüm işlem geçmişi kayıtlarını (audit logs) kalıcı olarak siler.</p>
          <button className="btn btn-danger" style={{ width: '100%' }} onClick={() => setConfirmClean('logs')}>
            📋 Log Verilerini Temizle
          </button>
        </div>

        <div className="card" style={{ padding: 20 }}>
          <h4 style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-danger)', marginBottom: 6 }}>🧠 AI Hafızasını Temizle</h4>
          <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 14 }}>Bitro AI'ın öğrendiği tüm kişisel ve operasyonel hafızayı sıfırlar.</p>
          <button className="btn btn-danger" style={{ width: '100%' }} onClick={() => setConfirmClean('ai_memory')}>
            🧠 AI Hafızasını Sıfırla
          </button>
        </div>
      </div>

      {confirmClean && (
        <ConfirmDialog
          title="Veri Temizliği Onayı"
          message={
            confirmClean === 'chat'
              ? 'Tüm sohbet geçmişi ve odaları silinecektir. Emin misiniz?'
              : confirmClean === 'ai_memory'
              ? 'Bitro AI\'ın tüm öğrendiği hafıza kayıtları silinecektir. Emin misiniz?'
              : 'Tüm işlem logları silinecektir. Emin misiniz?'
          }
          confirmText="Evet, Temizle"
          cancelText="Vazgeç"
          type="danger"
          onConfirm={() => handleClean(confirmClean)}
          onCancel={() => setConfirmClean(null)}
        />
      )}
    </div>
  );
}

// ─── İşlem Geçmişi Paneli ──────────────────────────────────────────
function AuditLogPanel({ showNotification }) {
  const [logs, setLogs]             = useState([]);
  const [loading, setLoading]       = useState(true);
  const [moduleFilter, setModuleFilter] = useState('ALL');
  const [actionFilter, setActionFilter] = useState('ALL');

  const loadLogs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await window.electronAPI.getAuditLogs({
        module: moduleFilter === 'ALL' ? null : moduleFilter,
        action: actionFilter === 'ALL' ? null : actionFilter,
        limit: 200
      });
      if (res.success && Array.isArray(res.data)) {
        setLogs(res.data);
      }
    } catch (e) {
      showNotification('Loglar yüklenirken hata oluştu.', 'danger');
    } finally {
      setLoading(false);
    }
  }, [moduleFilter, actionFilter, showNotification]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  const actionLabels = {
    CREATE: 'Oluşturma',
    UPDATE: 'Güncelleme',
    DELETE: 'Silme',
    LOGIN: 'Giriş',
    LOGOUT: 'Çıkış',
    BACKUP: 'Yedek',
    RESTORE: 'Geri Yükleme',
    SYNC: 'Senkronizasyon',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, height: '100%' }}>
      <div className="card" style={{ padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 4 }}>Modül</label>
            <select value={moduleFilter} onChange={e => setModuleFilter(e.target.value)} style={{ padding: '6px 10px', fontSize: 12, borderRadius: 4, border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)' }}>
              <option value="ALL">Tüm Modüller</option>
              <option value="service">Servis Fişleri</option>
              <option value="stock">Stok / Parça</option>
              <option value="toner">Toner</option>
              <option value="users">Kullanıcılar</option>
              <option value="system">Sistem</option>
            </select>
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 4 }}>İşlem Türü</label>
            <select value={actionFilter} onChange={e => setActionFilter(e.target.value)} style={{ padding: '6px 10px', fontSize: 12, borderRadius: 4, border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)' }}>
              <option value="ALL">Tüm İşlemler</option>
              {Object.entries(actionLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </div>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={loadLogs} title="Yenile">
          🔄 Yenile
        </button>
      </div>

      <div className="card" style={{ flex: 1, overflowY: 'auto' }}>
        {loading ? (
          <div className="flex-center" style={{ height: 200 }}><div className="spinner" /></div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: 'var(--grid-header-bg)', color: 'var(--grid-header-text)', borderBottom: '1px solid var(--color-border)' }}>
                <th style={{ padding: '10px 14px', textAlign: 'left', width: 140 }}>Tarih</th>
                <th style={{ padding: '10px 14px', textAlign: 'left', width: 130 }}>Kullanıcı</th>
                <th style={{ padding: '10px 14px', textAlign: 'left', width: 100 }}>İşlem</th>
                <th style={{ padding: '10px 14px', textAlign: 'left', width: 100 }}>Modül</th>
                <th style={{ padding: '10px 14px', textAlign: 'left' }}>Açıklama</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log, index) => (
                <tr key={log.id || index} style={{ borderBottom: '1px solid var(--color-border)', background: index % 2 ? 'var(--color-surface-alt)' : 'var(--color-surface)' }}>
                  <td style={{ padding: '10px 14px', color: 'var(--color-text-secondary)', whiteSpace: 'nowrap' }}>{log.created_at?.replace('T', ' ').slice(0, 16)}</td>
                  <td style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--color-text)' }}>{log.user_name || log.username || 'Sistem'}</td>
                  <td style={{ padding: '10px 14px' }}>
                    <span className={`badge ${log.action === 'DELETE' ? 'badge-danger' : log.action === 'CREATE' ? 'badge-success' : 'badge-info'}`}>
                      {actionLabels[log.action] || log.action}
                    </span>
                  </td>
                  <td style={{ padding: '10px 14px', color: 'var(--color-text-secondary)', textTransform: 'capitalize' }}>{log.module}</td>
                  <td style={{ padding: '10px 14px', color: 'var(--color-text)' }}>{log.description}</td>
                </tr>
              ))}
              {logs.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ padding: 30, textAlign: 'center', color: 'var(--color-text-muted)' }}>İşlem kaydı bulunamadı.</td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ─── Ana Ayarlar Modülü ─────────────────────────────────────────────
export default function Settings() {
  const { showNotification, reloadSettings } = useApp();
  const { hasPermission, auditLog } = useAuth();
  
  const [activeSection, setActiveSection] = useState('general');
  const [subTabs, setSubTabs] = useState({
    stock_templates: 'categories',
    integrations_notifications: 'snipeit',
    db_backup: 'backup',
    logs_clean: 'logs'
  });

  const [settings, setSettings] = useState({});
  const [savedSettings, setSavedSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);
  const [testingServer, setTestingServer] = useState(false);
  const [pulling, setPulling] = useState(false);
  const [pushing, setPushing] = useState(false);
  const [shownFields, setShownFields] = useState({});
  const [confirmAction, setConfirmAction] = useState(null);

  const isDirty = JSON.stringify(settings) !== JSON.stringify(savedSettings);

  const setSubTab = (sectionKey, tabKey) => {
    setSubTabs(prev => ({ ...prev, [sectionKey]: tabKey }));
  };

  const switchSection = (key) => {
    if (isDirty && !window.confirm('Kaydedilmemiş değişiklikler var. Yine de geçmek istiyor musunuz?')) return;
    setActiveSection(key);
    setSyncResult(null);
  };

  const load = useCallback(async () => {
    setLoading(true);
    const map = {};
    try {
      const s = await window.electronAPI.query('SELECT `key`, `value` FROM settings', []);
      if (s.success && Array.isArray(s.data)) s.data.forEach(r => { map[r.key] = r.value; });
    } catch (e) { console.error('Settings load failed:', e); }
    try {
      const response = await fetch(`${getApiBase()}/api/snipe-config`);
      if (response.ok) {
        const config = await response.json();
        const sc = config.success && config.config ? config.config : config;
        map.snipeit_url     = sc.snipeit_url     || map.snipeit_url     || '';
        map.snipeit_api_key = sc.snipeit_api_key || map.snipeit_api_key || '';
      }
    } catch {}
    setSettings(map); setSavedSettings(map); setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const saveSettings = async () => {
    setSaving(true);
    try {
      const norm = {
        ...settings,
        snipeit_url:     (settings.snipeit_url || '').trim().replace(/\/+$/, '').replace(/\/api\/v1$/i, ''),
        snipeit_api_key: (settings.snipeit_api_key || '').trim().replace(/^Bearer\s+/i, '').trim(),
      };
      const ops = Object.entries(norm).map(([key, value]) => ({
        sql: "REPLACE INTO settings (`key`,`value`,`updated_at`) VALUES (?,?,CURRENT_TIMESTAMP)",
        params: [key, value],
      }));
      const res = await window.electronAPI.transaction(ops);
      if (!res?.success) { showNotification('Ayarlar kaydedilemedi: ' + (res?.message || ''), 'danger'); return; }
      setSettings(norm); setSavedSettings(norm);
      await load(); await reloadSettings();
      await auditLog({
        action: 'UPDATE',
        module: 'settings',
        description: 'Ayarlar kaydedildi.',
        newValue: Object.keys(norm)
      });
      showNotification('Ayarlar kaydedildi.', 'success');
    } catch (err) { showNotification('Hata: ' + err.message, 'danger'); }
    finally { setSaving(false); }
  };

  const handleSync = async () => {
    setSyncing(true); setSyncResult(null);
    try {
      const r = await window.electronAPI.snipeitSync();
      if (r.success) {
        setSyncResult(r.results);
        await auditLog({ action: 'SYNC', module: 'snipeit', description: 'Snipe-IT senkronizasyonu çalıştırıldı.', newValue: r.results });
        showNotification('Snipe-IT verileri başarıyla senkronize edildi.', 'success');
      } else {
        showNotification('Senkronizasyon başarısız: ' + (r.message || ''), 'danger');
      }
    } catch { showNotification('Senkronizasyon hatası oluştu.', 'danger'); }
    finally { setSyncing(false); }
  };

  const handleTestMysql = async () => {
    setTestingServer(true);
    try {
      const r = await window.electronAPI.testMysql(settings);
      if (r?.success) showNotification('✓ Sunucuya bağlantı başarılı!', 'success');
      else showNotification('Bağlantı hatası: ' + (r?.message || ''), 'danger');
    } catch { showNotification('Bağlantı testi sırasında hata.', 'danger'); }
    finally { setTestingServer(false); }
  };

  const handlePullMysql = async () => {
    setPulling(true);
    try {
      const r = await window.electronAPI.pullMysql(settings);
      if (r?.success) {
        await auditLog({ action: 'SYNC', module: 'server', description: 'Sunucudan veriler indirildi.' });
        await reloadSettings();
        showNotification('✓ ' + (r.message || 'Veriler indirildi.'), 'success');
      } else { showNotification('İndirme başarısız: ' + (r?.message || ''), 'danger'); }
    } catch { showNotification('Veri indirme sırasında hata.', 'danger'); }
    finally { setPulling(false); }
  };

  const handlePushMysql = () => {
    setConfirmAction({
      title: 'Yerel Verileri Sunucuya Yükle',
      message: 'Bu bilgisayardaki tüm veriler MySQL sunucusuna yüklenecek. Sunucudaki mevcut veriler silinebilir.',
      type: 'danger',
      onConfirm: async () => {
        setConfirmAction(null); setPushing(true);
        try {
          const r = await window.electronAPI.pushMysql(settings);
          if (r?.success) {
            await auditLog({ action: 'SYNC', module: 'server', description: 'Yerel veriler sunucuya yüklendi.' });
            await reloadSettings();
            showNotification(r.message || 'Veriler yüklendi.', 'success');
          } else { showNotification('Hata: ' + (r?.message || ''), 'danger'); }
        } catch { showNotification('Yükleme başarısız.', 'danger'); }
        finally { setPushing(false); }
      },
    });
  };

  const renderField = (key) => {
    if (key !== 'db_type' && key !== 'db_network_path' && key.startsWith('db_') && settings.db_type !== 'mysql') return null;
    if (key === 'db_network_path' && settings.db_type === 'mysql') return null;
    const label = LABELS[key] || key;
    const isSecret = key.includes('pass') || key.includes('api_key');
    return (
      <div key={key} style={{ marginBottom: 14 }}>
        <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
          {label}
        </label>
        {key === 'db_type' ? (
          <select value={settings[key] || 'sqlite'} onChange={e => setSettings(s => ({ ...s, [key]: e.target.value }))}
            style={{ width: '100%', padding: '8px 12px', borderRadius: 4, border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)' }}>
            <option value="sqlite">Yerel SQLite / Paylaşılan Ağ Klasörü</option>
            <option value="mysql">MySQL / MariaDB Sunucusu</option>
          </select>
        ) : key === 'snipeit_sync_interval' ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="number" min="1" max="1440" value={settings[key] || '5'}
              onChange={e => setSettings(s => ({ ...s, [key]: e.target.value }))} style={{ width: 90 }} />
            <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>dakika</span>
          </div>
        ) : isSecret ? (
          <div style={{ position: 'relative' }}>
            <input type={shownFields[key] ? 'text' : 'password'} value={settings[key] || ''}
              onChange={e => setSettings(s => ({ ...s, [key]: e.target.value }))} style={{ paddingRight: 40 }} />
            <button type="button" onClick={() => setShownFields(f => ({ ...f, [key]: !f[key] }))}
              style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)', fontSize: 15 }}>
              {shownFields[key] ? '🙈' : '👁'}
            </button>
          </div>
        ) : (
          <input type="text" value={settings[key] || ''} onChange={e => setSettings(s => ({ ...s, [key]: e.target.value }))}
            placeholder={key === 'db_network_path' ? '\\\\128.1.1.10\\ortak_klasor' : ''} />
        )}
      </div>
    );
  };

  // ─── İçerik Render ───
  const renderContent = () => {
    if (activeSection === 'general') {
      return <GeneralSettings />;
    }

    if (activeSection === 'reports') {
      return (
        <div style={{ height: '100%', minHeight: 400 }}>
          <Reports />
        </div>
      );
    }

    if (activeSection === 'stock_templates') {
      const activeTab = subTabs.stock_templates || 'categories';
      return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          <SubTabHeader
            tabs={[
              { key: 'categories', icon: '🏷️', label: 'Stok Kategorileri' },
              { key: 'templates',  icon: '📋', label: 'Kurulum Şablonları' },
            ]}
            activeKey={activeTab}
            onChange={k => setSubTab('stock_templates', k)}
          />
          <div style={{ flex: 1 }}>
            {activeTab === 'categories' ? (
              <CategorySettings showNotification={showNotification} auditLog={auditLog} />
            ) : (
              <TemplateSettings showNotification={showNotification} />
            )}
          </div>
        </div>
      );
    }

    if (activeSection === 'announcements') {
      return (
        <div style={{ height: '100%', minHeight: 400 }}>
          <AnnouncementsSettings showNotification={showNotification} />
        </div>
      );
    }

    if (activeSection === 'notifications' || activeSection === 'integrations_notifications') {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <WebPushSettings showNotification={showNotification} />
        </div>
      );
    }

    if (activeSection === 'auth') {
      return (
        <div style={{ height: '100%', minHeight: 400 }}>
          <SystemUsers />
        </div>
      );
    }

    if (activeSection === 'db_backup') {
      const activeTab = subTabs.db_backup || 'backup';
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <SubTabHeader
            tabs={[
              { key: 'backup', icon: '💾', label: 'Veritabanı Yedekleme & Geri Yükleme' },
              { key: 'server', icon: '🌐', label: 'Veritabanı & Sunucu Ayarları' },
            ]}
            activeKey={activeTab}
            onChange={k => setSubTab('db_backup', k)}
          />
          {activeTab === 'backup' ? (
            <BackupPanel showNotification={showNotification} auditLog={auditLog} />
          ) : (
            <div className="card" style={{ padding: 24 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0 20px' }}>
                {SERVER_KEYS.map(k => renderField(k))}
              </div>
              <div style={{ marginTop: 24, display: 'flex', gap: 10, flexWrap: 'wrap', borderTop: '1px solid var(--color-border)', paddingTop: 20 }}>
                <button className="btn btn-primary" onClick={saveSettings} disabled={saving} style={{ padding: '9px 22px' }}>
                  {saving ? '⏳ Kaydediliyor...' : '💾 Kaydet'}
                </button>
                {isDirty && (
                  <button className="btn btn-secondary" onClick={() => { setSettings(savedSettings); }} style={{ padding: '9px 18px' }}>
                    ↩ İptal
                  </button>
                )}
                {settings.db_type === 'mysql' && (
                  <>
                    <button className="btn btn-secondary" onClick={handleTestMysql} disabled={testingServer} style={{ padding: '9px 18px' }}>
                      {testingServer ? '⏳ Test Ediliyor...' : '🔌 Bağlantıyı Test Et'}
                    </button>
                    <button className="btn btn-success" onClick={handlePullMysql} disabled={pulling} style={{ padding: '9px 18px' }}>
                      {pulling ? '⏳ İndiriliyor...' : '☁️ Sunucudan İndir'}
                    </button>
                    <button className="btn btn-warning" onClick={handlePushMysql} disabled={pushing} style={{ padding: '9px 18px', background: '#d97706', color: '#fff', border: 'none' }}>
                      {pushing ? '⏳ Yükleniyor...' : '🚀 Yerel Verileri Yükle'}
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      );
    }

    if (activeSection === 'logs_clean') {
      const activeTab = subTabs.logs_clean || 'ai_memory';
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <SubTabHeader
            tabs={[
              { key: 'ai_memory', icon: '🧠', label: 'Bitro AI Hafızası' },
              { key: 'logs',      icon: '📋', label: 'İşlem Logları' },
              { key: 'clean',     icon: '🧹', label: 'Veri & Log Temizliği' },
            ]}
            activeKey={activeTab}
            onChange={k => setSubTab('logs_clean', k)}
          />
          {activeTab === 'logs' ? (
            <AuditLogPanel showNotification={showNotification} />
          ) : activeTab === 'ai_memory' ? (
            <AiMemoryPanel showNotification={showNotification} />
          ) : (
            <DataCleanPanel showNotification={showNotification} auditLog={auditLog} />
          )}
        </div>
      );
    }

    return null;
  };

  if (!hasPermission('settings', 'can_admin')) {
    return (
      <div className="flex-center flex-column" style={{ height: '100%', gap: 14 }}>
        <div style={{ fontSize: 42 }}>🔒</div>
        <div style={{ color: 'var(--color-text-secondary)', fontSize: 14 }}>Ayarlar modülüne erişim yetkiniz yok.</div>
      </div>
    );
  }

  const isFullHeightSection = ['auth', 'stock_templates', 'announcements', 'reports'].includes(activeSection);

  return (
    <div style={{ display: 'flex', height: '100%', background: 'var(--color-bg)', overflow: 'hidden' }}>
      {/* Sol Menü */}
      <div style={{
        width: 240,
        flexShrink: 0,
        borderRight: '1px solid var(--color-border)',
        background: 'var(--color-bg-dark)',
        padding: '16px 0',
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        overflowY: 'auto'
      }}>
        {SECTION_GROUPS.map((group, gIdx) => (
          <div key={gIdx} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{
              padding: '0 18px',
              marginTop: gIdx > 0 ? 18 : 4,
              marginBottom: 6,
              fontSize: 10,
              fontWeight: 700,
              color: 'var(--color-text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.8px'
            }}>
              {group.title}
            </div>
            {group.items.map(s => {
              const isActive = activeSection === s.key;
              return (
                <button
                  key={s.key}
                  onClick={() => switchSection(s.key)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    width: '100%',
                    padding: '10px 18px',
                    textAlign: 'left',
                    border: 'none',
                    cursor: 'pointer',
                    borderLeft: `3px solid ${isActive ? 'var(--color-primary)' : 'transparent'}`,
                    background: isActive ? 'var(--color-surface)' : 'transparent',
                    color: isActive ? 'var(--color-primary-light)' : 'var(--color-text-secondary)',
                    fontWeight: isActive ? 700 : 500,
                    fontSize: 13,
                    transition: 'all 0.15s',
                  }}
                >
                  <span style={{ fontSize: 15 }}>{s.icon}</span>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.label}</span>
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {/* İçerik */}
      <div style={{ flex: 1, overflow: 'auto', padding: isFullHeightSection ? '24px 32px' : '24px 32px' }}>
        {loading ? (
          <div className="flex-center" style={{ height: 200 }}><div className="spinner" /></div>
        ) : (
          <div style={{ 
            maxWidth: isFullHeightSection ? '100%' : 780, 
            height: isFullHeightSection ? '100%' : 'auto',
          }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-text)', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
              {ALL_SECTIONS.find(s => s.key === activeSection)?.icon}{' '}
              {ALL_SECTIONS.find(s => s.key === activeSection)?.label}
            </h2>
            {renderContent()}
          </div>
        )}
      </div>

      {confirmAction && (
        <ConfirmDialog
          title={confirmAction.title} message={confirmAction.message} type={confirmAction.type}
          confirmText="Evet, Devam Et" cancelText="İptal"
          onConfirm={confirmAction.onConfirm} onCancel={() => setConfirmAction(null)}
        />
      )}
    </div>
  );
}
