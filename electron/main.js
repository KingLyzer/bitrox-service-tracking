const { app, BrowserWindow, ipcMain, dialog, shell, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const { Readable } = require('stream');
const { initDatabase, dbAll, dbGet, dbRun, dbTransaction, flushMysqlPendingWrites, getDb, closeDb } = require('./db/database');
const bcrypt = require('bcryptjs');
const snipeitService = require('./services/snipeit');

const isDev = process.env.NODE_ENV === 'development';
const UPDATE_MANIFEST_URL = process.env.UPDATE_MANIFEST_URL || 'http://128.1.1.10:3000/api/update/latest';
let mainWindow;

function createWindow() {
  Menu.setApplicationMenu(null);
  
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    show: false,
    title: 'Servis ve Toner Takip Sistemi',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    backgroundColor: '#1e1e1e', // changed to dark
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.once('ready-to-show', () => {
    const maximized = dbGet("SELECT value FROM settings WHERE key='window_maximized'");
    if (!maximized || maximized.value === '1') mainWindow.maximize();
    mainWindow.show();
  });

  mainWindow.on('closed', () => { mainWindow = null; });
}

app.whenReady().then(() => {
  try {
    initDatabase();
  } catch (err) {
    console.error('DB init failed:', err);
  }
  createWindow();
  app.on('activate', () => { if (!mainWindow) createWindow(); });
});

app.on('window-all-closed', () => {
  closeDb();
  if (process.platform !== 'darwin') app.quit();
});

function compareVersions(a, b) {
  const pa = String(a || '0').split('.').map(n => parseInt(n, 10) || 0);
  const pb = String(b || '0').split('.').map(n => parseInt(n, 10) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i += 1) {
    if ((pa[i] || 0) > (pb[i] || 0)) return 1;
    if ((pa[i] || 0) < (pb[i] || 0)) return -1;
  }
  return 0;
}

function getUpdatePlatformKey() {
  return `${process.platform}-${process.arch}`;
}

function sendUpdateProgress(data) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.webContents.send('update:progress', data);
}

async function downloadFile(url, targetPath) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Güncelleme indirilemedi: HTTP ${response.status}`);

  await fs.promises.mkdir(path.dirname(targetPath), { recursive: true });
  const file = fs.createWriteStream(targetPath);
  const body = typeof response.body.pipe === 'function' ? response.body : Readable.fromWeb(response.body);
  const total = Number(response.headers.get('content-length')) || 0;
  let downloaded = 0;

  await new Promise((resolve, reject) => {
    body.on('data', chunk => {
      downloaded += chunk.length;
      const percent = total ? Math.max(1, Math.min(99, Math.round((downloaded / total) * 100))) : null;
      sendUpdateProgress({
        phase: 'download',
        percent,
        downloaded,
        total,
        message: percent ? `Güncelleme indiriliyor... %${percent}` : 'Güncelleme indiriliyor...',
      });
    });
    body.pipe(file);
    body.on('error', reject);
    file.on('finish', resolve);
    file.on('error', reject);
  });
}

function shellEscapePs(value) {
  return String(value).replace(/'/g, "''");
}

async function installWindowsZip(zipPath) {
  const updateDir = path.dirname(zipPath);
  const extractDir = path.join(updateDir, 'extracted');
  const appDir = path.dirname(app.getPath('exe'));
  const exePath = app.getPath('exe');
  const scriptPath = path.join(updateDir, 'install-update.ps1');
  const logPath = path.join(updateDir, 'install-update.log');
  const pid = process.pid;

  const base64ZipPath = Buffer.from(zipPath).toString('base64');
  const base64ExtractDir = Buffer.from(extractDir).toString('base64');
  const base64AppDir = Buffer.from(appDir).toString('base64');
  const base64ExePath = Buffer.from(exePath).toString('base64');
  const base64LogPath = Buffer.from(logPath).toString('base64');

  const script = `
$ErrorActionPreference = 'Stop'
$Host.UI.RawUI.WindowTitle = 'Servis Takip Guncelleniyor'
$zip = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String('${base64ZipPath}'))
$extract = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String('${base64ExtractDir}'))
$appDir = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String('${base64AppDir}'))
$exe = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String('${base64ExePath}'))
$log = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String('${base64LogPath}'))
function Log($message) {
  $line = ('{0} {1}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $message)
  Write-Host $line
  Add-Content -LiteralPath $log -Value $line
}
try {
  Set-Content -LiteralPath $log -Value ('{0} Guncelleme basladi' -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'))
  Log 'Uygulamanin kapanmasi bekleniyor...'
  Start-Sleep -Seconds 2
  try { Wait-Process -Id ${pid} -Timeout 10 -ErrorAction SilentlyContinue } catch {}
  Get-Process -Name 'Servis ve Toner Takip Sistemi' -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
  Start-Sleep -Seconds 1
  Log 'Paket aciliyor...'
  if (Test-Path -LiteralPath $extract) { Remove-Item -LiteralPath $extract -Recurse -Force }
  New-Item -ItemType Directory -Force -Path $extract | Out-Null
  Expand-Archive -LiteralPath $zip -DestinationPath $extract -Force
  $candidates = @(
    (Join-Path $extract 'dist-electron\\win-unpacked'),
    (Join-Path $extract 'win-unpacked'),
    $extract
  )
  $src = $null
  foreach ($candidate in $candidates) {
    if (Test-Path -LiteralPath (Join-Path $candidate 'Servis ve Toner Takip Sistemi.exe')) {
      $src = $candidate
      break
    }
  }
  if (-not $src) { throw 'Guncelleme paketi icinde uygulama exe dosyasi bulunamadi.' }
  Log ('Dosyalar kopyalaniyor: ' + $src)
  $robocopyArgs = @($src, $appDir, '/E', '/IS', '/IT', '/NP', '/NFL', '/NDL', '/NJH', '/NJS', '/R:3', '/W:1')
  & robocopy @robocopyArgs | Out-Null
  if ($LASTEXITCODE -ge 8) { throw "Robocopy kopyalama basarisiz: Kod $LASTEXITCODE" }
  Log 'Uygulama yeniden baslatiliyor...'
  Start-Process -FilePath $exe
  Log 'Guncelleme tamamlandi.'
  Start-Sleep -Seconds 2
} catch {
  Log ('HATA: ' + $_.Exception.Message)
  Write-Host ''
  Write-Host ('Hata log dosyasi: ' + $log)
  Read-Host 'Kapatmak icin Enter'
}
`;

  await fs.promises.writeFile(scriptPath, '\uFEFF' + script, 'utf8');
  sendUpdateProgress({
    phase: 'install',
    percent: 100,
    message: `Kurulum başlıyor. Ayrı bir güncelleme penceresi açılacak. Log: ${logPath}`,
    logPath,
  });
  const command = `Get-Content -Raw -Encoding UTF8 -LiteralPath '${scriptPath.replace(/'/g, "''")}' | Invoke-Expression`;
  spawn('cmd.exe', ['/c', 'start', 'Servis Takip Guncelleniyor', 'powershell.exe', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', command], {
    detached: true,
    stdio: 'ignore',
  }).unref();
  setTimeout(() => app.quit(), 800);
}

