import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MemoryStick, Zap } from 'lucide-react';
import { memoryPresets, workloadPresets } from '@/lib/presets';
import type { MemSpec, Workload } from '@/lib/types';
import { calculateDataRate } from '@/lib/ddr5Calculator';

interface PresetSelectorProps {
  selectedMemoryId: string;
  selectedWorkloadId: string;
  onSelectMemory: (preset: MemSpec, id: string) => void;
  onSelectWorkload: (preset: Workload, id: string) => void;
  defaultManufacturer?: string;
}

export function PresetSelector({
  selectedMemoryId,
  selectedWorkloadId,
  onSelectMemory,
  onSelectWorkload,
  defaultManufacturer,
}: PresetSelectorProps) {
  const manufacturers = [...new Set(memoryPresets.map((p) => p.manufacturer))];
  
  // Find the manufacturer for the selected preset
  const selectedPreset = memoryPresets.find((p) => p.id === selectedMemoryId);
  const initialManufacturer = selectedPreset?.manufacturer || defaultManufacturer || manufacturers[0];
  const [activeTab, setActiveTab] = useState(initialManufacturer);

  // Update active tab when selectedMemoryId or defaultManufacturer changes
  useEffect(() => {
    const preset = memoryPresets.find((p) => p.id === selectedMemoryId);
    const manufacturer = preset?.manufacturer || defaultManufacturer || manufacturers[0];
    setActiveTab(manufacturer);
  }, [selectedMemoryId, defaultManufacturer, manufacturers]);

  return (
    <Card className="power-card">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <MemoryStick className="w-4 h-4 text-primary" />
          Presets
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Memory Presets */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full grid grid-cols-3 h-8 bg-secondary">
            {manufacturers.map((mfr) => (
              <TabsTrigger key={mfr} value={mfr} className="text-xs data-[state=active]:bg-primary">
                {mfr}
              </TabsTrigger>
            ))}
          </TabsList>
          {manufacturers.map((mfr) => (
            <TabsContent key={mfr} value={mfr} className="mt-3 space-y-2">
              {memoryPresets
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
                  className={`text-xs ${isSelected ? 'glow-accent bg-accent hover:bg-accent/90' : ''}`}
                  onClick={() => onSelectWorkload(preset.workload, preset.id)}
                >
                  {preset.name}
                </Button>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
