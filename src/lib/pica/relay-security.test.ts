import assert from "node:assert/strict";
import test from "node:test";
import {
  isAllowedPicaImageUrl,
  isAllowedPicaMethod,
  isAllowedPicaPath,
  limitedResponseBody,
  nextPicaImageUrl,
  picaApiRequestSchema,
  picaImageRequestSchema,
} from "./relay-security.ts";

test("只允许登记过的 Pica API 路径", () => {
  assert.equal(isAllowedPicaPath("auth/sign-in"), true);
  assert.equal(isAllowedPicaPath("comics/507f1f77bcf86cd799439011/order/1/pages?page=2"), true);
  assert.equal(isAllowedPicaPath("admin/users"), false);
  assert.equal(isAllowedPicaPath("https://example.com/steal"), false);
  assert.equal(isAllowedPicaPath("comics/1/../../users/profile"), false);
  assert.equal(isAllowedPicaMethod("POST", "auth/sign-in"), true);
  assert.equal(isAllowedPicaMethod("GET", "auth/sign-in"), false);
  assert.equal(isAllowedPicaMethod("GET", "users/profile"), true);
});

test("图片 URL 只接受 HTTPS 白名单域名", () => {
  assert.equal(isAllowedPicaImageUrl("https://picaapi.picacomic.com/static/a.webp"), true);
  assert.equal(isAllowedPicaImageUrl("https://storage1.icu/static/a.webp"), true);
  assert.equal(isAllowedPicaImageUrl("http://picaapi.picacomic.com/static/a.webp"), false);
  assert.equal(isAllowedPicaImageUrl("https://evilpicacomic.com/static/a.webp"), false);
  assert.equal(isAllowedPicaImageUrl("https://user:secret@storage1.icu/a.png"), false);
  assert.equal(isAllowedPicaImageUrl("https://storage1.icu:8443/a.png"), false);
});

test("relay inputs validate path, method, headers and JSON body before use", () => {
  const get = { method: "GET", path: "/users/profile", body: null, token: "fixture-token" };
  assert.equal(picaApiRequestSchema.parse(get).path, "users/profile");
  for (const input of [
    null,
    {},
    { ...get, path: 1 },
    { ...get, method: "DELETE" },
    { ...get, token: "a\r\nb" },
    { ...get, token: "a".repeat(8193) },
    { ...get, body: "{}" },
    { ...get, path: "auth/sign-in" },
  ]) {
    assert.equal(picaApiRequestSchema.safeParse(input).success, false);
  }
  const login = {
    method: "POST",
    path: "auth/sign-in",
    body: '{"email":"fixture@example.com","password":"fixture"}',
    token: null,
  };
  assert.equal(picaApiRequestSchema.safeParse(login).success, true);
  for (const body of [
    null,
    "invalid",
    "[]",
    "null",
    "{}",
    "a".repeat(8193),
    '{"email":1,"password":false}',
  ]) {
    assert.equal(picaApiRequestSchema.safeParse({ ...login, body }).success, false);
  }
  assert.equal(
    picaApiRequestSchema.safeParse({
      ...login,
      path: "comics/advanced-search?page=1",
      body: '{"keyword":"test","sort":"dd"}',
    }).success,
    true,
  );
  assert.equal(picaImageRequestSchema.safeParse({ url: 1 }).success, false);
  assert.equal(
    picaImageRequestSchema.safeParse({ url: "https://storage1.icu/a.png" }).success,
    true,
  );
});

test("重定向目标必须继续通过图片域名校验", () => {
  assert.equal(
    nextPicaImageUrl("https://picaapi.picacomic.com/static/a.webp", "/static/b.webp"),
    "https://picaapi.picacomic.com/static/b.webp",
  );
  assert.equal(
    nextPicaImageUrl("https://picaapi.picacomic.com/static/a.webp", "https://evil.example/b.webp"),
    null,
  );
});

test("限制图片响应体大小，超限时中止流", async () => {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new Uint8Array(4));
      controller.enqueue(new Uint8Array(4));
      controller.close();
    },
  });
  const limited = limitedResponseBody(body, 5, "图片响应过大");
  assert.ok(limited);
  const reader = limited.getReader();
  await reader.read();
  await assert.rejects(() => reader.read(), /图片响应过大/);
});
