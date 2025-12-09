import { test, expect } from "@playwright/test";
import { setupSupabaseMock } from "../fixtures/supabaseMock";

test.beforeEach(async ({ page }) => {
  await setupSupabaseMock(page);
});

test("share page shows error for invalid token", async ({ page }) => {
  await page.goto("/share/invalid-token");

  await expect(page.getByText(/无法打开分享链接/)).toBeVisible();
  await expect(page.getByRole("button", { name: /返回首页/ })).toBeVisible();

  await page.getByRole("button", { name: /返回首页/ }).click();
  await expect(page).toHaveURL(/\/$/);
});
