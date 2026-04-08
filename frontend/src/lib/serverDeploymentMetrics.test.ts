import { describe, it, expect } from 'vitest';
import {
  fleetMemoryPowerKw,
  fleetMemoryCapacityTb,
  rackCountForServers,
  SERVERS_PER_STANDARD_RACK,
  matchingCapPerServerW,
  maxServersUnderTotalBudget,
  fleetRemainingBudgetW,
} from './serverDeploymentMetrics';

describe('fleetMemoryPowerKw', () => {
  it('converts W to kW (memory draw × server count)', () => {
    expect(fleetMemoryPowerKw(100, 50)).toBe(5);
    expect(fleetMemoryPowerKw(1, 1000)).toBe(1);
    expect(fleetMemoryPowerKw(100, 47.3)).toBeCloseTo(4.73, 10);
  });

  it('returns 0 for non-positive server count', () => {
    expect(fleetMemoryPowerKw(0, 200)).toBe(0);
    expect(fleetMemoryPowerKw(-5, 200)).toBe(0);
  });

  it('floors fractional server counts', () => {
    // 10.9 → 10 servers × 10 W = 100 W = 0.1 kW
    expect(fleetMemoryPowerKw(10.9, 10)).toBeCloseTo(0.1, 10);
  });
});

describe('fleetMemoryCapacityTb', () => {
  it('uses ÷1024 from GB installed per server (matches deployment UI)', () => {
    // 100 servers × 256 GB/server = 25600 GB → 25600/1024 = 25 TB
    expect(fleetMemoryCapacityTb(100, 256)).toBeCloseTo(25, 10);
    expect(fleetMemoryCapacityTb(42, 64)).toBeCloseTo((42 * 64) / 1024, 10);
  });

  it('returns 0 when no servers', () => {
    expect(fleetMemoryCapacityTb(0, 128)).toBe(0);
  });
});

describe('rackCountForServers', () => {
  it('matches standard 42-server rack rounding', () => {
    expect(rackCountForServers(100)).toBe(Math.ceil(100 / SERVERS_PER_STANDARD_RACK));
    expect(rackCountForServers(42)).toBe(1);
    expect(rackCountForServers(43)).toBe(2);
    expect(rackCountForServers(1)).toBe(1);
  });

  it('returns 0 for zero servers', () => {
    expect(rackCountForServers(0)).toBe(0);
  });
});

describe('matchingCapPerServerW', () => {
  it('divides total by reference servers for search-time cap', () => {
    expect(matchingCapPerServerW(100000, 100)).toBe(1000);
    expect(matchingCapPerServerW(500, 100)).toBe(5);
  });

  it('returns 0 for invalid inputs', () => {
    expect(matchingCapPerServerW(0, 100)).toBe(0);
    expect(matchingCapPerServerW(-1, 100)).toBe(0);
    expect(matchingCapPerServerW(1000, 0)).toBe(0);
    expect(matchingCapPerServerW(Number.NaN, 100)).toBe(0);
  });
});

describe('maxServersUnderTotalBudget', () => {
  it('floors total/power and clamps to maxServers', () => {
    expect(maxServersUnderTotalBudget(100, 10)).toBe(10);
    expect(maxServersUnderTotalBudget(100, 11)).toBe(9);
    expect(maxServersUnderTotalBudget(100, 1, 50)).toBe(50);
  });

  it('returns 0 for invalid inputs', () => {
    expect(maxServersUnderTotalBudget(0, 10)).toBe(0);
    expect(maxServersUnderTotalBudget(100, 0)).toBe(0);
    expect(maxServersUnderTotalBudget(100, -1)).toBe(0);
  });
});

describe('fleetRemainingBudgetW', () => {
  it('computes remaining = total - (servers × powerPerServer)', () => {
    expect(fleetRemainingBudgetW(100, 10, 10)).toBe(0);
    expect(fleetRemainingBudgetW(100, 9, 11)).toBe(1);
  });

  it('floors fractional server counts and never returns negative', () => {
    expect(fleetRemainingBudgetW(100, 9.9, 11)).toBe(1); // 9×11=99
    expect(fleetRemainingBudgetW(100, 1000, 11)).toBe(0);
  });
});
