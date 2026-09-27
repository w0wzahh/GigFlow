/**
 * Transactional email delivery.
 *
 * No email provider is wired up in this environment, so the default
 * implementation writes messages to the server log. The interface is
 * intentionally small so a real provider (SES, Resend, Postmark…) can be
 * dropped in without touching call sites.
 */

export type MailMessage = {
  to: string;
  subject: string;
  text: string;
};

export interface Mailer {
  send(message: MailMessage): Promise<void>;
}

class LogMailer implements Mailer {
  async send(message: MailMessage): Promise<void> {
    // In development the full message (including magic links) is logged so
    // verification and reset flows are testable end to end.
    console.info(
      `[mailer] to=${message.to} subject=${message.subject}\n${message.text}`,
    );
  }
}

export const mailer: Mailer = new LogMailer();

function appUrl(path: string): string {
  const base = process.env.APP_URL ?? "http://localhost:3000";
  return `${base}${path}`;
}

export async function sendVerificationEmail(
  to: string,
  token: string,
): Promise<void> {
  await mailer.send({
    to,
    subject: "Verify your GigFlow email",
    text: `Welcome to GigFlow. Verify your email address:\n\n${appUrl(`/verify-email?token=${token}`)}\n\nThis link expires in 24 hours.`,
  });
}

export async function sendPasswordResetEmail(
  to: string,
  token: string,
): Promise<void> {
  await mailer.send({
    to,
    subject: "Reset your GigFlow password",
    text: `A password reset was requested for your GigFlow account:\n\n${appUrl(`/reset-password?token=${token}`)}\n\nThis link expires in 1 hour. If you did not request it, ignore this email.`,
  });
}
