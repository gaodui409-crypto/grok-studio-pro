import { useRef, useState } from "react";
import { Upload, X } from "lucide-react";
import { fileToDataUri } from "@/lib/xai";
import { cn } from "@/lib/utils";

export function ImageUpload({
  values,
  onChange,
  max = 1,
  label = "点击或拖拽上传图片",
}: {
  values: string[];
  onChange: (v: string[]) => void;
  max?: number;
  label?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const full = values.length >= max;

  const handleFiles = async (files: FileList | null) => {
    if (!files) return;
    const arr = Array.from(files).slice(0, max - values.length);
    const uris = await Promise.all(arr.map(fileToDataUri));
    onChange([...values, ...uris].slice(0, max));
  };

  const remove = (i: number) => onChange(values.filter((_, idx) => idx !== i));

  return (
    <div className="space-y-3">
      {/* A real button, not a div with onClick. As a div it had no role, no
          accessible name and no tab stop, so upload was mouse-only. The file
          input is a sibling rather than a child: an <input> inside a <button> is
          not valid, and clicking the label would have double-fired. */}
      <button
        type="button"
        disabled={full}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          if (!full) setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          if (!full) void handleFiles(e.dataTransfer.files);
        }}
        className={cn(
          "flex w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border/70 bg-surface/50 px-4 py-8 text-center transition hover:border-primary/60 hover:bg-surface focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
          drag && "border-primary bg-accent/30",
          full && "cursor-not-allowed opacity-60 hover:border-border/70 hover:bg-surface/50",
        )}
      >
        <Upload className="h-6 w-6 text-muted-foreground" aria-hidden />
        <span className="text-sm text-muted-foreground">{full ? `已达上限 ${max} 张` : label}</span>
        <span className="text-xs text-muted-foreground/70">
          {values.length}/{max} · PNG / JPG / WEBP
        </span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple={max > 1}
        className="hidden"
        onChange={(e) => {
          void handleFiles(e.target.files);
          // Without this, picking the same file after removing it is a no-op:
          // the value has not changed, so no change event fires.
          e.target.value = "";
        }}
      />

      {values.length > 0 && (
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
          {values.map((v, i) => (
            <li
              key={i}
              className="group relative overflow-hidden rounded-lg border border-border/60 bg-surface/60"
            >
              {/* object-contain: these thumbnails exist to confirm *which* image
                  was uploaded, and a square crop of a tall image can hide the
                  part that distinguishes it from the others. */}
              <img
                src={v}
                alt={`已上传的参考图 ${i + 1}`}
                className="aspect-square w-full object-contain"
              />
              <button
                type="button"
                aria-label={`移除参考图 ${i + 1}`}
                onClick={(e) => {
                  e.stopPropagation();
                  remove(i);
                }}
                className="absolute right-1 top-1 rounded-full bg-background/80 p-1 opacity-0 transition focus-visible:opacity-100 group-hover:opacity-100"
              >
                <X className="h-3 w-3" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
