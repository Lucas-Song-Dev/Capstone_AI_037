'use client';

import { CardDescription } from '@/components/ui/card';
import { HelpTooltip } from '@/components/HelpTooltip';
import { cn } from '@/lib/utils';

/** Split plain prose into sentences (., !, ? followed by whitespace). */
export function splitSentences(text: string): string[] {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (!normalized) return [];
  const parts = normalized
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  return parts.length ? parts : [normalized];
}

type Variant = 'card' | 'plain' | 'note';

const variantClass: Record<Variant, string> = {
  card: '',
  plain: 'text-sm text-muted-foreground',
  note: 'text-xs text-muted-foreground',
};

/**
 * Card or paragraph description: if text is more than two sentences, show the first two
 * inline and the full text in a help tooltip.
 */
export function DescriptionWithTooltip({
  text,
  className,
  label = 'Full description',
  variant = 'card',
  contentClassName,
  'data-tutorial': dataTutorial,
}: {
  text: string;
  className?: string;
  label?: string;
  variant?: Variant;
  contentClassName?: string;
  'data-tutorial'?: string;
}) {
  const sentences = splitSentences(text);
  const tip = (
    <HelpTooltip
      label={label}
      triggerClassName="shrink-0 mt-0.5"
      contentClassName={cn('max-w-sm', contentClassName)}
    >
      <p className="text-sm whitespace-pre-wrap">{text}</p>
    </HelpTooltip>
  );

  if (sentences.length <= 2) {
    if (variant === 'card') {
      return (
        <CardDescription className={className} data-tutorial={dataTutorial}>
          {text}
        </CardDescription>
      );
    }
    return (
      <p className={cn(variantClass[variant], className)} data-tutorial={dataTutorial}>
        {text}
      </p>
    );
  }

  const visible = `${sentences[0]} ${sentences[1]}`.trim();

  if (variant === 'card') {
    return (
      <div className={cn('flex items-start gap-2 pt-1', className)} data-tutorial={dataTutorial}>
        <CardDescription className="text-xs flex-1 mb-0">{visible}</CardDescription>
        {tip}
      </div>
    );
  }

  return (
    <div className={cn('flex items-start gap-2', className)} data-tutorial={dataTutorial}>
      <p className={cn(variantClass[variant], 'flex-1 leading-relaxed')}>{visible}</p>
      {tip}
    </div>
  );
}

/** Slider / field hint line: same sentence rule as descriptions. */
export function HintWithTooltip({ text, className }: { text: string; className?: string }) {
  const sentences = splitSentences(text);
  if (sentences.length <= 2) {
    return <p className={cn('text-xs text-muted-foreground leading-snug', className)}>{text}</p>;
  }
  const visible = `${sentences[0]} ${sentences[1]}`.trim();
  return (
    <div className={cn('flex items-start gap-1.5', className)}>
      <p className="text-xs text-muted-foreground leading-snug flex-1">{visible}</p>
      <HelpTooltip label="Full hint" triggerClassName="shrink-0 mt-0.5" contentClassName="max-w-sm">
        <p className="text-sm whitespace-pre-wrap">{text}</p>
      </HelpTooltip>
    </div>
  );
}
