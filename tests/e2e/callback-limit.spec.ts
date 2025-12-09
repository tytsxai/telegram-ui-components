import { test, expect } from "@playwright/test";
import { setupSupabaseMock, seedAuthSession, mockUser } from "../fixtures/supabaseMock";

test.beforeEach(async ({ page }) => {
  await seedAuthSession(page);
  await setupSupabaseMock(page);
});

test("callback data longer than 64B is blocked", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /跳过引导/ }).click({ timeout: 4000 }).catch(() => {});
  // If redirected to login for any reason, log in quickly
  const loginHeading = page.getByRole("heading", { name: /log in/i });
  if (await loginHeading.isVisible({ timeout: 2000 }).catch(() => false)) {
    await page.getByPlaceholder(/email/i).fill(mockUser.email);
    await page.getByPlaceholder(/password/i).fill("password123");
    await page.getByRole("button", { name: /log in/i }).click();
    await page.waitForURL("**/", { waitUntil: "domcontentloaded", timeout: 10000 });
    await page.getByRole("button", { name: /跳过引导/ }).click({ timeout: 4000 }).catch(() => {});
  }

  await expect(page.locator('[data-testid="inline-keyboard"]')).toBeVisible({ timeout: 10000 });

  // Open the button edit dialog for the first inline keyboard button (hover to reveal gear, then click gear)
  const firstButtonWrapper = page.locator('[data-testid="inline-keyboard"] .group').first();
  await firstButtonWrapper.scrollIntoViewIfNeeded();
  await firstButtonWrapper.hover();
  const editTrigger = firstButtonWrapper.getByRole("button", { name: /Edit button/i }).first();
  await editTrigger.click({ timeout: 10000, force: true });

  // Ensure dialog is present
  const dialog = page.getByRole("dialog");
  await dialog.waitFor({ state: "visible", timeout: 20000 });

  // Ensure the callback tab/input is visible before typing
  const callbackTab = page.getByRole("tab", { name: /callback/i });
  if (await callbackTab.isVisible().catch(() => false)) {
    await callbackTab.click();
    await page.waitForTimeout(200);
  }

  // Prefer role+name inside dialog; fall back to placeholder/name contains callback, then first visible input
  let callbackInput = dialog.getByRole("textbox", { name: /callback/i }).first();
  try {
    await callbackInput.waitFor({ state: "visible", timeout: 15000 });
  } catch {
    callbackInput = dialog.locator('input[placeholder*="callback" i], input[name*="callback" i], input[type="text"]:visible').first();
    await callbackInput.waitFor({ state: "visible", timeout: 15000 });
  }

  // Focus callback tab and input long text
  await callbackInput.fill("x".repeat(200));
  await page.getByRole("button", { name: "保存" }).click();

  const warning = page.getByText(/超过 64B/);
  const sawWarning = await warning.isVisible({ timeout: 2000 }).catch(() => false);
  if (!sawWarning) {
    // Retry once: ensure callback tab active and save again
    const callbackTab = page.getByRole("tab", { name: /callback/i });
    if (await callbackTab.isVisible().catch(() => false)) {
      await callbackTab.click();
    }
    await page.getByRole("button", { name: "保存" }).click();
  }

  await expect(warning).toBeVisible({ timeout: 3000 });
});
