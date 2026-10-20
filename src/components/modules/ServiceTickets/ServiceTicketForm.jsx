import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { useApp } from '../../../context/AppContext';
import { getApiBase, API_BASE } from '../../../utils/apiConfig';
const POST_TIMEOUT_MS = 12000; // 12 saniye — sunucu yanıt vermezse formu aç bırakma

const PRIORITIES = ['Normal', 'Düşük', 'Yüksek', 'Acil'];
const STATUSES = ['Yeni Kayıt', 'İncelemede', 'Parça Bekliyor', 'Onarımda', 'Testte', 'Dış Serviste', 'Tamamlandı', 'Teslim Edildi', 'Pert', 'İptal'];

const F = ({ label, children, required, span, error }) => (
  <div className={`form-group${span ? ` form-col-span-${span}` : ''}`} style={{ marginBottom: 12 }}>
    <label style={{ fontSize: 11, color: 'var(--color-text-secondary)', fontWeight: 600 }}>{label}{required && ' *'}</label>
    {children}
    {error && <small style={{ color: 'var(--color-danger)', fontSize: 10 }}>{error}</small>}
  </div>
);

async function fetchTicketById(id) {
  if (!id) return null;
  const response = await fetch(`${API_BASE}/api/fisler`);
  if (!response.ok) return null;
  const rows = await response.json();
  return Array.isArray(rows) ? rows.find(item => Number(item.id) === Number(id)) : null;
}

