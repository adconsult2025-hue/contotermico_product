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
  if (!url || !key) throw new Error('Missing TERMO_SUPABASE_URL or TERMO_SUPABASE_SERVICE_ROLE env');
  return createClient(url, key, { auth: { persistSession: false } });
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return json(200, { ok: true });
  const diag = (event.queryStringParameters && event.queryStringParameters.diag) ? true : false;

  try {
    if (event.httpMethod !== 'POST') return json(405, { ok: false, error: 'Method not allowed' });

    const supabase = getAdminSupabase();
    const body = JSON.parse(event.body || '{}');

    const practiceId = body.practice_id;
    const stateId = body.state_id;
    const items = Array.isArray(body.items) ? body.items : [];

    if (!practiceId || typeof stateId !== 'number') {
      return json(400, { ok: false, error: 'practice_id/state_id mancanti o non validi' });
    }
    if (!items.length) return json(400, { ok: false, error: 'items vuoto' });

    const upserts = items.map((it) => ({
      practice_id: practiceId,
      state_id: stateId,
      item_key: it.item_key,
      is_done: !!it.is_done,
      done_at: it.is_done ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })).filter(r => r.item_key);

    const { error } = await supabase
      .from('ct_practice_checklist_items')
      .upsert(upserts, { onConflict: 'practice_id,state_id,item_key' });

    if (error) throw error;

    return json(200, { ok: true, updated: upserts.length });
  } catch (e) {
    return json(500, {
      ok: false,
      error: 'ct-practice-checklist-update failed',
      message: String(e && e.message ? e.message : e),
      ...(diag ? { stack: String(e && e.stack ? e.stack : '') } : {}),
    });
  }
};
