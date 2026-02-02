import type { MemSpec, MemPowerSpec, Workload, PowerResult, MemoryPreset, DIMMPowerResult } from "./types";
import { computeCorePower, computeDIMMPower } from "./ddr5Calculator";
import { memoryPresets } from "./presets";

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

function randomInRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function perturbMemspec(base: MemSpec): MemSpec {
  const m = cloneMemspec(base);
  const p = m.mempowerspec;

  for (const key of TUNABLE_CURRENT_KEYS) {
    const [lo, hi] = CURRENT_FACTOR_BOUNDS[key as string];
    const factor = randomInRange(lo, hi);
    // currents are in mA
    (p as any)[key] = (p as any)[key] * factor;
  }

  const [vddLo, vddHi] = VOLTAGE_BOUNDS.vdd;
  const [vppLo, vppHi] = VOLTAGE_BOUNDS.vpp;
  p.vdd = randomInRange(vddLo, vddHi);
  p.vpp = randomInRange(vppLo, vppHi);

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

  let bestOverall: InverseResult | null = null;

  const presets: MemoryPreset[] = memoryPresets;

  for (const preset of presets) {
    let bestForPreset: InverseResult | null = null;

    for (let i = 0; i < samplesPerPreset; i++) {
      const candidateMemspec = perturbMemspec(preset.memspec);
      const power = computeCorePower(candidateMemspec, workload);
      const dimmPower = computeDIMMPower(power, candidateMemspec);

      if (!isPhysicallyReasonable(power)) {
        continue;
      }

      const loss = computeLoss(power, dimmPower, target, weights);

      if (!bestForPreset || loss < bestForPreset.loss) {
        bestForPreset = {
          basePresetId: preset.id,
          basePresetName: preset.name,
          optimizedMemspec: candidateMemspec,
          power,
          dimmPower,
          loss,
        };
      }
    }

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


