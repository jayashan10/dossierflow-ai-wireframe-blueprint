import { Plus, LayoutGrid } from 'lucide-react';
import { Button } from './ui/button';
import { ProgramCard } from './ProgramCard';
import type { Program } from '../data/mockData';

interface DashboardProps {
  onProgramClick: (programId: string) => void;
  onCreateNew: () => void;
  programs: Program[];
}

export function Dashboard({ onProgramClick, onCreateNew, programs }: DashboardProps) {
  return (
    <div className="p-8 dashboard-grid min-h-full">
      <div className="flex items-end justify-between mb-8 animate-fade-in">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/8 border border-primary/10">
            <LayoutGrid className="h-5 w-5 text-primary/70" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>Programs</h1>
            <p className="text-sm text-muted-foreground mt-0.5">{programs.length} active programs</p>
          </div>
        </div>
        <Button className="gap-2 shadow-md shadow-primary/15 hover:shadow-lg hover:shadow-primary/20 transition-shadow" onClick={onCreateNew}>
          <Plus className="h-4 w-4" />
          Create New Program
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-5">
        {programs.map((program, index) => (
          <div key={program.id} className={`animate-fade-in-up stagger-${Math.min(index + 1, 9)}`}>
            <ProgramCard
              program={program}
              onClick={() => onProgramClick(program.id)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
