import React, { useState, useEffect } from 'react';
import Modal from '../../common/Modal';
import { apiPost } from '../../../utils/apiFetch';

export default function CargoDeliverModal({ isOpen, onClose, onDelivered, cargo, currentUser }) {
  const [deliveredTo, setDeliveredTo] = useState('');
  const [deliveredBy, setDeliveredBy] = useState('');
  const [deliveredDate, setDeliveredDate] = useState('');
  const [deliveryNotes, setDeliveryNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (cargo) {
      setDeliveredTo(cargo.recipient_name || '');
      setDeliveredBy(currentUser?.full_name || currentUser?.username || 'IT Ekibi');
      setDeliveredDate(new Date().toISOString().slice(0, 16));
      setDeliveryNotes('');
      setErrorMsg('');
    }
  }, [cargo, isOpen, currentUser]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!cargo?.id) return;
    if (!deliveredTo.trim()) {
      setErrorMsg('Lütfen kargoyu teslim alan kişi adını giriniz.');
      return;
    }

    setSubmitting(true);
    setErrorMsg('');

    try {
      const res = await apiPost(`/api/cargo/${cargo.id}/deliver`, {
        delivered_to: deliveredTo.trim(),
        delivered_by: deliveredBy.trim(),
        delivered_date: deliveredDate,
        delivery_notes: deliveryNotes.trim()
      });

      if (res?.success) {
        onDelivered && onDelivered(cargo.id);
        onClose();
      } else {
        setErrorMsg(res?.message || res?.error || 'Teslimat kaydedilirken hata oluştu.');
      }
    } catch (err) {
      setErrorMsg(err.message || 'Sunucu hatası.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!cargo) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="✍️ Kargoyu Personele Teslim Et"
      size="md"
    >
      <form onSubmit={handleSubmit} className="cargo-deliver-form">
        {errorMsg && (
          <div className="alert-banner alert-danger" style={{ marginBottom: 16 }}>
            <span>⚠️</span> {errorMsg}
          </div>
        )}

        {/* Kargo Özet Bilgi Kartı */}
        <div className="cargo-summary-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--color-primary)' }}>
              📦 Kargo #{cargo.id} • {cargo.carrier}
            </span>
            <span className="cargo-badge badge-warning">
              📥 IT Deposunda
            </span>
          </div>

          <div style={{ fontSize: 13, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 16px' }}>
            <div><strong>Kayıtlı Alıcı:</strong> {cargo.recipient_name}</div>
            <div><strong>Departman:</strong> {cargo.department || '—'}</div>
            <div><strong>Gönderen:</strong> {cargo.sender || '—'}</div>
            <div><strong>İçerik:</strong> {cargo.package_type} ({cargo.package_count || 1} Adet)</div>
            {cargo.tracking_number && (
              <div style={{ gridColumn: 'span 2' }}>
                <strong>Takip No:</strong> <code>{cargo.tracking_number}</code>
              </div>
            )}
          </div>
        </div>

        <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Teslim Alan Kişi */}
          <div className="form-group">
            <label>Kargoyu Teslim Alan Kişi <span style={{ color: 'var(--color-danger)' }}>*</span></label>
            <input
              type="text"
              value={deliveredTo}
              onChange={e => setDeliveredTo(e.target.value)}
              className="form-control"
              placeholder="Asıl alıcı veya vekaleten teslim alan..."
              required
            />
            <span style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4, display: 'block' }}>
              Alıcı dışında birine teslim edildiyse lütfen teslim alan kişinin adını ve unvanını yazın.
            </span>
          </div>

          {/* Teslim Eden IT Yetkilisi */}
          <div className="form-group">
            <label>Teslim Eden IT Yetkilisi</label>
            <input
              type="text"
              value={deliveredBy}
              onChange={e => setDeliveredBy(e.target.value)}
              className="form-control"
              placeholder="Teslim eden..."
              required
            />
          </div>

          {/* Teslim Tarihi & Saati */}
          <div className="form-group">
            <label>Teslim Tarihi & Saati</label>
            <input
              type="datetime-local"
              value={deliveredDate}
              onChange={e => setDeliveredDate(e.target.value)}
              className="form-control"
              required
            />
          </div>

          {/* Teslimat Notu */}
          <div className="form-group">
            <label>Teslimat Notu / Tutanak Açıklaması</label>
            <textarea
              rows="2"
              placeholder="Örn: Sağlam ve eksiksiz teslim edildi, tutanak imzalatıldı..."
              value={deliveryNotes}
              onChange={e => setDeliveryNotes(e.target.value)}
              className="form-control"
              style={{ resize: 'vertical' }}
            />
          </div>
        </div>

        <div className="modal-footer" style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={submitting}>
            İptal
          </button>
          <button type="submit" className="btn btn-success" disabled={submitting}>
            {submitting ? 'Kaydediliyor...' : '✅ Teslimatı Onayla & Tamamla'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
