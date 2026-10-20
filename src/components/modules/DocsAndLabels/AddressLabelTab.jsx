import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../../../context/AppContext';
import { findBestUserMatch } from '../../../utils/textUtils';
import './docsAndLabels.css';

const emptyParty = {
  name: '',
  userId: '',
  site: '',
  address: '',
  extra: '',
};

function normalizeText(value) {
  return String(value || '').trim();
}

function joinLine(parts, separator = ' ') {
  return parts.map(normalizeText).filter(Boolean).join(separator);
}

function formatLocationAddress(location) {
  if (!location) return '';
  const addressLine = joinLine([location.address, location.address2], ', ');
  const districtCity = location.state && location.city
    ? `${location.state}/${location.city}`
    : joinLine([location.state, location.city], '/');
  const cityLine = joinLine([location.zip, districtCity]);

  return [addressLine, cityLine, location.country]
    .map(normalizeText)
    .filter(Boolean)
    .join('\n');
}

const LOCATION_COMPANY_MAP = {};

function getCompanyForLocation(locationName, companies = []) {
  if (!locationName) return '';
  const cleanLoc = locationName.trim().toUpperCase();
  
  if (LOCATION_COMPANY_MAP[cleanLoc]) {
    return LOCATION_COMPANY_MAP[cleanLoc];
  }
  
  const matched = companies.find(c => {
    const cName = (c.name || '').toUpperCase();
    return cName.includes(cleanLoc) || cleanLoc.includes(cName);
  });

  return matched ? matched.name : locationName;
}

function buildParty(party, users, locations, companies) {
  const user = users.find(item => String(item.id) === String(party.userId));
  const location = locations.find(item => String(item.id) === String(user?.location_id || ''));

  const autoCompanyName = getCompanyForLocation(user?.location_name || location?.name, companies);
  const displayCompany = party.site !== undefined && party.site !== '' ? party.site : (autoCompanyName || user?.location_name || '');
  const displayName = party.name !== undefined && party.name !== '' ? party.name : (user?.name || '');
  const displayAddress = party.address !== undefined && party.address !== '' ? party.address : formatLocationAddress(location);

  return {
    user,
    location,
    name: displayName,
    site: displayCompany,
    address: displayAddress,
    extra: normalizeText(party.extra),
  };
}

function FragileHeroSvg() {
  return (
    <svg className="fragile-hero-icon" viewBox="0 0 180 180" role="img" aria-label="Dikkat kırılır">
      <rect width="180" height="180" rx="10" fill="#ef4444" />
      <text x="90" y="38" textAnchor="middle" fill="#ffffff" fontWeight="900" fontSize="22" letterSpacing="1">DİKKAT</text>
      <g fill="#fff">
        <path d="M54 55h72v16c0 24-15 43-36 43S54 95 54 71V55zm16 15c0 16 8 29 20 29s20-13 20-29H70z" />
        <rect x="84" y="108" width="12" height="33" rx="3" />
        <rect x="62" y="139" width="56" height="10" rx="5" />
      </g>
      <path d="M96 58 82 84h17l-13 28 31-38H99l12-16z" fill="#ef4444" />
      <text x="90" y="165" textAnchor="middle" fill="#ffffff" fontWeight="900" fontSize="22" letterSpacing="1">KIRILIR</text>
    </svg>
  );
}

