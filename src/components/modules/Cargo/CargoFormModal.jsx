import React, { useState, useEffect, useMemo } from 'react';
import Modal from '../../common/Modal';
import { apiGet, apiPost, apiPut } from '../../../utils/apiFetch';

const CARRIERS = [
  'Yurtiçi Kargo',
  'Aras Kargo',
  'MNG Kargo',
  'Sürat Kargo',
  'PTT Kargo',
  'UPS Kargo',
  'DHL',
  'Kolay Gelsin',
  'Hepsijet',
  'Trendyol Express',
  'FedEx',
  'Özel Kurye',
  'Elden / Getirilen',
  'Diğer'
];

const PACKAGE_TYPES = [
  'Laptop / Bilgisayar',
  'Monitör / Ekran',
  'Yazıcı / Barkod Cihazı',
  'Donanım / Çevre Birimi',
  'Toner / Sarf Malzeme',
  'Yedek Parça / Elektronik',
  'Telefon / Tablet / El Terminali',
  'Evrak / Belge / Sözleşme',
  'Koli / Özel Paket',
  'Diğer'
];

const STATUS_OPTIONS_INCOMING = [
  'Teslim Alındı',
  'İşlemde / Serviste',
  'Personele Teslim Edildi',
  'Kullanıma Hazır'
];

const STATUS_OPTIONS_OUTGOING = [
  'Hazırlanıyor / Paketlendi',
  'Gönderildi',
  'Yolda / Dağıtımda',
  'Teslim Edildi',
  'İptal Edildi'
];

