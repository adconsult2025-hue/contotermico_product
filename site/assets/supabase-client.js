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
    window.__supabase = window.supabase.createClient(url, anon, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
  }

  if (!window.getSessionUser) {
    window.getSessionUser = async function getSessionUser() {
      if (!window.__supabase) return null;
      try {
        const { data, error } = await window.__supabase.auth.getSession();
        if (error) return null;
        return data?.session?.user || null;
      } catch (err) {
        console.debug('[supabase-client] getSessionUser failed', err);
        return null;
      }
    };
  }

  if (!window.isSuperadmin) {
    window.isSuperadmin = async function isSuperadmin() {
      const user = await window.getSessionUser?.();
      if (!user?.id || !window.__supabase) return false;
      try {
        const { data, error } = await window.__supabase
          .from('app_superadmins')
          .select('user_id')
          .eq('user_id', user.id)
          .limit(1);
        if (error) return false;
        return Boolean(data?.length);
      } catch (err) {
        console.debug('[supabase-client] isSuperadmin failed', err);
        return false;
      }
    };
  }
})();
