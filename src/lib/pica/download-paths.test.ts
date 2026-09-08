import assert from "node:assert/strict";
import test from "node:test";
import { chapterDirectoryName, comicDirectoryName } from "./download-paths.ts";

test("漫画目录名去掉 Windows 不允许的字符", () => {
  assert.equal(comicDirectoryName("  我的漫画:Vol/1?  ", "comic-1"), "我的漫画_Vol_1_-comic-1");
  assert.equal(comicDirectoryName("", "comic-1"), "comic-comic-1");
});

test("章节目录名带有稳定的顺序前缀", () => {
  assert.equal(chapterDirectoryName(3, "第一话:相遇", "ch-1"), "0003-第一话_相遇-ch-1");
  assert.equal(chapterDirectoryName(12, "", "ch-2"), "0012-chapter-ch-2");
});

test("stable IDs separate identical comic and chapter titles", () => {
  assert.notEqual(comicDirectoryName("Same", "a"), comicDirectoryName("Same", "b"));
  assert.notEqual(chapterDirectoryName(1, "Same", "a"), chapterDirectoryName(1, "Same", "b"));
  assert.match(comicDirectoryName("CON. ", "a"), /^_CON-a$/);
  assert.ok(comicDirectoryName("a".repeat(300), "123456789012345678901234").length < 100);
});
