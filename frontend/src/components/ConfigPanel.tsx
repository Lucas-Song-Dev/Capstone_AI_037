'use client';

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { HintWithTooltip } from '@/components/DescriptionTooltip';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Cpu, Zap, Activity, Settings2 } from 'lucide-react';
import type { MemSpec, Workload } from '@/lib/types';

interface ConfigPanelProps {
  memspec: MemSpec;
  workload: Workload;
  onMemspecChange: (memspec: MemSpec) => void;
  onWorkloadChange: (workload: Workload) => void;
}

export function ConfigPanel({
  memspec,
  workload,
  onMemspecChange,
  onWorkloadChange,
}: ConfigPanelProps) {
  const handlePowerChange = (key: keyof MemSpec['mempowerspec'], value: number) => {
    onMemspecChange({
      ...memspec,
      mempowerspec: {
        ...memspec.mempowerspec,
        [key]: value,
      },
    });
  };

  const handleWorkloadChange = (key: keyof Workload, value: number) => {
    onWorkloadChange({
      ...workload,
      [key]: value,
    });
  };

  return (
    <Card className="power-card">
      <CardHeader className="!p-4 !pb-2 border-b border-border">
        <CardTitle className="flex items-center gap-2 text-base">
          <Settings2 className="w-4 h-4 text-primary" />
          Configuration
        </CardTitle>
        <CardDescription className="text-xs pt-1">
          Fields mirror <code className="text-[10px] bg-muted px-1 rounded">core/src/parser.py</code> MemSpec and Workload. Adjust workload here or via presets—there is no separate file import for workload.
        </CardDescription>
      </CardHeader>
      <CardContent className="!p-0 overflow-y-auto scrollbar-thin" style={{ maxHeight: 'calc(100vh - 20rem)' }}>
        <Accordion type="multiple" defaultValue={['voltage', 'workload']} className="w-full">
          <AccordionItem value="architecture" className="border-border">
            <AccordionTrigger className="px-4 py-3 hover:bg-secondary/50">
              <div className="flex items-center gap-2">
                <Cpu className="w-4 h-4 text-primary" />
                <span>Architecture</span>
                <Badge variant="secondary" className="ml-2 text-xs">
                  {memspec.memoryId}
                </Badge>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <InfoItem label="Banks" value={memspec.memarchitecturespec.nbrOfBanks} />
                <InfoItem label="Bank Groups" value={memspec.memarchitecturespec.nbrOfBankGroups} />
                <InfoItem label="Ranks" value={memspec.memarchitecturespec.nbrOfRanks} />
                <InfoItem label="Width" value={`${memspec.memarchitecturespec.width}-bit`} />
                <InfoItem label="Burst Length" value={memspec.memarchitecturespec.burstLength} />
                <InfoItem label="Columns" value={memspec.memarchitecturespec.nbrOfColumns.toLocaleString()} />
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="voltage" className="border-border">
            <AccordionTrigger className="px-4 py-3 hover:bg-secondary/50">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-power-vdd" />
                <span>Voltage & Current</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4 space-y-5">
              <p className="text-xs text-muted-foreground leading-relaxed">
                All IDD and IPP inputs are <strong className="font-medium text-foreground">milliamps (mA)</strong>. The calculator converts to amps internally to match the core power model.
              </p>
              <SliderControl
                label="VDD (Core)"
                value={memspec.mempowerspec.vdd}
                min={1.0}
                max={1.2}
                step={0.01}
                unit="V"
                onChange={(v) => handlePowerChange('vdd', v)}
              />
              <SliderControl
                label="VPP (Wordline)"
                value={memspec.mempowerspec.vpp}
                min={1.7}
                max={1.9}
                step={0.01}
                unit="V"
                onChange={(v) => handlePowerChange('vpp', v)}
              />
              <SliderControl
                label="VDDQ (I/O)"
                value={memspec.mempowerspec.vddq}
                min={1.0}
                max={1.2}
                step={0.01}
                unit="V"
                onChange={(v) => handlePowerChange('vddq', v)}
              />

              <div className="pt-2 border-t border-border">
                <p className="text-xs text-muted-foreground mb-3">Key IDD currents (mA)</p>
                <div className="grid grid-cols-2 gap-3">
                  <NumberInput
                    label="IDD0 (ACT)"
                    value={memspec.mempowerspec.idd0}
                    onChange={(v) => handlePowerChange('idd0', v)}
                  />
                  <NumberInput
                    label="IDD4R (Read)"
                    value={memspec.mempowerspec.idd4r}
                    onChange={(v) => handlePowerChange('idd4r', v)}
                  />
                  <NumberInput
                    label="IDD4W (Write)"
                    value={memspec.mempowerspec.idd4w}
                    onChange={(v) => handlePowerChange('idd4w', v)}
                  />
                  <NumberInput
                    label="IDD5B (Refresh)"
                    value={memspec.mempowerspec.idd5b}
                    onChange={(v) => handlePowerChange('idd5b', v)}
                  />
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="workload" className="border-border">
            <AccordionTrigger className="px-4 py-3 hover:bg-secondary/50">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-accent" />
                <span>Workload</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4 space-y-5">
              <p className="text-xs text-muted-foreground leading-relaxed">
                Scheduling and timing percentages match the Workload dataclass consumed by the core model. Use presets for quick profiles, then refine here.
              </p>
              <SliderControl
                label="Read scheduling"
                value={workload.RDsch_percent}
                min={0}
                max={50}
                step={1}
                unit="%"
                hint="Share of time budgeted to read-related scheduling (not bus utilization)."
                onChange={(v) => handleWorkloadChange('RDsch_percent', v)}
                color="text-power-read"
              />
              <SliderControl
                label="Write scheduling"
                value={workload.WRsch_percent}
                min={0}
                max={50}
                step={1}
                unit="%"
                hint="Share of time budgeted to write-related scheduling."
                onChange={(v) => handleWorkloadChange('WRsch_percent', v)}
                color="text-power-write"
              />
              <SliderControl
                label="CKE low (precharged)"
                value={workload.CKE_LO_PRE_percent}
                min={0}
                max={100}
                step={1}
                unit="%"
                hint="Fraction of time CKE is low while banks are precharged."
                onChange={(v) => handleWorkloadChange('CKE_LO_PRE_percent', v)}
              />
              <SliderControl
                label="CKE low (active)"
                value={workload.CKE_LO_ACT_percent}
                min={0}
                max={100}
                step={1}
                unit="%"
                hint="Fraction of time CKE is low while rows are active."
                onChange={(v) => handleWorkloadChange('CKE_LO_ACT_percent', v)}
              />
              <SliderControl
                label="Banks precharged"
                value={workload.BNK_PRE_percent}
                min={0}
                max={100}
                step={1}
                unit="%"
                onChange={(v) => handleWorkloadChange('BNK_PRE_percent', v)}
              />
              <SliderControl
                label="Page hit rate"
                value={workload.PageHit_percent}
                min={0}
                max={100}
                step={1}
                unit="%"
                onChange={(v) => handleWorkloadChange('PageHit_percent', v)}
              />
              <SliderControl
                label="Read data low"
                value={workload.RD_Data_Low_percent}
                min={0}
                max={100}
                step={1}
                unit="%"
                hint="Data bus low time during read-related intervals."
                onChange={(v) => handleWorkloadChange('RD_Data_Low_percent', v)}
              />
              <SliderControl
                label="Write data low"
                value={workload.WR_Data_Low_percent}
                min={0}
                max={100}
                step={1}
                unit="%"
                hint="Data bus low time during write-related intervals."
                onChange={(v) => handleWorkloadChange('WR_Data_Low_percent', v)}
              />
              <SliderControl
                label="Terminated read scheduling"
                value={workload.termRDsch_percent}
                min={0}
                max={100}
                step={1}
                unit="%"
                onChange={(v) => handleWorkloadChange('termRDsch_percent', v)}
              />
              <SliderControl
                label="Terminated write scheduling"
                value={workload.termWRsch_percent}
                min={0}
                max={100}
                step={1}
                unit="%"
                onChange={(v) => handleWorkloadChange('termWRsch_percent', v)}
              />
              <SliderControl
                label="System tRC"
                value={workload.System_tRC_ns}
                min={20}
                max={150}
                step={1}
                unit="ns"
                hint="Row cycle time used in workload modeling (nanoseconds)."
                onChange={(v) => handleWorkloadChange('System_tRC_ns', v)}
              />
              <SliderControl
                label="tRRD scheduling"
                value={workload.tRRDsch_ns}
                min={2}
                max={20}
                step={0.5}
                unit="ns"
                hint="Active-active delay scheduling component."
                onChange={(v) => handleWorkloadChange('tRRDsch_ns', v)}
              />
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </CardContent>
    </Card>
  );
}

