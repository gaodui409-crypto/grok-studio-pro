import assert from "node:assert/strict";
import test from "node:test";
import { attachChapterPage, type Comic } from "./types.ts";

const comic = {
  _id: "comic-1",
  title: "fixture",
  author: "author",
  pagesCount: 2,
  chapterInfos: [],
  chapterCount: 0,
} as unknown as Comic;

test("将章节分页写回漫画对象供下载器查找", () => {
  const chapters = {
    total: 2,
    limit: 20,
    page: 1,
    pages: 1,
    docs: [
      { _id: "chapter-1", title: "第一话", order: 1, updatedAt: "2026-09-05" },
      { _id: "chapter-2", title: "第二话", order: 2, updatedAt: "2026-09-05" },
    ],
  };
  const result = attachChapterPage(comic, chapters);
  assert.deepEqual(result.chapterInfos, chapters.docs);
  assert.equal(result.chapterCount, 2);
});