async function installLinuxAppImage(packagePath) {
  const updateDir = path.dirname(packagePath);
  const currentAppImage = process.env.APPIMAGE || app.getPath('exe');
  const scriptPath = path.join(updateDir, 'install-update.sh');
  const logPath = path.join(updateDir, 'install-update.log');
  const pid = process.pid;
  const script = `#!/usr/bin/env bash
exec > "${logPath.replace(/"/g, '\\"')}" 2>&1
set -ex
sleep 2
while kill -0 ${pid} 2>/dev/null; do sleep 1; done
rm -f '${currentAppImage.replace(/'/g, "'\\''")}' || true
cp '${packagePath.replace(/'/g, "'\\''")}' '${currentAppImage.replace(/'/g, "'\\''")}'
chmod +x '${currentAppImage.replace(/'/g, "'\\''")}'
'${currentAppImage.replace(/'/g, "'\\''")}' >/dev/null 2>&1 &
`;
  await fs.promises.writeFile(scriptPath, script, 'utf8');
  await fs.promises.chmod(scriptPath, 0o755);
  spawn('/bin/bash', [scriptPath], { detached: true, stdio: 'ignore' }).unref();
  app.quit();
}

ipcMain.handle('update:check', async () => {
  try {
    const platformKey = getUpdatePlatformKey();
    const url = `${UPDATE_MANIFEST_URL}?platform=${encodeURIComponent(process.platform)}&arch=${encodeURIComponent(process.arch)}`;
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) throw new Error(`Güncelleme sunucusu HTTP ${response.status} döndü.`);

    const manifest = await response.json();
    const currentVersion = app.getVersion();
    const latestVersion = manifest.version || manifest.latestVersion;
    const updatePackage = manifest.package || manifest.packages?.[platformKey];
    const hasUpdate = latestVersion && compareVersions(latestVersion, currentVersion) > 0;

    return {
      success: true,
      currentVersion,
      latestVersion,
      hasUpdate,
      update: hasUpdate ? { ...updatePackage, version: latestVersion, notes: manifest.notes || '' } : null,
      notes: manifest.notes || '',
    };
  } catch (err) {
    return { success: false, message: err.message };
  }
});

ipcMain.handle('update:download-and-install', async (_, update = {}) => {
  try {
    if (!update.url) throw new Error('Güncelleme paket URL bilgisi yok.');

    const updateDir = path.join(app.getPath('userData'), 'updates');
    const fileName = update.fileName || path.basename(new URL(update.url).pathname) || `update-${Date.now()}`;
    const targetPath = path.join(updateDir, fileName);
    sendUpdateProgress({ phase: 'start', percent: 0, message: 'Güncelleme hazırlanıyor...' });
    await downloadFile(update.url, targetPath);
    sendUpdateProgress({ phase: 'downloaded', percent: 100, message: 'İndirme tamamlandı. Kurulum hazırlanıyor...' });

    if (process.platform === 'win32') {
      await installWindowsZip(targetPath);
      return { success: true, message: 'Güncelleme indirildi. Uygulama yeniden başlatılıyor.' };
    }

    if (process.platform === 'linux') {
      await installLinuxAppImage(targetPath);
      return { success: true, message: 'Güncelleme indirildi. Uygulama yeniden başlatılıyor.' };
    }

    shell.showItemInFolder(targetPath);
    return { success: true, message: 'Güncelleme indirildi, dosya konumu açıldı.' };
  } catch (err) {
    return { success: false, message: err.message };
  }
});

// Helper to get local DB settings for MySQL connection
function getDbSettings() {
  const settings = {};
  try {
    const rows = dbAll("SELECT key, value FROM settings");
    for (const row of rows) {
      settings[row.key] = row.value;
    }
  } catch (e) {
    console.error('Error reading settings:', e);
  }
  return settings;
}

function actorFromUser(user = {}) {
  return {
    id: user.id || null,
    username: user.username || user.full_name || null,
  };
}

