import { test } from "node:test";
import assert from "node:assert/strict";
import {
  VIDEO_SUB_MODES,
  activeDuration,
  formatElapsed,
  phaseLabel,
  progressPercent,
  shortRequestId,
  submitBlocker,
  videoFileName,
} from "./video-task.ts";
import type { VideoState } from "./app-store.ts";

const base: Pick<
  VideoState,
  "subMode" | "prompt" | "startImage" | "sourceVideoUrl" | "sourceVideoDataUri"
> = {
  subMode: "t2v",
  prompt: "一只机械蝴蝶",
  startImage: [],
  sourceVideoUrl: "",
  sourceVideoDataUri: "",
};

test("每个子模式都写明需要什么输入", () => {
  assert.equal(VIDEO_SUB_MODES.length, 4);
  for (const mode of VIDEO_SUB_MODES) {
    assert.ok(mode.needs.length > 0, `${mode.id} 缺少输入说明`);
  }
});

test("空提示词先被拦住", () => {
  assert.equal(submitBlocker({ ...base, prompt: "   " }), "请先输入提示词");
});

test("文生视频只要有提示词就能提交", () => {
  assert.equal(submitBlocker(base), null);
});

test("图生视频缺起始帧时说明缺什么", () => {
  assert.equal(submitBlocker({ ...base, subMode: "i2v" }), "图生视频需要一张起始帧");
  assert.equal(submitBlocker({ ...base, subMode: "i2v", startImage: ["data:,x"] }), null);
});

test("视频编辑和延长都接受文件或 URL 任一种", () => {
  for (const subMode of ["edit", "extend"] as const) {
    assert.equal(submitBlocker({ ...base, subMode }), "请先上传 mp4 或填入视频 URL");
    assert.equal(submitBlocker({ ...base, subMode, sourceVideoUrl: "https://x/v.mp4" }), null);
    assert.equal(
      submitBlocker({ ...base, subMode, sourceVideoDataUri: "data:video/mp4;base64,x" }),
      null,
    );
  }
});

test("只有空白的 URL 不算填了", () => {
  assert.equal(
    submitBlocker({ ...base, subMode: "edit", sourceVideoUrl: "   " }),
    "请先上传 mp4 或填入视频 URL",
  );
});

test("延长模式用的是自己那根时长滑块", () => {
  const v = { subMode: "extend" as const, duration: 6, extendDuration: 9 };
  assert.equal(activeDuration(v), 9);
  assert.equal(activeDuration({ ...v, subMode: "t2v" }), 6);
});

test("状态文案不编造接口没给的阶段", () => {
  assert.equal(phaseLabel("idle", null), "待提交");
  assert.equal(phaseLabel("submitting", null), "提交中");
  assert.equal(phaseLabel("polling", { status: "pending" }), "生成中");
  assert.equal(phaseLabel("done", { status: "done" }), "已完成");
  assert.equal(phaseLabel("failed", { status: "failed" }), "失败");
  // 过期和失败是两回事：过期意味着任务跑完了但结果链接没了。
  assert.equal(phaseLabel("failed", { status: "expired" }), "已过期");
});

test("没有 progress 字段时不给假百分比", () => {
  assert.equal(progressPercent(null), null);
  assert.equal(progressPercent({ status: "pending" }), null);
  assert.equal(progressPercent({ status: "pending", progress: 42 }), 42);
});

test("百分比夹在 0 到 100 之间", () => {
  assert.equal(progressPercent({ status: "pending", progress: -5 }), 0);
  assert.equal(progressPercent({ status: "pending", progress: 140 }), 100);
  assert.equal(progressPercent({ status: "pending", progress: 41.6 }), 42);
});

test("request_id 缩写保留两头，短 id 原样返回", () => {
  assert.equal(shortRequestId("req_8a3f2b91c4d12c"), "req_8a3f…d12c");
  assert.equal(shortRequestId("req_short"), "req_short");
});

test("用时格式：秒保留一位，超过一分钟分秒补零", () => {
  assert.equal(formatElapsed(2300), "2.3s");
  assert.equal(formatElapsed(64_000), "1m 04s");
  assert.equal(formatElapsed(600_000), "10m 00s");
});

test("刚提交的任务不会显示 0s", () => {
  assert.equal(formatElapsed(0), "0.1s");
});

test("文件名带上子模式，便于区分同一天的多个任务", () => {
  assert.equal(videoFileName("extend", 1700000000000), "grok-extend-1700000000000.mp4");
});
