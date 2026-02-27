import { Search, Bell, User, ChevronDown } from 'lucide-react';
import { Input } from './ui/input';
import { Button } from './ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';

interface HeaderProps {
  onLogoClick?: () => void;
}

export function Header({ onLogoClick }: HeaderProps) {
  return (
    <header className="border-b border-[rgba(31,26,20,0.06)] bg-card/70 backdrop-blur-md px-6 py-2.5 sticky top-0 z-50">
      <div className="flex items-center gap-5">
        <div
          className="flex items-center gap-3 cursor-pointer group shrink-0"
          onClick={onLogoClick}
        >
          <div className="relative">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary transition-transform duration-200 group-hover:scale-105" style={{ boxShadow: '0 2px 8px rgba(31,59,52,0.25)' }}>
              <span className="text-[11px] font-bold text-primary-foreground tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>DF</span>
            </div>
          </div>
          <div className="flex flex-col leading-none">
            <span className="text-[13px] font-bold tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>DossierFlow</span>
            <span className="text-[9px] uppercase tracking-[0.2em] text-primary/50 font-semibold mt-px" style={{ fontFamily: 'var(--font-mono)' }}>Regulatory AI</span>
          </div>
        </div>

        <div className="h-5 w-px bg-border/50" />

        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/40" />
          <Input
            type="search"
            placeholder="Search programs and documents..."
            className="pl-9 h-8 text-[13px] bg-background/40 border-border/40 rounded-lg placeholder:text-muted-foreground/35 focus:bg-background focus:border-primary/20 transition-all"
          />
        </div>

        <div className="flex items-center gap-1.5 ml-auto">
          <Button variant="ghost" size="icon" className="relative h-8 w-8 rounded-lg hover:bg-accent/50">
            <Bell className="h-4 w-4 text-muted-foreground/70" />
            <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-destructive ring-2 ring-card" />
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="gap-2 h-8 px-2.5 rounded-lg hover:bg-accent/50">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 ring-1 ring-primary/10">
                  <User className="h-3 w-3 text-primary/70" />
                </div>
                <span className="text-[13px] font-medium">John Doe</span>
                <ChevronDown className="h-3 w-3 text-muted-foreground/50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel className="text-xs text-muted-foreground">My Account</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem>Profile</DropdownMenuItem>
              <DropdownMenuItem>Settings</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem>Log out</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
