import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";

/**
 * Password-style input with a per-field reveal toggle.
 *
 * Each instance owns its own visibility state. The settings page previously
 * shared one `showKey` flag across every credential field, which meant
 * revealing one key revealed all of them — and the ModelScope field consumed
 * that flag without rendering a toggle, so its value could never be shown.
 */
export function SecretInput({
  value,
  onChange,
  placeholder,
  label = "凭证",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /**
   * Names both the field and its toggle ("显示 xAI API Key").
   *
   * The input carries it as aria-label because the visible <Label> beside it is
   * not associated via htmlFor — without this, a screen reader announces these
   * credential fields as an unlabelled text box.
   */
  label?: string;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <Input
        type={visible ? "text" : "password"}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={label}
        className="pr-10 font-mono"
        autoComplete="off"
        spellCheck={false}
      />
      <button
        type="button"
        onClick={() => setVisible((current) => !current)}
        aria-label={`${visible ? "隐藏" : "显示"}${label}`}
        aria-pressed={visible}
        className="absolute right-0.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded text-muted-foreground hover:text-foreground"
      >
        {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}
