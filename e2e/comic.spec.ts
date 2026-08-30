import type { Page } from "@playwright/test";
import { test, expect, seedSettings, trapConsole, CONFIGURED } from "./fixtures";

// Nothing here presses 开始批量上色 / 开始批量翻译: CONFIGURED holds fake keys, so a
// real batch would fail on the network and every assertion would end up being
// about error toasts instead of the queue.

const hydrated = (page: Page) =>
  page.waitForFunction(() => document.documentElement.dataset.hydrated === "1");

// 1×1 PNG. The queue only counts and orders pages, so a real bitmap buys nothing.
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==",
  "base64",
);

/**
 * Uploads pages through the drop zone's own file chooser.
 *
 * Deliberately not `setInputFiles` on the hidden input: going through the button
 * proves the drop zone is reachable as a button at all. It used to be a
 * `<div onClick>` — no role, no accessible name, no tab stop — so this route is
 * also the regression test for that fix.
 */
async function upload(page: Page, names: string[]) {
  const zone = page.getByRole("button", { name: /点击或拖拽上传漫画页/ });
  await expect(async () => {
    const chooser = page.waitForEvent("filechooser", { timeout: 4000 });
    await zone.click();
    const files = await chooser;
    await files.setFiles(names.map((name) => ({ name, mimeType: "image/png", buffer: PNG })));
    await expect(page.getByRole("region", { name: "批处理队列" })).toBeVisible();
    // Route components are lazy chunks, so `data-hydrated` on <html> only means the
    // shell is live: under parallel load the first click can land on server markup
    // with no handler attached, and a swallowed click looks like a broken uploader.
  }).toPass({ timeout: 20_000 });
}

const queueRows = (page: Page) =>
  page.getByRole("region", { name: "批处理队列" }).getByRole("listitem");

/**
 * The visible tab's panel.
 *
 * Both panels stay mounted so a tab switch cannot abort a running batch, so text
 * that appears on either one ("暂无任务") needs scoping. Role queries already skip
 * the hidden panel — `display: none` keeps it out of the accessibility tree — which
 * is why the locators above need no such help.
 */
const activePanel = (page: Page) => page.getByRole("tabpanel");

