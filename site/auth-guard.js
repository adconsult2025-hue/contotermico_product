// Guard minimale: se non sei loggato -> /login/
function isLoginPage() {
  const p = window.location.pathname || '/';
  return p === '/login/' || p === '/login' || p.startsWith('/login/');
}

async function getSessionUserId() {
  if (!window.__supabase) return null;
  try {
    const { data, error } = await window.__supabase.auth.getSession();
    if (error) return null;
    return data?.session?.user?.id || null;
  } catch (error) {
    return null;
  }
}

async function checkAuth() {
  if (isLoginPage() || (window.location.pathname || '') === '/') return;

  if (!window.__supabase) {
    console.warn('[auth-guard] Supabase client missing.');
    return;
  }

  const uid = await getSessionUserId();
  if (!uid) {
    console.debug('[auth-guard] redirecting to /login/ from', window.location.pathname || '/');
    window.location.href = '/login/';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  checkAuth();
});