async function insertAuditLog(conn, { user, action, module, refId = null, description = '', oldValue = null, newValue = null }) {
  const actor = actorFromUser(user);
  const oldText = oldValue == null ? null : (typeof oldValue === 'string' ? oldValue : JSON.stringify(oldValue));
  const newText = newValue == null ? null : (typeof newValue === 'string' ? newValue : JSON.stringify(newValue));
  await conn.execute(
    `INSERT INTO audit_logs
      (user_id, username, action, module, ref_id, description, old_value, new_value)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [actor.id, actor.username, action, module, refId, description, oldText, newText]
  );
}

// ── AUTH ──────────────────────────────────────────────────
ipcMain.handle('auth:login', async (_, { username, password }) => {
  let conn;
  try {
    const settings = getDbSettings();
    conn = await createMysqlConnection(settings);
    const [rows] = await conn.execute(
      `SELECT u.*, r.name AS role_name
       FROM users u
       LEFT JOIN roles r ON u.role_id = r.id
       WHERE u.username = ? AND u.is_active = 1
       LIMIT 1`,
      [username]
    );

    const user = rows?.[0];
    if (!user) return { success: false, message: 'Kullanıcı bulunamadı.' };
    if (!bcrypt.compareSync(password, user.password_hash || '')) {
      return { success: false, message: 'Şifre hatalı.' };
    }

    await conn.execute('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?', [user.id]);

    try {
      await conn.execute(
        'INSERT INTO audit_logs (user_id, username, action, module, description) VALUES (?, ?, ?, ?, ?)',
        [user.id, user.username, 'LOGIN', 'auth', 'Kullanıcı girişi yapıldı.']
      );
    } catch (auditErr) {
      console.warn('[auth:login] audit log skipped:', auditErr.message);
    }

    const [permissions] = await conn.execute('SELECT * FROM permissions WHERE role_id = ?', [user.role_id]);
    const { password_hash, ...safeUser } = user;
    return { success: true, user: safeUser, permissions };
  } catch (err) {
    console.error('[auth:login] error:', err.message);
    return { success: false, message: err.message };
  } finally {
    if (conn) await conn.end();
  }
});

ipcMain.handle('audit:log', async (_, entry) => {
  let conn;
  try {
    const settings = getDbSettings();
    conn = await createMysqlConnection(settings);
    await insertAuditLog(conn, entry || {});
    return { success: true };
  } catch (err) {
    console.error('[audit:log] error:', err.message);
    return { success: false, message: err.message };
  } finally {
    if (conn) await conn.end();
  }
});

ipcMain.handle('audit:get-logs', async (_, { limit = 200, action = '', module = '', username = '' } = {}) => {
  let conn;
  try {
    const settings = getDbSettings();
    conn = await createMysqlConnection(settings);
    const where = [];
    const params = [];

    if (action) {
      where.push('action = ?');
      params.push(action);
    }
    if (module) {
      where.push('module = ?');
      params.push(module);
    }
    if (username) {
      where.push('(username LIKE ? OR description LIKE ?)');
      params.push(`%${username}%`, `%${username}%`);
    }

    params.push(Math.max(1, Math.min(Number(limit) || 200, 1000)));
    const [rows] = await conn.execute(
      `SELECT id, user_id, username, action, module, ref_id, description, old_value, new_value, ip_address, created_at
       FROM audit_logs
       ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
       ORDER BY created_at DESC, id DESC
       LIMIT ?`,
      params
    );
    return { success: true, data: rows };
  } catch (err) {
    console.error('[audit:get-logs] error:', err.message);
    return { success: false, message: err.message };
  } finally {
    if (conn) await conn.end();
  }
});

ipcMain.handle('auth:get-users', async (_, { showInactive }) => {
  let conn;
  try {
    const settings = getDbSettings();
    conn = await createMysqlConnection(settings);
    const query = showInactive
      ? 'SELECT u.*, r.name AS role_name FROM users u LEFT JOIN roles r ON u.role_id=r.id ORDER BY u.full_name'
      : 'SELECT u.*, r.name AS role_name FROM users u LEFT JOIN roles r ON u.role_id=r.id WHERE u.is_active=1 ORDER BY u.full_name';
    const [rows] = await conn.execute(query);
    return { success: true, data: rows };
  } catch (err) {
    console.error('[auth:get-users] error:', err.message);
    return { success: false, message: err.message };
  } finally {
    if (conn) await conn.end();
  }
});

ipcMain.handle('auth:get-roles', async () => {
  let conn;
  try {
    const settings = getDbSettings();
    conn = await createMysqlConnection(settings);
    const [rows] = await conn.execute('SELECT id, name FROM roles ORDER BY id');
    return { success: true, data: rows };
  } catch (err) {
    console.error('[auth:get-roles] error:', err.message);
    return { success: false, message: err.message };
  } finally {
    if (conn) await conn.end();
  }
});

ipcMain.handle('auth:save-user', async (_, { user }) => {
  let conn;
  try {
    const settings = getDbSettings();
    conn = await createMysqlConnection(settings);
    const actor = user.actor || null;
    if (user.id) {
      const [beforeRows] = await conn.execute('SELECT id, username, full_name, role_id, email, is_active FROM users WHERE id=? LIMIT 1', [user.id]);
      if (user.new_password?.trim()) {
        const hashedPassword = bcrypt.hashSync(user.new_password, 10);
        await conn.execute(
          'UPDATE users SET username=?, password_hash=?, full_name=?, role_id=?, email=?, is_active=? WHERE id=?',
          [user.username, hashedPassword, user.full_name, user.role_id, user.email || null, user.is_active, user.id]
        );
      } else {
        await conn.execute(
          'UPDATE users SET username=?, full_name=?, role_id=?, email=?, is_active=? WHERE id=?',
          [user.username, user.full_name, user.role_id, user.email || null, user.is_active, user.id]
        );
      }
      await insertAuditLog(conn, {
        user: actor,
        action: 'UPDATE',
        module: 'users',
        refId: user.id,
        description: `${user.full_name || user.username} kullanıcısı güncellendi.`,
        oldValue: beforeRows?.[0] || null,
        newValue: { username: user.username, full_name: user.full_name, role_id: user.role_id, email: user.email || null, is_active: user.is_active }
      });
      return { success: true, id: user.id };
    } else {
      const hashedPassword = bcrypt.hashSync(user.new_password, 10);
      const [result] = await conn.execute(
        'INSERT INTO users (username, password_hash, full_name, role_id, email, is_active) VALUES (?, ?, ?, ?, ?, ?)',
        [user.username, hashedPassword, user.full_name, user.role_id, user.email || null, user.is_active]
      );
      await insertAuditLog(conn, {
        user: actor,
        action: 'CREATE',
        module: 'users',
        refId: result.insertId,
        description: `${user.full_name || user.username} kullanıcısı oluşturuldu.`,
        newValue: { username: user.username, full_name: user.full_name, role_id: user.role_id, email: user.email || null, is_active: user.is_active }
      });
      return { success: true, id: result.insertId };
    }
  } catch (err) {
    console.error('[auth:save-user] error:', err.message);
    return { success: false, message: err.message };
  } finally {
    if (conn) await conn.end();
  }
});

ipcMain.handle('auth:delete-user', async (_, { id, actor }) => {
  let conn;
  try {
    const settings = getDbSettings();
    conn = await createMysqlConnection(settings);
    const [rows] = await conn.execute('SELECT id, username, full_name FROM users WHERE id=? LIMIT 1', [id]);
    await conn.execute('UPDATE users SET is_active=0 WHERE id=?', [id]);
    await insertAuditLog(conn, {
      user: actor,
      action: 'DELETE',
      module: 'users',
      refId: id,
      description: `${rows?.[0]?.full_name || rows?.[0]?.username || id} kullanıcısı pasif yapıldı.`,
      oldValue: rows?.[0] || null
    });
    return { success: true };
  } catch (err) {
    console.error('[auth:delete-user] error:', err.message);
    return { success: false, message: err.message };
  } finally {
    if (conn) await conn.end();
  }
});

// Kalıcı kullanıcı silme — yalnızca pasif (is_active=0) kullanıcılar için izin verilir
ipcMain.handle('auth:purge-user', async (_, { id, actor }) => {
  let conn;
  try {
    const settings = getDbSettings();
    conn = await createMysqlConnection(settings);
    // Güvenlik: yalnızca zaten pasif olan kullanıcıyı sil
    const [rows] = await conn.execute('SELECT id, username, full_name, is_active FROM users WHERE id=?', [id]);
    if (!rows || rows.length === 0) return { success: false, message: 'Kullanıcı bulunamadı.' };
    if (Number(rows[0].is_active) !== 0) return { success: false, message: 'Yalnızca pasif kullanıcılar kalıcı olarak silinebilir.' };
    await conn.execute('DELETE FROM users WHERE id=?', [id]);
    await insertAuditLog(conn, {
      user: actor,
      action: 'PURGE',
      module: 'users',
      refId: id,
      description: `${rows[0].full_name || rows[0].username} kullanıcısı kalıcı olarak silindi.`,
      oldValue: rows[0]
    });
    return { success: true };
  } catch (err) {
    console.error('[auth:purge-user] error:', err.message);
    return { success: false, message: err.message };
  } finally {
    if (conn) await conn.end();
  }
});

ipcMain.handle('auth:change-password', async (_, { userId, oldPassword, newPassword, actor }) => {
  let conn;
  try {
    const settings = getDbSettings();
    conn = await createMysqlConnection(settings);
    const [rows] = await conn.execute('SELECT password_hash FROM users WHERE id=?', [userId]);
    if (!rows || rows.length === 0) {
      return { success: false, message: 'Kullanıcı bulunamadı.' };
    }
    const user = rows[0];
    const match = bcrypt.compareSync(oldPassword, user.password_hash);
    if (!match) {
      return { success: false, message: 'Mevcut şifre hatalı.' };
    }
    const hashedPassword = bcrypt.hashSync(newPassword, 10);
    await conn.execute('UPDATE users SET password_hash=? WHERE id=?', [hashedPassword, userId]);
    await insertAuditLog(conn, {
      user: actor || { id: userId },
      action: 'UPDATE',
      module: 'auth',
      refId: userId,
      description: 'Kullanıcı şifresi değiştirildi.'
    });
    return { success: true };
  } catch (err) {
    console.error('[auth:change-password] error:', err.message);
    return { success: false, message: err.message };
  } finally {
    if (conn) await conn.end();
  }
});

ipcMain.handle('service:get-tickets', async () => {
  let conn;
  try {
    const settings = getDbSettings();
    conn = await createMysqlConnection(settings);

    const [tickets] = await conn.execute(
      `SELECT *
       FROM service_tickets
       ORDER BY COALESCE(updated_at, created_at) DESC, id DESC`
    );
    const [operations] = await conn.execute(
      `SELECT op.*, u.full_name AS tech_name, u.username AS tech_username
       FROM service_operations op
       LEFT JOIN users u ON op.user_id = u.id
       ORDER BY COALESCE(op.op_date, op.created_at) DESC, op.id DESC`
    );
    const [parts] = await conn.execute(
      `SELECT *
       FROM used_parts
       ORDER BY id DESC`
    );

    const operationsByTicket = new Map();
    for (const op of operations || []) {
      const key = String(op.ticket_id);
      if (!operationsByTicket.has(key)) operationsByTicket.set(key, []);
      operationsByTicket.get(key).push(op);
    }

    const partsByTicket = new Map();
    for (const part of parts || []) {
      const key = String(part.ticket_id);
      if (!partsByTicket.has(key)) partsByTicket.set(key, []);
      partsByTicket.get(key).push(part);
    }

    const data = (tickets || []).map(ticket => {
      const serviceOperations = operationsByTicket.get(String(ticket.id)) || [];
      const usedParts = partsByTicket.get(String(ticket.id)) || [];
      return {
        ...ticket,
        model: ticket.model_name || ticket.asset_name || ticket.model || null,
        urun: ticket.asset_name || ticket.model_name || ticket.urun || null,
        location: ticket.location_name || ticket.location || null,
        asset_no: ticket.asset_tag || ticket.asset_no || null,
        service_operations: serviceOperations,
        operations: serviceOperations,
        logs: serviceOperations,
        actions: serviceOperations,
        used_parts: usedParts,
      };
    });

    return { success: true, data };
  } catch (err) {
    console.error('[service:get-tickets] error:', err.message);
    return { success: false, message: err.message };
  } finally {
    if (conn) await conn.end();
  }
});

// ── GENERIC DB ────────────────────────────────────────────
ipcMain.handle('db:query', (_, { sql, params }) => {
  try { return { success: true, data: dbAll(sql, params || []) }; }
  catch (err) { return { success: false, message: err.message }; }
});

ipcMain.handle('db:get', (_, { sql, params }) => {
  try { return { success: true, data: dbGet(sql, params || []) }; }
  catch (err) { return { success: false, message: err.message }; }
});

ipcMain.handle('db:run', async (_, { sql, params }) => {
  try {
    const processedParams = (params || []).map(p => {
      if (typeof p === 'string' && p.startsWith('PLAIN:')) {
        return bcrypt.hashSync(p.slice(6), 10);
      }
      return p;
    });
    const result = dbRun(sql, processedParams);
    return { success: true, lastInsertRowid: result.lastInsertRowid, changes: result.changes };
  } catch (err) { return { success: false, message: err.message }; }
});

ipcMain.handle('db:transaction', async (_, { operations }) => {
  try {
    const results = dbTransaction(() => {
      return operations.map(op => {
        const r = dbRun(op.sql, op.params || []);
        return { lastInsertRowid: r.lastInsertRowid, changes: r.changes };
      });
    });
    return { success: true, results };
  } catch (err) { return { success: false, message: err.message }; }
});

ipcMain.handle('db:flush-mysql-pending', async () => {
  try {
    return await flushMysqlPendingWrites(5000);
  } catch (err) {
    return { success: false, message: err.message };
  }
});

ipcMain.handle('db:test-mysql', async (_, settings) => {
  return { success: true, message: 'MySQL doğrudan sunucu bağlantısı kapatıldı (Middleware/Websocket devrede)!' };
});

const CORE_TABLES = [
  'roles', 'users', 'permissions', 'departments', 'people',
  'cached_locations', 'cached_users', 'cached_manufacturers', 'cached_models', 'cached_assets',
  'cached_companies', 'cached_suppliers', 'cached_categories',
  'device_types', 'brands', 'devices', 'service_tickets',
  'service_operations', 'stock_categories', 'stock_items',
  'stock_movements', 'used_parts', 'printer_models', 'printers',
  'toner_items', 'toner_changes', 'attachments',
  'settings', 'operation_types', 'audit_logs'
];

const LOCAL_SETTING_KEYS = [
  'db_type', 'db_host', 'db_port', 'db_user', 'db_pass', 'db_name', 'db_network_path'
];
const LOCAL_SETTING_KEY_SET = new Set(LOCAL_SETTING_KEYS);

function normalizeSignatureValue(value) {
  if (value instanceof Date) return value.toISOString().replace('T', ' ').substring(0, 19);
  if (Buffer.isBuffer(value)) return value.toString('base64');
  if (value === undefined) return null;
  if (value === null) return null;
  return String(value);
}

function signatureForRows(rows, table) {
  const normalized = (rows || []).map(row => {
    const out = {};
    for (const key of Object.keys(row || {}).sort()) {
      if (key.startsWith('__')) continue;
      if (table === 'settings' && key.toLowerCase() === 'key' && LOCAL_SETTING_KEY_SET.has(String(row[key] || row.Key || ''))) {
        return null;
      }
      out[key] = normalizeSignatureValue(row[key]);
    }
    return out;
  }).filter(Boolean);

  normalized.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  return require('crypto').createHash('sha1').update(JSON.stringify(normalized)).digest('hex');
}

function getLocalTableSignature(localDb, table) {
  try {
    const columns = getLocalColumns(localDb, table);
    if (columns.length === 0) return signatureForRows([], table);
    const orderColumn = columns.find(c => c.name === 'id') ? 'id'
      : columns.find(c => c.name === 'key') ? 'key'
        : columns[0].name;
    const rows = localDb.prepare(
      `SELECT * FROM ${quoteSqliteIdentifier(table)} ORDER BY ${quoteSqliteIdentifier(orderColumn)}`
    ).all();
    return signatureForRows(rows, table);
  } catch (_) {
    return signatureForRows([], table);
  }
}

function quoteSqliteIdentifier(name) {
  return '"' + String(name).replace(/"/g, '""') + '"';
}

function quoteMysqlIdentifier(name) {
  return '`' + String(name).replace(/`/g, '``') + '`';
}

async function createMysqlConnection(settings = {}) {
  const mysql = require('mysql2/promise');
  return mysql.createConnection({
    host: settings.db_host || '128.1.1.10',
    port: parseInt(settings.db_port || '3306', 10),
    user: settings.db_user || 'root',
    password: settings.db_pass || '',
    database: settings.db_name || 'servicetracker_db',
    connectTimeout: 5000,
    dateStrings: true
  });
}

async function ensureRemoteSyncMeta(conn) {
  await conn.execute(`
    CREATE TABLE IF NOT EXISTS sync_meta (
      \`key\` VARCHAR(255) PRIMARY KEY,
      \`value\` TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

async function getRemoteDataVersion(conn) {
  await ensureRemoteSyncMeta(conn);
  const [rows] = await conn.execute("SELECT `value`, updated_at FROM sync_meta WHERE `key`='data_version' LIMIT 1");
  return rows?.[0] || null;
}

async function touchRemoteDataVersion(conn) {
  await ensureRemoteSyncMeta(conn);
  const version = String(Date.now());
  await conn.execute(
    "INSERT INTO sync_meta (`key`, `value`, updated_at) VALUES ('data_version', ?, CURRENT_TIMESTAMP) ON DUPLICATE KEY UPDATE `value`=VALUES(`value`), updated_at=CURRENT_TIMESTAMP",
    [version]
  );
  return version;
}

async function hasRemoteData(conn) {
  for (const table of CORE_TABLES) {
    try {
      const [rows] = await conn.execute(`SELECT 1 AS has_data FROM ${quoteMysqlIdentifier(table)} LIMIT 1`);
      if (rows?.length > 0) return true;
    } catch (err) {
      // Missing tables are expected before the first upload.
    }
  }
  return false;
}

function getLocalColumns(localDb, table) {
  try {
    return localDb.prepare(`PRAGMA table_info(${quoteSqliteIdentifier(table)})`).all();
  } catch (err) {
    return [];
  }
}

function normalizeDbValue(value) {
  if (value instanceof Date) return value.toISOString().replace('T', ' ').substring(0, 19);
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (value === undefined) return null;
  if (typeof value === 'object' && value !== null && !Buffer.isBuffer(value)) return JSON.stringify(value);
  return value;
}

function normalizePulledValue(table, key, row) {
  const value = row[key];
  if (table === 'settings') {
    if (key === 'category' && (value === undefined || value === null || value === '')) return 'general';
    if (key === 'label' && (value === undefined || value === null || value === '')) return row.key || null;
  }
  return normalizeDbValue(value);
}

function createLegacySyncId(table, row) {
  const ticketPart = row.__ticket_no || row.ticket_id || 'ticket';
  const datePart = row.created_at || row.op_date || row.change_date || row.id || Date.now();
  const textPart = row.description || row.part_name || row.op_type || row.id || '';
  return `${table}-legacy-${String(ticketPart)}-${String(datePart)}-${String(textPart).slice(0, 80)}`;
}

function mapPulledTicketId(localDb, row) {
  const ticketSyncId = row.ticket_sync_id || row.__ticket_sync_id;
  if (ticketSyncId) {
    const localTicket = localDb.prepare('SELECT id, sync_id FROM service_tickets WHERE sync_id=? LIMIT 1').get(ticketSyncId);
    if (localTicket) {
      row.ticket_sync_id = localTicket.sync_id;
      return localTicket.id;
    }
  }

  if (!row.__ticket_no) return row.ticket_id;
  const localTicket = localDb.prepare('SELECT id, sync_id FROM service_tickets WHERE ticket_no=? LIMIT 1').get(row.__ticket_no);
  if (localTicket?.sync_id && !row.ticket_sync_id) row.ticket_sync_id = localTicket.sync_id;
  return localTicket?.id || row.ticket_id;
}

function upsertPulledMergeRow(localDb, table, columns, sourceRow) {
  const row = { ...sourceRow };
  row.ticket_id = mapPulledTicketId(localDb, row);
  if (columns.includes('sync_id') && !row.sync_id) {
    row.sync_id = createLegacySyncId(table, row);
  }

  const syncId = row.sync_id;
  if (!syncId) return false;

  try {
    const wasDeleted = localDb.prepare(
      `SELECT 1 FROM deleted_sync_ids WHERE table_name=? AND sync_id=? LIMIT 1`
    ).get(table, syncId);
    if (wasDeleted) return false;
  } catch (err) {
    // deleted_sync_ids tablosu henüz yoksa devam et
  }

  const existing = localDb.prepare(
    `SELECT id FROM ${quoteSqliteIdentifier(table)} WHERE sync_id=? LIMIT 1`
  ).get(syncId);

  if (existing) {
    const updateKeys = columns.filter(key => key !== 'id' && key !== 'sync_id' && Object.prototype.hasOwnProperty.call(row, key));
    if (updateKeys.length) {
      if (updateKeys.includes('updated_at')) {
        const localRow = localDb.prepare(
          `SELECT updated_at FROM ${quoteSqliteIdentifier(table)} WHERE sync_id=? LIMIT 1`
        ).get(syncId);
        const localTs = localRow?.updated_at ? new Date(localRow.updated_at).getTime() : 0;
        const remoteTs = row.updated_at ? new Date(row.updated_at).getTime() : 0;
        if (localTs > remoteTs) return true;
      }
      const assignments = updateKeys.map(key => `${quoteSqliteIdentifier(key)}=?`).join(', ');
      localDb.prepare(
        `UPDATE ${quoteSqliteIdentifier(table)} SET ${assignments} WHERE sync_id=?`
      ).run(...updateKeys.map(key => normalizePulledValue(table, key, row)), syncId);
    }
    return true;
  }

  const insertKeys = columns.filter(key => key !== 'id' && Object.prototype.hasOwnProperty.call(row, key));
  if (!insertKeys.length) return false;

  const placeholders = insertKeys.map(() => '?').join(', ');
  const cols = insertKeys.map(quoteSqliteIdentifier).join(', ');
  localDb.prepare(
    `INSERT INTO ${quoteSqliteIdentifier(table)} (${cols}) VALUES (${placeholders})`
  ).run(...insertKeys.map(key => normalizePulledValue(table, key, row)));
  return true;
}

ipcMain.handle('db:mysql-sync-state', async (_, settings) => {
  return {
    success: true,
    version: String(Date.now()),
    updated_at: new Date()
  };
});

ipcMain.handle('db:pull-mysql-settings', async (_, settings) => {
  return { success: true, pulled: 0, message: 'Doğrudan bağlantı devre dışı' };
});

ipcMain.handle('db:pull-mysql', async (_, settings) => {
  return {
    success: true,
    message: 'Doğrudan MySQL bağlantısı kapatıldı. Veriler middleware üzerinden çekilmektedir.',
    version: null,
    results: {},
    changedTables: []
  };
});

ipcMain.handle('db:push-mysql', async (_, settings) => {
  return {
    success: true,
    message: 'Doğrudan MySQL bağlantısı kapatıldı. Veriler middleware üzerinden gönderilmektedir.',
    version: null,
    results: {}
  };
});

// ── TICKET NO / CODE GENERATOR ────────────────────────────
ipcMain.handle('util:generate-ticket-no', () => {
  try {
    const prefix = (dbGet("SELECT value FROM settings WHERE key='ticket_prefix'") || {}).value || 'SRV';
    const year = new Date().getFullYear();
    const last = dbGet(
      'SELECT ticket_no FROM service_tickets WHERE ticket_no LIKE ? ORDER BY id DESC LIMIT 1',
      [`${prefix}-${year}-%`]
    );
    let seq = 1;
    if (last) {
      const parts = last.ticket_no.split('-');
      const parsed = parseInt(parts[parts.length - 1], 10);
      seq = Number.isFinite(parsed) ? parsed + 1 : 1;
    }
    return { success: true, value: `${prefix}-${year}-${String(seq).padStart(3, '0')}` };
  } catch (err) { return { success: false, message: err.message }; }
});

ipcMain.handle('util:generate-code', (_, { type }) => {
  try {
    const keyMap = { device: 'device_prefix', stock: 'stock_prefix', toner: 'toner_prefix' };
    const tableMap = { device: 'devices', stock: 'stock_items', toner: 'toner_items' };
    const colMap = { device: 'device_code', stock: 'stock_code', toner: 'toner_code' };
    if (!keyMap[type] || !tableMap[type] || !colMap[type]) {
      return { success: false, message: 'Geçersiz kod türü.' };
    }
    const prefix = (dbGet(`SELECT value FROM settings WHERE key='${keyMap[type]}'`) || {}).value || type.toUpperCase().slice(0, 3);
    const col = colMap[type];
    const table = tableMap[type];
    const last = dbGet(`SELECT ${col} FROM ${table} ORDER BY id DESC LIMIT 1`);
    let seq = 1;
    if (last && last[col]) {
      const parts = last[col].split('-');
      const parsed = parseInt(parts[parts.length - 1], 10);
      seq = Number.isFinite(parsed) ? parsed + 1 : 1;
    }
    return { success: true, value: `${prefix}-${String(seq).padStart(4, '0')}` };
  } catch (err) { return { success: false, message: err.message }; }
});

// ── BACKUP ────────────────────────────────────────────────
ipcMain.handle('backup:manual', async (_, { targetDir }) => {
  try {
    const dbPath = path.join(app.getPath('userData'), 'servicetracker.db');
    const now = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const dest = path.join(targetDir, `servicetracker_backup_${now}.db`);
    fs.copyFileSync(dbPath, dest);
    dbRun('INSERT INTO audit_logs (action,module,description) VALUES (?,?,?)',
      ['BACKUP', 'system', `Yedekleme alındı: ${dest}`]);
    return { success: true, path: dest };
  } catch (err) { return { success: false, message: err.message }; }
});

ipcMain.handle('backup:restore', async (_, { sourcePath }) => {
  const dbPath = path.join(app.getPath('userData'), 'servicetracker.db');
  const tempBackup = dbPath + '.before-restore';
  try {
    fs.copyFileSync(dbPath, tempBackup);
    closeDb();
    fs.copyFileSync(sourcePath, dbPath);
    initDatabase();
    if (fs.existsSync(tempBackup)) fs.unlinkSync(tempBackup);
    return { success: true };
  } catch (err) {
    try {
      if (fs.existsSync(tempBackup)) {
        fs.copyFileSync(tempBackup, dbPath);
        fs.unlinkSync(tempBackup);
        initDatabase();
      }
    } catch (rollbackErr) {
      console.error('[Backup Restore Rollback Error]', rollbackErr.message);
    }
    return { success: false, message: err.message };
  }
});

ipcMain.handle('backup:choose-dir', async () => {
  const result = await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory'] });
  if (result.canceled) return { success: false };
  return { success: true, path: result.filePaths[0] };
});

ipcMain.handle('backup:choose-file', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    filters: [{ name: 'SQLite DB', extensions: ['db'] }],
    properties: ['openFile']
  });
  if (result.canceled) return { success: false };
  return { success: true, path: result.filePaths[0] };
});

// ── ATTACHMENTS ───────────────────────────────────────────
ipcMain.handle('attachment:add', async (_, { refType, refId, userId }) => {
  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'Dosyalar', extensions: ['jpg', 'jpeg', 'png', 'pdf', 'docx', 'xlsx', 'txt'] }]
    });
    if (result.canceled) return { success: false };
    const attachDir = path.join(app.getPath('userData'), 'attachments', refType, String(refId));
    fs.mkdirSync(attachDir, { recursive: true });
    const saved = [];
    for (const filePath of result.filePaths) {
      const fname = path.basename(filePath);
      const dest = path.join(attachDir, `${Date.now()}_${fname}`);
      fs.copyFileSync(filePath, dest);
      const r = dbRun(
        'INSERT INTO attachments (ref_type,ref_id,file_name,file_path,uploaded_by) VALUES (?,?,?,?,?)',
        [refType, refId, fname, dest, userId]
      );
      saved.push({ id: r.lastInsertRowid, file_name: fname, file_path: dest });
    }
    return { success: true, files: saved };
  } catch (err) { return { success: false, message: err.message }; }
});

ipcMain.handle('attachment:open', (_, { filePath }) => {
  shell.openPath(filePath);
  return { success: true };
});

ipcMain.handle('attachment:delete', (_, { id }) => {
  try {
    const att = dbGet('SELECT * FROM attachments WHERE id=?', [id]);
    if (!att) return { success: false, message: 'Ek bulunamadı.' };
    dbRun('DELETE FROM attachments WHERE id=?', [id]);
    if (att.file_path && fs.existsSync(att.file_path)) {
      try { fs.unlinkSync(att.file_path); } catch (e) { console.warn('[Attachment Delete] Dosya silinemedi:', e.message); }
    }
    return { success: true };
  } catch (err) { return { success: false, message: err.message }; }
});

// ── PRINT / EXPORT ────────────────────────────────────────
ipcMain.handle('util:print', async (_, options = {}) => {
  try {
    await mainWindow.webContents.print({
      silent: false,
      printBackground: true,
      landscape: !!options.landscape,
      margins: {
        marginType: 'none',
      },
    });
    return { success: true };
  } catch (err) { return { success: false, message: err.message }; }
});

ipcMain.handle('util:print-html', async (_, { html, options = {} }) => {
  let printWindow;
  try {
    printWindow = new BrowserWindow({
      width: 900,
      height: 1200,
      show: false,
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
      backgroundColor: '#ffffff',
    });

    await printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html || '')}`);
    await new Promise((resolve, reject) => {
      printWindow.webContents.print({
        silent: false,
        printBackground: true,
        landscape: !!options.landscape,
        margins: {
          marginType: 'none',
        },
      }, (success, failureReason) => {
        if (success) resolve();
        else if (String(failureReason || '').toLowerCase().includes('cancel')) resolve();
        else reject(new Error(failureReason || 'Yazdırma iptal edildi veya başarısız oldu.'));
      });
    });
    return { success: true };
  } catch (err) {
    return { success: false, message: err.message };
  } finally {
    if (printWindow && !printWindow.isDestroyed()) printWindow.close();
  }
});

