import { createRequire } from 'module';
import { getCtTypeCandidates, listAcceptedCtTypes } from './ct-type-utils.js';

const require = createRequire(import.meta.url);
const { getAdminClient, requireUser, corsHeaders } = require('./_supabase');

function buildResponse(statusCode, body) {
  return {
    statusCode,
    headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(body),
  };
}

/*
 * Netlify function to retrieve Conto Termico checklist items and their completion status.
 *
 * Query parameters:
 *   - practice_id: (optional) UUID of the practice. If provided, the function will look up
 *     the practice to determine its ct_type and current_state and return completion info.
 *   - ct_type: (optional) explicit ct_type to use when no practice_id is given.
 *   - state: (optional) explicit state_id to filter completion rows when a practice is provided.
 *
 * Response:
 *   {
 *     ok: true,
 *     practice: {...} (when practice_id provided),
 *     resolved_ct_type: string,
 *     allowed_ct_types: [...],
 *     used_fallback: boolean,
 *     fallback_from: original type,
 *     fallback_to: fallback type,
 *     checklistByState: { [state_id]: [ { ct_type, state_id, item_key, label, description, required, sort_order } ] },
 *     items: [ ... ] checklist items for current_state (backwards compatibility),
 *     completion: [ { item_key, state_id, is_done } ]
 *   }
 */
export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' };
  }
  if (event.httpMethod !== 'GET') {
    return buildResponse(405, { ok: false, error: 'Method Not Allowed' });
  }
  try {
    const { user } = await requireUser(event);
    const supabase = getAdminClient();
    const params = event.queryStringParameters || {};
    const practiceId = params.practice_id || null;
    const explicitCtType = params.ct_type ?? params.ctType ?? null;
    const explicitState = params.state
      ? parseInt(params.state, 10)
      : params.state_id
        ? parseInt(params.state_id, 10)
        : null;

    if (!practiceId && !explicitCtType) {
      return {
        statusCode: 400,
        body: JSON.stringify({ ok: false, error: 'Missing practice_id or ct_type' }),
      };
    }

    let practice = null;
    let ctType = explicitCtType;
    let currentState = explicitState;

    // If practice_id is provided, fetch ct_type and current_state from the database
    if (practiceId) {
      const { data: practiceRow, error: practiceError } = await supabase
        .from('ct_practices')
        .select('id, ct_type, current_state')
        .eq('id', practiceId)
        .eq('owner_user_id', user.id)
        .maybeSingle();
      if (practiceError) {
        throw new Error(practiceError.message);
      }
      if (!practiceRow) {
        return { statusCode: 404, body: JSON.stringify({ ok: false, error: 'Practice not found' }) };
      }
      practice = practiceRow;
      ctType = practice.ct_type;
      if (typeof practice.current_state === 'number') {
        currentState = practice.current_state;
      }
    }

    // Ensure ctType is resolved
    if (!ctType) {
      return {
        statusCode: 400,
        body: JSON.stringify({ ok: false, error: 'Unable to determine ct_type', allowed_ct_types: listAcceptedCtTypes() }),
      };
    }

    // Resolve ct_type and get fallback candidates
    const { resolved, candidates } = getCtTypeCandidates(ctType);
    if (!resolved) {
      return {
        statusCode: 400,
        body: JSON.stringify({ ok: false, error: 'Unrecognized ct_type', allowed_ct_types: listAcceptedCtTypes() }),
      };
    }

    // Helper to fetch checklist items for a given type
    const fetchChecklist = async (type) => {
      const { data, error } = await supabase
        .from('ct_checklist_items')
        .select('ct_type,state_id,item_key,label,description,is_required,sort_order')
        .eq('ct_type', type)
        .order('state_id', { ascending: true })
        .order('sort_order', { ascending: true, nullsFirst: true })
        .order('label', { ascending: true });
      if (error) {
        throw new Error(error.message);
      }
      return data || [];
    };

    let checklistCtType = resolved;
    let itemsRows = await fetchChecklist(checklistCtType);
    let usedFallback = false;
    let fallbackFrom = null;
    let fallbackTo = null;
    // Fallback: if no checklist exists for the resolved type, try the next candidate
    if (!itemsRows.length && candidates.length > 1) {
      const fallbackType = candidates[1];
      const fallbackRows = await fetchChecklist(fallbackType);
      if (fallbackRows.length) {
        itemsRows = fallbackRows;
        checklistCtType = fallbackType;
        usedFallback = true;
        fallbackFrom = resolved;
        fallbackTo = fallbackType;
      }
    }

    // Group checklist items by state
    const checklistByState = {};
    for (const row of itemsRows) {
      const sid = row.state_id;
      if (!checklistByState[sid]) checklistByState[sid] = [];
      checklistByState[sid].push({
        ct_type: row.ct_type,
        state_id: row.state_id,
        item_key: row.item_key,
        label: row.label,
        description: row.description,
        is_required: row.is_required,
        required: row.is_required,
        sort_order: row.sort_order,
      });
    }

    // Maintain backwards compatibility: items array for currentState
    let items = [];
    if (currentState !== null && checklistByState[currentState]) {
      items = checklistByState[currentState];
    }

    // Fetch completion status if practiceId provided
    let completion = [];
    if (practiceId) {
      let query = supabase
        .from('ct_practice_checklist_items')
        .select('item_key,state_id,is_done')
        .eq('practice_id', practiceId);
      if (currentState !== null && currentState !== undefined) {
        query = query.eq('state_id', currentState);
      }
      const { data: completionRows, error: completionError } = await query;
      if (completionError) {
        throw new Error(completionError.message);
      }
      completion = completionRows || [];
    }

    return buildResponse(200, {
      ok: true,
      practice,
      resolved_ct_type: resolved,
      allowed_ct_types: listAcceptedCtTypes(),
      used_fallback: usedFallback,
      fallback_from: fallbackFrom,
      fallback_to: fallbackTo,
      checklistByState,
      items,
      completion,
    });
  } catch (err) {
    console.error('ct-checklist-get error', err);
    return buildResponse(err.statusCode || 500, { ok: false, error: err.message || 'Unexpected error' });
  }
};
