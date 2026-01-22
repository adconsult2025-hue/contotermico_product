const supabaseUrl = window.__TERMO_SUPABASE_URL;
const supabaseAnonKey = window.__TERMO_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase config missing: update /config.js');
}

if (!window.supabase?.createClient) {
  console.warn('Supabase JS not loaded: include the CDN script.');
}

window.termoSupabase = window.supabase?.createClient?.(supabaseUrl, supabaseAnonKey);

window.getSession = () => window.termoSupabase?.auth.getSession();
window.onAuthStateChange = (callback) => window.termoSupabase?.auth.onAuthStateChange(callback);
window.signOut = () => window.termoSupabase?.auth.signOut();
