import type { Page } from "@playwright/test";
import { test, expect, seedSettings, trapConsole, CONFIGURED } from "./fixtures";

// Nothing here presses 开始生成: CONFIGURED holds fake keys, so a real batch would
// fail on the network and every assertion would end up being about error toasts.

const hydrated = (page: Page) =>
  page.waitForFunction(() => document.documentElement.dataset.hydrated === "1");

const costFigure = (page: Page) => page.getByRole("region", { name: "预估消耗" });

/**
 * Opens 战斗场景 and ticks the named outfits and actions from the default tree.
 *
 * exact: true throughout — the rename and delete buttons carry the scene name in
 * their aria-label, so a substring match hits three buttons per scene.
 *
 * The first click retries until the panel reports itself open. Route components are
 * lazy chunks, so `data-hydrated` on <html> only means the shell is live: under
 * parallel load this click can land on server-rendered markup that has no handler
 * attached yet, and a swallowed click looks exactly like a broken accordion.
 */
async function pick(page: Page, outfits: string[], actions: string[]) {
  const trigger = page.getByRole("button", { name: "战斗场景", exact: true });
  await expect(async () => {
    await trigger.click();
    await expect(trigger).toHaveAttribute("aria-expanded", "true");
  }).toPass({ timeout: 15_000 });

  // Each chip is asserted rather than fired and forgotten: a click that does not
  // toggle would otherwise surface later as an off-by-one in the count, which is a
  // much harder failure to read.
  for (const name of [...outfits, ...actions]) {
    const chip = page.getByRole("button", { name, exact: true });
    await chip.click();
    await expect(chip).toHaveAttribute("aria-pressed", "true");
  }
}

test.describe("同人图批量 · 预估消耗", () => {
  /**
   * The count is the whole point of the panel: it is the number of billed requests
   * one click is about to make, and it is a product rather than a sum, so it grows
   * faster than it looks like it should. 2 outfits × 3 actions is 6 images, not 5.
   */
  test("数量是服装 × 动作的组合数", async ({ page }) => {
    await seedSettings(page, CONFIGURED);
    await page.goto("/fanart");
    await hydrated(page);

    await expect(costFigure(page)).toContainText("0 张");

    await pick(page, ["铠甲", "战斗服"], ["举剑挥砍", "格挡防御", "空中跳斩"]);
    await expect(costFigure(page)).toContainText("6 张");
    await expect(page.getByRole("button", { name: /开始生成 · 6 张/ })).toBeEnabled();
  });

  /**
   * Regression test for a fabricated price. The estimate used to be
   * `count * 0.07` — xAI's Image Pro rate — applied to whichever channel was
   * selected, so a 24-image batch on Gitee's free daily allowance was labelled
   * "$1.68". CONFIGURED selects gitee, which cannot bill anything.
   */
  test("免费渠道不报出美元金额", async ({ page }) => {
    await seedSettings(page, CONFIGURED);
    await page.goto("/fanart");
    await hydrated(page);

    await pick(page, ["铠甲"], ["举剑挥砍"]);

    const panel = costFigure(page);
    await expect(panel).toContainText("免费");
    await expect(panel).not.toContainText("$");
  });

  test("付费渠道按张报价", async ({ page }) => {
    await seedSettings(page, { ...CONFIGURED, provider: "xai" });
    await page.goto("/fanart");
    await hydrated(page);

    await pick(page, ["铠甲", "战斗服"], ["举剑挥砍"]);
    // 2 images at the Pro rate of $0.07.
    await expect(costFigure(page)).toContainText("$0.14");
  });
});

