import { Plus } from 'lucide-react';
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
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <h1>Programs</h1>
        <Button className="gap-2" onClick={onCreateNew}>
          <Plus className="h-4 w-4" />
          Create New Program
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {programs.map((program) => (
          <ProgramCard
            key={program.id}
            program={program}
            onClick={() => onProgramClick(program.id)}
          />
        ))}
      </div>
    </div>
  );
}
