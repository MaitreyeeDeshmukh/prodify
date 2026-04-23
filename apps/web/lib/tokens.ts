import crypto from "crypto";
import { prisma } from "./prisma";

const TOKEN_EXPIRY_HOURS = 1;

/**
 * Creates a secure password reset token for a user.
 * Deletes any existing token for the user first to prevent stale tokens.
 */
export async function createPasswordResetToken(
  userId: string
): Promise<string> {
  const token = crypto.randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);

  // Remove any existing token for this user
  await prisma.passwordResetToken.deleteMany({ where: { userId } });

  // Create new token
  await prisma.passwordResetToken.create({
    data: { token, userId, expires },
  });

  return token;
}

/**
 * Validates a password reset token.
 * Returns the userId if valid, null if expired or not found.
 */
export async function validatePasswordResetToken(
  token: string
): Promise<string | null> {
  const record = await prisma.passwordResetToken.findUnique({
    where: { token },
  });

  if (!record) return null;
  if (record.expires < new Date()) {
    // Token expired — clean it up
    await prisma.passwordResetToken.delete({ where: { token } });
    return null;
  }

  return record.userId;
}

/**
 * Deletes a password reset token after it has been consumed.
 */
export async function deletePasswordResetToken(token: string): Promise<void> {
  await prisma.passwordResetToken.deleteMany({ where: { token } });
}
