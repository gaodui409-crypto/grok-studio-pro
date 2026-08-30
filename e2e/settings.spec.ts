import { test, expect, seedSettings, CONFIGURED } from "./fixtures";

// CONFIGURED.provider is "gitee", and it also seeds an xAI key — so both channels
// read as configured and the two can be told apart by which one holds 当前.
const CURRENT = "Gitee AI 模力方舟";
const OTHER = "xAI / NewAPI 中转";

function navRow(page: import("@playwright/test").Page, label: string) {
  return page.getByRole("button", {
    name: new RegExp(label.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")),
  });
}

/**
 * The channel whose config fills the main pane.
 *
 * Scoped to the 渠道配置 region rather than picked by position: the nav's own
 * group labels are level-2 headings too, so "the first h2" is the nav's 渠道.
 */
function openChannel(page: import("@playwright/test").Page) {
  return page.getByRole("region", { name: "渠道配置" }).getByRole("heading", { level: 2 });
}

/**
 * Opens the page and waits until the seeded channel's config is actually shown.
 *
 * `data-hydrated` is not enough: localStorage is read in an effect afterwards,
 * so there is a window where the pane still shows the default channel. Clicking
 * a channel in that window used to look like it worked and then get overwritten.
 *
 * The wait is an exact match on the pane's own heading, which is the direct
 * output of the landing effect these tests need to have run. Waiting on the nav
 * badge instead would be waiting on a different effect's state, and matching a
 * substring like 当前 would let some future unrelated label satisfy the wait and
 * quietly turn this barrier back into a race.
 */
async function openSettled(page: import("@playwright/test").Page, current: string) {
  await page.goto("/settings");
  await page.waitForFunction(() => document.documentElement.dataset.hydrated === "1");
  await expect(openChannel(page), `页面没有停在 ${current}，种子设置可能没生效`).toHaveText(
    current,
  );
}

test.describe("设置 · 渠道", () => {
  test("打开时停在正在使用的渠道，而不是列表第一个", async ({ page }) => {
    // Deliberately does not use openSettled: landing on the current channel is
    // what this test exists to check, and asserting it as a precondition would
    // leave a test that cannot fail.
    await seedSettings(page, CONFIGURED);
    await page.goto("/settings");
    await page.waitForFunction(() => document.documentElement.dataset.hydrated === "1");

    await expect(openChannel(page)).toHaveText(CURRENT);
    await expect(page.getByText("当前生成渠道")).toBeVisible();
  });

  test("浏览别的渠道不会改变当前生成渠道", async ({ page }) => {
    await seedSettings(page, CONFIGURED);
    await openSettled(page, CURRENT);

    await navRow(page, OTHER).click();
    await expect(page.getByRole("heading", { name: OTHER, level: 2 })).toBeVisible();

    // The badge stays on Gitee: only 切换为当前 moves it.
    await expect(navRow(page, CURRENT)).toContainText("当前");
    await expect(page.getByRole("button", { name: "切换为当前" })).toBeVisible();
    await expect(page.getByText("有未保存的修改")).toBeHidden();
  });

  test("切换为当前后徽标移动并标记未保存", async ({ page }) => {
    await seedSettings(page, CONFIGURED);
    await openSettled(page, CURRENT);

    await navRow(page, OTHER).click();
    await page.getByRole("button", { name: "切换为当前" }).click();

    await expect(navRow(page, OTHER)).toContainText("当前");
    await expect(navRow(page, CURRENT)).not.toContainText("当前");
    await expect(page.getByText("有未保存的修改")).toBeVisible();
  });

  test("未配置的渠道不能设为当前", async ({ page }) => {
    await seedSettings(page, CONFIGURED);
    await openSettled(page, CURRENT);

    await navRow(page, "PixAI 号池").click();
    await expect(page.getByRole("button", { name: "切换为当前" })).toBeDisabled();
    await expect(page.getByText("还需填写：")).toBeVisible();
  });

  test("状态点同时给出文字，不只靠颜色", async ({ page }) => {
    await page.goto("/settings");
    await page.waitForFunction(() => document.documentElement.dataset.hydrated === "1");

    // Empty profile: anonymous Horde is usable but capped, everything else unset.
    await expect(navRow(page, "AI Horde")).toContainText("可用但受限");
    await expect(navRow(page, "Pollinations")).toContainText("未配置");
  });
});

test.describe("设置 · 保存", () => {
  test("改动后出现未保存提示，还原后消失", async ({ page }) => {
    await seedSettings(page, CONFIGURED);
    await openSettled(page, CURRENT);

    await expect(page.getByText("有未保存的修改")).toBeHidden();

    await page.getByLabel("Gitee AI API Key", { exact: true }).fill("changed-key");
    await expect(page.getByText("有未保存的修改")).toBeVisible();

    await page.getByRole("button", { name: "还原未保存的修改" }).click();
    await expect(page.getByText("有未保存的修改")).toBeHidden();
  });

  test("保存后写入 localStorage", async ({ page }) => {
    await seedSettings(page, CONFIGURED);
    await openSettled(page, CURRENT);

    await page.getByLabel("Gitee AI API Key", { exact: true }).fill("saved-key");
    // exact: true — role-name matching is substring by default, and 保存 is also
    // inside 还原未保存的修改.
    await page.getByRole("button", { name: "保存", exact: true }).click();

    await expect(page.getByText("有未保存的修改")).toBeHidden();
    const stored = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("grok-studio-settings") ?? "{}"),
    );
    expect(stored.giteeApiKey).toBe("saved-key");
  });
});

test.describe("设置 · 通用", () => {
  test("跳转到通用默认值与角色预设", async ({ page }) => {
    await page.goto("/settings");
    await page.waitForFunction(() => document.documentElement.dataset.hydrated === "1");

    await page.getByRole("button", { name: "并发 / 默认值" }).click();
    await expect(page.getByRole("heading", { name: "通用默认值" })).toBeInViewport();

    await page.getByRole("button", { name: "角色预设" }).click();
    await expect(page.getByRole("heading", { name: "角色预设" })).toBeInViewport();

    await page.screenshot({ path: "e2e/__screens__/设置/角色预设.png", fullPage: false });
  });
});
