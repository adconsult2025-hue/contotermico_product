// TERMO 3.0 - Practice detail (Condominio first)
// Requires window.__supabase initialized.

const qs = new URLSearchParams(location.search);
const practiceId = qs.get('id');

const $ = (sel) => document.querySelector(sel);

function esc(s) {
  return String(s || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

async function getUid() {
  const { data, error } = await window.__supabase.auth.getSession();
  if (error) return null;
  return data?.session?.user?.id || null;
}

function setStatus(msg, isErr = false) {
  const el = $('#status');
  if (!el) return;
  el.textContent = msg || '';
  el.style.color = isErr ? 'var(--danger)' : 'var(--muted)';
}

async function loadPractice() {
  if (!practiceId) {
    setStatus('ID pratica mancante.', true);
    return null;
  }
  const { data, error } = await window.__supabase
    .from('ct_practices')
    .select('*')
    .eq('id', practiceId)
    .maybeSingle();
  if (error) {
    setStatus('Errore caricamento pratica: ' + error.message, true);
    return null;
  }
  if (!data) {
    setStatus('Pratica non trovata.', true);
    return null;
  }
  return data;
}

async function ensureSubject(practice, uid) {
  // One subject row per practice (data jsonb)
  const { data: existing, error: e1 } = await window.__supabase
    .from('ct_subjects')
    .select('*')
    .eq('practice_id', practice.id)
    .maybeSingle();
  if (e1) throw e1;
  if (existing) return existing;
  const payload = {
    practice_id: practice.id,
    owner_user_id: uid,
    data: {
      kind: 'condominio',
      denominazione: '',
      cf: '',
      indirizzo: '',
      comune: '',
      provincia: '',
      amministratore: { nome: '', email: '', tel: '' }
    }
  };
  const { data: ins, error: e2 } = await window.__supabase
    .from('ct_subjects')
    .insert(payload)
    .select('*')
    .single();
  if (e2) throw e2;
  return ins;
}

function renderTabs() {
  const tabs = $('#tabs');
  if (!tabs) return;
  tabs.innerHTML = `
    <button class="tab active" data-tab="soggetto">Soggetto</button>
    <button class="tab" data-tab="unita">Unità</button>
    <button class="tab" data-tab="interventi">Interventi</button>
  `;
  tabs.querySelectorAll('.tab').forEach((b) => {
    b.addEventListener('click', () => {
      tabs.querySelectorAll('.tab').forEach((x) => x.classList.remove('active'));
      b.classList.add('active');
      showTab(b.dataset.tab);
    });
  });
}

function showTab(name) {
  document.querySelectorAll('[data-pane]').forEach((p) => {
    p.style.display = p.dataset.pane === name ? '' : 'none';
  });
}

function renderSubjectForm(subject) {
  const pane = $('#pane-soggetto');
  const d = subject?.data || {};
  pane.innerHTML = `
    <div class="panel">
      <h2>Anagrafica Condominio</h2>
      <div class="grid2">
        <label>Denominazione<input id="s_den" value="${esc(d.denominazione)}" /></label>
        <label>Codice Fiscale<input id="s_cf" value="${esc(d.cf)}" /></label>
        <label>Indirizzo<input id="s_ind" value="${esc(d.indirizzo)}" /></label>
        <label>Comune<input id="s_com" value="${esc(d.comune)}" /></label>
        <label>Provincia<input id="s_prov" value="${esc(d.provincia)}" /></label>
      </div>
      <h3 style="margin-top:16px;">Amministratore</h3>
      <div class="grid3">
        <label>Nome<input id="s_adm_nome" value="${esc(d.amministratore?.nome)}" /></label>
        <label>Email<input id="s_adm_email" value="${esc(d.amministratore?.email)}" /></label>
        <label>Telefono<input id="s_adm_tel" value="${esc(d.amministratore?.tel)}" /></label>
      </div>
      <div class="row" style="margin-top:14px; gap:10px;">
        <button class="btn" id="btnSaveSubject" style="width:auto;">Salva soggetto</button>
        <span class="muted" id="subjectSavedHint"></span>
      </div>
    </div>
  `;

  $('#btnSaveSubject').addEventListener('click', async () => {
    const newData = {
      ...(subject.data || {}),
      kind: 'condominio',
      denominazione: $('#s_den').value.trim(),
      cf: $('#s_cf').value.trim(),
      indirizzo: $('#s_ind').value.trim(),
      comune: $('#s_com').value.trim(),
      provincia: $('#s_prov').value.trim(),
      amministratore: {
        nome: $('#s_adm_nome').value.trim(),
        email: $('#s_adm_email').value.trim(),
        tel: $('#s_adm_tel').value.trim()
      }
    };

    const { error } = await window.__supabase
      .from('ct_subjects')
      .update({ data: newData, updated_at: new Date().toISOString() })
      .eq('id', subject.id);

    if (error) {
      $('#subjectSavedHint').textContent = 'Errore: ' + error.message;
      $('#subjectSavedHint').style.color = 'var(--danger)';
      return;
    }
    $('#subjectSavedHint').textContent = 'Salvato.';
    $('#subjectSavedHint').style.color = 'var(--muted)';
  });
}

async function loadUnits(practiceId) {
  const { data, error } = await window.__supabase
    .from('ct_units')
    .select('*')
    .eq('practice_id', practiceId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

function renderUnits(paneEl, units) {
  paneEl.innerHTML = `
    <div class="panel">
      <div class="row" style="justify-content:space-between; align-items:center;">
        <h2>Unità immobiliari</h2>
        <button class="btn secondary" id="btnAddUnit" style="width:auto;">Aggiungi unità</button>
      </div>
      <div class="muted small">Tipologie: PA (100%), Uffici (65%), Residenziale (0% se non ammesso in condominio), Altro.</div>
      <div class="tableWrap" style="margin-top:12px;">
        <table class="table">
          <thead><tr>
            <th>Unità</th><th>Tipo</th><th>Millesimi</th><th>% Ammiss.</th><th>Note</th>
          </tr></thead>
          <tbody id="unitsBody"></tbody>
        </table>
      </div>
      <div class="muted small" style="margin-top:10px;" id="unitsHint"></div>
    </div>
  `;

  const body = paneEl.querySelector('#unitsBody');
  if (!units.length) {
    body.innerHTML = `<tr><td colspan="5" class="muted">Nessuna unità. Aggiungila per calcolare ammissibilità e ripartizioni.</td></tr>`;
  } else {
    body.innerHTML = units.map(u => `
      <tr>
        <td>${esc(u.unit_code || '')}</td>
        <td>${esc(u.unit_type || '')}</td>
        <td>${u.millesimi ?? ''}</td>
        <td>${u.eligible_pct ?? ''}</td>
        <td>${esc(u.notes || '')}</td>
      </tr>
    `).join('');
  }
}

async function addUnit(practiceId, uid) {
  const unit_code = prompt('Codice unità (es. INT. 3 / Scala A - 2°p):');
  if (unit_code === null) return;
  const unit_type = prompt("Tipo unità: pa / ufficio / residenziale / altro", "residenziale");
  if (unit_type === null) return;
  const eligible_pct = prompt("Percentuale ammissibile (es. 100 / 65 / 0). Lascia vuoto per decidere dopo:", "");
  const payload = {
    practice_id: practiceId,
    owner_user_id: uid,
    unit_code: unit_code.trim(),
    unit_type: (unit_type || 'residenziale').trim().toLowerCase(),
    eligible_pct: eligible_pct === '' ? null : Number(eligible_pct),
  };
  const { error } = await window.__supabase.from('ct_units').insert(payload);
  if (error) throw error;
}

async function loadInterventions(practiceId) {
  const { data, error } = await window.__supabase
    .from('ct_interventions')
    .select('*')
    .eq('practice_id', practiceId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

function renderInterventions(paneEl, rows) {
  paneEl.innerHTML = `
    <div class="panel">
      <div class="row" style="justify-content:space-between; align-items:center;">
        <h2>Interventi</h2>
        <button class="btn secondary" id="btnAddInt" style="width:auto;">Aggiungi intervento</button>
      </div>
      <div class="muted small">Minimo: scegli un codice (PDC / FV_PDC / INVOLUCRO). I parametri tecnici li completiamo dopo.</div>
      <div class="tableWrap" style="margin-top:12px;">
        <table class="table">
          <thead><tr>
            <th>Codice</th><th>Titolo</th><th>Parametri</th>
          </tr></thead>
          <tbody id="intBody"></tbody>
        </table>
      </div>
    </div>
  `;
  const body = paneEl.querySelector('#intBody');
  if (!rows.length) {
    body.innerHTML = `<tr><td colspan="3" class="muted">Nessun intervento. Aggiungilo per avviare il calcolo incentivo.</td></tr>`;
  } else {
    body.innerHTML = rows.map(r => `
      <tr>
        <td>${esc(r.intervention_code)}</td>
        <td>${esc(r.title || '')}</td>
        <td class="muted small">${esc(JSON.stringify(r.data || {}))}</td>
      </tr>
    `).join('');
  }
}

async function addIntervention(practiceId, uid) {
  const code = prompt("Codice intervento: PDC / FV_PDC / INVOLUCRO", "PDC");
  if (code === null) return;
  const title = prompt("Titolo intervento (opzionale):", "");
  if (title === null) return;
  const payload = {
    practice_id: practiceId,
    owner_user_id: uid,
    intervention_code: code.trim().toUpperCase(),
    title: title.trim(),
    data: {}
  };
  const { error } = await window.__supabase.from('ct_interventions').insert(payload);
  if (error) throw error;
}

async function main() {
  if (!window.__supabase) {
    setStatus('Supabase non disponibile.', true);
    return;
  }
  const uid = await getUid();
  if (!uid) {
    setStatus('Sessione non disponibile.', true);
    return;
  }
  const practice = await loadPractice();
  if (!practice) return;

  renderTabs();
  showTab('soggetto');

  // panes exist in HTML
  const paneS = $('#pane-soggetto');
  const paneU = $('#pane-unita');
  const paneI = $('#pane-interventi');

  const subject = await ensureSubject(practice, uid);
  renderSubjectForm(subject);

  const units = await loadUnits(practice.id);
  renderUnits(paneU, units);
  paneU.querySelector('#btnAddUnit').addEventListener('click', async () => {
    try {
      await addUnit(practice.id, uid);
      const updated = await loadUnits(practice.id);
      renderUnits(paneU, updated);
      paneU.querySelector('#btnAddUnit').addEventListener('click', async () => {
        await addUnit(practice.id, uid);
      });
    } catch (e) {
      alert('Errore unità: ' + (e?.message || e));
    }
  });

  const ints = await loadInterventions(practice.id);
  renderInterventions(paneI, ints);
  paneI.querySelector('#btnAddInt').addEventListener('click', async () => {
    try {
      await addIntervention(practice.id, uid);
      const updated = await loadInterventions(practice.id);
      renderInterventions(paneI, updated);
      paneI.querySelector('#btnAddInt').addEventListener('click', async () => {
        await addIntervention(practice.id, uid);
      });
    } catch (e) {
      alert('Errore interventi: ' + (e?.message || e));
    }
  });

  setStatus('Pratica caricata.');
}

main().catch((e) => setStatus('Errore: ' + (e?.message || e), true));
