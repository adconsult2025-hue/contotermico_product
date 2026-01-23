// CT 3.0 calc engine (condominio + unità) – v0.1
// Implementazione iniziale:
// - legge riparti da ct_practice_intervention_units
// - calcola incentivo lordo per unità = eligible_cost_eur * share_pct * RATE
// - somma a livello pratica e salva in ct_practice_incentives
// - registra run in ct_calc_runs e ct_calc_results (già presenti in 020_ct_calc_results.sql)

import { createClient } from '@supabase/supabase-js';

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization'
};

function json(statusCode, body) {
  return { statusCode, headers: corsHeaders, body: JSON.stringify(body) };
}

function getEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env ${name}`);
  return v;
}

function toNumber(x) {
  const n = typeof x === 'string' ? Number(x) : (typeof x === 'number' ? x : 0);
  return Number.isFinite(n) ? n : 0;
}

// Rate provvisorio per condomini (da parametrizzare sulle tabelle DM)
const DEFAULT_RATE = 0.65;
const DEFAULT_DURATION_YEARS = 5;
const ENGINE_VERSION = 'condo-0.1';

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') return json(200, { ok: true });

  try {
    const supabaseUrl = getEnv('SUPABASE_URL');
    const serviceKey = getEnv('SUPABASE_SERVICE_ROLE_KEY');
    const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    const payload = event.body ? JSON.parse(event.body) : {};
    const practice_id = payload.practice_id || payload.practiceId;
    if (!practice_id) return json(400, { ok: false, error: 'practice_id mancante' });

    const { data: practice, error: pErr } = await supabase
      .from('ct_practices')
      .select('id, owner_user_id, ct_type, subject_id')
      .eq('id', practice_id)
      .single();
    if (pErr) return json(404, { ok: false, error: 'Pratica non trovata', detail: String(pErr.message || pErr) });

    const input_snapshot = {
      practice_id,
      engine_version: ENGINE_VERSION,
      computed_at: new Date().toISOString()
    };

    const { data: run, error: runErr } = await supabase
      .from('ct_calc_runs')
      .insert({
        practice_id,
        owner_user_id: practice.owner_user_id,
        engine_version: ENGINE_VERSION,
        input_snapshot
      })
      .select('id')
      .single();
    if (runErr) return json(500, { ok: false, error: 'Errore creazione ct_calc_runs', detail: String(runErr.message || runErr) });

    const { data: rows, error: rErr } = await supabase
      .from('ct_practice_intervention_units')
      .select('id, intervention_id, unit_id, share_pct, eligible_cost_eur, qty, uom')
      .eq('practice_id', practice_id);
    if (rErr) return json(500, { ok: false, error: 'Errore lettura riparti', detail: String(rErr.message || rErr) });

    let total_gross = 0;
    const unit_map = {};
    for (const row of rows || []) {
      const eligible_cost = toNumber(row.eligible_cost_eur);
      const share_pct = toNumber(row.share_pct);
      const gross = eligible_cost * share_pct * DEFAULT_RATE;
      total_gross += gross;
      unit_map[row.unit_id] = (unit_map[row.unit_id] || 0) + gross;
    }

    const total_net = total_gross;

    const details = {
      rate: DEFAULT_RATE,
      duration_years: DEFAULT_DURATION_YEARS,
      units: unit_map,
      rows_count: (rows || []).length
    };

    const { error: upErr } = await supabase
      .from('ct_practice_incentives')
      .upsert({
        practice_id,
        version_code: 'CT3_DM_2025_08_07',
        computed_at: new Date().toISOString(),
        total_gross,
        total_net,
        duration_years: DEFAULT_DURATION_YEARS,
        rates: [{ code: 'DEFAULT_RATE', value: DEFAULT_RATE }],
        details,
        warnings: []
      }, { onConflict: 'practice_id' });
    if (upErr) return json(500, { ok: false, error: 'Errore upsert ct_practice_incentives', detail: String(upErr.message || upErr) });

    const results = [];
    results.push({
      run_id: run.id,
      practice_id,
      owner_user_id: practice.owner_user_id,
      scope: 'practice',
      ref_id: null,
      result: { total_gross, total_net, details }
    });
    for (const [unit_id, gross] of Object.entries(unit_map)) {
      results.push({
        run_id: run.id,
        practice_id,
        owner_user_id: practice.owner_user_id,
        scope: 'unit',
        ref_id: unit_id,
        result: { gross, rate: DEFAULT_RATE }
      });
    }

    const { error: resErr } = await supabase.from('ct_calc_results').insert(results);
    if (resErr) return json(500, { ok: false, error: 'Errore insert ct_calc_results', detail: String(resErr.message || resErr) });

    return json(200, {
      ok: true,
      practice_id,
      run_id: run.id,
      engine_version: ENGINE_VERSION,
      total_gross,
      total_net,
      duration_years: DEFAULT_DURATION_YEARS
    });
  } catch (e) {
    return json(500, { ok: false, error: String(e?.message || e) });
  }
}