export default function AddressLabelTab() {
  const { showNotification, refreshToggle, settings } = useApp();
  const [users, setUsers] = useState([]);
  const [locations, setLocations] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);

  const [sender, setSender] = useState(emptyParty);
  const [receiver, setReceiver] = useState(emptyParty);
  const [format, setFormat] = useState('a4'); // 'a4', '100x150', '54x24'
  const [fragile, setFragile] = useState(true);

  // 54x24 mm mini barkod etiket durumları
  const [labelTopText, setLabelTopText] = useState('SP330 TONER');
  const [labelMiddleText, setLabelMiddleText] = useState('');
  const [labelBottomText, setLabelBottomText] = useState('');

  const loadedRef = useRef(false);

  // Veritabanı verilerini yükle
  const load = useCallback(async () => {
    if (!loadedRef.current) setLoading(true);
    try {
      const [usersRes, locationsRes, companiesRes] = await Promise.all([
        window.electronAPI.query(`
          SELECT u.*, l.name AS location_full_name
          FROM cached_users u
          LEFT JOIN cached_locations l ON u.location_id = l.id
          ORDER BY u.name ASC
        `, []),
        window.electronAPI.query('SELECT * FROM cached_locations ORDER BY name ASC', []),
        window.electronAPI.query('SELECT * FROM cached_companies ORDER BY name ASC', []),
      ]);
      if (usersRes.success) setUsers(usersRes.data || []);
      if (locationsRes.success) setLocations(locationsRes.data || []);
      if (companiesRes.success) setCompanies(companiesRes.data || []);
    } catch (err) {
      showNotification('Veriler yüklenirken hata: ' + err.message, 'danger');
    } finally {
      loadedRef.current = true;
      setLoading(false);
    }
  }, [showNotification]);

  useEffect(() => { load(); }, [load, refreshToggle]);

  const senderInfo = useMemo(() => buildParty(sender, users, locations, companies), [sender, users, locations, companies]);
  const receiverInfo = useMemo(() => buildParty(receiver, users, locations, companies), [receiver, users, locations, companies]);

  // Alıcı değiştiğinde 54x24 etiket metinlerini otomatik doldur
  useEffect(() => {
    if (receiverInfo.name) setLabelMiddleText(receiverInfo.name.toUpperCase());
    if (receiverInfo.site) setLabelBottomText(receiverInfo.site.toUpperCase());
  }, [receiverInfo.name, receiverInfo.site]);

  // Bitro AI'dan gelen otomatik etiket doldurma isteği
  useEffect(() => {
    if (users.length === 0) return;

    const processPending = (receiverName, senderName) => {
      if (receiverName) {
        const matchedRec = findBestUserMatch(receiverName, users);
        if (matchedRec) handleUserChange('receiver', matchedRec.id);
      }
      if (senderName) {
        const matchedSen = findBestUserMatch(senderName, users);
        if (matchedSen) handleUserChange('sender', matchedSen.id);
      }
    };

    try {
      const pending = window.__PENDING_ADDRESS_LABEL__ || JSON.parse(localStorage.getItem('service_tracker_pending_label') || 'null');
      if (pending) {
        window.__PENDING_ADDRESS_LABEL__ = null;
        localStorage.removeItem('service_tracker_pending_label');
        processPending(pending.receiverName, pending.senderName);
      }
    } catch (e) {}

    const handleEvent = (e) => {
      const { receiverName, senderName } = e.detail || {};
      processPending(receiverName, senderName);
    };

    window.addEventListener('service_tracker_prepare_label', handleEvent);
    return () => window.removeEventListener('service_tracker_prepare_label', handleEvent);
  }, [users]);

  const handleUserChange = (type, userId) => {
    const user = users.find(item => String(item.id) === String(userId));
    const location = locations.find(item => String(item.id) === String(user?.location_id || ''));
    const autoCompanyName = getCompanyForLocation(user?.location_name || location?.name, companies);

    const update = prev => ({
      ...prev,
      userId,
      name: user ? user.name : (prev.name || ''),
      site: autoCompanyName || '',
      address: location ? formatLocationAddress(location) : prev.address,
    });
    if (type === 'sender') setSender(update);
    else setReceiver(update);
  };

  const handleSwap = () => {
    setSender(receiver);
    setReceiver(sender);
    showNotification('Gönderici ve Alıcı yer değiştirildi.', 'info');
  };

  // Yazdırma Motoru
  const handlePrint = () => {
    if (format === '54x24') {
      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8" />
            <title>Barkod & Toner Etiketi</title>
            <style>
              @page { size: 54mm 24mm; margin: 0; }
              html, body {
                margin: 0 !important; padding: 0 !important;
                width: 54mm !important; height: 24mm !important;
                background-color: #fff !important; color: #000 !important;
                font-family: 'Inter', system-ui, -apple-system, sans-serif;
                overflow: hidden;
              }
              .barcode-box {
                width: 54mm; height: 24mm; box-sizing: border-box;
                padding: 1.5mm 2mm;
                display: flex; flex-direction: column;
                justify-content: center; align-items: center;
                text-align: center;
              }
              .t-top { font-weight: 900; font-size: 11pt; text-align: center; text-transform: uppercase; word-break: break-word; line-height: 1.15; width: 100%; }
              .t-mid { font-weight: 700; font-size: 9pt; text-align: center; margin-top: 1.2mm; word-break: break-word; line-height: 1.15; width: 100%; }
              .t-bot { font-weight: 600; font-size: 7.5pt; color: #222; text-align: center; margin-top: 1mm; word-break: break-word; line-height: 1.15; width: 100%; }
            </style>
          </head>
          <body>
            <div class="barcode-box">
              ${labelTopText ? `<div class="t-top">${labelTopText}</div>` : ''}
              ${labelMiddleText ? `<div class="t-mid">${labelMiddleText}</div>` : ''}
              ${labelBottomText ? `<div class="t-bot">${labelBottomText}</div>` : ''}
            </div>
          </body>
        </html>
      `;
      printHtml(html);
      return;
    }

    if (format === '100x150') {
      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8" />
            <title>Kargo Adres Etiketi</title>
            <style>
              @page { size: 100mm 150mm; margin: 0; }
              html, body {
                margin: 0; padding: 0; background: #fff; color: #000;
                font-family: 'Inter', system-ui, sans-serif;
              }
              .label-page {
                width: 100mm; min-height: 150mm; box-sizing: border-box; padding: 6mm;
                display: flex; flex-direction: column; justify-content: space-between;
              }
              .brand-row {
                display: flex; justify-content: space-between; align-items: center;
                border-bottom: 2.5px solid #000; padding-bottom: 3mm; margin-bottom: 4mm;
              }
              .brand-title { font-size: 15pt; font-weight: 900; }
              .box {
                border: 1.5px solid #000; border-radius: 4px; padding: 3mm 4mm; margin-bottom: 3mm;
              }
              .box-receiver { border: 2.5px solid #000; background: #fafafa; }
              .box-role { font-size: 8pt; font-weight: 900; text-transform: uppercase; letter-spacing: 0.5px; }
              .box-name { font-size: 13pt; font-weight: 800; margin-top: 1mm; }
              .box-site { font-size: 10.5pt; font-weight: 700; color: #222; }
              .box-addr { font-size: 9.5pt; color: #333; margin-top: 2mm; line-height: 1.35; white-space: pre-line; }
              .footer-row {
                display: flex; justify-content: space-between; align-items: flex-end;
                border-top: 2px solid #000; padding-top: 3mm; margin-top: 4mm;
              }
            </style>
          </head>
          <body>
            <div class="label-page">
              <div>
                <div class="brand-row">
                  <div class="brand-title">KARGO SEVKİYAT ETİKETİ</div>
                  <div style="font-size: 10pt; font-weight: 700;">${new Date().toLocaleDateString('tr-TR')}</div>
                </div>
                <div class="box box-receiver">
                  <div class="box-role">🎯 ALICI (TESLİM ALACAK KİŞİ / BİRİM)</div>
                  <div class="box-name">${receiverInfo.name || 'ALICI BELİRTİLMEDİ'}</div>
                  <div class="box-site">${receiverInfo.site || ''}</div>
                  <div class="box-addr">${receiverInfo.address || ''}</div>
                  ${receiverInfo.extra ? `<div style="font-size: 9pt; font-weight: 700; margin-top: 2mm; color: #555;">Not: ${receiverInfo.extra}</div>` : ''}
                </div>
                <div class="box">
                  <div class="box-role">🏢 GÖNDERİCİ (ÇIKIŞ BİRİMİ)</div>
                  <div class="box-name">${senderInfo.name || settings?.brand_title || 'BİLGİ TEKNOLOJİLERİ'}</div>
                  <div class="box-site">${senderInfo.site || settings?.company_name || ''}</div>
                  <div class="box-addr">${senderInfo.address || settings?.company_address || ''}</div>
                </div>
              </div>
              <div class="footer-row">
                <div style="font-size: 8pt; color: #666;">ServiceTracker Kurumsal Etiket Sistemi</div>
                ${fragile ? `<div style="background: #ef4444; color: #fff; padding: 3mm 5mm; border-radius: 4px; font-weight: 900; font-size: 10pt;">⚠️ DİKKAT KIRILIR</div>` : ''}
              </div>
            </div>
          </body>
        </html>
      `;
      printHtml(html);
      return;
    }

    // A4 Formatı Baskısı (Tam Sayfa Eşleşen Tasarım)
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>A4 Kargo Adres Etiketi</title>
          <style>
            @page { size: A4 portrait; margin: 10mm; }
            html, body {
              margin: 0; padding: 0; background: #fff; color: #000;
              font-family: 'Inter', system-ui, -apple-system, sans-serif;
            }
            .a4-container {
              width: 190mm; margin: 0 auto; box-sizing: border-box;
            }
            .cards-row {
              display: grid; grid-template-columns: 1fr 1fr; gap: 6mm; margin-bottom: 8mm;
            }
            .card {
              border: 1.5pt solid #222; border-radius: 4mm; padding: 5mm; min-height: 55mm; box-sizing: border-box;
            }
            .card-title {
              font-size: 10pt; font-weight: 900; text-transform: uppercase; letter-spacing: 0.5px; color: #555;
            }
            .card-divider {
              border-bottom: 1pt dashed #bbb; margin: 2mm 0 3mm;
            }
            .card-name { font-size: 14pt; font-weight: 800; color: #000; margin-bottom: 1mm; }
            .card-company { font-size: 11pt; font-weight: 700; color: #333; margin-bottom: 2mm; }
            .card-address { font-size: 10pt; color: #444; line-height: 1.4; white-space: pre-line; }
            .fragile-box {
              min-height: 115mm; border: 2pt dashed #ef4444; background: #fff5f5;
              border-radius: 4mm; display: flex; flex-direction: column; align-items: center; justify-content: center;
              text-align: center; padding: 8mm; box-sizing: border-box;
            }
            .fragile-svg { width: 45mm; height: 45mm; margin-bottom: 3mm; }
            .fragile-letterspace { color: #ef4444; font-size: 16pt; font-weight: 900; letter-spacing: 6px; margin-top: 2mm; }
            .fragile-main { color: #ef4444; font-size: 38pt; font-weight: 900; line-height: 1.1; }
            .fragile-sub { color: #ef4444; font-size: 13pt; font-weight: 800; margin-top: 2mm; }
          </style>
        </head>
        <body>
          <div class="a4-container">
            <div class="cards-row">
              <div class="card">
                <div class="card-title">GÖNDEREN</div>
                <div class="card-divider"></div>
                <div class="card-name">${senderInfo.name || settings?.brand_title || 'Bilgi Teknolojileri'}</div>
                <div class="card-company">${senderInfo.site || settings?.company_name || ''}</div>
                <div class="card-address">${senderInfo.address || settings?.company_address || ''}</div>
              </div>
              <div class="card">
                <div class="card-title">ALICI</div>
                <div class="card-divider"></div>
                <div class="card-name">${receiverInfo.name || 'Alıcı Seçiniz'}</div>
                <div class="card-company">${receiverInfo.site || ''}</div>
                <div class="card-address">${receiverInfo.address || 'Adres belirtilmedi'}</div>
                ${receiverInfo.extra ? `<div style="font-size: 9.5pt; font-weight: 700; color: #2563eb; margin-top: 2mm;">Not: ${receiverInfo.extra}</div>` : ''}
              </div>
            </div>

            ${fragile ? `
              <div class="fragile-box">
                <svg class="fragile-svg" viewBox="0 0 180 180" role="img">
                  <rect width="180" height="180" rx="10" fill="#ef4444" />
                  <text x="90" y="38" textAnchor="middle" fill="#ffffff" fontWeight="900" fontSize="22" letterSpacing="1">DİKKAT</text>
                  <g fill="#fff">
                    <path d="M54 55h72v16c0 24-15 43-36 43S54 95 54 71V55zm16 15c0 16 8 29 20 29s20-13 20-29H70z" />
                    <rect x="84" y="108" width="12" height="33" rx="3" />
                    <rect x="62" y="139" width="56" height="10" rx="5" />
                  </g>
                  <path d="M96 58 82 84h17l-13 28 31-38H99l12-16z" fill="#ef4444" />
                  <text x="90" y="165" textAnchor="middle" fill="#ffffff" fontWeight="900" fontSize="22" letterSpacing="1">KIRILIR</text>
                </svg>
                <div class="fragile-letterspace">D İ K K A T</div>
                <div class="fragile-main">KIRILIR</div>
                <div class="fragile-sub">Hassas ve kırılabilir eşya. Lütfen dikkatli taşıyınız.</div>
              </div>
            ` : ''}
          </div>
        </body>
      </html>
    `;
    printHtml(html);
  };

  const printHtml = (content) => {
    window.electronAPI.printHtml(content);
  };

  return (
    <div className="address-workspace">
      {/* ── LEFT CONTROLS PANEL ── */}
      <div className="address-controls-panel">
        {/* ALICI BÖLÜMÜ */}
        <div className="address-section-card">
          <div className="address-section-header">
            <span>🎯 Alıcı Bilgileri</span>
            <span className="address-section-badge receiver">Hedef</span>
          </div>

          <div className="form-group" style={{ marginBottom: 8 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 4 }}>
              Personel Seçiniz (Snipe-IT)
            </label>
            <select
              className="form-control"
              value={receiver.userId}
              onChange={e => handleUserChange('receiver', e.target.value)}
              style={{ background: 'var(--color-surface)', color: 'var(--color-text)', fontSize: 12, border: '1px solid var(--color-border)' }}
            >
              <option value="">— Personel Listesinden Seçin —</option>
              {users.map(u => (
                <option key={u.id} value={u.id}>{u.name} ({u.location_full_name || u.location_name || 'Lokasyonsuz'})</option>
              ))}
            </select>
          </div>

          <div className="form-group" style={{ marginBottom: 8 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 4 }}>
              Alıcı Adı / Yetkili
            </label>
            <input
              type="text"
              className="form-control"
              placeholder="Örn: Ahmet Yılmaz veya Yetkili Kişi"
              value={receiver.name !== undefined ? receiver.name : (receiverInfo.name || '')}
              onChange={e => setReceiver(prev => ({ ...prev, name: e.target.value }))}
              style={{ background: 'var(--color-surface)', color: 'var(--color-text)', fontSize: 12, border: '1px solid var(--color-border)', fontWeight: 600 }}
            />
          </div>

          <div className="form-group" style={{ marginBottom: 8 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 4 }}>
              Şirket / Tesis Adı
            </label>
            <input
              type="text"
              className="form-control"
              placeholder="Örn: Örnek Fabrika"
              value={receiver.site !== undefined ? receiver.site : (receiverInfo.site || '')}
              onChange={e => setReceiver(prev => ({ ...prev, site: e.target.value }))}
              style={{ background: 'var(--color-surface)', color: 'var(--color-text)', fontSize: 12, border: '1px solid var(--color-border)' }}
            />
          </div>

          <div className="form-group" style={{ marginBottom: 8 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 4 }}>
              Teslimat Adresi
            </label>
            <textarea
              className="form-control"
              rows={2}
              placeholder="Açık adres..."
              value={receiver.address !== undefined ? receiver.address : (receiverInfo.address || '')}
              onChange={e => setReceiver(prev => ({ ...prev, address: e.target.value }))}
              style={{ background: 'var(--color-surface)', color: 'var(--color-text)', fontSize: 11.5, border: '1px solid var(--color-border)' }}
            />
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 4 }}>
              Ek Not / İletişim / Tel (Kargo Açıklaması)
            </label>
            <input
              type="text"
              className="form-control"
              placeholder="Örn: Tel: 0532..., Karşı Ödemeli, Danışmaya Bırakılsın"
              value={receiver.extra || ''}
              onChange={e => setReceiver(prev => ({ ...prev, extra: e.target.value }))}
              style={{ background: 'var(--color-surface)', color: 'var(--color-text)', fontSize: 11.5, border: '1px solid var(--color-border)' }}
            />
          </div>
        </div>

        {/* SWAP BUTTON */}
        <button type="button" className="address-swap-btn" onClick={handleSwap} title="Gönderici ile Alıcıyı Değiştir">
          <span>🔄</span>
          <span>Gönderici ⇋ Alıcıyı Değiştir</span>
        </button>

        {/* GÖNDERİCİ BÖLÜMÜ */}
        <div className="address-section-card">
          <div className="address-section-header">
            <span>🏢 Gönderici Bilgileri</span>
            <span className="address-section-badge sender">Çıkış</span>
          </div>

          <div className="form-group" style={{ marginBottom: 8 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 4 }}>
              Gönderen Personel / Birim
            </label>
            <select
              className="form-control"
              value={sender.userId}
              onChange={e => handleUserChange('sender', e.target.value)}
              style={{ background: 'var(--color-surface)', color: 'var(--color-text)', fontSize: 12, border: '1px solid var(--color-border)' }}
            >
              <option value="">— Varsayılan (Bilgi Teknolojileri) —</option>
              {users.map(u => (
                <option key={u.id} value={u.id}>{u.name} ({u.location_full_name || u.location_name || 'Lokasyon'})</option>
              ))}
            </select>
          </div>

          <div className="form-group" style={{ marginBottom: 8 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 4 }}>
              Gönderici Adı / Birim
            </label>
            <input
              type="text"
              className="form-control"
              placeholder="Örn: Bilgi Teknolojileri"
              value={sender.name !== undefined ? sender.name : (senderInfo.name || '')}
              onChange={e => setSender(prev => ({ ...prev, name: e.target.value }))}
              style={{ background: 'var(--color-surface)', color: 'var(--color-text)', fontSize: 12, border: '1px solid var(--color-border)', fontWeight: 600 }}
            />
          </div>

          <div className="form-group" style={{ marginBottom: 8 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 4 }}>
              Şirket / Tesis Adı
            </label>
            <input
              type="text"
              className="form-control"
              placeholder="Örn: Örnek Teknoloji Grubu"
              value={sender.site !== undefined ? sender.site : (senderInfo.site || '')}
              onChange={e => setSender(prev => ({ ...prev, site: e.target.value }))}
              style={{ background: 'var(--color-surface)', color: 'var(--color-text)', fontSize: 12, border: '1px solid var(--color-border)' }}
            />
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 4 }}>
              Gönderici Adresi
            </label>
            <textarea
              className="form-control"
              rows={2}
              placeholder="Gönderen açık adres..."
              value={sender.address !== undefined ? sender.address : (senderInfo.address || '')}
              onChange={e => setSender(prev => ({ ...prev, address: e.target.value }))}
              style={{ background: 'var(--color-surface)', color: 'var(--color-text)', fontSize: 11.5, border: '1px solid var(--color-border)' }}
            />
          </div>
        </div>

        {/* 54x24 MM TONER & BARKOD ETİKETİ METİN DÜZENLEME PANELİ */}
        {format === '54x24' && (
          <div className="address-section-card" style={{ border: '1.5px solid var(--color-primary)', background: 'var(--color-surface-alt)' }}>
            <div className="address-section-header">
              <span style={{ color: 'var(--color-primary)', fontWeight: 800 }}>🔖 54x24 mm Barkod & Etiket Metinleri</span>
              <span className="address-section-badge" style={{ background: 'var(--color-primary)', color: '#fff' }}>Mini Termal</span>
            </div>

            <div className="form-group" style={{ marginBottom: 8 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text)', marginBottom: 4, display: 'flex', justifyContent: 'space-between' }}>
                <span>🏷️ 1. Satır (Başlık / Toner / Barkod)</span>
                <span style={{ fontSize: 10, color: 'var(--color-primary)' }}>Ortalanır</span>
              </label>
              <input
                type="text"
                className="form-control"
                placeholder="Örn: SP330 TONER, HP 106A, 34-ABC-01, ARŞİV-2026..."
                value={labelTopText}
                onChange={e => setLabelTopText(e.target.value)}
                style={{ background: 'var(--color-surface)', color: 'var(--color-text)', fontSize: 12, border: '1px solid var(--color-border)', fontWeight: 800 }}
              />
            </div>

            <div className="form-group" style={{ marginBottom: 8 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text)', marginBottom: 4 }}>
                👤 2. Satır (Personel / Alıcı Adı)
              </label>
              <input
                type="text"
                className="form-control"
                placeholder="Örn: AHMET YILMAZ"
                value={labelMiddleText}
                onChange={e => setLabelMiddleText(e.target.value)}
                style={{ background: 'var(--color-surface)', color: 'var(--color-text)', fontSize: 12, border: '1px solid var(--color-border)' }}
              />
            </div>

            <div className="form-group" style={{ marginBottom: 10 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text)', marginBottom: 4 }}>
                🏢 3. Satır (Şirket / Lokasyon / Birim)
              </label>
              <input
                type="text"
                className="form-control"
                placeholder="Örn: ÖRNEK TEKNOLOJİ GRUBU"
                value={labelBottomText}
                onChange={e => setLabelBottomText(e.target.value)}
                style={{ background: 'var(--color-surface)', color: 'var(--color-text)', fontSize: 12, border: '1px solid var(--color-border)' }}
              />
            </div>

            {/* Hızlı Şablonlar */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn btn-xs btn-secondary"
                onClick={() => {
                  setLabelTopText('SP330 TONER');
                  setLabelMiddleText(receiverInfo.name ? receiverInfo.name.toUpperCase() : 'AHMET YILMAZ');
                  setLabelBottomText(receiverInfo.site ? receiverInfo.site.toUpperCase() : 'ÖRNEK TEKNOLOJİ GRUBU');
                }}
                style={{ fontSize: 10.5, padding: '3px 8px' }}
              >
                🖨️ Toner Şablonu
              </button>
              <button
                type="button"
                className="btn btn-xs btn-secondary"
                onClick={() => {
                  setLabelTopText(receiverInfo.site ? receiverInfo.site.toUpperCase() : 'ÖRNEK TEKNOLOJİ GRUBU');
                  setLabelMiddleText(receiverInfo.name ? receiverInfo.name.toUpperCase() : 'PERSONEL');
                  setLabelBottomText(new Date().toLocaleDateString('tr-TR'));
                }}
                style={{ fontSize: 10.5, padding: '3px 8px' }}
              >
                👤 Personel Şablonu
              </button>
              <button
                type="button"
                className="btn btn-xs btn-secondary"
                onClick={() => {
                  setLabelTopText('');
                  setLabelMiddleText('');
                  setLabelBottomText('');
                }}
                style={{ fontSize: 10.5, padding: '3px 8px' }}
              >
                ✕ Temizle
              </button>
            </div>
          </div>
        )}

        {/* AYARLAR */}
        {format !== '54x24' && (
          <div className="address-section-card">
            <div className="address-section-header">
              <span>⚙️ Etiket & Sevkiyat Ayarları</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 0' }}>
              <span style={{ fontSize: 12, fontWeight: 600 }}>🚨 "Kırılabilir Malzeme" Kutusu</span>
              <input
                type="checkbox"
                checked={fragile}
                onChange={e => setFragile(e.target.checked)}
                style={{ width: 18, height: 18, cursor: 'pointer', accentColor: '#ef4444' }}
              />
            </div>
          </div>
        )}
      </div>

      {/* ── RIGHT LIVE PREVIEW PANEL ── */}
      <div className="address-preview-panel">
        {/* Top Format Selector & Print Bar */}
        <div className="address-preview-toolbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text)' }}>Baskı Formatı:</span>
            <div className="address-format-chips">
              <button
                type="button"
                className={`address-chip-btn ${format === 'a4' ? 'active' : ''}`}
                onClick={() => setFormat('a4')}
              >
                📄 A4 Standart Kargo (Fotoğraftaki Düzen)
              </button>
              <button
                type="button"
                className={`address-chip-btn ${format === '100x150' ? 'active' : ''}`}
                onClick={() => setFormat('100x150')}
              >
                🏷️ 100x150 mm Termal
              </button>
              <button
                type="button"
                className={`address-chip-btn ${format === '54x24' ? 'active' : ''}`}
                onClick={() => setFormat('54x24')}
              >
                🔖 54x24 mm Toner/Barkod
              </button>
            </div>
          </div>

          <button
            type="button"
            className="btn btn-primary"
            onClick={handlePrint}
            style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, padding: '7px 16px' }}
          >
            <span>🖨️</span>
            <span>Etiketi Yazdır</span>
          </button>
        </div>

        {/* Viewport with Exact Matching Preview */}
        <div className="address-preview-viewport">
          {format === 'a4' ? (
            <div className="address-print-page-a4">
              {/* TOP CARDS ROW */}
              <div className="address-cards-grid">
                {/* GÖNDEREN CARD */}
                <div className="address-grid-card">
                  <div className="address-grid-card-title">GÖNDEREN</div>
                  <div className="address-grid-card-divider"></div>
                  <div className="address-grid-card-name">{senderInfo.name || 'Gönderen seçin'}</div>
                  <div className="address-grid-card-company">{senderInfo.site || settings?.company_name || ''}</div>
                  <div className="address-grid-card-address">{senderInfo.address || settings?.company_address || 'Adres seçilmedi'}</div>
                </div>

                {/* ALICI CARD */}
                <div className="address-grid-card">
                  <div className="address-grid-card-title">ALICI</div>
                  <div className="address-grid-card-divider"></div>
                  <div className="address-grid-card-name">{receiverInfo.name || 'Alıcı seçin'}</div>
                  <div className="address-grid-card-company">{receiverInfo.site || ''}</div>
                  <div className="address-grid-card-address">{receiverInfo.address || 'Adres seçilmedi'}</div>
                  {receiverInfo.extra && <div className="address-grid-card-extra">Not: {receiverInfo.extra}</div>}
                </div>
              </div>

              {/* BOTTOM FRAGILE BOX */}
              {fragile && (
                <div className="fragile-hero-box">
                  <FragileHeroSvg />
                  <div className="fragile-letterspaced-title">D İ K K A T</div>
                  <div className="fragile-hero-main">KIRILIR</div>
                  <div className="fragile-hero-sub">Hassas ve kırılabilir eşya. Lütfen dikkatli taşıyınız.</div>
                </div>
              )}
            </div>
          ) : format === '100x150' ? (
            <div className="paper-thermal-100x150">
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #000', paddingBottom: 8, marginBottom: 12 }}>
                  <div style={{ fontWeight: 900, fontSize: 16 }}>📦 KARGO SEVKİYAT ETİKETİ</div>
                  <div style={{ fontWeight: 700, fontSize: 11 }}>{new Date().toLocaleDateString('tr-TR')}</div>
                </div>
                <div style={{ border: '2px solid #000', padding: 10, borderRadius: 4, marginBottom: 10, background: '#fafafa' }}>
                  <div style={{ fontSize: 9, fontWeight: 900, textTransform: 'uppercase' }}>🎯 ALICI</div>
                  <div style={{ fontSize: 14, fontWeight: 800 }}>{receiverInfo.name || 'ALICI SEÇİLMEDİ'}</div>
                  <div style={{ fontSize: 11, fontWeight: 700 }}>{receiverInfo.site || ''}</div>
                  <div style={{ fontSize: 10, color: '#333', whiteSpace: 'pre-line', marginTop: 4 }}>{receiverInfo.address || ''}</div>
                </div>
                <div style={{ border: '1.5px solid #000', padding: 8, borderRadius: 4 }}>
                  <div style={{ fontSize: 9, fontWeight: 900, textTransform: 'uppercase' }}>🏢 GÖNDEREN</div>
                  <div style={{ fontSize: 13, fontWeight: 800 }}>{senderInfo.name || settings?.brand_title || 'Bilgi Teknolojileri'}</div>
                  <div style={{ fontSize: 10, color: '#333', whiteSpace: 'pre-line', marginTop: 2 }}>{senderInfo.address || settings?.company_address || ''}</div>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderTop: '2px solid #000', paddingTop: 8 }}>
                <div style={{ fontSize: 9, color: '#666' }}>ServiceTracker Kurumsal Etiket</div>
                {fragile && (
                  <div style={{ background: '#ef4444', color: '#fff', padding: '4px 8px', borderRadius: 4, fontWeight: 900, fontSize: 11 }}>
                    ⚠️ DİKKAT KIRILIR
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div style={{
              width: 340, minHeight: 150, background: '#fff', color: '#000', borderRadius: 8,
              boxShadow: '0 20px 40px rgba(0,0,0,0.5)', padding: '16px 20px', boxSizing: 'border-box',
              display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
              textAlign: 'center', gap: 8, border: '2px solid #e2e8f0'
            }}>
              <div style={{ fontWeight: 900, fontSize: 16, textAlign: 'center', textTransform: 'uppercase', color: '#000', width: '100%', wordBreak: 'break-word' }}>
                {labelTopText || <span style={{ color: '#94a3b8', fontStyle: 'italic', fontSize: 13 }}>[1. Satır: Toner / Barkod Başlığı]</span>}
              </div>
              <div style={{ fontWeight: 700, fontSize: 13, textAlign: 'center', color: '#1e293b', width: '100%', wordBreak: 'break-word' }}>
                {labelMiddleText || <span style={{ color: '#94a3b8', fontStyle: 'italic', fontSize: 12 }}>[2. Satır: Personel / Alıcı Adı]</span>}
              </div>
              <div style={{ fontWeight: 600, fontSize: 11, textAlign: 'center', color: '#475569', width: '100%', wordBreak: 'break-word' }}>
                {labelBottomText || <span style={{ color: '#94a3b8', fontStyle: 'italic', fontSize: 11 }}>[3. Satır: Şirket / Lokasyon]</span>}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
