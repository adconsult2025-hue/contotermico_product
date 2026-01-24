const { getAdminClient, requireUser, corsHeaders } = require('./_supabase');
const { normalizeCtType } = require('./ct-type-utils');

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
  const { user } = await requireUser(event);
  const supabase = getAdminClient();
  try {
    // Determine ct_type from practice
    const { data: practice, error: practiceError } = await supabase
      .from('ct_practices')
      .select('ct_type')
      .eq('id', practiceId)
      .eq('owner_user_id', user.id)
      .maybeSingle();
    if (practiceError) {
      throw new Error(practiceError.message);
    }
    if (!practice) {
      return buildResponse(404, { ok: false, error: 'Practice not found' });
    }
    const ctType = normalizeCtType(practice.ct_type || '');
    // Fetch checklist items for ct_type and state
    const { data: checklistItems, error: itemsError } = await supabase
      .from('ct_checklist_items')
      .select('item_key,label,description,is_required')
      .eq('ct_type', ctType)
      .eq('state_id', stateId)
      .order('sort_order', { ascending: true, nullsLast: true })
      .order('item_key', { ascending: true });
    if (itemsError) {
      throw new Error(itemsError.message);
    }
    // Fetch documents for the practice and state
    const { data: documents, error: documentsError } = await supabase
      .from('ct_documents')
      .select(
        'id,checklist_item_key,original_filename,mime_type,file_size,drive_file_id,review_status,uploaded_by,signed_detected,signature_type,uploaded_at,signed_at,reviewed_at'
      )
      .eq('practice_id', practiceId)
      .eq('state_id', stateId)
      .order('created_at', { ascending: true });
    if (documentsError) {
      throw new Error(documentsError.message);
    }
    return buildResponse(200, { ok: true, checklist_items: checklistItems || [], documents: documents || [] });
  } catch (err) {
    return buildResponse(err.statusCode || 500, { ok: false, error: err.message || 'Internal error' });
  }
};
