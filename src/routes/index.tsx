import { createFileRoute } from "@tanstack/react-router";
import { useRef } from "react";
import { ImageIcon, Sparkles, Loader2, X, Minus, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/page-header";
import { ApiKeyBanner } from "@/components/api-key-banner";
import { ImageGallery } from "@/components/image-gallery";
import { EmptyResults } from "@/components/generation/empty-results";
import { RunSummary } from "@/components/generation/run-summary";
import { AspectRatioSelect, ResolutionSelect } from "@/components/param-selects";
import { useResolutionLimit } from "@/hooks/use-resolution-limit";
import { ProviderModelSelect, ProviderSelect } from "@/components/provider-model-select";
import { QuotaBadge } from "@/components/quota-badge";
import { generateImagesWithFallback, providerLabel } from "@/lib/xai";
import { addGalleryFromUrl } from "@/lib/gallery-db";
import { useAppStore } from "@/lib/app-store";
import { isAbortError } from "@/lib/http";
import type { ResolutionTier } from "@/lib/settings";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "文生图 — Grok Studio" },
      { name: "description", content: "通过 xAI Grok Imagine 文本生成高质量图片。" },
    ],
  }),
  component: Index,
});

// Short, concrete, and spread across genres so they read as starting points rather
// than as the only things that work.
const EXAMPLES = [
  "赛博朋克少女，霓虹夜景",
  "古风山水，水墨画风格",
  "机械姬，未来实验室",
  "太空旅行，星际飞船",
] as const;

// Long enough for a detailed prompt with style and camera notes; low enough that
// the counter means something. Channels vary, so this is a UI guardrail rather
// than any single vendor's documented limit.
const PROMPT_MAX = 2000;

const N_MIN = 1;
const N_MAX = 10;

function Index() {
  const t2i = useAppStore((s) => s.t2i);
  const setT2I = useAppStore((s) => s.setT2I);
  const { prompt, n, aspect, resolution, model, loading, images, lastRun } = t2i;
  const generationRef = useRef<AbortController | null>(null);
  const { limit: resolutionLimit } = useResolutionLimit(resolution, (tier) =>
    setT2I({ resolution: tier }),
  );

  const cancelGenerate = () => generationRef.current?.abort();

  const handleGenerate = async () => {
    if (!prompt.trim()) return toast.error("请输入提示词");
    const controller = new AbortController();
    generationRef.current = controller;
    setT2I({ loading: true });
    const startedAt = performance.now();
    try {
      // Fallback-aware: if the local tally says the chosen channel is spent for
      // today, this runs on the next configured one instead of firing a request
      // that is expected to be refused. The switch is reported below and named in
      // the run summary, so a result never arrives from a channel the user did not
      // pick without the page saying so.
      const {
        images: data,
        provider: prov,
        switchedFrom,
        partialError,
        model: actualModel,
      } = await generateImagesWithFallback({
        prompt,
        n,
        aspect_ratio: aspect,
        resolution,
        model: undefined,
        signal: controller.signal,
      });
      setT2I({
        images: data,
        lastRun: {
          count: data.length,
          requested: n,
          seconds: (performance.now() - startedAt) / 1000,
          provider: providerLabel(prov),
          aspect,
        },
      });
      if (partialError) {
        toast.warning(`已生成 ${data.length} 张，后续图片失败：${partialError}`);
      } else if (switchedFrom) {
        toast.warning(
          `${providerLabel(switchedFrom)} 今日本地计数已用尽，已改用 ${providerLabel(prov)} 生成 ${data.length} 张`,
        );
      } else {
        toast.success(`已生成 ${data.length} 张图片`);
      }
      // allSettled, not all: with Promise.all a batch where 3 of 4 images fail
      // to save reports only the first reason and silently drops the rest.
      Promise.allSettled(
        data.map((img) =>
          addGalleryFromUrl(img.url, {
            prompt,
            model: actualModel,
            sceneName: "文生图",
            provider: providerLabel(prov),
          }),
        ),
      ).then((results) => {
        const failed = results.filter(
          (result): result is PromiseRejectedResult => result.status === "rejected",
        );
        if (failed.length === 0) {
          toast.success("已自动保存到画廊");
          return;
        }
        const reason = (failed[0].reason as Error)?.message ?? "未知原因";
        toast.error(
          failed.length === results.length
            ? `画廊保存失败：${reason}`
            : `画廊保存部分失败：${failed.length}/${results.length} 张未保存（${reason}）`,
        );
      });
    } catch (e) {
      if (isAbortError(e)) toast.info("已取消生成");
      else toast.error((e as Error).message);
    } finally {
      if (generationRef.current === controller) {
        generationRef.current = null;
        setT2I({ loading: false });
      }
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 md:px-8">
      <PageHeader
        title="文生图"
        description="写下提示词，用当前渠道批量生成图片。"
        icon={ImageIcon}
      />
      <ApiKeyBanner />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <PromptCard
          prompt={prompt}
          loading={loading}
          onChange={(next) => setT2I({ prompt: next })}
          onGenerate={handleGenerate}
          onCancel={cancelGenerate}
        />

        <aside className="space-y-4 rounded-2xl border border-border/60 bg-card p-5 shadow-card">
          <h2 className="font-display text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            参数
          </h2>
          <Stepper value={n} onChange={(next) => setT2I({ n: next })} disabled={loading} />
          <AspectRatioSelect value={aspect} onChange={(v) => setT2I({ aspect: v })} />
          <ResolutionSelect
            value={resolution}
            onChange={(v) => setT2I({ resolution: v as ResolutionTier })}
            limit={resolutionLimit}
          />
          <ProviderSelect />
          <ProviderModelSelect />
          <QuotaBadge />
        </aside>
      </div>

      <section className="mt-8" aria-label="生成结果">
        {loading && images.length === 0 ? (
          <PendingGrid count={n} aspect={aspect} />
        ) : images.length > 0 ? (
          <>
            {lastRun && (
              <RunSummary data={lastRun} onRegenerate={handleGenerate} disabled={loading} />
            )}
            <ImageGallery images={images} prefix="t2i" aspect={lastRun?.aspect ?? aspect} />
          </>
        ) : (
          <EmptyResults examples={EXAMPLES} onPick={(next) => setT2I({ prompt: next })} />
        )}
      </section>
    </div>
  );
}

function PromptCard({
  prompt,
  loading,
  onChange,
  onGenerate,
  onCancel,
}: {
  prompt: string;
  loading: boolean;
  onChange: (next: string) => void;
  onGenerate: () => void;
  onCancel: () => void;
}) {
  const over = prompt.length > PROMPT_MAX * 0.9;

  return (
    // flex column, so the prompt box absorbs whatever height the params panel
    // beside it happens to need. Fixed at min-h it left ~200px of blank card
    // under the button: the panel is the taller of the two and the grid stretches
    // both to match, so that space existed either way and the only question was
    // whether it was usable.
    <div className="flex flex-col gap-4 rounded-2xl border border-border/60 bg-card p-5 shadow-card">
      <div className="flex min-h-0 flex-1 flex-col gap-2">
        <Label htmlFor="t2i-prompt">提示词</Label>
        <div className="relative flex-1">
          <Textarea
            id="t2i-prompt"
            value={prompt}
            onChange={(e) => onChange(e.target.value)}
            maxLength={PROMPT_MAX}
            placeholder="例如：赛博朋克风格的东京夜晚，霓虹倒映在湿润街道，雨夜，电影感"
            // pb leaves room for the counter, which sits inside the box so it
            // cannot be mistaken for a hint about the button below it.
            className="h-full min-h-[180px] resize-none bg-background/60 pb-8 text-base"
          />
          <span
            aria-hidden
            className={`pointer-events-none absolute bottom-2.5 right-3 font-mono text-xs ${
              over ? "text-warning" : "text-muted-foreground"
            }`}
          >
            {prompt.length} / {PROMPT_MAX}
          </span>
        </div>
      </div>
      <div className="flex items-center justify-end gap-2">
        <Button
          onClick={onGenerate}
          disabled={loading}
          className="bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-95"
        >
          {loading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <Sparkles className="mr-2 h-4 w-4" aria-hidden />
          )}
          {loading ? "生成中…" : "生成图片"}
        </Button>
        {loading && (
          <Button type="button" variant="secondary" onClick={onCancel}>
            <X className="mr-2 h-4 w-4" aria-hidden /> 取消
          </Button>
        )}
      </div>
    </div>
  );
}

