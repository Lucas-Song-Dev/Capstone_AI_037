'use client';

import { useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MemoryStick } from 'lucide-react';
import type { DIMMPowerResult } from '@/lib/types';
import { formatPower } from '@/lib/ddr5Calculator';
import { ChartTooltipSimple } from '@/components/recharts/chartTooltip';

const OVERHEAD_EPS = 1e-9;
const COLORS = { core: '#3b82f6', interface: '#22c55e', overhead: '#f97316' };

/** TEMP: single-column DIMM summary for poster screenshot — remove with poster-summary route. */
export function PosterDimmSummaryCard({ dimmPower }: { dimmPower: DIMMPowerResult | null }) {
  const showOverhead = Boolean(dimmPower && dimmPower.P_overhead_DIMM > OVERHEAD_EPS);

  const pieData = useMemo(() => {
    if (!dimmPower) return [];
    const slices: { name: string; value: number; color: string }[] = [
      { name: 'Core', value: dimmPower.P_core_DIMM, color: COLORS.core },
      { name: 'Interface', value: dimmPower.P_interface_DIMM, color: COLORS.interface },
    ];
    if (showOverhead) {
      slices.push({ name: 'Overhead', value: dimmPower.P_overhead_DIMM, color: COLORS.overhead });
    }
    return slices;
  }, [dimmPower, showOverhead]);

  const chartMuted = 'hsl(var(--muted-foreground))';

  if (!dimmPower) {
    return (
      <Card className="poster-panel h-full min-h-[300px] border-2 shadow-lg flex flex-col">
        <CardHeader className="!pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <MemoryStick className="w-5 h-5 text-primary" />
            DIMM module power
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
          Configure memory and workload, then reopen this view.
        </CardContent>
      </Card>
    );
  }

  const pieSum = pieData.reduce((s, d) => s + d.value, 0);

  return (
    <Card className="poster-panel h-full min-h-[300px] border-2 shadow-lg flex flex-col overflow-hidden relative">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/8 via-transparent to-accent/8 pointer-events-none" />
      <CardHeader className="!pb-2 relative">
        <CardTitle className="text-base flex items-center gap-2">
          <MemoryStick className="w-5 h-5 text-primary" />
          DIMM module power
        </CardTitle>
        <p className="text-3xl font-bold font-mono gradient-text tabular-nums pt-1">
          {formatPower(dimmPower.P_total_DIMM, 3)}
        </p>
        <p className="text-xs text-muted-foreground">{dimmPower.chipsPerDIMM} devices / DIMM</p>
      </CardHeader>
      <CardContent className="!pt-0 flex-1 relative pb-2">
        <ResponsiveContainer width="100%" height={240}>
          <PieChart>
            <Pie
              data={pieData}
              cx="50%"
              cy="50%"
              innerRadius={48}
              outerRadius={88}
              paddingAngle={2}
              dataKey="value"
            >
              {pieData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              content={(props) => {
                if (!props.active || !props.payload?.length) return null;
                const entry = props.payload[0];
                const value = typeof entry.value === 'number' ? entry.value : 0;
                const pct = pieSum > 0 ? (value / pieSum) * 100 : 0;
                return (
                  <ChartTooltipSimple
                    title={String(entry.name ?? '')}
                    valueText={`${value.toFixed(3)} W (${pct.toFixed(1)}%)`}
                  />
                );
              }}
            />
            <Legend
              verticalAlign="bottom"
              formatter={(value) => <span style={{ color: chartMuted }}>{value}</span>}
            />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