test.describe("漫画工具 · 批处理队列", () => {
  test.beforeEach(async ({ page }) => {
    await seedSettings(page, CONFIGURED);
  });

  test("上传后队列逐页列出，按钮标注将要发出的请求数", async ({ page }) => {
    const trap = trapConsole(page);
    await page.goto("/comic");
    await hydrated(page);

    // Before anything is uploaded the queue says so instead of showing an empty box.
    await expect(activePanel(page).getByText("暂无任务")).toBeVisible();
    await expect(
      activePanel(page).getByText("上传漫画页并选择上色风格，即可开始批量上色。"),
    ).toBeVisible();

    await upload(page, ["page-01.png", "page-02.png", "page-03.png"]);

    await expect(queueRows(page)).toHaveCount(3);
    await expect(page.getByText("漫画页").first()).toBeVisible();
    await expect(page.getByText("3/30")).toBeVisible();

    // The count is the point of the button: 3 张 and 27 张 are different decisions,
    // and the old button said neither.
    await expect(page.getByRole("button", { name: "开始批量上色（3 张）" })).toBeEnabled();

    // Every row starts as 等待中 with no result yet.
    await expect(page.getByText("等待中")).toHaveCount(3);
    await expect(page.getByText("0 完成 · 0 进行中 · 0 失败 · 3 等待")).toBeVisible();

    expect(trap.errors).toEqual([]);
  });

  test("没有页面时开始按钮不可点，避免一次空请求", async ({ page }) => {
    await page.goto("/comic");
    await hydrated(page);
    await expect(page.getByRole("button", { name: "开始批量上色（0 张）" })).toBeDisabled();
  });

  test("可以调整页序和删除某一页，缩略图标号跟着变", async ({ page }) => {
    await page.goto("/comic");
    await hydrated(page);
    await upload(page, ["a.png", "b.png", "c.png"]);

    const rows = queueRows(page);
    await expect(rows.nth(0)).toContainText("a.png");
    await expect(rows.nth(1)).toContainText("b.png");

    // 后移 the first page: reading order is part of the output, so it has to be
    // editable after upload without re-picking every file.
    await page.getByRole("button", { name: "把第 1 页后移" }).click();
    await expect(rows.nth(0)).toContainText("b.png");
    await expect(rows.nth(1)).toContainText("a.png");
    await expect(rows.nth(0)).toContainText("第 1 页");

    await page.getByRole("button", { name: "移除第 3 页" }).click();
    await expect(rows).toHaveCount(2);
    await expect(page.getByText("2/30")).toBeVisible();
    await expect(page.getByRole("button", { name: "开始批量上色（2 张）" })).toBeVisible();
  });

  test("清空后回到空状态", async ({ page }) => {
    await page.goto("/comic");
    await hydrated(page);
    await upload(page, ["a.png", "b.png"]);
    await page.getByRole("button", { name: "清空" }).click();
    await expect(activePanel(page).getByText("暂无任务")).toBeVisible();
    await expect(page.getByRole("button", { name: "开始批量上色（0 张）" })).toBeDisabled();
  });

  test("上色风格是一排 chip，选中状态可读", async ({ page }) => {
    await page.goto("/comic");
    await hydrated(page);

    // Chips rather than a <Select>: six options fit on screen, and a dropdown was
    // hiding five of them behind a click.
    const jp = page.getByRole("button", { name: "日系动漫上色" });
    const hk = page.getByRole("button", { name: "90 年代港漫复古色" });
    await expect(jp).toHaveAttribute("aria-pressed", "true");
    await expect(hk).toHaveAttribute("aria-pressed", "false");

    await expect(async () => {
      await hk.click();
      await expect(hk).toHaveAttribute("aria-pressed", "true");
    }).toPass({ timeout: 15_000 });
    await expect(jp).toHaveAttribute("aria-pressed", "false");

    // 自定义 reveals its own field, and only then.
    await expect(page.getByLabel("自定义上色风格")).toHaveCount(0);
    await page.getByRole("button", { name: "自定义风格" }).click();
    await expect(page.getByLabel("自定义上色风格")).toBeVisible();
  });

  test("翻译页可以交换两端语言", async ({ page }) => {
    const trap = trapConsole(page);
    await page.goto("/comic");
    await hydrated(page);

    await expect(async () => {
      await page.getByRole("tab", { name: "漫画翻译" }).click();
      await expect(page.getByRole("button", { name: "交换源语言和目标语言" })).toBeVisible();
    }).toPass({ timeout: 15_000 });

    await expect(page.getByText("日语 → 简体中文")).toBeVisible();
    await page.getByRole("button", { name: "交换源语言和目标语言" }).click();
    await expect(page.getByText("简体中文 → 日语")).toBeVisible();

    await expect(page.getByText("上传漫画页并选择语言，开始批量翻译吧。")).toBeVisible();
    expect(trap.errors).toEqual([]);
  });

  /**
   * The regression test for the bug this rewrite exists to fix.
   *
   * 开始 used to reset every page to `pending` and re-send the whole list, so
   * recovering one failure out of three cost three more billed requests. The
   * assertion is at the network level on purpose: counting intercepted calls is the
   * only way to show what the user is actually charged for.
   */
  test("重试只重发失败的那一页，已成功的页不再计费", async ({ page }) => {
    await seedSettings(page, { ...CONFIGURED, provider: "xai", apiKey: "e2e-fake-xai-key" });

    const sentPrompts: string[] = [];
    await page.route("**/v1/images/edits", async (route) => {
      const body = route.request().postDataJSON() as { image?: { url: string } };
      sentPrompts.push(body.image?.url ?? "");
      // The third page fails the first time it is sent, then succeeds on retry.
      const isThird = sentPrompts.length === 3;
      if (isThird) {
        await route.fulfill({
          status: 429,
          contentType: "application/json",
          body: JSON.stringify({ error: { message: "配额已用完" } }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: [{ b64_json: PNG.toString("base64"), mime_type: "image/png" }],
        }),
      });
    });

    await page.goto("/comic");
    await hydrated(page);
    await upload(page, ["p1.png", "p2.png", "p3.png"]);

    await page.getByRole("button", { name: "开始批量上色（3 张）" }).click();
    await expect(page.getByText("2 完成 · 0 进行中 · 1 失败 · 0 等待")).toBeVisible({
      timeout: 20_000,
    });
    expect(sentPrompts).toHaveLength(3);

    // The row carries its own reason, instead of a toast that has since gone.
    await expect(queueRows(page).nth(2)).toContainText("配额已用完");
    await expect(page.getByText("已完成")).toHaveCount(2);

    // 1 张, not 3: this is the whole point.
    await expect(page.getByRole("button", { name: "开始批量上色（1 张）" })).toBeVisible();

    await page.getByRole("button", { name: "重试失败项 (1)" }).click();
    await expect(page.getByText("3 完成 · 0 进行中 · 0 失败 · 0 等待")).toBeVisible({
      timeout: 20_000,
    });
    expect(sentPrompts).toHaveLength(4);

    // With everything done, 开始 becomes an explicit "re-run all" rather than a
    // button that silently has nothing to do.
    await expect(page.getByRole("button", { name: "全部重新上色（3 张）" })).toBeVisible();
  });

  test("切到另一个标签页不会掐掉正在跑的批处理", async ({ page }) => {
    await seedSettings(page, { ...CONFIGURED, provider: "xai", apiKey: "e2e-fake-xai-key" });

    // Held open until the test lets go, so the switch lands mid-request rather than
    // racing a batch that may already have finished.
    let release = () => {};
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    let sent = 0;
    await page.route("**/v1/images/edits", async (route) => {
      sent += 1;
      await held;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: [{ b64_json: PNG.toString("base64"), mime_type: "image/png" }],
        }),
      });
    });

    await page.goto("/comic");
    await hydrated(page);
    await upload(page, ["p1.png", "p2.png"]);
    await page.getByRole("button", { name: "开始批量上色（2 张）" }).click();
    await expect(page.getByText("0 完成 · 2 进行中 · 0 失败 · 0 等待")).toBeVisible();

    // Radix unmounts inactive tabs by default, and each panel aborts its batch on
    // unmount — so this used to discard both requests and mark the pages 已取消.
    await page.getByRole("tab", { name: "漫画翻译" }).click();
    await expect(page.getByRole("button", { name: /开始批量翻译/ })).toBeVisible();
    await page.getByRole("tab", { name: "漫画上色" }).click();

    release();
    await expect(page.getByText("2 完成 · 0 进行中 · 0 失败 · 0 等待")).toBeVisible({
      timeout: 20_000,
    });
    // Nothing was re-sent to recover: the original two requests ran to completion.
    expect(sent).toBe(2);
  });

  test("翻译页说明请求数是页数的两倍", async ({ page }) => {
    await page.goto("/comic");
    await hydrated(page);
    await expect(async () => {
      await page.getByRole("tab", { name: "漫画翻译" }).click();
      await expect(page.getByRole("button", { name: /开始批量翻译/ })).toBeVisible();
    }).toPass({ timeout: 15_000 });
    // Two billed requests per page is not guessable from the UI, so it is stated.
    await expect(page.getByText(/翻译的请求数是页数的两倍/)).toBeVisible();
  });
});
