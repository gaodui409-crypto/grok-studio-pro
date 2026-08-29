import { createFileRoute } from "@tanstack/react-router";
import { useRef } from "react";
import {
  BookOpen,
  Sparkles,
  Loader2,
  Download,
  Upload,
  X,
  ArrowUp,
  ArrowDown,
  Eye,
} from "lucide-react";
import { toast } from "sonner";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { PageHeader } from "@/components/page-header";
import { ApiKeyBanner } from "@/components/api-key-banner";
import { ProviderUnsupportedBanner } from "@/components/provider-banner";
import { ImageUpload } from "@/components/image-upload";
import { ImageModelSelect } from "@/components/param-selects";
import { useSettings } from "@/hooks/use-settings";
import {
  editImages,
  chatCompletion,
  fileToDataUri,
  currentProvider,
  providerLabel,
} from "@/lib/xai";
import { addGalleryFromUrl } from "@/lib/gallery-db";
import { runWithConcurrency } from "@/lib/concurrency";
import { useAppStore, type ComicPageItem } from "@/lib/app-store";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { attemptPersistence } from "@/lib/persistence";
import { fetchBlobChecked } from "@/lib/http";

export const Route = createFileRoute("/comic")({
  head: () => ({
    meta: [
      { title: "漫画工具 — Grok Studio" },
      { name: "description", content: "漫画批量上色与翻译，自动保存到画廊。" },
    ],
  }),
  component: ComicPage,
});

const COLOR_STYLES = [
  "日系动漫上色",
  "美漫浓郁上色",
  "水彩柔和上色",
  "写实风格上色",
  "赛璐璐平涂上色",
];

const LANG_PRESETS = [
  { from: "日语", to: "中文" },
  { from: "英语", to: "中文" },
  { from: "韩语", to: "中文" },
  { from: "中文", to: "英语" },
];

