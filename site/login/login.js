const statusEl = document.getElementById('status');
const whoEl = document.getElementById('who');
const btnLogin = document.getElementById('btnLogin');
const btnGoApp = document.getElementById('btnGoApp');

function setStatus(text, isErr = false) {
  statusEl.classList.toggle('error', Boolean(isErr));
  statusEl.querySelector('strong').textContent = text;
}

function goApp() {
  window.location.href = '/app/';
}

btnLogin.addEventListener('click', () => {
  if (!window.netlifyIdentity) return;
  window.netlifyIdentity.open();
});

btnGoApp.addEventListener('click', goApp);

if (window.netlifyIdentity) {
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
  });
  window.netlifyIdentity.init();
} else {
  setStatus('widget non caricato', true);
}
