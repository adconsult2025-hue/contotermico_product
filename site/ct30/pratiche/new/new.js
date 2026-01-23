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
    const { data: sessionData, error: sessionError } =
      await window.TERMO_SUPABASE.supabase.auth.getSession();
    if (sessionError) {
      throw new Error(sessionError.message || 'Sessione non disponibile.');
    }
    const user = sessionData?.session?.user;
    if (!user) {
      throw new Error('Nessuna sessione attiva.');
    }

    const { data, error } = await window.TERMO_SUPABASE.supabase
      .from('ct_practices')
      .insert({
        owner_user_id: user.id,
        title,
        subject_type: subjectType,
      })
      .select()
      .single();

    if (error) {
      throw new Error(error.message || 'Errore in creazione.');
    }

    window.location.href = `/ct30/pratiche/detail/?id=${data.id}`;
  } catch (error) {
    setStatus(error.message, true);
  }
});
