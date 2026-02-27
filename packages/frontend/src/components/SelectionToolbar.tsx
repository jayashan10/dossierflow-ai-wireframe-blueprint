import { useState, useRef, useCallback } from 'react';
import { BubbleMenu, type Editor } from '@tiptap/react';
import {
  Sparkles,
  ArrowUpRight,
  Minimize2,
  BookOpen,
  RefreshCw,
  Scissors,
  GraduationCap,
  Loader2,
  Pencil,
  X
} from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { streamRefineSelection, type RefineAction } from '../lib/api';

interface SelectionToolbarProps {
  editor: Editor;
  sectionTitle?: string;
  disabled?: boolean;
}

const ACTIONS: Array<{
  id: RefineAction;
  label: string;
  icon: typeof Sparkles;
  description: string;
}> = [
  { id: 'improve', label: 'Improve', icon: Sparkles, description: 'Enhance clarity and quality' },
  { id: 'expand', label: 'Expand', icon: ArrowUpRight, description: 'Add more detail' },
  { id: 'make_concise', label: 'Concise', icon: Scissors, description: 'Shorten and tighten' },
  { id: 'simplify', label: 'Simplify', icon: Minimize2, description: 'Make clearer' },
  { id: 'add_references', label: 'References', icon: BookOpen, description: 'Add citation placeholders' },
  { id: 'formal_tone', label: 'Formal', icon: GraduationCap, description: 'Regulatory tone' },
  { id: 'rewrite', label: 'Rewrite', icon: RefreshCw, description: 'Fresh approach' },
];

export function SelectionToolbar({ editor, sectionTitle, disabled }: SelectionToolbarProps) {
  const [isRefining, setIsRefining] = useState(false);
  const [showCustom, setShowCustom] = useState(false);
  const [customInstruction, setCustomInstruction] = useState('');
  const cancelRef = useRef<(() => void) | null>(null);

  const handleAction = useCallback((action: RefineAction, instruction?: string) => {
    const { from, to } = editor.state.selection;
    const selectedText = editor.state.doc.textBetween(from, to, ' ');

    if (!selectedText.trim()) return;

    const fullDoc = editor.state.doc.textContent;
    const contextStart = Math.max(0, from - 500);
    const contextEnd = Math.min(fullDoc.length, to + 500);
    const surroundingContext = fullDoc.slice(contextStart, contextEnd);

    setIsRefining(true);
    setShowCustom(false);

    const cancel = streamRefineSelection(
      {
        selectedText,
        action,
        customInstruction: instruction,
        sectionTitle,
        surroundingContext
      },
      {
        onText: () => {},
        onComplete: (fullText) => {
          if (fullText.trim()) {
            editor
              .chain()
              .focus()
              .deleteRange({ from, to })
              .insertContentAt(from, fullText)
              .run();
          }
          setIsRefining(false);
          cancelRef.current = null;
        },
        onError: (error) => {
          console.error('Refine error:', error);
          setIsRefining(false);
          cancelRef.current = null;
        }
      }
    );

    cancelRef.current = cancel;
  }, [editor, sectionTitle]);

  const handleCancel = useCallback(() => {
    if (cancelRef.current) {
      cancelRef.current();
      cancelRef.current = null;
    }
    setIsRefining(false);
    setShowCustom(false);
  }, []);

  const handleCustomSubmit = useCallback(() => {
    if (customInstruction.trim()) {
      handleAction('custom', customInstruction.trim());
      setCustomInstruction('');
    }
  }, [customInstruction, handleAction]);

  if (disabled) return null;

  return (
    <BubbleMenu
      editor={editor}
      tippyOptions={{
        duration: 150,
        placement: 'top',
        maxWidth: 'none',
      }}
      shouldShow={({ editor: e, state }) => {
        const { from, to } = state.selection;
        const text = state.doc.textBetween(from, to, ' ');
        return !e.isActive('codeBlock') && text.trim().length > 3 && !isRefining;
      }}
    >
      <div
        className="flex items-center gap-0.5 rounded-xl border border-[rgba(31,26,20,0.15)] bg-card px-1 py-0.5"
        style={{
          boxShadow: '0 4px 24px -4px rgba(31,26,20,0.18), 0 2px 6px -1px rgba(31,26,20,0.08)',
          fontFamily: 'var(--font-body)',
        }}
      >
        {isRefining ? (
          <div className="flex items-center gap-2 px-3 py-1.5">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
            <span className="text-xs font-medium text-muted-foreground">Refining...</span>
            <button onClick={handleCancel} className="ml-1 hover:text-destructive">
              <X className="h-3 w-3" />
            </button>
          </div>
        ) : showCustom ? (
          <div className="flex items-center gap-1.5 px-1 py-0.5">
            <Input
              value={customInstruction}
              onChange={(e) => setCustomInstruction(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCustomSubmit();
                if (e.key === 'Escape') { setShowCustom(false); setCustomInstruction(''); }
              }}
              placeholder="Custom instruction..."
              className="h-7 w-56 text-xs border-border/50 bg-background/50"
              autoFocus
            />
            <Button size="sm" className="h-7 px-2 text-xs" onClick={handleCustomSubmit} disabled={!customInstruction.trim()}>
              Apply
            </Button>
            <button onClick={() => { setShowCustom(false); setCustomInstruction(''); }} className="p-1 hover:text-destructive">
              <X className="h-3 w-3" />
            </button>
          </div>
        ) : (
          <>
            {ACTIONS.map((action) => (
              <button
                key={action.id}
                onClick={() => handleAction(action.id)}
                className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent/60 transition-colors"
                title={action.description}
              >
                <action.icon className="h-3 w-3" />
                <span>{action.label}</span>
              </button>
            ))}
            <div className="w-px h-4 bg-border/50 mx-0.5" />
            <button
              onClick={() => setShowCustom(true)}
              className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-primary/70 hover:text-primary hover:bg-primary/5 transition-colors"
              title="Custom instruction"
            >
              <Pencil className="h-3 w-3" />
            </button>
          </>
        )}
      </div>
    </BubbleMenu>
  );
}
