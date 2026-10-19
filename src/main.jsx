import React from 'react';
import ReactDOM from 'react-dom/client';
import { getApiBase } from './utils/apiConfig';

if (!window.electronAPI) {
  const apiCall = async (endpoint, data, silent = false) => {
    try {
      const res = await fetch(`${window.API_BASE}/api/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        if (!silent) {
          console.warn(`[API] /api/${endpoint} returned ${res.status}`);
        }
        return { success: false, status: res.status, message: errorData.message || `HTTP error ${res.status}` };
      }
      return await res.json();
    } catch (err) {
      if (!silent) {
        console.warn(`[API] /api/${endpoint} failed:`, err.message);
      }
      return { success: false, message: err.message };
    }
  };

  window.electronAPI = {
    // Auth
    login: (creds) => apiCall('auth/login', creds),
    changePassword: (data) => apiCall('auth/change-password', data),
    getUsers: (showInactive) => apiCall('auth/get-users', { showInactive: !!showInactive }),
    getRoles: async () => {
      try {
        const dbRes = await apiCall('db/query', { sql: 'SELECT * FROM roles ORDER BY id ASC', params: [] });
        if (dbRes && dbRes.success && Array.isArray(dbRes.data)) {
          return { success: true, data: dbRes.data };
        }
        return dbRes;
      } catch (e) {
        return { success: false, message: e.message };
      }
    },
    getRolePermissions: async () => {
      try {
        const rolesRes = await apiCall('db/query', { sql: 'SELECT * FROM roles ORDER BY id ASC', params: [] });
        const permsRes = await apiCall('db/query', { sql: 'SELECT * FROM permissions ORDER BY role_id ASC, module ASC', params: [] });
        return {
          success: true,
          roles: rolesRes.data || [],
          permissions: permsRes.data || []
        };
      } catch (e) {
        return { success: false, message: e.message };
      }
    },
    saveRolePermissions: async (payload) => {
      const { role_id, permissions } = payload || {};
      if (!role_id || !Array.isArray(permissions)) {
        return { success: false, message: 'Geçersiz veri' };
      }

      try {
        await apiCall('db/run', {
          sql: `CREATE TABLE IF NOT EXISTS permissions (
            id INT AUTO_INCREMENT PRIMARY KEY,
            role_id INT NOT NULL,
            module VARCHAR(50) NOT NULL,
            can_view TINYINT DEFAULT 1,
            can_create TINYINT DEFAULT 1,
            can_edit TINYINT DEFAULT 1,
            can_delete TINYINT DEFAULT 1,
            can_admin TINYINT DEFAULT 0,
            UNIQUE KEY role_module (role_id, module)
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
          params: []
        });

        const deleteOp = {
          sql: 'DELETE FROM permissions WHERE role_id = ?',
          params: [role_id]
        };

        const insertOps = permissions.map(p => ({
          sql: `INSERT INTO permissions (role_id, module, can_view, can_create, can_edit, can_delete, can_admin)
                VALUES (?, ?, ?, ?, ?, ?, ?)`,
          params: [
            role_id,
            p.module,
            p.can_view ? 1 : 0,
            p.can_create ? 1 : 0,
            p.can_edit ? 1 : 0,
            p.can_delete ? 1 : 0,
            p.can_admin ? 1 : 0
          ]
        }));
        const txRes = await apiCall('db/transaction', { operations: [deleteOp, ...insertOps] });
        if (txRes && txRes.success) {
          return { success: true, message: 'Rol yetkileri başarıyla kaydedildi.' };
        }
        return txRes;
      } catch (e) {
        return { success: false, message: e.message };
      }
    },
    saveRole: async ({ id, name, description }) => {
      try {
        if (id) {
          await apiCall('db/run', { sql: 'UPDATE roles SET name = ?, description = ? WHERE id = ?', params: [name.trim(), description || null, id] });
          return { success: true, id };
        } else {
          const runRes = await apiCall('db/run', { sql: 'INSERT INTO roles (name, description) VALUES (?, ?)', params: [name.trim(), description || null] });
          const modules = ['dashboard', 'service', 'cargo', 'bitlocker', 'toner', 'stock', 'maintenance', 'inventory', 'users', 'docs_forms', 'address_label', 'handover', 'files', 'tasks', 'reports', 'settings'];
          const ops = modules.map(m => ({
            sql: 'INSERT IGNORE INTO permissions (role_id, module, can_view, can_create, can_edit, can_delete, can_admin) VALUES (?, ?, 1, 1, 1, 1, 0)',
            params: [role_id, m]
          }));
          await apiCall('db/transaction', { operations: ops });
          return { success: true, id: role_id };
        }
      } catch (e) {
        return { success: false, message: e.message };
      }
    },
    deleteRole: async (id, actor) => {
      try {
        if (Number(id) === 1) {
          return { success: false, message: 'Yönetici (Admin) rolü silinemez.' };
        }
        return await apiCall('auth/delete-role', { id, actor });
      } catch (e) {
        return { success: false, message: e.message };
      }
    },
    reorderRoles: (roles, actor) => apiCall('auth/reorder-roles', { roles, actor }),
    saveUser: (user) => apiCall('auth/save-user', { user }),
    deleteUser: (id, actor) => apiCall('auth/delete-user', { id, actor }),
    purgeUser: (id, actor) => apiCall('auth/purge-user', { id, actor }),
    setGuideDisabled: (disabled, userId, username) => apiCall('auth/set-guide-disabled', { disabled, user_id: userId, username }),
    auditLog: (entry) => apiCall('audit/log', entry),
    getAuditLogs: (filters) => apiCall('audit/get-logs', filters || {}),
    getServiceTickets: () => apiCall('service/get-tickets', {}),

    // BitLocker
    getBitlockerKeys: (params) => {
      const q = new URLSearchParams(params || {}).toString();
      return fetch(`${window.API_BASE}/api/bitlocker${q ? '?' + q : ''}`).then(r => r.json());
    },
    getBitlockerStats: () => fetch(`${window.API_BASE}/api/bitlocker/stats`).then(r => r.json()),
    saveBitlockerKey: (data) => {
      if (data?.id) {
        return fetch(`${window.API_BASE}/api/bitlocker/${data.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        }).then(r => r.json());
      }
      return fetch(`${window.API_BASE}/api/bitlocker`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      }).then(r => r.json());
    },
    deleteBitlockerKey: (id, permanent = false) => {
      const url = permanent 
        ? `${window.API_BASE}/api/bitlocker/${id}/permanent`
        : `${window.API_BASE}/api/bitlocker/${id}`;
      return fetch(url, { method: 'DELETE' }).then(r => r.json());
    },
    restoreBitlockerKey: (id) => {
      return fetch(`${window.API_BASE}/api/bitlocker/${id}/restore`, { method: 'POST' }).then(r => r.json());
    },
    uploadBitlockerFiles: (formData) => {
      return fetch(`${window.API_BASE}/api/bitlocker/upload`, {
        method: 'POST',
        body: formData
      }).then(r => r.json());
    },

    // Announcements
    getAnnouncements: () => apiCall('announcements/get-all', {}),
    saveAnnouncement: (ann) => apiCall('announcements/save', ann),
    deleteAnnouncement: (id) => apiCall('announcements/delete', { id }),
    getActiveAnnouncements: (username, role_name) => apiCall('announcements/get-active', { username, role_name }),
    markAnnouncementRead: (announcement_id, username) => apiCall('announcements/mark-read', { announcement_id, username }),

    // Database
    query: (sql, params) => apiCall('db/query', { sql, params }),
    get: (sql, params) => apiCall('db/get', { sql, params }),
    run: (sql, params) => apiCall('db/run', { sql, params }),
    transaction: (operations) => apiCall('db/transaction', { operations }),
    testMysql: (settings) => apiCall('db/test-mysql', settings),
    pullMysqlSettings: (settings) => apiCall('db/pull-mysql-settings', settings),
    pullMysql: (settings) => apiCall('db/pull-mysql', settings),
    pushMysql: (settings) => apiCall('db/push-mysql', settings),
    getMysqlSyncState: (settings) => apiCall('db/mysql-sync-state', settings),
    flushMysqlPending: () => apiCall('db/flush-mysql-pending', {}),

    // Utils
    generateTicketNo: () => apiCall('util/generate-ticket-no', {}),
    generateCode: (type) => apiCall('util/generate-code', { type }),
    getAppPath: () => Promise.resolve('/'),
    print: (options) => { window.print(); return Promise.resolve({ success: true }); },
    printHtml: (html, options) => {
      // Offscreen iframe printing keeps the user on the active page without opening a blank/stretched tab
      try {
        const oldFrame = document.getElementById('app-print-frame');
        if (oldFrame) oldFrame.remove();

        // Strip any embedded window.print calls inside the HTML to prevent duplicate print dialogs
        const cleanHtml = (html || '').replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*window\.print\(\)[^<]*<\/script>/gi, '');

        const iframe = document.createElement('iframe');
        iframe.id = 'app-print-frame';
        iframe.style.position = 'fixed';
        iframe.style.top = '0';
        iframe.style.left = '0';
        iframe.style.width = '210mm';
        iframe.style.height = '297mm';
        iframe.style.border = 'none';
        iframe.style.opacity = '0';
        iframe.style.pointerEvents = 'none';
        iframe.style.zIndex = '-9999';
        document.body.appendChild(iframe);

        const doc = iframe.contentWindow.document;
        doc.open();
        doc.write(cleanHtml);
        doc.close();

        let printed = false;
        const triggerPrint = () => {
          if (printed) return;
          printed = true;
          try {
            iframe.contentWindow.focus();
            iframe.contentWindow.print();
          } catch (e) {
            console.error('Iframe print error, falling back to popup:', e);
            const printWindow = window.open('', '_blank');
            if (printWindow) {
              printWindow.document.open();
              printWindow.document.write(cleanHtml);
              printWindow.document.close();
            }
          }
        };

        setTimeout(triggerPrint, 300);

        return Promise.resolve({ success: true });
      } catch (err) {
        console.warn('Iframe setup failed, falling back to popup:', err);
        const printWindow = window.open('', '_blank');
        if (printWindow) {
          const cleanHtml = (html || '').replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*window\.print\(\)[^<]*<\/script>/gi, '');
          printWindow.document.open();
          printWindow.document.write(cleanHtml);
          printWindow.document.close();
          return Promise.resolve({ success: true });
        }
        return Promise.resolve({ success: false, message: err.message });
      }
    },
    savePdf: () => Promise.resolve({ success: false, message: 'Lütfen tarayıcının Yazdır -> PDF olarak Kaydet seçeneğini kullanın.' }),
    saveExcel: () => Promise.resolve({ success: false, message: 'Web modunda Excel doğrudan sunucu üzerinden indirilmelidir.' }),

    // Backup
    backupManual: () => Promise.resolve({ success: false, message: 'Yedekleme sadece sunucu tarafından yönetilebilir.' }),
    backupRestore: () => Promise.resolve({ success: false, message: 'Yedekleme sadece sunucu tarafından yönetilebilir.' }),
    backupChooseDir: () => Promise.resolve({ success: false }),
    backupChooseFile: () => Promise.resolve({ success: false }),

    // Attachments
    addAttachment: () => Promise.resolve({ success: false, message: 'Web modunda dosya yöneticisinden yükleme yapabilirsiniz.' }),
    openAttachment: (filePath) => {
      const filename = filePath.split(/[\\\/]/).pop();
      window.open(filePath.startsWith('http') ? filePath : `${window.API_BASE}/files/${encodeURIComponent(filename)}`, '_blank');
      return Promise.resolve({ success: true });
    },
    deleteAttachment: (id) => apiCall('attachment/delete', { id }),

    // Snipe-IT
    snipeitSync: () => apiCall('snipeit/sync', {}),
    snipeitSaveConsumable: (data) => apiCall('snipeit/save-consumable', { data }),
    snipeitCheckoutConsumable: (data) => apiCall('snipeit/checkout-consumable', { data }),
    snipeitSaveComponent: (data) => apiCall('snipeit/save-component', { data }),
    snipeitSyncCheckedout: () => apiCall('snipeit/sync-checkedout', {}),

    // Web Push
    pushVapidKey: () => apiCall('db/push-vapid-key', {}),
    pushSubscribe: (subscription, user_id, username) => apiCall('db/push-subscribe', { subscription, user_id, username }),
    pushUnsubscribe: (endpoint) => apiCall('db/push-unsubscribe', { endpoint }),
    pushTest: (username, title, body) => apiCall('db/push-test', { username, title, body }),

    // Maintenance (Periyodik Bakım)
    getMaintenanceMeta: () => fetch(`${API_BASE}/api/maintenance/meta`).then(r => r.json()),
    getMaintenancePlans: () => fetch(`${API_BASE}/api/maintenance/plans`).then(r => r.json()),
    createMaintenancePlan: (data) => fetch(`${API_BASE}/api/maintenance/plans`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }).then(r => r.json()),
    getMaintenancePlanDetail: (id) => fetch(`${API_BASE}/api/maintenance/plans/${id}`).then(r => r.json()),
    saveMaintenanceItemCheck: (id, data) => fetch(`${API_BASE}/api/maintenance/items/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }).then(r => r.json()),
    completeMaintenancePlan: (id, actor) => fetch(`${API_BASE}/api/maintenance/plans/${id}/complete`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ actor }) }).then(r => r.json()),
    deleteMaintenancePlan: (id, actor) => fetch(`${API_BASE}/api/maintenance/plans/${id}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ actor }) }).then(r => r.json()),
    previewMaintenanceAssets: (filter) => fetch(`${API_BASE}/api/maintenance/preview-assets`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(filter) }).then(r => r.json()),
    getMasterCalendarEvents: (params = '') => fetch(`${API_BASE}/api/maintenance/master-calendar${params ? '?' + params : ''}`).then(r => r.json()),

    // Inventory (Demirbaşlar)
    getInventoryStats: () => fetch(`${API_BASE}/api/inventory/stats`).then(r => r.json()),
    getInventoryAssets: (params = '') => fetch(`${API_BASE}/api/inventory/assets${params ? '?' + params : ''}`).then(r => r.json()),
    getInventoryAssetDetail: (id, live = false) => fetch(`${API_BASE}/api/inventory/assets/${id}${live ? '?live=1' : ''}`).then(r => r.json()),

    // Updates
    checkForUpdates: () => Promise.resolve({ success: false }),
    downloadAndInstallUpdate: () => Promise.resolve({ success: false }),
    onUpdateProgress: () => () => {},
  };
}
import { AuthProvider } from './context/AuthContext';
import { AppProvider } from './context/AppContext';
import App from './App';
import './styles/variables.css';
import './styles/global.css';
import './styles/toolbar.css';
import './styles/layout.css';
import './styles/legacy-erp.css';
import './styles/themes.css';

// AG Grid v31+ Module Registration
import { ModuleRegistry, AllCommunityModule, provideGlobalGridOptions } from 'ag-grid-community';
ModuleRegistry.registerModules([ AllCommunityModule ]);

provideGlobalGridOptions({
  popupParent: typeof document !== 'undefined' ? document.body : undefined,
  paginationPageSizeSelector: [25, 50, 100, 200, 500],
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthProvider>
      <AppProvider>
        <App />
      </AppProvider>
    </AuthProvider>
  </React.StrictMode>
);
