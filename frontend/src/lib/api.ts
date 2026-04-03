/**
 * Backend API client for DDR5 power calculations.
 *
 * - **Unified Vercel (repo root):** `vercel.json` rewrites `/api/*` to the Python serverless app.
 *   If `NEXT_PUBLIC_API_URL` is **unset**, the browser uses `window.location.origin` so requests
 *   hit `https://<deployment>/api/...` without extra env.
 * - **Explicit URL:** Set `NEXT_PUBLIC_API_URL` when the API is on another host (or for local dev
 *   with `http://localhost:8000` while Next runs on :3000).
 * - **Tests:** Stub `NEXT_PUBLIC_API_URL` to `''` (empty string) to disable the API and use the JS
 *   port; empty is treated as “no API”, not same-origin.
 */

import type { MemSpec, Workload, PowerResult, DIMMPowerResult } from './types';
import { calculateChipsPerDIMM } from './ddr5Calculator';

export function getApiBase(): string {
  if (typeof process === 'undefined') return '';

  const raw = process.env.NEXT_PUBLIC_API_URL;
  if (typeof raw === 'string' && raw.trim() !== '') {
    return raw.trim();
  }

  // Unset on client → same deployment (typical Vercel monorepo). Empty string → tests / opt-out.
  if (raw === undefined && typeof window !== 'undefined') {
    return window.location.origin;
  }

  return '';
}

export function isApiAvailable(): boolean {
  return Boolean(getApiBase());
}

/** Ensure memspec has nbrOfDevices for backend/core (default 1). */
export function normalizeMemspecForApi(memspec: MemSpec): MemSpec {
  const arch = memspec.memarchitecturespec;
  if (arch.nbrOfDevices != null) return memspec;
  return {
    ...memspec,
    memarchitecturespec: { ...arch, nbrOfDevices: 1 },
  };
}

/** Map flat /api/calculate/dimm JSON to DIMMPowerResult (shared by single and batch). */
export function dimmApiResponseToResult(
  raw: Record<string, number>,
  memspec: MemSpec
): DIMMPowerResult {
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

/** POST /api/calculate/core */
export async function fetchCorePower(memspec: MemSpec, workload: Workload): Promise<PowerResult> {
  const base = getApiBase();
  const res = await fetch(`${base}/api/calculate/core`, {
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
  const base = getApiBase();
  const res = await fetch(`${base}/api/calculate/interface`, {
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
  const base = getApiBase();
  const res = await fetch(`${base}/api/calculate/all`, {
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
  const base = getApiBase();
  const normalized = normalizeMemspecForApi(memspec);
  const res = await fetch(`${base}/api/calculate/dimm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      memspec: normalized,
      workload,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error((err as { detail?: string }).detail ?? `API error ${res.status}`);
  }
  const raw = (await res.json()) as Record<string, number>;
  return dimmApiResponseToResult(raw, normalized);
}

const INVERSE_BATCH_CHUNK = 48;

/**
 * POST /api/calculate/dimm/batch — many memspecs, one workload (order preserved).
 */
export async function fetchBatchDIMMPower(
  workload: Workload,
  memspecs: MemSpec[]
): Promise<DIMMPowerResult[]> {
  if (memspecs.length === 0) return [];
  const base = getApiBase();
  const normalized = memspecs.map(normalizeMemspecForApi);
  const out: DIMMPowerResult[] = [];

  for (let i = 0; i < normalized.length; i += INVERSE_BATCH_CHUNK) {
    const chunk = normalized.slice(i, i + INVERSE_BATCH_CHUNK);
    const res = await fetch(`${base}/api/calculate/dimm/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workload,
        memspecs: chunk,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error((err as { detail?: string }).detail ?? `API error ${res.status}`);
    }
    const data = (await res.json()) as { results: Record<string, number>[] };
    const rows = data.results;
    if (!Array.isArray(rows) || rows.length !== chunk.length) {
      throw new Error('Invalid batch DIMM response');
    }
    for (let j = 0; j < rows.length; j++) {
      out.push(dimmApiResponseToResult(rows[j], chunk[j]));
    }
  }

  return out;
}
