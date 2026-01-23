(async () => {
  const isLogin = window.location.pathname.startsWith('/login/');

  if (window.__supabaseReady === false) {
    if (!isLogin) {
      const currentUrl = new URL(window.location.href);
      if (currentUrl.searchParams.get('err') !== 'supabase') {
        window.location.href = '/login/?err=supabase';
      }
      return;
    }

    const statusEl = document.getElementById('status');
    if (statusEl) {
      statusEl.classList.add('error');
      const strong = statusEl.querySelector('strong');
      if (strong) {
        strong.textContent = 'Supabase non disponibile';
      } else {
        statusEl.textContent = 'Supabase non disponibile';
      }
    }
    return;
  }

  const session = await window.TERMO_SUPABASE.getSession();
  if (!session && !isLogin) {
    window.location.href = '/login/';
  }
})();
