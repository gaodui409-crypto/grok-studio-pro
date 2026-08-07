import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readBatch(name: string): string {
  try {
    return readFileSync(new URL(`../../${name}`, import.meta.url), "utf8");
  } catch {
    return "";
  }
}

test("启动脚本可从任意目录启动开发服务", () => {
  const script = readBatch("启动.bat");

  assert.match(script, /cd \/d "%~dp0"/i);
  assert.match(script, /where node/i);
  assert.match(script, /npm\.cmd install/i);
  assert.match(script, /node node_modules\\vite\\bin\\vite\.js dev %\*/i);
  assert.match(script, /exit \/b %EXIT_CODE%/i);
});

test("测试脚本运行项目的完整单元测试", () => {
  const script = readBatch("测试.bat");

  assert.match(script, /cd \/d "%~dp0"/i);
  assert.match(script, /where node/i);
  assert.match(script, /npm\.cmd install/i);
  assert.match(script, /node --experimental-strip-types --test "src\/\*\*\/\*\.test\.ts"/i);
  assert.match(script, /exit \/b %EXIT_CODE%/i);
});

test("Windows 批处理脚本使用 CRLF 换行", () => {
  for (const name of ["启动.bat", "测试.bat"]) {
    const script = readBatch(name);
    const lineFeeds = script.match(/\n/g)?.length ?? 0;
    const crlfPairs = script.match(/\r\n/g)?.length ?? 0;

    assert.ok(lineFeeds > 0, `${name} 应包含多行命令`);
    assert.equal(crlfPairs, lineFeeds, `${name} 必须使用 CRLF 换行`);
  }
});