function InfoItem({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex flex-col">
      <span className="data-label">{label}</span>
      <span className="data-value">{value}</span>
    </div>
  );
}

interface SliderControlProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  onChange: (value: number) => void;
  color?: string;
  hint?: string;
}

function formatTick(n: number, step: number): string {
  return n.toFixed(step < 1 ? 2 : 0);
}

function SliderControl({ label, value, min, max, step, unit, onChange, color, hint }: SliderControlProps) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center gap-2">
        <Label className="text-sm text-muted-foreground">{label}</Label>
        <span className={`data-value shrink-0 ${color || ''}`}>
          {formatTick(value, step)} {unit}
        </span>
      </div>
      {hint ? <HintWithTooltip text={hint} /> : null}
      <Slider
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={([v]) => onChange(v)}
        className="py-1"
      />
      <div className="flex justify-between text-[10px] text-muted-foreground tabular-nums px-0.5">
        <span>
          {formatTick(min, step)} {unit}
        </span>
        <span>
          {formatTick(max, step)} {unit}
        </span>
      </div>
    </div>
  );
}

interface NumberInputProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
}

function NumberInput({ label, value, onChange }: NumberInputProps) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input
        type="number"
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        className="h-8 text-sm font-mono bg-secondary border-border"
      />
    </div>
  );
}
