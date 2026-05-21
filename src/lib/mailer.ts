import nodemailer from 'nodemailer'

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
})

function otpEmailHtml(code: string, heading: string, subheading: string) {
  return `<!DOCTYPE html>
<html>
  <body style="margin:0;padding:0;background:#09090b;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
    <div style="max-width:440px;margin:40px auto;background:#18181b;border-radius:16px;padding:36px;border:1px solid #27272a;">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:28px;">
        <div style="width:36px;height:36px;background:#FFA116;border-radius:8px;display:inline-flex;align-items:center;justify-content:center;font-weight:800;color:#000;font-size:13px;line-height:36px;text-align:center;">LC</div>
        <span style="color:#fff;font-weight:600;font-size:17px;vertical-align:middle;">LeetCode Companies</span>
      </div>
      <h2 style="color:#fff;margin:0 0 8px;font-size:22px;font-weight:700;">${heading}</h2>
      <p style="color:#a1a1aa;margin:0 0 28px;font-size:15px;">${subheading}</p>
      <div style="background:#09090b;border-radius:12px;padding:24px;text-align:center;margin-bottom:28px;border:1px solid #27272a;">
        <span style="font-size:42px;font-weight:800;letter-spacing:14px;color:#FFA116;font-variant-numeric:tabular-nums;">${code}</span>
      </div>
      <p style="color:#71717a;font-size:13px;margin:0;line-height:1.6;">
        This code expires in <strong style="color:#a1a1aa;">10 minutes</strong>.<br/>
        If you didn't request this, you can safely ignore this email.
      </p>
    </div>
  </body>
</html>`
}

export async function sendOtpEmail(to: string, code: string, isResend = false) {
  await transporter.sendMail({
    from: `"LeetCode Companies" <${process.env.GMAIL_USER}>`,
    to,
    subject: `${code} is your verification code`,
    html: otpEmailHtml(
      code,
      isResend ? 'New verification code' : 'Verify your email',
      isResend ? 'Here is your new code:' : 'Enter this code to complete your sign up:'
    ),
  })
}
