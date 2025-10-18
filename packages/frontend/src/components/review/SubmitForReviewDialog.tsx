import { useState } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { Checkbox } from '../ui/checkbox';
import { Textarea } from '../ui/textarea';
import { reviewers } from '../../data/mockData';

interface SubmitForReviewDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (payload: { reviewers: string[]; note?: string }) => void;
  defaultSelected?: string[];
}

export function SubmitForReviewDialog({ open, onClose, onSubmit, defaultSelected = [] }: SubmitForReviewDialogProps) {
  const [selectedReviewers, setSelectedReviewers] = useState<Set<string>>(new Set(defaultSelected));
  const [note, setNote] = useState('');

  const toggleReviewer = (id: string, checked: boolean | string) => {
    const next = new Set(selectedReviewers);
    if (checked) {
      next.add(id);
    } else {
      next.delete(id);
    }
    setSelectedReviewers(next);
  };

  const handleSubmit = () => {
    onSubmit({ reviewers: Array.from(selectedReviewers), note: note.trim() || undefined });
    setNote('');
    setSelectedReviewers(new Set(defaultSelected));
  };

  return (
    <Dialog open={open} onOpenChange={(value) => !value && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Submit for Review</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <p className="text-sm font-medium mb-2">Select Reviewer(s)</p>
            <div className="space-y-2">
              {reviewers.filter((reviewer) => reviewer.id !== 'mark').map((reviewer) => (
                <label key={reviewer.id} className="flex items-center gap-3 text-sm">
                  <Checkbox
                    checked={selectedReviewers.has(reviewer.id)}
                    onCheckedChange={(checked) => toggleReviewer(reviewer.id, checked)}
                  />
                  <span>
                    {reviewer.name}
                    <span className="text-muted-foreground ml-2">({reviewer.role})</span>
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <p className="text-sm font-medium mb-2">Add a note (optional)</p>
            <Textarea
              placeholder="Regina, please check the tables in section 2.6.2.2."
              value={note}
              onChange={(event) => setNote(event.target.value)}
              className="min-h-[120px]"
            />
          </div>
        </div>

        <DialogFooter className="justify-between">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={selectedReviewers.size === 0}>
            Submit
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
