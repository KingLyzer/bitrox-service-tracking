import React, { useState, useEffect, useRef } from 'react';
import Modal from '../../common/Modal';

// Türkçe karakterleri büyük harfe çevirme yardımcısı
function toUpperTr(value) {
  if (!value) return '';
  const map = { 'i': 'İ', 'ı': 'I', 'ş': 'Ş', 'ğ': 'Ğ', 'ü': 'Ü', 'ö': 'Ö', 'ç': 'Ç' };
  return String(value)
    .replace(/[iışğüöç]/g, ch => map[ch] || ch)
    .toUpperCase()
    .trim();
}

// Dosya adından veya metinden ad soyad, GUID ve kurtarma anahtarı çıkarma (istemci tarafı ayrıştırıcı)
function extractFromFilename(filename) {
  const base = filename.replace(/\.[^/.]+$/, '');
  let identifier = null;
  let recovery_key = null;

  const idMatch = base.match(/\b[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}\b/);
  if (idMatch) identifier = idMatch[0].toUpperCase();

  const keyMatch = base.match(/\b\d{6}-\d{6}-\d{6}-\d{6}-\d{6}-\d{6}-\d{6}-\d{6}\b/);
  if (keyMatch) recovery_key = keyMatch[0];

  let name = base;
  if (identifier) name = name.replace(identifier, ' ');
  if (recovery_key) name = name.replace(recovery_key, ' ');

  name = name.replace(/\b[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}\b/gi, ' ');
  name = name.replace(/\b\d{6}-\d{6}-\d{6}-\d{6}-\d{6}-\d{6}-\d{6}\b/g, ' ');
  name = name.replace(/\b(sifre|sifresi|recovery|bitlocker|kurtarma|anahtar|anahtari|key|pdf|txt|html)\b/gi, ' ');
  name = name.replace(/\d+/g, ' ');
  name = name.replace(/[._-]+/g, ' ');
  name = name.trim().replace(/\s+/g, ' ');

  return { identifier, recovery_key, full_name: name ? toUpperTr(name) : null };
}

function parseBitlockerContent(content, filename = '') {
  const text = String(content || '').replace(/\r\n|\r/g, '\n').trim();

  let identifier = null;
  const idMatch = text.match(/\b[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}\b/);
  if (idMatch) identifier = idMatch[0].toUpperCase();

  let recovery_key = null;
  const keyMatch = text.match(/\b\d{6}-\d{6}-\d{6}-\d{6}-\d{6}-\d{6}-\d{6}-\d{6}\b/);
  if (keyMatch) recovery_key = keyMatch[0];

  let full_name = null;
  if (filename) {
    const fromFilename = extractFromFilename(filename);
    if (!identifier && fromFilename.identifier) identifier = fromFilename.identifier;
    if (!recovery_key && fromFilename.recovery_key) recovery_key = fromFilename.recovery_key;
    full_name = fromFilename.full_name;
  }

  let device_name = '';
  const devMatch = text.match(/(?:Bilgisayar Adı|Computer Name|Cihaz Adı)[\s:=]+([A-Za-z0-9_-]+)/i);
  if (devMatch) device_name = devMatch[1].trim();

  return { identifier, recovery_key, full_name, device_name, raw_text: text };
}

