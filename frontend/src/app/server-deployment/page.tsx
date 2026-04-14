'use client';

import { useMemo, useState } from "react";
import { Header } from "@/components/Header";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, Zap, MemoryStick, Gauge, Server } from "lucide-react";
import { HelpTooltip } from "@/components/HelpTooltip";
import {
  findServerConfigurations,
  SERVER_DEPLOYMENT_RANK_MAX,
  type ServerRequirements,
  type ServerConfiguration,
  type DimmSearchMode,
} from "@/lib/serverDeployment";
import {
  fleetMemoryPowerKw,
  fleetMemoryCapacityTb,
  rackCountForServers,
  matchingCapPerServerW,
  maxServersUnderTotalBudget,
  fleetRemainingBudgetW,
  serverPeakMemoryBandwidthGbps,
  minServersForBandwidthTarget,
  minServersForCapacityTarget,
  fleetAggregateBandwidthGbps,
} from "@/lib/serverDeploymentMetrics";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { PowerBreakdownChart, TotalPowerDisplay } from "@/components/PowerChart";
import { ServerRackVisualization } from "@/components/ServerRackVisualization";
import { useConfig } from "@/contexts/ConfigContext";
import { useRouter } from "next/navigation";
import { SpotlightTutorial } from "@/components/SpotlightTutorial";
import { SERVER_DEPLOYMENT_TUTORIAL_STEPS } from "@/config/spotlight-page-steps";
import { ONBOARDING_SERVER_DEPLOYMENT_KEY } from "@/lib/onboarding-storage";
import { DescriptionWithTooltip } from "@/components/DescriptionTooltip";
import { cn } from "@/lib/utils";
import { energyEquivalentsFromWatts } from "@/lib/powerEquivalents";

const SERVER_DEPLOYMENT_INTRO =
  "Search memory presets against power, bandwidth, and capacity limits you set. Ranked results favor efficient configs that still meet every constraint. Pick a row to inspect power charts and rack-scale totals before sending the memspec back to Configuration.";

/** Converts a fleet total memory power budget (W) into a per-server cap for matching (same as disabled server-count field in total-budget mode). */
const TOTAL_BUDGET_REFERENCE_SERVERS = 100;

type FleetSizingMode =
  | "per_server"
  | "fleet_total_power"
  | "fleet_total_bandwidth"
  | "fleet_total_capacity";

const FLEET_SIZING_MODES: FleetSizingMode[] = [
  "per_server",
  "fleet_total_power",
  "fleet_total_bandwidth",
  "fleet_total_capacity",
];

function isDerivedFleetServerCount(mode: FleetSizingMode): boolean {
  return mode !== "per_server";
}

