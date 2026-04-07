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
import {
  computePowerLocal,
  isLpddrMemoryType,
  registeredToBoolean,
} from './powerCompute';

function _coreKey(k: string, raw: Record<string, number>, corePrefix: boolean): number {
  const key = corePrefix ? `core.${k}` : k;
  return raw[key] ?? 0;
}

function _hasLpddrRailKeys(raw: Record<string, number>, corePrefix: boolean): boolean {
  const p1 = corePrefix ? raw['core.P_VDD1'] : raw.P_VDD1;
  const p2h = corePrefix ? raw['core.P_VDD2H'] : raw.P_VDD2H;
  return p1 !== undefined || p2h !== undefined;
}

function _optionalCoreField(
  raw: Record<string, number>,
  k: string,
  corePrefix: boolean
): number | undefined {
  const key = corePrefix ? `core.${k}` : k;
  if (!(key in raw)) return undefined;
  const v = raw[key];
  return typeof v === 'number' && !Number.isNaN(v) ? v : undefined;
}

/** Map /api/calculate/core JSON (or core.* keys from DIMM response) to PowerResult. */
export function coreApiResponseToPowerResult(
  raw: Record<string, number>,
  corePrefix = false
): PowerResult {
  const ck = (k: string) => _coreKey(k, raw, corePrefix);
  const total = raw.P_total_core ?? ck('P_total_core');
  if (_hasLpddrRailKeys(raw, corePrefix)) {
    const v1 = ck('P_VDD1');
    const v2h = ck('P_VDD2H');
    const v2l = ck('P_VDD2L');
    const vq = ck('P_VDDQ');
    const railSum = v1 + v2h + v2l + vq;
    return {
      P_PRE_STBY_core: ck('P_PRE_STBY_core'),
      P_ACT_STBY_core: ck('P_ACT_STBY_core'),
      P_ACT_PRE_core: ck('P_ACT_PRE_core'),
      P_RD_core: ck('P_RD_core'),
      P_WR_core: ck('P_WR_core'),
      P_REF_core: ck('P_REF_core'),
      P_VDD_core: railSum,
      P_VPP_core: 0,
      P_total_core: total,
      P_VDD1: v1,
      P_VDD2H: v2h,
      P_VDD2L: v2l,
      P_VDDQ: vq,
      P_background: _optionalCoreField(raw, 'P_background', corePrefix),
      P_SELFREF: _optionalCoreField(raw, 'P_SELFREF', corePrefix),
    };
  }
  return {
    P_PRE_STBY_core: ck('P_PRE_STBY_core'),
    P_ACT_STBY_core: ck('P_ACT_STBY_core'),
    P_ACT_PRE_core: ck('P_ACT_PRE_core'),
    P_RD_core: ck('P_RD_core'),
    P_WR_core: ck('P_WR_core'),
    P_REF_core: ck('P_REF_core'),
    P_VDD_core: ck('P_VDD_core'),
    P_VPP_core: ck('P_VPP_core'),
    P_total_core: total,
  };
}

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

/**
 * Shape memspec for FastAPI: `registered` as "true"/"false", `nbrOfDBs` and `nbrOfDevices` set.
 * Mirrors tests/e2e/api_payload.py.
 */
export function normalizeMemspecForApi(memspec: MemSpec): MemSpec {
  const arch = memspec.memarchitecturespec;
  const nbrOfDevices = arch.nbrOfDevices != null ? arch.nbrOfDevices : 1;
  const nbrOfDBs =
    arch.nbrOfDBs != null && !Number.isNaN(Number(arch.nbrOfDBs))
      ? Math.round(Number(arch.nbrOfDBs))
      : arch.nbrOfBankGroups ?? 8;
  const registered = registeredToBoolean(memspec.registered) ? 'true' : 'false';

  return {
    ...memspec,
    registered,
    memarchitecturespec: {
      ...arch,
      nbrOfDevices,
      nbrOfDBs,
    },
  };
}

export type TryApiThenLocalResult = {
  powerResult: PowerResult;
  dimmPowerResult: DIMMPowerResult;
  /** True when API was attempted and failed; false when API unavailable or succeeded. */
  usedFallback: boolean;
};

/** Map flat /api/calculate/dimm JSON to DIMMPowerResult (shared by single and batch). */
export function dimmApiResponseToResult(
  raw: Record<string, number>,
  memspec: MemSpec
): DIMMPowerResult {
  const P_total_core = raw.P_total_core ?? 0;
  const P_total_interface = raw.P_total_interface ?? 0;
  const P_total = raw.P_total ?? P_total_core + P_total_interface;

  const corePower = coreApiResponseToPowerResult(raw, true);
  if (!corePower.P_total_core && P_total_core) {
    corePower.P_total_core = P_total_core;
  }

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
  const data = (await res.json()) as Record<string, number>;
  return coreApiResponseToPowerResult(data, false);
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

/**
 * Try Python API (core + DIMM); on any failure use in-browser calculator so the UI stays usable.
 */
export async function tryApiThenLocalPower(
  memspec: MemSpec,
  workload: Workload
): Promise<TryApiThenLocalResult> {
  const lpddr = isLpddrMemoryType(memspec.memoryType);

  if (!isApiAvailable()) {
    if (lpddr) {
      throw new Error(
        'LPDDR5/LPDDR5X presets require the power API (Python core). Set NEXT_PUBLIC_API_URL to your API, or use same-origin deployment with /api routes.'
      );
    }
    const { powerResult, dimmPowerResult } = computePowerLocal(memspec, workload);
    return { powerResult, dimmPowerResult, usedFallback: false };
  }
  try {
    const [powerResult, dimmPowerResult] = await Promise.all([
      fetchCorePower(memspec, workload),
      fetchDIMMPower(memspec, workload),
    ]);
    return { powerResult, dimmPowerResult, usedFallback: false };
  } catch (e) {
    if (lpddr) {
      throw e instanceof Error ? e : new Error(String(e));
    }
    const { powerResult, dimmPowerResult } = computePowerLocal(memspec, workload);
    return { powerResult, dimmPowerResult, usedFallback: true };
  }
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
