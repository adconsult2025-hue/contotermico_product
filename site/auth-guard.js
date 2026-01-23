// Guard minimale: se non sei loggato -> /login/
async function waitForSessionUser() {
  for (let i = 0; i < 20; i++) {
    if (window.getSessionUser) break;
    await new Promise((r) => setTimeout(r, 50));
  }
  if (!window.getSessionUser) return null;
  return window.getSessionUser();
}

async function checkAuth() {
  const path = window.location.pathname || '';
  if (path === '/' || path.startsWith('/login')) return;

  const user = await waitForSessionUser();
  if (!user) {
    console.debug('[auth-guard] redirect /login (no session user)');
    window.location.href = '/login/';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  checkAuth();
});
