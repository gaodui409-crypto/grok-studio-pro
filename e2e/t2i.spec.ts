import type { Page } from "@playwright/test";
import { test, expect, seedSettings, CONFIGURED } from "./fixtures";

// None of these press 生成图片: CONFIGURED holds fake keys, so a real request
// would fail on the network and the assertion would be about the error toast
// rather than about the control under test.

test.describe("文生图 · 数量", () => {
  const readout = (page: Page) => page.getByRole("status", { name: "生成数量" });

  test("加减按钮改变数量", async ({ page }) => {
    await seedSettings(page, CONFIGURED);
    await page.goto("/");
    await page.waitForFunction(() => document.documentElement.dataset.hydrated === "1");

    await expect(readout(page)).toHaveText("1");
    await page.getByRole("button", { name: "增加一张" }).click();
    await page.getByRole("button", { name: "增加一张" }).click();
    await expect(readout(page)).toHaveText("3");
    await page.getByRole("button", { name: "减少一张" }).click();
    await expect(readout(page)).toHaveText("2");
  });

  /**
   * The control this replaced was a number input that clamped on every keystroke,
   * so typing "12" became 10 the moment the "1" landed and the "2" then replaced a
   * value the user never chose. A stepper cannot express that bug, but it can
   * still walk out of range if the bound is only applied to one direction, so both
   * ends are pinned here.
   */
  test("数量停在 1 和 10 之间", async ({ page }) => {
    await seedSettings(page, CONFIGURED);
    await page.goto("/");
    await page.waitForFunction(() => document.documentElement.dataset.hydrated === "1");

    const minus = page.getByRole("button", { name: "减少一张" });
    const plus = page.getByRole("button", { name: "增加一张" });

    // Starts at the floor, so the decrement is unavailable rather than silently ignored.
    await expect(minus).toBeDisabled();

    for (let i = 0; i < 12; i++) await plus.click({ force: true });
    await expect(readout(page)).toHaveText("10");
    await expect(plus).toBeDisabled();
  });
});

test.describe("文生图 · 空态", () => {
  test("没生成过时说明下一步", async ({ page }) => {
    await seedSettings(page, CONFIGURED);
    await page.goto("/");
    await page.waitForFunction(() => document.documentElement.dataset.hydrated === "1");

    await expect(page.getByRole("heading", { name: "还没有生成过任何图片" })).toBeVisible();
  });

  /**
   * Missing credentials are reported once, by ApiKeyBanner at the top of the page.
   * The empty state below deliberately stays quiet about setup — an earlier
   * version had its own "go configure a channel" button, which was both dead
   * (AI Horde needs no key, so no one ever has zero ready channels) and vaguer
   * than the banner, which names the exact credential the selected channel wants.
   */
  test("缺凭据只由顶部横幅提示一次", async ({ page }) => {
    await page.goto("/");
    await page.waitForFunction(() => document.documentElement.dataset.hydrated === "1");

    // Default channel is xAI, which has no key in a fresh browser.
    await expect(page.getByText(/尚未配置.*API Key/)).toBeVisible();
    await expect(page.getByRole("heading", { name: "还没有生成过任何图片" })).toBeVisible();
    await expect(page.getByRole("link", { name: /配置渠道/ })).toHaveCount(0);
  });

  test("示例词填入输入框而不直接生成", async ({ page }) => {
    await seedSettings(page, CONFIGURED);
    await page.goto("/");
    await page.waitForFunction(() => document.documentElement.dataset.hydrated === "1");

    const box = page.getByLabel("提示词");
    await expect(box).toHaveValue("");

    const example = page.getByRole("button", { name: "赛博朋克少女，霓虹夜景" });
    await example.click();

    await expect(box).toHaveValue("赛博朋克少女，霓虹夜景");
    // Filling the box is the whole effect: the examples must not spend a free
    // channel's daily quota on a single click.
    await expect(page.getByRole("status", { name: /正在生成/ })).toHaveCount(0);
  });
});

test.describe("文生图 · 提示词", () => {
  test("字数随输入更新", async ({ page }) => {
    await seedSettings(page, CONFIGURED);
    await page.goto("/");
    await page.waitForFunction(() => document.documentElement.dataset.hydrated === "1");

    const box = page.getByLabel("提示词");
    await box.fill("霓虹雨夜");

    // The counter is aria-hidden (the textarea's own maxLength is what assistive
    // tech reads), so it is matched as text rather than by role.
    await expect(page.getByText("4 / 2000")).toBeVisible();
  });
});

test.describe("文生图 · 分辨率上限", () => {
  /**
   * The ceiling has to be visible in the list, not just enforced at request time.
   *
   * aspectToWH() has always clamped the long edge, so picking 2k on a 1024px model
   * produced a 1024px image and said nothing — indistinguishable from the model
   * ignoring the setting. Asserting on aria-disabled rather than on a class keeps
   * this about what a screen reader is told, which is the part that was missing.
   */
  test("超出当前模型上限的档位不可选，并说明上限", async ({ page }) => {
    // SDXL on Gitee caps at 1024, so 1.5k and 2k are unreachable.
    await seedSettings(page, { ...CONFIGURED, giteeModel: "stable-diffusion-xl-base-1.0" });
    await page.goto("/");
    await page.waitForFunction(() => document.documentElement.dataset.hydrated === "1");

    await expect(page.getByText("当前模型最高支持 1024px")).toBeVisible();

    await page.getByLabel("分辨率").click();
    const options = page.getByRole("option");
    // Radix omits aria-disabled on enabled items rather than setting it false, so
    // the enabled case asserts absence.
    await expect(options.filter({ hasText: "768" })).not.toHaveAttribute("aria-disabled", "true");
    await expect(options.filter({ hasText: "1.5k" })).toHaveAttribute("aria-disabled", "true");
    await expect(options.filter({ hasText: "2k" })).toHaveAttribute("aria-disabled", "true");
  });

  test("换到上限更低的模型时，已选档位退到最高可用档而不是默认档", async ({ page }) => {
    // 2k saved, then Z-Image-Turbo (1664) selected: the honest step-down is 1.5k.
    await seedSettings(page, {
      ...CONFIGURED,
      provider: "modelscope",
      modelscopeModel: "Tongyi-MAI/Z-Image-Turbo",
      defaultResolution: "2k",
    });
    await page.goto("/");
    await page.waitForFunction(() => document.documentElement.dataset.hydrated === "1");

    await expect(page.getByLabel("分辨率")).toContainText("1.5k");
  });

  test("渠道自己就只吃两档时，小档位保留但注明会按什么出图", async ({ page }) => {
    // xAI takes a tier name and knows only 1k/2k, so 512 rounds *up*. Rounding up
    // costs nothing the user asked for, so it stays selectable — unlike a ceiling.
    await seedSettings(page, { ...CONFIGURED, provider: "xai" });
    await page.goto("/");
    await page.waitForFunction(() => document.documentElement.dataset.hydrated === "1");

    await page.getByLabel("分辨率").click();
    const small = page.getByRole("option").filter({ hasText: "512" });
    await expect(small).not.toHaveAttribute("aria-disabled", "true");
    await expect(small).toContainText("1024");
  });
});
