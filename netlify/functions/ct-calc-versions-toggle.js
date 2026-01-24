import { getClient } from './_db.js';
import { getCurrentUser } from './_auth.js';

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST,OPTIONS',
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
      console.log('[ct-calc-versions-toggle] actor', user.user.email);
    }
  } catch (err) {
    console.log('[ct-calc-versions-toggle] actor unknown');
  }
}

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return buildResponse(200, { ok: true });
  }

  if (event.httpMethod !== 'POST') {
    return buildResponse(405, { ok: false, error: 'Method not allowed' });
  }

  await logActor(event);

  try {
    const payload = JSON.parse(event.body || '{}');
    const versionCode = (payload.version_code || '').trim();
    const isActive = payload.is_active;
    const exclusive = Boolean(payload.exclusive);

    if (!versionCode || typeof isActive !== 'boolean') {
      return buildResponse(400, { ok: false, error: 'version_code e is_active sono obbligatori' });
    }

    const db = await getClient();
    await db.query('BEGIN');

    if (exclusive && isActive) {
      await db.query('UPDATE public.ct_calc_versions SET is_active = false WHERE version_code <> $1', [versionCode]);
    }

    await db.query('UPDATE public.ct_calc_versions SET is_active = $1 WHERE version_code = $2', [isActive, versionCode]);

    await db.query('COMMIT');
    return buildResponse(200, { ok: true });
  } catch (err) {
    console.error('ct-calc-versions-toggle error', err);
    try {
      const db = await getClient();
      await db.query('ROLLBACK');
    } catch (rollbackErr) {
      console.error('ct-calc-versions-toggle rollback error', rollbackErr);
    }

    if (isMissingRelation(err)) {
      return buildResponse(500, { ok: false, error: 'Run db-migrate-ct-economics first' });
    }

    return buildResponse(err.statusCode || 500, { ok: false, error: err.message || 'Internal error' });
  }
};
