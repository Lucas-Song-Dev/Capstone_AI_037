import { useState } from 'react';
import { Button, Container, Title, Select, Stack, Card, Text, Group, Badge, Progress, Box, Paper } from '@mantine/core';
import { Cpu, Zap, BarChart3, Settings, Zap as ZapIcon } from 'lucide-react';
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

    // Simulate a brief calculation delay for better UX
    await new Promise(resolve => setTimeout(resolve, 500));

    const memspec = DDR5_PRESETS[selectedPreset];
    const workload = createDefaultWorkload();
    const result = computeCorePower(memspec, workload);
    setPowerResult(result);
    setIsCalculating(false);
  };

  const handlePresetChange = (value: string | null) => {
    if (value) setSelectedPreset(value);
  };

  const getPowerColor = (power: number) => {
    if (power < 0.1) return 'green';
    if (power < 0.5) return 'blue';
    if (power < 1.0) return 'orange';
    return 'red';
  };

  const formatPower = (power: number) => `${power.toFixed(4)} W`;

  return (
    <Box style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      padding: '2rem 0'
    }}>
      <Container size="lg">
        {/* Header */}
        <Paper shadow="xl" radius="lg" p="xl" mb="xl" style={{ background: 'rgba(255, 255, 255, 0.95)' }}>
          <Group justify="center" mb="md">
            <Cpu size={48} color="#1c7ed6" />
          </Group>
          <Title order={1} ta="center" c="blue.8" mb="sm">
            DDR5 Power Calculator
          </Title>
          <Text ta="center" c="dimmed" size="lg">
            Analyze DDR5 memory power consumption with JEDEC-compliant calculations
          </Text>
          <Group justify="center" mt="md">
            <Badge color="blue" variant="light" size="lg">
              Real-time Analysis
            </Badge>
            <Badge color="green" variant="light" size="lg">
              JEDEC Compliant
            </Badge>
            <Badge color="orange" variant="light" size="lg">
              Browser-based
            </Badge>
          </Group>
        </Paper>

        <Stack gap="xl">
          {/* Configuration Card */}
          <Card shadow="xl" padding="xl" radius="lg" style={{ background: 'rgba(255, 255, 255, 0.95)' }}>
            <Group mb="lg">
              <Settings size={24} color="#1c7ed6" />
              <Title order={2} c="blue.8">Memory Configuration</Title>
            </Group>

            <Stack gap="md">
              <Select
                label="DDR5 Memory Specification"
                placeholder="Choose a memory configuration"
                description="Select from pre-configured manufacturer specifications"
                data={Object.entries(PRESET_NAMES).map(([key, name]) => ({
                  value: key,
                  label: name
                }))}
                value={selectedPreset}
                onChange={handlePresetChange}
                size="lg"
                radius="md"
                leftSection={<Cpu size={18} />}
              />

              <Button
                onClick={handleCalculate}
                size="xl"
                fullWidth
                leftSection={<Zap size={20} />}
                loading={isCalculating}
                loaderProps={{ type: 'dots' }}
                gradient={{ from: 'blue', to: 'cyan' }}
                style={{ height: 60 }}
              >
                {isCalculating ? 'Calculating...' : 'Calculate Power Consumption'}
              </Button>
            </Stack>
          </Card>

          {/* Results Card */}
          {powerResult && (
            <Card shadow="xl" padding="xl" radius="lg" style={{ background: 'rgba(255, 255, 255, 0.95)' }}>
              <Group mb="lg">
                <BarChart3 size={24} color="#1c7ed6" />
                <Title order={2} c="blue.8">Power Analysis Results</Title>
              </Group>

              {/* Main Power Display */}
              <Paper shadow="sm" p="xl" radius="md" mb="xl" style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white' }}>
                <Group justify="center">
                  <div style={{ textAlign: 'center' }}>
                    <ZapIcon size={48} style={{ marginBottom: '1rem' }} />
                    <Title order={1} style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>
                      {formatPower(powerResult.P_total_core)}
                    </Title>
                    <Text size="xl" fw={500}>Total Core Power</Text>
                  </div>
                </Group>
              </Paper>

              {/* Power Breakdown */}
              <Stack gap="md">
                <Title order={3} c="blue.8" mb="md">Power Breakdown</Title>

                <Group grow>
                  <Paper shadow="sm" p="md" radius="md" style={{ border: '1px solid #e9ecef' }}>
                    <Text size="sm" c="dimmed" mb="xs">VDD Power</Text>
                    <Text size="lg" fw={600} c={getPowerColor(powerResult.P_VDD_core)}>
                      {formatPower(powerResult.P_VDD_core)}
                    </Text>
                    <Progress
                      value={(powerResult.P_VDD_core / powerResult.P_total_core) * 100}
                      color="blue"
                      size="sm"
                      mt="xs"
                    />
                  </Paper>

                  <Paper shadow="sm" p="md" radius="md" style={{ border: '1px solid #e9ecef' }}>
                    <Text size="sm" c="dimmed" mb="xs">VPP Power</Text>
                    <Text size="lg" fw={600} c={getPowerColor(powerResult.P_VPP_core)}>
                      {formatPower(powerResult.P_VPP_core)}
                    </Text>
                    <Progress
                      value={(powerResult.P_VPP_core / powerResult.P_total_core) * 100}
                      color="orange"
                      size="sm"
                      mt="xs"
                    />
                  </Paper>
                </Group>

                <Title order={4} c="blue.7" mt="lg" mb="md">Detailed Components</Title>

                <Stack gap="sm">
                  {[
                    { label: 'Precharge Standby', value: powerResult.P_PRE_STBY_core },
                    { label: 'Active Standby', value: powerResult.P_ACT_STBY_core },
                    { label: 'Read Power', value: powerResult.P_RD_core },
                    { label: 'Write Power', value: powerResult.P_WR_core },
                    { label: 'Refresh Power', value: powerResult.P_REF_core },
                    { label: 'Activate/Precharge', value: powerResult.P_ACT_PRE_core },
                  ].map((item, index) => (
                    <Group key={index} justify="space-between" style={{ padding: '0.5rem', borderRadius: '4px', background: index % 2 === 0 ? '#f8f9fa' : 'transparent' }}>
                      <Text fw={500}>{item.label}:</Text>
                      <Text c={getPowerColor(item.value)} fw={600}>
                        {formatPower(item.value)}
                      </Text>
                    </Group>
                  ))}
                </Stack>
              </Stack>
            </Card>
          )}
        </Stack>

        {/* Footer */}
        <Paper shadow="sm" p="md" radius="md" mt="xl" style={{ background: 'rgba(255, 255, 255, 0.9)', textAlign: 'center' }}>
          <Text size="sm" c="dimmed">
            DDR5 Power Calculator - JEDEC-compliant power analysis for modern memory systems
          </Text>
        </Paper>
      </Container>
    </Box>
  );
}

export default App;
