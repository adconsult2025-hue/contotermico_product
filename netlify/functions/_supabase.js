const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = process.env.TERMO_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.TERMO_SUPABASE_SERVICE_ROLE_KEY;

let adminClient;

function getAdminClient() {
  if (!adminClient) {
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      throw new Error("Missing Supabase admin environment variables.");
    }

    adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  return adminClient;
}

async function requireUser(event) {
  const authHeader = event.headers?.authorization || event.headers?.Authorization || "";

  if (!authHeader.startsWith("Bearer ")) {
    const error = new Error("Authorization Bearer token mancante.");
    error.statusCode = 401;
    throw error;
  }

  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  const supabase = getAdminClient();
  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data?.user) {
    const authError = new Error(error?.message || "Token non valido.");
    authError.statusCode = 401;
    throw authError;
  }

  return { user: data.user, token };
}

module.exports = { getAdminClient, requireUser };
