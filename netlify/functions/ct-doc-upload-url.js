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

    if (!practiceId || !filename) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify({ ok: false, error: "practice_id e filename sono obbligatori." }),
      };
    }

    const supabase = getAdminClient();
    const sanitizedFilename = filename.replace(/[^\w.\-]+/g, "_");
    const storagePath = `${user.id}/${practiceId}/${sanitizedFilename}`;

    const { data, error } = await supabase.storage
      .from("ct-docs")
      .createSignedUploadUrl(storagePath);

    if (error) {
      throw new Error(error.message);
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        ok: true,
        uploadUrl: data.signedUrl,
        storagePath,
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
