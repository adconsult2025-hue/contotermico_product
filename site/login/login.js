const statusEl = document.getElementById('status');
const whoEl = document.getElementById('who');
const loginForm = document.getElementById('loginForm');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const btnGoApp = document.getElementById('btnGoApp');

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

btnGoApp.addEventListener('click', goApp);

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  setStatus('accesso in corso...');

  if (!window.termoSupabase) {
    setStatus('supabase non disponibile', true);
    return;
  }

  const email = emailInput?.value?.trim();
  const password = passwordInput?.value;

  if (!email || !password) {
    setStatus('inserisci email e password', true);
    return;
  }

  const { error } = await window.termoSupabase.auth.signInWithPassword({ email, password });

  if (error) {
    setStatus('errore autenticazione', true);
    whoEl.textContent = error.message || '';
    return;
  }

  setStatus('autenticato');
  whoEl.textContent = email;
  goApp();
});

window.onAuthStateChange?.((_event, session) => {
  if (session?.user) {
    whoEl.textContent = session.user.email || '';
    setStatus('autenticato');
    btnGoApp.style.display = '';
  } else {
    setStatus('non autenticato');
    whoEl.textContent = '';
    btnGoApp.style.display = 'none';
  }
});

resolveSession().then((session) => {
  if (session?.user) {
    whoEl.textContent = session.user.email || '';
    setStatus('autenticato');
    btnGoApp.style.display = '';
    goApp();
  } else {
    setStatus('non autenticato');
  }
});
