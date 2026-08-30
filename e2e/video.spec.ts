import type { Page } from "@playwright/test";
import { test, expect, seedSettings, trapConsole, CONFIGURED } from "./fixtures";

const hydrated = (page: Page) =>
  page.waitForFunction(() => document.documentElement.dataset.hydrated === "1");

// Video is xAI-only, so every test that reaches the network seeds xAI. CONFIGURED
// defaults to gitee, which is the case the unsupported banner covers.
const XAI = { ...CONFIGURED, provider: "xai", apiKey: "e2e-fake-xai-key" };

const promptBox = (page: Page) => page.getByLabel(/文本提示词|修改说明|接下来的内容/);
const submit = (page: Page) => page.getByRole("button", { name: /提交生成任务/ });

/** Route components are lazy chunks, so the first interaction can miss its handler. */
async function pickMode(page: Page, name: string) {
  await expect(async () => {
    await page.getByRole("radio", { name: new RegExp(name) }).click();
    await expect(page.getByRole("radio", { name: new RegExp(name) })).toHaveAttribute(
      "aria-checked",
      "true",
    );
  }).toPass({ timeout: 20_000 });
}

test.describe("视频生成 · 表单", () => {
  test("四个模式都写明需要什么输入", async ({ page }) => {
    const trap = trapConsole(page);
    await seedSettings(page, XAI);
    await page.goto("/video");
    await hydrated(page);

    // The requirement used to surface only as a toast after 执行 had been pressed.
    await expect(page.getByRole("radio", { name: /文生视频/ })).toContainText("仅需文本");
    await expect(page.getByRole("radio", { name: /图生视频/ })).toContainText("需图片");
    await expect(page.getByRole("radio", { name: /视频编辑/ })).toContainText("需视频");
    await expect(page.getByRole("radio", { name: /视频延长/ })).toContainText("需视频");

    expect(trap.errors).toEqual([]);
  });

  test("提交按钮在缺输入时不可点，并说明缺什么", async ({ page }) => {
    await seedSettings(page, XAI);
    await page.goto("/video");
    await hydrated(page);

    await expect(submit(page)).toBeDisabled();
    await expect(page.getByText("请先输入提示词")).toBeVisible();

    await promptBox(page).fill("一只机械蝴蝶在霓虹花园中起飞");
    await expect(submit(page)).toBeEnabled();

    // Switching to a mode with an unmet requirement disables it again, rather than
    // letting the click through to a toast.
    await pickMode(page, "图生视频");
    await expect(submit(page)).toBeDisabled();
    await expect(page.getByText("图生视频需要一张起始帧")).toBeVisible();

    await pickMode(page, "视频编辑");
    await expect(page.getByText("请先上传 mp4 或填入视频 URL")).toBeVisible();

    // A URL satisfies 视频编辑 without a file upload.
    await page.getByLabel("或粘贴视频 URL").fill("https://example.test/a.mp4");
    await expect(submit(page)).toBeEnabled();
  });

  test("时长滑块旁边给出按秒计费的预估", async ({ page }) => {
    await seedSettings(page, XAI);
    await page.goto("/video");
    await hydrated(page);

    // 6s at 480p, the store's defaults: 6 × $0.05.
    await expect(page.getByText("$0.30")).toBeVisible();
    await expect(page.getByText("6 秒 × $0.05/秒（480p 官方价）")).toBeVisible();

    await page.getByRole("combobox", { name: /分辨率/ }).click();
    await page.getByRole("option", { name: "720p" }).click();
    await expect(page.getByText("$0.42")).toBeVisible();
  });

  test("非 xAI 渠道不报价，也说明为什么", async ({ page }) => {
    // CONFIGURED is gitee, which has no video endpoint.
    await seedSettings(page, CONFIGURED);
    await page.goto("/video");
    await hydrated(page);

    await expect(page.getByText(/当前渠道没有视频接口/)).toBeVisible();
    // Quoting a price for a channel that cannot bill anyone is the mistake
    // batch-cost.ts exists to prevent; it must not come back on this page.
    await expect(page.getByText(/^\$\d/)).toHaveCount(0);
  });

  test("视频编辑说明参数继承源视频，不显示无效滑块", async ({ page }) => {
    await seedSettings(page, XAI);
    await page.goto("/video");
    await hydrated(page);

    await expect(page.getByRole("slider", { name: "时长" })).toBeVisible();
    await pickMode(page, "视频编辑");
    await expect(page.getByRole("slider", { name: "时长" })).toHaveCount(0);
    await expect(page.getByText(/全部继承源视频/)).toBeVisible();
  });

  test("延长模式用自己的时长范围", async ({ page }) => {
    await seedSettings(page, XAI);
    await page.goto("/video");
    await hydrated(page);

    await pickMode(page, "视频延长");
    const slider = page.getByRole("slider", { name: "延长时长" });
    await expect(slider).toBeVisible();
    await expect(slider).toHaveAttribute("aria-valuemin", "2");
    await expect(slider).toHaveAttribute("aria-valuemax", "10");
  });

  test("没有结果时结果区说明在等什么", async ({ page }) => {
    await seedSettings(page, XAI);
    await page.goto("/video");
    await hydrated(page);
    await expect(page.getByRole("region", { name: "生成结果" })).toContainText("还没有生成结果");
    // Nothing submitted yet, so there is no task card to read.
    await expect(page.getByRole("region", { name: "任务状态" })).toHaveCount(0);
  });
});

