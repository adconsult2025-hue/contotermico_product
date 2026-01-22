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
  window.location.href = '/app/';
}

btnGoApp.addEventListener('click', goApp);

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  setStatus('accesso in corso...');

  if (!window.TERMO_SUPABASE) {
    setStatus('supabase non disponibile', true);
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
