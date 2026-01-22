import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import type { MemSpec, Workload, PowerResult, DIMMPowerResult } from '@/lib/types';
import { computeCorePower, computeDIMMPower } from '@/lib/ddr5Calculator';

interface UseDDR5PowerOptions {
  debounceMs?: number;
}

interface UseDDR5PowerReturn {
  powerResult: PowerResult | null;
  dimmPowerResult: DIMMPowerResult | null;
  isCalculating: boolean;
  error: Error | null;
  calculate: () => void;
}

export function useDDR5Power(
  memspec: MemSpec | null,
  workload: Workload | null,
  options: UseDDR5PowerOptions = {}
): UseDDR5PowerReturn {
  const { debounceMs = 150 } = options;
  
  const [powerResult, setPowerResult] = useState<PowerResult | null>(null);
  const [dimmPowerResult, setDimmPowerResult] = useState<DIMMPowerResult | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  
  const timeoutRef = useRef<NodeJS.Timeout>();

  const calculate = useCallback(() => {
    if (!memspec || !workload) {
      setPowerResult(null);
      return;
    }

    setIsCalculating(true);
    setError(null);

    // Clear any pending calculation
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      try {
        const coreResult = computeCorePower(memspec, workload);
        setPowerResult(coreResult);
        
        // Calculate DIMM power
        const dimmResult = computeDIMMPower(coreResult, memspec, {
          isRDIMM: false, // Default to UDIMM, can be made configurable
        });
        setDimmPowerResult(dimmResult);
        
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Calculation failed'));
        setPowerResult(null);
        setDimmPowerResult(null);
      } finally {
        setIsCalculating(false);
      }
    }, debounceMs);
  }, [memspec, workload, debounceMs]);

  // Auto-calculate when inputs change
  useEffect(() => {
    calculate();
    
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [calculate]);

  return {
    powerResult,
    dimmPowerResult,
    isCalculating,
    error,
    calculate,
  };
}

// Helper hook for chart data formatting
export function usePowerChartData(powerResult: PowerResult | null) {
  return useMemo(() => {
    if (!powerResult) return { breakdown: [], distribution: [] };

    const breakdown = [
      { name: 'PRE Standby', value: powerResult.P_PRE_STBY_core, color: 'hsl(215, 20%, 50%)' },
      { name: 'ACT Standby', value: powerResult.P_ACT_STBY_core, color: 'hsl(217, 91%, 60%)' },
      { name: 'ACT/PRE', value: powerResult.P_ACT_PRE_core, color: 'hsl(25, 95%, 53%)' },
      { name: 'Read', value: powerResult.P_RD_core, color: 'hsl(142, 76%, 45%)' },
      { name: 'Write', value: powerResult.P_WR_core, color: 'hsl(280, 87%, 65%)' },
      { name: 'Refresh', value: powerResult.P_REF_core, color: 'hsl(48, 96%, 53%)' },
    ];

    const distribution = [
      { name: 'VDD Core', value: powerResult.P_VDD_core, color: 'hsl(217, 91%, 60%)' },
      { name: 'VPP Core', value: powerResult.P_VPP_core, color: 'hsl(25, 95%, 53%)' },
    ];

    return { breakdown, distribution };
  }, [powerResult]);
}
