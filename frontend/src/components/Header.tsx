'use client';

import { useEffect, useState } from 'react';
import { MemoryStick, Github, Info, Settings, Zap, MemoryStick as DIMMIcon, Target, Server } from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import { LinkIconTooltip } from '@/components/HelpTooltip';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ONBOARDING_CONFIGURATION_KEY, isOnboardingComplete } from '@/lib/onboarding-storage';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

export function Header() {
  const pathname = usePathname();
  const [isConfigurationUnlocked, setIsConfigurationUnlocked] = useState(() =>
    isOnboardingComplete(ONBOARDING_CONFIGURATION_KEY)
  );

  useEffect(() => {
    const sync = () => setIsConfigurationUnlocked(isOnboardingComplete(ONBOARDING_CONFIGURATION_KEY));
    sync();
    window.addEventListener('storage', sync);
    window.addEventListener('ddr5:onboarding-updated', sync as EventListener);
    window.addEventListener('focus', sync);
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener('ddr5:onboarding-updated', sync as EventListener);
      window.removeEventListener('focus', sync);
    };
  }, []);

  useEffect(() => {
    setIsConfigurationUnlocked(isOnboardingComplete(ONBOARDING_CONFIGURATION_KEY));
  }, [pathname]);

  const designConfigGroup = [
    { path: '/target-power', label: 'Inverse Design', icon: Target },
    { path: '/server-deployment', label: 'Deployment Planning', icon: Server },
    { path: '/configuration', label: 'Configuration', icon: Settings },
  ];
  const powerGroup = [
    { path: '/core-power', label: 'Core Power', icon: Zap },
    { path: '/dimm-power', label: 'DIMM Power', icon: DIMMIcon },
  ];

  const NavButton = ({
    item,
    locked = false,
  }: {
    item: { path: string; label: string; icon: typeof Settings };
    locked?: boolean;
  }) => {
    const Icon = item.icon;
    const isActive = pathname === item.path;
    const isConfigurationTab = item.path === '/configuration';
    if (locked) {
      return (
        <Tooltip delayDuration={120}>
          <TooltipTrigger asChild>
            <div
              aria-disabled="true"
              data-testid={`locked-nav-${item.path}`}
              className="inline-flex h-8 px-3 text-xs items-center justify-center gap-2 whitespace-nowrap rounded-md opacity-45 cursor-help"
            >
              <Icon className="w-3.5 h-3.5 mr-1.5" />
              {item.label}
            </div>
          </TooltipTrigger>
          <TooltipContent
            side="bottom"
            className="max-w-xs bg-muted text-muted-foreground border border-border shadow-sm"
          >
            <p className="text-sm">Please select a configuration.</p>
          </TooltipContent>
        </Tooltip>
      );
    }
    return (
      <Button
        variant={isConfigurationTab ? 'outline' : isActive ? 'secondary' : 'ghost'}
        size="sm"
        asChild
        className={cn(
          'h-8 px-3 text-xs',
          isConfigurationTab
            ? 'border-white/90 text-white hover:bg-white/10 hover:text-white'
            : isActive && 'bg-primary/10 text-primary'
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
            <nav className="hidden md:flex items-center gap-1 mr-4">
              <div className="flex items-center gap-1">
                {designConfigGroup.map((item) => (
                  <NavButton key={item.path} item={item} />
                ))}
              </div>
              <div className="h-5 w-px bg-border mx-2" aria-hidden />
              <div className="flex items-center gap-1">
                {powerGroup.map((item) => (
                  <NavButton key={item.path} item={item} locked={!isConfigurationUnlocked} />
                ))}
              </div>
            </nav>

            <LinkIconTooltip
              href="/sources"
              label="View Sources"
              side="bottom"
              icon={<Info className="w-4 h-4" />}
            >
              <p className="text-sm">
                DDR5 power calculator based on JEDEC specifications.
                Supports IDD/IPP current measurements and workload modeling.
              </p>
            </LinkIconTooltip>

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
  );
}
