const practiceTitleEl = document.getElementById('practiceTitle');
const practiceMetaEl = document.getElementById('practiceMeta');
const practiceStatusEl = document.getElementById('practiceStatus');
const subjectTypeEl = document.getElementById('subjectType');
const practiceIdEl = document.getElementById('practiceId');
const documentsBody = document.getElementById('documentsBody');
const uploadForm = document.getElementById('uploadForm');
const uploadStatus = document.getElementById('uploadStatus');

const params = new URLSearchParams(window.location.search);
const practiceId = params.get('id');

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

function setUploadStatus(message, isError = false) {
  if (!uploadStatus) return;
  uploadStatus.textContent = message;
  uploadStatus.classList.toggle('error', isError);
}

function formatDate(value) {
  if (!value) return '';
  return new Date(value).toLocaleDateString('it-IT');
}

function renderDocuments(documents) {
  if (!documentsBody) return;
  if (!documents?.length) {
    documentsBody.innerHTML = `
      <tr>
        <td colspan="4" class="muted">Nessun documento caricato.</td>
      </tr>
    `;
    return;
  }

  documentsBody.innerHTML = documents
    .map((doc) => {
      return `
        <tr>
          <td>${doc.filename || 'Documento'}</td>
          <td>${doc.kind || '-'}</td>
          <td>${formatDate(doc.created_at)}</td>
          <td class="small">${doc.storage_path || ''}</td>
        </tr>
      `;
    })
    .join('');
}

async function loadPractice() {
  if (!practiceId) {
    if (practiceStatusEl) {
      practiceStatusEl.textContent = 'ID pratica non valido.';
      practiceStatusEl.classList.add('error');
    }
    return;
  }

  try {
    const response = await fetchWithAuth(`/.netlify/functions/ct-practices-get?id=${practiceId}`);
    const payload = await response.json();

    if (!payload.ok) {
      throw new Error(payload.error || 'Errore nel caricamento.');
    }

    const practice = payload.practice || {};
    if (practiceTitleEl) {
      practiceTitleEl.textContent = practice.title || 'Pratica CT3.0';
    }
    if (practiceMetaEl) {
      practiceMetaEl.textContent = `Stato: ${practice.status || 'draft'} · Creata ${formatDate(practice.created_at)}`;
    }
    if (practiceStatusEl) {
      practiceStatusEl.textContent = 'Dati anagrafica disponibili per la pratica.';
      practiceStatusEl.classList.remove('error');
    }

    if (practiceIdEl) practiceIdEl.value = practice.id || practiceId;
    if (subjectTypeEl) {
      subjectTypeEl.value = practice.subject_type || payload.subject?.data?.subject_type || '';
    }

    renderDocuments(payload.documents || []);
  } catch (error) {
    if (practiceStatusEl) {
      practiceStatusEl.textContent = `Errore: ${error.message}`;
      practiceStatusEl.classList.add('error');
    }
  }
}

uploadForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const fileInput = document.getElementById('docFile');
  const kindInput = document.getElementById('docKind');
  const file = fileInput?.files?.[0];

  if (!file) {
    setUploadStatus('Seleziona un file da caricare.', true);
    return;
  }

  setUploadStatus('Preparazione upload...');

  try {
    const uploadResponse = await fetchWithAuth('/.netlify/functions/ct-doc-upload-url', {
      method: 'POST',
      body: JSON.stringify({
        practice_id: practiceId,
        filename: file.name,
      }),
    });
    const uploadPayload = await uploadResponse.json();

    if (!uploadPayload.ok) {
      throw new Error(uploadPayload.error || 'Errore nella generazione URL.');
    }

    const uploadResult = await fetch(uploadPayload.uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': file.type || 'application/octet-stream',
      },
      body: file,
    });

    if (!uploadResult.ok) {
      throw new Error('Upload fallito.');
    }

    const attachResponse = await fetchWithAuth('/.netlify/functions/ct-doc-attach', {
      method: 'POST',
      body: JSON.stringify({
        practice_id: practiceId,
        filename: file.name,
        storage_path: uploadPayload.storagePath,
        kind: kindInput?.value || '',
      }),
    });
    const attachPayload = await attachResponse.json();

    if (!attachPayload.ok) {
      throw new Error(attachPayload.error || 'Errore nel salvataggio documento.');
    }

    setUploadStatus('Documento caricato con successo.');
    if (fileInput) fileInput.value = '';
    if (kindInput) kindInput.value = '';
    await loadPractice();
  } catch (error) {
    setUploadStatus(error.message, true);
  }
});

document.querySelectorAll('.tab-btn').forEach((button) => {
  button.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach((btn) => btn.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach((panel) => panel.classList.remove('active'));

    button.classList.add('active');
    const target = button.dataset.tab;
    const panel = document.getElementById(`tab-${target}`);
    if (panel) panel.classList.add('active');
  });
});

loadPractice();
