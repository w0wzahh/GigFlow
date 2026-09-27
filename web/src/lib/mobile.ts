import { createHash } from "node:crypto";
import { db } from "@/lib/db";
import { errors } from "@/lib/api";
import { rateLimit, clientIp } from "@/lib/ratelimit";

export function hashMobileToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Bearer-token auth for the Android companion app. Returns the user's id.
 * Rate-limited per IP before the (indexed) hash lookup so token probing
 * can't hammer the database.
 */
export async function getMobileUser(req: Request): Promise<{ id: string }> {
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (token.length < 16 || token.length > 128) throw errors.unauthorized();

  const rl = rateLimit(`mobile:${clientIp(req)}`, 300, 5 * 60_000);
  if (!rl.ok) throw errors.tooMany(rl.retryAfterSec);

  const user = await db.user.findFirst({
    where: { mobileTokenHash: hashMobileToken(token), deletedAt: null },
    select: { id: true },
  });
  if (!user) throw errors.unauthorized();
  return user;
}
