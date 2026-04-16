'use client';

import { useState, useMemo, useCallback } from "react";
import { Header } from "@/components/Header";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import type { PowerResult, DIMMPowerResult, Workload } from "@/lib/types";
import { inverseSearchForTarget } from "@/lib/inverseDDR5";
import { useRouter } from "next/navigation";
import { PowerBreakdownChart, TotalPowerDisplay } from "@/components/PowerChart";
import { SpotlightTutorial } from "@/components/SpotlightTutorial";
import { TARGET_POWER_TUTORIAL_STEPS } from "@/config/spotlight-page-steps";
import { ONBOARDING_TARGET_POWER_KEY } from "@/lib/onboarding-storage";
import { workloadPresets } from "@/lib/presets";
import { AlertCircle, CheckCircle2, FileJson } from "lucide-react";

type InverseResult = {
  basePresetId: string;
  basePresetName: string;
  loss: number;
  optimizedMemspec: any;
  power: PowerResult;
  dimmPower: DIMMPowerResult;
};

function matchingWorkloadPresetId(workload: Workload): string {
  const matching = workloadPresets.find((preset) => {
    return (
      Math.abs(preset.workload.RDsch_percent - workload.RDsch_percent) < 0.1 &&
      Math.abs(preset.workload.WRsch_percent - workload.WRsch_percent) < 0.1 &&
      Math.abs(preset.workload.BNK_PRE_percent - workload.BNK_PRE_percent) < 0.1 &&
      Math.abs(preset.workload.tRRDsch_ns - workload.tRRDsch_ns) < 0.1
    );
  });
  return matching?.id ?? "custom";
}

export default function TargetPower() {
  const { inverseWorkload, setInverseWorkload, loadInverseWorkloadFromFile, setMemspec } = useConfig();
  const router = useRouter();
  const [P_total_core, setPTotalCore] = useState<string>("2.0");
  const [P_total_DIMM, setPTotalDIMM] = useState<string>("");
  const [dimmWeight, setDimmWeight] = useState<number>(70);
  const [profile, setProfile] = useState<"balanced" | "core" | "dimm">("balanced");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<InverseResult | null>(null);
  const [inverseWorkloadFile, setInverseWorkloadFile] = useState<File | null>(null);
  const [inverseWorkloadUploadError, setInverseWorkloadUploadError] = useState<string | null>(null);
  const [inverseWorkloadUploadSuccess, setInverseWorkloadUploadSuccess] = useState(false);

  const inverseWorkloadSelectValue = useMemo(
    () => matchingWorkloadPresetId(inverseWorkload),
    [inverseWorkload]
  );

  const handleInverseWorkloadPresetChange = useCallback((id: string) => {
    if (id === "custom") return;
    const preset = workloadPresets.find((p) => p.id === id);
    if (!preset) return;
    setInverseWorkload(preset.workload);
    setInverseWorkloadFile(null);
    setInverseWorkloadUploadSuccess(false);
    setInverseWorkloadUploadError(null);
  }, [setInverseWorkload]);

  const handleInverseWorkloadFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setInverseWorkloadFile(file);
      setInverseWorkloadUploadError(null);
      setInverseWorkloadUploadSuccess(false);
      try {
        await loadInverseWorkloadFromFile(file);
        setInverseWorkloadUploadSuccess(true);
      } catch (err) {
        setInverseWorkloadUploadError(
          err instanceof Error ? err.message : "Failed to load workload file"
        );
      }
    },
    [loadInverseWorkloadFromFile]
  );

  const handleSubmit = async () => {
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
        inverseWorkload,
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
                inverse workload (below), profile, emphasis, and sample budget always yield the same best match.
                Randomness is only used internally with a fixed seed derived from those inputs. This workload is{" "}
                <strong className="font-medium text-foreground">independent</strong> from Configuration.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3 rounded-md border border-border/60 bg-muted/20 p-4" data-tutorial="target-power-workload">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-foreground">Workload for this search</span>
                  <HelpTooltip label="Help: inverse workload" triggerClassName="shrink-0">
                    <p className="text-sm">
                      Activity percentages used only for Target Power. Choose a preset or upload JSON (same format as
                      Configuration upload). Sliders are not available here; edit Configuration’s workload separately if
                      you need a custom mix there.
                    </p>
                  </HelpTooltip>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">Activity preset</label>
                  <Select value={inverseWorkloadSelectValue} onValueChange={handleInverseWorkloadPresetChange}>
                    <SelectTrigger className="h-9 max-w-md" id="inverse-workload-preset">
                      <SelectValue placeholder="Select workload" />
                    </SelectTrigger>
                    <SelectContent>
                      {workloadPresets.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                      <SelectItem value="custom" disabled>
                        Custom (JSON upload)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  {inverseWorkloadSelectValue === "custom" ? (
                    <p className="text-xs text-muted-foreground">
                      Current workload was loaded from a file or does not match a built-in preset.
                    </p>
                  ) : null}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="inverse-workload-file" className="text-xs font-medium text-muted-foreground">
                    Workload JSON file
                  </Label>
                  <p className="text-[11px] text-muted-foreground">
                    Root fields or a <code className="text-[10px]">workload</code> wrapper; required fields match
                    Configuration upload.
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <Input
                      id="inverse-workload-file"
                      type="file"
                      accept=".json,application/json"
                      className="max-w-md flex-1 min-w-[12rem]"
                      onChange={handleInverseWorkloadFileChange}
                    />
                    {inverseWorkloadFile ? (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <FileJson className="h-3 w-3 shrink-0" aria-hidden />
                        {inverseWorkloadFile.name}
                      </span>
                    ) : null}
                  </div>
                  {inverseWorkloadUploadSuccess ? (
                    <Alert className="bg-accent/10 border-accent/30 py-2">
                      <CheckCircle2 className="h-4 w-4 text-accent" />
                      <AlertDescription className="text-sm">Workload loaded for inverse search.</AlertDescription>
                    </Alert>
                  ) : null}
                  {inverseWorkloadUploadError ? (
                    <Alert variant="destructive" className="py-2">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription className="text-sm">{inverseWorkloadUploadError}</AlertDescription>
                    </Alert>
                  ) : null}
                </div>
              </div>

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
                      <strong>Target die (core) power per DRAM device (W).</strong> The inverse search minimizes error
                      against modeled <code>P_total_core</code> for one die under the inverse workload you set above. It is not the
                      full module: interface rails and PMIC / RCD overhead are excluded unless you also constrain DIMM
                      total.
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
                      <strong>Optional target for full-module power (W).</strong> When set, the loss can include error
                      on modeled DIMM total (dies × core path plus VDDQ interface and PMIC / RCD overhead as implemented).
                      Leave empty to optimize core-only. With both targets active, profile and emphasis control how die vs
                      module mismatch is weighted.
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

