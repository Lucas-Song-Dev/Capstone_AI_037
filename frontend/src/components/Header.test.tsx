/**
 * Test for Header component with Next.js navigation
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '../../tests/unit/next-test-utils';
import { Header } from './Header';

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
  it('should render the logo and title', () => {
    render(<Header />);
    
    // Text is split across elements, so check for parts separately
    expect(screen.getByText('DDR5')).toBeInTheDocument();
    expect(screen.getByText('Power Calculator')).toBeInTheDocument();
    expect(screen.getByText(/JEDEC-compliant power modeling/i)).toBeInTheDocument();
  });

  it('should render navigation links', () => {
    render(<Header />);
    
    expect(screen.getByRole('link', { name: /configuration/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /core power/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /dimm power/i })).toBeInTheDocument();
  });

  it('should have correct hrefs for navigation links', () => {
    render(<Header />);
    
    const configLink = screen.getByRole('link', { name: /configuration/i });
    expect(configLink).toHaveAttribute('href', '/configuration');
    
    const corePowerLink = screen.getByRole('link', { name: /core power/i });
    expect(corePowerLink).toHaveAttribute('href', '/core-power');
  });
});

