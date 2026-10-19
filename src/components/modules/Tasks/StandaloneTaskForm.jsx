import React, { useState, useEffect } from 'react';
import Modal from '../../common/Modal';
import { useApp } from '../../../context/AppContext';
import { getApiBase, API_BASE } from '../../../utils/apiConfig';

export default function StandaloneTaskForm({ onClose, onSave }) {
  const { showNotification } = useApp();
  const [saving, setSaving] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [form, setForm] = useState({
    taskName: '',
    assignee: '',
    priority: 'Normal',
    description: '',
    template_id: ''
  });

  useEffect(() => {
    fetch(`${API_BASE}/api/installation/settings/templates`)
      .then(r => r.json())
      .then(d => setTemplates(d.data || []))
      .catch(console.error);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.taskName.trim()) {
      showNotification('Görev adı zorunludur.', 'warning');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/api/fis-ekle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          record_type: 'standalone_task',
          model_name: form.taskName, // Görev adını model_name'de tutuyoruz
          user_name: form.assignee, // Atanan kişiyi user_name'de tutuyoruz
          fault_desc: form.description || 'Bağımsız Görev',
          priority: form.priority,
          status: 'Yeni Kayıt',
          template_id: form.template_id || null
        })
      });

      if (res.ok) {
        showNotification('Görev başarıyla oluşturuldu.', 'success');
        onSave();
      } else {
        const err = await res.json();
        showNotification(err.message || 'Görev oluşturulamadı.', 'danger');
      }
    } catch (e) {
      showNotification('Sunucu bağlantı hatası.', 'danger');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen title="Yeni Görev Ekle" size="md" onClose={onClose}>
      <form onSubmit={handleSubmit} style={{ padding: '5px 15px 20px', display: 'flex', flexDirection: 'column', gap: 15 }}>
        
        <div className="form-group">
          <label>Görev Adı *</label>
          <input 
            type="text" 
            autoFocus
            value={form.taskName} 
            onChange={e => setForm({...form, taskName: e.target.value})} 
            placeholder="Örn: Yeni sunucu kurulumu" 
          />
        </div>

        <div className="form-grid-3">
          <div className="form-group">
            <label>Kime Atanacak (İsteğe Bağlı)</label>
            <input 
              type="text" 
              value={form.assignee} 
              onChange={e => setForm({...form, assignee: e.target.value})} 
              placeholder="Örn: Ahmet" 
            />
          </div>
          <div className="form-group">
            <label>Şablon Seçimi</label>
            <select value={form.template_id} onChange={e => setForm({...form, template_id: e.target.value})}>
              <option value="">Şablon Yok</option>
              {templates.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Öncelik</label>
            <select value={form.priority} onChange={e => setForm({...form, priority: e.target.value})}>
              <option value="Düşük">Düşük</option>
              <option value="Normal">Normal</option>
              <option value="Yüksek">Yüksek</option>
              <option value="Acil">Acil</option>
            </select>
          </div>
        </div>

        <div className="form-group">
          <label>Detaylı Açıklama (İsteğe Bağlı)</label>
          <textarea 
            rows={3}
            value={form.description} 
            onChange={e => setForm({...form, description: e.target.value})} 
            placeholder="Görev hakkında ek bilgiler..." 
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>İptal</button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Kaydediliyor...' : 'Görev Oluştur'}
          </button>
        </div>

      </form>
    </Modal>
  );
}
