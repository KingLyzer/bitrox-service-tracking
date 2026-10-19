import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useApp } from '../../../context/AppContext';
import { useAuth } from '../../../context/AuthContext';
import { getApiBase } from '../../../utils/apiConfig';
import { apiGet, apiPost } from '../../../utils/apiFetch';
import WebPushSettings from './WebPushSettings';

export default function GeneralSettings() {
  const { showNotification, reloadSettings, settings: appSettings } = useApp();
  const { user, auditLog } = useAuth();
  const isSuperAdmin = Boolean(user?.is_superadmin || user?.username === 'admin' || Number(user?.id) === 1);

  const [form, setForm] = useState({
    brand_title: 'Örnek Teknoloji A.Ş.',
    brand_subtitle: 'Servis Takip',
    currency: '₺',
    ticket_prefix: 'SRV',
    stock_prefix: 'STK',
    toner_prefix: 'TNR',
    
    // Snipe-IT
    snipeit_url: 'https://snipe.example.com',
    snipeit_api_key: '',
    snipeit_sync_interval: '5',

    // Gemini AI
    gemini_api_key: '',
    gemini_model: 'gemini-3.5-flash-lite',
    ai_assistant_name: 'Bitro',

    // Database & Network
    db_type: 'mysql',
    db_host: '127.0.0.1',
    db_port: '3306',
    db_user: 'root',
    db_pass: '',
    db_name: 'servicetracker',
    db_network_path: '\\\\172.16.1.97\\Storage',
  });

  const [initialForm, setInitialForm] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showSecrets, setShowSecrets] = useState({
    snipeit_api_key: false,
    gemini_api_key: false,
    db_pass: false,
  });

  // Yönetici Şifre Doğrulama Modal Durumu
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [verifying, setVerifying] = useState(false);

  // Ayarları Yükle
  const loadSettings = useCallback(async () => {
    setLoading(true);
    try {
      const merged = { ...form };

      // 1. MySQL / API Settings tablosu
      try {
        const res = await apiGet('/api/settings');
        if (res.success && Array.isArray(res.data)) {
          res.data.forEach(item => {
            if (item.key && item.value !== undefined && item.value !== null) {
              merged[item.key] = item.value;
            }
          });
        }
      } catch (e) {
        console.warn('API settings get failed:', e);
      }

      // 2. Electron lokal sorgusu (varsa)
      if (window.electronAPI?.query) {
        try {
          const qRes = await window.electronAPI.query('SELECT `key`, `value` FROM settings', []);
          if (qRes.success && Array.isArray(qRes.data)) {
            qRes.data.forEach(item => {
              if (item.key && item.value !== undefined && item.value !== null) {
                merged[item.key] = item.value;
              }
            });
          }
        } catch (e) {}
      }

      // 3. Snipe Config fallback
      try {
        const snipeRes = await fetch(`${getApiBase()}/api/snipe-config`).then(r => r.json()).catch(() => null);
        if (snipeRes?.config) {
          if (!merged.snipeit_url && (snipeRes.config.snipeit_url || snipeRes.config.snipe_url)) {
            merged.snipeit_url = snipeRes.config.snipeit_url || snipeRes.config.snipe_url;
          }
          if (!merged.snipeit_api_key && (snipeRes.config.snipeit_api_key || snipeRes.config.snipe_token)) {
            merged.snipeit_api_key = snipeRes.config.snipeit_api_key || snipeRes.config.snipe_token;
          }
        }
      } catch (e) {}


      setForm(merged);
      setInitialForm(merged);
    } catch (err) {
      console.error('Ayarlar yüklenirken hata:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const toggleSecret = (field) => {
    setShowSecrets(prev => ({ ...prev, [field]: !prev[field] }));
  };

  const handleChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  // Form submit edildiğinde şifre doğrulama modalını aç
  const handleRequestSave = (e) => {
    if (e) e.preventDefault();
    setAuthError('');
    setAdminPassword('');
    setShowAuthModal(true);
  };

  // Şifreyi doğrula ve ayarları uygula
  const handleVerifyAndSave = async (e) => {
    if (e) e.preventDefault();
    if (!adminPassword) {
      setAuthError('Lütfen yönetici şifrenizi giriniz.');
      return;
    }

    setVerifying(true);
    setAuthError('');

    try {
      const username = user?.username || 'admin';
      let verifyRes = await apiPost('/api/auth/verify-password', {
        username,
        password: adminPassword,
      });

      // Fallback: If 404 (e.g. older backend instance / proxy), try alternative endpoints
      if (!verifyRes?.success && (verifyRes?.status === 404 || String(verifyRes?.message).includes('404'))) {
        verifyRes = await apiPost('/api/verify-password', {
          username,
          password: adminPassword,
        });
      }

      if (!verifyRes?.success && (verifyRes?.status === 404 || String(verifyRes?.message).includes('404'))) {
        verifyRes = await apiPost('/api/auth/login', {
          username,
          password: adminPassword,
        });
      }

      if (!verifyRes?.success && (verifyRes?.status === 404 || String(verifyRes?.message).includes('404'))) {
        verifyRes = await apiPost('/api/login', {
          username,
          password: adminPassword,
        });
      }

      if (!verifyRes.success) {
        setAuthError(verifyRes.message || 'Girdiğiniz yönetici şifresi hatalı!');
        setVerifying(false);
        return;
      }

      // Şifre doğru, kaydetme işlemine devam et
      setSaving(true);
      let cleanForm = {};

      if (isSuperAdmin) {
        cleanForm = {
          ...form,
          brand_title: (form.brand_title || 'Örnek Teknoloji A.Ş.').trim(),
          brand_subtitle: (form.brand_subtitle || 'Servis Takip').trim(),
          snipeit_url: (form.snipeit_url || '').trim().replace(/\/+$/, '').replace(/\/api\/v1$/i, ''),
          snipeit_api_key: (form.snipeit_api_key || '').trim().replace(/^Bearer\s+/i, '').trim(),
          gemini_api_key: (form.gemini_api_key || '').trim(),
          db_pass: form.db_pass || '',
        };
      } else {
        // Normal yöneticiler sadece Kurumsal Kimlik & Başlık ayarlarını değiştirebilir
        cleanForm = {
          brand_title: (form.brand_title || 'Örnek Teknoloji A.Ş.').trim(),
          brand_subtitle: (form.brand_subtitle || 'Servis Takip').trim(),
          currency: (form.currency || '₺').trim(),
          ticket_prefix: (form.ticket_prefix || 'SRV').trim(),
          stock_prefix: (form.stock_prefix || 'STK').trim(),
          toner_prefix: (form.toner_prefix || 'TNR').trim(),
        };
      }

      // 1. Backend API üzerinden kaydet
      const saveRes = await apiPost('/api/settings/save', { settings: cleanForm });
      if (!saveRes.success) {
        throw new Error(saveRes.message || 'Kayıt başarısız');
      }

      // 2. Electron lokal SQLite varsa oraya da yaz
      if (window.electronAPI?.transaction) {
        try {
          const queries = Object.entries(cleanForm).map(([k, v]) => ({
            sql: 'REPLACE INTO settings (`key`, `value`, `updated_at`) VALUES (?, ?, CURRENT_TIMESTAMP)',
            params: [k, String(v ?? '')]
          }));
          await window.electronAPI.transaction(queries);
        } catch (e) {}
      }

      setInitialForm(cleanForm);
      setForm(prev => ({ ...prev, ...cleanForm }));
      setShowAuthModal(false);
      setAdminPassword('');

      if (reloadSettings) await reloadSettings();
      if (auditLog) {
        await auditLog({
          action: 'UPDATE',
          module: 'settings',
          description: `Genel sistem ve API ayarları güncellendi (${isSuperAdmin ? 'Süper Yönetici' : 'Yönetici'}: ${username}).`,
        });
      }

      showNotification('Genel ayarlar başarıyla kaydedildi.', 'success');
    } catch (err) {
      setAuthError('Ayarlar kaydedilirken hata: ' + err.message);
    } finally {
      setVerifying(false);
      setSaving(false);
    }
  };

  const isDirty = JSON.stringify(form) !== JSON.stringify(initialForm);

  if (loading) {
    return (
      <div className="flex-center" style={{ height: 260 }}>
        <div className="spinner" />
      </div>
    );
  }

  return (
    <>
      <form onSubmit={handleRequestSave} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        
        {/* 1. KURUMSAL KİMLİK & BAŞLIK AYARLARI */}
        <div className="card" style={{ padding: 20, border: '1px solid var(--color-border)', borderRadius: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, borderBottom: '1px solid var(--color-border)', paddingBottom: 10 }}>
            <span style={{ fontSize: 18 }}>🏢</span>
            <div>
              <h3 style={{ fontSize: 14, fontWeight: 800, color: 'var(--color-text)', margin: 0 }}>
                Kurumsal Kimlik & Başlık Ayarları
              </h3>
              <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                Sol üstteki uygulama logosu, başlık ve sistem önekleri
              </span>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--color-text-secondary)', marginBottom: 5 }}>
                UYGULAMA ANA BAŞLIĞI
              </label>
              <input
                type="text"
                className="form-control"
                value={form.brand_title}
                onChange={e => handleChange('brand_title', e.target.value)}
                placeholder="Örn: Örnek Teknoloji A.Ş."
                style={{ fontWeight: 700 }}
                required
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--color-text-secondary)', marginBottom: 5 }}>
                ALT BAŞLIK / SLOGAN
              </label>
              <input
                type="text"
                className="form-control"
                value={form.brand_subtitle}
                onChange={e => handleChange('brand_subtitle', e.target.value)}
                placeholder="Örn: Servis Takip"
                required
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--color-text-secondary)', marginBottom: 5 }}>
                PARA BİRİMİ
              </label>
              <input
                type="text"
                className="form-control"
                value={form.currency}
                onChange={e => handleChange('currency', e.target.value)}
                placeholder="₺"
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--color-text-secondary)', marginBottom: 5 }}>
                SERVİS FİŞ ÖNEKİ
              </label>
              <input
                type="text"
                className="form-control"
                value={form.ticket_prefix}
                onChange={e => handleChange('ticket_prefix', e.target.value)}
                placeholder="SRV"
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--color-text-secondary)', marginBottom: 5 }}>
                STOK PARÇA KODU ÖNEKİ
              </label>
              <input
                type="text"
                className="form-control"
                value={form.stock_prefix}
                onChange={e => handleChange('stock_prefix', e.target.value)}
                placeholder="STK"
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--color-text-secondary)', marginBottom: 5 }}>
                TONER KODU ÖNEKİ
              </label>
              <input
                type="text"
                className="form-control"
                value={form.toner_prefix}
                onChange={e => handleChange('toner_prefix', e.target.value)}
                placeholder="TNR"
              />
            </div>
          </div>
        </div>

        {/* 2. SNIPE-IT API ENTEGRASYON AYARLARI */}
        <div className="card" style={{ padding: 20, border: '1px solid var(--color-border)', borderRadius: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, borderBottom: '1px solid var(--color-border)', paddingBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 18 }}>☁️</span>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <h3 style={{ fontSize: 14, fontWeight: 800, color: 'var(--color-text)', margin: 0 }}>
                    Snipe-IT Asset Management API
                  </h3>
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: '2px 8px',
                    borderRadius: 10,
                    fontSize: 10.5,
                    fontWeight: 700,
                    background: form.snipeit_url ? 'rgba(16,185,129,0.15)' : 'rgba(156,163,175,0.15)',
                    color: form.snipeit_url ? '#10b981' : '#9ca3af',
                    border: form.snipeit_url ? '1px solid rgba(16,185,129,0.3)' : '1px solid rgba(156,163,175,0.3)'
                  }}>
                    ● {form.snipeit_url ? 'Bağlantı Aktif' : 'Yapılandırılmadı'}
                  </span>
                </div>
                <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                  Canlı envanter, zimmet, lokasyon ve personel senkronizasyonu
                </span>
              </div>
            </div>
            {!isSuperAdmin ? (
              <span className="badge badge-secondary" style={{ fontSize: 11 }}>
                🔒 Sadece Süper Yönetici
              </span>
            ) : (
              <span className="badge badge-primary" style={{ fontSize: 11 }}>
                REST API v1
              </span>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--color-text-secondary)', marginBottom: 5 }}>
                SNIPE-IT SUNUCU URL
              </label>
              <input
                type="text"
                className="form-control"
                value={form.snipeit_url}
                onChange={e => isSuperAdmin && handleChange('snipeit_url', e.target.value)}
                placeholder="https://snipe.example.com"
                readOnly={!isSuperAdmin}
                disabled={!isSuperAdmin}
                style={{
                  fontFamily: 'monospace',
                  fontSize: 12,
                  opacity: !isSuperAdmin ? 0.7 : 1,
                  cursor: !isSuperAdmin ? 'not-allowed' : 'text'
                }}
              />
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-secondary)', margin: 0 }}>
                  SNIPE-IT API BEARER TOKEN / KEY
                </label>
                {!isSuperAdmin && (
                  <span className="badge badge-secondary" style={{ fontSize: 10, padding: '2px 6px' }}>
                    🔒 Yalnızca Süper Yönetici
                  </span>
                )}
              </div>
              <div style={{ position: 'relative' }}>
                <input
                  type={!isSuperAdmin ? 'password' : (showSecrets.snipeit_api_key ? 'text' : 'password')}
                  className="form-control"
                  value={!isSuperAdmin ? (form.snipeit_api_key ? '••••••••••••••••••••••••••••••••' : '') : form.snipeit_api_key}
                  onChange={e => isSuperAdmin && handleChange('snipeit_api_key', e.target.value)}
                  placeholder={!isSuperAdmin ? 'Süper Yönetici Korumalı' : 'Bearer Token giriniz...'}
                  readOnly={!isSuperAdmin}
                  disabled={!isSuperAdmin}
                  style={{
                    paddingRight: 40,
                    fontFamily: 'monospace',
                    fontSize: 12,
                    opacity: !isSuperAdmin ? 0.7 : 1,
                    cursor: !isSuperAdmin ? 'not-allowed' : 'text'
                  }}
                />
                {isSuperAdmin ? (
                  <button
                    type="button"
                    onClick={() => toggleSecret('snipeit_api_key')}
                    style={{
                      position: 'absolute',
                      right: 8,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: 16,
                      color: 'var(--color-text-muted)'
                    }}
                    title={showSecrets.snipeit_api_key ? 'Gizle' : 'Göster'}
                  >
                    {showSecrets.snipeit_api_key ? '🙈' : '👁️'}
                  </button>
                ) : (
                  <span
                    style={{
                      position: 'absolute',
                      right: 10,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      fontSize: 14,
                      opacity: 0.6,
                      cursor: 'not-allowed'
                    }}
                    title="Bu hassas parametre yalnızca Süper Yönetici tarafından görüntülenebilir ve düzenlenebilir."
                  >
                    🔒
                  </span>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--color-text-secondary)', marginBottom: 5 }}>
                  OTOMATİK SENKRONİZASYON PERİYODU
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input
                    type="number"
                    min="1"
                    max="1440"
                    className="form-control"
                    value={form.snipeit_sync_interval}
                    onChange={e => isSuperAdmin && handleChange('snipeit_sync_interval', e.target.value)}
                    readOnly={!isSuperAdmin}
                    disabled={!isSuperAdmin}
                    style={{
                      width: 100,
                      opacity: !isSuperAdmin ? 0.7 : 1,
                      cursor: !isSuperAdmin ? 'not-allowed' : 'text'
                    }}
                  />
                  <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>dakika</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 3. GOOGLE GEMINI AI AYARLARI */}
        <div className="card" style={{ padding: 20, border: '1px solid var(--color-border)', borderRadius: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, borderBottom: '1px solid var(--color-border)', paddingBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 18 }}>🤖</span>
              <div>
                <h3 style={{ fontSize: 14, fontWeight: 800, color: 'var(--color-text)', margin: 0 }}>
                  Yapay Zeka & Gemini API Ayarları
                </h3>
                <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                  Bitro AI Asistanı ve Snipe-IT AI Komutanı entegrasyonu
                </span>
              </div>
            </div>
            {!isSuperAdmin ? (
              <span className="badge badge-secondary" style={{ fontSize: 11 }}>
                🔒 Sadece Süper Yönetici
              </span>
            ) : (
              <span className="badge badge-accent" style={{ fontSize: 11 }}>
                Google Gemini
              </span>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-secondary)', margin: 0 }}>
                  GOOGLE GEMINI API ANAHTARI
                </label>
                {!isSuperAdmin && (
                  <span className="badge badge-secondary" style={{ fontSize: 10, padding: '2px 6px' }}>
                    🔒 Yalnızca Süper Yönetici
                  </span>
                )}
              </div>
              <div style={{ position: 'relative' }}>
                <input
                  type={!isSuperAdmin ? 'password' : (showSecrets.gemini_api_key ? 'text' : 'password')}
                  className="form-control"
                  value={!isSuperAdmin ? (form.gemini_api_key ? '••••••••••••••••••••••••••••••••' : '') : form.gemini_api_key}
                  onChange={e => isSuperAdmin && handleChange('gemini_api_key', e.target.value)}
                  placeholder={!isSuperAdmin ? 'Süper Yönetici Korumalı' : 'AIzaSy... veya Gemini API Key'}
                  readOnly={!isSuperAdmin}
                  disabled={!isSuperAdmin}
                  style={{
                    paddingRight: 40,
                    fontFamily: 'monospace',
                    fontSize: 12,
                    opacity: !isSuperAdmin ? 0.7 : 1,
                    cursor: !isSuperAdmin ? 'not-allowed' : 'text'
                  }}
                />
                {isSuperAdmin ? (
                  <button
                    type="button"
                    onClick={() => toggleSecret('gemini_api_key')}
                    style={{
                      position: 'absolute',
                      right: 8,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: 16,
                      color: 'var(--color-text-muted)'
                    }}
                    title={showSecrets.gemini_api_key ? 'Gizle' : 'Göster'}
                  >
                    {showSecrets.gemini_api_key ? '🙈' : '👁️'}
                  </button>
                ) : (
                  <span
                    style={{
                      position: 'absolute',
                      right: 10,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      fontSize: 14,
                      opacity: 0.6,
                      cursor: 'not-allowed'
                    }}
                    title="Bu hassas parametre yalnızca Süper Yönetici tarafından görüntülenebilir ve düzenlenebilir."
                  >
                    🔒
                  </span>
                )}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--color-text-secondary)', marginBottom: 5 }}>
                  VARSAYILAN AI MODELİ
                </label>
                <select
                  className="form-control"
                  value={form.gemini_model}
                  onChange={e => isSuperAdmin && handleChange('gemini_model', e.target.value)}
                  disabled={!isSuperAdmin}
                  style={{
                    background: 'var(--color-surface)',
                    color: 'var(--color-text)',
                    opacity: !isSuperAdmin ? 0.7 : 1,
                    cursor: !isSuperAdmin ? 'not-allowed' : 'pointer'
                  }}
                >
                  <option value="gemini-3.5-flash-lite">gemini-3.5-flash-lite (Hızlı & Tavsiye Edilen)</option>
                  <option value="gemini-3.1-flash-lite-preview">gemini-3.1-flash-lite-preview</option>
                  <option value="gemini-3.5-flash">gemini-3.5-flash</option>
                  <option value="gemini-2.5-flash">gemini-2.5-flash</option>
                  <option value="gemini-flash-lite-latest">gemini-flash-lite-latest</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--color-text-secondary)', marginBottom: 5 }}>
                  AI ASİSTAN ADI
                </label>
                <input
                  type="text"
                  className="form-control"
                  value={form.ai_assistant_name}
                  onChange={e => isSuperAdmin && handleChange('ai_assistant_name', e.target.value)}
                  placeholder="Bitro"
                  readOnly={!isSuperAdmin}
                  disabled={!isSuperAdmin}
                  style={{
                    opacity: !isSuperAdmin ? 0.7 : 1,
                    cursor: !isSuperAdmin ? 'not-allowed' : 'text'
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* 4. VERİTABANI & AĞ PAYLAŞIMI (GÖMÜLÜ SİSTEM AYARLARI) */}
        <div className="card" style={{ padding: 20, border: '1px solid var(--color-border)', borderRadius: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, borderBottom: '1px solid var(--color-border)', paddingBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 18 }}>💾</span>
              <div>
                <h3 style={{ fontSize: 14, fontWeight: 800, color: 'var(--color-text)', margin: 0 }}>
                  Veritabanı & Ağ Depolama Parametreleri
                </h3>
                <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                  Merkezi MySQL bağlantısı ve SMB paylaşımlı depolama klasörü
                </span>
              </div>
            </div>
            {!isSuperAdmin && (
              <span className="badge badge-secondary" style={{ fontSize: 11 }}>
                🔒 Sadece Süper Yönetici
              </span>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--color-text-secondary)', marginBottom: 5 }}>
                VERİTABANI TÜRÜ
              </label>
              <select
                className="form-control"
                value={form.db_type}
                onChange={e => isSuperAdmin && handleChange('db_type', e.target.value)}
                disabled={!isSuperAdmin}
                style={{
                  background: 'var(--color-surface)',
                  color: 'var(--color-text)',
                  opacity: !isSuperAdmin ? 0.7 : 1,
                  cursor: !isSuperAdmin ? 'not-allowed' : 'pointer'
                }}
              >
                <option value="mysql">MySQL / MariaDB Sunucusu (Merkezi)</option>
                <option value="sqlite">Yerel SQLite / Paylaşımlı Dosya</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--color-text-secondary)', marginBottom: 5 }}>
                SUNUCU IP / HOST
              </label>
              <input
                type="text"
                className="form-control"
                value={form.db_host}
                onChange={e => isSuperAdmin && handleChange('db_host', e.target.value)}
                placeholder="127.0.0.1"
                readOnly={!isSuperAdmin}
                disabled={!isSuperAdmin}
                style={{
                  fontFamily: 'monospace',
                  opacity: !isSuperAdmin ? 0.7 : 1,
                  cursor: !isSuperAdmin ? 'not-allowed' : 'text'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--color-text-secondary)', marginBottom: 5 }}>
                PORT
              </label>
              <input
                type="text"
                className="form-control"
                value={form.db_port}
                onChange={e => isSuperAdmin && handleChange('db_port', e.target.value)}
                placeholder="3306"
                readOnly={!isSuperAdmin}
                disabled={!isSuperAdmin}
                style={{
                  fontFamily: 'monospace',
                  opacity: !isSuperAdmin ? 0.7 : 1,
                  cursor: !isSuperAdmin ? 'not-allowed' : 'text'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--color-text-secondary)', marginBottom: 5 }}>
                KULLANICI ADI
              </label>
              <input
                type="text"
                className="form-control"
                value={form.db_user}
                onChange={e => isSuperAdmin && handleChange('db_user', e.target.value)}
                placeholder="root"
                readOnly={!isSuperAdmin}
                disabled={!isSuperAdmin}
                style={{
                  opacity: !isSuperAdmin ? 0.7 : 1,
                  cursor: !isSuperAdmin ? 'not-allowed' : 'text'
                }}
              />
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-secondary)', margin: 0 }}>
                  ŞİFRE
                </label>
                {!isSuperAdmin && (
                  <span className="badge badge-secondary" style={{ fontSize: 10, padding: '2px 6px' }}>
                    🔒 Korumalı
                  </span>
                )}
              </div>
              <div style={{ position: 'relative' }}>
                <input
                  type={!isSuperAdmin ? 'password' : (showSecrets.db_pass ? 'text' : 'password')}
                  className="form-control"
                  value={!isSuperAdmin ? (form.db_pass ? '••••••••••••••••' : '') : form.db_pass}
                  onChange={e => isSuperAdmin && handleChange('db_pass', e.target.value)}
                  placeholder={!isSuperAdmin ? 'Süper Yönetici Korumalı' : 'Veritabanı şifresi...'}
                  readOnly={!isSuperAdmin}
                  disabled={!isSuperAdmin}
                  style={{
                    paddingRight: 40,
                    opacity: !isSuperAdmin ? 0.7 : 1,
                    cursor: !isSuperAdmin ? 'not-allowed' : 'text'
                  }}
                />
                {isSuperAdmin ? (
                  <button
                    type="button"
                    onClick={() => toggleSecret('db_pass')}
                    style={{
                      position: 'absolute',
                      right: 8,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: 16,
                      color: 'var(--color-text-muted)'
                    }}
                    title={showSecrets.db_pass ? 'Gizle' : 'Göster'}
                  >
                    {showSecrets.db_pass ? '🙈' : '👁️'}
                  </button>
                ) : (
                  <span
                    style={{
                      position: 'absolute',
                      right: 10,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      fontSize: 14,
                      opacity: 0.6,
                      cursor: 'not-allowed'
                    }}
                    title="Bu şifre yalnızca Süper Yönetici tarafından görüntülenebilir."
                  >
                    🔒
                  </span>
                )}
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--color-text-secondary)', marginBottom: 5 }}>
                VERİTABANI ADI
              </label>
              <input
                type="text"
                className="form-control"
                value={form.db_name}
                onChange={e => isSuperAdmin && handleChange('db_name', e.target.value)}
                placeholder="servicetracker"
                readOnly={!isSuperAdmin}
                disabled={!isSuperAdmin}
                style={{
                  opacity: !isSuperAdmin ? 0.7 : 1,
                  cursor: !isSuperAdmin ? 'not-allowed' : 'text'
                }}
              />
            </div>

            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--color-text-secondary)', marginBottom: 5 }}>
                AĞ PAYLAŞIM / SMB DEPOLAMA YOLU
              </label>
              <input
                type="text"
                className="form-control"
                value={form.db_network_path}
                onChange={e => isSuperAdmin && handleChange('db_network_path', e.target.value)}
                placeholder="\\\\172.16.1.97\\Storage"
                readOnly={!isSuperAdmin}
                disabled={!isSuperAdmin}
                style={{
                  fontFamily: 'monospace',
                  opacity: !isSuperAdmin ? 0.7 : 1,
                  cursor: !isSuperAdmin ? 'not-allowed' : 'text'
                }}
              />
            </div>
          </div>
        </div>

        {/* 5. TARAYICI & MASAÜSTÜ BİLDİRİM YÖNETİMİ */}
        <WebPushSettings showNotification={showNotification} />

        {/* KAYDET BUTONU */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', justifyContent: 'flex-start', paddingTop: 6 }}>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={saving}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 24px',
              fontSize: 13,
              fontWeight: 800,
              borderRadius: 8
            }}
          >
            <span>{saving ? '⏳' : '💾'}</span>
            <span>{saving ? 'Ayarlar Kaydediliyor...' : 'Genel Ayarları Kaydet'}</span>
          </button>

          {isDirty && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setForm(initialForm)}
              style={{ padding: '10px 18px', fontSize: 13 }}
            >
              ↩ Değişiklikleri Sıfırla
            </button>
          )}
        </div>

      </form>

      {/* 🔒 YÖNETİCİ ŞİFRE DOĞRULAMA MODALI */}
      {showAuthModal && createPortal(
        <div className="modal-overlay" style={{ zIndex: 1000000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)' }}>
          <div className="modal-content animate-pop" style={{ width: 440, maxWidth: '92%', background: 'var(--color-surface)', borderRadius: 12, border: '1px solid var(--color-border)', boxShadow: '0 20px 50px rgba(0,0,0,0.6)', overflow: 'hidden' }}>
            <div className="modal-header" style={{ padding: '16px 20px', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--color-surface-alt)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 20 }}>🔒</span>
                <div>
                  <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: 'var(--color-text)' }}>Yönetici Onayı Gerekli</h3>
                  <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>Kullanıcı: {user?.full_name || user?.name || user?.username || 'Yönetici'}</span>
                </div>
              </div>
              <button type="button" className="btn-close" onClick={() => setShowAuthModal(false)} style={{ background: 'none', border: 'none', fontSize: 18, color: 'var(--color-text-muted)', cursor: 'pointer' }}>&times;</button>
            </div>

            <div className="modal-body" style={{ padding: '20px' }}>
              <p style={{ fontSize: 12.5, color: 'var(--color-text-secondary)', marginBottom: 16, lineHeight: 1.5 }}>
                Genel sistem başlıkları, veritabanı bağlantıları ve API anahtarlarını değiştirmek için lütfen <strong>{user?.username || 'admin'}</strong> hesabınızın şifresini giriniz:
              </p>

              <div className="form-group" style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--color-text)', marginBottom: 6 }}>
                  YÖNETİCİ ŞİFRESİ
                </label>
                <input
                  type="password"
                  autoFocus
                  className="form-control"
                  placeholder="Şifrenizi yazınız..."
                  value={adminPassword}
                  onChange={e => {
                    setAdminPassword(e.target.value);
                    if (authError) setAuthError('');
                  }}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleVerifyAndSave();
                    }
                  }}
                  style={{ fontSize: 14, padding: '10px 14px', background: 'var(--color-bg-dark)', color: 'var(--color-text)', border: authError ? '1.5px solid var(--color-danger)' : '1px solid var(--color-border)' }}
                />
              </div>

              {authError && (
                <div style={{ padding: '8px 12px', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: 6, color: '#ef4444', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>⚠️</span>
                  <span>{authError}</span>
                </div>
              )}
            </div>

            <div className="modal-footer" style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', padding: '14px 20px', background: 'var(--color-surface-alt)', borderTop: '1px solid var(--color-border)' }}>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={verifying}
                onClick={() => setShowAuthModal(false)}
                style={{ padding: '8px 16px', fontSize: 12.5 }}
              >
                İptal
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={verifying || !adminPassword}
                onClick={handleVerifyAndSave}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 20px', fontSize: 12.5, fontWeight: 800 }}
              >
                <span>{verifying ? '⏳' : '🔐'}</span>
                <span>{verifying ? 'Doğrulanıyor...' : 'Onayla ve Kaydet'}</span>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
