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