test.describe("同人图批量 · 场景树", () => {
  test("提示词预览逐条列出组合", async ({ page }) => {
    await seedSettings(page, CONFIGURED);
    await page.goto("/fanart");
    await hydrated(page);

    // pick() first: it retries until the route is interactive, so the fill that
    // follows cannot be swallowed by a not-yet-hydrated textarea. Order is
    // otherwise irrelevant — the preview rebuilds from both.
    await pick(page, ["铠甲"], ["举剑挥砍", "格挡防御"]);
    await page.getByLabel("角色描述").fill("白发红眼少女");

    const items = page.getByRole("listitem").filter({ hasText: "白发红眼少女" });
    await expect(items).toHaveCount(2);
    await expect(items.first()).toContainText("穿铠甲");
    await expect(items.first()).toContainText("战斗场景");
  });

  /**
   * The tree is saved to localStorage, and it used to be read back with
   * `useState(loadSceneTree)` — during the first render, which the server also
   * performs without any localStorage. So the server rendered the default scenes
   * while the browser rendered the saved ones, and React threw a hydration error
   * on every visit for anyone who had ever added a scene. Editing the tree is the
   * normal case for this page, so this reproduces with one added scene.
   */
  test("编辑过场景树后重新进入不报错", async ({ page }) => {
    await seedSettings(page, CONFIGURED);
    await page.goto("/fanart");
    await hydrated(page);

    // Retried as a unit for the same reason as pick(): before the lazy route chunk
    // hydrates, the fill lands in the DOM and the click goes nowhere.
    await expect(async () => {
      await page.getByLabel("新场景名称").fill("温泉");
      await page.getByRole("button", { name: "新建场景" }).click();
      await expect(page.getByRole("button", { name: "温泉", exact: true })).toBeVisible({
        timeout: 2_000,
      });
    }).toPass({ timeout: 15_000 });

    const trap = trapConsole(page);
    await page.reload();
    await hydrated(page);

    await expect(page.getByRole("button", { name: "温泉", exact: true })).toBeVisible();
    expect(trap.errors, `控制台错误:\n${trap.errors.join("\n")}`).toEqual([]);
  });
});

// 1×1 PNG, same stand-in the comic spec uses.
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==",
  "base64",
);

test.describe("同人图批量 · 重试", () => {
  // These two actually run a batch, wait for it to settle, then run a retry — three
  // request round-trips plus two lazy route loads, against a dev server shared by
  // four workers. The suite's 30s default is sized for assertion-only tests and
  // this pair times out under parallel load without ever being wrong.
  test.slow();

  /**
   * A retry must re-run only what failed.
   *
   * Re-submitting the batch was the only way to recover a failure, which re-pays
   * for every image that already worked — on a 24-image batch that is 21 wasted
   * requests to recover 3. So the count of requests is what this asserts, not just
   * that the row turned green.
   */
  test("单项重试只重跑那一项", async ({ page }) => {
    let attempts = 0;
    await page.route("**/v1/images/generations", async (route) => {
      attempts += 1;
      // First request fails, everything after succeeds: gives one failed row to
      // retry while its sibling finishes normally.
      if (attempts === 1) {
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ error: { message: "渠道临时故障" } }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: [{ b64_json: PNG.toString("base64") }] }),
      });
    });

    await seedSettings(page, { ...CONFIGURED, provider: "xai", concurrency: 1 });
    await page.goto("/fanart");
    await hydrated(page);

    await pick(page, ["铠甲"], ["举剑挥砍", "格挡防御"]);
    await page.getByLabel("角色描述").fill("白发红眼少女");
    await page.getByRole("button", { name: /开始生成 · 2 张/ }).click();

    await expect(page.getByRole("heading", { name: "1 张未生成" })).toBeVisible({
      timeout: 20_000,
    });
    expect(attempts).toBe(2);

    await page.getByRole("button", { name: /^重试 / }).click();

    // The failure block disappears once nothing is failed, and only one extra
    // request was made — the image that already succeeded was not re-paid for.
    await expect(page.getByRole("heading", { name: /张未生成/ })).toHaveCount(0, {
      timeout: 20_000,
    });
    expect(attempts).toBe(3);
  });

  test("重试全部失败项后仍失败的项留在列表里", async ({ page }) => {
    await page.route("**/v1/images/generations", async (route) => {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: { message: "渠道临时故障" } }),
      });
    });

    await seedSettings(page, { ...CONFIGURED, provider: "xai", concurrency: 1 });
    await page.goto("/fanart");
    await hydrated(page);

    await pick(page, ["铠甲"], ["举剑挥砍", "格挡防御"]);
    await page.getByLabel("角色描述").fill("白发红眼少女");
    await page.getByRole("button", { name: /开始生成 · 2 张/ }).click();

    await expect(page.getByRole("heading", { name: "2 张未生成" })).toBeVisible({
      timeout: 20_000,
    });

    await page.getByRole("button", { name: /重试全部失败项 \(2\)/ }).click();

    // Still two failures, and the block did not silently clear itself — a retry
    // that fails has to look different from one that worked.
    await expect(page.getByRole("heading", { name: "2 张未生成" })).toBeVisible({
      timeout: 20_000,
    });
  });
});
