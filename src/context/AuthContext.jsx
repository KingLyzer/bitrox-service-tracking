import React, { createContext, useContext, useState, useCallback } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem('currentUser');
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      return null;
    }
  });
  const [permissions, setPermissions] = useState(() => {
    try {
      const saved = localStorage.getItem('permissions');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  const normalizeUser = useCallback((rawUser, fallbackUsername) => {
    const userObj = { ...(rawUser || {}) };
    if (!userObj.name) {
      userObj.name = userObj.full_name || userObj.username || fallbackUsername;
    }
    return userObj;
  }, []);

  const applyLogin = useCallback((rawUser, rawPermissions, fallbackUsername) => {
    const userObj = normalizeUser(rawUser, fallbackUsername);
    const permissionList = Array.isArray(rawPermissions) ? rawPermissions : [];

    setUser(userObj);
    setPermissions(permissionList);

    localStorage.setItem('currentUser', JSON.stringify(userObj));
    localStorage.setItem('permissions', JSON.stringify(permissionList));

    try {
      Object.keys(sessionStorage).forEach(key => {
        if (key.startsWith('dismissed_ann_')) {
          sessionStorage.removeItem(key);
        }
      });
    } catch (e) {}

    return { success: true, user: userObj, permissions: permissionList };
  }, [normalizeUser]);

  const login = useCallback(async (username, password) => {
    try {
      if (window.electronAPI?.login) {
        const result = await window.electronAPI.login({ username, password });
        if (result?.success) {
          return applyLogin(result.user || result, result.permissions, username);
        }

        return {
          success: false,
          message: result?.message || 'Kullanıcı adı veya şifre hatalı.'
        };
      }

      const response = await fetch(`${window.API_BASE}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      if (!response.ok) {
        return { success: false, message: `Giriş Hatası (Sunucu Hatası: ${response.status})` };
      }

      const result = await response.json();
      const isSuccess = result.success || (response.ok && (result.user || result.username));

      if (isSuccess) {
        return applyLogin(result.user || result, result.permissions, username);
      } else {
        return { success: false, message: result.message || 'Kullanıcı adı veya şifre hatalı.' };
      }
    } catch (err) {
      console.error('API login failed:', err);
      return { success: false, message: 'Sunucuya bağlanılamadı: ' + err.message };
    }
  }, [applyLogin]);

  const logout = useCallback(() => {
    if (user && window.electronAPI?.auditLog) {
      window.electronAPI.auditLog({
        user,
        action: 'LOGOUT',
        module: 'auth',
        description: 'Kullanıcı çıkış yaptı.'
      }).catch(() => {});
    }
    setUser(null);
    setPermissions([]);
    localStorage.removeItem('currentUser');
    localStorage.removeItem('permissions');
    try {
      Object.keys(sessionStorage).forEach(key => {
        if (key.startsWith('dismissed_ann_')) {
          sessionStorage.removeItem(key);
        }
      });
    } catch (e) {}
  }, [user]);

  const auditLog = useCallback((entry) => {
    if (!window.electronAPI?.auditLog || !user) return Promise.resolve({ success: false });
    return window.electronAPI.auditLog({ ...entry, user });
  }, [user]);

  const refreshUserPermissions = useCallback(async () => {
    if (!user || !user.id) return;

    try {
      let currentRoleId = Number(user.role_id);
      let currentRoleName = user.role_name || user.role;

      if (window.electronAPI?.query) {
        const uRes = await window.electronAPI.query(
          `SELECT u.*, r.name as role_name 
           FROM users u 
           LEFT JOIN roles r ON u.role_id = r.id 
           WHERE u.id = ?`,
          [user.id]
        );
        if (uRes && uRes.success && uRes.data && uRes.data.length > 0) {
          const freshUser = uRes.data[0];
          currentRoleId = Number(freshUser.role_id);
          currentRoleName = freshUser.role_name || freshUser.role;

          if (
            Number(freshUser.role_id) !== Number(user.role_id) ||
            freshUser.role_name !== user.role_name ||
            freshUser.allowed_locations !== user.allowed_locations
          ) {
            const updatedUser = { ...user, ...freshUser, role_id: currentRoleId, role_name: currentRoleName, allowed_locations: freshUser.allowed_locations };
            setUser(updatedUser);
            localStorage.setItem('currentUser', JSON.stringify(updatedUser));
          }
        }
      }

      const lowerRole = String(currentRoleName || '').toLocaleLowerCase('tr-TR');
      if (currentRoleId === 1 || lowerRole === 'admin' || lowerRole === 'yönetici' || user.username === 'admin') {
        setPermissions(prev => (prev.length === 0 ? prev : []));
        return;
      }

      if (window.electronAPI?.getRolePermissions) {
        const rpRes = await window.electronAPI.getRolePermissions();
        if (rpRes && rpRes.success && Array.isArray(rpRes.permissions)) {
          const userPerms = rpRes.permissions.filter(p => Number(p.role_id) === currentRoleId);
          setPermissions(userPerms);
          localStorage.setItem('permissions', JSON.stringify(userPerms));
        }
      }
    } catch (e) {
      console.warn('User permissions refresh failed:', e);
    }
  }, [user]);

  React.useEffect(() => {
    refreshUserPermissions();

    const handleFocus = () => refreshUserPermissions();
    const handleCustomEvent = () => refreshUserPermissions();

    window.addEventListener('focus', handleFocus);
    window.addEventListener('permissionsUpdated', handleCustomEvent);

    return () => {
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('permissionsUpdated', handleCustomEvent);
    };
  }, [refreshUserPermissions]);

  const hasPermission = useCallback((module, action = 'can_view') => {
    if (!user) return false;
    const roleId = Number(user.role_id);
    const roleName = String(user.role_name || user.role || '').toLocaleLowerCase('tr-TR');
    if (roleId === 1 || roleName === 'admin' || roleName === 'yönetici' || user.username === 'admin') return true;

    if (Array.isArray(permissions) && permissions.length > 0) {
      const perm = permissions.find(p => p.module === module);
      if (perm) {
        return Number(perm[action]) === 1 || perm[action] === true;
      }
      return false;
    }

    return false;
  }, [user, permissions]);

  const updateUser = useCallback((partialUser) => {
    setUser(prev => {
      if (!prev) return prev;
      const updated = { ...prev, ...partialUser };
      localStorage.setItem('currentUser', JSON.stringify(updated));
      return updated;
    });
  }, []);

  return (
    <AuthContext.Provider value={{ user, permissions, login, logout, hasPermission, auditLog, refreshUserPermissions, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
