import { getClient } from './_db.js';

// Authentication and authorization helpers for Netlify functions. This module
// exposes functions for retrieving the current user and enforcing role- or
// customer-based permissions. The implementation is copied from the NUOVA
// repository so that CT functions can be reused without changes.

const SUPERADMIN_CODES = ['SUPERADMIN'];
const ADMIN_CODES = ['ADMIN_OPERATIVO'];

// Determine if we are running in a development environment. When not in
// production the functions will return a simulated superadmin user to
// simplify local testing.
const isDev = () => process.env.NODE_ENV !== 'production';

function toArray(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  return [value];
}

function isSuperAdmin(context) {
  return (
    context?.user?.tipo_utente === 'superadmin' ||
    context?.roles?.some((code) => SUPERADMIN_CODES.includes(code))
  );
}

function isAdminOrAbove(context) {
  return (
    isSuperAdmin(context) ||
    context?.user?.tipo_utente === 'admin' ||
    context?.roles?.some((code) => ADMIN_CODES.includes(code))
  );
}

function isClientUser(context) {
  return (
    context?.user?.tipo_utente === 'cliente' ||
    context?.roles?.some((code) => /CLIENTE/i.test(code))
  );
}

/**
 * Retrieve the current user based on Netlify function headers. In
 * development it returns a dummy superadmin. In production it looks up
 * the user in the app_users table and populates roles and customer/CER
 * associations.
 *
 * @param {object} event The Netlify event containing request headers.
 * @returns {Promise<object>} A context object with user, roles,
 *   customerIds and cerIds.
 */
async function getCurrentUser(event) {
  if (isDev()) {
    return {
      user: { id: 'dev-admin', tipo_utente: 'superadmin' },
      roles: ['SUPERADMIN', 'ADMIN'],
      customerIds: [],
      cerIds: [],
    };
  }

  const headers = event.headers || {};
  const userHeader = headers['x-user-id'] || headers['X-User-Id'];
  const userTypeHeader = headers['x-user-type'] || headers['X-User-Type'];

  const pool = getClient();
  let user = null;

  if (userHeader) {
    const result = await pool.query(
      'SELECT * FROM app_users WHERE id = $1 OR auth_provider_id = $1 LIMIT 1',
      [userHeader],
    );
    if (result.rows.length) {
      user = result.rows[0];
    }
  }

  if (!user && userTypeHeader) {
    user = {
      id: userHeader || null,
      auth_provider_id: userHeader || null,
      email: null,
      display_name: 'Utente simulato',
      tipo_utente: userTypeHeader,
      attivo: true,
    };
  }

  if (!user) {
    const error = new Error('Utente non autenticato');
    error.statusCode = 401;
    throw error;
  }

  const rolesResult = await pool.query(
    `SELECT r.code
     FROM app_roles r
     INNER JOIN app_user_roles ur ON ur.role_id = r.id
     WHERE ur.user_id = $1`,
    [user.id],
  );
  const roles = rolesResult.rows.map((r) => r.code);

  const customerResult = await pool.query(
    `SELECT DISTINCT c.customer_id
      FROM (
        SELECT customer_id FROM app_user_customers WHERE user_id = $1
        UNION
        SELECT sac.customer_id
        FROM sales_agent_customers sac
        INNER JOIN sales_agents sa ON sa.id = sac.agent_id
        WHERE sa.user_id = $1
      ) c`,
    [user.id],
  );
  const customerIds = customerResult.rows.map((r) => r.customer_id);

  const cerResult = await pool.query(
    'SELECT cer_id FROM app_user_cer_permissions WHERE user_id = $1',
    [user.id],
  );
  const cerIds = cerResult.rows.map((r) => r.cer_id);

  return { user, roles, customerIds, cerIds };
}

/**
 * Require that the current user has at least one of the allowed roles. In
 * development it always succeeds. Throws an error with status 401 or 403
 * if the user is missing or lacks the required role.
 *
 * @param {object} userContext The object returned by getCurrentUser().
 * @param {Array<string>} allowedRoles The roles permitted to execute the
 *   protected action.
 */
function requireRole(userContext, allowedRoles = []) {
  if (isDev()) return true;

  if (!userContext?.user) {
    const error = new Error('Utente non autenticato');
    error.statusCode = 401;
    throw error;
  }

  const allowed = toArray(allowedRoles);
  if (!allowed.length) return true;

  if (isSuperAdmin(userContext)) return true;

  if (
    allowed.includes(userContext.user.tipo_utente) ||
    userContext.roles.some((code) => allowed.includes(code))
  ) {
    return true;
  }

  const error = new Error('Accesso negato: ruolo insufficiente');
  error.statusCode = 403;
  throw error;
}

function requireCustomerAccess(userContext, customerId) {
  if (!userContext?.user) {
    const error = new Error('Utente non autenticato');
    error.statusCode = 401;
    throw error;
  }
  if (!customerId) return true;
  if (isAdminOrAbove(userContext)) return true;
  if (userContext.customerIds.includes(customerId)) return true;
  const error = new Error('Accesso cliente negato');
  error.statusCode = 403;
  throw error;
}

function requireCerAccess(userContext, cerId) {
  if (!userContext?.user) {
    const error = new Error('Utente non autenticato');
    error.statusCode = 401;
    throw error;
  }
  if (!cerId) return true;
  if (isAdminOrAbove(userContext)) return true;
  if (userContext.cerIds.includes(cerId)) return true;
  const error = new Error('Accesso CER negato');
  error.statusCode = 403;
  throw error;
}

export {
  getCurrentUser,
  requireRole,
  requireCustomerAccess,
  requireCerAccess,
  isAdminOrAbove,
  isSuperAdmin,
  isClientUser,
};
