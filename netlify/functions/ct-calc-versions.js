import { getClient } from './_db.js';
import { getCurrentUser } from './_auth.js';

// Manage versions of CT calculation coefficients. Supports listing existing
// versions via GET and creating a new version via POST. When creating a
// version, the caller may specify whether the new version should be
// activated exclusively (deactivating others).

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers':
    'Content-Type, Authorization, Accept, X-User-Id, X-User-Type, x-user-id, x-user-type',
};

function buildResponse(statusCode, payload) {
  return { statusCode, headers: corsHeaders, body: JSON.stringify(payload) };
}

function isMissingRelation(err) {
  return /relation .*ct_calc_/i.test(err?.message || '');
}

async function logActor(event) {
  try {
    const user = await getCurrentUser(event);
    if (user?.user?.email) {
      console.log('[ct-calc-versions] actor', user.user.email);
    }
  } catch (err) {
    console.log('[ct-calc-versions] actor unknown');
  }
}

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return buildResponse(200, { ok: true });
  }

  if (!['GET', 'POST'].includes(event.httpMethod)) {
    return buildResponse(405, { ok: false, error: 'Method not allowed' });
  }

  await logActor(event);

  if (event.httpMethod === 'GET') {
    try {
      const db = await getClient();
      const { rows } = await db.query(
        `SELECT version_code, dm_ref, effective_from, effective_to, is_active, created_at
         FROM public.ct_calc_versions
         ORDER BY effective_from DESC NULLS LAST, created_at DESC`,
      );
      return buildResponse(200, { ok: true, versions: rows });
    } catch (err) {
      console.error('ct-calc-versions GET error', err);
      if (isMissingRelation(err)) {
        return buildResponse(500, { ok: false, error: 'Run db-migrate-ct-economics first' });
      }
      return buildResponse(err.statusCode || 500, { ok: false, error: err.message || 'Internal error' });
    }
  }

  // POST: create a new calculation version
  try {
    const payload = JSON.parse(event.body || '{}');
    const versionCode = (payload.version_code || '').trim();
    const dmRef = (payload.dm_ref || '').trim();
    const effectiveFrom = payload.effective_from || null;
    const makeActive = Boolean(payload.make_active);

    if (!versionCode || !dmRef) {
      return buildResponse(400, { ok: false, error: 'version_code e dm_ref sono obbligatori' });
    }

    const db = await getClient();
    await db.query('BEGIN');

    const existing = await db.query(
      'SELECT version_code FROM public.ct_calc_versions WHERE version_code = $1 LIMIT 1',
      [versionCode],
    );
    if (existing.rows.length) {
      await db.query('ROLLBACK');
      return buildResponse(409, { ok: false, error: 'Versione già esistente' });
    }

    await db.query(
      `INSERT INTO public.ct_calc_versions (version_code, dm_ref, effective_from, is_active)
       VALUES ($1, $2, $3, $4)`,
      [versionCode, dmRef, effectiveFrom, makeActive],
    );
    if (makeActive) {
      await db.query('UPDATE public.ct_calc_versions SET is_active = false WHERE version_code <> $1', [versionCode]);
      await db.query('UPDATE public.ct_calc_versions SET is_active = true WHERE version_code = $1', [versionCode]);
    }

    await db.query('COMMIT');
    return buildResponse(200, { ok: true });
  } catch (err) {
    console.error('ct-calc-versions POST error', err);
    try {
      const db = await getClient();
      await db.query('ROLLBACK');
    } catch (rollbackErr) {
      console.error('ct-calc-versions rollback error', rollbackErr);
    }
    if (isMissingRelation(err)) {
      return buildResponse(500, { ok: false, error: 'Run db-migrate-ct-economics first' });
    }
    return buildResponse(err.statusCode || 500, { ok: false, error: err.message || 'Internal error' });
  }
};
