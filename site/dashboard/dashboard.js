const who = document.getElementById('who');
const practicesBody = document.getElementById('ctPracticesBody');
const practicesEmpty = document.getElementById('ctPracticesEmpty');

async function loadUser() {
  if (!window.TERMO_SUPABASE) return;
  const session = await window.TERMO_SUPABASE.getSession();
  if (who) {
    who.textContent = session?.user?.email || '';
  }
}

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

function formatDate(value) {
  if (!value) return '';
  const date = new Date(value);
  return date.toLocaleDateString('it-IT');
}

async function loadPractices() {
  if (!practicesBody) return;
  try {
    const response = await fetchWithAuth('/.netlify/functions/ct-practices-list');
    const payload = await response.json();

    if (!payload.ok) {
      throw new Error(payload.error || 'Errore nel caricamento.');
    }

    if (!payload.practices?.length) {
      practicesBody.innerHTML = '';
      if (practicesEmpty) practicesEmpty.style.display = 'block';
      return;
    }

    if (practicesEmpty) practicesEmpty.style.display = 'none';
    practicesBody.innerHTML = payload.practices
      .map((practice) => {
        const href = `/ct30/pratiche/detail/?id=${practice.id}`;
        return `
        <tr class="row-link" data-href="${href}">
          <td>${practice.title || 'Senza titolo'}</td>
          <td>${practice.status || 'draft'}</td>
          <td>${formatDate(practice.created_at)}</td>
          <td class="align-right">
            <a class="link" href="${href}">Apri</a>
          </td>
        </tr>
      `;
      })
      .join('');

    practicesBody.querySelectorAll('.row-link').forEach((row) => {
      row.addEventListener('click', (event) => {
        if (event.target?.closest('a')) return;
        const href = row.dataset.href;
        if (href) window.location.href = href;
      });
    });
  } catch (error) {
    practicesBody.innerHTML = `
      <tr>
        <td colspan="4" class="error-text">Errore: ${error.message}</td>
      </tr>
    `;
  }
}

document.getElementById('logout')?.addEventListener('click', async () => {
  await window.TERMO_SUPABASE.signOut();
  window.location.href = '/login/';
});

loadUser();
loadPractices();
