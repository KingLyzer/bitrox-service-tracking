const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Auth
  login: (creds) => ipcRenderer.invoke('auth:login', creds),
  changePassword: (data) => ipcRenderer.invoke('auth:change-password', data),
  getUsers: (showInactive) => ipcRenderer.invoke('auth:get-users', { showInactive }),
  getRoles: () => ipcRenderer.invoke('auth:get-roles'),
  saveUser: (user) => ipcRenderer.invoke('auth:save-user', { user }),
  deleteUser: (id, actor) => ipcRenderer.invoke('auth:delete-user', { id, actor }),
  purgeUser:  (id, actor) => ipcRenderer.invoke('auth:purge-user',  { id, actor }),
  auditLog: (entry) => ipcRenderer.invoke('audit:log', entry),
  getAuditLogs: (filters) => ipcRenderer.invoke('audit:get-logs', filters || {}),
  getServiceTickets: () => ipcRenderer.invoke('service:get-tickets'),

  // Database
  query: (sql, params) => ipcRenderer.invoke('db:query', { sql, params }),
  get: (sql, params) => ipcRenderer.invoke('db:get', { sql, params }),
  run: (sql, params) => ipcRenderer.invoke('db:run', { sql, params }),
  transaction: (operations) => ipcRenderer.invoke('db:transaction', { operations }),
  testMysql: (settings) => ipcRenderer.invoke('db:test-mysql', settings),
  pullMysqlSettings: (settings) => ipcRenderer.invoke('db:pull-mysql-settings', settings),
  pullMysql: (settings) => ipcRenderer.invoke('db:pull-mysql', settings),
  pushMysql: (settings) => ipcRenderer.invoke('db:push-mysql', settings),
  getMysqlSyncState: (settings) => ipcRenderer.invoke('db:mysql-sync-state', settings),
  flushMysqlPending: () => ipcRenderer.invoke('db:flush-mysql-pending'),

  // Utils
  generateTicketNo: () => ipcRenderer.invoke('util:generate-ticket-no'),
  generateCode: (type) => ipcRenderer.invoke('util:generate-code', { type }),
  getAppPath: () => ipcRenderer.invoke('util:get-app-path'),
  print: (options) => ipcRenderer.invoke('util:print', options || {}),
  printHtml: (html, options) => ipcRenderer.invoke('util:print-html', { html, options: options || {} }),
  savePdf: (defaultName) => ipcRenderer.invoke('util:save-pdf', { defaultName }),
  saveExcel: (defaultName, buffer) => ipcRenderer.invoke('util:save-excel', { defaultName, buffer }),

  // Backup
  backupManual: (targetDir) => ipcRenderer.invoke('backup:manual', { targetDir }),
  backupRestore: (sourcePath) => ipcRenderer.invoke('backup:restore', { sourcePath }),
  backupChooseDir: () => ipcRenderer.invoke('backup:choose-dir'),
  backupChooseFile: () => ipcRenderer.invoke('backup:choose-file'),

  // Attachments
  addAttachment: (refType, refId, userId) => ipcRenderer.invoke('attachment:add', { refType, refId, userId }),
  openAttachment: (filePath) => ipcRenderer.invoke('attachment:open', { filePath }),
  deleteAttachment: (id) => ipcRenderer.invoke('attachment:delete', { id }),

  // Snipe-IT
  snipeitSync: () => ipcRenderer.invoke('snipeit:sync'),
  snipeitSaveConsumable: (data) => ipcRenderer.invoke('snipeit:save-consumable', { data }),
  snipeitCheckoutConsumable: (data) => ipcRenderer.invoke('snipeit:checkout-consumable', { data }),
  snipeitSaveComponent: (data) => ipcRenderer.invoke('snipeit:save-component', { data }),
  snipeitSyncCheckedout: () => ipcRenderer.invoke('snipeit:sync-checkedout'),

  // Updates
  checkForUpdates: () => ipcRenderer.invoke('update:check'),
  downloadAndInstallUpdate: (update) => ipcRenderer.invoke('update:download-and-install', update),
  onUpdateProgress: (callback) => {
    const listener = (_event, data) => callback(data);
    ipcRenderer.on('update:progress', listener);
    return () => ipcRenderer.removeListener('update:progress', listener);
  },
});
