'use client';

import { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DescriptionWithTooltip } from '@/components/DescriptionTooltip';
import { Badge } from '@/components/ui/badge';
import { Cpu, Zap, Settings, MemoryStick } from 'lucide-react';
import type { DIMMPowerResult, MemSpec } from '@/lib/types';
import { formatPower } from '@/lib/ddr5Calculator';
import { ChartTooltipSimple, makeSeriesTooltipContent } from '@/components/recharts/chartTooltip';
import { cn } from '@/lib/utils';

const DIMMBarTooltip = makeSeriesTooltipContent({ valueDecimals: 3, unitSuffix: 'W' });

const OVERHEAD_EPS = 1e-9;

interface DIMMPowerVisualizerProps {
  dimmPower: DIMMPowerResult | null;
  memspec: MemSpec | null;
}

const COLORS = {
  core: '#3b82f6',
  interface: '#22c55e',
  overhead: '#f97316',
  rcd: '#a855f7',
};

export function DIMMPowerVisualizer({ dimmPower }: DIMMPowerVisualizerProps) {
  const showOverhead = Boolean(dimmPower && dimmPower.P_overhead_DIMM > OVERHEAD_EPS);

  const breakdownData = useMemo(() => {
    if (!dimmPower) return [];

    const rows: {
      name: string;
      value: number;
      fill: string;
      icon: typeof Cpu;
      description: string;
    }[] = [
      {
        name: 'Core Power',
        value: dimmPower.P_core_DIMM,
        fill: COLORS.core,
        icon: Cpu,
        description: `Power from ${dimmPower.chipsPerDIMM} memory chips`,
      },
      {
        name: 'Interface Power',
        value: dimmPower.P_interface_DIMM,
        fill: COLORS.interface,
        icon: Zap,
        description: 'VDDQ IO power for data lines',
      },
    ];

    if (showOverhead) {
      rows.push({
        name: 'Overhead',
        value: dimmPower.P_overhead_DIMM,
        fill: COLORS.overhead,
        icon: Settings,
        description:
          'PMIC efficiency loss' + (dimmPower.rcdPower ? ' + RCD power' : ''),
      });
    }

    return rows;
  }, [dimmPower, showOverhead]);

  const pieData = useMemo(() => {
    if (!dimmPower) return [];

    const slices: { name: string; value: number; color: string }[] = [
      { name: 'Core', value: dimmPower.P_core_DIMM, color: COLORS.core },
      { name: 'Interface', value: dimmPower.P_interface_DIMM, color: COLORS.interface },
    ];
    if (showOverhead) {
      slices.push({
        name: 'Overhead',
        value: dimmPower.P_overhead_DIMM,
        color: COLORS.overhead,
      });
    }
    return slices;
  }, [dimmPower, showOverhead]);

  const visibleTotal = useMemo(
    () => breakdownData.reduce((s, d) => s + d.value, 0),
    [breakdownData]
  );

  if (!dimmPower) {
    return (
      <Card className="power-card">
        <CardHeader className="!p-4 !pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Total DIMM Power</CardTitle>
        </CardHeader>
        <CardContent className="!p-4 !pt-0 text-center py-8">
          <p className="text-muted-foreground text-sm">Configure memory and workload to see DIMM power</p>
        </CardContent>
      </Card>
    );
  }

  const moduleTotal = dimmPower.P_total_DIMM;
  const coreOnly = dimmPower.corePower.P_total_core * dimmPower.chipsPerDIMM;
  const interfacePctVisible =
    visibleTotal > 0 ? ((dimmPower.P_interface_DIMM / visibleTotal) * 100).toFixed(1) : '0.0';
  const corePctVisible =
    visibleTotal > 0 ? ((dimmPower.P_core_DIMM / visibleTotal) * 100).toFixed(1) : '0.0';
  const overheadPctVisible =
    showOverhead && visibleTotal > 0
      ? ((dimmPower.P_overhead_DIMM / visibleTotal) * 100).toFixed(1)
      : '0.0';

  const subtitleParts = [
    `Core only: ${formatPower(coreOnly, 3)}`,
    ...(showOverhead ? [`Overhead: ${overheadPctVisible}%`] : []),
    `Interface: ${interfacePctVisible}%`,
  ];

  const chartGridStroke = 'hsl(var(--border))';
  const chartMutedStroke = 'hsl(var(--muted-foreground))';

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Total DIMM Power Display */}
        <Card className="power-card relative overflow-hidden min-w-0">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-accent/5 to-transparent pointer-events-none" />
          <CardHeader className="!p-4 !pb-2 relative">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center justify-between">
              <span className="flex items-center gap-2">
                <MemoryStick className="w-4 h-4 text-primary" />
                Total DIMM Power
              </span>
              <Badge variant="outline" className="text-xs font-mono">
                {dimmPower.chipsPerDIMM} chips
              </Badge>
            </CardTitle>
            <DescriptionWithTooltip
              variant="card"
              className="text-xs relative pt-1"
              label="About module total"
              text="Module total includes die (core) power, VDDQ interface, and overhead such as PMIC loss and RCD where modeled—distinct from die-only Core Power."
            />
          </CardHeader>
          <CardContent className="!p-4 !pt-0 relative">
            <div className="text-center mb-4">
              <p className="data-label mb-2">Total DIMM Power</p>
              <p className="text-5xl font-bold font-mono gradient-text">
                {formatPower(dimmPower.P_total_DIMM, 3)}
              </p>
              <p className="text-xs text-muted-foreground mt-2">{subtitleParts.join(' • ')}</p>
              <p className="text-[10px] text-muted-foreground/80 mt-1">
                Percentages above are shares of the displayed breakdown (core
                {showOverhead ? ', interface, overhead' : ' and interface'}) so they sum to 100%.
              </p>
            </div>

            <div
              className={cn(
                'grid gap-3 mt-4',
                breakdownData.length <= 2 ? 'grid-cols-2' : 'grid-cols-3'
              )}
            >
              {breakdownData.map((item) => {
                const Icon = item.icon;
                const percentage = visibleTotal > 0 ? (item.value / visibleTotal) * 100 : 0;

                return (
                  <div key={item.name} className="text-center p-2 rounded-lg bg-secondary/30 min-w-0">
                    <Icon className={`w-4 h-4 mx-auto mb-1`} style={{ color: item.fill }} />
                    <p className="text-xs text-muted-foreground mb-1 truncate">{item.name}</p>
                    <p className="text-sm font-mono font-semibold" style={{ color: item.fill }}>
                      {formatPower(item.value, 2)}
                    </p>
                    <p className="text-xs text-muted-foreground">{percentage.toFixed(1)}%</p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Breakdown Bar Chart */}
        <Card className="power-card min-w-0">
          <CardHeader className="!p-4 !pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              DIMM Power Breakdown (W)
            </CardTitle>
            <DescriptionWithTooltip
              variant="card"
              className="text-xs pt-1"
              label="About this chart"
              text="Same categories as the summary tiles above; values are watts so they align with the headline module total."
            />
          </CardHeader>
          <CardContent className="!p-4 !pt-0">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={breakdownData} margin={{ top: 10, right: 10, left: -10, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={chartGridStroke} />
                <XAxis
                  dataKey="name"
                  tick={{ fill: chartMutedStroke, fontSize: 10 }}
                  axisLine={{ stroke: chartGridStroke }}
                  tickLine={{ stroke: chartGridStroke }}
                />
                <YAxis
                  tick={{ fill: chartMutedStroke, fontSize: 10 }}
                  axisLine={{ stroke: chartGridStroke }}
                  tickLine={{ stroke: chartGridStroke }}
                />
                <Tooltip content={DIMMBarTooltip} />
                <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={60}>
                  {breakdownData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Distribution Pie Chart */}
        <Card className="power-card min-w-0">
          <CardHeader className="!p-4 !pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Power Distribution
            </CardTitle>
          </CardHeader>
          <CardContent className="!p-4 !pt-0">
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={70}
                  paddingAngle={3}
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
                    const pieSum = pieData.reduce((sum, d) => sum + d.value, 0);
                    const pct = pieSum > 0 ? (value / pieSum) * 100 : 0;
                    return (
                      <ChartTooltipSimple
                        title={entry.name || 'Value'}
                        valueText={`${value.toFixed(3)} W (${pct.toFixed(1)}%)`}
                      />
                    );
                  }}
                />
                <Legend
                  verticalAlign="bottom"
                  formatter={(value) => (
                    <span style={{ color: chartMutedStroke }}>{value}</span>
                  )}
                />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Component Breakdown — full width */}
      <Card className="power-card">
        <CardHeader className="!p-4 !pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Component Details
          </CardTitle>
        </CardHeader>
        <CardContent className="!p-4 !pt-0 space-y-3">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Cpu className="w-3.5 h-3.5 text-power-vdd" />
                <span className="text-sm">Core Power ({dimmPower.chipsPerDIMM} chips)</span>
              </div>
              <span className="data-value text-power-vdd">
                {formatPower(dimmPower.P_core_DIMM, 3)}
              </span>
            </div>
            <div
              className="relative h-px w-full overflow-hidden rounded-full bg-border/45"
              aria-hidden
            >
              <div
                className="absolute left-0 top-0 h-full min-h-px max-w-full rounded-full"
                style={{
                  width: `${Math.min(Math.max(0, parseFloat(corePctVisible) || 0), 100)}%`,
                  backgroundColor: COLORS.core,
                }}
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Zap className="w-3.5 h-3.5 text-power-read" />
                <span className="text-sm">Interface Power (VDDQ IO)</span>
              </div>
              <span className="data-value text-power-read">
                {formatPower(dimmPower.P_interface_DIMM, 3)}
              </span>
            </div>
            <div
              className="relative h-px w-full overflow-hidden rounded-full bg-border/45"
              aria-hidden
            >
              <div
                className="absolute left-0 top-0 h-full min-h-px max-w-full rounded-full"
                style={{
                  width: `${Math.min(Math.max(0, parseFloat(interfacePctVisible) || 0), 100)}%`,
                  backgroundColor: COLORS.interface,
                }}
              />
            </div>
          </div>

          {showOverhead && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Settings className="w-3.5 h-3.5 text-power-vpp" />
                  <span className="text-sm">Overhead</span>
                </div>
                <span className="data-value text-power-vpp">
                  {formatPower(dimmPower.P_overhead_DIMM, 3)}
                </span>
              </div>
              <div
                className="relative h-px w-full overflow-hidden rounded-full bg-border/45"
                aria-hidden
              >
                <div
                  className="absolute left-0 top-0 h-full min-h-px max-w-full rounded-full"
                  style={{
                    width: `${Math.min(Math.max(0, parseFloat(overheadPctVisible) || 0), 100)}%`,
                    backgroundColor: COLORS.overhead,
                  }}
                />
              </div>
              {dimmPower.rcdPower ? (
                <p className="text-xs text-muted-foreground ml-7">
                  Includes RCD power: {formatPower(dimmPower.rcdPower, 3)}
                </p>
              ) : null}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
