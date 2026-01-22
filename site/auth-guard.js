// Guard minimale: se non sei loggato -> /login/
// NB: qui NON facciamo più gate lato function (lo reinseriremo dopo, stabile).
const supabaseUrl = window.__TERMO_SUPABASE_URL;
const supabaseAnonKey = window.__TERMO_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase config missing: update /config.js');
}

async function ensureIdentityWidget() {
  if (window.netlifyIdentity) return true;
  return new Promise((resolve) => {
    const src = 'https://identity.netlify.com/v1/netlify-identity-widget.js';
    const existing = Array.from(document.scripts || []).find((s) => s.src === src);
    if (existing) {
      const done = () => resolve(!!window.netlifyIdentity);
      existing.addEventListener('load', done, { once: true });
      existing.addEventListener('error', () => resolve(false), { once: true });
      setTimeout(done, 300);
      return;
    }
    const s = document.createElement('script');
    s.src = src;
    s.async = true;
    s.onload = () => resolve(!!window.netlifyIdentity);
    s.onerror = () => resolve(false);
    document.head.appendChild(s);
  });
}

async function checkAuth() {
  const path = window.location.pathname || '';
  if (path === '/' || path.startsWith('/login')) return;

  const ok = await ensureIdentityWidget();
  if (!ok || !window.netlifyIdentity) {
    window.location.href = '/login/';
    return;
  }

  // init e check utente
  await new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (!settled) {
        settled = true;
        resolve();
      }
    };
    window.netlifyIdentity.on('init', () => finish());
    window.netlifyIdentity.init();
    setTimeout(finish, 800);
  });

  const u = window.netlifyIdentity.currentUser && window.netlifyIdentity.currentUser();
  if (!u) {
    window.location.href = '/login/';
  }
}

document.addEventListener('DOMContentLoaded', () => { checkAuth(); });