export default function CargoFormModal({ isOpen, onClose, onSaved, editCargo, cachedUsers = [], currentUser, initialDirection = 'incoming' }) {
  const [direction, setDirection] = useState(initialDirection);
  const [formData, setFormData] = useState({
    direction: initialDirection,
    status: initialDirection === 'outgoing' ? 'Gönderildi' : 'Teslim Alındı',
    tracking_number: '',
    waybill_no: '',
    carrier: 'Yurtiçi Kargo',
    carrier_tracking_url: '',
    sender: '',
    recipient_id: '',
    recipient_name: '',
    receiver_address: '',
    receiver_phone: '',
    department: '',
    package_type: 'Laptop / Bilgisayar',
    package_count: 1,
    received_date: new Date().toISOString().slice(0, 16),
    received_by: currentUser?.full_name || currentUser?.username || 'IT Ekibi',
    asset_id: '',
    asset_tag: '',
    asset_name: '',
    serial_no: '',
    model_name: '',
    device_user: '',
    create_service_ticket: false,
    fault_desc: '',
    notes: ''
  });

  const [recipientSearch, setRecipientSearch] = useState('');
  const [showUserSuggestions, setShowUserSuggestions] = useState(false);

  const [cachedAssets, setCachedAssets] = useState([]);
  const [assetSearch, setAssetSearch] = useState('');
  const [showAssetSuggestions, setShowAssetSuggestions] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const [internalUsers, setInternalUsers] = useState(cachedUsers || []);

  // Snipe-IT Cihazları ve Personelleri Çek
  useEffect(() => {
    const fetchAssets = async () => {
      try {
        const res = await apiGet('/api/cached/assets');
        if (res?.success && Array.isArray(res.data)) {
          setCachedAssets(res.data);
        }
      } catch (err) {
        console.warn('[Cached Assets Fetch Error]:', err);
      }
    };
    fetchAssets();

    if (cachedUsers && cachedUsers.length > 0) {
      setInternalUsers(cachedUsers);
    } else {
      const fetchUsers = async () => {
        try {
          const res = await apiGet('/api/cached/users');
          if (res?.success && Array.isArray(res.data)) {
            setInternalUsers(res.data);
          }
        } catch (err) {
          console.warn('[Cached Users Fetch Error]:', err);
        }
      };
      fetchUsers();
    }
  }, [cachedUsers]);

  useEffect(() => {
    if (editCargo) {
      const dir = editCargo.direction || 'incoming';
      setDirection(dir);
      setFormData({
        direction: dir,
        status: editCargo.status || (dir === 'outgoing' ? 'Gönderildi' : 'Teslim Alındı'),
        tracking_number: editCargo.tracking_number || '',
        waybill_no: editCargo.waybill_no || '',
        carrier: editCargo.carrier || 'Yurtiçi Kargo',
        carrier_tracking_url: editCargo.carrier_tracking_url || '',
        sender: editCargo.sender || (dir === 'outgoing' ? (currentUser?.full_name ? `IT Departmanı (${currentUser.full_name})` : 'IT Departmanı') : ''),
        recipient_id: editCargo.recipient_id || '',
        recipient_name: editCargo.recipient_name || '',
        receiver_address: editCargo.receiver_address || '',
        receiver_phone: editCargo.receiver_phone || '',
        department: editCargo.department || '',
        package_type: editCargo.package_type || 'Laptop / Bilgisayar',
        package_count: editCargo.package_count || 1,
        received_date: editCargo.received_date ? new Date(editCargo.received_date).toISOString().slice(0, 16) : new Date().toISOString().slice(0, 16),
        received_by: editCargo.received_by || currentUser?.full_name || 'IT Ekibi',
        asset_id: editCargo.asset_id || '',
        asset_tag: editCargo.asset_tag || '',
        asset_name: editCargo.asset_name || '',
        serial_no: editCargo.serial_no || '',
        model_name: editCargo.model_name || '',
        device_user: editCargo.device_user || '',
        create_service_ticket: Boolean(editCargo.create_service_ticket || editCargo.service_ticket_id || editCargo.service_ticket_no),
        fault_desc: '',
        notes: editCargo.notes || ''
      });
      setRecipientSearch(editCargo.recipient_name || '');
      setAssetSearch(editCargo.asset_tag ? `${editCargo.asset_tag} - ${editCargo.model_name || editCargo.asset_name || ''}` : '');
    } else {
      const dir = initialDirection || 'incoming';
      setDirection(dir);
      setFormData({
        direction: dir,
        status: dir === 'outgoing' ? 'Gönderildi' : 'Teslim Alındı',
        tracking_number: '',
        waybill_no: '',
        carrier: 'Yurtiçi Kargo',
        carrier_tracking_url: '',
        sender: dir === 'outgoing' ? (currentUser?.full_name ? `IT Departmanı (${currentUser.full_name})` : 'IT Departmanı') : '',
        recipient_id: '',
        recipient_name: '',
        receiver_address: '',
        receiver_phone: '',
        department: '',
        package_type: 'Laptop / Bilgisayar',
        package_count: 1,
        received_date: new Date().toISOString().slice(0, 16),
        received_by: currentUser?.full_name || currentUser?.username || 'IT Ekibi',
        asset_id: '',
        asset_tag: '',
        asset_name: '',
        serial_no: '',
        model_name: '',
        device_user: '',
        create_service_ticket: false,
        fault_desc: '',
        notes: ''
      });
      setRecipientSearch('');
      setAssetSearch('');
    }
    setErrorMsg('');
  }, [editCargo, isOpen, currentUser, initialDirection]);

  // Yön değiştirme (Gelen / Giden)
  const handleDirectionChange = (newDir) => {
    setDirection(newDir);
    setFormData(prev => ({
      ...prev,
      direction: newDir,
      status: newDir === 'outgoing' ? 'Gönderildi' : 'Teslim Alındı',
      sender: newDir === 'outgoing' && !prev.sender ? (currentUser?.full_name ? `IT Departmanı (${currentUser.full_name})` : 'IT Departmanı') : prev.sender,
      create_service_ticket: newDir === 'outgoing' ? (isTicketLocked ? prev.create_service_ticket : false) : prev.create_service_ticket
    }));
  };

  // Alıcı personel filtreleme / arama
  const filteredUsers = useMemo(() => {
    if (!recipientSearch || recipientSearch.length < 2) return [];
    const query = recipientSearch.toLowerCase();
    return internalUsers
      .filter(u => (u.name && u.name.toLowerCase().includes(query)) || (u.username && u.username.toLowerCase().includes(query)))
      .slice(0, 8);
  }, [recipientSearch, internalUsers]);

  // Snipe-IT Cihaz Arama
  const filteredAssets = useMemo(() => {
    if (!assetSearch || assetSearch.length < 2) return [];
    const query = assetSearch.toLowerCase();
    return cachedAssets
      .filter(a => 
        (a.asset_tag && a.asset_tag.toLowerCase().includes(query)) ||
        (a.name && a.name.toLowerCase().includes(query)) ||
        (a.serial && a.serial.toLowerCase().includes(query)) ||
        (a.model_name && a.model_name.toLowerCase().includes(query))
      )
      .slice(0, 8);
  }, [assetSearch, cachedAssets]);

  const handleSelectUser = (user) => {
    setFormData(prev => ({
      ...prev,
      recipient_id: user.id,
      recipient_name: user.name,
      department: user.department_name || user.company_name || prev.department,
      receiver_phone: user.phone || prev.receiver_phone,
      receiver_address: user.location_name ? `${user.company_name ? user.company_name + ' / ' : ''}${user.location_name}` : prev.receiver_address
    }));
    setRecipientSearch(user.name);
    setShowUserSuggestions(false);
  };

  const handleSelectAsset = (asset) => {
    const assignedUser = asset.assigned_to_user_name || '';
    setFormData(prev => ({
      ...prev,
      asset_id: asset.id,
      asset_tag: asset.asset_tag || '',
      asset_name: asset.name || '',
      serial_no: asset.serial || '',
      model_name: asset.model_name || '',
      device_user: assignedUser || prev.device_user || '',
      // Gelen kargoda alıcı personel kargoyu teslim alacak IT teknisyenidir (örn: İsmail KARA), ezme!
      // Sadece giden kargoda ve alıcı henüz boşsa zimmetli personeli alıcıya öner:
      recipient_name: prev.recipient_name || (direction === 'outgoing' ? assignedUser : prev.recipient_name),
      department: prev.department || asset.location_name || prev.department
    }));
    if (direction === 'outgoing' && !recipientSearch && assignedUser) {
      setRecipientSearch(assignedUser);
    }
    setAssetSearch(`${asset.asset_tag || ''} - ${asset.model_name || asset.name || ''}`);
    setShowAssetSuggestions(false);
  };

  const handleClearAsset = () => {
    const isTicketLinked = Boolean(editCargo?.service_ticket_id || editCargo?.service_ticket_no);
    setFormData(prev => ({
      ...prev,
      asset_id: '',
      asset_tag: '',
      asset_name: '',
      serial_no: '',
      model_name: '',
      device_user: '',
      create_service_ticket: isTicketLinked ? prev.create_service_ticket : false
    }));
    setAssetSearch('');
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.recipient_name.trim() && !recipientSearch.trim()) {
      setErrorMsg(direction === 'outgoing' ? 'Lütfen alıcı (kişi / firma / servis) adını giriniz.' : 'Lütfen alıcı personel adını giriniz.');
      return;
    }

    setSubmitting(true);
    setErrorMsg('');

    const payload = {
      ...formData,
      direction,
      recipient_name: formData.recipient_name.trim() || recipientSearch.trim(),
      waybill_no: formData.waybill_no ? String(formData.waybill_no).trim().slice(0, 16) : null
    };

    try {
      let res;
      if (editCargo?.id) {
        res = await apiPut(`/api/cargo/${editCargo.id}`, payload);
      } else {
        res = await apiPost('/api/cargo', payload);
      }

      if (res?.success) {
        onSaved && onSaved(res.id || editCargo?.id);
        onClose();
      } else {
        setErrorMsg(res?.message || res?.error || 'Kayıt sırasında hata oluştu.');
      }
    } catch (err) {
      setErrorMsg(err.message || 'Sunucu hatası.');
    } finally {
      setSubmitting(false);
    }
  };

  const isOutgoing = direction === 'outgoing';
  const isTicketLocked = Boolean(editCargo?.service_ticket_id || editCargo?.service_ticket_no);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editCargo 
        ? `✏️ Kargo Kaydını Düzenle (#${editCargo.id})` 
        : (isOutgoing ? '📤 Yeni Giden Kargo Çıkışı' : '📥 Yeni Gelen Kargo Girişi')}
      size="lg"
    >
      <form onSubmit={handleSubmit} className="cargo-form-container">
        {errorMsg && (
          <div className="alert-banner alert-danger" style={{ marginBottom: 16 }}>
            <span>⚠️</span> {errorMsg}
          </div>
        )}

        {/* ── Kargo Yönü Seçimi (Gelen / Giden) ── */}
        <div style={{
          display: 'flex',
          gap: 10,
          marginBottom: 16,
          background: 'var(--color-surface-alt, rgba(0,0,0,0.15))',
          padding: 6,
          borderRadius: 10,
          border: '1px solid var(--color-border)'
        }}>
          <button
            type="button"
            className={`btn btn-sm ${!isOutgoing ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => handleDirectionChange('incoming')}
            style={{
              flex: 1,
              fontWeight: 800,
              fontSize: 13,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              padding: '8px 12px'
            }}
          >
            <span>📥</span>
            <span>Gelen Kargo (Kabul & Giriş)</span>
          </button>
          <button
            type="button"
            className={`btn btn-sm ${isOutgoing ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => handleDirectionChange('outgoing')}
            style={{
              flex: 1,
              fontWeight: 800,
              fontSize: 13,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              padding: '8px 12px',
              background: isOutgoing ? 'linear-gradient(135deg, #f59e0b, #d97706)' : undefined,
              color: isOutgoing ? '#ffffff' : undefined
            }}
          >
            <span>📤</span>
            <span>Giden Kargo (Gönderim & Çıkış)</span>
          </button>
        </div>

        <div className="cargo-form-grid">
          {/* Kargo Takip No & Barkod */}
          <div className="form-group">
            <label>Kargo Takip No / Barkod <span style={{ color: 'var(--color-text-muted)', fontSize: 11 }}>(Opsiyonel)</span></label>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                placeholder="Barkod okutun veya takip no girin..."
                value={formData.tracking_number}
                onChange={e => handleInputChange('tracking_number', e.target.value)}
                className="form-control"
                style={{ paddingLeft: 34 }}
              />
              <span style={{ position: 'absolute', left: 10, top: 9, opacity: 0.6 }}>🏷️</span>
            </div>
          </div>

          {/* İrsaliye Numarası (16 Hane) */}
          <div className="form-group">
            <label>İrsaliye Numarası <span style={{ color: 'var(--color-text-muted)', fontSize: 11 }}>(16 Haneli)</span></label>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                placeholder="Örn: EAA2026000001234"
                maxLength={16}
                value={formData.waybill_no}
                onChange={e => handleInputChange('waybill_no', e.target.value.toUpperCase())}
                className="form-control"
                style={{ paddingLeft: 34, letterSpacing: 0.5 }}
              />
              <span style={{ position: 'absolute', left: 10, top: 9, opacity: 0.6 }}>📄</span>
            </div>
            {formData.waybill_no && formData.waybill_no.length > 0 && formData.waybill_no.length < 16 && (
              <span style={{ fontSize: 10, color: 'var(--color-warning)', marginTop: 2, display: 'block' }}>
                İrsaliye no {formData.waybill_no.length}/16 karakter
              </span>
            )}
          </div>

          {/* Kargo Firması */}
          <div className="form-group">
            <label>Kargo Firması <span style={{ color: 'var(--color-danger)' }}>*</span></label>
            <select
              value={formData.carrier}
              onChange={e => handleInputChange('carrier', e.target.value)}
              className="form-control"
              required
            >
              {CARRIERS.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Kargo Durumu */}
          <div className="form-group">
            <label>Kargo Durumu <span style={{ color: 'var(--color-danger)' }}>*</span></label>
            <select
              value={formData.status}
              onChange={e => handleInputChange('status', e.target.value)}
              className="form-control"
              required
            >
              {(isOutgoing ? STATUS_OPTIONS_OUTGOING : STATUS_OPTIONS_INCOMING).map(st => (
                <option key={st} value={st}>{st}</option>
              ))}
            </select>
          </div>

          {/* Gönderen (Firma / Şahıs / IT) */}
          <div className="form-group">
            <label>{isOutgoing ? 'Gönderici (IT Birimi / Şirket / Şahıs)' : 'Gönderen (Firma / Tedarikçi / Şahıs)'}</label>
            <input
              type="text"
              placeholder={isOutgoing ? 'Örn: IT Departmanı (Ahmet Yılmaz), Örnek Şirket A.Ş.' : 'Örn: Tedarikçi Firma, Yetkili Servis, vb.'}
              value={formData.sender}
              onChange={e => handleInputChange('sender', e.target.value)}
              className="form-control"
            />
          </div>

          {/* Alıcı (Personel / Firma / Yetkili Servis) */}
          <div className="form-group" style={{ position: 'relative' }}>
            <label>{isOutgoing ? 'Alıcı (Kişi / Firma / Yetkili Servis / Şube)' : 'Alıcı Personel'} <span style={{ color: 'var(--color-danger)' }}>*</span></label>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                placeholder={isOutgoing ? 'Personel adı, servis firması veya alıcı yazın...' : 'Personel adı arayın veya yazın...'}
                value={recipientSearch}
                onChange={e => {
                  setRecipientSearch(e.target.value);
                  handleInputChange('recipient_name', e.target.value);
                  setShowUserSuggestions(true);
                }}
                onFocus={() => setShowUserSuggestions(true)}
                className="form-control"
                style={{ paddingLeft: 34 }}
                required
              />
              <span style={{ position: 'absolute', left: 10, top: 9, opacity: 0.6 }}>{isOutgoing ? '🏢' : '🧑‍💻'}</span>
            </div>

            {/* Otomatik Tamamlama Önerileri */}
            {showUserSuggestions && filteredUsers.length > 0 && (
              <div className="cargo-user-suggestions">
                {filteredUsers.map(u => (
                  <div
                    key={u.id}
                    className="cargo-user-item"
                    onMouseDown={() => handleSelectUser(u)}
                  >
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{u.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                      {u.department_name ? `${u.department_name} • ` : ''}{u.location_name || ''}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Alıcı Telefon Numarası (Özellikle Giden Kargo İçin) */}
          {isOutgoing && (
            <div className="form-group">
              <label>Alıcı Telefon Numarası <span style={{ color: 'var(--color-text-muted)', fontSize: 11 }}>(Etiket için)</span></label>
              <input
                type="text"
                placeholder="Örn: 0532 XXX XX XX / 0216 XXX XX XX"
                value={formData.receiver_phone}
                onChange={e => handleInputChange('receiver_phone', e.target.value)}
                className="form-control"
              />
            </div>
          )}

          {/* Departman / Şirket / Şube */}
          <div className="form-group">
            <label>Departman / Şirket / Şube</label>
            <input
              type="text"
              placeholder="Örn: Bilgi İşlem / IT, Muhasebe, Yetkili Servis"
              value={formData.department}
              onChange={e => handleInputChange('department', e.target.value)}
              className="form-control"
            />
          </div>

          {/* Paket İçeriği / Türü */}
          <div className="form-group">
            <label>Paket İçeriği / Türü</label>
            <select
              value={formData.package_type}
              onChange={e => handleInputChange('package_type', e.target.value)}
              className="form-control"
            >
              {PACKAGE_TYPES.map(pt => (
                <option key={pt} value={pt}>{pt}</option>
              ))}
            </select>
          </div>

          {/* Koli / Paket Sayısı */}
          <div className="form-group">
            <label>Paket / Koli Adedi</label>
            <input
              type="number"
              min="1"
              max="999"
              value={formData.package_count}
              onChange={e => handleInputChange('package_count', e.target.value)}
              className="form-control"
            />
          </div>

          {/* Tarih & Saat */}
          <div className="form-group">
            <label>{isOutgoing ? 'Gönderim / Çıkış Tarihi & Saati' : 'Geliş / Teslim Alma Tarihi & Saati'}</label>
            <input
              type="datetime-local"
              value={formData.received_date}
              onChange={e => handleInputChange('received_date', e.target.value)}
              className="form-control"
              required
            />
          </div>

          {/* İşlem Yapan IT Yetkilisi */}
          <div className="form-group">
            <label>{isOutgoing ? 'Kargoyu Gönderen IT Yetkilisi' : 'Teslim Alan IT Yetkilisi'}</label>
            <input
              type="text"
              value={formData.received_by}
              onChange={e => handleInputChange('received_by', e.target.value)}
              className="form-control"
              placeholder="IT Yetkilisi adı..."
            />
          </div>
        </div>

        {/* Alıcı Teslimat Adresi (Giden Kargo İçin Özel) */}
        {isOutgoing && (
          <div className="form-group" style={{ marginTop: 12 }}>
            <label>Alıcı Teslimat Adresi <span style={{ color: 'var(--color-text-muted)', fontSize: 11 }}>(Kargo çıkış etiketi ve kurye için)</span></label>
            <textarea
              rows="2"
              placeholder="Örn: Organize Sanayi Bölgesi 12. Cadde No:45 Odunpazarı / Eskişehir"
              value={formData.receiver_address}
              onChange={e => handleInputChange('receiver_address', e.target.value)}
              className="form-control"
              style={{ resize: 'vertical' }}
            />
          </div>
        )}

        {/* ── 🖥️ Snipe-IT Cihaz / Envanter Eşleştirme Bölümü (Opsiyonel) ── */}
        <div className="cargo-asset-card" style={{ marginTop: 16, padding: 14, background: 'rgba(99, 102, 241, 0.06)', border: '1px dashed rgba(99, 102, 241, 0.3)', borderRadius: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontWeight: 700, fontSize: 13, color: '#818cf8', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>🖥️</span> Snipe-IT Cihaz / Envanter Eşleştirme <span style={{ fontSize: 11, fontWeight: 'normal', opacity: 0.8 }}>(Opsiyonel)</span>
            </span>
            {formData.asset_tag && (
              <button
                type="button"
                className="btn btn-xs btn-secondary"
                onClick={handleClearAsset}
                title="Cihaz Seçimini Kaldır"
              >
                ✕ Seçimi Kaldır
              </button>
            )}
          </div>

          <div style={{ position: 'relative' }}>
            <input
              type="text"
              placeholder="Snipe-IT Asset Tag (Demirbaş No), Seri No veya Model adı arayın..."
              value={assetSearch}
              onChange={e => {
                setAssetSearch(e.target.value);
                setShowAssetSuggestions(true);
              }}
              onFocus={() => setShowAssetSuggestions(true)}
              className="form-control"
              style={{ paddingLeft: 34 }}
            />
            <span style={{ position: 'absolute', left: 10, top: 9, opacity: 0.6 }}>🔍</span>

            {/* Cihaz Öneri Listesi */}
            {showAssetSuggestions && filteredAssets.length > 0 && (
              <div className="cargo-user-suggestions" style={{ maxHeight: 200 }}>
                {filteredAssets.map(a => (
                  <div
                    key={a.id}
                    className="cargo-user-item"
                    onMouseDown={() => handleSelectAsset(a)}
                  >
                    <div style={{ fontWeight: 700, fontSize: 13 }}>
                      <code>{a.asset_tag}</code> - {a.model_name || a.name || 'Cihaz'}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                      Seri: {a.serial || '—'} {a.assigned_to_user_name ? `• Atanan: ${a.assigned_to_user_name}` : ''}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Seçili Cihaz Bilgisi ve Servis Fişi Aktarma Onayı */}
          {formData.asset_tag && (
            <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid rgba(99, 102, 241, 0.2)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, fontSize: 12, marginBottom: 10 }}>
                <div><strong>Demirbaş No:</strong> <code>{formData.asset_tag}</code></div>
                <div><strong>Model / Cihaz:</strong> {formData.model_name || formData.asset_name || '—'}</div>
                <div><strong>Seri No:</strong> {formData.serial_no || '—'}</div>
                <div><strong>Cihaz Sahibi (Zimmet):</strong> <span style={{ color: '#38bdf8', fontWeight: 600 }}>{formData.device_user || '—'}</span></div>
              </div>

              {/* Servis Fişi Aktarma Checkbox'ı ve Alanları - SADECE GELEN KARGODA VEYA MEVCUT BAĞLI FİŞ VARSA */}
              {!isOutgoing && (
                <>
                  <label style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: 8, 
                    cursor: isTicketLocked ? 'not-allowed' : 'pointer', 
                    fontWeight: 600, 
                    color: isTicketLocked ? '#34d399' : '#38bdf8',
                    opacity: isTicketLocked ? 0.95 : 1 
                  }}>
                    <input
                      type="checkbox"
                      checked={formData.create_service_ticket}
                      disabled={isTicketLocked}
                      onChange={e => {
                        if (!isTicketLocked) {
                          handleInputChange('create_service_ticket', e.target.checked);
                        }
                      }}
                      style={{ width: 16, height: 16, accentColor: isTicketLocked ? '#10b981' : '#0284c7', cursor: isTicketLocked ? 'not-allowed' : 'pointer' }}
                    />
                    <span>
                      {isTicketLocked 
                        ? `🔒 Servis Fişi Bağlı (${editCargo.service_ticket_no || '#' + editCargo.service_ticket_id}) — Düzenleme esnasında kaldırılamaz` 
                        : '⚡ Bu işlem için otomatik Servis Fişi oluştur ve servise bağla'}
                    </span>
                  </label>

                  {formData.create_service_ticket && (
                    <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div>
                        <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-secondary, #94a3b8)', marginBottom: 3, display: 'block' }}>
                          👤 Bilgisayar Sahibi / Kullanıcı (Servis Fişinde Kullanılacak İsim):
                        </label>
                        <input
                          type="text"
                          placeholder="Cihaz kullanıcısı / bilgisayar sahibi..."
                          value={formData.device_user}
                          onChange={e => handleInputChange('device_user', e.target.value)}
                          className="form-control"
                          style={{ fontSize: 12 }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-secondary, #94a3b8)', marginBottom: 3, display: 'block' }}>
                          🔧 Arıza Açıklaması / Ön Tespit:
                        </label>
                        <input
                          type="text"
                          placeholder="Arıza açıklaması / Ön tespit..."
                          value={formData.fault_desc}
                          onChange={e => handleInputChange('fault_desc', e.target.value)}
                          className="form-control"
                          style={{ fontSize: 12 }}
                        />
                      </div>
                    </div>
                  )}
                </>
              )}

              {isOutgoing && isTicketLocked && (
                <div style={{ marginTop: 8, padding: '6px 10px', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: 6, fontSize: 12, fontWeight: 600, color: '#34d399' }}>
                  🔒 Bağlı Servis Fişi: {editCargo.service_ticket_no || '#' + editCargo.service_ticket_id}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Açıklama / İçerik Notları */}
        <div className="form-group" style={{ marginTop: 14 }}>
          <label>Açıklama & Koli / Cihaz Notları</label>
          <textarea
            rows="3"
            placeholder={isOutgoing 
              ? "Gönderim amacı (Yetkili servise onarıma gönderim, şubeye transfer, kullanıcıya zimmet gönderimi vb.), koli notları..." 
              : "Cihaz arıza bilgisi, kutu durumu, faturası var mı, genel koli açıklaması vb..."}
            value={formData.notes}
            onChange={e => handleInputChange('notes', e.target.value)}
            className="form-control"
            style={{ resize: 'vertical' }}
          />
        </div>

        <div className="modal-footer" style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={submitting}>
            İptal
          </button>
          <button type="submit" className="btn btn-primary" disabled={submitting} style={{
            background: isOutgoing ? 'linear-gradient(135deg, #f59e0b, #d97706)' : undefined,
            color: isOutgoing ? '#ffffff' : undefined,
            border: 'none',
            fontWeight: 800
          }}>
            {submitting 
              ? 'Kaydediliyor...' 
              : editCargo 
                ? '💾 Değişiklikleri Kaydet' 
                : (isOutgoing ? '📤 Giden Kargoyu Kaydet' : '📥 Gelen Kargoyu Kaydet')}
          </button>
        </div>
      </form>
    </Modal>
  );
}
