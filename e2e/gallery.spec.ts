import { test, expect, seedGallery, trapConsole, type SeedItem } from "./fixtures";

// A small archive with deliberate structure: two scenes of unequal size, two
// characters, two channels, one video, and one record old enough to fall outside
// the 7-day window.
const ARCHIVE: SeedItem[] = [
  {
    id: "a1",
    prompt: "樱花树下的JK少女",
    sceneName: "校园",
    character: "樱井 美咲",
    provider: "Gitee AI 模力方舟",
    size: 1_400_000,
  },
  {
    id: "a2",
    prompt: "微风拂起发丝",
    sceneName: "校园",
    character: "樱井 美咲",
    provider: "Gitee AI 模力方舟",
    size: 900_000,
  },
  {
    id: "a3",
    prompt: "阳光透过花瓣洒落",
    sceneName: "校园",
    character: "银发少女",
    provider: "魔搭 ModelScope",
    size: 2_100_000,
  },
  {
    id: "b1",
    prompt: "露天温泉 木质汤屋",
    sceneName: "温泉",
    character: "银发少女",
    provider: "魔搭 ModelScope",
    size: 3_600_000,
  },
  {
    id: "v1",
    prompt: "圣诞夜 灯光斑驳的街道",
    sceneName: "节日",
    character: "樱井 美咲",
    provider: "Gitee AI 模力方舟",
    type: "video",
    size: 5_200_000,
  },
  {
    id: "old",
    prompt: "很久以前的旧图",
    sceneName: "温泉",
    character: "银发少女",
    provider: "Pollinations",
    ageDays: 20,
    size: 500_000,
  },
];

// The count lives in a status line under the h1, not in the heading itself: at
// 30px display type it was shouting a number that changes on every keystroke.
// role=status also means a filter change is announced rather than silently
// re-rendered.
const count = (page: import("@playwright/test").Page) => page.getByRole("status");

test.describe("画廊 · 有内容", () => {
  test.beforeEach(async ({ page }) => {
    await seedGallery(page, ARCHIVE);
  });

  test("渲染全部条目并统计数量", async ({ page }) => {
    const trap = trapConsole(page);
    await page.goto("/gallery");

    await expect(count(page)).toContainText("全部生成结果 6 项");
    // One card per record.
    await expect(page.getByRole("button", { name: "放大预览" })).toHaveCount(6);
    // The video badge marks the one non-image record.
    await expect(page.getByText("VIDEO", { exact: false })).toHaveCount(1);

    await page.waitForFunction(() => document.documentElement.dataset.hydrated === "1");
    await page.screenshot({ path: "e2e/__screens__/画廊有内容/gallery.png", fullPage: true });

    expect(trap.errors, `控制台错误:\n${trap.errors.join("\n")}`).toEqual([]);
  });

  test("类型 facet 的计数与筛选一致", async ({ page }) => {
    await page.goto("/gallery");
    const nav = page.getByRole("navigation", { name: "画廊筛选" });

    await expect(nav.getByRole("button", { name: /^图片/ })).toContainText("5");
    await expect(nav.getByRole("button", { name: /^视频/ })).toContainText("1");

    await nav.getByRole("button", { name: /^视频/ }).click();
    await expect(count(page)).toContainText("筛选结果 1 项");
    await expect(page.getByRole("button", { name: "放大预览" })).toHaveCount(1);
  });

  test("场景 facet 计数保留其他场景，可组合筛选", async ({ page }) => {
    await page.goto("/gallery");
    const nav = page.getByRole("navigation", { name: "画廊筛选" });

    await nav.getByRole("button", { name: /^校园/ }).click();
    await expect(count(page)).toContainText("筛选结果 3 项");

    // The point of relaxed facet counts: 温泉 still reports its own total while
    // 校园 is selected, so the sidebar stays navigable instead of showing zeros.
    await expect(nav.getByRole("button", { name: /^温泉/ })).toContainText("2");

    // Scene AND character compose.
    await nav.getByRole("button", { name: /^银发少女/ }).click();
    await expect(count(page)).toContainText("筛选结果 1 项");
  });

  test("时间筛选排除超出窗口的旧条目", async ({ page }) => {
    await page.goto("/gallery");
    const nav = page.getByRole("navigation", { name: "画廊筛选" });

    await nav.getByRole("button", { name: "近 7 天" }).click();
    await expect(count(page)).toContainText("筛选结果 5 项");
  });

  test("搜索命中提示词与场景", async ({ page }) => {
    await page.goto("/gallery");
    const search = page.getByLabel("搜索提示词");

    await search.fill("温泉");
    await expect(count(page)).toContainText("筛选结果 2 项");

    await search.fill("樱花");
    await expect(count(page)).toContainText("筛选结果 1 项");

    await search.fill("不存在的关键词");
    await expect(page.getByText("当前筛选条件下没有内容")).toBeVisible();
  });

  test("全选后出现批量操作条", async ({ page }) => {
    await page.goto("/gallery");

    await expect(page.getByRole("button", { name: /打包下载/ })).toHaveCount(0);
    await page.getByRole("button", { name: /^全选/ }).click();

    await expect(page.getByRole("button", { name: "打包下载 (6)" })).toBeVisible();
    await expect(page.getByRole("button", { name: "删除选中 (6)" })).toBeVisible();

    const nav = page.getByRole("navigation", { name: "画廊筛选" });
    await expect(nav.getByText("已选 6 项")).toBeVisible();
    await nav.getByRole("button", { name: "清空" }).click();
    await expect(page.getByRole("button", { name: /打包下载/ })).toHaveCount(0);
  });

  test("删空后不显示筛选栏", async ({ page }) => {
    await page.goto("/gallery");
    await page.getByRole("button", { name: /^全选/ }).click();
    await page.getByRole("button", { name: "删除选中 (6)" }).click();

    await expect(page.getByText("还没有内容，去生成一些吧～")).toBeVisible();
    await expect(page.getByRole("navigation", { name: "画廊筛选" })).toHaveCount(0);
    await expect(page.getByLabel("搜索提示词")).toHaveCount(0);
  });
});

