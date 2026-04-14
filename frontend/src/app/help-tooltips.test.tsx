import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import userEvent from '@testing-library/user-event';
import { cleanup, render, screen, within } from '../../tests/unit/next-test-utils';
import ServerDeployment from '@/app/server-deployment/page';
import TargetPower from '@/app/target-power/page';
import { Header } from '@/components/Header';
import { ONBOARDING_SERVER_DEPLOYMENT_KEY } from '@/lib/onboarding-storage';

afterEach(() => {
  cleanup();
});

/**
 * Field hints use HelpTooltip / LinkIconTooltip from components/HelpTooltip.tsx.
 * Test TooltipProvider uses delayDuration={0} (see next-test-utils).
 */
describe('Help (?) tooltips', () => {
  beforeEach(() => {
    localStorage.setItem(ONBOARDING_SERVER_DEPLOYMENT_KEY, '1');
  });
  it('Server Deployment: workload type help opens on hover', async () => {
    const user = userEvent.setup();
    render(<ServerDeployment />);
    const trigger = screen.getByRole('button', { name: /help: workload type/i });
    await user.hover(trigger);
    const tooltip = await screen.findByRole('tooltip');
    expect(within(tooltip).getByText(/Workload \/ command-mix preset/i)).toBeInTheDocument();
    await user.unhover(trigger);
  });

  it('Server Deployment: minimum data rate help opens on hover', async () => {
    const user = userEvent.setup();
    render(<ServerDeployment />);
    const trigger = screen.getByRole('button', { name: /help: minimum data rate/i });
    await user.hover(trigger);
    const tooltip = await screen.findByRole('tooltip');
    expect(within(tooltip).getByText(/Minimum effective data rate \(MT\/s\)/i)).toBeInTheDocument();
  });

  it('Target Power: optimizer profile help opens on hover', async () => {
    const user = userEvent.setup();
    render(<TargetPower />);
    const trigger = screen.getByRole('button', { name: /help: optimizer profile/i });
    await user.hover(trigger);
    const tooltip = await screen.findByRole('tooltip');
    expect(within(tooltip).getByText(/Controls how the search penalizes/i)).toBeInTheDocument();
  });

  it('Header: sources info tooltip opens on hover', async () => {
    const user = userEvent.setup();
    render(<Header />);
    const trigger = screen.getByRole('link', { name: /view sources/i });
    await user.hover(trigger);
    const tooltip = await screen.findByRole('tooltip');
    expect(
      within(tooltip).getByText(/DDR5 power calculator based on JEDEC specifications/i),
    ).toBeInTheDocument();
  });
});
