/**
 * Email Service for Authentication
 * 
 * Uses Resend for email delivery (free tier: 100 emails/day)
 * OTP-based email verification
 */

import { config } from '../config/index.js';

// Email templates
const TEMPLATES = {
  verificationOTP: (name: string, otp: string) => ({
    subject: '🎯 Your MicroScroll verification code',
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc; padding: 40px 20px;">
          <div style="max-width: 480px; margin: 0 auto; background: white; border-radius: 16px; padding: 40px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
            <div style="text-align: center; margin-bottom: 32px;">
              <div style="width: 64px; height: 64px; background: linear-gradient(135deg, #6366f1, #8b5cf6); border-radius: 16px; margin: 0 auto 16px; display: flex; align-items: center; justify-content: center;">
                <span style="font-size: 32px;">📚</span>
              </div>
              <h1 style="color: #1e293b; font-size: 24px; margin: 0;">Verify your email</h1>
            </div>
            
            <p style="color: #475569; font-size: 16px; line-height: 1.6; text-align: center;">
              Hi ${name || 'there'}, enter this code to verify your email:
            </p>
            
            <div style="text-align: center; margin: 32px 0;">
              <div style="display: inline-block; background: linear-gradient(135deg, #6366f1, #8b5cf6); padding: 20px 40px; border-radius: 16px;">
                <span style="font-size: 36px; font-weight: bold; color: white; letter-spacing: 8px; font-family: monospace;">
                  ${otp}
                </span>
              </div>
            </div>
            
            <p style="color: #94a3b8; font-size: 14px; text-align: center;">
              This code expires in <strong>10 minutes</strong>.<br/>
              If you didn't create an account, you can safely ignore this email.
            </p>
            
            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 32px 0;">
            
            <p style="color: #94a3b8; font-size: 12px; text-align: center;">
              © ${new Date().getFullYear()} MicroScroll. Learn in scrolls.
            </p>
          </div>
        </body>
      </html>
    `,
    text: `Hi ${name || 'there'},\n\nYour MicroScroll verification code is: ${otp}\n\nThis code expires in 10 minutes.\n\n- The MicroScroll Team`,
  }),
};

/**
 * Send email using Resend API
 */
async function sendWithResend(to: string, subject: string, html: string, text: string): Promise<boolean> {
  const resendApiKey = config.email?.resendApiKey;
  
  if (!resendApiKey) {
    console.warn('⚠️ Resend API key not configured. Email not sent.');
    console.log('📧 Would send email to:', to);
    console.log('📧 Subject:', subject);
    // Extract OTP from text for testing
    const otpMatch = text.match(/code is: (\d{6})/);
    if (otpMatch) {
      console.log('📧 OTP Code:', otpMatch[1]);
    }
    return false;
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: config.email?.fromAddress || 'MicroScroll <onboarding@resend.dev>',
        to: [to],
        subject,
        html,
        text,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Resend API error:', error);
      return false;
    }

    console.log('📧 Email sent successfully to:', to);
    return true;
  } catch (error) {
    console.error('Failed to send email:', error);
    return false;
  }
}

/**
 * Generate 6-digit OTP
 */
export function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Send verification OTP email
 */
export async function sendVerificationOTP(
  to: string,
  name: string | null,
  otp: string
): Promise<boolean> {
  const template = TEMPLATES.verificationOTP(name || '', otp);
  return sendWithResend(to, template.subject, template.html, template.text);
}
