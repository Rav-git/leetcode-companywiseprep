import nodemailer from 'nodemailer'

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
})

function buildOtpEmailHtml(code: string, heading: string, subheading: string) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <meta name="color-scheme" content="dark"/>
</head>
<body style="margin:0;padding:0;background-color:#09090b;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation" style="background-color:#09090b;">
    <tr>
      <td align="center" style="padding:40px 16px;">

        <!-- Card -->
        <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation"
          style="max-width:440px;background-color:#18181b;border-radius:16px;border:1px solid #27272a;">

          <!-- Padding top -->
          <tr><td style="height:32px;"></td></tr>

          <!-- Logo row -->
          <tr>
            <td style="padding:0 32px;">
              <table cellpadding="0" cellspacing="0" border="0" role="presentation">
                <tr>
                  <td style="width:36px;height:36px;background-color:#FFA116;border-radius:8px;text-align:center;vertical-align:middle;">
                    <span style="font-size:13px;font-weight:900;color:#000000;line-height:36px;display:block;">&lt;/&gt;</span>
                  </td>
                  <td style="padding-left:10px;vertical-align:middle;">
                    <span style="color:#ffffff;font-weight:600;font-size:16px;">Code Company Wise</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Spacing -->
          <tr><td style="height:24px;"></td></tr>

          <!-- Heading -->
          <tr>
            <td style="padding:0 32px;">
              <h1 style="margin:0 0 8px 0;color:#ffffff;font-size:22px;font-weight:700;line-height:1.3;">${heading}</h1>
              <p style="margin:0;color:#a1a1aa;font-size:15px;line-height:1.5;">${subheading}</p>
            </td>
          </tr>

          <!-- Spacing -->
          <tr><td style="height:24px;"></td></tr>

          <!-- OTP box -->
          <tr>
            <td style="padding:0 32px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation"
                style="background-color:#09090b;border-radius:12px;border:1px solid #27272a;">
                <tr>
                  <td align="center" style="padding:24px 16px;">
                    <span style="font-size:40px;font-weight:800;letter-spacing:10px;color:#FFA116;font-family:'Courier New',Courier,monospace;">${code}</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Spacing -->
          <tr><td style="height:24px;"></td></tr>

          <!-- Footer note -->
          <tr>
            <td style="padding:0 32px;">
              <p style="margin:0;color:#71717a;font-size:13px;line-height:1.6;">
                This code expires in <strong style="color:#a1a1aa;">10 minutes</strong>.<br/>
                If you didn&apos;t request this, you can safely ignore this email.
              </p>
            </td>
          </tr>

          <!-- Padding bottom -->
          <tr><td style="height:32px;"></td></tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

function buildReengagementEmailHtml(firstName: string, unsubscribeUrl: string) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <meta name="color-scheme" content="dark"/>
</head>
<body style="margin:0;padding:0;background-color:#09090b;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation" style="background-color:#09090b;">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation"
          style="max-width:440px;background-color:#18181b;border-radius:16px;border:1px solid #27272a;">

          <tr><td style="height:32px;"></td></tr>

          <!-- Logo -->
          <tr>
            <td style="padding:0 32px;">
              <table cellpadding="0" cellspacing="0" border="0" role="presentation">
                <tr>
                  <td style="width:36px;height:36px;background-color:#FFA116;border-radius:8px;text-align:center;vertical-align:middle;">
                    <span style="font-size:13px;font-weight:900;color:#000000;line-height:36px;display:block;">&lt;/&gt;</span>
                  </td>
                  <td style="padding-left:10px;vertical-align:middle;">
                    <span style="color:#ffffff;font-weight:600;font-size:16px;">Code Company Wise</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr><td style="height:28px;"></td></tr>

          <!-- Body -->
          <tr>
            <td style="padding:0 32px;">
              <h1 style="margin:0 0 16px 0;color:#ffffff;font-size:22px;font-weight:700;line-height:1.3;">
                Hey ${firstName}, your prep is waiting 👋
              </h1>
              <p style="margin:0 0 12px 0;color:#a1a1aa;font-size:15px;line-height:1.6;">
                Top companies like <strong style="color:#e4e4e7;">Google, Amazon, and Meta</strong> are
                actively hiring — and consistent practice is the single biggest factor that separates
                candidates who get offers from those who don&apos;t.
              </p>
              <p style="margin:0 0 28px 0;color:#a1a1aa;font-size:15px;line-height:1.6;">
                Even <strong style="color:#e4e4e7;">one problem a day</strong> keeps the momentum alive.
                Your dashboard is right where you left it.
              </p>

              <!-- CTA button -->
              <table cellpadding="0" cellspacing="0" border="0" role="presentation">
                <tr>
                  <td style="background-color:#FFA116;border-radius:8px;">
                    <a href="${process.env.NEXTAUTH_URL ?? 'https://codecompanywise.com'}"
                      style="display:inline-block;padding:12px 28px;color:#000000;font-weight:700;font-size:15px;text-decoration:none;">
                      Resume your prep →
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr><td style="height:32px;"></td></tr>

          <!-- Footer -->
          <tr>
            <td style="padding:0 32px 28px 32px;border-top:1px solid #27272a;">
              <p style="margin:20px 0 0 0;color:#52525b;font-size:12px;line-height:1.6;">
                You&apos;re receiving this because you signed up for Code Company Wise.<br/>
                <a href="${unsubscribeUrl}" style="color:#71717a;text-decoration:underline;">Unsubscribe</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

export async function sendReengagementEmail({ email, name }: { email: string; name: string }) {
  const { createHmac } = await import('crypto')
  const token = createHmac('sha256', process.env.AUTH_SECRET ?? '').update(email).digest('hex')
  const unsubscribeUrl = `${process.env.NEXTAUTH_URL ?? 'https://codecompanywise.com'}/api/unsubscribe?email=${encodeURIComponent(email)}&token=${token}`
  const firstName = name.split(' ')[0]

  await transporter.sendMail({
    from: `"Code Company Wise" <${process.env.GMAIL_USER}>`,
    to: email,
    subject: `${firstName}, your interview prep is waiting`,
    html: buildReengagementEmailHtml(firstName, unsubscribeUrl),
  })
}

export async function sendOtpEmail(to: string, code: string, isResend = false) {
  await transporter.sendMail({
    from: `"LeetCode Companies" <${process.env.GMAIL_USER}>`,
    to,
    subject: `${code} is your LeetCode Companies verification code`,
    html: buildOtpEmailHtml(
      code,
      isResend ? 'New verification code' : 'Verify your email',
      isResend ? 'Here is your new one-time code:' : 'Enter this code to complete your sign up:'
    ),
  })
}
