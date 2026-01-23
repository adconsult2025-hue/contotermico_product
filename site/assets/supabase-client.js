// Supabase client bootstrap (browser-safe).
// Requires:
//  - /config.js that sets window.__TERMO_SUPABASE_URL and window.__TERMO_SUPABASE_ANON_KEY
//  - Supabase JS loaded (CDN) before this file
//
// Exposes: window.__supabase, window.getSessionUser, window.isSuperadmin,
//          window.termoGetSession (legacy)
(function () {
  const url = window.__TERMO_SUPABASE_URL;
  const anon = window.__TERMO_SUPABASE_ANON_KEY;

  if (!url || !anon) {
    console.warn('[supabase] Missing config values. Check /config.js (must not be placeholder) and Netlify env injection.');
    return;
  }

  // If already initialized, keep it.
  if (window.__supabase) return;

  // Supabase v2 expects global "supabase" when loaded via CDN
  const factory = window.supabase?.createClient;
  if (!factory) {
    console.warn('[supabase] Supabase CDN not loaded. Ensure <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script> is present.');
    return;
  }

  // IMPORTANT: persist session in localStorage, auto refresh token
  window.__supabase = factory(url, anon, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storage: window.localStorage,
    },
  });

  window.termoGetSession = async () => (await window.__supabase.auth.getSession()).data.session;
  window.getSessionUser = async () => {
    const { data, error } = await window.__supabase.auth.getUser();
    if (error) return null;
    return data?.user ?? null;
  };

  let cachedSuperadmin = null;
  window.isSuperadmin = async () => {
    if (cachedSuperadmin !== null) return cachedSuperadmin;
    const user = await window.getSessionUser();
    if (!user) {
      cachedSuperadmin = false;
      return false;
    }
    const { data, error } = await window.__supabase
      .from('app_superadmins')
      .select('user_id')
      .eq('user_id', user.id)
      .maybeSingle();
    if (error) {
      cachedSuperadmin = false;
      return false;
    }
    cachedSuperadmin = Boolean(data?.user_id);
    return cachedSuperadmin;
  };
})();
