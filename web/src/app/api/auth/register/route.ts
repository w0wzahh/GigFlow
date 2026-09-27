import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { createSession, setSessionCookie } from "@/lib/auth/session";
import { createToken } from "@/lib/auth/tokens";
import { sendVerificationEmail } from "@/lib/auth/mailer";
import { withErrors, parseBody, errors, assertSameOrigin } from "@/lib/api";
import { registerSchema } from "@/lib/schemas";
import { rateLimit, clientIp } from "@/lib/ratelimit";
import { ensurePlatformCatalog } from "@/lib/catalog";
import { NextResponse } from "next/server";

export const POST = withErrors(async (req) => {
  assertSameOrigin(req);
  const ip = clientIp(req);
  const rl = rateLimit(`register:${ip}`, 10, 60_000);
  if (!rl.ok) throw errors.tooMany(rl.retryAfterSec);

  const body = await parseBody(req, registerSchema);

  const existing = await db.user.findUnique({ where: { email: body.email } });
  if (existing) throw errors.conflict("An account with this email already exists.");

  const user = await db.user.create({
    data: {
      email: body.email,
      name: body.name,
      passwordHash: await hashPassword(body.password),
      preference: { create: {} },
    },
  });
  await ensurePlatformCatalog();

  const token = await createToken(user.id, "EMAIL_VERIFY");
  await sendVerificationEmail(user.email, token);

  const sessionToken = await createSession(user.id, {
    ip,
    userAgent: req.headers.get("user-agent") ?? undefined,
  });
  await setSessionCookie(sessionToken);

  return NextResponse.json({ data: { id: user.id, email: user.email } }, { status: 201 });
});
