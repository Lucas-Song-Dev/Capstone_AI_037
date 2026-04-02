'use client';

import { useState, useCallback, useEffect } from 'react';
import { Header } from '@/components/Header';
import { ConfigPanel } from '@/components/ConfigPanel';
import { PresetSelector } from '@/components/PresetSelector';
import { VisualBuilderContent } from '@/components/VisualBuilderContent';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FileJson, CheckCircle2, AlertCircle, MemoryStick, Box } from 'lucide-react';
import { useConfig } from '@/contexts/ConfigContext';
import { memoryPresets, workloadPresets } from '@/lib/presets';
import { useRouter } from 'next/navigation';
import { SpotlightTutorial } from '@/components/SpotlightTutorial';
import { CONFIGURATION_TUTORIAL_STEPS } from '@/config/spotlight-page-steps';
import { ONBOARDING_CONFIGURATION_KEY } from '@/lib/onboarding-storage';
import { DescriptionWithTooltip } from '@/components/DescriptionTooltip';

const CONFIGURATION_PAGE_INTRO =
  'Configure memory specifications and workload parameters. Choose one path at a time: either the in-app editor or JSON upload. The in-app path uses presets, sliders, and the visual builder; upload mode accepts memspec and workload JSON files.';

export default function Configuration() {
  const { memspec, workload, setMemspec, setWorkload, loadMemspecFromFile, loadWorkloadFromFile } = useConfig();
  const router = useRouter();
  const [configMode, setConfigMode] = useState<'inApp' | 'upload'>('inApp');
  const [memorySource, setMemorySource] = useState<'preset' | 'build'>('preset');
  const [selectedMemoryId, setSelectedMemoryId] = useState(memoryPresets[0].id);
  const [selectedWorkloadId, setSelectedWorkloadId] = useState('balanced');

  const [selectedManufacturer, setSelectedManufacturer] = useState<string>('');

  // Match loaded memspec to a preset ID on mount and when memspec changes
  useEffect(() => {
    // Try to find a preset that matches the current memspec by memoryId
    const matchingPreset = memoryPresets.find(
      (preset) => preset.memspec.memoryId === memspec.memoryId
    );
    
    if (matchingPreset) {
      setSelectedMemoryId(matchingPreset.id);
      setSelectedManufacturer(matchingPreset.manufacturer);
    } else {
      // If no exact match, check if it's a custom/uploaded spec
      setSelectedMemoryId('custom');
      // Try to infer manufacturer from memoryId
      const memoryIdLower = memspec.memoryId.toLowerCase();
      if (memoryIdLower.includes('micron')) {
        setSelectedManufacturer('Micron');
      } else if (memoryIdLower.includes('samsung')) {
        setSelectedManufacturer('Samsung');
      } else if (memoryIdLower.includes('hynix') || memoryIdLower.includes('skhynix')) {
        setSelectedManufacturer('SK Hynix');
      } else {
        setSelectedManufacturer('Micron'); // Default fallback
      }
    }
  }, [memspec]);

  // Match loaded workload to a preset ID on mount and when workload changes
  useEffect(() => {
    // Try to find a workload preset that matches the current workload
    const matchingWorkload = workloadPresets.find((preset) => {
      // Compare key workload fields
      return (
        Math.abs(preset.workload.RDsch_percent - workload.RDsch_percent) < 0.1 &&
        Math.abs(preset.workload.WRsch_percent - workload.WRsch_percent) < 0.1 &&
        Math.abs(preset.workload.BNK_PRE_percent - workload.BNK_PRE_percent) < 0.1 &&
        Math.abs(preset.workload.tRRDsch_ns - workload.tRRDsch_ns) < 0.1
      );
    });
    
    if (matchingWorkload) {
      setSelectedWorkloadId(matchingWorkload.id);
    } else {
      setSelectedWorkloadId('custom');
    }
  }, [workload]);
  const [memspecFile, setMemspecFile] = useState<File | null>(null);
  const [workloadFile, setWorkloadFile] = useState<File | null>(null);
  const [memspecError, setMemspecError] = useState<string | null>(null);
  const [workloadError, setWorkloadError] = useState<string | null>(null);
  const [memspecSuccess, setMemspecSuccess] = useState(false);
  const [workloadSuccess, setWorkloadSuccess] = useState(false);

  const handleSelectMemory = useCallback((preset: typeof memspec, id: string) => {
    setMemspec(preset);
    setSelectedMemoryId(id);
    setMemspecFile(null);
    setMemspecSuccess(false);
    setMemspecError(null);
  }, [setMemspec]);

  const handleSelectWorkload = useCallback((preset: typeof workload, id: string) => {
    setWorkload(preset);
    setSelectedWorkloadId(id);
    setWorkloadSuccess(false);
    setWorkloadError(null);
    setWorkloadFile(null);
  }, [setWorkload]);

  const handleMemspecFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setMemspecFile(file);
    setMemspecError(null);
    setMemspecSuccess(false);

    try {
      await loadMemspecFromFile(file);
      setMemspecSuccess(true);
      setSelectedMemoryId('custom');
    } catch (error) {
      setMemspecError(error instanceof Error ? error.message : 'Failed to load memory spec file');
    }
  }, [loadMemspecFromFile]);

  const handleWorkloadFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setWorkloadFile(file);
    setWorkloadError(null);
    setWorkloadSuccess(false);
    try {
      await loadWorkloadFromFile(file);
      setWorkloadSuccess(true);
      setSelectedWorkloadId('custom');
    } catch (error) {
      setWorkloadError(error instanceof Error ? error.message : 'Failed to load workload file');
    }
  }, [loadWorkloadFromFile]);

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      <Header />
      <SpotlightTutorial storageKey={ONBOARDING_CONFIGURATION_KEY} steps={CONFIGURATION_TUTORIAL_STEPS} />

      <main className="flex-1 container mx-auto px-4 py-6 overflow-y-auto scrollbar-thin">
        <div className="max-w-6xl mx-auto">
          <div className="mb-6" data-tutorial="configuration-intro">
            <h1 className="text-3xl font-bold mb-2">Configuration</h1>
            <DescriptionWithTooltip variant="plain" label="Configuration overview" text={CONFIGURATION_PAGE_INTRO} />
          </div>

          <Tabs value={configMode} onValueChange={(v) => setConfigMode(v as 'inApp' | 'upload')} className="w-full">
            <TabsList className="grid w-full max-w-md grid-cols-2 mb-6" data-tutorial="configuration-tabs">
              <TabsTrigger value="inApp" className="flex items-center gap-2">
                <MemoryStick className="w-4 h-4" />
                In-app editor
              </TabsTrigger>
              <TabsTrigger value="upload" className="flex items-center gap-2">
                <FileJson className="w-4 h-4" />
                Upload JSON
              </TabsTrigger>
            </TabsList>
            <div className={configMode === 'inApp' ? 'space-y-6' : 'hidden'}>
              <Tabs value={memorySource} onValueChange={(v) => setMemorySource(v as 'preset' | 'build')} className="w-full">
                <TabsList className="grid w-full max-w-md grid-cols-2 mb-6">
                  <TabsTrigger value="preset" className="flex items-center gap-2">
                    <MemoryStick className="w-4 h-4" />
                    Preset
                  </TabsTrigger>
                  <TabsTrigger value="build" className="flex items-center gap-2">
                    <Box className="w-4 h-4" />
                    Build your own
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="preset" className="mt-0">
                  <div className="space-y-6">
                    <div data-tutorial="configuration-presets">
                      <PresetSelector
                        selectedMemoryId={selectedMemoryId}
                        selectedWorkloadId={selectedWorkloadId}
                        currentMemspec={memspec}
                        onSelectMemory={handleSelectMemory}
                        onSelectWorkload={handleSelectWorkload}
                        defaultManufacturer={selectedManufacturer}
                      />
                    </div>
                    <div data-tutorial="configuration-panel">
                      <ConfigPanel
                        memspec={memspec}
                        workload={workload}
                        onMemspecChange={setMemspec}
                        onWorkloadChange={setWorkload}
                      />
                    </div>
                  </div>
                </TabsContent>
                <TabsContent value="build" className="mt-0">
                  <VisualBuilderContent
                    onApply={(m) => {
                      setMemspec(m);
                      setSelectedMemoryId('custom');
                      setMemorySource('preset');
                    }}
                  />
                </TabsContent>
              </Tabs>
            </div>

            <div className={configMode === 'upload' ? 'space-y-6' : 'hidden'} data-tutorial="configuration-uploads">
              <Card className="power-card">
                <CardHeader className="!p-4 !pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <FileJson className="w-4 h-4 text-primary" />
                    Upload Memory Specification
                  </CardTitle>
                  <CardDescription className="text-xs">
                    JSON with a top-level <code className="text-[10px]">memspec</code> object. IDD/IPP values are interpreted as milliamps in the UI and normalized if amp-scale exports are provided.
                  </CardDescription>
                </CardHeader>
                <CardContent className="!p-4 !pt-0 space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="memspec-file" className="text-sm">Memory Spec JSON File</Label>
                    <div className="flex items-center gap-2">
                      <Input id="memspec-file" type="file" accept=".json" onChange={handleMemspecFileChange} className="flex-1" />
                      {memspecFile ? (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <FileJson className="w-3 h-3" />
                          {memspecFile.name}
                        </div>
                      ) : null}
                    </div>
                  </div>
                  {memspecSuccess ? (
                    <Alert className="bg-accent/10 border-accent/30">
                      <CheckCircle2 className="h-4 w-4 text-accent" />
                      <AlertDescription className="text-sm">Memory specification loaded successfully!</AlertDescription>
                    </Alert>
                  ) : null}
                  {memspecError ? (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription className="text-sm">{memspecError}</AlertDescription>
                    </Alert>
                  ) : null}
                </CardContent>
              </Card>

              <Card className="power-card">
                <CardHeader className="!p-4 !pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <FileJson className="w-4 h-4 text-primary" />
                    Upload Workload
                  </CardTitle>
                  <CardDescription className="text-xs">
                    JSON can be either root fields (core <code className="text-[10px]">load_workload</code> style) or wrapped in <code className="text-[10px]">workload</code>. All workload fields are required.
                  </CardDescription>
                </CardHeader>
                <CardContent className="!p-4 !pt-0 space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="workload-file" className="text-sm">Workload JSON File</Label>
                    <div className="flex items-center gap-2">
                      <Input id="workload-file" type="file" accept=".json" onChange={handleWorkloadFileChange} className="flex-1" />
                      {workloadFile ? (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <FileJson className="w-3 h-3" />
                          {workloadFile.name}
                        </div>
                      ) : null}
                    </div>
                  </div>
                  {workloadSuccess ? (
                    <Alert className="bg-accent/10 border-accent/30">
                      <CheckCircle2 className="h-4 w-4 text-accent" />
                      <AlertDescription className="text-sm">Workload loaded successfully!</AlertDescription>
                    </Alert>
                  ) : null}
                  {workloadError ? (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription className="text-sm">{workloadError}</AlertDescription>
                    </Alert>
                  ) : null}
                  <div className="text-xs text-muted-foreground space-y-1">
                    <p className="font-medium">Required fields:</p>
                    <pre className="bg-secondary/50 p-2 rounded text-[10px] overflow-x-auto">{`{
  "BNK_PRE_percent": 50.0,
  "CKE_LO_PRE_percent": 0.0,
  "CKE_LO_ACT_percent": 0.0,
  "PageHit_percent": 50.0,
  "RDsch_percent": 25.0,
  "RD_Data_Low_percent": 50.0,
  "WRsch_percent": 25.0,
  "WR_Data_Low_percent": 50.0,
  "termRDsch_percent": 0.0,
  "termWRsch_percent": 0.0,
  "System_tRC_ns": 46.0,
  "tRRDsch_ns": 5.0
}`}</pre>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Keep these anchors in DOM for tutorial selector tests */}
            <div className={configMode === 'upload' ? '' : 'hidden'} data-tutorial="configuration-presets" />
            <div className={configMode === 'upload' ? '' : 'hidden'} data-tutorial="configuration-panel" />
            <div className={configMode === 'inApp' ? '' : 'hidden'} data-tutorial="configuration-uploads" />

            <div className="flex gap-3 pt-4" data-tutorial="configuration-power-nav">
              <Button onClick={() => router.push('/core-power')} className="flex-1" size="lg">
                View Core Power
              </Button>
              <Button onClick={() => router.push('/dimm-power')} variant="outline" className="flex-1" size="lg">
                View DIMM Power
              </Button>
            </div>
          </Tabs>
        </div>
      </main>
    </div>
  );
}