export default function ServerDeployment() {
  const { setMemspec, setWorkload } = useConfig();
  const router = useRouter();
  
  const [fleetSizingMode, setFleetSizingMode] = useState<FleetSizingMode>("per_server");
  const [powerBudget, setPowerBudget] = useState<string>("100");
  const [targetFleetBandwidthGbps, setTargetFleetBandwidthGbps] = useState<string>("1000");
  const [targetFleetCapacityTb, setTargetFleetCapacityTb] = useState<string>("100");
  const [minDataRate, setMinDataRate] = useState<string>("4800");
  const [totalCapacity, setTotalCapacity] = useState<string>("128");
  const [workloadType, setWorkloadType] = useState<ServerRequirements['workloadType']>("database_web");
  const [maxDIMMs, setMaxDIMMs] = useState<string>("8");
  const [dimmSearchMode, setDimmSearchMode] = useState<DimmSearchMode>("optimize");
  const [numServers, setNumServers] = useState<string>("100");
  const [configurations, setConfigurations] = useState<ServerConfiguration[]>([]);
  const [totalMatchedCount, setTotalMatchedCount] = useState<number | null>(null);
  const [selectedConfig, setSelectedConfig] = useState<ServerConfiguration | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const effectivePerServerBudgetW = useMemo(() => {
    const v = parseFloat(powerBudget);
    if (!Number.isFinite(v) || v <= 0) return 0;
    return fleetSizingMode === "fleet_total_power"
      ? matchingCapPerServerW(v, TOTAL_BUDGET_REFERENCE_SERVERS)
      : v;
  }, [powerBudget, fleetSizingMode]);

  const selectedPerServerPeakBandwidthGbps = useMemo(() => {
    if (!selectedConfig) return 0;
    return serverPeakMemoryBandwidthGbps(selectedConfig.dataRate, selectedConfig.channelsPerServer);
  }, [selectedConfig]);

  /** Fleet size for stats and visualization: explicit count, or derived from power / bandwidth / capacity target. */
  const fleetServerCountForViz = useMemo(() => {
    if (fleetSizingMode === "per_server") {
      return Math.max(0, parseInt(numServers, 10) || 0);
    }
    if (!selectedConfig) return 0;
    if (fleetSizingMode === "fleet_total_power") {
      const totalW = parseFloat(powerBudget);
      return maxServersUnderTotalBudget(totalW, selectedConfig.powerPerServer, 1_000_000);
    }
    if (fleetSizingMode === "fleet_total_bandwidth") {
      const target = parseFloat(targetFleetBandwidthGbps);
      const per = serverPeakMemoryBandwidthGbps(
        selectedConfig.dataRate,
        selectedConfig.channelsPerServer
      );
      return minServersForBandwidthTarget(target, per, 1_000_000);
    }
    if (fleetSizingMode === "fleet_total_capacity") {
      const targetTb = parseFloat(targetFleetCapacityTb);
      return minServersForCapacityTarget(targetTb, selectedConfig.totalCapacity, 1_000_000);
    }
    return 0;
  }, [
    fleetSizingMode,
    numServers,
    powerBudget,
    selectedConfig,
    targetFleetBandwidthGbps,
    targetFleetCapacityTb,
  ]);

  const fleetPowerForEquivalentsW = useMemo(() => {
    if (!selectedConfig) return 0;

    if (fleetSizingMode === "fleet_total_power") {
      const totalW = parseFloat(powerBudget);
      return Number.isFinite(totalW) && totalW > 0 ? totalW : 0;
    }

    const servers = fleetServerCountForViz;
    if (!Number.isFinite(servers) || servers <= 0) return 0;
    return selectedConfig.powerPerServer * servers;
  }, [selectedConfig, fleetSizingMode, powerBudget, fleetServerCountForViz]);

  const fleetEnergyEquivalents = useMemo(() => {
    if (!Number.isFinite(fleetPowerForEquivalentsW) || fleetPowerForEquivalentsW <= 0) return null;
    return energyEquivalentsFromWatts(fleetPowerForEquivalentsW);
  }, [fleetPowerForEquivalentsW]);

  const fleetBudgetUsedW = useMemo(() => {
    if (!selectedConfig) return 0;
    if (fleetSizingMode !== "fleet_total_power") return 0;
    const totalW = parseFloat(powerBudget);
    if (!Number.isFinite(totalW) || totalW <= 0) return 0;
    return fleetServerCountForViz * selectedConfig.powerPerServer;
  }, [selectedConfig, fleetSizingMode, powerBudget, fleetServerCountForViz]);

  const fleetBudgetRemainingW = useMemo(() => {
    if (!selectedConfig) return 0;
    if (fleetSizingMode !== "fleet_total_power") return 0;
    const totalW = parseFloat(powerBudget);
    return fleetRemainingBudgetW(totalW, fleetServerCountForViz, selectedConfig.powerPerServer);
  }, [selectedConfig, fleetSizingMode, powerBudget, fleetServerCountForViz]);

  const fleetAggregatePeakBandwidthGbps = useMemo(
    () => fleetAggregateBandwidthGbps(fleetServerCountForViz, selectedPerServerPeakBandwidthGbps),
    [fleetServerCountForViz, selectedPerServerPeakBandwidthGbps]
  );

  const handleSearch = async () => {
    setError(null);
    setSelectedConfig(null);
    setTotalMatchedCount(null);

    const powerBudgetNum = parseFloat(powerBudget);
    const minDataRateNum = parseFloat(minDataRate);
    const totalCapacityNum = parseFloat(totalCapacity);
    const maxDIMMsNum = parseInt(maxDIMMs);

    if (!Number.isFinite(powerBudgetNum) || powerBudgetNum <= 0) {
      setError(
        fleetSizingMode === "fleet_total_power"
          ? "Total memory power budget must be a positive number"
          : "Memory power budget per server must be a positive number"
      );
      return;
    }

    if (fleetSizingMode === "fleet_total_bandwidth") {
      const bw = parseFloat(targetFleetBandwidthGbps);
      if (!Number.isFinite(bw) || bw <= 0) {
        setError("Target fleet peak bandwidth must be a positive number (GB/s)");
        return;
      }
    }

    if (fleetSizingMode === "fleet_total_capacity") {
      const tb = parseFloat(targetFleetCapacityTb);
      if (!Number.isFinite(tb) || tb <= 0) {
        setError("Target fleet memory capacity must be a positive number (TB)");
        return;
      }
    }

    if (!Number.isFinite(minDataRateNum) || minDataRateNum <= 0) {
      setError("Minimum data rate must be a positive number");
      return;
    }

    if (!Number.isFinite(totalCapacityNum) || totalCapacityNum <= 0) {
      setError("Total capacity must be a positive number");
      return;
    }

    if (!Number.isFinite(maxDIMMsNum) || maxDIMMsNum < 1 || maxDIMMsNum > 16) {
      setError("Max DIMMs must be between 1 and 16");
      return;
    }

    if (fleetSizingMode === "per_server") {
      const numServersNum = parseFloat(numServers);
      if (!Number.isFinite(numServersNum) || numServersNum < 1 || numServersNum > 1000000) {
        setError("Number of servers must be between 1 and 1,000,000");
        return;
      }
    }

    setLoading(true);

    try {
      const powerBudgetPerServer =
        fleetSizingMode === "fleet_total_power"
          ? powerBudgetNum / TOTAL_BUDGET_REFERENCE_SERVERS
          : powerBudgetNum;

      const requirements: ServerRequirements = {
        powerBudgetPerServer,
        minDataRate: minDataRateNum,
        totalCapacity: totalCapacityNum,
        workloadType,
        dimmsPerServer: maxDIMMsNum,
        dimmSearchMode,
      };

      const { rankedConfigurations, totalMatched } = await findServerConfigurations(requirements);

      if (rankedConfigurations.length === 0) {
        setError("No configurations found that meet all requirements. Try relaxing constraints.");
      } else {
        setConfigurations(rankedConfigurations);
        setTotalMatchedCount(totalMatched);
        setSelectedConfig(rankedConfigurations[0]);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to find configurations");
    } finally {
      setLoading(false);
    }
  };

  const handleUseConfiguration = () => {
    if (!selectedConfig) return;
    
    setMemspec(selectedConfig.preset.memspec);
    setWorkload(selectedConfig.workload);
    router.push("/configuration");
  };

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      <Header />
      <SpotlightTutorial storageKey={ONBOARDING_SERVER_DEPLOYMENT_KEY} steps={SERVER_DEPLOYMENT_TUTORIAL_STEPS} />
      <main className="flex-1 container mx-auto px-4 py-6 overflow-y-auto scrollbar-thin">
        <div className="max-w-6xl mx-auto space-y-6">
          {/* Header */}
          <div className="text-center mb-6" data-tutorial="server-deployment-intro">
            <h1 className="text-3xl font-bold mb-2 flex items-center justify-center gap-2">
              <Server className="w-8 h-8 text-primary" />
              Server Deployment Designer
            </h1>
            <DescriptionWithTooltip variant="plain" label="About server deployment" text={SERVER_DEPLOYMENT_INTRO} />
          </div>

          {/* Requirements Input Card */}
          <Card className="power-card" data-tutorial="server-requirements-card">
            <CardHeader>
              <CardTitle>Server Requirements</CardTitle>
              <DescriptionWithTooltip
                variant="card"
                label="Requirements card"
                text="Choose how fleet size is set (per-server count, total memory power, target aggregate bandwidth, or target aggregate capacity), plus per-server power for matching, data rate, capacity, DIMM slots, and workload. The designer scores presets that satisfy all constraints."
              />
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4" data-tutorial="server-req-hardware">
                <div className="space-y-2 md:col-span-2">
                  <div className="flex items-center gap-2">
                    <Label>Fleet sizing</Label>
                    <HelpTooltip label="Help: fleet sizing">
                      <p className="text-sm">
                        <strong>Per server:</strong> you set server count; memory power is a per-node cap for search and
                        fleet stats.
                        <br />
                        <br />
                        <strong>Total fleet power (W):</strong> combined memory power budget; search uses total ÷{" "}
                        {TOTAL_BUDGET_REFERENCE_SERVERS} as the per-server matching cap; server count is how many identical
                        nodes fit under the total at the selected config.
                        <br />
                        <br />
                        <strong>Target fleet bandwidth (GB/s):</strong> theoretical peak aggregate memory bandwidth you
                        need fleet-wide; the power field is the per-server cap for search; server count is the minimum
                        homogeneous fleet that meets the bandwidth target.
                        <br />
                        <br />
                        <strong>Target fleet capacity (TB):</strong> installed memory you need fleet-wide; per-server
                        power caps search; server count is the minimum homogeneous fleet that meets the capacity target.
                      </p>
                    </HelpTooltip>
                  </div>
                  <ToggleGroup
                    type="single"
                    value={fleetSizingMode}
                    onValueChange={(v) => {
                      if (FLEET_SIZING_MODES.includes(v as FleetSizingMode)) {
                        setFleetSizingMode(v as FleetSizingMode);
                      }
                    }}
                    variant="outline"
                    className="flex flex-wrap justify-start gap-1"
                  >
                    <ToggleGroupItem value="per_server" className="text-xs sm:text-sm px-2 sm:px-3">
                      Per server
                    </ToggleGroupItem>
                    <ToggleGroupItem value="fleet_total_power" className="text-xs sm:text-sm px-2 sm:px-3">
                      Fleet power (W)
                    </ToggleGroupItem>
                    <ToggleGroupItem value="fleet_total_bandwidth" className="text-xs sm:text-sm px-2 sm:px-3">
                      Fleet BW (GB/s)
                    </ToggleGroupItem>
                    <ToggleGroupItem value="fleet_total_capacity" className="text-xs sm:text-sm px-2 sm:px-3">
                      Fleet cap (TB)
                    </ToggleGroupItem>
                  </ToggleGroup>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="power-budget">
                      {fleetSizingMode === "fleet_total_power"
                        ? "Total memory power budget (W)"
                        : "Memory power budget per server (W)"}
                    </Label>
                    <HelpTooltip
                      label={
                        fleetSizingMode === "fleet_total_power"
                          ? "Help: total memory power budget"
                          : "Help: memory power budget per server"
                      }
                    >
                      <p className="text-sm">
                        {fleetSizingMode === "fleet_total_power" ? (
                          <>
                            <strong>Combined memory power envelope</strong> for every server together (watts). The
                            designer converts this to a per-server matching cap using ÷{" "}
                            {TOTAL_BUDGET_REFERENCE_SERVERS} servers, then ranks DIMM configs that stay under that limit.
                          </>
                        ) : (
                          <>
                            <strong>Per-server memory power ceiling (W)</strong> used to filter presets during search.
                            In bandwidth or capacity fleet modes, fleet size comes from your target; this cap still bounds
                            which DIMM mixes are allowed per node.
                          </>
                        )}
                      </p>
                    </HelpTooltip>
                  </div>
                  <Input
                    id="power-budget"
                    type="number"
                    step="0.1"
                    value={powerBudget}
                    onChange={(e) => setPowerBudget(e.target.value)}
                    placeholder={fleetSizingMode === "fleet_total_power" ? "10000" : "100"}
                  />
                  {fleetSizingMode === "fleet_total_power" ? (
                    <p className="text-xs text-muted-foreground">
                      Matching uses {TOTAL_BUDGET_REFERENCE_SERVERS} servers as reference:{" "}
                      <span className="font-mono">
                        {effectivePerServerBudgetW > 0 ? `${effectivePerServerBudgetW.toFixed(3)} W` : "—"}
                      </span>{" "}
                      per server cap (adjust total budget to tighten or loosen).
                    </p>
                  ) : null}
                </div>

                {fleetSizingMode === "fleet_total_bandwidth" ? (
                  <div className="space-y-2 md:col-span-2">
                    <div className="flex items-center gap-2">
                      <Label htmlFor="target-fleet-bw">Target fleet peak bandwidth (GB/s)</Label>
                      <HelpTooltip label="Help: target fleet bandwidth">
                        <p className="text-sm">
                          <strong>Theoretical peak</strong> aggregate memory bandwidth for the whole fleet (sum of per-node
                          peaks: data rate × 8 bytes × channel count ÷ 1000 per server). After you pick a configuration,
                          server count is{" "}
                          <code className="text-xs">ceil(target ÷ peak GB/s per server)</code>, capped at 1,000,000. Not
                          sustained workload throughput.
                        </p>
                      </HelpTooltip>
                    </div>
                    <Input
                      id="target-fleet-bw"
                      type="number"
                      step="0.1"
                      min="0"
                      value={targetFleetBandwidthGbps}
                      onChange={(e) => setTargetFleetBandwidthGbps(e.target.value)}
                      placeholder="1000"
                    />
                  </div>
                ) : null}

                {fleetSizingMode === "fleet_total_capacity" ? (
                  <div className="space-y-2 md:col-span-2">
                    <div className="flex items-center gap-2">
                      <Label htmlFor="target-fleet-cap">Target fleet memory capacity (TB)</Label>
                      <HelpTooltip label="Help: target fleet capacity">
                        <p className="text-sm">
                          Minimum <strong>installed DRAM</strong> you want fleet-wide (binary TB, same as stats: GB ×
                          servers ÷ 1024). Server count is{" "}
                          <code className="text-xs">ceil(target TB ÷ TB per server)</code>, capped at 1,000,000.
                        </p>
                      </HelpTooltip>
                    </div>
                    <Input
                      id="target-fleet-cap"
                      type="number"
                      step="0.1"
                      min="0"
                      value={targetFleetCapacityTb}
                      onChange={(e) => setTargetFleetCapacityTb(e.target.value)}
                      placeholder="100"
                    />
                  </div>
                ) : null}

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="min-data-rate">
                      Minimum Data Rate (MT/s)
                    </Label>
                    <HelpTooltip label="Help: minimum data rate">
                      <p className="text-sm">
                        <strong>Minimum effective data rate (MT/s).</strong> Presets whose timing-derived data rate
                        falls below this threshold are rejected. Align with the speed grade you are willing to deploy;
                        the tool does not assume overclocking beyond what each memspec supports.
                      </p>
                    </HelpTooltip>
                  </div>
                  <Input
                    id="min-data-rate"
                    type="number"
                    step="100"
                    value={minDataRate}
                    onChange={(e) => setMinDataRate(e.target.value)}
                    placeholder="4800"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="total-capacity">
                      Total Memory Capacity (GB)
                    </Label>
                    <HelpTooltip label="Help: total memory capacity">
                      <p className="text-sm">
                        <strong>Minimum aggregate DRAM capacity per server (GB).</strong> Installed capacity is DIMM
                        density × populated slot count; configurations that clear this bar are kept. Use the minimum you
                        need for working set / VM footprint, not raw DIMM sticker size alone.
                      </p>
                    </HelpTooltip>
                  </div>
                  <Input
                    id="total-capacity"
                    type="number"
                    step="8"
                    value={totalCapacity}
                    onChange={(e) => setTotalCapacity(e.target.value)}
                    placeholder="128"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="max-dimms">
                      Maximum DIMM Slots per Server
                    </Label>
                    <HelpTooltip label="Help: maximum DIMM slots">
                      <p className="text-sm">
                        <strong>Maximum populated DIMM slots per server.</strong> Bounds the search: Optimize sweeps
                        1…max; All slots filled evaluates only the fully populated case. Should match your board /
                        CPU memory architecture (channel layout still uses a simple packing heuristic in the summary).
                      </p>
                    </HelpTooltip>
                  </div>
                  <Input
                    id="max-dimms"
                    type="number"
                    step="1"
                    min="1"
                    max="16"
                    value={maxDIMMs}
                    onChange={(e) => setMaxDIMMs(e.target.value)}
                    placeholder="8"
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <div className="flex items-center gap-2">
                    <Label>DIMM search mode</Label>
                    <HelpTooltip label="Help: DIMM search mode">
                      <p className="text-sm">
                        <strong>Optimize</strong> tries every DIMM count from 1 up to your maximum slots and keeps
                        configs that meet your targets—fewer DIMMs can rank higher when they still satisfy capacity
                        because memory power is lower.
                        <br />
                        <br />
                        <strong>All slots filled</strong> only evaluates fully populated servers (DIMMs = max slots) so
                        you compare presets on equal footing for &quot;fleet at full memory fill&quot; planning.
                      </p>
                    </HelpTooltip>
                  </div>
                  <ToggleGroup
                    type="single"
                    value={dimmSearchMode}
                    onValueChange={(v) => {
                      if (v === "optimize" || v === "max_slots") setDimmSearchMode(v);
                    }}
                    variant="outline"
                    className="flex flex-wrap justify-start gap-1"
                  >
                    <ToggleGroupItem value="optimize" className="text-xs sm:text-sm px-3">
                      Optimize (1–max slots)
                    </ToggleGroupItem>
                    <ToggleGroupItem value="max_slots" className="text-xs sm:text-sm px-3">
                      All slots filled
                    </ToggleGroupItem>
                  </ToggleGroup>
                </div>
              </div>

              <div
                className="rounded-md border border-border/80 bg-muted/30 p-3 space-y-2 text-xs text-muted-foreground"
                data-tutorial="server-deployment-transparency"
              >
                <p>
                  <span className="font-medium text-foreground">Power math: </span>
                  power per server = (module watts per DIMM) × (DIMMs per server).{" "}
                  <strong>Per-server</strong> fleet sizing uses your server count and per-node power cap.{" "}
                  <strong>Total fleet power</strong> uses total ÷ {TOTAL_BUDGET_REFERENCE_SERVERS} for matching and{" "}
                  <code className="text-xs">floor(total W ÷ W per server)</code> for count.{" "}
                  <strong>Bandwidth / capacity</strong> targets set count from your goal; per-server W still filters which
                  configs match the search.
                </p>
                <p>
                  <span className="font-medium text-foreground">Ranking: </span>
                  results are sorted by a score that favors more headroom under your power budget and higher data rate
                  versus the minimum you set. In Optimize mode, a smaller DIMM count can appear above a larger one if it
                  still meets capacity and scores better on power and rate.
                </p>
                <p>
                  <span className="font-medium text-foreground">Rack view: </span>
                  each cube is one server at the same memory power as the selected row; total fleet memory power ≈ server
                  count × power per server (see deployment statistics).
                </p>
              </div>

              <div className="space-y-4" data-tutorial="server-req-fleet">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div
                  className={cn(
                    "space-y-2 transition-opacity",
                    isDerivedFleetServerCount(fleetSizingMode) && "opacity-60"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <Label htmlFor="num-servers">
                      Number of Servers
                      {fleetSizingMode === "fleet_total_power" ? (
                        <span className="text-muted-foreground font-normal"> (from power budget)</span>
                      ) : fleetSizingMode === "fleet_total_bandwidth" ? (
                        <span className="text-muted-foreground font-normal"> (from bandwidth target)</span>
                      ) : fleetSizingMode === "fleet_total_capacity" ? (
                        <span className="text-muted-foreground font-normal"> (from capacity target)</span>
                      ) : null}
                    </Label>
                    <HelpTooltip label="Help: number of servers">
                      <p className="text-sm">
                        {fleetSizingMode === "fleet_total_power" ? (
                          <>
                            <strong>Estimated from total memory power budget</strong> after you select a configuration:{" "}
                            <code>floor(total W ÷ memory W per server)</code>, capped at 1,000,000.
                          </>
                        ) : fleetSizingMode === "fleet_total_bandwidth" ? (
                          <>
                            <strong>Estimated from target fleet peak bandwidth:</strong>{" "}
                            <code>ceil(target GB/s ÷ peak GB/s per server)</code>, capped at 1,000,000.
                          </>
                        ) : fleetSizingMode === "fleet_total_capacity" ? (
                          <>
                            <strong>Estimated from target fleet memory (TB):</strong>{" "}
                            <code>ceil(target TB ÷ TB per server)</code>, capped at 1,000,000.
                          </>
                        ) : (
                          <>
                            <strong>Fleet size (nodes).</strong> Drives aggregate fleet memory power (kW), installed
                            memory (TB), rack count (42-server racks), and the 3D rack view (1–1,000,000).
                          </>
                        )}
                        {isDerivedFleetServerCount(fleetSizingMode) ? (
                          <>
                            {" "}
                            Switch to <strong>Per server</strong> fleet sizing to enter a server count directly.
                          </>
                        ) : null}
                      </p>
                    </HelpTooltip>
                  </div>
                  <Input
                    id="num-servers"
                    type="number"
                    step="1"
                    min="1"
                    max="1000000"
                    disabled={isDerivedFleetServerCount(fleetSizingMode)}
                    readOnly={isDerivedFleetServerCount(fleetSizingMode)}
                    value={
                      isDerivedFleetServerCount(fleetSizingMode)
                        ? selectedConfig
                          ? String(fleetServerCountForViz)
                          : ""
                        : numServers
                    }
                    onChange={(e) => {
                      if (fleetSizingMode === "per_server") setNumServers(e.target.value);
                    }}
                    placeholder={
                      isDerivedFleetServerCount(fleetSizingMode)
                        ? "Select a configuration"
                        : "100"
                    }
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="workload-type">Workload Type</Label>
                    <HelpTooltip label="Help: workload type">
                      <p className="text-sm">
                        <strong>Workload / command-mix preset.</strong> Sets the activity percentages (bank states,
                        reads, writes, refresh contribution, etc.) in the workload JSON passed into the power model.
                        Choose the profile closest to your traffic; tune the full workload on Configuration if you need
                        a custom mix.
                      </p>
                    </HelpTooltip>
                  </div>
                  <Select
                    value={workloadType}
                    onValueChange={(val) => setWorkloadType(val as ServerRequirements['workloadType'])}
                  >
                    <SelectTrigger id="workload-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="database_web">Database/Web (Mixed)</SelectItem>
                      <SelectItem value="balanced">Balanced activity (read/write mix)</SelectItem>
                      <SelectItem value="read_heavy">Read Heavy</SelectItem>
                      <SelectItem value="write_heavy">Write Heavy</SelectItem>
                      <SelectItem value="idle">Idle</SelectItem>
                      <SelectItem value="stress">Stress Test</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                </div>
              </div>

              <Button
                data-tutorial="server-deployment-search"
                onClick={handleSearch}
                disabled={loading}
                className="w-full"
              >
                {loading ? "Searching..." : "Find Configurations"}
              </Button>

              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          {/* Results */}
          {configurations.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Configuration List */}
              <div className="lg:col-span-1 space-y-4">
                <Card className="power-card">
                  <CardHeader>
                    <CardTitle className="text-lg">
                      Top picks ({configurations.length}
                      {totalMatchedCount != null && totalMatchedCount > configurations.length
                        ? ` of ${totalMatchedCount}`
                        : ""}
                      )
                    </CardTitle>
                    {totalMatchedCount != null && totalMatchedCount > configurations.length ? (
                      <p className="text-sm font-normal text-muted-foreground leading-snug pt-1">
                        Showing a short list (up to {SERVER_DEPLOYMENT_RANK_MAX}) of the strongest options with varied
                        presets and DIMM counts so the choices stay comparable. Relax or tighten filters if you need a
                        different mix.
                      </p>
                    ) : null}
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {configurations.map((config, idx) => (
                      <Card
                        key={`${config.preset.id}-${config.dimmsPerServer}`}
                        className={`cursor-pointer transition-all ${
                          selectedConfig === config
                            ? "ring-2 ring-primary"
                            : "hover:bg-muted/50"
                        }`}
                        onClick={() => setSelectedConfig(config)}
                      >
                        <CardContent className="p-4 space-y-2">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <p className="font-medium text-sm">
                                {config.dimmsPerServer}x {config.preset.name}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {config.totalCapacity}GB | {config.dataRate} MT/s
                              </p>
                            </div>
                            <Badge
                              variant={
                                config.meetsRequirements.power &&
                                config.meetsRequirements.performance &&
                                config.meetsRequirements.capacity
                                  ? "default"
                                  : "destructive"
                              }
                            >
                              #{idx + 1}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2 text-xs">
                            <Zap className="w-3 h-3 text-power-vdd" />
                            <span>{config.powerPerServer.toFixed(2)}W</span>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </CardContent>
                </Card>
              </div>

              {/* Selected Configuration Details */}
              {selectedConfig && (
                <div className="lg:col-span-2 space-y-4">
                  <Card className="power-card">
                    <CardHeader>
                      <CardTitle>Configuration Details</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* Summary */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="space-y-1">
                          <p className="text-xs text-muted-foreground">Memory Module</p>
                          <p className="font-medium">{selectedConfig.preset.name}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-xs text-muted-foreground">DIMMs per Server</p>
                          <p className="font-medium">{selectedConfig.dimmsPerServer}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-xs text-muted-foreground">Total Capacity</p>
                          <p className="font-medium">{selectedConfig.totalCapacity} GB</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-xs text-muted-foreground">Data Rate</p>
                          <p className="font-medium">{selectedConfig.dataRate} MT/s</p>
                        </div>
                      </div>

                      {/* Power Breakdown */}
                      <div className="space-y-2">
                        {fleetSizingMode === "fleet_total_power" ? (
                          <p className="text-xs text-muted-foreground leading-relaxed">
                            Total memory budget:{" "}
                            <span className="font-mono text-foreground">
                              {(parseFloat(powerBudget) || 0).toFixed(1)} W
                            </span>
                            . Matching cap:{" "}
                            <span className="font-mono text-foreground">
                              {effectivePerServerBudgetW.toFixed(3)} W
                            </span>{" "}
                            per server (total ÷ {TOTAL_BUDGET_REFERENCE_SERVERS}).
                          </p>
                        ) : null}
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          Selected configuration:{" "}
                          <span className="font-mono text-foreground">
                            {selectedConfig.powerPerDIMM.toFixed(3)} W/DIMM × {selectedConfig.dimmsPerServer} DIMMs ={" "}
                            {selectedConfig.powerPerServer.toFixed(3)} W
                          </span>{" "}
                          per server.
                        </p>
                        {fleetSizingMode === "fleet_total_power" ? (
                          <p className="text-xs text-muted-foreground leading-relaxed">
                            Fleet budget remaining after placing{" "}
                            <span className="font-mono text-foreground">{fleetServerCountForViz.toLocaleString()}</span>{" "}
                            servers:{" "}
                            <span className="font-mono text-foreground">
                              {(parseFloat(powerBudget) || 0).toFixed(1)} W −{" "}
                              {fleetBudgetUsedW.toFixed(1)} W = {fleetBudgetRemainingW.toFixed(1)} W
                            </span>
                            .
                          </p>
                        ) : fleetSizingMode === "fleet_total_bandwidth" ? (
                          <p className="text-xs text-muted-foreground leading-relaxed">
                            Target fleet peak bandwidth:{" "}
                            <span className="font-mono text-foreground">
                              {(parseFloat(targetFleetBandwidthGbps) || 0).toFixed(1)} GB/s
                            </span>
                            . At this server count, fleet aggregate peak ≈{" "}
                            <span className="font-mono text-foreground">
                              {fleetAggregatePeakBandwidthGbps.toFixed(1)} GB/s
                            </span>{" "}
                            (theoretical).
                          </p>
                        ) : fleetSizingMode === "fleet_total_capacity" ? (
                          <p className="text-xs text-muted-foreground leading-relaxed">
                            Target fleet memory:{" "}
                            <span className="font-mono text-foreground">
                              {(parseFloat(targetFleetCapacityTb) || 0).toFixed(1)} TB
                            </span>
                            . Installed at this count ≈{" "}
                            <span className="font-mono text-foreground">
                              {fleetMemoryCapacityTb(
                                fleetServerCountForViz,
                                selectedConfig.totalCapacity
                              ).toFixed(1)}{" "}
                              TB
                            </span>
                            .
                          </p>
                        ) : (
                          <p className="text-xs text-muted-foreground leading-relaxed">
                            Per-server budget headroom:{" "}
                            <span className="font-mono text-foreground">
                              {effectivePerServerBudgetW.toFixed(3)} W − {selectedConfig.powerPerServer.toFixed(3)} W ={" "}
                              {(effectivePerServerBudgetW - selectedConfig.powerPerServer).toFixed(3)} W
                            </span>
                            .
                          </p>
                        )}
                        <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                          <div className="flex items-center gap-2">
                            <Zap className="w-4 h-4 text-power-vdd" />
                            <span className="text-sm font-medium">Power per DIMM</span>
                          </div>
                          <span className="font-bold">{selectedConfig.powerPerDIMM.toFixed(3)} W</span>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                          <div className="flex items-center gap-2">
                            <Server className="w-4 h-4 text-primary" />
                            <span className="text-sm font-medium">Power per Server</span>
                          </div>
                          <span className="font-bold">{selectedConfig.powerPerServer.toFixed(3)} W</span>
                        </div>
                        {fleetEnergyEquivalents ? (
                          <div className="p-3 bg-muted/50 rounded-lg space-y-2">
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium">Fleet energy equivalents</span>
                                <HelpTooltip
                                  title="Assumptions"
                                  description={
                                    "Energy = continuous power × time. EV: 0.30 kWh/mi, full charge = 60 kWh. Food: converts to dietary energy using 2,000 kcal/person/day (not the electricity required to grow food)."
                                  }
                                />
                              </div>
                              <span className="text-xs text-muted-foreground font-mono tabular-nums">
                                {fleetEnergyEquivalents.kwhPerDay.toFixed(1)} kWh/day ·{" "}
                                {fleetEnergyEquivalents.kwhPerYear.toFixed(0)} kWh/yr
                              </span>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                              <div className="rounded bg-background/60 p-2">
                                <p className="text-muted-foreground">EV driving</p>
                                <p className="font-medium tabular-nums">
                                  {fleetEnergyEquivalents.evMilesPerDay.toFixed(0)} mi/day
                                </p>
                                <p className="text-muted-foreground tabular-nums">
                                  {fleetEnergyEquivalents.evMilesPerYear.toFixed(0)} mi/yr
                                </p>
                              </div>
                              <div className="rounded bg-background/60 p-2">
                                <p className="text-muted-foreground">EV “full charges”</p>
                                <p className="font-medium tabular-nums">
                                  {fleetEnergyEquivalents.evFullChargesPerDay.toFixed(2)} /day
                                </p>
                                <p className="text-muted-foreground tabular-nums">
                                  {fleetEnergyEquivalents.evFullChargesPerYear.toFixed(1)} /yr
                                </p>
                              </div>
                              <div className="rounded bg-background/60 p-2">
                                <p className="text-muted-foreground">Calories equivalent</p>
                                <p className="font-medium tabular-nums">
                                  {fleetEnergyEquivalents.peopleDailyCaloriesPerDay.toFixed(0)} people/day
                                </p>
                                <p className="text-muted-foreground tabular-nums">
                                  {fleetEnergyEquivalents.peopleDailyCaloriesPerYear.toFixed(0)} people-days/yr
                                </p>
                              </div>
                            </div>
                          </div>
                        ) : null}
                        {fleetSizingMode === "fleet_total_power" ? (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                              <div className="flex items-center gap-2">
                                <Gauge className="w-4 h-4 text-muted-foreground" />
                                <span className="text-sm font-medium">Fleet budget used</span>
                              </div>
                              <span className="font-bold">{fleetBudgetUsedW.toFixed(1)} W</span>
                            </div>
                            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                              <div className="flex items-center gap-2">
                                <MemoryStick className="w-4 h-4 text-accent" />
                                <span className="text-sm font-medium">Fleet budget remaining</span>
                              </div>
                              <span className="font-bold tabular-nums">{fleetBudgetRemainingW.toFixed(1)} W</span>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                              <div className="flex items-center gap-2">
                                <Gauge className="w-4 h-4 text-muted-foreground" />
                                <span className="text-sm font-medium">Power budget / server</span>
                              </div>
                              <span className="font-bold">{effectivePerServerBudgetW.toFixed(3)} W</span>
                            </div>
                            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                              <div className="flex items-center gap-2">
                                <MemoryStick className="w-4 h-4 text-accent" />
                                <span className="text-sm font-medium">Remaining (per server)</span>
                              </div>
                              <span
                                className={`font-bold ${
                                  effectivePerServerBudgetW - selectedConfig.powerPerServer >= 0
                                    ? "text-green-600"
                                    : "text-red-600"
                                }`}
                              >
                                {(effectivePerServerBudgetW - selectedConfig.powerPerServer).toFixed(3)} W
                              </span>
                            </div>
                          </>
                        )}
                      </div>

                      {/* Requirements Check */}
                      <div className="space-y-2">
                        <p className="text-sm font-medium">Requirements Check</p>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                          <div className="flex items-center gap-2 p-2 bg-muted/30 rounded">
                            {selectedConfig.meetsRequirements.power ? (
                              <CheckCircle2 className="w-4 h-4 text-green-600" />
                            ) : (
                              <XCircle className="w-4 h-4 text-red-600" />
                            )}
                            <span className="text-xs">Power Budget</span>
                          </div>
                          <div className="flex items-center gap-2 p-2 bg-muted/30 rounded">
                            {selectedConfig.meetsRequirements.performance ? (
                              <CheckCircle2 className="w-4 h-4 text-green-600" />
                            ) : (
                              <XCircle className="w-4 h-4 text-red-600" />
                            )}
                            <span className="text-xs">Performance</span>
                          </div>
                          <div className="flex items-center gap-2 p-2 bg-muted/30 rounded">
                            {selectedConfig.meetsRequirements.capacity ? (
                              <CheckCircle2 className="w-4 h-4 text-green-600" />
                            ) : (
                              <XCircle className="w-4 h-4 text-red-600" />
                            )}
                            <span className="text-xs">Capacity</span>
                          </div>
                        </div>
                      </div>

                      {/* Server Architecture */}
                      <div className="space-y-2">
                        <p className="text-sm font-medium">Server Architecture</p>
                        <div className="grid grid-cols-2 gap-4 p-3 bg-muted/30 rounded">
                          <div>
                            <p className="text-xs text-muted-foreground">Channels per Server</p>
                            <p className="font-medium">{selectedConfig.channelsPerServer}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">DIMMs per Channel</p>
                            <p className="font-medium">{selectedConfig.dimmsPerChannel}</p>
                          </div>
                        </div>
                      </div>

                      <Button onClick={handleUseConfiguration} className="w-full">
                        Use This Configuration
                      </Button>
                    </CardContent>
                  </Card>

                  {/* 3D Server Farm Visualization */}
                  <p className="text-xs text-muted-foreground px-1">
                    Visualization: each block is one server at{" "}
                    <span className="font-mono text-foreground">{selectedConfig.powerPerServer.toFixed(3)} W</span>{" "}
                    memory.
                    {fleetSizingMode === "fleet_total_power" ? (
                      <>
                        {" "}
                        Count = max servers that fit under your{" "}
                        <span className="font-mono text-foreground">{(parseFloat(powerBudget) || 0).toFixed(1)} W</span>{" "}
                        total memory budget.
                      </>
                    ) : fleetSizingMode === "fleet_total_bandwidth" ? (
                      <>
                        {" "}
                        Count = minimum servers to reach{" "}
                        <span className="font-mono text-foreground">
                          {(parseFloat(targetFleetBandwidthGbps) || 0).toFixed(1)} GB/s
                        </span>{" "}
                        aggregate peak bandwidth.
                      </>
                    ) : fleetSizingMode === "fleet_total_capacity" ? (
                      <>
                        {" "}
                        Count = minimum servers to reach{" "}
                        <span className="font-mono text-foreground">
                          {(parseFloat(targetFleetCapacityTb) || 0).toFixed(1)} TB
                        </span>{" "}
                        installed memory.
                      </>
                    ) : (
                      <> Fleet totals use this power times the server count you entered.</>
                    )}
                  </p>
                  <ServerRackVisualization
                    numServers={fleetServerCountForViz}
                    powerPerServer={selectedConfig.powerPerServer}
                    selectedConfig={{
                      dimmsPerServer: selectedConfig.dimmsPerServer,
                      totalCapacity: selectedConfig.totalCapacity,
                      dataRate: selectedConfig.dataRate,
                      preset: selectedConfig.preset,
                    }}
                  />

                  {/* Power Visualization */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <TotalPowerDisplay powerResult={selectedConfig.powerResult} />
                    <PowerBreakdownChart powerResult={selectedConfig.powerResult} />
                  </div>
                  
                  {/* Large Scale Stats */}
                  <Card className="power-card">
                    <CardHeader>
                      <CardTitle>Large Scale Deployment Statistics</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-4">
                        <div>
                          <p className="text-xs text-muted-foreground">Total Servers</p>
                          <p className="text-2xl font-bold">{fleetServerCountForViz.toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Total Power</p>
                          <p className="text-2xl font-bold">
                            {fleetMemoryPowerKw(fleetServerCountForViz, selectedConfig.powerPerServer).toFixed(1)} kW
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Peak fleet BW</p>
                          <p className="text-2xl font-bold tabular-nums">
                            {fleetAggregatePeakBandwidthGbps.toFixed(1)} GB/s
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">theoretical aggregate</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Total Capacity</p>
                          <p className="text-2xl font-bold">
                            {fleetMemoryCapacityTb(fleetServerCountForViz, selectedConfig.totalCapacity).toFixed(1)} TB
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Number of Racks</p>
                          <p className="text-2xl font-bold">
                            {rackCountForServers(fleetServerCountForViz).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