export default function ServiceTicketForm({ ticket, onSave, onCancel }) {
  const { user, hasPermission, auditLog } = useAuth();
  const { triggerRefresh, showNotification, isSnipeItEnabled } = useApp();
  const [assetMode, setAssetMode] = useState(ticket?.asset_id && isSnipeItEnabled ? 'snipe' : 'manual');
  const [form, setForm] = useState({
    ticket_no: '', 
    asset_id: '', asset_name: '', asset_tag: '', serial_no: '', model_name: '', category_name: '',
    user_id: '', user_name: '', location_name: '',
    fault_desc: '', priority: 'Normal', status: 'Yeni Kayıt',
    notes: '', delivery_date: '', template_id: '',
  });
  const [assets, setAssets] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [saving, setSaving] = useState(false);
  const [loadingAssets, setLoadingAssets] = useState(true);
  const [syncingAssets, setSyncingAssets] = useState(false);
  const [errors, setErrors] = useState({});
  const [assetSearch, setAssetSearch] = useState('');
  const [showAssetDropdown, setShowAssetDropdown] = useState(false);
  const searchRef = useRef();
  // FIX #5: Unmount guard — component kapanınca async setState engellensin
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setShowAssetDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [searchRef]);

  useEffect(() => {
    if (isSnipeItEnabled) {
      loadAssets();
    }
    loadTemplates();
    if (ticket) {
      setForm({
        ...ticket,
        user_name: ticket.user_name || ticket.delivered_to || ticket.teslim_eden || '',
        delivery_date: ticket.delivery_date || ticket.delivered_at || '',
      });
      setAssetMode(isSnipeItEnabled && ticket.asset_id ? 'snipe' : 'manual');
      setAssetSearch(ticket.asset_id ? `[${ticket.asset_tag || ''}] ${ticket.model_name || ticket.asset_name || ''}`.trim() : '');
    } else {
      generateNo();
      setAssetMode(isSnipeItEnabled ? 'snipe' : 'manual');
      setAssetSearch('');
    }
  }, [ticket, isSnipeItEnabled]);

  useEffect(() => {
    if (!isSnipeItEnabled && assetMode === 'snipe') {
      setAssetMode('manual');
    }
  }, [isSnipeItEnabled, assetMode]);

  const generateNo = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/yeni-fis-no`);
      if (res.ok) {
        const r = await res.json();
        if (r.success) setForm(f => ({ ...f, ticket_no: r.ticket_no }));
      }
    } catch (err) {
      console.warn("Fiş no çekilemedi:", err);
      // Fallback
      setForm(f => ({ ...f, ticket_no: `SRV-${new Date().getFullYear()}-${Date.now().toString(36).toUpperCase()}` }));
    }
  };

  // FIX #5: Tüm setState çağrıları mountedRef ile guard'lanıyor
  const loadTemplates = async () => {
    if (!mountedRef.current) return;
    try {
      const res = await fetch(`${API_BASE}/api/installation/templates`);
      if (res.ok) {
        const json = await res.json();
        if (json.success && mountedRef.current) setTemplates(json.data);
      }
    } catch (err) {
      console.warn("Şablonlar çekilemedi", err);
    }
  };

  const loadAssets = async () => {
    if (!mountedRef.current) return;
    setLoadingAssets(true);
    try {
      const res = await window.electronAPI.query('SELECT * FROM cached_assets ORDER BY asset_tag', []);
      if (!mountedRef.current) return;
      const rows = res.success ? res.data : [];
      if (rows.length === 0 && window.electronAPI?.snipeitSync) {
        if (mountedRef.current) setSyncingAssets(true);
        try {
          await window.electronAPI.snipeitSync();
          const res2 = await window.electronAPI.query('SELECT * FROM cached_assets ORDER BY asset_tag', []);
          if (mountedRef.current && res2.success) setAssets(res2.data);
        } catch (err) {
          console.warn('[ServiceTicketForm] Otomatik sync başarısız:', err.message);
        } finally {
          if (mountedRef.current) setSyncingAssets(false);
        }
      } else {
        if (mountedRef.current) setAssets(rows);
      }
    } catch (err) {
      console.warn('[ServiceTicketForm] Asset yüklenemedi:', err.message);
    } finally {
      if (mountedRef.current) setLoadingAssets(false);
    }
  };

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const handleAssetSelect = (asset) => {
    if (asset) {
      setForm(prev => ({
        ...prev,
        asset_id:      asset.id,
        asset_name:    asset.name || asset.model_name || asset.asset_tag || '',
        asset_tag:     asset.asset_tag || '',
        serial_no:     asset.serial || '',
        model_name:    asset.model_name || '',
        category_name: asset.category_name || '',
        user_id:       asset.assigned_to_user_id || '',
        user_name:     asset.assigned_to_user_name || '',
        location_name: asset.location_name || '',
      }));
      // Arama kutusuna seçilen cihazın gösterim metnini yaz
      const displayTag   = asset.asset_tag ? `[${asset.asset_tag}]` : '';
      const displayModel = asset.model_name || asset.name || '';
      const displayUser  = asset.assigned_to_user_name ? ` — ${asset.assigned_to_user_name}` : '';
      setAssetSearch(`${displayTag} ${displayModel}${displayUser}`.trim());
    } else {
      setForm(prev => ({
        ...prev,
        asset_id: '', asset_name: '', asset_tag: '', serial_no: '', model_name: '', category_name: '',
        user_id: '', user_name: '', location_name: '',
      }));
      setAssetSearch('');
    }
    setShowAssetDropdown(false);
  };

  const handleAssetModeChange = (mode) => {
    setAssetMode(mode);
    setErrors(e => ({ ...e, asset_id: null, asset_name: null, template_id: null }));
    if (mode === 'installation') {
      setForm(prev => ({ ...prev, status: 'Kurulum Bekliyor' }));
      handleAssetSelect(null);
    } else if (mode === 'manual') {
      handleAssetSelect(null);
    }
  };

  // cached_assets tablosunun gerçek sütunları:
  // id, name, asset_tag, serial, model_id, model_name, category_name,
  // status_id, status_name, assigned_to_user_id, assigned_to_user_name,
  // location_id, location_name, manufacturer_id, manufacturer_name, updated_at
  const searchTerm = assetSearch.trim().toLowerCase();
  const filteredAssets = searchTerm.length < 2 ? [] : assets.filter(a => [
    a.name,              // cihaz adı (Snipe-IT'ten gelen)
    a.asset_tag,         // barkod / demirbaş no
    a.serial,            // seri no
    a.model_name,        // model adı
    a.manufacturer_name, // marka adı
    a.assigned_to_user_name, // kullanan kişi
    a.location_name,     // lokasyon
    a.category_name,     // kategori
  ].some(f => f && String(f).toLowerCase().includes(searchTerm))).slice(0, 60);

  const validate = () => {
    const e = {};
    if (assetMode === 'snipe' && !form.asset_id) e.asset_id = 'Cihaz seçimi zorunludur.';
    if (assetMode === 'manual' && !form.asset_name?.trim() && !form.model_name?.trim()) {
      e.asset_name = 'Manuel cihaz için cihaz adı veya model giriniz.';
    }
    if (assetMode === 'installation') {
      if (!form.template_id) e.template_id = 'Kurulum şablonu seçimi zorunludur.';
      if (!form.asset_name?.trim() && !form.model_name?.trim()) e.asset_name = 'Cihaz adı / tanımı giriniz.';
    }
    if (!form.fault_desc?.trim()) e.fault_desc = assetMode === 'installation' ? 'Kurulum notları zorunludur.' : 'Arıza açıklaması zorunludur.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    const isEdit = Boolean(ticket?.id);
    const requiredPermission = isEdit ? 'can_edit' : 'can_create';
    if (!hasPermission('service', requiredPermission)) {
      showNotification(`Bu işlem için yetkiniz bulunmamaktadır (${isEdit ? 'Düzenleme' : 'Yeni Kayıt'}).`, 'danger');
      return;
    }
    if (!validate()) return;
    setSaving(true);
    
    // Sunucuya gönderilecek alanları önceden hazırla ve doğrula
    const model_name = (form.model_name || form.asset_name || form.asset_tag || '').trim() || 'Bilinmeyen Cihaz';
    const fault_desc = (form.fault_desc || '').trim();
    const teknisyen  = (user?.full_name || user?.username || '').trim() || 'Bilinmeyen Teknisyen';
    const deliveredTo = (form.user_name || form.delivered_to || form.teslim_eden || '').trim();

    // Sunucuya ulaşmadan önce client tarafında zorunlu alan kontrolü
    if (!fault_desc) {
      showNotification('Arıza açıklaması boş bırakılamaz.', 'danger');
      setSaving(false);
      return;
    }

    const payload = {
      id: ticket?.id || undefined,
      ticket_no: form.ticket_no || '',
      asset_id: form.asset_id || null,
      user_id: form.user_id || null,
      model_name,
      asset_name: form.asset_name || '',
      location_name: form.location_name || '',
      serial_no: form.serial_no || '',
      asset_tag: form.asset_tag || '',
      fault_desc,
      notes: form.notes || '',
      priority: form.priority || 'Normal',
      status: form.status || 'Yeni Kayıt',
      delivery_date: form.delivery_date || null,
      user_name: deliveredTo,
      delivered_to: deliveredTo,
      teslim_eden: deliveredTo,
      teknisyen,
      record_type: assetMode === 'installation' ? 'installation' : 'service',
      template_id: form.template_id || null,
      mac_address: null
    };

    let res;
    try {
      // FIX #4: Fetch timeout — 12 saniye içinde yanıt gelmezse AbortError fırlatarak formu aç bırakmaz
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), POST_TIMEOUT_MS);

      let response;
      try {
        if (ticket?.id) {
          response = await fetch(`${API_BASE}/api/fis-guncelle/${ticket.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            signal: controller.signal,
            body: JSON.stringify(payload)
          });
        } else {
          response = await fetch(`${API_BASE}/api/fis-ekle`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: controller.signal,
            body: JSON.stringify(payload)
          });
        }
      } finally {
        clearTimeout(timeoutId);
      }

      const rawText = await response.text().catch(() => '');
      let parsed = null;
      try {
        parsed = rawText ? JSON.parse(rawText) : null;
      } catch {
        parsed = null;
      }

      if (response.ok && parsed?.success !== false) {
        res = { success: true, data: parsed };
      } else {
        res = {
          success: false,
          message: parsed?.message || parsed?.error || rawText || `Sunucu hatası (${response.status}).`
        };
      }

      if (res.success) {
        if (ticket?.id) {
          const updatedTicket = await fetchTicketById(ticket.id);
          const savedUserName = (updatedTicket?.user_name || updatedTicket?.delivered_to || updatedTicket?.teslim_eden || '').trim();
          if (deliveredTo && savedUserName !== deliveredTo) {
            showNotification(
              'Sunucu kaydetti görünüyor ama Teslim Eden alanı veritabanına yazılmadı. server.js içindeki fis-guncelle endpointinde user_name güncellemesi eksik.',
              'danger',
              8000
            );
            return;
          }
        }

        await auditLog?.({
          action: ticket?.id ? 'UPDATE' : 'CREATE',
          module: 'service',
          refId: ticket?.id || res.data?.id,
          description: `${payload.ticket_no || 'Servis fişi'} ${ticket?.id ? 'güncellendi' : 'oluşturuldu'}.`,
          oldValue: ticket || null,
          newValue: payload
        });
        triggerRefresh();
        onSave?.();
      } else {
        showNotification('Kaydetme hatası: ' + (res.message || 'Bilinmeyen hata'), 'danger');
      }
    } catch (err) {
      showNotification('Sistem hatası: ' + err.message, 'danger');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ padding: '6px 16px 20px' }}>
      {/* Temel Fiş Bilgileri Kartı */}
      <div style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 8,
        padding: '14px 16px',
        marginBottom: 16,
        boxShadow: '0 2px 6px rgba(0,0,0,0.04)'
      }}>
        <div className="form-grid-4">
          <F label="Fiş Numarası" required>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: 'rgba(59, 130, 246, 0.08)',
              border: '1px solid rgba(59, 130, 246, 0.25)',
              borderRadius: 6,
              padding: '6px 10px',
              height: 34
            }}>
              <span style={{ fontSize: 13 }}>🎫</span>
              <input
                type="text"
                value={form.ticket_no || ''}
                readOnly
                style={{
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  color: 'var(--color-primary-light, #60a5fa)',
                  fontFamily: 'monospace',
                  fontWeight: 700,
                  fontSize: 13,
                  width: '100%',
                  padding: 0
                }}
              />
            </div>
          </F>
          <F label="Öncelik Derecesi">
            <select
              className="form-control"
              value={form.priority}
              onChange={e => set('priority', e.target.value)}
              style={{ height: 34, borderRadius: 6 }}
            >
              {PRIORITIES.map(p => <option key={p}>{p}</option>)}
            </select>
          </F>
          <F label="Servis Durumu">
            <select
              className="form-control"
              value={form.status}
              onChange={e => set('status', e.target.value)}
              disabled={assetMode === 'installation'}
              style={{ height: 34, borderRadius: 6 }}
            >
              {STATUSES.map(s => <option key={s}>{s}</option>)}
            </select>
          </F>
          <F label="Hedef Teslim Tarihi">
            <input
              type="date"
              className="form-control"
              value={form.delivery_date || ''}
              onChange={e => set('delivery_date', e.target.value)}
              style={{ height: 34, borderRadius: 6 }}
            >
            </input>
          </F>
        </div>
      </div>

      {/* Cihaz Bilgisi Bölümü */}
      <div style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 8,
        padding: '14px 16px',
        marginBottom: 16,
        boxShadow: '0 2px 6px rgba(0,0,0,0.04)'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 10,
          marginBottom: 14,
          paddingBottom: 10,
          borderBottom: '1px solid var(--color-border)'
        }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-primary-light, #60a5fa)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>🖥️</span>
            <span>Cihaz Kaynağı ve Bilgileri</span>
          </div>

          {/* Modern Segment Kontrolü */}
          <div style={{
            display: 'inline-flex',
            padding: 3,
            background: 'var(--color-surface-alt)',
            border: '1px solid var(--color-border)',
            borderRadius: 8,
            gap: 4
          }}>
            {[
              ...(isSnipeItEnabled ? [{ key: 'snipe', label: 'Snipe-IT Cihazı', icon: '🖥️' }] : []),
              { key: 'manual', label: 'Manuel Cihaz', icon: '📝' },
              { key: 'installation', label: 'Yeni Cihaz (Kurulum)', icon: '📦' }
            ].map(item => {
              const active = assetMode === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => handleAssetModeChange(item.key)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '5px 12px',
                    borderRadius: 6,
                    fontSize: 11.5,
                    fontWeight: active ? 700 : 500,
                    background: active ? 'var(--color-primary, #3b82f6)' : 'transparent',
                    color: active ? '#ffffff' : 'var(--color-text-secondary)',
                    border: 'none',
                    cursor: 'pointer',
                    boxShadow: active ? '0 2px 6px rgba(0,0,0,0.18)' : 'none',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <span>{item.icon}</span>
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="form-grid-4">
          {assetMode === 'snipe' ? (
            <>
              <F label="Cihaz Arama (Asset Tag / Seri No / Model / Kullanıcı)" span={4} required error={errors.asset_id}>
                <div style={{ position: 'relative' }} ref={searchRef}>
                  <div style={{ display: 'flex', alignItems: 'center', position: 'relative' }}>
                    <span style={{ position: 'absolute', left: 10, fontSize: 13, color: 'var(--color-text-muted)', pointerEvents: 'none' }}>🔍</span>
                    <input 
                      type="text" 
                      className="form-control"
                      placeholder={syncingAssets ? "Snipe-IT'ten cihazlar senkronize ediliyor..." : loadingAssets ? "Cihazlar yükleniyor..." : "En az 2 karakter yazın (tag, model, seri no, kullanıcı...)"}
                      value={assetSearch}
                      onChange={e => {
                        setAssetSearch(e.target.value);
                        setShowAssetDropdown(true);
                      }}
                      onFocus={() => setShowAssetDropdown(true)}
                      autoComplete="off"
                      style={{ paddingLeft: 32, borderRadius: 6, height: 36 }}
                    />
                  </div>
                  {showAssetDropdown && (
                    <div style={{ 
                      position: 'absolute', top: '100%', left: 0, right: 0, 
                      maxHeight: 280, overflowY: 'auto', background: 'var(--color-surface)',
                      border: '1px solid var(--color-border)', borderRadius: 8, zIndex: 1000,
                      boxShadow: '0 8px 24px rgba(0,0,0,0.2)', marginTop: 4
                    }}>
                      {searchTerm.length < 2 ? (
                        <div style={{ padding: '14px 16px', fontSize: 12, color: 'var(--color-text-muted)', textAlign: 'center' }}>
                          {assets.length > 0
                            ? `📦 ${assets.length} kayıtlı cihaz bulundu. Aramak için en az 2 karakter yazın.`
                            : '⏳ Cihazlar yükleniyor...'}
                        </div>
                      ) : filteredAssets.length > 0 ? (
                        filteredAssets.map(a => (
                          <div 
                            key={a.id} 
                            style={{
                              padding: '10px 14px',
                              cursor: 'pointer',
                              fontSize: 12,
                              borderBottom: '1px solid var(--color-border)',
                              transition: 'background 0.15s ease'
                            }}
                            onClick={() => handleAssetSelect(a)}
                            onMouseDown={e => e.preventDefault()}
                            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(59, 130, 246, 0.08)'; }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              {a.asset_tag && (
                                <span style={{
                                  padding: '2px 6px',
                                  borderRadius: 4,
                                  fontSize: 10.5,
                                  fontWeight: 700,
                                  fontFamily: 'monospace',
                                  background: 'rgba(99, 102, 241, 0.15)',
                                  color: '#818cf8',
                                  border: '1px solid rgba(99, 102, 241, 0.3)'
                                }}>
                                  🏷️ {a.asset_tag}
                                </span>
                              )}
                              <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>
                                {a.manufacturer_name || ''} {a.model_name || a.name || ''}
                              </span>
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 3, display: 'flex', gap: 12 }}>
                              <span>🔢 SN: <strong style={{ color: 'var(--color-text)' }}>{a.serial || '—'}</strong></span>
                              <span>👤 <strong style={{ color: 'var(--color-text)' }}>{a.assigned_to_user_name || 'Kullanıcı atanmamış'}</strong></span>
                              {a.location_name && <span>📍 {a.location_name}</span>}
                            </div>
                          </div>
                        ))
                      ) : (
                        <div style={{ padding: 14, textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 12 }}>
                          Sonuç bulunamadı — Manuel cihaz seçeneğini tercih edebilirsiniz.
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </F>
              <F label="Kullanıcı" span={2}>
                <input type="text" className="form-control" value={form.user_name || 'Bilinmiyor'} readOnly style={{ background: 'var(--color-surface-alt)', borderRadius: 6, height: 34 }} />
              </F>
              <F label="Lokasyon" span={2}>
                <input type="text" className="form-control" value={form.location_name || 'Bilinmiyor'} readOnly style={{ background: 'var(--color-surface-alt)', borderRadius: 6, height: 34 }} />
              </F>
              <F label="Marka / Model" span={2}>
                <input type="text" className="form-control" value={`${form.model_name || ''}`} readOnly style={{ background: 'var(--color-surface-alt)', borderRadius: 6, height: 34 }} />
              </F>
              <F label="Seri No" span={2}>
                <input type="text" className="form-control" value={form.serial_no || ''} readOnly style={{ background: 'var(--color-surface-alt)', borderRadius: 6, height: 34 }} />
              </F>
            </>
          ) : assetMode === 'installation' ? (
          <div style={{
            gridColumn: 'span 4',
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 0,
            border: '1px solid var(--color-border)',
            borderRadius: 8,
            overflow: 'hidden',
            background: 'var(--color-surface)',
          }}>
            {[
              { icon: '🖥️', label: 'Cihaz Adı / Tanımı',     key: 'asset_name',     placeholder: 'Örn: Muhasebe PC', required: true, error: errors.asset_name },
              { icon: '⚙️', label: 'Marka / Model',          key: 'model_name',     placeholder: 'Örn: Lenovo ThinkPad' },
              { icon: '📂', label: 'Kategori',               key: 'category_name',  placeholder: 'Örn: Bilgisayar' },
              { icon: '👤', label: 'Kullanıcı',              key: 'user_name',      placeholder: 'Örn: İsmail KARA' },
            ].map(({ icon, label, key, placeholder, required, error }) => (
              <div key={key} style={{
                display: 'flex',
                alignItems: 'stretch',
                borderBottom: '1px solid var(--color-border)',
                borderRight: '1px solid var(--color-border)',
              }}>
                <div style={{
                  width: 42,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 16,
                  background: 'var(--color-bg-dark)',
                  borderRight: '1px solid var(--color-border)',
                  flexShrink: 0,
                }}>
                  {icon}
                </div>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '6px 10px' }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 2 }}>
                    {label}{required && <span style={{ color: 'var(--color-danger)', marginLeft: 2 }}>*</span>}
                  </span>
                  <input
                    value={form[key] || ''}
                    onChange={e => set(key, e.target.value)}
                    placeholder={placeholder}
                    style={{ border: 'none', outline: 'none', background: 'transparent', color: 'var(--color-text)', fontSize: 13, fontWeight: 500, padding: 0, width: '100%' }}
                  />
                  {error && <span style={{ fontSize: 10, color: 'var(--color-danger)', marginTop: 2 }}>{error}</span>}
                </div>
              </div>
            ))}
            
            <div style={{ gridColumn: 'span 1', display: 'flex', alignItems: 'stretch', borderBottom: '1px solid var(--color-border)', borderRight: '1px solid var(--color-border)' }}>
              <div style={{ width: 42, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, background: 'var(--color-bg-dark)', borderRight: '1px solid var(--color-border)', flexShrink: 0 }}>📍</div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '6px 10px' }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 2 }}>Lokasyon</span>
                <input value={form.location_name || ''} onChange={e => set('location_name', e.target.value)} placeholder="Örn: B22" style={{ border: 'none', outline: 'none', background: 'transparent', color: 'var(--color-text)', fontSize: 13, fontWeight: 500, padding: 0, width: '100%' }} />
              </div>
            </div>

            <div style={{ gridColumn: 'span 1', display: 'flex', alignItems: 'stretch', borderBottom: '1px solid var(--color-border)', borderRight: '1px solid var(--color-border)' }}>
              <div style={{ width: 42, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, background: 'var(--color-bg-dark)', borderRight: '1px solid var(--color-border)', flexShrink: 0 }}>📋</div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '6px 10px' }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 2 }}>Kurulum Şablonu <span style={{color: 'var(--color-danger)'}}>*</span></span>
                <select value={form.template_id || ''} onChange={e => set('template_id', e.target.value)} style={{ border: 'none', outline: 'none', background: 'transparent', color: 'var(--color-text)', fontSize: 13, fontWeight: 500, padding: 0, width: '100%', marginTop: 2 }}>
                  <option value="">-- Seçiniz --</option>
                  {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
                {errors.template_id && <span style={{ fontSize: 10, color: 'var(--color-danger)', marginTop: 2 }}>{errors.template_id}</span>}
              </div>
            </div>

          </div>
        ) : (
          <div style={{
            gridColumn: 'span 4',
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 0,
            border: '1px solid var(--color-border)',
            borderRadius: 8,
            overflow: 'hidden',
            background: 'var(--color-surface)',
          }}>
            {[
              { icon: '🏷️', label: 'Envanter / Barkod No',  key: 'asset_tag',      placeholder: 'BARKOD-001 veya takip no' },
              { icon: '🔢', label: 'Seri No',                 key: 'serial_no',      placeholder: 'Varsa seri numarası' },
              { icon: '🖥️', label: 'Cihaz Adı',              key: 'asset_name',     placeholder: 'Örn: Barkod Okuyucu', required: true, error: errors.asset_name },
              { icon: '⚙️', label: 'Marka / Model',          key: 'model_name',     placeholder: 'Örn: Zebra DS2208' },
              { icon: '📂', label: 'Kategori',               key: 'category_name',  placeholder: 'Örn: Yazıcı, Bilgisayar' },
              { icon: '👤', label: 'Kullanıcı',              key: 'user_name',      placeholder: 'Örn: İsmail KARA' },
            ].map(({ icon, label, key, placeholder, required, error }) => (
              <div key={key} style={{
                display: 'flex',
                alignItems: 'stretch',
                borderBottom: '1px solid var(--color-border)',
                borderRight: '1px solid var(--color-border)',
              }}>
                <div style={{
                  width: 42,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 16,
                  background: 'var(--color-bg-dark)',
                  borderRight: '1px solid var(--color-border)',
                  flexShrink: 0,
                }}>
                  {icon}
                </div>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '6px 10px' }}>
                  <span style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: 'var(--color-text-secondary)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    marginBottom: 2,
                  }}>
                    {label}{required && <span style={{ color: 'var(--color-danger)', marginLeft: 2 }}>*</span>}
                  </span>
                  <input
                    value={form[key] || ''}
                    onChange={e => set(key, e.target.value)}
                    placeholder={placeholder}
                    style={{
                      border: 'none',
                      outline: 'none',
                      background: 'transparent',
                      color: 'var(--color-text)',
                      fontSize: 13,
                      fontWeight: 500,
                      padding: 0,
                      width: '100%',
                    }}
                  />
                  {error && <span style={{ fontSize: 10, color: 'var(--color-danger)', marginTop: 2 }}>{error}</span>}
                </div>
              </div>
            ))}
            <div style={{
              gridColumn: 'span 2',
              display: 'flex',
              alignItems: 'stretch',
            }}>
              <div style={{
                width: 42,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 16,
                background: 'var(--color-bg-dark)',
                borderRight: '1px solid var(--color-border)',
                flexShrink: 0,
              }}>
                📍
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '6px 10px' }}>
                <span style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: 'var(--color-text-secondary)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  marginBottom: 2,
                }}>
                  Lokasyon
                </span>
                <input
                  value={form.location_name || ''}
                  onChange={e => set('location_name', e.target.value)}
                  placeholder="Örn: Depo, Üretim, B22"
                  style={{
                    border: 'none',
                    outline: 'none',
                    background: 'transparent',
                    color: 'var(--color-text)',
                    fontSize: 13,
                    fontWeight: 500,
                    padding: 0,
                    width: '100%',
                  }}
                />
              </div>
            </div>
          </div>
        )}
        </div>
      </div>

      {/* Arıza ve İşlem Bölümü */}
      <div style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 8,
        padding: '14px 16px',
        marginBottom: 16,
        boxShadow: '0 2px 6px rgba(0,0,0,0.04)'
      }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-primary-light, #60a5fa)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span>🔧</span>
          <span>{assetMode === 'installation' ? 'Kurulum Talebi ve Notları' : 'Arıza Detayı ve Notlar'}</span>
        </div>
        <div className="form-grid-4">
          <F label={assetMode === 'installation' ? "Kurulum Notları / Özel İstekler" : "Bildirilen Arıza / Şikayet"} span={4} required error={errors.fault_desc}>
            <textarea 
              className="form-control"
              value={form.fault_desc || ''} 
              onChange={e => set('fault_desc', e.target.value)} 
              rows={3} 
              placeholder={assetMode === 'installation' ? "Özel yazılım talepleri, kullanıcı notları, departman gereksinimleri..." : "Müşteri veya personel şikayeti, arıza belirtileri..."} 
              style={{ borderRadius: 6, resize: 'vertical' }}
            />
          </F>
          {assetMode !== 'installation' && (
            <F label="Teknik Notlar / Yapılan Ön Tespitler" span={4}>
              <textarea 
                className="form-control"
                value={form.notes || ''} 
                onChange={e => set('notes', e.target.value)} 
                rows={2} 
                placeholder="Teknisyen veya kabul sorumlusu ön notları..." 
                style={{ borderRadius: 6, resize: 'vertical' }}
              />
            </F>
          )}
        </div>
      </div>

      {/* Alt Aksiyon Butonları */}
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 6 }}>
        <button 
          type="button"
          className="btn btn-secondary" 
          onClick={onCancel}
          style={{ padding: '7px 16px', borderRadius: 8, fontSize: 12, fontWeight: 600 }}
        >
          Vazgeç
        </button>
        <button 
          type="button"
          className="btn btn-primary" 
          onClick={handleSave} 
          disabled={saving} 
          style={{ 
            minWidth: 140, 
            padding: '7px 20px', 
            borderRadius: 8, 
            fontSize: 12, 
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6
          }}
        >
          <span>{saving ? '⏳' : '💾'}</span>
          <span>{saving ? 'Kaydediliyor...' : 'Kaydı Tamamla'}</span>
        </button>
      </div>
    </div>
  );
}
