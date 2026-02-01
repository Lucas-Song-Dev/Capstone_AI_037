'use client';

import { useState, useCallback, useEffect } from 'react';
import { Header } from '@/components/Header';
import { ConfigPanel } from '@/components/ConfigPanel';
import { PresetSelector } from '@/components/PresetSelector';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Upload, FileJson, CheckCircle2, AlertCircle } from 'lucide-react';
import { useConfig } from '@/contexts/ConfigContext';
import { memoryPresets, workloadPresets } from '@/lib/presets';
import { useRouter } from 'next/navigation';

export default function Configuration() {
  const { memspec, workload, setMemspec, setWorkload, loadWorkloadFromFile, loadMemspecFromFile } = useConfig();
  const router = useRouter();
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
  const [workloadFile, setWorkloadFile] = useState<File | null>(null);
  const [memspecFile, setMemspecFile] = useState<File | null>(null);
  const [workloadError, setWorkloadError] = useState<string | null>(null);
  const [memspecError, setMemspecError] = useState<string | null>(null);
  const [workloadSuccess, setWorkloadSuccess] = useState(false);
  const [memspecSuccess, setMemspecSuccess] = useState(false);

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
    setWorkloadFile(null);
    setWorkloadSuccess(false);
    setWorkloadError(null);
  }, [setWorkload]);

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

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      <Header />
      
      <main className="flex-1 container mx-auto px-4 py-6 overflow-y-auto scrollbar-thin">
        <div className="max-w-6xl mx-auto">
          <div className="mb-6">
            <h1 className="text-3xl font-bold mb-2">Configuration</h1>
            <p className="text-muted-foreground">
              Configure memory specifications and workload parameters. Upload custom JSON files or select from presets.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Column - Presets */}
            <div className="space-y-6">
              <PresetSelector
                selectedMemoryId={selectedMemoryId}
                selectedWorkloadId={selectedWorkloadId}
                onSelectMemory={handleSelectMemory}
                onSelectWorkload={handleSelectWorkload}
                defaultManufacturer={selectedManufacturer}
              />
              
              <ConfigPanel
                memspec={memspec}
                workload={workload}
                onMemspecChange={setMemspec}
                onWorkloadChange={setWorkload}
              />
            </div>

            {/* Right Column - File Uploads */}
            <div className="space-y-6">
              {/* Memory Spec Upload */}
              <Card className="power-card">
                <CardHeader className="!p-4 !pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <FileJson className="w-4 h-4 text-primary" />
                    Upload Memory Specification
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Upload a custom memory specification JSON file
                  </CardDescription>
                </CardHeader>
                <CardContent className="!p-4 !pt-0 space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="memspec-file" className="text-sm">
                      Memory Spec JSON File
                    </Label>
                    <div className="flex items-center gap-2">
                      <Input
                        id="memspec-file"
                        type="file"
                        accept=".json"
                        onChange={handleMemspecFileChange}
                        className="flex-1"
                      />
                      {memspecFile && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <FileJson className="w-3 h-3" />
                          {memspecFile.name}
                        </div>
                      )}
                    </div>
                  </div>

                  {memspecSuccess && (
                    <Alert className="bg-accent/10 border-accent/30">
                      <CheckCircle2 className="h-4 w-4 text-accent" />
                      <AlertDescription className="text-sm">
                        Memory specification loaded successfully!
                      </AlertDescription>
                    </Alert>
                  )}

                  {memspecError && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription className="text-sm">
                        {memspecError}
                      </AlertDescription>
                    </Alert>
                  )}

                  <div className="text-xs text-muted-foreground space-y-1">
                    <p className="font-medium">Expected format:</p>
                    <pre className="bg-secondary/50 p-2 rounded text-[10px] overflow-x-auto">
{`{
  "memspec": {
    "memoryId": "...",
    "memarchitecturespec": {...},
    "mempowerspec": {...},
    "memtimingspec": {...}
  }
}`}
                    </pre>
                  </div>
                </CardContent>
              </Card>

              {/* Workload Upload */}
              <Card className="power-card">
                <CardHeader className="!p-4 !pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Upload className="w-4 h-4 text-primary" />
                    Upload Workload
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Upload a custom workload JSON file
                  </CardDescription>
                </CardHeader>
                <CardContent className="!p-4 !pt-0 space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="workload-file" className="text-sm">
                      Workload JSON File
                    </Label>
                    <div className="flex items-center gap-2">
                      <Input
                        id="workload-file"
                        type="file"
                        accept=".json"
                        onChange={handleWorkloadFileChange}
                        className="flex-1"
                      />
                      {workloadFile && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <FileJson className="w-3 h-3" />
                          {workloadFile.name}
                        </div>
                      )}
                    </div>
                  </div>

                  {workloadSuccess && (
                    <Alert className="bg-accent/10 border-accent/30">
                      <CheckCircle2 className="h-4 w-4 text-accent" />
                      <AlertDescription className="text-sm">
                        Workload loaded successfully!
                      </AlertDescription>
                    </Alert>
                  )}

                  {workloadError && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription className="text-sm">
                        {workloadError}
                      </AlertDescription>
                    </Alert>
                  )}

                  <div className="text-xs text-muted-foreground space-y-1">
                    <p className="font-medium">Expected format:</p>
                    <pre className="bg-secondary/50 p-2 rounded text-[10px] overflow-x-auto">
{`{
  "BNK_PRE_percent": 50.0,
  "RDsch_percent": 25.0,
  "WRsch_percent": 25.0,
  ...
}`}
                    </pre>
                  </div>
                </CardContent>
              </Card>

              {/* Navigation Buttons */}
              <div className="flex gap-3 pt-4">
                <Button
                  onClick={() => router.push('/core-power')}
                  className="flex-1"
                  size="lg"
                >
                  View Core Power
                </Button>
                <Button
                  onClick={() => router.push('/dimm-power')}
                  variant="outline"
                  className="flex-1"
                  size="lg"
                >
                  View DIMM Power
                </Button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

