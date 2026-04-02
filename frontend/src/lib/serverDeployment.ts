import type { Workload, MemoryPreset, PowerResult, DIMMPowerResult } from './types';
import { memoryPresets, workloadPresets } from './presets';
import { computeCorePower, computeDIMMPower, calculateDataRate } from './ddr5Calculator';
import { isApiAvailable, fetchBatchDIMMPower } from './api';

export interface ServerRequirements {
  powerBudgetPerServer: number; // W
  minDataRate: number; // MT/s
  totalCapacity: number; // GB
  workloadType: 'balanced' | 'read_heavy' | 'write_heavy' | 'idle' | 'stress' | 'database_web';
  dimmsPerServer?: number; // Optional: specify number of DIMM slots
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

function buildServerConfiguration(
  preset: MemoryPreset,
  requirements: ServerRequirements,
  dimmsPerServer: number,
  workload: Workload,
  powerResult: PowerResult,
  dimmPowerResult: DIMMPowerResult
): ServerConfiguration | null {
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
): Promise<ServerConfiguration[]> {
  const configurations: ServerConfiguration[] = [];
  const maxDIMMs = requirements.dimmsPerServer || 8;
  const workload = getWorkload(requirements.workloadType);
  const powerByPreset = await powerForAllPresets(workload);

  for (const preset of memoryPresets) {
    const entry = powerByPreset.get(preset.id);
    if (!entry) continue;
    const { powerResult, dimmPowerResult } = entry;

    for (let dimms = 1; dimms <= maxDIMMs; dimms++) {
      const config = buildServerConfiguration(
        preset,
        requirements,
        dimms,
        workload,
        powerResult,
        dimmPowerResult
      );

      if (
        config &&
        config.meetsRequirements.power &&
        config.meetsRequirements.performance &&
        config.meetsRequirements.capacity
      ) {
        configurations.push(config);
      }
    }
  }

  configurations.sort((a, b) => b.score - a.score);
  return configurations;
}

export function formatServerSummary(config: ServerConfiguration): string {
  const { preset, dimmsPerServer, powerPerServer, totalCapacity, dataRate } = config;
  return `${dimmsPerServer}x ${preset.name} | ${totalCapacity}GB | ${dataRate} MT/s | ${powerPerServer.toFixed(2)}W`;
}

