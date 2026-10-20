import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useApp } from '../../context/AppContext';
import '../../styles/toolbar.css';
import logo from '../../assets/logo.png';

import SnipeItAiDrawer from '../common/SnipeItAiDrawer';
import UserAvatar from '../common/UserAvatar';

const TOOLBAR_ITEMS = [
  { id: 'dashboard',    icon: '📊', label: 'Dashboard',      tab: { id: 'dashboard', label: 'Dashboard', icon: '📊', module: 'Dashboard', closable: false } },
  { id: 'tickets',      icon: '🔧', label: 'Servis Fişleri', tab: { id: 'service-tickets', label: 'Servis Fişleri', icon: '🔧', module: 'ServiceTickets' } },
  { id: 'sep1', sep: true },
  { id: 'toner',        icon: '🖨️', label: 'Toner Takibi',  tab: { id: 'toner', label: 'Toner & Kartuş', icon: '🖨️', module: 'Toner' } },
  { id: 'stock',        icon: '📦', label: 'Stok / Parça',   tab: { id: 'stock', label: 'Stok / Parça', icon: '📦', module: 'Stock' } },
  { id: 'sep2', sep: true },
  { id: 'maintenance',  icon: '🗓️', label: 'Operasyon & Bakım', tab: { id: 'maintenance', label: 'Operasyon Takvimi', icon: '🗓️', module: 'Maintenance' } },
  { id: 'inventory',    icon: '🖥️', label: 'Envanter',       tab: { id: 'inventory', label: 'Envanter (Demirbaşlar)', icon: '🖥️', module: 'Inventory' } },
  { id: 'sep3', sep: true },
  { id: 'users',        icon: '🧑‍💻', label: 'Kullanıcılar',  tab: { id: 'users', label: 'Personel (Snipe-IT)', icon: '🧑‍💻', module: 'Users' } },
  { id: 'docs-forms',   icon: '✍️', label: 'Tutanak & Etiket', tab: { id: 'docs-forms', label: 'Tutanak & Etiket', icon: '✍️', module: 'DocsAndLabels' } },
  { id: 'cargo',        icon: '🚚', label: 'Kargo Takip',    tab: { id: 'cargo', label: 'Kargo Takip', icon: '🚚', module: 'Cargo' } },
  { id: 'bitlocker',    icon: '🔐', label: 'BitLocker',      tab: { id: 'bitlocker', label: 'BitLocker Vault', icon: '🔐', module: 'Bitlocker' } },
  { id: 'files',         icon: '📁', label: 'Dosyalar',      tab: { id: 'files', label: 'Dosyalar', icon: '📁', module: 'FilesManager' } },
  { id: 'snipe-ai',      icon: '🤖', label: 'Snipe-IT AI',   isAction: true, adminOnly: true },
  { id: 'settings',      icon: '⚙️', label: 'Ayarlar',       tab: { id: 'settings', label: 'Ayarlar', icon: '⚙️', module: 'Settings' }, adminOnly: true },
];

