import type { VideoState, VideoSubMode } from "./app-store.ts";
import type { VideoStatus } from "./xai.ts";

/**
 * The four sub-modes, with what each one needs before it can be submitted.
 *
 * `needs` is the short line under the tab label. The four tabs used to be bare
 * names, so "视频编辑" gave no hint that it wants an mp4 until you had written a
 * prompt, pressed 执行, and been handed a toast. Stating the input up front is
 * cheaper than validating after the click.
 */
export const VIDEO_SUB_MODES: { id: VideoSubMode; label: string; needs: string }[] = [
  { id: "t2v", label: "文生视频", needs: "仅需文本" },
  { id: "i2v", label: "图生视频", needs: "需图片" },
  { id: "edit", label: "视频编辑", needs: "需视频" },
  { id: "extend", label: "视频延长", needs: "需视频" },
];

export const SUB_MODE_LABEL: Record<VideoSubMode, string> = {
  t2v: "文生视频",
  i2v: "图生视频",
  edit: "视频编辑",
  extend: "视频延长",
};

/**
 * Why the submit button is disabled, or null when it is ready.
 *
 * Returned as a string so the reason can sit beside the button instead of only
 * appearing in a toast after a click that was never going to work. The old code
 * checked the same three conditions inside the click handler and each one
 * `return toast.error(...)`-ed, which meant the button looked enabled right up
 * to the moment it refused.
 */
export function submitBlocker(
  v: Pick<
    VideoState,
    "subMode" | "prompt" | "startImage" | "sourceVideoUrl" | "sourceVideoDataUri"
  >,
): string | null {
  if (!v.prompt.trim()) return "请先输入提示词";
  if (v.subMode === "i2v" && !v.startImage.length) return "图生视频需要一张起始帧";
  if (
    (v.subMode === "edit" || v.subMode === "extend") &&
    !v.sourceVideoUrl.trim() &&
    !v.sourceVideoDataUri
  ) {
    return "请先上传 mp4 或填入视频 URL";
  }
  return null;
}

/** Which duration slider applies. 延长 has its own, shorter range. */
export function activeDuration(v: Pick<VideoState, "subMode" | "duration" | "extendDuration">) {
  return v.subMode === "extend" ? v.extendDuration : v.duration;
}

/**
 * `stopped` is separate from `failed` on purpose.
 *
 * Pressing 取消任务 used to land on `failed`, so the card read 失败 under a warning
 * triangle while the toast beside it said the render was probably still going. One
 * of the two was lying, and the alarming one was the lie: nothing failed, the user
 * chose to stop watching. Same for re-opening the page on a task with a request_id
 * and no result — the poll isn't running, which is not the same as the job breaking.
 * Both are recoverable by 继续查询, and calling them 失败 makes a live paid render
 * look like a dead one.
 */
export type TaskPhase = "idle" | "submitting" | "polling" | "done" | "stopped" | "failed";

/**
 * The one-line state readout.
 *
 * Deliberately does not invent stages. The mockup shows 排队中 ▸ 生成中 ▸ 转码中,
 * but /v1/videos/{id} only ever answers pending, done, failed or expired — there
 * is no signal that separates queueing from encoding, so a three-step breadcrumb
 * would be lighting up steps on a timer rather than on anything the server said.
 */
export function phaseLabel(phase: TaskPhase, status: VideoStatus | null): string {
  if (phase === "submitting") return "提交中";
  if (phase === "polling") return status?.status === "pending" ? "生成中" : "查询中";
  if (phase === "done") return "已完成";
  if (phase === "stopped") return "已停止查询";
  if (phase === "failed") return status?.status === "expired" ? "已过期" : "失败";
  return "待提交";
}

/**
 * Progress to show, or null for "no number available".
 *
 * The old code substituted 5% for a pending task with no progress field, so a
 * three-minute render sat at "5%" and looked stuck. A bar with no number is
 * honest about not knowing; the elapsed clock beside it is what actually moves.
 */
export function progressPercent(status: VideoStatus | null): number | null {
  if (typeof status?.progress !== "number") return null;
  return Math.max(0, Math.min(100, Math.round(status.progress)));
}

/** `req_8a3f2b91c4d12c` → `req_8a3f…d12c`, for a chip that must not wrap. */
export function shortRequestId(id: string, keep = 8): string {
  if (id.length <= keep + 5) return id;
  return `${id.slice(0, keep)}…${id.slice(-4)}`;
}

/** `2.3s` / `1m 04s`, clamped so a fresh task never reads 0s. */
export function formatElapsed(ms: number): string {
  const seconds = Math.max(0.1, ms / 1000);
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const whole = Math.round(seconds);
  return `${Math.floor(whole / 60)}m ${String(whole % 60).padStart(2, "0")}s`;
}

export function videoFileName(subMode: VideoSubMode, at = Date.now()): string {
  return `grok-${subMode}-${at}.mp4`;
}
