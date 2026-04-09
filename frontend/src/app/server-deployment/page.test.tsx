import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import userEvent from '@testing-library/user-event';
import { cleanup, render, screen, waitFor } from '../../../tests/unit/next-test-utils';
import * as serverDeployment from '@/lib/serverDeployment';
import { memoryPresets, workloadPresets } from '@/lib/presets';
import { computeCorePower, computeDIMMPower } from '@/lib/ddr5Calculator';
import type { ServerConfiguration, ServerRequirements } from '@/lib/serverDeployment';
import { ONBOARDING_SERVER_DEPLOYMENT_KEY } from '@/lib/onboarding-storage';
import ServerDeployment from './page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), prefetch: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/server-deployment',
}));

function makeLenientRankedConfig(): ServerConfiguration {
  const preset = memoryPresets[0];
  const workload = workloadPresets[0].workload;
  const powerResult = computeCorePower(preset.memspec, workload);
  const dimmPowerResult = computeDIMMPower(powerResult, preset.memspec);
  const req: ServerRequirements = {
    powerBudgetPerServer: 100_000,
    minDataRate: 1,
    totalCapacity: 1,
    workloadType: 'balanced',
    dimmsPerServer: 8,
  };
  return serverDeployment.buildServerConfiguration(
    preset,
    req,
    4,
    workload,
    powerResult,
    dimmPowerResult
  );
}

describe('ServerDeployment fleet sizing UI', () => {
  beforeEach(() => {
    localStorage.setItem(ONBOARDING_SERVER_DEPLOYMENT_KEY, '1');
    const cfg = makeLenientRankedConfig();
    vi.spyOn(serverDeployment, 'findServerConfigurations').mockResolvedValue({
      rankedConfigurations: [cfg],
      totalMatched: 1,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    cleanup();
  });

  it('renders four fleet sizing modes', () => {
    render(<ServerDeployment />);
    expect(screen.getByRole('radio', { name: /per server/i })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /fleet power/i })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /fleet bw/i })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /fleet cap/i })).toBeInTheDocument();
  });

  it('shows target peak bandwidth input in fleet bandwidth mode', async () => {
    const user = userEvent.setup();
    render(<ServerDeployment />);
    await user.click(screen.getByRole('radio', { name: /fleet bw/i }));
    expect(screen.getByLabelText(/target fleet peak bandwidth/i)).toBeInTheDocument();
  });

  it('shows target fleet memory capacity input in fleet capacity mode', async () => {
    const user = userEvent.setup();
    render(<ServerDeployment />);
    await user.click(screen.getByRole('radio', { name: /fleet cap/i }));
    expect(screen.getByLabelText(/target fleet memory capacity/i)).toBeInTheDocument();
  });

  it(
    'rejects non-positive target bandwidth before search',
    async () => {
      const user = userEvent.setup();
      render(<ServerDeployment />);
      await user.click(screen.getByRole('radio', { name: /fleet bw/i }));
      const bwInput = document.getElementById('target-fleet-bw') as HTMLInputElement;
      await user.clear(bwInput);
      await user.type(bwInput, '0');
      await user.click(screen.getByRole('button', { name: /find configurations/i }));
      expect(await screen.findByText(/target fleet peak bandwidth must be a positive number/i)).toBeInTheDocument();
      expect(serverDeployment.findServerConfigurations).not.toHaveBeenCalled();
    },
    15_000,
  );

  it(
    'rejects non-positive target fleet capacity before search',
    async () => {
      const user = userEvent.setup();
      render(<ServerDeployment />);
      await user.click(screen.getByRole('radio', { name: /fleet cap/i }));
      const capInput = document.getElementById('target-fleet-cap') as HTMLInputElement;
      await user.clear(capInput);
      await user.type(capInput, '0');
      await user.click(screen.getByRole('button', { name: /find configurations/i }));
      expect(
        await screen.findByText(/target fleet memory capacity must be a positive number/i),
      ).toBeInTheDocument();
      expect(serverDeployment.findServerConfigurations).not.toHaveBeenCalled();
    },
    15_000,
  );

  it('passes powerBudgetPerServer = total÷100 in fleet power mode', async () => {
    const user = userEvent.setup();
    render(<ServerDeployment />);
    await user.click(screen.getByRole('radio', { name: /fleet power/i }));
    const powerInput = document.getElementById('power-budget') as HTMLInputElement;
    await user.clear(powerInput);
    await user.type(powerInput, '10000');
    await user.click(screen.getByRole('button', { name: /find configurations/i }));
    await waitFor(() => {
      expect(serverDeployment.findServerConfigurations).toHaveBeenCalled();
    });
    const arg = vi.mocked(serverDeployment.findServerConfigurations).mock.calls[0][0];
    expect(arg.powerBudgetPerServer).toBeCloseTo(100, 10);
  });

  it('passes direct per-server power in fleet bandwidth mode', async () => {
    const user = userEvent.setup();
    render(<ServerDeployment />);
    await user.click(screen.getByRole('radio', { name: /fleet bw/i }));
    const powerInput = document.getElementById('power-budget') as HTMLInputElement;
    await user.clear(powerInput);
    await user.type(powerInput, '250');
    await user.click(screen.getByRole('button', { name: /find configurations/i }));
    await waitFor(() => {
      expect(serverDeployment.findServerConfigurations).toHaveBeenCalled();
    });
    const arg = vi.mocked(serverDeployment.findServerConfigurations).mock.calls[0][0];
    expect(arg.powerBudgetPerServer).toBeCloseTo(250, 10);
  });
});
