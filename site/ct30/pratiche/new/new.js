const form = document.getElementById('practiceForm');
const statusEl = document.getElementById('status');

async function fetchWithAuth(url, options = {}) {
  const session = await window.TERMO_SUPABASE.getSession();
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  if (session?.access_token) {
    headers.Authorization = `Bearer ${session.access_token}`;
  }

  return fetch(url, { ...options, headers });
}

function setStatus(message, isError = false) {
  if (!statusEl) return;
  statusEl.textContent = message;
  statusEl.classList.toggle('error', isError);
}

form?.addEventListener('submit', async (event) => {
  event.preventDefault();
  setStatus('Creazione pratica in corso...');

  const title = document.getElementById('title')?.value || '';
  const subjectType = document.getElementById('subjectType')?.value || 'CONDOMINIO';

  try {
    const response = await fetchWithAuth('/.netlify/functions/ct-practices-create', {
      method: 'POST',
      body: JSON.stringify({ title, subject_type: subjectType }),
    });

    const payload = await response.json();
    if (!payload.ok) {
      throw new Error(payload.error || 'Errore in creazione.');
    }

    window.location.href = `/ct30/pratiche/detail/?id=${payload.id}`;
  } catch (error) {
    setStatus(error.message, true);
  }
});
