import assert from "node:assert/strict";
import test from "node:test";
import { PicaClient } from "./client.ts";

const page = {
  total: 1,
  limit: 20,
  page: 1,
  pages: 1,
  docs: [{ _id: "comic-1", title: "fixture" }],
};

function clientWith(body: unknown): PicaClient {
  const client = new PicaClient();
  (client as unknown as { request: () => Promise<Response> }).request = async () =>
    new Response(JSON.stringify({ code: 200, data: body }), { status: 200 });
  return client;
}

test("searchComic unwraps the comics pagination envelope", async () => {
  const result = await clientWith({ comics: page }).searchComic("fixture", "dd", 1);
  assert.deepEqual(result.docs, page.docs);
});

test("getFavorite unwraps the comics pagination envelope", async () => {
  const result = await clientWith({ comics: page }).getFavorite("dd", 1);
  assert.deepEqual(result.docs, page.docs);
});

test("directory scanning uses native values() rather than [name, handle] entries", async () => {
  const file = {
    kind: "file",
    name: "comic.json",
    getFile: async () =>
      new File([JSON.stringify({ _id: "saved-1", title: "Saved" })], "comic.json"),
  };
  const directory = {
    kind: "directory",
    name: "saved",
    async *values() {
      yield file;
    },
    async *[Symbol.asyncIterator]() {
      yield ["comic.json", file];
    },
  };
  const root = {
    async *values() {
      yield directory;
    },
    async *[Symbol.asyncIterator]() {
      yield ["saved", directory];
    },
  };
  const comics = await new PicaClient().getDownloadedComicsFromDir(
    root as unknown as FileSystemDirectoryHandle,
  );
  assert.deepEqual(
    comics.map((comic) => comic._id),
    ["saved-1"],
  );
  assert.deepEqual(comics[0].categories, []);
  assert.equal(comics[0].thumb.fileServer, "");
});

test("directory scanning skips malformed comic metadata", async () => {
  const root = {
    async *values() {
      for (const extra of [
        { categories: 1 },
        { thumb: { path: "a.png" } },
        { chapterInfos: [{}] },
      ]) {
        yield {
          kind: "file",
          name: "comic.json",
          getFile: async () =>
            new File([JSON.stringify({ _id: "saved-1", title: "Saved", ...extra })], "comic.json"),
        };
      }
    },
  };
  assert.deepEqual(
    await new PicaClient().getDownloadedComicsFromDir(root as unknown as FileSystemDirectoryHandle),
    [],
  );
});

test("getAllChapters flattens every chapter page", async () => {
  const client = new PicaClient();
  const pages = [
    {
      total: 2,
      limit: 1,
      page: 1,
      pages: 2,
      docs: [{ _id: "c1", title: "一", order: 1, updatedAt: "" }],
    },
    {
      total: 2,
      limit: 1,
      page: 2,
      pages: 2,
      docs: [{ _id: "c2", title: "二", order: 2, updatedAt: "" }],
    },
  ];
  (client as unknown as { getChapters: () => Promise<unknown> }).getChapters = async () =>
    pages.shift();
  const result = await client.getAllChapters("comic-1");
  assert.deepEqual(
    result.docs.map((chapter) => chapter._id),
    ["c1", "c2"],
  );
});

test("getAllChapterImages flattens image pages in API order", async () => {
  const client = new PicaClient();
  const pages = [
    {
      total: 2,
      limit: 1,
      page: 1,
      pages: 2,
      docs: [{ _id: "p1", media: { fileServer: "https://s", path: "1", originalName: "1" } }],
    },
    {
      total: 2,
      limit: 1,
      page: 2,
      pages: 2,
      docs: [{ _id: "p2", media: { fileServer: "https://s", path: "2", originalName: "2" } }],
    },
  ];
  (client as unknown as { getChapterImages: () => Promise<unknown> }).getChapterImages = async () =>
    pages.shift();
  const result = await client.getAllChapterImages("comic-1", 1);
  assert.deepEqual(
    result.map((image) => image._id),
    ["p1", "p2"],
  );
});
