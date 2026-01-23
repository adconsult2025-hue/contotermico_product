// CT 3.0 calc engine entrypoint (stub).
// Server-side uses Supabase Service Role to read/write regardless of RLS.

import { createClient } from '@supabase/supabase-js';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST,OPTIONS',
};

function bad(statusCode, message) {
  return {
    statusCode,
    headers: { ...cors, 'Content-Type': 'application/json' },
    body: JSON.stringify({ ok: false, error: message }),
  };
}

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: cors, body: '' };
  }
  if (event.httpMethod !== 'POST') return bad(405, 'Method not allowed');

  const SUPABASE_URL = process.env.TERMO_SUPABASE_URL;
  const SUPABASE_SERVICE_ROLE = process.env.TERMO_SUPABASE_SERVICE_ROLE;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) {
    return bad(500, 'Missing server env: TERMO_SUPABASE_URL / TERMO_SUPABASE_SERVICE_ROLE');
  }

  let payload = {};
  try {
    payload = JSON.parse(event.body || '{}');
  } catch (error) {
    console.warn('ct-calc: invalid JSON body', error);
  }
  const practice_id = payload.practice_id;
  if (!practice_id) return bad(400, 'practice_id required');

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE, {
    auth: { persistSession: false },
  });

  // Load practice + subject + units + interventions
  const { data: practice, error: eP } = await supabase
    .from('ct_practices')
    .select('*')
    .eq('id', practice_id)
    .maybeSingle();
  if (eP) return bad(500, eP.message);
  if (!practice) return bad(404, 'Practice not found');

  const owner_user_id = practice.owner_user_id;

  const { data: subject } = await supabase
    .from('ct_subjects')
    .select('*')
    .eq('practice_id', practice_id)
    .maybeSingle();

  const { data: units } = await supabase
    .from('ct_units')
    .select('*')
    .eq('practice_id', practice_id);

  const { data: interventions } = await supabase
    .from('ct_interventions')
    .select('*')
    .eq('practice_id', practice_id);

  const input_snapshot = {
    practice,
    subject,
    units: units || [],
    interventions: interventions || [],
  };

  // Create run
  const { data: run, error: eR } = await supabase
    .from('ct_calc_runs')
    .insert({ practice_id, owner_user_id, engine_version: 'stub-0.1', input_snapshot })
    .select('*')
    .single();
  if (eR) return bad(500, eR.message);

  // STUB result (replace with Neon engine port)
  const resultPractice = {
    totals: {
      incentivo_totale: 0,
      rate: [],
      note: 'STUB: motore calcolo da portare dal progetto Neon',
    },
  };

  const { error: eRes } = await supabase
    .from('ct_calc_results')
    .insert({
      run_id: run.id,
      practice_id,
      owner_user_id,
      scope: 'practice',
      ref_id: null,
      result: resultPractice,
    });
  if (eRes) return bad(500, eRes.message);

  return {
    statusCode: 200,
    headers: { ...cors, 'Content-Type': 'application/json' },
    body: JSON.stringify({ ok: true, run_id: run.id, result: resultPractice }),
  };
}
