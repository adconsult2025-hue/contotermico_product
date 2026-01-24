const { getClient } = require('./_db');
const { getCurrentUser } = require('./_auth');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Requested-With',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
};

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
  const user = await getCurrentUser(event.headers);
  if (!user) {
    return buildResponse(401, { ok: false, error: 'Unauthorized' });
  }
  const client = await getClient();
  try {
    const now = new Date();
    for (const item of items) {
      const { item_key, is_done } = item;
      await client.query(
        `INSERT INTO ct_practice_checklist_items (practice_id, state_id, item_key, is_done, done_at)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (practice_id, state_id, item_key) DO UPDATE
           SET is_done = EXCLUDED.is_done,
               done_at = EXCLUDED.done_at,
               updated_at = now()`,
        [practice_id, state_id, item_key, is_done, is_done ? now : null]
      );
    }
    return buildResponse(200, { ok: true });
  } catch (err) {
    return buildResponse(500, { ok: false, error: err.message || 'Internal error' });
  } finally {
    if (client) await client.release();
  }
};
