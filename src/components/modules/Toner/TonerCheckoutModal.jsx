import React, { useState, useEffect, useMemo } from 'react';
import Modal from '../../common/Modal';
import { useAuth } from '../../../context/AuthContext';
import { useApp } from '../../../context/AppContext';
import { apiGet } from '../../../utils/apiFetch';

export default function TonerCheckoutModal({ isOpen, onClose, onSaved, initialTonerId = null }) {
  const { user, auditLog } = useAuth();
  const { showNotification, triggerTableRefresh, isSnipeItEnabled } = useApp();

  const [toners, setToners] = useState(() => {
    try {
      const saved = localStorage.getItem('cached_toner_items');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [snipeUsers, setSnipeUsers] = useState(() => {
    try {
      const saved = localStorage.getItem('cached_snipeit_users');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [formData, setFormData] = useState({
    assigned_user_id: '',
    assigned_user_name: '',
    toner_id: initialTonerId ? String(initialTonerId) : '',
    change_date: new Date().toISOString().slice(0, 10),
    qty: 1,
    notes: '',
  });

  const [userSearch, setUserSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Fetch toners & users on mount if empty or update
  useEffect(() => {
    if (!isOpen) return;

    const loadData = async () => {
      setLoading(true);
      try {
        // Fetch users if not loaded
        if (snipeUsers.length === 0) {
          if (window.electronAPI?.query) {
            const uRes = await window.electronAPI.query('SELECT * FROM cached_users ORDER BY name ASC', []);
            if (uRes?.success && Array.isArray(uRes.data)) {
              setSnipeUsers(uRes.data);
              try { localStorage.setItem('cached_snipeit_users', JSON.stringify(uRes.data)); } catch {}
            }
          } else {
            const res = await apiGet('/api/cached/users');
            if (res?.success && Array.isArray(res.data)) {
              setSnipeUsers(res.data);
              try { localStorage.setItem('cached_snipeit_users', JSON.stringify(res.data)); } catch {}
            }
          }
        }

        // Fetch toners
        if (window.electronAPI?.query) {
          const tRes = await window.electronAPI.query('SELECT * FROM toner_items WHERE is_active=1 ORDER BY toner_model ASC', []);
          if (tRes?.success && Array.isArray(tRes.data)) {
            setToners(tRes.data);
            try { localStorage.setItem('cached_toner_items', JSON.stringify(tRes.data)); } catch {}
          }
        }
      } catch (err) {
        console.warn('[TonerCheckoutModal Load Error]:', err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [isOpen]);

  useEffect(() => {
    if (initialTonerId) {
      setFormData(prev => ({ ...prev, toner_id: String(initialTonerId) }));
    }
  }, [initialTonerId]);

  // Filtered users by search input
  const filteredUsers = useMemo(() => {
    if (!userSearch.trim()) return snipeUsers;
    const q = userSearch.toLowerCase().trim();
    return snipeUsers.filter(u =>
      (u.name || '').toLowerCase().includes(q) ||
      (u.username || '').toLowerCase().includes(q) ||
      (u.department_name || '').toLowerCase().includes(q) ||
      (u.company_name || '').toLowerCase().includes(q)
    );
  }, [snipeUsers, userSearch]);

  const selectedToner = useMemo(() => {
    return toners.find(t => String(t.id) === String(formData.toner_id));
  }, [toners, formData.toner_id]);

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    setErrorMsg('');

    const selectedUser = snipeUsers.find(u => String(u.id) === String(formData.assigned_user_id));
    const recipientName = (formData.assigned_user_name || '').trim() || selectedUser?.name || '';

    if (!recipientName && (!isSnipeItEnabled || !formData.assigned_user_id)) {
      setErrorMsg('Lütfen sarf malzemesi teslim edilecek personel adını giriniz.');
      return;
    }
    if (!formData.toner_id) {
      setErrorMsg('Lütfen çıkış yapılacak sarf malzemesini seçin.');
      return;
    }

    const qty = Number(formData.qty || 0);
    if (!Number.isFinite(qty) || qty <= 0) {
      setErrorMsg('Lütfen geçerli bir çıkış adedi giriniz.');
      return;
    }

    if (isSnipeItEnabled && !selectedUser && !recipientName) {
      setErrorMsg('Seçilen kullanıcı bulunamadı.');
      return;
    }

    if (!selectedToner || Number(selectedToner.qty) < qty) {
      setErrorMsg(`Yetersiz stok! Mevcut stok: ${selectedToner?.qty ?? 0}`);
      return;
    }

    setSaving(true);
    try {
      // 1. Snipe-IT Checkout (Sadece Snipe-IT aktifse)
      if (isSnipeItEnabled && selectedToner.snipeit_consumable_id && selectedUser && window.electronAPI?.snipeitCheckoutConsumable) {
        const checkoutRes = await window.electronAPI.snipeitCheckoutConsumable({
          consumableId: selectedToner.snipeit_consumable_id,
          assignedTo: selectedUser.id,
          qty,
          notes: formData.notes || null,
        });
        if (!checkoutRes.success) {
          setErrorMsg('Snipe-IT çıkış hatası: ' + (checkoutRes.message || 'Bilinmeyen hata'));
          setSaving(false);
          return;
        }
      }

      // 2. Local Database Stock Update
      const stockRes = await window.electronAPI.run(
        'UPDATE toner_items SET qty = qty - ?, available_qty = CASE WHEN COALESCE(available_qty, qty) - ? < 0 THEN 0 ELSE COALESCE(available_qty, qty) - ? END WHERE id=? AND qty >= ?',
        [qty, qty, qty, formData.toner_id, qty]
      );
      if (!stockRes.success || stockRes.changes === 0) {
        setErrorMsg('Sarf malzemesi stok güncellemesi yapılamadı.');
        setSaving(false);
        return;
      }

      // 3. Local Database Insert toner_changes
      const res1 = await window.electronAPI.run(
        'INSERT INTO toner_changes (asset_id, asset_name, toner_id, change_date, user_id, assigned_user_id, assigned_user_name, page_count, qty, notes) VALUES (?,?,?,?,?,?,?,?,?,?)',
        [null, null, formData.toner_id, formData.change_date, user?.id || null, selectedUser?.id || null, recipientName, null, qty, formData.notes || null]
      );

      if (!res1.success) {
        // Rollback stock if insert fails
        await window.electronAPI.run(
          'UPDATE toner_items SET qty = qty + ?, available_qty = COALESCE(available_qty, 0) + ? WHERE id=?',
          [qty, qty, formData.toner_id]
        );
        setErrorMsg('Değişim kaydı eklenemedi: ' + res1.message);
        setSaving(false);
        return;
      }

      // 4. Audit Log
      await auditLog({
        action: 'CREATE',
        module: 'toner',
        refId: res1.lastInsertRowid,
        description: `${selectedUser.name} kullanıcısına ${qty} adet ${selectedToner.toner_model || 'sarf malzemesi'} çıkışı yapıldı.`
      });

      // 5. Update cached toners locally
      const updatedToners = toners.map(t => {
        if (String(t.id) === String(formData.toner_id)) {
          const newQty = Math.max(0, Number(t.qty) - qty);
          return { ...t, qty: newQty, available_qty: newQty };
        }
        return t;
      });
      try { localStorage.setItem('cached_toner_items', JSON.stringify(updatedToners)); } catch {}

      showNotification(`${recipientName} personeline ${qty} adet ${selectedToner.toner_model} çıkışı yapıldı.`, 'success');
      triggerTableRefresh?.(['toner_items', 'toner_changes']);

      if (onSaved) onSaved({ user: selectedUser || { name: recipientName }, toner: selectedToner, qty });
      onClose();
    } catch (err) {
      console.error('[Toner Checkout Save Error]:', err);
      setErrorMsg('İşlem sırasında beklenmedik hata oluştu: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      title="🖨️ Sarf Malzemesi / Toner Çıkışı Kaydet"
      size="md"
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '4px 6px' }}>
        {errorMsg && (
          <div style={{
            background: 'var(--color-danger-bg, rgba(239, 68, 68, 0.15))',
            color: 'var(--color-danger, #ef4444)',
            border: '1px solid var(--color-danger)',
            borderRadius: 8,
            padding: '10px 14px',
            fontSize: 12.5,
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}>
            <span>⚠️</span>
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Kullanıcı Seçimi */}
        {isSnipeItEnabled ? (
          <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text)' }}>
              Teslim Alan Personel (Snipe-IT) <span style={{ color: 'var(--color-danger)' }}>*</span>
            </label>
            <div style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
              <input
                type="text"
                placeholder="Personel ara (isim, birim, sicil)..."
                value={userSearch}
                onChange={e => setUserSearch(e.target.value)}
                style={{
                  fontSize: 12,
                  padding: '6px 10px',
                  borderRadius: 7,
                  border: '1px solid var(--color-border)',
                  background: 'var(--color-surface)',
                  color: 'var(--color-text)',
                  width: '100%',
                }}
              />
            </div>
            <select
              value={formData.assigned_user_id}
              onChange={e => setFormData(prev => ({ ...prev, assigned_user_id: e.target.value }))}
              style={{
                fontSize: 12,
                padding: '8px 10px',
                borderRadius: 7,
                border: '1px solid var(--color-border)',
                background: 'var(--color-surface)',
                color: 'var(--color-text)',
                maxHeight: 200,
              }}
              required
            >
              <option value="">— Personel Seçiniz ({filteredUsers.length} kişi) —</option>
              {filteredUsers.map(u => (
                <option key={u.id} value={u.id}>
                  {u.name} {u.department_name ? `• ${u.department_name}` : ''} {u.location_name ? `(${u.location_name})` : ''}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text)' }}>
              Kime Verildi (Personel Adı) <span style={{ color: 'var(--color-danger)' }}>*</span>
            </label>
            <input
              type="text"
              placeholder="Teslim alan personelin adını ve soyadını yazınız..."
              value={formData.assigned_user_name}
              onChange={e => setFormData(prev => ({ ...prev, assigned_user_name: e.target.value }))}
              style={{
                fontSize: 12,
                padding: '8px 10px',
                borderRadius: 7,
                border: '1px solid var(--color-border)',
                background: 'var(--color-surface)',
                color: 'var(--color-text)',
                width: '100%',
              }}
              required
            />
          </div>
        )}

        {/* Sarf Malzemesi Seçimi */}
        <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text)' }}>
              Sarf Malzemesi / Toner <span style={{ color: 'var(--color-danger)' }}>*</span>
            </label>
            {selectedToner && (
              <span style={{
                fontSize: 11,
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: 12,
                background: Number(selectedToner.qty) > 0 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                color: Number(selectedToner.qty) > 0 ? 'var(--color-success, #10b981)' : 'var(--color-danger, #ef4444)',
                border: `1px solid ${Number(selectedToner.qty) > 0 ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`
              }}>
                Mevcut Stok: {selectedToner.qty} Adet
              </span>
            )}
          </div>
          <select
            value={formData.toner_id}
            onChange={e => setFormData(prev => ({ ...prev, toner_id: e.target.value }))}
            style={{
              fontSize: 12,
              padding: '8px 10px',
              borderRadius: 7,
              border: '1px solid var(--color-border)',
              background: 'var(--color-surface)',
              color: 'var(--color-text)',
            }}
            required
          >
            <option value="">— Sarf Malzemesi Seçiniz —</option>
            {toners.map(t => (
              <option key={t.id} value={t.id}>
                {t.toner_model} {t.toner_code ? `[${t.toner_code}]` : ''} — Stok: {t.qty}
              </option>
            ))}
          </select>
        </div>

        {/* 2 Sütun: Tarih ve Adet */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text)' }}>
              Çıkış Tarihi
            </label>
            <input
              type="date"
              value={formData.change_date}
              onChange={e => setFormData(prev => ({ ...prev, change_date: e.target.value }))}
              style={{
                fontSize: 12,
                padding: '7px 10px',
                borderRadius: 7,
                border: '1px solid var(--color-border)',
                background: 'var(--color-surface)',
                color: 'var(--color-text)',
              }}
              required
            />
          </div>

          <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text)' }}>
              Çıkış Adedi
            </label>
            <input
              type="number"
              min="1"
              max={selectedToner ? selectedToner.qty : undefined}
              value={formData.qty}
              onChange={e => setFormData(prev => ({ ...prev, qty: e.target.value }))}
              style={{
                fontSize: 12,
                padding: '7px 10px',
                borderRadius: 7,
                border: '1px solid var(--color-border)',
                background: 'var(--color-surface)',
                color: 'var(--color-text)',
              }}
              required
            />
          </div>
        </div>

        {/* Notlar */}
        <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text)' }}>
            Notlar / Açıklama
          </label>
          <textarea
            rows={2}
            placeholder="Örn: Muhasebe departmanı yazıcısı için teslim edildi..."
            value={formData.notes}
            onChange={e => setFormData(prev => ({ ...prev, notes: e.target.value }))}
            style={{
              fontSize: 12,
              padding: '8px 10px',
              borderRadius: 7,
              border: '1px solid var(--color-border)',
              background: 'var(--color-surface)',
              color: 'var(--color-text)',
              resize: 'vertical',
            }}
          />
        </div>

        {/* Butonlar */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 10, paddingTop: 12, borderTop: '1px solid var(--color-border)' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onClose}
            disabled={saving}
            style={{ minWidth: 80, height: 34, fontSize: 12 }}
          >
            İptal
          </button>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={saving || loading}
            style={{ minWidth: 120, height: 34, fontSize: 12, fontWeight: 700 }}
          >
            {saving ? 'Kaydediliyor...' : '✓ Çıkışı Kaydet'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
