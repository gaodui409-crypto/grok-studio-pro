import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useState } from "react";
import {
  BookOpen,
  Sparkles,
  Loader2,
  Download,
  X,
  Languages,
  Palette,
  BookOpenText,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { PageHeader } from "@/components/page-header";
import { ApiKeyBanner } from "@/components/api-key-banner";
import { ProviderUnsupportedBanner } from "@/components/provider-banner";
import { ImageUpload } from "@/components/image-upload";
import { ImageModelSelect } from "@/components/param-selects";
import { PageUploader } from "@/components/comic/page-uploader";
import { BatchQueue } from "@/components/comic/batch-queue";
import { StyleChips, CUSTOM_STYLE } from "@/components/comic/style-chips";
import { LangPicker } from "@/components/comic/lang-picker";
import { ComicReader } from "@/components/comic/comic-reader";
import { useComicBatch, type ProcessOutcome } from "@/hooks/use-comic-batch";
import { editImages, chatCompletion, currentProvider, providerLabel } from "@/lib/xai";
import { addGalleryFromUrl } from "@/lib/gallery-db";
import { useAppStore, type ComicPageItem } from "@/lib/app-store";
import { attemptPersistence } from "@/lib/persistence";
import { downloadAllAsZip } from "@/lib/download";
import { isReadable } from "@/lib/comic-reader";
import {
  failedPages,
  pagesToRun,
  resultFileName,
  shouldOfferRerunAll,
  translationFileName,
} from "@/lib/comic-batch";

export const Route = createFileRoute("/comic")({
  head: () => ({
    meta: [
      { title: "漫画工具 — Grok Studio" },
      { name: "description", content: "漫画批量上色与翻译，自动保存到画廊。" },
    ],
  }),
  component: ComicPage,
});

function ComicPage() {
  const tab = useAppStore((s) => s.comic.tab);
  const set = useAppStore((s) => s.setComic);

  return (
    <div className="mx-auto max-w-[1500px] px-4 py-8 md:px-8">
      <PageHeader
        title="漫画工具"
        description="批量上色 / 多语翻译，逐页查看进度，结果自动入库画廊。"
        icon={BookOpen}
      />
      <ApiKeyBanner />
      <ProviderUnsupportedBanner feature="i2i" />

      <Tabs value={tab} onValueChange={(v) => set({ tab: v as "colorize" | "translate" })}>
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="colorize">
            <Palette className="mr-1.5 h-3.5 w-3.5" aria-hidden /> 漫画上色
          </TabsTrigger>
          <TabsTrigger value="translate">
            <Languages className="mr-1.5 h-3.5 w-3.5" aria-hidden /> 漫画翻译
          </TabsTrigger>
        </TabsList>
        {/* forceMount + CSS hiding, rather than letting Radix unmount the inactive
            tab. Each panel aborts its batch on unmount, so switching tabs used to
            kill a run in progress — glancing at 漫画翻译 threw away a 30-page
            colouring job and the 30 requests already paid for. The two tabs are one
            page; the user has not left, and can come back and cancel deliberately.
            Navigating away still aborts, which is the case that rationale was for. */}
        <TabsContent value="colorize" forceMount className="mt-5 data-[state=inactive]:hidden">
          <ColorizePanel />
        </TabsContent>
        <TabsContent value="translate" forceMount className="mt-5 data-[state=inactive]:hidden">
          <TranslatePanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/** Shared frame: work column on the left, parameters in a sticky rail on the right. */
function PanelLayout({ main, aside }: { main: React.ReactNode; aside: React.ReactNode }) {
  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_324px]">
      {/* items-start, not the grid default of stretch: with an empty queue the work
          column is much shorter than the parameter rail, and stretching it left a
          card that was two thirds blank space below the button. */}
      <div className="space-y-5 rounded-2xl border border-border/60 bg-card p-5 shadow-card">
        {main}
      </div>
      <aside className="space-y-5 lg:sticky lg:top-6 lg:self-start">
        <div className="space-y-5 rounded-2xl border border-border/60 bg-card p-5 shadow-card">
          {aside}
        </div>
      </aside>
    </div>
  );
}

/**
 * 开始 / 取消 / 打包下载, plus the count the button is about to spend money on.
 *
 * The count is the point: "开始批量上色（4 张）" is a different decision from
 * "开始批量上色（27 张）", and the old button said neither.
 */
function RunBar({
  running,
  queued,
  rerunAll,
  hasResults,
  canRead,
  labels,
  onRun,
  onCancel,
  onDownload,
  onRead,
}: {
  running: boolean;
  queued: number;
  rerunAll: boolean;
  hasResults: boolean;
  /** Any pages at all — reading the uploads to check their order is worth doing too. */
  canRead: boolean;
  labels: { idle: string; busy: string; rerun: string; download: string };
  onRun: () => void;
  onCancel: () => void;
  onDownload: () => void;
  onRead: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {/* Left of 打包下载, because reading the results is what you do before deciding
          they are worth keeping. Present from the first upload: the same flip-through
          checks the page order before a 30-page run is paid for. */}
      {canRead && (
        <Button type="button" variant="ghost" onClick={onRead}>
          <BookOpenText className="mr-2 h-4 w-4" aria-hidden /> 阅读
        </Button>
      )}
      {hasResults && (
        <Button type="button" variant="secondary" onClick={onDownload}>
          <Download className="mr-2 h-4 w-4" aria-hidden /> {labels.download}
        </Button>
      )}
      {running && (
        <Button type="button" variant="secondary" onClick={onCancel}>
          <X className="mr-2 h-4 w-4" aria-hidden /> 取消
        </Button>
      )}
      <Button
        type="button"
        onClick={onRun}
        disabled={running || queued === 0}
        className="bg-gradient-primary text-primary-foreground shadow-glow"
      >
        {running ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
        ) : (
          <Sparkles className="mr-2 h-4 w-4" aria-hidden />
        )}
        {running ? labels.busy : `${rerunAll ? labels.rerun : labels.idle}（${queued} 张）`}
      </Button>
    </div>
  );
}

