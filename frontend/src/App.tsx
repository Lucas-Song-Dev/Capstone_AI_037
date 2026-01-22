import { useState } from 'react';
import { computeCorePower, createDefaultWorkload } from './lib/ddr5Calculator';
import { DDR5_PRESETS, PRESET_NAMES } from './lib/presets';
import type { PowerResult } from './lib/types';

function App() {
  const [selectedPreset, setSelectedPreset] = useState<string>('micron_16gb_6400');
  const [powerResult, setPowerResult] = useState<PowerResult | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);

  const handleCalculate = async () => {
    if (!selectedPreset || !DDR5_PRESETS[selectedPreset]) return;

    setIsCalculating(true);

    // Simulate calculation time for better UX
    await new Promise(resolve => setTimeout(resolve, 500));

    try {
      const memspec = DDR5_PRESETS[selectedPreset];
      const workload = createDefaultWorkload();
      const result = computeCorePower(memspec, workload);
      setPowerResult(result);
    } catch (error) {
      console.error('Calculation error:', error);
    } finally {
      setIsCalculating(false);
    }
  };

  const handlePresetChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedPreset(event.target.value);
  };

  const formatPower = (power: number) => `${power.toFixed(4)} W`;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 via-purple-600 to-blue-800 p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-4">
            DDR5 Power Calculator
          </h1>
          <p className="text-blue-100 text-lg">
            Analyze DDR5 memory power consumption with JEDEC-compliant calculations
          </p>
        </div>

        {/* Configuration */}
        <div className="glass-card rounded-lg p-6 mb-8">
          <h2 className="text-2xl font-semibold text-white mb-4">Memory Configuration</h2>

          <div className="mb-4">
            <label className="block text-sm font-medium text-blue-100 mb-2">
              DDR5 Memory Specification
            </label>
            <select
              value={selectedPreset}
              onChange={handlePresetChange}
              className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-md text-white"
            >
              {Object.entries(PRESET_NAMES).map(([key, name]) => (
                <option key={key} value={key} className="bg-gray-800">
                  {name}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={handleCalculate}
            disabled={isCalculating}
            className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-semibold py-3 px-6 rounded-md transition-all duration-200 disabled:opacity-50"
          >
            {isCalculating ? 'Calculating...' : 'Calculate Power Consumption'}
          </button>
        </div>

        {/* Results */}
        {powerResult && (
          <div className="glass-card rounded-lg p-6">
            <h2 className="text-2xl font-semibold text-white mb-6">Power Analysis Results</h2>

            {/* Main Power Display */}
            <div className="bg-gradient-to-r from-blue-500/20 to-purple-600/20 rounded-lg p-6 mb-6 border border-white/10">
              <div className="text-center">
                <div className="text-5xl font-bold text-white mb-2">
                  {formatPower(powerResult.P_total_core)}
                </div>
                <div className="text-blue-200 text-lg">Total Core Power</div>
              </div>
            </div>

            {/* Power Breakdown */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-lg font-medium text-white mb-4">Power Distribution</h3>
                <div className="space-y-4">
                  <div className="flex justify-between items-center p-3 bg-white/5 rounded-md">
                    <span className="text-blue-100 font-medium">VDD Power:</span>
                    <span className="font-mono font-semibold text-blue-400">
                      {formatPower(powerResult.P_VDD_core)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-white/5 rounded-md">
                    <span className="text-blue-100 font-medium">VPP Power:</span>
                    <span className="font-mono font-semibold text-purple-400">
                      {formatPower(powerResult.P_VPP_core)}
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-medium text-white mb-4">Component Breakdown</h3>
                <div className="space-y-2">
                  {[
                    { label: 'Precharge Standby', value: powerResult.P_PRE_STBY_core },
                    { label: 'Active Standby', value: powerResult.P_ACT_STBY_core },
                    { label: 'Read Power', value: powerResult.P_RD_core },
                    { label: 'Write Power', value: powerResult.P_WR_core },
                    { label: 'Refresh Power', value: powerResult.P_REF_core },
                    { label: 'Activate/Precharge', value: powerResult.P_ACT_PRE_core },
                  ].map((item, index) => (
                    <div key={item.label} className={`flex justify-between items-center py-2 px-3 rounded-md ${index % 2 === 0 ? 'bg-white/5' : 'bg-white/10'}`}>
                      <span className="text-blue-100 text-sm">{item.label}:</span>
                      <span className="font-mono text-sm text-white">
                        {formatPower(item.value)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