function ComicPage() {
  const c = useAppStore((s) => s.comic);
  const set = useAppStore((s) => s.setComic);

  return (
    <div className="mx-auto max-w-[1500px] px-4 py-8 md:px-8">
      <PageHeader
        title="漫画工具"
        description="批量上色 / 多语翻译，左右对比，结果自动入库画廊。"
        icon={BookOpen}
      />
      <ApiKeyBanner />
      <ProviderUnsupportedBanner feature="i2i" />

      <Tabs
        value={c.tab}
        onValueChange={(v) => set({ tab: v as "colorize" | "translate" })}
        className="mb-4"
      >
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="colorize">漫画上色</TabsTrigger>
          <TabsTrigger value="translate">漫画翻译</TabsTrigger>
        </TabsList>
        <TabsContent value="colorize" className="mt-4">
          <ColorizePanel />
        </TabsContent>
        <TabsContent value="translate" className="mt-4">
          <TranslatePanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ======================= Shared page list UI =======================

function PageList({
  pages,
  onChange,
  onPreview,
}: {
  pages: ComicPageItem[];
  onChange: (p: ComicPageItem[]) => void;
  onPreview: (p: ComicPageItem) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    const arr = Array.from(files);
    const newPages: ComicPageItem[] = await Promise.all(
      arr.map(async (f) => ({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        name: f.name,
        src: await fileToDataUri(f),
        status: "pending" as const,
      })),
    );
    onChange([...pages, ...newPages]);
  };

  const move = (idx: number, dir: -1 | 1) => {
    const next = [...pages];
    const t = idx + dir;
    if (t < 0 || t >= next.length) return;
    [next[idx], next[t]] = [next[t], next[idx]];
    onChange(next);
  };

  const remove = (idx: number) => onChange(pages.filter((_, i) => i !== idx));

  return (
    <div className="space-y-3">
      <div
        onClick={() => inputRef.current?.click()}
        className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-border/70 bg-surface/50 px-4 py-6 text-center hover:border-primary/60"
      >
        <Upload className="h-5 w-5 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">点击上传漫画页（可多选，按上传顺序）</p>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      {pages.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {pages.map((p, i) => (
            <div
              key={p.id}
              className={cn(
                "group relative overflow-hidden rounded-xl border bg-card",
                p.status === "done" && "border-success/60",
                p.status === "running" && "border-primary/60",
                p.status === "failed" && "border-destructive/60",
                p.status === "pending" && "border-border/60",
              )}
            >
              <div className="grid grid-cols-2">
                <img src={p.src} alt="原图" className="aspect-square w-full object-cover" />
                {p.resultUrl ? (
                  <img src={p.resultUrl} alt="结果" className="aspect-square w-full object-cover" />
                ) : (
                  <div className="aspect-square w-full bg-surface/60 flex items-center justify-center text-[11px] text-muted-foreground">
                    {p.status === "running" ? (p.step ?? "处理中…") : "未处理"}
                  </div>
                )}
              </div>
              <div className="flex items-center justify-between p-2 text-[11px]">
                <span className="truncate text-muted-foreground">
                  #{i + 1} · {p.name}
                </span>
                <div className="flex items-center gap-1">
                  {p.translation && (
                    <button onClick={() => onPreview(p)} className="opacity-70 hover:opacity-100">
                      <Eye className="h-3.5 w-3.5" />
                    </button>
                  )}
                  <button onClick={() => move(i, -1)} className="opacity-70 hover:opacity-100">
                    <ArrowUp className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => move(i, 1)} className="opacity-70 hover:opacity-100">
                    <ArrowDown className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => remove(i)} className="opacity-70 hover:text-destructive">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              {p.status === "failed" && p.error && (
                <p className="px-2 pb-2 text-[10px] text-destructive truncate">{p.error}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ======================= Colorize panel =======================

function ColorizePanel() {
  const { settings } = useSettings();
  const c = useAppStore((s) => s.comic);
  const set = useAppStore((s) => s.setComic);
  const patch = useAppStore((s) => s.patchComic);
  const [previewPage, setPreviewPage] = useState<ComicPageItem | null>(null);

  const {
    colorPages: pages,
    styleSel,
    customStyle,
    refImage,
    colorRunning: running,
    colorDone: done,
    model,
  } = c;
  const styleText = styleSel === "自定义" ? customStyle.trim() : styleSel;

  const updatePage = (id: string, p: Partial<ComicPageItem>) =>
    patch((s) => ({
      ...s,
      colorPages: s.colorPages.map((x) => (x.id === id ? { ...x, ...p } : x)),
    }));

  const handleRun = async () => {
    if (!pages.length) return toast.error("请上传漫画页");
    if (!styleText) return toast.error("请选择或输入上色风格");
    set({ colorRunning: true, colorDone: 0 });
    patch((s) => ({
      ...s,
      colorPages: s.colorPages.map((p) => ({
        ...p,
        status: "pending",
        resultUrl: undefined,
        error: undefined,
      })),
    }));
    let unsaved = 0;
    const saveErrors: string[] = [];

    await runWithConcurrency(
      pages,
      async (page) => {
        updatePage(page.id, { status: "running", step: "上色中…" });
        try {
          const basePrompt = refImage.length
            ? `参考 <IMAGE_1> 的配色风格，为 <IMAGE_0> 这张黑白漫画上色，使用${styleText}，保持原画的线条和构图不变`
            : `为这张黑白漫画上色，使用${styleText}，保持原画的线条和构图不变，色彩自然协调`;
          const images = refImage.length ? [page.src, refImage[0]] : [page.src];
          const data = await editImages({ prompt: basePrompt, images, n: 1, model });
          const img = data[0];
          if (!img?.url) throw new Error("API 未返回图片");
          updatePage(page.id, { status: "done", resultUrl: img.url });
          const persistence = await attemptPersistence(() =>
            addGalleryFromUrl(img.url, {
              prompt: basePrompt,
              model,
              sceneName: "漫画上色",
              type: "image",
              provider: providerLabel(currentProvider()),
            }),
          );
          if (!persistence.saved) {
            unsaved++;
            saveErrors.push(`${page.name}: ${persistence.error.message}`);
          }
        } catch (e) {
          updatePage(page.id, { status: "failed", error: (e as Error).message });
          toast.error(`第 ${page.name} 失败：${(e as Error).message}`);
        } finally {
          patch((s) => ({ ...s, colorDone: s.colorDone + 1 }));
        }
      },
      settings.concurrency,
    );

    set({ colorRunning: false });
    if (unsaved) {
      toast.warning(`上色任务完成，但 ${unsaved} 张未保存到画廊：${saveErrors[0]}`);
    } else {
      toast.success("上色任务完成并已保存到画廊");
    }
  };

  const downloadAll = async () => {
    const okPages = pages.filter((p) => p.resultUrl);
    if (!okPages.length) return toast.error("没有可下载结果");
    const zip = new JSZip();
    let failed = 0;
    for (const p of okPages) {
      try {
        const blob = await fetchBlobChecked(p.resultUrl!);
        zip.file(`${p.name.replace(/\.[^.]+$/, "")}-colored.png`, blob);
      } catch {
        failed++;
      }
    }
    const blob = await zip.generateAsync({ type: "blob" });
    saveAs(blob, `comic-colorized-${Date.now()}.zip`);
    if (failed) toast.warning(`压缩包已生成，但 ${failed} 个结果获取失败`);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-5 rounded-2xl border border-border/60 bg-card p-5 shadow-card">
        <PageList
          pages={pages}
          onChange={(p) => set({ colorPages: p })}
          onPreview={setPreviewPage}
        />

        {(running || done > 0) && (
          <div className="space-y-2 rounded-xl border border-border/60 bg-surface/60 p-3 text-sm">
            <div className="flex justify-between">
              <span>
                进度：{done} / {pages.length} · 并发 {settings.concurrency}
              </span>
              <span className="font-mono text-primary-glow">
                {pages.length ? Math.round((done / pages.length) * 100) : 0}%
              </span>
            </div>
            <Progress value={pages.length ? (done / pages.length) * 100 : 0} />
          </div>
        )}

        <div className="flex flex-wrap justify-end gap-2">
          <Button
            variant="secondary"
            disabled={!pages.some((p) => p.resultUrl)}
            onClick={downloadAll}
          >
            <Download className="mr-2 h-4 w-4" /> 打包下载
          </Button>
          <Button
            onClick={handleRun}
            disabled={running}
            className="bg-gradient-primary text-primary-foreground shadow-glow"
          >
            {running ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="mr-2 h-4 w-4" />
            )}
            {running ? "上色中…" : "开始上色"}
          </Button>
        </div>
      </div>

      <aside className="space-y-4 rounded-2xl border border-border/60 bg-card p-5 shadow-card">
        <h3 className="font-display text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          参数
        </h3>
        <div className="space-y-1.5">
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">上色风格</Label>
          <Select value={styleSel} onValueChange={(v) => set({ styleSel: v })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {COLOR_STYLES.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
              <SelectItem value="自定义">自定义…</SelectItem>
            </SelectContent>
          </Select>
          {styleSel === "自定义" && (
            <Input
              value={customStyle}
              onChange={(e) => set({ customStyle: e.target.value })}
              placeholder="例如：90 年代港漫复古色"
            />
          )}
        </div>
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
        </div>
        <ImageModelSelect value={model} onChange={(v) => set({ model: v })} />
      </aside>

      <PreviewDialog page={previewPage} onClose={() => setPreviewPage(null)} />
    </div>
  );
}

// ======================= Translate panel =======================

function TranslatePanel() {
  const { settings } = useSettings();
  const c = useAppStore((s) => s.comic);
  const set = useAppStore((s) => s.setComic);
  const patch = useAppStore((s) => s.patchComic);
  const [previewPage, setPreviewPage] = useState<ComicPageItem | null>(null);

  const {
    translatePages: pages,
    preset,
    customFrom,
    customTo,
    translateRunning: running,
    translateDone: done,
    model,
  } = c;
  const langs =
    preset === "custom"
      ? { from: customFrom.trim(), to: customTo.trim() }
      : LANG_PRESETS[Number(preset)];

  const updatePage = (id: string, p: Partial<ComicPageItem>) =>
    patch((s) => ({
      ...s,
      translatePages: s.translatePages.map((x) => (x.id === id ? { ...x, ...p } : x)),
    }));

  const handleRun = async () => {
    if (!pages.length) return toast.error("请上传漫画页");
    if (!langs.from || !langs.to) return toast.error("请填写源语言和目标语言");
    set({ translateRunning: true, translateDone: 0 });
    patch((s) => ({
      ...s,
      translatePages: s.translatePages.map((p) => ({
        ...p,
        status: "pending",
        resultUrl: undefined,
        translation: undefined,
        error: undefined,
      })),
    }));
    let unsaved = 0;
    const saveErrors: string[] = [];

    await runWithConcurrency(
      pages,
      async (page) => {
        try {
          updatePage(page.id, { status: "running", step: "识别中…" });
          const ocrPrompt = `这是一页漫画，请识别图中所有文字气泡/对话框中的${langs.from}文字，翻译为${langs.to}。按顺序列出每个气泡的原文和译文，格式：\n气泡1：原文｜译文\n气泡2：原文｜译文\n...`;
          const translation = await chatCompletion({
            model: "grok-4.20-0309-non-reasoning",
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
          updatePage(page.id, { translation, step: "嵌入中…" });

          const embedPrompt = `将这张漫画中的所有文字替换为以下${langs.to}翻译，保持气泡位置和大小不变，字体清晰可读：\n${translation}`;
          const data = await editImages({ prompt: embedPrompt, images: [page.src], n: 1, model });
          const img = data[0];
          if (!img?.url) throw new Error("API 未返回图片");
          updatePage(page.id, { status: "done", resultUrl: img.url, step: "完成" });
          const persistence = await attemptPersistence(() =>
            addGalleryFromUrl(img.url, {
              prompt: embedPrompt,
              model,
              sceneName: "漫画翻译",
              type: "image",
              provider: providerLabel(currentProvider()),
            }),
          );
          if (!persistence.saved) {
            unsaved++;
            saveErrors.push(`${page.name}: ${persistence.error.message}`);
          }
        } catch (e) {
          updatePage(page.id, { status: "failed", error: (e as Error).message });
          toast.error(`${page.name} 失败：${(e as Error).message}`);
        } finally {
          patch((s) => ({ ...s, translateDone: s.translateDone + 1 }));
        }
      },
      settings.concurrency,
    );

    set({ translateRunning: false });
    if (unsaved) {
      toast.warning(`翻译任务完成，但 ${unsaved} 张未保存到画廊：${saveErrors[0]}`);
    } else {
      toast.success("翻译任务完成并已保存到画廊");
    }
  };

  const downloadAll = async () => {
    const okPages = pages.filter((p) => p.resultUrl);
    if (!okPages.length) return toast.error("没有可下载结果");
    const zip = new JSZip();
    let failed = 0;
    for (const p of okPages) {
      try {
        const blob = await fetchBlobChecked(p.resultUrl!);
        zip.file(`${p.name.replace(/\.[^.]+$/, "")}-translated.png`, blob);
        if (p.translation) {
          zip.file(`${p.name.replace(/\.[^.]+$/, "")}-translation.txt`, p.translation);
        }
      } catch {
        failed++;
      }
    }
    const blob = await zip.generateAsync({ type: "blob" });
    saveAs(blob, `comic-translated-${Date.now()}.zip`);
    if (failed) toast.warning(`压缩包已生成，但 ${failed} 个结果获取失败`);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-5 rounded-2xl border border-border/60 bg-card p-5 shadow-card">
        <PageList
          pages={pages}
          onChange={(p) => set({ translatePages: p })}
          onPreview={setPreviewPage}
        />

        {(running || done > 0) && (
          <div className="space-y-2 rounded-xl border border-border/60 bg-surface/60 p-3 text-sm">
            <div className="flex justify-between">
              <span>
                进度：{done} / {pages.length} · 并发 {settings.concurrency}
              </span>
              <span className="font-mono text-primary-glow">
                {pages.length ? Math.round((done / pages.length) * 100) : 0}%
              </span>
            </div>
            <Progress value={pages.length ? (done / pages.length) * 100 : 0} />
          </div>
        )}

        <div className="flex flex-wrap justify-end gap-2">
          <Button
            variant="secondary"
            disabled={!pages.some((p) => p.resultUrl)}
            onClick={downloadAll}
          >
            <Download className="mr-2 h-4 w-4" /> 打包下载（含译文 txt）
          </Button>
          <Button
            onClick={handleRun}
            disabled={running}
            className="bg-gradient-primary text-primary-foreground shadow-glow"
          >
            {running ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="mr-2 h-4 w-4" />
            )}
            {running ? "翻译中…" : "开始翻译"}
          </Button>
        </div>
      </div>

      <aside className="space-y-4 rounded-2xl border border-border/60 bg-card p-5 shadow-card">
        <h3 className="font-display text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          参数
        </h3>
        <div className="space-y-1.5">
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">语言</Label>
          <Select value={preset} onValueChange={(v) => set({ preset: v })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LANG_PRESETS.map((l, i) => (
                <SelectItem key={i} value={String(i)}>
                  {l.from} → {l.to}
                </SelectItem>
              ))}
              <SelectItem value="custom">自定义…</SelectItem>
            </SelectContent>
          </Select>
          {preset === "custom" && (
            <div className="grid grid-cols-2 gap-2 pt-2">
              <Input
                value={customFrom}
                onChange={(e) => set({ customFrom: e.target.value })}
                placeholder="源语言"
              />
              <Input
                value={customTo}
                onChange={(e) => set({ customTo: e.target.value })}
                placeholder="目标语言"
              />
            </div>
          )}
        </div>
        <ImageModelSelect value={model} onChange={(v) => set({ model: v })} />
        <p className="text-[11px] text-muted-foreground">
          先用 grok-4 识别+翻译文字，再用图片编辑模型把译文嵌回原图。每页 2 步。
        </p>
      </aside>

      <PreviewDialog page={previewPage} onClose={() => setPreviewPage(null)} />
    </div>
  );
}

function PreviewDialog({ page, onClose }: { page: ComicPageItem | null; onClose: () => void }) {
  return (
    <Dialog open={!!page} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl border-border/60 bg-background">
        <DialogTitle>识别原文 / 译文对照</DialogTitle>
        {page?.translation ? (
          <Textarea readOnly value={page.translation} className="min-h-[400px] font-mono text-xs" />
        ) : (
          <p className="text-sm text-muted-foreground">该页未生成译文。</p>
        )}
      </DialogContent>
    </Dialog>
  );
}
