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
    <div class="panel ct-section">
      <div class="ct-section__head">
        <h2 class="ct-section__title">Anagrafica Condominio</h2>
      </div>
      <div class="ct-form">
        <div class="ct-field">
          <label for="s_den">Denominazione</label>
          <input id="s_den" value="${esc(d.denominazione)}" />
        </div>
        <div class="ct-field">
          <label for="s_cf">Codice Fiscale</label>
          <input id="s_cf" value="${esc(d.cf)}" />
        </div>
        <div class="ct-field">
          <label for="s_ind">Indirizzo</label>
          <input id="s_ind" value="${esc(d.indirizzo)}" />
        </div>
        <div class="ct-field">
          <label for="s_com">Comune</label>
          <input id="s_com" value="${esc(d.comune)}" />
        </div>
        <div class="ct-field">
          <label for="s_prov">Provincia</label>
          <input id="s_prov" value="${esc(d.provincia)}" />
        </div>
      </div>
      <h3 style="margin-top:16px;">Amministratore</h3>
      <div class="ct-form ct-form--3">
        <div class="ct-field">
          <label for="s_adm_nome">Nome</label>
          <input id="s_adm_nome" value="${esc(d.amministratore?.nome)}" />
        </div>
        <div class="ct-field">
          <label for="s_adm_email">Email</label>
          <input id="s_adm_email" value="${esc(d.amministratore?.email)}" />
        </div>
        <div class="ct-field">
          <label for="s_adm_tel">Telefono</label>
          <input id="s_adm_tel" value="${esc(d.amministratore?.tel)}" />
        </div>
      </div>
      <div class="ct-actions-row">
        <span class="muted" id="subjectSavedHint" style="margin-right:auto;"></span>
        <button class="btn" id="btnSaveSubject" style="width:auto;">Salva soggetto</button>
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
  const preferred = await window.__supabase
    .from('ct_condo_units_v')
    .select('*')
    .eq('practice_id', practiceId)
    .order('created_at', { ascending: false });
  if (!preferred.error) {
    return preferred.data || [];
  }

  const fallback = await window.__supabase
    .from('ct_units')
    .select('*')
    .eq('practice_id', practiceId)
    .order('created_at', { ascending: false });
  if (fallback.error) throw fallback.error;
  return fallback.data || [];
}

function renderUnits(paneEl, units, practiceId, uid) {
  paneEl.innerHTML = `
    <div class="panel ct-section">
      <div class="ct-section__head">
        <h2 class="ct-section__title">Unità</h2>
        <button class="btn secondary" id="btnAddUnit" style="width:auto;">Aggiungi unità</button>
      </div>
      <div class="muted small" style="margin-top:6px;">Tipologie: PA (100%), Uffici (65%), Residenziale, Altro.</div>
      <div id="unitsEmpty" class="muted small" style="margin-top:10px; display:none;">
        Nessuna unità presente. Aggiungi la prima unità per proseguire.
      </div>
      <div id="unitsError" class="error-text small" style="margin-top:10px; display:none;"></div>
      <div id="unitsList" style="margin-top:10px;"></div>

      <div id="unitForm" style="display:none; margin-top:14px;">
        <div class="ct-form">
          <div class="ct-field">
            <label for="unit_code">Codice unità</label>
            <input id="unit_code" placeholder="es. INT. 3 / Scala A - 2°p" />
          </div>
          <div class="ct-field">
            <label for="unit_type">Tipo unità</label>
            <select id="unit_type">
              <option value="pa">PA</option>
              <option value="ufficio">Ufficio</option>
              <option value="residenziale" selected>Residenziale</option>
              <option value="altro">Altro</option>
            </select>
          </div>
          <div class="ct-field">
            <label for="unit_millesimi">Millesimi</label>
            <input id="unit_millesimi" type="number" step="0.01" value="0" />
          </div>
          <div class="ct-field">
            <label for="unit_eligible">% Ammissibile</label>
            <input id="unit_eligible" type="number" step="0.01" placeholder="es. 100 / 65 / 0" />
          </div>
          <div class="ct-field ct-span-2">
            <label for="unit_notes">Note</label>
            <textarea id="unit_notes" placeholder="Note facoltative"></textarea>
          </div>
        </div>
        <div class="ct-actions-row">
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
    const normalizedUnits = units.map((u) => ({
      unit_code: u.unit_code || u.sub_code || u.unit_label || '',
      unit_type: u.unit_type || u.use_type || '',
      millesimi: u.millesimi ?? '',
      eligible_pct: u.eligible_pct ?? u.eligible_share_pct ?? '',
      notes: u.notes || ''
    }));
    listEl.innerHTML = normalizedUnits.map(u => `
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
    const condoPayload = {
      practice_id: practiceId,
      sub_code: payload.unit_code,
      unit_label: payload.unit_code,
      use_type: String(payload.unit_type || 'residenziale').toUpperCase(),
      beneficiary_type: String(payload.unit_type || 'residenziale').toUpperCase() === 'PA' ? 'PA' : 'PRIVATO',
      millesimi: payload.millesimi
    };
    const preferredInsert = await window.__supabase.from('ct_condo_units').insert(condoPayload);
    if (preferredInsert.error && preferredInsert.error.code !== 'PGRST205') {
      errEl.textContent = `Errore salvataggio unità: ${preferredInsert.error.message}`;
      errEl.style.display = '';
      return;
    }
    if (preferredInsert.error?.code === 'PGRST205') {
      const { error } = await window.__supabase.from('ct_units').insert(payload);
      if (error) {
        errEl.textContent = `Errore salvataggio unità: ${error.message}`;
        errEl.style.display = '';
        return;
      }
    }
    const updated = await loadUnits(practiceId);
    renderUnits(paneEl, updated, practiceId, uid);
  });
}