export default function BitlockerFormModal({ isOpen, onClose, onSave, onUploadSuccess, item }) {
  // Aktif mod: 'files' | 'manual'
  const [activeTab, setActiveTab] = useState('files');
  
  // Manuel form verileri
  const [formData, setFormData] = useState({
    full_name: '',
    device_name: '',
    identifier: '',
    recovery_key: '',
    raw_text: '',
  });

  // Dosya yükleme durumu (1 veya birden çok dosya)
  const [files, setFiles] = useState([]);
  const [defaultName, setDefaultName] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [parsedHint, setParsedHint] = useState('');

  const fileInputRef = useRef(null);

  useEffect(() => {
    if (item) {
      setFormData({
        full_name: item.full_name || '',
        device_name: item.device_name || '',
        identifier: item.identifier || '',
        recovery_key: item.recovery_key || '',
        raw_text: item.raw_text || '',
      });
      setActiveTab('manual');
    } else {
      setFormData({
        full_name: '',
        device_name: '',
        identifier: '',
        recovery_key: '',
        raw_text: '',
      });
      setFiles([]);
      setDefaultName('');
      setUploadResult(null);
      setParsedHint('');
      setActiveTab('files');
    }
    setError('');
  }, [item, isOpen]);

  if (!isOpen) return null;

  // ── Dosya Ekleme ve Doğrulama ──
  const addFiles = (newFiles) => {
    const valid = newFiles.filter(f => {
      const ext = f.name.split('.').pop().toLowerCase();
      return ['txt', 'html', 'htm', 'pdf'].includes(ext);
    });

    if (valid.length < newFiles.length) {
      setError('Yalnızca .txt, .html ve .pdf uzantılı dosyalar desteklenmektedir.');
    } else {
      setError('');
    }

    if (valid.length === 0) return;

    // Eğer tek bir metin dosyası sürüklendiyse, doğrudan ayrıştırıp form alanlarına da aktarabiliriz
    if (valid.length === 1 && ['txt', 'html', 'htm'].includes(valid[0].name.split('.').pop().toLowerCase())) {
      const file = valid[0];
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const content = e.target?.result || '';
          const parsed = parseBitlockerContent(content, file.name);
          setFormData(prev => ({
            ...prev,
            full_name: parsed.full_name || prev.full_name,
            device_name: parsed.device_name || prev.device_name,
            identifier: parsed.identifier || prev.identifier,
            recovery_key: parsed.recovery_key || prev.recovery_key,
            raw_text: parsed.raw_text || prev.raw_text,
          }));
          setParsedHint(`✓ "${file.name}" dosyasından anahtar ve bilgiler otomatik okundu.`);
        } catch (err) {
          console.warn('Dosya ön ayrıştırma hatası:', err);
        }
      };
      reader.readAsText(file);
    }

    setFiles(prev => [...prev, ...valid]);
  };

  const removeFile = (idx) => {
    setFiles(prev => prev.filter((_, i) => i !== idx));
  };

  // ── Sürükle Bırak Olayları ──
  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files?.length) {
      setActiveTab('files');
      addFiles(Array.from(e.dataTransfer.files));
    }
  };

  // ── Toplu / Tekli Dosya Yükleme (Backend) ──
  const handleUploadFiles = async () => {
    if (!files.length) {
      setError('Lütfen en az bir dosya seçin.');
      return;
    }

    setUploading(true);
    setError('');
    setUploadResult(null);

    try {
      const formPayload = new FormData();
      files.forEach(f => formPayload.append('files', f));
      if (defaultName.trim()) {
        formPayload.append('default_full_name', defaultName.trim());
      }

      let res;
      if (window.electronAPI?.uploadBitlockerFiles) {
        res = await window.electronAPI.uploadBitlockerFiles(formPayload);
      } else {
        const response = await fetch(`${window.API_BASE}/api/bitlocker/upload`, {
          method: 'POST',
          body: formPayload
        });
        res = await response.json();
      }

      if (res?.success) {
        setUploadResult(res);
        onUploadSuccess?.();
      } else {
        setError(res?.message || 'Yükleme sırasında hata oluştu.');
      }
    } catch (err) {
      setError('Yükleme hatası: ' + err.message);
    } finally {
      setUploading(false);
    }
  };

  // ── Manuel Form Gönderimi ──
  const handleManualSubmit = async (e) => {
    e.preventDefault();
    if (!formData.full_name.trim()) {
      setError('Personel Ad Soyad alanı zorunludur.');
      return;
    }
    if (!formData.recovery_key.trim()) {
      setError('Kurtarma Anahtarı alanı zorunludur.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      await onSave({
        ...formData,
        id: item?.id
      });
      onClose();
    } catch (err) {
      setError(err.message || 'Kayıt sırasında bir hata oluştu.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={item ? `✏️ BitLocker Kaydını Düzenle` : `🔐 Yeni BitLocker Anahtarı Ekle`}
      size="md"
    >
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
      >
        {/* Hata Bildirimi */}
        {error && (
          <div style={{
            padding: '8px 12px',
            background: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: 6,
            color: '#f87171',
            fontSize: 12
          }}>
            {error}
          </div>
        )}

        {/* Dosyadan Okundu Bildirimi */}
        {parsedHint && (
          <div style={{
            padding: '8px 12px',
            background: 'rgba(59, 130, 246, 0.15)',
            border: '1px solid rgba(59, 130, 246, 0.3)',
            borderRadius: 6,
            color: '#60a5fa',
            fontSize: 12,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <span>{parsedHint}</span>
            <button
              type="button"
              className="btn btn-xs btn-primary"
              onClick={() => setActiveTab('manual')}
              style={{ padding: '2px 8px', fontSize: 11 }}
            >
              Formda Gör →
            </button>
          </div>
        )}

        {/* Yeni Kayıt İse Mod Seçim Sekmeleri */}
        {!item && (
          <div style={{
            display: 'flex',
            gap: 6,
            background: 'rgba(255, 255, 255, 0.04)',
            padding: 4,
            borderRadius: 8,
            border: '1px solid var(--color-border, rgba(255, 255, 255, 0.08))'
          }}>
            <button
              type="button"
              className={`btn btn-sm ${activeTab === 'files' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setActiveTab('files')}
              style={{ flex: 1, fontWeight: 700, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
            >
              <span>📂</span>
              <span>Dosya Sürükle & Yükle {files.length > 0 ? `(${files.length})` : ''}</span>
            </button>
            <button
              type="button"
              className={`btn btn-sm ${activeTab === 'manual' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setActiveTab('manual')}
              style={{ flex: 1, fontWeight: 700, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
            >
              <span>📝</span>
              <span>Manuel Form Girişi</span>
            </button>
          </div>
        )}

        {/* ── MOD 1: DOSYA SÜRÜKLE / YÜKLE (TEK VE ÇOKLU) ── */}
        {!item && activeTab === 'files' && (
          <div>
            {uploadResult ? (
              /* Yükleme Başarı Özeti */
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{
                  padding: '12px 16px',
                  background: 'rgba(34, 197, 94, 0.12)',
                  border: '1px solid rgba(34, 197, 94, 0.3)',
                  borderRadius: 8,
                  color: '#4ade80',
                  fontSize: 13,
                  fontWeight: 600
                }}>
                  ✓ {uploadResult.message || 'Yükleme tamamlandı.'}
                </div>

                <div style={{ fontSize: 12, color: 'var(--color-text-secondary, #94a3b8)', lineHeight: 1.6 }}>
                  <div>• Toplam Dosya: <strong>{uploadResult.total_files}</strong></div>
                  <div>• Eklenen Anahtar: <strong style={{ color: '#4ade80' }}>{uploadResult.added}</strong></div>
                  <div>• Atlanan (Zaten Kayıtlı): <strong>{uploadResult.skipped}</strong></div>
                  {uploadResult.errors?.length > 0 && (
                    <div style={{ marginTop: 8, color: '#f87171' }}>
                      <strong>Ayrıştırılamayanlar:</strong>
                      <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
                        {uploadResult.errors.map((err, i) => (
                          <li key={i}>{err}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 10 }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => {
                      setFiles([]);
                      setUploadResult(null);
                      setError('');
                    }}
                  >
                    Yeni Dosyalar Yükle
                  </button>
                  <button type="button" className="btn btn-primary" onClick={onClose}>
                    Tamamla & Kapat
                  </button>
                </div>
              </div>
            ) : (
              /* Dosya Seçim & Sürükle Bırak Alanı */
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div
                  className={`bitlocker-dropzone ${isDragOver ? 'dragover' : ''}`}
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    cursor: 'pointer',
                    padding: '28px 16px',
                    border: '2px dashed var(--color-primary, #3b82f6)',
                    background: isDragOver ? 'rgba(59, 130, 246, 0.15)' : 'rgba(59, 130, 246, 0.05)',
                    borderRadius: 10,
                    textAlign: 'center',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept=".txt,.html,.htm,.pdf"
                    style={{ display: 'none' }}
                    onChange={(e) => {
                      if (e.target.files?.length) {
                        addFiles(Array.from(e.target.files));
                      }
                    }}
                  />
                  <div style={{ fontSize: 36, marginBottom: 6 }}>📁</div>
                  <h4 style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 700, color: 'var(--color-text)' }}>
                    BitLocker Dosyalarını Buraya Sürükleyin
                  </h4>
                  <p style={{ margin: 0, fontSize: 11.5, color: 'var(--color-text-secondary)' }}>
                    1 veya birden çok dosya seçebilirsiniz (.txt, .pdf, .html)
                  </p>
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 4 }}>
                    Varsayılan Personel Adı (Opsiyonel)
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Dosya adında isim yoksa kullanılacak ad soyad"
                    value={defaultName}
                    onChange={(e) => setDefaultName(e.target.value)}
                    style={{ fontSize: 12 }}
                  />
                  <small style={{ color: 'var(--color-text-secondary, #94a3b8)', fontSize: 10.5, marginTop: 2, display: 'block' }}>
                    Boş bırakılırsa dosya adından otomatik tespit edilir (örn: ahmet_yilmaz_bitlocker.pdf).
                  </small>
                </div>

                {/* Seçilen Dosyaların Listesi */}
                {files.length > 0 && (
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>Seçilen Dosyalar ({files.length})</span>
                      <button
                        type="button"
                        style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: 11, cursor: 'pointer', fontWeight: 600 }}
                        onClick={() => setFiles([])}
                      >
                        Tümünü Temizle
                      </button>
                    </div>
                    <div className="bitlocker-files-list" style={{ maxHeight: 150, overflowY: 'auto' }}>
                      {files.map((file, idx) => (
                        <div key={idx} className="bitlocker-file-item" style={{ fontSize: 12, padding: '5px 10px' }}>
                          <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                            📄 {file.name}
                          </span>
                          <button
                            type="button"
                            style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '0 4px', fontSize: 13 }}
                            onClick={() => removeFile(idx)}
                            title="Dosyayı Çıkar"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 6 }}>
                  <button type="button" className="btn btn-secondary" onClick={onClose} disabled={uploading}>
                    İptal
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={handleUploadFiles}
                    disabled={uploading || files.length === 0}
                    style={{ fontWeight: 700 }}
                  >
                    {uploading ? 'Ayrıştırılıyor & Yükleniyor...' : `${files.length || 1} Dosyayı Yükle & Kaydet`}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── MOD 2: MANUEL FORM GİRİŞİ ── */}
        {(item || activeTab === 'manual') && (
          <form onSubmit={handleManualSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="form-group">
              <label className="form-label" style={{ fontWeight: 600, fontSize: 12 }}>
                Personel Ad Soyad <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input
                type="text"
                className="form-control"
                placeholder="Örn: AHMET YILMAZ"
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                autoFocus
                required
              />
            </div>

            <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 600, fontSize: 12 }}>Cihaz / Bilgisayar Adı</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Örn: DEMO-PC-042"
                  value={formData.device_name}
                  onChange={(e) => setFormData({ ...formData, device_name: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 600, fontSize: 12 }}>Sürücü Tanımlayıcı (GUID)</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Örn: 0A1DEC53-8806-42C3-8607-C27DF7EEDF45"
                  value={formData.identifier}
                  onChange={(e) => setFormData({ ...formData, identifier: e.target.value })}
                  style={{ fontFamily: 'monospace', fontSize: 11 }}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" style={{ fontWeight: 600, fontSize: 12 }}>
                Kurtarma Anahtarı (48 Haneli) <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input
                type="text"
                className="form-control"
                placeholder="XXXXXX-XXXXXX-XXXXXX-XXXXXX-XXXXXX-XXXXXX-XXXXXX-XXXXXX"
                value={formData.recovery_key}
                onChange={(e) => setFormData({ ...formData, recovery_key: e.target.value })}
                style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 13, letterSpacing: '0.5px' }}
                required
              />
              <small style={{ color: 'var(--color-text-secondary, #94a3b8)', fontSize: 10.5, marginTop: 2, display: 'block' }}>
                Tirelerle ayrılmış 48 haneli sayısal kurtarma anahtarı.
              </small>
            </div>

            <div className="form-group">
              <label className="form-label" style={{ fontWeight: 600, fontSize: 12 }}>Ham Metin / Notlar (Opsiyonel)</label>
              <textarea
                className="form-control"
                rows={3}
                placeholder="BitLocker çıktısı metni veya ek notlar..."
                value={formData.raw_text}
                onChange={(e) => setFormData({ ...formData, raw_text: e.target.value })}
                style={{ fontFamily: 'monospace', fontSize: 11 }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 6 }}>
              <button type="button" className="btn btn-secondary" onClick={onClose} disabled={submitting}>
                İptal
              </button>
              <button type="submit" className="btn btn-primary" disabled={submitting} style={{ fontWeight: 700 }}>
                {submitting ? 'Kaydediliyor...' : item ? 'Güncelle' : 'Kaydet'}
              </button>
            </div>
          </form>
        )}
      </div>
    </Modal>
  );
}
