import { useState, useCallback, useEffect, useMemo } from 'react';
import {
  Save,
  Loader2,
  FileText,
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  FolderOpen
} from 'lucide-react';
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle
} from '../ui/resizable';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { FileTree } from './FileTree';
import { CodeMirrorEditor } from './CodeMirrorEditor';
import { cn } from '../ui/utils';
import type { FileNode } from '../../lib/api';
import {
  fetchProgramFiles,
  fetchFileContent,
  saveFileContent
} from '../../lib/api';

interface BackendPaneProps {
  programId: string;
  programName: string;
  className?: string;
  focusPath?: string | null;
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export function BackendPane({
  programId,
  programName,
  className,
  focusPath
}: BackendPaneProps) {
  // File tree state
  const [files, setFiles] = useState<FileNode[]>([]);
  const [isLoadingFiles, setIsLoadingFiles] = useState(true);
  const [filesError, setFilesError] = useState<string | null>(null);

  // Editor state
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string>('');
  const [originalContent, setOriginalContent] = useState<string>('');
  const [isLoadingContent, setIsLoadingContent] = useState(false);
  const [contentError, setContentError] = useState<string | null>(null);

  // Save state
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);

  // Derived state
  const hasUnsavedChanges = fileContent !== originalContent;
  const isMarkdownFile = selectedPath?.endsWith('.md') ?? false;
  const isReadOnly = selectedPath?.endsWith('.json') || selectedPath === 'program.json';

  // Load file tree
  const loadFiles = useCallback(async () => {
    setIsLoadingFiles(true);
    setFilesError(null);
    try {
      const result = await fetchProgramFiles(programId);
      setFiles(result);
    } catch (error) {
      setFilesError(error instanceof Error ? error.message : 'Failed to load files');
    } finally {
      setIsLoadingFiles(false);
    }
  }, [programId]);

  // Load file content
  const loadFileContent = useCallback(async (path: string) => {
    setIsLoadingContent(true);
    setContentError(null);
    try {
      const content = await fetchFileContent(programId, path);
      setFileContent(content);
      setOriginalContent(content);
    } catch (error) {
      setContentError(error instanceof Error ? error.message : 'Failed to load file');
      setFileContent('');
      setOriginalContent('');
    } finally {
      setIsLoadingContent(false);
    }
  }, [programId]);

