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
    const practiceId = event.queryStringParameters?.id;

    if (!practiceId) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify({ ok: false, error: "Parametro id mancante." }),
      };
    }

    const supabase = getAdminClient();

    const { data: practice, error: practiceError } = await supabase
      .from("ct_practices")
      .select("id,title,status,subject_type,created_at,updated_at")
      .eq("id", practiceId)
      .eq("owner_user_id", user.id)
      .single();

    if (practiceError) {
      throw new Error(practiceError.message);
    }

    const { data: subject, error: subjectError } = await supabase
      .from("ct_subjects")
      .select("id,data,created_at,updated_at")
      .eq("practice_id", practiceId)
      .eq("owner_user_id", user.id)
      .single();

    if (subjectError && subjectError.code !== "PGRST116") {
      throw new Error(subjectError.message);
    }

    const { data: documents, error: documentsError } = await supabase
      .from("ct_documents")
      .select("id,kind,filename,storage_path,meta,created_at")
      .eq("practice_id", practiceId)
      .eq("owner_user_id", user.id)
      .order("created_at", { ascending: false });

    if (documentsError) {
      throw new Error(documentsError.message);
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        ok: true,
        practice,
        subject: subject || null,
        documents: documents || [],
      }),
    };
  } catch (error) {
    return {
      statusCode: error.statusCode || 500,
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({ ok: false, error: error.message || "Errore imprevisto." }),
    };
  }
};
