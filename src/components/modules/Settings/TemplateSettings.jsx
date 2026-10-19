import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import ConfirmDialog from '../../common/ConfirmDialog';
import PromptDialog from '../../common/PromptDialog';
import { getApiBase, API_BASE } from '../../../utils/apiConfig';

export default function TemplateSettings({ showNotification }) {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTemplateId, setSelectedTemplateId] = useState(null);
  
  // Modals / Dialogs
  const [confirmAction, setConfirmAction] = useState(null);
  const [promptAction, setPromptAction] = useState(null);
  const [taskForm, setTaskForm] = useState(null); // { mode: 'add'|'edit', task: null|obj, form: { task_name, input_type, is_required } }

  const loadTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/installation/settings/templates`);
      if (res.ok) {
        const json = await res.json();
        setTemplates(json.data || []);
        if (!selectedTemplateId && json.data?.length > 0) {
          setSelectedTemplateId(json.data[0].id);
        }
      }
    } catch (e) {
      showNotification('Şablonlar yüklenirken hata oluştu.', 'danger');
    } finally {
      setLoading(false);
    }
  }, [showNotification, selectedTemplateId]);

  useEffect(() => { loadTemplates(); }, [loadTemplates]);

  const selectedTemplate = templates.find(t => t.id === selectedTemplateId) || null;

  // --- TEMPLATE ACTIONS ---
  const handleAddTemplate = () => {
    setPromptAction({
      title: 'Yeni Şablon Oluştur',
      message: 'Lütfen yeni şablonun adını girin:',
      defaultValue: '',
      onConfirm: async (name) => {
        setPromptAction(null);
        if (!name?.trim()) return;
        try {
          const res = await fetch(`${API_BASE}/api/installation/settings/templates`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: name.trim() })
          });
          if (res.ok) {
            showNotification('Yeni şablon eklendi.', 'success');
            loadTemplates();
          } else {
            showNotification('Şablon eklenemedi.', 'danger');
          }
        } catch (e) {
          showNotification('Bağlantı hatası.', 'danger');
        }
      }
    });
  };

  const handleEditTemplate = (template) => {
    setPromptAction({
      title: 'Şablon Adını Düzenle',
      message: 'Şablon için yeni bir isim girin:',
      defaultValue: template.name,
      onConfirm: async (newName) => {
        setPromptAction(null);
        if (!newName?.trim() || newName === template.name) return;
        try {
          const res = await fetch(`${API_BASE}/api/installation/settings/templates/${template.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: newName.trim() })
          });
          if (res.ok) {
            showNotification('Şablon adı güncellendi.', 'success');
            loadTemplates();
          } else {
            showNotification('Şablon adı güncellenemedi.', 'danger');
          }
        } catch (e) {
          showNotification('Bağlantı hatası.', 'danger');
        }
      }
    });
  };

  const handleDeleteTemplate = (template) => {
    setConfirmAction({
      title: 'Şablonu Sil',
      message: `"${template.name}" adlı şablonu silmek istediğinize emin misiniz? İçindeki tüm görevler de silinecektir.`,
      type: 'danger',
      onConfirm: async () => {
        setConfirmAction(null);
        try {
          const res = await fetch(`${API_BASE}/api/installation/settings/templates/${template.id}`, { method: 'DELETE' });
          if (res.ok) {
            showNotification('Şablon silindi.', 'success');
            if (selectedTemplateId === template.id) setSelectedTemplateId(null);
            loadTemplates();
          } else {
            showNotification('Şablon silinemedi.', 'danger');
          }
        } catch (e) {
          showNotification('Bağlantı hatası.', 'danger');
        }
      }
    });
  };

  // --- TASK ACTIONS ---
  const handleAddTask = () => {
    if (!selectedTemplate) return;
    setTaskForm({
      mode: 'add',
      task: null,
      form: { task_name: '', input_type: 'checkbox', is_required: 0 }
    });
  };

  const handleEditTask = (task) => {
    setTaskForm({
      mode: 'edit',
      task: task,
      form: { task_name: task.task_name, input_type: task.input_type || 'checkbox', is_required: task.is_required || 0 }
    });
  };

  const saveTask = async () => {
    if (!taskForm?.form?.task_name?.trim()) return showNotification('Görev adı zorunludur.', 'danger');
    
    try {
      if (taskForm.mode === 'add') {
        const sortOrder = selectedTemplate.tasks.length > 0 
          ? Math.max(...selectedTemplate.tasks.map(t => t.sort_order || 0)) + 1 
          : 0;

        const res = await fetch(`${API_BASE}/api/installation/settings/templates/${selectedTemplate.id}/tasks`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...taskForm.form, sort_order: sortOrder })
        });
        if (res.ok) {
          showNotification('Görev eklendi.', 'success');
          loadTemplates();
        } else showNotification('Görev eklenemedi.', 'danger');
      } else {
        const res = await fetch(`${API_BASE}/api/installation/settings/tasks/${taskForm.task.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(taskForm.form)
        });
        if (res.ok) {
          showNotification('Görev güncellendi.', 'success');
          loadTemplates();
        } else showNotification('Görev güncellenemedi.', 'danger');
      }
    } catch (e) {
      showNotification('Bağlantı hatası.', 'danger');
    }
    setTaskForm(null);
  };

  const handleDeleteTask = (task) => {
    setConfirmAction({
      title: 'Görevi Sil',
      message: `"${task.task_name}" görevini silmek istediğinize emin misiniz?`,
      type: 'danger',
      onConfirm: async () => {
        setConfirmAction(null);
        try {
          const res = await fetch(`${API_BASE}/api/installation/settings/tasks/${task.id}`, { method: 'DELETE' });
          if (res.ok) {
            showNotification('Görev silindi.', 'success');
            loadTemplates();
          } else {
            showNotification('Görev silinemedi.', 'danger');
          }
        } catch (e) {
          showNotification('Bağlantı hatası.', 'danger');
        }
      }
    });
  };

  const moveTask = async (task, direction) => {
    if (!selectedTemplate) return;
    const currentIndex = selectedTemplate.tasks.findIndex(t => t.id === task.id);
    if (direction === 'up' && currentIndex === 0) return;
    if (direction === 'down' && currentIndex === selectedTemplate.tasks.length - 1) return;

    const newTasks = [...selectedTemplate.tasks];
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    const targetTask = newTasks[targetIndex];

    // Swap sort_order
    const currentOrder = task.sort_order;
    const targetOrder = targetTask.sort_order;

    try {
      await fetch(`${API_BASE}/api/installation/settings/tasks/${task.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sort_order: targetOrder })
      });
      await fetch(`${API_BASE}/api/installation/settings/tasks/${targetTask.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sort_order: currentOrder })
      });
      loadTemplates();
    } catch (e) {
      showNotification('Sıralama güncellenemedi.', 'danger');
    }
  };

  if (loading && templates.length === 0) {
    return <div className="flex-center" style={{ height: 200 }}><div className="spinner" /></div>;
  }

  return (
    <div style={{ display: 'flex', gap: 20, height: '100%' }}>
      {/* Şablon Listesi */}
      <div className="card" style={{ width: 280, display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        <div className="card-header" style={{ padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 13, fontWeight: 700 }}>Şablonlar</span>
          <button className="btn btn-sm btn-primary" onClick={handleAddTemplate} title="Yeni Şablon">+</button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {templates.map(template => (
            <div 
              key={template.id}
              style={{
                padding: '12px 16px',
                borderBottom: '1px solid var(--color-border)',
                background: selectedTemplateId === template.id ? 'var(--color-surface-alt)' : 'transparent',
                borderLeft: selectedTemplateId === template.id ? '3px solid var(--color-primary)' : '3px solid transparent',
                cursor: 'pointer',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}
              onClick={() => setSelectedTemplateId(template.id)}
            >
              <div style={{ fontSize: 13, fontWeight: selectedTemplateId === template.id ? 700 : 500, color: 'var(--color-text)' }}>
                {template.name}
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                <button 
                  className="btn btn-sm" 
                  style={{ background: 'transparent', border: 'none', padding: 4, fontSize: 14 }}
                  onClick={(e) => { e.stopPropagation(); handleEditTemplate(template); }}
                  title="Düzenle"
                >✏️</button>
                <button 
                  className="btn btn-sm" 
                  style={{ background: 'transparent', border: 'none', padding: 4, fontSize: 14 }}
                  onClick={(e) => { e.stopPropagation(); handleDeleteTemplate(template); }}
                  title="Sil"
                >❌</button>
              </div>
            </div>
          ))}
          {templates.length === 0 && (
            <div style={{ padding: 20, textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 12 }}>
              Henüz şablon eklenmemiş.
            </div>
          )}
        </div>
      </div>

      {/* Şablona Ait Görevler */}
      <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {selectedTemplate ? (
          <>
            <div className="card-header" style={{ padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13, fontWeight: 700 }}>
                {selectedTemplate.name} Görevleri (Check-list)
              </span>
              <button className="btn btn-sm btn-primary" onClick={handleAddTask}>+ Yeni Görev Ekle</button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: 'var(--grid-header-bg)', color: 'var(--grid-header-text)', borderBottom: '1px solid var(--color-border)' }}>
                    <th style={{ padding: '10px 15px', textAlign: 'left', width: 60 }}>Sıra</th>
                    <th style={{ padding: '10px 15px', textAlign: 'left' }}>Görev / Madde Adı</th>
                    <th style={{ padding: '10px 15px', textAlign: 'left', width: 120 }}>Tür</th>
                    <th style={{ padding: '10px 15px', textAlign: 'right', width: 140 }}>İşlemler</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedTemplate.tasks.map((task, index) => (
                    <tr key={task.id} style={{ borderBottom: '1px solid var(--color-border)', background: index % 2 ? 'var(--color-surface-alt)' : 'var(--color-surface)' }}>
                      <td style={{ padding: '10px 15px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>
                        #{index + 1}
                      </td>
                      <td style={{ padding: '10px 15px', color: 'var(--color-text)' }}>
                        {task.task_name}
                      </td>
                      <td style={{ padding: '10px 15px', color: 'var(--color-text-secondary)', fontSize: 12 }}>
                        {task.input_type === 'text' ? (task.is_required ? 'Metin (Zorunlu)' : 'Metin (Opsiyonel)') : 'Onay Kutusu'}
                      </td>
                      <td style={{ padding: '10px 15px', textAlign: 'right', display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                        <button 
                          className="btn btn-sm btn-secondary" 
                          disabled={index === 0}
                          onClick={() => moveTask(task, 'up')}
                          title="Yukarı Taşı"
                        >⬆️</button>
                        <button 
                          className="btn btn-sm btn-secondary" 
                          disabled={index === selectedTemplate.tasks.length - 1}
                          onClick={() => moveTask(task, 'down')}
                          title="Aşağı Taşı"
                        >⬇️</button>
                        <button 
                          className="btn btn-sm btn-secondary" 
                          onClick={() => handleEditTask(task)}
                          title="Düzenle"
                        >✏️</button>
                        <button 
                          className="btn btn-sm btn-danger" 
                          onClick={() => handleDeleteTask(task)}
                          title="Sil"
                        >❌</button>
                      </td>
                    </tr>
                  ))}
                  {selectedTemplate.tasks.length === 0 && (
                    <tr>
                      <td colSpan={3} style={{ padding: 30, textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 13 }}>
                        Bu şablonda henüz görev bulunmuyor.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <div className="flex-center" style={{ flex: 1, flexDirection: 'column', color: 'var(--color-text-muted)', gap: 10 }}>
            <span style={{ fontSize: 40 }}>📋</span>
            <span>Görevlerini görmek için soldan bir şablon seçin.</span>
          </div>
        )}
      </div>

      {confirmAction && (
        <ConfirmDialog
          title={confirmAction.title} 
          message={confirmAction.message} 
          type={confirmAction.type}
          confirmText="Evet, Devam Et" 
          cancelText="İptal"
          onConfirm={confirmAction.onConfirm} 
          onCancel={() => setConfirmAction(null)}
        />
      )}

      {promptAction && (
        <PromptDialog
          title={promptAction.title}
          message={promptAction.message}
          defaultValue={promptAction.defaultValue}
          onConfirm={promptAction.onConfirm}
          onCancel={() => setPromptAction(null)}
        />
      )}

      {taskForm && createPortal(
        <div className="modal-overlay" style={{ zIndex: 1000000 }}>
          <div className="modal-content" style={{ width: 450, maxWidth: '90%', background: 'var(--color-surface)', borderRadius: 8, boxShadow: '0 4px 20px rgba(0,0,0,0.5)', overflow: 'hidden' }}>
            <div className="modal-header">
              <h3>{taskForm.mode === 'add' ? 'Yeni Görev Ekle' : 'Görevi Düzenle'}</h3>
              <button className="btn-close" onClick={() => setTaskForm(null)}>&times;</button>
            </div>
            <div className="modal-body" style={{ padding: 20 }}>
              <div className="form-group" style={{ marginBottom: 15 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 5, display: 'block' }}>Görev/Madde Adı</label>
                <input 
                  type="text" 
                  className="form-control"
                  value={taskForm.form.task_name}
                  onChange={e => setTaskForm({...taskForm, form: {...taskForm.form, task_name: e.target.value}})}
                  placeholder="Örn: İşletim Sistemi Kurulumu"
                  autoFocus
                />
              </div>
              <div className="form-group" style={{ marginBottom: 15 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 5, display: 'block' }}>Girdi Türü</label>
                <select 
                  className="form-control"
                  value={taskForm.form.input_type}
                  onChange={e => setTaskForm({...taskForm, form: {...taskForm.form, input_type: e.target.value}})}
                >
                  <option value="checkbox">Onay Kutusu (Check-list)</option>
                  <option value="text">Metin Kutucuğu (Text Input)</option>
                </select>
              </div>
              {taskForm.form.input_type === 'text' && (
                <div className="form-group">
                  <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', background: 'var(--color-surface-alt)', padding: 12, borderRadius: 6 }}>
                    <input 
                      type="checkbox" 
                      checked={taskForm.form.is_required}
                      onChange={e => setTaskForm({...taskForm, form: {...taskForm.form, is_required: e.target.checked ? 1 : 0}})}
                    />
                    <span style={{ fontSize: 13, fontWeight: 500 }}>Bu alanın doldurulması zorunlu olsun</span>
                  </label>
                </div>
              )}
            </div>
            <div className="modal-footer" style={{ padding: '15px 20px', background: 'var(--color-surface-alt)', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button className="btn btn-secondary" onClick={() => setTaskForm(null)}>İptal</button>
              <button className="btn btn-primary" onClick={saveTask}>{taskForm.mode === 'add' ? 'Ekle' : 'Güncelle'}</button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
