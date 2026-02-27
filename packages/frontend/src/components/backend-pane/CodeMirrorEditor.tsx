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
    fontFamily: 'var(--font-mono)',
    backgroundColor: 'transparent',
  },
  '.cm-content': {
    padding: '16px 0',
    caretColor: '#1f1a14',
  },
  '.cm-line': {
    padding: '0 24px',
  },
  '.cm-gutters': {
    backgroundColor: 'transparent',
    borderRight: 'none',
    color: '#8a7d71',
    paddingRight: '8px',
  },
  '.cm-gutter.cm-lineNumbers': {
    minWidth: '48px',
  },
  '.cm-activeLineGutter': {
    backgroundColor: 'transparent',
    color: '#6f6256',
  },
  '.cm-activeLine': {
    backgroundColor: 'rgba(31, 26, 20, 0.04)',
  },
  '.cm-selectionBackground': {
    backgroundColor: 'rgba(31, 59, 52, 0.16) !important',
  },
  '&.cm-focused .cm-selectionBackground': {
    backgroundColor: 'rgba(31, 59, 52, 0.22) !important',
  },
  '.cm-cursor': {
    borderLeftColor: '#1f1a14',
    borderLeftWidth: '2px',
  },
  '.cm-placeholder': {
    color: '#a39587',
    fontStyle: 'italic',
  },
  // Markdown syntax highlighting
  '.cm-header': {
    fontWeight: '600',
    color: '#1f1a14',
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
    color: '#1f3b34',
    textDecoration: 'underline',
  },
  '.cm-url': {
    color: '#7b6e62',
  },
  '.cm-quote': {
    color: '#7b6e62',
    fontStyle: 'italic',
    borderLeft: '3px solid rgba(31, 26, 20, 0.16)',
    paddingLeft: '12px',
  },
  '.cm-list': {
    color: '#1f1a14',
  },
  '.cm-hr': {
    color: 'rgba(31, 26, 20, 0.2)',
  },
  '.cm-meta': {
    color: '#7b6e62',
  },
  '.cm-formatting': {
    color: '#a39587',
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
        'bg-transparent',
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
