// Supabase singleton client for TERMO 3.0
// Requires:
//  - <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
//  - <script src="/config.js"></script>
//
// Exposes: window.__supabase, window.getSessionUser, window.isSuperadmin

(function () {
  const url = window.__TERMO_SUPABASE_URL;
  const anon = window.__TERMO_SUPABASE_ANON_KEY;

  if (!url || !anon) {
    console.warn('[supabase-client] Missing config in /config.js');
    return;
  }
  if (!window.supabase || !window.supabase.createClient) {
    console.warn('[supabase-client] supabase-js not loaded');
    return;
  }

  // Create once
  if (!window.__supabase) {
    window.__supabase = supabase.createClient(url, anon, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
  }

  window.termoGetSession = async () => (await window.__supabase.auth.getSession()).data.session;
  window.termoGetUser = async () => (await window.__supabase.auth.getUser()).data.user;
})();
