import assert from "node:assert/strict";
import test from "node:test";
import { relayPicaApi, relayPicaImage, type OutboundFetch } from "./relay-transport.ts";

test("API redirects never forward credentials to another host and discard the body", async () => {
  let cancelled = false;
  const result = await relayPicaApi(
    { method: "GET", path: "users/profile", body: null, token: "fixture" },
    async (_url, init) => {
      assert.equal(init.redirect, "manual");
      return new Response(
        new ReadableStream({
          cancel() {
            cancelled = true;
          },
        }),
        { status: 302, headers: { location: "https://other.invalid/" } },
      );
    },
  );
  assert.equal(result.status, 502);
  assert.equal(cancelled, true);
});

test("image redirects share one deadline and close rejected responses", async () => {
  let cancelled = 0;
  const signals: (AbortSignal | null | undefined)[] = [];
  const urls: string[] = [];
  const send: OutboundFetch = async (url, init) => {
    urls.push(url);
    signals.push(init.signal);
    return new Response(
      new ReadableStream({
        cancel() {
          cancelled++;
        },
      }),
      {
        status: 302,
        headers: { location: urls.length === 1 ? "/next.png" : "https://localhost/private" },
      },
    );
  };
  const result = await relayPicaImage("https://storage1.icu/first.png", send);
  assert.equal(result.status, 403);
  assert.deepEqual(urls, ["https://storage1.icu/first.png", "https://storage1.icu/next.png"]);
  assert.equal(signals[0], signals[1]);
  assert.equal(cancelled, 2);
});

test("oversized and non-image upstream bodies are cancelled", async () => {
  const cases: Record<string, string>[] = [
    { "content-length": String(26 * 1024 * 1024) },
    { "content-type": "text/html" },
  ];
  for (const headers of cases) {
    let cancelled = false;
    const result = await relayPicaImage(
      "https://storage1.icu/a.png",
      async () =>
        new Response(
          new ReadableStream({
            cancel() {
              cancelled = true;
            },
          }),
          { headers },
        ),
    );
    assert.ok([413, 415].includes(result.status));
    assert.equal(cancelled, true);
  }
});

test("image relay streams valid image bytes without caching", async () => {
  const result = await relayPicaImage(
    "https://storage1.icu/a.png",
    async () => new Response("fixture", { headers: { "content-type": "image/png" } }),
  );
  assert.equal(await result.text(), "fixture");
  assert.equal(result.headers.get("cache-control"), "no-store");
});
