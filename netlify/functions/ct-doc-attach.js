const { getAdminClient, requireUser, corsHeaders } = require("./_supabase");

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: corsHeaders, body: "" };
  }
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({ ok: false, error: "Metodo non consentito." }),
    };
  }

  try {
    const { user } = await requireUser(event);
    const payload = event.body ? JSON.parse(event.body) : {};
    const practiceId = (payload.practice_id || "").trim();
    const filename = (payload.filename || "").trim();
    const storagePath = (payload.path || payload.storage_path || "").trim();
    const kind = (payload.kind || "").trim();
    const contentType = (payload.content_type || "").trim();

    if (!practiceId || !filename || !storagePath) {
      return {
        statusCode: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify({
          ok: false,
          error: "practice_id, filename e path sono obbligatori.",
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
          kind: kind || "GENERIC",
          meta: contentType ? { content_type: contentType } : {},
        },
      ])
      .select("id")
      .single();

    if (error) {
      throw new Error(error.message);
    }

    const { error: eventError } = await supabase.from("ct_events").insert([
      {
        practice_id: practiceId,
        owner_user_id: user.id,
        type: "DOC_ATTACHED",
        payload: { document_id: data.id, filename, kind: kind || "GENERIC" },
      },
    ]);

    if (eventError) {
      throw new Error(eventError.message);
    }

    return {
      statusCode: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({ ok: true, id: data.id }),
    };
  } catch (error) {
    return {
      statusCode: error.statusCode || 500,
      headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({ ok: false, error: error.message || "Errore imprevisto." }),
    };
  }
};
