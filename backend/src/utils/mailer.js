const nodemailer = require('nodemailer');

const host = process.env.SMTP_HOST;
const port = Number(process.env.SMTP_PORT || 587);
const user = process.env.SMTP_USER;
const pass = process.env.SMTP_PASS;
const from = process.env.SMTP_FROM || user;

if (!host || !user || !pass) {
  console.warn(
    '[Mailer] SMTP configuration is incomplete. Emails will not be sent.'
  );
}

const transporter =
  host && user && pass
    ? nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: {
          user,
          pass
        }
      })
    : null;

async function sendMail(options) {
  if (!transporter) {
    console.warn('[Mailer] Transporter is not configured. Skipping sendMail.');
    return;
  }

  return transporter.sendMail({
    from,
    ...options
  });
}

async function sendPasswordResetEmail(user, resetUrl) {
  if (!user?.email) return;

  const name = user.displayName || user.username || 'there';

  const subject = 'Reset your H!BRUH password';
  const text = `Hi ${name},

You requested to reset your H!BRUH password.
Click the link below to set a new password:

${resetUrl}

If you did not request this, you can ignore this email.
`;

  const html = `
    <p>Hi ${name},</p>
    <p>You requested to reset your H!BRUH password.</p>
    <p>
      Click the link below to set a new password:<br/>
      <a href="${resetUrl}" target="_blank" rel="noopener noreferrer">${resetUrl}</a>
    </p>
    <p>If you did not request this, you can ignore this email.</p>
  `;

  return sendMail({
    to: user.email,
    subject,
    text,
    html
  });
}

async function sendEmailVerification(user, verifyUrl, overrideEmail) {
  const to = overrideEmail || user?.email;
  if (!to) return;

  const name = user.displayName || user.username || 'there';

  const subject = 'Verify your H!BRUH email';
  const text = `Hi ${name},

Welcome to H!BRUH! Please verify your email address by clicking the link below:

${verifyUrl}

If you did not create this account, you can ignore this email.
`;

  const html = `
    <p>Hi ${name},</p>
    <p>Welcome to H!BRUH! Please verify your email address by clicking the link below:</p>
    <p>
      <a href="${verifyUrl}" target="_blank" rel="noopener noreferrer">${verifyUrl}</a>
    </p>
    <p>If you did not create this account, you can ignore this email.</p>
  `;

  return sendMail({
    to,
    subject,
    text,
    html
  });
}

module.exports = {
  sendMail,
  sendPasswordResetEmail,
  sendEmailVerification
};
