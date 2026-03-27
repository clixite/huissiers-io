import "dotenv/config";
import express from "express";
import cors from "cors";
import { Resend } from "resend";

const app = express();
const PORT = process.env.PORT || 3050;

// ---------------------------------------------------------------------------
// Resend client
// ---------------------------------------------------------------------------
const resend = new Resend(process.env.RESEND_API_KEY);

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------
app.use(express.json());
app.use(
  cors({
    origin: [
      "https://huissiers.io",
      "https://www.huissiers.io",
      "http://localhost:5500",
      "http://127.0.0.1:5500",
    ],
    methods: ["POST", "OPTIONS"],
    allowedHeaders: ["Content-Type"],
  })
);

// ---------------------------------------------------------------------------
// Health check
// ---------------------------------------------------------------------------
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ---------------------------------------------------------------------------
// POST /api/contact
// ---------------------------------------------------------------------------
app.post("/api/contact", async (req, res) => {
  try {
    const {
      study_name,
      name,
      email,
      phone,
      bailiffs_count,
      current_software,
      message,
      gdpr_consent,
    } = req.body;

    // --- Validation --------------------------------------------------------
    const errors = [];
    if (!study_name?.trim()) errors.push("study_name est requis");
    if (!name?.trim()) errors.push("name est requis");
    if (!email?.trim()) errors.push("email est requis");
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.push("email invalide");
    }
    if (!gdpr_consent) errors.push("Le consentement RGPD est requis");

    if (errors.length > 0) {
      return res.status(400).json({ success: false, errors });
    }

    // --- Build HTML email --------------------------------------------------
    const html = buildEmailHtml({
      study_name,
      name,
      email,
      phone,
      bailiffs_count,
      current_software,
      message,
    });

    // --- Send via Resend ---------------------------------------------------
    const { data, error } = await resend.emails.send({
      from: process.env.RESEND_FROM || "noreply@huissier.clixitebot.eu",
      to: [process.env.CONTACT_TO || "nicolas@clixite.be"],
      replyTo: email,
      subject: `[huissiers.io] Nouvelle demande — ${study_name}`,
      html,
    });

    if (error) {
      console.error("[resend] Send failed:", error);
      return res.status(502).json({
        success: false,
        errors: ["L'envoi de l'email a echoue. Veuillez reessayer."],
      });
    }

    console.log("[resend] Email sent:", data?.id);
    return res.json({ success: true, messageId: data?.id });
  } catch (err) {
    console.error("[contact] Unexpected error:", err);
    return res.status(500).json({
      success: false,
      errors: ["Erreur interne du serveur."],
    });
  }
});

// ---------------------------------------------------------------------------
// HTML email builder
// ---------------------------------------------------------------------------
function buildEmailHtml({
  study_name,
  name,
  email,
  phone,
  bailiffs_count,
  current_software,
  message,
}) {
  const row = (label, value) => {
    if (!value) return "";
    return `
      <tr>
        <td style="padding:12px 16px;font-weight:600;color:#374151;border-bottom:1px solid #f3f4f6;width:200px;vertical-align:top;">
          ${label}
        </td>
        <td style="padding:12px 16px;color:#1f2937;border-bottom:1px solid #f3f4f6;">
          ${escapeHtml(String(value))}
        </td>
      </tr>`;
  };

  return `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#f97316,#ea580c);padding:28px 32px;">
              <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;">
                Nouvelle demande de contact
              </h1>
              <p style="margin:6px 0 0;color:rgba(255,255,255,0.85);font-size:14px;">
                via huissiers.io
              </p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:24px 32px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
                ${row("Etude", study_name)}
                ${row("Nom", name)}
                ${row("Email", email)}
                ${row("Telephone", phone)}
                ${row("Nombre d'huissiers", bailiffs_count)}
                ${row("Logiciel actuel", current_software)}
              </table>

              ${
                message
                  ? `
              <div style="margin-top:24px;">
                <h2 style="margin:0 0 8px;font-size:15px;font-weight:600;color:#374151;">Message</h2>
                <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:16px;color:#1f2937;font-size:14px;line-height:1.6;white-space:pre-wrap;">${escapeHtml(message)}</div>
              </div>`
                  : ""
              }
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:16px 32px 24px;border-top:1px solid #f3f4f6;">
              <p style="margin:0;font-size:12px;color:#9ca3af;">
                Cet email a ete envoye automatiquement depuis le formulaire de contact de
                <a href="https://huissiers.io" style="color:#f97316;text-decoration:none;">huissiers.io</a>.
                Vous pouvez repondre directement a cet email pour contacter ${escapeHtml(name)} (${escapeHtml(email)}).
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------
app.listen(PORT, () => {
  console.log(`[huissiers-io-api] Listening on port ${PORT}`);
});
