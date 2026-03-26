'use client';

import { useEffect, useMemo, useState } from 'react';
import { MemoryStick, Github, Info, Settings, Zap, MemoryStick as DIMMIcon, Target, Server } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { PresentationModeHighlighter } from '@/components/PresentationModeHighlighter';
import { createPortal } from 'react-dom';

export function Header() {
  const pathname = usePathname();
  const [presentationOn, setPresentationOn] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const presentationToggle = useMemo(() => {
    if (!mounted || typeof document === 'undefined') return null;

    const z = presentationOn ? 650 : 105;
    return createPortal(
      <div
        className="fixed top-4 right-20 md:right-24 pointer-events-auto"
        style={{ zIndex: z }}
      >
        <Button
          type="button"
          size="sm"
          variant={presentationOn ? 'secondary' : 'outline'}
          className="bg-card/95 shadow-md"
          onClick={() => setPresentationOn((v) => !v)}
        >
          presentation mode
        </Button>
      </div>,
      document.body,
    );
  }, [mounted, presentationOn]);

  const designConfigGroup = [
    { path: '/target-power', label: 'Inverse Design', icon: Target },
    { path: '/server-deployment', label: 'Deployment Planning', icon: Server },
    { path: '/configuration', label: 'Configuration', icon: Settings },
  ];
  const powerGroup = [
    { path: '/core-power', label: 'Core Power', icon: Zap },
    { path: '/dimm-power', label: 'DIMM Power', icon: DIMMIcon },
  ];

  const NavButton = ({ item }: { item: { path: string; label: string; icon: typeof Settings } }) => {
    const Icon = item.icon;
    const isActive = pathname === item.path;
    return (
      <Button
        variant={isActive ? 'secondary' : 'ghost'}
        size="sm"
        asChild
        className={cn(
          'h-8 px-3 text-xs',
          isActive && 'bg-primary/10 text-primary'
        )}
      >
        <Link href={item.path}>
          <Icon className="w-3.5 h-3.5 mr-1.5" />
          {item.label}
        </Link>
      </Button>
    );
  };

  return (
    <>
      {presentationToggle}
      <PresentationModeHighlighter active={presentationOn} />
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
      <div className="container mx-auto px-4">
        <div className="h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <div className="relative">
              <MemoryStick className="w-7 h-7 text-primary" />
              <div className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-accent rounded-full animate-pulse-glow" />
            </div>
            <div>
              <h1 className="text-lg font-semibold tracking-tight">
                DDR5 <span className="gradient-text">Power Calculator</span>
              </h1>
              <p className="text-xs text-muted-foreground -mt-0.5">
                JEDEC-compliant power modeling
              </p>
            </div>
          </Link>

          <div className="flex items-center gap-2">
            {/* Navigation: Design & config | Power (Visual Builder is inside Configuration tab) */}
            <nav className="hidden md:flex items-center gap-1 mr-4">
              <div className="flex items-center gap-1">
                {designConfigGroup.map((item) => (
                  <NavButton key={item.path} item={item} />
                ))}
              </div>
              <div className="h-5 w-px bg-border mx-2" aria-hidden />
              <div className="flex items-center gap-1">
                {powerGroup.map((item) => (
                  <NavButton key={item.path} item={item} />
                ))}
              </div>
            </nav>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                  <Link href="/sources" aria-label="View Sources">
                    <Info className="w-4 h-4" />
                  </Link>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-xs">
                <p className="text-sm">
                  DDR5 power calculator based on JEDEC specifications.
                  Supports IDD/IPP current measurements and workload modeling.
                </p>
              </TooltipContent>
            </Tooltip>
            
            <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
              <a 
                href="https://github.com/Lucas-Song-Dev/Capstone_AI_037" 
                target="_blank" 
                rel="noopener noreferrer"
                aria-label="View on GitHub"
              >
                <Github className="w-4 h-4" />
              </a>
            </Button>
          </div>
        </div>
      </div>
    </header>
    </>
  );
}
