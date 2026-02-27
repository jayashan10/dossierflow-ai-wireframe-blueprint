import { MoreVertical, FileText, Clock, ArrowUpRight } from 'lucide-react';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
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

const statusConfig: Record<string, { color: string; bg: string; border: string; dot: string }> = {
  'In Progress': { color: 'text-amber-800', bg: 'bg-amber-50', border: 'border-amber-200', dot: 'bg-amber-500' },
  'Under Review': { color: 'text-blue-800', bg: 'bg-blue-50', border: 'border-blue-200', dot: 'bg-blue-500' },
  'Submitted': { color: 'text-emerald-800', bg: 'bg-emerald-50', border: 'border-emerald-200', dot: 'bg-emerald-500' },
};

export function ProgramCard({ program, onClick }: ProgramCardProps) {
  const status = statusConfig[program.status] ?? statusConfig['In Progress'];
  const documentCount = program.sectionCount ?? program.documentCount ?? 0;
  const lastUpdated = program.lastUpdated ?? 'Just now';
  const updatedByLabel = program.lastUpdatedBy ?? 'System';
  const progressPct = program.progress;

  return (
    <Card
      className="group relative overflow-hidden border-border/60 hover:border-border hover:shadow-xl hover:shadow-primary/5 transition-all duration-300 cursor-pointer"
      onClick={onClick}
    >
      <div
        className="absolute left-0 top-0 bottom-0 w-1 transition-all duration-300 group-hover:w-1.5"
        style={{ backgroundColor: `var(--status-${program.status === 'In Progress' ? 'in-progress' : program.status === 'Under Review' ? 'review' : 'submitted'})` }}
      />

      <div className="p-5 pl-5">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <h3 className="text-base font-semibold truncate leading-tight" style={{ fontFamily: 'var(--font-display)' }}>
                {program.title}
              </h3>
              <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground/0 group-hover:text-muted-foreground/60 transition-all duration-300 flex-shrink-0" />
            </div>
            <Badge
              variant="outline"
              className={`${status.bg} ${status.color} ${status.border} text-[11px] font-medium px-2 py-0 h-5`}
            >
              <span className={`inline-block h-1.5 w-1.5 rounded-full mr-1.5 ${status.dot}`} />
              {program.status}
            </Badge>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>Settings</DropdownMenuItem>
              <DropdownMenuItem>Archive</DropdownMenuItem>
              <DropdownMenuItem className="text-destructive">Delete</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="mb-3">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Progress</span>
            <span className="text-xs font-semibold tabular-nums" style={{ fontFamily: 'var(--font-mono)', fontSize: '11px' }}>{progressPct}%</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-muted/80 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700 ease-out"
              style={{
                width: `${progressPct}%`,
                background: progressPct === 100
                  ? 'linear-gradient(90deg, #2d7250, #3a9b6a)'
                  : progressPct >= 50
                  ? 'linear-gradient(90deg, #1f3b34, #2a5a4e)'
                  : 'linear-gradient(90deg, #a67c32, #c49b4a)'
              }}
            />
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs text-muted-foreground pt-1 border-t border-border/40">
          <div className="flex items-center gap-1.5">
            <FileText className="h-3.5 w-3.5" />
            <span className="tabular-nums">{documentCount}</span>
            <span>Sections</span>
          </div>
          <span className="text-border">|</span>
          <div className="flex items-center gap-1.5 truncate">
            <Clock className="h-3.5 w-3.5 flex-shrink-0" />
            <span className="truncate">{lastUpdated} by {updatedByLabel}</span>
          </div>
        </div>
      </div>
    </Card>
  );
}
