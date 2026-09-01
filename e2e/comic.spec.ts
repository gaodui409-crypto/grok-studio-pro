import type { Page } from "@playwright/test";
import JSZip from "jszip";
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
    await expect(page.getByText("3/200")).toBeVisible();

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
    await expect(page.getByText("2/200")).toBeVisible();
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

  /**
   * The reader exists because the old preview dialog could show page 14 and offered
   * no way to reach page 15 — a 30-page job could only be read by opening and closing
   * 30 modals. So the assertions are about *turning* pages, not about one page.
   */
  test("阅读器能连续翻页，页码跟着走，到头就停", async ({ page }) => {
    const trap = trapConsole(page);
    await page.goto("/comic");
    await hydrated(page);
    await upload(page, ["a.png", "b.png", "c.png"]);

    // Offered from the first upload, before any run: the same flip-through checks the
    // page order before 30 requests are paid for.
    await page.getByRole("button", { name: "阅读" }).click();
    const reader = page.getByRole("dialog");
    await expect(reader).toContainText("第 1 / 3 页");
    await expect(reader).toContainText("0 / 3 页已生成");

    const next = reader.getByRole("button", { name: "下一页" });
    const prev = reader.getByRole("button", { name: "上一页" });

    // At the first page there is nowhere back to go — clamped, not wrapped, so 上一页
    // cannot silently restart the book.
    await expect(prev).toBeDisabled();
    await next.click();
    await expect(reader).toContainText("第 2 / 3 页");
    await expect(prev).toBeEnabled();

    // Keyboard, because a reader that needs the mouse for every turn is not a reader.
    await page.keyboard.press("ArrowRight");
    await expect(reader).toContainText("第 3 / 3 页");
    await expect(next).toBeDisabled();

    await page.keyboard.press("ArrowLeft");
    await expect(reader).toContainText("第 2 / 3 页");
    await page.keyboard.press("Home");
    await expect(reader).toContainText("第 1 / 3 页");
    await page.keyboard.press("End");
    await expect(reader).toContainText("第 3 / 3 页");

    // The strip is the only way from page 2 to page 27 without 25 clicks.
    await reader.getByRole("button", { name: "跳到第 1 页" }).click();
    await expect(reader).toContainText("第 1 / 3 页");

    expect(trap.errors).toEqual([]);
  });

  test("从某一行进入阅读器时停在那一页", async ({ page }) => {
    await page.goto("/comic");
    await hydrated(page);
    await upload(page, ["a.png", "b.png", "c.png"]);

    // 查看大图 on a row is now "start reading here", not "look at this one thing".
    // Rows only offer it once they have a result, so the reader is opened via the
    // strip's own entry point and then checked for the requested page.
    await page.getByRole("button", { name: "阅读" }).click();
    const reader = page.getByRole("dialog");
    await reader.getByRole("button", { name: "跳到第 3 页" }).click();
    await expect(reader).toContainText("第 3 / 3 页");

    // Reopening starts a fresh read rather than resuming: position is per-visit.
    await page.keyboard.press("Escape");
    await expect(reader).toBeHidden();
    await page.getByRole("button", { name: "阅读" }).click();
    await expect(page.getByRole("dialog")).toContainText("第 1 / 3 页");
  });

  test("未生成的页显示原图并说明原因，不会被跳过", async ({ page }) => {
    await page.goto("/comic");
    await hydrated(page);
    await upload(page, ["a.png", "b.png"]);
    await page.getByRole("button", { name: "阅读" }).click();

    const reader = page.getByRole("dialog");
    // Hiding unfinished pages would renumber the book mid-run, so they stay and say
    // why they are still black and white.
    await expect(reader).toContainText("这一页还没有生成结果，显示的是原图");
    await expect(reader).toContainText("第 1 / 2 页");

    // With nothing generated there is no 结果/原图 comparison to offer: both buttons
    // would show the same image.
    await expect(reader.getByRole("group", { name: "切换显示原图或结果" })).toHaveCount(0);
    await expect(reader.getByRole("button", { name: "下载这一页" })).toBeDisabled();
  });

  test("连页模式滚动时页码跟随当前页", async ({ page }) => {
    await page.goto("/comic");
    await hydrated(page);
    await upload(page, ["a.png", "b.png", "c.png"]);
    await page.getByRole("button", { name: "阅读" }).click();

    const reader = page.getByRole("dialog");
    await reader.getByRole("button", { name: "连页" }).click();

    // In 连页 every page is in the DOM at once, so the counter is driven by what owns
    // the middle of the viewport. Without that it would read 第 1 / 3 页 while you
    // look at page 3, and 下载这一页 beside it would hand you page 1.
    await reader.getByRole("button", { name: "跳到第 3 页" }).click();
    await expect(reader).toContainText("第 3 / 3 页");
  });

  test("翻译页阅读器可以展开该页译文", async ({ page }) => {
    await seedSettings(page, { ...CONFIGURED, provider: "xai", apiKey: "e2e-fake-xai-key" });

    await page.route("**/v1/chat/completions", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          choices: [{ message: { content: "气泡1：こんにちは｜你好" } }],
        }),
      });
    });
    await page.route("**/v1/images/edits", async (route) => {
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
    await expect(async () => {
      await page.getByRole("tab", { name: "漫画翻译" }).click();
      await expect(page.getByRole("button", { name: /开始批量翻译/ })).toBeVisible();
    }).toPass({ timeout: 15_000 });

    await upload(page, ["p1.png"]);
    await page.getByRole("button", { name: "开始批量翻译（1 张）" }).click();
    await expect(page.getByText("1 完成 · 0 进行中 · 0 失败 · 0 等待")).toBeVisible({
      timeout: 20_000,
    });

    await page.getByRole("button", { name: "阅读" }).click();
    const reader = page.getByRole("dialog");
    await expect(reader).toContainText("1 / 1 页已生成");

    // Collapsed by default: the text competes with the page for height, and the page
    // is what a reader is for.
    await expect(reader.getByLabel("第 1 页识别原文与译文对照")).toHaveCount(0);
    await reader.getByRole("button", { name: "查看译文" }).click();
    await expect(reader.getByLabel("第 1 页识别原文与译文对照")).toHaveValue(/こんにちは｜你好/);

    // Now that a result exists, the comparison toggle is worth offering.
    await expect(reader.getByRole("group", { name: "切换显示原图或结果" })).toBeVisible();
    await expect(reader.getByRole("button", { name: "下载这一页" })).toBeEnabled();
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

/**
 * A real archive, built here rather than committed as a binary fixture.
 *
 * The unpacking is the thing under test, so the bytes have to be a genuine zip —
 * and generating them keeps the entry names visible in the test that depends on
 * their order.
 */
async function cbz(paths: string[]): Promise<Buffer> {
  const zip = new JSZip();
  for (const path of paths) zip.file(path, PNG);
  return zip.generateAsync({ type: "nodebuffer" });
}

/** Picks files through the drop zone, as `upload` does, but with arbitrary bytes. */
async function pick(page: Page, files: { name: string; mimeType: string; buffer: Buffer }[]) {
  const zone = page.getByRole("button", { name: /点击或拖拽上传漫画页/ });
  await expect(async () => {
    const chooser = page.waitForEvent("filechooser", { timeout: 4000 });
    await zone.click();
    await (await chooser).setFiles(files);
  }).toPass({ timeout: 20_000 });
}

test.describe("漫画工具 · 压缩包导入", () => {
  test.beforeEach(async ({ page }) => {
    await seedSettings(page, CONFIGURED);
  });

  test("CBZ 解压后按阅读顺序进入队列", async ({ page }) => {
    const trap = trapConsole(page);
    await page.goto("/comic");
    await hydrated(page);

    // Entry order here is neither reading order nor plain string order: ch1/010
    // before ch1/002 tests numeric collation, and ch2 last tests that the sort
    // compares the full path before names are flattened to the basename.
    await pick(page, [
      {
        name: "volume.cbz",
        mimeType: "application/vnd.comicbook+zip",
        buffer: await cbz(["ch1/010.png", "ch1/002.png", "ch2/001.png", "ComicInfo.xml"]),
      },
    ]);

    await expect(page.getByText("3/200")).toBeVisible({ timeout: 20_000 });
    // ComicInfo.xml is in the archive and must not become a page.
    await expect(queueRows(page)).toHaveCount(3);
    await expect(page.getByRole("img", { name: "第 1 页：002.png" })).toBeVisible();
    await expect(page.getByRole("img", { name: "第 2 页：010.png" })).toBeVisible();
    await expect(page.getByRole("img", { name: "第 3 页：001.png" })).toBeVisible();

    expect(trap.errors).toEqual([]);
  });

  test("超出上限时说明总页数和实际导入数", async ({ page }) => {
    // 200 tiles plus 200 queue rows is a lot of DOM for the dev server to build.
    test.slow();
    await page.goto("/comic");
    await hydrated(page);

    const names = Array.from({ length: 201 }, (_, i) => `${String(i + 1).padStart(3, "0")}.png`);
    await pick(page, [
      { name: "big.cbz", mimeType: "application/vnd.comicbook+zip", buffer: await cbz(names) },
    ]);

    // The number that was left out is the point: showing 200 of a 201-page volume
    // with no message reads as "it lost my last page".
    await expect(page.getByText(/共 201 页，超出 200 张上限，已导入前 200 页/)).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByText("200/200")).toBeVisible();
    await expect(page.getByRole("button", { name: /已满 200/ })).toBeDisabled();
  });

  test("坏压缩包只报错，不清空已有页面", async ({ page }) => {
    await page.goto("/comic");
    await hydrated(page);

    await upload(page, ["page-01.png"]);
    await expect(queueRows(page)).toHaveCount(1);

    // Named .cbz but not a zip. The filmstrip has replaced the drop zone by now,
    // so this goes through the trailing 添加 tile.
    await expect(async () => {
      const chooser = page.waitForEvent("filechooser", { timeout: 4000 });
      await page.getByRole("button", { name: "添加" }).click();
      await (
        await chooser
      ).setFiles([
        { name: "broken.cbz", mimeType: "application/zip", buffer: Buffer.from("not a zip") },
      ]);
    }).toPass({ timeout: 20_000 });

    await expect(page.getByText(/broken.cbz 解压失败/)).toBeVisible({ timeout: 20_000 });
    // The page that was already there survives a failed import.
    await expect(queueRows(page)).toHaveCount(1);
    await expect(page.getByText("1/200")).toBeVisible();
  });

  test("提供文件夹入口，且说明支持压缩包", async ({ page }) => {
    await page.goto("/comic");
    await hydrated(page);

    // The folder button is the only way to reach `webkitdirectory`, and it has to
    // exist before pages are added — the drop zone it sits beside disappears later.
    await expect(page.getByRole("button", { name: "选择文件夹" })).toBeEnabled();
    // Scoped to the visible panel: both tabs keep an uploader mounted, and this
    // hint is static text rather than a role, so an unscoped query matches the
    // hidden panel's copy too.
    await expect(activePanel(page).getByText(/图片或 ZIP \/ CBZ 压缩包/)).toBeVisible();
  });
});