// ======================= Colorize =======================

function ColorizePanel() {
  const set = useAppStore((s) => s.setComic);
  const { styleSel, customStyle, refImage, model } = useAppStore((s) => s.comic);
  // The page id the reader should open at, or null for closed. An id rather than the
  // item itself: the page keeps changing under a live batch, and the reader needs the
  // current array anyway to turn to the next page.
  const [readId, setReadId] = useState<string | null>(null);
  const styleText = styleSel === CUSTOM_STYLE ? customStyle.trim() : styleSel;

  const process = useCallback(
    async (page: ComicPageItem, { signal }: { signal: AbortSignal }): Promise<ProcessOutcome> => {
      const prompt = refImage.length
        ? `参考 <IMAGE_1> 的配色风格，为 <IMAGE_0> 这张黑白漫画上色，使用${styleText}，保持原画的线条和构图不变`
        : `为这张黑白漫画上色，使用${styleText}，保持原画的线条和构图不变，色彩自然协调`;
      const data = await editImages({
        prompt,
        images: refImage.length ? [page.src, refImage[0]] : [page.src],
        n: 1,
        model,
        signal,
      });
      const img = data[0];
      if (!img?.url) throw new Error("API 未返回图片");
      // Written before the gallery copy: the generation is already paid for, so the
      // result must be on screen even if archiving it fails.
      updateResult(page.id, "colorPages", { resultUrl: img.url });
      const persistence = await attemptPersistence(() =>
        addGalleryFromUrl(img.url, {
          prompt,
          model,
          sceneName: "漫画上色",
          type: "image",
          provider: providerLabel(currentProvider()),
        }),
      );
      return persistence.saved ? {} : { saveError: persistence.error.message };
    },
    [refImage, styleText, model],
  );

  const { pages, running, run, cancel, concurrency } = useComicBatch({
    pagesKey: "colorPages",
    runningKey: "colorRunning",
    label: "上色",
    process,
  });

  const rerunAll = shouldOfferRerunAll(pages);
  const queued = rerunAll ? pages.length : pagesToRun(pages).length;

  const handleRun = () => {
    if (!pages.length) return toast.error("请先上传漫画页");
    if (!styleText) return toast.error("请选择或填写上色风格");
    void run(rerunAll ? pages : undefined);
  };

  const download = async () => {
    const ok = pages.filter((p) => p.resultUrl);
    if (!ok.length) return toast.error("没有可下载的结果");
    const { failed } = await downloadAllAsZip(
      ok.map((p, i) => ({
        url: p.resultUrl!,
        // Index-prefixed so the zip keeps reading order even when the source files
        // were named arbitrarily.
        filename: `${String(i + 1).padStart(2, "0")}-${resultFileName(p.name, "colored")}`,
      })),
      `comic-colorized-${Date.now()}.zip`,
    );
    if (failed) toast.warning(`压缩包已生成，但 ${failed} 张结果获取失败`);
  };

  return (
    <>
      <PanelLayout
        main={
          <>
            <PageUploader
              pages={pages}
              onChange={(p) => set({ colorPages: p })}
              disabled={running}
            />
            <BatchQueue
              pages={pages}
              running={running}
              concurrency={concurrency}
              onPreview={(p) => setReadId(p.id)}
              onRetry={(p) => void run([p])}
              onRetryFailed={() => void run(failedPages(pages))}
              emptyHint="上传漫画页并选择上色风格，即可开始批量上色。"
            />
            <RunBar
              running={running}
              queued={queued}
              rerunAll={rerunAll}
              hasResults={pages.some((p) => p.resultUrl)}
              canRead={isReadable(pages)}
              labels={{
                idle: "开始批量上色",
                busy: "上色中…",
                rerun: "全部重新上色",
                download: "打包下载",
              }}
              onRun={handleRun}
              onCancel={cancel}
              onDownload={() => void download()}
              onRead={() => setReadId(pages[0]?.id ?? null)}
            />
          </>
        }
        aside={
          <>
            <h2 className="font-display text-sm font-semibold tracking-tight">参数</h2>
            <StyleChips
              value={styleSel}
              custom={customStyle}
              onValue={(v) => set({ styleSel: v })}
              onCustom={(v) => set({ customStyle: v })}
              disabled={running}
            />
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                配色参考图（可选）
              </Label>
              <ImageUpload
                values={refImage}
                onChange={(v) => set({ refImage: v })}
                max={1}
                label="上传参考图"
              />
              <p className="text-[11px] text-muted-foreground">
                提供参考图时，会以它的配色为准，风格描述作为辅助。
              </p>
            </div>
            <ImageModelSelect value={model} onChange={(v) => set({ model: v })} />
          </>
        }
      />
      <ComicReader pages={pages} openId={readId} onClose={() => setReadId(null)} suffix="colored" />
    </>
  );
}

