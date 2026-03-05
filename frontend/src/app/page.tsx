'use client';

import { Header } from '@/components/Header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowRight, Settings, Zap, MemoryStick, FileJson, Play } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      <Header />
      
      <main className="flex-1 container mx-auto px-4 py-6 overflow-y-auto scrollbar-thin">
        <div className="max-w-4xl mx-auto">
          {/* Hero Section */}
          <div className="text-center mb-12 mt-8">
            <h1 className="text-4xl font-bold mb-4">
              DDR5 <span className="gradient-text">Power Calculator</span>
            </h1>
            <p className="text-xl text-muted-foreground mb-8">
              JEDEC-compliant power modeling for DDR5 memory modules
            </p>
            <Button
              size="lg"
              onClick={() => router.push('/configuration')}
              className="text-lg px-8"
            >
              <Play className="w-5 h-5 mr-2" />
              Get Started
            </Button>
          </div>

          {/* How to Use Section */}
          <div className="mb-12">
            <h2 className="text-2xl font-semibold mb-6 text-center">How to Use</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Step 1 */}
              <Card className="power-card">
                <CardHeader className="!p-4 !pb-2">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">
                      1
                    </div>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Settings className="w-5 h-5 text-primary" />
                      Configure
                    </CardTitle>
                  </div>
                  <CardDescription>
                    Set up your memory specification and workload parameters
                  </CardDescription>
                </CardHeader>
                <CardContent className="!p-4 !pt-0 space-y-2">
                  <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                    <li>Select a memory preset or upload a custom JSON file</li>
                    <li>Choose a workload profile or upload custom workload</li>
                    <li>Adjust voltage, current, and workload parameters</li>
                  </ul>
                </CardContent>
              </Card>

              {/* Step 2 */}
              <Card className="power-card">
                <CardHeader className="!p-4 !pb-2">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">
                      2
                    </div>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Zap className="w-5 h-5 text-power-vdd" />
                      Core Power
                    </CardTitle>
                  </div>
                  <CardDescription>
                    Analyze per-chip power consumption breakdown
                  </CardDescription>
                </CardHeader>
                <CardContent className="!p-4 !pt-0 space-y-2">
                  <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                    <li>View total core power per chip</li>
                    <li>See 3D visualization of memory architecture</li>
                    <li>Analyze power components and distribution</li>
                  </ul>
                </CardContent>
              </Card>

              {/* Step 3 */}
              <Card className="power-card">
                <CardHeader className="!p-4 !pb-2">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">
                      3
                    </div>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <MemoryStick className="w-5 h-5 text-accent" />
                      DIMM Power
                    </CardTitle>
                  </div>
                  <CardDescription>
                    Calculate total DIMM power including overhead
                  </CardDescription>
                </CardHeader>
                <CardContent className="!p-4 !pt-0 space-y-2">
                  <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                    <li>View total DIMM power consumption</li>
                    <li>See breakdown of core, interface, and overhead</li>
                    <li>Understand complete power profile</li>
                  </ul>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Features Section */}
          <div className="mb-12">
            <h2 className="text-2xl font-semibold mb-6 text-center">Features</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="power-card">
                <CardHeader className="!p-4 !pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <FileJson className="w-4 h-4 text-primary" />
                    Custom JSON Upload
                  </CardTitle>
                </CardHeader>
                <CardContent className="!p-4 !pt-0">
                  <p className="text-sm text-muted-foreground">
                    Upload your own memory specification and workload JSON files for custom configurations.
                  </p>
                </CardContent>
              </Card>

              <Card className="power-card">
                <CardHeader className="!p-4 !pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Settings className="w-4 h-4 text-primary" />
                    Persistent Configuration
                  </CardTitle>
                </CardHeader>
                <CardContent className="!p-4 !pt-0">
                  <p className="text-sm text-muted-foreground">
                    Your settings are automatically saved to localStorage and persist across page navigation.
                  </p>
                </CardContent>
              </Card>

              <Card className="power-card">
                <CardHeader className="!p-4 !pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Zap className="w-4 h-4 text-power-vdd" />
                    Real-time Calculation
                  </CardTitle>
                </CardHeader>
                <CardContent className="!p-4 !pt-0">
                  <p className="text-sm text-muted-foreground">
                    Power calculations update automatically as you adjust parameters in real-time.
                  </p>
                </CardContent>
              </Card>

              <Card className="power-card">
                <CardHeader className="!p-4 !pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <MemoryStick className="w-4 h-4 text-accent" />
                    JEDEC Compliant
                  </CardTitle>
                </CardHeader>
                <CardContent className="!p-4 !pt-0">
                  <p className="text-sm text-muted-foreground">
                    Based on JEDEC JESD79-5 specifications for accurate DDR5 power modeling.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

