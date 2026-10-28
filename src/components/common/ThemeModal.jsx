import React from 'react';
import Modal from './Modal';
import { useApp } from '../../context/AppContext';

export const THEMES_LIST = [
  {
    id: 'dark',
    name: 'Koyu Tema (Varsayılan)',
    category: 'Standart',
    icon: '🌙',
    badge: 'Popüler',
    badgeColor: 'badge-primary',
    desc: 'Göz yormayan, modern ve şık koyu lacivert tonları.',
    previewColors: ['#0f172a', '#1e293b', '#6366f1', '#38bdf8'],
  },
  {
    id: 'light',
    name: 'Açık Tema (Kurumsal)',
    category: 'Standart',
    icon: '☀️',
    badge: 'Klasik',
    badgeColor: 'badge-secondary',
    desc: 'Ferah, aydınlık ve temiz kurumsal açık gri palet.',
    previewColors: ['#f1f5f9', '#ffffff', '#4f46e5', '#0ea5e9'],
  },
  {
    id: 'sakura',
    name: 'Elus Çiçeği (Sakura 🌸)',
    category: 'Doğa & Zarafet',
    icon: '🌸',
    badge: 'Yaprak Yağışlı 🍃',
    badgeColor: 'badge-danger',
    desc: 'Yumuşak pastel pembe ve çiçek tonları, ağaçtan süzülen Elus çiçeği yaprakları.',
    previewColors: ['#f9d5df', '#ffffff', '#e11d48', '#881337'],
  },
  {
    id: 'halloween',
    name: 'Cadılar Bayramı (Halloween)',
    category: 'Özel Etkinlik',
    icon: '🎃',
    badge: 'Animasyonlu 🕷️',
    badgeColor: 'badge-warning',
    desc: 'Karanlık mor ve neon turuncu renkler, parlayan bal kabakları, yarasalar ve örümcek.',
    previewColors: ['#0c0714', '#170d24', '#ff7700', '#9d4edd'],
  },
  {
    id: 'christmas',
    name: 'Yılbaşı & Noel Masalı (Christmas 🎄)',
    category: 'Özel Etkinlik',
    icon: '🎄',
    badge: 'Noel Işıkları & Kar ❄️',
    badgeColor: 'badge-danger',
    desc: 'Lapa lapa kristal kar yağışı, çam ormanı derinliği, kadife Noel kırmızısı ve şömine altını, peri ışıkları ve asılı süsler.',
    previewColors: ['#06111e', '#0a1f18', '#dc2626', '#fbbf24'],
  },
  {
    id: 'ramadan',
    name: 'Şehr-i Ramazan (Kandil & Hilal 🌙)',
    category: 'Özel Etkinlik',
    icon: '🌙',
    badge: 'Kandil & Hilal ✨',
    badgeColor: 'badge-warning',
    desc: 'Gece göğü derinliği, sarkan altın kandiller, ışıltılı hilal, kayan yıldızlar ve cami silüeti.',
    previewColors: ['#080d1a', '#111a2e', '#f59e0b', '#10b981'],
  },
  {
    id: 'cyberpunk',
    name: 'Cyberpunk 2077 (Night City ⚡)',
    category: 'Fütüristik',
    icon: '⚡',
    badge: 'Night City HUD 🖲️',
    badgeColor: 'badge-warning',
    desc: 'Yüksek voltajlı Cyberpunk sarısı (#fcee0a), Night City turkuazı ve karbon karanlığı, Kiroshi HUD telemetrisi ve 3D siber perspektif gridi.',
    previewColors: ['#07080c', '#0e1219', '#fcee0a', '#00f0ff'],
  },
  {
    id: 'autumn',
    name: 'Sonbahar Masalı (Autumn 🍂)',
    category: 'Mevsimsel',
    icon: '🍂',
    badge: 'Yaprak Yağışı 🍁',
    badgeColor: 'badge-warning',
    desc: 'Sıcak kehribar, pas turuncusu ve altın sarısı tonları, rüzgarla dans eden sonbahar yaprakları.',
    previewColors: ['#1f120c', '#2e1a12', '#f97316', '#eab308'],
  },
  {
    id: 'summer',
    name: 'Yaz & Tropik Sahil Cenneti (Summer ☀️)',
    category: 'Mevsimsel',
    icon: '🏖️',
    badge: 'Turkuaz Lagün & Sahil 🌴',
    badgeColor: 'badge-warning',
    desc: 'Büyüleyici beyaz kumlu tropik sahil, turkuaz lagün, parlayan altın güneş ışınları, asılı tropik içecekler ve sörf tılsımları.',
    previewColors: ['#041624', '#08263a', '#f59e0b', '#06b6d4'],
  },
  {
    id: 'aurora',
    name: 'Kuzey Işıkları (Aurora Borealis 🌌)',
    category: 'Doğa & Evren',
    icon: '🌌',
    badge: 'Kutup Dansı ❄️',
    badgeColor: 'badge-success',
    desc: 'Zifiri Arktik gecesi, dalgalanan zümrüt ve lila kutup ışıkları, karlı dağlar ve göl manzarası.',
    previewColors: ['#030712', '#0b1329', '#10b981', '#8b5cf6'],
  },

  {
    id: 'rainy_eskisehir',
    name: 'Yağmurlu Eskişehir (Porsuk Gecesi 🌧️)',
    category: 'Şehir & Nostalji',
    icon: '🌧️',
    badge: 'Porsuk & Yağmur ☔',
    badgeColor: 'badge-info',
    desc: 'Eskişehir Porsuk Çayı, gondollar, ıslak sokak lambaları ışıltısı ve cama vuran dinlendirici yağmur.',
    previewColors: ['#090d16', '#111827', '#f59e0b', '#38bdf8'],
  },
  {
    id: 'desert_gold',
    name: 'Antik Mısır & Çöl Altını (Dune ⚔️)',
    category: 'Tarih & Gizem',
    icon: '⚔️',
    badge: '24K Firavun Altını 👑',
    badgeColor: 'badge-warning',
    desc: 'Antik Piramitler, Samanyolu çöl göğü, savrulan altın kum tozları ve hiyeroglifli firavun tılsımları.',
    previewColors: ['#0c0a09', '#1c1917', '#eab308', '#b45309'],
  },
  {
    id: 'cozy_coffee',
    name: 'Kahve & Ahşap Barista (Cozy Coffee ☕)',
    category: 'Yaşam & Sıcaklık',
    icon: '☕',
    badge: 'Sıcak Buhar 🥐',
    badgeColor: 'badge-warning',
    desc: 'Kavrulmuş espresso ve ahşap kafe sıcaklığı, tüten kahve buharı, latte krema ve karamel tonları.',
    previewColors: ['#120a05', '#1c1008', '#d97706', '#fef3c7'],
  },
  {
    id: 'retro_arcade',
    name: 'Retro Arcade & Pixel Nostalji (8-Bit 🎮)',
    category: 'Fütüristik',
    icon: '🎮',
    badge: 'Pixel Art 🕹️',
    badgeColor: 'badge-primary',
    desc: '90’lar arcade salonu neonları, Street Fighter makineleri, süzülen 8-bit piksel bonusları ve CRT retro hava.',
    previewColors: ['#0a0815', '#130f26', '#22c55e', '#f43f5e'],
  },
  {
    id: 'ocean',
    name: 'Okyanus Derinliği',
    category: 'Doğa',
    icon: '🌊',
    badge: 'Ferah',
    badgeColor: 'badge-info',
    desc: 'Derin deniz mavisi ve turkuaz okyanus esintisi tonları.',
    previewColors: ['#031424', '#07253d', '#06b6d4', '#3b82f6'],
  },
  {
    id: 'sunset',
    name: 'Gün Batımı (Sunset Glow)',
    category: 'Doğa',
    icon: '🌅',
    badge: 'Sıcak Radyans',
    badgeColor: 'badge-danger',
    desc: 'Sıcak amber, fuşya ve gün batımı moru harmanı.',
    previewColors: ['#180d1e', '#26162f', '#f43f5e', '#f59e0b'],
  },
  {
    id: 'military',
    name: 'Askeri & Taktik Operasyon (Military 🎖️)',
    category: 'Özel & Taktik',
    icon: '🎖️',
    badge: 'Taktik Radar & HUD 🎯',
    badgeColor: 'badge-success',
    desc: 'Haki kamuflaj, taktiksel zeytin yeşili ve mat karbon palet, askeri radar telemetrisi ve operasyonel HUD göstergeleri.',
    previewColors: ['#090e09', '#111a11', '#84cc16', '#eab308'],
  },
];

