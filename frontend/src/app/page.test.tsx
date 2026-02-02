/**
 * Example test for Next.js App Router page
 * 
 * This demonstrates how to test Next.js pages and components
 * using Vitest and React Testing Library
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '../../tests/unit/next-test-utils';
import Home from './page';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
}));

describe('Home Page', () => {
  it('should render the main heading', () => {
    render(<Home />);
    
    // Text appears in both header and main content, so use getAllByText
    expect(screen.getAllByText('DDR5').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Power Calculator').length).toBeGreaterThan(0);
  });

  it('should render the get started button', () => {
    render(<Home />);
    
    const getStartedButton = screen.getByRole('button', { name: /get started/i });
    expect(getStartedButton).toBeInTheDocument();
  });

  it('should render feature cards', () => {
    render(<Home />);
    
    expect(screen.getByText(/How to Use/i)).toBeInTheDocument();
    expect(screen.getByText(/Features/i)).toBeInTheDocument();
  });

  it('should render all three steps', () => {
    render(<Home />);
    
    expect(screen.getByText(/Configure/i)).toBeInTheDocument();
    // Use getAllByText since these appear multiple times (header nav + feature cards)
    expect(screen.getAllByText(/Core Power/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/DIMM Power/i).length).toBeGreaterThan(0);
  });
});

