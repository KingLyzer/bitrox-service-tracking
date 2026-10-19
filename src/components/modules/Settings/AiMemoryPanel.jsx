import React, { useState, useEffect, useCallback, useMemo } from 'react';
import ConfirmDialog from '../../common/ConfirmDialog';
import Modal from '../../common/Modal';
import { getApiBase } from '../../../utils/apiConfig';

export default function AiMemoryPanel({ showNotification }) {
  const [memories, setMemories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [showAddForm, setShowAddForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  // Detay & Düzenleme Modal State'i
  const [selectedMemory, setSelectedMemory] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editFormData, setEditFormData] = useState({ category: 'person', target_key: '', fact_text: '' });
  const [editSaving, setEditSaving] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    category: 'person',
    target_key: '',
    fact_text: '',
  });

  const loadMemories = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${getApiBase()}/api/ai/memories`);
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.data)) {
          setMemories(data.data);
        }
      }
    } catch (e) {
      showNotification('Hafıza kayıtları yüklenirken hata oluştu: ' + e.message, 'danger');
    } finally {
      setLoading(false);
    }
  }, [showNotification]);

  useEffect(() => {
    loadMemories();
  }, [loadMemories]);

  const handleAddMemory = async (e) => {
    e.preventDefault();
    if (!formData.fact_text.trim()) {
      showNotification('Lütfen öğrenilecek bilgi metnini girin.', 'warning');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`${getApiBase()}/api/ai/memories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: formData.category,
          target_key: formData.target_key.trim(),
          fact_text: formData.fact_text.trim(),
          added_by: 'Superadmin'
        })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          showNotification('🧠 Bilgi Bitro AI hafızasına başarıyla kaydedildi!', 'success');
          setFormData({ category: 'person', target_key: '', fact_text: '' });
          setShowAddForm(false);
          loadMemories();
        } else {
          showNotification('Kayıt başarısız: ' + data.error, 'danger');
        }
      }
    } catch (err) {
      showNotification('Kayıt hatası: ' + err.message, 'danger');
    } finally {
      setSaving(false);
    }
  };

  const handleOpenDetail = (memory) => {
    setSelectedMemory(memory);
    setEditFormData({
      category: memory.category || 'person',
      target_key: memory.target_key || '',
      fact_text: memory.fact_text || '',
    });
    setIsEditing(false);
  };

  const handleUpdateMemory = async (e) => {
    e.preventDefault();
    if (!selectedMemory) return;
    if (!editFormData.fact_text.trim()) {
      showNotification('Lütfen bilgi metnini boş bırakmayın.', 'warning');
      return;
    }

    setEditSaving(true);
    try {
      const res = await fetch(`${getApiBase()}/api/ai/memories/${selectedMemory.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: editFormData.category,
          target_key: editFormData.target_key.trim(),
          fact_text: editFormData.fact_text.trim(),
        })
      });

      if (res.ok) {
        showNotification('✓ Hafıza kaydı başarıyla güncellendi.', 'success');
        setSelectedMemory(null);
        setIsEditing(false);
        loadMemories();
      } else {
        showNotification('Güncelleme başarısız.', 'danger');
      }
    } catch (err) {
      showNotification('Güncelleme hatası: ' + err.message, 'danger');
    } finally {
      setEditSaving(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      const res = await fetch(`${getApiBase()}/api/ai/memories/${id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        showNotification('🗑️ Bilgi hafızadan başarıyla silindi.', 'info');
        setConfirmDeleteId(null);
        if (selectedMemory?.id === id) {
          setSelectedMemory(null);
        }
        loadMemories();
      } else {
        showNotification('Silme işlemi başarısız.', 'danger');
      }
    } catch (err) {
      showNotification('Silme hatası: ' + err.message, 'danger');
    }
  };

  const filteredMemories = useMemo(() => {
    return memories.filter(m => {
      const matchesCategory = categoryFilter === 'ALL' || m.category === categoryFilter;
      const q = search.toLowerCase().trim();
      const matchesSearch = !q ||
        (m.target_key || '').toLowerCase().includes(q) ||
        (m.fact_text || '').toLowerCase().includes(q) ||
        (m.added_by || '').toLowerCase().includes(q);
      return matchesCategory && matchesSearch;
    });
  }, [memories, categoryFilter, search]);

  const getCategoryBadge = (cat) => {
    switch (cat) {
      case 'person':
        return <span className="badge" style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa', border: '1px solid rgba(59, 130, 246, 0.3)' }}>👤 Personel / Kişi</span>;
      case 'device':
        return <span className="badge" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.3)' }}>💻 Donanım / Cihaz</span>;
      case 'rule':
        return <span className="badge" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24', border: '1px solid rgba(245, 158, 11, 0.3)' }}>📜 Kural / Politika</span>;
      default:
        return <span className="badge" style={{ background: 'rgba(139, 92, 246, 0.15)', color: '#a78bfa', border: '1px solid rgba(139, 92, 246, 0.3)' }}>📌 Genel Not</span>;
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Üst Bilgi Kartı */}
      <div className="card" style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}>
            🧠 Bitro AI Kalıcı Hafızası & Canlı Öğrenme
            <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 12, background: 'var(--color-primary)', color: '#fff', fontWeight: 600 }}>
              {memories.length} Kayıt
            </span>
          </h3>
          <p style={{ fontSize: 12, color: 'var(--color-text-muted)', margin: '4px 0 0 0' }}>
            Yapay zekanın personeller, cihazlar ve kurallar hakkında aklında tuttuğu bilgiler. Detayları görmek ve düzenlemek için satırlara tıklayabilirsiniz.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            className={`btn ${showAddForm ? 'btn-secondary' : 'btn-primary'}`}
            onClick={() => setShowAddForm(!showAddForm)}
            style={{ fontSize: 12, padding: '7px 14px' }}
          >
            {showAddForm ? '✕ Formu Kapat' : '➕ Yeni Bilgi Öğret'}
          </button>
          <button className="btn btn-secondary" onClick={loadMemories} title="Yenile" style={{ fontSize: 12, padding: '7px 12px' }}>
            🔄
          </button>
        </div>
      </div>

      {/* Yeni Bilgi Ekleme Formu */}
      {showAddForm && (
        <form onSubmit={handleAddMemory} className="card" style={{ padding: 20, background: 'var(--color-surface-alt)', border: '1px solid var(--color-border)', animation: 'fadeIn 0.2s ease-in-out' }}>
          <h4 style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text)', marginBottom: 14 }}>
            ➕ Bitro AI'a Yeni Bilgi / Karakter Notu Öğret
          </h4>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: 12, marginBottom: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 4 }}>
                Kategori
              </label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                style={{ width: '100%', padding: '8px 10px', fontSize: 12, borderRadius: 6, border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)' }}
              >
                <option value="person">👤 Personel / Kullanıcı (Mizaç & Unvan)</option>
                <option value="device">💻 Cihaz / Donanım (IP & Konum)</option>
                <option value="rule">📜 Şirket Kuralı & Prosedür</option>
                <option value="general">📌 Genel Bilgi / Not</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 4 }}>
                Hedef Kişi / Cihaz / Konu Adı
              </label>
              <input
                type="text"
                placeholder="Örn: Ahmet Yılmaz, Mehmet Demir, HP LaserJet Pro..."
                value={formData.target_key}
                onChange={(e) => setFormData({ ...formData, target_key: e.target.value })}
                style={{ width: '100%', padding: '8px 10px', fontSize: 12, borderRadius: 6, border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)' }}
              />
            </div>
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 4 }}>
              Öğrenilecek Bilgi / Mizaç & Hitap Notu <span style={{ color: 'var(--color-danger)' }}>*</span>
            </label>
            <textarea
              rows={3}
              placeholder="Örn: Bilgi Yönetim Sistemleri Kıdemli Uzmanı. Disiplinli ve titizdir. Şakayı dozunda sever, ona göre hürmetli konuş..."
              value={formData.fact_text}
              onChange={(e) => setFormData({ ...formData, fact_text: e.target.value })}
              style={{ width: '100%', padding: '8px 10px', fontSize: 12, borderRadius: 6, border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)', resize: 'vertical' }}
              required
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button type="button" className="btn btn-secondary" onClick={() => setShowAddForm(false)} style={{ fontSize: 12, padding: '7px 14px' }}>
              İptal
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving} style={{ fontSize: 12, padding: '7px 18px' }}>
              {saving ? '⏳ Kaydediliyor...' : '💾 Hafızaya Kaydet & Eğit'}
            </button>
          </div>
        </form>
      )}

      {/* Arama ve Filtreler */}
      <div className="card" style={{ padding: '12px 16px', display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <input
            type="text"
            placeholder="🔍 Kişi, konu veya bilgi metninde ara..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: '100%', padding: '7px 12px', fontSize: 12, borderRadius: 6, border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)' }}
          />
        </div>

        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {[
            { key: 'ALL', label: 'Tümü' },
            { key: 'person', label: '👤 Personeller' },
            { key: 'device', label: '💻 Cihazlar' },
            { key: 'rule', label: '📜 Kurallar' },
            { key: 'general', label: '📌 Genel' }
          ].map(f => (
            <button
              key={f.key}
              type="button"
              onClick={() => setCategoryFilter(f.key)}
              style={{
                fontSize: 11,
                fontWeight: categoryFilter === f.key ? 700 : 500,
                padding: '5px 10px',
                borderRadius: 12,
                border: 'none',
                cursor: 'pointer',
                background: categoryFilter === f.key ? 'var(--color-primary)' : 'var(--color-surface-alt)',
                color: categoryFilter === f.key ? '#fff' : 'var(--color-text-secondary)',
                transition: 'all 0.15s'
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Hafıza Kayıtları Tablosu */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-muted)' }}>
            <div className="spinner" style={{ margin: '0 auto 10px auto' }} />
            Hafıza kayıtları yükleniyor...
          </div>
        ) : filteredMemories.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-muted)' }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>🧠</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)' }}>Kayıtlı hafıza bilgisi bulunamadı.</div>
            <div style={{ fontSize: 12, marginTop: 4 }}>
              Yukarıdaki formdan yeni bilgi ekleyebilir veya Bitro ile sohbet ederken <em>"bunu aklında tut"</em> diyerek öğretebilirsiniz.
            </div>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: 'var(--color-surface-alt)', color: 'var(--color-text-secondary)', borderBottom: '1px solid var(--color-border)', textAlign: 'left' }}>
                <th style={{ padding: '10px 14px', width: 140 }}>Kategori</th>
                <th style={{ padding: '10px 14px', width: 160 }}>Hedef / İsim</th>
                <th style={{ padding: '10px 14px' }}>Öğrenilen Bilgi & Mizaç</th>
                <th style={{ padding: '10px 14px', width: 110 }}>Öğreten</th>
                <th style={{ padding: '10px 14px', width: 130 }}>Tarih</th>
                <th style={{ padding: '10px 14px', width: 110, textAlign: 'center' }}>İşlem</th>
              </tr>
            </thead>
            <tbody>
              {filteredMemories.map((m, idx) => (
                <tr
                  key={m.id || idx}
                  style={{
                    borderBottom: '1px solid var(--color-border)',
                    background: idx % 2 === 0 ? 'var(--color-surface)' : 'var(--color-surface-alt)',
                    transition: 'background 0.15s',
                    cursor: 'pointer'
                  }}
                  onClick={() => handleOpenDetail(m)}
                  title="Detayları görmek veya düzenlemek için tıklayın"
                >
                  <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }} onClick={(e) => { e.stopPropagation(); handleOpenDetail(m); }}>
                    {getCategoryBadge(m.category)}
                  </td>
                  <td style={{ padding: '10px 14px', fontWeight: 700, color: 'var(--color-text)', whiteSpace: 'nowrap' }}>
                    {m.target_key || '—'}
                  </td>
                  <td style={{ padding: '10px 14px', color: 'var(--color-text)', lineHeight: 1.4 }}>
                    <div
                      style={{
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        maxHeight: '2.8em',
                        color: 'var(--color-text)',
                      }}
                    >
                      {m.fact_text}
                    </div>
                  </td>
                  <td style={{ padding: '10px 14px', color: 'var(--color-text-secondary)', fontSize: 11, whiteSpace: 'nowrap' }}>
                    <span style={{ padding: '2px 6px', borderRadius: 4, background: 'rgba(255,255,255,0.06)' }}>
                      {m.added_by || 'Sohbet'}
                    </span>
                  </td>
                  <td style={{ padding: '10px 14px', color: 'var(--color-text-muted)', fontSize: 11, whiteSpace: 'nowrap' }}>
                    {m.created_at ? new Date(m.created_at).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' }) : '—'}
                  </td>
                  <td style={{ padding: '10px 14px', textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleOpenDetail(m)}
                        title="Detay & Düzenle"
                        style={{ padding: '3px 8px', fontSize: 11, borderRadius: 4 }}
                      >
                        🔍 Aç
                      </button>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => setConfirmDeleteId(m.id)}
                        title="Hafızadan Sil"
                        style={{ padding: '3px 8px', fontSize: 11, borderRadius: 4 }}
                      >
                        🗑️
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Detay & Düzenleme Modal Pop-up */}
      {selectedMemory && (
        <Modal
          isOpen={true}
          onClose={() => { setSelectedMemory(null); setIsEditing(false); }}
          title={isEditing ? '✏️ Hafıza Kaydını Düzenle' : '🧠 Bitro AI Hafıza Detayı'}
          size="md"
          footer={
            <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
              <div>
                <button
                  type="button"
                  className="btn btn-danger btn-sm"
                  onClick={() => setConfirmDeleteId(selectedMemory.id)}
                  style={{ padding: '6px 12px', fontSize: 12 }}
                >
                  🗑️ Hafızadan Sil
                </button>
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                {isEditing ? (
                  <>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => setIsEditing(false)}
                      style={{ padding: '6px 14px', fontSize: 12 }}
                    >
                      İptal
                    </button>
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={handleUpdateMemory}
                      disabled={editSaving}
                      style={{ padding: '6px 16px', fontSize: 12 }}
                    >
                      {editSaving ? '⏳ Kaydediliyor...' : '💾 Değişiklikleri Kaydet'}
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => setIsEditing(true)}
                      style={{ padding: '6px 14px', fontSize: 12 }}
                    >
                      ✏️ Düzenle
                    </button>
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => setSelectedMemory(null)}
                      style={{ padding: '6px 16px', fontSize: 12 }}
                    >
                      Tamam
                    </button>
                  </>
                )}
              </div>
            </div>
          }
        >
          {isEditing ? (
            <form onSubmit={handleUpdateMemory} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 4 }}>
                    Kategori
                  </label>
                  <select
                    value={editFormData.category}
                    onChange={(e) => setEditFormData({ ...editFormData, category: e.target.value })}
                    style={{ width: '100%', padding: '8px 10px', fontSize: 12, borderRadius: 6, border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)' }}
                  >
                    <option value="person">👤 Personel / Kullanıcı</option>
                    <option value="device">💻 Cihaz / Donanım</option>
                    <option value="rule">📜 Kural / Politika</option>
                    <option value="general">📌 Genel Not</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 4 }}>
                    Hedef Kişi / Cihaz / Konu Adı
                  </label>
                  <input
                    type="text"
                    value={editFormData.target_key}
                    onChange={(e) => setEditFormData({ ...editFormData, target_key: e.target.value })}
                    style={{ width: '100%', padding: '8px 10px', fontSize: 12, borderRadius: 6, border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 4 }}>
                  Öğrenilen Bilgi / Mizaç & Hitap Notu <span style={{ color: 'var(--color-danger)' }}>*</span>
                </label>
                <textarea
                  rows={5}
                  value={editFormData.fact_text}
                  onChange={(e) => setEditFormData({ ...editFormData, fact_text: e.target.value })}
                  style={{ width: '100%', padding: '10px 12px', fontSize: 12, borderRadius: 6, border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)', resize: 'vertical' }}
                  required
                />
              </div>
            </form>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Üst Başlık Bilgisi */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 12, borderBottom: '1px solid var(--color-border)', flexWrap: 'wrap', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {getCategoryBadge(selectedMemory.category)}
                  <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--color-text)' }}>
                    {selectedMemory.target_key || 'Genel Konu'}
                  </span>
                </div>

                <div style={{ fontSize: 11, color: 'var(--color-text-muted)', display: 'flex', gap: 8 }}>
                  <span>Öğreten: <strong>{selectedMemory.added_by || 'Sohbet'}</strong></span>
                  <span>•</span>
                  <span>{selectedMemory.created_at ? new Date(selectedMemory.created_at).toLocaleString('tr-TR') : '—'}</span>
                </div>
              </div>

              {/* Bilgi Metni Kartı */}
              <div style={{ background: 'var(--color-surface-alt)', padding: 16, borderRadius: 8, border: '1px solid var(--color-border)' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>
                  📝 Yapay Zekanın Öğrendiği Bilgi & Mizaç
                </div>
                <div style={{ fontSize: 13, color: 'var(--color-text)', lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                  {selectedMemory.fact_text}
                </div>
              </div>
            </div>
          )}
        </Modal>
      )}

      {/* Silme Onay Modal */}
      {confirmDeleteId && (
        <ConfirmDialog
          title="Hafıza Kaydını Sil"
          message="Bu bilgiyi Bitro AI'ın hafızasından kalıcı olarak silmek istediğinize emin misiniz?"
          confirmText="Evet, Hafızadan Sil"
          cancelText="Vazgeç"
          type="danger"
          onConfirm={() => handleDelete(confirmDeleteId)}
          onCancel={() => setConfirmDeleteId(null)}
        />
      )}
    </div>
  );
}
