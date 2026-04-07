'use client';

import type { ComponentProps, ReactNode } from 'react';
import Link from 'next/link';
import { HelpCircle } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  useTooltipStayOpenOnClick,
} from '@/components/ui/tooltip';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const HELP_PANEL_CLASS =
  'max-w-xs border border-border bg-popover p-3 text-popover-foreground shadow-lg';

const HELP_TRIGGER_CLASS =
  'inline-flex items-center rounded-sm cursor-help focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

type TooltipContentProps = ComponentProps<typeof TooltipContent>;

/** Help (?) control + popover — Radix-safe trigger (native button), shared styling for all field hints. */
export function HelpTooltip({
  label,
  children,
  side,
  triggerClassName,
  contentClassName,
}: {
  label: string;
  children: ReactNode;
  side?: TooltipContentProps['side'];
  triggerClassName?: string;
  contentClassName?: string;
}) {
  const { open, onOpenChange, triggerProps } = useTooltipStayOpenOnClick();

  return (
    <Tooltip open={open} onOpenChange={onOpenChange}>
      <TooltipTrigger asChild>
        <button
          type="button"
          className={cn(HELP_TRIGGER_CLASS, triggerClassName)}
          aria-label={label}
          aria-expanded={open}
          {...triggerProps}
        >
          <HelpCircle className="w-4 h-4 text-muted-foreground hover:text-foreground transition-colors" />
        </button>
      </TooltipTrigger>
      <TooltipContent side={side} className={cn(HELP_PANEL_CLASS, contentClassName)}>
        {children}
      </TooltipContent>
    </Tooltip>
  );
}

/** Icon link as tooltip trigger (e.g. header info) — single place for Link + TooltipTrigger + panel styles. */
export function LinkIconTooltip({
  href,
  label,
  icon,
  children,
  side = 'bottom',
  linkClassName,
  contentClassName,
}: {
  href: string;
  label: string;
  icon: ReactNode;
  children: ReactNode;
  side?: TooltipContentProps['side'];
  linkClassName?: string;
  contentClassName?: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Link
          href={href}
          aria-label={label}
          className={cn(buttonVariants({ variant: 'ghost', size: 'icon' }), 'h-8 w-8', linkClassName)}
        >
          {icon}
        </Link>
      </TooltipTrigger>
      <TooltipContent side={side} className={cn(HELP_PANEL_CLASS, contentClassName)}>
        {children}
      </TooltipContent>
    </Tooltip>
  );
}
