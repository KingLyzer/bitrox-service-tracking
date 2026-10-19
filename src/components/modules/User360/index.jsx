import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useApp } from '../../../context/AppContext';
import UserAvatar from '../../common/UserAvatar';
import Modal from '../../common/Modal';
import ServiceTicketDetail from '../ServiceTickets/ServiceTicketDetail';

const formatDateTime = (value) => {
  if (!value) return '—';
  if (value instanceof Date) {
    const yyyy = value.getFullYear();
    const mm = String(value.getMonth() + 1).padStart(2, '0');
    const dd = String(value.getDate()).padStart(2, '0');
    const hh = String(value.getHours()).padStart(2, '0');
    const min = String(value.getMinutes()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
  }
  return String(value).slice(0, 16).replace('T', ' ');
};

const formatDate = (value) => {
  if (!value) return '—';
  return String(value).slice(0, 10);
};

export default function User360({ tabData, tabId }) {
  const { openTab, showNotification } = useApp();

  // Selected user: from tabData or default to active search
  const [targetUser, setTargetUser] = useState(tabData?.user || null);
  const [profileData, setProfileData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedTicket, setSelectedTicket] = useState(null);

  // Search input inside User360
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const searchDebounceRef = useRef(null);
  const searchContainerRef = useRef(null);

  // Tabs & Views
  const [activeTab, setActiveTab] = useState('all'); // 'all', 'assets', 'tickets', 'toners', 'cargos', 'security'
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'tabs'

  // BitLocker key reveal state
  const [visibleKeys, setVisibleKeys] = useState({});
  const [copiedKeyId, setCopiedKeyId] = useState(null);

  // Update target user if tabData changes
  useEffect(() => {
    if (tabData?.user) {
      setTargetUser(tabData.user);
    }
  }, [tabData?.user]);

  // Fetch full 360 profile data
  const fetchProfile = async (user) => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const param = user.id ? `id=${user.id}` : `name=${encodeURIComponent(user.name || '')}`;
      const res = await fetch(`${window.API_BASE || ''}/api/user360/profile?${param}`);
      const data = await res.json();
      if (data.success) {
        setProfileData(data);
      } else {
        setError(data.message || 'Kullanıcı verileri yüklenemedi.');
      }
    } catch (err) {
      console.error('[User360] Fetch error:', err);
      setError('Bağlantı hatası oluştu.');
    } finally {
      setLoading(false);
    }
  };

  // Trigger load on targetUser change
  useEffect(() => {
    if (targetUser) {
      fetchProfile(targetUser);
    } else {
      // If no initial user, fetch default first user or search
      (async () => {
        try {
          const res = await fetch(`${window.API_BASE || ''}/api/cached/users`);
          const data = await res.json();
          if (data.success && data.data?.length > 0) {
            setTargetUser(data.data[0]);
          }
        } catch {}
      })();
    }
  }, [targetUser?.id, targetUser?.name]);

  // Global click to close search dropdown
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target)) {
        setIsSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // Handle personnel search
  const handleSearchChange = (text) => {
    setSearchQuery(text);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    if (!text || text.trim().length < 2) {
      setSearchResults([]);
      setIsSearchOpen(false);
      return;
    }

    setSearchLoading(true);
    setIsSearchOpen(true);
    searchDebounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`${window.API_BASE || ''}/api/user360/search?q=${encodeURIComponent(text.trim())}`);
        const data = await res.json();
        if (data.success) {
          setSearchResults(data.results || []);
        }
      } catch (err) {
        console.error('[User360:Search] error:', err);
      } finally {
        setSearchLoading(false);
      }
    }, 250);
  };

  const handleSelectUser = (userItem) => {
    setTargetUser(userItem);
    setSearchQuery('');
    setIsSearchOpen(false);
  };

  const toggleKeyVisibility = (id) => {
    setVisibleKeys(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const copyToClipboard = (text, keyId) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedKeyId(keyId);
    showNotification('BitLocker anahtarı panoya kopyalandı.', 'success');
    setTimeout(() => {
      setCopiedKeyId(null);
    }, 2000);
  };

  const user = profileData?.user || targetUser;
  const assets = profileData?.assets || [];
  const tickets = profileData?.tickets || [];
  const toners = profileData?.toners || [];
  const cargos = profileData?.cargos || [];
  const bitlockers = profileData?.bitlockers || [];
  const stats = profileData?.stats || {
    total_assets: assets.length,
    open_tickets: 0,
    total_tickets: tickets.length,
    total_toners: 0,
    total_cargos: cargos.length,
    has_bitlocker: bitlockers.length > 0,
  };

  // Status badge styling helper for service tickets
  const getTicketStatusBadge = (status) => {
    const s = String(status || '').toLowerCase();
    let bg = 'rgba(100, 116, 139, 0.15)';
    let color = '#94a3b8';
    let border = 'rgba(148, 163, 184, 0.25)';

    if (s.includes('teslim') || s.includes('çözüldü') || s.includes('tamam')) {
      bg = 'rgba(16, 185, 129, 0.15)';
      color = '#10b981';
      border = 'rgba(16, 185, 129, 0.3)';
    } else if (s.includes('bekli') || s.includes('incele')) {
      bg = 'rgba(245, 158, 11, 0.15)';
      color = '#f59e0b';
      border = 'rgba(245, 158, 11, 0.3)';
    } else if (s.includes('yeni') || s.includes('açık')) {
      bg = 'rgba(56, 189, 248, 0.15)';
      color = '#38bdf8';
      border = 'rgba(56, 189, 248, 0.3)';
    } else if (s.includes('iptal')) {
      bg = 'rgba(239, 68, 68, 0.15)';
      color = '#ef4444';
      border = 'rgba(239, 68, 68, 0.3)';
    }

    return (
      <span style={{
        padding: '3px 8px',
        borderRadius: 12,
        fontSize: 11,
        fontWeight: 700,
        background: bg,
        color: color,
        border: `1px solid ${border}`,
        whiteSpace: 'nowrap',
        display: 'inline-block'
      }}>
        {status || 'Belirtilmemiş'}
      </span>
    );
  };

  // Priority badge helper
  const getPriorityBadge = (priority) => {
    const p = String(priority || '').toLowerCase();
    let color = '#94a3b8';
    if (p.includes('yüksek') || p.includes('acil')) color = '#ef4444';
    else if (p.includes('orta')) color = '#f59e0b';
    else if (p.includes('düşük')) color = '#10b981';

    return (
      <span style={{ fontSize: 11, fontWeight: 700, color }}>
        ● {priority || 'Normal'}
      </span>
    );
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      overflow: 'hidden',
      background: 'var(--color-bg, #0b0f19)',
      color: 'var(--color-text)',
      position: 'relative',
      zIndex: 1,
    }}>
      {/* ── 1. ÜST HEADER: BAŞLIK + AKILLI ARAMA ÇUBUĞU + YENİLE ── */}
      <div style={{
        padding: '12px 20px',
        background: 'linear-gradient(180deg, var(--color-surface) 0%, var(--color-surface-alt) 100%)',
        borderBottom: '1px solid var(--color-border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 12,
        boxShadow: '0 2px 10px rgba(0, 0, 0, 0.08)',
        zIndex: 20,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            background: 'linear-gradient(135deg, var(--color-primary, #38bdf8), #0284c7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 18,
            boxShadow: '0 2px 8px rgba(56, 189, 248, 0.35)',
            color: '#fff',
          }}>
            👤
          </div>
          <div>
            <h1 style={{ fontSize: 16, fontWeight: 800, margin: 0, letterSpacing: '-0.3px', color: 'var(--color-text)' }}>
              Kullanıcı 360° Görünümü
            </h1>
            <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 1 }}>
              Tüm IT Envanter, Servis, Toner, Kargo ve Güvenlik Geçmişi
            </div>
          </div>
        </div>

        {/* Akıllı Personel Arama Çubuğu */}
        <div ref={searchContainerRef} style={{ position: 'relative', width: 340, maxWidth: '100%' }}>
          <div style={{ position: 'relative' }}>
            <span style={{
              position: 'absolute',
              left: 10,
              top: '50%',
              transform: 'translateY(-50%)',
              fontSize: 13,
              opacity: 0.6,
              pointerEvents: 'none',
            }}>
              🔍
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              onFocus={() => { if (searchResults.length > 0) setIsSearchOpen(true); }}
              placeholder="Personel adı, sicil no veya cihaz ara..."
              style={{
                width: '100%',
                height: 36,
                paddingLeft: 32,
                paddingRight: searchQuery ? 30 : 12,
                borderRadius: 8,
                fontSize: 12,
                background: 'var(--input-bg, var(--color-surface))',
                border: '1px solid var(--input-border, var(--color-border))',
                color: 'var(--color-text)',
                outline: 'none',
                boxSizing: 'border-box',
                transition: 'border-color 0.2s',
              }}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => { setSearchQuery(''); setSearchResults([]); setIsSearchOpen(false); }}
                style={{
                  position: 'absolute',
                  right: 8,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: 'var(--color-text-muted)',
                  cursor: 'pointer',
                  fontSize: 12,
                }}
              >
                ✕
              </button>
            )}
          </div>

          {/* Autocomplete Sonuç Listesi */}
          {isSearchOpen && (
            <div style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              right: 0,
              marginTop: 4,
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 8,
              boxShadow: '0 8px 24px rgba(0, 0, 0, 0.35)',
              zIndex: 100,
              maxHeight: 320,
              overflowY: 'auto',
            }}>
              {searchLoading ? (
                <div style={{ padding: '12px 16px', fontSize: 12, color: 'var(--color-text-muted)', textAlign: 'center' }}>
                  Aranıyor...
                </div>
              ) : searchResults.length === 0 ? (
                <div style={{ padding: '12px 16px', fontSize: 12, color: 'var(--color-text-muted)', textAlign: 'center' }}>
                  Sonuç bulunamadı.
                </div>
              ) : (
                searchResults.map((item, idx) => (
                  <div
                    key={`${item.id || item.name}-${idx}`}
                    onClick={() => handleSelectUser(item)}
                    style={{
                      padding: '8px 12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      cursor: 'pointer',
                      borderBottom: idx !== searchResults.length - 1 ? '1px solid var(--color-border)' : 'none',
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'var(--color-surface-alt)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    <UserAvatar user={item} size={30} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontWeight: 700, fontSize: 12, color: 'var(--color-text)' }}>
                          {item.name}
                        </span>
                        <span style={{
                          fontSize: 9.5,
                          padding: '1px 5px',
                          borderRadius: 4,
                          background: item.match_type === 'user' ? 'rgba(56, 189, 248, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                          color: item.match_type === 'user' ? 'var(--color-primary, #38bdf8)' : 'var(--color-warning, #f59e0b)',
                          fontWeight: 700,
                        }}>
                          {item.match_badge}
                        </span>
                      </div>
                      <div style={{ fontSize: 10.5, color: 'var(--color-text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {item.match_highlight ? `${item.match_highlight} • ` : ''}{item.match_info}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Yenile & Kontrol Butonları */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            type="button"
            onClick={() => targetUser && fetchProfile(targetUser)}
            disabled={loading}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              height: 34,
              padding: '0 12px',
              borderRadius: 7,
              background: 'var(--color-surface-alt)',
              border: '1px solid var(--color-border)',
              color: 'var(--color-text)',
              fontSize: 11.5,
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            <span style={{ display: 'inline-block', transform: loading ? 'rotate(180deg)' : 'none', transition: 'transform 0.4s' }}>
              🔄
            </span>
            <span>{loading ? 'Yükleniyor...' : 'Yenile'}</span>
          </button>
        </div>
      </div>

      {/* ── 2. ANA İÇERİK (KAYDIRILABİLİR) ── */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '16px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        background: 'var(--color-bg, #0b0f19)',
        position: 'relative',
        zIndex: 1,
      }}>

        {/* ── ÜST KULLANICI ÖZET KARTI (PROFİL + KPI KARTLARI) ── */}
        <div style={{
          background: 'linear-gradient(145deg, var(--color-surface) 0%, var(--color-surface-alt) 100%)',
          border: '1px solid var(--color-border)',
          borderRadius: 14,
          padding: 16,
          boxShadow: '0 4px 18px rgba(0, 0, 0, 0.12)',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 16,
          alignItems: 'center',
        }}>
          {/* Sol Taraf: Büyük Profil Bilgisi */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
            <div style={{ position: 'relative' }}>
              <UserAvatar user={user} size={76} fontSize={26} />
              <div style={{
                position: 'absolute',
                bottom: 0,
                right: 0,
                width: 18,
                height: 18,
                borderRadius: '50%',
                background: '#10b981',
                border: '3px solid var(--color-surface)',
                boxShadow: '0 0 6px #10b981',
              }} title="Aktif Kullanıcı" />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <h2 style={{ fontSize: 20, fontWeight: 900, margin: 0, color: 'var(--color-text)', letterSpacing: '-0.3px' }}>
                  {user?.name || 'Kullanıcı Seçilmedi'}
                </h2>
                {user?.username && (
                  <span style={{
                    fontSize: 11,
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: 12,
                    background: 'rgba(56, 189, 248, 0.15)',
                    color: 'var(--color-primary, #38bdf8)',
                    border: '1px solid rgba(56, 189, 248, 0.25)',
                  }}>
                    @{user.username}
                  </span>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 2 }}>
                <span title="Departman / Birim">🏢 {user?.department_name || 'Birim Belirtilmemiş'}</span>
                <span style={{ opacity: 0.4 }}>•</span>
                <span title="Lokasyon">📍 {user?.location_name || 'Lokasyon Yok'}</span>
                {user?.employee_num && (
                  <>
                    <span style={{ opacity: 0.4 }}>•</span>
                    <span title="Sicil Numarası">🆔 {user.employee_num}</span>
                  </>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', fontSize: 11.5, color: 'var(--color-text-muted)', marginTop: 4 }}>
                {user?.email && (
                  <a
                    href={`mailto:${user.email}`}
                    style={{ color: 'var(--color-text-secondary)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                  >
                    ✉️ {user.email}
                  </a>
                )}
                {user?.phone && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    📞 {user.phone}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Sağ Taraf: Hızlı İstatistikler (Mini KPI Kartları) */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))',
            gap: 10,
          }}>
            {/* 1. Zimmetli Cihaz */}
            <div
              onClick={() => setActiveTab('assets')}
              style={{
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: 10,
                padding: '10px 12px',
                cursor: 'pointer',
                transition: 'all 0.2s',
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--color-primary, #38bdf8)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--color-border)'; e.currentTarget.style.transform = 'none'; }}
            >
              <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--color-text-muted)' }}>Zimmetli Cihaz</div>
              <div style={{ fontSize: 20, fontWeight: 900, color: 'var(--color-primary, #38bdf8)' }}>
                {stats.total_assets}
              </div>
              <div style={{ fontSize: 9.5, color: 'var(--color-text-muted)' }}>Envanter Kayıtları</div>
            </div>

            {/* 2. Açık Servis Kaydı */}
            <div
              onClick={() => setActiveTab('tickets')}
              style={{
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: 10,
                padding: '10px 12px',
                cursor: 'pointer',
                transition: 'all 0.2s',
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#f59e0b'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--color-border)'; e.currentTarget.style.transform = 'none'; }}
            >
              <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--color-text-muted)' }}>Açık Servis</div>
              <div style={{ fontSize: 20, fontWeight: 900, color: stats.open_tickets > 0 ? '#f59e0b' : 'var(--color-text)' }}>
                {stats.open_tickets}
              </div>
              <div style={{ fontSize: 9.5, color: 'var(--color-text-muted)' }}>Toplam: {stats.total_tickets} Fiş</div>
            </div>

            {/* 3. Toplam Toner */}
            <div
              onClick={() => setActiveTab('toners')}
              style={{
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: 10,
                padding: '10px 12px',
                cursor: 'pointer',
                transition: 'all 0.2s',
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#10b981'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--color-border)'; e.currentTarget.style.transform = 'none'; }}
            >
              <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--color-text-muted)' }}>Toner Alımı</div>
              <div style={{ fontSize: 20, fontWeight: 900, color: '#10b981' }}>
                {stats.total_toners}
              </div>
              <div style={{ fontSize: 9.5, color: 'var(--color-text-muted)' }}>Toplam {toners.length} Çıkış</div>
            </div>

            {/* 4. Kargo / Teslimat */}
            <div
              onClick={() => setActiveTab('cargos')}
              style={{
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: 10,
                padding: '10px 12px',
                cursor: 'pointer',
                transition: 'all 0.2s',
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#a855f7'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--color-border)'; e.currentTarget.style.transform = 'none'; }}
            >
              <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--color-text-muted)' }}>Kargo / Teslim</div>
              <div style={{ fontSize: 20, fontWeight: 900, color: '#a855f7' }}>
                {stats.total_cargos}
              </div>
              <div style={{ fontSize: 9.5, color: 'var(--color-text-muted)' }}>Gelen & Giden</div>
            </div>

            {/* 5. Güvenlik / BitLocker */}
            <div
              onClick={() => setActiveTab('security')}
              style={{
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: 10,
                padding: '10px 12px',
                cursor: 'pointer',
                transition: 'all 0.2s',
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#06b6d4'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--color-border)'; e.currentTarget.style.transform = 'none'; }}
            >
              <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--color-text-muted)' }}>BitLocker</div>
              <div style={{ fontSize: 20, fontWeight: 900, color: stats.has_bitlocker ? '#06b6d4' : 'var(--color-text-muted)' }}>
                {stats.bitlocker_count}
              </div>
              <div style={{ fontSize: 9.5, color: stats.has_bitlocker ? '#10b981' : 'var(--color-text-muted)' }}>
                {stats.has_bitlocker ? 'Aktif Anahtar' : 'Kayıt Yok'}
              </div>
            </div>
          </div>
        </div>

        {/* ── 3. SEKME VE GÖRÜNÜM GEÇİŞ ÇUBUĞU (SPA) ── */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 10,
          borderBottom: '1px solid var(--color-border)',
          paddingBottom: 4,
        }}>
          {/* Sekme Butonları */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            {[
              { id: 'all', label: 'Tümü (Genel Bakış)', icon: '📋' },
              { id: 'assets', label: `Zimmetli Cihazlar (${assets.length})`, icon: '🖥️' },
              { id: 'tickets', label: `Servis Geçmişi (${tickets.length})`, icon: '🔧' },
              { id: 'toners', label: `Toner Geçmişi (${toners.length})`, icon: '🖨️' },
              { id: 'cargos', label: `Kargo & Teslimat (${cargos.length})`, icon: '🚚' },
              { id: 'security', label: `Güvenlik & BitLocker (${bitlockers.length})`, icon: '🔐' },
            ].map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '8px 14px',
                    borderRadius: '8px 8px 0 0',
                    border: 'none',
                    borderBottom: isActive ? '2px solid var(--color-primary, #38bdf8)' : '2px solid transparent',
                    background: isActive ? 'var(--color-surface)' : 'transparent',
                    color: isActive ? 'var(--color-primary, #38bdf8)' : 'var(--color-text-secondary)',
                    fontSize: 12,
                    cursor: 'pointer',
                    transition: 'color 0.18s ease, border-color 0.18s ease, background 0.18s ease',
                  }}
                >
                  <span>{tab.icon}</span>
                  <span
                    className="tab-label-guard"
                    data-text={tab.label}
                    style={{
                      fontWeight: isActive ? 700 : 500,
                      transition: 'font-weight 0.18s ease, color 0.18s ease',
                    }}
                  >
                    {tab.label}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Düzen Değiştirici (Izgara vs. Sekmeli) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'var(--color-surface)', padding: 3, borderRadius: 8, border: '1px solid var(--color-border)' }}>
            <button
              type="button"
              onClick={() => { setViewMode('grid'); setActiveTab('all'); }}
              style={{
                padding: '4px 8px',
                borderRadius: 6,
                border: 'none',
                background: viewMode === 'grid' && activeTab === 'all' ? 'var(--color-surface-alt)' : 'transparent',
                color: viewMode === 'grid' && activeTab === 'all' ? 'var(--color-primary, #38bdf8)' : 'var(--color-text-muted)',
                fontSize: 11,
                fontWeight: 700,
                cursor: 'pointer',
              }}
              title="Tüm blokları yan yana/alt alta göster"
            >
              ⊞ Izgara
            </button>
            <button
              type="button"
              onClick={() => setViewMode('tabs')}
              style={{
                padding: '4px 8px',
                borderRadius: 6,
                border: 'none',
                background: viewMode === 'tabs' ? 'var(--color-surface-alt)' : 'transparent',
                color: viewMode === 'tabs' ? 'var(--color-primary, #38bdf8)' : 'var(--color-text-muted)',
                fontSize: 11,
                fontWeight: 700,
                cursor: 'pointer',
              }}
              title="Sekmeli tekil görünüm"
            >
              ⊟ Sekmeli
            </button>
          </div>
        </div>

        {/* ── 4. DETAY ALANI (BLOKLAR) ── */}
        <style>{`
          .user360-blocks-container {
            display: grid;
            gap: 16px;
            align-items: start;
            width: 100%;
          }

          .user360-card {
            backdrop-filter: blur(8px);
            -webkit-backdrop-filter: blur(8px);
          }

          .user360-single-view {
            grid-template-columns: 1fr !important;
          }
          .user360-single-view > div {
            grid-column: 1 / -1 !important;
            grid-row: auto !important;
          }

          /* 3-Sütunlu Masaüstü Masonry Izgarası (>= 1240px) */
          @media (min-width: 1240px) {
            .user360-grid-view {
              grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
            }
            .user360-card-assets {
              grid-column: 1 !important;
              grid-row: 1 !important;
            }
            .user360-card-cargo {
              grid-column: 1 !important;
              grid-row: 2 !important;
            }
            .user360-card-tickets {
              grid-column: 2 !important;
              grid-row: 1 / span 2 !important;
            }
            .user360-card-toner {
              grid-column: 3 !important;
              grid-row: 1 / span 2 !important;
            }
            .user360-card-security {
              grid-column: 1 / -1 !important;
              grid-row: 3 !important;
            }
          }

          /* 2-Sütunlu Tablet/Dizüstü Izgarası (768px - 1239px) */
          @media (min-width: 768px) and (max-width: 1239px) {
            .user360-grid-view {
              grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
            }
            .user360-card-assets {
              grid-column: 1 !important;
              grid-row: 1 !important;
            }
            .user360-card-cargo {
              grid-column: 1 !important;
              grid-row: 2 !important;
            }
            .user360-card-tickets {
              grid-column: 2 !important;
              grid-row: 1 !important;
            }
            .user360-card-toner {
              grid-column: 2 !important;
              grid-row: 2 !important;
            }
            .user360-card-security {
              grid-column: 1 / -1 !important;
              grid-row: 3 !important;
            }
          }

          /* 1-Sütunlu Mobil Düzeni (< 768px) */
          @media (max-width: 767px) {
            .user360-grid-view {
              grid-template-columns: 1fr !important;
            }
            .user360-card-assets,
            .user360-card-cargo,
            .user360-card-tickets,
            .user360-card-toner,
            .user360-card-security {
              grid-column: 1 / -1 !important;
              grid-row: auto !important;
            }
          }
        `}</style>

        <div
          className={`user360-blocks-container ${viewMode === 'grid' && activeTab === 'all' ? 'user360-grid-view' : 'user360-single-view'}`}
        >

          {/* ══════════════════════════════════════════════════════════════
              BLOK A: ZİMMETLİ CİHAZLAR (ENVANTER MODÜLÜNDEN)
             ══════════════════════════════════════════════════════════════ */}
          {(activeTab === 'all' || activeTab === 'assets') && (
            <div
              className="user360-card user360-card-assets"
              style={{
                background: 'var(--color-surface, #1e293b)',
                border: '1px solid var(--color-border)',
                borderRadius: 12,
                padding: 16,
                boxShadow: '0 4px 16px rgba(0, 0, 0, 0.16)',
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
                position: 'relative',
                zIndex: 1,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 16 }}>🖥️</span>
                  <h3 style={{ fontSize: 14, fontWeight: 800, margin: 0, color: 'var(--color-text)' }}>
                    Zimmetli Cihazlar
                  </h3>
                  <span style={{
                    fontSize: 10,
                    fontWeight: 700,
                    padding: '2px 7px',
                    borderRadius: 10,
                    background: 'rgba(56, 189, 248, 0.15)',
                    color: 'var(--color-primary, #38bdf8)',
                  }}>
                    {assets.length} Adet
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => openTab({ id: 'inventory', label: 'Envanter', icon: '🖥️', module: 'Inventory' })}
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: 'var(--color-primary, #38bdf8)',
                    background: 'rgba(56, 189, 248, 0.1)',
                    border: '1px solid rgba(56, 189, 248, 0.25)',
                    padding: '4px 9px',
                    borderRadius: 6,
                    cursor: 'pointer',
                  }}
                >
                  Envanterde Gör ↗
                </button>
              </div>

              {assets.length === 0 ? (
                <div style={{
                  padding: '24px 16px',
                  textAlign: 'center',
                  color: 'var(--color-text-muted)',
                  fontSize: 12,
                  background: 'var(--color-surface-alt)',
                  borderRadius: 8,
                }}>
                  Bu kullanıcıya ait zimmetli cihaz kaydı bulunamadı.
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5, textAlign: 'left' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}>
                        <th style={{ padding: '8px 10px', fontWeight: 700 }}>Cihaz Adı</th>
                        <th style={{ padding: '8px 10px', fontWeight: 700 }}>Model / Marka</th>
                        <th style={{ padding: '8px 10px', fontWeight: 700 }}>Seri No / Varlık No</th>
                        <th style={{ padding: '8px 10px', fontWeight: 700 }}>Kategori</th>
                        <th style={{ padding: '8px 10px', fontWeight: 700 }}>Durum</th>
                      </tr>
                    </thead>
                    <tbody>
                      {assets.map((asset) => (
                        <tr
                          key={asset.id}
                          style={{ borderBottom: '1px solid var(--color-border)', transition: 'background 0.15s' }}
                          onMouseEnter={(e) => e.currentTarget.style.background = 'var(--color-surface-alt)'}
                          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                        >
                          <td style={{ padding: '8px 10px', fontWeight: 700, color: 'var(--color-text)' }}>
                            {asset.name}
                          </td>
                          <td style={{ padding: '8px 10px', color: 'var(--color-text-secondary)' }}>
                            {asset.model_name || '—'}
                          </td>
                          <td style={{ padding: '8px 10px' }}>
                            <div style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--color-text)' }}>
                              {asset.asset_tag || '—'}
                            </div>
                            {asset.serial && (
                              <div style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>
                                S/N: {asset.serial}
                              </div>
                            )}
                          </td>
                          <td style={{ padding: '8px 10px', color: 'var(--color-text-secondary)' }}>
                            {asset.category_name || '—'}
                          </td>
                          <td style={{ padding: '8px 10px' }}>
                            <span style={{
                              padding: '2px 7px',
                              borderRadius: 10,
                              fontSize: 10.5,
                              fontWeight: 700,
                              background: 'rgba(16, 185, 129, 0.15)',
                              color: '#10b981',
                            }}>
                              {asset.status_name || 'Zimmetli'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════
              BLOK B: SERVİS GEÇMİŞİ (SERVİS FİŞLERİ MODÜLÜNDEN)
             ══════════════════════════════════════════════════════════════ */}
          {(activeTab === 'all' || activeTab === 'tickets') && (
            <div
              className="user360-card user360-card-tickets"
              style={{
                background: 'var(--color-surface, #1e293b)',
                border: '1px solid var(--color-border)',
                borderRadius: 12,
                padding: 16,
                boxShadow: '0 4px 16px rgba(0, 0, 0, 0.16)',
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
                position: 'relative',
                zIndex: 1,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 16 }}>🔧</span>
                  <h3 style={{ fontSize: 14, fontWeight: 800, margin: 0, color: 'var(--color-text)' }}>
                    Servis Geçmişi
                  </h3>
                  <span style={{
                    fontSize: 10,
                    fontWeight: 700,
                    padding: '2px 7px',
                    borderRadius: 10,
                    background: 'rgba(245, 158, 11, 0.15)',
                    color: '#f59e0b',
                  }}>
                    {tickets.length} Kayıt
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => openTab({ id: 'service-tickets', label: 'Servis Fişleri', icon: '🔧', module: 'ServiceTickets' })}
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: '#f59e0b',
                    background: 'rgba(245, 158, 11, 0.1)',
                    border: '1px solid rgba(245, 158, 11, 0.25)',
                    padding: '4px 9px',
                    borderRadius: 6,
                    cursor: 'pointer',
                  }}
                >
                  Servis Fişlerine Git ↗
                </button>
              </div>

              {tickets.length === 0 ? (
                <div style={{
                  padding: '24px 16px',
                  textAlign: 'center',
                  color: 'var(--color-text-muted)',
                  fontSize: 12,
                  background: 'var(--color-surface-alt)',
                  borderRadius: 8,
                }}>
                  Bu kullanıcıya ait servis fişi bulunamadı.
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5, textAlign: 'left' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}>
                        <th style={{ padding: '8px 10px', fontWeight: 700 }}>Fiş No</th>
                        <th style={{ padding: '8px 10px', fontWeight: 700 }}>Tarih</th>
                        <th style={{ padding: '8px 10px', fontWeight: 700 }}>Cihaz & Arıza Konusu</th>
                        <th style={{ padding: '8px 10px', fontWeight: 700 }}>Öncelik</th>
                        <th style={{ padding: '8px 10px', fontWeight: 700 }}>Durum</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tickets.map((ticket) => (
                        <tr
                          key={ticket.id}
                          style={{ borderBottom: '1px solid var(--color-border)', transition: 'background 0.15s' }}
                          onMouseEnter={(e) => e.currentTarget.style.background = 'var(--color-surface-alt)'}
                          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                        >
                          <td style={{ padding: '8px 10px' }}>
                            <span
                              onClick={() => setSelectedTicket(ticket)}
                              style={{
                                color: 'var(--color-primary, #38bdf8)',
                                fontWeight: 700,
                                cursor: 'pointer',
                                textDecoration: 'underline',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                              }}
                              title="Servis Fişi Detay Popup'ını Aç"
                            >
                              <span>{ticket.ticket_no}</span>
                              <span style={{ fontSize: 10, opacity: 0.8 }}>🔍</span>
                            </span>
                          </td>
                          <td style={{ padding: '8px 10px', color: 'var(--color-text-secondary)', whiteSpace: 'nowrap' }}>
                            {formatDate(ticket.created_at)}
                          </td>
                          <td style={{ padding: '8px 10px' }}>
                            <div style={{ fontWeight: 600, color: 'var(--color-text)' }}>
                              {ticket.asset_name || ticket.model_name || 'Cihaz'}
                            </div>
                            <div style={{ fontSize: 10.5, color: 'var(--color-text-muted)', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={ticket.fault_desc}>
                              {ticket.fault_desc || 'Arıza detayı girilmemiş.'}
                            </div>
                          </td>
                          <td style={{ padding: '8px 10px' }}>
                            {getPriorityBadge(ticket.priority)}
                          </td>
                          <td style={{ padding: '8px 10px' }}>
                            {getTicketStatusBadge(ticket.status)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════
              BLOK C: TONER GEÇMİŞİ (TONER TAKİP MODÜLÜNDEN)
             ══════════════════════════════════════════════════════════════ */}
          {(activeTab === 'all' || activeTab === 'toners') && (
            <div
              className="user360-card user360-card-toner"
              style={{
                background: 'var(--color-surface, #1e293b)',
                border: '1px solid var(--color-border)',
                borderRadius: 12,
                padding: 16,
                boxShadow: '0 4px 16px rgba(0, 0, 0, 0.16)',
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
                position: 'relative',
                zIndex: 1,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 16 }}>🖨️</span>
                  <h3 style={{ fontSize: 14, fontWeight: 800, margin: 0, color: 'var(--color-text)' }}>
                    Toner Geçmişi
                  </h3>
                  <span style={{
                    fontSize: 10,
                    fontWeight: 700,
                    padding: '2px 7px',
                    borderRadius: 10,
                    background: 'rgba(16, 185, 129, 0.15)',
                    color: '#10b981',
                  }}>
                    {toners.length} Teslim
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => openTab({ id: 'toner', label: 'Toner & Kartuş', icon: '🖨️', module: 'Toner' })}
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: '#10b981',
                    background: 'rgba(16, 185, 129, 0.1)',
                    border: '1px solid rgba(16, 185, 129, 0.25)',
                    padding: '4px 9px',
                    borderRadius: 6,
                    cursor: 'pointer',
                  }}
                >
                  Toner Modülüne Git ↗
                </button>
              </div>

              {toners.length === 0 ? (
                <div style={{
                  padding: '24px 16px',
                  textAlign: 'center',
                  color: 'var(--color-text-muted)',
                  fontSize: 12,
                  background: 'var(--color-surface-alt)',
                  borderRadius: 8,
                }}>
                  Bu kullanıcıya ait toner teslim kaydı bulunamadı.
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5, textAlign: 'left' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}>
                        <th style={{ padding: '8px 10px', fontWeight: 700 }}>Toner Modeli</th>
                        <th style={{ padding: '8px 10px', fontWeight: 700 }}>Renk</th>
                        <th style={{ padding: '8px 10px', fontWeight: 700 }}>Veriliş Tarihi</th>
                        <th style={{ padding: '8px 10px', fontWeight: 700 }}>Adet</th>
                        <th style={{ padding: '8px 10px', fontWeight: 700 }}>Notlar</th>
                      </tr>
                    </thead>
                    <tbody>
                      {toners.map((t) => (
                        <tr
                          key={t.id}
                          style={{ borderBottom: '1px solid var(--color-border)', transition: 'background 0.15s' }}
                          onMouseEnter={(e) => e.currentTarget.style.background = 'var(--color-surface-alt)'}
                          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                        >
                          <td style={{ padding: '8px 10px', fontWeight: 700, color: 'var(--color-text)' }}>
                            {t.toner_model || t.toner_code || 'Sarf Malzemesi'}
                          </td>
                          <td style={{ padding: '8px 10px', color: 'var(--color-text-secondary)' }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                              <span style={{
                                width: 8,
                                height: 8,
                                borderRadius: '50%',
                                background: t.color ? t.color.toLowerCase() : '#94a3b8',
                                display: 'inline-block'
                              }} />
                              {t.color || 'Standart'}
                            </span>
                          </td>
                          <td style={{ padding: '8px 10px', color: 'var(--color-text-secondary)', whiteSpace: 'nowrap' }}>
                            {formatDate(t.change_date || t.created_at)}
                          </td>
                          <td style={{ padding: '8px 10px' }}>
                            <span style={{
                              fontWeight: 800,
                              color: '#10b981',
                              background: 'rgba(16, 185, 129, 0.1)',
                              padding: '2px 6px',
                              borderRadius: 4,
                            }}>
                              {t.qty || 1} Adet
                            </span>
                          </td>
                          <td style={{ padding: '8px 10px', color: 'var(--color-text-muted)', fontSize: 11 }}>
                            {t.notes || '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════
              BLOK D: KARGO & TESLİMAT GEÇMİŞİ (KARGO TAKİP MODÜLÜNDEN)
             ══════════════════════════════════════════════════════════════ */}
          {(activeTab === 'all' || activeTab === 'cargos') && (
            <div
              className="user360-card user360-card-cargo"
              style={{
                background: 'var(--color-surface, #1e293b)',
                border: '1px solid var(--color-border)',
                borderRadius: 12,
                padding: 16,
                boxShadow: '0 4px 16px rgba(0, 0, 0, 0.16)',
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
                position: 'relative',
                zIndex: 1,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 16 }}>🚚</span>
                  <h3 style={{ fontSize: 14, fontWeight: 800, margin: 0, color: 'var(--color-text)' }}>
                    Kargo & Teslimat Geçmişi
                  </h3>
                  <span style={{
                    fontSize: 10,
                    fontWeight: 700,
                    padding: '2px 7px',
                    borderRadius: 10,
                    background: 'rgba(168, 85, 247, 0.15)',
                    color: '#a855f7',
                  }}>
                    {cargos.length} Kargo
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => openTab({ id: 'cargo', label: 'Kargo Takip', icon: '🚚', module: 'Cargo' })}
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: '#a855f7',
                    background: 'rgba(168, 85, 247, 0.1)',
                    border: '1px solid rgba(168, 85, 247, 0.25)',
                    padding: '4px 9px',
                    borderRadius: 6,
                    cursor: 'pointer',
                  }}
                >
                  Kargo Modülüne Git ↗
                </button>
              </div>

              {cargos.length === 0 ? (
                <div style={{
                  padding: '24px 16px',
                  textAlign: 'center',
                  color: 'var(--color-text-muted)',
                  fontSize: 12,
                  background: 'var(--color-surface-alt)',
                  borderRadius: 8,
                }}>
                  Bu kullanıcı adına gelen veya giden kargo kaydı bulunamadı.
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5, textAlign: 'left' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}>
                        <th style={{ padding: '8px 10px', fontWeight: 700 }}>Kargo Firması</th>
                        <th style={{ padding: '8px 10px', fontWeight: 700 }}>Takip No / İrsaliye</th>
                        <th style={{ padding: '8px 10px', fontWeight: 700 }}>Yön</th>
                        <th style={{ padding: '8px 10px', fontWeight: 700 }}>Tarih</th>
                        <th style={{ padding: '8px 10px', fontWeight: 700 }}>Durum</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cargos.map((cargo) => (
                        <tr
                          key={cargo.id}
                          style={{ borderBottom: '1px solid var(--color-border)', transition: 'background 0.15s' }}
                          onMouseEnter={(e) => e.currentTarget.style.background = 'var(--color-surface-alt)'}
                          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                        >
                          <td style={{ padding: '8px 10px', fontWeight: 700, color: 'var(--color-text)' }}>
                            {cargo.carrier || 'Kargo'}
                          </td>
                          <td style={{ padding: '8px 10px' }}>
                            {cargo.tracking_number ? (
                              <a
                                href={cargo.carrier_tracking_url || '#'}
                                target="_blank"
                                rel="noreferrer"
                                style={{
                                  color: 'var(--color-primary, #38bdf8)',
                                  fontWeight: 700,
                                  textDecoration: cargo.carrier_tracking_url ? 'underline' : 'none',
                                }}
                              >
                                {cargo.tracking_number}
                              </a>
                            ) : (
                              <span style={{ color: 'var(--color-text-muted)' }}>—</span>
                            )}
                            {cargo.waybill_no && (
                              <div style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>
                                İrs: {cargo.waybill_no}
                              </div>
                            )}
                          </td>
                          <td style={{ padding: '8px 10px' }}>
                            <span style={{
                              fontSize: 10,
                              fontWeight: 700,
                              padding: '2px 6px',
                              borderRadius: 4,
                              background: cargo.direction === 'incoming' ? 'rgba(56, 189, 248, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                              color: cargo.direction === 'incoming' ? 'var(--color-primary, #38bdf8)' : '#f59e0b',
                            }}>
                              {cargo.direction === 'incoming' ? '📥 Gelen' : '📤 Giden'}
                            </span>
                          </td>
                          <td style={{ padding: '8px 10px', color: 'var(--color-text-secondary)', whiteSpace: 'nowrap' }}>
                            {formatDate(cargo.received_date)}
                          </td>
                          <td style={{ padding: '8px 10px' }}>
                            <span style={{
                              padding: '2px 7px',
                              borderRadius: 10,
                              fontSize: 10.5,
                              fontWeight: 700,
                              background: 'rgba(16, 185, 129, 0.15)',
                              color: '#10b981',
                            }}>
                              {cargo.status || 'Teslim Alındı'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════
              BLOK E: GÜVENLİK VE BİTLOCKER (BİTLOCKER MODÜLÜNDEN)
             ══════════════════════════════════════════════════════════════ */}
          {(activeTab === 'all' || activeTab === 'security') && (
            <div
              className="user360-card user360-card-security"
              style={{
                background: 'linear-gradient(145deg, var(--color-surface, #1e293b) 0%, var(--color-surface-alt, #0f172a) 100%)',
                border: '1px solid var(--color-border)',
                borderRadius: 12,
                padding: 16,
                boxShadow: '0 4px 16px rgba(0, 0, 0, 0.16)',
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
                position: 'relative',
                zIndex: 1,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 16 }}>🔐</span>
                  <h3 style={{ fontSize: 14, fontWeight: 800, margin: 0, color: 'var(--color-text)' }}>
                    Güvenlik & BitLocker Kurtarma Anahtarları
                  </h3>
                  <span style={{
                    fontSize: 10,
                    fontWeight: 700,
                    padding: '2px 7px',
                    borderRadius: 10,
                    background: bitlockers.length > 0 ? 'rgba(6, 182, 212, 0.15)' : 'rgba(100, 116, 139, 0.15)',
                    color: bitlockers.length > 0 ? '#06b6d4' : 'var(--color-text-muted)',
                  }}>
                    {bitlockers.length} Anahtar
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => openTab({ id: 'bitlocker', label: 'BitLocker', icon: '🔐', module: 'Bitlocker' })}
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: '#06b6d4',
                    background: 'rgba(6, 182, 212, 0.1)',
                    border: '1px solid rgba(6, 182, 212, 0.25)',
                    padding: '4px 9px',
                    borderRadius: 6,
                    cursor: 'pointer',
                  }}
                >
                  BitLocker Modülüne Git ↗
                </button>
              </div>

              {bitlockers.length === 0 ? (
                <div style={{
                  padding: '24px 16px',
                  textAlign: 'center',
                  color: 'var(--color-text-muted)',
                  fontSize: 12,
                  background: 'var(--color-surface)',
                  borderRadius: 8,
                }}>
                  Bu kullanıcıya veya adına kayıtlı cihazlara ait BitLocker kurtarma anahtarı bulunamadı.
                </div>
              ) : (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
                  gap: 12,
                }}>
                  {bitlockers.map((bl) => {
                    const isRevealed = visibleKeys[bl.id];
                    const isCopied = copiedKeyId === bl.id;
                    return (
                      <div
                        key={bl.id}
                        style={{
                          background: 'var(--color-surface)',
                          border: '1px solid var(--color-border)',
                          borderRadius: 10,
                          padding: 14,
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 10,
                          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontSize: 14 }}>💻</span>
                            <span style={{ fontWeight: 800, fontSize: 13, color: 'var(--color-text)' }}>
                              {bl.device_name || 'Bilinmeyen Cihaz'}
                            </span>
                          </div>
                          <span style={{ fontSize: 10.5, color: 'var(--color-text-muted)' }}>
                            {formatDate(bl.updated_at || bl.uploaded_at)}
                          </span>
                        </div>

                        {bl.identifier && (
                          <div style={{ fontSize: 10.5, color: 'var(--color-text-secondary)', fontFamily: 'monospace' }}>
                            GUID: {bl.identifier}
                          </div>
                        )}

                        {/* Kurtarma Anahtarı Kutusu (Göz İkonlu ve Kopyala Butonlu) */}
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 8,
                          background: 'var(--color-surface-alt)',
                          border: '1px solid var(--color-border)',
                          borderRadius: 8,
                          padding: '8px 12px',
                        }}>
                          <div style={{
                            fontFamily: 'monospace',
                            fontSize: 12,
                            fontWeight: 700,
                            letterSpacing: isRevealed ? '0.5px' : '2px',
                            color: isRevealed ? '#06b6d4' : 'var(--color-text-muted)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            userSelect: isRevealed ? 'all' : 'none',
                          }}>
                            {isRevealed
                              ? bl.recovery_key
                              : '••••••-••••••-••••••-••••••-••••••-••••••-••••••-••••••'}
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            {/* Göster / Gizle Göz Butonu */}
                            <button
                              type="button"
                              onClick={() => toggleKeyVisibility(bl.id)}
                              style={{
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                fontSize: 14,
                                padding: 2,
                                opacity: 0.8,
                              }}
                              title={isRevealed ? 'Anahtarı Gizle' : 'Anahtarı Göster'}
                            >
                              {isRevealed ? '🙈' : '👁️'}
                            </button>

                            {/* Kopyala Butonu */}
                            <button
                              type="button"
                              onClick={() => copyToClipboard(bl.recovery_key, bl.id)}
                              style={{
                                padding: '3px 8px',
                                borderRadius: 5,
                                border: '1px solid var(--color-border)',
                                background: isCopied ? 'rgba(16, 185, 129, 0.2)' : 'var(--color-surface)',
                                color: isCopied ? '#10b981' : 'var(--color-text)',
                                fontSize: 10.5,
                                fontWeight: 700,
                                cursor: 'pointer',
                              }}
                            >
                              {isCopied ? '✓ Kopyalandı' : 'Kopyala'}
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

        </div>
      </div>

      {/* ── Servis Fişi Detay Popup / Modalı ── */}
      {selectedTicket && (
        <Modal
          isOpen
          title={`Servis Fişi Detayı: ${selectedTicket.ticket_no}`}
          size="xl"
          onClose={() => setSelectedTicket(null)}
        >
          <ServiceTicketDetail
            ticket={selectedTicket}
            onClose={() => setSelectedTicket(null)}
            onUpdate={() => {
              if (targetUser) fetchProfile(targetUser);
            }}
          />
        </Modal>
      )}
    </div>
  );
}
