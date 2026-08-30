import type { ReactNode } from "react";

/**
 * A numbered step in the batch form.
 *
 * The page is a long single-column form — character, scenes, style, lighting,
 * mode, params, cost, run — and unnumbered cards gave no sense of how far along
 * you were or what still needed filling in. Numbering them makes the order
 * explicit, which matters here because the later steps are meaningless until the
 * earlier ones have values.
 *
 * Headings are h2: the page has one h1 in PageHeader, and these are its direct
 * children. They were h3 before, skipping a level for no reason.
 */
export function SectionCard({
  step,
  title,
  hint,
  action,
  children,
}: {
  step: number;
  title: string;
  hint?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border/60 bg-card p-5 shadow-card">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2.5 font-display text-sm font-semibold tracking-tight">
          <span
            aria-hidden
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary/15 font-mono text-xs text-primary-glow"
          >
            {step}
          </span>
          {title}
          {hint && (
            <span className="font-sans text-xs font-normal text-muted-foreground">{hint}</span>
          )}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}
