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
import { Badge } from '@/components/ui/badge';
import { Cpu, Zap, Settings, MemoryStick } from 'lucide-react';
import type { DIMMPowerResult, MemSpec } from '@/lib/types';
import { formatPower } from '@/lib/ddr5Calculator';

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

// Custom tooltip component
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const entry = payload[0];
    const value = typeof entry.value === 'number' ? entry.value : 0;
    
    return (
      <div
        style={{
          backgroundColor: 'hsl(222, 47%, 14%)',
          border: '1px solid hsl(217, 32%, 22%)',
          borderRadius: '8px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
          padding: '8px 12px',
        }}
      >
        <p style={{ color: 'hsl(210, 40%, 98%)', fontWeight: 500, marginBottom: '4px', marginTop: 0 }}>
          {label || entry.name || 'Value'}
        </p>
        <p style={{ color: 'hsl(210, 40%, 98%)', margin: 0 }}>
          {value.toFixed(3)} W
        </p>
      </div>
    );
  }
  return null;
};

export function DIMMPowerVisualizer({ dimmPower, memspec }: DIMMPowerVisualizerProps) {
  const breakdownData = useMemo(() => {
    if (!dimmPower) return [];
    
    return [
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
      { 
        name: 'Overhead', 
        value: dimmPower.P_overhead_DIMM, 
        fill: COLORS.overhead,
        icon: Settings,
        description: 'PMIC efficiency loss' + (dimmPower.rcdPower ? ' + RCD power' : ''),
      },
    ];
  }, [dimmPower]);

  const pieData = useMemo(() => {
    if (!dimmPower) return [];
    
    return [
      { name: 'Core', value: dimmPower.P_core_DIMM, color: COLORS.core },
      { name: 'Interface', value: dimmPower.P_interface_DIMM, color: COLORS.interface },
      { name: 'Overhead', value: dimmPower.P_overhead_DIMM, color: COLORS.overhead },
    ];
  }, [dimmPower]);

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

  const total = dimmPower.P_total_DIMM;
  const coreOnly = dimmPower.corePower.P_total_core * dimmPower.chipsPerDIMM;
  const overheadPercent = ((dimmPower.P_overhead_DIMM / total) * 100).toFixed(1);
  const interfacePercent = ((dimmPower.P_interface_DIMM / total) * 100).toFixed(1);
  const corePercent = ((dimmPower.P_core_DIMM / total) * 100).toFixed(1);

  return (
    <div className="space-y-6">
      {/* Total DIMM Power Display */}
      <Card className="power-card relative overflow-hidden">
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
        </CardHeader>
        <CardContent className="!p-4 !pt-0 relative">
          <div className="text-center mb-4">
            <p className="data-label mb-2">Total DIMM Power</p>
            <p className="text-5xl font-bold font-mono gradient-text">
              {formatPower(dimmPower.P_total_DIMM, 3)}
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              Core only: {formatPower(coreOnly, 3)} • 
              Overhead: {overheadPercent}% • 
              Interface: {interfacePercent}%
            </p>
          </div>
          
          {/* Quick breakdown */}
          <div className="grid grid-cols-3 gap-3 mt-4">
            {breakdownData.map((item) => {
              const Icon = item.icon;
              const percentage = (item.value / total) * 100;
              
              return (
                <div key={item.name} className="text-center p-2 rounded-lg bg-secondary/30">
                  <Icon className={`w-4 h-4 mx-auto mb-1`} style={{ color: item.fill }} />
                  <p className="text-xs text-muted-foreground mb-1">{item.name}</p>
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
      <Card className="power-card">
        <CardHeader className="!p-4 !pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            DIMM Power Breakdown (W)
          </CardTitle>
        </CardHeader>
        <CardContent className="!p-4 !pt-0">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={breakdownData} margin={{ top: 10, right: 10, left: -10, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(217, 32%, 22%)" />
              <XAxis 
                dataKey="name" 
                tick={{ fill: 'hsl(215, 20%, 65%)', fontSize: 10 }}
                axisLine={{ stroke: 'hsl(217, 32%, 22%)' }}
                tickLine={{ stroke: 'hsl(217, 32%, 22%)' }}
              />
              <YAxis 
                tick={{ fill: 'hsl(215, 20%, 65%)', fontSize: 10 }}
                axisLine={{ stroke: 'hsl(217, 32%, 22%)' }}
                tickLine={{ stroke: 'hsl(217, 32%, 22%)' }}
              />
              <Tooltip content={<CustomTooltip />} />
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
      <Card className="power-card">
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
                  if (props.active && props.payload && props.payload.length) {
                    const entry = props.payload[0];
                    const value = typeof entry.value === 'number' ? entry.value : 0;
                    const total = pieData.reduce((sum, d) => sum + d.value, 0);
                    return (
                      <div
                        style={{
                          backgroundColor: 'hsl(222, 47%, 14%)',
                          border: '1px solid hsl(217, 32%, 22%)',
                          borderRadius: '8px',
                          boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                          padding: '8px 12px',
                        }}
                      >
                        <p style={{ color: 'hsl(210, 40%, 98%)', fontWeight: 500, marginBottom: '4px', marginTop: 0 }}>
                          {entry.name || 'Value'}
                        </p>
                        <p style={{ color: 'hsl(210, 40%, 98%)', margin: 0 }}>
                          {`${value.toFixed(3)} W (${((value / total) * 100).toFixed(1)}%)`}
                        </p>
                      </div>
                    );
                  }
                  return null;
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

      {/* Detailed Component Breakdown */}
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
            <div className="relative h-1.5 bg-secondary rounded-full overflow-hidden">
              <div 
                className="absolute inset-y-0 left-0 rounded-full"
                style={{ 
                  width: `${corePercent}%`,
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
            <div className="relative h-1.5 bg-secondary rounded-full overflow-hidden">
              <div 
                className="absolute inset-y-0 left-0 rounded-full"
                style={{ 
                  width: `${interfacePercent}%`,
                  backgroundColor: COLORS.interface,
                }}
              />
            </div>
          </div>

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
            <div className="relative h-1.5 bg-secondary rounded-full overflow-hidden">
              <div 
                className="absolute inset-y-0 left-0 rounded-full"
                style={{ 
                  width: `${overheadPercent}%`,
                  backgroundColor: COLORS.overhead,
                }}
              />
            </div>
            {dimmPower.rcdPower && (
              <p className="text-xs text-muted-foreground ml-7">
                Includes RCD power: {formatPower(dimmPower.rcdPower, 3)}
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

