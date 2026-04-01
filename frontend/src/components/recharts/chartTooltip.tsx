'use client';

import type { CSSProperties, ReactNode } from 'react';
import type { TooltipProps } from 'recharts';

const SHELL: CSSProperties = {
  backgroundColor: 'hsl(222, 47%, 14%)',
  border: '1px solid hsl(217, 32%, 22%)',
  borderRadius: '8px',
  boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
  padding: '8px 12px',
};

const LABEL_STYLE: CSSProperties = {
  color: 'hsl(210, 40%, 98%)',
  fontWeight: 500,
  marginBottom: '4px',
  marginTop: 0,
};

const VALUE_STYLE: CSSProperties = {
  color: 'hsl(210, 40%, 98%)',
  margin: 0,
};

/** Shared Recharts tooltip panel (bar/line/pie) — used anywhere we duplicate the dark popover shell. */
export function ChartTooltipSimple({ title, valueText }: { title: ReactNode; valueText: string }) {
  return (
    <div style={SHELL}>
      <p style={LABEL_STYLE}>{title}</p>
      <p style={VALUE_STYLE}>{valueText}</p>
    </div>
  );
}

/** Factory for Recharts `<Tooltip content={...} />` on bar/line series (label + numeric value line). */
export function makeSeriesTooltipContent(options: { valueDecimals: number; unitSuffix: string }) {
  return function SeriesTooltipContent(
    props: Pick<TooltipProps<number, string>, 'active' | 'payload' | 'label'>,
  ) {
    if (!props.active || !props.payload?.length) {
      return null;
    }
    const entry = props.payload[0];
    const value = typeof entry.value === 'number' ? entry.value : 0;
    const displayLabel =
      (typeof props.label === 'string' && props.label) || String(entry.name ?? 'Value');
    return (
      <ChartTooltipSimple
        title={displayLabel}
        valueText={`${value.toFixed(options.valueDecimals)} ${options.unitSuffix}`}
      />
    );
  };
}
