import type { Workload, MemoryPreset, PowerResult, DIMMPowerResult } from './types';
import { memoryPresets, workloadPresets } from './presets';
import { computeCorePower, computeDIMMPower, calculateDataRate } from './ddr5Calculator';
import { isApiAvailable, fetchBatchDIMMPower } from './api';

export type DimmSearchMode = 'optimize' | 'max_slots';

export interface ServerRequirements {
  powerBudgetPerServer: number; // W
  minDataRate: number; // MT/s
  totalCapacity: number; // GB
  workloadType: 'balanced' | 'read_heavy' | 'write_heavy' | 'idle' | 'stress' | 'database_web';
  dimmsPerServer?: number; // Max DIMM slots per server (also used as fixed count in max_slots mode)
  /** optimize: try 1..max DIMMs; max_slots: only evaluate all slots filled (fair comparison). */
  dimmSearchMode?: DimmSearchMode;
}

/** DIMM counts to evaluate for a given max slot count and search mode. */
export function dimmCountsForSearchMode(maxDIMMs: number, mode: DimmSearchMode | undefined): number[] {
  const max = Math.max(1, Math.floor(maxDIMMs));
  if (mode === 'max_slots') {
    return [max];
  }
  return Array.from({ length: max }, (_, i) => i + 1);
}

export interface ServerConfiguration {
  preset: MemoryPreset;
  dimmsPerServer: number;
  dimmsPerChannel: number;
  channelsPerServer: number;
  totalCapacity: number;
  powerPerDIMM: number;
  powerPerServer: number;
  dataRate: number;
  workload: Workload;
  powerResult: PowerResult;
  dimmPowerResult: DIMMPowerResult;
  meetsRequirements: {
    power: boolean;
    performance: boolean;
    capacity: boolean;
  };
  score: number; // Higher is better (lower power, higher performance)
}

/** Typical shortlist size (meaningful tradeoffs, not a long ranked list). */
export const SERVER_DEPLOYMENT_RANK_TARGET = 5;
/** Hard cap on rows returned; extra slots only fill when they add preset or DIMM-count variety. */
export const SERVER_DEPLOYMENT_RANK_MAX = 10;

export interface FindServerConfigurationsResult {
  rankedConfigurations: ServerConfiguration[];
  /** All valid configs before trimming to the shortlist. */
  totalMatched: number;
}

/**
 * Reduce a score-sorted list to a small set with varied presets and DIMM counts.
 * Assumes `sortedDescending` is already sorted by score (high first) and entries are unique per preset+dimms.
 */
export function pickDiverseRankedConfigurations(
  sortedDescending: ServerConfiguration[],
  options?: { target?: number; max?: number }
): ServerConfiguration[] {
  const target = options?.target ?? SERVER_DEPLOYMENT_RANK_TARGET;
  const max = options?.max ?? SERVER_DEPLOYMENT_RANK_MAX;
  const n = sortedDescending.length;
  if (n === 0) return [];
  if (n <= target) return sortedDescending.slice();

  const picked: ServerConfiguration[] = [];
  const key = (c: ServerConfiguration) => `${c.preset.id}:${c.dimmsPerServer}`;
  const pickedKeys = new Set<string>();
  const presetCount = new Map<string, number>();

  const add = (c: ServerConfiguration) => {
    const k = key(c);
    if (pickedKeys.has(k)) return false;
    picked.push(c);
    pickedKeys.add(k);
    presetCount.set(c.preset.id, (presetCount.get(c.preset.id) ?? 0) + 1);
    return true;
  };

  for (const c of sortedDescending) {
    if (picked.length >= max) break;
    if (pickedKeys.has(key(c))) continue;

    const newPreset = (presetCount.get(c.preset.id) ?? 0) === 0;
    const dimmsSeen = new Set(picked.map((p) => p.dimmsPerServer));
    const newDimms = !dimmsSeen.has(c.dimmsPerServer);

    if (picked.length < 3) {
      add(c);
      continue;
    }

    if (picked.length < target) {
      if (newPreset || newDimms) add(c);
      continue;
    }

    if (picked.length < max && (newPreset || newDimms)) {
      add(c);
    }
  }

  if (picked.length < target) {
    for (const c of sortedDescending) {
      if (picked.length >= target) break;
      add(c);
    }
  }

  return picked;
}

// Database/web mixed workload (typical for data centers)
const databaseWebWorkload: Workload = {
  BNK_PRE_percent: 45.0,
  CKE_LO_PRE_percent: 5.0,
  CKE_LO_ACT_percent: 5.0,
  PageHit_percent: 60.0,
  RDsch_percent: 35.0,
  RD_Data_Low_percent: 40.0,
  WRsch_percent: 30.0,
  WR_Data_Low_percent: 35.0,
  termRDsch_percent: 5.0,
  termWRsch_percent: 5.0,
  System_tRC_ns: 50.0,
  tRRDsch_ns: 4.5,
};

function getWorkload(workloadType: ServerRequirements['workloadType']): Workload {
  if (workloadType === 'database_web') {
    return databaseWebWorkload;
  }
  const preset = workloadPresets.find(w => w.id === workloadType);
  return preset?.workload || workloadPresets[0].workload;
}