// PAGE_SIZE is 48, so a 60-record archive is the smallest one that pages.
const MANY: SeedItem[] = Array.from({ length: 60 }, (_, index) => ({
  id: `p${index}`,
  prompt: `第 ${index} 张`,
  sceneName: index % 2 === 0 ? "校园" : "温泉",
  size: (index + 1) * 1000,
}));

test.describe("画廊 · 分页", () => {
  test.beforeEach(async ({ page }) => {
    await seedGallery(page, MANY);
  });

  test("首屏只渲染一页，加载更多补齐剩余", async ({ page }) => {
    await page.goto("/gallery");

    await expect(count(page)).toContainText("全部生成结果 60 项");
    // The count is the whole archive; the grid is one page of it. This is also
    // what bounds memory — only rendered cards hold an object URL.
    await expect(page.getByRole("button", { name: "放大预览" })).toHaveCount(48);

    const more = page.getByRole("button", { name: /加载更多/ });
    await expect(more).toContainText("剩余 12 项");
    await more.click();

    await expect(page.getByRole("button", { name: "放大预览" })).toHaveCount(60);
    await expect(page.getByRole("button", { name: /加载更多/ })).toHaveCount(0);
  });

  test("换筛选条件后回到第一页", async ({ page }) => {
    await page.goto("/gallery");
    await page.getByRole("button", { name: /加载更多/ }).click();
    await expect(page.getByRole("button", { name: "放大预览" })).toHaveCount(60);

    // Without the reset, the offset would carry over and 30 filtered records
    // would render under a "剩余" button that had nothing left to load.
    await page
      .getByRole("navigation", { name: "画廊筛选" })
      .getByRole("button", { name: /^校园/ })
      .click();
    await expect(count(page)).toContainText("筛选结果 30 项");
    await expect(page.getByRole("button", { name: "放大预览" })).toHaveCount(30);
    await expect(page.getByRole("button", { name: /加载更多/ })).toHaveCount(0);
  });
});

/**
 * How much of the first cover's source image actually reaches the screen.
 *
 * The scale is derived from the *computed* object-fit rather than assumed, which
 * matters more than it sounds: an earlier version of this helper always used the
 * contain formula, so it reported "nothing cropped" no matter what the CSS said
 * and both tests below passed against the very bug they were written for.
 *
 * `shown` is per-axis rendered size over box size — above 1 means that axis
 * overflows the box and is clipped.
 */
async function coverFit(page: import("@playwright/test").Page) {
  return page
    .locator("img[alt]")
    .first()
    .evaluate((el) => {
      const img = el as HTMLImageElement;
      const box = el.getBoundingClientRect();
      const objectFit = getComputedStyle(el).objectFit;
      const byWidth = box.width / img.naturalWidth;
      const byHeight = box.height / img.naturalHeight;
      const scale =
        objectFit === "cover"
          ? Math.max(byWidth, byHeight)
          : objectFit === "contain"
            ? Math.min(byWidth, byHeight)
            : objectFit === "none"
              ? 1
              : NaN; // fill / scale-down: not used here, and averaging them would lie
      return {
        objectFit,
        natural: { w: img.naturalWidth, h: img.naturalHeight },
        shownWidth: (img.naturalWidth * scale) / box.width,
        shownHeight: (img.naturalHeight * scale) / box.height,
      };
    });
}

test.describe("画廊 · 封面完整性", () => {
  // A 3:8 cover in a 3:4 box is the worst case for cropping: object-cover scales
  // it to fill the width and throws away more than half the height. The reported
  // symptom was exactly that — a portrait cover you could not identify without
  // opening it.
  test("竖图封面完整显示，不被裁掉上下两端", async ({ page }) => {
    await seedGallery(page, [{ id: "p1", prompt: "竖向封面", shape: "portrait" }]);
    await page.goto("/gallery");
    await page.waitForFunction(() => document.documentElement.dataset.hydrated === "1");

    const fit = await coverFit(page);

    // Guards the fixture: a 1×1 pixel would satisfy everything below while
    // proving nothing, because at 1×1 every fit mode agrees.
    expect(fit.natural).toEqual({ w: 72, h: 192 });
    // Neither axis overflows, so no edge is cut. Height reaching exactly 1 is
    // what says the cover is scaled to fit rather than left small.
    expect(fit.shownHeight).toBeCloseTo(1, 2);
    expect(fit.shownWidth).toBeLessThanOrEqual(1.001);
  });

  test("横图封面也完整显示", async ({ page }) => {
    await seedGallery(page, [{ id: "l1", prompt: "横向封面", shape: "landscape" }]);
    await page.goto("/gallery");
    await page.waitForFunction(() => document.documentElement.dataset.hydrated === "1");

    const fit = await coverFit(page);

    expect(fit.natural).toEqual({ w: 192, h: 72 });
    // The trade for keeping portraits whole: a wide cover gets bars above and
    // below rather than losing its sides.
    expect(fit.shownWidth).toBeCloseTo(1, 2);
    expect(fit.shownHeight).toBeLessThanOrEqual(1.001);
  });
});
