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
    <header className="border-b border-border/60 bg-card/80 backdrop-blur-sm px-6 py-3 sticky top-0 z-50">
      <div className="flex items-center gap-6">
        <div
          className="flex items-center gap-3 cursor-pointer group"
          onClick={onLogoClick}
        >
          <div className="relative flex h-9 w-9 items-center justify-center rounded-lg bg-primary shadow-md shadow-primary/20 transition-transform duration-200 group-hover:scale-105">
            <span className="text-sm font-semibold text-primary-foreground tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>DF</span>
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold tracking-tight leading-none" style={{ fontFamily: 'var(--font-display)' }}>DossierFlow</span>
            <span className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-medium leading-none mt-0.5">AI Platform</span>
          </div>
        </div>

        <div className="relative flex-1 max-w-xl">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
          <Input
            type="search"
            placeholder="Search programs, sections, documents..."
            className="pl-10 bg-background/60 border-border/50 h-9 text-sm placeholder:text-muted-foreground/50 focus:bg-background focus:border-primary/30 transition-colors"
          />
        </div>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="relative h-9 w-9 rounded-lg hover:bg-accent/60">
            <Bell className="h-4 w-4 text-muted-foreground" />
            <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-destructive ring-2 ring-card" />
          </Button>

          <div className="w-px h-5 bg-border/60 mx-1" />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="gap-2 h-9 px-3 rounded-lg hover:bg-accent/60">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <User className="h-3.5 w-3.5" />
                </div>
                <span className="text-sm">John Doe</span>
                <ChevronDown className="h-3 w-3 text-muted-foreground" />
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