export function buildServerConfiguration(
  preset: MemoryPreset,
  requirements: ServerRequirements,
  dimmsPerServer: number,
  workload: Workload,
  powerResult: PowerResult,
  dimmPowerResult: DIMMPowerResult
): ServerConfiguration {
  const dimmCapacityGB = parseFloat(preset.capacity);
  
  // Calculate total server power
  const powerPerServer = dimmPowerResult.P_total_DIMM * dimmsPerServer;
  
  // Calculate data rate
  const dataRate = calculateDataRate(preset.memspec.memtimingspec);
  
  // Calculate total capacity
  const totalCapacity = dimmCapacityGB * dimmsPerServer;
  
  // Check if meets requirements
  const meetsPower = powerPerServer <= requirements.powerBudgetPerServer;
  const meetsPerformance = dataRate >= requirements.minDataRate;
  const meetsCapacity = totalCapacity >= requirements.totalCapacity;
  
  // Calculate score (higher is better)
  // Score = (power efficiency) + (performance bonus) - (overcapacity penalty)
  const powerEfficiency = (requirements.powerBudgetPerServer - powerPerServer) / requirements.powerBudgetPerServer;
  const performanceBonus = (dataRate - requirements.minDataRate) / requirements.minDataRate;
  const overcapacityPenalty = totalCapacity > requirements.totalCapacity 
    ? (totalCapacity - requirements.totalCapacity) / requirements.totalCapacity * 0.1 
    : 0;
  const score = powerEfficiency * 0.5 + performanceBonus * 0.3 - overcapacityPenalty;
  
  // Typical server configurations: 2-4 channels, 1-2 DIMMs per channel
  const channelsPerServer = Math.ceil(dimmsPerServer / 2);
  const dimmsPerChannel = Math.ceil(dimmsPerServer / channelsPerServer);
  
  return {
    preset,
    dimmsPerServer,
    dimmsPerChannel,
    channelsPerServer,
    totalCapacity,
    powerPerDIMM: dimmPowerResult.P_total_DIMM,
    powerPerServer,
    dataRate,
    workload,
    powerResult,
    dimmPowerResult,
    meetsRequirements: {
      power: meetsPower,
      performance: meetsPerformance,
      capacity: meetsCapacity,
    },
    score,
  };
}

async function powerForAllPresets(
  workload: Workload
): Promise<Map<string, { powerResult: PowerResult; dimmPowerResult: DIMMPowerResult }>> {
  const map = new Map<string, { powerResult: PowerResult; dimmPowerResult: DIMMPowerResult }>();

  if (isApiAvailable()) {
    try {
      const memspecs = memoryPresets.map((p) => p.memspec);
      const dimmResults = await fetchBatchDIMMPower(workload, memspecs);
      memoryPresets.forEach((preset, i) => {
        const dimmPowerResult = dimmResults[i];
        map.set(preset.id, {
          powerResult: dimmPowerResult.corePower,
          dimmPowerResult,
        });
      });
      return map;
    } catch {
      // Fall back to local calculator below.
    }
  }

  for (const preset of memoryPresets) {
    const powerResult = computeCorePower(preset.memspec, workload);
    const dimmPowerResult = computeDIMMPower(powerResult, preset.memspec);
    map.set(preset.id, { powerResult, dimmPowerResult });
  }
  return map;
}

/** Uses Python core via batch API when NEXT_PUBLIC_API_URL is set; otherwise the JS port. */
export async function findServerConfigurations(
  requirements: ServerRequirements
): Promise<FindServerConfigurationsResult> {
  const configurations: ServerConfiguration[] = [];
  const maxDIMMs = requirements.dimmsPerServer || 8;
  const mode: DimmSearchMode = requirements.dimmSearchMode ?? 'optimize';
  const dimmIterations = dimmCountsForSearchMode(maxDIMMs, mode);
  const workload = getWorkload(requirements.workloadType);
  const powerByPreset = await powerForAllPresets(workload);

  for (const preset of memoryPresets) {
    const entry = powerByPreset.get(preset.id);
    if (!entry) continue;
    const { powerResult, dimmPowerResult } = entry;

    for (const dimms of dimmIterations) {
      const config = buildServerConfiguration(
        preset,
        requirements,
        dimms,
        workload,
        powerResult,
        dimmPowerResult
      );

      if (
        config.meetsRequirements.power &&
        config.meetsRequirements.performance &&
        config.meetsRequirements.capacity
      ) {
        configurations.push(config);
      }
    }
  }

  configurations.sort((a, b) => b.score - a.score);
  const totalMatched = configurations.length;
  const rankedConfigurations =
    totalMatched <= SERVER_DEPLOYMENT_RANK_MAX
      ? configurations.slice()
      : pickDiverseRankedConfigurations(configurations);
  return { rankedConfigurations, totalMatched };
}

export function formatServerSummary(config: ServerConfiguration): string {
  const { preset, dimmsPerServer, powerPerServer, totalCapacity, dataRate } = config;
  return `${dimmsPerServer}x ${preset.name} | ${totalCapacity}GB | ${dataRate} MT/s | ${powerPerServer.toFixed(2)}W`;
}

