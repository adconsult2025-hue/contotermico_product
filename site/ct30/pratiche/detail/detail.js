const practiceStatusEl = document.getElementById('practiceStatus');
const practiceTitleEl = document.getElementById('practiceTitle');
const practiceSubjectEl = document.getElementById('practiceSubject');
const practiceStateEl = document.getElementById('practiceState');
const practiceCreatedEl = document.getElementById('practiceCreated');
const simulationButtonEl = document.getElementById('runSimulation');
const simulationOutputEl = document.getElementById('simulationOutput');
const simulationStatusEl = document.getElementById('simulationStatus');

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
    if (simulationStatusEl) {
      simulationStatusEl.textContent = 'Seleziona una pratica valida per simulare.';
      simulationStatusEl.classList.add('error');
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

async function runSimulation() {
  if (!practiceId) return;
  if (simulationOutputEl) simulationOutputEl.textContent = 'Calcolo in corso...';
  if (simulationStatusEl) {
    simulationStatusEl.textContent = 'Esecuzione motore di calcolo in corso.';
    simulationStatusEl.classList.remove('error');
  }

  try {
    const res = await fetch('/.netlify/functions/ct-calc', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ practice_id: practiceId }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json.ok) {
      throw new Error(json?.error || `HTTP ${res.status}`);
    }
    if (simulationOutputEl) simulationOutputEl.textContent = JSON.stringify(json, null, 2);
    if (simulationStatusEl) simulationStatusEl.textContent = 'Simulazione completata.';
  } catch (error) {
    if (simulationOutputEl) simulationOutputEl.textContent = 'Errore: ' + (error?.message || error);
    if (simulationStatusEl) {
      simulationStatusEl.textContent = 'Errore durante la simulazione.';
      simulationStatusEl.classList.add('error');
    }
  }
}

loadPractice();

if (simulationButtonEl) {
  simulationButtonEl.addEventListener('click', runSimulation);
}
