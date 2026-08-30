import * as React from "react";
import * as SliderPrimitive from "@radix-ui/react-slider";

import { cn } from "@/lib/utils";

/**
 * The accessible name goes on the thumb, not the root.
 *
 * Radix puts `role="slider"`, `tabIndex` and the arrow-key handling on the thumb;
 * the root is a plain span. An `aria-label` passed straight through landed on that
 * span, so the control a screen reader announces had no name, and
 * `getByRole("slider", {name})` matched nothing. Worse, `getByLabel` *did* match —
 * the unfocusable wrapper — so a keyboard test could find the element, press a key
 * and silently do nothing.
 *
 * Only the single-thumb case is handled: one name cannot describe two thumbs, and a
 * range slider would need a thumb per value anyway.
 */
const Slider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root>
>(({ className, "aria-label": ariaLabel, "aria-labelledby": ariaLabelledby, ...props }, ref) => (
  <SliderPrimitive.Root
    ref={ref}
    className={cn("relative flex w-full touch-none select-none items-center", className)}
    {...props}
  >
    <SliderPrimitive.Track className="relative h-1.5 w-full grow overflow-hidden rounded-full bg-primary/20">
      <SliderPrimitive.Range className="absolute h-full bg-primary" />
    </SliderPrimitive.Track>
    <SliderPrimitive.Thumb
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledby}
      className="block h-4 w-4 rounded-full border border-primary/50 bg-background shadow transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
    />
  </SliderPrimitive.Root>
));
Slider.displayName = SliderPrimitive.Root.displayName;

export { Slider };
