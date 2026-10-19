import React, { useState } from 'react';
import Modal from '../../common/Modal';

const CHECKLIST_ITEMS = [
  {
    key: 'check_dust',
    title: 'Toz Bakımı',
    icon: '🧹',
    desc: 'Kasa içi, güç kaynağı ve anakart toz temizliği yapıldı.',
    required: true
  },
  {
    key: 'check_fan',
    title: 'Fan Kontrolü',
    icon: '🌀',
    desc: 'İşlemci ve kasa fanları kontrol edildi, arızalı/sesli fan yok.',
    required: true
  },
  {
    key: 'check_visual_audio',
    title: 'Ses ve Görsel Kontrol',
    icon: '👁️',
    desc: 'Ekran görüntüsü, fiziksel kasa durumu ve ses çıkışları normal.',
    required: true
  },
  {
    key: 'check_performance',
    title: 'Performans Kontrolü',
    icon: '⚡',
    desc: 'Kasma, donma, aşırı yavaşlama yok; disk ve RAM sağlığı iyi.',
    required: true
  },
  {
    key: 'check_ports',
    title: 'Port Kontrolleri',
    icon: '🔌',
    desc: 'USB, VGA, HDMI, Ethernet portları fiziksel olarak çalışıyor.',
    required: true
  },
  {
    key: 'check_antivirus',
    title: 'Antivirüs Kontrolü',
    icon: '🛡️',
    desc: 'Güvenlik yazılımı kurulu, güncel ve lisansı aktif.',
    required: true
  },
  {
    key: 'check_license',
    title: 'Lisans Kontrolü',
    icon: '🔑',
    desc: 'Windows ve Office lisansları etkinleştirilmiş ve geçerli.',
    required: true
  },
  {
    key: 'check_network',
    title: 'Network / Ağ Kontrolü',
    icon: '🌐',
    desc: 'Cihaz IP alıyor, yerel ağ ve internet iletişimi kesintisiz.',
    required: true
  },
  {
    key: 'check_standard_software',
    title: 'Standart Yazılımlar',
    icon: '💻',
    desc: 'Kaspersky, Chrome, Foxit, WinRAR, OnlyOffice, GLPI, Oracle vb. kurulu.',
    required: true
  },
  {
    key: 'check_keyboard_mouse',
    title: 'Klavye / Mouse',
    icon: '⌨️',
    desc: 'Klavye tuşları ve optik mouse tepkileri kontrol edildi.',
    required: false
  },
  {
    key: 'check_printer_drum',
    title: 'Yazıcı / Drum',
    icon: '🖨️',
    desc: 'Bağlı yazıcı veya drum ünitesi test çıktısı alındı.',
    required: false
  },
];

export default function DeviceCheckModal({ item, onClose, onSave, currentUser }) {
  const [checks, setChecks] = useState({
    check_dust: Boolean(item.check_dust),
    check_fan: Boolean(item.check_fan),
    check_visual_audio: Boolean(item.check_visual_audio),
    check_performance: Boolean(item.check_performance),
    check_ports: Boolean(item.check_ports),
    check_antivirus: Boolean(item.check_antivirus),
    check_license: Boolean(item.check_license),
    check_network: Boolean(item.check_network),
    check_standard_software: Boolean(item.check_standard_software),
    check_keyboard_mouse: Boolean(item.check_keyboard_mouse),
    check_printer_drum: Boolean(item.check_printer_drum),
  });

  const [notes, setNotes] = useState(item.notes || '');
  const [saving, setSaving] = useState(false);

  const toggleCheck = (key) => {
    setChecks(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const markAllRequired = () => {
    setChecks(prev => {
      const next = { ...prev };
      CHECKLIST_ITEMS.forEach(it => {
        if (it.required) next[it.key] = true;
      });
      return next;
    });
  };

  // Validation: all required items must be true
  const requiredItems = CHECKLIST_ITEMS.filter(it => it.required);
  const completedRequiredCount = requiredItems.filter(it => checks[it.key]).length;
  const isAllRequiredChecked = completedRequiredCount === requiredItems.length;

  const handleSave = async () => {
    if (!isAllRequiredChecked) return;
    setSaving(true);
    try {
      await onSave({
        ...checks,
        notes: notes.trim(),
        actor: currentUser
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen
      title={`Cihaz Bakım Kontrolü: ${item.asset_tag || item.asset_name}`}
      size="lg"
      onClose={onClose}
    >
      <div style={{ padding: '4px 2px', width: '100%', boxSizing: 'border-box' }}>
        {/* Device Header Info Box */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 140px), 1fr))',
          gap: 10,
          padding: '10px 12px',
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 8,
          marginBottom: 12
        }}>
          <div>
            <div style={{ fontSize: 10.5, color: 'var(--color-text-secondary)', fontWeight: 600 }}>Envanter / Barkod</div>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--color-primary)', fontFamily: 'monospace', wordBreak: 'break-all' }}>
              {item.asset_tag || '—'}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 10.5, color: 'var(--color-text-secondary)', fontWeight: 600 }}>Cihaz & Model</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text)', wordBreak: 'break-word' }}>
              {item.asset_name || item.model_name || '—'}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 10.5, color: 'var(--color-text-secondary)', fontWeight: 600 }}>Zimmetli Personel</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text)', wordBreak: 'break-word' }}>
              👤 {item.assigned_user || '—'}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 10.5, color: 'var(--color-text-secondary)', fontWeight: 600 }}>Lokasyon</div>
            <div style={{ fontSize: 12, color: 'var(--color-text)', wordBreak: 'break-word' }}>
              📍 {item.location_name || '—'}
            </div>
          </div>
        </div>

        {/* Progress & Quick Actions Bar */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          marginBottom: 12,
          background: isAllRequiredChecked ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)',
          border: `1px solid ${isAllRequiredChecked ? 'rgba(16, 185, 129, 0.3)' : 'rgba(245, 158, 11, 0.3)'}`,
          padding: '10px 12px',
          borderRadius: 8
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 18, flexShrink: 0 }}>{isAllRequiredChecked ? '✅' : '⏳'}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: isAllRequiredChecked ? '#10b981' : '#f59e0b' }}>
                Zorunlu Maddeler: {completedRequiredCount} / {requiredItems.length} Tamamlandı
              </div>
              <div style={{ fontSize: 10.5, color: 'var(--color-text-muted)', marginTop: 2, lineHeight: 1.3 }}>
                {isAllRequiredChecked 
                  ? 'Tüm zorunlu adımlar tamamlandı. Bakımı onaylayabilirsiniz.' 
                  : 'Onaylamak için 9 zorunlu kontrol maddesini işaretleyiniz.'}
              </div>
            </div>
          </div>

          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={markAllRequired}
            style={{ fontSize: 11, fontWeight: 600, width: '100%', justifyContent: 'center', padding: '6px 10px' }}
          >
            ⚡ Tüm Zorunluları İşaretle
          </button>
        </div>

        {/* 11 Checklist Items Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))',
          gap: 8,
          marginBottom: 14
        }}>
          {CHECKLIST_ITEMS.map((it) => {
            const isChecked = checks[it.key];
            return (
              <div
                key={it.key}
                onClick={() => toggleCheck(it.key)}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 10,
                  padding: 10,
                  borderRadius: 8,
                  cursor: 'pointer',
                  border: isChecked 
                    ? '1.5px solid var(--color-primary, #3b82f6)' 
                    : '1px solid var(--color-border)',
                  background: isChecked 
                    ? 'rgba(59, 130, 246, 0.08)' 
                    : 'var(--color-surface)',
                  transition: 'all 0.15s ease',
                  boxSizing: 'border-box'
                }}
              >
                <div style={{
                  width: 22,
                  height: 22,
                  borderRadius: 6,
                  border: isChecked ? 'none' : '2px solid var(--color-border)',
                  background: isChecked ? 'var(--color-primary, #3b82f6)' : 'transparent',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 13,
                  fontWeight: 800,
                  flexShrink: 0,
                  marginTop: 2
                }}>
                  {isChecked && '✓'}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, flexWrap: 'wrap' }}>
                    <div style={{ fontWeight: 700, fontSize: 12, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: 5 }}>
                      <span>{it.icon}</span>
                      <span>{it.title}</span>
                    </div>
                    {it.required ? (
                      <span style={{
                        fontSize: 9,
                        fontWeight: 700,
                        padding: '1px 5px',
                        borderRadius: 4,
                        background: 'rgba(239, 68, 68, 0.15)',
                        color: '#ef4444',
                        textTransform: 'uppercase',
                        flexShrink: 0
                      }}>
                        Zorunlu
                      </span>
                    ) : (
                      <span style={{
                        fontSize: 9,
                        fontWeight: 600,
                        padding: '1px 5px',
                        borderRadius: 4,
                        background: 'rgba(148, 163, 184, 0.15)',
                        color: '#94a3b8',
                        textTransform: 'uppercase',
                        flexShrink: 0
                      }}>
                        Opsiyonel
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 10.5, color: 'var(--color-text-secondary)', marginTop: 4, lineHeight: 1.35, wordBreak: 'break-word' }}>
                    {it.desc}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Technician Notes Field */}
        <div className="form-group" style={{ marginBottom: 14 }}>
          <label style={{ color: 'var(--color-text)', fontWeight: 600, fontSize: 11.5, marginBottom: 4, display: 'block' }}>
            📝 Teknisyen Özel Notları / Tespitler
          </label>
          <textarea
            className="form-control"
            rows={2}
            placeholder="Cihazda tespit edilen arıza, parça ihtiyacı veya yapılan özel işlem notları..."
            value={notes}
            onChange={e => setNotes(e.target.value)}
            style={{ background: 'var(--color-surface)', color: 'var(--color-text)', border: '1px solid var(--color-border)', fontSize: 11.5, width: '100%', boxSizing: 'border-box' }}
          />
        </div>

        {/* Footer Actions */}
        <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'flex-end', flexWrap: 'wrap', gap: 8, borderTop: '1px solid var(--color-border)', paddingTop: 10 }}>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving} style={{ flex: '1 1 80px', fontSize: 12 }}>
            İptal
          </button>
          <button
            type="button"
            className="btn btn-success"
            onClick={handleSave}
            disabled={!isAllRequiredChecked || saving}
            style={{
              opacity: isAllRequiredChecked ? 1 : 0.45,
              cursor: isAllRequiredChecked ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              flex: '2 1 180px',
              fontSize: 12
            }}
          >
            {saving ? '⏳ Kaydediliyor...' : '✅ Bakımı Onayla ve Tamamla'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
