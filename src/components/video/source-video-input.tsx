import { useRef, useState } from "react";
import { Film, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** xAI takes 2–15s clips; a data URI much past this is not worth POSTing. */
const MAX_BYTES = 30 * 1024 * 1024;

/**
 * The source clip for 视频编辑 / 视频延长.
 *
 * Was a bare `<Input type="file">` — the browser's default control, the only one
 * on the page, and not droppable, while every other upload in the app is a dashed
 * drop zone. It also had no size guard: the file becomes a base64 data URI in the
 * request body, so a 200MB mp4 turned into a ~270MB JSON POST that would fail
 * after a long silent wait.
 */
export function SourceVideoInput({
  url,
  dataUri,
  name,
  onFile,
  onUrlChange,
  onClear,
}: {
  url: string;
  dataUri: string;
  name: string;
  onFile: (file: File) => void;
  onUrlChange: (next: string) => void;
  onClear: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const accept = (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("video/")) {
      toast.error("请选择 mp4 视频文件");
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error(`视频超过 30MB（${(file.size / 1024 / 1024).toFixed(1)}MB），请先裁剪或压缩`);
      return;
    }
    onFile(file);
  };

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label>源视频（mp4，2–15 秒）</Label>
        {dataUri ? (
          <div className="space-y-2 rounded-xl border border-border/60 bg-surface/60 p-3">
            <div className="flex items-center gap-2">
              <Film className="h-4 w-4 shrink-0 text-primary-glow" aria-hidden />
              <span className="min-w-0 flex-1 truncate text-sm">{name}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={onClear}
                aria-label="移除源视频"
                className="h-7 w-7"
              >
                <X className="h-3.5 w-3.5" aria-hidden />
              </Button>
            </div>
            <video src={dataUri} controls className="w-full rounded-lg" />
          </div>
        ) : (
          <>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                accept(e.dataTransfer.files[0]);
              }}
              className={`flex w-full flex-col items-center gap-1.5 rounded-xl border border-dashed px-4 py-8 transition-colors ${
                dragging
                  ? "border-primary/60 bg-primary/10"
                  : "border-border/60 bg-background/40 hover:border-border"
              }`}
            >
              <Film className="h-6 w-6 text-muted-foreground" aria-hidden />
              <span className="text-sm">拖入视频或点击上传</span>
              <span className="text-[11px] text-muted-foreground">支持 mp4，大小不超过 30MB</span>
            </button>
            {/* Sibling, not nested in the button: a label-wrapped input inside a
                button gives two activation targets for one action. Resetting
                value on every pick means choosing the same file twice fires
                change twice. */}
            <input
              ref={inputRef}
              type="file"
              accept="video/mp4,video/*"
              className="hidden"
              onChange={(e) => {
                accept(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="video-source-url">或粘贴视频 URL</Label>
        <Input
          id="video-source-url"
          value={url}
          onChange={(e) => onUrlChange(e.target.value)}
          placeholder="https://…/video.mp4"
        />
        {/* Which one wins is not guessable, and picking wrong means paying for a
            render of the wrong clip. */}
        {dataUri && url.trim() && (
          <p className="text-[11px] text-warning">
            已上传文件，本次将使用上传的文件而不是这个 URL。
          </p>
        )}
      </div>
    </div>
  );
}