test.describe("视频生成 · 任务", () => {
  test("提交后 request_id 留在页面上，可复制、可取消", async ({ page }) => {
    await seedSettings(page, XAI);
    await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);

    let statusCalls = 0;
    await page.route("**/v1/videos/generations", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ request_id: "req_8a3f2b91c4d12c" }),
      }),
    );
    // Never finishes, so the in-flight state can be inspected.
    await page.route("**/v1/videos/req_*", (route) => {
      statusCalls += 1;
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ status: "pending" }),
      });
    });

    await page.goto("/video");
    await hydrated(page);
    await promptBox(page).fill("一只机械蝴蝶");
    await submit(page).click();

    const card = page.getByRole("region", { name: "任务状态" });
    await expect(card).toContainText("生成中");
    // The id used to live only in a toast. It is the only handle to a job that is
    // already billing, so it has to survive on screen.
    await expect(card.getByText("req_8a3f…d12c")).toBeVisible();
    await expect(card).toContainText("已用");

    await card.getByRole("button", { name: "复制 request_id" }).click();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe("req_8a3f2b91c4d12c");

    // Cancel exists at all: pollVideo always returned a stop handle and the page
    // used to drop it, so a submitted task could only be waited out.
    await card.getByRole("button", { name: "取消任务" }).click();
    await expect(card.getByRole("button", { name: "继续查询" })).toBeVisible();

    // Cancelling is not failing. The card used to read 失败 under a warning triangle
    // while the toast beside it said the render was probably still running, which
    // reads as "your paid job broke" for something the user chose to stop watching.
    await expect(card).toContainText("已停止查询");
    await expect(card).not.toContainText("失败");

    const afterCancel = statusCalls;
    await page.waitForTimeout(1500);
    expect(statusCalls).toBe(afterCancel);
  });

  test("继续查询接回同一个任务，不重新提交", async ({ page }) => {
    await seedSettings(page, XAI);

    let submits = 0;
    await page.route("**/v1/videos/generations", (route) => {
      submits += 1;
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ request_id: "req_resume_0001" }),
      });
    });
    let statusCalls = 0;
    await page.route("**/v1/videos/req_*", (route) => {
      statusCalls += 1;
      // Fails the first four times: past the 3-retry cap, so the poll gives up and
      // the page has to offer a way back rather than a re-submit.
      if (statusCalls <= 4) return route.fulfill({ status: 502, body: "bad gateway" });
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          status: "done",
          video: { url: "https://example.test/out.mp4", duration: 6 },
        }),
      });
    });

    await page.goto("/video");
    await hydrated(page);
    await promptBox(page).fill("一只机械蝴蝶");
    await submit(page).click();

    const card = page.getByRole("region", { name: "任务状态" });
    await expect(card).toContainText("轮询中断", { timeout: 20_000 });
    // The render is still going server-side, so the id and the way back stay put.
    await expect(card.getByText("req_resu…0001")).toBeVisible();
    await expect(card).toContainText(/重新提交会再计费一次/);

    await card.getByRole("button", { name: "继续查询" }).click();
    await expect(card).toContainText("已完成", { timeout: 20_000 });
    // The whole point: one submission, one bill.
    expect(submits).toBe(1);
  });

  test("完成后结果区出现视频和下载", async ({ page }) => {
    await seedSettings(page, XAI);
    await page.route("**/v1/videos/generations", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ request_id: "req_done_0001" }),
      }),
    );
    await page.route("**/v1/videos/req_*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          status: "done",
          video: { url: "https://example.test/out.mp4", duration: 6 },
        }),
      }),
    );

    await page.goto("/video");
    await hydrated(page);
    await promptBox(page).fill("一只机械蝴蝶");
    await submit(page).click();

    const result = page.getByRole("region", { name: "生成结果" });
    await expect(result.getByRole("button", { name: "下载视频" })).toBeVisible({ timeout: 20_000 });
    await expect(result.locator("video")).toHaveAttribute("src", "https://example.test/out.mp4");
  });

  test("提交失败时不留下假的进行中状态", async ({ page }) => {
    await seedSettings(page, XAI);
    await page.route("**/v1/videos/generations", (route) =>
      route.fulfill({
        status: 429,
        contentType: "application/json",
        body: JSON.stringify({ error: { message: "额度已用完" } }),
      }),
    );

    await page.goto("/video");
    await hydrated(page);
    await promptBox(page).fill("一只机械蝴蝶");
    await submit(page).click();

    await expect(page.getByRole("region", { name: "任务状态" })).toContainText("失败");
    // No id was ever issued, so there is nothing to resume — offering it would
    // send a request for a task that does not exist.
    await expect(page.getByRole("button", { name: "继续查询" })).toHaveCount(0);
    await expect(submit(page)).toBeEnabled();
  });
});
