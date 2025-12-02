import { useCallback, useEffect, useRef } from 'react';
import CodeMirror, { ReactCodeMirrorRef } from '@uiw/react-codemirror';
import { markdown } from '@codemirror/lang-markdown';
import { EditorView } from '@codemirror/view';
import { cn } from '../ui/utils';

interface CodeMirrorEditorProps {
  value: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
  placeholder?: string;
  className?: string;
  onSave?: () => void;
}

// Custom theme that matches DossierFlow's editorial aesthetic
const editorTheme = EditorView.theme({
  '&': {
    fontSize: '14px',
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
    backgroundColor: 'transparent',
  },
  '.cm-content': {
    padding: '16px 0',
    caretColor: '#030213',
  },
  '.cm-line': {
    padding: '0 24px',
  },
  '.cm-gutters': {
    backgroundColor: 'transparent',
    borderRight: 'none',
    color: '#a1a1aa',
    paddingRight: '8px',
  },
  '.cm-gutter.cm-lineNumbers': {
    minWidth: '48px',
  },
  '.cm-activeLineGutter': {
    backgroundColor: 'transparent',
    color: '#71717a',
  },
  '.cm-activeLine': {
    backgroundColor: 'rgba(0, 0, 0, 0.03)',
  },
  '.cm-selectionBackground': {
    backgroundColor: 'rgba(217, 119, 6, 0.15) !important',
  },
  '&.cm-focused .cm-selectionBackground': {
    backgroundColor: 'rgba(217, 119, 6, 0.2) !important',
  },
  '.cm-cursor': {
    borderLeftColor: '#030213',
    borderLeftWidth: '2px',
  },
  '.cm-placeholder': {
    color: '#a1a1aa',
    fontStyle: 'italic',
  },
  // Markdown syntax highlighting
  '.cm-header': {
    fontWeight: '600',
    color: '#030213',
  },
  '.cm-header-1': {
    fontSize: '1.5em',
  },
  '.cm-header-2': {
    fontSize: '1.3em',
  },
  '.cm-header-3': {
    fontSize: '1.15em',
  },
  '.cm-strong': {
    fontWeight: '700',
  },
  '.cm-emphasis': {
    fontStyle: 'italic',
  },
  '.cm-link': {
    color: '#2563eb',
    textDecoration: 'underline',
  },
  '.cm-url': {
    color: '#6b7280',
  },
  '.cm-quote': {
    color: '#6b7280',
    fontStyle: 'italic',
    borderLeft: '3px solid #e5e7eb',
    paddingLeft: '12px',
  },
  '.cm-list': {
    color: '#030213',
  },
  '.cm-hr': {
    color: '#d1d5db',
  },
  '.cm-meta': {
    color: '#6b7280',
  },
  '.cm-formatting': {
    color: '#9ca3af',
  },
});

// Extension for save keyboard shortcut
const saveKeymap = (onSave?: () => void) =>
  EditorView.domEventHandlers({
    keydown(event) {
      if ((event.metaKey || event.ctrlKey) && event.key === 's') {
        event.preventDefault();
        onSave?.();
        return true;
      }
      return false;
    },
  });

export function CodeMirrorEditor({
  value,
  onChange,
  readOnly = false,
  placeholder = 'Start writing...',
  className,
  onSave
}: CodeMirrorEditorProps) {
  const editorRef = useRef<ReactCodeMirrorRef>(null);

  const handleChange = useCallback(
    (val: string) => {
      onChange(val);
    },
    [onChange]
  );

  // Focus editor on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      editorRef.current?.view?.focus();
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div
      className={cn(
        'h-full w-full overflow-hidden',
        'bg-white',
        className
      )}
    >
      <CodeMirror
        ref={editorRef}
        value={value}
        onChange={handleChange}
        extensions={[
          markdown(),
          editorTheme,
          EditorView.lineWrapping,
          saveKeymap(onSave),
        ]}
        placeholder={placeholder}
        readOnly={readOnly}
        basicSetup={{
          lineNumbers: true,
          highlightActiveLineGutter: true,
          highlightActiveLine: true,
          foldGutter: false,
          dropCursor: true,
          allowMultipleSelections: false,
          indentOnInput: true,
          bracketMatching: false,
          closeBrackets: false,
          autocompletion: false,
          rectangularSelection: false,
          crosshairCursor: false,
          highlightSelectionMatches: false,
          searchKeymap: true,
          history: true,
          drawSelection: true,
          syntaxHighlighting: true,
        }}
        className="h-full"
        style={{
          height: '100%',
          overflow: 'auto',
        }}
      />
    </div>
  );
}
