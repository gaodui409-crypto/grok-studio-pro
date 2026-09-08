import assert from "node:assert/strict";
import test from "node:test";
import { usePicaStore } from "./store.ts";
import type { Comic, Pagination, ChapterInfo } from "./types.ts";

test("cancelling the directory picker clears the loading state", async (t) => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "window");
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      showDirectoryPicker: async () => {
        throw new DOMException("cancel", "AbortError");
      },
    },
  });
  t.after(() => {
    if (previous) Object.defineProperty(globalThis, "window", previous);
    else Reflect.deleteProperty(globalThis, "window");
  });
  await usePicaStore.getState().loadDownloaded();
  assert.equal(usePicaStore.getState().downloadedLoading, false);
  assert.equal(usePicaStore.getState().downloadedError, null);
});

test("late chapter responses do not replace a newly selected comic", async (t) => {
  const client = usePicaStore.getState().client;
  const previous = client.getAllChapters;
  let resolve!: (page: Pagination<ChapterInfo>) => void;
  client.getAllChapters = () =>
    new Promise((done) => {
      resolve = done;
    });
  t.after(() => {
    client.getAllChapters = previous;
  });
  usePicaStore.getState().pickComic({ _id: "a" } as Comic);
  const request = usePicaStore.getState().loadChapters("a");
  usePicaStore.getState().pickComic({ _id: "b" } as Comic);
  resolve({ page: 1, pages: 1, docs: [], total: 0, limit: 20 });
  await request;
  assert.equal(usePicaStore.getState().pickedComic?._id, "b");
  assert.equal(usePicaStore.getState().pickedChapters, null);
});

test("download setup errors propagate to the caller instead of showing success", async (t) => {
  const client = usePicaStore.getState().client;
  const previous = client.getAllChapters;
  client.getAllChapters = async () => {
    throw new Error("fixture setup failure");
  };
  t.after(() => {
    client.getAllChapters = previous;
  });
  usePicaStore.setState({ pickedComic: null, pickedChapters: null });
  await assert.rejects(
    usePicaStore.getState().downloadComic({ _id: "c" } as Comic),
    /fixture setup failure/,
  );
  assert.equal(usePicaStore.getState().downloadLoading, false);
});
