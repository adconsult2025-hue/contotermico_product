(async () => {
  const isLogin = window.location.pathname.startsWith('/login/');

  const attempts = 8;
  const intervalMs = 150;
  let session = null;

  for (let i = 0; i < attempts; i += 1) {
    if (window.__supabase?.auth) {
      const { data, error } = await window.__supabase.auth.getSession();
      if (error) {
        console.warn('[auth-guard] getSession error', error);
      }
      session = data?.session ?? null;
      if (session?.user) {
        return;
      }
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  if (!window.__supabase?.auth) {
    console.warn('[auth-guard] supabase client missing on this page');
    return;
  }

  if (!session?.user && !isLogin) {
    window.location.href = '/login/';
  }
})();
