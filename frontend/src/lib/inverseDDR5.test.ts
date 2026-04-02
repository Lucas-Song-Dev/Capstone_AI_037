import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { inverseSearchForTarget } from "./inverseDDR5";
import { memoryPresets, defaultWorkload } from "./presets";
import { computeCorePower, computeDIMMPower } from "./ddr5Calculator";

describe("inverseSearchForTarget", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("can approximately recover a known preset total core power", async () => {
    const preset = memoryPresets[0];
    const workload = defaultWorkload;

    const power = computeCorePower(preset.memspec, workload);
    const dimm = computeDIMMPower(power, preset.memspec);

    const target = {
      P_total_core: power.P_total_core,
      P_total_DIMM: dimm.P_total_DIMM,
    };

    const result = await inverseSearchForTarget(workload, target, {
      samplesPerPreset: 80,
    });

    expect(result.loss).toBeGreaterThanOrEqual(0);
    const recovered = result.power.P_total_core;
    const relErr = Math.abs(recovered - power.P_total_core) / power.P_total_core;
    expect(relErr).toBeLessThan(0.1); // within 10%
  });

  it("returns identical results for identical inputs (deterministic search)", async () => {
    const workload = defaultWorkload;
    const target = { P_total_core: 2.0 };
    const opts = { samplesPerPreset: 60 };

    const r1 = await inverseSearchForTarget(workload, target, opts);
    const r2 = await inverseSearchForTarget(workload, target, opts);

    expect(r1.loss).toBe(r2.loss);
    expect(r1.basePresetId).toBe(r2.basePresetId);
    expect(r1.power.P_total_core).toBe(r2.power.P_total_core);
  });
});


