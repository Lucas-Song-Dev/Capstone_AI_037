import type { MemSpec, Workload, PowerResult, DIMMPowerResult } from './types';
import { computeCorePower, computeDIMMPower } from './ddr5Calculator';

/** True when memspec uses LPDDR5 / LPDDR5X core + interface models (requires API). */
export function isLpddrMemoryType(memoryType: string): boolean {
  const u = String(memoryType).trim().toUpperCase();
  return u === 'LPDDR5' || u === 'LPDDR5X';
}

/** Match Python/API semantics for registered DIMMs (RDIMM). */
export function registeredToBoolean(registered: string | boolean): boolean {
  if (typeof registered === 'boolean') return registered;
  const s = String(registered).trim().toLowerCase();
  return s === 'true' || s === '1' || s === 'yes';
}

export function computePowerLocal(
  memspec: MemSpec,
  workload: Workload
): { powerResult: PowerResult; dimmPowerResult: DIMMPowerResult } {
  if (isLpddrMemoryType(memspec.memoryType)) {
    throw new Error(
      'LPDDR5/LPDDR5X power is computed by the Python core only. Use the deployed API or run the api service locally.'
    );
  }
  const powerResult = computeCorePower(memspec, workload);
  const dimmPowerResult = computeDIMMPower(powerResult, memspec, {
    isRDIMM: registeredToBoolean(memspec.registered),
  });
  return { powerResult, dimmPowerResult };
}
