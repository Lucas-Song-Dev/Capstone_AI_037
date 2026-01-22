import { MemoryStick, Github, Info, Settings, Zap, MemoryStick as DIMMIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useNavigate, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';

export function Header() {
  const navigate = useNavigate();
  const location = useLocation();

  const navItems = [
    { path: '/configuration', label: 'Configuration', icon: Settings },
    { path: '/core-power', label: 'Core Power', icon: Zap },
    { path: '/dimm-power', label: 'DIMM Power', icon: DIMMIcon },
  ];

  return (
    <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
      <div className="container mx-auto px-4">
        <div className="h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
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
          </div>

          <div className="flex items-center gap-2">
            {/* Navigation */}
            <nav className="hidden md:flex items-center gap-1 mr-4">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;
                return (
                  <Button
                    key={item.path}
                    variant={isActive ? 'secondary' : 'ghost'}
                    size="sm"
                    onClick={() => navigate(item.path)}
                    className={cn(
                      'h-8 px-3 text-xs',
                      isActive && 'bg-primary/10 text-primary'
                    )}
                  >
                    <Icon className="w-3.5 h-3.5 mr-1.5" />
                    {item.label}
                  </Button>
                );
              })}
            </nav>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <Info className="w-4 h-4" />
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
                href="https://github.com" 
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
