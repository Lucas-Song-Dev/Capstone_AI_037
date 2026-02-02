import { Header } from '@/components/Header';
import { DIMMPowerVisualizer } from '@/components/DIMMPowerVisualizer';
import { useDDR5Power } from '@/hooks/useDDR5Power';
import { useConfig } from '@/contexts/ConfigContext';
import { Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

export default function DIMMPower() {
  const { memspec, workload } = useConfig();
  const navigate = useNavigate();
  const { dimmPowerResult, isCalculating, error } = useDDR5Power(memspec, workload);

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      <Header />
      
      <main className="flex-1 container mx-auto px-4 py-6 overflow-y-auto scrollbar-thin">
        {/* Navigation */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">Total DIMM Power Analysis</h1>
            <p className="text-muted-foreground">
              Complete DIMM power consumption including core, interface, and overhead components
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => navigate('/configuration')}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Configuration
          </Button>
        </div>

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

        {/* DIMM Power Visualization */}
        <div className="max-w-7xl mx-auto">
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

