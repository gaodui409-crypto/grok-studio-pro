import assert from "node:assert/strict";
import test from "node:test";
import { ObjectUrlRegistry } from "./object-url-registry.ts";

test("reuses an existing object URL for the same item", () => {
  let created = 0;
  const registry = new ObjectUrlRegistry(() => `blob:${++created}`, () => {});
  const blob = new Blob(["a"]);
  assert.equal(registry.register("one", blob), "blob:1");
  assert.equal(registry.register("one", blob), "blob:1");
  assert.equal(created, 1);
});

test("reconcile revokes URLs for removed items", () => {
  const revoked: string[] = [];
  const registry = new ObjectUrlRegistry(
    (blob) => `blob:${blob.size}`,
    (url) => revoked.push(url),
  );
  registry.register("one", new Blob(["a"]));
  registry.register("two", new Blob(["bb"]));
  registry.reconcile(new Set(["two"]));
  assert.deepEqual(revoked, ["blob:1"]);
  assert.deepEqual(registry.snapshot(), { two: "blob:2" });
});

test("dispose revokes every remaining URL", () => {
  const revoked: string[] = [];
  const registry = new ObjectUrlRegistry(
    (blob) => `blob:${blob.size}`,
    (url) => revoked.push(url),
  );
  registry.register("one", new Blob(["a"]));
  registry.register("two", new Blob(["bb"]));
  registry.dispose();
  assert.deepEqual(revoked, ["blob:1", "blob:2"]);
  assert.deepEqual(registry.snapshot(), {});
});
