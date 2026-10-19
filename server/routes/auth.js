'use strict';

const bcrypt = require('bcryptjs');

module.exports = function registerAuth(app, { pool, helpers }) {
  const { verifyPassword, insertAuditLog, dbError } = helpers;

  async function doLogin(req, res) {
    try {
      const username = req.body.username || req.body.user_name || req.body.usernameInput;
      const password = req.body.password || req.body.sifre || req.body.passwordInput;

      if (!username || !password) {
        return res.status(400).json({ success: false, message: 'Kullanıcı adı ve şifre gereklidir.' });
      }

      const [rows] = await pool.execute(
        `SELECT u.*, r.name AS role_name
         FROM users u
         LEFT JOIN roles r ON u.role_id = r.id
         WHERE u.username = ? AND COALESCE(u.is_active, 1) = 1
         LIMIT 1`,
        [username]
      );

      if (!rows.length) {
        return res.status(401).json({ success: false, message: 'Kullanıcı bulunamadı.' });
      }

      const user = rows[0];
      const passwordValue = user.password_hash || user.password || user.sifre;
      const passwordOk = await verifyPassword(password, passwordValue);
      if (!passwordOk) {
        return res.status(401).json({ success: false, message: 'Şifre hatalı.' });
      }

      await pool.execute('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?', [user.id]).catch(() => {});

      const [permissions] = await pool.execute(
        'SELECT * FROM permissions WHERE role_id = ?',
        [user.role_id]
      ).catch(() => [[]]);

      delete user.password_hash;
      delete user.password;
      delete user.sifre;

      const isSuper = Boolean(user.is_superadmin || user.username === 'admin' || Number(user.id) === 1);

      res.json({
        success: true,
        user: {
          ...user,
          is_superadmin: isSuper ? 1 : 0,
          name: user.full_name || user.name || user.username,
          full_name: user.full_name || user.name || user.username,
          role: user.role_name,
        },
        permissions,
      });
    } catch (err) {
      console.error('[login]', err);
      res.status(500).json({ success: false, message: err.message });
    }
  }

  app.post('/api/login', doLogin);
  app.post('/api/auth/login', doLogin);

  app.post('/api/auth/set-guide-disabled', async (req, res) => {
    try {
      const { user_id, username, disabled } = req.body;
      const val = disabled ? 1 : 0;
      if (user_id) {
        await pool.execute('UPDATE users SET guide_disabled = ? WHERE id = ?', [val, user_id]);
      } else if (username) {
        await pool.execute('UPDATE users SET guide_disabled = ? WHERE username = ?', [val, username]);
      }
      res.json({ success: true, guide_disabled: val });
    } catch (err) {
      dbError(res, err, 'auth:set-guide-disabled');
    }
  });

  const verifyPasswordHandler = async (req, res) => {
    try {
      const username = req.body.username || req.body.user_name || req.body.usernameInput;
      const password = req.body.password || req.body.sifre || req.body.passwordInput;

      if (!username || !password) {
        return res.status(400).json({ success: false, message: 'Kullanıcı adı ve şifre gereklidir.' });
      }

      const [rows] = await pool.execute(
        `SELECT u.*, r.name AS role_name
         FROM users u
         LEFT JOIN roles r ON u.role_id = r.id
         WHERE u.username = ? AND COALESCE(u.is_active, 1) = 1
         LIMIT 1`,
        [username]
      );

      if (!rows.length) {
        return res.status(401).json({ success: false, message: 'Kullanıcı bulunamadı.' });
      }

      const user = rows[0];
      const passwordValue = user.password_hash || user.password || user.sifre;
      const passwordOk = await verifyPassword(password, passwordValue);
      if (!passwordOk) {
        return res.status(401).json({ success: false, message: 'Girdiğiniz yönetici şifresi hatalı!' });
      }

      res.json({ success: true, message: 'Şifre doğrulandı.' });
    } catch (err) {
      console.error('[verify-password]', err);
      res.status(500).json({ success: false, message: err.message });
    }
  };

  app.post('/api/auth/verify-password', verifyPasswordHandler);
  app.post('/api/verify-password', verifyPasswordHandler);
  app.post('/api/settings/verify-password', verifyPasswordHandler);

  app.post('/api/auth/get-users', async (req, res) => {
    try {
      const { showInactive } = req.body;
      const filterExpr = showInactive ? '' : 'WHERE COALESCE(u.is_active, 1) = 1';
      const [rows] = await pool.execute(`
        SELECT u.id, u.username, u.full_name, u.role_id, u.email, u.phone, u.is_active, u.last_login, u.created_at, u.manager_id, u.allowed_locations,
               CASE WHEN u.is_superadmin = 1 OR u.username = 'admin' OR u.id = 1 THEN 1 ELSE 0 END AS is_superadmin,
               r.name AS role_name, m.full_name AS manager_name, m.username AS manager_username
        FROM users u
        LEFT JOIN roles r ON u.role_id = r.id
        LEFT JOIN users m ON u.manager_id = m.id
        ${filterExpr}
        ORDER BY u.id ASC
      `);
      res.json({ success: true, data: rows });
    } catch (err) {
      dbError(res, err, 'auth:get-users');
    }
  });

  // Tablo & Varsayılan Rol Yetkileri Hazırlığı
  (async () => {
    try {
      try {
        const [userCols] = await pool.query("SHOW COLUMNS FROM users LIKE 'manager_id'");
        if (userCols.length === 0) {
          await pool.query("ALTER TABLE users ADD COLUMN manager_id INT NULL DEFAULT NULL");
        }
      } catch (e) {}

      try {
        const [superCols] = await pool.query("SHOW COLUMNS FROM users LIKE 'is_superadmin'");
        if (superCols.length === 0) {
          await pool.query("ALTER TABLE users ADD COLUMN is_superadmin TINYINT(1) DEFAULT 0");
        }
        await pool.query("UPDATE users SET is_superadmin = 1 WHERE username = 'admin' OR id = 1");
      } catch (e) {}

      try {
        const [avatarCols] = await pool.query("SHOW COLUMNS FROM users LIKE 'avatar'");
        if (avatarCols.length === 0) {
          await pool.query("ALTER TABLE users ADD COLUMN avatar MEDIUMTEXT NULL DEFAULT NULL");
        }
      } catch (e) {}

      try {
        const [roleCols] = await pool.query("SHOW COLUMNS FROM roles LIKE 'sort_order'");
        if (roleCols.length === 0) {
          await pool.query("ALTER TABLE roles ADD COLUMN sort_order INT DEFAULT 0");
        }
      } catch (e) {}

      await pool.execute(`
        CREATE TABLE IF NOT EXISTS roles (
          id INT AUTO_INCREMENT PRIMARY KEY,
          name VARCHAR(50) NOT NULL UNIQUE,
          description VARCHAR(255),
          sort_order INT DEFAULT 0
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);
      
      await pool.execute(`INSERT IGNORE INTO roles (id, name, description, sort_order) VALUES 
        (1, 'Yönetici', 'Tam sistem yöneticisi yetkilerine sahiptir.', 0),
        (2, 'Kullanıcı', 'Standart operasyonel kullanıcı.', 1)
      `);

      await pool.execute(`
        CREATE TABLE IF NOT EXISTS permissions (
          id INT AUTO_INCREMENT PRIMARY KEY,
          role_id INT NOT NULL,
          module VARCHAR(50) NOT NULL,
          can_view TINYINT DEFAULT 1,
          can_create TINYINT DEFAULT 1,
          can_edit TINYINT DEFAULT 1,
          can_delete TINYINT DEFAULT 1,
          can_admin TINYINT DEFAULT 0,
          UNIQUE KEY role_module (role_id, module)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);

      const [existing] = await pool.execute('SELECT COUNT(*) as count FROM permissions WHERE role_id = 2');
      if (existing[0]?.count === 0) {
        const modules = ['dashboard', 'service', 'tasks', 'toner', 'stock', 'reports', 'maintenance', 'users', 'address_label', 'handover', 'files'];
        for (const m of modules) {
          await pool.execute(
            'INSERT IGNORE INTO permissions (role_id, module, can_view, can_create, can_edit, can_delete, can_admin) VALUES (?, ?, 1, 1, 1, 1, 0)',
            [2, m]
          );
        }
      }
    } catch (e) {
      console.error('[auth init] Migration error:', e.message);
    }
  })();

  app.post('/api/auth/get-roles', async (_req, res) => {
    try {
      const [rows] = await pool.execute('SELECT * FROM roles ORDER BY sort_order ASC, id ASC');
      res.json({ success: true, data: rows });
    } catch (err) {
      dbError(res, err, 'auth:get-roles');
    }
  });

  app.post('/api/auth/get-role-permissions', async (_req, res) => {
    try {
      const [roles] = await pool.execute('SELECT * FROM roles ORDER BY sort_order ASC, id ASC');
      const [permissions] = await pool.execute('SELECT * FROM permissions ORDER BY role_id ASC, module ASC');
      res.json({ success: true, roles, permissions });
    } catch (err) {
      dbError(res, err, 'auth:get-role-permissions');
    }
  });

  app.post('/api/auth/reorder-roles', async (req, res) => {
    try {
      const { roles, actor } = req.body;
      if (!Array.isArray(roles)) {
        return res.status(400).json({ success: false, message: 'Geçersiz rol listesi.' });
      }

      for (let i = 0; i < roles.length; i++) {
        const roleId = typeof roles[i] === 'object' ? roles[i].id : roles[i];
        await pool.execute('UPDATE roles SET sort_order = ? WHERE id = ?', [i, roleId]);
      }

      if (helpers.emit?.safeEmit) {
        helpers.emit.safeEmit('roles-updated', {});
      }

      res.json({ success: true, message: 'Rol sıralaması güncellendi.' });
    } catch (err) {
      dbError(res, err, 'auth:reorder-roles');
    }
  });

  app.post('/api/auth/save-role-permissions', async (req, res) => {
    try {
      const { role_id, permissions, actor } = req.body;
      if (!role_id || !Array.isArray(permissions)) {
        return res.status(400).json({ success: false, message: 'Geçersiz veri' });
      }

      await pool.execute('DELETE FROM permissions WHERE role_id = ?', [role_id]);
      for (const p of permissions) {
        await pool.execute(`
          INSERT INTO permissions (role_id, module, can_view, can_create, can_edit, can_delete, can_admin)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [
          role_id,
          p.module,
          p.can_view ? 1 : 0,
          p.can_create ? 1 : 0,
          p.can_edit ? 1 : 0,
          p.can_delete ? 1 : 0,
          p.can_admin ? 1 : 0
        ]);
      }

      if (helpers.emit?.safeEmit) {
        helpers.emit.safeEmit('user-permissions-updated', { role_id });
      }

      await insertAuditLog(pool, {
        user: actor,
        action: 'UPDATE',
        module: 'settings',
        description: `Rol (ID: ${role_id}) yetkileri güncellendi.`
      });

      res.json({ success: true, message: 'Rol yetkileri güncellendi.' });
    } catch (err) {
      dbError(res, err, 'auth:save-role-permissions');
    }
  });

  app.post('/api/auth/save-role', async (req, res) => {
    try {
      const { id, name, description } = req.body;
      if (!name?.trim()) return res.status(400).json({ success: false, message: 'Rol adı zorunludur' });

      if (id) {
        await pool.execute('UPDATE roles SET name = ?, description = ? WHERE id = ?', [name.trim(), description || null, id]);
        res.json({ success: true, id });
      } else {
        const [result] = await pool.execute('INSERT INTO roles (name, description) VALUES (?, ?)', [name.trim(), description || null]);
        const role_id = result.insertId;
        const modules = ['dashboard', 'service', 'tasks', 'toner', 'stock', 'reports', 'maintenance', 'users', 'address_label', 'handover', 'files'];
        for (const m of modules) {
          await pool.execute(
            'INSERT IGNORE INTO permissions (role_id, module, can_view, can_create, can_edit, can_delete, can_admin) VALUES (?, ?, 1, 1, 1, 1, 0)',
            [role_id, m]
          );
        }
        res.json({ success: true, id: role_id });
      }
    } catch (err) {
      dbError(res, err, 'auth:save-role');
    }
  });

  app.post('/api/auth/delete-role', async (req, res) => {
    let conn;
    try {
      const { id, actor } = req.body;
      if (!id) return res.status(400).json({ success: false, message: 'Rol ID gereklidir.' });
      if (Number(id) === 1) {
        return res.status(400).json({ success: false, message: 'Yönetici (Admin) rolü silinemez.' });
      }

      conn = await pool.getConnection();
      await conn.beginTransaction();

      const [roleRows] = await conn.execute('SELECT * FROM roles WHERE id = ?', [id]);
      const roleName = roleRows[0]?.name || `Rol #${id}`;

      // Bu role sahip kullanıcıları standart 'Kullanıcı' (2) rolüne aktar
      await conn.execute('UPDATE users SET role_id = 2 WHERE role_id = ?', [id]);

      // Yetkileri ve rolü sil
      await conn.execute('DELETE FROM permissions WHERE role_id = ?', [id]);
      await conn.execute('DELETE FROM roles WHERE id = ?', [id]);

      await conn.commit();

      await insertAuditLog(pool, {
        user: actor,
        action: 'DELETE',
        module: 'settings',
        description: `Kullanıcı Rolü silindi: "${roleName}" (Kullanıcılar varsayılan role aktarıldı).`
      });

      res.json({ success: true, message: `"${roleName}" rolü başarıyla silindi.` });
    } catch (err) {
      if (conn) await conn.rollback();
      dbError(res, err, 'auth:delete-role');
    } finally {
      if (conn) conn.release();
    }
  });

  app.post('/api/auth/save-user', async (req, res) => {
    let conn;
    try {
      const { user } = req.body;
      const actor = req.body.actor || user?.actor;
      const isActorSuper = Boolean(actor?.is_superadmin || actor?.username === 'admin' || Number(actor?.id) === 1);
      conn = await pool.getConnection();
      await conn.beginTransaction();

      if (user.id) {
        const [oldRows] = await conn.execute('SELECT * FROM users WHERE id = ?', [user.id]);
        const oldUser = oldRows[0];
        if (!oldUser) {
          return res.json({ success: false, message: 'Kullanıcı bulunamadı.' });
        }

        const isTargetSuper = Boolean(oldUser.is_superadmin || oldUser.username === 'admin' || Number(oldUser.id) === 1);
        if (isTargetSuper && !isActorSuper) {
          return res.json({ success: false, message: 'Süper Yönetici hesabı üzerinde değişiklik yapma yetkiniz yoktur.' });
        }

        const managerId = user.manager_id ? Number(user.manager_id) : null;
        const allowedLocs = user.allowed_locations ? String(user.allowed_locations).trim() : null;
        let sql = 'UPDATE users SET username=?, full_name=?, role_id=?, email=?, is_active=?, manager_id=?, allowed_locations=?';
        const params = [user.username, user.full_name, user.role_id, user.email || null, user.is_active, managerId, allowedLocs];

        if (isActorSuper && user.is_superadmin !== undefined) {
          const superVal = (oldUser.username === 'admin' || Number(oldUser.id) === 1) ? 1 : (Number(user.is_superadmin) ? 1 : 0);
          sql += ', is_superadmin=?';
          params.push(superVal);
        }

        if (user.new_password) {
          sql += ', password_hash=?';
          params.push(bcrypt.hashSync(user.new_password, 10));
        }

        sql += ' WHERE id=?';
        params.push(user.id);

        await conn.execute(sql, params);

        await insertAuditLog(conn, {
          user: actor,
          action: 'UPDATE',
          module: 'users',
          refId: user.id,
          description: `${user.full_name || user.username} kullanıcısı güncellendi.`,
          oldValue: oldUser,
          newValue: { ...user, manager_id: managerId, allowed_locations: allowedLocs }
        });
        await conn.commit();
        res.json({ success: true });
      } else {
        const managerId = user.manager_id ? Number(user.manager_id) : null;
        const allowedLocs = user.allowed_locations ? String(user.allowed_locations).trim() : null;
        const hashedPassword = bcrypt.hashSync(user.new_password, 10);
        const superVal = (isActorSuper && Number(user.is_superadmin)) ? 1 : 0;
        const [result] = await conn.execute(
          'INSERT INTO users (username, password_hash, full_name, role_id, email, is_active, manager_id, allowed_locations, is_superadmin) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [user.username, hashedPassword, user.full_name, user.role_id, user.email || null, user.is_active, managerId, allowedLocs, superVal]
        );

        await insertAuditLog(conn, {
          user: actor,
          action: 'CREATE',
          module: 'users',
          refId: result.insertId,
          description: `${user.full_name || user.username} kullanıcısı oluşturuldu.`,
          newValue: { username: user.username, full_name: user.full_name, role_id: user.role_id, email: user.email || null, is_active: user.is_active, manager_id: managerId, allowed_locations: allowedLocs, is_superadmin: superVal }
        });
        await conn.commit();
        res.json({ success: true, id: result.insertId });
      }
    } catch (err) {
      if (conn) await conn.rollback().catch(() => {});
      console.error('[auth:save-user] error:', err.message);
      res.json({ success: false, message: err.message });
    } finally {
      if (conn) conn.release();
    }
  });

  app.post('/api/auth/delete-user', async (req, res) => {
    let conn;
    try {
      const { id, actor } = req.body;
      conn = await pool.getConnection();
      await conn.beginTransaction();

      const [rows] = await conn.execute('SELECT id, username, full_name, is_superadmin FROM users WHERE id=? LIMIT 1', [id]);
      if (!rows || rows.length === 0) return res.json({ success: false, message: 'Kullanıcı bulunamadı.' });

      const isTargetSuper = Boolean(rows[0].is_superadmin || rows[0].username === 'admin' || Number(rows[0].id) === 1);
      if (isTargetSuper) {
        return res.json({ success: false, message: 'Süper Yönetici hesabı pasif yapılamaz.' });
      }

      await conn.execute('UPDATE users SET is_active=0 WHERE id=?', [id]);

      await insertAuditLog(conn, {
        user: actor,
        action: 'DELETE',
        module: 'users',
        refId: id,
        description: `${rows?.[0]?.full_name || rows?.[0]?.username || id} kullanıcısı pasif yapıldı.`,
        oldValue: rows?.[0] || null
      });
      await conn.commit();
      res.json({ success: true });
    } catch (err) {
      if (conn) await conn.rollback().catch(() => {});
      res.json({ success: false, message: err.message });
    } finally {
      if (conn) conn.release();
    }
  });

  app.post('/api/auth/purge-user', async (req, res) => {
    let conn;
    try {
      const { id, actor } = req.body;
      conn = await pool.getConnection();
      await conn.beginTransaction();

      const [rows] = await conn.execute('SELECT id, username, full_name, is_active, is_superadmin FROM users WHERE id=?', [id]);
      if (!rows || rows.length === 0) return res.json({ success: false, message: 'Kullanıcı bulunamadı.' });

      const isTargetSuper = Boolean(rows[0].is_superadmin || rows[0].username === 'admin' || Number(rows[0].id) === 1);
      if (isTargetSuper) {
        return res.json({ success: false, message: 'Süper Yönetici hesabı silinemez.' });
      }

      if (Number(rows[0].is_active) !== 0) return res.json({ success: false, message: 'Yalnızca pasif kullanıcılar kalıcı olarak silinebilir.' });

      await conn.execute('DELETE FROM users WHERE id=?', [id]);

      await insertAuditLog(conn, {
        user: actor,
        action: 'PURGE',
        module: 'users',
        refId: id,
        description: `${rows[0].full_name || rows[0].username} kullanıcısı kalıcı olarak silindi.`,
        oldValue: rows[0]
      });
      await conn.commit();
      res.json({ success: true });
    } catch (err) {
      if (conn) await conn.rollback().catch(() => {});
      res.json({ success: false, message: err.message });
    } finally {
      if (conn) conn.release();
    }
  });

  app.post('/api/auth/change-password', async (req, res) => {
    let conn;
    try {
      const { userId, oldPassword, newPassword, actor } = req.body;
      conn = await pool.getConnection();
      await conn.beginTransaction();

      const [rows] = await conn.execute('SELECT id, username, password_hash, is_superadmin FROM users WHERE id=?', [userId]);
      if (!rows || rows.length === 0) {
        return res.json({ success: false, message: 'Kullanıcı bulunamadı.' });
      }
      const user = rows[0];

      const isTargetSuper = Boolean(user.is_superadmin || user.username === 'admin' || Number(user.id) === 1);
      const isActorSuper = Boolean(actor?.is_superadmin || actor?.username === 'admin' || Number(actor?.id) === 1);
      if (isTargetSuper && actor && Number(actor.id) !== Number(userId) && !isActorSuper) {
        return res.json({ success: false, message: 'Süper Yönetici şifresi yalnızca kendisi tarafından değiştirilebilir.' });
      }

      const match = await verifyPassword(oldPassword, user.password_hash);
      if (!match) {
        return res.json({ success: false, message: 'Mevcut şifre hatalı.' });
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
      await conn.commit();
      res.json({ success: true });
    } catch (err) {
      if (conn) await conn.rollback().catch(() => {});
      res.json({ success: false, message: err.message });
    } finally {
      if (conn) conn.release();
    }
  });

  app.post('/api/audit/log', async (req, res) => {
    try {
      await insertAuditLog(pool, req.body);
      res.json({ success: true });
    } catch (err) {
      res.json({ success: false, message: err.message });
    }
  });

  app.post('/api/audit/get-logs', async (req, res) => {
    try {
      const filters = req.body;
      let sql = 'SELECT * FROM audit_logs';
      const conditions = [];
      const params = [];

      if (filters.username) {
        conditions.push('username = ?');
        params.push(filters.username);
      }
      if (filters.action) {
        conditions.push('action = ?');
        params.push(filters.action);
      }
      if (filters.module) {
        conditions.push('module = ?');
        params.push(filters.module);
      }

      if (conditions.length > 0) {
        sql += ' WHERE ' + conditions.join(' AND ');
      }

      const limit = Math.min(parseInt(filters.limit, 10) || 500, 5000);
      sql += ' ORDER BY created_at DESC, id DESC LIMIT ' + limit;

      const [rows] = await pool.execute(sql, params);
      res.json({ success: true, data: rows });
    } catch (err) {
      dbError(res, err, 'audit:get-logs');
    }
  });

  app.post('/api/auth/update-profile', async (req, res) => {
    try {
      const { id, full_name, email } = req.body;
      if (!id) return res.status(400).json({ success: false, message: 'Kullanıcı ID gerekli.' });

      await pool.execute(
        'UPDATE users SET full_name = ?, email = ? WHERE id = ?',
        [full_name, email || null, id]
      );

      const [rows] = await pool.execute('SELECT u.*, r.name as role_name FROM users u LEFT JOIN roles r ON u.role_id = r.id WHERE u.id = ?', [id]);
      const updatedUser = rows[0];
      if (updatedUser) {
        delete updatedUser.password_hash;
        updatedUser.is_superadmin = Boolean(updatedUser.is_superadmin || updatedUser.username === 'admin' || updatedUser.id === 1);
      }

      res.json({ success: true, user: updatedUser, message: 'Profil başarıyla güncellendi.' });
    } catch (err) {
      dbError(res, err, 'auth:update-profile');
    }
  });

  const handleUpdateAvatar = async (req, res) => {
    try {
      const { userId, avatar } = req.body;
      if (!userId) {
        return res.status(400).json({ success: false, message: 'Kullanıcı ID gereklidir.' });
      }

      await pool.execute(
        'UPDATE users SET avatar = ? WHERE id = ?',
        [avatar || null, userId]
      );

      res.json({
        success: true,
        avatar: avatar || null,
        message: 'Avatar başarıyla güncellendi.'
      });
    } catch (err) {
      dbError(res, err, 'auth:update-avatar');
    }
  };

  app.post('/api/auth/update-avatar', handleUpdateAvatar);
  app.post('/api/update-avatar', handleUpdateAvatar);
  app.post('/api/auth/avatar', handleUpdateAvatar);

  app.post('/api/auth/get-user-stats', async (req, res) => {
    try {
      const { userId, username, fullName } = req.body;
      let completedTickets = 0;
      let openTickets = 0;
      let maintenanceCompleted = 0;

      // 1. Kullanıcının süper yönetici veya yönetici olup olmadığını kontrol et
      let isSuper = false;
      let subordinateNames = [];
      let subordinateIds = [];

      try {
        const [uRows] = await pool.execute(
          'SELECT id, username, full_name, role_id, is_superadmin FROM users WHERE id = ? OR username = ?',
          [userId || 0, username || '']
        );
        if (uRows?.[0]) {
          const u = uRows[0];
          isSuper = Boolean(u.is_superadmin || u.username === 'admin' || Number(u.id) === 1);

          // Bu kullanıcının yönettiği personelleri bul (manager_id = u.id)
          const [subRows] = await pool.execute(
            'SELECT id, username, full_name FROM users WHERE manager_id = ?',
            [u.id]
          );
          if (Array.isArray(subRows)) {
            subordinateIds = subRows.map(s => s.id);
            subordinateNames = subRows.flatMap(s => [s.username, s.full_name]).filter(Boolean);
          }
        }
      } catch (e) {}

      // Arama isim ve ID havuzu
      const allNames = Array.from(new Set([
        username,
        fullName,
        ...subordinateNames
      ])).filter(Boolean);

      const allIds = Array.from(new Set([
        userId,
        ...subordinateIds
      ])).filter(Boolean);

      // 2. Servis Fişlerini Say
      try {
        if (isSuper) {
          // Süper Yönetici için sistem genelindeki tüm tamamlanan ve açık fişler
          const [ticketRows] = await pool.query(
            `SELECT 
               COUNT(CASE WHEN status IN ('Tamamlandı', 'Teslim Edildi', 'Kapandı', 'Çözüldü') THEN 1 END) as completed,
               COUNT(CASE WHEN status NOT IN ('Tamamlandı', 'Teslim Edildi', 'Kapandı', 'Çözüldü', 'İptal', 'Pert', 'İptal Edildi') THEN 1 END) as open
             FROM service_tickets`
          );
          if (ticketRows?.[0]) {
            completedTickets = ticketRows[0].completed || 0;
            openTickets = ticketRows[0].open || 0;
          }
        } else {
          // Kendisi + Yöneticisi olduğu personellerin çözdüğü veya üzerinde olan işler
          const namePlaceholders = allNames.map(() => '?').join(',');
          const idPlaceholders = allIds.map(() => '?').join(',');

          let sql = `
            SELECT 
              COUNT(DISTINCT CASE WHEN st.status IN ('Tamamlandı', 'Teslim Edildi', 'Kapandı', 'Çözüldü') THEN st.id END) as completed,
              COUNT(DISTINCT CASE WHEN st.status NOT IN ('Tamamlandı', 'Teslim Edildi', 'Kapandı', 'Çözüldü', 'İptal', 'Pert', 'İptal Edildi') THEN st.id END) as open
            FROM service_tickets st
            LEFT JOIN service_operations so ON st.id = so.ticket_id
            WHERE 
          `;

          const conds = [];
          const params = [];

          if (allNames.length > 0) {
            conds.push(`st.teknisyen IN (${namePlaceholders})`);
            params.push(...allNames);
            conds.push(`st.user_name IN (${namePlaceholders})`);
            params.push(...allNames);
          }

          if (allIds.length > 0) {
            conds.push(`so.user_id IN (${idPlaceholders})`);
            params.push(...allIds);
          }

          if (conds.length === 0) {
            conds.push('1=0');
          }

          sql += '(' + conds.join(' OR ') + ')';

          const [ticketRows] = await pool.query(sql, params);
          if (ticketRows?.[0]) {
            completedTickets = ticketRows[0].completed || 0;
            openTickets = ticketRows[0].open || 0;
          }
        }
      } catch (e) {
        console.warn('[auth:get-user-stats] ticket stats error:', e.message);
      }

      // 3. Periyodik Bakım Sayımı
      try {
        if (isSuper) {
          const [maintRows] = await pool.query(
            `SELECT COUNT(*) as count FROM maintenance_item_checks WHERE status = 'Tamamlandı'`
          );
          if (maintRows?.[0]) {
            maintenanceCompleted = maintRows[0].count || 0;
          }
        } else {
          const namePlaceholders = allNames.map(() => '?').join(',');
          const idPlaceholders = allIds.map(() => '?').join(',');

          let mSql = `SELECT COUNT(*) as count FROM maintenance_item_checks WHERE status = 'Tamamlandı' AND (`;
          const mConds = [];
          const mParams = [];

          if (allNames.length > 0) {
            mConds.push(`tech_name IN (${namePlaceholders})`);
            mParams.push(...allNames);
          }
          if (allIds.length > 0) {
            mConds.push(`technician_id IN (${idPlaceholders})`);
            mParams.push(...allIds);
          }
          if (mConds.length === 0) mConds.push('1=0');

          mSql += mConds.join(' OR ') + ')';
          const [maintRows] = await pool.query(mSql, mParams);
          if (maintRows?.[0]) {
            maintenanceCompleted = maintRows[0].count || 0;
          }
        }
      } catch (e) {
        console.warn('[auth:get-user-stats] maintenance stats error:', e.message);
      }

      res.json({
        success: true,
        stats: {
          completedTickets: Number(completedTickets) || 0,
          openTickets: Number(openTickets) || 0,
          maintenanceCompleted: Number(maintenanceCompleted) || 0,
          totalImpact: (Number(completedTickets) || 0) + (Number(maintenanceCompleted) || 0)
        }
      });
    } catch (err) {
      res.json({ success: true, stats: { completedTickets: 0, openTickets: 0, maintenanceCompleted: 0, totalImpact: 0 } });
    }
  });

  app.get('/api/kullanicilar', async (_req, res) => {
    try {
      const hasFullName = await helpers.tableHasColumn(pool, 'users', 'full_name');
      const nameExpr = hasFullName ? 'COALESCE(full_name, username)' : 'COALESCE(name, username)';
      const [users] = await pool.execute(
        `SELECT id, username, ${nameExpr} AS name, email, role_id, is_active
         FROM users
         WHERE COALESCE(is_active, 1) = 1
         ORDER BY id ASC`
      );
      res.json(users);
    } catch (err) {
      dbError(res, err, 'kullanicilar');
    }
  });
};
