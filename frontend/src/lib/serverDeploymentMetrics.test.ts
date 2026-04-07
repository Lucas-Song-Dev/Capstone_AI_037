import { describe, it, expect } from 'vitest';
import {
  fleetMemoryPowerKw,
  fleetMemoryCapacityTb,
  rackCountForServers,
  SERVERS_PER_STANDARD_RACK,
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
