import { query } from './_db.js';

// Simple audit helper to record events in the ct_audit_events table. This
// implementation matches the one in the NUOVA repository and allows
// asynchronous event logging without blocking the main logic of a
// Netlify function.

function firstIp(xff = '') {
  const s = String(xff || '').split(',')[0]?.trim();
  return s || null;
}

/**
 * Extract request metadata from Netlify headers. Returns IP, user agent
 * and request ID values if present.
 *
 * @param {object} event The Netlify function event
 */
export function getRequestMeta(event = {}) {
  const h = event.headers || {};
  const nfIp = h['x-nf-client-connection-ip'] || h['X-Nf-Client-Connection-Ip'] || null;
  const ip =
    nfIp ||
    firstIp(h['x-forwarded-for'] || h['X-Forwarded-For']) ||
    h['client-ip'] ||
    h['Client-Ip'] ||
    null;
  const user_agent = h['user-agent'] || h['User-Agent'] || null;
  const request_id = h['x-nf-request-id'] || h['X-Nf-Request-Id'] || null;
  return { ip, user_agent, request_id };
}

/**
 * Write an audit event to the database. Failures are logged to the console
 * but do not interrupt execution of the caller.
 *
 * @param {object} params The event details
 */
export async function writeAuditEvent({
  scope = null,
  entity_type,
  entity_id = null,
  practice_id = null,
  action,
  actor_user_id = null,
  actor_email = null,
  actor_roles = null,
  ip = null,
  user_agent = null,
  request_id = null,
  summary = null,
  meta = {},
}) {
  // Non-blocking audit: swallow errors and log them
  try {
    await query(
      `INSERT INTO public.ct_audit_events
        (scope, entity_type, entity_id, practice_id, action,
         actor_user_id, actor_email, actor_roles,
         ip, user_agent, request_id, summary, meta)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
      [
        scope,
        entity_type,
        entity_id,
        practice_id,
        action,
        actor_user_id,
        actor_email,
        actor_roles,
        ip,
        user_agent,
        request_id,
        summary,
        meta || {},
      ],
    );
  } catch (e) {
  
    console.error('[audit] write failed', e);
  }
}
