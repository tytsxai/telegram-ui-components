import { test, expect } from "@playwright/test";
import { seedAuthSession, setupSupabaseMock, type SupabaseMockState } from "../fixtures/supabaseMock";

let supabaseState: SupabaseMockState;

test.beforeEach(async ({ page }) => {
  await seedAuthSession(page);
  const { state } = await setupSupabaseMock(page);
  supabaseState = state;
});

test("create -> edit -> save template flow", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /跳过引导/ }).click({ timeout: 6000 }).catch(() => {});
  await expect(page.locator('[data-testid="inline-keyboard"]')).toBeVisible({ timeout: 10000 });

  await page.getByPlaceholder("输入名称...").fill("E2E Flow Template");

  const editor = page.locator('[contenteditable="true"]').first();
  await editor.click();
  await editor.fill("Hello from E2E flow");

  const keyboardButton = page.locator(".bg-telegram-button").first();
  await keyboardButton.dblclick();
  const textInput = page.locator('input[type="text"]').first();
  await textInput.fill("E2E Button");
  await textInput.press("Enter");

  await page.getByRole("button", { name: "保存新模版" }).click();
  // default screen is pre-seeded, so after saving there should be 2
  await expect.poll(() => supabaseState.screens.length, { timeout: 10_000 }).toBe(2);

  await editor.click();
  await editor.fill("Updated content for E2E");
  await page.getByRole("button", { name: /保存修改/ }).click();

  await expect.poll(() => supabaseState.screens.find((s) => s.name === "E2E Flow Template")?.message_content ?? "").toContain("Updated content for E2E");
});
