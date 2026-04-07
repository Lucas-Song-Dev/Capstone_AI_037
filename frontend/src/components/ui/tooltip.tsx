import * as React from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";

import { cn } from "@/lib/utils";

const TooltipProvider = TooltipPrimitive.Provider;

const Tooltip = TooltipPrimitive.Root;

const TooltipTrigger = TooltipPrimitive.Trigger;

/**
 * Radix TooltipTrigger closes on pointerdown (when open) and on click by default.
 * Use with controlled `<Tooltip open={open} onOpenChange={setOpen}>` so hover still
 * drives open/close via Radix, while click opens (or keeps open) instead of dismissing.
 */
export function useTooltipStayOpenOnClick() {
  const [open, setOpen] = React.useState(false);
  const triggerProps = React.useMemo(
    () => ({
      onPointerDown: (e: React.PointerEvent<HTMLElement>) => {
        if (open) e.preventDefault();
      },
      onClick: (e: React.MouseEvent<HTMLElement>) => {
        e.preventDefault();
        setOpen(true);
      },
    }),
    [open]
  );
  return { open, onOpenChange: setOpen, triggerProps };
}

const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 4, ...props }, ref) => (
  <TooltipPrimitive.Content
    ref={ref}
    sideOffset={sideOffset}
    className={cn(
      "",
      className,
    )}
    {...props}
  />
));
TooltipContent.displayName = TooltipPrimitive.Content.displayName;

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider };
