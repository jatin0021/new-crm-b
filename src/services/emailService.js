import nodemailer from 'nodemailer';
import { env } from '../config/env.js';

let transporter = null;

if (env.SMTP_HOST && env.SMTP_USER) {
  transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: parseInt(env.SMTP_PORT) || 587,
    secure: parseInt(env.SMTP_PORT) === 465,
    auth: {
      user: env.SMTP_USER,
      pass: env.SMTP_PASS
    }
  });
}

/**
 * Send Account Activation Email
 */
export const sendActivationEmail = async (email, name, token) => {
  const activationUrl = `${env.CLIENT_BASE_URL}/activate?token=${token}&email=${encodeURIComponent(email)}`;

  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #0f172a; color: #f8fafc; padding: 30px; border-radius: 16px; border: 1px solid #334155;">
      <div style="text-align: center; margin-bottom: 24px;">
        <h1 style="color: #10b981; font-size: 24px; margin: 0;">Vintage<span style="color: #ffffff;">CRM</span></h1>
        <p style="color: #94a3b8; font-size: 13px; margin-top: 4px;">Trader Account Verification</p>
      </div>

      <p style="font-size: 15px;">Hello <strong>${name}</strong>,</p>
      <p style="font-size: 14px; color: #cbd5e1; line-height: 1.6;">
        Welcome to Vintage CRM! Please click the button below to verify your email address and activate live trading privileges.
      </p>

      <div style="text-align: center; margin: 32px 0;">
        <a href="${activationUrl}" style="background: linear-gradient(135deg, #059669 0%, #0d9488 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 30px; font-weight: bold; font-size: 14px; display: inline-block; box-shadow: 0 4px 14px rgba(16, 185, 129, 0.4);">
          Activate Account Now
        </a>
      </div>

      <p style="font-size: 12px; color: #64748b; line-height: 1.5;">
        Or copy and paste this link into your browser:<br/>
        <a href="${activationUrl}" style="color: #34d399;">${activationUrl}</a>
      </p>

      <hr style="border: 0; border-top: 1px solid #334155; margin: 24px 0;" />
      <p style="font-size: 11px; color: #64748b; text-align: center;">
        If you did not register for a Vintage CRM account, please ignore this email.
      </p>
    </div>
  `;

  console.log(`\n==================================================`);
  console.log(`📧 [EMAIL SERVICE] ACCOUNT ACTIVATION LINK DISPATCHED`);
  console.log(`To: ${email}`);
  console.log(`Link: ${activationUrl}`);
  console.log(`==================================================\n`);

  if (transporter) {
    try {
      await transporter.sendMail({
        from: env.SMTP_FROM,
        to: email,
        subject: 'Activate Your Vintage CRM Account',
        html: htmlContent
      });
      return { success: true, dispatched: true };
    } catch (err) {
      console.warn('⚠️ SMTP Email delivery error (using fallback logged link):', err.message);
    }
  }

  return { success: true, dispatched: false, link: activationUrl };
};

/**
 * Send Password Reset Email
 */
export const sendPasswordResetEmail = async (email, name, token) => {
  const resetUrl = `${env.CLIENT_BASE_URL}/reset-password?token=${token}&email=${encodeURIComponent(email)}`;

  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #0f172a; color: #f8fafc; padding: 30px; border-radius: 16px; border: 1px solid #334155;">
      <div style="text-align: center; margin-bottom: 24px;">
        <h1 style="color: #10b981; font-size: 24px; margin: 0;">Vintage<span style="color: #ffffff;">CRM</span></h1>
        <p style="color: #94a3b8; font-size: 13px; margin-top: 4px;">Password Reset Request</p>
      </div>

      <p style="font-size: 15px;">Hello <strong>${name}</strong>,</p>
      <p style="font-size: 14px; color: #cbd5e1; line-height: 1.6;">
        We received a request to reset your password. Click the button below to update your password standards. This reset link expires in 1 hour.
      </p>

      <div style="text-align: center; margin: 32px 0;">
        <a href="${resetUrl}" style="background: linear-gradient(135deg, #059669 0%, #0d9488 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 30px; font-weight: bold; font-size: 14px; display: inline-block; box-shadow: 0 4px 14px rgba(16, 185, 129, 0.4);">
          Reset Your Password
        </a>
      </div>

      <p style="font-size: 12px; color: #64748b; line-height: 1.5;">
        Or copy and paste this link into your browser:<br/>
        <a href="${resetUrl}" style="color: #34d399;">${resetUrl}</a>
      </p>

      <hr style="border: 0; border-top: 1px solid #334155; margin: 24px 0;" />
      <p style="font-size: 11px; color: #64748b; text-align: center;">
        If you did not request a password reset, please secure your account immediately or ignore this email.
      </p>
    </div>
  `;

  console.log(`\n==================================================`);
  console.log(`🔑 [EMAIL SERVICE] PASSWORD RESET LINK DISPATCHED`);
  console.log(`To: ${email}`);
  console.log(`Link: ${resetUrl}`);
  console.log(`==================================================\n`);

  if (transporter) {
    try {
      await transporter.sendMail({
        from: env.SMTP_FROM,
        to: email,
        subject: 'Reset Your Vintage CRM Password',
        html: htmlContent
      });
      return { success: true, dispatched: true };
    } catch (err) {
      console.warn('⚠️ SMTP Email delivery error (using fallback logged link):', err.message);
    }
  }

  return { success: true, dispatched: false, link: resetUrl };
};
