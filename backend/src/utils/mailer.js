const https = require('https');

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const RESEND_FROM =
  process.env.RESEND_FROM || 'H!BRUH <no-reply@hibruh.xyz>';

if (!RESEND_API_KEY) {
  console.warn(
    '[Mailer] RESEND_API_KEY is not set. Emails will not be sent via Resend.'
  );
}

async function sendMail(options) {
  if (!RESEND_API_KEY) {
    console.warn('[Mailer] Missing RESEND_API_KEY. Skipping sendMail.');
    return;
  }

  const { to, subject, text, html } = options;

  const payload = {
    from: RESEND_FROM,
    to: Array.isArray(to) ? to : [to],
    subject,
    html,
    text
  };

  const body = JSON.stringify(payload);

  const requestOptions = {
    hostname: 'api.resend.com',
    path: '/emails',
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body)
    }
  };

  await new Promise((resolve, reject) => {
    const req = https.request(requestOptions, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            const parsed = data ? JSON.parse(data) : null;
            if (parsed && parsed.id) {
              console.log('[Mailer] Resend email sent:', parsed.id);
            }
          } catch (e) {
            // abaikan error parse; tidak perlu gagal
          }
          resolve();
        } else {
          console.error(
            '[Mailer] Resend email failed:',
            res.statusCode,
            data
          );
          reject(new Error(`Resend API error: ${res.statusCode}`));
        }
      });
    });

    req.on('error', (err) => {
      console.error('[Mailer] Resend request error:', err);
      reject(err);
    });

    req.write(body);
    req.end();
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

