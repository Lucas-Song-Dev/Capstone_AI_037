'use client';

import { useState } from "react";
import { Header } from "@/components/Header";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
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
import { CheckCircle2, XCircle, Zap, MemoryStick, Gauge, Server, HelpCircle } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { findServerConfigurations, formatServerSummary, type ServerRequirements, type ServerConfiguration } from "@/lib/serverDeployment";
import { PowerBreakdownChart, TotalPowerDisplay } from "@/components/PowerChart";
import { ServerRackVisualization } from "@/components/ServerRackVisualization";
import { useConfig } from "@/contexts/ConfigContext";
import { useRouter } from "next/navigation";

export default function ServerDeployment() {
  const { setMemspec, setWorkload } = useConfig();
  const router = useRouter();
  
  const [powerBudget, setPowerBudget] = useState<string>("100");
  const [minDataRate, setMinDataRate] = useState<string>("4800");
  const [totalCapacity, setTotalCapacity] = useState<string>("128");
  const [workloadType, setWorkloadType] = useState<ServerRequirements['workloadType']>("database_web");
  const [maxDIMMs, setMaxDIMMs] = useState<string>("8");
  const [numServers, setNumServers] = useState<string>("100");
  const [configurations, setConfigurations] = useState<ServerConfiguration[]>([]);
  const [selectedConfig, setSelectedConfig] = useState<ServerConfiguration | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSearch = () => {
    setError(null);
    setSelectedConfig(null);
    
    const powerBudgetNum = parseFloat(powerBudget);
    const minDataRateNum = parseFloat(minDataRate);
    const totalCapacityNum = parseFloat(totalCapacity);
    const maxDIMMsNum = parseInt(maxDIMMs);
    
    if (!Number.isFinite(powerBudgetNum) || powerBudgetNum <= 0) {
      setError("Power budget must be a positive number");
      return;
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
    
    const numServersNum = parseFloat(numServers);
    if (!Number.isFinite(numServersNum) || numServersNum < 1 || numServersNum > 1000000) {
      setError("Number of servers must be between 1 and 1,000,000");
      return;
    }
    
    setLoading(true);
    
    try {
      const requirements: ServerRequirements = {
        powerBudgetPerServer: powerBudgetNum,
        minDataRate: minDataRateNum,
        totalCapacity: totalCapacityNum,
        workloadType,
        dimmsPerServer: maxDIMMsNum,
      };
      
      const results = findServerConfigurations(requirements);
      
      if (results.length === 0) {
        setError("No configurations found that meet all requirements. Try relaxing constraints.");
      } else {
        setConfigurations(results);
        setSelectedConfig(results[0]); // Select best match
      }
    } catch (e: any) {
      setError(e?.message ?? "Failed to find configurations");
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
      <main className="flex-1 container mx-auto px-4 py-6 overflow-y-auto scrollbar-thin">
        <div className="max-w-6xl mx-auto space-y-6">
          {/* Header */}
          <div className="text-center mb-6">
            <h1 className="text-3xl font-bold mb-2 flex items-center justify-center gap-2">
              <Server className="w-8 h-8 text-primary" />
              Server Deployment Designer
            </h1>
            <p className="text-muted-foreground">
              Find optimal DDR5 memory configurations for your server requirements
            </p>
          </div>

          {/* Requirements Input Card */}
          <Card className="power-card">
            <CardHeader>
              <CardTitle>Server Requirements</CardTitle>
              <CardDescription>
                Enter your server deployment requirements to find matching memory configurations
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="power-budget">
                      Power Budget per Server (W)
                    </Label>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button type="button" className="inline-flex items-center">
                          <HelpCircle className="w-4 h-4 text-muted-foreground hover:text-foreground transition-colors" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs p-3 bg-popover border border-border shadow-lg">
                        <p className="text-sm">
                          <strong>How much electricity can the memory use?</strong><br />
                          Like a light bulb that can only use so much power, your server has a limit. 
                          This is the maximum amount of electricity (in Watts) that all the memory 
                          in one server is allowed to use. Lower numbers mean less power, which saves 
                          money and keeps things cooler!
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <Input
                    id="power-budget"
                    type="number"
                    step="0.1"
                    value={powerBudget}
                    onChange={(e) => setPowerBudget(e.target.value)}
                    placeholder="25"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="min-data-rate">
                      Minimum Data Rate (MT/s)
                    </Label>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="w-4 h-4 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p className="text-sm">
                          <strong>How fast should the memory be?</strong><br />
                          Think of this like the speed limit on a highway. The memory needs to be 
                          at least this fast (measured in millions of transfers per second). 
                          Higher numbers mean faster memory, which helps your server work quicker. 
                          Like a race car vs a regular car!
                        </p>
                      </TooltipContent>
                    </Tooltip>
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
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="w-4 h-4 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p className="text-sm">
                          <strong>How much memory do you need?</strong><br />
                          This is like the size of a backpack - how much stuff (data) can it hold? 
                          More GB (gigabytes) means more space to store information. If you need to 
                          remember lots of things at once, you need a bigger backpack!
                        </p>
                      </TooltipContent>
                    </Tooltip>
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
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="w-4 h-4 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p className="text-sm">
                          <strong>How many memory sticks can fit?</strong><br />
                          A DIMM is like a memory stick (like a USB stick, but for memory). 
                          Your server has slots where you can plug in these sticks. This number 
                          tells us the maximum number of slots available. More slots means you 
                          can add more memory sticks!
                        </p>
                      </TooltipContent>
                    </Tooltip>
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

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="num-servers">
                      Number of Servers
                    </Label>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="w-4 h-4 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p className="text-sm">
                          <strong>How many servers do you need?</strong><br />
                          Enter the total number of servers in your deployment. 
                          Supports large-scale deployments up to 1,000,000 servers. 
                          The visualization will show server racks with cubes representing each server.
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <Input
                    id="num-servers"
                    type="number"
                    step="1"
                    min="1"
                    max="1000000"
                    value={numServers}
                    onChange={(e) => setNumServers(e.target.value)}
                    placeholder="100"
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="workload-type">Workload Type</Label>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="w-4 h-4 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p className="text-sm">
                          <strong>What will your server be doing?</strong><br />
                          This is like asking: will you be reading books, writing stories, or both? 
                          Different jobs use memory differently. Some read a lot (like looking up 
                          information), some write a lot (like saving new data), and some do both 
                          equally. Pick the one that matches what your server will do most!
                        </p>
                      </TooltipContent>
                    </Tooltip>
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
                      <SelectItem value="balanced">Balanced</SelectItem>
                      <SelectItem value="read_heavy">Read Heavy</SelectItem>
                      <SelectItem value="write_heavy">Write Heavy</SelectItem>
                      <SelectItem value="idle">Idle</SelectItem>
                      <SelectItem value="stress">Stress Test</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Button onClick={handleSearch} disabled={loading} className="w-full">
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
                      Found {configurations.length} Configuration{configurations.length !== 1 ? 's' : ''}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {configurations.map((config, idx) => (
                      <Card
                        key={idx}
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
                        <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                          <div className="flex items-center gap-2">
                            <Gauge className="w-4 h-4 text-muted-foreground" />
                            <span className="text-sm font-medium">Power Budget</span>
                          </div>
                          <span className="font-bold">{parseFloat(powerBudget).toFixed(1)} W</span>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                          <div className="flex items-center gap-2">
                            <MemoryStick className="w-4 h-4 text-accent" />
                            <span className="text-sm font-medium">Remaining Budget</span>
                          </div>
                          <span className={`font-bold ${
                            parseFloat(powerBudget) - selectedConfig.powerPerServer >= 0
                              ? "text-green-600"
                              : "text-red-600"
                          }`}>
                            {(parseFloat(powerBudget) - selectedConfig.powerPerServer).toFixed(3)} W
                          </span>
                        </div>
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
                  <ServerRackVisualization
                    numServers={parseInt(numServers) || 0}
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
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                          <p className="text-xs text-muted-foreground">Total Servers</p>
                          <p className="text-2xl font-bold">{(parseInt(numServers) || 0).toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Total Power</p>
                          <p className="text-2xl font-bold">
                            {((parseInt(numServers) || 0) * selectedConfig.powerPerServer / 1000).toFixed(1)} kW
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Total Capacity</p>
                          <p className="text-2xl font-bold">
                            {((parseInt(numServers) || 0) * selectedConfig.totalCapacity / 1024).toFixed(1)} TB
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Number of Racks</p>
                          <p className="text-2xl font-bold">
                            {Math.ceil((parseInt(numServers) || 0) / 42).toLocaleString()}
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