function isMissingRelation(error) {
  return error?.code === 'PGRST205';
}

async function loadCatalogInterventions() {
  const preferred = await window.__supabase
    .from('ct_interventions')
    .select('code, category, description, eligible_ct')
    .order('category', { ascending: true })
    .order('code', { ascending: true });
  if (preferred.error) throw preferred.error;
  return preferred.data || [];
}

async function loadPracticeInterventions(practiceId) {
  const preferred = await window.__supabase
    .from('v_ct_practice_interventions')
    .select('id, practice_id, intervention_code, note, created_at, category, description, eligible_ct')
    .eq('practice_id', practiceId)
    .order('created_at', { ascending: true });
  if (!preferred.error) return preferred.data || [];
  if (!isMissingRelation(preferred.error)) throw preferred.error;

  const fallback = await window.__supabase
    .from('ct_practice_interventions')
    .select('id, practice_id, intervention_code, note, created_at')
    .eq('practice_id', practiceId)
    .order('created_at', { ascending: true });
  if (fallback.error) throw fallback.error;
  return fallback.data || [];
}

async function loadUnitEligibility(practiceId) {
  const preferred = await window.__supabase
    .from('v_ct_unit_eligibility')
    .select('*')
    .eq('practice_id', practiceId);
  if (!preferred.error) return preferred.data || [];
  if (!isMissingRelation(preferred.error)) throw preferred.error;
  return [];
}

function buildInterventionRows(catalog, selected, economics) {
  const selectedMap = new Map(selected.map((row) => [row.intervention_code, row]));
  return catalog.map((item) => {
    const sel = selectedMap.get(item.code);
    const econ = economics.get(item.code) || { main_value: '', eligible_costs: '' };
    return {
      code: item.code,
      category: item.category,
      description: item.description,
      eligible_ct: item.eligible_ct,
      selected: Boolean(sel),
      practiceInterventionId: sel?.id || null,
      note: sel?.note || '',
      main_value: econ.main_value,
      eligible_costs: econ.eligible_costs
    };
  });
}

async function upsertPracticeIntervention(practiceId, interventionCode, note) {
  const payload = {
    practice_id: practiceId,
    intervention_code: interventionCode,
    note: note || null
  };
  const preferred = await window.__supabase
    .from('ct_practice_interventions')
    .upsert(payload, { onConflict: 'practice_id,intervention_code' })
    .select('id, intervention_code, note')
    .single();
  if (preferred.error) throw preferred.error;
  return preferred.data;
}

async function deletePracticeIntervention(practiceId, interventionCode) {
  const { error } = await window.__supabase
    .from('ct_practice_interventions')
    .delete()
    .eq('practice_id', practiceId)
    .eq('intervention_code', interventionCode);
  if (error && !isMissingRelation(error)) throw error;
}

async function runPracticeCalc(practiceId, calcStatusEl) {
  if (!calcStatusEl) return null;
  calcStatusEl.textContent = 'Calcolo incentivo in corso…';
  try {
    const res = await fetch('/.netlify/functions/ct-calc', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ practice_id: practiceId })
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json.ok === false) {
      const msg = json?.error || `HTTP ${res.status}`;
      calcStatusEl.textContent = `Errore calcolo: ${msg}`;
      return null;
    }
    calcStatusEl.textContent = `Calcolo aggiornato. Totale incentivo: ${Number(json.total_gross || 0).toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })}`;
    return json;
  } catch (e) {
    calcStatusEl.textContent = `Errore calcolo: ${e?.message || e}`;
    return null;
  }
}

