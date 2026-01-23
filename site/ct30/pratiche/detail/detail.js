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

function renderUnits(paneEl, units, practiceId, uid) {
  paneEl.innerHTML = `
    <div class="panel">
      <div class="row" style="justify-content:space-between; align-items:center;">
        <h2>Unità</h2>
        <button class="btn secondary" id="btnAddUnit" style="width:auto;">Aggiungi unità</button>
      </div>
      <div class="muted small" style="margin-top:6px;">Tipologie: PA (100%), Uffici (65%), Residenziale, Altro.</div>
      <div id="unitsEmpty" class="muted small" style="margin-top:10px; display:none;">
        Nessuna unità presente. Aggiungi la prima unità per proseguire.
      </div>
      <div id="unitsError" class="error-text small" style="margin-top:10px; display:none;"></div>
      <div id="unitsList" style="margin-top:10px;"></div>

      <div id="unitForm" style="display:none; margin-top:14px;">
        <div class="grid2">
          <label>Codice unità<input id="unit_code" placeholder="es. INT. 3 / Scala A - 2°p" /></label>
          <label>Tipo unità
            <select id="unit_type">
              <option value="pa">PA</option>
              <option value="ufficio">Ufficio</option>
              <option value="residenziale" selected>Residenziale</option>
              <option value="altro">Altro</option>
            </select>
          </label>
          <label>Millesimi<input id="unit_millesimi" type="number" step="0.01" value="0" /></label>
          <label>% Ammissibile<input id="unit_eligible" type="number" step="0.01" placeholder="es. 100 / 65 / 0" /></label>
          <label>Note<input id="unit_notes" placeholder="Note facoltative" /></label>
        </div>
        <div class="row" style="gap:10px; margin-top:12px;">
          <button class="btn primary" id="btnSaveUnit" style="width:auto;">Salva unità</button>
          <button class="btn secondary" id="btnCancelUnit" style="width:auto;">Annulla</button>
        </div>
      </div>
    </div>
  `;

  const listEl = paneEl.querySelector('#unitsList');
  const emptyEl = paneEl.querySelector('#unitsEmpty');
  const errEl = paneEl.querySelector('#unitsError');
  const formEl = paneEl.querySelector('#unitForm');
  const addBtn = paneEl.querySelector('#btnAddUnit');
  const saveBtn = paneEl.querySelector('#btnSaveUnit');
  const cancelBtn = paneEl.querySelector('#btnCancelUnit');

  if (!units.length) {
    emptyEl.style.display = '';
    listEl.innerHTML = '';
  } else {
    emptyEl.style.display = 'none';
    listEl.innerHTML = units.map(u => `
      <div class="row" style="justify-content:space-between; padding:10px 0; border-bottom:1px solid rgba(255,255,255,.08);">
        <div>
          <div><b>${esc(u.unit_code || '')}</b> — ${esc(u.unit_type || '')}</div>
          <div class="muted small">Millesimi: ${u.millesimi ?? ''} · % Ammissibile: ${u.eligible_pct ?? ''}</div>
          ${u.notes ? `<div class="muted small">${esc(u.notes)}</div>` : ''}
        </div>
      </div>
    `).join('');
  }

  addBtn.addEventListener('click', () => {
    formEl.style.display = '';
    errEl.style.display = 'none';
    errEl.textContent = '';
  });

  cancelBtn.addEventListener('click', () => {
    formEl.style.display = 'none';
  });

  saveBtn.addEventListener('click', async () => {
    const payload = {
      practice_id: practiceId,
      owner_user_id: uid,
      unit_code: paneEl.querySelector('#unit_code').value.trim(),
      unit_type: paneEl.querySelector('#unit_type').value || 'residenziale',
      millesimi: Number(paneEl.querySelector('#unit_millesimi').value || 0),
      eligible_pct: paneEl.querySelector('#unit_eligible').value === '' ? null : Number(paneEl.querySelector('#unit_eligible').value),
      notes: paneEl.querySelector('#unit_notes').value.trim() || null
    };
    if (!payload.unit_code) {
      errEl.textContent = 'Inserisci il codice unità.';
      errEl.style.display = '';
      return;
    }
    const { error } = await window.__supabase.from('ct_units').insert(payload);
    if (error) {
      errEl.textContent = `Errore salvataggio unità: ${error.message}`;
      errEl.style.display = '';
      return;
    }
    const updated = await loadUnits(practiceId);
    renderUnits(paneEl, updated, practiceId, uid);
  });
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

function renderInterventions(paneEl, rows, practiceId, uid) {
  paneEl.innerHTML = `
    <div class="panel">
      <div class="row" style="justify-content:space-between; align-items:center;">
        <h2>Interventi</h2>
        <button class="btn secondary" id="btnAddInt" style="width:auto;">Aggiungi intervento</button>
      </div>
      <div class="muted small" style="margin-top:6px;">Minimo: scegli un codice (PDC / FV_PDC / INVOLUCRO). I parametri tecnici li completiamo dopo.</div>
      <div id="intEmpty" class="muted small" style="margin-top:10px; display:none;">
        Nessun intervento presente. Aggiungi il primo intervento per avviare la simulazione.
      </div>
      <div id="intError" class="error-text small" style="margin-top:10px; display:none;"></div>
      <div id="intList" style="margin-top:10px;"></div>

      <div id="intForm" style="display:none; margin-top:14px;">
        <div class="grid2">
          <label>Codice<input id="int_code" placeholder="es. PDC, FV_PDC, INVOLUCRO" /></label>
          <label>Titolo<input id="int_title" placeholder="Titolo o descrizione breve" /></label>
          <label>Valore<input id="int_main" type="number" step="0.01" value="0" /></label>
          <label>Unità<input id="int_unit" placeholder="kW / m2 / kWh" /></label>
          <label>Costi ammissibili (€)<input id="int_cost" type="number" step="0.01" value="0" /></label>
        </div>
        <div class="row" style="gap:10px; margin-top:12px;">
          <button class="btn primary" id="btnSaveInt" style="width:auto;">Salva intervento</button>
          <button class="btn secondary" id="btnCancelInt" style="width:auto;">Annulla</button>
        </div>
      </div>

      <div class="row" style="gap:10px; margin-top:14px;">
        <button class="btn primary" id="btnCalc" style="width:auto;">Calcola (stub)</button>
        <div id="calcStatus" class="muted small"></div>
      </div>
    </div>
  `;

  const listEl = paneEl.querySelector('#intList');
  const emptyEl = paneEl.querySelector('#intEmpty');
  const errEl = paneEl.querySelector('#intError');
  const formEl = paneEl.querySelector('#intForm');
  const addBtn = paneEl.querySelector('#btnAddInt');
  const saveBtn = paneEl.querySelector('#btnSaveInt');
  const cancelBtn = paneEl.querySelector('#btnCancelInt');
  const calcBtn = paneEl.querySelector('#btnCalc');
  const calcStatus = paneEl.querySelector('#calcStatus');

  if (!rows.length) {
    emptyEl.style.display = '';
    listEl.innerHTML = '';
  } else {
    emptyEl.style.display = 'none';
    listEl.innerHTML = rows.map(r => `
      <div class="row" style="justify-content:space-between; padding:10px 0; border-bottom:1px solid rgba(255,255,255,.08);">
        <div>
          <div><b>${esc(r.intervention_code)}</b> — ${esc(r.title || '')}</div>
          <div class="muted small">Valore: ${r.data?.main_value ?? ''} ${esc(r.data?.unit || '')} · Costi ammissibili: € ${r.data?.eligible_costs ?? ''}</div>
        </div>
      </div>
    `).join('');
  }

  addBtn.addEventListener('click', () => {
    formEl.style.display = '';
    errEl.style.display = 'none';
    errEl.textContent = '';
  });

  cancelBtn.addEventListener('click', () => {
    formEl.style.display = 'none';
  });

  saveBtn.addEventListener('click', async () => {
    const code = paneEl.querySelector('#int_code').value.trim().toUpperCase();
    const title = paneEl.querySelector('#int_title').value.trim();
    if (!code) {
      errEl.textContent = 'Inserisci il codice intervento.';
      errEl.style.display = '';
      return;
    }
    const data = {
      main_value: Number(paneEl.querySelector('#int_main').value || 0),
      unit: paneEl.querySelector('#int_unit').value.trim() || null,
      eligible_costs: Number(paneEl.querySelector('#int_cost').value || 0)
    };
    const payload = {
      practice_id: practiceId,
      owner_user_id: uid,
      intervention_code: code,
      title,
      data
    };
    const { error } = await window.__supabase.from('ct_interventions').insert(payload);
    if (error) {
      errEl.textContent = `Errore salvataggio intervento: ${error.message}`;
      errEl.style.display = '';
      return;
    }
    const updated = await loadInterventions(practiceId);
    renderInterventions(paneEl, updated, practiceId, uid);
  });

  calcBtn.addEventListener('click', async () => {
    calcStatus.textContent = 'Calcolo in corso…';
    try {
      const inputSnapshot = {
        interventions: rows.map((r) => ({
          id: r.id,
          code: r.intervention_code,
          title: r.title,
          data: r.data || {}
        }))
      };
      const { data: runRows, error: runErr } = await window.__supabase
        .from('ct_calc_runs')
        .insert({
          practice_id: practiceId,
          owner_user_id: uid,
          engine_version: 'stub-0.1',
          input_snapshot: inputSnapshot
        })
        .select('*');
      if (runErr) throw runErr;
      const runId = runRows?.[0]?.id;
      if (!runId) throw new Error('Run non creato.');

      if (rows.length) {
        const results = rows.map((r) => ({
          run_id: runId,
          practice_id: practiceId,
          owner_user_id: uid,
          scope: 'intervention',
          ref_id: r.id,
          result: {
            intervention_code: r.intervention_code,
            eligible_costs: r.data?.eligible_costs ?? 0,
            main_value: r.data?.main_value ?? 0,
            unit: r.data?.unit ?? null
          }
        }));
        const { error: resErr } = await window.__supabase
          .from('ct_calc_results')
          .insert(results);
        if (resErr) throw resErr;
      }
      calcStatus.textContent = `Ok. Run creato: ${runId}`;
    } catch (e) {
      calcStatus.textContent = `Errore calcolo: ${e?.message || e}`;
    }
  });
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
  renderUnits(paneU, units, practice.id, uid);

  const ints = await loadInterventions(practice.id);
  renderInterventions(paneI, ints, practice.id, uid);

  setStatus('Pratica caricata.');
}

main().catch((e) => setStatus('Errore: ' + (e?.message || e), true));