  // Save file content
  const handleSave = useCallback(async () => {
    if (!selectedPath || !hasUnsavedChanges) return;

    setSaveStatus('saving');
    setSaveError(null);
    try {
      await saveFileContent(programId, selectedPath, fileContent);
      setOriginalContent(fileContent);
      setSaveStatus('saved');
      // Reset status after delay
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (error) {
      setSaveStatus('error');
      setSaveError(error instanceof Error ? error.message : 'Failed to save');
    }
  }, [programId, selectedPath, fileContent, hasUnsavedChanges]);

  // Handle file selection
  const handleSelectFile = useCallback((path: string) => {
    // Check for unsaved changes before switching
    if (hasUnsavedChanges) {
      const confirmed = window.confirm(
        'You have unsaved changes. Do you want to discard them?'
      );
      if (!confirmed) return;
    }

    setSelectedPath(path);
    loadFileContent(path);
  }, [hasUnsavedChanges, loadFileContent]);

  // Initial load
  useEffect(() => {
    loadFiles();
  }, [loadFiles]);

  useEffect(() => {
    if (!focusPath) {
      return;
    }

    setSelectedPath(focusPath);
    void loadFileContent(focusPath);
  }, [focusPath, loadFileContent]);

  // Keyboard shortcut for save
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSave]);

  // Breadcrumb segments
  const breadcrumbs = useMemo(() => {
    if (!selectedPath) return [];
    return selectedPath.split('/').filter(Boolean);
  }, [selectedPath]);

  return (
    <div className={cn('flex flex-col h-full min-h-0 dossier-pane', className)}>
      {/* Top bar with breadcrumbs and save button */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[rgba(31,26,20,0.12)] bg-[rgba(251,246,240,0.9)]">
        <div className="flex items-center gap-3 min-w-0">
          {/* Program name */}
          <Badge variant="outline" className="shrink-0 text-[10px] dossier-meta border-[rgba(31,26,20,0.2)]">
            {programName}
          </Badge>

          {/* Breadcrumbs */}
          {selectedPath && (
            <>
              <ChevronRight className="h-4 w-4 text-[rgba(31,26,20,0.45)] shrink-0" />
              <nav className="flex items-center gap-1 text-sm min-w-0">
                {breadcrumbs.map((segment, index) => (
                  <span key={index} className="flex items-center gap-1">
                    {index > 0 && (
                      <ChevronRight className="h-3 w-3 text-[rgba(31,26,20,0.45)]" />
                    )}
                    <span
                      className={cn(
                        'font-mono truncate text-[13px]',
                        index === breadcrumbs.length - 1
                          ? 'text-foreground font-medium'
                          : 'text-[rgba(31,26,20,0.55)]'
                      )}
                    >
                      {segment}
                    </span>
                  </span>
                ))}
              </nav>
            </>
          )}

          {/* Unsaved indicator */}
          {hasUnsavedChanges && (
            <span className="h-2 w-2 rounded-full bg-[rgba(31,59,52,0.7)] shrink-0" />
          )}
        </div>

        {/* Action buttons and status */}
        <div className="flex items-center gap-2">
          {/* Save status */}
          {saveStatus === 'saved' && (
            <span className="flex items-center gap-1 text-xs text-emerald-700">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Saved
            </span>
          )}
          {saveStatus === 'error' && (
            <span className="flex items-center gap-1 text-xs text-destructive">
              <AlertCircle className="h-3.5 w-3.5" />
              {saveError || 'Error'}
            </span>
          )}
          <Button
            size="sm"
            variant={hasUnsavedChanges ? 'default' : 'outline'}
            onClick={handleSave}
            disabled={!selectedPath || !hasUnsavedChanges || saveStatus === 'saving' || isReadOnly}
            className={cn(
              'gap-1.5',
              hasUnsavedChanges
                ? 'bg-[rgba(31,59,52,0.95)] text-[rgba(251,246,240,0.95)] hover:bg-[rgba(31,59,52,0.85)]'
                : 'border-[rgba(31,26,20,0.2)] text-[rgba(31,26,20,0.85)] hover:bg-[rgba(31,26,20,0.06)]'
            )}
          >
            {saveStatus === 'saving' ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Save
          </Button>
        </div>
      </div>

      {/* Main content: resizable file tree + editor */}
      <ResizablePanelGroup direction="horizontal" className="flex-1 min-h-0">
        {/* File tree panel */}
        <ResizablePanel
          defaultSize={25}
          minSize={15}
          maxSize={40}
          className="min-w-0 min-h-0"
        >
          {filesError ? (
            <div className="flex flex-col items-center justify-center h-full p-4 bg-[var(--sidebar)] text-[rgba(31,26,20,0.6)]">
              <AlertCircle className="h-8 w-8 mb-2 text-rose-700" />
              <p className="text-sm text-center">{filesError}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={loadFiles}
                className="mt-3 border-[rgba(31,26,20,0.2)]"
              >
                Retry
              </Button>
            </div>
          ) : (
            <FileTree
              files={files}
              selectedPath={selectedPath}
              onSelectFile={handleSelectFile}
              onRefresh={loadFiles}
              isLoading={isLoadingFiles}
            />
          )}
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* Editor panel */}
        <ResizablePanel defaultSize={75} minSize={40} className="min-w-0 min-h-0">
          {!selectedPath ? (
            // No file selected
            <div className="flex items-center justify-center w-full h-full min-h-[70vh] bg-[rgba(251,246,240,0.55)]">
              <div className="w-full max-w-md px-6">
                <div className="rounded-2xl border border-[rgba(31,26,20,0.12)] bg-[rgba(251,246,240,0.9)] p-6 text-center shadow-[0_24px_60px_-48px_rgba(31,26,20,0.45)]">
                  <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-[rgba(31,26,20,0.12)] bg-[rgba(31,26,20,0.04)]">
                    <div className="relative">
                      <FolderOpen className="h-7 w-7 text-[rgba(31,26,20,0.55)]" />
                      <FileText className="h-4 w-4 text-[rgba(31,26,20,0.7)] absolute -bottom-2 -right-2" />
                    </div>
                  </div>
                  <h3 className="text-lg font-medium text-foreground">
                    Select a file to edit
                  </h3>
                  <p className="mt-2 text-sm text-[rgba(31,26,20,0.6)] leading-relaxed">
                    Choose a markdown file from the file tree to view or edit its content.
                    Generated sections are stored as .md files.
                  </p>
                </div>
              </div>
            </div>
          ) : isLoadingContent ? (
            // Loading content
            <div className="flex items-center justify-center h-full bg-[rgba(251,246,240,0.55)]">
              <Loader2 className="h-8 w-8 animate-spin text-[rgba(31,26,20,0.5)]" />
            </div>
          ) : contentError ? (
            // Error loading content
            <div className="flex flex-col items-center justify-center h-full bg-[rgba(251,246,240,0.55)]">
              <AlertCircle className="h-8 w-8 mb-3 text-destructive" />
              <p className="text-sm text-[rgba(31,26,20,0.6)] mb-3">{contentError}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => selectedPath && loadFileContent(selectedPath)}
                className="border-[rgba(31,26,20,0.2)]"
              >
                Retry
              </Button>
            </div>
          ) : (
            // Editor
            <div className="h-full flex flex-col">
              {/* Read-only banner for JSON files */}
              {isReadOnly && (
                <div className="px-4 py-2 bg-[rgba(228,214,199,0.6)] border-b border-[rgba(31,26,20,0.15)] text-[rgba(31,26,20,0.8)] text-sm flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  This file is read-only
                </div>
              )}
              <div className="flex-1 min-h-0 bg-[rgba(251,246,240,0.7)]">
                <CodeMirrorEditor
                  value={fileContent}
                  onChange={setFileContent}
                  readOnly={isReadOnly}
                  onSave={handleSave}
                  placeholder={
                    isMarkdownFile
                      ? 'Start writing markdown content...'
                      : 'File content will appear here'
                  }
                />
              </div>
            </div>
          )}
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
