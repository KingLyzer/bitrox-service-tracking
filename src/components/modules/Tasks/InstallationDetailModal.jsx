import React, { useState, useEffect } from 'react';
import Modal from '../../common/Modal';
import { useApp } from '../../../context/AppContext';
import { useAuth } from '../../../context/AuthContext';
import { getApiBase, API_BASE } from '../../../utils/apiConfig';

export default function InstallationDetailModal({ ticket, onClose, onComplete }) {
  const { showNotification, triggerRefresh } = useApp();
  const { user, hasPermission } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    asset_tag: ticket.asset_tag || '',
    serial_no: ticket.serial_no || '',
    mac_address: ticket.mac_address || '',
    os_name: ticket.os_name || '',
    os_license: ticket.os_license || '',
    model_name: ticket.model_name || ticket.asset_name || '',
    user_name: ticket.user_name || '',
    agreement: false
  });
  const [completing, setCompleting] = useState(false);

  useEffect(() => {
    loadTasks();
  }, [ticket.id]);

  const loadTasks = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/installation/tasks/${ticket.id}`);
      if (res.ok) {
        const json = await res.json();
        setTasks(json.data || []);
      }
    } catch (e) {
      console.warn("Görevler alınamadı", e);
    } finally {
      setLoading(false);
    }
  };

  const updateTaskText = async (task, value) => {
    if (!hasPermission('tasks', 'can_edit')) return;
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, task_value: value } : t));
    
    try {
      await fetch(`${API_BASE}/api/installation/tasks/${task.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_completed: task.is_completed, task_value: value })
      });
    } catch (e) {
      console.error(e);
    }
  };

  const toggleTask = async (task) => {
    if (!hasPermission('tasks', 'can_edit')) return;
    if (task.input_type === 'text') return; // Text inputs do not have checkboxes
    
    const isCompleted = !task.is_completed;
    const completedBy = isCompleted ? (user?.full_name || user?.username || 'Teknisyen') : null;
    
    // Optimistic update
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, is_completed: isCompleted, completed_by: completedBy } : t));
    
    try {
      await fetch(`${API_BASE}/api/installation/tasks/${task.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_completed: isCompleted, completed_by: completedBy })
      });
      triggerRefresh();
    } catch (e) {
      showNotification("Görev güncellenemedi", "danger");
      loadTasks(); // rollback on error
    }
  };

  const handleComplete = async () => {
    if (!hasPermission('tasks', 'can_edit')) {
      showNotification("Bu işlem için düzenleme yetkiniz yok.", "danger");
      return;
    }
    const isStandalone = ticket.record_type === 'standalone_task';

    if (!isStandalone) {
      if (!form.asset_tag.trim()) return showNotification("Envanter Numarası zorunludur.", "danger");
      if (!form.serial_no.trim()) return showNotification("Seri Numarası zorunludur.", "danger");
      if (!form.agreement) return showNotification("Kurulum onayını işaretlemelisiniz.", "danger");
    }

    const uncompletedCheckboxTasks = tasks.filter(t => t.input_type !== 'text' && !t.is_completed);
    if (uncompletedCheckboxTasks.length > 0) {
      return showNotification("Tüm onay kutularını işaretlemelisiniz.", "danger");
    }

    const emptyRequiredTexts = tasks.filter(t => t.input_type === 'text' && t.is_required && (!t.task_value || !t.task_value.trim()));
    if (emptyRequiredTexts.length > 0) {
      return showNotification(`Zorunlu alanları doldurun: ${emptyRequiredTexts.map(t => t.task_name).join(', ')}`, "danger");
    }

    setCompleting(true);
    try {
      const res = await fetch(`${API_BASE}/api/installation/complete/${ticket.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(isStandalone ? {} : {
          asset_tag: form.asset_tag,
          serial_no: form.serial_no,
          mac_address: form.mac_address,
          os_name: form.os_name,
          os_license: form.os_license,
          model_name: form.model_name,
          user_name: form.user_name
        })
      });

      if (res.ok) {
        showNotification("Cihaz kurulumu başarıyla tamamlandı!", "success");
        triggerRefresh();
        onComplete();
      } else {
        const err = await res.json();
        showNotification(err.message || "Bir hata oluştu", "danger");
      }
    } catch (e) {
      console.error(e);
      showNotification("Sunucuya ulaşılamadı", "danger");
    } finally {
      setCompleting(false);
    }
  };

  return (
    <Modal isOpen title={`Yeni Cihaz Kurulumu - ${ticket.ticket_no}`} size="lg" onClose={onClose}>
      <div style={{ padding: '5px 15px 20px', display: 'flex', flexDirection: 'column', gap: 20 }}>
        
        {/* Ticket Header Info */}
        <div style={{ background: 'var(--color-bg-dark)', padding: 15, borderRadius: 8, display: 'flex', flexWrap: 'wrap', gap: 15 }}>
          <div style={{ flex: '1 1 200px' }}>
            <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', fontWeight: 'bold' }}>KULLANICI</div>
            <div>{ticket.user_name || 'Bilinmiyor'}</div>
          </div>
          <div style={{ flex: '1 1 200px' }}>
            <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', fontWeight: 'bold' }}>CİHAZ TANIMI</div>
            <div>{ticket.model_name || ticket.asset_name || 'Bilinmiyor'}</div>
          </div>
          <div style={{ flex: '1 1 200px' }}>
            <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', fontWeight: 'bold' }}>ÖZEL İSTEKLER / NOTLAR</div>
            <div>{ticket.fault_desc || '-'}</div>
          </div>
        </div>

        {/* Check-List */}
        <div>
          <div className="section-title" style={{ marginBottom: 10 }}>✅ Kurulum İşlemleri (Check-List)</div>
          <div style={{ border: '1px solid var(--color-border)', borderRadius: 8, overflow: 'hidden' }}>
            {loading ? (
              <div style={{ padding: 20, textAlign: 'center', color: 'var(--color-text-muted)' }}>Yükleniyor...</div>
            ) : tasks.length === 0 ? (
              <div style={{ padding: 20, textAlign: 'center', color: 'var(--color-text-muted)' }}>Bu şablona ait tanımlı görev bulunmuyor.</div>
            ) : (
              tasks.map((task, index) => (
                <div 
                  key={task.id} 
                  style={{ 
                    padding: '12px 15px', 
                    borderBottom: index < tasks.length - 1 ? '1px solid var(--color-border)' : 'none',
                    display: 'flex', 
                    flexDirection: task.input_type === 'text' ? 'column' : 'row',
                    alignItems: task.input_type === 'text' ? 'flex-start' : 'center', 
                    gap: 10,
                    background: task.is_completed ? 'rgba(46, 204, 113, 0.05)' : 'var(--color-surface)',
                    cursor: task.input_type === 'text' ? 'default' : 'pointer',
                    transition: 'all 0.2s'
                  }}
                  onClick={() => toggleTask(task)}
                >
                  {task.input_type === 'text' ? (
                    <div style={{ width: '100%' }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)', marginBottom: 6 }}>
                        {task.task_name} {task.is_required ? <span style={{ color: 'var(--color-danger)' }}>*</span> : <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>(Opsiyonel)</span>}
                      </div>
                      <input 
                        type="text" 
                        className="form-control"
                        placeholder="Cevabınızı girin..."
                        value={task.task_value || ''}
                        onChange={e => setTasks(prev => prev.map(t => t.id === task.id ? { ...t, task_value: e.target.value } : t))}
                        onBlur={e => updateTaskText(task, e.target.value)}
                        style={{ width: '100%', fontSize: 13 }}
                      />
                    </div>
                  ) : (
                    <>
                      <div style={{ 
                        width: 22, height: 22, 
                        borderRadius: 4, 
                        border: `2px solid ${task.is_completed ? 'var(--color-success)' : 'var(--color-border)'}`,
                        background: task.is_completed ? 'var(--color-success)' : 'transparent',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: 'white', fontWeight: 'bold', fontSize: 14,
                        flexShrink: 0
                      }}>
                        {task.is_completed ? '✓' : ''}
                      </div>
                      <div style={{ 
                        flex: 1, 
                        fontSize: 14, 
                        textDecoration: task.is_completed ? 'line-through' : 'none',
                        color: task.is_completed ? 'var(--color-text-muted)' : 'var(--color-text)'
                      }}>
                        {task.task_name}
                      </div>
                      {task.is_completed && task.completed_by && (
                        <div style={{ fontSize: 11, color: 'var(--color-success)', fontStyle: 'italic' }}>
                          {task.completed_by} onayladı
                        </div>
                      )}
                    </>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Cihaz Donanım & Yazılım Bilgileri - Sadece Kurulum Fişlerinde */}
        {ticket.record_type !== 'standalone_task' && (
          <div>
            <div className="section-title" style={{ marginBottom: 10 }}>📦 Cihaz & Yazılım Bilgileri</div>
          <div className="form-grid-4">
            <div className="form-group form-col-span-2">
              <label style={{ fontSize: 11, color: 'var(--color-text-secondary)', fontWeight: 600 }}>İşletim Sistemi</label>
              <input type="text" value={form.os_name} onChange={e => setForm({...form, os_name: e.target.value})} placeholder="Örn: Windows 11 Pro" />
            </div>
            <div className="form-group form-col-span-2">
              <label style={{ fontSize: 11, color: 'var(--color-text-secondary)', fontWeight: 600 }}>İşletim Sistemi Lisansı</label>
              <input type="text" value={form.os_license} onChange={e => setForm({...form, os_license: e.target.value})} placeholder="Örn: Dijital Lisans / OEM Anahtarı" />
            </div>
            <div className="form-group form-col-span-2">
              <label style={{ fontSize: 11, color: 'var(--color-text-secondary)', fontWeight: 600 }}>Marka / Model</label>
              <input type="text" value={form.model_name} onChange={e => setForm({...form, model_name: e.target.value})} placeholder="Örn: Dell Latitude 5530" />
            </div>
            <div className="form-group form-col-span-2">
              <label style={{ fontSize: 11, color: 'var(--color-text-secondary)', fontWeight: 600 }}>Ait Kişi / Kullanıcı</label>
              <input type="text" value={form.user_name} onChange={e => setForm({...form, user_name: e.target.value})} placeholder="Örn: Ahmet Yılmaz" />
            </div>
            <div className="form-group form-col-span-2">
              <label style={{ fontSize: 11, color: 'var(--color-text-secondary)', fontWeight: 600 }}>MAC Adresi</label>
              <input type="text" value={form.mac_address} onChange={e => setForm({...form, mac_address: e.target.value})} placeholder="Örn: 00-14-22-01-23-45" />
            </div>
            <div className="form-group form-col-span-2">
              <label style={{ fontSize: 11, color: 'var(--color-text-secondary)', fontWeight: 600 }}>Envanter Numarası (Asset Tag) *</label>
              <input type="text" value={form.asset_tag} onChange={e => setForm({...form, asset_tag: e.target.value})} placeholder="Örn: BARKOD-001" />
            </div>
            <div className="form-group form-col-span-4">
              <label style={{ fontSize: 11, color: 'var(--color-text-secondary)', fontWeight: 600 }}>Seri Numarası (S/N) *</label>
              <input type="text" value={form.serial_no} onChange={e => setForm({...form, serial_no: e.target.value})} placeholder="Örn: PF1234XYZ" />
            </div>
          </div>
          </div>
        )}

        {/* Onay & Tamamlama */}
        <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 15 }}>
          {ticket.record_type !== 'standalone_task' && (
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', background: 'var(--color-bg-dark)', padding: 15, borderRadius: 8 }}>
              <input 
                type="checkbox" 
                checked={form.agreement} 
                onChange={e => setForm({...form, agreement: e.target.checked})} 
                style={{ width: 18, height: 18 }}
              />
              <span style={{ fontSize: 13, fontWeight: 500, color: form.agreement ? 'var(--color-primary)' : 'var(--color-text)' }}>
                Bilgisayarın kurulumları eksiksiz tamamlanmıştır, cihazı çalışır durumda kullanıcıya teslim etmeye hazırım.
              </span>
            </label>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <button className="btn btn-secondary" onClick={onClose} disabled={completing}>Kapat</button>
            <button 
              className="btn btn-primary" 
              onClick={handleComplete} 
              disabled={completing || (ticket.record_type !== 'standalone_task' && (!form.agreement || !form.asset_tag || !form.serial_no))}
              style={{ padding: '0 25px', fontWeight: 'bold' }}
            >
              {completing ? 'Tamamlanıyor...' : 'GÖREVİ TAMAMLA'}
            </button>
          </div>
        </div>

      </div>
    </Modal>
  );
}
