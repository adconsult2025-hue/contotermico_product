const statusEl = document.getElementById('status');
const whoEl = document.getElementById('who');
const btnLogin = document.getElementById('btnLogin');
const btnGoApp = document.getElementById('btnGoApp');
const supabaseUrl = window.__TERMO_SUPABASE_URL;
const supabaseAnonKey = window.__TERMO_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase config missing: update /config.js');
}

function setStatus(text, isErr = false) {
  statusEl.classList.toggle('error', Boolean(isErr));
  statusEl.querySelector('strong').textContent = text;
}

function goApp() {
  window.location.href = '/app/';
}

function hasInviteParams() {
  const url = new URL(window.location.href);
  const keys = [
    'invite',
    'confirmation',
    'recovery',
    'token',
    'access_token',
  ];

  if (keys.some((key) => url.searchParams.has(key))) {
    return true;
  }

  const hash = url.hash.replace(/^#/, '');
  if (!hash) {
    return false;
  }

  const hashParams = new URLSearchParams(hash);
  return keys.some((key) => hashParams.has(key));
}

btnLogin.addEventListener('click', () => {
  if (!window.netlifyIdentity) return;
  window.netlifyIdentity.open();
});

btnGoApp.addEventListener('click', goApp);

if (window.netlifyIdentity) {
  const shouldOpenSignup = hasInviteParams();

  window.netlifyIdentity.on('login', () => {
    window.netlifyIdentity.close();
    goApp();
  });
  window.netlifyIdentity.on('logout', () => {
    setStatus('logout');
    whoEl.textContent = '';
  });
  window.netlifyIdentity.on('init', (user) => {
    if (user) {
      whoEl.textContent = user.email || '';
      setStatus('autenticato');
      btnGoApp.style.display = '';
    } else {
      setStatus('non autenticato');
    }
    if (shouldOpenSignup) {
      setTimeout(() => {
        window.netlifyIdentity.open('signup');
      }, 150);
    }
  });
  window.netlifyIdentity.init();
} else {
  setStatus('widget non caricato', true);
}
