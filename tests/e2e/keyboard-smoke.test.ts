import { test, expect } from "@playwright/test";
import { seedAuthSession, setupSupabaseMock } from "../fixtures/supabaseMock";

test.beforeEach(async ({ page }) => {
  await seedAuthSession(page);
  await setupSupabaseMock(page);
});

test("keyboard smoke: skip onboarding, navigate inline keyboard, paste message", async ({ page }) => {
  await page.goto("/");

  const skipButton = page.getByRole("button", { name: /跳过引导/ });
  if (await skipButton.isVisible()) {
    await skipButton.press("Enter");
  }

  await expect(page.locator('[data-testid="inline-keyboard"]')).toBeVisible({ timeout: 10000 });

  const firstKeyboardButton = page.getByRole("button", { name: /Button 1/i }).first();
  const secondKeyboardButton = page.getByRole("button", { name: /Button 2/i }).first();

  await firstKeyboardButton.click({ timeout: 10000 });
  await secondKeyboardButton.click({ timeout: 10000 });

  // 粘贴文本到消息框
  const textbox = page.getByRole("textbox", { name: /message body/i });
  await textbox.focus();
  await textbox.evaluate((el) => {
    const data = new DataTransfer();
    data.setData("text/plain", "hello line1\nline2");
    const evt = new ClipboardEvent("paste", { bubbles: true, cancelable: true });
    Object.defineProperty(evt, "clipboardData", { value: data });
    el.dispatchEvent(evt);
  });

  const value = (await textbox.textContent()) || "";
  expect(value).toContain("hello line1");

  // 删除按钮后焦点应落到剩余按钮
  const deleteBtn = page.getByRole("button", { name: /delete button/i }).first();
  if (await deleteBtn.isVisible()) {
    await deleteBtn.click();
    const nextTarget = page.getByRole("button", { name: /Button/ }).first();
    await expect(nextTarget).toBeFocused();
  }
});
