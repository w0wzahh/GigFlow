import { createHash, randomBytes } from "node:crypto";
import { db } from "@/lib/db";

export type TokenType = "EMAIL_VERIFY" | "PASSWORD_RESET";

const TTL: Record<TokenType, number> = {
  EMAIL_VERIFY: 1000 * 60 * 60 * 24, // 24h
  PASSWORD_RESET: 1000 * 60 * 60, // 1h
};

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Create a one-time token. Returns the raw token to embed in a link. */
export async function createToken(
  userId: string,
  type: TokenType,
): Promise<string> {
  const raw = randomBytes(32).toString("base64url");
  await db.verificationToken.create({
    data: {
      userId,
      type,
      token: hashToken(raw),
      expiresAt: new Date(Date.now() + TTL[type]),
    },
  });
  return raw;
}

/** Consume a token; returns the user id or null when invalid/expired/used. */
export async function consumeToken(
  raw: string,
  type: TokenType,
): Promise<string | null> {
  const record = await db.verificationToken.findUnique({
    where: { token: hashToken(raw) },
  });
  if (!record || record.type !== type || record.usedAt || record.expiresAt < new Date()) {
    return null;
  }
  await db.verificationToken.update({
    where: { id: record.id },
    data: { usedAt: new Date() },
  });
  return record.userId;
}
