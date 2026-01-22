import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PresetSelector } from './PresetSelector';
import { memoryPresets, workloadPresets } from '@/lib/presets';

describe('PresetSelector', () => {
  const mockOnSelectMemory = vi.fn();
  const mockOnSelectWorkload = vi.fn();

  it('should render memory presets', () => {
    render(
      <PresetSelector
        selectedMemoryId={memoryPresets[0].id}
        selectedWorkloadId="balanced"
        onSelectMemory={mockOnSelectMemory}
        onSelectWorkload={mockOnSelectWorkload}
      />
    );

    // Check that at least the first preset is rendered (others are in different tabs)
    expect(screen.getByText(memoryPresets[0].name)).toBeInTheDocument();
    
    // Check that manufacturer tabs are rendered
    const manufacturers = [...new Set(memoryPresets.map((p) => p.manufacturer))];
    manufacturers.forEach((mfr) => {
      expect(screen.getByText(mfr)).toBeInTheDocument();
    });
  });

  it('should render workload presets', () => {
    render(
      <PresetSelector
        selectedMemoryId={memoryPresets[0].id}
        selectedWorkloadId="balanced"
        onSelectMemory={mockOnSelectMemory}
        onSelectWorkload={mockOnSelectWorkload}
      />
    );

    // Check that workload preset names are rendered
    workloadPresets.forEach((preset) => {
      expect(screen.getByText(preset.name)).toBeInTheDocument();
    });
  });

  it('should highlight selected memory preset', () => {
    const selectedId = memoryPresets[1].id;
    render(
      <PresetSelector
        selectedMemoryId={selectedId}
        selectedWorkloadId="balanced"
        onSelectMemory={mockOnSelectMemory}
        onSelectWorkload={mockOnSelectWorkload}
      />
    );

    const selectedButton = screen.getByText(memoryPresets[1].name).closest('button');
    expect(selectedButton).toHaveClass('glow-primary');
  });

  it('should highlight selected workload preset', () => {
    render(
      <PresetSelector
        selectedMemoryId={memoryPresets[0].id}
        selectedWorkloadId="read_heavy"
        onSelectMemory={mockOnSelectMemory}
        onSelectWorkload={mockOnSelectWorkload}
      />
    );

    const selectedButton = screen.getByText('Read Heavy').closest('button');
    expect(selectedButton).toHaveClass('bg-accent');
  });
});

