import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withAuth, ok, errors, assertSameOrigin } from "@/lib/api";
import {
  gmailConfigured, refreshAccessToken, syncReceipts, authorizeUrl,
} from "@/lib/integrations/gmail";
import { decryptSecret, encryptSecret } from "@/lib/crypto";
import { rateLimit } from "@/lib/ratelimit";
import { notify } from "@/lib/notifications";

function gmailAccount(userId: string) {
  return db.account.findFirst({ where: { userId, provider: "gmail" } });
}

async function liveAccessToken(account: {
  accessTokenEnc: string | null; refreshTokenEnc: string | null; tokenExpiresAt: Date | null;
}): Promise<{ token: string; refreshed?: { accessTokenEnc: string; tokenExpiresAt: Date } }> {
  if (!account.accessTokenEnc) throw errors.badRequest("Gmail not connected.");
  if (account.tokenExpiresAt && account.tokenExpiresAt.getTime() > Date.now() + 30_000) {
    return { token: decryptSecret(account.accessTokenEnc) };
  }
  if (!account.refreshTokenEnc) throw errors.badRequest("Gmail token expired — reconnect.");
  const refreshed = await refreshAccessToken(account.refreshTokenEnc);
  return {
    token: refreshed.accessToken,
    refreshed: {
      accessTokenEnc: encryptSecret(refreshed.accessToken),
      tokenExpiresAt: refreshed.expiresAt,
    },
  };
}

/** POST /api/integrations/gmail — sync trip receipts into earnings. */
export const POST = withAuth(async (req, { user }) => {
  assertSameOrigin(req);
  const rl = rateLimit(`gmail-sync:${user.id}`, 6, 60_000);
  if (!rl.ok) throw errors.tooMany(rl.retryAfterSec);
  if (!gmailConfigured()) throw errors.badRequest("Gmail sync isn't configured on this deployment.");

  const account = await gmailAccount(user.id);
  if (!account) throw errors.badRequest("Connect Gmail first.");

  const { token, refreshed } = await liveAccessToken(account);
  if (refreshed) {
    await db.account.update({ where: { id: account.id }, data: refreshed });
  }

  const receipts = await syncReceipts(token);
  const platforms = await db.platform.findMany({ select: { id: true, key: true } });
  const keyToId = new Map(platforms.map((p) => [p.key, p.id]));

  const existing = await db.earning.findMany({
    where: { userId: user.id, importKey: { in: receipts.map((r) => r.externalId) } },
    select: { importKey: true },
  });
  const seen = new Set(existing.map((e) => e.importKey));
  const fresh = receipts.filter((r) => !seen.has(r.externalId));

  for (const r of fresh) {
    const platformId = keyToId.get(r.platformKey) ?? null;
    if (platformId) {
      await db.platformConnection.upsert({
        where: { userId_platformId: { userId: user.id, platformId } },
        update: {},
        create: { userId: user.id, platformId, status: "MANUAL" },
      });
    }
    await db.earning.create({
      data: {
        userId: user.id,
        platformId,
        category: "TRIP",
        amountCents: r.amountCents,
        tipCents: r.tipCents,
        bonusCents: r.bonusCents,
        earnedAt: r.earnedAt,
        importKey: r.externalId,
        source: "SYNC",
        notes: "From email receipt",
      },
    });
  }

  if (fresh.length) {
    await notify(user.id, "PLATFORM", "Receipts imported", `${fresh.length} trip receipt${fresh.length === 1 ? "" : "s"} synced from Gmail.`);
  }
  return ok({ imported: fresh.length, found: receipts.length });
});

/** GET /api/integrations/gmail — connection status (or OAuth start URL). */
export const GET = withAuth(async (req, { user }) => {
  const account = await gmailAccount(user.id);
  return ok({
    configured: gmailConfigured(),
    connected: !!account,
    email: account?.providerAccountId ?? null,
    authorizeUrl: gmailConfigured() ? authorizeUrl(user.id) : null,
  });
});

/** DELETE /api/integrations/gmail — disconnect and drop stored tokens. */
export const DELETE = withAuth(async (req, { user }) => {
  assertSameOrigin(req);
  await db.account.deleteMany({ where: { userId: user.id, provider: "gmail" } });
  return ok({ disconnected: true });
});

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 });
}
