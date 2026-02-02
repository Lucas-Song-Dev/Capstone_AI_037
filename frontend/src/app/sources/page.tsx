'use client';

import { Header } from '@/components/Header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ExternalLink, FileText, BookOpen } from 'lucide-react';
import Link from 'next/link';

export default function Sources() {
  const sources = [
    {
      title: 'DRAMPower 5: An Open-Source Power Simulator for Current Generation DRAM Standards',
      authors: 'Lukas Steiner, Thomas Psota, Marco Mörz, Derek Christ, Matthias Jung, Norbert Wehn',
      venue: 'RAPIDO \'25: Proceedings of the Rapid Simulation and Performance Evaluation for Design',
      year: '2025',
      pages: '8-16',
      doi: '10.1145/3721848.3721850',
      url: 'https://dl.acm.org/doi/10.1145/3721848.3721850',
      type: 'academic',
      description: 'Presents DRAMPower 5, a completely revised version of the popular DRAMPower simulator with newly developed core and interface power models to support current generation DRAM standards including DDR5, LPDDR5, and HBM3.',
    },
    {
      title: 'Low-Power (LP) Memory in the Data Center: The role of low-power memory in data center workloads',
      authors: 'Sudharshan Vazhkudai, Henrique Pötter, Khayam Anjam, Moiz Arif',
      venue: 'Micron Technology Technical Brief',
      year: '2025',
      url: 'https://assets.micron.com/adobe/assets/urn:aaid:aem:5a10a15d-ae6c-40f9-8fc2-e522e7c6749f/renditions/original/as/lp-in-data-center-technical-brief.pdf',
      type: 'technical',
      description: 'Comprehensive analysis of LPDDR5X performance in data center environments, demonstrating up to 77% lower memory power consumption and 36% higher memory bandwidth compared to DDR5.',
    },
    {
      title: 'SK hynix\'s DDR5 Key to Enabling Industry-Leading Performing Data Centers',
      authors: 'SK hynix and Intel',
      venue: 'White Paper',
      year: '2023',
      url: 'https://news.skhynix.com/white-paper-reveals-sk-hynix-ddr5-key-to-first-rate-data-centers/',
      type: 'whitepaper',
      description: 'Performance verification white paper showing SK hynix DDR5 boosts server bandwidth by 70% while lowering power consumption by 14.4% compared to DDR4 when applied to 4th Gen Intel® Xeon® Scalable processors.',
    },
  ];

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'academic':
        return <BookOpen className="w-4 h-4" />;
      case 'technical':
      case 'whitepaper':
        return <FileText className="w-4 h-4" />;
      default:
        return <FileText className="w-4 h-4" />;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'academic':
        return 'Academic Paper';
      case 'technical':
        return 'Technical Brief';
      case 'whitepaper':
        return 'White Paper';
      default:
        return 'Document';
    }
  };

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      <Header />
      <main className="flex-1 container mx-auto px-4 py-6 overflow-y-auto scrollbar-thin">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold">Sources & References</h1>
            <p className="text-muted-foreground">
              Academic papers, technical briefs, and white papers that inform the power modeling and calculations in this tool.
            </p>
          </div>

          <div className="space-y-4">
            {sources.map((source, index) => (
              <Card key={index} className="power-card">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        {getTypeIcon(source.type)}
                        <span className="text-xs text-muted-foreground">
                          {getTypeLabel(source.type)}
                        </span>
                      </div>
                      <CardTitle className="text-lg">{source.title}</CardTitle>
                      <CardDescription className="mt-2">
                        {source.authors}
                        {source.venue && (
                          <>
                            <br />
                            <span className="text-xs">
                              {source.venue}
                              {source.year && ` (${source.year})`}
                              {source.pages && `, pp. ${source.pages}`}
                            </span>
                          </>
                        )}
                        {source.doi && (
                          <>
                            <br />
                            <span className="text-xs">DOI: {source.doi}</span>
                          </>
                        )}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">{source.description}</p>
                  <div className="flex items-center gap-2">
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
                    >
                      <ExternalLink className="w-4 h-4" />
                      View Source
                    </a>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="power-card">
            <CardHeader>
              <CardTitle>Citation Format</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2 text-sm">
                <p className="font-medium">Academic Paper (APA Style):</p>
                <p className="text-muted-foreground pl-4 border-l-2 border-primary/20">
                  Steiner, L., Psota, T., Mörz, M., Christ, D., Jung, M., & Wehn, N. (2025). DRAMPower 5: An Open-Source Power Simulator for Current Generation DRAM Standards. <em>RAPIDO '25: Proceedings of the Rapid Simulation and Performance Evaluation for Design</em>, 8-16. https://doi.org/10.1145/3721848.3721850
                </p>
              </div>
              <div className="space-y-2 text-sm">
                <p className="font-medium">Technical Brief:</p>
                <p className="text-muted-foreground pl-4 border-l-2 border-primary/20">
                  Vazhkudai, S., Pötter, H., Anjam, K., & Arif, M. (2025). <em>Low-Power (LP) Memory in the Data Center: The role of low-power memory in data center workloads</em>. Micron Technology, Inc.
                </p>
              </div>
              <div className="space-y-2 text-sm">
                <p className="font-medium">White Paper:</p>
                <p className="text-muted-foreground pl-4 border-l-2 border-primary/20">
                  SK hynix & Intel. (2023). <em>SK hynix's DDR5 Key to Enabling Industry-Leading Performing Data Centers</em>. SK hynix Newsroom.
                </p>
              </div>
            </CardContent>
          </Card>

          <div className="text-center text-sm text-muted-foreground">
            <Link href="/" className="text-primary hover:underline">
              ← Back to Home
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}

