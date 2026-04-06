'use client';

import { useState } from "react";
import { Header } from "@/components/Header";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { HelpTooltip } from "@/components/HelpTooltip";
import { useConfig } from "@/contexts/ConfigContext";
import type { PowerResult, DIMMPowerResult } from "@/lib/types";
import { inverseSearchForTarget } from "@/lib/inverseDDR5";
import { useRouter } from "next/navigation";
import { PowerBreakdownChart, TotalPowerDisplay } from "@/components/PowerChart";
import { SpotlightTutorial } from "@/components/SpotlightTutorial";
import { TARGET_POWER_TUTORIAL_STEPS } from "@/config/spotlight-page-steps";
import { ONBOARDING_TARGET_POWER_KEY } from "@/lib/onboarding-storage";

type InverseResult = {
  basePresetId: string;
  basePresetName: string;
  loss: number;
  optimizedMemspec: any;
  power: PowerResult;
  dimmPower: DIMMPowerResult;
};

export default function TargetPower() {
  const { workload, setMemspec } = useConfig();
  const router = useRouter();
  const [P_total_core, setPTotalCore] = useState<string>("2.0");
  const [P_total_DIMM, setPTotalDIMM] = useState<string>("");
  const [dimmWeight, setDimmWeight] = useState<number>(70);
  const [profile, setProfile] = useState<"balanced" | "core" | "dimm">("balanced");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<InverseResult | null>(null);

  const handleSubmit = async () => {
    if (!workload) {
      setError("Workload is not initialized.");
      return;
    }

    const targetCore = parseFloat(P_total_core);
    if (!Number.isFinite(targetCore) || targetCore <= 0) {
      setError("Please enter a valid positive number for target total core power.");
      return;
    }

    const targetDIMM = P_total_DIMM.trim().length
      ? parseFloat(P_total_DIMM)
      : undefined;
    if (targetDIMM !== undefined && (!Number.isFinite(targetDIMM) || targetDIMM <= 0)) {
      setError("If provided, DIMM power must be a valid positive number.");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const dimmWeightFraction = dimmWeight / 100;
      const coreWeightFraction = 1 - dimmWeightFraction;

      const data = await inverseSearchForTarget(
        workload,
        {
          P_total_core: targetCore,
          P_total_DIMM: targetDIMM,
        },
        {
          weights:
            profile === "core"
              ? { P_total_core: 1.2, P_total_DIMM: 0.3 }
              : profile === "dimm"
              ? { P_total_core: 0.4, P_total_DIMM: 1.2 }
              : { P_total_core: coreWeightFraction, P_total_DIMM: dimmWeightFraction },
        }
      );
      setResult({
        basePresetId: data.basePresetId,
        basePresetName: data.basePresetName,
        loss: data.loss,
        optimizedMemspec: data.optimizedMemspec,
        power: data.power,
        dimmPower: data.dimmPower,
      });
    } catch (e: any) {
      setError(e?.message ?? "Failed to run inverse search");
    } finally {
      setLoading(false);
    }
  };

  const handleUseInCalculator = () => {
    if (!result) return;
    setMemspec(result.optimizedMemspec);
    router.push("/configuration");
  };

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      <Header />
      <SpotlightTutorial storageKey={ONBOARDING_TARGET_POWER_KEY} steps={TARGET_POWER_TUTORIAL_STEPS} />
      <main className="flex-1 container mx-auto px-4 py-6 overflow-y-auto scrollbar-thin">
        <div className="max-w-3xl mx-auto space-y-6">
          <Card className="power-card">
            <CardHeader data-tutorial="target-power-header">
              <CardTitle>Target Power (Inverse DDR5)</CardTitle>
              <CardDescription className="text-sm pt-1">
                The search is <strong className="font-medium text-foreground">deterministic</strong>: same targets,
                workload, profile, emphasis, and sample budget always yield the same best match. Randomness is only
                used internally with a fixed seed derived from those inputs.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div
                className="grid grid-cols-1 md:grid-cols-2 gap-4"
                data-tutorial="target-power-optimization"
              >
                <div className="space-y-2 md:col-span-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-muted-foreground">
                      <strong className="text-foreground/90">Profile &amp; emphasis</strong>
                    </span>
                    <HelpTooltip label="Help: profile & emphasis" triggerClassName="shrink-0">
                      <p className="text-sm">
                        They weight core vs module errors in the loss. If optional DIMM target is empty, only core
                        error is optimized; scaling it by a constant does not change which candidate wins, so the
                        dropdown/slider have little effect until you set a DIMM power target.
                      </p>
                    </HelpTooltip>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <label className="block text-xs font-medium text-muted-foreground">
                      Optimizer profile
                    </label>
                    <HelpTooltip label="Help: optimizer profile">
                      <p className="text-sm">
                        Controls how the search penalizes <strong>die (core)</strong> power versus{" "}
                        <strong>whole-module</strong> power (core plus interface and overhead modeled for the DIMM).
                        This is separate from workload activity presets on Configuration.
                      </p>
                    </HelpTooltip>
                  </div>
                  <Select
                    value={profile}
                    onValueChange={(val) =>
                      setProfile(val as "balanced" | "core" | "dimm")
                    }
                  >
                    <SelectTrigger className="h-9 max-w-xs">
                      <SelectValue placeholder="Select profile" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="balanced">Equal weight: core vs module total</SelectItem>
                      <SelectItem value="core">Prioritize die (core) match</SelectItem>
                      <SelectItem value="dimm">Prioritize module total (DIMM) match</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-medium text-foreground/90">Target emphasis</span>
                      <HelpTooltip label="Help: target emphasis" triggerClassName="shrink-0">
                        <p className="text-sm">
                          Only active for <strong>Equal weight</strong>. Tilts the loss toward matching die power
                          or full module power when both targets are in play.
                        </p>
                      </HelpTooltip>
                    </div>
                    <span className="shrink-0 tabular-nums">
                      Die {(100 - dimmWeight).toFixed(0)}% / Module {dimmWeight.toFixed(0)}%
                    </span>
                  </div>
                  <div className="flex justify-between text-[10px] text-muted-foreground uppercase tracking-wide max-w-xs px-0.5">
                    <span>Die (core)</span>
                    <span>Module total (DIMM)</span>
                  </div>
                  <Slider
                    value={[dimmWeight]}
                    min={0}
                    max={100}
                    step={5}
                    className="max-w-xs"
                    onValueChange={([val]) => setDimmWeight(val)}
                    disabled={profile !== "balanced"}
                  />
                  {profile !== "balanced" ? (
                    <p className="text-xs text-muted-foreground max-w-xs">
                      Emphasis is fixed while a one-sided optimizer profile is selected; choose Equal weight to adjust the split.
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="space-y-4" data-tutorial="target-power-targets">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <label className="block text-sm mb-1">
                    Target Total Core Power (W)
                  </label>
                  <HelpTooltip label="Help: target core power">
                    <p className="text-sm">
                      <strong>What power do you want the memory chip to use?</strong><br />
                      This is the power (in Watts) that you want one memory chip to use. 
                      The tool will search for memory that matches this power as closely 
                      as possible.                         Think of it like telling a chef &quot;I want a meal that 
                      has exactly 500 calories&quot; - they&apos;ll find the best recipe that matches!
                    </p>
                  </HelpTooltip>
                </div>
                <Input
                  type="number"
                  step="0.01"
                  value={P_total_core}
                  onChange={(e) => setPTotalCore(e.target.value)}
                  className="max-w-xs"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <label className="block text-sm mb-1">
                    Target Total DIMM Power (W, optional)
                  </label>
                  <HelpTooltip label="Help: target DIMM power">
                    <p className="text-sm">
                      <strong>What power do you want the whole memory stick to use?</strong><br />
                      This is optional! If you leave it empty, we&apos;ll only match the chip power. 
                      But if you fill it in, we&apos;ll try to match both the chip power AND the 
                      whole memory stick power. The DIMM power includes the chip plus extra 
                      parts like connectors. It&apos;s like saying &quot;I want the engine to use 100W 
                      AND the whole car to use 150W&quot; - more specific!
                    </p>
                  </HelpTooltip>
                </div>
                <Input
                  type="number"
                  step="0.01"
                  value={P_total_DIMM}
                  onChange={(e) => setPTotalDIMM(e.target.value)}
                  className="max-w-xs"
                />
              </div>
              </div>

              <Button data-tutorial="target-power-submit" onClick={handleSubmit} disabled={loading}>
                {loading ? "Solving..." : "Find Matching Spec"}
              </Button>

              {error && (
                <Alert variant="destructive">
                  <AlertDescription className="text-sm">{error}</AlertDescription>
                </Alert>
              )}

              <p className="text-xs text-muted-foreground" data-tutorial="target-power-note">
                This feature finds a DDR5 memspec whose modeled core power best
                matches your target. Results are approximate and may not be
                unique.
              </p>
            </CardContent>
          </Card>

          {result && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="power-card">
                <CardHeader>
                  <CardTitle>Best Match</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <p>Base preset: {result.basePresetName}</p>
                  <p>Fit error (loss): {result.loss.toFixed(4)}</p>
                  <p>
                    Resulting P_total_core:{" "}
                    {result.power.P_total_core.toFixed(4)} W
                  </p>
                  <p>
                    Resulting P_total_DIMM:{" "}
                    {result.dimmPower.P_total_DIMM.toFixed(4)} W
                  </p>

                  <Button
                    size="sm"
                    className="mt-3"
                    onClick={handleUseInCalculator}
                  >
                    Use in Calculator
                  </Button>
                </CardContent>
              </Card>

              <div className="space-y-4">
                <TotalPowerDisplay powerResult={result.power} />
                <PowerBreakdownChart powerResult={result.power} />
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

