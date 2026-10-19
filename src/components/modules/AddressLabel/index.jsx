import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useApp } from '../../../context/AppContext';
import { findBestUserMatch } from '../../../utils/textUtils';
import './style.css';

const emptyParty = {
  userId: '',
  companyId: '',
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

function buildParty(party, users, locations, companies) {
  const user = users.find(item => String(item.id) === String(party.userId));
  const selectedCompany = companies.find(item => String(item.id) === String(party.companyId));
  const location = locations.find(item => String(item.id) === String(user?.location_id || ''));

  const autoCompanyName = user?.location_name ? getCompanyForLocation(user.location_name, companies) : '';
  const displayCompany = selectedCompany?.name || autoCompanyName || user?.location_name || '';

  return {
    user,
    company: selectedCompany,
    location,
    name: user?.name || '',
    site: displayCompany,
    address: party.address || formatLocationAddress(location),
    extra: normalizeText(party.extra),
  };
}

function FragileIcon() {
  return (
    <svg className="fragile-icon" viewBox="0 0 180 180" role="img" aria-label="Dikkat kırılır">
      <rect width="180" height="180" fill="#f70808" />
      <text x="90" y="38" textAnchor="middle" className="fragile-icon-text">DİKKAT</text>
      <g fill="#fff">
        <path d="M54 55h72v16c0 24-15 43-36 43S54 95 54 71V55zm16 15c0 16 8 29 20 29s20-13 20-29H70z" />
        <rect x="84" y="108" width="12" height="33" rx="3" />
        <rect x="62" y="139" width="56" height="10" rx="5" />
      </g>
      <path d="M96 58 82 84h17l-13 28 31-38H99l12-16z" fill="#f70808" />
      <text x="90" y="165" textAnchor="middle" className="fragile-icon-text">KIRILIR</text>
    </svg>
  );
}

const LOCATION_COMPANY_MAP = {
  'G10': 'Örnek Teknoloji Grubu',
  'G00': 'Örnek Teknoloji Grubu',
  'sirket.local': 'Örnek Teknoloji Grubu',
  'B11': 'Demo Teknoloji A.Ş.',
  'B12': 'Demo Üretim İşletmesi',
  'B20': 'Örnek Sanayi GM',
  'B21': 'Örnek Sanayi Fabrika 1',
  'B22': 'Örnek Sanayi Fabrika 2',
  'B41': 'Örnek Teknoloji Tesisleri',
  'K10': 'Demo Yapı İşletmesi',
  'K11': 'Demo Yapı İşletmesi',
  'K00': 'Demo Elektronik A.Ş.',
  'D00': 'Demo Elektrik A.Ş.',
  'E00': 'Esmek Demirali Ekmek',
  'E10': 'Esmek Demirali Ekmek',
  'JANUS': 'JANUS BARKOD TEKN.TURZ.SAN.TİC.LTD. ŞTİ',
};

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

export default function AddressLabel() {
  const { showNotification, refreshToggle, tableRefreshVersions = {}, activeTab } = useApp();
  const [users, setUsers] = useState([]);
  const [locations, setLocations] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sender, setSender] = useState(emptyParty);
  const [receiver, setReceiver] = useState(emptyParty);
  const [format, setFormat] = useState('a4-normal');
  const [fragile, setFragile] = useState(true);
  const loadedRef = useRef(false);

  // Custom barcode label states (default 54mm x 24mm)
  const [labelWidth, setLabelWidth] = useState(54);
  const [labelHeight, setLabelHeight] = useState(24);
  const [labelTopText, setLabelTopText] = useState('SP330 TONER');
  const [labelTopSize, setLabelTopSize] = useState(15);
  const [labelMiddleText, setLabelMiddleText] = useState('');
  const [labelMiddleSize, setLabelMiddleSize] = useState(15);
  const [labelBottomText, setLabelBottomText] = useState('');
  const [labelBottomSize, setLabelBottomSize] = useState(15);
  const [syncing, setSyncing] = useState(false);

  // Design customizations
  const [labelAlign, setLabelAlign] = useState('left');
  const [labelDivider, setLabelDivider] = useState(false);
  const [labelBorder, setLabelBorder] = useState(false);
  const [labelBottomBox, setLabelBottomBox] = useState(false);

  const prevReceiverRef = useRef({ name: '', site: '' });

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
      if (usersRes.success) setUsers(usersRes.data);
      if (locationsRes.success) setLocations(locationsRes.data);
      if (companiesRes.success) setCompanies(companiesRes.data);
    } catch (err) {
      showNotification('Veriler yüklenirken hata oluştu: ' + err.message, 'danger');
    } finally {
      loadedRef.current = true;
      setLoading(false);
    }
  }, [showNotification]);

  const addressRefreshVersion = [
    tableRefreshVersions.cached_users || 0,
    tableRefreshVersions.cached_locations || 0,
  ].join('|');

  useEffect(() => { load(); }, [load, refreshToggle, addressRefreshVersion]);

  const senderInfo = useMemo(() => buildParty(sender, users, locations, companies), [sender, users, locations, companies]);
  const receiverInfo = useMemo(() => buildParty(receiver, users, locations, companies), [receiver, users, locations, companies]);

  // Autofill barcode label middle & bottom fields from selected receiver
  useEffect(() => {
    if (format === 'etiket-barkod') {
      const currentName = receiverInfo.name || '';
      const currentSite = receiverInfo.site || '';
      if (currentName !== prevReceiverRef.current.name) {
        setLabelMiddleText(currentName.toUpperCase());
        prevReceiverRef.current.name = currentName;
      }
      if (currentSite !== prevReceiverRef.current.site) {
        setLabelBottomText(currentSite.toUpperCase());
        prevReceiverRef.current.site = currentSite;
      }
    }
  }, [receiverInfo.name, receiverInfo.site, format]);

  const handleUserChange = useCallback((type, userId) => {
    const user = users.find(item => String(item.id) === String(userId));
    const location = locations.find(item => String(item.id) === String(user?.location_id || ''));
    let autoCompanyId = '';
    if (user?.location_name) {
      const matchedName = getCompanyForLocation(user.location_name, companies);
      const matchedComp = companies.find(c => c.name === matchedName);
      if (matchedComp) autoCompanyId = String(matchedComp.id);
    }

    const update = prev => ({
      ...prev,
      userId,
      companyId: autoCompanyId || prev.companyId,
      address: location ? formatLocationAddress(location) : prev.address,
    });
    if (type === 'sender') setSender(update);
    else setReceiver(update);
  }, [users, locations, companies]);

  // Bitro AI veya Global Etkinlikten gelen otomatik doldurma
  useEffect(() => {
    if (users.length === 0) return;

    const processPending = (receiverName, senderName) => {
      if (receiverName) {
        const matchedRec = findBestUserMatch(receiverName, users);
        if (matchedRec) {
          handleUserChange('receiver', matchedRec.id);
        }
      }
      if (senderName) {
        const matchedSen = findBestUserMatch(senderName, users);
        if (matchedSen) {
          handleUserChange('sender', matchedSen.id);
        }
      }
    };

    // Check Window & LocalStorage
    try {
      const pending = window.__PENDING_ADDRESS_LABEL__ || JSON.parse(localStorage.getItem('service_tracker_pending_label') || 'null');
      if (pending) {
        window.__PENDING_ADDRESS_LABEL__ = null;
        localStorage.removeItem('service_tracker_pending_label');
        processPending(pending.receiverName, pending.senderName);
      }
    } catch (e) {}

    // Event Listener
    const handleEvent = (e) => {
      const { receiverName, senderName } = e.detail || {};
      processPending(receiverName, senderName);
    };

    window.addEventListener('service_tracker_prepare_label', handleEvent);
    return () => window.removeEventListener('service_tracker_prepare_label', handleEvent);
  }, [users, handleUserChange]);

  const handleCompanyChange = (setParty, companyId) => {
    setParty(prev => ({
      ...prev,
      companyId,
    }));
  };

  const handlePrint = () => {
    if (format === 'etiket-barkod') {
      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8" />
            <style>
              @page {
                size: ${labelWidth}mm ${labelHeight}mm;
                margin: 0;
              }
              html, body {
                margin: 0 !important;
                padding: 0 !important;
                width: ${labelWidth}mm !important;
                height: ${labelHeight}mm !important;
                background-color: #ffffff !important;
                color: #000000 !important;
                box-sizing: border-box !important;
                overflow: hidden !important;
                font-family: 'Inter', system-ui, -apple-system, sans-serif;
              }
              .barcode-container {
                width: 100% !important;
                height: 100% !important;
                padding: 2mm 3mm !important;
                box-sizing: border-box !important;
                display: flex !important;
                flex-direction: column !important;
                justify-content: space-around !important;
                align-items: ${labelAlign === 'center' ? 'center' : 'flex-start'} !important;
                border: ${labelBorder ? '1px solid #000000' : 'none'} !important;
              }
              .barcode-text {
                font-weight: 700;
                line-height: 1.1;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
                width: 100%;
                text-align: ${labelAlign};
              }
              .top-text {
                font-size: ${labelTopSize}px;
                text-transform: uppercase;
              }
              .middle-text {
                font-size: ${labelMiddleSize}px;
                font-weight: 900 !important;
                text-transform: uppercase;
              }
              .bottom-text {
                font-size: ${labelBottomSize}px;
                text-transform: uppercase;
              }
              .divider {
                width: 100%;
                border-top: 1.2px solid #000000;
                margin: 1mm 0;
                box-sizing: border-box;
              }
              .boxed-text span {
                background-color: #000000 !important;
                color: #ffffff !important;
                padding: 1px 4px !important;
                border-radius: 2px !important;
                display: inline-block !important;
                font-weight: 700 !important;
                line-height: 1.0 !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
            </style>
          </head>
          <body>
            <div class="barcode-container">
              <div class="barcode-text top-text">${labelTopText || ''}</div>
              ${labelDivider ? '<div class="divider"></div>' : ''}
              <div class="barcode-text middle-text">${labelMiddleText || ''}</div>
              <div class="barcode-text bottom-text ${labelBottomBox ? 'boxed-text' : ''}">
                <span>${labelBottomText || ''}</span>
              </div>
            </div>
          </body>
        </html>
      `;
      window.electronAPI.printHtml(html, { landscape: false });
      return;
    }
    if (!senderInfo.name || !senderInfo.address || !receiverInfo.name || !receiverInfo.address) {
      showNotification('Yazdırmadan önce gönderen ve alıcı kişi/adres bilgilerini tamamlayın.', 'warning');
      return;
    }
    window.electronAPI.print({ landscape: format === 'a5-normal' });
  };

  const handleSnipeSync = async () => {
    setSyncing(true);
    showNotification('Snipe-IT senkronizasyonu başlatıldı...', 'info');
    try {
      const res = await window.electronAPI.snipeitSync();
      if (res?.success) {
        showNotification('Snipe-IT verileri başarıyla güncellendi.', 'success');
        load();
      } else {
        showNotification('Senkronizasyon başarısız: ' + (res?.message || 'Bilinmeyen hata'), 'danger');
      }
    } catch (err) {
      showNotification('Senkronizasyon hatası: ' + err.message, 'danger');
    } finally {
      setSyncing(false);
    }
  };

  const renderUserOptions = () => (
    <>
      <option value="">Kullanıcı seçin</option>
      {users.map(user => (
        <option key={user.id} value={user.id}>
          {user.name}{user.location_name ? ` - ${user.location_name}` : ''}
        </option>
      ))}
    </>
  );

  const renderCompanyOptions = () => (
    <>
      <option value="">Şirket seçin</option>
      {companies.map(company => (
        <option key={company.id} value={company.id}>
          {company.name}
        </option>
      ))}
    </>
  );

  const renderPartyFields = (type, title, party, setParty) => {
    const info = type === 'sender' ? senderInfo : receiverInfo;
    return (
      <div className="address-form-section">
        <div className="address-form-section-title">{title}</div>
        <label>
          Kişi
          <select value={party.userId} onChange={e => handleUserChange(type, e.target.value)}>
            {renderUserOptions()}
          </select>
        </label>
        <label>
          Şirket Adı
          <select value={party.companyId} onChange={e => handleCompanyChange(setParty, e.target.value)}>
            {renderCompanyOptions()}
          </select>
        </label>
        <label>
          Adres
          <textarea
            value={party.address}
            onChange={e => setParty(prev => ({ ...prev, address: e.target.value }))}
            placeholder="Kullanıcının konum adresi otomatik gelir. Gerekirse elle düzenleyin."
          />
        </label>
        <label>
          Ek Bilgi
          <input
            type="text"
            value={party.extra}
            onChange={e => setParty(prev => ({ ...prev, extra: e.target.value }))}
            placeholder={type === 'sender' ? 'Dahili, departman, not...' : 'Birim, dikkat notu...'}
          />
        </label>
      </div>
    );
  };

  const renderLabelContent = () => {
    const senderCompany = senderInfo.site;
    const receiverCompany = receiverInfo.site;

    return (
      <>
        <div className="address-cards-row">
          <section className="address-card">
            <div className="address-card-title">GÖNDEREN</div>
            <div className="address-card-divider" />
            <div className="address-card-body">
              {senderCompany && <div className="address-card-company">{senderCompany.toUpperCase()}</div>}
              {senderInfo.name && <div className="address-card-name">{senderInfo.name.toUpperCase()}</div>}
              <div className="address-card-address">{senderInfo.address || 'Gönderen seçin'}</div>
              {senderInfo.extra && <div className="address-card-extra">{senderInfo.extra}</div>}
            </div>
          </section>

          <section className="address-card">
            <div className="address-card-title">ALICI</div>
            <div className="address-card-divider" />
            <div className="address-card-body">
              {receiverCompany && <div className="address-card-company">{receiverCompany.toUpperCase()}</div>}
              {receiverInfo.name && <div className="address-card-name">{receiverInfo.name.toUpperCase()}</div>}
              <div className="address-card-address">{receiverInfo.address || 'Alıcı seçin'}</div>
              {receiverInfo.extra && <div className="address-card-extra">{receiverInfo.extra}</div>}
            </div>
          </section>
        </div>

        {fragile && (
          <section className="fragile-box">
            <FragileIcon />
            <div className="fragile-letterspace">DİKKAT</div>
            <div className="fragile-main">KIRILIR</div>
            <p>Hassas ve kırılabilir eşya.<br />Lütfen dikkatli taşıyınız.</p>
          </section>
        )}
      </>
    );
  };

  const printStyle = useMemo(() => {
    if (format === 'etiket-barkod') {
      return `
        @media print {
          @page {
            size: ${labelWidth}mm ${labelHeight}mm;
            margin: 0;
          }
          .address-print-barcode {
            width: ${labelWidth}mm !important;
            height: ${labelHeight}mm !important;
            min-height: unset !important;
            margin: 0 !important;
            border: ${labelBorder ? '1px solid #000000' : 'none'} !important;
            box-shadow: none !important;
            transform: none !important;
            border-radius: 0 !important;
            padding: 2mm 3mm !important;
            box-sizing: border-box !important;
            display: flex !important;
            flex-direction: column !important;
            justify-content: space-around !important;
            align-items: ${labelAlign === 'center' ? 'center' : 'flex-start'} !important;
            background: #ffffff !important;
            color: #000000 !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          .address-print-barcode * {
            color: #000000 !important;
          }
          .address-print-barcode-text {
            text-align: ${labelAlign} !important;
            align-items: ${labelAlign === 'center' ? 'center' : 'flex-start'} !important;
            padding-left: ${labelAlign === 'center' ? '0' : '1mm'} !important;
          }
          .address-print-barcode-text.bottom-text.boxed-text span {
            background-color: #000000 !important;
            color: #ffffff !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `;
    }

    if (format === 'a5-normal') {
      return `
        @media print {
          @page {
            size: A4 landscape;
            margin: 0;
          }
        }
      `;
    }

    return `
      @media print {
        @page {
          size: A4 portrait;
          margin: 0;
        }
      }
    `;
  }, [format, labelWidth, labelHeight, labelAlign, labelBorder]);

  const renderPrintableContent = () => {
    if (format === 'etiket-barkod') {
      return (
        <div
          className="address-print-barcode"
          style={{
            width: `${labelWidth}mm`,
            height: `${labelHeight}mm`,
            alignItems: labelAlign === 'center' ? 'center' : 'flex-start',
            border: labelBorder ? '1.5px solid #000000' : 'none',
          }}
        >
          <div 
            className="address-print-barcode-container"
            style={{
              alignItems: labelAlign === 'center' ? 'center' : 'flex-start',
            }}
          >
            <div className="address-print-barcode-text top-text" style={{ fontSize: `${labelTopSize}px`, textAlign: labelAlign, paddingLeft: labelAlign === 'center' ? 0 : '1mm' }}>
              {labelTopText}
            </div>
            {labelDivider && <div className="address-print-barcode-divider" />}
            <div className="address-print-barcode-text middle-text" style={{ fontSize: `${labelMiddleSize}px`, textAlign: labelAlign, paddingLeft: labelAlign === 'center' ? 0 : '1mm' }}>
              {labelMiddleText}
            </div>
            <div className={`address-print-barcode-text bottom-text ${labelBottomBox ? 'boxed-text' : ''}`} style={{ fontSize: `${labelBottomSize}px`, textAlign: labelAlign, paddingLeft: labelAlign === 'center' ? 0 : '1mm' }}>
              <span>{labelBottomText}</span>
            </div>
          </div>
        </div>
      );
    }

    if (format === 'a5-normal') {
      return (
        <div className="address-print-page address-print-a5-sheet">
          <div className="address-a5-copy">{renderLabelContent()}</div>
          <div className="address-a5-cutline" aria-hidden="true" />
          <div className="address-a5-copy">{renderLabelContent()}</div>
        </div>
      );
    }

    return (
      <div className={`address-print-page ${format === 'a4-large' ? 'address-print-large' : ''}`}>
        {renderLabelContent()}
      </div>
    );
  };

  return (
    <div className="address-label-module">
      {printStyle && <style>{printStyle}</style>}
      <aside className="address-label-sidebar">
        <div className="address-eyebrow">Servis Takip</div>
        <h2>Adres Etiketi Yazdır</h2>

        <div className="address-panel">
          <div className="address-panel-title">Etiket İçeriği</div>
          <label>
            Yazdırma Biçimi
            <select value={format} onChange={e => setFormat(e.target.value)}>
              <option value="a4-normal">A4 - Normal</option>
              <option value="a4-large">A4 - Büyük Yazı</option>
              <option value="a5-normal">A5 - Küçük Etiket</option>
              <option value="etiket-barkod">🏷️ Etiket (Barkod Yazıcı)</option>
            </select>
          </label>

          {format === 'etiket-barkod' ? (
            <>
              <div className="address-form-section">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <div className="address-form-section-title" style={{ margin: 0 }}>Alıcı Seçimi & Senkronizasyon</div>
                  <button
                    className="address-sync-button"
                    onClick={handleSnipeSync}
                    disabled={syncing}
                    title="Snipe-IT Kullanıcılarını Güncelle"
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--color-primary)',
                      cursor: 'pointer',
                      fontSize: 14,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      padding: '4px 8px',
                      borderRadius: 4,
                      backgroundColor: 'var(--color-info-bg)'
                    }}
                  >
                    <span>{syncing ? '🔄 Güncelleniyor...' : '🔄 Snipe-IT Güncelle'}</span>
                  </button>
                </div>

                <label>
                  Kişi Arama (Snipe-IT)
                  <input
                    type="text"
                    list="barcode-users-list"
                    placeholder="Kullanıcı adı yazın..."
                    style={{ fontWeight: 'bold' }}
                    onChange={e => {
                      const val = e.target.value;
                      const found = users.find(u => u.name === val || `${u.name}${u.location_name ? ` - ${u.location_name}` : ''}` === val);
                      if (found) {
                        setLabelMiddleText(found.name.toUpperCase());
                        
                        let locName = found.location_name || '';
                        if (!locName) {
                          const loc = locations.find(l => String(l.id) === String(found.location_id));
                          if (loc) {
                            locName = loc.name;
                          }
                        }

                        if (locName) {
                          const companyName = getCompanyForLocation(locName, companies);
                          setLabelBottomText(companyName.toUpperCase());
                        } else {
                          setLabelBottomText('');
                        }
                      }
                    }}
                  />
                  <datalist id="barcode-users-list">
                    {users.map(u => (
                      <option key={u.id} value={`${u.name}${u.location_name ? ` - ${u.location_name}` : ''}`} />
                    ))}
                  </datalist>
                </label>
              </div>

              <div className="address-form-section">
                <div className="address-form-section-title">Boyut Ayarları (mm)</div>
                <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
                  <label style={{ flex: 1, margin: 0 }}>
                    Genişlik
                    <input
                      type="number"
                      value={labelWidth}
                      onChange={e => setLabelWidth(Number(e.target.value) || 0)}
                      min="1"
                    />
                  </label>
                  <label style={{ flex: 1, margin: 0 }}>
                    Yükseklik
                    <input
                      type="number"
                      value={labelHeight}
                      onChange={e => setLabelHeight(Number(e.target.value) || 0)}
                      min="1"
                    />
                  </label>
                </div>
              </div>

              <div className="address-form-section">
                <div className="address-form-section-title">Tasarım Ayarları</div>
                <label>
                  Yazı Hizalama
                  <select value={labelAlign} onChange={e => setLabelAlign(e.target.value)}>
                    <option value="left">Sola Hizala</option>
                    <option value="center">Ortala</option>
                  </select>
                </label>
                <label className="address-check-row" style={{ marginTop: 8 }}>
                  <input type="checkbox" checked={labelDivider} onChange={e => setLabelDivider(e.target.checked)} />
                  Üst alanın altına çizgi ekle
                </label>
                <label className="address-check-row">
                  <input type="checkbox" checked={labelBorder} onChange={e => setLabelBorder(e.target.checked)} />
                  Etikete dış çerçeve ekle
                </label>
                <label className="address-check-row">
                  <input type="checkbox" checked={labelBottomBox} onChange={e => setLabelBottomBox(e.target.checked)} />
                  Alt alanı kutu (ters renk) içine al
                </label>
              </div>

              <div className="address-form-section">
                <div className="address-form-section-title">Etiket Özelleştirme</div>
                <label>
                  Üst Alan & Boyut (px)
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input
                      type="text"
                      value={labelTopText}
                      onChange={e => setLabelTopText(e.target.value)}
                      placeholder="Örn: SP330 TONER"
                      style={{ flex: 1 }}
                    />
                    <input
                      type="number"
                      value={labelTopSize}
                      onChange={e => setLabelTopSize(Number(e.target.value) || 0)}
                      style={{ width: 68, textAlign: 'center' }}
                      min="1"
                    />
                  </div>
                </label>

                <label>
                  Orta Alan & Boyut (px)
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input
                      type="text"
                      value={labelMiddleText}
                      onChange={e => setLabelMiddleText(e.target.value)}
                      placeholder="Örn: AHMET YILMAZ"
                      style={{ flex: 1, fontWeight: 'bold' }}
                    />
                    <input
                      type="number"
                      value={labelMiddleSize}
                      onChange={e => setLabelMiddleSize(Number(e.target.value) || 0)}
                      style={{ width: 68, textAlign: 'center', fontWeight: 'bold' }}
                      min="1"
                    />
                  </div>
                </label>

                <label>
                  Alt Alan & Boyut (px)
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input
                      type="text"
                      value={labelBottomText}
                      onChange={e => setLabelBottomText(e.target.value)}
                      placeholder="Örn: M01 - ÖRNEK TEKNOLOJİ"
                      style={{ flex: 1 }}
                    />
                    <input
                      type="number"
                      value={labelBottomSize}
                      onChange={e => setLabelBottomSize(Number(e.target.value) || 0)}
                      style={{ width: 68, textAlign: 'center' }}
                      min="1"
                    />
                  </div>
                </label>
              </div>
            </>
          ) : (
            <>
              {renderPartyFields('sender', 'Gönderen', sender, setSender)}
              {renderPartyFields('receiver', 'Alıcı', receiver, setReceiver)}

              <label className="address-check-row">
                <input type="checkbox" checked={fragile} onChange={e => setFragile(e.target.checked)} />
                Dikkat kırılır yazısını ekle
              </label>
            </>
          )}

          <button className="address-print-button" onClick={handlePrint} disabled={loading || syncing}>
            Yazdır
          </button>
        </div>
      </aside>

      <main className="address-preview-wrap">
        {renderPrintableContent()}
      </main>
      {activeTab === 'address-label' && createPortal(
        <div className="address-label-print-portal">
          {renderPrintableContent()}
        </div>,
        document.body
      )}
    </div>
  );
}
