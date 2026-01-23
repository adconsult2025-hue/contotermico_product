// Guard minimale: se non sei loggato -> /login/
// NB: qui NON facciamo più gate lato function (lo reinseriremo dopo, stabile).
async function getSessionSafe() {
  for (let i = 0; i < 20; i++) {
    if (window.__supabase) break;
    await new Promise((r) => setTimeout(r, 50));
  }
  if (!window.__supabase) return null;
  try {
    const { data, error } = await window.__supabase.auth.getSession();
    if (error) return null;
    return data?.session || null;
  } catch {
    return null;
  }
}

async function checkAuth() {
  const path = window.location.pathname || '';
  if (path === '/' || path.startsWith('/login')) return;

  const session = await getSessionSafe();
  if (!session) window.location.href = '/login/';
}

document.addEventListener('DOMContentLoaded', () => {
  checkAuth();
});
