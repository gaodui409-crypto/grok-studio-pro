import type { Page } from "@playwright/test";
import { test, expect, seedSettings, CONFIGURED } from "./fixtures";

const PIXEL =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==";

async function gallerySources(page: Page) {
  return page.evaluate(async () => {
    const path = "/src/lib/gallery-db.ts";
    const { listGallery } = await import(/* @vite-ignore */ path);
    return (await listGallery()).map((item: { model: string; provider: string }) => ({
      model: item.model,
      provider: item.provider,
    }));
  });
}

test("the selected image model is sent to the provider and recorded in the gallery", async ({
  page,
}) => {
  await seedSettings(page, {
    ...CONFIGURED,
    provider: "xai",
    imageModel: "grok-imagine-image-pro",
  });
  const models: string[] = [];
  await page.route("**/v1/images/generations", (route) => {
    models.push(route.request().postDataJSON().model);
    return route.fulfill({ json: { data: [{ b64_json: PIXEL }] } });
  });
  await page.goto("/");
  await page.waitForFunction(() => document.documentElement.dataset.hydrated === "1");
  await page.getByRole("combobox").filter({ hasText: "Grok Imagine · Image Pro" }).click();
  await page
    .getByRole("option")
    .filter({ hasText: /^Grok Imagine · Image（/ })
    .click();
  await page.getByLabel("提示词").fill("offline model fixture");
  await page.getByRole("button", { name: "生成图片", exact: true }).click();
  await expect(page.getByRole("region", { name: "生成结果" }).locator("img")).toHaveCount(1);
  expect(models).toEqual(["grok-imagine-image"]);
  await expect
    .poll(() => gallerySources(page))
    .toEqual([{ model: "grok-imagine-image", provider: "xAI/NewAPI" }]);
});

test("a later provider failure keeps the first image, gallery entry and quota count", async ({
  page,
}) => {
  await seedSettings(page, { ...CONFIGURED, giteeModel: "stable-diffusion-xl-base-1.0" });
  let requests = 0;
  await page.route("**/v1/images/generations", (route) => {
    requests++;
    return requests === 1
      ? route.fulfill({ json: { data: [{ b64_json: PIXEL }] } })
      : route.fulfill({ status: 429, json: { error: { message: "offline quota limit" } } });
  });
  await page.goto("/");
  await page.waitForFunction(() => document.documentElement.dataset.hydrated === "1");
  await page.getByRole("button", { name: "增加一张" }).click();
  await page.getByLabel("提示词").fill("offline partial batch fixture");
  await page.getByRole("button", { name: "生成图片", exact: true }).click();
  await expect(page.getByRole("region", { name: "生成结果" }).locator("img")).toHaveCount(1);
  await expect(page.getByText(/后续图片失败/)).toBeVisible();
  expect(requests).toBe(2);
  await expect
    .poll(() => gallerySources(page))
    .toEqual([{ model: "stable-diffusion-xl-base-1.0", provider: "Gitee AI 模力方舟" }]);
  expect(
    await page.evaluate(async () => {
      const path = "/src/lib/quota.ts";
      const { usedToday } = await import(/* @vite-ignore */ path);
      return usedToday("gitee");
    }),
  ).toBe(1);
});
