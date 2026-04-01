/**
 * Test for Header component with Next.js navigation
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '../../tests/unit/next-test-utils';
import userEvent from '@testing-library/user-event';
import { Header } from './Header';
import { ONBOARDING_CONFIGURATION_KEY } from '@/lib/onboarding-storage';

// Mock next/navigation
const mockPush = vi.fn();
const mockPathname = '/';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
  usePathname: () => mockPathname,
}));

describe('Header', () => {
  it('locks core and dimm links until configuration tutorial complete', () => {
    localStorage.removeItem(ONBOARDING_CONFIGURATION_KEY);
    render(<Header />);
    expect(screen.queryByRole('link', { name: /core power/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /dimm power/i })).not.toBeInTheDocument();
    expect(screen.getByTestId('locked-nav-/core-power')).toBeInTheDocument();
  });

  it('shows lock tooltip on hover before configuration complete', async () => {
    const user = userEvent.setup();
    localStorage.removeItem(ONBOARDING_CONFIGURATION_KEY);
    render(<Header />);
    await user.hover(screen.getByTestId('locked-nav-/core-power'));
    const tooltip = await screen.findByRole('tooltip');
    expect(within(tooltip).getByText(/please select a configuration/i)).toBeInTheDocument();
  });

  it('should render the logo and title', () => {
    localStorage.setItem(ONBOARDING_CONFIGURATION_KEY, '1');
    render(<Header />);
    
    // Text is split across elements, so check for parts separately
    expect(screen.getByText('DDR5')).toBeInTheDocument();
    expect(screen.getByText('Power Calculator')).toBeInTheDocument();
    expect(screen.getByText(/JEDEC-compliant power modeling/i)).toBeInTheDocument();
  });

  it('should render navigation links', () => {
    localStorage.setItem(ONBOARDING_CONFIGURATION_KEY, '1');
    render(<Header />);
    
    expect(screen.getByRole('link', { name: /configuration/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /core power/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /dimm power/i })).toBeInTheDocument();
  });

  it('should have correct hrefs for navigation links', () => {
    localStorage.setItem(ONBOARDING_CONFIGURATION_KEY, '1');
    render(<Header />);
    
    const configLink = screen.getByRole('link', { name: /configuration/i });
    expect(configLink).toHaveAttribute('href', '/configuration');
    
    const corePowerLink = screen.getByRole('link', { name: /core power/i });
    expect(corePowerLink).toHaveAttribute('href', '/core-power');
  });
});

