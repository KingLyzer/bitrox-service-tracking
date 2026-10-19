'use strict';

const path = require('path');
const fs = require('fs/promises');
const fsSync = require('fs');
const multer = require('multer');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

let archiverModule = null;
try {
  archiverModule = require('archiver');
} catch (e) {
  console.warn('[Archiver] archiver modülü yüklü değil.');
}

function createZipStream(options = { zlib: { level: 6 } }) {
  if (!archiverModule) return null;
  if (typeof archiverModule === 'function') {
    return archiverModule('zip', options);
  }
  if (typeof archiverModule.create === 'function') {
    return archiverModule.create('zip', options);
  }
  if (archiverModule.ZipArchive) {
    return new archiverModule.ZipArchive(options);
  }
  if (archiverModule.default && typeof archiverModule.default === 'function') {
    return archiverModule.default('zip', options);
  }
  return null;
}

module.exports = function registerFiles(app, { pool, emit, config }) {
  const { filesDir } = config;

  const upload = multer({
    storage: multer.diskStorage({
      destination: (_req, _file, cb) => cb(null, filesDir),
      filename: (req, file, cb) => {
        const originalNameUtf8 = Buffer.from(file.originalname, 'latin1').toString('utf8');
        const ext = path.extname(originalNameUtf8);
        let name = path.basename(originalNameUtf8, ext);

        const turkishMap = {
          'ş': 's', 'Ş': 'S', 'ı': 'i', 'İ': 'I', 'ğ': 'g', 'Ğ': 'G',
          'ç': 'c', 'Ç': 'C', 'ö': 'o', 'Ö': 'O', 'ü': 'u', 'Ü': 'U'
        };
        name = name.split('').map(char => turkishMap[char] || char).join('');
        name = name.replace(/[^a-zA-Z0-9_\-]/g, '_');

        cb(null, `${name}-${Date.now()}${ext}`);
      }
    })
  });

  app.get('/api/files', async (req, res) => {
    try {
      const { user_id } = req.query;
      if (!user_id) return res.status(400).json({ success: false, message: 'user_id eksik' });

      const [rows] = await pool.query(`
        SELECT f.*,
               u.name as owner_name,
               (SELECT COUNT(*) FROM user_file_shares WHERE file_id = f.id) as shared_count,
               (SELECT COUNT(*) FROM public_file_shares WHERE file_id = f.id AND is_active = 1 AND (expires_at IS NULL OR expires_at > NOW()) AND (download_limit IS NULL OR download_count < download_limit)) as public_share_count
        FROM user_files f
        LEFT JOIN cached_users u ON f.user_id = u.id
        WHERE f.user_id = ?
           OR f.id IN (SELECT file_id FROM user_file_shares WHERE shared_with = ?)
        ORDER BY f.type = 'folder' DESC, f.name ASC
      `, [user_id, user_id]);

      res.json({ success: true, data: rows });
    } catch (err) {
      console.error('[GET /api/files]', err);
      res.status(500).json({ success: false, message: err.message });
    }
  });

  app.post('/api/files/item', async (req, res) => {
    try {
      const { user_id, parent_id, type, name, content } = req.body;
      const [result] = await pool.execute(
        'INSERT INTO user_files (user_id, parent_id, type, name, content) VALUES (?, ?, ?, ?, ?)',
        [user_id, parent_id || null, type, name, content || null]
      );

      // Physically create folder/file on Network Storage (fileserver) as well
      if (type === 'folder' && name) {
        try {
          const folderOnStorage = `${getStorageBasePath().replace(/\/+$/, '')}/${name.trim()}`;
          if (!fsSync.existsSync(folderOnStorage)) {
            fsSync.mkdirSync(folderOnStorage, { recursive: true });
          }
        } catch (e) {}
      }

      emit.safeEmit('files-updated', { user_id });
      res.json({ success: true, data: { id: result.insertId } });
    } catch (err) {
      console.error('[POST /api/files/item]', err);
      res.status(500).json({ success: false, message: err.message });
    }
  });

  app.post('/api/files/upload', upload.any(), async (req, res) => {
    try {
      const { user_id, parent_id } = req.body;
      const uploadedFiles = req.files || [];
      if (uploadedFiles.length === 0) return res.status(400).json({ success: false, message: 'Dosya seçilmedi' });

      const inserted = [];
      const storageBase = getStorageBasePath();

      for (const file of uploadedFiles) {
        const originalNameUtf8 = Buffer.from(file.originalname, 'latin1').toString('utf8');
        
        // Ensure physical copy is also placed on Fileserver network storage
        try {
          const targetOnStorage = `${storageBase.replace(/\/+$/, '')}/${originalNameUtf8}`;
          if (file.path && fsSync.existsSync(file.path)) {
            await fs.copyFile(file.path, targetOnStorage).catch(() => {});
          }
        } catch (e) {}

        const [result] = await pool.execute(
          'INSERT INTO user_files (user_id, parent_id, type, name, file_path, size) VALUES (?, ?, ?, ?, ?, ?)',
          [user_id, parent_id || null, 'file', originalNameUtf8, file.filename, file.size]
        );
        inserted.push({ id: result.insertId, name: originalNameUtf8 });
      }
      emit.safeEmit('files-updated', { user_id });
      res.json({ success: true, count: inserted.length, data: inserted });
    } catch (err) {
      console.error('[POST /api/files/upload]', err);
      res.status(500).json({ success: false, message: err.message });
    }
  });

  app.put('/api/files/item/:id', async (req, res) => {
    try {
      const { name, content } = req.body;
      const { id } = req.params;

      await pool.execute(
        'UPDATE user_files SET name = ?, content = ? WHERE id = ?',
        [name, content || null, id]
      );
      emit.safeEmit('files-updated', {});
      res.json({ success: true });
    } catch (err) {
      console.error('[PUT /api/files/item]', err);
      res.status(500).json({ success: false, message: err.message });
    }
  });

  app.delete('/api/files/item/:id', async (req, res) => {
    try {
      const { id } = req.params;

      const [rows] = await pool.query('SELECT type, file_path FROM user_files WHERE id = ?', [id]);
      if (rows.length > 0 && rows[0].type === 'file' && rows[0].file_path) {
        const fullPath = path.join(filesDir, rows[0].file_path);
        if (fsSync.existsSync(fullPath)) {
          await fs.unlink(fullPath).catch(() => {});
        }
      }

      await pool.execute('DELETE FROM user_files WHERE id = ?', [id]);
      emit.safeEmit('files-updated', {});
      res.json({ success: true });
    } catch (err) {
      console.error('[DELETE /api/files/item]', err);
      res.status(500).json({ success: false, message: err.message });
    }
  });

  app.get('/api/files/share/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const [rows] = await pool.query('SELECT shared_with FROM user_file_shares WHERE file_id = ?', [id]);
      res.json({ success: true, data: rows.map(r => r.shared_with) });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  app.post('/api/files/share/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const { shared_by, user_ids } = req.body;

      await pool.execute('DELETE FROM user_file_shares WHERE file_id = ?', [id]);

      if (user_ids && user_ids.length > 0) {
        const values = user_ids.map(uid => [id, shared_by, uid]);
        await pool.query('INSERT INTO user_file_shares (file_id, shared_by, shared_with) VALUES ?', [values]);
      }

      emit.safeEmit('files-updated', {});
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  function getUniqueDiskName(targetBaseDir, originalName) {
    const fullTarget = `${targetBaseDir.replace(/\/+$/, '')}/${originalName}`;
    if (!fsSync.existsSync(fullTarget)) return originalName;

    let ext = '';
    let nameNoExt = originalName;

    const lastDot = originalName.lastIndexOf('.');
    if (lastDot > 0) {
      ext = originalName.substring(lastDot);
      nameNoExt = originalName.substring(0, lastDot);
    }

    let counter = 1;
    while (true) {
      const candidateName = `${nameNoExt} (${counter})${ext}`;
      const candidatePath = `${targetBaseDir.replace(/\/+$/, '')}/${candidateName}`;
      if (!fsSync.existsSync(candidatePath)) {
        return candidateName;
      }
      counter++;
    }
  }

  async function getUniqueDbName(userId, parentId, originalName) {
    const [rows] = await pool.query(
      'SELECT name FROM user_files WHERE user_id = ? AND (parent_id <=> ? OR (parent_id IS NULL AND ? IS NULL))',
      [userId, parentId || null, parentId || null]
    );
    const existingNames = new Set(rows.map(r => r.name.toLowerCase()));

    if (!existingNames.has(originalName.toLowerCase())) return originalName;

    let ext = '';
    let nameNoExt = originalName;
    const lastDot = originalName.lastIndexOf('.');
    if (lastDot > 0) {
      ext = originalName.substring(lastDot);
      nameNoExt = originalName.substring(0, lastDot);
    }

    let counter = 1;
    while (true) {
      const candidateName = `${nameNoExt} (${counter})${ext}`;
      if (!existingNames.has(candidateName.toLowerCase())) {
        return candidateName;
      }
      counter++;
    }
  }

  const handlePasteFiles = async (req, res) => {
    try {
      const { action, source_mode, target_mode, source_items, source_item, target_folder_id, target_subpath, user_id } = req.body;
      const itemsToProcess = source_items && Array.isArray(source_items) ? source_items : (source_item ? [source_item] : []);

      if (itemsToProcess.length === 0 || !action) {
        return res.status(400).json({ success: false, message: 'Geçersiz kopyalama parametreleri.' });
      }

      for (const itemToCopy of itemsToProcess) {
        if (source_mode === 'storage') {
          const srcPath = resolveStoragePath(itemToCopy.id);
          
          if (target_mode === 'storage') {
            // Storage -> Storage (With unique naming like Windows Explorer)
            const targetBase = resolveStoragePath(target_subpath || '');
            const destName = getUniqueDiskName(targetBase, itemToCopy.name);
            const destPath = `${targetBase.replace(/\/+$/, '')}/${destName}`;

            if (fsSync.existsSync(srcPath)) {
              if (action === 'cut') {
                await fs.rename(srcPath, destPath).catch(async () => {
                  await fs.cp(srcPath, destPath, { recursive: true });
                  await fs.rm(srcPath, { recursive: true, force: true });
                });
              } else {
                await fs.cp(srcPath, destPath, { recursive: true });
              }
            }
          } else {
            // Storage -> DB (With unique naming)
            const topName = await getUniqueDbName(user_id, target_folder_id, itemToCopy.name);

            async function copyStorageToDb(itemRelPath, parentId, overrideName = null) {
              const fullP = resolveStoragePath(itemRelPath);
              const stat = await fs.stat(fullP);
              const basename = overrideName || path.basename(itemRelPath);

              if (stat.isDirectory()) {
                const [ins] = await pool.execute(
                  'INSERT INTO user_files (user_id, parent_id, type, name) VALUES (?, ?, ?, ?)',
                  [user_id, parentId || null, 'folder', basename]
                );
                const newFolderId = ins.insertId;
                const children = await fs.readdir(fullP);
                for (const child of children) {
                  await copyStorageToDb(`${itemRelPath}/${child}`, newFolderId);
                }
              } else {
                const ext = path.extname(basename);
                const uniqueFileName = `${basename.replace(ext, '')}-${Date.now()}${ext}`;
                const destLocal = path.join(filesDir, uniqueFileName);
                await fs.copyFile(fullP, destLocal);

                await pool.execute(
                  'INSERT INTO user_files (user_id, parent_id, type, name, file_path, size) VALUES (?, ?, ?, ?, ?, ?)',
                  [user_id, parentId || null, 'file', basename, uniqueFileName, stat.size]
                );
              }
            }

            await copyStorageToDb(itemToCopy.id, target_folder_id, topName);

            if (action === 'cut') {
              await fs.rm(srcPath, { recursive: true, force: true }).catch(() => {});
            }
          }
        } else {
          if (target_mode === 'storage') {
            // DB -> Storage (With unique naming)
            const targetBase = resolveStoragePath(target_subpath || '');
            const topName = getUniqueDiskName(targetBase, itemToCopy.name);

            async function copyDbToStorage(dbFileId, currentSubPath, overrideName = null) {
              const [rows] = await pool.query('SELECT * FROM user_files WHERE id = ?', [dbFileId]);
              if (rows.length === 0) return;
              const item = rows[0];
              const destName = overrideName || item.name;
              const targetBaseDir = resolveStoragePath(currentSubPath || '');
              const destPath = `${targetBaseDir.replace(/\/+$/, '')}/${destName}`;

              if (item.type === 'folder') {
                if (!fsSync.existsSync(destPath)) {
                  await fs.mkdir(destPath, { recursive: true });
                }
                const [children] = await pool.query('SELECT id FROM user_files WHERE parent_id = ?', [item.id]);
                for (const child of children) {
                  await copyDbToStorage(child.id, `${currentSubPath ? currentSubPath + '/' : ''}${destName}`);
                }
              } else if (item.type === 'file') {
                if (item.file_path) {
                  const srcLocal = path.join(filesDir, item.file_path);
                  if (fsSync.existsSync(srcLocal)) {
                    await fs.copyFile(srcLocal, destPath);
                  }
                }
              } else if (item.type === 'note') {
                const noteFile = `${destPath}.txt`;
                await fs.writeFile(noteFile, item.content || '', 'utf8');
              }
            }

            await copyDbToStorage(itemToCopy.id, target_subpath, topName);

            if (action === 'cut') {
              await pool.execute('DELETE FROM user_files WHERE id = ?', [itemToCopy.id]);
            }
          } else {
            // DB -> DB (With unique naming)
            const topName = await getUniqueDbName(user_id, target_folder_id, itemToCopy.name);

            if (action === 'cut') {
              await pool.execute('UPDATE user_files SET parent_id = ?, name = ? WHERE id = ?', [target_folder_id || null, topName, itemToCopy.id]);
            } else {
              async function duplicateDbTree(fileId, newParentId, overrideName = null) {
                const [rows] = await pool.query('SELECT * FROM user_files WHERE id = ?', [fileId]);
                if (rows.length === 0) return;
                const item = rows[0];
                const destName = overrideName || item.name;

                let newFilePath = null;
                if (item.type === 'file' && item.file_path) {
                  const oldLocal = path.join(filesDir, item.file_path);
                  const ext = path.extname(item.file_path);
                  newFilePath = `${path.basename(item.file_path, ext)}-copy-${Date.now()}${ext}`;
                  const newLocal = path.join(filesDir, newFilePath);
                  if (fsSync.existsSync(oldLocal)) {
                    await fs.copyFile(oldLocal, newLocal);
                  }
                }

                const [ins] = await pool.execute(
                  'INSERT INTO user_files (user_id, parent_id, type, name, content, file_path, size) VALUES (?, ?, ?, ?, ?, ?, ?)',
                  [user_id, newParentId || null, item.type, destName, item.content || null, newFilePath, item.size || 0]
                );

                if (item.type === 'folder') {
                  const [children] = await pool.query('SELECT id FROM user_files WHERE parent_id = ?', [item.id]);
                  for (const child of children) {
                    await duplicateDbTree(child.id, ins.insertId);
                  }
                }
              }

              await duplicateDbTree(itemToCopy.id, target_folder_id, topName);
            }
          }
        }
      }

      emit.safeEmit('files-updated', { user_id });
      res.json({ success: true });
    } catch (err) {
      console.error('[POST /api/files/paste]', err);
      res.status(500).json({ success: false, message: err.message });
    }
  };

  app.post('/api/files/paste', handlePasteFiles);
  app.post('/api/files/storage/paste', handlePasteFiles);

  // ── Chat file upload ──
  app.post('/api/chat/upload', upload.single('file'), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ success: false, message: 'Dosya seçilmedi' });
      const originalNameUtf8 = Buffer.from(req.file.originalname, 'latin1').toString('utf8');
      res.json({
        success: true,
        filename: originalNameUtf8,
        filepath: `/files/${req.file.filename}`,
        mimetype: req.file.mimetype,
        size: req.file.size
      });
    } catch (err) {
      console.error('[POST /api/chat/upload]', err);
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // ── Network Storage (\\172.16.1.97\Storage) ──
  const { exec } = require('child_process');
  const DEFAULT_NETWORK_STORAGE = process.platform === 'win32' ? '//172.16.1.97/Storage' : '/mnt/storage';

  let isNetUseAttempted = false;
  function ensureNetworkShareAuth() {
    if (isNetUseAttempted) return;
    isNetUseAttempted = true;
    const netUser = process.env.NETWORK_STORAGE_USER || 'default';
    const netPass = process.env.NETWORK_STORAGE_PASS || 'default';
    const rawPath = process.env.NETWORK_STORAGE_PATH || '//172.16.1.97/Storage';

    if (process.platform === 'win32') {
      const netPath = rawPath.replace(/\//g, '\\');
      try {
        exec(`net use "${netPath}" "${netPass}" /user:"${netUser}"`, (err) => {
          if (err) {
            console.log('[Network Storage Win] net use note:', err.message);
          } else {
            console.log('[Network Storage Win] Connected SMB share:', netPath);
          }
        });
      } catch (e) {}
    } else {
      const mountDir = '/mnt/storage';
      const uncPath = rawPath.startsWith('//') ? rawPath : '//' + rawPath.replace(/^[\/\\]+/, '');
      try {
        if (!fsSync.existsSync(mountDir)) {
          exec(`mkdir -p ${mountDir}`, () => {});
        }
        exec(`mount -t cifs "${uncPath}" "${mountDir}" -o username="${netUser}",password="${netPass}",file_mode=0777,dir_mode=0777`, (err) => {
          if (err) {
            console.log('[Network Storage Linux] mount note:', err.message);
          } else {
            console.log('[Network Storage Linux] Connected CIFS mount:', mountDir);
          }
        });
      } catch (e) {}
    }
  }

  let isWatcherInitialized = false;
  let watcherDebounceTimer = null;
  function initStorageWatcher() {
    if (isWatcherInitialized) return;
    isWatcherInitialized = true;
    try {
      const storagePath = getStorageBasePath();
      if (fsSync.existsSync(storagePath)) {
        fsSync.watch(storagePath, { recursive: true }, (_eventType, _filename) => {
          if (watcherDebounceTimer) clearTimeout(watcherDebounceTimer);
          watcherDebounceTimer = setTimeout(() => {
            emit.safeEmit('files-updated', { is_storage: true });
          }, 300);
        });
      }
    } catch (e) {}
  }

  function getStorageBasePath() {
    ensureNetworkShareAuth();
    let configured = process.env.NETWORK_STORAGE_PATH || DEFAULT_NETWORK_STORAGE;
    
    try {
      if (fsSync.existsSync(configured)) {
        return configured;
      }
    } catch (e) {}

    if (process.platform !== 'win32') {
      if (fsSync.existsSync('/mnt/storage')) return '/mnt/storage';
      if (fsSync.existsSync('/mnt/Storage')) return '/mnt/Storage';
    }

    const fallback = path.join(filesDir, '..', 'storage_files').replace(/\\/g, '/');
    if (!fsSync.existsSync(fallback)) {
      fsSync.mkdirSync(fallback, { recursive: true });
    }
    return fallback;
  }

  // Initialize watcher after functions are defined
  setTimeout(() => initStorageWatcher(), 2000);

  function resolveStoragePath(subpath = '') {
    const basePath = getStorageBasePath();
    if (!subpath) return basePath;
    const safeSub = subpath.replace(/\\/g, '/').replace(/^(\.\.[\/])+/g, '').replace(/^\/+/g, '');
    const full = `${basePath.replace(/\/+$/, '')}/${safeSub}`;
    return full;
  }

  const storageUpload = multer({
    storage: multer.diskStorage({
      destination: (req, _file, cb) => {
        const subpath = req.query.subpath || req.body.subpath || '';
        const target = resolveStoragePath(subpath);
        if (!fsSync.existsSync(target)) {
          fsSync.mkdirSync(target, { recursive: true });
        }
        cb(null, target);
      },
      filename: (_req, file, cb) => {
        const originalNameUtf8 = Buffer.from(file.originalname, 'latin1').toString('utf8');
        cb(null, originalNameUtf8);
      }
    })
  });

  const handleGetStorageFiles = async (req, res) => {
    try {
      const subpath = req.query.subpath || '';
      const targetDir = resolveStoragePath(subpath);

      if (!fsSync.existsSync(targetDir)) {
        return res.json({ success: true, data: [], basePath: getStorageBasePath(), subpath });
      }

      // Check active public shares for storage files
      const [pubShares] = await pool.query(
        `SELECT storage_path FROM public_file_shares 
         WHERE source_mode = 'storage' AND is_active = 1 
           AND (expires_at IS NULL OR expires_at > NOW()) 
           AND (download_limit IS NULL OR download_count < download_limit)`
      ).catch(() => [[]]);
      const activeStoragePubShares = new Set((pubShares || []).map(p => p.storage_path));

      const entries = await fs.readdir(targetDir, { withFileTypes: true });
      const list = [];

      for (const entry of entries) {
        try {
          const fullItemPath = `${targetDir.replace(/\/+$/, '')}/${entry.name}`;
          const stat = await fs.stat(fullItemPath);
          const relPath = subpath ? `${subpath.replace(/\/+$/, '')}/${entry.name}` : entry.name;
          list.push({
            id: relPath,
            name: entry.name,
            type: entry.isDirectory() ? 'folder' : 'file',
            size: stat.size,
            updated_at: stat.mtime.toISOString(),
            is_storage: true,
            user_id: 0,
            owner_name: 'Storage Server',
            public_share_count: activeStoragePubShares.has(relPath) ? 1 : 0
          });
        } catch (e) {}
      }

      list.sort((a, b) => (b.type === 'folder') - (a.type === 'folder') || a.name.localeCompare(b.name, 'tr'));
      res.json({ success: true, data: list, basePath: getStorageBasePath(), subpath });
    } catch (err) {
      console.error('[GET /api/storage/files]', err);
      res.status(500).json({ success: false, message: err.message });
    }
  };

  app.get('/api/storage/files', handleGetStorageFiles);
  app.get('/api/files/storage/list', handleGetStorageFiles);

  const handleStorageUpload = async (req, res) => {
    try {
      const uploadedFiles = req.files || [];
      const subpath = req.query.subpath || req.body.subpath || '';
      res.json({ success: true, count: uploadedFiles.length, subpath });
    } catch (err) {
      console.error('[POST /api/storage/upload]', err);
      res.status(500).json({ success: false, message: err.message });
    }
  };

  app.post('/api/storage/upload', storageUpload.any(), handleStorageUpload);
  app.post('/api/files/storage/upload', storageUpload.any(), handleStorageUpload);

  const handleStorageFolder = async (req, res) => {
    try {
      const { name, subpath } = req.body;
      if (!name) return res.status(400).json({ success: false, message: 'Klasör adı eksik' });
      const target = `${resolveStoragePath(subpath || '').replace(/\/+$/, '')}/${name}`;
      await fs.mkdir(target, { recursive: true });
      res.json({ success: true });
    } catch (err) {
      console.error('[POST /api/storage/folder]', err);
      res.status(500).json({ success: false, message: err.message });
    }
  };

  app.post('/api/storage/folder', handleStorageFolder);
  app.post('/api/files/storage/folder', handleStorageFolder);

  const handleStorageDelete = async (req, res) => {
    try {
      const { item_path } = req.body;
      if (!item_path) return res.status(400).json({ success: false, message: 'item_path eksik' });
      const target = resolveStoragePath(item_path);
      const stat = await fs.stat(target);
      if (stat.isDirectory()) {
        await fs.rm(target, { recursive: true, force: true });
      } else {
        await fs.unlink(target);
      }
      res.json({ success: true });
    } catch (err) {
      console.error('[DELETE /api/storage/item]', err);
      res.status(500).json({ success: false, message: err.message });
    }
  };

  app.delete('/api/storage/item', handleStorageDelete);
  app.delete('/api/files/storage/item', handleStorageDelete);

  const handleStorageRename = async (req, res) => {
    try {
      const { item_path, new_name } = req.body;
      if (!item_path || !new_name) return res.status(400).json({ success: false, message: 'Eksik parametre' });
      const oldTarget = resolveStoragePath(item_path);
      const parentDir = path.dirname(oldTarget);
      const newTarget = path.join(parentDir, new_name);
      await fs.rename(oldTarget, newTarget);
      res.json({ success: true });
    } catch (err) {
      console.error('[PUT /api/storage/item]', err);
      res.status(500).json({ success: false, message: err.message });
    }
  };

  app.put('/api/storage/item', handleStorageRename);
  app.put('/api/files/storage/item', handleStorageRename);
  const handleStorageDownload = async (req, res) => {
    try {
      const itemPath = req.query.item_path;
      if (!itemPath) return res.status(400).send('Dosya yolu eksik');
      const target = resolveStoragePath(itemPath);
      if (!fsSync.existsSync(target)) {
        return res.status(404).send('Ağ deposundaki dosya bulunamadı.');
      }

      const ext = path.extname(target).toLowerCase();
      const mimeTypes = {
        '.pdf': 'application/pdf',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.gif': 'image/gif',
        '.webp': 'image/webp',
        '.svg': 'image/svg+xml',
        '.txt': 'text/plain; charset=utf-8',
        '.log': 'text/plain; charset=utf-8',
        '.json': 'application/json'
      };

      const filename = path.basename(target);
      if (mimeTypes[ext]) {
        res.setHeader('Content-Type', mimeTypes[ext]);
        res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(filename)}"`);
        return res.sendFile(target);
      }

      res.download(target, filename);
    } catch (err) {
      console.error('[Storage Download]', err);
      res.status(500).send('İndirme hatası: ' + err.message);
    }
  };

  app.get('/api/storage/download', handleStorageDownload);
  app.get('/api/files/storage/download', handleStorageDownload);
  app.get('/api/storage/view', handleStorageDownload);
  app.get('/api/files/storage/view', handleStorageDownload);

  // ── PUBLIC SHARE SYSTEM ──
  // 1. Get active public shares for a file/storage item
  const handleGetPublicShares = async (req, res) => {
    try {
      const { file_id, storage_path, source_mode } = req.query;
      let query = 'SELECT * FROM public_file_shares WHERE is_active = 1 ';
      const params = [];

      if (source_mode === 'storage' && storage_path) {
        query += 'AND source_mode = "storage" AND storage_path = ? ';
        params.push(storage_path);
      } else if (file_id) {
        query += 'AND source_mode = "db" AND file_id = ? ';
        params.push(file_id);
      } else {
        return res.json({ success: true, data: [] });
      }

      const [rows] = await pool.query(query, params);
      const data = rows.map(r => ({
        ...r,
        has_password: !!r.password_hash,
        is_expired: r.expires_at ? new Date(r.expires_at) < new Date() : false,
        is_limit_reached: r.download_limit ? r.download_count >= r.download_limit : false
      }));
      res.json({ success: true, data });
    } catch (err) {
      console.error('[GET /api/files/public-shares]', err);
      res.status(500).json({ success: false, message: err.message });
    }
  };

  app.get('/api/files/public-shares', handleGetPublicShares);
  app.get('/api/files/storage/public-shares', handleGetPublicShares);

  // 2. Create public share link
  const handleCreatePublicShare = async (req, res) => {
    try {
      const {
        source_mode = 'db',
        file_id = null,
        storage_path = null,
        name,
        type = 'file',
        size = 0,
        created_by,
        password = null,
        expires_in_hours = null,
        download_limit = null
      } = req.body;

      if (!name) {
        return res.status(400).json({ success: false, message: 'İsim gereklidir.' });
      }

      // Generate 32-byte secure random token (64 hex characters)
      const token = crypto.randomBytes(32).toString('hex');
      
      let password_hash = null;
      if (password && password.trim()) {
        password_hash = await bcrypt.hash(password.trim(), 10);
      }

      let expires_at = null;
      if (expires_in_hours && !isNaN(expires_in_hours) && Number(expires_in_hours) > 0) {
        expires_at = new Date(Date.now() + Number(expires_in_hours) * 60 * 60 * 1000);
      }

      const [result] = await pool.execute(
        `INSERT INTO public_file_shares 
         (token, source_mode, file_id, storage_path, name, type, size, created_by, password_hash, expires_at, download_limit, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
        [
          token,
          source_mode,
          file_id ? Number(file_id) : null,
          storage_path || null,
          name,
          type,
          size || 0,
          created_by || 0,
          password_hash,
          expires_at,
          download_limit ? Number(download_limit) : null
        ]
      );

      res.json({
        success: true,
        data: {
          id: result.insertId,
          token,
          name,
          type,
          has_password: !!password_hash,
          expires_at,
          download_limit,
          download_count: 0
        }
      });
    } catch (err) {
      console.error('[POST /api/files/public-shares]', err);
      res.status(500).json({ success: false, message: err.message });
    }
  };

  app.post('/api/files/public-shares', handleCreatePublicShare);
  app.post('/api/files/storage/public-shares', handleCreatePublicShare);

  // 3. Delete/Revoke public share link
  const handleDeletePublicShare = async (req, res) => {
    try {
      const { id } = req.params;
      await pool.execute('UPDATE public_file_shares SET is_active = 0 WHERE id = ?', [id]);
      res.json({ success: true });
    } catch (err) {
      console.error('[DELETE /api/files/public-shares/:id]', err);
      res.status(500).json({ success: false, message: err.message });
    }
  };

  app.delete('/api/files/public-shares/:id', handleDeletePublicShare);
  app.delete('/api/files/storage/public-shares/:id', handleDeletePublicShare);

  // 4. Public endpoint: Get share metadata (no auth needed)
  app.get('/api/public/share/:token/info', async (req, res) => {
    try {
      const { token } = req.params;
      const [rows] = await pool.query(
        `SELECT s.*, COALESCE(u.name, u.username, 'Sistem Yöneticisi') as owner_name
         FROM public_file_shares s
         LEFT JOIN cached_users u ON s.created_by = u.id
         WHERE s.token = ? AND s.is_active = 1`,
        [token]
      );

      if (rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Paylaşım bağlantısı bulunamadı veya iptal edilmiş.' });
      }

      const share = rows[0];
      const is_expired = share.expires_at ? new Date(share.expires_at) < new Date() : false;
      const is_limit_reached = share.download_limit ? share.download_count >= share.download_limit : false;

      if (is_expired) {
        return res.status(410).json({ success: false, message: 'Bu paylaşım bağlantısının süresi dolmuş.', is_expired: true });
      }
      if (is_limit_reached) {
        return res.status(410).json({ success: false, message: 'Bu paylaşım bağlantısının indirme limiti dolmuş.', is_limit_reached: true });
      }

      // If folder, list immediate children
      let children = [];
      if (share.type === 'folder') {
        if (share.source_mode === 'storage' && share.storage_path) {
          const targetDir = resolveStoragePath(share.storage_path);
          if (fsSync.existsSync(targetDir)) {
            const entries = await fs.readdir(targetDir, { withFileTypes: true });
            for (const entry of entries) {
              const fullP = `${targetDir.replace(/\/+$/, '')}/${entry.name}`;
              const stat = await fs.stat(fullP).catch(() => ({ size: 0 }));
              children.push({
                name: entry.name,
                type: entry.isDirectory() ? 'folder' : 'file',
                size: stat.size || 0
              });
            }
          }
        } else if (share.file_id) {
          const [dbChildren] = await pool.query('SELECT name, type, size FROM user_files WHERE parent_id = ?', [share.file_id]);
          children = dbChildren;
        }
      }

      res.json({
        success: true,
        data: {
          token: share.token,
          name: share.name,
          type: share.type,
          size: share.size,
          has_password: !!share.password_hash,
          created_at: share.created_at,
          expires_at: share.expires_at,
          download_count: share.download_count,
          download_limit: share.download_limit,
          owner_name: share.owner_name || 'Sistem Yöneticisi',
          children
        }
      });
    } catch (err) {
      console.error('[GET /api/public/share/:token/info]', err);
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // 5. Public endpoint: Verify password
  app.post('/api/public/share/:token/verify', async (req, res) => {
    try {
      const { token } = req.params;
      const { password } = req.body;

      const [rows] = await pool.query('SELECT * FROM public_file_shares WHERE token = ? AND is_active = 1', [token]);
      if (rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Paylaşım bağlantısı bulunamadı.' });
      }

      const share = rows[0];
      if (!share.password_hash) {
        return res.json({ success: true, verified: true });
      }

      if (!password) {
        return res.status(401).json({ success: false, message: 'Lütfen şifreyi girin.' });
      }

      const isMatch = await bcrypt.compare(password, share.password_hash);
      if (!isMatch) {
        return res.status(401).json({ success: false, message: 'Girdiğiniz şifre hatalı!' });
      }

      res.json({ success: true, verified: true });
    } catch (err) {
      console.error('[POST /api/public/share/:token/verify]', err);
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // 6. Public endpoint: Download file or folder ZIP
  const handleDownloadPublicShare = async (req, res) => {
    try {
      const { token } = req.params;
      const { password, sub_file } = req.query;

      const [rows] = await pool.query('SELECT * FROM public_file_shares WHERE token = ? AND is_active = 1', [token]);
      if (rows.length === 0) {
        return res.status(404).send('Paylaşım bağlantısı bulunamadı.');
      }

      const share = rows[0];

      if (share.expires_at && new Date(share.expires_at) < new Date()) {
        return res.status(410).send('Bu paylaşım bağlantısının süresi dolmuş.');
      }
      if (share.download_limit && share.download_count >= share.download_limit) {
        return res.status(410).send('Bu paylaşım bağlantısının indirme limiti dolmuş.');
      }

      if (share.password_hash) {
        if (!password) return res.status(401).send('Şifre gereklidir.');
        const isMatch = await bcrypt.compare(password, share.password_hash);
        if (!isMatch) return res.status(401).send('Hatalı şifre.');
      }

      // Increment download count
      await pool.execute('UPDATE public_file_shares SET download_count = download_count + 1 WHERE id = ?', [share.id]);

      // If single file
      if (share.type === 'file') {
        if (share.source_mode === 'storage' && share.storage_path) {
          const filePath = resolveStoragePath(share.storage_path);
          if (fsSync.existsSync(filePath)) {
            return res.download(filePath, share.name);
          } else {
            return res.status(404).send('Ağ deposundaki dosya bulunamadı.');
          }
        } else if (share.file_id) {
          const [fileRows] = await pool.query('SELECT file_path, name FROM user_files WHERE id = ?', [share.file_id]);
          if (fileRows.length > 0 && fileRows[0].file_path) {
            const filePath = path.join(filesDir, fileRows[0].file_path);
            if (fsSync.existsSync(filePath)) {
              return res.download(filePath, fileRows[0].name || share.name);
            } else {
              return res.status(404).send('Sunucu diskindeki dosya bulunamadı.');
            }
          }
        }
      }

      // If note
      if (share.type === 'note' && share.file_id) {
        const [noteRows] = await pool.query('SELECT content, name FROM user_files WHERE id = ?', [share.file_id]);
        if (noteRows.length > 0) {
          res.setHeader('Content-Type', 'text/plain; charset=utf-8');
          res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(noteRows[0].name || 'Not')}.txt"`);
          return res.send(noteRows[0].content || '');
        }
      }

      // If sub_file requested from a shared folder
      if (share.type === 'folder' && sub_file) {
        if (share.source_mode === 'storage' && share.storage_path) {
          const filePath = `${resolveStoragePath(share.storage_path).replace(/\/+$/, '')}/${sub_file.replace(/\\/g, '/').replace(/^\/+/, '')}`;
          if (fsSync.existsSync(filePath)) {
            return res.download(filePath, path.basename(sub_file));
          } else {
            return res.status(404).send('Klasör içi dosya bulunamadı.');
          }
        } else if (share.file_id) {
          const [subRows] = await pool.query('SELECT file_path, name FROM user_files WHERE parent_id = ? AND name = ?', [share.file_id, sub_file]);
          if (subRows.length > 0 && subRows[0].file_path) {
            const filePath = path.join(filesDir, subRows[0].file_path);
            if (fsSync.existsSync(filePath)) {
              return res.download(filePath, subRows[0].name);
            }
          }
        }
      }

      // If entire folder download -> Stream ZIP archive!
      if (share.type === 'folder') {
        const archive = createZipStream({ zlib: { level: 6 } });
        if (!archive) {
          return res.status(500).send('Sunucuda ZIP modülü (archiver) başlatılamadı.');
        }

        const asciiName = (share.name || 'Paylasilan_Klasor')
          .replace(/[çÇ]/g, 'c')
          .replace(/[ğĞ]/g, 'g')
          .replace(/[ıİ]/g, 'i')
          .replace(/[öÖ]/g, 'o')
          .replace(/[şŞ]/g, 's')
          .replace(/[üÜ]/g, 'u')
          .replace(/[^a-zA-Z0-9_\-]/g, '_');
        const utf8Name = encodeURIComponent(share.name || 'Paylasilan_Klasor');

        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename="${asciiName}.zip"; filename*=UTF-8''${utf8Name}.zip`);

        archive.on('warning', (err) => {
          console.warn('[Archiver warning]', err);
        });
        archive.on('error', (err) => {
          console.error('[Archiver error]', err);
          if (!res.headersSent) res.status(500).end();
        });

        archive.pipe(res);

        if (share.source_mode === 'storage' && share.storage_path) {
          const folderPath = resolveStoragePath(share.storage_path);
          if (fsSync.existsSync(folderPath)) {
            archive.directory(folderPath, false);
          }
        } else if (share.file_id) {
          async function addDbFolderToArchive(folderId, currentZipPath) {
            const [children] = await pool.query('SELECT * FROM user_files WHERE parent_id = ?', [folderId]);
            for (const item of children) {
              const itemZipPath = currentZipPath ? `${currentZipPath}/${item.name}` : item.name;
              if (item.type === 'folder') {
                await addDbFolderToArchive(item.id, itemZipPath);
              } else if (item.type === 'file' && item.file_path) {
                const physicalP = path.join(filesDir, item.file_path);
                if (fsSync.existsSync(physicalP)) {
                  archive.file(physicalP, { name: itemZipPath });
                }
              } else if (item.type === 'note') {
                archive.append(item.content || '', { name: `${itemZipPath}.txt` });
              }
            }
          }
          await addDbFolderToArchive(share.file_id, '');
        }

        await archive.finalize();
        return;
      }

      res.status(404).send('Dosya bulunamadı.');
    } catch (err) {
      console.error('[GET /api/public/share/:token/download]', err);
      if (!res.headersSent) res.status(500).send('İndirme hatası: ' + err.message);
    }
  };

  app.get('/api/public/share/:token/download', handleDownloadPublicShare);
  app.get('/api/files/public/share/:token/download', handleDownloadPublicShare);
  app.get('/api/files/storage/public/share/:token/download', handleDownloadPublicShare);

  // 7. Public endpoint: View / Preview file in browser
  app.get('/api/public/share/:token/view', async (req, res) => {
    try {
      const { token } = req.params;
      const { password, sub_file } = req.query;

      const [rows] = await pool.query('SELECT * FROM public_file_shares WHERE token = ? AND is_active = 1', [token]);
      if (rows.length === 0) return res.status(404).send('Paylaşım bağlantısı bulunamadı.');

      const share = rows[0];
      if (share.expires_at && new Date(share.expires_at) < new Date()) {
        return res.status(410).send('Süresi dolmuş.');
      }
      if (share.password_hash) {
        if (!password) return res.status(401).send('Şifre gereklidir.');
        const isMatch = await bcrypt.compare(password, share.password_hash);
        if (!isMatch) return res.status(401).send('Hatalı şifre.');
      }

      let targetPath = null;

      if (share.type === 'file') {
        if (share.source_mode === 'storage' && share.storage_path) {
          targetPath = resolveStoragePath(share.storage_path);
        } else if (share.file_id) {
          const [fileRows] = await pool.query('SELECT file_path FROM user_files WHERE id = ?', [share.file_id]);
          if (fileRows.length > 0 && fileRows[0].file_path) {
            targetPath = path.join(filesDir, fileRows[0].file_path);
          }
        }
      } else if (share.type === 'folder' && sub_file) {
        if (share.source_mode === 'storage' && share.storage_path) {
          targetPath = `${resolveStoragePath(share.storage_path).replace(/\/+$/, '')}/${sub_file.replace(/\\/g, '/').replace(/^\/+/, '')}`;
        }
      }

      if (targetPath && fsSync.existsSync(targetPath)) {
        res.sendFile(path.resolve(targetPath));
      } else {
        res.status(404).send('Dosya bulunamadı.');
      }
    } catch (err) {
      res.status(500).send('Görüntüleme hatası: ' + err.message);
    }
  });
};
