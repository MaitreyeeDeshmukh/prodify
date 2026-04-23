import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_EMAIL = "Prodify <noreply@prodify.dev>";
const APP_URL = process.env.NEXTAUTH_URL ?? "http://localhost:3000";

/**
 * Sends a password reset email with a one-time link.
 */
export async function sendPasswordResetEmail(
  email: string,
  token: string
): Promise<void> {
  const resetUrl = `${APP_URL}/reset-password?token=${token}`;

  const { error } = await resend.emails.send({
    from: FROM_EMAIL,
    to: email,
    subject: "Reset your Prodify password",
    html: `
      <div style="font-family: Inter, sans-serif; max-width: 520px; margin: 0 auto; padding: 32px; background: #0f0f0f; color: #f5f5f5; border-radius: 12px;">
        <h1 style="font-size: 24px; font-weight: 700; margin-bottom: 8px; color: #ffffff;">Reset your password</h1>
        <p style="color: #a0a0a0; margin-bottom: 24px; line-height: 1.6;">
          We received a request to reset the password for your Prodify account. Click the button below to choose a new password.
        </p>
        <a
          href="${resetUrl}"
          style="display: inline-block; background: #6366f1; color: #ffffff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 15px;"
        >
          Reset password
        </a>
        <p style="color: #666; font-size: 13px; margin-top: 24px;">
          This link expires in 1 hour. If you didn't request a password reset, you can safely ignore this email — your password won't change.
        </p>
        <hr style="border: none; border-top: 1px solid #222; margin: 24px 0;" />
        <p style="color: #444; font-size: 12px;">Prodify · Built for developers</p>
      </div>
    `,
  });

  if (error) {
    throw new Error(`Failed to send password reset email: ${error.message}`);
  }
}
