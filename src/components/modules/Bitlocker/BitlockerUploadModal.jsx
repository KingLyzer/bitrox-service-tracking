import React, { useState, useRef } from 'react';
import Modal from '../../common/Modal';

export default function BitlockerUploadModal({ isOpen, onClose, onUploadSuccess }) {
  const [files, setFiles] = useState([]);
  const [defaultName, setDefaultName] = useState('');
  const [uploading, setUploading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const [error, setError] = useState('');

  const fileInputRef = useRef(null);

  if (!isOpen) return null;

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
      addFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files?.length) {
      addFiles(Array.from(e.target.files));
    }
  };

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

    setFiles(prev => [...prev, ...valid]);
  };

  const removeFile = (idx) => {
    setFiles(prev => prev.filter((_, i) => i !== idx));
  };

  const handleUpload = async () => {
    if (!files.length) {
      setError('Lütfen en az bir dosya seçin.');
      return;
    }

    setUploading(true);
    setError('');
    setUploadResult(null);

    try {
      const formData = new FormData();
      files.forEach(f => formData.append('files', f));
      if (defaultName.trim()) {
        formData.append('default_full_name', defaultName.trim());
      }

      let res;
      if (window.electronAPI?.uploadBitlockerFiles) {
        res = await window.electronAPI.uploadBitlockerFiles(formData);
      } else {
        const response = await fetch(`${window.API_BASE}/api/bitlocker/upload`, {
          method: 'POST',
          body: formData
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

  const handleReset = () => {
    setFiles([]);
    setUploadResult(null);
    setError('');
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="📤 Toplu BitLocker Dosyası Yükleme"
      size="md"
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {uploadResult ? (
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
              <button type="button" className="btn btn-secondary" onClick={handleReset}>
                Yeni Dosyalar Yükle
              </button>
              <button type="button" className="btn btn-primary" onClick={onClose}>
                Tamamla & Kapat
              </button>
            </div>
          </div>
        ) : (
          <>
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

            <div
              className={`bitlocker-dropzone ${isDragOver ? 'dragover' : ''}`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".txt,.html,.htm,.pdf"
                style={{ display: 'none' }}
                onChange={handleFileChange}
              />
              <div className="bitlocker-dropzone-icon">📁</div>
              <h4>BitLocker Çıktı Dosyalarını Buraya Sürükleyin</h4>
              <p>veya dosya seçmek için tıklayın (.txt, .html, .pdf)</p>
            </div>

            <div className="form-group">
              <label className="form-label" style={{ fontSize: 12, fontWeight: 600 }}>
                Varsayılan Personel Adı (Opsiyonel)
              </label>
              <input
                type="text"
                className="form-control"
                placeholder="Dosya adında isim yoksa kullanılacak ad soyad"
                value={defaultName}
                onChange={(e) => setDefaultName(e.target.value)}
              />
              <small style={{ color: 'var(--color-text-secondary, #94a3b8)', fontSize: 11 }}>
                Boş bırakılırsa dosya adından otomatik tespit edilmeye çalışılır (örn: ahmet_yilmaz_bitlocker.pdf).
              </small>
            </div>

            {files.length > 0 && (
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6, display: 'flex', justifyContent: 'space-between' }}>
                  <span>Seçilen Dosyalar ({files.length})</span>
                  <button
                    type="button"
                    style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: 11, cursor: 'pointer' }}
                    onClick={() => setFiles([])}
                  >
                    Tümünü Temizle
                  </button>
                </div>
                <div className="bitlocker-files-list">
                  {files.map((file, idx) => (
                    <div key={idx} className="bitlocker-file-item">
                      <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                        📄 {file.name}
                      </span>
                      <button
                        type="button"
                        style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '0 4px' }}
                        onClick={() => removeFile(idx)}
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
                onClick={handleUpload}
                disabled={uploading || files.length === 0}
              >
                {uploading ? 'Ayrıştırılıyor & Yükleniyor...' : `${files.length} Dosyayı Yükle & Ayrıştır`}
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
