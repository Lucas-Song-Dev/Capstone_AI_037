/**
 * Next.js Testing Utilities
 * 
 * Helper functions for testing Next.js App Router components
 * Based on Next.js testing best practices
 */

import { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { ConfigProvider } from '@/contexts/ConfigContext';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ThemeProvider } from '@/components/theme-provider';

/**
 * Custom render function that includes Next.js providers
 * Use this instead of the default render from @testing-library/react
 */
function AllTheProviders({ children }: { children: React.ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider delayDuration={0} skipDelayDuration={0}>
          <ConfigProvider>
            {children}
          </ConfigProvider>
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

const customRender = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>,
) => render(ui, { wrapper: AllTheProviders, ...options });

// Re-export everything from @testing-library/react
export * from '@testing-library/react';

// Override render method
export { customRender as render };

