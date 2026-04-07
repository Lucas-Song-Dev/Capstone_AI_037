'use client';

import Link from 'next/link';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/button';
import { useConfig } from '@/contexts/ConfigContext';
import { useDDR5Power } from '@/hooks/useDDR5Power';
import { PowerBreakdownChart, PowerDistributionChart } from '@/components/PowerChart';
import { PosterDimmSummaryCard } from '@/components/PosterDimmSummaryCard';

/**
 * TEMP_POSTER_SUMMARY_PAGE — one-screen dashboard for poster screenshots (3 panels).
 * Remove: this file, PosterDimmSummaryCard.tsx, and the TEMP_POSTER_ENTRY block in Header.tsx
 */
export default function PosterSummaryPage() {
  const { memspec, workload } = useConfig();
  const { powerResult, dimmPowerResult, isCalculating, error } = useDDR5Power(memspec, workload);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1 flex flex-col">
        <div className="border-b border-border bg-muted/30 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <Button variant="ghost" size="sm" asChild className="-ml-2">
              <Link href="/configuration">
                <ArrowLeft className="w-4 h-4 mr-1.5" />
                Back
              </Link>
            </Button>
          </div>
          <div className="text-center flex-1 min-w-[200px]">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">DDR5 power — summary dashboard</h1>
            <p className="text-xs sm:text-sm text-muted-foreground font-mono truncate max-w-2xl mx-auto">
              {memspec.memoryId} · {memspec.memoryType}
            </p>
          </div>
          <div className="w-[72px] shrink-0 hidden sm:block" aria-hidden />
        </div>

        {isCalculating && (
          <div className="flex items-center justify-center gap-2 py-2 text-sm text-muted-foreground border-b border-border/60">
            <Loader2 className="w-4 h-4 animate-spin" />
            Updating…
          </div>
        )}

        {error ? (
          <p className="text-center text-destructive text-sm py-4 px-4">{error.message}</p>
        ) : null}

        <div className="flex-1 p-4 sm:p-6">
          <div className="max-w-[1600px] mx-auto grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-5 items-stretch poster-summary-grid">
            <div className="min-h-[280px] flex flex-col [&_.power-card]:h-full [&_.power-card]:flex [&_.power-card]:flex-col [&_.power-card]:border-2 [&_.power-card]:shadow-lg">
              <PowerBreakdownChart powerResult={powerResult} />
            </div>
            <div className="min-h-[280px] flex flex-col [&_.power-card]:h-full [&_.power-card]:flex [&_.power-card]:flex-col [&_.power-card]:border-2 [&_.power-card]:shadow-lg">
              <PowerDistributionChart powerResult={powerResult} />
            </div>
            <div className="min-h-[280px] flex flex-col">
              <PosterDimmSummaryCard dimmPower={dimmPowerResult} />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
