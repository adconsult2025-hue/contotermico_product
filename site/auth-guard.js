(async () => {
  const isLogin = window.location.pathname.startsWith('/login/');

  if (isLogin) {
    return;
  }

  const timeoutMs = 2500;
  const intervalMs = 250;
  const start = Date.now();
  let session = null;

  while (Date.now() - start < timeoutMs) {
    if (window.__supabaseReady && window.__supabase) {
      const { data } = await window.__supabase.auth.getSession();
      session = data?.session ?? null;
      if (session) {
        return;
      }
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  if (!session) {
    window.location.href = '/login/';
  }
})();
