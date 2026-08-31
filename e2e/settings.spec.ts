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
 * Scoped to the 渠道配置 region rather than picked by position. The region is
 * named for the open view, so this locator finds nothing at all when 通用默认值
 * or 角色预设 is showing — which is what makes the exclusivity test below able
 * to fail.
 */
function openChannel(page: import("@playwright/test").Page) {
  return page.getByRole("region", { name: "渠道配置" }).getByRole("heading", { level: 2 });
}

/**
 * By role, not by label.
 *
 * `getByLabel` matched the Radix root — an unfocusable span — so pressing a key on
 * it did nothing while still looking like a found element. The role query can only
 * match the thumb, which is the part that owns the keyboard behaviour.
 */
function concurrency(page: import("@playwright/test").Page) {
  return page.getByRole("slider", { name: "并发请求数" });
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

const QUOTA_KEY = "grok-studio-quota";

/** Writes a used-count for today straight into the quota ledger. */
async function seedQuota(page: import("@playwright/test").Page, provider: string, used: number) {
  await page.addInitScript(
    ([key, id, count]) => {
      const now = new Date();
      const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
        now.getDate(),
      ).padStart(2, "0")}`;
      window.localStorage.setItem(
        key as string,
        JSON.stringify({ [id as string]: { [today]: count } }),
      );
    },
    [QUOTA_KEY, provider, used] as const,
  );
}

test.describe("设置 · 今日额度", () => {
  test("显示本地已用与上限，并说明这是本地估算", async ({ page }) => {
    // Gitee's default cap is 100.
    await seedSettings(page, CONFIGURED);
    await seedQuota(page, "gitee", 42);
    await openSettled(page, CURRENT);

    // The figure and its cap live in one paragraph, so it is matched as a whole
    // rather than as two separate exact strings.
    await expect(page.getByText(/42\s*\/ 100/)).toBeVisible();
    // The bar carries the same fact for assistive tech, which is the part that
    // used to be missing entirely.
    await expect(page.getByRole("progressbar", { name: "今日额度已用 42%" })).toBeVisible();
    // The wording matters more than the number: a tally the user reads as the
    // vendor's own would be trusted until a batch dies half-finished.
    await expect(page.getByText(/不是渠道返回的余量/)).toBeVisible();
  });

  test("清零立即生效，不需要按保存", async ({ page }) => {
    await seedSettings(page, CONFIGURED);
    await seedQuota(page, "gitee", 42);
    await openSettled(page, CURRENT);

    await page.getByRole("button", { name: "清零" }).click();

    await expect(page.getByText(/0\s*\/ 100/)).toBeVisible();
    // The ledger is its own store, so this must not have dirtied the settings draft.
    await expect(page.getByText("有未保存的修改")).toBeHidden();
    const ledger = await page.evaluate(() => localStorage.getItem("grok-studio-quota"));
    expect(ledger).not.toContain('"gitee"');
  });

  test("接近上限时给出告警", async ({ page }) => {
    // 95 of 100 is inside the 20% warning band.
    await seedSettings(page, CONFIGURED);
    await seedQuota(page, "gitee", 95);
    await openSettled(page, CURRENT);

    await expect(page.getByText(/剩余约 5 张/)).toBeVisible();
  });

  test("上限改动要经过保存", async ({ page }) => {
    await seedSettings(page, CONFIGURED);
    await openSettled(page, CURRENT);

    await page.getByLabel("每日上限").fill("60");
    await expect(page.getByText("有未保存的修改")).toBeVisible();

    await page.getByRole("button", { name: "保存", exact: true }).click();
    const stored = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("grok-studio-settings") ?? "{}"),
    );
    expect(stored.dailyLimits.gitee).toBe(60);
  });

  test("清空上限视为不限，而不是存成 0", async ({ page }) => {
    // A stored 0 would read in the UI as a real ceiling of zero, and quota.ts
    // treats 0 as "no cap" — so the two would disagree.
    await seedSettings(page, CONFIGURED);
    await openSettled(page, CURRENT);

    await page.getByLabel("每日上限").fill("");
    await page.getByRole("button", { name: "保存", exact: true }).click();

    const stored = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("grok-studio-settings") ?? "{}"),
    );
    expect(stored.dailyLimits.gitee).toBeUndefined();
  });
});

test.describe("文生图 · 额度徽标", () => {
  test("有上限时显示今日剩余", async ({ page }) => {
    await seedSettings(page, CONFIGURED);
    await seedQuota(page, "gitee", 42);
    await page.goto("/");
    await page.waitForFunction(() => document.documentElement.dataset.hydrated === "1");

    // 剩余, not 已用: the question at this spot is whether the next batch fits.
    await expect(page.getByRole("link", { name: /今日剩余/ })).toContainText("58 / 100");
  });

  test("没有上限的渠道不显示徽标", async ({ page }) => {
    // AI Horde meters Kudos, not a daily count, so claiming a daily number would
    // invent a cap the vendor does not have.
    await seedSettings(page, { ...CONFIGURED, provider: "aihorde" });
    await page.goto("/");
    await page.waitForFunction(() => document.documentElement.dataset.hydrated === "1");

    await expect(page.getByRole("link", { name: /今日剩余/ })).toHaveCount(0);
  });
});

test.describe("设置 · 全局", () => {
  // 通用默认值 and 角色预设 are global, but they used to be sections stacked under
  // whichever channel was open, which read as if they belonged to it. They are
  // now exclusive views: opening one has to *replace* the channel pane, not
  // scroll to a heading that was on screen all along.
  test("通用默认值是独立视图，不再挂在渠道下面", async ({ page }) => {
    await seedSettings(page, CONFIGURED);
    await openSettled(page, CURRENT);

    await navRow(page, "通用默认值").click();

    await expect(page.getByRole("heading", { name: "通用默认值", level: 2 })).toBeVisible();
    // The channel pane is gone, not merely scrolled past.
    await expect(openChannel(page)).toHaveCount(0);
    await expect(page.getByLabel("Gitee AI API Key", { exact: true })).toHaveCount(0);
    await expect(concurrency(page)).toBeVisible();

    await page.screenshot({ path: "e2e/__screens__/设置/通用默认值.png", fullPage: false });
  });

  test("角色预设是独立视图，回到渠道后凭证仍在", async ({ page }) => {
    await seedSettings(page, CONFIGURED);
    await openSettled(page, CURRENT);

    await navRow(page, "角色预设").click();
    await expect(page.getByRole("heading", { name: "角色预设", level: 2 })).toBeVisible();
    await expect(openChannel(page)).toHaveCount(0);

    await navRow(page, CURRENT).click();
    await expect(openChannel(page)).toHaveText(CURRENT);
    await expect(page.getByLabel("Gitee AI API Key", { exact: true })).toBeVisible();
  });

  test("在全局视图里改并发，未保存提示照样出现", async ({ page }) => {
    await seedSettings(page, CONFIGURED);
    await openSettled(page, CURRENT);

    await navRow(page, "通用默认值").click();
    await expect(page.getByText("有未保存的修改")).toBeHidden();

    // The header's 保存 covers every view that writes to the settings draft, so
    // the dirty flag has to track edits made here too.
    const before = await concurrency(page).getAttribute("aria-valuenow");
    await concurrency(page).press("ArrowRight");
    // Assert the key actually moved the slider before reading the dirty flag,
    // otherwise a control that silently swallows the keypress looks like a
    // missing-dirty-flag bug instead of what it is.
    await expect(concurrency(page)).not.toHaveAttribute("aria-valuenow", before ?? "");
    await expect(page.getByText("有未保存的修改")).toBeVisible();
  });
});
