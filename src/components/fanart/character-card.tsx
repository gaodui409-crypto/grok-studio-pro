import { UserCircle2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ImageUpload } from "@/components/image-upload";
import { SectionCard } from "./section-card";
import { BUILTIN_PRESETS, type CharacterPreset } from "@/lib/character-presets";

export function CharacterCard({
  step,
  presetId,
  charName,
  charDesc,
  refImages,
  customPresets,
  onApplyPreset,
  onChange,
}: {
  step: number;
  presetId: string;
  charName: string;
  charDesc: string;
  refImages: string[];
  customPresets: CharacterPreset[];
  onApplyPreset: (id: string) => void;
  onChange: (patch: { charName?: string; charDesc?: string; refImages?: string[] }) => void;
}) {
  return (
    <SectionCard step={step} title="角色设定" hint="预设可在「设置 · 角色预设」中管理">
      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label
              htmlFor="fanart-preset"
              className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-muted-foreground"
            >
              <UserCircle2 className="h-3.5 w-3.5" aria-hidden /> 角色预设
            </Label>
            <Select
              value={presetId || "__custom"}
              onValueChange={(v) => onApplyPreset(v === "__custom" ? "" : v)}
            >
              <SelectTrigger id="fanart-preset">
                <SelectValue placeholder="选择内置或自定义角色" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__custom">自定义角色（手动填写）</SelectItem>
                {BUILTIN_PRESETS.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    ★ {p.name}
                  </SelectItem>
                ))}
                {customPresets.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label
              htmlFor="fanart-charname"
              className="text-xs uppercase tracking-wider text-muted-foreground"
            >
              角色名
            </Label>
            <Input
              id="fanart-charname"
              value={charName}
              onChange={(e) => onChange({ charName: e.target.value })}
              placeholder="例如：白雪"
            />
            <p className="text-xs text-muted-foreground">用于画廊按角色筛选，可留空</p>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label
            htmlFor="fanart-chardesc"
            className="text-xs uppercase tracking-wider text-muted-foreground"
          >
            角色描述
          </Label>
          <Textarea
            id="fanart-chardesc"
            value={charDesc}
            onChange={(e) => onChange({ charDesc: e.target.value })}
            placeholder="例如：银发红瞳的少女，气质冷艳，腰间别着短刃"
            className="min-h-[90px] resize-none bg-background/60"
          />
          {/* Says required because handleRun refuses to start without it. The
              old version left that rule undiscoverable until the button failed. */}
          <p className="text-xs text-muted-foreground">必填，会作为每条提示词的开头</p>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">
            角色参考图
          </Label>
          <ImageUpload
            values={refImages}
            onChange={(v) => onChange({ refImages: v })}
            max={3}
            // Selecting reference images silently switches the whole batch from
            // text-to-image to image-editing, which changes what the channel has
            // to support. Saying so here beats discovering it from a failure.
          />
          <p className="text-xs text-muted-foreground">
            选填，最多 3 张。传了参考图会改用「图生图」，只有支持图生图的渠道能跑
          </p>
        </div>
      </div>
    </SectionCard>
  );
}
