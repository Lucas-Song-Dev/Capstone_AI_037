import { describe, it, expect } from "vitest";
import { inverseSearchForTarget } from "./inverseDDR5";
import { memoryPresets, defaultWorkload } from "./presets";
import { computeCorePower, computeDIMMPower } from "./ddr5Calculator";

describe("inverseSearchForTarget", () => {
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
});


