import { useState, useCallback } from 'react';
import { Header } from '@/components/Header';
import { ConfigPanel } from '@/components/ConfigPanel';
import { PresetSelector } from '@/components/PresetSelector';
import { DDR5Chip3D } from '@/components/DDR5Chip3D';
import { PowerBreakdownChart, PowerDistributionChart, TotalPowerDisplay } from '@/components/PowerChart';
import { PowerDetails } from '@/components/PowerDetails';
import { DIMMPowerVisualizer } from '@/components/DIMMPowerVisualizer';
import { useDDR5Power } from '@/hooks/useDDR5Power';
import { memoryPresets, defaultWorkload, workloadPresets } from '@/lib/presets';
import type { MemSpec, Workload } from '@/lib/types';
import { Loader2 } from 'lucide-react';

export default function Index() {
  const [selectedMemoryId, setSelectedMemoryId] = useState(memoryPresets[0].id);
  const [selectedWorkloadId, setSelectedWorkloadId] = useState('balanced');
  const [memspec, setMemspec] = useState<MemSpec>(memoryPresets[0].memspec);
  const [workload, setWorkload] = useState<Workload>(defaultWorkload);

  const { powerResult, dimmPowerResult, isCalculating, error } = useDDR5Power(memspec, workload);

  const handleSelectMemory = useCallback((preset: MemSpec, id: string) => {
    setMemspec(preset);
    setSelectedMemoryId(id);
  }, []);

  const handleSelectWorkload = useCallback((preset: Workload, id: string) => {
    setWorkload(preset);
    setSelectedWorkloadId(id);
  }, []);

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      <Header />
      
      <main className="flex-1 container mx-auto px-4 py-6 overflow-y-auto scrollbar-thin">
        {/* Loading/Error State */}
        {isCalculating && (
          <div className="fixed top-16 right-4 flex items-center gap-2 bg-card border border-border rounded-lg px-3 py-2 shadow-lg z-40">
            <Loader2 className="w-4 h-4 animate-spin text-primary" />
            <span className="text-sm text-muted-foreground">Calculating...</span>
          </div>
        )}

        {error && (
          <div className="mb-4 p-4 bg-destructive/10 border border-destructive/30 rounded-lg">
            <p className="text-sm text-destructive">Error: {error.message}</p>
          </div>
        )}

        {/* Main Grid Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Panel - Configuration */}
          <div className="lg:col-span-3 space-y-6">
            <PresetSelector
              selectedMemoryId={selectedMemoryId}
              selectedWorkloadId={selectedWorkloadId}
              onSelectMemory={handleSelectMemory}
              onSelectWorkload={handleSelectWorkload}
            />
            <ConfigPanel
              memspec={memspec}
              workload={workload}
              onMemspecChange={setMemspec}
              onWorkloadChange={setWorkload}
            />
          </div>

          {/* Center Panel - Visualization */}
          <div className="lg:col-span-5 space-y-6">
            <TotalPowerDisplay powerResult={powerResult} />
            <DDR5Chip3D powerResult={powerResult} memspec={memspec} />
            <PowerDetails powerResult={powerResult} />
          </div>

          {/* Right Panel - Charts */}
          <div className="lg:col-span-4 space-y-6">
            <PowerBreakdownChart powerResult={powerResult} />
            <PowerDistributionChart powerResult={powerResult} />
          </div>
        </div>

        {/* DIMM Power Section */}
        <div className="mt-8">
          <h2 className="text-xl font-semibold mb-4 text-foreground">Total DIMM Power Analysis</h2>
          <DIMMPowerVisualizer dimmPower={dimmPowerResult} memspec={memspec} />
        </div>

        {/* Footer */}
        <footer className="mt-8 pt-6 border-t border-border">
          <div className="flex flex-wrap items-center justify-between gap-4 text-xs text-muted-foreground">
            <p>DDR5 Power Calculator • Based on JEDEC JESD79-5 specifications</p>
            <div className="flex items-center gap-4">
              <span>VDD: 1.1V nominal</span>
              <span>VPP: 1.8V nominal</span>
              <span>VDDQ: 1.1V nominal</span>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}
