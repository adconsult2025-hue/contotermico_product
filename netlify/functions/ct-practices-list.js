const { getAdminClient, requireUser } = require("./_supabase");

exports.handler = async (event) => {
  if (event.httpMethod !== "GET") {
    return {
      statusCode: 405,
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({ ok: false, error: "Metodo non consentito." }),
    };
  }

  try {
    const { user } = await requireUser(event);
    const supabase = getAdminClient();

    const { data, error } = await supabase
      .from("ct_practices")
      .select("id,title,status,created_at")
      .eq("owner_user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({ ok: true, practices: data || [] }),
    };
  } catch (error) {
    return {
      statusCode: error.statusCode || 500,
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({ ok: false, error: error.message || "Errore imprevisto." }),
    };
  }
};
