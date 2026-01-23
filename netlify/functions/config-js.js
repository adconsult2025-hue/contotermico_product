export async function handler() {
  const url = process.env.TERMO_SUPABASE_URL || "";
  const anon = process.env.TERMO_SUPABASE_ANON_KEY || "";

  const js = `// Auto-generated at runtime by Netlify Function
window.__TERMO_SUPABASE_URL = ${JSON.stringify(url || "MISSING_TERMO_SUPABASE_URL")};
window.__TERMO_SUPABASE_ANON_KEY = ${JSON.stringify(
    anon || "MISSING_TERMO_SUPABASE_ANON_KEY",
  )};
`;

  return {
    statusCode: 200,
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "no-store, max-age=0",
    },
    body: js,
  };
}
