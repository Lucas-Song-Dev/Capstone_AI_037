import { describe, it, expect } from 'vitest';
import { parseWorkloadJson } from './workloadJson';
import { defaultWorkload } from './presets';

const validWorkload = {
  BNK_PRE_percent: 50.0,
  CKE_LO_PRE_percent: 0.0,
  CKE_LO_ACT_percent: 0.0,
  PageHit_percent: 50.0,
  RDsch_percent: 25.0,
  RD_Data_Low_percent: 50.0,
  WRsch_percent: 25.0,
  WR_Data_Low_percent: 50.0,
  termRDsch_percent: 0.0,
  termWRsch_percent: 0.0,
  System_tRC_ns: 46.0,
  tRRDsch_ns: 5.0,
};

describe('parseWorkloadJson', () => {
  it('parses root-level workload JSON', () => {
    const w = parseWorkloadJson(JSON.stringify(validWorkload));
    expect(w.RDsch_percent).toBe(25.0);
    expect(w.tRRDsch_ns).toBe(5.0);
  });

  it('parses JSON wrapped in workload key', () => {
    const w = parseWorkloadJson(JSON.stringify({ workload: { ...validWorkload, RDsch_percent: 40.0 } }));
    expect(w.RDsch_percent).toBe(40.0);
  });

  it('throws on invalid JSON', () => {
    expect(() => parseWorkloadJson('not json')).toThrow(/Invalid JSON/);
  });

  it('throws when a required field is missing', () => {
    const bad = { ...validWorkload };
    delete (bad as Record<string, unknown>).tRRDsch_ns;
    expect(() => parseWorkloadJson(JSON.stringify(bad))).toThrow(/Missing or invalid required field: tRRDsch_ns/);
  });

  it('throws when a required field is not a number', () => {
    const bad = { ...validWorkload, RDsch_percent: '25' };
    expect(() => parseWorkloadJson(JSON.stringify(bad))).toThrow(/Missing or invalid required field: RDsch_percent/);
  });

  it('matches defaultWorkload shape from presets', () => {
    const w = parseWorkloadJson(JSON.stringify(defaultWorkload));
    expect(w).toEqual(defaultWorkload);
  });
});
