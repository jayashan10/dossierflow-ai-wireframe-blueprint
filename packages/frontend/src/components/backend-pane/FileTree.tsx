import { useState, useCallback, useMemo } from 'react';
import {
  ChevronRight,
  Folder,
  FolderOpen,
  FileText,
  FileJson,
  File,
  FileCode,
  RefreshCw
} from 'lucide-react';
import { cn } from '../ui/utils';
import { ScrollArea } from '../ui/scroll-area';
import type { FileNode } from '../../lib/api';

interface FileTreeProps {
  files: FileNode[];
  selectedPath: string | null;
  onSelectFile: (path: string) => void;
  onRefresh?: () => void;
  isLoading?: boolean;
  className?: string;
}

interface FileTreeItemProps {
  node: FileNode;
  depth: number;
  selectedPath: string | null;
  expandedPaths: Set<string>;
  onToggleExpand: (path: string) => void;
  onSelectFile: (path: string) => void;
}

const nameCollator = new Intl.Collator('en', {
  numeric: true,
  sensitivity: 'base'
});

const getFileIcon = (name: string, type: 'file' | 'directory', isOpen: boolean) => {
  if (type === 'directory') {
    return isOpen ? (
      <FolderOpen className="h-4 w-4 text-emerald-800" />
    ) : (
      <Folder className="h-4 w-4 text-emerald-800/70" />
    );
  }

  const ext = name.split('.').pop()?.toLowerCase();

  switch (ext) {
    case 'md':
    case 'mdx':
      return <FileText className="h-4 w-4 text-emerald-700" />;
    case 'json':
      return <FileJson className="h-4 w-4 text-amber-700" />;
    case 'ts':
    case 'tsx':
    case 'js':
    case 'jsx':
      return <FileCode className="h-4 w-4 text-slate-600" />;
    case 'pdf':
      return <FileText className="h-4 w-4 text-rose-700" />;
    case 'docx':
    case 'doc':
      return <FileText className="h-4 w-4 text-sky-700" />;
    default:
      return <File className="h-4 w-4 text-slate-500" />;
  }
};

function FileTreeItem({
  node,
  depth,
  selectedPath,
  expandedPaths,
  onToggleExpand,
  onSelectFile
}: FileTreeItemProps) {
  const isDirectory = node.type === 'directory';
  const isExpanded = expandedPaths.has(node.path);
  const isSelected = selectedPath === node.path;

  const handleClick = useCallback(() => {
    if (isDirectory) {
      onToggleExpand(node.path);
    } else {
      onSelectFile(node.path);
    }
  }, [isDirectory, node.path, onToggleExpand, onSelectFile]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick();
    }
  }, [handleClick]);

  return (
    <div className="select-none">
      <div
        role="treeitem"
        tabIndex={0}
        aria-expanded={isDirectory ? isExpanded : undefined}
        aria-selected={isSelected}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        className={cn(
          'group flex items-center gap-2 py-1.5 px-2 cursor-pointer rounded-md',
          'transition-all duration-150 ease-out',
          'hover:bg-[rgba(31,26,20,0.06)]',
          'focus:outline-none focus:ring-1 focus:ring-[rgba(31,59,52,0.35)]',
          isSelected && 'bg-[rgba(31,59,52,0.12)] text-foreground',
          !isSelected && 'text-[rgba(31,26,20,0.68)]'
        )}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
      >
        {/* Expand/collapse chevron for directories */}
        <span className="w-4 h-4 flex items-center justify-center flex-shrink-0">
          {isDirectory && (
            <ChevronRight
              className={cn(
                'h-3 w-3 transition-transform duration-200',
                isExpanded && 'rotate-90',
                'text-[rgba(31,26,20,0.45)] group-hover:text-[rgba(31,26,20,0.7)]'
              )}
            />
          )}
        </span>

        {/* File/folder icon */}
        {getFileIcon(node.name, node.type, isExpanded)}

        {/* File name */}
        <span
          className={cn(
            'text-[13px] font-mono truncate',
            isDirectory && 'font-medium'
          )}
        >
          {node.name}
        </span>

        {/* File size for files */}
        {!isDirectory && node.size !== undefined && (
          <span className="ml-auto text-[10px] text-[rgba(31,26,20,0.4)] tabular-nums">
            {formatFileSize(node.size)}
          </span>
        )}
      </div>

      {/* Children (if expanded directory) */}
      {isDirectory && isExpanded && node.children && (
        <div
          className="overflow-hidden"
          style={{
            animation: 'slideDown 150ms ease-out'
          }}
        >
          {node.children.map((child) => (
            <FileTreeItem
              key={child.path}
              node={child}
              depth={depth + 1}
              selectedPath={selectedPath}
              expandedPaths={expandedPaths}
              onToggleExpand={onToggleExpand}
              onSelectFile={onSelectFile}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}K`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}M`;
}

export function FileTree({
  files,
  selectedPath,
  onSelectFile,
  onRefresh,
  isLoading,
  className
}: FileTreeProps) {
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(() => {
    // Auto-expand first level
    const initial = new Set<string>();
    files.forEach((file) => {
      if (file.type === 'directory') {
        initial.add(file.path);
      }
    });
    return initial;
  });

  const handleToggleExpand = useCallback((path: string) => {
    setExpandedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }, []);

  // Sort files: directories first, then alphabetically
  const sortedFiles = useMemo(() => {
    return [...files].sort((a, b) => {
      if (a.type === 'directory' && b.type !== 'directory') return -1;
      if (a.type !== 'directory' && b.type === 'directory') return 1;
      return nameCollator.compare(a.name, b.name);
    });
  }, [files]);

  return (
    <div
      className={cn(
        'flex flex-col h-full',
        'bg-[var(--sidebar)]',
        'border-r border-[rgba(31,26,20,0.12)]',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[rgba(31,26,20,0.12)]">
        <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[rgba(31,26,20,0.6)]">
          Files
        </span>
        {onRefresh && (
          <button
            onClick={onRefresh}
            disabled={isLoading}
            className={cn(
              'p-1 rounded-md hover:bg-[rgba(31,26,20,0.08)] transition-colors',
              'text-[rgba(31,26,20,0.5)] hover:text-[rgba(31,26,20,0.8)]',
              'focus:outline-none focus:ring-1 focus:ring-[rgba(31,59,52,0.35)]',
              isLoading && 'animate-spin'
            )}
            title="Refresh files"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Tree */}
      <ScrollArea className="flex-1">
        <div className="py-1" role="tree" aria-label="File tree">
          {sortedFiles.length === 0 ? (
            <div className="px-3 py-8 text-center">
              <Folder className="h-8 w-8 mx-auto mb-2 text-[rgba(31,26,20,0.35)]" />
              <p className="text-sm text-[rgba(31,26,20,0.6)]">No files yet</p>
              <p className="text-xs text-[rgba(31,26,20,0.5)] mt-1">
                Upload a template to get started
              </p>
            </div>
          ) : (
            sortedFiles.map((node) => (
              <FileTreeItem
                key={node.path}
                node={node}
                depth={0}
                selectedPath={selectedPath}
                expandedPaths={expandedPaths}
                onToggleExpand={handleToggleExpand}
                onSelectFile={onSelectFile}
              />
            ))
          )}
        </div>
      </ScrollArea>

      {/* Subtle animation keyframes */}
      <style>{`
        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-4px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
