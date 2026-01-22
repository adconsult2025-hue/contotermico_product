(function () {
  const LOGIN_PATH = '/login/';
  const HOME_AFTER_LOGIN = '/dashboard/';

  function isLoginPage() {
    const p = window.location.pathname || '/';
    return p === '/login/' || p === '/login';
  }

  async function enforceAuth() {
    if (isLoginPage()) return;
    if (!window.getSession) {
      window.location.href = LOGIN_PATH;
      return;
    }
    const { data, error } = await window.getSession();
    if (error || !data?.session) {
      window.location.href = LOGIN_PATH;
    }
  }

  function listenAuthChanges() {
    if (!window.onAuthStateChange) return;
    window.onAuthStateChange((_event, session) => {
      if (session && isLoginPage()) {
        window.location.href = HOME_AFTER_LOGIN;
        return;
      }
      if (!session && !isLoginPage()) {
        window.location.href = LOGIN_PATH;
      }
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    enforceAuth();
    listenAuthChanges();
  });
})();