/**
 * Quantity, as −/+ around a readout.
 *
 * This was a number input that clamped on every keystroke, so typing "12" to reach
 * 12 turned into 10 as soon as the "1" landed and the second character replaced a
 * value the user never asked for. The range is 1–10 and the common change is ±1,
 * which a stepper does in one click and without a keyboard.
 */
function Stepper({
  value,
  onChange,
  disabled,
}: {
  value: number;
  onChange: (next: number) => void;
  disabled?: boolean;
}) {
  const step = (delta: number) => onChange(Math.min(N_MAX, Math.max(N_MIN, value + delta)));

  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        数量
      </Label>
      <div className="flex items-center rounded-md border border-border/60 bg-background/60">
        <button
          type="button"
          onClick={() => step(-1)}
          disabled={disabled || value <= N_MIN}
          aria-label="减少一张"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-l-md text-muted-foreground transition hover:bg-surface hover:text-foreground disabled:opacity-40 disabled:hover:bg-transparent"
        >
          <Minus className="h-4 w-4" aria-hidden />
        </button>
        {/* A live region, not an input: the value is only reachable through the two
            buttons, so the change has to be announced rather than read off a
            focused field. */}
        <output
          aria-live="polite"
          aria-label="生成数量"
          className="flex-1 text-center font-mono text-sm"
        >
          {value}
        </output>
        <button
          type="button"
          onClick={() => step(1)}
          disabled={disabled || value >= N_MAX}
          aria-label="增加一张"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-r-md text-muted-foreground transition hover:bg-surface hover:text-foreground disabled:opacity-40 disabled:hover:bg-transparent"
        >
          <Plus className="h-4 w-4" aria-hidden />
        </button>
      </div>
      <p className="text-xs text-muted-foreground">
        一次 {N_MIN}–{N_MAX} 张，免费渠道建议少量多次
      </p>
    </div>
  );
}

/**
 * Placeholders while the first batch is in flight.
 *
 * Sized to the requested ratio rather than square, so the grid does not reflow
 * into a different shape the moment the images land.
 */
function PendingGrid({ count, aspect }: { count: number; aspect: string }) {
  const ratio = aspect === "auto" ? undefined : aspect.split(":");
  const style =
    ratio && Number(ratio[0]) && Number(ratio[1])
      ? { aspectRatio: `${Number(ratio[0])} / ${Number(ratio[1])}` }
      : undefined;

  return (
    <div
      role="status"
      aria-label={`正在生成 ${count} 张图片`}
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
    >
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          style={style}
          className={`animate-pulse rounded-xl bg-surface ${style ? "" : "aspect-square"}`}
        />
      ))}
    </div>
  );
}
