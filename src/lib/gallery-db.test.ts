import { test } from "node:test";
import assert from "node:assert/strict";
import { formatBytesPair } from "./gallery-db.ts";

const KB = 1024;
const MB = 1024 * KB;
const GB = 1024 * MB;

test("formatBytesPair 用总量的单位统一两侧", () => {
  assert.equal(formatBytesPair(1.2 * GB, 6 * GB), "1.20 / 6.00 GB");
  // The case that motivated this: a tiny usage against a large quota used to
  // render as "2.1 KB / 1015.9 MB".
  assert.equal(formatBytesPair(2.1 * KB, 1015.9 * MB), "0.0 / 1015.9 MB");
  assert.equal(formatBytesPair(300 * KB, 900 * KB), "300.0 / 900.0 KB");
});

test("formatBytesPair 总量不足 1KB 时退回字节", () => {
  assert.equal(formatBytesPair(10, 900), "10 / 900 B");
});
