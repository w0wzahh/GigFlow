import { createHmac } from "node:crypto";
import { decryptSecret, encryptSecret } from "@/lib/crypto";

/**
 * Gmail receipt sync — a real, user-consented data source.
 *
 * Uber and Lyft send drivers per-trip receipt/earnings emails. With the user's
 * explicit OAuth consent (gmail.readonly), we read those messages and turn
 * them into Earning records. This is the same mechanism expense tools use for
 * receipt capture — no credential storage, no scraping, revocable at any time.
 *
 * Requires env: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, APP_URL.
 * Without those the integration is surfaced as "Needs setup" — never faked.
 */

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const API = "https://gmail.googleapis.com/gmail/v1/users/me";
const SCOPE = "openid email https://www.googleapis.com/auth/gmail.readonly";

// Senders that actually email drivers per-trip earnings receipts.
export const RECEIPT_SENDERS: Record<string, string> = {
  "noreply@uber.com": "uber",
  "uber@uber.com": "uber-eats",
  "no-reply@lyftmail.com": "lyft",
  "receipts@lyftmail.com": "lyft",
};

export function gmailConfigured(): boolean {
  return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.APP_URL);
}

/* ---------------- OAuth state (HMAC-signed, expires) ---------------- */

export function signOAuthState(userId: string): string {
  const exp = Date.now() + 10 * 60_000;
  const payload = `${userId}.${exp}`;
  const sig = createHmac("sha256", process.env.APP_SECRET ?? "").update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function verifyOAuthState(state: string): { userId: string } | null {
  const parts = state.split(".");
  if (parts.length !== 3) return null;
  const [userId, exp, sig] = parts;
  const expected = createHmac("sha256", process.env.APP_SECRET ?? "")
    .update(`${userId}.${exp}`)
    .digest("base64url");
  if (sig !== expected || Number(exp) < Date.now()) return null;
  return { userId };
}

export function authorizeUrl(userId: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: `${process.env.APP_URL}/api/integrations/gmail/callback`,
    response_type: "code",
    scope: SCOPE,
    access_type: "offline",
    prompt: "consent",
    state: signOAuthState(userId),
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

type TokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  id_token?: string;
};

export async function exchangeCode(code: string): Promise<TokenResponse> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      code,
      grant_type: "authorization_code",
      redirect_uri: `${process.env.APP_URL}/api/integrations/gmail/callback`,
    }),
  });
  if (!res.ok) throw new Error(`Google token exchange failed (${res.status})`);
  return res.json();
}

export async function refreshAccessToken(refreshTokenEnc: string): Promise<{ accessToken: string; expiresAt: Date }> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: decryptSecret(refreshTokenEnc),
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) throw new Error(`Token refresh failed (${res.status}) — reconnect Gmail.`);
  const data = (await res.json()) as { access_token: string; expires_in: number };
  return {
    accessToken: data.access_token,
    expiresAt: new Date(Date.now() + data.expires_in * 1000),
  };
}

/** Decode the email address out of an OIDC id_token (payload is base64url JSON). */
export function emailFromIdToken(idToken: string | undefined): string | null {
  if (!idToken) return null;
  try {
    const payload = JSON.parse(Buffer.from(idToken.split(".")[1], "base64url").toString("utf8"));
    return typeof payload.email === "string" ? payload.email : null;
  } catch {
    return null;
  }
}

export function encryptTokens(t: TokenResponse): {
  accessTokenEnc: string;
  refreshTokenEnc: string | null;
  tokenExpiresAt: Date;
} {
  return {
    accessTokenEnc: encryptSecret(t.access_token),
    refreshTokenEnc: t.refresh_token ? encryptSecret(t.refresh_token) : null,
    tokenExpiresAt: new Date(Date.now() + t.expires_in * 1000),
  };
}

/* ---------------- Receipt parsing ---------------- */

export type ParsedReceipt = {
  platformKey: string;
  amountCents: number;
  tipCents: number;
  bonusCents: number;
  earnedAt: Date;
  externalId: string;
};

export function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, " ");
}

const toCents = (m: RegExpMatchArray | null) =>
  m ? Math.round(parseFloat(m[1].replace(/[$,]/g, "")) * 100) : null;

/**
 * Extract earnings from a driver receipt email body. Looks for labeled
 * amounts — "Total", "You earned", "Trip fare", "Tip" — and falls back to the
 * largest currency figure, which on ride receipts is the trip total.
 */