export default function Toolbar() {
  const { user, logout, hasPermission } = useAuth();
  const { openTab, activeTab, theme, openThemeModal, settings, showNotification, triggerRefresh, isSnipeItEnabled, isAiEnabled } = useApp();
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [updateProgress, setUpdateProgress] = useState(null);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showMobileDrawer, setShowMobileDrawer] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [isSnipeAiOpen, setIsSnipeAiOpen] = useState(false);

  const isAdmin = user?.role === 'admin' || 
                  user?.is_admin === 1 || 
                  user?.is_admin === true || 
                  user?.role_name?.toLowerCase().includes('admin') ||
                  hasPermission('settings', 'can_admin') || 
                  hasPermission('users', 'can_admin');

  const handleSnipeSync = async () => {
    setShowUserMenu(false);
    setShowMobileDrawer(false);
    setSyncing(true);
    showNotification('Snipe-IT senkronizasyonu başlatıldı...', 'info');
    try {
      const res = await window.electronAPI.snipeitSync();
      if (res?.success) {
        showNotification('Snipe-IT verileri başarıyla güncellendi.', 'success');
        triggerRefresh();
      } else {
        showNotification('Senkronizasyon başarısız: ' + (res?.message || 'Bilinmeyen hata'), 'danger');
      }
    } catch (err) {
      showNotification('Senkronizasyon hatası: ' + err.message, 'danger');
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    const handleGlobalClick = () => {
      setShowUserMenu(false);
    };
    window.addEventListener('click', handleGlobalClick);
    return () => window.removeEventListener('click', handleGlobalClick);
  }, []);

  const initials = user?.full_name
    ? user.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : user?.username?.slice(0, 2).toUpperCase() || 'ST';

  const MODULE_PERMISSIONS = {
    Dashboard: ['dashboard', 'can_view'],
    ServiceTickets: ['service', 'can_view'],
    TasksModule: ['tasks', 'can_view'],
    Toner: ['toner', 'can_view'],
    Stock: ['stock', 'can_view'],
    Reports: ['reports', 'can_view'],
    Maintenance: ['maintenance', 'can_view'],
    Inventory: ['inventory', 'can_view'],
    Users: ['users', 'can_view'],
    AddressLabel: ['address_label', 'can_view'],
    HandoverProtocol: ['handover', 'can_view'],
    DocsAndLabels: ['docs_forms', 'can_view'],
    Cargo: ['cargo', 'can_view'],
    Bitlocker: ['bitlocker', 'can_view'],
    FilesManager: ['files', 'can_view'],
    Settings: ['settings', 'can_admin'],
  };

  const allowedItems = TOOLBAR_ITEMS.filter((item) => {
    if (item.sep) return true;
    if (item.id === 'settings') return false;
    if (item.id === 'inventory' && !isSnipeItEnabled) return false;
    if (item.id === 'snipe-ai' && (!isAdmin || !isAiEnabled)) return false;
    if (item.adminOnly && !isAdmin) return false;
    if (item.tab) {
      if (item.tab.module === 'DocsAndLabels') {
        const canDocs = hasPermission('docs_forms', 'can_view') || hasPermission('address_label', 'can_view') || hasPermission('handover', 'can_view');
        if (!canDocs) return false;
      } else {
        const permMapping = MODULE_PERMISSIONS[item.tab.module];
        if (permMapping && !hasPermission(permMapping[0], permMapping[1])) {
          return false;
        }
      }
    }
    return true;
  }).map(item => {
    if (item.id === 'users' && !isSnipeItEnabled) {
      return {
        ...item,
        label: 'Personel',
        tab: { ...item.tab, label: 'Personel' }
      };
    }
    return item;
  });

  const filteredNavItems = allowedItems.filter((item, index, array) => {
    if (!item.sep) return true;
    if (index === 0 || index === array.length - 1) return false;
    if (array[index - 1]?.sep) return false;
    return true;
  });

  return (
    <>
      <div className="toolbar">
        {/* Mobile Hamburger Button */}
        <button
          className="mobile-nav-toggle"
          onClick={() => setShowMobileDrawer(true)}
          title="Tüm Modüller"
        >
          <span>☰</span>
          <span>Menü</span>
        </button>

        {/* Logo */}
        <div className="toolbar-logo">
          <div className="toolbar-logo-icon">
            <img src={logo} alt="Servis Takip" />
          </div>
          <div className="toolbar-logo-text">
            <span>{settings?.brand_title || 'Örnek Teknoloji A.Ş.'}</span>
            <span>{settings?.brand_subtitle || 'Servis Takip'}</span>
          </div>
        </div>

        {/* Horizontal Swipeable Nav Strip */}
        <div 
          className="toolbar-nav-scroll"
          onWheel={(e) => {
            if (e.deltaY !== 0) {
              e.currentTarget.scrollLeft += e.deltaY;
            }
          }}
        >
          {filteredNavItems.map((item) => {
            if (item.sep) return <div key={item.id} className="toolbar-sep" />;

            if (item.isAction) {
              return (
                <button
                  key={item.id}
                  id={`toolbar-btn-${item.id}`}
                  className="toolbar-btn snipe-ai-toolbar-btn"
                  title={item.label}
                  onClick={() => setIsSnipeAiOpen(true)}
                  style={{
                    background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.22), rgba(99, 102, 241, 0.22))',
                    border: '1px solid rgba(168, 85, 247, 0.5)',
                    boxShadow: '0 0 12px rgba(168, 85, 247, 0.3)',
                  }}
                >
                  <span className="toolbar-btn-icon" style={{ filter: 'drop-shadow(0 0 6px #c084fc)' }}>{item.icon}</span>
                  <span className="toolbar-btn-label" style={{ fontWeight: 700, color: '#f3e8ff' }}>{item.label}</span>
                </button>
              );
            }

            const isActive = activeTab === item.tab?.id;
            return (
              <button
                key={item.id}
                id={`toolbar-btn-${item.id}`}
                className={`toolbar-btn${isActive ? ' active' : ''}`}
                title={item.label}
                onClick={() => openTab(item.tab)}
              >
                <span className="toolbar-btn-icon">{item.icon}</span>
                <span className="toolbar-btn-label">{item.label}</span>
              </button>
            );
          })}
        </div>

        {/* Quick Guide Wizard Button */}
        <button
          className="toolbar-btn"
          title="Bu Bölümün Kullanım Sihirbazını Aç"
          onClick={() => window.openModuleGuide?.()}
          style={{
            background: 'rgba(59, 130, 246, 0.15)',
            border: '1px solid rgba(59, 130, 246, 0.35)',
            color: '#38bdf8',
            fontWeight: 700,
            borderRadius: 8,
            padding: '4px 10px',
            marginRight: 6
          }}
        >
          <span className="toolbar-btn-icon">💡</span>
          <span className="toolbar-btn-label">Sihirbaz</span>
        </button>

        {/* Office Rules Button */}
        <button
          className="toolbar-btn"
          title="Teknik Ofis Çalışma & Disiplin Kurallarını Aç"
          onClick={() => window.openOfficeRules?.()}
          style={{
            background: 'rgba(245, 158, 11, 0.15)',
            border: '1px solid rgba(245, 158, 11, 0.35)',
            color: '#fbbf24',
            fontWeight: 700,
            borderRadius: 8,
            padding: '4px 10px',
            marginRight: 6
          }}
        >
          <span className="toolbar-btn-icon">📜</span>
          <span className="toolbar-btn-label">Kurallar</span>
        </button>

        {/* User Profile Button */}
        <div style={{ position: 'relative', zIndex: 10001 }}>
          <button 
            className={`toolbar-user-btn ${showUserMenu ? 'active' : ''}`}
            onClick={(e) => { e.stopPropagation(); setShowUserMenu(!showUserMenu); }}
          >
            <div className="toolbar-user-info">
              <span>{user?.full_name}</span>
              <span>{user?.role_name}</span>
            </div>
            <UserAvatar user={user} size={28} />
          </button>

          {showUserMenu && (
            <>
              <div 
                style={{ position: 'fixed', inset: 0, zIndex: 99998, background: 'transparent' }} 
                onClick={() => setShowUserMenu(false)} 
              />
              <div className="toolbar-user-dropdown" onClick={(e) => e.stopPropagation()}>
                <button className="toolbar-dropdown-item" onClick={() => { setShowUserMenu(false); openTab({ id: 'profile', label: 'Profilim', icon: '👤', module: 'Profile' }); }}>
                  <span style={{ fontSize: 16 }}>👤</span>
                  Profilim
                </button>

              <button className="toolbar-dropdown-item" onClick={() => { setShowUserMenu(false); window.openModuleGuide?.(); }}>
                <span style={{ fontSize: 16 }}>💡</span>
                Kullanım Sihirbazı
              </button>

              <button className="toolbar-dropdown-item" onClick={() => { setShowUserMenu(false); window.openOfficeRules?.(); }}>
                <span style={{ fontSize: 16 }}>📜</span>
                Teknik Ofis Kuralları
              </button>

              <button className="toolbar-dropdown-item" onClick={() => { setShowUserMenu(false); openThemeModal(); }}>
                <span style={{ fontSize: 16 }}>🎨</span>
                Temalar & Görünüm
              </button>

              {hasPermission('reports', 'can_view') && (
                <button className="toolbar-dropdown-item" onClick={() => { setShowUserMenu(false); openTab({ id: 'reports', label: 'Raporlar', icon: '📈', module: 'Reports' }); }}>
                  <span style={{ fontSize: 16 }}>📈</span> Raporlar
                </button>
              )}

              {hasPermission('settings', 'can_admin') && (
                <button className="toolbar-dropdown-item" onClick={() => { setShowUserMenu(false); openTab({ id: 'settings', label: 'Ayarlar', icon: '⚙️', module: 'Settings' }); }}>
                  <span style={{ fontSize: 16 }}>⚙️</span> Ayarlar
                </button>
              )}

              {isSnipeItEnabled && (
                <button className="toolbar-dropdown-item" onClick={handleSnipeSync} disabled={syncing}>
                  <span style={{ fontSize: 16 }}>🔄</span> {syncing ? 'Senkronize Ediliyor...' : 'Snipe-IT Senkronize Et'}
                </button>
              )}

              <div className="toolbar-dropdown-sep" />
              
              <button className="toolbar-dropdown-item danger" onClick={() => { setShowUserMenu(false); logout(); }}>
                <span style={{ fontSize: 16 }}>🚪</span> Çıkış Yap
              </button>
            </div>
          </>
          )}
        </div>
      </div>

      {/* ── MOBILE MENU DRAWER ── */}
      {showMobileDrawer && (
        <div className="mobile-drawer-backdrop" onClick={() => setShowMobileDrawer(false)}>
          <div className="mobile-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="mobile-drawer-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <img src={logo} alt="Logo" style={{ height: 28, objectFit: 'contain' }} />
                <div>
                  <div style={{ fontWeight: 800, fontSize: 13, color: 'var(--color-text)' }}>{settings?.brand_title || 'Örnek Teknoloji A.Ş.'}</div>
                  <div style={{ fontSize: 10, color: 'var(--color-text-secondary)' }}>Servis & Bakım Takip</div>
                </div>
              </div>
              <button
                onClick={() => setShowMobileDrawer(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--color-text-secondary)', fontSize: 20, cursor: 'pointer', padding: 4 }}
              >
                ✕
              </button>
            </div>

            {/* Modules List */}
            <div style={{ flex: 1, padding: '8px 0', overflowY: 'auto' }}>
              <div style={{ padding: '8px 16px 4px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-muted)', letterSpacing: 0.5 }}>
                Sistem Modülleri
              </div>

              {allowedItems.filter(i => !i.sep).map((item) => {
                if (item.isAction) {
                  return (
                    <button
                      key={item.id}
                      className="mobile-drawer-item"
                      onClick={() => {
                        setIsSnipeAiOpen(true);
                        setShowMobileDrawer(false);
                      }}
                    >
                      <span style={{ fontSize: 18 }}>{item.icon}</span>
                      <span>{item.label}</span>
                    </button>
                  );
                }
                const isActive = activeTab === item.tab?.id;
                return (
                  <button
                    key={item.id}
                    className={`mobile-drawer-item ${isActive ? 'active' : ''}`}
                    onClick={() => {
                      openTab(item.tab);
                      setShowMobileDrawer(false);
                    }}
                  >
                    <span style={{ fontSize: 18 }}>{item.icon}</span>
                    <span>{item.label}</span>
                  </button>
                );
              })}

              <div style={{ height: 1, background: 'var(--color-border)', margin: '8px 0' }} />

              <button
                className="mobile-drawer-item"
                onClick={() => {
                  setShowMobileDrawer(false);
                  openTab({ id: 'profile', label: 'Profilim', icon: '👤', module: 'Profile' });
                }}
                style={{ background: 'rgba(59, 130, 246, 0.12)', color: '#38bdf8', fontWeight: 700 }}
              >
                <span style={{ fontSize: 18 }}>👤</span>
                <span>Profilim</span>
              </button>

              <button
                className="mobile-drawer-item"
                onClick={() => {
                  setShowMobileDrawer(false);
                  window.openModuleGuide?.();
                }}
              >
                <span style={{ fontSize: 18 }}>💡</span>
                <span>Kullanım Sihirbazı</span>
              </button>

              <button
                className="mobile-drawer-item"
                onClick={() => {
                  setShowMobileDrawer(false);
                  window.openOfficeRules?.();
                }}
              >
                <span style={{ fontSize: 18 }}>📜</span>
                <span>Teknik Ofis Kuralları</span>
              </button>

              <button
                className="mobile-drawer-item"
                onClick={() => {
                  setShowMobileDrawer(false);
                  openThemeModal();
                }}
              >
                <span style={{ fontSize: 18 }}>🎨</span>
                <span>Temalar & Görünüm</span>
              </button>

              {isSnipeItEnabled && (
                <button
                  className="mobile-drawer-item"
                  onClick={handleSnipeSync}
                  disabled={syncing}
                >
                  <span style={{ fontSize: 18 }}>🔄</span>
                  <span>{syncing ? 'Senkronize Ediliyor...' : 'Snipe-IT Senkronize Et'}</span>
                </button>
              )}
            </div>

            {/* Drawer User Info Footer */}
            <div style={{
              padding: 14,
              borderTop: '1px solid var(--color-border)',
              background: 'var(--color-surface)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <UserAvatar user={user} size={34} />
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text)' }}>{user?.full_name}</div>
                  <div style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>{user?.role_name}</div>
                </div>
              </div>
              <button
                className="btn btn-sm btn-danger"
                onClick={() => {
                  setShowMobileDrawer(false);
                  logout();
                }}
                style={{ fontSize: 11 }}
              >
                Çıkış
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Snipe-IT AI Envanter Komutanı Drawer (Sadece Adminler İçin) */}
      {isAdmin && (
        <SnipeItAiDrawer isOpen={isSnipeAiOpen} onClose={() => setIsSnipeAiOpen(false)} />
      )}
    </>
  );
}
