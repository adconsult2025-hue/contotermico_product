// Guard minimale: se non sei loggato -> /login/
// NB: qui NON facciamo più gate lato function (lo reinseriremo dopo, stabile).
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

async function checkAuth() {
  const path = window.location.pathname || '';
  if (path === '/' || path.startsWith('/login')) return;

  const session = await getSessionWithRetry();
  if (!session?.user) {
    console.debug('[auth-guard] redirecting to /login/ from', path);
    window.location.href = '/login/';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  checkAuth();
});
