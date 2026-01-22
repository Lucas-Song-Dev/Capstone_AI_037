import { useState } from 'react';
import { Button, Container, Title, Select, Stack, Card, Text, Group } from '@mantine/core';
import { computeCorePower, createDefaultWorkload } from './lib/ddr5Calculator';
import { DDR5_PRESETS, PRESET_NAMES } from './lib/presets';
import type { PowerResult } from './lib/types';

function App() {
  const [selectedPreset, setSelectedPreset] = useState<string>('micron_16gb_6400');
  const [powerResult, setPowerResult] = useState<PowerResult | null>(null);

  const handleCalculate = () => {
    if (!selectedPreset || !DDR5_PRESETS[selectedPreset]) return;

    const memspec = DDR5_PRESETS[selectedPreset];
    const workload = createDefaultWorkload();
    const result = computeCorePower(memspec, workload);
    setPowerResult(result);
  };

  const handlePresetChange = (value: string | null) => {
    if (value) setSelectedPreset(value);
  };

  return (
    <Container size="lg" py="xl">
      <Title order={1} mb="xl">DDR5 Power Calculator</Title>

      <Stack gap="lg">
        <Card shadow="sm" padding="lg" radius="md" withBorder>
          <Title order={3} mb="md">Configuration</Title>

          <Select
            label="Memory Specification"
            placeholder="Select a DDR5 configuration"
            data={Object.entries(PRESET_NAMES).map(([key, name]) => ({
              value: key,
              label: name
            }))}
            value={selectedPreset}
            onChange={handlePresetChange}
            mb="md"
          />

          <Button onClick={handleCalculate} size="lg" w="100%">
            Calculate Power Consumption
          </Button>
        </Card>

        {powerResult && (
          <Card shadow="sm" padding="lg" radius="md" withBorder>
            <Title order={3} mb="md">Power Results</Title>

            <Stack gap="sm">
              <Group justify="space-between">
                <Text fw={500}>Total Core Power:</Text>
                <Text size="lg" fw={700} c="blue">
                  {powerResult.P_total_core.toFixed(4)} W
                </Text>
              </Group>

              <Group justify="space-between">
                <Text>VDD Power:</Text>
                <Text>{powerResult.P_VDD_core.toFixed(4)} W</Text>
              </Group>

              <Group justify="space-between">
                <Text>VPP Power:</Text>
                <Text>{powerResult.P_VPP_core.toFixed(4)} W</Text>
              </Group>

              <Group justify="space-between">
                <Text>Precharge Standby:</Text>
                <Text>{powerResult.P_PRE_STBY_core.toFixed(4)} W</Text>
              </Group>

              <Group justify="space-between">
                <Text>Active Standby:</Text>
                <Text>{powerResult.P_ACT_STBY_core.toFixed(4)} W</Text>
              </Group>

              <Group justify="space-between">
                <Text>Read Power:</Text>
                <Text>{powerResult.P_RD_core.toFixed(4)} W</Text>
              </Group>

              <Group justify="space-between">
                <Text>Write Power:</Text>
                <Text>{powerResult.P_WR_core.toFixed(4)} W</Text>
              </Group>

              <Group justify="space-between">
                <Text>Refresh Power:</Text>
                <Text>{powerResult.P_REF_core.toFixed(4)} W</Text>
              </Group>

              <Group justify="space-between">
                <Text>Activate/Precharge:</Text>
                <Text>{powerResult.P_ACT_PRE_core.toFixed(4)} W</Text>
              </Group>
            </Stack>
          </Card>
        )}
      </Stack>
    </Container>
  );
}

export default App;
