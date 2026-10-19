import React, { useState, useEffect } from 'react';
import Modal from '../../common/Modal';

export default function NewPlanModal({ onClose, onCreated, currentUser, showNotification }) {
  const [meta, setMeta] = useState({ companies: [], locations: [] });
  const [form, setForm] = useState({
    company_name: '',
    title: '',
    period: '2026/2. Dönem',
    planned_date: new Date().toISOString().slice(0, 10),
    location: '',
    notes: ''
  });
  const [loadingMeta, setLoadingMeta] = useState(true);
  const [previewCount, setPreviewCount] = useState(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    window.electronAPI.getMaintenanceMeta().then(res => {
      if (res?.success) {
        setMeta({
          companies: res.companies || [],
          locations: res.locations || []
        });
        if (res.companies?.length > 0) {
          const defaultComp = res.companies[0];
          setForm(prev => ({
            ...prev,
            company_name: defaultComp,
            title: `${defaultComp} - 2026/2. Dönem Periyodik Bakım`
          }));
        }
      }
    }).catch(e => {
      console.warn('Meta fetch error:', e);
    }).finally(() => setLoadingMeta(false));
  }, []);

  // Update preview when company or location changes
  useEffect(() => {
    let active = true;
    setLoadingPreview(true);
    window.electronAPI.previewMaintenanceAssets({
      company: form.company_name,
      location: form.location
    }).then(res => {
      if (active && res?.success) {
        setPreviewCount(res.count);
      }
    }).catch(() => {
      if (active) setPreviewCount(0);
    }).finally(() => {
      if (active) setLoadingPreview(false);
    });

    return () => { active = false; };
  }, [form.company_name, form.location]);

  const handleCompanyChange = (comp) => {
    setForm(prev => ({
      ...prev,
      company_name: comp,
      title: comp ? `${comp} - ${prev.period || 'Periyodik'} Bakım` : prev.title
    }));
  };

  const handlePeriodChange = (prd) => {
    setForm(prev => ({
      ...prev,
      period: prd,
      title: prev.company_name ? `${prev.company_name} - ${prd} Periyodik Bakım` : prev.title
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.company_name?.trim()) {
      showNotification('Lütfen bir şirket / işletme seçiniz.', 'warning');
      return;
    }
    if (!form.title?.trim()) {
      showNotification('Lütfen plan başlığı giriniz.', 'warning');
      return;
    }

    setSaving(true);
    try {
      const res = await window.electronAPI.createMaintenancePlan({
        ...form,
        actor: currentUser
      });

      if (res?.success) {
        showNotification(`"${form.title}" planı ${res.total_devices || 0} cihaz ile oluşturuldu.`, 'success');
        onCreated(res.id);
      } else {
        showNotification('Plan oluşturulamadı: ' + (res?.message || 'Bilinmeyen hata'), 'danger');
      }
    } catch (err) {
      showNotification('Hata: ' + err.message, 'danger');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen title="Yeni Periyodik Bakım Planla" size="md" onClose={onClose}>
      <form onSubmit={handleSubmit} style={{ padding: '16px 20px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
          {/* Şirket Seçimi */}
          <div className="form-group" style={{ gridColumn: 'span 2' }}>
            <label className="required" style={{ color: 'var(--color-text)', fontWeight: 600, fontSize: 12 }}>
              🏢 Şirket / İşletme (Snipe-IT)
            </label>
            {meta.companies.length > 0 ? (
              <select
                className="form-control"
                value={form.company_name}
                onChange={e => handleCompanyChange(e.target.value)}
                style={{ background: 'var(--color-surface)', color: 'var(--color-text)', border: '1px solid var(--color-border)', fontWeight: 600 }}
              >
                {meta.companies.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                className="form-control"
                placeholder="Örn: Örnek Teknoloji A.Ş."
                value={form.company_name}
                onChange={e => handleCompanyChange(e.target.value)}
                style={{ background: 'var(--color-surface)', color: 'var(--color-text)', border: '1px solid var(--color-border)' }}
              />
            )}
          </div>

          {/* Plan Başlığı */}
          <div className="form-group" style={{ gridColumn: 'span 2' }}>
            <label className="required" style={{ color: 'var(--color-text)', fontWeight: 600, fontSize: 12 }}>
              📋 Bakım Planı Başlığı
            </label>
            <input
              type="text"
              className="form-control"
              placeholder="Örn: Örnek Teknoloji A.Ş. - 2026/1. Dönem Bakım"
              value={form.title}
              onChange={e => setForm({ ...form, title: e.target.value })}
              style={{ background: 'var(--color-surface)', color: 'var(--color-text)', border: '1px solid var(--color-border)' }}
            />
          </div>

          {/* Dönem */}
          <div className="form-group">
            <label style={{ color: 'var(--color-text)', fontWeight: 600, fontSize: 12 }}>
              🗓️ Bakım Dönemi
            </label>
            <select
              className="form-control"
              value={form.period}
              onChange={e => handlePeriodChange(e.target.value)}
              style={{ background: 'var(--color-surface)', color: 'var(--color-text)', border: '1px solid var(--color-border)' }}
            >
              <option value="2026/1. Dönem">2026/1. Dönem (İlk 6 Ay)</option>
              <option value="2026/2. Dönem">2026/2. Dönem (Son 6 Ay)</option>
              <option value="2027/1. Dönem">2027/1. Dönem</option>
              <option value="Yıllık Genel Bakım">Yıllık Genel Bakım</option>
              <option value="Özel Bakım">Özel Bakım</option>
            </select>
          </div>

          {/* Planlanan Tarih */}
          <div className="form-group">
            <label style={{ color: 'var(--color-text)', fontWeight: 600, fontSize: 12 }}>
              📅 Planlanan Başlangıç Tarihi
            </label>
            <input
              type="date"
              className="form-control"
              value={form.planned_date}
              onChange={e => setForm({ ...form, planned_date: e.target.value })}
              style={{ background: 'var(--color-surface)', color: 'var(--color-text)', border: '1px solid var(--color-border)' }}
            />
          </div>

          {/* Lokasyon Filtresi (Opsiyonel) */}
          <div className="form-group" style={{ gridColumn: 'span 2' }}>
            <label style={{ color: 'var(--color-text)', fontWeight: 600, fontSize: 12 }}>
              📍 Lokasyon Filtresi (Opsiyonel)
            </label>
            <select
              className="form-control"
              value={form.location}
              onChange={e => setForm({ ...form, location: e.target.value })}
              style={{ background: 'var(--color-surface)', color: 'var(--color-text)', border: '1px solid var(--color-border)' }}
            >
              <option value="">— Tüm Lokasyonlar & Birimler —</option>
              {meta.locations.map(loc => (
                <option key={loc} value={loc}>{loc}</option>
              ))}
            </select>
            <small style={{ color: 'var(--color-text-muted)', display: 'block', marginTop: 4 }}>
              Belirli bir lokasyona göre filtrelemek istemiyorsanız boş bırakınız.
            </small>
          </div>

          {/* Notlar */}
          <div className="form-group" style={{ gridColumn: 'span 2' }}>
            <label style={{ color: 'var(--color-text)', fontWeight: 600, fontSize: 12 }}>
              📝 Plan Açıklaması / Hedefler
            </label>
            <textarea
              className="form-control"
              rows={2}
              placeholder="Bakım hedefi veya operasyonel notlar..."
              value={form.notes}
              onChange={e => setForm({ ...form, notes: e.target.value })}
              style={{ background: 'var(--color-surface)', color: 'var(--color-text)', border: '1px solid var(--color-border)' }}
            />
          </div>
        </div>

        {/* Live Asset Count Preview Badge */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '12px 16px',
          background: 'rgba(59, 130, 246, 0.08)',
          border: '1px solid rgba(59, 130, 246, 0.25)',
          borderRadius: 8,
          marginBottom: 16
        }}>
          <span style={{ fontSize: 22 }}>💻</span>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-primary)' }}>
              {loadingPreview ? 'Cihazlar taranıyor...' : `${previewCount ?? 0} Adet Cihaz Bulundu`}
            </div>
            <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 }}>
              Plan oluşturulduğunda sistem bu işletmeye ait kayıtlı tüm bilgisayarları otomatik olarak bakım listesine aktaracaktır.
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>
            İptal
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving || loadingPreview}>
            {saving ? '⏳ Plan Oluşturuluyor...' : '🚀 Bakım Planını Başlat'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
