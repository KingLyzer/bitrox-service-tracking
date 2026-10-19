import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';

export default function CategorySettings({ showNotification, auditLog }) {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editCategory, setEditCategory] = useState(null);
  const [form, setForm] = useState({ name: '', description: '' });
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const loadCategories = useCallback(async () => {
    setLoading(true);
    try {
      const res = await window.electronAPI.query(
        `SELECT sc.*, COUNT(si.id) AS item_count
         FROM stock_categories sc
         LEFT JOIN stock_items si ON sc.id = si.category_id AND si.is_active = 1
         WHERE sc.is_active = 1
         GROUP BY sc.id
         ORDER BY sc.name ASC`,
        []
      );
      if (res.success && Array.isArray(res.data)) {
        setCategories(res.data);
      }
    } catch (err) {
      console.error('Kategoriler yüklenemedi:', err);
      showNotification?.('Kategoriler yüklenirken hata oluştu.', 'danger');
    } finally {
      setLoading(false);
    }
  }, [showNotification]);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  const handleOpenAdd = () => {
    setEditCategory(null);
    setForm({ name: '', description: '' });
    setShowModal(true);
  };

  const handleOpenEdit = (cat) => {
    setEditCategory(cat);
    setForm({ name: cat.name || '', description: cat.description || '' });
    setShowModal(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      showNotification?.('Kategori adı zorunludur.', 'warning');
      return;
    }

    setSaving(true);
    try {
      if (editCategory) {
        const res = await window.electronAPI.run(
          'UPDATE stock_categories SET name = ?, description = ? WHERE id = ?',
          [form.name.trim(), form.description.trim() || null, editCategory.id]
        );
        if (!res.success) throw new Error(res.message);

        await auditLog?.({
          action: 'UPDATE',
          module: 'stock_categories',
          refId: editCategory.id,
          description: `"${form.name.trim()}" kategorisi güncellendi.`,
        });
        showNotification?.('Kategori güncellendi.', 'success');
      } else {
        const res = await window.electronAPI.run(
          'INSERT INTO stock_categories (name, description, is_active) VALUES (?, ?, 1)',
          [form.name.trim(), form.description.trim() || null]
        );
        if (!res.success) throw new Error(res.message);

        await auditLog?.({
          action: 'CREATE',
          module: 'stock_categories',
          refId: res.insertId,
          description: `"${form.name.trim()}" kategorisi oluşturuldu.`,
        });
        showNotification?.('Yeni kategori eklendi.', 'success');
      }
      setShowModal(false);
      loadCategories();
    } catch (err) {
      showNotification?.('Kaydetme hatası: ' + err.message, 'danger');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const res = await window.electronAPI.run(
        'UPDATE stock_categories SET is_active = 0 WHERE id = ?',
        [deleteTarget.id]
      );
      if (!res.success) throw new Error(res.message);

      await auditLog?.({
        action: 'DELETE',
        module: 'stock_categories',
        refId: deleteTarget.id,
        description: `"${deleteTarget.name}" kategorisi kaldırıldı.`,
      });
      showNotification?.('Kategori kaldırıldı.', 'success');
      setDeleteTarget(null);
      loadCategories();
    } catch (err) {
      showNotification?.('Silme hatası: ' + err.message, 'danger');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, height: '100%' }}>
      {/* Header */}
      <div className="flex-between" style={{ alignItems: 'center' }}>
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 800, color: 'var(--color-text)', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>🏷️ Stok ve Parça Kategorileri</span>
          </h3>
          <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 4, margin: 0 }}>
            Stok ve parça modülünde kullanılan ürün kategorilerini buradan ekleyebilir, düzenleyebilir veya silebilirsiniz.
          </p>
        </div>
        <div className="flex-gap">
          <button className="btn btn-primary btn-sm" onClick={handleOpenAdd}>
            ➕ Yeni Kategori Ekle
          </button>
          <button className="btn btn-secondary btn-sm" onClick={loadCategories} title="Yenile">
            🔄
          </button>
        </div>
      </div>

      {/* Content Table / Cards */}
      {loading ? (
        <div className="flex-center" style={{ height: 200 }}>
          <div className="spinner" />
          <span style={{ marginLeft: 10, color: 'var(--color-text-muted)', fontSize: 13 }}>Kategoriler Yükleniyor...</span>
        </div>
      ) : (
        <div className="card" style={{ flex: 1, overflowY: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--grid-header-bg)', color: 'var(--grid-header-text)', borderBottom: '1px solid var(--color-border)' }}>
                <th style={{ padding: '10px 14px', textAlign: 'left', width: 60 }}>#</th>
                <th style={{ padding: '10px 14px', textAlign: 'left' }}>Kategori Adı</th>
                <th style={{ padding: '10px 14px', textAlign: 'left' }}>Açıklama</th>
                <th style={{ padding: '10px 14px', textAlign: 'center', width: 140 }}>Bağlı Ürün Sayısı</th>
                <th style={{ padding: '10px 14px', textAlign: 'right', width: 130 }}>İşlemler</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((cat, idx) => (
                <tr key={cat.id || idx} style={{ borderBottom: '1px solid var(--color-border)', background: idx % 2 ? 'var(--color-surface-alt)' : 'var(--color-surface)' }}>
                  <td style={{ padding: '10px 14px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>#{idx + 1}</td>
                  <td style={{ padding: '10px 14px', fontWeight: 700, color: 'var(--color-text)' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 14 }}>🏷️</span>
                      {cat.name}
                    </span>
                  </td>
                  <td style={{ padding: '10px 14px', color: 'var(--color-text-secondary)', fontSize: 12 }}>
                    {cat.description || '—'}
                  </td>
                  <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                    <span style={{
                      display: 'inline-block', padding: '2px 10px', borderRadius: 12, fontSize: 11, fontWeight: 700,
                      background: Number(cat.item_count) > 0 ? 'rgba(79, 70, 229, 0.12)' : 'var(--color-surface-alt)',
                      color: Number(cat.item_count) > 0 ? 'var(--color-primary)' : 'var(--color-text-muted)',
                      border: `1px solid ${Number(cat.item_count) > 0 ? 'rgba(79, 70, 229, 0.25)' : 'var(--color-border)'}`
                    }}>
                      {cat.item_count || 0} Ürün
                    </span>
                  </td>
                  <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                      <button className="btn btn-sm btn-secondary" onClick={() => handleOpenEdit(cat)} title="Düzenle">
                        ✏️
                      </button>
                      <button className="btn btn-sm btn-danger" onClick={() => setDeleteTarget(cat)} title="Sil">
                        ❌
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {categories.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ padding: 30, textAlign: 'center', color: 'var(--color-text-muted)' }}>
                    Henüz kayıtlı kategori bulunmuyor.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Add / Edit Modal */}
      {showModal && createPortal(
        <div className="modal-overlay" style={{ zIndex: 1000000 }}>
          <div className="modal-content" style={{ width: 440, maxWidth: '90%', background: 'var(--color-surface)', borderRadius: 8, overflow: 'hidden' }}>
            <div className="modal-header">
              <h3>{editCategory ? 'Kategoriyi Düzenle' : 'Yeni Kategori Ekle'}</h3>
              <button className="btn-close" onClick={() => setShowModal(false)}>×</button>
            </div>
            <form onSubmit={handleSave}>
              <div className="modal-body" style={{ padding: 20 }}>
                <div className="form-group" style={{ marginBottom: 16 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 6, display: 'block' }}>
                    Kategori Adı *
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    value={form.name}
                    onChange={e => setForm({ ...form, name: e.target.value })}
                    placeholder="Örn: Ekran Kartı, Sunucu Parçası..."
                    autoFocus
                    required
                  />
                </div>
                <div className="form-group">
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 6, display: 'block' }}>
                    Açıklama (Opsiyonel)
                  </label>
                  <textarea
                    className="form-control"
                    value={form.description}
                    onChange={e => setForm({ ...form, description: e.target.value })}
                    placeholder="Kategori hakkında detaylı bilgi veya notlar..."
                    rows={3}
                  />
                </div>
              </div>
              <div className="modal-footer" style={{ padding: '12px 20px', background: 'var(--color-surface-alt)', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  İptal
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? '⏳ Kaydediliyor...' : editCategory ? 'Güncelle' : 'Ekle'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Delete Confirmation Dialog */}
      {deleteTarget && createPortal(
        <div className="modal-overlay" style={{ zIndex: 1000000 }}>
          <div className="modal-content" style={{ width: 400, maxWidth: '90%', background: 'var(--color-surface)', borderRadius: 8, overflow: 'hidden' }}>
            <div className="modal-header">
              <h3 style={{ color: 'var(--color-danger)' }}>⚠️ Kategoriyi Sil</h3>
              <button className="btn-close" onClick={() => setDeleteTarget(null)}>×</button>
            </div>
            <div className="modal-body" style={{ padding: 20 }}>
              <p style={{ fontSize: 13, color: 'var(--color-text)', margin: 0 }}>
                <strong>"{deleteTarget.name}"</strong> kategorisini silmek istediğinizden emin misiniz?
              </p>
              {Number(deleteTarget.item_count) > 0 && (
                <div className="alert alert-warning" style={{ marginTop: 12, fontSize: 12 }}>
                  ⚠️ Bu kategoriye bağlı <strong>{deleteTarget.item_count} adet stok ürünü</strong> bulunmaktadır.
                </div>
              )}
            </div>
            <div className="modal-footer" style={{ padding: '12px 20px', background: 'var(--color-surface-alt)', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button className="btn btn-secondary" onClick={() => setDeleteTarget(null)}>
                Vazgeç
              </button>
              <button className="btn btn-danger" onClick={handleDelete}>
                Evet, Sil
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
