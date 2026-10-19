import React, { useState, useEffect } from 'react';

const API_BASE = window.location.origin;

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatDate(d) {
  if (!d) return '-';
  return new Date(d).toLocaleString('tr-TR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

function getFileIcon(type, name = '') {
  if (type === 'folder') return '📁';
  const ext = name.split('.').pop().toLowerCase();
  switch (ext) {
    case 'pdf': return '📄';
    case 'doc':
    case 'docx': return '📝';
    case 'xls':
    case 'xlsx': return '📊';
    case 'ppt':
    case 'pptx': return '📊';
    case 'jpg':
    case 'jpeg':
    case 'png':
    case 'gif':
    case 'webp':
    case 'svg': return '🖼️';
    case 'zip':
    case 'rar':
    case '7z':
    case 'tar':
    case 'gz': return '🗜️';
    case 'mp3':
    case 'wav': return '🎵';
    case 'mp4':
    case 'avi':
    case 'mkv': return '🎬';
    case 'txt':
    case 'sql':
    case 'js':
    case 'json': return '📜';
    default: return '📄';
  }
}

export default function PublicSharePage({ token }) {
  const [loading, setLoading] = useState(true);
  const [shareData, setShareData] = useState(null);
  const [error, setError] = useState(null);

  const [password, setPassword] = useState('');
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [authError, setAuthError] = useState('');

  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    fetchShareInfo();
  }, [token]);

  const fetchShareInfo = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/public/share/${token}/info`);
      const json = await res.json();
      if (res.ok && json.success) {
        setShareData(json.data);
        if (!json.data.has_password) {
          setIsUnlocked(true);
        }
      } else {
        setError(json.message || 'Paylaşım bağlantısına ulaşılamadı.');
      }
    } catch (e) {
      setError('Bağlantı hatası oluştu. Lütfen daha sonra tekrar deneyin.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyPassword = async (e) => {
    e.preventDefault();
    if (!password.trim()) {
      setAuthError('Lütfen şifreyi girin.');
      return;
    }
    setVerifying(true);
    setAuthError('');
    try {
      const res = await fetch(`${API_BASE}/api/public/share/${token}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setIsUnlocked(true);
      } else {
        setAuthError(json.message || 'Şifre hatalı!');
      }
    } catch (e) {
      setAuthError('Doğrulama hatası oluştu.');
    } finally {
      setVerifying(false);
    }
  };

  const handleDownloadMain = () => {
    setDownloading(true);
    const downloadUrl = `${API_BASE}/api/public/share/${token}/download${password ? `?password=${encodeURIComponent(password)}` : ''}`;
    window.location.href = downloadUrl;
    setTimeout(() => setDownloading(false), 2000);
  };

  const handleDownloadSubFile = (subFileName) => {
    const downloadUrl = `${API_BASE}/api/public/share/${token}/download?sub_file=${encodeURIComponent(subFileName)}${password ? `&password=${encodeURIComponent(password)}` : ''}`;
    window.location.href = downloadUrl;
  };

  const isPreviewable = (name = '') => {
    const ext = name.split('.').pop().toLowerCase();
    return ['pdf', 'png', 'jpg', 'jpeg', 'webp', 'gif', 'svg', 'txt'].includes(ext);
  };

  const handlePreview = () => {
    const previewUrl = `${API_BASE}/api/public/share/${token}/view${password ? `?password=${encodeURIComponent(password)}` : ''}`;
    window.open(previewUrl, '_blank');
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'radial-gradient(ellipse at top, #1e293b 0%, #0f172a 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      fontFamily: "'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, sans-serif",
      color: '#f8fafc'
    }}>
      {/* Dynamic Background Glow Elements */}
      <div style={{
        position: 'fixed',
        top: '15%',
        left: '20%',
        width: 350,
        height: 350,
        background: 'radial-gradient(circle, rgba(59,130,246,0.18) 0%, rgba(59,130,246,0) 70%)',
        filter: 'blur(40px)',
        pointerEvents: 'none'
      }} />
      <div style={{
        position: 'fixed',
        bottom: '15%',
        right: '20%',
        width: 400,
        height: 400,
        background: 'radial-gradient(circle, rgba(147,51,234,0.15) 0%, rgba(147,51,234,0) 70%)',
        filter: 'blur(50px)',
        pointerEvents: 'none'
      }} />

      <div style={{
        width: '100%',
        maxWidth: shareData && shareData.type === 'folder' && isUnlocked ? 650 : 480,
        background: 'rgba(30, 41, 59, 0.75)',
        backdropFilter: 'blur(16px)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: 20,
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.05)',
        overflow: 'hidden',
        position: 'relative',
        zIndex: 1,
        transition: 'all 0.3s ease'
      }}>
        
        {/* Header Branding */}
        <div style={{
          padding: '24px 28px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'rgba(15, 23, 42, 0.4)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 38,
              height: 38,
              borderRadius: 10,
              background: 'linear-gradient(135deg, #3b82f6, #6366f1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 20,
              boxShadow: '0 4px 12px rgba(59,130,246,0.3)'
            }}>
              🌐
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-0.3px', color: '#fff' }}>
                Servis Takip Portalı
              </div>
              <div style={{ fontSize: 12, color: '#94a3b8' }}>
                Güvenli Dosya Paylaşım Portalı
              </div>
            </div>
          </div>

          {shareData && (
            <span style={{
              fontSize: 11,
              padding: '4px 10px',
              borderRadius: 20,
              background: shareData.has_password ? 'rgba(234, 179, 8, 0.15)' : 'rgba(34, 197, 94, 0.15)',
              color: shareData.has_password ? '#fde047' : '#4ade80',
              border: shareData.has_password ? '1px solid rgba(234, 179, 8, 0.3)' : '1px solid rgba(34, 197, 94, 0.3)',
              fontWeight: 600
            }}>
              {shareData.has_password ? '🔒 Şifre Korumalı' : '🌍 Herkese Açık'}
            </span>
          )}
        </div>

        {/* Content Area */}
        <div style={{ padding: '28px' }}>
          {loading && (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <div className="spinner" style={{
                width: 36,
                height: 36,
                border: '3px solid rgba(255,255,255,0.1)',
                borderTopColor: '#3b82f6',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
                margin: '0 auto 16px'
              }} />
              <div style={{ color: '#94a3b8', fontSize: 14 }}>Paylaşım bilgileri yükleniyor...</div>
            </div>
          )}

          {error && (
            <div style={{ textAlign: 'center', padding: '30px 10px' }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
              <h3 style={{ fontSize: 18, fontWeight: 700, color: '#f87171', marginBottom: 8 }}>Erişim Sağlanamadı</h3>
              <p style={{ fontSize: 14, color: '#94a3b8', lineHeight: 1.6, marginBottom: 20 }}>
                {error}
              </p>
              <button
                onClick={fetchShareInfo}
                style={{
                  padding: '10px 20px',
                  borderRadius: 10,
                  border: 'none',
                  background: '#3b82f6',
                  color: '#fff',
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: 'pointer'
                }}
              >
                Tekrar Dene
              </button>
            </div>
          )}

          {!loading && !error && shareData && (
            <>
              {/* PASSWORD GATE */}
              {!isUnlocked && (
                <form onSubmit={handleVerifyPassword} style={{ textAlign: 'center' }}>
                  <div style={{
                    width: 64,
                    height: 64,
                    borderRadius: '50%',
                    background: 'rgba(234, 179, 8, 0.12)',
                    border: '1px solid rgba(234, 179, 8, 0.25)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 28,
                    margin: '0 auto 16px',
                    color: '#fde047'
                  }}>
                    🔐
                  </div>
                  <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>Bu Paylaşım Şifrelenmiştir</h2>
                  <p style={{ fontSize: 13, color: '#94a3b8', marginBottom: 22, lineHeight: 1.5 }}>
                    <strong>"{shareData.name}"</strong> içeriğini görüntülemek veya indirmek için lütfen paylaşım şifresini girin.
                  </p>

                  <div style={{ marginBottom: 18, textAlign: 'left' }}>
                    <input
                      type="password"
                      placeholder="Şifreyi buraya yazın..."
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      autoFocus
                      style={{
                        width: '100%',
                        padding: '14px 16px',
                        background: 'rgba(15, 23, 42, 0.6)',
                        border: '1px solid rgba(255, 255, 255, 0.15)',
                        borderRadius: 12,
                        color: '#fff',
                        fontSize: 15,
                        outline: 'none',
                        boxSizing: 'border-box',
                        transition: 'border-color 0.2s'
                      }}
                    />
                    {authError && (
                      <div style={{ color: '#f87171', fontSize: 12, marginTop: 8, fontWeight: 500 }}>
                        {authError}
                      </div>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={verifying}
                    style={{
                      width: '100%',
                      padding: '14px',
                      borderRadius: 12,
                      border: 'none',
                      background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
                      color: '#fff',
                      fontSize: 15,
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                      boxShadow: '0 8px 20px -4px rgba(59, 130, 246, 0.4)'
                    }}
                  >
                    {verifying ? 'Doğrulanıyor...' : '🔓 Kilidi Aç ve Devam Et'}
                  </button>
                </form>
              )}

              {/* UNLOCKED VIEW */}
              {isUnlocked && (
                <div>
                  {/* File/Folder Info Box */}
                  <div style={{
                    padding: '20px',
                    background: 'rgba(15, 23, 42, 0.5)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: 14,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 16,
                    marginBottom: 20
                  }}>
                    <div style={{
                      width: 56,
                      height: 56,
                      borderRadius: 12,
                      background: 'rgba(59, 130, 246, 0.12)',
                      border: '1px solid rgba(59, 130, 246, 0.25)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 30,
                      flexShrink: 0
                    }}>
                      {getFileIcon(shareData.type, shareData.name)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: 16,
                        fontWeight: 700,
                        color: '#fff',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        marginBottom: 4
                      }} title={shareData.name}>
                        {shareData.name}
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, fontSize: 12, color: '#94a3b8' }}>
                        <span>Tür: <strong style={{ color: '#cbd5e1' }}>{shareData.type === 'folder' ? 'Klasör' : 'Dosya'}</strong></span>
                        {shareData.type !== 'folder' && (
                          <span>Boyut: <strong style={{ color: '#cbd5e1' }}>{formatBytes(shareData.size)}</strong></span>
                        )}
                        <span>Paylaşan: <strong style={{ color: '#cbd5e1' }}>{shareData.owner_name}</strong></span>
                      </div>
                    </div>
                  </div>

                  {/* Expiration and Download Stats */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                    gap: 10,
                    marginBottom: 24,
                    fontSize: 12
                  }}>
                    <div style={{
                      padding: '10px 14px',
                      borderRadius: 10,
                      background: 'rgba(255, 255, 255, 0.03)',
                      border: '1px solid rgba(255, 255, 255, 0.06)'
                    }}>
                      <div style={{ color: '#64748b', marginBottom: 2 }}>Son Geçerlilik</div>
                      <div style={{ fontWeight: 600, color: '#cbd5e1' }}>
                        {shareData.expires_at ? formatDate(shareData.expires_at) : 'Süresiz ♾️'}
                      </div>
                    </div>
                    <div style={{
                      padding: '10px 14px',
                      borderRadius: 10,
                      background: 'rgba(255, 255, 255, 0.03)',
                      border: '1px solid rgba(255, 255, 255, 0.06)'
                    }}>
                      <div style={{ color: '#64748b', marginBottom: 2 }}>İndirilme Durumu</div>
                      <div style={{ fontWeight: 600, color: '#cbd5e1' }}>
                        {shareData.download_count} {shareData.download_limit ? `/ ${shareData.download_limit}` : 'kez'}
                      </div>
                    </div>
                  </div>

                  {/* FOLDER CONTENTS TREE */}
                  {shareData.type === 'folder' && shareData.children && shareData.children.length > 0 && (
                    <div style={{ marginBottom: 24 }}>
                      <div style={{
                        fontSize: 12,
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                        color: '#94a3b8',
                        marginBottom: 10,
                        display: 'flex',
                        justifyContent: 'space-between'
                      }}>
                        <span>Klasör İçeriği ({shareData.children.length} Öğe)</span>
                        <span style={{ fontSize: 11, fontWeight: 500, color: '#64748b' }}>Tek tek veya toplu indirebilirsiniz</span>
                      </div>
                      <div style={{
                        maxHeight: 220,
                        overflowY: 'auto',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: 12,
                        background: 'rgba(15, 23, 42, 0.4)'
                      }}>
                        {shareData.children.map((item, idx) => (
                          <div
                            key={idx}
                            style={{
                              padding: '10px 14px',
                              borderBottom: idx < shareData.children.length - 1 ? '1px solid rgba(255, 255, 255, 0.05)' : 'none',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: 12
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                              <span style={{ fontSize: 18 }}>{getFileIcon(item.type, item.name)}</span>
                              <span style={{
                                fontSize: 13,
                                color: '#e2e8f0',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis'
                              }} title={item.name}>
                                {item.name}
                              </span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                              {item.type !== 'folder' && (
                                <span style={{ fontSize: 11, color: '#64748b' }}>{formatBytes(item.size)}</span>
                              )}
                              {item.type !== 'folder' && (
                                <button
                                  onClick={() => handleDownloadSubFile(item.name)}
                                  style={{
                                    padding: '4px 8px',
                                    borderRadius: 6,
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    background: 'rgba(255,255,255,0.05)',
                                    color: '#cbd5e1',
                                    fontSize: 11,
                                    cursor: 'pointer'
                                  }}
                                  title="Bu dosyayı indir"
                                >
                                  ⬇️ İndir
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* ACTION BUTTONS */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <button
                      onClick={handleDownloadMain}
                      disabled={downloading}
                      style={{
                        width: '100%',
                        padding: '15px',
                        borderRadius: 12,
                        border: 'none',
                        background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                        color: '#fff',
                        fontSize: 16,
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 10,
                        boxShadow: '0 8px 24px -4px rgba(59, 130, 246, 0.45)',
                        transition: 'transform 0.1s'
                      }}
                    >
                      <span>⬇️</span>
                      <span>
                        {downloading 
                          ? 'İndirme Başlatılıyor...' 
                          : shareData.type === 'folder' 
                            ? 'Tüm Klasörü İndir (.ZIP)' 
                            : 'Dosyayı İndir'}
                      </span>
                    </button>

                    {shareData.type === 'file' && isPreviewable(shareData.name) && (
                      <button
                        onClick={handlePreview}
                        style={{
                          width: '100%',
                          padding: '12px',
                          borderRadius: 12,
                          border: '1px solid rgba(255, 255, 255, 0.15)',
                          background: 'rgba(255, 255, 255, 0.05)',
                          color: '#e2e8f0',
                          fontSize: 14,
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 8
                        }}
                      >
                        👁️ Tarayıcıda Görüntüle / Önizle
                      </button>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '14px 28px',
          borderTop: '1px solid rgba(255, 255, 255, 0.06)',
          background: 'rgba(15, 23, 42, 0.5)',
          textAlign: 'center',
          fontSize: 11,
          color: '#64748b',
          letterSpacing: '0.3px'
        }}>
          Created by <strong style={{ color: '#94a3b8' }}>Bitrox</strong> • Güvenli Bağlantı
        </div>
      </div>
    </div>
  );
}
