const statusEl = document.getElementById('status');
const whoEl = document.getElementById('who');
const loginForm = document.getElementById('loginForm');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const btnGoApp = document.getElementById('btnGoApp');

function getSupabaseFlags() {
  return {
    hasUrl: Boolean(window.__TERMO_SUPABASE_URL),
    hasKey: Boolean(window.__TERMO_SUPABASE_ANON_KEY),
    hasLib: Boolean(window.supabase?.createClient),
    hasClient: Boolean(window.__supabase),
  };
}

function setStatus(text, isErr = false) {
  statusEl.classList.toggle('error', Boolean(isErr));
  statusEl.querySelector('strong').textContent = text;
}

function goApp() {
  window.location.href = '/dashboard/';
}

function showSupabaseUnavailable() {
  const { hasUrl, hasKey, hasLib, hasClient } = getSupabaseFlags();
  setStatus(
    `Supabase non disponibile (url:${hasUrl} key:${hasKey} lib:${hasLib} client:${hasClient})`,
    true
  );
}

if (!window.__supabase) {
  showSupabaseUnavailable();
}

btnGoApp.addEventListener('click', goApp);

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  setStatus('accesso in corso...');

  if (!window.__supabase) {
    showSupabaseUnavailable();
    return;
  }

  const email = emailInput?.value?.trim();
  const password = passwordInput?.value;

  if (!email || !password) {
    setStatus('inserisci email e password', true);
    return;
  }

  const { error } = await window.__supabase.auth.signInWithPassword({ email, password });

  if (error) {
    setStatus(error.message || 'errore autenticazione', true);
    whoEl.textContent = '';
    return;
  }

  setStatus('autenticato');
  whoEl.textContent = email;
  goApp();
});
