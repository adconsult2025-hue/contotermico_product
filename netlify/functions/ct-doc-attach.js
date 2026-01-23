const { getAdminClient, requireUser } = require("./_supabase");

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({ ok: false, error: "Metodo non consentito." }),
    };
  }

  try {
    const { user } = await requireUser(event);
    const payload = event.body ? JSON.parse(event.body) : {};
    const practiceId = (payload.practice_id || "").trim();
    const filename = (payload.filename || "").trim();
    const storagePath = (payload.storage_path || "").trim();
    const kind = (payload.kind || "").trim();

    if (!practiceId || !filename || !storagePath) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify({
          ok: false,
          error: "practice_id, filename e storage_path sono obbligatori.",
        }),
      };
    }

    const supabase = getAdminClient();
    const { data, error } = await supabase
      .from("ct_documents")
      .insert([
        {
          practice_id: practiceId,
          owner_user_id: user.id,
          filename,
          storage_path: storagePath,
          kind: kind || null,
        },
      ])
      .select("id")
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({ ok: true, id: data.id }),
    };
  } catch (error) {
    return {
      statusCode: error.statusCode || 500,
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({ ok: false, error: error.message || "Errore imprevisto." }),
    };
  }
};
