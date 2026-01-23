const form = document.getElementById('practiceForm');
const statusEl = document.getElementById('status');

function setStatus(message, isError = false) {
  if (!statusEl) return;
  statusEl.textContent = message;
  statusEl.classList.toggle('error', isError);
}

form?.addEventListener('submit', async (event) => {
  event.preventDefault();
  setStatus('Creazione pratica in corso...');

  const title = document.getElementById('title')?.value.trim() || '';
  const subjectType = document.getElementById('subjectType')?.value || 'condominio';

  try {
    if (!window.__supabase) {
      throw new Error('Supabase non disponibile.');
    }

    const user = await window.getSessionUser?.();
    if (!user) {
      throw new Error('Nessuna sessione attiva.');
    }

    const { data, error } = await window.__supabase
      .from('ct_practices')
      .insert({
        owner_user_id: user.id,
        title,
        subject_type: subjectType,
      })
      .select()
      .single();

    if (error) {
      const readable = /row level security|permission|rls/i.test(error.message || '')
        ? 'Permessi insufficienti per creare la pratica.'
        : error.message || 'Errore in creazione.';
      throw new Error(readable);
    }

    window.location.href = `/ct30/pratiche/detail/?id=${data.id}`;
  } catch (error) {
    setStatus(error.message, true);
  }
});
