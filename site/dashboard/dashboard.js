const who = document.getElementById('who');
const practicesBody = document.getElementById('table-pratiche-body');
const practicesEmpty = document.getElementById('table-pratiche-empty');
const newPracticeButton = document.getElementById('btn-new-pratica');

async function loadUser() {
  if (!window.__supabase) return;
  const { data } = await window.__supabase.auth.getSession();
  const session = data?.session || null;
  if (who) {
    who.textContent = session?.user?.email || '';
  }
}

function formatDate(value) {
  if (!value) return '';
  const date = new Date(value);
  return date.toLocaleDateString('it-IT');
}

async function loadPractices() {
  if (!practicesBody || !window.__supabase) return;
  try {
    const { data, error } = await window.__supabase
      .from('ct_practices')
      .select()
      .order('created_at', { ascending: false });

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
