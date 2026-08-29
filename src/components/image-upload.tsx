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

  const handleFiles = async (files: FileList | null) => {
    if (!files) return;
    const arr = Array.from(files).slice(0, max - values.length);
    const uris = await Promise.all(arr.map(fileToDataUri));
    onChange([...values, ...uris].slice(0, max));
  };

  const remove = (i: number) => onChange(values.filter((_, idx) => idx !== i));

  return (
    <div className="space-y-3">
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          handleFiles(e.dataTransfer.files);
        }}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border/70 bg-surface/50 px-4 py-8 text-center transition hover:border-primary/60 hover:bg-surface",
          drag && "border-primary bg-accent/30",
        )}
      >
        <Upload className="h-6 w-6 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="text-xs text-muted-foreground/70">
          {values.length}/{max} · PNG / JPG / WEBP
        </p>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple={max > 1}
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      {values.length > 0 && (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
          {values.map((v, i) => (
            <div
              key={i}
              className="group relative overflow-hidden rounded-lg border border-border/60"
            >
              <img src={v} alt="" className="aspect-square w-full object-cover" />
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  remove(i);
                }}
                className="absolute right-1 top-1 rounded-full bg-background/80 p-1 opacity-0 transition group-hover:opacity-100"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
