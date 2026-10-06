const { Resend } = require("resend");
const fs = require("fs");
const path = require("path");

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  const resendApiKey = process.env.RESEND_API_KEY;
  const recipientEmail = process.env.FORM_RECIPIENT_EMAIL;

  if (!resendApiKey || !recipientEmail) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Email service not configured" }),
    };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: "Invalid JSON" }) };
  }

  const { formId, referenceNumber, submittedAt, applicantEmail, data } = body;

  if (!formId || !data || !referenceNumber) {
    return { statusCode: 400, body: JSON.stringify({ error: "Missing required fields" }) };
  }

  const timestamp = submittedAt || new Date().toISOString();
  const dateFormatted = new Date(timestamp).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  // Build the replacements map from the form data
  const replacements = {
    "{{REFERENCE_NUMBER}}": esc(referenceNumber),
    "{{DATE_SUBMITTED}}": esc(dateFormatted),
    "{{APPLICANT_NAME}}": esc(data["Your details"]?.["Full name"] || ""),
    "{{REGISTRATION_NUMBER}}": esc(data["Vehicle details"]?.["Registration number"] || ""),
    "{{CHASSIS_NUMBER}}": esc(data["Vehicle details"]?.["Chassis number"] || ""),
    "{{OLD_ENGINE_NUMBER}}": esc(data["Engine details"]?.["Old engine number"] || ""),
    "{{NEW_ENGINE_NUMBER}}": esc(data["Engine details"]?.["New engine number"] || ""),
    "{{ENGINE_SOURCE}}": esc(data["Engine details"]?.["Source of new engine"] || ""),
    "{{OLD_ENGINE_DISPOSAL}}": esc(data["Old engine disposal"]?.["What happened to the old engine"] || ""),
  };

  // Load and populate email templates
  const templatesDir = path.resolve(__dirname, "../../prototypes", formId);
  let adminHtml, applicantHtmlBody;

  try {
    adminHtml = populateTemplate(
      fs.readFileSync(path.join(templatesDir, "email-bla.html"), "utf-8"),
      replacements
    );
    applicantHtmlBody = populateTemplate(
      fs.readFileSync(path.join(templatesDir, "email-applicant.html"), "utf-8"),
      replacements
    );
  } catch (err) {
    console.error("Template read error:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Email template not found for this form" }),
    };
  }

  const resend = new Resend(resendApiKey);
  const results = [];

  // Send to BLA admin
  try {
    const { data: adminResult, error } = await resend.emails.send({
      from: "BLA Forms <onboarding@resend.dev>",
      to: [recipientEmail],
      subject: `New change of engine notification – ${referenceNumber}`,
      html: adminHtml,
    });

    if (error) {
      console.error("Resend error (admin):", error);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "Failed to send email", details: error.message }),
      };
    }
    results.push({ to: "admin", emailId: adminResult.id });
  } catch (err) {
    console.error("Send error (admin):", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Failed to send email" }),
    };
  }

  // Send confirmation to applicant
  if (applicantEmail) {
    try {
      const { error } = await resend.emails.send({
        from: "BLA Forms <onboarding@resend.dev>",
        to: [applicantEmail],
        subject: `Your change of engine notification has been submitted – Reference ${referenceNumber}`,
        html: applicantHtmlBody,
      });
      if (error) {
        console.error("Resend error (applicant):", error);
      } else {
        results.push({ to: "applicant" });
      }
    } catch (err) {
      // Log but don't fail the whole submission if applicant email fails
      console.error("Send error (applicant):", err);
    }
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ success: true, referenceNumber, emails: results }),
  };
};

/**
 * Replace all {{PLACEHOLDER}} tokens in a template string.
 */
function populateTemplate(template, replacements) {
  let result = template;
  for (const [token, value] of Object.entries(replacements)) {
    result = result.replaceAll(token, value);
  }
  return result;
}

function esc(str) {
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
