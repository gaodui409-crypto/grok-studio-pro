import assert from "node:assert/strict";
import test from "node:test";
import { chapterImageDownloads, picaMediaUrl, safeDownloadFilename } from "./types.ts";

test("把章节图片媒体信息转换为可下载 URL 和文件名", () => {
  assert.deepEqual(
    chapterImageDownloads([
      {
        _id: "page-1",
        media: { fileServer: "https://storage.example", path: "a/b.webp", originalName: "" },
      },
      {
        _id: "page-2",
        media: { fileServer: "https://storage.example", path: "c.png", originalName: "page-2.png" },
      },
    ]),
    [
      { id: "page-1", url: "https://storage.example/static/a/b.webp", filename: "0001-page-1.jpg" },
      { id: "page-2", url: "https://storage.example/static/c.png", filename: "0002-page-2.png" },
    ],
  );
});

test("媒体 URL 使用接口返回的 fileServer", () => {
  assert.equal(
    picaMediaUrl({ fileServer: "https://cdn.example/", path: "/a.webp", originalName: "" }),
    "https://cdn.example/static/a.webp",
  );
});

test("下载文件名去掉路径和危险字符", () => {
  assert.equal(safeDownloadFilename("../chapter/page:1?.png", "fallback.jpg"), "page_1_.png");
  assert.equal(safeDownloadFilename("", "fallback.jpg"), "fallback.jpg");
});

test("恢复任务时只返回尚未成功的页面", () => {
  const images = [
    {
      _id: "page-1",
      media: { fileServer: "https://storage.example", path: "1", originalName: "1.png" },
    },
    {
      _id: "page-2",
      media: { fileServer: "https://storage.example", path: "2", originalName: "2.png" },
    },
  ];
  assert.deepEqual(chapterImageDownloads(images, new Set(["page-1"])), [
    { id: "page-2", url: "https://storage.example/static/2", filename: "0002-2.png" },
  ]);
});
