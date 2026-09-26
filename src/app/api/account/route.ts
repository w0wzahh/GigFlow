import { db } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { withAuth, parseBody, errors, ok, assertSameOrigin } from "@/lib/api";
import { z } from "zod";
import { emailSchema, passwordSchema } from "@/lib/schemas";

const patchSchema = z.object({
  name: z.string().trim().max(80).optional(),
  email: emailSchema.optional(),
  currentPassword: z.string().optional(),
  newPassword: passwordSchema.optional(),
});

export const GET = withAuth(async (_req, { user }) => {
  const dbUser = await db.user.findUniqueOrThrow({
    where: { id: user.id },
    select: {
      id: true, email: true, name: true, emailVerifiedAt: true,
      createdAt: true, preference: true,
      sessions: {
        orderBy: { createdAt: "desc" },
        select: { id: true, ip: true, userAgent: true, createdAt: true, expiresAt: true },
      },
    },
  });
  return ok({
    ...dbUser,
    sessions: dbUser.sessions.map((s) => ({
      ...s,
      current: s.id === user.sessionId,
    })),
  });
});

export const PATCH = withAuth(async (req, { user }) => {
  assertSameOrigin(req);
  const body = await parseBody(req, patchSchema);
  const dbUser = await db.user.findUniqueOrThrow({ where: { id: user.id } });

  const data: Record<string, unknown> = {};
  if (body.name !== undefined) data.name = body.name;
  if (body.email && body.email !== dbUser.email) {
    const taken = await db.user.findUnique({ where: { email: body.email } });
    if (taken) throw errors.conflict("That email is already in use.");
    data.email = body.email;
    data.emailVerifiedAt = null; // requires re-verification
  }
  if (body.newPassword) {
    if (!body.currentPassword || !(await verifyPassword(body.currentPassword, dbUser.passwordHash))) {
      throw errors.badRequest("Current password is incorrect.");
    }
    data.passwordHash = await hashPassword(body.newPassword);
  }
  const updated = await db.user.update({ where: { id: user.id }, data });
  if (body.newPassword) {
    // Revoke other sessions after a password change, keep the current one.
    await db.session.deleteMany({ where: { userId: user.id, NOT: { id: user.sessionId } } });
  }
  return ok({ id: updated.id, email: updated.email, name: updated.name });
});

const deleteSchema = z.object({ password: z.string().min(1) });

/** Permanently delete the account and all owned data (cascades). */
export const DELETE = withAuth(async (req, { user }) => {
  assertSameOrigin(req);
  const { password } = await parseBody(req, deleteSchema);
  const dbUser = await db.user.findUniqueOrThrow({ where: { id: user.id } });
  if (!(await verifyPassword(password, dbUser.passwordHash))) {
    throw errors.badRequest("Password is incorrect.");
  }
  await db.user.delete({ where: { id: user.id } });
  const { clearSessionCookie } = await import("@/lib/auth/session");
  await clearSessionCookie();
  return ok({ deleted: true });
});
