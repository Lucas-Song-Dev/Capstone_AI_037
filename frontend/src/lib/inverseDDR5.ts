import type { MemSpec, MemPowerSpec, Workload, PowerResult, MemoryPreset, DIMMPowerResult } from "./types";
import { computeCorePower, computeDIMMPower } from "./ddr5Calculator";
import { memoryPresets } from "./presets";
import { isApiAvailable, fetchBatchDIMMPower } from "./api";

export interface InverseTarget {
  P_total_core: number;
  P_VDD_core?: number;
  P_VPP_core?: number;
  P_RD_core?: number;
  P_WR_core?: number;
  P_total_DIMM?: number;
}

export interface InverseWeights {
  P_total_core: number;
  P_VDD_core: number;
  P_VPP_core: number;
  P_RD_core: number;
  P_WR_core: number;
  P_total_DIMM: number;
}

export interface InverseResult {
  basePresetId: string;
  basePresetName: string;
  optimizedMemspec: MemSpec;
  power: PowerResult;
  dimmPower: DIMMPowerResult;
  loss: number;
}

const DEFAULT_WEIGHTS: InverseWeights = {
  P_total_core: 1.0,
  P_VDD_core: 0.3,
  P_VPP_core: 0.3,
  P_RD_core: 0.5,
  P_WR_core: 0.5,
  P_total_DIMM: 0.7,
};

const TUNABLE_CURRENT_KEYS: (keyof MemPowerSpec)[] = [
  "idd0",
  "idd2n",
  "idd3n",
  "idd4r",
  "idd4w",
  "idd5b",
  "ipp0",
  "ipp2n",
  "ipp3n",
  "ipp5b",
];

const CURRENT_FACTOR_BOUNDS: Record<string, [number, number]> = {
  idd0: [0.7, 1.3],
  idd2n: [0.7, 1.3],
  idd3n: [0.7, 1.3],
  idd4r: [0.7, 1.3],
  idd4w: [0.7, 1.3],
  idd5b: [0.7, 1.3],
  ipp0: [0.7, 1.3],
  ipp2n: [0.7, 1.3],
  ipp3n: [0.7, 1.3],
  ipp5b: [0.7, 1.3],
};

const VOLTAGE_BOUNDS = {
  vdd: [1.0, 1.2] as [number, number],
  vpp: [1.6, 1.9] as [number, number],
};

function cloneMemspec(memspec: MemSpec): MemSpec {
  return JSON.parse(JSON.stringify(memspec));
}

