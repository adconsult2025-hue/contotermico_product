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
    const supabase = getAdminSupabase();
    const practiceId = event.queryStringParameters && event.queryStringParameters.practice_id;
    const stateId = event.queryStringParameters && event.queryStringParameters.state_id;

    if (!practiceId) return json(400, { ok: false, error: 'practice_id mancante' });

    let q = supabase
      .from('ct_documents')
      .select('id,practice_id,ct_type,state_id,checklist_item_key,original_filename,mime_type,file_size,drive_file_id,created_at,signed_required,signed_detected,review_status,reviewed_at')
      .eq('practice_id', practiceId)
      .order('created_at', { ascending: false });

    if (stateId) q = q.eq('state_id', Number(stateId));

    const { data, error } = await q;
    if (error) throw error;

    return json(200, { ok: true, practice_id: practiceId, docs: data || [] });
  } catch (e) {
    return json(500, {
      ok: false,
      error: 'ct-doc-list failed',
      message: String(e && e.message ? e.message : e),
      ...(diag ? { stack: String(e && e.stack ? e.stack : '') } : {}),
    });
  }
};
