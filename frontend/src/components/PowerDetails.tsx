import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Activity, Cpu, RefreshCw, FileInput, FileOutput } from 'lucide-react';
import type { PowerResult } from '@/lib/types';
import { formatPower } from '@/lib/ddr5Calculator';

interface PowerDetailsProps {
  powerResult: PowerResult | null;
}

export function PowerDetails({ powerResult }: PowerDetailsProps) {
  if (!powerResult) {
    return (
      <Card className="power-card">
        <CardContent className="!p-4 text-center">
          <p className="text-muted-foreground">Configure memory and workload to see power details</p>
        </CardContent>
      </Card>
    );
  }

  const lpddrRailDetails =
    powerResult.P_VDD1 != null ||
    powerResult.P_VDD2H != null ||
    powerResult.P_VDD2L != null ||
    powerResult.P_VDDQ != null
      ? [
          {
            label: 'VDD1 rail',
            value: powerResult.P_VDD1 ?? 0,
            icon: Cpu,
            color: 'text-power-vdd',
            description: 'LPDDR VDD1 core contribution',
          },
          {
            label: 'VDD2H rail',
            value: powerResult.P_VDD2H ?? 0,
            icon: Cpu,
            color: 'text-power-vpp',
            description: 'LPDDR VDD2H core contribution',
          },
          {
            label: 'VDD2L rail',
            value: powerResult.P_VDD2L ?? 0,
            icon: Cpu,
            color: 'text-power-read',
            description: 'LPDDR VDD2L core contribution',
          },
          {
            label: 'VDDQ rail',
            value: powerResult.P_VDDQ ?? 0,
            icon: Cpu,
            color: 'text-power-write',
            description: 'LPDDR VDDQ core contribution',
          },
        ]
      : [];

  const extraLpddr =
    powerResult.P_background != null || powerResult.P_SELFREF != null
      ? [
          ...(powerResult.P_background != null
            ? [
                {
                  label: 'Background',
                  value: powerResult.P_background,
                  icon: Activity,
                  color: 'text-muted-foreground',
                  description: 'Background / standby rail-related core term',
                },
              ]
            : []),
          ...(powerResult.P_SELFREF != null
            ? [
                {
                  label: 'Self refresh',
                  value: powerResult.P_SELFREF,
                  icon: RefreshCw,
                  color: 'text-muted-foreground',
                  description: 'Self-refresh contribution',
                },
              ]
            : []),
        ]
      : [];

  const details = [
    {
      label: 'Precharge Standby',
      value: powerResult.P_PRE_STBY_core,
      icon: Cpu,
      color: 'text-power-standby',
      description: 'Power when all banks precharged, CKE high',
    },
    {
      label: 'Active Standby',
      value: powerResult.P_ACT_STBY_core,
      icon: Activity,
      color: 'text-power-vdd',
      description: 'Power with one or more banks active',
    },
    {
      label: 'Activate/Precharge',
      value: powerResult.P_ACT_PRE_core,
      icon: Activity,
      color: 'text-power-vpp',
      description: 'Power for row activation and precharge',
    },
    {
      label: 'Read Operations',
      value: powerResult.P_RD_core,
      icon: FileOutput,
      color: 'text-power-read',
      description: 'Incremental power during read bursts',
    },
    {
      label: 'Write Operations',
      value: powerResult.P_WR_core,
      icon: FileInput,
      color: 'text-power-write',
      description: 'Incremental power during write bursts',
    },
    {
      label: 'Refresh',
      value: powerResult.P_REF_core,
      icon: RefreshCw,
      color: 'text-power-refresh',
      description: 'Power consumed by periodic cell refresh',
    },
  ];

  return (
    <Card className="power-card">
      <CardHeader className="!p-4 !pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center justify-between">
          <span>Power Components</span>
          <Badge variant="outline" className="text-xs font-mono">
            Total: {formatPower(powerResult.P_total_core)}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="!p-4 !pt-0 space-y-2.5">
        {[...details, ...lpddrRailDetails, ...extraLpddr].map((item) => {
          const Icon = item.icon;
          const denom = powerResult.P_total_core || 1;
          const percentage = (item.value / denom) * 100;
          
          return (
            <div key={item.label} className="group">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <Icon className={`w-3.5 h-3.5 ${item.color}`} />
                  <span className="text-sm">{item.label}</span>
                </div>
                <span className={`data-value ${item.color}`}>
                  {formatPower(item.value)}
                </span>
              </div>
              <div
                className="relative h-px w-full overflow-hidden rounded-full bg-border/45"
                aria-hidden
              >
                <div
                  className="absolute left-0 top-0 h-full min-h-px max-w-full rounded-full transition-[width] duration-300"
                  style={{
                    width: `${Math.min(percentage, 100)}%`,
                    backgroundColor: `var(--${item.color.replace('text-', '')})`,
                  }}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {item.description} ({percentage.toFixed(1)}%)
              </p>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
