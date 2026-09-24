import "server-only";
import { Resend } from "resend";

/**
 * Sends the password reset email through Resend. Without RESEND_API_KEY
 * (local development) the link is printed to the server console instead.
 */
export async function sendResetEmail(to: string, username: string, link: string) {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.log(`[mail] Password reset for ${username}: ${link}`);
    return;
  }

  const resend = new Resend(key);
  const { error } = await resend.emails.send({
    from: process.env.EMAIL_FROM ?? "Levitating Notebook <onboarding@resend.dev>",
    to,
    subject: "Reset your Levitating Notebook password",
    text: `Hi ${username},\n\nSomeone asked to reset the password for your Levitating Notebook account. If that was you, open this link within the next hour:\n\n${link}\n\nIf it wasn't you, you can ignore this email.`,
  });
  if (error) console.error("[mail] Resend error:", error);
}