export function parseReceiptBody(text: string): { amountCents: number; tipCents: number; bonusCents: number } | null {
  const t = stripHtml(text);
  const labeled = (patterns: RegExp[]): number | null => {
    for (const re of patterns) {
      const m = t.match(re);
      const c = m && toCents(m);
      if (c != null && c > 0) return c;
    }
    return null;
  };

  const tip = labeled([/tip(?:s|ped)?[^$\d]{0,20}(\$?\d{1,4}[.,]\d{2})/i]);
  const bonus = labeled([/(?:bonus|promotion|quest|incentive|adjustment)[^$\d]{0,20}(\$?\d{1,4}[.,]\d{2})/i]);
  let amount = labeled([
    /(?:your (?:total )?earnings|you earned|total)[^$\d]{0,20}(\$?\d{1,5}[.,]\d{2})/i,
    /(?:trip fare|ride fare|delivery pay|base pay)[^$\d]{0,20}(\$?\d{1,5}[.,]\d{2})/i,
  ]);

  if (amount == null) {
    // Fallback: largest currency figure in the email is typically the total.
    const all = [...t.matchAll(/\$\s*(\d{1,5}[.,]\d{2})/g)]
      .map((m) => toCents(m)!)
      .filter((c) => c > 0);
    if (!all.length) return null;
    amount = Math.max(...all);
  }

  // If the amount already includes tip/bonus (a "Total"), keep it as the base;
  // when a separate fare matched, tips are additive. Cap sanity at $5,000.
  if (amount > 500_000) return null;
  return { amountCents: amount, tipCents: tip ?? 0, bonusCents: bonus ?? 0 };
}

export function platformForSender(fromHeader: string): string | null {
  const from = fromHeader.toLowerCase();
  for (const [sender, key] of Object.entries(RECEIPT_SENDERS)) {
    if (from.includes(sender)) return key;
  }
  return null;
}

/* ---------------- Gmail API calls ---------------- */

type GmailMessage = {
  id: string;
  internalDate?: string;
  payload?: {
    headers?: { name: string; value: string }[];
    body?: { data?: string };
    parts?: { mimeType: string; body?: { data?: string }; parts?: { mimeType: string; body?: { data?: string } }[] }[];
  };
};

async function gmailFetch(accessToken: string, path: string): Promise<Response> {
  const res = await fetch(`${API}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Gmail API ${res.status}`);
  return res;
}

type GmailPart = {
  mimeType?: string;
  body?: { data?: string };
  parts?: GmailPart[];
};

function decodeBody(msg: GmailMessage): string {
  const parts: string[] = [];
  const walk = (p?: GmailPart) => {
    if (!p) return;
    if (p.body?.data && (p.mimeType === "text/plain" || p.mimeType === "text/html")) parts.push(p.body.data);
    p.parts?.forEach(walk);
  };
  walk(msg.payload);
  return parts
    .map((d) => Buffer.from(d, "base64url").toString("utf8"))
    .join("\n");
}

/**
 * Pull driver-receipt emails newer than `sinceDays` and parse them into
 * earning-shaped rows. Dedupe upstream via importKey `gmail:<messageId>`.
 */
export async function syncReceipts(
  accessToken: string,
  { sinceDays = 90, max = 200 }: { sinceDays?: number; max?: number } = {},
): Promise<ParsedReceipt[]> {
  const q = `newer_than:${sinceDays}d (${Object.keys(RECEIPT_SENDERS).map((s) => `from:${s}`).join(" OR ")})`;
  const listRes = await gmailFetch(
    accessToken,
    `/messages?q=${encodeURIComponent(q)}&maxResults=${max}`,
  );
  const list = (await listRes.json()) as { messages?: { id: string }[] };
  const out: ParsedReceipt[] = [];

  for (const { id } of list.messages ?? []) {
    const msg = (await (await gmailFetch(accessToken, `/messages/${id}?format=full`)).json()) as GmailMessage;
    const headers = msg.payload?.headers ?? [];
    const from = headers.find((h) => h.name.toLowerCase() === "from")?.value ?? "";
    const subject = headers.find((h) => h.name.toLowerCase() === "subject")?.value ?? "";
    const platformKey = platformForSender(from);
    if (!platformKey) continue;
    const parsed = parseReceiptBody(`${subject} ${decodeBody(msg)}`);
    if (!parsed) continue;
    out.push({
      platformKey,
      ...parsed,
      earnedAt: msg.internalDate ? new Date(Number(msg.internalDate)) : new Date(),
      externalId: `gmail:${id}`,
    });
  }
  return out;
}
