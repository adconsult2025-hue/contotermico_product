const supabase = window.supabase.createClient(
  window.__TERMO_SUPABASE_URL,
  window.__TERMO_SUPABASE_ANON_KEY
);

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

window.TERMO_SUPABASE = { supabase, getSession, signIn, signOut };
