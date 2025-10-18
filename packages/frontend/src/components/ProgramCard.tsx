import { MoreVertical, FileText, Clock } from 'lucide-react';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { Progress } from './ui/progress';
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

export function ProgramCard({ program, onClick }: ProgramCardProps) {
  const statusColors = {
    'In Progress': 'bg-yellow-100 text-yellow-800 border-yellow-300',
    'Under Review': 'bg-blue-100 text-blue-800 border-blue-300',
    'Submitted': 'bg-green-100 text-green-800 border-green-300'
  };

  return (
    <Card className="p-6 hover:shadow-lg transition-shadow cursor-pointer" onClick={onClick}>
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <h3 className="mb-2">{program.title}</h3>
          <Badge variant="outline" className={statusColors[program.status]}>
            {program.status}
          </Badge>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <Button variant="ghost" size="icon">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem>Settings</DropdownMenuItem>
            <DropdownMenuItem>Archive</DropdownMenuItem>
            <DropdownMenuItem>Delete</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="space-y-3">
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-muted-foreground">Progress</span>
            <span>{program.progress}%</span>
          </div>
          <Progress value={program.progress} />
        </div>

        <div className="flex items-center gap-4 text-muted-foreground">
          <div className="flex items-center gap-1">
            <FileText className="h-4 w-4" />
            <span>{program.documentCount} Documents</span>
          </div>
          <div className="flex items-center gap-1">
            <Clock className="h-4 w-4" />
            <span>Last updated: {program.lastUpdated} by {program.lastUpdatedBy}</span>
          </div>
        </div>
      </div>
    </Card>
  );
}
