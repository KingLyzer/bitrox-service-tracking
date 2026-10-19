import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { AgGridReact } from 'ag-grid-react';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-quartz.css';
import { useAuth } from '../../../context/AuthContext';
import { useApp } from '../../../context/AppContext';
import Modal from '../../common/Modal';
import ConfirmDialog from '../../common/ConfirmDialog';

const MODULE_LIST = [
  { key: 'dashboard',     label: 'Dashboard',             icon: '📊', desc: 'Genel operasyon özeti, sayaçlar ve istatistik paneli' },
  { key: 'service',       label: 'Servis Fişleri',        icon: '🔧', desc: 'Arıza ve servis kaydı oluşturma, durum ve süreç takibi' },
  { key: 'cargo',         label: 'Kargo Takip',           icon: '🚚', desc: 'Gelen ve giden kargo kayıtları, kargo etiketleri ve takip' },
  { key: 'bitlocker',     label: 'BitLocker Vault',       icon: '🔐', desc: 'BitLocker kurtarma anahtarları ve şifre kasası' },
  { key: 'toner',         label: 'Toner Takibi',          icon: '🖨️', desc: 'Toner ve yazıcı sarf malzeme stokları, değişim takibi' },
  { key: 'stock',         label: 'Stok / Parça',          icon: '📦', desc: 'Yedek parça, sarf malzeme ve stok envanter yönetimi' },
  { key: 'maintenance',   label: 'Periyodik Bakım',       icon: '🛡️', desc: 'İşletme ve departman bazlı periyodik bakım takibi' },
  { key: 'inventory',     label: 'Envanter (Demirbaşlar)', icon: '🖥️', desc: 'Snipe-IT entegre demirbaş, zimmet ve donanım envanteri' },
  { key: 'users',         label: 'Kullanıcılar (Personel)', icon: '🧑‍💻', desc: 'Snipe-IT entegre şirket personeli rehberi' },
  { key: 'docs_forms',    label: 'Tutanak & Etiket',      icon: '✍️', desc: 'Zimmet teslim tutanağı ve kargo adres etiketi basımı' },
  { key: 'files',         label: 'Dosyalar',              icon: '📁', desc: 'Dosya yöneticisi, arıza fotoğrafları ve doküman arşivi' },
  { key: 'tasks',         label: 'Kurulum Görevleri',     icon: '📋', desc: 'Saha kurulum, montaj ve görev takibi' },
  { key: 'reports',       label: 'Raporlar',              icon: '📈', desc: 'Performans, arıza ve servis analiz raporları' },
  { key: 'settings',      label: 'Sistem Ayarları',       icon: '⚙️', desc: 'Sistem konfigürasyonu, roller ve yetkilendirme (Admin)' },
];

function getRoleBadgeConfig(roleName, roleId, isSuper) {
  if (isSuper) {
    return {
      bg: 'rgba(245, 158, 11, 0.15)',
      border: 'rgba(245, 158, 11, 0.45)',
      color: '#fbbf24',
      icon: '👑',
      label: 'Süper Yönetici'
    };
  }

  const name = String(roleName || '').toLowerCase().trim();
  const id = Number(roleId);

  if (id === 1 || name.includes('yönetici') || name.includes('admin')) {
    return {
      bg: 'rgba(168, 85, 247, 0.14)',
      border: 'rgba(168, 85, 247, 0.4)',
      color: '#c084fc',
      icon: '👑',
      label: roleName || 'Yönetici'
    };
  }
  if (id === 2 || name.includes('teknik')) {
    return {
      bg: 'rgba(59, 130, 246, 0.14)',
      border: 'rgba(59, 130, 246, 0.4)',
      color: '#60a5fa',
      icon: '🔧',
      label: roleName || 'Teknik Personel'
    };
  }
  if (id === 5 || name.includes('bakım') || name.includes('bakim')) {
    return {
      bg: 'rgba(6, 182, 212, 0.14)',
      border: 'rgba(6, 182, 212, 0.4)',
      color: '#22d3ee',
      icon: '🛡️',
      label: roleName || 'Bakım'
    };
  }
  if (id === 6 || name.includes('stajyer')) {
    return {
      bg: 'rgba(16, 185, 129, 0.14)',
      border: 'rgba(16, 185, 129, 0.4)',
      color: '#34d399',
      icon: '🎓',
      label: roleName || 'BYS Stajyer'
    };
  }
  if (id === 4 || name.includes('snipe')) {
    return {
      bg: 'rgba(14, 165, 233, 0.14)',
      border: 'rgba(14, 165, 233, 0.4)',
      color: '#38bdf8',
      icon: '🖥️',
      label: roleName || 'Snipe İzleyici'
    };
  }
  if (id === 3 || name.includes('görüntüleyici') || name.includes('goruntuleyici') || name.includes('izleyici')) {
    return {
      bg: 'rgba(148, 163, 184, 0.14)',
      border: 'rgba(148, 163, 184, 0.35)',
      color: '#cbd5e1',
      icon: '👁️',
      label: roleName || 'Görüntüleyici'
    };
  }

  return {
    bg: 'rgba(99, 102, 241, 0.14)',
    border: 'rgba(99, 102, 241, 0.35)',
    color: '#a5b4fc',
    icon: '👥',
    label: roleName || 'Kullanıcı'
  };
}

