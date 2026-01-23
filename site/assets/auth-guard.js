(function () {
  const LOGIN_PATH = '/login/';
  const HOME_AFTER_LOGIN = '/dashboard/';

  function isLoginPage() {
    const p = window.location.pathname || '/';
    return p === '/login/' || p === '/login';
  }

  function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async function getSessionWithRetry() {
    if (!window.termoGetSession) return null;
    let session = null;
    for (let i = 0; i < 3; i += 1) {
      session = await window.termoGetSession();
      if (session?.user) break;
      await wait(500);
    }
    return session;
  }

  async function guard() {
    if (isLoginPage()) return;
    const session = await getSessionWithRetry();
    if (!session?.user) {
      console.debug('[auth-guard] redirecting to /login/ from', window.location.pathname || '/');
      window.location.href = LOGIN_PATH;
      return;
    }
  }

  document.addEventListener('DOMContentLoaded', guard);
})();
