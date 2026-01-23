const $ = (id) => document.getElementById(id);

const el = {
  name: $('name'),
  fiscal_code: $('fiscal_code'),
  address: $('address'),
  city: $('city'),
  province: $('province'),
  cap: $('cap'),
  administrator_name: $('administrator_name'),
  administrator_email: $('administrator_email'),
  administrator_phone: $('administrator_phone'),
  notes: $('notes'),
  currentId: $('currentId'),
  subStatus: $('subStatus'),
  unitsTbody: $('unitsTbody'),
  importStatus: $('importStatus'),
  fileCsv: $('fileCsv'),
};

const btn = {
  new: $('btnNew'),
  save: $('btnSave'),
  addUnit: $('btnAddUnit'),
  downloadTemplate: $('btnDownloadTemplate'),
  importCsv: $('btnImportCsv'),
};

let current = { id: null, owner_user_id: null };

function setTab(tabKey) {
  document.querySelectorAll('.tab').forEach(t => {
    t.classList.toggle('active', t.dataset.tab === tabKey);
  });
  $('tab-anagrafica').style.display = tabKey === 'anagrafica' ? '' : 'none';
  $('tab-unita').style.display = tabKey === 'unita' ? '' : 'none';
  $('tab-import').style.display = tabKey === 'import' ? '' : 'none';
}

document.querySelectorAll('.tab').forEach(t => {
  t.addEventListener('click', () => setTab(t.dataset.tab));
});

async function getUserOrThrow() {
  const { data, error } = await window.__supabase.auth.getUser();
  if (error) throw error;
  if (!data?.user) throw new Error('Not authenticated');
  return data.user;
}

function readForm() {
  return {
    name: el.name.value.trim(),
    fiscal_code: el.fiscal_code.value.trim() || null,
    address: el.address.value.trim() || null,
    city: el.city.value.trim() || null,
    province: el.province.value.trim() || null,
    cap: el.cap.value.trim() || null,
    administrator_name: el.administrator_name.value.trim() || null,
    administrator_email: el.administrator_email.value.trim() || null,
    administrator_phone: el.administrator_phone.value.trim() || null,
    notes: el.notes.value.trim() || null,
  };
}

function fillForm(row) {
  el.name.value = row?.name || '';
  el.fiscal_code.value = row?.fiscal_code || '';
  el.address.value = row?.address || '';
  el.city.value = row?.city || '';
  el.province.value = row?.province || '';
  el.cap.value = row?.cap || '';
  el.administrator_name.value = row?.administrator_name || '';
  el.administrator_email.value = row?.administrator_email || '';
  el.administrator_phone.value = row?.administrator_phone || '';
  el.notes.value = row?.notes || '';
}

function setCurrentId(id) {
  current.id = id || null;
  el.currentId.textContent = current.id || '—';
  el.subStatus.textContent = current.id ? 'Modifica condominio esistente.' : 'Crea un nuovo condominio.';
}

async function loadById(id) {
  const { data, error } = await window.__supabase
    .from('ct_condominiums')
    .select('*')
    .eq('id', id)
    .single();
  if (error) throw error;
  fillForm(data);
  setCurrentId(data.id);
  await loadUnits();
}

async function loadUnits() {
  if (!current.id) {
    el.unitsTbody.innerHTML = `<tr><td colspan="6" class="muted">Salva prima il condominio, poi inserisci le unità.</td></tr>`;
    return;
  }
  const { data, error } = await window.__supabase
    .from('ct_units')
    .select('*')
    .eq('condominium_id', current.id)
    .order('created_at', { ascending: false });
  if (error) throw error;

  if (!data || data.length === 0) {
    el.unitsTbody.innerHTML = `<tr><td colspan="6" class="muted">Nessuna unità. Clicca “Aggiungi unità”.</td></tr>`;
    return;
  }

  el.unitsTbody.innerHTML = data.map(u => `
    <tr data-id="${u.id}">
      <td>${u.unit_code || ''}</td>
      <td>${u.unit_type || ''}</td>
      <td>${u.surface_m2 ?? ''}</td>
      <td>${u.millesimi ?? ''}</td>
      <td>${u.pod || ''}</td>
      <td><button class="btn small secondary" data-del="${u.id}">Elimina</button></td>
    </tr>
  `).join('');

  el.unitsTbody.querySelectorAll('[data-del]').forEach(b => {
    b.addEventListener('click', async (e) => {
      e.preventDefault();
      const id = b.getAttribute('data-del');
      if (!confirm('Eliminare questa unità?')) return;
      const { error } = await window.__supabase.from('ct_units').delete().eq('id', id);
      if (error) alert(error.message);
      await loadUnits();
    });
  });
}

