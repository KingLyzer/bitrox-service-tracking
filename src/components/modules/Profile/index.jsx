import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { useApp } from '../../../context/AppContext';
import { apiPost, apiGet } from '../../../utils/apiFetch';
import WebPushSettings from '../Settings/WebPushSettings';
import Modal from '../../common/Modal';
import UserAvatar, { AVATAR_PRESETS } from '../../common/UserAvatar';

// Ses bildirim dosyasını import et
import notificationSound from '../../../assets/bildirim.mp3';

export default function Profile() {
  const { user, auditLog, updateUser, hasPermission } = useAuth();
  const { 
    showNotification, 
    openThemeModal 
  } = useApp();

  const fileInputRef = useRef(null);

  const isSuperAdmin = Boolean(user?.is_superadmin || user?.username === 'admin' || Number(user?.id) === 1);
  const isAdmin = isSuperAdmin || Number(user?.role_id) === 1 || String(user?.role_name || '').toLowerCase() === 'yönetici';

  const canViewService = hasPermission('service', 'can_view');
  const canViewMaintenance = hasPermission('maintenance', 'can_view');

  // Sekme durumu
  const [activeTab, setActiveTab] = useState('account');

  // Avatar Modal (Popup) Durumu
  const [avatarModalOpen, setAvatarModalOpen] = useState(false);
  const [selectedAvatar, setSelectedAvatar] = useState(user?.avatar || '');
  const [savingAvatar, setSavingAvatar] = useState(false);

  // Profil formu
  const [profileForm, setProfileForm] = useState({
    full_name: user?.full_name || user?.name || '',
    email: user?.email || '',
    username: user?.username || ''
  });
  const [savingProfile, setSavingProfile] = useState(false);

  // Şifre formu
  const [passwordForm, setPasswordForm] = useState({
    oldPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [showPass, setShowPass] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  // Kişisel İstatistikler
  const [stats, setStats] = useState({
    completedTickets: 0,
    openTickets: 0,
    maintenanceCompleted: 0,
    totalImpact: 0,
    loading: true
  });

  // Ses Tercihi (Local Storage)
  const [soundEnabled, setSoundEnabled] = useState(() => {
    return localStorage.getItem('user_sound_enabled') !== 'false';
  });

  // Kullanıcı İstatistiklerini Çek
  const fetchStats = useCallback(async () => {
    try {
      const storedUser = user || JSON.parse(localStorage.getItem('user') || '{}');
      const uId = storedUser?.id || 1;
      const uName = storedUser?.username || 'admin';
      const uFullName = storedUser?.full_name || storedUser?.name || '';
      const isSuper = Boolean(storedUser?.is_superadmin || uName === 'admin' || Number(uId) === 1);

      // 1. Backend Endpoint Çağrısı
      const res = await apiPost('/api/auth/get-user-stats', {
        userId: uId,
        username: uName,
        fullName: uFullName
      });

      const s = res?.stats || res?.data?.stats;
      if (s && (s.completedTickets > 0 || s.openTickets > 0 || s.maintenanceCompleted > 0)) {
        setStats({
          completedTickets: Number(s.completedTickets) || 0,
          openTickets: Number(s.openTickets) || 0,
          maintenanceCompleted: Number(s.maintenanceCompleted) || 0,
          totalImpact: Number(s.totalImpact) || (Number(s.completedTickets) || 0) + (Number(s.maintenanceCompleted) || 0),
          loading: false
        });
        return;
      }

      // 2. İkincil Canlı Fallback: /api/fisler üzerinden dinamik hesaplama
      try {
        const fislerRes = await fetch('/api/fisler').then(r => r.json()).catch(() => []);
        if (Array.isArray(fislerRes) && fislerRes.length > 0) {
          const completedCount = fislerRes.filter(t => 
            ['Tamamlandı', 'Teslim Edildi', 'Kapandı', 'Çözüldü'].includes(t.status) &&
            (isSuper || t.teknisyen === uFullName || t.teknisyen === uName || t.user_name === uFullName || t.user_name === uName)
          ).length;

          const openCount = fislerRes.filter(t => 
            !['Tamamlandı', 'Teslim Edildi', 'Kapandı', 'Çözüldü', 'İptal', 'Pert', 'İptal Edildi'].includes(t.status) &&
            (isSuper || t.teknisyen === uFullName || t.teknisyen === uName || t.user_name === uFullName || t.user_name === uName)
          ).length;

          setStats({
            completedTickets: completedCount,
            openTickets: openCount,
            maintenanceCompleted: Number(s?.maintenanceCompleted) || 0,
            totalImpact: completedCount + (Number(s?.maintenanceCompleted) || 0),
            loading: false
          });
          return;
        }
      } catch (err2) {
        console.warn('Fallback fisler fetch failed:', err2);
      }

      // Sonuç s nesnesi varsa onu ata
      if (s) {
        setStats({
          completedTickets: Number(s.completedTickets) || 0,
          openTickets: Number(s.openTickets) || 0,
          maintenanceCompleted: Number(s.maintenanceCompleted) || 0,
          totalImpact: Number(s.totalImpact) || 0,
          loading: false
        });
      } else {
        setStats(prev => ({ ...prev, loading: false }));
      }
    } catch (e) {
      console.warn('Failed to fetch stats:', e);
      setStats(prev => ({ ...prev, loading: false }));
    }
  }, [user]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    if (user) {
      setProfileForm({
        full_name: user.full_name || user.name || '',
        email: user.email || '',
        username: user.username || ''
      });
      setSelectedAvatar(user.avatar || '');
    }
  }, [user]);

  // Profil Güncelleme
  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    if (!profileForm.full_name.trim()) {
      showNotification('Lütfen ad ve soyadınızı giriniz.', 'warning');
      return;
    }

    setSavingProfile(true);
    try {
      const res = await apiPost('/api/auth/update-profile', {
        id: user.id,
        full_name: profileForm.full_name.trim(),
        email: profileForm.email.trim()
      });

      if (res?.success) {
        updateUser({
          full_name: profileForm.full_name.trim(),
          name: profileForm.full_name.trim(),
          email: profileForm.email.trim()
        });
        showNotification('Profil bilgileriniz başarıyla güncellendi! ✨', 'success');
        auditLog({
          action: 'UPDATE_PROFILE',
          module: 'profile',
          description: `${user.username} kendi profil bilgilerini güncelledi.`
        });
      } else {
        showNotification(res?.message || 'Profil güncellenemedi.', 'danger');
      }
    } catch (err) {
      showNotification('Hata: ' + err.message, 'danger');
    } finally {
      setSavingProfile(false);
    }
  };

  // Avatar Kaydetme
  const handleSaveAvatar = async (newAvatarValue) => {
    setSavingAvatar(true);
    try {
      const res = await apiPost('/api/auth/update-avatar', {
        userId: user?.id || 1,
        avatar: newAvatarValue || null
      });

      if (res?.success) {
        setSelectedAvatar(newAvatarValue || '');
        updateUser({ avatar: newAvatarValue || '' });
        showNotification('Profil avatarınız başarıyla güncellendi! 🎭✨', 'success');
        auditLog({
          action: 'UPDATE_AVATAR',
          module: 'profile',
          description: `${user.username} profil avatarını değiştirdi.`
        });
      } else {
        showNotification(res?.message || 'Avatar güncellenemedi.', 'danger');
      }
    } catch (err) {
      showNotification('Hata: ' + err.message, 'danger');
    } finally {
      setSavingAvatar(false);
    }
  };



  // Fotoğraf veya GIF Yükleme
  const handlePhotoUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showNotification('Lütfen geçerli bir görsel veya GIF dosyası seçiniz.', 'warning');
      return;
    }

    // Hareketli GIF dosyası ise doğrudan Data URL olarak yükle (animasyonu bozulmasın)
    if (file.type === 'image/gif' || file.name.toLowerCase().endsWith('.gif')) {
      if (file.size > 5 * 1024 * 1024) {
        showNotification('GIF dosya boyutu en fazla 5MB olabilir.', 'warning');
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        const gifDataUrl = event.target.result;
        setSelectedAvatar(gifDataUrl);
        handleSaveAvatar(gifDataUrl);
      };
      reader.readAsDataURL(file);
      return;
    }

    // Normal fotoğraflar için kare kırpma ve optimize etme
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxSize = 256;
        let width = img.width;
        let height = img.height;

        // Kare kırpma ve ölçeklendirme
        const minDim = Math.min(width, height);
        const startX = (width - minDim) / 2;
        const startY = (height - minDim) / 2;

        canvas.width = maxSize;
        canvas.height = maxSize;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, startX, startY, minDim, minDim, 0, 0, maxSize, maxSize);

        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        setSelectedAvatar(dataUrl);
        handleSaveAvatar(dataUrl);
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  // Şifre Değiştirme
  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (!passwordForm.oldPassword) {
      showNotification('Lütfen mevcut şifrenizi giriniz.', 'warning');
      return;
    }
    if (!passwordForm.newPassword) {
      showNotification('Lütfen yeni şifrenizi giriniz.', 'warning');
      return;
    }
    if (passwordForm.newPassword.length < 4) {
      showNotification('Yeni şifreniz en az 4 karakter olmalıdır.', 'warning');
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      showNotification('Yeni şifreler birbiriyle eşleşmiyor.', 'warning');
      return;
    }

    setSavingPassword(true);
    try {
      const res = await apiPost('/api/auth/change-password', {
        userId: user.id,
        oldPassword: passwordForm.oldPassword,
        newPassword: passwordForm.newPassword,
        actor: user
      });

      if (res?.success) {
        showNotification('Şifreniz başarıyla değiştirildi! 🔐', 'success');
        setPasswordForm({ oldPassword: '', newPassword: '', confirmPassword: '' });
      } else {
        showNotification(res?.message || 'Mevcut şifre hatalı.', 'danger');
      }
    } catch (err) {
      showNotification('Hata: ' + err.message, 'danger');
    } finally {
      setSavingPassword(false);
    }
  };

  // Ses Bildirimini Test Et
  const testSound = () => {
    try {
      const audio = new Audio(notificationSound);
      audio.volume = 0.8;
      audio.play().catch(e => console.warn('Ses çalınamadı:', e));
      showNotification('🔔 Bildirim sesi test edildi!', 'info');
    } catch (err) {
      showNotification('Ses çalma hatası: ' + err.message, 'warning');
    }
  };

  const handleToggleSound = (enabled) => {
    setSoundEnabled(enabled);
    localStorage.setItem('user_sound_enabled', String(enabled));
    showNotification(`Bildirim sesleri ${enabled ? 'açıldı 🔔' : 'kapatıldı 🔕'}.`, 'info');
  };

  // Rol Rozeti Rengi ve Başlığı
  const getRoleBadge = () => {
    if (isSuperAdmin) {
      return (
        <span style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '4px 12px',
          borderRadius: 20,
          fontSize: 12,
          fontWeight: 800,
          background: 'linear-gradient(135deg, #f59e0b, #d97706)',
          color: '#ffffff',
          boxShadow: '0 2px 8px rgba(245, 158, 11, 0.4)',
          letterSpacing: 0.3
        }}>
          👑 Süper Yönetici
        </span>
      );
    }
    if (isAdmin) {
      return (
        <span style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '4px 12px',
          borderRadius: 20,
          fontSize: 12,
          fontWeight: 800,
          background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
          color: '#ffffff',
          boxShadow: '0 2px 8px rgba(59, 130, 246, 0.35)'
        }}>
          👑 {user?.role_name || 'Yönetici'}
        </span>
      );
    }
    return (
      <span style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 12px',
        borderRadius: 20,
        fontSize: 12,
        fontWeight: 700,
        background: 'rgba(16, 185, 129, 0.15)',
        color: '#10b981',
        border: '1px solid rgba(16, 185, 129, 0.3)'
      }}>
        🛠️ {user?.role_name || 'Teknisyen / Kullanıcı'}
      </span>
    );
  };

  return (
    <div style={{ width: '100%', height: '100%', overflowY: 'auto', padding: '24px 28px', boxSizing: 'border-box' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 22, paddingBottom: 50 }}>
        
        {/* ─── 1. HERO BAŞLIK & PROFİL ÖZETİ KARTI ─── */}
        <div className="card" style={{
          padding: '24px 28px',
          background: 'linear-gradient(145deg, var(--color-surface), var(--color-surface-alt, var(--color-surface)))',
          border: '1px solid var(--color-border)',
          borderRadius: 14,
          boxShadow: '0 8px 24px rgba(0,0,0,0.06)',
          position: 'relative',
          overflow: 'hidden'
        }}>
          {/* Dekoratif Arka Plan Parıltısı */}
          <div style={{
            position: 'absolute',
            top: -40,
            right: -40,
            width: 220,
            height: 220,
            borderRadius: '50%',
            background: 'radial-gradient(circle, var(--color-primary) 0%, transparent 70%)',
            opacity: 0.12,
            pointerEvents: 'none'
          }} />

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 20 }}>
            {/* Avatar & İsim */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
              <div 
                style={{ position: 'relative', cursor: 'pointer' }}
                onClick={() => setAvatarModalOpen(true)}
                title="Profil Avatarını Değiştirmek İçin Tıkla"
              >
                <UserAvatar user={user} size={82} fontSize={32} />
                <div style={{
                  position: 'absolute',
                  bottom: -2,
                  right: -2,
                  background: '#2563eb',
                  color: '#ffffff',
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '2.5px solid #ffffff',
                  boxShadow: '0 2px 10px rgba(0,0,0,0.5)',
                  transition: 'transform 0.15s ease'
                }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                </div>
              </div>

              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <h1 style={{ fontSize: 22, fontWeight: 900, color: 'var(--color-text)', margin: 0 }}>
                    {user?.full_name || user?.name || user?.username}
                  </h1>
                  {getRoleBadge()}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 6, color: 'var(--color-text-secondary)', fontSize: 13, flexWrap: 'wrap' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span>@</span>
                    <strong>{user?.username}</strong>
                  </span>
                  {user?.email && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span>✉️</span>
                      <span>{user.email}</span>
                    </span>
                  )}
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span>🆔</span>
                    <span>ID: #{user?.id || 1}</span>
                  </span>
                </div>
              </div>
            </div>

            {/* Hızlı İstatistik Rozetleri */}
            {(canViewService || canViewMaintenance) && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                {canViewService && (
                  <>
                    <div style={{
                      background: 'var(--color-surface)',
                      border: '1px solid var(--color-border)',
                      borderRadius: 10,
                      padding: '10px 16px',
                      textAlign: 'center',
                      minWidth: 95
                    }}>
                      <div style={{ fontSize: 11, color: 'var(--color-text-muted)', fontWeight: 600 }}>Çözülen Servis</div>
                      <div style={{ fontSize: 20, fontWeight: 900, color: '#10b981', marginTop: 2 }}>
                        {stats.loading ? '...' : stats.completedTickets}
                      </div>
                    </div>

                    <div style={{
                      background: 'var(--color-surface)',
                      border: '1px solid var(--color-border)',
                      borderRadius: 10,
                      padding: '10px 16px',
                      textAlign: 'center',
                      minWidth: 95
                    }}>
                      <div style={{ fontSize: 11, color: 'var(--color-text-muted)', fontWeight: 600 }}>Açık Servis</div>
                      <div style={{ fontSize: 20, fontWeight: 900, color: '#3b82f6', marginTop: 2 }}>
                        {stats.loading ? '...' : stats.openTickets}
                      </div>
                    </div>
                  </>
                )}

                {canViewMaintenance && (
                  <div style={{
                    background: 'var(--color-surface)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 10,
                    padding: '10px 16px',
                    textAlign: 'center',
                    minWidth: 95
                  }}>
                    <div style={{ fontSize: 11, color: 'var(--color-text-muted)', fontWeight: 600 }}>Bakım</div>
                    <div style={{ fontSize: 20, fontWeight: 900, color: '#f59e0b', marginTop: 2 }}>
                      {stats.loading ? '...' : stats.maintenanceCompleted}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ─── 2. PROFİL SEKMELERİ ─── */}
        <div style={{
          display: 'inline-flex',
          gap: 6,
          background: 'var(--color-surface-alt, var(--color-surface))',
          padding: '5px',
          borderRadius: 10,
          border: '1px solid var(--color-border)',
          alignSelf: 'flex-start',
          flexWrap: 'wrap'
        }}>
          {[
            { key: 'account', icon: '👤', label: 'Hesap & Güvenlik' },
            { key: 'notifications', icon: '🔔', label: 'Bildirimler & Ses' },
            { key: 'stats', icon: '📈', label: 'Aktivite & İstatistik' }
          ].map(tabItem => {
            const isActive = activeTab === tabItem.key;
            return (
              <button
                key={tabItem.key}
                type="button"
                onClick={() => setActiveTab(tabItem.key)}
                style={{
                  padding: '9px 18px',
                  borderRadius: 8,
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 13,
                  fontWeight: isActive ? 800 : 600,
                  background: isActive ? 'var(--color-primary)' : 'transparent',
                  color: isActive ? '#ffffff' : 'var(--color-text-secondary)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  transition: 'all 0.15s ease'
                }}
              >
                <span>{tabItem.icon}</span>
                <span>{tabItem.label}</span>
              </button>
            );
          })}
        </div>

        {/* ─── 3. SEKME İÇERİKLERİ ─── */}

        {/* TAB 1: HESAP BİLGİLERİ & ŞİFRE DEĞİŞTİRME */}
        {activeTab === 'account' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 20 }}>
            
            {/* Kişisel Bilgiler Formu */}
            <div className="card" style={{ padding: 22, border: '1px solid var(--color-border)', borderRadius: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, borderBottom: '1px solid var(--color-border)', paddingBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 20 }}>👤</span>
                  <div>
                    <h3 style={{ fontSize: 15, fontWeight: 800, color: 'var(--color-text)', margin: 0 }}>Kişisel Bilgiler</h3>
                    <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>Görünen adınız ve iletişim adresiniz</span>
                  </div>
                </div>

                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setAvatarModalOpen(true)}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, fontWeight: 700 }}
                >
                  <span>🎭</span>
                  <span>Avatarı Değiştir</span>
                </button>
              </div>

              <form onSubmit={handleUpdateProfile} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: 'var(--color-text-secondary)', marginBottom: 5 }}>
                    KULLANICI ADI (GİRİŞ KİMLİĞİ)
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    value={profileForm.username}
                    disabled
                    readOnly
                    style={{ opacity: 0.7, cursor: 'not-allowed', fontFamily: 'monospace' }}
                  />
                  <span style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4, display: 'block' }}>
                    Kullanıcı adı sistem güvenliği nedeniyle yalnızca yöneticiler tarafından değiştirilebilir.
                  </span>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: 'var(--color-text-secondary)', marginBottom: 5 }}>
                    AD SOYAD *
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    value={profileForm.full_name}
                    onChange={e => setProfileForm({ ...profileForm, full_name: e.target.value })}
                    placeholder="Örn: Ahmet YILMAZ"
                    required
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: 'var(--color-text-secondary)', marginBottom: 5 }}>
                    E-POSTA ADRESİ
                  </label>
                  <input
                    type="email"
                    className="form-control"
                    value={profileForm.email}
                    onChange={e => setProfileForm({ ...profileForm, email: e.target.value })}
                    placeholder="ad.soyad@example.com"
                  />
                </div>

                <div style={{ paddingTop: 6 }}>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={savingProfile}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 20px', fontWeight: 700 }}
                  >
                    <span>{savingProfile ? '⏳' : '💾'}</span>
                    <span>{savingProfile ? 'Kaydediliyor...' : 'Bilgilerimi Güncelle'}</span>
                  </button>
                </div>
              </form>
            </div>

            {/* Şifre Değiştirme Formu */}
            <div className="card" style={{ padding: 22, border: '1px solid var(--color-border)', borderRadius: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, borderBottom: '1px solid var(--color-border)', paddingBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 20 }}>🔐</span>
                  <div>
                    <h3 style={{ fontSize: 15, fontWeight: 800, color: 'var(--color-text)', margin: 0 }}>Şifremi Değiştir</h3>
                    <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>Hesap güvenliğiniz için güçlü bir şifre seçin</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--color-primary)', fontWeight: 600 }}
                >
                  {showPass ? '🙈 Şifreleri Gizle' : '👁️ Şifreleri Göster'}
                </button>
              </div>

              <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: 'var(--color-text-secondary)', marginBottom: 5 }}>
                    MEVCUT ŞİFRE *
                  </label>
                  <input
                    type={showPass ? 'text' : 'password'}
                    className="form-control"
                    value={passwordForm.oldPassword}
                    onChange={e => setPasswordForm({ ...passwordForm, oldPassword: e.target.value })}
                    placeholder="Şu anki şifrenizi giriniz"
                    required
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: 'var(--color-text-secondary)', marginBottom: 5 }}>
                    YENİ ŞİFRE *
                  </label>
                  <input
                    type={showPass ? 'text' : 'password'}
                    className="form-control"
                    value={passwordForm.newPassword}
                    onChange={e => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                    placeholder="En az 4 karakter"
                    required
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: 'var(--color-text-secondary)', marginBottom: 5 }}>
                    YENİ ŞİFRE (TEKRAR) *
                  </label>
                  <input
                    type={showPass ? 'text' : 'password'}
                    className="form-control"
                    value={passwordForm.confirmPassword}
                    onChange={e => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                    placeholder="Yeni şifrenizi tekrar giriniz"
                    required
                  />
                </div>

                <div style={{ paddingTop: 6 }}>
                  <button
                    type="submit"
                    className="btn btn-warning"
                    disabled={savingPassword}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 20px', fontWeight: 800, color: '#000' }}
                  >
                    <span>{savingPassword ? '⏳' : '🔑'}</span>
                    <span>{savingPassword ? 'Güncelleniyor...' : 'Şifreyi Güncelle'}</span>
                  </button>
                </div>
              </form>
            </div>

          </div>
        )}

        {/* TAB 2: BİLDİRİM & SES AYARLARI */}
        {activeTab === 'notifications' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            
            {/* Sesli Bildirim Kartı */}
            <div className="card" style={{ padding: 22, border: '1px solid var(--color-border)', borderRadius: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, borderBottom: '1px solid var(--color-border)', paddingBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 20 }}>🔊</span>
                  <div>
                    <h3 style={{ fontSize: 15, fontWeight: 800, color: 'var(--color-text)', margin: 0 }}>Uygulama İçi Ses Bildirimleri</h3>
                    <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>Yeni servis fişi veya acil görev geldiğinde çalacak ses</span>
                  </div>
                </div>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={testSound}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, padding: '6px 14px' }}
                >
                  <span>🎵</span>
                  <span>Sesi Test Et</span>
                </button>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text)' }}>
                    Sesli Uyarılar
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 }}>
                    Sistem üzerinden anlık bildirim geldiğinde ses çalınır.
                  </div>
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', margin: 0 }}>
                  <input
                    type="checkbox"
                    checked={soundEnabled}
                    onChange={e => handleToggleSound(e.target.checked)}
                    style={{ width: 20, height: 20, accentColor: 'var(--color-primary)', cursor: 'pointer' }}
                  />
                  <span style={{ fontSize: 12, fontWeight: 700, color: soundEnabled ? 'var(--color-success)' : 'var(--color-text-muted)' }}>
                    {soundEnabled ? 'Açık 🔔' : 'Kapalı 🔕'}
                  </span>
                </label>
              </div>
            </div>

            {/* Web Push Kartı */}
            <WebPushSettings showNotification={showNotification} />
          </div>
        )}

        {/* TAB 3: AKTİVİTE & İSTATİSTİKLER */}
        {activeTab === 'stats' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div className="card" style={{ padding: 22, border: '1px solid var(--color-border)', borderRadius: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, borderBottom: '1px solid var(--color-border)', paddingBottom: 12 }}>
                <span style={{ fontSize: 20 }}>📊</span>
                <div>
                  <h3 style={{ fontSize: 15, fontWeight: 800, color: 'var(--color-text)', margin: 0 }}>Kişisel Performans & Katkı Özeti</h3>
                  <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>Sistem üzerindeki toplam operasyonel kayıtlarınız</span>
                </div>
              </div>

              {canViewService || canViewMaintenance ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
                  {canViewService && (
                    <>
                      <div style={{ padding: 18, background: 'rgba(16, 185, 129, 0.08)', borderRadius: 10, border: '1px solid rgba(16, 185, 129, 0.25)' }}>
                        <div style={{ fontSize: 28, marginBottom: 6 }}>✅</div>
                        <div style={{ fontSize: 24, fontWeight: 900, color: '#10b981' }}>{stats.completedTickets}</div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text)', marginTop: 4 }}>Tamamlanan Servis Fişleri</div>
                        <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 }}>Başarıyla çözüme kavuşturulup kapatılan kayıtlar</div>
                      </div>

                      <div style={{ padding: 18, background: 'rgba(59, 130, 246, 0.08)', borderRadius: 10, border: '1px solid rgba(59, 130, 246, 0.25)' }}>
                        <div style={{ fontSize: 28, marginBottom: 6 }}>⏳</div>
                        <div style={{ fontSize: 24, fontWeight: 900, color: '#3b82f6' }}>{stats.openTickets}</div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text)', marginTop: 4 }}>Üzerindeki Açık Servisler</div>
                        <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 }}>İşlem bekleyen veya devam eden servisler</div>
                      </div>
                    </>
                  )}

                  {canViewMaintenance && (
                    <div style={{ padding: 18, background: 'rgba(245, 158, 11, 0.08)', borderRadius: 10, border: '1px solid rgba(245, 158, 11, 0.25)' }}>
                      <div style={{ fontSize: 28, marginBottom: 6 }}>🛡️</div>
                      <div style={{ fontSize: 24, fontWeight: 900, color: '#f59e0b' }}>{stats.maintenanceCompleted}</div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text)', marginTop: 4 }}>Tamamlanan Periyodik Bakım</div>
                      <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 }}>Kontrolü ve bakımı yapılmış cihaz sayısı</div>
                    </div>
                  )}

                  <div style={{ padding: 18, background: 'rgba(139, 92, 246, 0.08)', borderRadius: 10, border: '1px solid rgba(139, 92, 246, 0.25)' }}>
                    <div style={{ fontSize: 28, marginBottom: 6 }}>⚡</div>
                    <div style={{ fontSize: 24, fontWeight: 900, color: '#8b5cf6' }}>
                      {(canViewService ? stats.completedTickets : 0) + (canViewMaintenance ? stats.maintenanceCompleted : 0)}
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text)', marginTop: 4 }}>Toplam Operasyonel Etki</div>
                    <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 }}>Yetkili olunan modüllerdeki toplam iş hacmi</div>
                  </div>
                </div>
              ) : (
                <div style={{ padding: '20px', background: 'var(--color-surface)', border: '1px dashed var(--color-border)', borderRadius: 10, textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 13 }}>
                  🔒 Hesabınızda servis veya bakım modülü görüntüleme yetkisi bulunmadığı için operasyonel istatistikler gizlenmiştir.
                </div>
              )}

              {/* Oturum & Cihaz Bilgisi */}
              <div style={{ marginTop: 20, padding: 16, background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 10 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-secondary)', marginBottom: 8 }}>
                  💻 MEVCUT OTURUM & PLATFORM BİLGİSİ
                </div>
                <div style={{ fontSize: 11, color: 'var(--color-text-muted)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10, fontFamily: 'monospace' }}>
                  <div>Tarayıcı / Agent: {navigator.userAgent.slice(0, 45)}...</div>
                  <div>Çözünürlük: {window.innerWidth} x {window.innerHeight} px</div>
                  <div>Dil: {navigator.language}</div>
                  <div>Platform: {navigator.platform || 'Win32'}</div>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* ─── 4. AVATAR & KARAKTER SEÇİM POPUP MODALI ─── */}
      {avatarModalOpen && (
        <Modal 
          isOpen={avatarModalOpen} 
          onClose={() => setAvatarModalOpen(false)} 
          title="🎭 Profil Avatarı & Karakter Stüdyosu" 
          size="lg"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18, padding: '4px 6px' }}>
            
            {/* Canlı Avatar Önizleme Kartı */}
            <div style={{
              padding: '16px 20px',
              border: '1px solid var(--color-border)',
              borderRadius: 12,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 16,
              background: 'var(--color-surface-alt, var(--color-surface))'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <UserAvatar user={{ ...user, avatar: selectedAvatar }} size={76} fontSize={28} />
                <div>
                  <h4 style={{ fontSize: 15, fontWeight: 800, color: 'var(--color-text)', margin: 0 }}>
                    Seçili Avatarınız
                  </h4>
                  <div style={{ fontSize: 11.5, color: 'var(--color-text-muted)', marginTop: 2 }}>
                    Galeriden bir karakter seçin veya bilgisayarınızdan kendi fotoğraf/GIF'inizi yükleyin.
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {selectedAvatar && (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => handleSaveAvatar('')}
                    disabled={savingAvatar}
                    style={{ fontSize: 11 }}
                  >
                    ↺ Varsayılana Dön
                  </button>
                )}
                
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handlePhotoUpload}
                  accept="image/*,.gif"
                  style={{ display: 'none' }}
                />

                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => fileInputRef.current?.click()}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: 12 }}
                >
                  <span>📷</span>
                  <span>Görsel / GIF Yükle</span>
                </button>
              </div>
            </div>

            {/* 1. Hazır Karakter & İkon Galerisi */}
            <div>
              <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--color-text)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>🎭</span>
                <span>Hazır Karakterler & Emojiler</span>
              </div>

              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(105px, 1fr))',
                gap: 10
              }}>
                {AVATAR_PRESETS.filter(p => p.type === 'emoji').map(preset => {
                  const isSelected = selectedAvatar === preset.id;
                  return (
                    <div
                      key={preset.id}
                      onClick={() => handleSaveAvatar(preset.id)}
                      style={{
                        padding: '12px 8px',
                        borderRadius: 10,
                        border: isSelected ? '2.5px solid var(--color-primary)' : '1px solid var(--color-border)',
                        background: isSelected ? 'rgba(59, 130, 246, 0.12)' : 'var(--color-surface)',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 6,
                        transition: 'all 0.15s ease',
                        boxShadow: isSelected ? '0 3px 12px rgba(59, 130, 246, 0.25)' : 'none'
                      }}
                    >
                      <div style={{
                        width: 44,
                        height: 44,
                        borderRadius: '50%',
                        background: preset.bg,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 22,
                        boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
                      }}>
                        {preset.icon}
                      </div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text)', textAlign: 'center' }}>
                        {preset.label}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 2. Özel Renkli Degrade Baş Harf Paletleri */}
            <div>
              <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--color-text)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>🌈</span>
                <span>Renkli Degrade Baş Harf Paletleri</span>
              </div>

              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(115px, 1fr))',
                gap: 10
              }}>
                {AVATAR_PRESETS.filter(p => p.type === 'gradient').map(preset => {
                  const isSelected = selectedAvatar === preset.id;
                  return (
                    <div
                      key={preset.id}
                      onClick={() => handleSaveAvatar(preset.id)}
                      style={{
                        padding: '12px 8px',
                        borderRadius: 10,
                        border: isSelected ? '2.5px solid var(--color-primary)' : '1px solid var(--color-border)',
                        background: isSelected ? 'rgba(59, 130, 246, 0.12)' : 'var(--color-surface)',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 6,
                        transition: 'all 0.15s ease',
                        boxShadow: isSelected ? '0 3px 12px rgba(59, 130, 246, 0.25)' : 'none'
                      }}
                    >
                      <UserAvatar user={{ ...user, avatar: preset.id }} size={44} fontSize={17} />
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text)', textAlign: 'center' }}>
                        {preset.label}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

          </div>
        </Modal>
      )}

    </div>
  );
}
