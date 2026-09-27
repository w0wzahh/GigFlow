import { db } from "@/lib/db";
import { consumeToken } from "@/lib/auth/tokens";
import { withErrors, parseBody, errors, ok } from "@/lib/api";
import { z } from "zod";

const schema = z.object({ token: z.string().min(10) });

export const POST = withErrors(async (req) => {
  const { token } = await parseBody(req, schema);
  const userId = await consumeToken(token, "EMAIL_VERIFY");
  if (!userId) throw errors.badRequest("This verification link is invalid or has expired.");
  await db.user.update({
    where: { id: userId },
    data: { emailVerifiedAt: new Date() },
  });
  return ok({ verified: true });
});
