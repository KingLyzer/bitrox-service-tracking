import React, { useState } from 'react';
import Modal from '../../common/Modal';

export default function BitlockerRawModal({ isOpen, onClose, item, onCopyKey }) {
  const [copiedRaw, setCopiedRaw] = useState(false);

  if (!isOpen || !item) return null;

  const handleCopyRaw = () => {
    if (!item.raw_text) return;
    navigator.clipboard.writeText(item.raw_text);
    setCopiedRaw(true);
    setTimeout(() => setCopiedRaw(false), 2000);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`📄 Ham BitLocker Metni — ${item.full_name || 'Kayıt'}`}
      size="lg"
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <div style={{ fontSize: 12, color: 'var(--color-text-secondary, #94a3b8)' }}>
            <span><strong>Tanımlayıcı:</strong> {item.identifier || '—'}</span>
            <span style={{ margin: '0 8px' }}>•</span>
            <span><strong>Kaynak:</strong> {item.source_filename || 'Manuel Kayıt'}</span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => onCopyKey?.(item.recovery_key)}
            >
              📋 Anahtarı Kopyala
            </button>
            <button
              type="button"
              className={`btn ${copiedRaw ? 'btn-success' : 'btn-primary'} btn-sm`}
              onClick={handleCopyRaw}
              disabled={!item.raw_text}
            >
              {copiedRaw ? '✓ Metin Kopyalandı' : '📄 Tüm Metni Kopyala'}
            </button>
          </div>
        </div>

        <pre className="bitlocker-raw-codeblock">
          {item.raw_text || 'Bu kayda ait ham metin bilgisi bulunmuyor.'}
        </pre>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Kapat
          </button>
        </div>
      </div>
    </Modal>
  );
}
