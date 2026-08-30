import { test } from "node:test";
import assert from "node:assert/strict";
import type { GalleryMeta } from "./gallery-db.ts";
import {
  applyFilter,
  computeFacets,
  emptyFilter,
  isFiltered,
  kindOf,
  matchesFilter,
  sortItems,
  timeCutoff,
  type GalleryFilter,
} from "./gallery-filter.ts";

const DAY = 24 * 60 * 60 * 1000;
// Fixed "now" so the rolling-window tests do not drift with the clock.
const NOW = new Date(2026, 7, 30, 14, 30, 0);

function item(over: Partial<GalleryMeta> = {}): GalleryMeta {
  return {
    id: over.id ?? Math.random().toString(36).slice(2),
    mimeType: "image/png",
    prompt: "a cat",
    createdAt: NOW.getTime(),
    size: 1000,
    ...over,
  };
}

function filter(over: Partial<GalleryFilter> = {}): GalleryFilter {
  return { ...emptyFilter, ...over };
}

test("kindOf 优先用 type，缺失时回退到 mimeType", () => {
  assert.equal(kindOf(item({ type: "video" })), "video");
  assert.equal(kindOf(item({ mimeType: "video/mp4" })), "video");
  assert.equal(kindOf(item({ mimeType: "image/png" })), "image");
  // A legacy video record with no `type` must not be mislabelled as an image.
  assert.equal(kindOf(item({ type: undefined, mimeType: "video/webm" })), "video");
});

test("今日按本地零点算，而不是 24 小时前", () => {
  const midnight = new Date(2026, 7, 30).getTime();
  assert.equal(timeCutoff("today", NOW), midnight);
  // 13:00 yesterday is within 24h of 14:30 today but is NOT "today".
  const yesterdayAfternoon = item({ createdAt: midnight - 2 * 60 * 60 * 1000 });
  assert.equal(matchesFilter(yesterdayAfternoon, filter({ time: "today" }), NOW), false);
  const thisMorning = item({ createdAt: midnight + 60 * 1000 });
  assert.equal(matchesFilter(thisMorning, filter({ time: "today" }), NOW), true);
});

test("近 7 天 / 近 30 天 是滚动窗口", () => {
  const sixDays = item({ createdAt: NOW.getTime() - 6 * DAY });
  const eightDays = item({ createdAt: NOW.getTime() - 8 * DAY });
  assert.equal(matchesFilter(sixDays, filter({ time: "7d" }), NOW), true);
  assert.equal(matchesFilter(eightDays, filter({ time: "7d" }), NOW), false);
  assert.equal(matchesFilter(eightDays, filter({ time: "30d" }), NOW), true);
  assert.equal(timeCutoff("all", NOW), null);
});

test("搜索覆盖提示词、场景、角色、服装、动作", () => {
  const it = item({
    prompt: "银发少女",
    sceneName: "校园",
    character: "樱井",
    outfit: "水手服",
    action: "回头",
  });
  for (const term of ["银发", "校园", "樱井", "水手服", "回头"]) {
    assert.equal(matchesFilter(it, filter({ search: term }), NOW), true, `应匹配 ${term}`);
  }
  assert.equal(matchesFilter(it, filter({ search: "赛博朋克" }), NOW), false);
});

test("搜索忽略大小写与首尾空格", () => {
  const it = item({ prompt: "Cyberpunk Tokyo" });
  assert.equal(matchesFilter(it, filter({ search: "  cyberpunk " }), NOW), true);
});

test("各筛选条件是与关系", () => {
  const it = item({ type: "image", sceneName: "校园", character: "樱井", provider: "Gitee AI" });
  assert.equal(
    matchesFilter(it, filter({ kind: "image", scene: "校园", character: "樱井" }), NOW),
    true,
  );
  // One mismatch is enough to exclude.
  assert.equal(matchesFilter(it, filter({ kind: "image", scene: "温泉" }), NOW), false);
});