/** FNV-1a 32-bit — stable string seed for reproducible inverse search. */
function hashStringToSeed(input: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

/** Deterministic PRNG (mulberry32) so identical inputs yield identical search results. */
function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randomInRange(rng: () => number, min: number, max: number): number {
  return min + rng() * (max - min);
}

function perturbMemspec(base: MemSpec, rng: () => number): MemSpec {
  const m = cloneMemspec(base);
  const p = m.mempowerspec;

  for (const key of TUNABLE_CURRENT_KEYS) {
    const [lo, hi] = CURRENT_FACTOR_BOUNDS[key as string];
    const factor = randomInRange(rng, lo, hi);
    // currents are in mA
    (p as any)[key] = (p as any)[key] * factor;
  }

  const [vddLo, vddHi] = VOLTAGE_BOUNDS.vdd;
  const [vppLo, vppHi] = VOLTAGE_BOUNDS.vpp;
  p.vdd = randomInRange(rng, vddLo, vddHi);
  p.vpp = randomInRange(rng, vppLo, vppHi);

  return m;
}

function computeLoss(
  power: PowerResult,
  dimmPower: DIMMPowerResult | null,
  target: InverseTarget,
  weights: InverseWeights
): number {
  let loss = 0;

  loss +=
    weights.P_total_core *
    (power.P_total_core - target.P_total_core) *
    (power.P_total_core - target.P_total_core);

  if (typeof target.P_VDD_core === "number") {
    const diff = power.P_VDD_core - target.P_VDD_core;
    loss += weights.P_VDD_core * diff * diff;
  }

  if (typeof target.P_VPP_core === "number") {
    const diff = power.P_VPP_core - target.P_VPP_core;
    loss += weights.P_VPP_core * diff * diff;
  }

  if (typeof target.P_RD_core === "number") {
    const diff = power.P_RD_core - target.P_RD_core;
    loss += weights.P_RD_core * diff * diff;
  }

  if (typeof target.P_WR_core === "number") {
    const diff = power.P_WR_core - target.P_WR_core;
    loss += weights.P_WR_core * diff * diff;
  }

  if (dimmPower && typeof target.P_total_DIMM === "number") {
    const diff = dimmPower.P_total_DIMM - target.P_total_DIMM;
    loss += weights.P_total_DIMM * diff * diff;
  }

  return loss;
}

function isPhysicallyReasonable(power: PowerResult): boolean {
  // Basic sanity: all core components should be non-negative.
  return (
    power.P_total_core >= 0 &&
    power.P_VDD_core >= 0 &&
    power.P_VPP_core >= 0 &&
    power.P_RD_core >= 0 &&
    power.P_WR_core >= 0 &&
    power.P_PRE_STBY_core >= 0 &&
    power.P_ACT_STBY_core >= 0 &&
    power.P_ACT_PRE_core >= 0 &&
    power.P_REF_core >= 0
  );
}

function updateBestForCandidate(
  preset: MemoryPreset,
  candidateMemspec: MemSpec,
  power: PowerResult,
  dimmPower: DIMMPowerResult,
  target: InverseTarget,
  weights: InverseWeights,
  bestSoFar: InverseResult | null
): InverseResult | null {
  if (!isPhysicallyReasonable(power)) {
    return bestSoFar;
  }
  const loss = computeLoss(power, dimmPower, target, weights);
  if (!bestSoFar || loss < bestSoFar.loss) {
    return {
      basePresetId: preset.id,
      basePresetName: preset.name,
      optimizedMemspec: candidateMemspec,
      power,
      dimmPower,
      loss,
    };
  }
  return bestSoFar;
}

/**
 * When NEXT_PUBLIC_API_URL is set, uses POST /api/calculate/dimm/batch (Python core).
 * Otherwise uses the in-browser port (ddr5Calculator).
 */
async function searchOnePreset(
  preset: MemoryPreset,
  workload: Workload,
  target: InverseTarget,
  weights: InverseWeights,
  samplesPerPreset: number,
  rng: () => number
): Promise<InverseResult | null> {
  const candidates: MemSpec[] = [];
  for (let i = 0; i < samplesPerPreset; i++) {
    candidates.push(perturbMemspec(preset.memspec, rng));
  }

  let bestForPreset: InverseResult | null = null;

  if (isApiAvailable()) {
    try {
      const dimmResults = await fetchBatchDIMMPower(workload, candidates);
      for (let i = 0; i < candidates.length; i++) {
        const dimmPower = dimmResults[i];
        bestForPreset = updateBestForCandidate(
          preset,
          candidates[i],
          dimmPower.corePower,
          dimmPower,
          target,
          weights,
          bestForPreset
        );
      }
      return bestForPreset;
    } catch {
      // Network / API errors: fall back to local calculator for this preset.
    }
  }

  for (let i = 0; i < candidates.length; i++) {
    const m = candidates[i];
    const power = computeCorePower(m, workload);
    const dimmPower = computeDIMMPower(power, m);
    bestForPreset = updateBestForCandidate(
      preset,
      m,
      power,
      dimmPower,
      target,
      weights,
      bestForPreset
    );
  }
  return bestForPreset;
}

export async function inverseSearchForTarget(
  workload: Workload,
  target: InverseTarget,
  options?: {
    weights?: Partial<InverseWeights>;
    samplesPerPreset?: number;
  }
): Promise<InverseResult> {
  const weights: InverseWeights = {
    ...DEFAULT_WEIGHTS,
    ...(options?.weights ?? {}),
  };
  const samplesPerPreset = options?.samplesPerPreset ?? 300;

  const seedPayload = JSON.stringify({
    workload,
    target,
    weights,
    samplesPerPreset,
  });
  const rng = mulberry32(hashStringToSeed(seedPayload));

  let bestOverall: InverseResult | null = null;

  const presets: MemoryPreset[] = memoryPresets;

  for (const preset of presets) {
    const bestForPreset = await searchOnePreset(
      preset,
      workload,
      target,
      weights,
      samplesPerPreset,
      rng
    );

    if (bestForPreset) {
      if (!bestOverall || bestForPreset.loss < bestOverall.loss) {
        bestOverall = bestForPreset;
      }
    }
  }

  if (!bestOverall) {
    throw new Error("Inverse search failed to find any valid configuration.");
  }

  return bestOverall;
}


