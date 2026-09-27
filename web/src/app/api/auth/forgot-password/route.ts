import { db } from "@/lib/db";
import { createToken } from "@/lib/auth/tokens";
import { sendPasswordResetEmail } from "@/lib/auth/mailer";
import { withErrors, parseBody, errors, ok, assertSameOrigin } from "@/lib/api";
import { z } from "zod";
import { emailSchema } from "@/lib/schemas";
import { rateLimit, clientIp } from "@/lib/ratelimit";

const schema = z.object({ email: emailSchema });

export const POST = withErrors(async (req) => {
  assertSameOrigin(req);
  const ip = clientIp(req);
  const rl = rateLimit(`forgot:${ip}`, 5, 60_000);
  if (!rl.ok) throw errors.tooMany(rl.retryAfterSec);

  const { email } = await parseBody(req, schema);
  const user = await db.user.findUnique({ where: { email } });
  // Always respond identically to avoid account enumeration.
  if (user && !user.deletedAt) {
    const token = await createToken(user.id, "PASSWORD_RESET");
    await sendPasswordResetEmail(user.email, token);
  }
  return ok({ sent: true });
});
