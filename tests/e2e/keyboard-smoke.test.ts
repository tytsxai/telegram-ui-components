import { test, expect } from "@playwright/test";

test("keyboard smoke: skip onboarding, navigate inline keyboard, paste message", async ({ page }) => {
  await page.goto("http://localhost:5173/");

  const skipButton = page.getByRole("button", { name: /跳过引导/ });
  if (await skipButton.isVisible()) {
    await skipButton.press("Enter");
  }

  const firstKeyboardButton = page.getByRole("button", { name: /inline keyboard button 1/i }).first();
  await firstKeyboardButton.focus();
  await expect(firstKeyboardButton).toBeFocused();

  const secondKeyboardButton = page.getByRole("button", { name: /inline keyboard button 2/i }).first();
  await page.keyboard.press("ArrowRight");
  await expect(secondKeyboardButton).toBeFocused();
  await page.keyboard.press("ArrowLeft");
  await expect(firstKeyboardButton).toBeFocused();

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
    const nextTarget = page.getByRole("button", { name: /inline keyboard button/i }).first();
    await expect(nextTarget).toBeFocused();
  }
});
