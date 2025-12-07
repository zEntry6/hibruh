const https = require('https');

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const RESEND_FROM =
  process.env.RESEND_FROM || 'H!BRUH <onboarding@resend.dev>';

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
