import { Plus, Folder, BarChart3, Clock3 } from 'lucide-react';
import { Button } from './ui/button';
import { ProgramCard } from './ProgramCard';
import type { Program } from '../data/mockData';
import { useMemo } from 'react';

interface DashboardProps {
  onProgramClick: (programId: string) => void;
  onCreateNew: () => void;
  programs: Program[];
}

export function Dashboard({ onProgramClick, onCreateNew, programs }: DashboardProps) {
  const stats = useMemo(() => {
    const inProgress = programs.filter(p => p.status === 'In Progress').length;
    const underReview = programs.filter(p => p.status === 'Under Review').length;
    const submitted = programs.filter(p => p.status === 'Submitted').length;
    const totalSections = programs.reduce((sum, p) => sum + (p.sectionCount ?? p.documentCount ?? 0), 0);
    return { inProgress, underReview, submitted, totalSections };
  }, [programs]);

  return (
    <div className="min-h-full relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none" style={{
        background: `
          radial-gradient(ellipse 80% 50% at 20% 0%, rgba(31,59,52,0.06), transparent),
          radial-gradient(ellipse 60% 40% at 80% 100%, rgba(166,124,50,0.04), transparent),
          radial-gradient(ellipse 50% 50% at 50% 50%, rgba(31,26,20,0.02), transparent)
        `,
      }} />

      <div className="absolute inset-0 pointer-events-none opacity-[0.03]" style={{
        backgroundImage: `
          repeating-linear-gradient(90deg, rgba(31,26,20,1) 0px, transparent 1px, transparent 80px),
          repeating-linear-gradient(0deg, rgba(31,26,20,1) 0px, transparent 1px, transparent 80px)
        `,
      }} />

      <div className="relative px-8 pt-8 pb-4">
        <div className="flex items-end justify-between mb-6 animate-fade-in">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] uppercase tracking-[0.18em] font-semibold text-muted-foreground/60" style={{ fontFamily: 'var(--font-mono)' }}>
                Workspace
              </span>
            </div>
            <h1
              className="text-3xl font-bold tracking-tight leading-none"
              style={{ fontFamily: 'var(--font-display)', letterSpacing: '-0.02em' }}
            >
              Programs
            </h1>
          </div>
          <Button
            className="gap-2 rounded-xl h-10 px-5 shadow-lg shadow-primary/10 hover:shadow-xl hover:shadow-primary/15 transition-all duration-300"
            onClick={onCreateNew}
          >
            <Plus className="h-4 w-4" />
            New Program
          </Button>
        </div>

        <div className="grid grid-cols-4 gap-3 mb-8 animate-fade-in" style={{ animationDelay: '0.05s' }}>
          {[
            { icon: Folder, label: 'Total', value: programs.length, color: 'rgba(31,59,52,0.8)' },
            { icon: BarChart3, label: 'In Progress', value: stats.inProgress, color: '#a67c32' },
            { icon: Clock3, label: 'In Review', value: stats.underReview, color: '#3b6ea0' },
            { icon: Folder, label: 'Submitted', value: stats.submitted, color: '#2d7250' },
          ].map((stat) => (
            <div
              key={stat.label}
              className="flex items-center gap-3 rounded-xl border border-[rgba(31,26,20,0.06)] bg-card/60 backdrop-blur-sm px-4 py-3 transition-colors hover:bg-card/90"
            >
              <div
                className="flex h-8 w-8 items-center justify-center rounded-lg"
                style={{ backgroundColor: `${stat.color}10` }}
              >
                <stat.icon className="h-4 w-4" style={{ color: stat.color }} />
              </div>
              <div>
                <p className="text-lg font-bold leading-none tabular-nums" style={{ fontFamily: 'var(--font-display)', color: stat.color }}>{stat.value}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">{stat.label}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="relative px-8 pb-10">
        <div className="flex items-center gap-2 mb-4 animate-fade-in" style={{ animationDelay: '0.08s' }}>
          <div className="h-px flex-1 bg-gradient-to-r from-border/60 via-border/30 to-transparent" />
          <span className="text-[10px] uppercase tracking-[0.16em] font-semibold text-muted-foreground/50 px-2" style={{ fontFamily: 'var(--font-mono)' }}>
            {programs.length} programs
          </span>
          <div className="h-px flex-1 bg-gradient-to-l from-border/60 via-border/30 to-transparent" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {programs.map((program, index) => (
            <div
              key={program.id}
              className={`animate-fade-in-up stagger-${Math.min(index + 1, 9)}`}
            >
              <ProgramCard
                program={program}
                onClick={() => onProgramClick(program.id)}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
