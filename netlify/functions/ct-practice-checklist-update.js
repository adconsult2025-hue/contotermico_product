const { getAdminClient, requireUser, corsHeaders } = require('./_supabase');

function buildResponse(statusCode, body) {
  return { statusCode, headers: corsHeaders, body: JSON.stringify(body) };
}

exports.handler = async function(event) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders };
  }
  if (event.httpMethod !== 'POST') {
    return buildResponse(405, { ok: false, error: 'Method Not Allowed' });
  }
  let data;
  try {
    data = JSON.parse(event.body || '{}');
  } catch (err) {
    return buildResponse(400, { ok: false, error: 'Invalid JSON body' });
  }
  const { practice_id, state_id, items } = data;
  if (!practice_id || !state_id || !Array.isArray(items)) {
    return buildResponse(400, { ok: false, error: 'Missing or invalid parameters' });
  }
  // Authenticate user
  const { user } = await requireUser(event);
  const supabase = getAdminClient();
  try {
    const now = new Date().toISOString();
    const payload = items.map((item) => ({
      practice_id,
      state_id,
      item_key: item.item_key,
      is_done: Boolean(item.is_done),
      done_at: item.is_done ? now : null,
      updated_at: now,
    }));

    const { error } = await supabase
      .from('ct_practice_checklist_items')
      .upsert(payload, { onConflict: 'practice_id,state_id,item_key' });

    if (error) {
      throw new Error(error.message);
    }
    return buildResponse(200, { ok: true });
  } catch (err) {
    return buildResponse(err.statusCode || 500, { ok: false, error: err.message || 'Internal error' });
  }
};