async function loadPracticeIncentive(practiceId) {
  const { data, error } = await window.__supabase
    .from('ct_practice_incentives')
    .select('practice_id, total_gross, total_net, warnings, computed_at')
    .eq('practice_id', practiceId)
    .maybeSingle();
  if (error && !isMissingRelation(error)) throw error;
  return data || null;
}

function renderCalcPreview(calcBox, incentive, calcResponse) {
  if (!calcBox) return;
  const totalGross = calcResponse?.total_gross ?? incentive?.total_gross ?? 0;
  const totalNet = calcResponse?.total_net ?? incentive?.total_net ?? totalGross;
  const warnings = calcResponse?.warnings ?? incentive?.warnings ?? [];
  const computedAt = calcResponse?.computed_at ?? incentive?.computed_at;
  const when = computedAt ? new Date(computedAt).toLocaleString('it-IT') : '—';
  const warningsHtml = Array.isArray(warnings) && warnings.length
    ? `<ul class="ct-warnings">${warnings.map((w) => `<li>${esc(w)}</li>`).join('')}</ul>`
    : '<div class="muted small">Nessun warning.</div>';
  calcBox.innerHTML = `
    <div class="ct-calc-preview__row">
      <div class="ct-calc-preview__item">
        <div class="muted small">Totale incentivo</div>
        <div class="ct-calc-preview__value">${Number(totalGross || 0).toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })}</div>
      </div>
      <div class="ct-calc-preview__item">
        <div class="muted small">Netto stimato</div>
        <div class="ct-calc-preview__value">${Number(totalNet || 0).toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })}</div>
      </div>
      <div class="ct-calc-preview__item">
        <div class="muted small">Ultimo calcolo</div>
        <div class="ct-calc-preview__value ct-calc-preview__value--small">${esc(when)}</div>
      </div>
    </div>
    <div style="margin-top:10px;">
      <div class="muted small" style="margin-bottom:6px;">Warnings</div>
      ${warningsHtml}
    </div>
  `;
}

