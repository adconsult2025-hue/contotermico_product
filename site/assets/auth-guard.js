(function () {
  const LOGIN_PATH = '/login/';
  const HOME_AFTER_LOGIN = '/dashboard/';

  function isLoginPage() {
    const p = window.location.pathname || '/';
    return p === '/login/' || p === '/login';
  }

  async function getSessionSafe() {
    // Wait a bit for supabase client bootstrap
    for (let i = 0; i < 20; i++) {
      if (window.getSessionUser) break;
      await new Promise((r) => setTimeout(r, 50));
    }
    if (!window.getSessionUser) return null;
    return window.getSessionUser();
  }

  async function waitForSessionOrAuthEvent(timeoutMs = 1500) {
    // If session is already there, good.
    const u0 = await getSessionSafe();
    if (u0) return u0;

    // Otherwise wait for auth state change (deep links / refresh token / URL hash)
    if (!window.__supabase) return null;
    let done = false;
    let sess = null;
    const t = setTimeout(() => {
      done = true;
    }, timeoutMs);

    const { data: sub } = window.__supabase.auth.onAuthStateChange((_event, session) => {
      if (session && !done) {
        sess = session?.user || null;
        done = true;
        clearTimeout(t);
      }
    });

    // Poll quickly while waiting
    while (!done) {
      const s = await getSessionSafe();
      if (s) {
        sess = s;
        done = true;
        break;
      }
      await new Promise((r) => setTimeout(r, 80));
    }

    try { sub?.subscription?.unsubscribe?.(); } catch (_) {}
    return sess;
  }

  async function guard() {
    if (isLoginPage()) return;
    const user = await waitForSessionOrAuthEvent(2000);
    if (!user) {
      console.debug('[auth-guard] redirect /login (no session user)');
      window.location.href = LOGIN_PATH;
      return;
    }
  }

  document.addEventListener('DOMContentLoaded', guard);
})();
