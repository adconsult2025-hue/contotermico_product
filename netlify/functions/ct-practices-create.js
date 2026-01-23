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
    const title = (payload.title || "").trim();
    const subjectType = (payload.subject_type || "CONDOMINIO").trim() || "CONDOMINIO";

    if (!title) {
      return {
        statusCode: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify({ ok: false, error: "Titolo obbligatorio." }),
      };
    }

    const supabase = getAdminClient();

    const { data: practice, error } = await supabase
      .from("ct_practices")
      .insert([
        {
          owner_user_id: user.id,
          title,
          subject_type: subjectType,
        },
      ])
      .select("id")
      .single();

    if (error) {
      throw new Error(error.message);
    }

    const subjectData = {
      tipo: "CONDOMINIO",
      denominazione: "",
      indirizzo: "",
      comune: "",
    };

    const { error: subjectError } = await supabase.from("ct_subjects").insert([
      {
        practice_id: practice.id,
        owner_user_id: user.id,
        data: subjectData,
      },
    ]);

    if (subjectError) {
      throw new Error(subjectError.message);
    }

    const { error: eventError } = await supabase.from("ct_events").insert([
      {
        practice_id: practice.id,
        owner_user_id: user.id,
        type: "PRACTICE_CREATED",
        payload: { title, subject_type: subjectType },
      },
    ]);

    if (eventError) {
      throw new Error(eventError.message);
    }

    return {
      statusCode: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({ ok: true, id: practice.id }),
    };
  } catch (error) {
    return {
      statusCode: error.statusCode || 500,
      headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({ ok: false, error: error.message || "Errore imprevisto." }),
    };
  }
};
