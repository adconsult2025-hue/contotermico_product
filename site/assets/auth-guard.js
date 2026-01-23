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
      if (window.__supabase) break;
      await new Promise((r) => setTimeout(r, 50));
    }
    if (!window.__supabase) return null;
    try {
      const { data, error } = await window.__supabase.auth.getSession();
      if (error) return null;
      return data?.session || null;
    } catch (e) {
      return null;
    }
  }

  async function waitForSessionOrAuthEvent(timeoutMs = 1500) {
    // If session is already there, good.
    const s0 = await getSessionSafe();
    if (s0) return s0;

    // Otherwise wait for auth state change (deep links / refresh token / URL hash)
    if (!window.__supabase) return null;
    let done = false;
    let sess = null;
    const t = setTimeout(() => {
      done = true;
    }, timeoutMs);

    const { data: sub } = window.__supabase.auth.onAuthStateChange((_event, session) => {
      if (session && !done) {
        sess = session;
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
    const session = await waitForSessionOrAuthEvent(2000);
    if (!session) {
      window.location.href = LOGIN_PATH;
      return;
    }
  }

  document.addEventListener('DOMContentLoaded', guard);
})();
