import { createHash, randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import { withAuth, ok, assertSameOrigin } from "@/lib/api";

export function hashMobileToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * POST — generate a new bearer token for the Android companion app.
 * The plaintext token is returned exactly once; only its SHA-256 hash is
 * persisted, matching how session cookies are stored.
 */
export const POST = withAuth(async (req, { user }) => {
  assertSameOrigin(req);
  const token = `gf_${randomBytes(24).toString("base64url")}`;
  await db.user.update({
    where: { id: user.id },
    data: { mobileTokenHash: hashMobileToken(token), mobileTokenCreatedAt: new Date() },
  });
  return ok({ token });
});

/** DELETE — revoke the companion-app token. */
export const DELETE = withAuth(async (req, { user }) => {
  assertSameOrigin(req);
  await db.user.update({
    where: { id: user.id },
    data: { mobileTokenHash: null, mobileTokenCreatedAt: null },
  });
  return ok({ revoked: true });
});
