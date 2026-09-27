import { test, expect, type Page, type BrowserContext } from "@playwright/test";

/**
 * Full-journey e2e suite. Each worker registers one user, completes
 * onboarding, captures the session cookie, and reuses it for the
 * authenticated tests so we stay well under auth rate limits.
 *
 * Serial mode: a failure early in the journey skips dependent tests.
 */

const PASSWORD = "E2ePass1234";
const creds = { email: "", name: "E2E Driver" };
let sessionCookie: { name: string; value: string; url: string } | null = null;

async function register(page: Page) {
  creds.email = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.dev`;
  await page.goto("/register");
  await page.getByLabel("Name").fill(creds.name);
  await page.getByLabel("Email").fill(creds.email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/onboarding/);
}

async function signIn(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(creds.email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

async function restoreSession(context: BrowserContext) {
  if (!sessionCookie) throw new Error("No captured session — register test must run first");
  await context.clearCookies();
  await context.addCookies([sessionCookie]);
}

test.describe("public pages", () => {
  test("landing page renders hero + CTAs", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("gig work");
    await expect(page.getByRole("link", { name: "Get Started" }).first()).toBeVisible();
  });

  test("unauthenticated users are redirected from app pages", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe("journey", () => {
  test.describe.configure({ mode: "serial" });

  test("register → onboarding → dashboard", async ({ page, context }) => {
    await register(page);
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByRole("button", { name: "Finish setup" }).click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 30000 });
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();

    const cookie = (await context.cookies()).find((c) => c.name === "gigflow_session");
    if (!cookie) throw new Error("session cookie missing after onboarding");
    sessionCookie = { name: cookie.name, value: cookie.value, url: "http://localhost:3100" };
  });

  test("login works after registration", async ({ page, context }) => {
    await context.clearCookies();
    await signIn(page);
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  });

  test("bad password is rejected", async ({ page, context }) => {
    await context.clearCookies();
    await page.goto("/login");
    await page.getByLabel("Email").fill(creds.email);
    await page.getByLabel("Password").fill("WrongPass1");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Invalid email or password" })).toBeVisible();
  });

  test.describe("authenticated flows", () => {
    test.describe.configure({ mode: "serial" });
    test.beforeEach(async ({ context }) => restoreSession(context));

    test("add a vehicle", async ({ page }) => {
      await page.goto("/settings/vehicles");
      await page.getByRole("button", { name: "Add", exact: true }).click();
      await page.getByLabel("Nickname").fill("E2E Camry");
      await page.getByLabel("Make").fill("Toyota");
      await page.getByLabel("Model").fill("Camry");
      await page.getByLabel("Year").fill("2021");
      await page.getByRole("button", { name: "Add vehicle" }).click();
      await expect(page.getByText("E2E Camry")).toBeVisible({ timeout: 10000 });
      await expect(page.getByText("default")).toBeVisible();
    });

    test("add a platform for manual tracking", async ({ page }) => {
      await page.goto("/platforms");
      const trackButtons = page.getByRole("button", { name: "Track manually" });
      await expect(trackButtons.first()).toBeVisible();
      const before = await trackButtons.count();
      await Promise.all([
        page.waitForResponse((r) => r.url().includes("/api/platforms/connections") && r.request().method() === "POST"),
        trackButtons.first().click(),
      ]);
      // The added platform leaves the "add more" list and joins "Your platforms".
      await expect(trackButtons).toHaveCount(before - 1, { timeout: 15000 });
      await expect(page.getByRole("heading", { name: "Your platforms" })).toBeVisible();
      await expect(page.getByText("Manual tracking").first()).toBeVisible();
    });

    test("add an earning", async ({ page }) => {
      await page.goto("/earnings");
      await page.getByRole("button", { name: "Add earning" }).first().click();
      await page.getByLabel("Base amount").fill("18.50");
      await page.getByLabel("Tip", { exact: true }).fill("3.25");
      await page.getByRole("button", { name: "Save earning" }).click();
      await expect(page.getByText("$21.75").first()).toBeVisible({ timeout: 10000 });
    });

    test("add an expense", async ({ page }) => {
      await page.goto("/expenses");
      await page.getByRole("button", { name: "Add expense" }).first().click();
      await page.getByLabel("Amount").fill("42.50");
      await page.getByLabel("Description").fill("E2E fuel");
      await page.getByRole("button", { name: "Save expense" }).click();
      await expect(page.getByText("E2E fuel")).toBeVisible({ timeout: 10000 });
    });

    test("log mileage", async ({ page }) => {
      await page.goto("/mileage");
      await page.getByRole("button", { name: "Log mileage" }).first().click();
      await page.getByLabel(/Distance/).fill("34.2");
      await page.getByRole("button", { name: "Save mileage" }).click();
      await expect(page.getByText(/34\.2/).first()).toBeVisible({ timeout: 10000 });
    });

    test("analytics computes metrics", async ({ page }) => {
      await page.goto("/analytics");
      await expect(page.getByRole("heading", { name: "Analytics" })).toBeVisible();
      await expect(page.getByText("Gross", { exact: true })).toBeVisible();
      await expect(page.getByText(/per hour/i).first()).toBeVisible();
    });

    test("create a rule and evaluate an offer", async ({ page }) => {
      await page.goto("/rules");
      await page.getByRole("button", { name: "New rule" }).first().click();
      await page.getByLabel("Rule name").fill("E2E good offer");
      await page.getByRole("button", { name: "Save rule" }).click();
      await expect(page.getByText("E2E good offer")).toBeVisible({ timeout: 10000 });

      await page.getByRole("button", { name: "Test rules" }).click();
      await page.getByLabel("Payout").fill("28");
      await page.getByLabel(/Distance/).fill("8");
      await page.getByLabel("Duration (min)").fill("45");
      await page.getByRole("button", { name: "Evaluate" }).click();
      await expect(page.getByText(/Matches:|No rules matched/)).toBeVisible({ timeout: 10000 });
    });

    test("edit profile settings", async ({ page }) => {
      await page.goto("/settings/profile");
      await page.getByLabel("Name").fill("E2E Driver Renamed");
      await Promise.all([
        page.waitForResponse((r) => r.url().includes("/api/account") && r.request().method() === "PATCH"),
        page.getByRole("button", { name: "Save profile" }).click(),
      ]);
      await page.reload();
      await expect(page.getByLabel("Name")).toHaveValue("E2E Driver Renamed");
    });

    test("export downloads JSON", async ({ page }) => {
      await page.goto("/settings/data");
      const [download] = await Promise.all([
        page.waitForEvent("download"),
        page.getByRole("button", { name: "Download JSON export" }).click(),
      ]);
      expect(download.suggestedFilename()).toMatch(/gigflow-export-.*\.json/);
    });

    test("delete account", async ({ page }) => {
      page.on("dialog", (d) => void d.accept());
      await page.goto("/settings/data");
      await page.getByLabel("Confirm with your password").fill(PASSWORD);
      await page.getByRole("button", { name: "Delete account" }).click();
      await expect(page).toHaveURL(/\/$/, { timeout: 15000 });
      // Session is dead — dashboard should bounce to login.
      await page.goto("/dashboard");
      await expect(page).toHaveURL(/\/login/);
    });
  });
});
