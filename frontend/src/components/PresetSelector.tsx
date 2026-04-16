'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MemoryStick, Zap } from 'lucide-react';
import { memoryPresets, workloadPresets } from '@/lib/presets';
import type { MemSpec, MemoryPreset, Workload } from '@/lib/types';
import { calculateDataRate } from '@/lib/ddr5Calculator';
import { cn } from '@/lib/utils';

interface PresetSelectorProps {
  selectedMemoryId: string;
  selectedWorkloadId: string;
  /** Active MemSpec (preset or custom) — shown when Custom is selected. */
  currentMemspec: MemSpec;
  onSelectMemory: (preset: MemSpec, id: string) => void;
  onSelectWorkload: (preset: Workload, id: string) => void;
  defaultManufacturer?: string;
}

function presetFamilyOf(p: MemoryPreset): 'DDR5' | 'LPDDR' {
  return p.family === 'LPDDR' ? 'LPDDR' : 'DDR5';
}

export function PresetSelector({
  selectedMemoryId,
  selectedWorkloadId,
  currentMemspec,
  onSelectMemory,
  onSelectWorkload,
  defaultManufacturer: _defaultManufacturer,
}: PresetSelectorProps) {
  const [memoryFamily, setMemoryFamily] = useState<'DDR5' | 'LPDDR'>('DDR5');

  const filteredMemoryPresets = useMemo(
    () => memoryPresets.filter((p) => presetFamilyOf(p) === memoryFamily),
    [memoryFamily],
  );
  const manufacturers = useMemo(
    () => [...new Set(filteredMemoryPresets.map((p) => p.manufacturer))],
    [filteredMemoryPresets],
  );

  const [activeTab, setActiveTab] = useState(
    () => memoryPresets.find((p) => p.id === selectedMemoryId)?.manufacturer ?? 'Micron',
  );

  useEffect(() => {
    const preset = memoryPresets.find((p) => p.id === selectedMemoryId);
    if (preset) {
      setMemoryFamily(presetFamilyOf(preset));
    }
  }, [selectedMemoryId]);

  useEffect(() => {
    if (!manufacturers.includes(activeTab) && manufacturers.length > 0) {
      setActiveTab(manufacturers[0]);
    }
  }, [memoryFamily, manufacturers, activeTab]);

  useEffect(() => {
    const preset = memoryPresets.find((p) => p.id === selectedMemoryId);
    if (!preset || presetFamilyOf(preset) !== memoryFamily) return;
    const mfrsInFamily = new Set(
      memoryPresets.filter((p) => presetFamilyOf(p) === memoryFamily).map((p) => p.manufacturer),
    );
    if (mfrsInFamily.has(preset.manufacturer)) {
      setActiveTab(preset.manufacturer);
    }
  }, [selectedMemoryId, memoryFamily]);

  return (
    <Card className="power-card">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <MemoryStick className="w-4 h-4 text-primary" />
          Presets
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Custom (builder / JSON) — active MemSpec drives Configuration panel */}
        <div
          className={`rounded-lg border p-3 mb-1 ${
            selectedMemoryId === 'custom'
              ? 'border-primary bg-primary/10 ring-1 ring-primary/30'
              : 'border-dashed border-border bg-muted/20'
          }`}
        >
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-sm font-medium">Custom configuration</span>
            {selectedMemoryId === 'custom' && (
              <Badge className="text-[10px] px-1.5 py-0">Active</Badge>
            )}
          </div>
          {selectedMemoryId === 'custom' ? (
            <p className="text-xs font-mono text-muted-foreground break-all" title={currentMemspec.memoryId}>
              {currentMemspec.memoryId}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Use <strong>Build your own</strong> → Use this config, or upload a memory JSON, to set a custom MemSpec.
            </p>
          )}
        </div>

        {/* DDR5 vs LPDDR */}
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">Memory type</p>
          <Tabs
            value={memoryFamily}
            onValueChange={(v) => setMemoryFamily(v as 'DDR5' | 'LPDDR')}
            className="w-full"
          >
            <TabsList className="w-full grid grid-cols-2 h-8 bg-secondary">
              <TabsTrigger value="DDR5" className="text-xs data-[state=active]:bg-primary">
                DDR5
              </TabsTrigger>
              <TabsTrigger value="LPDDR" className="text-xs data-[state=active]:bg-primary">
                LPDDR5 / LPDDR5X
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Memory Presets */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList
            className={cn(
              'w-full h-8 bg-secondary',
              manufacturers.length === 1 && 'grid grid-cols-1',
              manufacturers.length === 2 && 'grid grid-cols-2',
              manufacturers.length >= 3 && 'grid grid-cols-3',
            )}
          >
            {manufacturers.map((mfr) => (
              <TabsTrigger key={mfr} value={mfr} className="text-xs data-[state=active]:bg-primary">
                {mfr}
              </TabsTrigger>
            ))}
          </TabsList>
          {manufacturers.map((mfr) => (
            <TabsContent key={mfr} value={mfr} className="mt-3 space-y-2">
              {filteredMemoryPresets
                .filter((p) => p.manufacturer === mfr)
                .map((preset) => {
                  const isSelected = selectedMemoryId === preset.id;
                  const dataRate = calculateDataRate(preset.memspec.memtimingspec);
                  return (
                    <Button
                      key={preset.id}
                      variant={isSelected ? 'default' : 'outline'}
                      className={`w-full justify-between h-auto py-2 px-3 ${
                        isSelected ? 'glow-primary' : 'hover:bg-secondary/80'
                      }`}
                      onClick={() => onSelectMemory(preset.memspec, preset.id)}
                    >
                      <div className="flex flex-col items-start">
                        <span className="text-sm font-medium">{preset.name}</span>
                        <span className="text-xs text-muted-foreground">{preset.capacity}</span>
                      </div>
                      <Badge variant="secondary" className="text-xs">
                        {dataRate} MT/s
                      </Badge>
                    </Button>
                  );
                })}
            </TabsContent>
          ))}
        </Tabs>

        {/* Workload Presets */}
        <div className="pt-3 border-t border-border">
          <div className="flex items-center gap-2 mb-3">
            <Zap className="w-4 h-4 text-accent" />
            <span className="text-sm font-medium text-muted-foreground">Workload Profile</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {workloadPresets.map((preset) => {
              const isSelected = selectedWorkloadId === preset.id;
              return (
                <Button
                  key={preset.id}
                  variant={isSelected ? 'default' : 'outline'}
                  size="sm"
                  className={`h-auto min-h-9 py-2 px-2 text-left justify-start ${isSelected ? 'glow-accent bg-accent hover:bg-accent/90' : ''}`}
                  onClick={() => onSelectWorkload(preset.workload, preset.id)}
                >
                  <span className="flex flex-col items-start gap-0.5 w-full">
                    <span className="text-xs font-medium leading-tight">{preset.name}</span>
                    <span
                      className={cn(
                        'text-[10px] font-normal leading-snug line-clamp-2',
                        isSelected ? 'text-accent-foreground/90' : 'text-muted-foreground',
                      )}
                    >
                      {preset.description}
                    </span>
                  </span>
                </Button>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
