import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useApp } from '../../../context/AppContext';
import { useAuth } from '../../../context/AuthContext';

export default function HandoverProtocol() {
  const { showNotification } = useApp();
  const { user } = useAuth();

  const getTodayDateString = () => {
    const today = new Date();
    const d = String(today.getDate()).padStart(2, '0');
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const y = today.getFullYear();
    return `${d}.${m}.${y}`;
  };

  // State definitions
  const [formData, setFormData] = useState({
    subject: 'Yeni Bilgisayar',
    date: getTodayDateString(),
    receiverName: '',
    receiverCompany: '',
    receiverDept: '',
    receiverTitle: '',
    brand: '',
    model: '',
    category: '',
    qty: '1',
    usageLimit: '-',
    serial: '',
    delivererName: user?.full_name || user?.username || '',
    delivererTitle: 'Kıdemli Uzman BYS'
  });

  const [dbUsers, setDbUsers] = useState([]);
  const [dbAssets, setDbAssets] = useState([]);
  const [userSearchText, setUserSearchText] = useState('');
  const [assetSearchText, setAssetSearchText] = useState('');
  const [userAssignedAssets, setUserAssignedAssets] = useState([]);
  
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [showAssetDropdown, setShowAssetDropdown] = useState(false);

  const fileInputRef = useRef(null);

  // Load database users and assets
  useEffect(() => {
    const loadDbData = async () => {
      try {
        const usersRes = await window.electronAPI.query('SELECT * FROM cached_users ORDER BY name ASC', []);
        if (usersRes.success) {
          setDbUsers(usersRes.data || []);
        }
        const assetsRes = await window.electronAPI.query('SELECT * FROM cached_assets ORDER BY name ASC', []);
        if (assetsRes.success) {
          setDbAssets(assetsRes.data || []);
        }
      } catch (err) {
        console.error('Tutanak DB yükleme hatası:', err);
      }
    };
    loadDbData();
  }, []);

  // Update default deliverer name when auth user changes
  useEffect(() => {
    if (user) {
      setFormData(prev => ({
        ...prev,
        delivererName: user.full_name || user.username || ''
      }));
    }
  }, [user]);

  // Filtered lists for dropdowns
  const filteredUsers = userSearchText.trim() === '' ? [] : dbUsers.filter(u => {
    const search = userSearchText.toLocaleLowerCase('tr-TR');
    return (u.name || '').toLocaleLowerCase('tr-TR').includes(search) || 
           (u.username || '').toLocaleLowerCase('tr-TR').includes(search) ||
           (u.email || '').toLocaleLowerCase('tr-TR').includes(search);
  });

  const filteredAssets = assetSearchText.trim() === '' ? [] : dbAssets.filter(a => {
    const search = assetSearchText.toLocaleLowerCase('tr-TR');
    return (a.serial || '').toLocaleLowerCase('tr-TR').includes(search) || 
           (a.asset_tag || '').toLocaleLowerCase('tr-TR').includes(search) ||
           (a.name || '').toLocaleLowerCase('tr-TR').includes(search) ||
           (a.model_name || '').toLocaleLowerCase('tr-TR').includes(search);
  });

  const handleSelectUser = (u) => {
    setFormData(prev => ({
      ...prev,
      receiverName: u.name || u.full_name || 'İsimsiz Kullanıcı',
      receiverCompany: u.location_name || u.company_name || prev.receiverCompany || '',
      receiverDept: u.department_name || '',
    }));
    setUserSearchText(u.name || u.full_name || '');
    setShowUserDropdown(false);

    // Get assets assigned to this user
    const assigned = dbAssets.filter(a => a.assigned_to_user_id === u.id);
    setUserAssignedAssets(assigned);
  };

  const handleSelectAsset = (a) => {
    setFormData(prev => ({
      ...prev,
      brand: a.manufacturer_name || '',
      model: a.model_name || a.name || '',
      category: a.category_name || '',
      serial: a.serial || '',
    }));
    setAssetSearchText(a.serial || a.asset_tag || '');
    setShowAssetDropdown(false);
  };

  const escapeHtml = (str) => {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  };

  const buildPrintHtml = useCallback(() => {
    return `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="utf-8" />
  <title>Teslim Tutanağı - ${escapeHtml(formData.receiverName || 'Teslim')}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 18mm 20mm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    html, body {
      margin: 0;
      padding: 0;
      background: #ffffff;
      color: #000000;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      font-size: 13px;
      line-height: 1.5;
    }
    .page-container {
      width: 100%;
      min-height: 255mm;
      display: flex;
      flex-direction: column;
      box-sizing: border-box;
    }
    .doc-title {
      font-size: 18px;
      font-weight: 800;
      text-align: center;
      color: #000000;
      letter-spacing: 0.8px;
      margin-top: 5px;
      margin-bottom: 25px;
      text-transform: uppercase;
    }
    .field-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 15px;
    }
    .field-table td {
      padding: 3px 0;
      font-size: 13px;
      vertical-align: top;
      color: #000000;
    }
    .field-table td.lbl {
      width: 130px;
      font-weight: 600;
      color: #000000;
    }
    .field-table td.sep {
      width: 16px;
      font-weight: 600;
    }
    .field-table td.val {
      color: #000000;
    }
    .section-title {
      font-size: 13.5px;
      font-weight: 800;
      color: #000000;
      margin-top: 15px;
      margin-bottom: 6px;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }
    .doc-p {
      font-size: 12.5px;
      color: #000000;
      line-height: 1.55;
      text-align: justify;
      margin: 10px 0;
    }
    .bullet-list {
      margin: 6px 0 10px 0;
      padding: 0;
      list-style: none;
    }
    .bullet-item {
      display: flex;
      font-size: 12.5px;
      line-height: 1.55;
      color: #000000;
      text-align: justify;
      margin-bottom: 5px;
      padding-left: 20px;
      position: relative;
    }
    .bullet-item::before {
      content: "-";
      position: absolute;
      left: 4px;
      top: 0;
      font-weight: bold;
    }
    .closing-p {
      font-size: 12.5px;
      color: #000000;
      margin: 10px 0 20px 0;
      font-weight: 500;
    }
    .signature-container {
      display: flex;
      justify-content: space-between;
      margin-top: auto;
      padding-top: 30px;
    }
    .sig-col {
      width: 48%;
      font-size: 12.5px;
    }
    .sig-header {
      font-weight: 700;
      font-size: 11.5px;
      text-transform: uppercase;
      margin-bottom: 34px;
      letter-spacing: 0.6px;
      color: #333333;
    }
    .sig-name {
      font-weight: 600;
      font-size: 13.5px;
      text-transform: uppercase;
      color: #000000;
    }
  </style>
</head>
<body>
  <div class="page-container">
    <div class="doc-title">TESLİM TUTANAĞI</div>

    <table class="field-table">
      <tr>
        <td class="lbl">Konu</td>
        <td class="sep">:</td>
        <td class="val">${escapeHtml(formData.subject || 'Yeni Bilgisayar')}</td>
      </tr>
      <tr>
        <td class="lbl">Tarih</td>
        <td class="sep">:</td>
        <td class="val">${escapeHtml(formData.date || '')}</td>
      </tr>
    </table>

    <div class="section-title">TESLİM ALANIN</div>
    <table class="field-table">
      <tr>
        <td class="lbl">Adı, soyadı</td>
        <td class="sep">:</td>
        <td class="val" style="font-weight: 600; text-transform: uppercase;">${escapeHtml(formData.receiverName || '')}</td>
      </tr>
      <tr>
        <td class="lbl">İşyeri Adı</td>
        <td class="sep">:</td>
        <td class="val" style="text-transform: uppercase;">${escapeHtml(formData.receiverCompany || '')}</td>
      </tr>
      <tr>
        <td class="lbl">Bölümü</td>
        <td class="sep">:</td>
        <td class="val">${escapeHtml(formData.receiverDept || '')}</td>
      </tr>
      <tr>
        <td class="lbl">Görevi</td>
        <td class="sep">:</td>
        <td class="val">${escapeHtml(formData.receiverTitle || '')}</td>
      </tr>
    </table>

    <p class="doc-p">
      Sorumlu olduğum görevimi yerine getirebilmek için aşağıda bilgileri bulunan donanımı imza karşılığında sağlam ve eksiksiz durumda teslim aldım.
    </p>

    <p class="doc-p" style="margin-bottom: 4px;">
      Bu malzemeyi nerede ve ne zaman kullanacağımı,
    </p>

    <div class="bullet-list">
      <div class="bullet-item">Kullanmadığım takdirde karşılaşabileceğim sorunların bilincinde olduğumu;</div>
      <div class="bullet-item">İşimle ilgili verilen bu malzemelerin bakımını yaparak muhafaza edeceğimi;</div>
      <div class="bullet-item">Kusurum nedeniyle malzemenin hasar görmesi durumunda derhal yetkililere bilgi vereceğimi ve kaybolması halinde bedelinin tarafımca karşılanacağını;</div>
      <div class="bullet-item">Aşağıda belirtilen kullanım Limit dahilinde kullanacağımı aksi takdirde aşan kısım kadarı ücretinin aylık maaşımdan kesileceğini ;</div>
      <div class="bullet-item">Anılan malzemeyi kullanmadığım takdirde ihtar edileceğimin, ikinci ihtarda 4857 Sayılı İş Kanunu Md. 25/ II-ı bendi gereği iş sözleşmemin feshedileceğinin bilincinde olduğumu;</div>
      <div class="bullet-item">İş sözleşmemin son bulması halinde bu malzemeleri derhal iade edeceğimi</div>
    </div>

    <p class="closing-p">
      Taahhüt, kabul ve beyan ederim.
    </p>

    <div class="section-title">MALZEMENİN ;</div>
    <table class="field-table">
      <tr>
        <td class="lbl">Marka</td>
        <td class="sep">:</td>
        <td class="val" style="text-transform: uppercase;">${escapeHtml(formData.brand || '')}</td>
      </tr>
      <tr>
        <td class="lbl">Model</td>
        <td class="sep">:</td>
        <td class="val" style="text-transform: uppercase;">${escapeHtml(formData.model || '')}</td>
      </tr>
      <tr>
        <td class="lbl">Cinsi</td>
        <td class="sep">:</td>
        <td class="val" style="text-transform: uppercase;">${escapeHtml(formData.category || '')}</td>
      </tr>
      <tr>
        <td class="lbl">Adedi</td>
        <td class="sep">:</td>
        <td class="val">${escapeHtml(formData.qty || '1')}</td>
      </tr>
      <tr>
        <td class="lbl">Kullanım Limiti</td>
        <td class="sep">:</td>
        <td class="val">${escapeHtml(formData.usageLimit || '-')}</td>
      </tr>
      <tr>
        <td class="lbl">Seri Numarası</td>
        <td class="sep">:</td>
        <td class="val" style="font-family: monospace; font-weight: 600; text-transform: uppercase;">${escapeHtml(formData.serial || '')}</td>
      </tr>
    </table>

    <div class="signature-container">
      <div class="sig-col">
        <div class="sig-header">TESLİM EDEN GÖREVLİ</div>
        <div class="sig-name">${escapeHtml(formData.delivererName || '')}</div>
      </div>
      <div class="sig-col">
        <div class="sig-header">TESLİM ALAN</div>
        <div class="sig-name">${escapeHtml(formData.receiverName || '')}</div>
      </div>
    </div>
  </div>
</body>
</html>`;
  }, [formData]);

  const handlePrint = useCallback(async () => {
    try {
      const html = buildPrintHtml();
      await window.electronAPI.printHtml(html);
    } catch (err) {
      console.error('Yazdırma hatası:', err);
      showNotification('Yazdırma başlatılamadı: ' + err.message, 'danger');
    }
  }, [buildPrintHtml, showNotification]);

  // Ctrl+P shortcut
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'p' || e.key === 'P')) {
        e.preventDefault();
        handlePrint();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handlePrint]);

  const handleSaveJson = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(formData, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `tutanak-${(formData.receiverName || 'teslim').replace(/\s+/g, '_')}-${formData.date}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    showNotification('Tutanak JSON dosyası olarak indirildi.', 'success');
  };

  const handleLoadJson = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target.result);
        setFormData({
          subject: parsed.subject || 'Yeni Bilgisayar',
          date: parsed.date || getTodayDateString(),
          receiverName: parsed.receiverName || '',
          receiverCompany: parsed.receiverCompany || '',
          receiverDept: parsed.receiverDept || '',
          receiverTitle: parsed.receiverTitle || '',
          brand: parsed.brand || '',
          model: parsed.model || '',
          category: parsed.category || '',
          qty: parsed.qty || '1',
          usageLimit: parsed.usageLimit || '-',
          serial: parsed.serial || '',
          delivererName: parsed.delivererName || '',
          delivererTitle: parsed.delivererTitle || 'Kıdemli Uzman BYS'
        });
        setUserSearchText(parsed.receiverName || '');
        setAssetSearchText(parsed.serial || '');
        showNotification('Tutanak verileri JSON dosyasından yüklendi.', 'success');
      } catch (err) {
        showNotification('Geçersiz JSON dosyası!', 'danger');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const renderDocumentContent = () => (
    <div id="printable-handover-area" style={styles.printArea}>
      <div style={styles.docHeader}>
        TESLİM TUTANAĞI
      </div>
      
      <table style={{ ...styles.docTable, marginBottom: 15 }}>
        <tbody>
          <tr>
            <td style={{ width: '130px', fontWeight: 600 }}>Konu</td>
            <td style={{ width: '16px', fontWeight: 600 }}>:</td>
            <td>{formData.subject || 'Yeni Bilgisayar'}</td>
          </tr>
          <tr>
            <td style={{ fontWeight: 600 }}>Tarih</td>
            <td style={{ fontWeight: 600 }}>:</td>
            <td>{formData.date}</td>
          </tr>
        </tbody>
      </table>

      <div style={styles.docSectionTitle}>TESLİM ALANIN</div>
      <table style={{ ...styles.docTable, marginBottom: 15 }}>
        <tbody>
          <tr>
            <td style={{ width: '130px', fontWeight: 600 }}>Adı, soyadı</td>
            <td style={{ width: '16px', fontWeight: 600 }}>:</td>
            <td style={{ fontWeight: 600, textTransform: 'uppercase' }}>{formData.receiverName || ''}</td>
          </tr>
          <tr>
            <td style={{ fontWeight: 600 }}>İşyeri Adı</td>
            <td style={{ fontWeight: 600 }}>:</td>
            <td style={{ textTransform: 'uppercase' }}>{formData.receiverCompany || ''}</td>
          </tr>
          <tr>
            <td style={{ fontWeight: 600 }}>Bölümü</td>
            <td style={{ fontWeight: 600 }}>:</td>
            <td>{formData.receiverDept || ''}</td>
          </tr>
          <tr>
            <td style={{ fontWeight: 600 }}>Görevi</td>
            <td style={{ fontWeight: 600 }}>:</td>
            <td>{formData.receiverTitle || ''}</td>
          </tr>
        </tbody>
      </table>

      <p style={styles.docText}>
        Sorumlu olduğum görevimi yerine getirebilmek için aşağıda bilgileri bulunan donanımı imza karşılığında sağlam ve eksiksiz durumda teslim aldım.
      </p>

      <p style={{ ...styles.docText, marginBottom: 4 }}>
        Bu malzemeyi nerede ve ne zaman kullanacağımı,
      </p>

      <div style={{ margin: '4px 0 10px 0', paddingLeft: 18 }}>
        {[
          'Kullanmadığım takdirde karşılaşabileceğim sorunların bilincinde olduğumu;',
          'İşimle ilgili verilen bu malzemelerin bakımını yaparak muhafaza edeceğimi;',
          'Kusurum nedeniyle malzemenin hasar görmesi durumunda derhal yetkililere bilgi vereceğimi ve kaybolması halinde bedelinin tarafımca karşılanacağını;',
          'Aşağıda belirtilen kullanım Limit dahilinde kullanacağımı aksi takdirde aşan kısım kadarı ücretinin aylık maaşımdan kesileceğini ;',
          'Anılan malzemeyi kullanmadığım takdirde ihtar edileceğimin, ikinci ihtarda 4857 Sayılı İş Kanunu Md. 25/ II-ı bendi gereği iş sözleşmemin feshedileceğinin bilincinde olduğumu;',
          'İş sözleşmemin son bulması halinde bu malzemeleri derhal iade edeceğimi'
        ].map((item, idx) => (
          <div key={idx} style={{ display: 'flex', fontSize: '12.5px', lineHeight: '1.55', color: '#000', marginBottom: 4, position: 'relative' }}>
            <span style={{ position: 'absolute', left: -14, fontWeight: 'bold' }}>-</span>
            <span>{item}</span>
          </div>
        ))}
      </div>

      <p style={{ fontSize: '12.5px', color: '#000', margin: '10px 0 20px 0', fontWeight: 500 }}>
        Taahhüt, kabul ve beyan ederim.
      </p>

      <div style={styles.docSectionTitle}>MALZEMENİN ;</div>
      <table style={{ ...styles.docTable, marginBottom: 15 }}>
        <tbody>
          <tr>
            <td style={{ width: '130px', fontWeight: 600 }}>Marka</td>
            <td style={{ width: '16px', fontWeight: 600 }}>:</td>
            <td style={{ textTransform: 'uppercase' }}>{formData.brand || ''}</td>
          </tr>
          <tr>
            <td style={{ fontWeight: 600 }}>Model</td>
            <td style={{ fontWeight: 600 }}>:</td>
            <td style={{ textTransform: 'uppercase' }}>{formData.model || ''}</td>
          </tr>
          <tr>
            <td style={{ fontWeight: 600 }}>Cinsi</td>
            <td style={{ fontWeight: 600 }}>:</td>
            <td style={{ textTransform: 'uppercase' }}>{formData.category || ''}</td>
          </tr>
          <tr>
            <td style={{ fontWeight: 600 }}>Adedi</td>
            <td style={{ fontWeight: 600 }}>:</td>
            <td>{formData.qty || '1'}</td>
          </tr>
          <tr>
            <td style={{ fontWeight: 600 }}>Kullanım Limiti</td>
            <td style={{ fontWeight: 600 }}>:</td>
            <td>{formData.usageLimit || '-'}</td>
          </tr>
          <tr>
            <td style={{ fontWeight: 600 }}>Seri Numarası</td>
            <td style={{ fontWeight: 600 }}>:</td>
            <td style={{ fontFamily: 'monospace', fontWeight: 600, textTransform: 'uppercase' }}>{formData.serial || ''}</td>
          </tr>
        </tbody>
      </table>

      <div style={styles.docFooter}>
        <div style={styles.docFooterCol}>
          <div style={{ fontWeight: 700, fontSize: 11.5, textTransform: 'uppercase', letterSpacing: '0.6px', color: '#333', marginBottom: 34 }}>TESLİM EDEN GÖREVLİ</div>
          <div style={{ fontWeight: 600, fontSize: 13.5, textTransform: 'uppercase', color: '#000' }}>{formData.delivererName || ''}</div>
        </div>

        <div style={styles.docFooterCol}>
          <div style={{ fontWeight: 700, fontSize: 11.5, textTransform: 'uppercase', letterSpacing: '0.6px', color: '#333', marginBottom: 34 }}>TESLİM ALAN</div>
          <div style={{ fontWeight: 600, fontSize: 13.5, textTransform: 'uppercase', color: '#000' }}>{formData.receiverName || ''}</div>
        </div>
      </div>
    </div>
  );

  return (
    <div style={styles.container} className="handover-protocol-container">
      {/* Autocomplete Styles */}
      <style>{`
        .handover-autocomplete-list {
          position: absolute;
          left: 0;
          right: 0;
          top: 100%;
          z-index: 999;
          max-height: 200px;
          overflow-y: auto;
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          border-radius: 6px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
          padding: 0;
          margin: 2px 0 0 0;
          list-style: none;
        }

        .handover-autocomplete-item {
          padding: 8px 12px;
          border-bottom: 1px solid var(--color-surface-alt);
          cursor: pointer;
          transition: background 0.15s ease;
        }

        .handover-autocomplete-item:hover {
          background: var(--color-surface-alt) !important;
        }
      `}</style>

      {/* Header Bar */}
      <div style={styles.headerBar} className="handover-header-bar">
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: 'var(--color-primary-hover)' }}>✍️ Cihaz Teslim Tutanağı</h2>
          <span style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>Snipe-IT entegrasyonuyla hızlı teslim formu oluşturun ve yazdırın.</span>
        </div>
        <div>
          <button 
            type="button"
            className="btn btn-primary" 
            onClick={handlePrint}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 13, padding: '7px 18px', cursor: 'pointer' }}
          >
            <span>🖨️</span>
            <span>Tutanağı Yazdır</span>
          </button>
        </div>
      </div>

      {/* Main Content Workspace */}
      <div style={styles.workspace}>
        {/* Left Form Panel */}
        <div style={styles.leftPanel} className="handover-left-panel">
          <h3 style={styles.panelTitle}>Teslim Tutanağı Formu</h3>

          <div className="form-group" style={{ marginBottom: 12 }}>
            <label style={styles.label}>Konu</label>
            <input 
              type="text" 
              className="form-control" 
              value={formData.subject}
              onChange={e => setFormData(prev => ({ ...prev, subject: e.target.value }))}
            />
          </div>

          <div className="form-group" style={{ marginBottom: 12 }}>
            <label style={styles.label}>Tarih</label>
            <input 
              type="text" 
              className="form-control" 
              value={formData.date}
              onChange={e => setFormData(prev => ({ ...prev, date: e.target.value }))}
            />
          </div>

          {/* User Search Autocomplete */}
          <div className="form-group" style={{ marginBottom: 12, position: 'relative' }}>
            <label style={styles.label}>Kullanıcı Ara (Ad, E-posta)</label>
            <input 
              type="text" 
              className="form-control" 
              value={userSearchText}
              placeholder="Aramak için yazın..."
              onChange={e => {
                setUserSearchText(e.target.value);
                setShowUserDropdown(true);
              }}
              onFocus={() => setShowUserDropdown(true)}
            />
            {showUserDropdown && filteredUsers.length > 0 && (
              <ul className="handover-autocomplete-list">
                {filteredUsers.slice(0, 50).map(u => (
                  <li 
                    key={u.id} 
                    className="handover-autocomplete-item"
                    onClick={() => handleSelectUser(u)}
                  >
                    <div style={{ fontWeight: 600, fontSize: 12 }}>{u.name || u.full_name}</div>
                    <div style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>{u.username} | {u.department_name || 'Departman Yok'}</div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* User Assigned Assets Selection */}
          <div className="form-group" style={{ marginBottom: 12 }}>
            <label style={styles.label}>Kullanıcıya Tanımlı Cihazlar</label>
            {userAssignedAssets.length === 0 ? (
              <div style={{ fontSize: 11, color: 'var(--color-text-muted)', background: 'var(--color-surface-alt)', padding: '8px 10px', borderRadius: 4, border: '1px dashed var(--color-border)' }}>
                Kullanıcı seçtiğinizde zimmetli cihazlar burada görünür.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {userAssignedAssets.map(a => (
                  <button
                    key={a.id}
                    type="button"
                    className="btn btn-secondary"
                    style={{ textAlign: 'left', display: 'block', padding: '6px 10px', fontSize: 11, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}
                    onClick={() => handleSelectAsset(a)}
                  >
                    🖥️ {a.asset_tag} | {a.serial} | {a.model_name || a.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Device Search Autocomplete */}
          <div className="form-group" style={{ marginBottom: 12, position: 'relative' }}>
            <label style={styles.label}>Cihaz Ara (Demirbaş No, Seri No)</label>
            <input 
              type="text" 
              className="form-control" 
              value={assetSearchText}
              placeholder="Zimmet dışı cihaz aramak için yazın..."
              onChange={e => {
                setAssetSearchText(e.target.value);
                setShowAssetDropdown(true);
              }}
              onFocus={() => setShowAssetDropdown(true)}
            />
            {showAssetDropdown && filteredAssets.length > 0 && (
              <ul className="handover-autocomplete-list">
                {filteredAssets.slice(0, 50).map(a => (
                  <li 
                    key={a.id} 
                    className="handover-autocomplete-item"
                    onClick={() => handleSelectAsset(a)}
                  >
                    <div style={{ fontWeight: 600, fontSize: 12 }}>{a.asset_tag} | {a.serial}</div>
                    <div style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>{a.model_name || a.name} ({a.manufacturer_name})</div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid var(--color-border)', margin: '15px 0' }} />

          <div className="form-group" style={{ marginBottom: 12 }}>
            <label style={styles.label}>Teslim Alan (Ad Soyad)</label>
            <input 
              type="text" 
              className="form-control" 
              value={formData.receiverName}
              onChange={e => setFormData(prev => ({ ...prev, receiverName: e.target.value }))}
            />
          </div>

          <div className="form-group" style={{ marginBottom: 12 }}>
            <label style={styles.label}>İşyeri Adı</label>
            <input 
              type="text" 
              className="form-control" 
              placeholder="Örn: B01 MERKEZ İŞLETME"
              value={formData.receiverCompany || ''}
              onChange={e => setFormData(prev => ({ ...prev, receiverCompany: e.target.value }))}
            />
          </div>

          <div className="form-group" style={{ marginBottom: 12 }}>
            <label style={styles.label}>Bölümü</label>
            <input 
              type="text" 
              className="form-control" 
              value={formData.receiverDept}
              onChange={e => setFormData(prev => ({ ...prev, receiverDept: e.target.value }))}
            />
          </div>

          <div className="form-group" style={{ marginBottom: 12 }}>
            <label style={styles.label}>Görevi</label>
            <input 
              type="text" 
              className="form-control" 
              value={formData.receiverTitle}
              onChange={e => setFormData(prev => ({ ...prev, receiverTitle: e.target.value }))}
            />
          </div>

          <div className="form-group" style={{ marginBottom: 12 }}>
            <label style={styles.label}>Marka</label>
            <input 
              type="text" 
              className="form-control" 
              value={formData.brand}
              onChange={e => setFormData(prev => ({ ...prev, brand: e.target.value }))}
            />
          </div>

          <div className="form-group" style={{ marginBottom: 12 }}>
            <label style={styles.label}>Model</label>
            <input 
              type="text" 
              className="form-control" 
              value={formData.model}
              onChange={e => setFormData(prev => ({ ...prev, model: e.target.value }))}
            />
          </div>

          <div className="form-group" style={{ marginBottom: 12 }}>
            <label style={styles.label}>Cinsi</label>
            <input 
              type="text" 
              className="form-control" 
              value={formData.category}
              onChange={e => setFormData(prev => ({ ...prev, category: e.target.value }))}
            />
          </div>

          <div className="form-group" style={{ marginBottom: 12 }}>
            <label style={styles.label}>Adedi</label>
            <input 
              type="number" 
              className="form-control" 
              value={formData.qty}
              onChange={e => setFormData(prev => ({ ...prev, qty: e.target.value }))}
            />
          </div>

          <div className="form-group" style={{ marginBottom: 12 }}>
            <label style={styles.label}>Kullanım Limiti</label>
            <input 
              type="text" 
              className="form-control" 
              value={formData.usageLimit}
              onChange={e => setFormData(prev => ({ ...prev, usageLimit: e.target.value }))}
            />
          </div>

          <div className="form-group" style={{ marginBottom: 12 }}>
            <label style={styles.label}>Seri Numarası</label>
            <input 
              type="text" 
              className="form-control" 
              value={formData.serial}
              onChange={e => setFormData(prev => ({ ...prev, serial: e.target.value }))}
            />
          </div>

          <div className="form-group" style={{ marginBottom: 12 }}>
            <label style={styles.label}>Teslim Eden Görevli</label>
            <input 
              type="text" 
              className="form-control" 
              value={formData.delivererName}
              onChange={e => setFormData(prev => ({ ...prev, delivererName: e.target.value }))}
            />
          </div>

          <div className="form-group" style={{ marginBottom: 16 }}>
            <label style={styles.label}>Teslim Eden Ünvanı</label>
            <input 
              type="text" 
              className="form-control" 
              value={formData.delivererTitle}
              onChange={e => setFormData(prev => ({ ...prev, delivererTitle: e.target.value }))}
            />
          </div>

          {/* Form Actions */}
          <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
            <button 
              type="button"
              className="btn btn-primary" 
              style={{ flex: 1, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '9px 16px' }} 
              onClick={handlePrint}
            >
              <span>🖨️</span>
              <span>Tutanağı Yazdır</span>
            </button>
          </div>
        </div>

        {/* Right Preview Panel */}
        <div style={styles.rightPanel} className="handover-right-panel" onClick={() => {
          setShowUserDropdown(false);
          setShowAssetDropdown(false);
        }}>
          {renderDocumentContent()}
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    background: 'var(--color-surface-alt)',
    overflow: 'hidden',
    boxSizing: 'border-box'
  },
  headerBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '6px 12px',
    background: 'var(--color-surface)',
    borderBottom: '1px solid var(--color-border)',
    boxSizing: 'border-box',
    flexShrink: 0
  },
  workspace: {
    display: 'flex',
    flex: 1,
    padding: 10,
    gap: 12,
    overflow: 'hidden',
    boxSizing: 'border-box'
  },
  leftPanel: {
    width: '360px',
    background: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    borderRadius: 6,
    padding: 16,
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    boxSizing: 'border-box',
    flexShrink: 0
  },
  rightPanel: {
    flex: 1,
    background: 'var(--color-surface-alt)',
    border: '1px solid var(--color-border)',
    borderRadius: 6,
    display: 'flex',
    justifyContent: 'center',
    padding: 20,
    overflowY: 'auto',
    boxSizing: 'border-box'
  },
  panelTitle: {
    fontSize: 13,
    fontWeight: 700,
    marginBottom: 12,
    borderBottom: '1px solid var(--color-border)',
    paddingBottom: 6,
    color: 'var(--color-text)'
  },
  label: {
    display: 'block',
    fontSize: 10,
    fontWeight: 700,
    color: 'var(--color-text-secondary)',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: '0.5px'
  },
  printArea: {
    width: '210mm',
    minHeight: '297mm',
    background: '#ffffff',
    color: '#000000',
    boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
    boxSizing: 'border-box',
    padding: '45px 50px',
    display: 'flex',
    flexDirection: 'column',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
  },
  docHeader: {
    fontSize: 18,
    fontWeight: 800,
    textAlign: 'center',
    color: '#000000',
    letterSpacing: '0.8px',
    marginBottom: 25,
    marginTop: 5,
    textTransform: 'uppercase'
  },
  docSectionTitle: {
    fontSize: 13.5,
    fontWeight: 800,
    color: '#000000',
    marginBottom: 6,
    marginTop: 15,
    textTransform: 'uppercase',
    letterSpacing: '0.3px'
  },
  docTable: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: 13,
    color: '#000000',
    marginBottom: 15
  },
  docText: {
    fontSize: 12.5,
    color: '#000000',
    lineHeight: 1.55,
    textAlign: 'justify',
    margin: '10px 0'
  },
  docFooter: {
    display: 'flex',
    justifyContent: 'space-between',
    marginTop: 'auto',
    paddingTop: 35
  },
  docFooterCol: {
    width: '48%',
    fontSize: 12.5,
    color: '#000000'
  }
};
