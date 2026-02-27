import { MoreVertical, FileText, Clock, ChevronRight } from 'lucide-react';
import { Button } from './ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { Program } from '../data/mockData';

interface ProgramCardProps {
  program: Program;
  onClick: () => void;
}

const statusThemes: Record<string, {
  accent: string;
  accentMuted: string;
  badge: string;
  badgeText: string;
  ring: string;
  progressTrail: string;
  progressFill: string;
  iconBg: string;
}> = {
  'In Progress': {
    accent: '#a67c32',
    accentMuted: 'rgba(166,124,50,0.08)',
    badge: 'bg-amber-50 border-amber-200/80',
    badgeText: 'text-amber-800',
    ring: 'rgba(166,124,50,0.18)',
    progressTrail: 'rgba(166,124,50,0.10)',
    progressFill: 'linear-gradient(90deg, #c9a24d, #a67c32)',
    iconBg: 'rgba(166,124,50,0.09)',
  },
  'Under Review': {
    accent: '#3b6ea0',
    accentMuted: 'rgba(59,110,160,0.07)',
    badge: 'bg-sky-50 border-sky-200/80',
    badgeText: 'text-sky-800',
    ring: 'rgba(59,110,160,0.16)',
    progressTrail: 'rgba(59,110,160,0.10)',
    progressFill: 'linear-gradient(90deg, #5b9bd5, #3b6ea0)',
    iconBg: 'rgba(59,110,160,0.09)',
  },
  'Submitted': {
    accent: '#2d7250',
    accentMuted: 'rgba(45,114,80,0.07)',
    badge: 'bg-emerald-50 border-emerald-200/80',
    badgeText: 'text-emerald-800',
    ring: 'rgba(45,114,80,0.16)',
    progressTrail: 'rgba(45,114,80,0.10)',
    progressFill: 'linear-gradient(90deg, #4aa87a, #2d7250)',
    iconBg: 'rgba(45,114,80,0.09)',
  },
};

function ProgressRing({ value, size = 44, strokeWidth = 3.5, accent }: { value: number; size?: number; strokeWidth?: number; accent: string }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(31,26,20,0.06)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={accent}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      <span
        className="absolute inset-0 flex items-center justify-center text-[11px] font-bold tabular-nums"
        style={{ fontFamily: 'var(--font-mono)', color: accent }}
      >
        {value}
      </span>
    </div>
  );
}

export function ProgramCard({ program, onClick }: ProgramCardProps) {
  const theme = statusThemes[program.status] ?? statusThemes['In Progress'];
  const documentCount = program.sectionCount ?? program.documentCount ?? 0;
  const lastUpdated = program.lastUpdated ?? 'Just now';
  const updatedByLabel = program.lastUpdatedBy ?? 'System';

  return (
    <div
      className="group relative cursor-pointer"
      onClick={onClick}
    >
      <div
        className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"
        style={{
          background: `radial-gradient(ellipse at 50% 0%, ${theme.accentMuted}, transparent 70%)`,
        }}
      />

      <div
        className="relative rounded-2xl border border-[rgba(31,26,20,0.08)] bg-card overflow-hidden transition-all duration-300 group-hover:border-[rgba(31,26,20,0.15)] group-hover:shadow-[0_8px_40px_-12px_rgba(31,26,20,0.15),0_2px_8px_-2px_rgba(31,26,20,0.06)] group-hover:translate-y-[-2px]"
        style={{
          boxShadow: '0 1px 3px rgba(31,26,20,0.04), 0 4px 16px -8px rgba(31,26,20,0.06)',
        }}
      >
        <div
          className="h-1 w-full"
          style={{ background: theme.progressFill, opacity: 0.7 }}
        />

        <div className="p-5 pb-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <h3
                className="text-[15px] font-semibold leading-snug truncate mb-2 group-hover:text-primary transition-colors"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                {program.title}
              </h3>
              <div
                className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded-full border ${theme.badge} ${theme.badgeText}`}
              >
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: theme.accent }}
                />
                {program.status}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <ProgressRing value={program.progress} accent={theme.accent} />
              <DropdownMenu>
                <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                  <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg opacity-0 group-hover:opacity-70 hover:!opacity-100 transition-opacity">
                    <MoreVertical className="h-3.5 w-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem>Settings</DropdownMenuItem>
                  <DropdownMenuItem>Archive</DropdownMenuItem>
                  <DropdownMenuItem className="text-destructive">Delete</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>

        <div className="px-5 pb-4">
          <div className="flex items-center justify-between text-[12px] text-muted-foreground">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <div className="flex h-5 w-5 items-center justify-center rounded-md" style={{ backgroundColor: theme.iconBg }}>
                  <FileText className="h-3 w-3" style={{ color: theme.accent }} />
                </div>
                <span className="tabular-nums font-medium" style={{ fontFamily: 'var(--font-mono)', fontSize: '11px' }}>{documentCount}</span>
                <span>sections</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 opacity-50" />
                <span className="truncate max-w-[140px]">{lastUpdated}</span>
              </div>
            </div>
          </div>
        </div>

        <div
          className="flex items-center justify-between px-5 py-2.5 border-t transition-colors"
          style={{ borderColor: 'rgba(31,26,20,0.05)', backgroundColor: theme.accentMuted }}
        >
          <span className="text-[11px] text-muted-foreground">
            by <span className="font-medium text-foreground/70">{updatedByLabel}</span>
          </span>
          <div className="flex items-center gap-1 text-[11px] font-medium opacity-0 group-hover:opacity-100 transition-all duration-300 translate-x-[-4px] group-hover:translate-x-0" style={{ color: theme.accent }}>
            Open
            <ChevronRight className="h-3 w-3" />
          </div>
        </div>
      </div>
    </div>
  );
}
