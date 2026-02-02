'use client';

import { useState } from "react";
import { Header } from "@/components/Header";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { HelpCircle } from "lucide-react";
import { useConfig } from "@/contexts/ConfigContext";
import type { PowerResult, DIMMPowerResult } from "@/lib/types";
import { inverseSearchForTarget } from "@/lib/inverseDDR5";
import { useRouter } from "next/navigation";
import { PowerBreakdownChart, TotalPowerDisplay } from "@/components/PowerChart";

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
      <main className="flex-1 container mx-auto px-4 py-6 overflow-y-auto scrollbar-thin">
        <div className="max-w-3xl mx-auto space-y-6">
          <Card className="power-card">
            <CardHeader>
              <CardTitle>Target Power (Inverse DDR5)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <label className="block text-xs font-medium text-muted-foreground">
                      Optimization Profile
                    </label>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button type="button" className="inline-flex items-center">
                          <HelpCircle className="w-4 h-4 text-muted-foreground hover:text-foreground transition-colors" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs p-3 bg-popover border border-border shadow-lg">
                        <p className="text-sm">
                          <strong>What should we focus on when searching?</strong><br />
                          This tells the tool what's most important to you. "Balanced" means 
                          we care about both the chip power (Core) and the whole memory stick 
                          power (DIMM) equally. "Core-Optimized" means we really want the chip 
                          power to be perfect. "DIMM-Optimized" means we care most about the 
                          total memory stick power. Like choosing what's most important when 
                          picking a car - speed, comfort, or both!
                        </p>
                      </TooltipContent>
                    </Tooltip>
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
                      <SelectItem value="balanced">Balanced (Core + DIMM)</SelectItem>
                      <SelectItem value="core">Core-Optimized</SelectItem>
                      <SelectItem value="dimm">DIMM-Optimized</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <span>Core vs DIMM Emphasis</span>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button type="button" className="inline-flex items-center">
                            <HelpCircle className="w-4 h-4 text-muted-foreground hover:text-foreground transition-colors" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs p-3 bg-popover border border-border shadow-lg">
                          <p className="text-sm">
                            <strong>How much should we care about each part?</strong><br />
                            When you pick "Balanced" profile, this slider lets you fine-tune 
                            the balance. Core is the power used by the memory chip itself. 
                            DIMM is the power used by the whole memory stick (chip + extra parts). 
                            Moving the slider is like adjusting a seesaw - more to one side means 
                            we care more about that part being perfect!
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <span>
                      Core {(100 - dimmWeight).toFixed(0)}% / DIMM{" "}
                      {dimmWeight.toFixed(0)}%
                    </span>
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
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <label className="block text-sm mb-1">
                    Target Total Core Power (W)
                  </label>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button type="button" className="inline-flex items-center">
                        <HelpCircle className="w-4 h-4 text-muted-foreground hover:text-foreground transition-colors" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs p-3 bg-popover border border-border shadow-lg">
                      <p className="text-sm">
                        <strong>What power do you want the memory chip to use?</strong><br />
                        This is the power (in Watts) that you want one memory chip to use. 
                        The tool will search for memory that matches this power as closely 
                        as possible. Think of it like telling a chef "I want a meal that 
                        has exactly 500 calories" - they'll find the best recipe that matches!
                      </p>
                    </TooltipContent>
                  </Tooltip>
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
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button type="button" className="inline-flex items-center">
                        <HelpCircle className="w-4 h-4 text-muted-foreground hover:text-foreground transition-colors" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs p-3 bg-popover border border-border shadow-lg">
                      <p className="text-sm">
                        <strong>What power do you want the whole memory stick to use?</strong><br />
                        This is optional! If you leave it empty, we'll only match the chip power. 
                        But if you fill it in, we'll try to match both the chip power AND the 
                        whole memory stick power. The DIMM power includes the chip plus extra 
                        parts like connectors. It's like saying "I want the engine to use 100W 
                        AND the whole car to use 150W" - more specific!
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <Input
                  type="number"
                  step="0.01"
                  value={P_total_DIMM}
                  onChange={(e) => setPTotalDIMM(e.target.value)}
                  className="max-w-xs"
                />
              </div>

              <Button onClick={handleSubmit} disabled={loading}>
                {loading ? "Solving..." : "Find Matching Spec"}
              </Button>

              {error && (
                <Alert variant="destructive">
                  <AlertDescription className="text-sm">{error}</AlertDescription>
                </Alert>
              )}

              <p className="text-xs text-muted-foreground">
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

