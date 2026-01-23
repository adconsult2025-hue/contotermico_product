const practiceStatusEl = document.getElementById('practiceStatus');
const practiceTitleEl = document.getElementById('practiceTitle');
const practiceSubjectEl = document.getElementById('practiceSubject');
const practiceStateEl = document.getElementById('practiceState');
const practiceCreatedEl = document.getElementById('practiceCreated');

const params = new URLSearchParams(window.location.search);
const practiceId = params.get('id');

function formatDate(value) {
  if (!value) return '';
  return new Date(value).toLocaleDateString('it-IT');
}

async function loadPractice() {
  if (!practiceId) {
    if (practiceStatusEl) {
      practiceStatusEl.textContent = 'ID pratica non valido.';
      practiceStatusEl.classList.add('error');
    }
    return;
  }

  const user = await window.getSessionUser?.();
  if (!user) {
    window.location.href = '/login/';
    return;
  }

  const supa = window.__supabase;
  if (!supa) return;

  try {
    const { data, error } = await supa
      .from('ct_practices')
      .select('*')
      .eq('id', practiceId)
      .single();

    if (error) {
      throw new Error(error.message || 'Errore nel caricamento.');
    }

    if (practiceTitleEl) practiceTitleEl.value = data.title || 'Pratica CT3.0';
    if (practiceSubjectEl) practiceSubjectEl.value = data.subject_type || '-';
    if (practiceStateEl) practiceStateEl.value = data.status || 'draft';
    if (practiceCreatedEl) practiceCreatedEl.value = formatDate(data.created_at);

    if (practiceStatusEl) {
      practiceStatusEl.textContent = 'Dati pratica caricati correttamente.';
      practiceStatusEl.classList.remove('error');
    }
  } catch (error) {
    if (practiceStatusEl) {
      practiceStatusEl.textContent = `Errore: ${error.message}`;
      practiceStatusEl.classList.add('error');
    }
  }
}

loadPractice();
