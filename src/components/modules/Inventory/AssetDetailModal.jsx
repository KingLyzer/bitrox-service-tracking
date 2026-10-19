import React from 'react';
import Modal from '../../common/Modal';
import { getCategoryBadgeConfig, getAssetStatusBadgeConfig } from './index';

export default function AssetDetailModal({ asset, onClose }) {
  if (!asset) return null;

  const categoryCfg = getCategoryBadgeConfig(asset.category_name);
  const statusCfg = getAssetStatusBadgeConfig(asset.status_name, asset.assigned_to_user_name);

  return (
    <Modal
      isOpen
      title={`Demirbaş Detayı: ${asset.asset_tag || asset.name || 'Cihaz'}`}
      onClose={onClose}
      size="lg"
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '4px 0' }}>
        {/* Top Highlight Banner */}
        <div style={{
          background: 'var(--color-surface-alt, rgba(255,255,255,0.04))',
          border: '1px solid var(--color-border)',
          borderRadius: 8,
          padding: '14px 18px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              fontSize: 26,
              width: 48,
              height: 48,
              borderRadius: 8,
              background: categoryCfg.bg,
              border: `1px solid ${categoryCfg.border}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              {categoryCfg.icon}
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--color-text)' }}>
                {asset.asset_tag} <span style={{ fontWeight: 500, fontSize: 13, color: 'var(--color-text-secondary)' }}>({asset.name})</span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '2px 8px',
                  borderRadius: 6,
                  fontSize: 11,
                  fontWeight: 600,
                  color: categoryCfg.color,
                  background: categoryCfg.bg,
                  border: `1px solid ${categoryCfg.border}`
                }}>
                  {categoryCfg.icon} {asset.category_name || 'Kategorisiz'}
                </span>
                <span>•</span>
                <span>{asset.manufacturer_name || ''} {asset.model_name || ''}</span>
              </div>
            </div>
          </div>
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '5px 12px',
            borderRadius: 6,
            fontSize: 12,
            fontWeight: 700,
            color: statusCfg.color,
            background: statusCfg.bg,
            border: `1px solid ${statusCfg.border}`,
            boxShadow: `0 2px 8px ${statusCfg.bg}`
          }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: statusCfg.dot, boxShadow: `0 0 6px ${statusCfg.dot}` }} />
            {statusCfg.label}
          </span>
        </div>

        {/* 2 Column Details Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
          {/* Box 1: Cihaz ve Donanım Bilgileri */}
          <div style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 8,
            padding: '14px 16px',
            display: 'flex',
            flexDirection: 'column',
            gap: 10
          }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--color-primary)', textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: '1px solid var(--color-border)', paddingBottom: 6 }}>
              📦 Cihaz & Model Bilgileri
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
              <span style={{ color: 'var(--color-text-secondary)' }}>Envanter Tag:</span>
              <span style={{ fontWeight: 700, color: 'var(--color-text)' }}>{asset.asset_tag || '—'}</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
              <span style={{ color: 'var(--color-text-secondary)' }}>Cihaz Adı:</span>
              <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>{asset.name || '—'}</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
              <span style={{ color: 'var(--color-text-secondary)' }}>Kategori:</span>
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                padding: '2px 8px',
                borderRadius: 6,
                fontSize: 11,
                fontWeight: 600,
                color: categoryCfg.color,
                background: categoryCfg.bg,
                border: `1px solid ${categoryCfg.border}`
              }}>
                {categoryCfg.icon} {asset.category_name || '—'}
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
              <span style={{ color: 'var(--color-text-secondary)' }}>Üretici / Marka:</span>
              <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>{asset.manufacturer_name || '—'}</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
              <span style={{ color: 'var(--color-text-secondary)' }}>Model Adı:</span>
              <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>{asset.model_name || '—'}</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
              <span style={{ color: 'var(--color-text-secondary)' }}>Seri Numarası:</span>
              <span style={{ fontWeight: 700, color: 'var(--color-primary)', fontFamily: 'monospace' }}>{asset.serial || '—'}</span>
            </div>
          </div>

          {/* Box 2: Zimmet & Konum Bilgileri */}
          <div style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 8,
            padding: '14px 16px',
            display: 'flex',
            flexDirection: 'column',
            gap: 10
          }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--color-primary)', textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: '1px solid var(--color-border)', paddingBottom: 6 }}>
              👤 Zimmet & Lokasyon
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
              <span style={{ color: 'var(--color-text-secondary)' }}>Zimmetli Personel:</span>
              <span style={{ fontWeight: 700, color: asset.assigned_to_user_name ? 'var(--color-text)' : 'var(--color-text-muted)' }}>
                {asset.assigned_to_user_name ? `👤 ${asset.assigned_to_user_name}` : '— (Boşta / Atanmamış)'}
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
              <span style={{ color: 'var(--color-text-secondary)' }}>Bulunduğu Lokasyon:</span>
              <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>🏢 {asset.location_name || 'Belirtilmedi'}</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
              <span style={{ color: 'var(--color-text-secondary)' }}>Envanter Durumu:</span>
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '2px 8px',
                borderRadius: 6,
                fontSize: 11,
                fontWeight: 600,
                color: statusCfg.color,
                background: statusCfg.bg,
                border: `1px solid ${statusCfg.border}`
              }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: statusCfg.dot }} />
                {statusCfg.label}
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
              <span style={{ color: 'var(--color-text-secondary)' }}>Snipe-IT ID:</span>
              <span style={{ fontWeight: 600, color: 'var(--color-text-secondary)' }}>#{asset.id}</span>
            </div>

            <div style={{ marginTop: 'auto', paddingTop: 8 }}>
              <a
                href={`https://snipe.example.com/hardware/${asset.id}`}
                target="_blank"
                rel="noreferrer"
                className="btn btn-secondary btn-sm"
                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 11.5 }}
              >
                🔗 Snipe-IT'de Görüntüle ↗
              </a>
            </div>
          </div>
        </div>

        {/* Bottom Actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
          <button className="btn btn-secondary" onClick={onClose}>
            Kapat
          </button>
        </div>
      </div>
    </Modal>
  );
}
