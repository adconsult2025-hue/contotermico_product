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
  };
}

function setStatus(text, isErr = false) {
  statusEl.classList.toggle('error', Boolean(isErr));
  statusEl.querySelector('strong').textContent = text;
}

function goApp() {
  window.location.href = '/dashboard/';
}

async function resolveSession() {
  if (!window.getSession) return null;
  const { data, error } = await window.getSession();
  if (error) {
    console.warn('Supabase session error', error);
  }
  return data?.session || null;
}

function showSupabaseUnavailable() {
  const { hasUrl, hasKey, hasLib } = getSupabaseFlags();
  setStatus(`Supabase non disponibile (url:${hasUrl} key:${hasKey} lib:${hasLib})`, true);
}

if (!window.__supabaseReady) {
  showSupabaseUnavailable();
}

btnGoApp.addEventListener('click', goApp);

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  setStatus('accesso in corso...');

  if (!window.__supabaseReady) {
    showSupabaseUnavailable();
    return;
  }

  const email = emailInput?.value?.trim();
  const password = passwordInput?.value;

  if (!email || !password) {
    setStatus('inserisci email e password', true);
    return;
  }

  const { error } = await window.TERMO_SUPABASE.signIn(email, password);

  if (error) {
    setStatus(error.message || 'errore autenticazione', true);
    whoEl.textContent = '';
    return;
  }

  setStatus('autenticato');
  whoEl.textContent = email;
  goApp();
});
