import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import type { MemSpec, Workload, PowerResult, DIMMPowerResult } from '@/lib/types';
import { tryApiThenLocalPower } from '@/lib/api';

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
      setDimmPowerResult(null);
      return;
    }

    setIsCalculating(true);
    setError(null);

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    const runCalculation = async () => {
      try {
        const { powerResult, dimmPowerResult } = await tryApiThenLocalPower(memspec, workload);
        setPowerResult(powerResult);
        setDimmPowerResult(dimmPowerResult);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Calculation failed'));
        setPowerResult(null);
        setDimmPowerResult(null);
      } finally {
        setIsCalculating(false);
      }
    };

    timeoutRef.current = setTimeout(runCalculation, debounceMs);
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

    const hasLpddrRails =
      powerResult.P_VDD1 != null ||
      powerResult.P_VDD2H != null ||
      powerResult.P_VDD2L != null ||
      powerResult.P_VDDQ != null;

    const distribution = hasLpddrRails
      ? [
          { name: 'VDD1', value: powerResult.P_VDD1 ?? 0, color: 'hsl(217, 91%, 60%)' },
          { name: 'VDD2H', value: powerResult.P_VDD2H ?? 0, color: 'hsl(25, 95%, 53%)' },
          { name: 'VDD2L', value: powerResult.P_VDD2L ?? 0, color: 'hsl(142, 76%, 45%)' },
          { name: 'VDDQ', value: powerResult.P_VDDQ ?? 0, color: 'hsl(280, 87%, 65%)' },
        ]
      : [
          { name: 'VDD Core', value: powerResult.P_VDD_core, color: 'hsl(217, 91%, 60%)' },
          { name: 'VPP Core', value: powerResult.P_VPP_core, color: 'hsl(25, 95%, 53%)' },
        ];

    return { breakdown, distribution };
  }, [powerResult]);
}
