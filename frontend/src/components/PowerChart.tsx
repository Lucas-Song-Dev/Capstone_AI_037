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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { PowerResult } from '@/lib/types';
import { formatPower } from '@/lib/ddr5Calculator';
import { ChartTooltipSimple, makeSeriesTooltipContent } from '@/components/recharts/chartTooltip';

const CorePowerBarTooltip = makeSeriesTooltipContent({ valueDecimals: 2, unitSuffix: 'mW' });

interface PowerChartProps {
  powerResult: PowerResult | null;
}

const COLORS = {
  preStandby: '#64748b',
  actStandby: '#3b82f6',
  actPre: '#f97316',
  read: '#22c55e',
  write: '#a855f7',
  refresh: '#eab308',
  vdd: '#3b82f6',
  vpp: '#f97316',
};

export function PowerBreakdownChart({ powerResult }: PowerChartProps) {
  const data = useMemo(() => {
    if (!powerResult) return [];
    
    return [
      { name: 'PRE\nStandby', value: powerResult.P_PRE_STBY_core * 1000, fill: COLORS.preStandby },
      { name: 'ACT\nStandby', value: powerResult.P_ACT_STBY_core * 1000, fill: COLORS.actStandby },
      { name: 'ACT/PRE', value: powerResult.P_ACT_PRE_core * 1000, fill: COLORS.actPre },
      { name: 'Read', value: powerResult.P_RD_core * 1000, fill: COLORS.read },
      { name: 'Write', value: powerResult.P_WR_core * 1000, fill: COLORS.write },
      { name: 'Refresh', value: powerResult.P_REF_core * 1000, fill: COLORS.refresh },
    ];
  }, [powerResult]);

  if (!powerResult) {
    return (
      <Card className="power-card">
        <CardHeader className="!p-4 !pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Power Breakdown</CardTitle>
        </CardHeader>
        <CardContent className="!p-4 !pt-0 h-[200px] flex items-center justify-center">
          <p className="text-muted-foreground text-sm">No data available</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="power-card">
      <CardHeader className="!p-4 !pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">Power Breakdown (mW)</CardTitle>
        <CardDescription className="text-xs pt-1">
          Per-component bars are in milliwatts (core contributions × 1000). Summary totals on this page use watts from the same modeled values—divide the bar stack by 1000 to compare to headline W.
        </CardDescription>
      </CardHeader>
      <CardContent className="!p-4 !pt-0">
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(217, 32%, 22%)" />
            <XAxis 
              dataKey="name" 
              tick={{ fill: 'hsl(215, 20%, 65%)', fontSize: 10 }}
              axisLine={{ stroke: 'hsl(217, 32%, 22%)' }}
              tickLine={{ stroke: 'hsl(217, 32%, 22%)' }}
              interval={0}
            />
            <YAxis 
              tick={{ fill: 'hsl(215, 20%, 65%)', fontSize: 10 }}
              axisLine={{ stroke: 'hsl(217, 32%, 22%)' }}
              tickLine={{ stroke: 'hsl(217, 32%, 22%)' }}
            />
            <Tooltip content={CorePowerBarTooltip} />
            <Bar 
              dataKey="value" 
              radius={[4, 4, 0, 0]}
              maxBarSize={40}
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

export function PowerDistributionChart({ powerResult }: PowerChartProps) {
  const data = useMemo(() => {
    if (!powerResult) return [];
    
    return [
      { name: 'VDD Core', value: powerResult.P_VDD_core * 1000, color: COLORS.vdd },
      { name: 'VPP Core', value: powerResult.P_VPP_core * 1000, color: COLORS.vpp },
    ];
  }, [powerResult]);

  if (!powerResult) {
  return (
    <Card className="power-card">
      <CardHeader className="!p-4 !pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">VDD vs VPP</CardTitle>
      </CardHeader>
      <CardContent className="!p-4 !pt-0 h-[200px] flex items-center justify-center">
          <p className="text-muted-foreground text-sm">No data available</p>
        </CardContent>
      </Card>
    );
  }

  const total = data.reduce((sum, d) => sum + d.value, 0);

  return (
    <Card className="power-card">
      <CardHeader className="!p-4 !pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">VDD vs VPP Distribution</CardTitle>
        <CardDescription className="text-xs pt-1">
          Slice values are milliwatts of core power on each rail. VDD + VPP in mW correspond to the watt-scale VDD/VPP lines in the total summary (same physics, different unit for chart readability).
        </CardDescription>
      </CardHeader>
      <CardContent className="!p-4 !pt-0">
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={80}
              paddingAngle={3}
              dataKey="value"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              content={(props) => {
                if (!props.active || !props.payload?.length) return null;
                const entry = props.payload[0];
                const value = typeof entry.value === 'number' ? entry.value : 0;
                return (
                  <ChartTooltipSimple
                    title={entry.name || 'Value'}
                    valueText={`${value.toFixed(2)} mW (${((value / total) * 100).toFixed(1)}%)`}
                  />
                );
              }}
            />
            <Legend 
              verticalAlign="bottom"
              formatter={(value) => <span style={{ color: 'hsl(215, 20%, 65%)' }}>{value}</span>}
            />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

export function TotalPowerDisplay({ powerResult }: PowerChartProps) {
  if (!powerResult) {
    return (
      <Card className="power-card">
        <CardContent className="py-6 text-center">
          <p className="text-muted-foreground">Waiting for calculation...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="power-card relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-accent/10 pointer-events-none" />
      <CardContent className="!p-4 !pt-0 relative">
        <div className="text-center">
          <p className="data-label mb-2">Total Core Power</p>
          <p className="text-4xl font-bold font-mono gradient-text">
            {formatPower(powerResult.P_total_core)}
          </p>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-4 text-center">
          <div>
            <p className="data-label">VDD Power</p>
            <p className="text-lg font-mono text-power-vdd">
              {formatPower(powerResult.P_VDD_core)}
            </p>
          </div>
          <div>
            <p className="data-label">VPP Power</p>
            <p className="text-lg font-mono text-power-vpp">
              {formatPower(powerResult.P_VPP_core)}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
