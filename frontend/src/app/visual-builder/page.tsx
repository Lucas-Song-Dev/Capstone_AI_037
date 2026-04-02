'use client';

import { Header } from '@/components/Header';
import { VisualBuilderContent } from '@/components/VisualBuilderContent';
import { DescriptionWithTooltip } from '@/components/DescriptionTooltip';
import { Box } from 'lucide-react';

const VISUAL_BUILDER_INTRO =
  'Configure one DDR5 DIMM: set Banks, Bank groups, Ranks, Width, Burst length, Columns, and devices. The board shows your single DIMM (position doesn’t matter). Core and DIMM power update live.';

export default function VisualBuilderPage() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-6">
        <div className="flex flex-col gap-4 mb-6">
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Box className="w-6 h-6 text-primary" />
            Visual DIMM Builder
          </h1>
          <DescriptionWithTooltip variant="plain" label="About the builder" text={VISUAL_BUILDER_INTRO} />
        </div>
        <VisualBuilderContent />
      </main>
    </div>
  );
}