ipcMain.handle('util:save-pdf', async (_, { defaultName }) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    defaultPath: defaultName || 'rapor.pdf',
    filters: [{ name: 'PDF', extensions: ['pdf'] }]
  });
  if (result.canceled) return { success: false };
  try {
    const data = await mainWindow.webContents.printToPDF({ printBackground: true });
    fs.writeFileSync(result.filePath, data);
    shell.openPath(result.filePath);
    return { success: true, path: result.filePath };
  } catch (err) { return { success: false, message: err.message }; }
});

ipcMain.handle('util:save-excel', async (_, { defaultName, buffer }) => {
  const ext = path.extname(defaultName || '').toLowerCase();
  const filters = ext === '.csv'
    ? [{ name: 'CSV', extensions: ['csv'] }]
    : [{ name: 'Excel', extensions: ['xlsx'] }, { name: 'CSV', extensions: ['csv'] }];
  const result = await dialog.showSaveDialog(mainWindow, {
    defaultPath: defaultName || 'rapor.xlsx',
    filters
  });
  if (result.canceled) return { success: false };
  try {
    fs.writeFileSync(result.filePath, Buffer.from(buffer));
    shell.openPath(result.filePath);
    return { success: true, path: result.filePath };
  } catch (err) { return { success: false, message: err.message }; }
});

ipcMain.handle('util:get-app-path', () => {
  return { success: true, path: app.getPath('userData') };
});

// ── SNIPE-IT ──────────────────────────────────────────────
ipcMain.handle('snipeit:sync', async () => {
  return await snipeitService.syncAll();
});

ipcMain.handle('snipeit:save-consumable', async (_, { data }) => {
  return await snipeitService.saveConsumable(data);
});

ipcMain.handle('snipeit:checkout-consumable', async (_, { data }) => {
  return await snipeitService.checkoutConsumable(data);
});

ipcMain.handle('snipeit:save-component', async (_, { data }) => {
  return await snipeitService.saveComponent(data);
});

ipcMain.handle('snipeit:sync-checkedout', async () => {
  return await snipeitService.syncCheckedoutHistory();
});