test("排序：最新 / 最旧 / 最大", () => {
  const a = item({ id: "a", createdAt: 100, size: 50 });
  const b = item({ id: "b", createdAt: 300, size: 10 });
  const c = item({ id: "c", createdAt: 200, size: 900 });
  assert.deepEqual(
    sortItems([a, b, c], "newest").map((i) => i.id),
    ["b", "c", "a"],
  );
  assert.deepEqual(
    sortItems([a, b, c], "oldest").map((i) => i.id),
    ["a", "c", "b"],
  );
  assert.deepEqual(
    sortItems([a, b, c], "largest").map((i) => i.id),
    ["c", "a", "b"],
  );
});

test("排序不修改入参数组", () => {
  const a = item({ id: "a", createdAt: 100 });
  const b = item({ id: "b", createdAt: 300 });
  const input = [a, b];
  sortItems(input, "newest");
  assert.deepEqual(
    input.map((i) => i.id),
    ["a", "b"],
  );
});

test("facet 计数排除该 facet 自身的选择", () => {
  const items = [
    item({ sceneName: "校园", type: "image" }),
    item({ sceneName: "校园", type: "image" }),
    item({ sceneName: "温泉", type: "image" }),
  ];
  // With 校园 selected, 温泉 must still report its own count — otherwise the
  // sidebar would show 0 and look unusable.
  const facets = computeFacets(items, filter({ scene: "校园" }), NOW);
  assert.deepEqual(facets.scenes, [
    { value: "校园", count: 2 },
    { value: "温泉", count: 1 },
  ]);
  // total, by contrast, honours the full filter.
  assert.equal(facets.total, 2);
});

test("facet 计数受其他 facet 约束", () => {
  const items = [
    item({ sceneName: "校园", type: "image" }),
    item({ sceneName: "校园", type: "video", mimeType: "video/mp4" }),
    item({ sceneName: "温泉", type: "video", mimeType: "video/mp4" }),
  ];
  // Only videos: 校园 has 1, 温泉 has 1. Tied counts fall back to pinyin order,
  // which puts 温泉 (w) ahead of 校园 (x).
  const facets = computeFacets(items, filter({ kind: "video" }), NOW);
  assert.deepEqual(facets.scenes, [
    { value: "温泉", count: 1 },
    { value: "校园", count: 1 },
  ]);
});

test("图片/视频计数不受当前类型选择影响", () => {
  const items = [
    item({ type: "image" }),
    item({ type: "image" }),
    item({ type: "video", mimeType: "video/mp4" }),
  ];
  const facets = computeFacets(items, filter({ kind: "video" }), NOW);
  assert.deepEqual(facets.kinds, { image: 2, video: 1 });
});

test("facet 按数量降序、同数量按名称排", () => {
  const items = [
    item({ character: "B" }),
    item({ character: "A" }),
    item({ character: "C" }),
    item({ character: "C" }),
  ];
  const facets = computeFacets(items, filter(), NOW);
  assert.deepEqual(facets.characters, [
    { value: "C", count: 2 },
    { value: "A", count: 1 },
    { value: "B", count: 1 },
  ]);
});

test("缺失字段不产生空 facet 项", () => {
  const items = [item({ sceneName: undefined }), item({ sceneName: "校园" })];
  const facets = computeFacets(items, filter(), NOW);
  assert.deepEqual(facets.scenes, [{ value: "校园", count: 1 }]);
});

test("applyFilter 同时筛选与排序", () => {
  const items = [
    item({ id: "old", sceneName: "校园", createdAt: 100 }),
    item({ id: "new", sceneName: "校园", createdAt: 900 }),
    item({ id: "other", sceneName: "温泉", createdAt: 500 }),
  ];
  assert.deepEqual(
    applyFilter(items, filter({ scene: "校园" }), "newest", NOW).map((i) => i.id),
    ["new", "old"],
  );
});

test("isFiltered 识别是否有条件生效", () => {
  assert.equal(isFiltered(filter()), false);
  assert.equal(isFiltered(filter({ search: "   " })), false);
  assert.equal(isFiltered(filter({ search: "猫" })), true);
  assert.equal(isFiltered(filter({ kind: "video" })), true);
  assert.equal(isFiltered(filter({ time: "today" })), true);
  assert.equal(isFiltered(filter({ provider: "Gitee AI" })), true);
});
