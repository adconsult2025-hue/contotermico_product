import { getClient } from './_db.js';
import { getCurrentUser } from './_auth.js';

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST,OPTIONS',
  'Access-Control-Allow-Headers':
    'Content-Type, Authorization, Accept, X-User-Id, X-User-Type, x-user-id, x-user-type, x-migrate-token, X-Migrate-Token',
};

function buildResponse(statusCode, payload) {
  return { statusCode, headers: corsHeaders, body: JSON.stringify(payload) };
}

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return buildResponse(200, { ok: true });
  }

  if (event.httpMethod !== 'POST') {
    return buildResponse(405, { ok: false, error: 'Method not allowed' });
  }

  let db;

  try {
    try {
      const actor = await getCurrentUser(event);
      if (actor) {
        console.log('db-migrate-ct-economics invoked by', actor?.email || actor?.id || 'unknown');
      }
    } catch (authErr) {
      console.warn('db-migrate-ct-economics: unable to read actor', authErr?.message || authErr);
    }

    if (process.env.MIGRATIONS_ENABLED !== '1') {
      return buildResponse(404, { ok: false, error: 'Migrations disabled' });
    }

    const expected = (process.env.MIGRATE_TOKEN || '').trim();
    if (!expected) {
      return buildResponse(500, { ok: false, error: 'MIGRATE_TOKEN missing' });
    }

    const token = event.headers['x-migrate-token'] || event.headers['X-Migrate-Token'];
    if (token !== expected) {
      return buildResponse(403, { ok: false, error: 'Forbidden' });
    }

    const client = await getClient();
    db = await client.connect();

    await db.query('BEGIN');

    await db.query('CREATE EXTENSION IF NOT EXISTS "pgcrypto";');

    await db.query(`
      CREATE TABLE IF NOT EXISTS public.ct_calc_versions (
        version_code text PRIMARY KEY,
        dm_ref text,
        effective_from date,
        effective_to date NULL,
        is_active boolean DEFAULT true,
        created_at timestamptz DEFAULT now()
      );
    `);

    await db.query(
      `INSERT INTO public.ct_calc_versions (version_code, dm_ref, effective_from, is_active)
       VALUES ($1, $2, $3, true)
       ON CONFLICT (version_code) DO NOTHING;`,
      ['CT3_DM_2025_08_07', 'DM 7 agosto 2025', '2025-12-25'],
    );

    await db.query(`
      CREATE TABLE IF NOT EXISTS public.ct_calc_coefficients (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        version_code text NOT NULL REFERENCES public.ct_calc_versions(version_code) ON DELETE CASCADE,
        intervention_code text NOT NULL REFERENCES public.ct_interventions(code) ON DELETE CASCADE,
        subject_type text NOT NULL,
        building_scope text NOT NULL,
        climate_zone text NULL,
        unit text NOT NULL,
        coeff_eur_per_unit numeric NOT NULL,
        duration_years int NOT NULL DEFAULT 5,
        cap_rate numeric NULL,
        notes text NULL,
        UNIQUE (version_code, intervention_code, subject_type, building_scope, climate_zone)
      );
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS public.ct_practice_economics (
        practice_id uuid PRIMARY KEY REFERENCES public.ct_practices(id) ON DELETE CASCADE,
        version_code text NOT NULL DEFAULT 'CT3_DM_2025_08_07' REFERENCES public.ct_calc_versions(version_code),
        climate_zone text NULL,
        building_scope text NULL,
        is_small_municipality boolean NOT NULL DEFAULT false,
        eligible_costs_total numeric NULL,
        updated_at timestamptz NOT NULL DEFAULT now()
      );
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS public.ct_practice_intervention_economics (
        practice_id uuid NOT NULL REFERENCES public.ct_practices(id) ON DELETE CASCADE,
        intervention_code text NOT NULL REFERENCES public.ct_interventions(code) ON DELETE CASCADE,
        main_value numeric NOT NULL,
        unit text NOT NULL,
        eligible_costs numeric NULL,
        notes text NULL,
        updated_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (practice_id, intervention_code)
      );
    `);

    await db.query(
      'CREATE INDEX IF NOT EXISTS idx_ct_econ_practice ON public.ct_practice_intervention_economics(practice_id);',
    );

    await db.query(`
      CREATE TABLE IF NOT EXISTS public.ct_practice_incentives (
        practice_id uuid PRIMARY KEY REFERENCES public.ct_practices(id) ON DELETE CASCADE,
        version_code text NOT NULL REFERENCES public.ct_calc_versions(version_code),
        computed_at timestamptz NOT NULL DEFAULT now(),
        subject_type text NULL,
        climate_zone text NULL,
        building_scope text NULL,
        cap_rate numeric NULL,
        total_gross numeric NOT NULL DEFAULT 0,
        total_net numeric NOT NULL DEFAULT 0,
        duration_years int NOT NULL DEFAULT 5,
        rates jsonb NOT NULL DEFAULT '[]'::jsonb,
        details jsonb NOT NULL DEFAULT '{}'::jsonb,
        warnings jsonb NOT NULL DEFAULT '[]'::jsonb
      );
    `);

    await db.query('COMMIT');

    return buildResponse(200, { ok: true });
  } catch (err) {
    if (db) {
      try {
        await db.query('ROLLBACK');
      } catch (rollbackErr) {
        console.error('Rollback error in db-migrate-ct-economics', rollbackErr);
      }
    }
    console.error('db-migrate-ct-economics error', err);
    return buildResponse(500, { ok: false, error: err.message || 'Migration error' });
  } finally {
    if (db) db.release();
  }
};

// Esempio invocazione:
// curl -X POST https://<host>/.netlify/functions/db-migrate-ct-economics \\
//   -H "x-migrate-token: <TOKEN>" \\
//   -H "Content-Type: application/json" \\
//   -d '{}'