function renderInterventions(paneEl, catalogRows, selectedRows, practiceId, economicsState, incentive) {
  const rows = buildInterventionRows(catalogRows, selectedRows, economicsState);
  paneEl.innerHTML = `
    <div class="panel ct-section">
      <div class="ct-section__head">
        <div>
          <h2 class="ct-section__title">Interventi</h2>
          <div class="ct-section__sub">Catalogo interventi CT con selezione per pratica e note operative.</div>
        </div>
        <div id="interventionsMeta" class="muted small"></div>
      </div>
      <div id="intError" class="error-text small" style="margin-top:10px; display:none;"></div>
      <div class="ct-table-wrap ct-table-wrap--interventions" style="margin-top:12px;">
        <table class="ct-table ct-table--interventions" id="interventionsTable">
          <thead>
            <tr>
              <th style="width: 12rem;">Categoria</th>
              <th style="width: 10rem;">Codice</th>
              <th>Descrizione</th>
              <th style="width: 9rem; text-align:center;">Selezionato</th>
              <th style="width: 20rem;">Note</th>
            </tr>
          </thead>
          <tbody></tbody>
        </table>
      </div>
      <div class="ct-calc-preview" id="calcPreview" style="margin-top:14px;"></div>
      <div class="row" style="gap:10px; margin-top:12px; align-items:center;">
        <button class="btn primary" id="btnCalc" style="width:auto;">Ricalcola incentivo</button>
        <div id="calcStatus" class="muted small"></div>
      </div>
    </div>
  `;

  const errEl = paneEl.querySelector('#intError');
  const tbody = paneEl.querySelector('#interventionsTable tbody');
  const metaEl = paneEl.querySelector('#interventionsMeta');
  const calcPreviewEl = paneEl.querySelector('#calcPreview');
  const calcBtn = paneEl.querySelector('#btnCalc');
  const calcStatus = paneEl.querySelector('#calcStatus');

  tbody.innerHTML = '';
  if (!rows.length) {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td colspan="5" style="opacity:.8;">Nessun intervento presente. Aggiungi il primo intervento per proseguire.</td>`;
    tbody.appendChild(tr);
  } else {
    rows.forEach((r) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="ct-cell-cat">${esc(r.category || '')}</td>
        <td class="ct-cell-code"><strong>${esc(r.code || '')}</strong></td>
        <td class="ct-cell-desc">
          <div>${esc(r.description || '')}</div>
          <div class="muted small">Ammissibile CT: ${r.eligible_ct ? 'Sì' : 'No'}</div>
        </td>
        <td class="ct-cell-toggle">
          <label class="ct-toggle">
            <input type="checkbox" data-role="toggle" data-code="${esc(r.code)}" ${r.selected ? 'checked' : ''} />
            <span class="ct-toggle__track"></span>
          </label>
        </td>
        <td class="ct-cell-note">
          <textarea
            class="ct-table-note"
            data-role="note"
            data-code="${esc(r.code)}"
            placeholder="Note intervento (ridimensionabile)"
          >${esc(r.note)}</textarea>
          <div class="ct-econ-row">
            <input class="ct-econ-input" data-role="main_value" data-code="${esc(r.code)}" type="number" step="0.01" placeholder="Valore principale" value="${esc(r.main_value)}" />
            <input class="ct-econ-input" data-role="eligible_costs" data-code="${esc(r.code)}" type="number" step="0.01" placeholder="Costi eleggibili" value="${esc(r.eligible_costs)}" />
          </div>
        </td>
      `;
      tbody.appendChild(tr);
    });
  }

  const selectedCount = rows.filter((r) => r.selected).length;
  if (metaEl) {
    metaEl.textContent = `${selectedCount} selezionati su ${rows.length}`;
  }
  renderCalcPreview(calcPreviewEl, incentive, null);

  tbody.querySelectorAll('input[data-role="toggle"]').forEach((toggle) => {
    toggle.addEventListener('change', async (ev) => {
      const code = ev.currentTarget.dataset.code;
      errEl.style.display = 'none';
      errEl.textContent = '';
      try {
        if (ev.currentTarget.checked) {
          const noteValue = paneEl.querySelector(`textarea[data-role="note"][data-code="${code}"]`)?.value.trim() || '';
          await upsertPracticeIntervention(practiceId, code, noteValue);
        } else {
          await deletePracticeIntervention(practiceId, code);
        }
        const [catalog, selected, nextIncentive] = await Promise.all([
          loadCatalogInterventions(),
          loadPracticeInterventions(practiceId),
          loadPracticeIncentive(practiceId)
        ]);
        renderInterventions(paneEl, catalog, selected, practiceId, economicsState, nextIncentive);
        await runPracticeCalc(practiceId, calcStatus);
      } catch (error) {
        errEl.textContent = `Errore aggiornamento intervento: ${error.message}`;
        errEl.style.display = '';
        ev.currentTarget.checked = !ev.currentTarget.checked;
      }
    });
  });

  const scheduleCalc = (() => {
    let timer = null;
    return () => {
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        runPracticeCalc(practiceId, calcStatus);
      }, 450);
    };
  })();

  tbody.querySelectorAll('textarea[data-role="note"]').forEach((ta) => {
    ta.addEventListener('change', async (ev) => {
      const code = ev.currentTarget.dataset.code;
      const noteValue = ev.currentTarget.value.trim();
      const row = selectedRows.find((r) => r.intervention_code === code);
      if (!row) return;
      errEl.style.display = 'none';
      errEl.textContent = '';
      try {
        await upsertPracticeIntervention(practiceId, code, noteValue);
        const updatedSelected = await loadPracticeInterventions(practiceId);
        renderInterventions(paneEl, catalogRows, updatedSelected, practiceId, economicsState, incentive);
      } catch (error) {
        errEl.textContent = `Errore salvataggio note: ${error.message}`;
        errEl.style.display = '';
      }
    });
  });

  tbody.querySelectorAll('input[data-role="main_value"], input[data-role="eligible_costs"]').forEach((input) => {
    input.addEventListener('input', (ev) => {
      const code = ev.currentTarget.dataset.code;
      const role = ev.currentTarget.dataset.role;
      const current = economicsState.get(code) || { main_value: '', eligible_costs: '' };
      current[role] = ev.currentTarget.value;
      economicsState.set(code, current);
      scheduleCalc();
    });
  });

  calcBtn.addEventListener('click', async () => {
    const calcResponse = await runPracticeCalc(practiceId, calcStatus);
    const freshIncentive = await loadPracticeIncentive(practiceId);
    renderCalcPreview(calcPreviewEl, freshIncentive || incentive, calcResponse);
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

  const economicsState = new Map();
  const [catalog, selected, _eligibility, incentive] = await Promise.all([
    loadCatalogInterventions(),
    loadPracticeInterventions(practice.id),
    loadUnitEligibility(practice.id),
    loadPracticeIncentive(practice.id)
  ]);
  renderInterventions(paneI, catalog, selected, practice.id, economicsState, incentive);

  setStatus('Pratica caricata.');
}

main().catch((e) => setStatus('Errore: ' + (e?.message || e), true));