export default function ThemeModal({ isOpen, onClose }) {
  const {
    theme,
    setTheme,
    effectsEnabled,
    setEffectsEnabled,
    showNotification
  } = useApp();

  if (!isOpen) return null;

  const handleSelectTheme = (themeId) => {
    setTheme(themeId);
    showNotification(`Tema "${THEMES_LIST.find(t => t.id === themeId)?.name}" olarak güncellendi.`, 'success');
  };

  return (
    <Modal isOpen={isOpen} title="🎨 Tema & Görünüm Galerisi" size="xl" onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '4px 8px' }}>
        
        {/* Ambient Effects Switch Bar */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'var(--color-surface-alt)',
          border: '1px solid var(--color-border)',
          borderRadius: 8,
          padding: '10px 14px',
          flexWrap: 'wrap',
          gap: 8
        }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--color-text)' }}>
              ✨ Özel Atmosfer Animasyonları
            </div>
            <div style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>
              Yılbaşında kar yağışı, Elus Çiçeğinde yaprak dökümü, Cadılar Bayramında bal kabağı gibi canlı efektler
            </div>
          </div>

          <label className="checkbox-inline" style={{ fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
            <input
              type="checkbox"
              checked={effectsEnabled}
              onChange={e => setEffectsEnabled(e.target.checked)}
            />
            Efektleri Etkinleştir
          </label>
        </div>

        {/* Themes Cards Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 12 }}>
          {THEMES_LIST.map(t => {
            const isSelected = theme === t.id;
            return (
              <div
                key={t.id}
                onClick={() => handleSelectTheme(t.id)}
                style={{
                  background: isSelected ? 'var(--color-surface)' : 'var(--color-surface-alt)',
                  border: `2px solid ${isSelected ? 'var(--color-primary)' : 'var(--color-border)'}`,
                  borderRadius: 10,
                  padding: 14,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                  cursor: 'pointer',
                  boxShadow: isSelected ? '0 4px 16px rgba(99, 102, 241, 0.25)' : 'none',
                  transition: 'all 0.2s ease',
                  position: 'relative',
                  overflow: 'hidden'
                }}
              >
                {/* Active Ribbon */}
                {isSelected && (
                  <div style={{
                    position: 'absolute',
                    top: 0,
                    right: 0,
                    background: 'var(--color-primary)',
                    color: '#fff',
                    fontSize: 10,
                    fontWeight: 800,
                    padding: '3px 10px',
                    borderBottomLeftRadius: 8,
                    letterSpacing: 0.5
                  }}>
                    ✓ SEÇİLİ
                  </div>
                )}

                {/* Title & Icon */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 24 }}>{t.icon}</span>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 13.5, color: 'var(--color-text)' }}>{t.name}</div>
                    <span className={`badge ${t.badgeColor}`} style={{ fontSize: 9.5, marginTop: 2 }}>{t.badge}</span>
                  </div>
                </div>

                {/* Description */}
                <div style={{ fontSize: 11.5, color: 'var(--color-text-secondary)', lineHeight: 1.4, flex: 1 }}>
                  {t.desc}
                </div>

                {/* Color Swatch Preview */}
                <div style={{
                  display: 'flex',
                  height: 18,
                  borderRadius: 6,
                  overflow: 'hidden',
                  border: '1px solid var(--color-border)'
                }}>
                  {t.previewColors.map((c, i) => (
                    <div key={i} style={{ flex: 1, background: c }} />
                  ))}
                </div>

                {/* Action Select Button */}
                <button
                  type="button"
                  className={`btn btn-sm ${isSelected ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSelectTheme(t.id);
                  }}
                  style={{ marginTop: 4, width: '100%', fontWeight: 700, fontSize: 11.5 }}
                >
                  {isSelected ? '✓ Aktif Tema' : 'Bu Temayı Seç'}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </Modal>
  );
}
