const { getClient } = require('./_db');
const { getCurrentUser } = require('./_auth');
const { normalizeCtType } = require('./ct-type-utils');

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
  if (event.httpMethod !== 'GET') {
    return buildResponse(405, { ok: false, error: 'Method Not Allowed' });
  }
  const params = event.queryStringParameters || {};
  const practiceId = params.practice_id;
  const stateId = params.state_id ? parseInt(params.state_id, 10) : null;
  if (!practiceId || !stateId) {
    return buildResponse(400, { ok: false, error: 'Missing practice_id or state_id' });
  }
  // Authenticate user (optional: we might allow public read for attachments)
  const user = await getCurrentUser(event.headers);
  if (!user) {
    return buildResponse(401, { ok: false, error: 'Unauthorized' });
  }
  const client = await getClient();
  try {
    // Determine ct_type from practice
    const practiceRes = await client.query('SELECT ct_type FROM ct_practices WHERE id = $1', [practiceId]);
    if (practiceRes.rowCount === 0) {
      return buildResponse(404, { ok: false, error: 'Practice not found' });
    }
    const ctType = normalizeCtType(practiceRes.rows[0].ct_type || '');
    // Fetch checklist items for ct_type and state
    const itemsRes = await client.query(
      `SELECT item_key, label, description, is_required
       FROM ct_checklist_items
       WHERE ct_type = $1 AND state_id = $2
       ORDER BY sort_order NULLS LAST, item_key`,
      [ctType, stateId]
    );
    // Fetch documents for the practice and state
    const docsRes = await client.query(
      `SELECT id, checklist_item_key, original_filename, mime_type, file_size, drive_file_id, review_status, uploaded_by, signed_detected, signature_type, uploaded_at, signed_at, reviewed_at
       FROM ct_documents
       WHERE practice_id = $1 AND state_id = $2
       ORDER BY created_at ASC`,
      [practiceId, stateId]
    );
    return buildResponse(200, { ok: true, checklist_items: itemsRes.rows, documents: docsRes.rows });
  } catch (err) {
    return buildResponse(500, { ok: false, error: err.message || 'Internal error' });
  } finally {
    if (client) await client.release();
  }
};
