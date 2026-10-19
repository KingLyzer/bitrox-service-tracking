import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { AgGridReact } from 'ag-grid-react';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-quartz.css';
import Modal from '../../common/Modal';
import ConfirmDialog from '../../common/ConfirmDialog';
import { useApp } from '../../../context/AppContext';

export default function AnnouncementsSettings({ showNotification }) {
  const { theme, refreshToggle } = useApp();
  const [announcements, setAnnouncements] = useState([]);
  const [roles, setRoles] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal ve Form durumları
  const [showForm, setShowForm] = useState(false);
  const [selectedAnn, setSelectedAnn] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  // Form Verileri
  const [form, setForm] = useState({
    title: '',
    content: '',
    target_roles: 'all', // 'all' veya virgülle ayrılmış rol adları (örn: 'Yönetici,Teknisyen')
    target_users: '',   // Boş veya virgülle ayrılmış kullanıcı adları (örn: 'admin,ahmet')
    frequency: 'once',  // 'once', 'always', 'daily'
    daily_time: '',     // Örn: '09:50' veya '09:50, 14:00'
    daily_times: [''],  // Form içi çoklu saat dizisi
    start_date: '',
    end_date: '',
    is_active: 1
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [annRes, rolesRes, usersRes] = await Promise.all([
        window.electronAPI.getAnnouncements(),
        window.electronAPI.getRoles(),
        window.electronAPI.getUsers(false)
      ]);

      if (annRes.success) setAnnouncements(annRes.data);
      if (rolesRes.success) setRoles(rolesRes.data);
      if (usersRes.success) setUsers(usersRes.data);
    } catch (err) {
      console.error('Duyuru verileri yüklenemedi:', err);
      showNotification?.('Duyuru verileri yüklenirken hata oluştu.', 'danger');
    } finally {
      setLoading(false);
    }
  }, [showNotification]);

  useEffect(() => {
    loadData();
  }, [loadData, refreshToggle]);

  const handleTimeChange = (index, value) => {
    setForm(prev => {
      const updated = [...(prev.daily_times || [''])];
      updated[index] = value;
      return { ...prev, daily_times: updated };
    });
  };

  const handleAddTimeSlot = () => {
    setForm(prev => ({
      ...prev,
      daily_times: [...(prev.daily_times || []), '']
    }));
  };

  const handleRemoveTimeSlot = (index) => {
    setForm(prev => {
      const current = prev.daily_times || [''];
      if (current.length <= 1) {
        return { ...prev, daily_times: [''] };
      }
      return {
        ...prev,
        daily_times: current.filter((_, i) => i !== index)
      };
    });
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.title.trim() || !form.content.trim()) {
      showNotification?.('Başlık ve içerik alanları zorunludur.', 'warning');
      return;
    }

    // Çoklu saat formatlaması ve doğrulaması
    const validTimes = (form.daily_times || [])
      .map(t => t.trim())
      .filter(t => /^\d{1,2}:\d{2}$/.test(t))
      .map(t => t.padStart(5, '0'));
    const uniqueSortedTimes = [...new Set(validTimes)].sort();
    const finalDailyTime = uniqueSortedTimes.length > 0 ? uniqueSortedTimes.join(', ') : null;

    if (form.frequency === 'daily' && !finalDailyTime) {
      showNotification?.('Lütfen en az bir geçerli gösterim saati girin.', 'warning');
      return;
    }

    try {
      const payload = {
        ...form,
        daily_time: form.frequency === 'daily' ? finalDailyTime : null,
        id: selectedAnn?.id || null
      };
      delete payload.daily_times;

      const res = await window.electronAPI.saveAnnouncement(payload);
      if (res.success) {
        try {
          const annId = res.id || res.insertId || payload.id;
          if (annId) {
            sessionStorage.removeItem(`dismissed_ann_${annId}`);
          }
        } catch (e) {}
        showNotification?.(selectedAnn ? 'Duyuru güncellendi.' : 'Duyuru oluşturuldu ve yayına alındı.', 'success');
        setShowForm(false);
        loadData();
      } else {
        showNotification?.(res.message || 'Duyuru kaydedilemedi.', 'danger');
      }
    } catch (err) {
      console.error('Duyuru kaydedilemedi:', err);
      showNotification?.('Sistemsel bir hata oluştu.', 'danger');
    }
  };

  const handleDelete = async () => {
    if (!confirmDeleteId) return;
    try {
      const res = await window.electronAPI.deleteAnnouncement(confirmDeleteId);
      if (res.success) {
        showNotification?.('Duyuru başarıyla silindi.', 'success');
        setConfirmDeleteId(null);
        loadData();
      } else {
        showNotification?.(res.message || 'Duyuru silinemedi.', 'danger');
      }
    } catch (err) {
      console.error('Duyuru silinemedi:', err);
      showNotification?.('Duyuru silinirken hata oluştu.', 'danger');
    }
  };

  const openEdit = (ann) => {
    const parsedTimes = ann.daily_time
      ? ann.daily_time.split(',').map(t => t.trim().slice(0, 5)).filter(Boolean)
      : [''];
    if (parsedTimes.length === 0) parsedTimes.push('');

    setSelectedAnn(ann);
    setForm({
      title: ann.title || '',
      content: ann.content || '',
      target_roles: ann.target_roles || 'all',
      target_users: ann.target_users || '',
      frequency: ann.frequency || 'once',
      daily_time: ann.daily_time || '',
      daily_times: parsedTimes,
      start_date: ann.start_date ? ann.start_date.substring(0, 10) : '',
      end_date: ann.end_date ? ann.end_date.substring(0, 10) : '',
      is_active: ann.is_active ?? 1
    });
    setShowForm(true);
  };

  const openCreate = () => {
    setSelectedAnn(null);
    setForm({
      title: '',
      content: '',
      target_roles: 'all',
      target_users: '',
      frequency: 'once',
      daily_time: '',
      daily_times: [''],
      start_date: '',
      end_date: '',
      is_active: 1
    });
    setShowForm(true);
  };

  // Rollerin seçilme durumları
  const handleRoleCheckboxChange = (roleName, checked) => {
    if (form.target_roles === 'all') {
      if (checked) {
        setForm(prev => ({ ...prev, target_roles: roleName }));
      }
    } else {
      let currentRoles = form.target_roles ? form.target_roles.split(',').map(r => r.trim()).filter(Boolean) : [];
      if (checked) {
        if (!currentRoles.includes(roleName)) {
          currentRoles.push(roleName);
        }
      } else {
        currentRoles = currentRoles.filter(r => r !== roleName);
      }
      setForm(prev => ({ 
        ...prev, 
        target_roles: currentRoles.length === 0 ? 'all' : currentRoles.join(',') 
      }));
    }
  };

  // Kullanıcıların seçilme durumları
  const handleUserCheckboxChange = (username, checked) => {
    let currentUsers = form.target_users ? form.target_users.split(',').map(u => u.trim()).filter(Boolean) : [];
    if (checked) {
      if (!currentUsers.includes(username)) {
        currentUsers.push(username);
      }
    } else {
      currentUsers = currentUsers.filter(u => u !== username);
    }
    setForm(prev => ({ ...prev, target_users: currentUsers.join(',') }));
  };

  const columnDefs = useMemo(() => [
    { field: 'title', headerName: 'Başlık', width: 200, sortable: true, filter: true },
    { field: 'content', headerName: 'İçerik', flex: 1, minWidth: 200, sortable: true, filter: true },
    { field: 'target_roles', headerName: 'Hedef Roller', width: 150, 
      valueFormatter: params => params.value === 'all' ? 'Tüm Roller' : params.value 
    },
    { field: 'target_users', headerName: 'Hedef Kullanıcılar', width: 160, 
      valueFormatter: params => params.value ? params.value : 'Tüm Kullanıcılar' 
    },
    { field: 'frequency', headerName: 'Sıklık', width: 130,
      valueFormatter: params => {
        if (params.value === 'once') return 'Tek Seferlik';
        if (params.value === 'always') return 'Her Açılışta';
        if (params.value === 'daily') return 'Her Gün';
        return params.value;
      }
    },
    { field: 'daily_time', headerName: 'Gösterim Saati / Saatleri', width: 180,
      valueFormatter: params => params.value ? String(params.value) : '—'
    },
    { field: 'start_date', headerName: 'Başlangıç', width: 110,
      valueFormatter: params => {
        if (!params.value) return '—';
        if (params.value instanceof Date) {
          return params.value.toISOString().substring(0, 10);
        }
        return String(params.value).substring(0, 10);
      }
    },
    { field: 'end_date', headerName: 'Bitiş', width: 110,
      valueFormatter: params => {
        if (!params.value) return '—';
        if (params.value instanceof Date) {
          return params.value.toISOString().substring(0, 10);
        }
        return String(params.value).substring(0, 10);
      }
    },
    { field: 'is_active', headerName: 'Durum', width: 90,
      cellRenderer: params => (
        <span className={`badge ${params.value ? 'badge-success' : 'badge-danger'}`}>
          {params.value ? 'Aktif' : 'Pasif'}
        </span>
      )
    },
    {
      headerName: 'İşlemler',
      width: 110,
      sortable: false,
      filter: false,
      cellRenderer: params => (
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', height: '100%' }}>
          <button className="btn btn-secondary btn-sm" style={{ padding: '2px 8px' }} onClick={() => openEdit(params.data)} title="Düzenle">✏️</button>
          <button className="btn btn-danger btn-sm" style={{ padding: '2px 8px' }} onClick={() => setConfirmDeleteId(params.data.id)} title="Sil">🗑️</button>
        </div>
      )
    }
  ], []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2, alignItems: 'center' }}>
        <h4 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>📢 Duyuru ve Bildirim Yönetimi</span>
        </h4>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-primary" onClick={openCreate}>➕ Yeni Duyuru Oluştur</button>
          <button className="btn btn-secondary btn-sm" onClick={loadData}>🔄</button>
        </div>
      </div>

      {loading ? (
        <div className="flex-center" style={{ flex: 1, minHeight: 200 }}>
          <div className="spinner" />
          <span style={{ marginLeft: 10, color: 'var(--color-text-muted)' }}>Duyurular Yükleniyor...</span>
        </div>
      ) : (
        <div
          className={theme === 'light' || theme === 'sakura' ? 'ag-theme-quartz' : 'ag-theme-quartz-dark'}
          style={{ flex: 1, width: '100%', minHeight: 300, border: '1px solid var(--color-border)', background: 'var(--color-surface)', borderRadius: 4 }}
        >
          <AgGridReact
            theme="legacy"
            rowData={announcements || []}
            columnDefs={columnDefs}
            defaultColDef={{ resizable: true, sortable: true, filter: true }}
            rowHeight={38}
            headerHeight={40}
            suppressDragLeaveHidesColumns={true}
            pagination
            paginationPageSize={50}
            noRowsOverlayComponent={() => <span>Duyuru bulunamadı.</span>}
          />
        </div>
      )}

      {/* Düzenleme / Ekleme Modalı */}
      <Modal
        isOpen={showForm}
        onClose={() => setShowForm(false)}
        title={selectedAnn ? 'Duyuruyu Düzenle' : 'Yeni Duyuru Ekle'}
        size="lg"
        footer={
          <div className="flex-gap" style={{ justifyContent: 'flex-end', width: '100%' }}>
            <button className="btn btn-secondary" onClick={() => setShowForm(false)}>İptal</button>
            <button className="btn btn-primary" onClick={handleSave}>Kaydet ve Yayınla</button>
          </div>
        }
      >
        <form onSubmit={handleSave} className="form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, padding: '4px 0' }}>
          
          <div className="form-col-span-2" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 11, color: 'var(--color-text-secondary)', fontWeight: 600 }}>Duyuru Başlığı *</label>
            <input
              type="text"
              value={form.title}
              onChange={e => setForm({ ...form, title: e.target.value })}
              placeholder="Duyuru başlığını yazın..."
              required
            />
          </div>

          <div className="form-col-span-2" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 11, color: 'var(--color-text-secondary)', fontWeight: 600 }}>Duyuru İçeriği *</label>
            <textarea
              value={form.content}
              onChange={e => setForm({ ...form, content: e.target.value })}
              placeholder="Duyuru metnini yazın..."
              rows={4}
              style={{ resize: 'vertical', minHeight: 80 }}
              required
            />
          </div>

          {/* Hedef Roller */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 11, color: 'var(--color-text-secondary)', fontWeight: 600 }}>Hedef Roller (Kimler Görecek?)</label>
            <div style={{ border: '1px solid var(--color-border)', borderRadius: 4, padding: 8, maxHeight: 130, overflowY: 'auto', background: 'var(--color-surface-alt)' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, marginBottom: 6, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={form.target_roles === 'all'}
                  onChange={e => setForm(prev => ({ ...prev, target_roles: e.target.checked ? 'all' : '' }))}
                  style={{ width: 'auto' }}
                />
                <span style={{ fontWeight: 600 }}>Tüm Roller (Herkes)</span>
              </label>
              {roles.map(r => {
                const isChecked = form.target_roles === 'all' || 
                  (form.target_roles ? form.target_roles.split(',').map(role => role.trim()).includes(r.name) : false);
                return (
                  <label key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, marginBottom: 4, paddingLeft: 12, cursor: 'pointer', opacity: form.target_roles === 'all' ? 0.6 : 1 }}>
                    <input
                      type="checkbox"
                      checked={isChecked}
                      disabled={form.target_roles === 'all'}
                      onChange={e => handleRoleCheckboxChange(r.name, e.target.checked)}
                      style={{ width: 'auto' }}
                    />
                    {r.name}
                  </label>
                );
              })}
            </div>
          </div>

          {/* Hedef Kullanıcılar */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 11, color: 'var(--color-text-secondary)', fontWeight: 600 }}>Hedef Özel Kullanıcılar (Opsiyonel)</label>
            <div style={{ border: '1px solid var(--color-border)', borderRadius: 4, padding: 8, maxHeight: 130, overflowY: 'auto', background: 'var(--color-surface-alt)' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, marginBottom: 6, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={!form.target_users}
                  onChange={e => setForm(prev => ({ ...prev, target_users: e.target.checked ? '' : '—' }))}
                  style={{ width: 'auto' }}
                />
                <span style={{ fontWeight: 600 }}>Tüm Kullanıcılar</span>
              </label>
              {users.map(u => {
                const isChecked = form.target_users ? form.target_users.split(',').map(usr => usr.trim()).includes(u.username) : false;
                return (
                  <label key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, marginBottom: 4, paddingLeft: 12, cursor: 'pointer', opacity: !form.target_users ? 0.6 : 1 }}>
                    <input
                      type="checkbox"
                      checked={isChecked}
                      disabled={!form.target_users}
                      onChange={e => handleUserCheckboxChange(u.username, e.target.checked)}
                      style={{ width: 'auto' }}
                    />
                    {u.full_name} ({u.username})
                  </label>
                );
              })}
            </div>
          </div>

          {/* Sıklık */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 11, color: 'var(--color-text-secondary)', fontWeight: 600 }}>Gösterim Sıklığı</label>
            <select
              value={form.frequency}
              onChange={e => setForm({ ...form, frequency: e.target.value })}
            >
              <option value="once">Tek Seferlik (Kapatana Kadar)</option>
              <option value="always">Her Oturumda / Her Açılışta</option>
              <option value="daily">Her Gün Belirli Saatte / Saatlerde</option>
            </select>
          </div>

          {/* Saat (Sadece her gün ise) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, opacity: form.frequency === 'daily' ? 1 : 0.4 }}>
            <label style={{ fontSize: 11, color: 'var(--color-text-secondary)', fontWeight: 600 }}>
              Her Gün Gösterim Saati / Saatleri {form.frequency === 'daily' && '*'}
            </label>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {(form.daily_times || ['']).map((timeVal, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input
                    type="time"
                    value={timeVal}
                    onChange={e => handleTimeChange(idx, e.target.value)}
                    disabled={form.frequency !== 'daily'}
                    required={form.frequency === 'daily' && idx === 0}
                    style={{ flex: 1 }}
                  />
                  {(form.daily_times || []).length > 1 && (
                    <button
                      type="button"
                      className="btn btn-danger btn-sm"
                      style={{ padding: '4px 8px', fontSize: 12, height: '100%', cursor: 'pointer' }}
                      onClick={() => handleRemoveTimeSlot(idx)}
                      disabled={form.frequency !== 'daily'}
                      title="Bu saati kaldır"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>

            {form.frequency === 'daily' && (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                style={{
                  marginTop: 2,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  padding: '5px 12px',
                  fontSize: 12,
                  fontWeight: 600,
                  alignSelf: 'flex-start',
                  cursor: 'pointer'
                }}
                onClick={handleAddTimeSlot}
                title="Yeni bir gösterim saati ekle"
              >
                <span>➕</span> Saat Ekle
              </button>
            )}
          </div>

          {/* Başlangıç Tarihi */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 11, color: 'var(--color-text-secondary)', fontWeight: 600 }}>Yayına Giriş Tarihi (Boş ise Hemen)</label>
            <input
              type="date"
              value={form.start_date}
              onChange={e => setForm({ ...form, start_date: e.target.value })}
            />
          </div>

          {/* Bitiş Tarihi */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 11, color: 'var(--color-text-secondary)', fontWeight: 600 }}>Yayından Kalkış Tarihi (Opsiyonel)</label>
            <input
              type="date"
              value={form.end_date}
              onChange={e => setForm({ ...form, end_date: e.target.value })}
            />
          </div>

          <div className="form-col-span-2" style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>
              <input
                type="checkbox"
                checked={form.is_active === 1}
                onChange={e => setForm({ ...form, is_active: e.target.checked ? 1 : 0 })}
                style={{ width: 'auto' }}
              />
              Duyuru Aktif (Yayınlansın)
            </label>
          </div>

        </form>
      </Modal>

      <ConfirmDialog
        isOpen={confirmDeleteId !== null}
        title="Duyuruyu Sil"
        message="Bu duyuruyu kalıcı olarak silmek istediğinizden emin misiniz? Bu işlem geri alınamaz."
        onConfirm={handleDelete}
        onCancel={() => setConfirmDeleteId(null)}
      />
    </div>
  );
}