export default function Users() {
  const { user: currentUser, hasPermission } = useAuth();
  const { showNotification, theme, refreshToggle, tableRefreshVersions = {} } = useApp();

  const [activeTab, setActiveTab] = useState('users'); // 'users' | 'permissions'
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [rolePermissions, setRolePermissions] = useState([]);
  const [selectedRoleId, setSelectedRoleId] = useState(2); // Default to Kullanıcı
  const [loading, setLoading] = useState(true);

  // User form modals
  const [showForm, setShowForm] = useState(false);
  const [showPwForm, setShowPwForm] = useState(false);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [editingRole, setEditingRole] = useState(null);
  const [deleteRoleTarget, setDeleteRoleTarget] = useState(null);
  const [editUser, setEditUser] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [purgeTarget, setPurgeTarget] = useState(null);
  const [showInactive, setShowInactive] = useState(false);
  const [locations, setLocations] = useState([]);
  
  const [form, setForm] = useState({ username: '', full_name: '', role_id: 2, email: '', is_active: 1, manager_id: '', allowed_locations: '', new_password: '' });
  const [pwForm, setPwForm] = useState({ oldPassword: '', newPassword: '', confirm: '' });
  const [roleForm, setRoleForm] = useState({ name: '', description: '' });
  const [saving, setSaving] = useState(false);

  // Local permissions state for selected role
  const [permMatrix, setPermMatrix] = useState({});

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [uRes, rRes, rpRes, locRes] = await Promise.all([
        window.electronAPI.getUsers(showInactive),
        window.electronAPI.getRoles().catch(() => ({ success: false })),
        window.electronAPI.getRolePermissions().catch(() => ({ success: false })),
        window.electronAPI.query ? window.electronAPI.query('SELECT DISTINCT location_name as name FROM cached_assets WHERE location_name IS NOT NULL AND location_name != "" ORDER BY location_name ASC').catch(() => null) : Promise.resolve(null),
      ]);
      if (uRes.success) setUsers(uRes.data || []);
      if (locRes?.success && Array.isArray(locRes.data)) {
        setLocations(locRes.data.map(l => l.name).filter(Boolean));
      }
      
      let fetchedRoles = [];
      if (rRes.success && Array.isArray(rRes.data) && rRes.data.length > 0) {
        fetchedRoles = rRes.data;
      } else if (rpRes.success && Array.isArray(rpRes.roles) && rpRes.roles.length > 0) {
        fetchedRoles = rpRes.roles;
      }

      if (fetchedRoles.length === 0) {
        fetchedRoles = [
          { id: 1, name: 'Yönetici', description: 'Tam yetkili sistem yöneticisi' },
          { id: 2, name: 'Kullanıcı', description: 'Standart operasyonel kullanıcı' }
        ];
      }

      setRoles(fetchedRoles);
      if (rpRes.success && Array.isArray(rpRes.permissions)) {
        setRolePermissions(rpRes.permissions);
      }
    } catch (err) {
      console.error('Kullanıcı & yetki verileri yüklenemedi:', err);
    } finally {
      setLoading(false);
    }
  }, [showInactive]);

  const systemUsersRefreshVersion = [
    tableRefreshVersions.users || 0,
    tableRefreshVersions.roles || 0,
    tableRefreshVersions.permissions || 0,
  ].join('|');

  useEffect(() => { loadData(); }, [loadData, refreshToggle, systemUsersRefreshVersion]);

  // Sync permMatrix when selectedRoleId or rolePermissions changes
  useEffect(() => {
    const rolePerms = rolePermissions.filter(p => Number(p.role_id) === Number(selectedRoleId));
    const map = {};
    MODULE_LIST.forEach(m => {
      const matching = rolePerms.filter(rp => rp.module === m.key);
      let p = matching.length > 0 ? matching[matching.length - 1] : null;

      // Geriye dönük uyumluluk: docs_forms kayıtlı değilse address_label veya handover fallback kontrolü
      if (!p && m.key === 'docs_forms') {
        p = rolePerms.find(rp => rp.module === 'address_label' || rp.module === 'handover') || null;
      }

      const isAdminRole = Number(selectedRoleId) === 1;
      map[m.key] = {
        can_view: p ? Boolean(Number(p.can_view)) : isAdminRole,
        can_create: p ? Boolean(Number(p.can_create)) : isAdminRole,
        can_edit: p ? Boolean(Number(p.can_edit)) : isAdminRole,
        can_delete: p ? Boolean(Number(p.can_delete)) : isAdminRole,
        can_admin: p ? Boolean(Number(p.can_admin)) : (isAdminRole && m.key === 'settings'),
      };
    });
    setPermMatrix(map);
  }, [selectedRoleId, rolePermissions]);

  const handleTogglePerm = (moduleKey, field) => {
    if (Number(selectedRoleId) === 1) return; // Admin has full power
    setPermMatrix(prev => ({
      ...prev,
      [moduleKey]: {
        ...prev[moduleKey],
        [field]: !prev[moduleKey]?.[field]
      }
    }));
  };

  const handleSelectAllRolePerms = (enable) => {
    if (Number(selectedRoleId) === 1) return;
    const newMap = {};
    MODULE_LIST.forEach(m => {
      newMap[m.key] = {
        can_view: enable,
        can_create: enable,
        can_edit: enable,
        can_delete: enable,
        can_admin: enable && m.key === 'settings'
      };
    });
    setPermMatrix(newMap);
  };

  const saveRolePermissions = async () => {
    setSaving(true);
    try {
      const payload = [];
      MODULE_LIST.forEach(m => {
        const item = {
          module: m.key,
          can_view: permMatrix[m.key]?.can_view ? 1 : 0,
          can_create: permMatrix[m.key]?.can_create ? 1 : 0,
          can_edit: permMatrix[m.key]?.can_edit ? 1 : 0,
          can_delete: permMatrix[m.key]?.can_delete ? 1 : 0,
          can_admin: permMatrix[m.key]?.can_admin ? 1 : 0,
        };
        payload.push(item);

        // Geriye dönük uyumluluk: docs_forms güncellenirken address_label ve handover da senkronize edilsin
        if (m.key === 'docs_forms') {
          payload.push({ ...item, module: 'address_label' });
          payload.push({ ...item, module: 'handover' });
        }
      });

      const res = await window.electronAPI.saveRolePermissions({
        role_id: selectedRoleId,
        permissions: payload,
        actor: currentUser
      });

      if (res.success) {
        showNotification('Rol yetkileri başarıyla güncellendi.', 'success');
        setRolePermissions(prev => {
          const filtered = prev.filter(p => Number(p.role_id) !== Number(selectedRoleId));
          const newItems = payload.map(p => ({ role_id: selectedRoleId, ...p }));
          return [...filtered, ...newItems];
        });
        window.dispatchEvent(new Event('permissionsUpdated'));
        await loadData();
      } else {
        showNotification('Yetkiler kaydedilemedi: ' + (res.message || ''), 'danger');
      }
    } catch (e) {
      showNotification('Hata: ' + e.message, 'danger');
    } finally {
      setSaving(false);
    }
  };

  const handleOpenEditRole = (role) => {
    if (!role) return;
    setEditingRole(role);
    setRoleForm({
      name: role.name || '',
      description: role.description || ''
    });
    setShowRoleModal(true);
  };

  const handleOpenCreateRole = () => {
    setEditingRole(null);
    setRoleForm({ name: '', description: '' });
    setShowRoleModal(true);
  };

  const saveRole = async () => {
    if (!roleForm.name?.trim()) return showNotification('Lütfen rol adı girin', 'warning');
    setSaving(true);
    try {
      const payload = {
        id: editingRole ? editingRole.id : undefined,
        name: roleForm.name.trim(),
        description: roleForm.description?.trim() || ''
      };
      const res = await window.electronAPI.saveRole(payload);
      if (res.success) {
        showNotification(editingRole ? 'Rol başarıyla güncellendi.' : 'Yeni rol eklendi.', 'success');
        setShowRoleModal(false);
        setEditingRole(null);
        setRoleForm({ name: '', description: '' });
        await loadData();
        if (res.id) setSelectedRoleId(Number(res.id));
      } else {
        showNotification('Rol kaydedilemedi: ' + (res.message || ''), 'danger');
      }
    } catch (e) {
      showNotification('Hata: ' + e.message, 'danger');
    } finally {
      setSaving(false);
    }
  };

  const confirmDeleteRole = async () => {
    if (!deleteRoleTarget) return;
    if (Number(deleteRoleTarget.id) === 1) {
      showNotification('Yönetici rolü silinemez.', 'warning');
      setDeleteRoleTarget(null);
      return;
    }
    setSaving(true);
    try {
      const res = await window.electronAPI.deleteRole(deleteRoleTarget.id, currentUser);
      if (res.success) {
        showNotification(`"${deleteRoleTarget.name}" rolü başarıyla silindi.`, 'success');
        setDeleteRoleTarget(null);
        setSelectedRoleId(1);
        await loadData();
      } else {
        showNotification('Rol silinemedi: ' + (res.message || ''), 'danger');
      }
    } catch (e) {
      showNotification('Hata: ' + e.message, 'danger');
    } finally {
      setSaving(false);
    }
  };

  // Drag & Drop handlers for role reordering
  const [draggedRoleIndex, setDraggedRoleIndex] = useState(null);
  const [dragOverRoleIndex, setDragOverRoleIndex] = useState(null);

  const handleDragStart = (e, index) => {
    setDraggedRoleIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(index));
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverRoleIndex !== index) {
      setDragOverRoleIndex(index);
    }
  };

  const handleDrop = async (e, targetIndex) => {
    e.preventDefault();
    setDragOverRoleIndex(null);
    if (draggedRoleIndex === null || draggedRoleIndex === targetIndex) {
      setDraggedRoleIndex(null);
      return;
    }

    const reordered = [...roles];
    const [movedItem] = reordered.splice(draggedRoleIndex, 1);
    reordered.splice(targetIndex, 0, movedItem);

    setRoles(reordered);
    setDraggedRoleIndex(null);

    try {
      const res = await window.electronAPI.reorderRoles(reordered.map(r => r.id), currentUser);
      if (res?.success) {
        showNotification('Rol sıralaması güncellendi.', 'success');
      } else {
        showNotification('Sıralama kaydedilemedi: ' + (res?.message || ''), 'warning');
      }
    } catch (err) {
      showNotification('Sıralama hatası: ' + err.message, 'danger');
    }
  };

  const handleDragEnd = () => {
    setDraggedRoleIndex(null);
    setDragOverRoleIndex(null);
  };

  const columnDefs = useMemo(() => [
    {
      field: 'username',
      headerName: 'Kullanıcı Adı',
      width: 145,
      cellRenderer: params => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, color: 'var(--color-primary-light, #60a5fa)', height: '100%' }}>
          <span style={{ opacity: 0.55, fontSize: 12 }}>@</span>
          <span>{params.value}</span>
        </div>
      )
    },
    {
      field: 'full_name',
      headerName: 'Ad Soyad',
      flex: 1,
      minWidth: 160,
      cellRenderer: params => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontWeight: 600, color: 'var(--color-text, #f8fafc)', height: '100%' }}>
          <span style={{ fontSize: 13, opacity: 0.7 }}>👤</span>
          <span>{params.value}</span>
        </div>
      )
    },
    {
      field: 'role_name',
      headerName: 'Rol',
      width: 165,
      cellRenderer: params => {
        const isTargetSuper = Number(params.data.is_superadmin) === 1 || params.data.username === 'admin' || Number(params.data.id) === 1;
        const isActorSuper = Boolean(currentUser?.is_superadmin || currentUser?.username === 'admin' || Number(currentUser?.id) === 1);
        const showSuper = isTargetSuper && isActorSuper;
        const cfg = getRoleBadgeConfig(params.value, params.data.role_id, showSuper);

        return (
          <div style={{ display: 'flex', alignItems: 'center', height: '100%' }}>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '3px 9px',
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 600,
              letterSpacing: '0.2px',
              background: cfg.bg,
              border: `1px solid ${cfg.border}`,
              color: cfg.color,
              lineHeight: 1.3,
              boxShadow: '0 1px 3px rgba(0,0,0,0.06)'
            }}>
              <span style={{ fontSize: 13, lineHeight: 1 }}>{cfg.icon}</span>
              <span>{cfg.label}</span>
            </span>
          </div>
        );
      }
    },
    {
      field: 'manager_name',
      headerName: 'Bağlı Olduğu Yönetici',
      width: 185,
      cellRenderer: params => {
        if (!params.value) return <span style={{ color: 'var(--color-text-muted)', opacity: 0.55, fontSize: 12 }}>— (Üst Yönetici)</span>;
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, height: '100%' }}>
            <span style={{ fontSize: 13 }}>👔</span>
            <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>{params.value}</span>
          </div>
        );
      }
    },
    {
      field: 'allowed_locations',
      headerName: 'Envanter Lokasyon İzni',
      width: 180,
      cellRenderer: params => {
        if (!params.value) {
          return (
            <div style={{ display: 'flex', alignItems: 'center', height: '100%' }}>
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '3px 8px',
                borderRadius: 6,
                fontSize: 11.5,
                fontWeight: 500,
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid var(--color-border)',
                color: 'var(--color-text-secondary)',
              }}>
                <span>🌐</span>
                <span>Tüm Lokasyonlar</span>
              </span>
            </div>
          );
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', height: '100%' }}>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              padding: '3px 8px',
              borderRadius: 6,
              fontSize: 11.5,
              fontWeight: 600,
              background: 'rgba(245, 158, 11, 0.1)',
              border: '1px solid rgba(245, 158, 11, 0.3)',
              color: '#fbbf24',
            }}>
              <span>🏢</span>
              <span>{params.value}</span>
            </span>
          </div>
        );
      }
    },
    {
      field: 'email',
      headerName: 'E-posta',
      width: 190,
      cellRenderer: params => (
        <span style={{ color: params.value ? 'var(--color-text)' : 'var(--color-text-muted)', fontSize: 12 }}>
          {params.value || '—'}
        </span>
      )
    },
    {
      field: 'last_login',
      headerName: 'Son Giriş',
      width: 150,
      valueFormatter: params => params.value ? params.value.slice(0, 16).replace('T', ' ') : '—'
    },
    {
      field: 'is_active',
      headerName: 'Durum',
      width: 105, 
      cellRenderer: params => {
        const active = Boolean(Number(params.value));
        return (
          <div style={{ display: 'flex', alignItems: 'center', height: '100%' }}>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              padding: '3px 8px',
              borderRadius: 6,
              fontSize: 11.5,
              fontWeight: 600,
              background: active ? 'rgba(34, 197, 94, 0.12)' : 'rgba(239, 68, 68, 0.12)',
              border: `1px solid ${active ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
              color: active ? '#4ade80' : '#f87171',
            }}>
              <span style={{ fontSize: 9, lineHeight: 1 }}>{active ? '●' : '○'}</span>
              <span>{active ? 'Aktif' : 'Pasif'}</span>
            </span>
          </div>
        );
      }
    },
    {
      headerName: 'İşlemler',
      width: 140,
      pinned: 'right',
      cellRenderer: params => {
        const isTargetSuper = Number(params.data.is_superadmin) === 1 || params.data.username === 'admin' || Number(params.data.id) === 1;
        const isActorSuper = Boolean(currentUser?.is_superadmin || currentUser?.username === 'admin' || Number(currentUser?.id) === 1);

        if (isTargetSuper && !isActorSuper) {
          return (
            <div style={{ display: 'flex', alignItems: 'center', height: '100%' }}>
              <span style={{
                fontSize: 11,
                padding: '3px 8px',
                borderRadius: 6,
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid var(--color-border)',
                color: 'var(--color-text-muted)',
              }} title="Bu yönetici hesabı sistem koruması altındadır, düzenlenemez.">
                🔒 Korumalı
              </span>
            </div>
          );
        }

        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, height: '100%' }}>
            <button
              type="button"
              className="btn-icon"
              title="Yetkilerini İncele"
              onClick={() => { setSelectedRoleId(Number(params.data.role_id)); setActiveTab('permissions'); }}
              style={{
                padding: '4px 7px',
                fontSize: 12,
                borderRadius: 6,
                background: 'rgba(59, 130, 246, 0.1)',
                border: '1px solid rgba(59, 130, 246, 0.25)',
                color: '#60a5fa',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              🔑
            </button>
            <button
              type="button"
              className="btn-icon"
              title="Kullanıcıyı Düzenle"
              onClick={() => { 
                setEditUser(params.data); 
                setForm({
                  username: params.data.username || '',
                  full_name: params.data.full_name || '',
                  role_id: Number(params.data.role_id) || 2,
                  email: params.data.email || '',
                  is_active: Number(params.data.is_active) ?? 1,
                  manager_id: params.data.manager_id ? String(params.data.manager_id) : '',
                  allowed_locations: params.data.allowed_locations || '',
                  is_superadmin: Number(params.data.is_superadmin) || 0,
                  new_password: ''
                }); 
                setShowForm(true); 
              }}
              style={{
                padding: '4px 7px',
                fontSize: 12,
                borderRadius: 6,
                background: 'rgba(245, 158, 11, 0.1)',
                border: '1px solid rgba(245, 158, 11, 0.25)',
                color: '#fbbf24',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              ✏️
            </button>
            {Number(params.data.is_active) ? (
              <button
                type="button"
                className="btn-icon"
                title="Kullanıcıyı Pasif Yap"
                onClick={() => setDeleteTarget(params.data)}
                style={{
                  padding: '4px 7px',
                  fontSize: 12,
                  borderRadius: 6,
                  background: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.25)',
                  color: '#f87171',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                🚫
              </button>
            ) : (
              <button
                type="button"
                className="btn-icon"
                title="Kalıcı Sil"
                onClick={() => setPurgeTarget(params.data)}
                style={{
                  padding: '4px 7px',
                  fontSize: 12,
                  borderRadius: 6,
                  background: 'rgba(239, 68, 68, 0.18)',
                  border: '1px solid rgba(239, 68, 68, 0.4)',
                  color: '#ef4444',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                🗑️
              </button>
            )}
          </div>
        );
      }
    }
  ], [currentUser]);

  const saveUser = async () => {
    if (!form.username?.trim()) return showNotification('Lütfen Kullanıcı Adı giriniz.', 'warning');
    if (!form.full_name?.trim()) return showNotification('Lütfen Ad Soyad giriniz.', 'warning');
    if (!editUser && !form.new_password?.trim()) return showNotification('Yeni kullanıcı için şifre zorunludur.', 'warning');
    if (!editUser && form.new_password.length < 4) return showNotification('Şifre en az 4 karakter olmalıdır.', 'warning');
    
    if (editUser?.id === currentUser.id && Number(form.is_active) === 0) {
      return showNotification('Kendi kullanıcınızı pasif yapamazsınız.', 'warning');
    }

    setSaving(true);
    try {
      const userPayload = {
        id: editUser ? editUser.id : null,
        username: form.username,
        full_name: form.full_name,
        role_id: form.role_id,
        email: form.email || null,
        is_active: form.is_active,
        manager_id: form.manager_id ? Number(form.manager_id) : null,
        allowed_locations: form.allowed_locations ? String(form.allowed_locations).trim() : null,
        is_superadmin: Number(form.is_superadmin) || 0,
        new_password: form.new_password,
        actor: currentUser,
      };
      const res = await window.electronAPI.saveUser(userPayload);
      if (res?.success) {
        setShowForm(false);
        showNotification(`Kullanıcı ${editUser ? 'güncellendi' : 'oluşturuldu'}.`, 'success');
        window.dispatchEvent(new Event('permissionsUpdated'));
        loadData();
      } else {
        showNotification('Kaydetme hatası: ' + (res?.message || 'Bilinmeyen hata'), 'danger');
      }
    } catch (err) {
      showNotification('Beklenmedik hata: ' + err.message, 'danger');
    } finally {
      setSaving(false);
    }
  };

  const changePw = async () => {
    if (!pwForm.newPassword?.trim()) return showNotification('Yeni şifre boş olamaz.', 'warning');
    if (pwForm.newPassword.length < 4) return showNotification('Şifre en az 4 karakter olmalıdır.', 'warning');
    if (pwForm.newPassword !== pwForm.confirm) return showNotification('Şifreler eşleşmiyor.', 'danger');
    try {
      const res = await window.electronAPI.changePassword({ userId: currentUser.id, oldPassword: pwForm.oldPassword, newPassword: pwForm.newPassword, actor: currentUser });
      if (res.success) {
        setShowPwForm(false);
        setPwForm({ oldPassword: '', newPassword: '', confirm: '' });
        showNotification('Şifre başarıyla değiştirildi.', 'success');
      } else {
        showNotification(res.message || 'Şifre değiştirilemedi.', 'danger');
      }
    } catch (err) {
      showNotification('Beklenmedik hata: ' + err.message, 'danger');
    }
  };

  if (!hasPermission('settings', 'can_admin')) {
    return (
      <div className="flex-center flex-column" style={{ height: '100%', gap: 20 }}>
        <div style={{ fontSize: 48 }}>🔒</div>
        <div style={{ color: 'var(--color-text-secondary)', fontSize: 14 }}>Bu modüle erişim yetkiniz yok.</div>
        <button className="btn btn-secondary" onClick={() => setShowPwForm(true)}>🔑 Şifremi Değiştir</button>
      </div>
    );
  }

  const selectedRole = roles.find(r => Number(r.id) === Number(selectedRoleId));

  return (
    <div className="module-container" style={{ padding: 0 }}>
      {/* Tab Navigasyon */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '14px 24px',
        borderBottom: '1px solid var(--color-border)',
        background: 'var(--color-surface)',
        gap: 12,
        flexWrap: 'wrap'
      }}>
        <div style={{
          display: 'flex',
          background: 'var(--color-bg-dark, #0f172a)',
          padding: 4,
          borderRadius: 10,
          border: '1px solid var(--color-border)',
          gap: 4
        }}>
          <button
            type="button"
            onClick={() => setActiveTab('users')}
            style={{
              padding: '7px 16px',
              borderRadius: 7,
              border: 'none',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: activeTab === 'users' ? 700 : 500,
              background: activeTab === 'users' ? 'var(--color-primary)' : 'transparent',
              color: activeTab === 'users' ? '#ffffff' : 'var(--color-text-secondary)',
              boxShadow: activeTab === 'users' ? '0 2px 8px rgba(0,0,0,0.25)' : 'none',
              transition: 'all 0.18s ease',
              display: 'flex',
              alignItems: 'center',
              gap: 7
            }}
          >
            <span>👥</span>
            <span>Kullanıcı Listesi</span>
            <span style={{
              fontSize: 11,
              padding: '1px 6px',
              borderRadius: 6,
              background: activeTab === 'users' ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.08)',
              color: '#ffffff'
            }}>
              {users.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('permissions')}
            style={{
              padding: '7px 16px',
              borderRadius: 7,
              border: 'none',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: activeTab === 'permissions' ? 700 : 500,
              background: activeTab === 'permissions' ? 'var(--color-primary)' : 'transparent',
              color: activeTab === 'permissions' ? '#ffffff' : 'var(--color-text-secondary)',
              boxShadow: activeTab === 'permissions' ? '0 2px 8px rgba(0,0,0,0.25)' : 'none',
              transition: 'all 0.18s ease',
              display: 'flex',
              alignItems: 'center',
              gap: 7
            }}
          >
            <span>🛡️</span>
            <span>Rol ve Modül Yetkileri</span>
          </button>
        </div>

        {activeTab === 'users' ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <label style={{
              display: 'flex',
              alignItems: 'center',
              gap: 7,
              fontSize: 12.5,
              color: 'var(--color-text-secondary)',
              cursor: 'pointer',
              userSelect: 'none',
              marginRight: 6
            }}>
              <input
                type="checkbox"
                checked={showInactive}
                onChange={e => setShowInactive(e.target.checked)}
                style={{ width: 16, height: 16, cursor: 'pointer', accentColor: 'var(--color-primary)' }}
              />
              <span>Pasif kullanıcılar</span>
            </label>
            <button
              className="btn btn-primary"
              onClick={() => {
                setEditUser(null);
                setForm({ username: '', full_name: '', role_id: 2, email: '', is_active: 1, manager_id: '', allowed_locations: '', is_superadmin: 0, new_password: '' });
                setShowForm(true);
              }}
              style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, padding: '7px 14px', borderRadius: 8 }}
            >
              <span>➕</span>
              <span>Yeni Kullanıcı</span>
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => setShowPwForm(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 8, fontSize: 12.5 }}
            >
              <span>🔑</span>
              <span>Şifre Değiştir</span>
            </button>
            <button
              className="btn btn-secondary btn-sm"
              onClick={loadData}
              title="Listeyi Yenile"
              style={{ padding: '7px 10px', borderRadius: 8 }}
            >
              🔄
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button className="btn btn-secondary" onClick={handleOpenCreateRole} style={{ borderRadius: 8, padding: '7px 14px' }}>
              ➕ Yeni Rol Ekle
            </button>
            <button
              className="btn btn-success"
              onClick={saveRolePermissions}
              disabled={saving || Number(selectedRoleId) === 1}
              style={{ borderRadius: 8, padding: '7px 16px', fontWeight: 700 }}
            >
              {saving ? '⏳ Kaydediliyor...' : '💾 Yetkileri Kaydet'}
            </button>
          </div>
        )}
      </div>

      {/* TABS CONTENT */}
      {activeTab === 'users' ? (
        <div style={{ flex: 1, padding: 24, display: 'flex', flexDirection: 'column' }}>
          {loading ? (
            <div className="flex-center" style={{ flex: 1 }}><div className="spinner" /></div>
          ) : (
            <div
              className={theme === 'light' || theme === 'sakura' ? 'ag-theme-quartz' : 'ag-theme-quartz-dark'}
              style={{ flex: 1, width: '100%', minHeight: 400, border: '1px solid var(--color-border)', borderRadius: 6 }}
            >
              <AgGridReact
                theme="legacy"
                rowData={users || []}
                columnDefs={columnDefs}
                defaultColDef={{ resizable: true, sortable: true, filter: true }}
                rowHeight={40}
                headerHeight={42}
                suppressDragLeaveHidesColumns={true}
                pagination
                paginationPageSize={50}
                noRowsOverlayComponent={() => <span>Kullanıcı bulunamadı.</span>}
              />
            </div>
          )}
        </div>
      ) : (
        /* ROL VE YETKİ MATRİSİ TABI */
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          {/* Sol Rol Seçim Menüsü */}
          <div style={{
            width: 320,
            minWidth: 300,
            borderRight: '1px solid var(--color-border)',
            background: 'var(--color-bg-dark)',
            padding: '16px 12px',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            overflowY: 'auto'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4, padding: '0 4px' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                Kullanıcı Rolleri
              </div>
              <button 
                type="button"
                className="btn btn-xs btn-secondary" 
                onClick={handleOpenCreateRole}
                title="Yeni Rol Ekle"
                style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6 }}
              >
                ➕ Ekle
              </button>
            </div>

            {roles.map((r, index) => {
              const isSel = Number(r.id) === Number(selectedRoleId);
              const userCount = users.filter(u => Number(u.role_id) === Number(r.id)).length;
              const isDefaultAdmin = Number(r.id) === 1;
              const isDragging = draggedRoleIndex === index;
              const isDragOver = dragOverRoleIndex === index;

              return (
                <div
                  key={r.id}
                  draggable={true}
                  onDragStart={(e) => handleDragStart(e, index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDrop={(e) => handleDrop(e, index)}
                  onDragEnd={handleDragEnd}
                  onClick={() => setSelectedRoleId(Number(r.id))}
                  title={`${r.name} (${userCount} kullanıcı)\nSırasını değiştirmek için sürükleyip bırakabilirsiniz`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: 8,
                    border: isDragOver
                      ? '1px dashed var(--color-primary)'
                      : '1px solid ' + (isSel ? 'var(--color-primary)' : 'var(--color-border)'),
                    background: isDragOver
                      ? 'var(--color-primary-bg)'
                      : isSel ? 'var(--color-surface)' : 'transparent',
                    color: isSel ? 'var(--color-primary-light)' : 'var(--color-text)',
                    fontWeight: isSel ? 700 : 500,
                    fontSize: 13,
                    cursor: 'grab',
                    transition: 'all 0.15s',
                    gap: 8,
                    opacity: isDragging ? 0.4 : 1,
                    transform: isDragging ? 'scale(0.98)' : 'none',
                    boxShadow: isSel ? '0 2px 8px rgba(0,0,0,0.12)' : 'none'
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
                    <span style={{ cursor: 'grab', opacity: 0.35, fontSize: 14, userSelect: 'none', lineHeight: 1 }} title="Sürükle">
                      ⋮⋮
                    </span>
                    <span style={{ flexShrink: 0, fontSize: 15 }}>{isDefaultAdmin ? '👑' : '👥'}</span>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }} title={r.name}>
                      {r.name}
                    </span>
                  </span>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                    {!isDefaultAdmin && (
                      <>
                        <button
                          type="button"
                          className="btn-icon"
                          title="Rolü Düzenle"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenEditRole(r);
                          }}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '3px 5px', fontSize: 12, opacity: isSel ? 0.9 : 0.6 }}
                        >
                          ✏️
                        </button>
                        <button
                          type="button"
                          className="btn-icon"
                          title="Rolü Sil"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteRoleTarget(r);
                          }}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '3px 5px', fontSize: 12, opacity: isSel ? 0.9 : 0.6 }}
                        >
                          🗑️
                        </button>
                      </>
                    )}
                    <span className="badge" style={{ fontSize: 11, padding: '2px 7px', borderRadius: 6, background: 'var(--color-surface-alt)', minWidth: 20, textAlign: 'center' }}>
                      {userCount}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Sağ Modül İzinler Matrisi */}
          <div style={{ flex: 1, padding: 24, overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, pb: 12, borderBottom: '1px solid var(--color-border)' }}>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-text)', margin: 0 }}>
                  {selectedRole?.name || 'Seçili Rol'} — Modül Erişim Yetkileri
                </h3>
                <p style={{ fontSize: 12, color: 'var(--color-text-muted)', margin: '4px 0 0 0' }}>
                  {selectedRole?.description || 'Bu role sahip kullanıcıların erişebileceği modülleri seçin.'}
                </p>
              </div>

              {Number(selectedRoleId) !== 1 && (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <button 
                    className="btn btn-secondary btn-sm" 
                    onClick={() => selectedRole && handleOpenEditRole(selectedRole)}
                    title="Seçili Rolü Düzenle"
                  >
                    ✏️ Rolü Düzenle
                  </button>
                  <button 
                    className="btn btn-danger btn-sm" 
                    onClick={() => selectedRole && setDeleteRoleTarget(selectedRole)}
                    title="Seçili Rolü Sil"
                  >
                    🗑️ Rolü Sil
                  </button>
                  <span style={{ width: 1, height: 18, background: 'var(--color-border)', margin: '0 2px' }} />
                  <button className="btn btn-secondary btn-sm" onClick={() => handleSelectAllRolePerms(true)}>✓ Tümünü Seç</button>
                  <button className="btn btn-secondary btn-sm" onClick={() => handleSelectAllRolePerms(false)}>✕ Tümünü Kaldır</button>
                </div>
              )}
            </div>

            {Number(selectedRoleId) === 1 ? (
              <div className="alert alert-info" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 16, fontSize: 13 }}>
                <span style={{ fontSize: 24 }}>👑</span>
                <div>
                  <strong>Yönetici (Admin) Rolü Tam Yetkilidir</strong>
                  <div style={{ fontSize: 12, marginTop: 2, opacity: 0.8 }}>Yönetici rolüne sahip kullanıcılar tüm sistem modüllerine tam erişim hakkına sahiptir, kısıtlanamaz.</div>
                </div>
              </div>
            ) : (
              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: 'var(--grid-header-bg)', color: 'var(--grid-header-text)', borderBottom: '1px solid var(--color-border)' }}>
                      <th style={{ padding: '12px 16px', textAlign: 'left' }}>Modül Adı</th>
                      <th style={{ padding: '12px 16px', textAlign: 'center', width: 140 }}>👁️ Görüntüleme</th>
                      <th style={{ padding: '12px 16px', textAlign: 'center', width: 140 }}>➕ Ekleme</th>
                      <th style={{ padding: '12px 16px', textAlign: 'center', width: 140 }}>✏️ Düzenleme</th>
                      <th style={{ padding: '12px 16px', textAlign: 'center', width: 140 }}>🗑️ Silme</th>
                    </tr>
                  </thead>
                  <tbody>
                    {MODULE_LIST.map((m, idx) => {
                      const p = permMatrix[m.key] || { can_view: false, can_create: false, can_edit: false, can_delete: false };
                      return (
                        <tr key={m.key} style={{ borderBottom: '1px solid var(--color-border)', background: idx % 2 ? 'var(--color-surface-alt)' : 'var(--color-surface)' }}>
                          <td style={{ padding: '12px 16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <span style={{ fontSize: 18 }}>{m.icon}</span>
                              <div>
                                <div style={{ fontWeight: 600, color: 'var(--color-text)' }}>{m.label}</div>
                                <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{m.desc}</div>
                              </div>
                            </div>
                          </td>
                          <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                            <input
                              type="checkbox"
                              checked={p.can_view}
                              onChange={() => handleTogglePerm(m.key, 'can_view')}
                              style={{ width: 18, height: 18, cursor: 'pointer' }}
                            />
                          </td>
                          <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                            <input
                              type="checkbox"
                              checked={p.can_create}
                              onChange={() => handleTogglePerm(m.key, 'can_create')}
                              disabled={!p.can_view}
                              style={{ width: 18, height: 18, cursor: 'pointer' }}
                            />
                          </td>
                          <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                            <input
                              type="checkbox"
                              checked={p.can_edit}
                              onChange={() => handleTogglePerm(m.key, 'can_edit')}
                              disabled={!p.can_view}
                              style={{ width: 18, height: 18, cursor: 'pointer' }}
                            />
                          </td>
                          <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                            <input
                              type="checkbox"
                              checked={p.can_delete}
                              onChange={() => handleTogglePerm(m.key, 'can_delete')}
                              disabled={!p.can_view}
                              style={{ width: 18, height: 18, cursor: 'pointer' }}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* KULLANICI EKLE / DÜZENLE MODALI */}
      {showForm && (
        <Modal isOpen title={editUser ? 'Kullanıcı Düzenle' : 'Yeni Kullanıcı'} size="md" onClose={() => setShowForm(false)}>
          <div className="form-grid-2" style={{ padding: 15 }}>
            <div className="form-group">
              <label className="required" style={{ color: 'var(--color-text)', fontWeight: 600 }}>Kullanıcı Adı</label>
              <input 
                type="text"
                className="form-control"
                value={form.username || ''} 
                onChange={e => setForm({...form, username: e.target.value})} 
                autoComplete="off" 
                style={{ background: 'var(--color-surface)', color: 'var(--color-text)', border: '1px solid var(--color-border)' }}
              />
            </div>
            <div className="form-group">
              <label className="required" style={{ color: 'var(--color-text)', fontWeight: 600 }}>Ad Soyad</label>
              <input 
                type="text"
                className="form-control"
                value={form.full_name || ''} 
                onChange={e => setForm({...form, full_name: e.target.value})} 
                style={{ background: 'var(--color-surface)', color: 'var(--color-text)', border: '1px solid var(--color-border)' }}
              />
            </div>
            <div className="form-group">
              <label style={{ color: 'var(--color-text)', fontWeight: 600 }}>Rol</label>
              <select 
                className="form-control"
                value={form.role_id ? String(form.role_id) : '2'} 
                onChange={e => setForm({...form, role_id: parseInt(e.target.value, 10)})}
                style={{ background: 'var(--color-surface)', color: 'var(--color-text)', border: '1px solid var(--color-border)' }}
              >
                {roles.map(r => (
                  <option key={r.id} value={String(r.id)} style={{ background: 'var(--color-surface)', color: 'var(--color-text)' }}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label style={{ color: 'var(--color-text)', fontWeight: 600 }}>Durum</label>
              <select 
                className="form-control"
                value={String(form.is_active ?? 1)} 
                onChange={e => setForm({...form, is_active: parseInt(e.target.value, 10)})}
                style={{ background: 'var(--color-surface)', color: 'var(--color-text)', border: '1px solid var(--color-border)' }}
              >
                <option value="1" style={{ background: 'var(--color-surface)', color: 'var(--color-text)' }}>Aktif</option>
                <option value="0" style={{ background: 'var(--color-surface)', color: 'var(--color-text)' }}>Pasif</option>
              </select>
            </div>
            <div className="form-group form-col-span-2">
              <label style={{ color: 'var(--color-text)', fontWeight: 600 }}>E-posta</label>
              <input 
                type="email" 
                className="form-control"
                value={form.email || ''} 
                onChange={e => setForm({...form, email: e.target.value})} 
                style={{ background: 'var(--color-surface)', color: 'var(--color-text)', border: '1px solid var(--color-border)' }}
              />
            </div>
            <div className="form-group form-col-span-2">
              <label style={{ color: 'var(--color-text)', fontWeight: 600 }}>Bağlı Olduğu Yönetici</label>
              <select 
                className="form-control"
                value={form.manager_id || ''} 
                onChange={e => setForm({...form, manager_id: e.target.value})}
                style={{ background: 'var(--color-surface)', color: 'var(--color-text)', border: '1px solid var(--color-border)' }}
              >
                <option value="" style={{ background: 'var(--color-surface)', color: 'var(--color-text)' }}>
                  — Yönetici Yok (En Üst Yetkili) —
                </option>
                {users
                  .filter(u => !editUser || u.id !== editUser.id)
                  .filter(u => Number(u.is_active) === 1)
                  .map(u => (
                    <option key={u.id} value={String(u.id)} style={{ background: 'var(--color-surface)', color: 'var(--color-text)' }}>
                      {u.full_name || u.username} ({u.role_name || 'Kullanıcı'})
                    </option>
                  ))}
              </select>
            </div>
            <div className="form-group form-col-span-2">
              <label style={{ color: 'var(--color-text)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>🏢 Envanter Lokasyon İzni (Kısıtlama)</span>
                <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--color-text-muted)' }}>
                  (Kullanıcının Envanter modülünde görebileceği lokasyon)
                </span>
              </label>
              <select 
                className="form-control"
                value={form.allowed_locations || ''} 
                onChange={e => setForm({...form, allowed_locations: e.target.value})}
                style={{ background: 'var(--color-surface)', color: 'var(--color-text)', border: '1px solid var(--color-border)' }}
              >
                <option value="" style={{ background: 'var(--color-surface)', color: 'var(--color-text)' }}>
                  🌐 Tüm Lokasyonlar (Kısıtlama Yok — Varsayılan)
                </option>
                {locations.map(loc => (
                  <option key={loc} value={loc} style={{ background: 'var(--color-surface)', color: 'var(--color-text)' }}>
                    🏢 Sadece {loc} Lokasyonu
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group form-col-span-2">
              <label className={!editUser ? 'required' : ''} style={{ color: 'var(--color-text)', fontWeight: 600 }}>
                {editUser ? 'Yeni Şifre (Değiştirmek istemiyorsanız boş bırakın)' : 'Şifre'}
              </label>
              <input 
                type="password" 
                className="form-control"
                value={form.new_password || ''} 
                onChange={e => setForm({...form, new_password: e.target.value})} 
                autoComplete="new-password" 
                style={{ background: 'var(--color-surface)', color: 'var(--color-text)', border: '1px solid var(--color-border)' }}
              />
            </div>
            {Boolean(currentUser?.is_superadmin || currentUser?.username === 'admin' || Number(currentUser?.id) === 1) && (
              <div className="form-group form-col-span-2" style={{ background: 'rgba(245, 158, 11, 0.08)', padding: '12px 14px', borderRadius: 8, border: '1px dashed rgba(245, 158, 11, 0.4)', marginTop: 4 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', margin: 0, color: 'var(--color-text)', fontWeight: 700 }}>
                  <input
                    type="checkbox"
                    checked={Number(form.is_superadmin) === 1}
                    disabled={editUser && (editUser.username === 'admin' || Number(editUser.id) === 1)}
                    onChange={e => setForm({ ...form, is_superadmin: e.target.checked ? 1 : 0 })}
                    style={{ width: 18, height: 18, accentColor: '#f59e0b', cursor: 'pointer' }}
                  />
                  <span>👑 Süper Yönetici Yetkisi Ver (is_superadmin)</span>
                </label>
                <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4, marginLeft: 28 }}>
                  Süper Yöneticiler gizli API anahtarlarını görebilir ve diğer yöneticiler tarafından düzenlenemez. Normal yöneticiler bu yetkiyi standart "Yönetici" olarak görür.
                </div>
              </div>
            )}
          </div>
          <div className="flex-gap" style={{ justifyContent: 'flex-end', padding: '0 15px 15px' }}>
            <button className="btn btn-secondary" onClick={() => setShowForm(false)}>İptal</button>
            <button className="btn btn-primary" onClick={saveUser} disabled={saving}>
              {saving ? '⏳ Kaydediliyor...' : '💾 Kaydet'}
            </button>
          </div>
        </Modal>
      )}

      {/* ROL EKLE / DÜZENLE MODALI */}
      {showRoleModal && (
        <Modal 
          isOpen 
          title={editingRole ? `Rolü Düzenle: ${editingRole.name}` : 'Yeni Kullanıcı Rolü Ekle'} 
          size="sm" 
          onClose={() => {
            setShowRoleModal(false);
            setEditingRole(null);
          }}
        >
          <div style={{ padding: 15 }}>
            <div className="form-group">
              <label className="required" style={{ color: 'var(--color-text)', fontWeight: 600 }}>Rol Adı</label>
              <input 
                type="text" 
                className="form-control" 
                value={roleForm.name || ''} 
                onChange={e => setRoleForm({...roleForm, name: e.target.value})} 
                placeholder="Örn: Tekniker, Saha Elemanı, Stajyer" 
                autoFocus
                style={{ background: 'var(--color-surface)', color: 'var(--color-text)', border: '1px solid var(--color-border)' }}
              />
            </div>
            <div className="form-group">
              <label style={{ color: 'var(--color-text)', fontWeight: 600 }}>Açıklama</label>
              <input 
                type="text" 
                className="form-control" 
                value={roleForm.description || ''} 
                onChange={e => setRoleForm({...roleForm, description: e.target.value})} 
                placeholder="Rolün görev ve yetki tanımı..." 
                style={{ background: 'var(--color-surface)', color: 'var(--color-text)', border: '1px solid var(--color-border)' }}
              />
            </div>
            <div className="flex-gap" style={{ justifyContent: 'flex-end', marginTop: 15 }}>
              <button className="btn btn-secondary" onClick={() => {
                setShowRoleModal(false);
                setEditingRole(null);
              }}>İptal</button>
              <button className="btn btn-primary" onClick={saveRole} disabled={saving}>
                {saving ? '⏳ Kaydediliyor...' : editingRole ? '💾 Değişiklikleri Kaydet' : '➕ Rolü Oluştur'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ROL SİLME ONAY DIALOGU */}
      {deleteRoleTarget && (
        <ConfirmDialog
          title="Rolü Sil"
          message={`"${deleteRoleTarget.name}" rolünü sistemden silmek istediğinize emin misiniz? Bu role atanmış ${users.filter(u => Number(u.role_id) === Number(deleteRoleTarget.id)).length} adet kullanıcı varsa, otomatik olarak standart 'Kullanıcı' rolüne aktarılacaktır.`}
          onConfirm={confirmDeleteRole}
          onCancel={() => setDeleteRoleTarget(null)}
          confirmText="Evet, Rolü Sil"
          type="danger"
        />
      )}

      {/* ŞİFRE DEĞİŞTİR MODALI */}
      {showPwForm && (
        <Modal isOpen title="Şifre Değiştir" size="sm" onClose={() => setShowPwForm(false)}>
          <div style={{ padding: 15 }}>
            <div className="form-group">
              <label style={{ color: 'var(--color-text)', fontWeight: 600 }}>Mevcut Şifre</label>
              <input 
                type="password" 
                className="form-control"
                value={pwForm.oldPassword || ''} 
                onChange={e => setPwForm({...pwForm, oldPassword: e.target.value})} 
                autoFocus 
                style={{ background: 'var(--color-surface)', color: 'var(--color-text)', border: '1px solid var(--color-border)' }}
              />
            </div>
            <div className="form-group">
              <label style={{ color: 'var(--color-text)', fontWeight: 600 }}>Yeni Şifre</label>
              <input 
                type="password" 
                className="form-control"
                value={pwForm.newPassword || ''} 
                onChange={e => setPwForm({...pwForm, newPassword: e.target.value})} 
                style={{ background: 'var(--color-surface)', color: 'var(--color-text)', border: '1px solid var(--color-border)' }}
              />
            </div>
            <div className="form-group">
              <label style={{ color: 'var(--color-text)', fontWeight: 600 }}>Tekrar</label>
              <input 
                type="password" 
                className="form-control"
                value={pwForm.confirm || ''} 
                onChange={e => setPwForm({...pwForm, confirm: e.target.value})} 
                style={{ background: 'var(--color-surface)', color: 'var(--color-text)', border: '1px solid var(--color-border)' }}
              />
            </div>
            <div className="flex-gap" style={{ justifyContent: 'flex-end', marginTop: 15 }}>
              <button className="btn btn-secondary" onClick={() => setShowPwForm(false)}>İptal</button>
              <button className="btn btn-primary" onClick={changePw}>Kaydet</button>
            </div>
          </div>
        </Modal>
      )}

      {deleteTarget && (
        <ConfirmDialog
          title="Kullanıcıyı Pasif Yap"
          message={`"${deleteTarget.full_name}" kullanıcısını pasif yapmak istediğinizden emin misiniz?`}
          onConfirm={async () => {
            if (deleteTarget.id === currentUser.id) {
              showNotification('Kendi kullanıcınızı pasif yapamazsınız.', 'warning');
              setDeleteTarget(null);
              return;
            }
            const res = await window.electronAPI.deleteUser(deleteTarget.id, currentUser);
            setDeleteTarget(null);
            if (res.success) {
              showNotification('Kullanıcı pasif yapıldı.', 'success');
              loadData();
            } else {
              showNotification('İşlem hatası: ' + res.message, 'danger');
            }
          }}
          onCancel={() => setDeleteTarget(null)}
          confirmText="Pasif Yap"
          type="warning"
        />
      )}

      {purgeTarget && (
        <ConfirmDialog
          title="Kullanıcıyı Kalıcı Olarak Sil"
          message={`⚠️ DİKKAT: "${purgeTarget.full_name}" kullanıcısı tamamen silinecektir. Emin misiniz?`}
          onConfirm={async () => {
            const res = await window.electronAPI.purgeUser(purgeTarget.id, currentUser);
            setPurgeTarget(null);
            if (res.success) {
              showNotification(`"${purgeTarget.full_name}" kalıcı olarak silindi.`, 'success');
              loadData();
            } else {
              showNotification('Silme hatası: ' + res.message, 'danger');
            }
          }}
          onCancel={() => setPurgeTarget(null)}
          confirmText="Evet, Kalıcı Sil"
          type="danger"
        />
      )}
    </div>
  );
}
