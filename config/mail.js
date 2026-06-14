const nodemailer = require('nodemailer');

const DEFAULT_ADMIN_EMAIL = 'admin-verification@example.com';

const getAdminVerificationEmail = () =>
  process.env.ADMIN_VERIFICATION_EMAIL || DEFAULT_ADMIN_EMAIL;

const createTransporter = () => {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    return null;
  }

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: String(process.env.SMTP_SECURE || 'false').toLowerCase() === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
};

const escapeHtml = (value) =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const sendVerificationCodeToAdmin = async ({ user, code }) => {
  const adminEmail = getAdminVerificationEmail();
  const transporter = createTransporter();

  const subject = 'VRJ mobile login verification code';
  const text = [
    'A non-admin user is requesting mobile login verification.',
    `User: ${user.name}`,
    `Email: ${user.email}`,
    `Role: ${user.roleId}`,
    `Verification code: ${code}`,
    'This code expires in 10 minutes.',
  ].join('\n');

  const html = `
    <div style="margin:0;padding:24px;background:#eef7f4;font-family:Arial,sans-serif;color:#16312b;">
      <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 14px 40px rgba(15,93,51,0.10);">
        <div style="padding:28px 32px;background:linear-gradient(135deg,#0f5d33 0%,#1f8a70 100%);color:#ffffff;">
          <div style="font-size:13px;letter-spacing:1.6px;text-transform:uppercase;opacity:0.9;">VRJ Mobile Security</div>
          <h1 style="margin:12px 0 0;font-size:28px;line-height:1.2;">Login verification request</h1>
          <p style="margin:12px 0 0;font-size:15px;line-height:1.6;opacity:0.95;">
            A non-admin user has signed in and needs approval code verification before mobile access is granted.
          </p>
        </div>
        <div style="padding:28px 32px;">
          <div style="margin-bottom:20px;padding:18px;background:#f6fbf9;border:1px solid #dbece5;border-radius:16px;">
            <div style="font-size:12px;color:#5d6f69;text-transform:uppercase;letter-spacing:1.2px;margin-bottom:8px;">Verification Code</div>
            <div style="font-size:34px;font-weight:700;letter-spacing:8px;color:#0f5d33;">${escapeHtml(code)}</div>
            <div style="margin-top:8px;font-size:13px;color:#5d6f69;">This code expires in 10 minutes.</div>
          </div>

          <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;">
            <tr>
              <td style="padding:10px 0;border-bottom:1px solid #edf3f0;font-size:14px;color:#5d6f69;width:140px;">User Name</td>
              <td style="padding:10px 0;border-bottom:1px solid #edf3f0;font-size:15px;font-weight:600;color:#16312b;">${escapeHtml(user.name)}</td>
            </tr>
            <tr>
              <td style="padding:10px 0;border-bottom:1px solid #edf3f0;font-size:14px;color:#5d6f69;">User Email</td>
              <td style="padding:10px 0;border-bottom:1px solid #edf3f0;font-size:15px;font-weight:600;color:#16312b;">${escapeHtml(user.email)}</td>
            </tr>
            <tr>
              <td style="padding:10px 0;border-bottom:1px solid #edf3f0;font-size:14px;color:#5d6f69;">Role ID</td>
              <td style="padding:10px 0;border-bottom:1px solid #edf3f0;font-size:15px;font-weight:600;color:#16312b;">${escapeHtml(user.roleId)}</td>
            </tr>
            <tr>
              <td style="padding:10px 0 0;font-size:14px;color:#5d6f69;">Requested At</td>
              <td style="padding:10px 0 0;font-size:15px;font-weight:600;color:#16312b;">${escapeHtml(new Date().toLocaleString())}</td>
            </tr>
          </table>

          <p style="margin:24px 0 0;font-size:13px;line-height:1.6;color:#6a7d76;">
            Share this code only with the verified user. If this request looks unexpected, do not share the code.
          </p>
        </div>
      </div>
    </div>
  `;

  if (!transporter) {
    console.warn(
      `SMTP is not configured. Intended verification email to ${adminEmail}: ${text}`,
    );
    return {
      delivered: false,
      adminEmail,
    };
  }

  await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: adminEmail,
    subject,
    text,
    html,
  });

  return {
    delivered: true,
    adminEmail,
  };
};

const sendPasswordResetOtpEmail = async ({ user, otp }) => {
  const transporter = createTransporter();
  const recipientEmail = user.email;

  const subject = 'VRJ mobile password reset OTP';
  const text = [
    `Hello ${user.name || 'User'},`,
    '',
    'We received a request to reset your password for the VRJ mobile app.',
    `OTP: ${otp}`,
    'This OTP expires in 10 minutes.',
    'Enter this OTP in the mobile app to continue resetting your password.',
    '',
    'If you did not request this, you can ignore this email.',
  ].join('\n');

  const html = `
    <div style="margin:0;padding:24px;background:#eef7f4;font-family:Arial,sans-serif;color:#16312b;">
      <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 14px 40px rgba(15,93,51,0.10);">
        <div style="padding:28px 32px;background:linear-gradient(135deg,#0f5d33 0%,#1f8a70 100%);color:#ffffff;">
          <div style="font-size:13px;letter-spacing:1.6px;text-transform:uppercase;opacity:0.9;">VRJ Mobile Security</div>
          <h1 style="margin:12px 0 0;font-size:28px;line-height:1.2;">Password reset OTP</h1>
          <p style="margin:12px 0 0;font-size:15px;line-height:1.6;opacity:0.95;">
            Enter the OTP below in the mobile app to continue your password reset. This OTP expires in 10 minutes.
          </p>
        </div>
        <div style="padding:28px 32px;">
          <div style="margin-bottom:20px;padding:18px;background:#f6fbf9;border:1px solid #dbece5;border-radius:16px;">
            <div style="font-size:12px;color:#5d6f69;text-transform:uppercase;letter-spacing:1.2px;margin-bottom:8px;">One-Time Password</div>
            <div style="font-size:34px;font-weight:700;letter-spacing:8px;color:#0f5d33;">${escapeHtml(otp)}</div>
          </div>

          <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;">
            <tr>
              <td style="padding:10px 0;border-bottom:1px solid #edf3f0;font-size:14px;color:#5d6f69;width:140px;">Account Email</td>
              <td style="padding:10px 0;border-bottom:1px solid #edf3f0;font-size:15px;font-weight:600;color:#16312b;">${escapeHtml(recipientEmail)}</td>
            </tr>
            <tr>
              <td style="padding:10px 0 0;font-size:14px;color:#5d6f69;">Expires In</td>
              <td style="padding:10px 0 0;font-size:15px;font-weight:600;color:#16312b;">10 minutes</td>
            </tr>
          </table>

          <p style="margin:24px 0 0;font-size:13px;line-height:1.6;color:#6a7d76;">
            If you did not request a password reset, you can safely ignore this email.
          </p>
        </div>
      </div>
    </div>
  `;

  if (!transporter) {
    console.warn(
      `SMTP is not configured. Intended password reset email to ${recipientEmail}: ${text}`,
    );
    return {
      delivered: false,
      recipientEmail,
    };
  }

  await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: recipientEmail,
    subject,
    text,
    html,
  });

  return {
    delivered: true,
    recipientEmail,
  };
};

module.exports = {
  sendVerificationCodeToAdmin,
  sendPasswordResetOtpEmail,
  getAdminVerificationEmail,
};
