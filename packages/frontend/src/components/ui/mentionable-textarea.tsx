import * as React from 'react';
import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { FileText } from 'lucide-react';
import { cn } from './utils';
import type { SourceSummary } from '../../lib/api';

interface MentionableTextareaProps {
  value: string;
  onChange: (value: string) => void;
  sources: SourceSummary[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  onMentionedFilesChange?: (fileIds: string[]) => void;
}

interface MentionMatch {
  start: number;
  end: number;
  query: string;
}

function findMentionAtCursor(text: string, cursor: number): MentionMatch | null {
  // Look backwards from cursor to find @ symbol
  let start = cursor;
  while (start > 0 && text[start - 1] !== '@' && text[start - 1] !== ' ' && text[start - 1] !== '\n') {
    start--;
  }

  // Check if we found an @ symbol
  if (start > 0 && text[start - 1] === '@') {
    const query = text.slice(start, cursor);
    return { start: start - 1, end: cursor, query };
  }

  // Check if cursor is right after @
  if (start < text.length && text[start] === '@') {
    return { start, end: cursor, query: '' };
  }

  return null;
}

function extractMentions(text: string): string[] {
  // Match @filename patterns (alphanumeric, dots, dashes, underscores)
  const pattern = /@([\w\-\.]+)/g;
  const mentions: string[] = [];
  let match;
  while ((match = pattern.exec(text)) !== null) {
    mentions.push(match[1]);
  }
  return mentions;
}

export function MentionableTextarea({
  value,
  onChange,
  sources,
  placeholder,
  disabled,
  className,
  onMentionedFilesChange
}: MentionableTextareaProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [mentionMatch, setMentionMatch] = useState<MentionMatch | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });

  // Filter sources based on mention query
  const filteredSources = useMemo(() => {
    if (!mentionMatch) return [];
    const query = mentionMatch.query.toLowerCase();
    return sources.filter(s =>
      s.name.toLowerCase().includes(query)
    ).slice(0, 8); // Limit to 8 suggestions
  }, [sources, mentionMatch]);

  // Extract mentioned file IDs when value changes
  useEffect(() => {
    if (!onMentionedFilesChange) return;

    const mentions = extractMentions(value);
    const matchedIds = sources
      .filter(s => mentions.some(m =>
        s.name.toLowerCase().includes(m.toLowerCase())
      ))
      .map(s => s.id);

    onMentionedFilesChange(matchedIds);
  }, [value, sources, onMentionedFilesChange]);

  // Update dropdown position based on cursor
  const updateDropdownPosition = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    // Create a mirror element to measure cursor position
    const mirror = document.createElement('div');
    const style = window.getComputedStyle(textarea);

    mirror.style.cssText = `
      position: absolute;
      visibility: hidden;
      white-space: pre-wrap;
      word-wrap: break-word;
      overflow: hidden;
      width: ${textarea.clientWidth}px;
      font-family: ${style.fontFamily};
      font-size: ${style.fontSize};
      line-height: ${style.lineHeight};
      padding: ${style.padding};
    `;

    const textBeforeCursor = value.slice(0, textarea.selectionStart);
    mirror.textContent = textBeforeCursor;

    const span = document.createElement('span');
    span.textContent = '|';
    mirror.appendChild(span);

    document.body.appendChild(mirror);
    const rect = textarea.getBoundingClientRect();
    const spanRect = span.getBoundingClientRect();
    document.body.removeChild(mirror);

    // Calculate position relative to textarea
    const top = Math.min(
      spanRect.height + 24, // line height + padding
      textarea.clientHeight - 200 // don't go below textarea
    );
    const left = Math.min(
      spanRect.width % textarea.clientWidth,
      textarea.clientWidth - 250 // don't go off right edge
    );

    setDropdownPosition({ top, left: Math.max(0, left) });
  }, [value]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    const cursor = e.target.selectionStart;

    onChange(newValue);

    // Check for @ mention
    const match = findMentionAtCursor(newValue, cursor);
    if (match && filteredSources.length > 0) {
      setMentionMatch(match);
      setShowSuggestions(true);
      setSelectedIndex(0);
      updateDropdownPosition();
    } else {
      setShowSuggestions(false);
      setMentionMatch(null);
    }
  }, [onChange, filteredSources.length, updateDropdownPosition]);

  const insertMention = useCallback((source: SourceSummary) => {
    if (!mentionMatch) return;

    const beforeMention = value.slice(0, mentionMatch.start);
    const afterMention = value.slice(mentionMatch.end);
    const newValue = `${beforeMention}@${source.name} ${afterMention}`;

    onChange(newValue);
    setShowSuggestions(false);
    setMentionMatch(null);

    // Focus textarea and set cursor after mention
    setTimeout(() => {
      const textarea = textareaRef.current;
      if (textarea) {
        const newCursor = mentionMatch.start + source.name.length + 2; // @ + name + space
        textarea.focus();
        textarea.setSelectionRange(newCursor, newCursor);
      }
    }, 0);
  }, [mentionMatch, value, onChange]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!showSuggestions || filteredSources.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % filteredSources.length);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + filteredSources.length) % filteredSources.length);
        break;
      case 'Enter':
      case 'Tab':
        e.preventDefault();
        if (filteredSources[selectedIndex]) {
          insertMention(filteredSources[selectedIndex]);
        }
        break;
      case 'Escape':
        setShowSuggestions(false);
        setMentionMatch(null);
        break;
    }
  }, [showSuggestions, filteredSources, selectedIndex, insertMention]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        textareaRef.current &&
        !textareaRef.current.contains(e.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Re-check mention when sources change
  useEffect(() => {
    if (mentionMatch && filteredSources.length === 0) {
      setShowSuggestions(false);
    } else if (mentionMatch && filteredSources.length > 0) {
      setShowSuggestions(true);
    }
  }, [filteredSources, mentionMatch]);

  return (
    <div className="relative">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        className={cn(
          'resize-none border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:bg-input/30 flex field-sizing-content min-h-16 w-full rounded-md border bg-input-background px-3 py-2 text-base transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
          className
        )}
      />

      {showSuggestions && filteredSources.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute z-50 bg-popover border rounded-md shadow-lg max-h-48 overflow-auto min-w-[200px]"
          style={{
            top: dropdownPosition.top,
            left: dropdownPosition.left
          }}
        >
          <div className="p-1">
            <div className="text-xs text-muted-foreground px-2 py-1">
              Files matching "{mentionMatch?.query}"
            </div>
            {filteredSources.map((source, index) => (
              <button
                key={source.id}
                type="button"
                onClick={() => insertMention(source)}
                className={cn(
                  'w-full px-2 py-1.5 text-left text-sm flex items-center gap-2 rounded-sm',
                  index === selectedIndex
                    ? 'bg-accent text-accent-foreground'
                    : 'hover:bg-accent/50'
                )}
              >
                <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <span className="truncate">{source.name}</span>
                <span className="text-xs text-muted-foreground ml-auto">{source.type}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {!disabled && (
        <div className="text-xs text-muted-foreground mt-1">
          Type @ to mention a source file
        </div>
      )}
    </div>
  );
}
