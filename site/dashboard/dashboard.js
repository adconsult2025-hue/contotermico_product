const who = document.getElementById('who');
const superadminBadge = document.getElementById('superadmin-badge');
const practicesBody = document.getElementById('table-pratiche-body');
const practicesEmpty = document.getElementById('table-pratiche-empty');
const newPracticeButton = document.getElementById('btn-new-pratica');

function renderPracticesError(message) {
  if (!practicesBody) return;
  practicesBody.innerHTML = `
    <tr>
      <td colspan="4" class="error-text">Errore: ${message}</td>
    </tr>
  `;
}

async function loadUser() {
  const user = await window.getSessionUser?.();
  if (who) {
    who.textContent = user?.email || '';
  }
  if (superadminBadge) {
    const isAdmin = await window.isSuperadmin?.();
    superadminBadge.style.display = isAdmin ? 'inline-flex' : 'none';
  }
}

function formatDate(value) {
  if (!value) return '';
  const date = new Date(value);
  return date.toLocaleDateString('it-IT');
}

async function loadPractices() {
  if (!practicesBody) return;
  if (!window.__supabase) {
    renderPracticesError('Supabase non disponibile. Verifica /config.js e il client.');
    return;
  }
  try {
    const user = await window.getSessionUser?.();
    const isAdmin = await window.isSuperadmin?.();
    if (!user) {
      throw new Error('Sessione non disponibile (utente non autenticato).');
    }

    let query = window.__supabase
      .from('ct_practices')
      .select('id,title,subject_type,status,created_at')
      .order('created_at', { ascending: false });

    if (!isAdmin) {
      query = query.eq('owner_user_id', user.id);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(error.message || 'Errore nel caricamento.');
    }

    if (!data?.length) {
      practicesBody.innerHTML = '';
      if (practicesEmpty) practicesEmpty.style.display = 'block';
      return;
    }

    if (practicesEmpty) practicesEmpty.style.display = 'none';
    practicesBody.innerHTML = data
      .map((practice) => {
        const href = `/ct30/pratiche/detail/?id=${practice.id}`;
        return `
          <tr class="row-link" data-href="${href}">
            <td>${practice.title || 'Senza titolo'}</td>
            <td>${practice.subject_type || '-'}</td>
            <td>${practice.status || 'draft'}</td>
            <td>${formatDate(practice.created_at)}</td>
          </tr>
        `;
      })
      .join('');

    practicesBody.querySelectorAll('.row-link').forEach((row) => {
      row.addEventListener('click', (event) => {
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

newPracticeButton?.addEventListener('click', () => {
  window.location.href = '/ct30/pratiche/new/';
});

document.getElementById('logout')?.addEventListener('click', async () => {
  await window.__supabase?.auth.signOut();
  window.location.href = '/login/';
});

loadUser();
loadPractices();
