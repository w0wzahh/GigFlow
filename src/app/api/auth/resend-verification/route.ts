import { db } from "@/lib/db";
import { createToken } from "@/lib/auth/tokens";
import { sendVerificationEmail } from "@/lib/auth/mailer";
import { withAuth, ok, errors } from "@/lib/api";
import { rateLimit } from "@/lib/ratelimit";

export const POST = withAuth(async (_req, { user }) => {
  const rl = rateLimit(`resend:${user.id}`, 3, 300_000);
  if (!rl.ok) throw errors.tooMany(rl.retryAfterSec);
  const dbUser = await db.user.findUnique({ where: { id: user.id } });
  if (!dbUser) throw errors.notFound("User");
  if (dbUser.emailVerifiedAt) return ok({ sent: false, alreadyVerified: true });
  const token = await createToken(user.id, "EMAIL_VERIFY");
  await sendVerificationEmail(dbUser.email, token);
  return ok({ sent: true });
});
