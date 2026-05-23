// Session flags — single API (localStorage; same keys for backward compatibility).
(function () {
  'use strict';

  const SESSION_DURATION_MS = 8 * 60 * 60 * 1000;

  function _ls() {
    try { return window.localStorage; } catch { return null; }
  }

  function setSession(opts) {
    const storage = _ls();
    if (!storage) return;
    const o = opts || {};
    if (o.loggedIn) storage.setItem('wfa_logged_in', 'true');
    if (o.loginTime != null) storage.setItem('wfa_login_time', String(o.loginTime));
    if (o.role != null) storage.setItem('wfa_user_role', o.role);
    if (o.userName != null) storage.setItem('wfa_user_name', o.userName);
    if (o.permissions != null) {
      storage.setItem('wfa_user_permissions', JSON.stringify(o.permissions));
    }
  }

  function setAdminSession() {
    setSession({
      loggedIn: true,
      loginTime: Date.now(),
      role: 'admin',
      userName: 'admin',
      permissions: ['*'],
    });
  }

  function setSubSession(username, permissions) {
    setSession({
      loggedIn: true,
      loginTime: Date.now(),
      role: 'subaccount',
      userName: username,
      permissions: permissions || [],
    });
  }

  function clearSession() {
    const storage = _ls();
    if (!storage) return;
    ['wfa_logged_in', 'wfa_login_time', 'wfa_user_role', 'wfa_user_name', 'wfa_user_permissions']
      .forEach((k) => storage.removeItem(k));
  }

  function isLoggedIn() {
    const storage = _ls();
    if (!storage || storage.getItem('wfa_logged_in') !== 'true') return false;
    const loginTime = parseInt(storage.getItem('wfa_login_time') || '0', 10);
    if (loginTime && Date.now() - loginTime > SESSION_DURATION_MS) {
      clearSession();
      return false;
    }
    return true;
  }

  function getRole() {
    return _ls()?.getItem('wfa_user_role') || null;
  }

  function getUserName() {
    return _ls()?.getItem('wfa_user_name') || 'admin';
  }

  function getPermissions() {
    try {
      return JSON.parse(_ls()?.getItem('wfa_user_permissions') || '[]');
    } catch {
      return [];
    }
  }

  function isAdmin() {
    const role = getRole();
    if (role === 'admin') return true;
    const storage = _ls();
    if (!role && storage?.getItem('wfa_logged_in') === 'true' && storage.getItem('wfa_login_time')) {
      return true;
    }
    return false;
  }

  window.SessionStore = {
    SESSION_DURATION_MS,
    setSession,
    setAdminSession,
    setSubSession,
    clearSession,
    isLoggedIn,
    getRole,
    getUserName,
    getPermissions,
    isAdmin,
  };
})();
