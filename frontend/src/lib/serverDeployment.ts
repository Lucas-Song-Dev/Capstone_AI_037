import type { MemSpec, Workload, MemoryPreset, PowerResult, DIMMPowerResult } from './types';
import { memoryPresets, workloadPresets } from './presets';
import { computeCorePower, computeDIMMPower, calculateDataRate } from './ddr5Calculator';

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

function calculateServerConfig(
  preset: MemoryPreset,
  requirements: ServerRequirements,
  dimmsPerServer: number
): ServerConfiguration | null {
  const workload = getWorkload(requirements.workloadType);
  const dimmCapacityGB = parseFloat(preset.capacity);
  
  // Calculate power
  const powerResult = computeCorePower(preset.memspec, workload);
  const dimmPowerResult = computeDIMMPower(powerResult, preset.memspec);
  
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

export function findServerConfigurations(requirements: ServerRequirements): ServerConfiguration[] {
  const configurations: ServerConfiguration[] = [];
  const maxDIMMs = requirements.dimmsPerServer || 8; // Default to 8 DIMM slots
  
  for (const preset of memoryPresets) {
    const dimmCapacityGB = parseFloat(preset.capacity);
    
    // Try different DIMM counts (1 to maxDIMMs)
    for (let dimms = 1; dimms <= maxDIMMs; dimms++) {
      const config = calculateServerConfig(preset, requirements, dimms);
      
      if (config && config.meetsRequirements.power && 
          config.meetsRequirements.performance && 
          config.meetsRequirements.capacity) {
        configurations.push(config);
      }
    }
  }
  
  // Sort by score (best first)
  configurations.sort((a, b) => b.score - a.score);
  
  return configurations;
}

export function formatServerSummary(config: ServerConfiguration): string {
  const { preset, dimmsPerServer, powerPerServer, totalCapacity, dataRate } = config;
  return `${dimmsPerServer}x ${preset.name} | ${totalCapacity}GB | ${dataRate} MT/s | ${powerPerServer.toFixed(2)}W`;
}

