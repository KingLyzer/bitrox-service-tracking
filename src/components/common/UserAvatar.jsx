import React from 'react';

export const AVATAR_PRESETS = [
  // 1. İkonlar & Karakterler
  { id: 'emoji:👑', type: 'emoji', icon: '👑', label: 'Taç / Lider', bg: 'linear-gradient(135deg, #f59e0b, #d97706)' },
  { id: 'emoji:👨‍🚀', type: 'emoji', icon: '👨‍🚀', label: 'Astronot', bg: 'linear-gradient(135deg, #3b82f6, #1d4ed8)' },
  { id: 'emoji:🤖', type: 'emoji', icon: '🤖', label: 'Robot / Sayborg', bg: 'linear-gradient(135deg, #06b6d4, #0891b2)' },
  { id: 'emoji:🛠️', type: 'emoji', icon: '🛠️', label: 'Teknisyen', bg: 'linear-gradient(135deg, #10b981, #059669)' },
  { id: 'emoji:💻', type: 'emoji', icon: '💻', label: 'Hacker / Geliştirici', bg: 'linear-gradient(135deg, #6366f1, #4f46e5)' },
  { id: 'emoji:⚡', type: 'emoji', icon: '⚡', label: 'Yıldırım', bg: 'linear-gradient(135deg, #ec4899, #db2777)' },
  { id: 'emoji:🥷', type: 'emoji', icon: '🥷', label: 'Ninja', bg: 'linear-gradient(135deg, #374151, #111827)' },
  { id: 'emoji:🦊', type: 'emoji', icon: '🦊', label: 'Tilki', bg: 'linear-gradient(135deg, #f97316, #ea580c)' },
  { id: 'emoji:🎮', type: 'emoji', icon: '🎮', label: 'Oyuncu', bg: 'linear-gradient(135deg, #8b5cf6, #7c3aed)' },
  { id: 'emoji:🧙‍♂️', type: 'emoji', icon: '🧙‍♂️', label: 'Büyücü', bg: 'linear-gradient(135deg, #14b8a6, #0d9488)' },
  { id: 'emoji:🦁', type: 'emoji', icon: '🦁', label: 'Aslan', bg: 'linear-gradient(135deg, #eab308, #ca8a04)' },
  { id: 'emoji:🚀', type: 'emoji', icon: '🚀', label: 'Roket', bg: 'linear-gradient(135deg, #ef4444, #dc2626)' },

  // 2. Özel Degrade Baş Harf Paletleri
  { id: 'grad:violet', type: 'gradient', name: 'Mor Gece', bg: 'linear-gradient(135deg, #6366f1, #8b5cf6)', label: 'Mor Gece' },
  { id: 'grad:sunset', type: 'gradient', name: 'Sıcak Gün Batımı', bg: 'linear-gradient(135deg, #f43f5e, #fb923c)', label: 'Gün Batımı' },
  { id: 'grad:cyber', type: 'gradient', name: 'Siber Turkuaz', bg: 'linear-gradient(135deg, #00f0ff, #ff007f)', label: 'Siber Neon' },
  { id: 'grad:emerald', type: 'gradient', name: 'Zümrüt Yeşili', bg: 'linear-gradient(135deg, #10b981, #064e3b)', label: 'Zümrüt' },
  { id: 'grad:gold', type: 'gradient', name: '24K Altın', bg: 'linear-gradient(135deg, #f59e0b, #78350f)', label: '24K Altın' },
  { id: 'grad:ocean', type: 'gradient', name: 'Okyanus', bg: 'linear-gradient(135deg, #0284c7, #0f172a)', label: 'Okyanus' },
];

export default function UserAvatar({ user, size = 40, fontSize, style = {}, className = '' }) {
  const avatarValue = user?.avatar || '';
  const fullName = user?.full_name || user?.name || user?.username || 'U';
  const initials = fullName
    .split(' ')
    .map(p => p[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const calcFontSize = fontSize || Math.max(11, Math.round(size * 0.42));

  // 1. Resim / Fotoğraf / GIF Avatarı (Data URL veya URL)
  if (avatarValue.startsWith('data:image/') || avatarValue.startsWith('http') || avatarValue.startsWith('/files/')) {
    return (
      <img
        src={avatarValue}
        alt={fullName}
        className={className}
        loading="lazy"
        onError={(e) => {
          e.currentTarget.style.display = 'none';
        }}
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          objectFit: 'cover',
          border: '2px solid rgba(255, 255, 255, 0.2)',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.25)',
          flexShrink: 0,
          ...style
        }}
      />
    );
  }

  // 2. Emoji / Karakter Avatarı
  if (avatarValue.startsWith('emoji:')) {
    const preset = AVATAR_PRESETS.find(p => p.id === avatarValue);
    const emojiChar = avatarValue.replace('emoji:', '');
    const bg = preset?.bg || 'linear-gradient(135deg, #6366f1, #8b5cf6)';

    return (
      <div
        className={className}
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          background: bg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: Math.round(size * 0.52),
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.25)',
          border: '2px solid rgba(255, 255, 255, 0.2)',
          userSelect: 'none',
          flexShrink: 0,
          ...style
        }}
      >
        {emojiChar}
      </div>
    );
  }

  // 3. Degrade Baş Harf Avatarı
  if (avatarValue.startsWith('grad:')) {
    const preset = AVATAR_PRESETS.find(p => p.id === avatarValue);
    const bg = preset?.bg || 'linear-gradient(135deg, #6366f1, #8b5cf6)';

    return (
      <div
        className={className}
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          background: bg,
          color: '#ffffff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: calcFontSize,
          fontWeight: 800,
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.25)',
          border: '2px solid rgba(255, 255, 255, 0.2)',
          letterSpacing: 0.5,
          userSelect: 'none',
          flexShrink: 0,
          ...style
        }}
      >
        {initials}
      </div>
    );
  }

  // 4. Varsayılan Baş Harf Avatarı
  return (
    <div
      className={className}
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: 'linear-gradient(135deg, var(--color-primary, #3b82f6), #8b5cf6)',
        color: '#ffffff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: calcFontSize,
        fontWeight: 800,
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.25)',
        border: '2px solid rgba(255, 255, 255, 0.2)',
        letterSpacing: 0.5,
        userSelect: 'none',
        flexShrink: 0,
        ...style
      }}
    >
      {initials}
    </div>
  );
}