async function saveCondominium() {
  const user = await getUserOrThrow();
  const payload = readForm();
  if (!payload.name) {
    alert('Inserisci il nome del condominio.');
    return;
  }

  if (!current.id) {
    const { data, error } = await window.__supabase
      .from('ct_condominiums')
      .insert([{ ...payload, owner_user_id: user.id }])
      .select('*')
      .single();
    if (error) throw error;
    setCurrentId(data.id);
  } else {
    const { error } = await window.__supabase
      .from('ct_condominiums')
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq('id', current.id);
    if (error) throw error;
  }
  await loadUnits();
  alert('Salvato.');
}

async function addUnit() {
  if (!current.id) {
    alert('Salva prima il condominio.');
    return;
  }
  const user = await getUserOrThrow();
  const unit_code = prompt('Codice unità (es. Scala A int. 3 / Sub 12):', '');
  if (unit_code === null) return;
  const unit_type = prompt('Tipo unità: PRIVATO / UFFICIO / PA / TERZO_SETTORE / ALTRO', 'PRIVATO');
  if (unit_type === null) return;
  const pod = prompt('POD (opzionale):', '');
  const { error } = await window.__supabase.from('ct_units').insert([{
    condominium_id: current.id,
    owner_user_id: user.id,
    unit_code: unit_code.trim() || null,
    unit_type: (unit_type || 'PRIVATO').trim().toUpperCase(),
    pod: pod?.trim() || null,
  }]);
  if (error) throw error;
  await loadUnits();
}

function downloadTemplateCsv() {
  const header = ['unit_code', 'unit_type', 'surface_m2', 'millesimi', 'pod', 'notes'];
  const sample = ['Scala A int. 3', 'PRIVATO', '90', '85.50', 'IT001E...', ''];
  const csv = [header.join(','), sample.join(',')].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'template_unita_condominio.csv';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function parseCsv(text) {
  // Simple CSV parser (comma-separated, no quoted commas handling for MVP)
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];
  const header = lines[0].split(',').map(s => s.trim());
  return lines.slice(1).map(line => {
    const cols = line.split(',').map(s => s.trim());
    const obj = {};
    header.forEach((h, i) => obj[h] = cols[i] ?? '');
    return obj;
  });
}

async function importCsv() {
  if (!current.id) {
    alert('Salva prima il condominio.');
    return;
  }
  const f = el.fileCsv.files?.[0];
  if (!f) {
    el.importStatus.textContent = 'Seleziona un CSV.';
    return;
  }
  const user = await getUserOrThrow();
  const text = await f.text();
  const rows = parseCsv(text);
  if (rows.length === 0) {
    el.importStatus.textContent = 'CSV vuoto o non valido.';
    return;
  }
  const insertRows = rows.map(r => ({
    condominium_id: current.id,
    owner_user_id: user.id,
    unit_code: r.unit_code || null,
    unit_type: (r.unit_type || 'PRIVATO').toUpperCase(),
    surface_m2: r.surface_m2 ? Number(r.surface_m2) : null,
    millesimi: r.millesimi ? Number(r.millesimi) : null,
    pod: r.pod || null,
    notes: r.notes || null,
  }));
  const { error } = await window.__supabase.from('ct_units').insert(insertRows);
  if (error) {
    el.importStatus.textContent = 'Errore import: ' + error.message;
    return;
  }
  el.importStatus.textContent = `Import completato: ${insertRows.length} unità.`;
  await loadUnits();
  setTab('unita');
}

function clearAll() {
  fillForm(null);
  setCurrentId(null);
  el.unitsTbody.innerHTML = `<tr><td colspan="6" class="muted">Salva prima il condominio, poi inserisci le unità.</td></tr>`;
  setTab('anagrafica');
}

async function init() {
  // load condominium by query param ?id=
  const url = new URL(window.location.href);
  const id = url.searchParams.get('id');
  clearAll();
  if (id) await loadById(id);
}

btn.new.addEventListener('click', clearAll);
btn.save.addEventListener('click', () => saveCondominium().catch(e => alert(e.message)));
btn.addUnit.addEventListener('click', () => addUnit().catch(e => alert(e.message)));
btn.downloadTemplate.addEventListener('click', downloadTemplateCsv);
btn.importCsv.addEventListener('click', () => importCsv().catch(e => alert(e.message)));

init().catch(e => alert(e.message));
