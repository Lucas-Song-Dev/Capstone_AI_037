import type { MemSpec, Workload, PowerResult, DIMMPowerResult } from './types';
import { computeCorePower, computeDIMMPower } from './ddr5Calculator';

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
  const powerResult = computeCorePower(memspec, workload);
  const dimmPowerResult = computeDIMMPower(powerResult, memspec, {
    isRDIMM: registeredToBoolean(memspec.registered),
  });
  return { powerResult, dimmPowerResult };
}
