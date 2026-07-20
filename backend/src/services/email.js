const nodemailer = require('nodemailer');

let transporter = null;

async function getTransporter() {
  if (transporter) return transporter;

  // If SMTP credentials are configured, use them
  if (process.env.SMTP_USER && process.env.SMTP_PASS) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT) || 587,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  } else {
    // Create an Ethereal test account automatically
    const testAccount = await nodemailer.createTestAccount();
    transporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    });
    console.log('📧 Using Ethereal test email account:', testAccount.user);
    console.log('   View sent emails at: https://ethereal.email/login');
    console.log('   Credentials:', testAccount.user, '/', testAccount.pass);
  }

  return transporter;
}

async function sendEmail({ to, subject, html }) {
  try {
    const t = await getTransporter();
    const info = await t.sendMail({
      from: `"Family Document Vault" <${process.env.FROM_EMAIL || 'noreply@familyvault.app'}>`,
      to,
      subject,
      html,
    });
    console.log(`📧 Email sent to ${to}: ${info.messageId}`);
    const previewUrl = nodemailer.getTestMessageUrl(info);
    if (previewUrl) {
      console.log(`   Preview: ${previewUrl}`);
    }
    return { success: true, messageId: info.messageId, previewUrl };
  } catch (error) {
    console.error('Email send error:', error.message);
    return { success: false, error: error.message };
  }
}

async function sendInviteEmail({ to, inviterName, familyName, inviteLink }) {
  return sendEmail({
    to,
    subject: `You're invited to join ${familyName} on Family Document Vault`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #1e3a5f;">Family Document Vault</h2>
        <p>Hi there!</p>
        <p><strong>${inviterName}</strong> has invited you to join the family <strong>"${familyName}"</strong> on Family Document Vault.</p>
        <p>Click the button below to accept the invitation:</p>
        <a href="${inviteLink}" style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; margin: 16px 0;">Accept Invitation</a>
        <p style="color: #666; font-size: 14px;">This invitation expires in 7 days. If you didn't expect this email, you can safely ignore it.</p>
      </div>
    `,
  });
}

async function sendExpiryReminderEmail({ to, userName, documentName, daysUntilExpiry, familyName }) {
  const urgencyColor = daysUntilExpiry <= 1 ? '#dc2626' : daysUntilExpiry <= 7 ? '#d97706' : '#16a34a';
  return sendEmail({
    to,
    subject: `⚠️ Document "${documentName}" expires in ${daysUntilExpiry} day${daysUntilExpiry !== 1 ? 's' : ''}`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #1e3a5f;">Family Document Vault</h2>
        <p>Hi ${userName},</p>
        <p>Your document <strong>"${documentName}"</strong> in family <strong>"${familyName}"</strong> is expiring soon:</p>
        <div style="background: ${urgencyColor}15; border-left: 4px solid ${urgencyColor}; padding: 12px 16px; border-radius: 4px; margin: 16px 0;">
          <strong style="color: ${urgencyColor};">${daysUntilExpiry} day${daysUntilExpiry !== 1 ? 's' : ''} remaining</strong>
        </div>
        <p>Please renew or update this document to keep your records current.</p>
      </div>
    `,
  });
}

async function sendNewSharedDocEmail({ to, uploaderName, documentName, familyName }) {
  return sendEmail({
    to,
    subject: `New document shared in ${familyName}`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #1e3a5f;">Family Document Vault</h2>
        <p><strong>${uploaderName}</strong> shared a new document in <strong>"${familyName}"</strong>:</p>
        <div style="background: #f0f9ff; border-left: 4px solid #2563eb; padding: 12px 16px; border-radius: 4px; margin: 16px 0;">
          <strong>${documentName}</strong>
        </div>
        <p>Log in to view and download the document.</p>
      </div>
    `,
  });
}

module.exports = { sendEmail, sendInviteEmail, sendExpiryReminderEmail, sendNewSharedDocEmail };
