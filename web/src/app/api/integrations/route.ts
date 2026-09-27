import { db } from "@/lib/db";
import { withAuth, ok } from "@/lib/api";
import { gmailConfigured } from "@/lib/integrations/gmail";

/**
 * GET /api/integrations — real data-source status for the UI.
 * Nothing here is simulated: a source is connected, needs setup, or off.
 */
export const GET = withAuth(async (_req, { user }) => {
  const gmail = await db.account.findFirst({
    where: { userId: user.id, provider: "gmail" },
    select: { providerAccountId: true, updatedAt: true },
  });
  return ok({
    sources: [
      {
        key: "csv",
        label: "Statement import",
        description: "Upload earnings/payment CSV exports from any platform.",
        status: "AVAILABLE",
      },
      {
        key: "gmail",
        label: "Gmail receipts",
        description:
          "Read trip receipts sent by Uber and Lyft to your inbox and turn them into earnings. Read-only OAuth access.",
        status: !gmailConfigured() ? "NEEDS_SETUP" : gmail ? "CONNECTED" : "AVAILABLE",
        email: gmail?.providerAccountId ?? null,
        configured: gmailConfigured(),
        connected: !!gmail,
      },
    ],
  });
});
