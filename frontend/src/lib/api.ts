/**
 * Backend API client for DDR5 power calculations.
 * Uses the core package via the backend when NEXT_PUBLIC_API_URL is set.
 */

import type { MemSpec, Workload, PowerResult, DIMMPowerResult } from './types';
import { calculateChipsPerDIMM } from './ddr5Calculator';

const API_BASE = typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_API_URL ?? '' : '';

export function isApiAvailable(): boolean {
  return Boolean(API_BASE);
}

/** Ensure memspec has nbrOfDevices for backend/core (default 1). */
function normalizeMemspecForApi(memspec: MemSpec): MemSpec {
  const arch = memspec.memarchitecturespec;
  if (arch.nbrOfDevices != null) return memspec;
  return {
    ...memspec,
    memarchitecturespec: { ...arch, nbrOfDevices: 1 },
  };
}

/** POST /api/calculate/core */
export async function fetchCorePower(memspec: MemSpec, workload: Workload): Promise<PowerResult> {
  const res = await fetch(`${API_BASE}/api/calculate/core`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      memspec: normalizeMemspecForApi(memspec),
      workload,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error((err as { detail?: string }).detail ?? `API error ${res.status}`);
  }
  return res.json() as Promise<PowerResult>;
}

/** POST /api/calculate/interface - returns interface power breakdown (P_total_interface, etc.) */
export async function fetchInterfacePower(
  memspec: MemSpec,
  workload: Workload
): Promise<Record<string, number>> {
  const res = await fetch(`${API_BASE}/api/calculate/interface`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      memspec: normalizeMemspecForApi(memspec),
      workload,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error((err as { detail?: string }).detail ?? `API error ${res.status}`);
  }
  return res.json() as Promise<Record<string, number>>;
}

/** POST /api/calculate/all - core + interface for single device */
export async function fetchAllPower(
  memspec: MemSpec,
  workload: Workload
): Promise<Record<string, number>> {
  const res = await fetch(`${API_BASE}/api/calculate/all`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      memspec: normalizeMemspecForApi(memspec),
      workload,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error((err as { detail?: string }).detail ?? `API error ${res.status}`);
  }
  return res.json() as Promise<Record<string, number>>;
}

/**
 * POST /api/calculate/dimm - DIMM-level power from core package.
 * Maps backend response (core.*, if.*, P_total_core, P_total_interface, P_total) to DIMMPowerResult.
 */
export async function fetchDIMMPower(
  memspec: MemSpec,
  workload: Workload
): Promise<DIMMPowerResult> {
  const res = await fetch(`${API_BASE}/api/calculate/dimm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      memspec: normalizeMemspecForApi(memspec),
      workload,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error((err as { detail?: string }).detail ?? `API error ${res.status}`);
  }
  const raw = (await res.json()) as Record<string, number>;

  const P_total_core = raw.P_total_core ?? 0;
  const P_total_interface = raw.P_total_interface ?? 0;
  const P_total = raw.P_total ?? P_total_core + P_total_interface;

  const corePower: PowerResult = {
    P_PRE_STBY_core: raw['core.P_PRE_STBY_core'] ?? 0,
    P_ACT_STBY_core: raw['core.P_ACT_STBY_core'] ?? 0,
    P_ACT_PRE_core: raw['core.P_ACT_PRE_core'] ?? 0,
    P_RD_core: raw['core.P_RD_core'] ?? 0,
    P_WR_core: raw['core.P_WR_core'] ?? 0,
    P_REF_core: raw['core.P_REF_core'] ?? 0,
    P_VDD_core: raw['core.P_VDD_core'] ?? 0,
    P_VPP_core: raw['core.P_VPP_core'] ?? 0,
    P_total_core,
  };

  const chipsPerDIMM = calculateChipsPerDIMM(memspec.memarchitecturespec);

  return {
    corePower,
    chipsPerDIMM,
    corePowerTotal: P_total_core,
    interfacePower: P_total_interface,
    pmicOverhead: 0,
    P_total_DIMM: P_total,
    P_core_DIMM: P_total_core,
    P_interface_DIMM: P_total_interface,
    P_overhead_DIMM: 0,
  };
}
