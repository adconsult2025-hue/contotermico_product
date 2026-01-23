exports.handler = async () => {
  const supabaseUrl = process.env.TERMO_SUPABASE_URL || "";
  const supabaseAnonKey = process.env.TERMO_SUPABASE_ANON_KEY || "";
  const warnings = [];

  if (!process.env.TERMO_SUPABASE_URL) {
    warnings.push('console.warn("Missing TERMO_SUPABASE_URL env var.");');
  }

  if (!process.env.TERMO_SUPABASE_ANON_KEY) {
    warnings.push('console.warn("Missing TERMO_SUPABASE_ANON_KEY env var.");');
  }

  const body = [
    ...warnings,
    `window.__TERMO_SUPABASE_URL=${JSON.stringify(supabaseUrl)};`,
    `window.__TERMO_SUPABASE_ANON_KEY=${JSON.stringify(supabaseAnonKey)};`,
  ].join(" ");

  return {
    statusCode: 200,
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "no-store",
    },
    body,
  };
};
