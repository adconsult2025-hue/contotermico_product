(function () {
  const supabaseUrl = window.__TERMO_SUPABASE_URL;
  const supabaseAnonKey = window.__TERMO_SUPABASE_ANON_KEY;
  const hasLib = !!window.supabase?.createClient;

  console.log('[supabase] url?', !!supabaseUrl, 'key?', !!supabaseAnonKey, 'lib?', hasLib);

  if (!supabaseUrl || !supabaseAnonKey || !hasLib) {
    window.__supabaseReady = false;
    return;
  }

  const supabase = window.supabase.createClient(supabaseUrl, supabaseAnonKey);

  async function getSession() {
    const { data } = await supabase.auth.getSession();
    return data.session;
  }

  async function signIn(email, password) {
    return supabase.auth.signInWithPassword({ email, password });
  }

  async function signOut() {
    return supabase.auth.signOut();
  }

  window.__supabase = supabase;
  window.__supabaseReady = true;
  window.TERMO_SUPABASE = { supabase, getSession, signIn, signOut };
})();
