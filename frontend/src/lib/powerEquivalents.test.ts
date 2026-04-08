import { describe, expect, test } from 'vitest';
import { energyEquivalentsFromWatts } from './powerEquivalents';

describe('energyEquivalentsFromWatts', () => {
  test('returns zeros for non-positive or non-finite inputs', () => {
    expect(energyEquivalentsFromWatts(0).kwhPerDay).toBe(0);
    expect(energyEquivalentsFromWatts(-1).kwhPerYear).toBe(0);
    expect(energyEquivalentsFromWatts(Number.NaN).evMilesPerDay).toBe(0);
    expect(energyEquivalentsFromWatts(Number.POSITIVE_INFINITY).evFullChargesPerYear).toBe(0);
  });

  test('converts 1000W continuous into 24 kWh/day and 8760 kWh/year', () => {
    const r = energyEquivalentsFromWatts(1000);
    expect(r.kwhPerDay).toBeCloseTo(24, 10);
    expect(r.kwhPerYear).toBeCloseTo(8760, 10);
  });

  test('derives EV miles and full charges using default assumptions', () => {
    // 300W continuous -> 7.2 kWh/day
    // EV miles/day @0.30 kWh/mi -> 24 mi/day
    // Full charges/day @60 kWh -> 0.12 charges/day
    const r = energyEquivalentsFromWatts(300);
    expect(r.kwhPerDay).toBeCloseTo(7.2, 10);
    expect(r.evMilesPerDay).toBeCloseTo(24, 10);
    expect(r.evFullChargesPerDay).toBeCloseTo(0.12, 10);
  });

  test('computes dietary calories equivalence (kWh to people-days) with defaults', () => {
    // 2000 kcal = 2000*4184 J = 8,368,000 J ≈ 2.324444... kWh
    // 1kW continuous -> 24 kWh/day -> ~10.326 people/day at 2000 kcal/day
    const r = energyEquivalentsFromWatts(1000);
    expect(r.peopleDailyCaloriesPerDay).toBeCloseTo(24 / ((2000 * 4184) / 3_600_000), 6);
  });
});

