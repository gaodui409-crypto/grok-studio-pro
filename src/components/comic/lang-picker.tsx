import { ArrowLeftRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { LANGS } from "@/lib/comic-batch";

const CUSTOM_LANG = "自定义";

/**
 * Source → target as two Selects with a swap button.
 *
 * Replaces a single list of four fixed pairs. Those pairs could not express
 * 日语 → 英语 at all, and picking "自定义…" opened two further inputs below, so the
 * common case and the general case looked like two different features. Any pair is
 * now two picks, and a custom language is one option inside the same control.
 */
export function LangPicker({
  from,
  to,
  onFrom,
  onTo,
  disabled,
}: {
  from: string;
  to: string;
  onFrom: (v: string) => void;
  onTo: (v: string) => void;
  disabled?: boolean;
}) {
  const isCustom = (v: string) => !LANGS.includes(v);

  const field = (
    which: "from" | "to",
    value: string,
    onChange: (v: string) => void,
    label: string,
  ) => {
    const custom = isCustom(value);
    return (
      <div className="min-w-0 flex-1 space-y-1.5">
        <Label
          htmlFor={`lang-${which}`}
          className="text-xs uppercase tracking-wider text-muted-foreground"
        >
          {label}
        </Label>
        <Select
          value={custom ? CUSTOM_LANG : value}
          onValueChange={(v) => onChange(v === CUSTOM_LANG ? "" : v)}
          disabled={disabled}
        >
          <SelectTrigger id={`lang-${which}`} aria-label={label}>
            <SelectValue placeholder="选择语言" />
          </SelectTrigger>
          <SelectContent>
            {LANGS.map((l) => (
              <SelectItem key={l} value={l}>
                {l}
              </SelectItem>
            ))}
            <SelectItem value={CUSTOM_LANG}>自定义…</SelectItem>
          </SelectContent>
        </Select>
        {custom && (
          <Input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            aria-label={`${label}（自定义）`}
            placeholder="语言名称"
          />
        )}
      </div>
    );
  };

  return (
    <div className="space-y-2">
      <div className="flex items-start gap-2">
        {field("from", from, onFrom, "源语言")}
        {/* Spacer mirrors the label above the Selects so the button lines up with the
            triggers, rather than being pushed down by a hand-measured margin. */}
        <div className="shrink-0 space-y-1.5">
          <span className="block text-xs" aria-hidden>
            &nbsp;
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={disabled}
            aria-label="交换源语言和目标语言"
            onClick={() => {
              onFrom(to);
              onTo(from);
            }}
            className="h-9 w-9 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeftRight className="h-4 w-4" aria-hidden />
          </Button>
        </div>
        {field("to", to, onTo, "目标语言")}
      </div>
      <p className="text-[11px] text-muted-foreground">
        {from && to ? `${from} → ${to}` : "请选择两端语言"}
      </p>
    </div>
  );
}
