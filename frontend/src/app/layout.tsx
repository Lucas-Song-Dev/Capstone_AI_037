import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import Providers from './providers';
import '@/index.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'DDR5 Power Calculator | JEDEC-Compliant Memory Power Modeling',
  description: 'Professional DDR5 memory power calculator with real-time 3D visualization. Model IDD/IPP currents, workload scenarios, and power consumption for DDR5-4800 to DDR5-6400 modules.',
  keywords: 'DDR5, power calculator, memory, DRAM, JEDEC, IDD, IPP, power consumption',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className={inter.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

