'use client';

import { Toaster } from '@/components/ui/toaster';
import { Toaster as Sonner } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ThemeProvider } from '@/components/theme-provider';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ConfigProvider } from '@/contexts/ConfigContext';
import { useState } from 'react';

export default function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} storageKey="ddr5-theme">
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <ConfigProvider>
            {children}
            <Toaster />
            <Sonner />
          </ConfigProvider>
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

