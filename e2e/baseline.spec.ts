import { test, expect, seedSettings, trapConsole, CONFIGURED } from "./fixtures";

// `heading` is matched as a substring, so the gallery's item count can vary
// without the assertion caring.
const ROUTES = [
  { path: "/", name: "文生图", heading: "文生图" },
  { path: "/edit", name: "图生图", heading: "图生图 / 编辑" },
  { path: "/video", name: "视频生成", heading: "视频生成" },
  { path: "/fanart", name: "同人图批量", heading: "同人图批量生成" },
  { path: "/comic", name: "漫画工具", heading: "漫画工具" },
  { path: "/gallery", name: "画廊", heading: "全部生成结果" },
  { path: "/settings", name: "设置", heading: "设置" },
] as const;

// Two passes per route: an unconfigured browser (what a first-time visitor sees)
// and a seeded one (what the app looks like once channels are usable). The
// refactor has to keep both working, and the empty state is the one that
// historically rots unnoticed.
for (const variant of ["空态", "已配置"] as const) {
  test.describe(`基线 · ${variant}`, () => {
    for (const route of ROUTES) {
      test(`${route.name} 渲染且无控制台错误`, async ({ page }) => {
        const trap = trapConsole(page);
        if (variant === "已配置") await seedSettings(page, CONFIGURED);

        await page.goto(route.path);

        await expect(page.getByRole("heading", { name: route.heading, level: 1 })).toBeVisible();

        // Sidebar nav is part of the root layout — if it is missing the shell broke.
        await expect(page.getByRole("link", { name: "画廊" })).toBeVisible();

        // The heading is present in the SSR HTML, so it goes visible *before*
        // hydration. Screenshotting there catches a half-built page (Radix select
        // triggers render empty server-side). Wait for the client to take over so
        // the images show the settled state a user actually reads.
        await page.waitForFunction(() => document.documentElement.dataset.hydrated === "1");

        await page.screenshot({
          path: `e2e/__screens__/${variant}/${route.path === "/" ? "index" : route.path.slice(1)}.png`,
          fullPage: true,
        });

        expect(trap.errors, `控制台错误:\n${trap.errors.join("\n")}`).toEqual([]);
      });
    }
  });
}

test.describe("导航", () => {
  test("侧边栏可在页面间跳转", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "画廊" }).click();
    await expect(page.getByRole("heading", { name: "全部生成结果", level: 1 })).toBeVisible();
    await page.getByRole("link", { name: "设置" }).click();
    await expect(page.getByRole("heading", { name: "设置", level: 1 })).toBeVisible();
  });

  test("未知路径显示 404", async ({ page }) => {
    await page.goto("/no-such-page");
    await expect(page.getByRole("heading", { name: "404" })).toBeVisible();
  });
});
