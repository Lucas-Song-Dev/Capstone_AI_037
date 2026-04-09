/**
 * Fleet-level numbers shown on the server deployment page.
 * Centralizes formulas so tests can lock the same math as the UI.
 */

export const SERVERS_PER_STANDARD_RACK = 42;

/** Search-time per-server cap derived from a total fleet memory power budget. */
export function matchingCapPerServerW(totalBudgetW: number, referenceServers: number): number {
  if (!Number.isFinite(totalBudgetW) || totalBudgetW <= 0) return 0;
  const ref = Number.isFinite(referenceServers) ? Math.floor(referenceServers) : 0;
  if (ref <= 0) return 0;
  return totalBudgetW / ref;
}

/** Maximum homogeneous servers that fit under a total fleet memory power budget. */
export function maxServersUnderTotalBudget(
  totalBudgetW: number,
  powerPerServerW: number,
  maxServers: number = 1_000_000
): number {
  const max = Number.isFinite(maxServers) ? Math.max(0, Math.floor(maxServers)) : 0;
  if (!Number.isFinite(totalBudgetW) || totalBudgetW <= 0) return 0;
  if (!Number.isFinite(powerPerServerW) || powerPerServerW <= 0) return 0;
  return Math.min(max, Math.floor(totalBudgetW / powerPerServerW));
}

/** Remaining fleet memory power budget (W) after allocating `numServers` at `powerPerServerW`. */
export function fleetRemainingBudgetW(
  totalBudgetW: number,
  numServers: number,
  powerPerServerW: number
): number {
  if (!Number.isFinite(totalBudgetW) || totalBudgetW <= 0) return 0;
  const n = Number.isFinite(numServers) ? Math.max(0, Math.floor(numServers)) : 0;
  if (!Number.isFinite(powerPerServerW) || powerPerServerW < 0) return 0;
  return Math.max(0, totalBudgetW - n * powerPerServerW);
}

/** Memory-only fleet power in kilowatts (W → kW). */
export function fleetMemoryPowerKw(numServers: number, powerPerServerW: number): number {
  const n = Number.isFinite(numServers) ? Math.max(0, Math.floor(numServers)) : 0;
  if (!Number.isFinite(powerPerServerW) || powerPerServerW < 0) return 0;
  return (n * powerPerServerW) / 1000;
}

/**
 * Aggregate installed memory in TB using the same rule as the deployment UI:
 * (servers × GB per server) / 1024 (binary TB / TiB-style labeling).
 */
export function fleetMemoryCapacityTb(numServers: number, memoryGbPerServer: number): number {
  const n = Number.isFinite(numServers) ? Math.max(0, Math.floor(numServers)) : 0;
  if (!Number.isFinite(memoryGbPerServer) || memoryGbPerServer < 0) return 0;
  return (n * memoryGbPerServer) / 1024;
}

export function rackCountForServers(
  numServers: number,
  serversPerRack: number = SERVERS_PER_STANDARD_RACK
): number {
  const n = Number.isFinite(numServers) ? Math.max(0, Math.floor(numServers)) : 0;
  const r = Math.floor(serversPerRack);
  if (r <= 0) return 0;
  if (n === 0) return 0;
  return Math.ceil(n / r);
}

/**
 * Theoretical peak aggregate memory bandwidth per server (GB/s):
 * MT/s × 8 bytes per 64-bit channel transfer × channel count ÷ 1000.
 */
export function serverPeakMemoryBandwidthGbps(dataRateMTs: number, channelsPerServer: number): number {
  const dr = Number.isFinite(dataRateMTs) ? Math.max(0, dataRateMTs) : 0;
  const ch = Number.isFinite(channelsPerServer) ? Math.max(0, Math.floor(channelsPerServer)) : 0;
  return (dr * 8 * ch) / 1000;
}

/** Minimum homogeneous servers to meet or exceed a fleet aggregate bandwidth target (GB/s). */
export function minServersForBandwidthTarget(
  targetFleetGbps: number,
  perServerGbps: number,
  maxServers: number = 1_000_000
): number {
  const max = Number.isFinite(maxServers) ? Math.max(0, Math.floor(maxServers)) : 0;
  if (!Number.isFinite(targetFleetGbps) || targetFleetGbps <= 0) return 0;
  if (!Number.isFinite(perServerGbps) || perServerGbps <= 0) return 0;
  return Math.min(max, Math.ceil(targetFleetGbps / perServerGbps));
}

/** Minimum homogeneous servers to meet or exceed a fleet aggregate memory capacity target (TB). */
export function minServersForCapacityTarget(
  targetFleetTb: number,
  memoryGbPerServer: number,
  maxServers: number = 1_000_000
): number {
  const max = Number.isFinite(maxServers) ? Math.max(0, Math.floor(maxServers)) : 0;
  if (!Number.isFinite(targetFleetTb) || targetFleetTb <= 0) return 0;
  if (!Number.isFinite(memoryGbPerServer) || memoryGbPerServer <= 0) return 0;
  const tbPerServer = memoryGbPerServer / 1024;
  return Math.min(max, Math.ceil(targetFleetTb / tbPerServer));
}

/** Fleet aggregate peak memory bandwidth (GB/s) for a homogeneous fleet. */
export function fleetAggregateBandwidthGbps(numServers: number, perServerGbps: number): number {
  const n = Number.isFinite(numServers) ? Math.max(0, Math.floor(numServers)) : 0;
  if (!Number.isFinite(perServerGbps) || perServerGbps < 0) return 0;
  return n * perServerGbps;
}
