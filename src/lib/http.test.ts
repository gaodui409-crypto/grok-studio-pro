import assert from "node:assert/strict";
import test from "node:test";
import { fetchBlobChecked, isAbortError, responseErrorMessage } from "./http.ts";

test("preserves a plain-text provider error", async () => {
  const response = new Response("plain provider error", { status: 500 });
  assert.equal(await responseErrorMessage(response), "plain provider error");
  assert.equal(response.bodyUsed, true);
});

test("extracts a nested JSON provider error", async () => {
  const response = new Response(JSON.stringify({ error: { message: "bad key" } }), {
    status: 401,
    headers: { "content-type": "application/json" },
  });
  assert.equal(await responseErrorMessage(response), "bad key");
});

test("falls back to HTTP status for an empty body", async () => {
  assert.equal(await responseErrorMessage(new Response(null, { status: 503 })), "HTTP 503");
});

test("checked blob fetch rejects non-2xx responses", async () => {
  await assert.rejects(
    fetchBlobChecked(
      "https://example.test/image.png",
      async () => new Response("missing", { status: 404 }),
    ),
    /missing/,
  );
});

test("checked blob fetch returns a successful blob", async () => {
  const blob = await fetchBlobChecked(
    "https://example.test/image.png",
    async () => new Response("image", { status: 200, headers: { "content-type": "image/png" } }),
  );
  assert.equal(blob.type, "image/png");
});

test("recognizes AbortError DOM exceptions", () => {
  assert.equal(isAbortError(new DOMException("cancelled", "AbortError")), true);
  assert.equal(isAbortError(new Error("cancelled")), false);
});
