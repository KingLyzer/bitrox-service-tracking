import React, { useState } from 'react';
import Modal from '../../common/Modal';
import { useApp } from '../../../context/AppContext';
export default function CargoDetailModal({ isOpen, onClose, cargo, onPrintLabel, onEdit }) {
  const { openTab, showNotification } = useApp();
  const [copiedField, setCopiedField] = useState('');

  if (!cargo) return null;

  const isOutgoing = cargo.direction === 'outgoing';

  const formattedDate = cargo.received_date
    ? new Date(cargo.received_date).toLocaleString('tr-TR', { dateStyle: 'long', timeStyle: 'short' })
    : '—';

  const handleCopy = (text, fieldName = '') => {
    if (!text) return;
    try {
      navigator.clipboard.writeText(String(text).trim());
      setCopiedField(fieldName);
      showNotification(`${fieldName ? fieldName + ' (' + text + ')' : text} panoya kopyalandı!`, 'success');
      setTimeout(() => setCopiedField(''), 2000);
    } catch (err) {
      console.warn('Copy error:', err);
    }
  };

  const handleOpenServiceTicket = () => {
    if (cargo.service_ticket_no || cargo.service_ticket_id) {
      openTab({
        id: 'service-tickets',
        label: 'Servis Fişleri',
        icon: '🔧',
        module: 'ServiceTickets',
        initialTicketNo: cargo.service_ticket_no,
        initialTicketId: cargo.service_ticket_id
      });
      onClose();
    }
  };

  const statusText = (() => {
    const s = String(cargo.status || '').toLowerCase().trim();
    if (s === 'received' || s === 'received_by_it' || (!cargo.status && !isOutgoing)) return 'Teslim Alındı';
    if (s === 'sent' || s === 'shipped' || (!cargo.status && isOutgoing)) return 'Gönderildi';
    if (s === 'delivered') return 'Teslim Edildi';
    if (s === 'in_transit') return 'Yolda / Dağıtımda';
    if (s === 'preparing') return 'Hazırlanıyor / Paketlendi';
    return cargo.status || (isOutgoing ? 'Gönderildi' : 'Teslim Alındı');
  })();

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`📦 Kargo Detayı • #${cargo.id} (${isOutgoing ? '📤 Giden Kargo' : '📥 Gelen Kargo'})`}
      size="lg"
    >
      <div className="cargo-detail-container">
        {/* Üst Başlık ve Özet Şerit */}
        <div className="cargo-detail-header-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{
                  padding: '3px 8px',
                  borderRadius: 6,
                  fontSize: 11,
                  fontWeight: 800,
                  background: isOutgoing ? 'rgba(245, 158, 11, 0.2)' : 'rgba(59, 130, 246, 0.2)',
                  color: isOutgoing ? '#f59e0b' : '#3b82f6',
                  border: isOutgoing ? '1px solid rgba(245, 158, 11, 0.4)' : '1px solid rgba(59, 130, 246, 0.4)'
                }}>
                  {isOutgoing ? '📤 GİDEN KARGO' : '📥 GELEN KARGO'}
                </span>
                <span style={{
                  padding: '3px 8px',
                  borderRadius: 6,
                  fontSize: 11,
                  fontWeight: 700,
                  background: 'rgba(16, 185, 129, 0.15)',
                  color: '#10b981',
                  border: '1px solid rgba(16, 185, 129, 0.3)'
                }}>
                  ● {statusText}
                </span>
              </div>
              <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--color-primary)', marginTop: 4 }}>
                {cargo.carrier} • #{cargo.id}
              </div>
              <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 2 }}>
                📅 {isOutgoing ? 'Çıkış Tarihi:' : 'Giriş Tarihi:'} {formattedDate}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {cargo.service_ticket_no && (
                <button
                  className="btn btn-sm btn-primary"
                  onClick={handleOpenServiceTicket}
                  title="Bağlı Servis Fişini Görüntüle"
                  style={{ display: 'flex', alignItems: 'center', gap: 5, fontWeight: 700 }}
                >
                  <span>🔧</span>
                  <span>Servis Fişi: {cargo.service_ticket_no}</span>
                </button>
              )}
              {cargo.carrier_tracking_url && (
                <a
                  href={cargo.carrier_tracking_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-sm btn-secondary"
                  style={{ display: 'flex', alignItems: 'center', gap: 5, textDecoration: 'none' }}
                >
                  <span>🌐</span>
                  <span>Kargo Firmasında Sorgula ↗</span>
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Detay Bilgi Kartları Izgarası */}
        <div className="cargo-detail-grid">
          {/* Takip & İrsaliye Bilgileri */}
          <div className="cargo-detail-section">
            <div className="cargo-detail-section-title">🏷️ Kargo & Belge Bilgileri</div>
            
            {/* Kargo Takip No */}
            <div className="cargo-detail-row">
              <span className="cargo-detail-label">Kargo Takip No:</span>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <span className="cargo-detail-value" style={{ userSelect: 'text' }}>
                  {cargo.tracking_number ? <code>{cargo.tracking_number}</code> : '—'}
                </span>
                {cargo.tracking_number && (
                  <button
                    type="button"
                    className={`btn btn-xs ${copiedField === 'Takip No' ? 'btn-success' : 'btn-secondary'}`}
                    onClick={() => handleCopy(cargo.tracking_number, 'Takip No')}
                    title="Takip Numarasını Kopyala"
                    style={{ padding: '2px 7px', fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 3, borderRadius: 5 }}
                  >
                    <span>{copiedField === 'Takip No' ? '✓' : '📋'}</span>
                  </button>
                )}
              </div>
            </div>

            {/* İrsaliye No (16 Hane) & Kopyalama Butonu */}
            <div className="cargo-detail-row">
              <span className="cargo-detail-label">İrsaliye No (16 Hane):</span>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <span className="cargo-detail-value" style={{ userSelect: 'text' }}>
                  {cargo.waybill_no ? (
                    <strong style={{ color: '#38bdf8', letterSpacing: 0.5, fontSize: 13.5 }}>
                      {cargo.waybill_no}
                    </strong>
                  ) : (
                    '—'
                  )}
                </span>
                {cargo.waybill_no && (
                  <button
                    type="button"
                    className={`btn btn-xs ${copiedField === 'İrsaliye No' ? 'btn-success' : 'btn-secondary'}`}
                    onClick={() => handleCopy(cargo.waybill_no, 'İrsaliye No')}
                    title={copiedField === 'İrsaliye No' ? 'Kopyalandı!' : 'İrsaliye Numarasını Kopyala'}
                    style={{
                      padding: '2px 7px',
                      fontSize: 12,
                      display: 'inline-flex',
                      alignItems: 'center',
                      borderRadius: 5,
                      cursor: 'pointer',
                      background: copiedField === 'İrsaliye No' ? '#16a34a' : undefined,
                      borderColor: copiedField === 'İrsaliye No' ? '#16a34a' : undefined,
                      color: copiedField === 'İrsaliye No' ? '#ffffff' : undefined,
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <span>{copiedField === 'İrsaliye No' ? '✅' : '📋'}</span>
                  </button>
                )}
              </div>
            </div>

            {/* Kargo Firması */}
            <div className="cargo-detail-row">
              <span className="cargo-detail-label">Kargo Firması:</span>
              <span className="cargo-detail-value">{cargo.carrier}</span>
            </div>

            {/* Gönderen */}
            <div className="cargo-detail-row">
              <span className="cargo-detail-label">{isOutgoing ? 'Gönderici (IT/Firma):' : 'Gönderen:'}</span>
              <span className="cargo-detail-value">{cargo.sender || (isOutgoing ? 'IT Ekibi' : '—')}</span>
            </div>
          </div>

          {/* Alıcı & IT İşlem Bilgileri */}
          <div className="cargo-detail-section">
            <div className="cargo-detail-section-title">
              {isOutgoing ? '🏢 Alıcı & Teslimat Bilgileri' : '🧑‍💻 Alıcı & Teslim Alma Bilgileri'}
            </div>
            <div className="cargo-detail-row">
              <span className="cargo-detail-label">{isOutgoing ? 'Alıcı (Kişi/Firma):' : 'Alıcı Personel:'}</span>
              <span className="cargo-detail-value" style={{ fontWeight: 700, fontSize: 14 }}>{cargo.recipient_name}</span>
            </div>
            {cargo.receiver_phone && (
              <div className="cargo-detail-row">
                <span className="cargo-detail-label">Alıcı Telefonu:</span>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <span className="cargo-detail-value">{cargo.receiver_phone}</span>
                  <button
                    type="button"
                    className="btn btn-xs btn-secondary"
                    onClick={() => handleCopy(cargo.receiver_phone, 'Telefon')}
                    style={{ padding: '2px 6px', fontSize: 11 }}
                  >
                    📋
                  </button>
                </div>
              </div>
            )}
            <div className="cargo-detail-row">
              <span className="cargo-detail-label">Departman / Şirket:</span>
              <span className="cargo-detail-value">{cargo.department || '—'}</span>
            </div>
            <div className="cargo-detail-row">
              <span className="cargo-detail-label">{isOutgoing ? 'Gönderen IT:' : 'Teslim Alan IT:'}</span>
              <span className="cargo-detail-value">{cargo.received_by || 'IT Ekibi'}</span>
            </div>
            <div className="cargo-detail-row">
              <span className="cargo-detail-label">Paket İçeriği & Adet:</span>
              <span className="cargo-detail-value">{cargo.package_type} ({cargo.package_count || 1} Adet)</span>
            </div>
          </div>

          {/* Alıcı Teslimat Adresi (Giden Kargolar İçin) */}
          {cargo.receiver_address && (
            <div className="cargo-detail-section" style={{ gridColumn: 'span 2', background: 'rgba(245, 158, 11, 0.05)', borderColor: 'rgba(245, 158, 11, 0.3)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <div className="cargo-detail-section-title" style={{ color: '#f59e0b', margin: 0 }}>📍 Alıcı Teslimat Adresi</div>
                <button
                  type="button"
                  className="btn btn-xs btn-secondary"
                  onClick={() => handleCopy(cargo.receiver_address, 'Adres')}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11 }}
                >
                  <span>📋 Adresi Kopyala</span>
                </button>
              </div>
              <div style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--color-text)', background: 'rgba(0,0,0,0.15)', padding: 10, borderRadius: 6, userSelect: 'text' }}>
                {cargo.receiver_address}
              </div>
            </div>
          )}

          {/* Eşleştirilmiş Snipe-IT Cihazı (Hizalanmış 4 Sütun Grid) */}
          {(cargo.asset_tag || cargo.asset_name || cargo.serial_no) && (
            <div className="cargo-detail-section" style={{ gridColumn: 'span 2', borderColor: 'rgba(99, 102, 241, 0.3)' }}>
              <div className="cargo-detail-section-title" style={{ color: '#818cf8' }}>🖥️ Eşleştirilmiş Snipe-IT Cihazı</div>
              <div className="cargo-asset-grid" style={{ display: 'grid', gridTemplateColumns: '1.1fr 1.3fr 1.3fr 1.3fr', gap: 14, marginTop: 8, alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div className="cargo-detail-label">Asset Tag (Demirbaş No):</div>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 28 }}>
                    <code style={{ userSelect: 'text', fontSize: 13 }}>{cargo.asset_tag || '—'}</code>
                    {cargo.asset_tag && (
                      <button
                        type="button"
                        className={`btn btn-xs ${copiedField === 'Demirbaş No' ? 'btn-success' : 'btn-secondary'}`}
                        onClick={() => handleCopy(cargo.asset_tag, 'Demirbaş No')}
                        title={copiedField === 'Demirbaş No' ? 'Kopyalandı!' : 'Demirbaş Numarasını Kopyala'}
                        style={{ padding: '2px 6px', fontSize: 11, borderRadius: 5 }}
                      >
                        {copiedField === 'Demirbaş No' ? '✅' : '📋'}
                      </button>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div className="cargo-detail-label">Cihaz / Model Adı:</div>
                  <div style={{ minHeight: 28, display: 'flex', alignItems: 'center' }}>
                    <strong style={{ color: 'var(--color-text-primary)', fontSize: 13 }}>
                      {cargo.model_name || cargo.asset_name || '—'}
                    </strong>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div className="cargo-detail-label">Seri Numarası:</div>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 28 }}>
                    <code style={{ userSelect: 'text', fontSize: 13 }}>{cargo.serial_no || '—'}</code>
                    {cargo.serial_no && (
                      <button
                        type="button"
                        className={`btn btn-xs ${copiedField === 'Seri No' ? 'btn-success' : 'btn-secondary'}`}
                        onClick={() => handleCopy(cargo.serial_no, 'Seri No')}
                        title={copiedField === 'Seri No' ? 'Kopyalandı!' : 'Seri Numarasını Kopyala'}
                        style={{ padding: '2px 6px', fontSize: 11, borderRadius: 5 }}
                      >
                        {copiedField === 'Seri No' ? '✅' : '📋'}
                      </button>
                    )}
                  </div>
                </div>

                {cargo.device_user && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <div className="cargo-detail-label">Cihaz Sahibi / Kullanıcı:</div>
                    <div style={{ minHeight: 28, display: 'flex', alignItems: 'center' }}>
                      <span style={{ color: '#38bdf8', fontWeight: 600, fontSize: 13 }}>
                        👤 {cargo.device_user}
                      </span>
                    </div>
                  </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div className="cargo-detail-label">Otomatik Servis Fişi:</div>
                  <div style={{ minHeight: 28, display: 'flex', alignItems: 'center' }}>
                    {cargo.service_ticket_no ? (
                      <button
                        type="button"
                        className="btn btn-xs btn-success"
                        onClick={handleOpenServiceTicket}
                        title="Servis Fişini Görüntüle"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 8px', fontSize: 12, fontWeight: 700, borderRadius: 6 }}
                      >
                        <span>✓ #{cargo.service_ticket_no}</span>
                        <span>↗</span>
                      </button>
                    ) : (
                      <span style={{ opacity: 0.6, fontSize: 12 }}>Fiş oluşturulmadı</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Açıklama & Notlar */}
          {cargo.notes && (
            <div className="cargo-detail-section" style={{ gridColumn: 'span 2' }}>
              <div className="cargo-detail-section-title">📝 Koli & Cihaz Açıklaması</div>
              <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.5, fontSize: 13, background: 'rgba(0,0,0,0.15)', padding: 10, borderRadius: 6, userSelect: 'text' }}>
                {cargo.notes}
              </div>
            </div>
          )}
        </div>

        {/* Alt Butonlar */}
        <div className="modal-footer" style={{ marginTop: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => onPrintLabel && onPrintLabel(cargo)}
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <span>🏷️</span>
              <span>{isOutgoing ? 'Kargo Gönderi Etiketi Yazdır' : 'Kabul Etiketi Yazdır'}</span>
            </button>
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => { onClose(); onEdit && onEdit(cargo); }}
            >
              ✏️ Düzenle
            </button>
            <button type="button" className="btn btn-primary" onClick={onClose}>
              Tamam
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