// ======================= Translate =======================

function TranslatePanel() {
  const set = useAppStore((s) => s.setComic);
  const { langFrom, langTo, model } = useAppStore((s) => s.comic);
  const [readId, setReadId] = useState<string | null>(null);

  const process = useCallback(
    async (page: ComicPageItem, { signal }: { signal: AbortSignal }): Promise<ProcessOutcome> => {
      updateResult(page.id, "translatePages", { step: "识别中…" });
      const ocrPrompt = `这是一页漫画，请识别图中所有文字气泡/对话框中的${langFrom}文字，翻译为${langTo}。按顺序列出每个气泡的原文和译文，格式：\n气泡1：原文｜译文\n气泡2：原文｜译文\n...`;
      // No `model` here: chatCompletion owns the multimodal default, so the model id
      // lives in one place instead of being pinned at each call site.
      const translation = await chatCompletion({
        signal,
        messages: [
          {
            role: "user",
            content: [
              { type: "image_url", image_url: { url: page.src } },
              { type: "text", text: ocrPrompt },
            ],
          },
        ],
      });
      updateResult(page.id, "translatePages", { translation, step: "嵌字中…" });

      const embedPrompt = `将这张漫画中的所有文字替换为以下${langTo}翻译，保持气泡位置和大小不变，字体清晰可读：\n${translation}`;
      const data = await editImages({
        prompt: embedPrompt,
        images: [page.src],
        n: 1,
        model,
        signal,
      });
      const img = data[0];
      if (!img?.url) throw new Error("API 未返回图片");
      updateResult(page.id, "translatePages", { resultUrl: img.url });
      const persistence = await attemptPersistence(() =>
        addGalleryFromUrl(img.url, {
          prompt: embedPrompt,
          model,
          sceneName: "漫画翻译",
          type: "image",
          provider: providerLabel(currentProvider()),
        }),
      );
      return persistence.saved ? {} : { saveError: persistence.error.message };
    },
    [langFrom, langTo, model],
  );

  const { pages, running, run, cancel, concurrency } = useComicBatch({
    pagesKey: "translatePages",
    runningKey: "translateRunning",
    label: "翻译",
    process,
  });

  const rerunAll = shouldOfferRerunAll(pages);
  const queued = rerunAll ? pages.length : pagesToRun(pages).length;

  const handleRun = () => {
    if (!pages.length) return toast.error("请先上传漫画页");
    if (!langFrom.trim() || !langTo.trim()) return toast.error("请填写源语言和目标语言");
    void run(rerunAll ? pages : undefined);
  };

  const download = async () => {
    const ok = pages.filter((p) => p.resultUrl);
    if (!ok.length) return toast.error("没有可下载的结果");
    const prefix = (i: number) => String(i + 1).padStart(2, "0");
    const { failed } = await downloadAllAsZip(
      ok.map((p, i) => ({
        url: p.resultUrl!,
        filename: `${prefix(i)}-${resultFileName(p.name, "translated")}`,
      })),
      `comic-translated-${Date.now()}.zip`,
      ok
        .filter((p) => p.translation)
        .map((p, i) => ({
          filename: `${prefix(i)}-${translationFileName(p.name)}`,
          content: p.translation!,
        })),
    );
    if (failed) toast.warning(`压缩包已生成，但 ${failed} 张结果获取失败`);
  };

  return (
    <>
      <PanelLayout
        main={
          <>
            <PageUploader
              pages={pages}
              onChange={(p) => set({ translatePages: p })}
              disabled={running}
            />
            <BatchQueue
              pages={pages}
              running={running}
              concurrency={concurrency}
              onPreview={(p) => setReadId(p.id)}
              onRetry={(p) => void run([p])}
              onRetryFailed={() => void run(failedPages(pages))}
              emptyHint="上传漫画页并选择语言，开始批量翻译吧。"
            />
            <RunBar
              running={running}
              queued={queued}
              rerunAll={rerunAll}
              hasResults={pages.some((p) => p.resultUrl)}
              canRead={isReadable(pages)}
              labels={{
                idle: "开始批量翻译",
                busy: "翻译中…",
                rerun: "全部重新翻译",
                download: "打包下载（含译文 txt）",
              }}
              onRun={handleRun}
              onCancel={cancel}
              onDownload={() => void download()}
              onRead={() => setReadId(pages[0]?.id ?? null)}
            />
          </>
        }
        aside={
          <>
            <h2 className="font-display text-sm font-semibold tracking-tight">参数</h2>
            <LangPicker
              from={langFrom}
              to={langTo}
              onFrom={(v) => set({ langFrom: v })}
              onTo={(v) => set({ langTo: v })}
              disabled={running}
            />
            <ImageModelSelect value={model} onChange={(v) => set({ model: v })} />
            <p className="rounded-lg border border-border/60 bg-surface/50 p-2.5 text-[11px] leading-relaxed text-muted-foreground">
              每页两步：先用多模态模型识别并翻译气泡文字，再用图片编辑模型把译文嵌回原图。
              因此翻译的请求数是页数的两倍。
            </p>
          </>
        }
      />
      <ComicReader
        pages={pages}
        openId={readId}
        onClose={() => setReadId(null)}
        suffix="translated"
      />
    </>
  );
}

/**
 * Write intermediate results straight to the store.
 *
 * `process` reports only the gallery outcome to the batch hook, but a two-step job
 * has milestones worth showing before it returns — the recognised text, the step
 * label, the image that arrived. Reaching for the store here keeps those immediate
 * without widening the hook's contract for one caller.
 */
function updateResult(
  id: string,
  key: "colorPages" | "translatePages",
  patch: Partial<ComicPageItem>,
) {
  useAppStore.getState().patchComic((s) => ({
    ...s,
    [key]: s[key].map((p) => (p.id === id ? { ...p, ...patch } : p)),
  }));
}
