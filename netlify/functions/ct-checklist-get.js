const { createClient } = require('@supabase/supabase-js');

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Requested-With',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
};

function json(statusCode, body) {
  return { statusCode, headers: corsHeaders, body: JSON.stringify(body) };
}

function getAdminSupabase() {
  const url = process.env.TERMO_SUPABASE_URL;
  const key = process.env.TERMO_SUPABASE_SERVICE_ROLE;
  if (!url || !key) {
    throw new Error('Missing TERMO_SUPABASE_URL or TERMO_SUPABASE_SERVICE_ROLE env');
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

function normalizeCtType(raw) {
  const v = String(raw || '').trim().toLowerCase();
  const map = {
    pa: 'pa',
    'pubblica amministrazione': 'pa',
    condominio: 'condominio',
    privato: 'privato_residenziale',
    'privato_residenziale': 'privato_residenziale',
    'privato non residenziale': 'privato_non_residenziale',
    'privato_non_residenziale': 'privato_non_residenziale',
    ets: 'ets',
    esco: 'esco',
  };
  return map[v] || v || null;
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return json(200, { ok: true });

  const diag = (event.queryStringParameters && event.queryStringParameters.diag) ? true : false;

  try {
    const supabase = getAdminSupabase();

    const practiceId = event.queryStringParameters && event.queryStringParameters.practice_id;
    if (!practiceId) return json(400, { ok: false, error: 'practice_id mancante' });

    // 1) Leggo pratica per ct_type + state_id
    const { data: practice, error: pErr } = await supabase
      .from('ct_practices')
      .select('id, ct_type, state_id')
      .eq('id', practiceId)
      .maybeSingle();

    if (pErr) throw pErr;
    if (!practice) return json(404, { ok: false, error: 'Pratica non trovata' });

    const ctType = normalizeCtType(practice.ct_type) || 'condominio';
    const currentStateId = practice.state_id ?? null;

    // 2) Carico voci checklist (catalogo)
    const { data: items, error: iErr } = await supabase
      .from('ct_checklist_items')
      .select('ct_type,state_id,item_key,label,description,is_required,sort_order')
      .eq('ct_type', ctType)
      .order('state_id', { ascending: true })
      .order('sort_order', { ascending: true })
      .order('item_key', { ascending: true });

    if (iErr) throw iErr;

    // 3) Carico completamenti
    const { data: doneRows, error: dErr } = await supabase
      .from('ct_practice_checklist_items')
      .select('state_id,item_key,is_done,done_at,updated_at')
      .eq('practice_id', practiceId);

    if (dErr) throw dErr;

    const doneMap = new Map();
    for (const r of (doneRows || [])) doneMap.set(`${r.state_id}:${r.item_key}`, r);

    // 4) Raggruppo per stato, applico is_done
    const itemsByState = {};
    for (const it of (items || [])) {
      const key = String(it.state_id);
      if (!itemsByState[key]) itemsByState[key] = [];
      const done = doneMap.get(`${it.state_id}:${it.item_key}`);
      itemsByState[key].push({
        ...it,
        is_done: !!(done && done.is_done),
        done_at: done ? done.done_at : null,
      });
    }

    return json(200, {
      ok: true,
      practice_id: practiceId,
      ct_type: ctType,
      current_state_id: currentStateId,
      itemsByState,
    });
  } catch (e) {
    return json(500, {
      ok: false,
      error: 'ct-checklist-get failed',
      message: String(e && e.message ? e.message : e),
      ...(diag ? { stack: String(e && e.stack ? e.stack : '') } : {}),
    });
  }
};
