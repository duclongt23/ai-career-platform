const nodemailer = require("nodemailer");

let transporter;

function getFrontendUrl() {
  return (process.env.FRONTEND_URL || "http://localhost:5173").replace(/\/$/, "");
}

function getMailTransporter() {
  if (!process.env.SMTP_HOST) {
    return null;
  }

  if (!transporter) {
    const port = Number(process.env.SMTP_PORT || 587);
    const hasAuth = Boolean(process.env.SMTP_USER && process.env.SMTP_PASS);

    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: String(process.env.SMTP_SECURE || "").toLowerCase() === "true",
      auth: hasAuth
        ? {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
          }
        : undefined,
    });
  }

  return transporter;
}

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function sendPasswordResetEmail({ to, name, resetToken, expiresInMinutes }) {
  const resetLink = `${getFrontendUrl()}/reset-password?token=${encodeURIComponent(
    resetToken
  )}`;
  const mailer = getMailTransporter();

  if (!mailer) {
    console.info(`Password reset link for ${to}: ${resetLink}`);
    return;
  }

  const displayName = name || "bạn";
  const escapedName = escapeHtml(displayName);
  const escapedLink = escapeHtml(resetLink);
  const from =
    process.env.EMAIL_FROM ||
    process.env.SMTP_FROM ||
    process.env.SMTP_USER ||
    "Career Guidance <no-reply@career-guidance.local>";

  await mailer.sendMail({
    from,
    to,
    subject: "Đặt lại mật khẩu Career Guidance",
    text: [
      `Xin chào ${displayName},`,
      "",
      `Bạn vừa yêu cầu đặt lại mật khẩu. Link này có hiệu lực trong ${expiresInMinutes} phút:`,
      resetLink,
      "",
      "Nếu bạn không yêu cầu thao tác này, hãy bỏ qua email này.",
    ].join("\n"),
    html: `
      <p>Xin chào ${escapedName},</p>
      <p>Bạn vừa yêu cầu đặt lại mật khẩu. Link này có hiệu lực trong ${expiresInMinutes} phút.</p>
      <p><a href="${escapedLink}">Đặt lại mật khẩu</a></p>
      <p>Nếu bạn không yêu cầu thao tác này, hãy bỏ qua email này.</p>
    `,
  });
}

module.exports = {
  getFrontendUrl,
  sendPasswordResetEmail,
};
