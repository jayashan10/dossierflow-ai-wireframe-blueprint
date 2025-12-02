import { useState, useCallback, useEffect, useMemo } from 'react';
import {
  Save,
  Loader2,
  FileText,
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  FolderOpen,
  FolderPlus
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
  saveFileContent,
  getProgram,
  createProgramStructure
} from '../../lib/api';

interface BackendPaneProps {
  programId: string;
  programName: string;
  className?: string;
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export function BackendPane({
  programId,
  programName,
  className
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

  // Structure creation state
  const [isCreatingStructure, setIsCreatingStructure] = useState(false);
  const [structureError, setStructureError] = useState<string | null>(null);

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

  // Handle structure creation
  const handleCreateStructure = useCallback(async () => {
    setIsCreatingStructure(true);
    setStructureError(null);

    try {
      // Fetch program metadata to get sections
      const program = await getProgram(programId);

      // Get sections from program metadata or prompt user
      let sectionsToCreate: Array<{ title: string; summary?: string; originalHeading?: string }> = [];

      if (program.sections && Object.keys(program.sections).length > 0) {
        // Use existing sections from program metadata
        sectionsToCreate = Object.values(program.sections).map((section) => ({
          title: section.title,
          originalHeading: section.title
        }));
      } else {
        // Prompt user for section names
        const input = window.prompt(
          'Enter section names (comma-separated):\n\nExample: Introduction, Methods, Results, Discussion, Conclusion'
        );

        if (!input) {
          setIsCreatingStructure(false);
          return;
        }

        sectionsToCreate = input
          .split(',')
          .map((s) => s.trim())
          .filter((s) => s.length > 0)
          .map((title) => ({ title, originalHeading: title }));

        if (sectionsToCreate.length === 0) {
          setStructureError('No valid sections provided');
          setIsCreatingStructure(false);
          return;
        }
      }

      // Call the structure creation API
      const result = await createProgramStructure(programId, sectionsToCreate);

      if (result.success) {
        // Refresh the file tree
        await loadFiles();
        alert(`Created ${result.filesCreated.length} section files successfully!`);
      } else if (result.warnings && result.warnings.length > 0) {
        setStructureError(result.warnings.join(', '));
      }
    } catch (error) {
      setStructureError(
        error instanceof Error ? error.message : 'Failed to create structure'
      );
    } finally {
      setIsCreatingStructure(false);
    }
  }, [programId, loadFiles]);

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
    <div className={cn('flex flex-col h-full bg-background', className)}>
      {/* Top bar with breadcrumbs and save button */}
      <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/30">
        <div className="flex items-center gap-2 min-w-0">
          {/* Program name */}
          <Badge variant="outline" className="shrink-0 font-mono text-xs">
            {programName}
          </Badge>

          {/* Breadcrumbs */}
          {selectedPath && (
            <>
              <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
              <nav className="flex items-center gap-1 text-sm min-w-0">
                {breadcrumbs.map((segment, index) => (
                  <span key={index} className="flex items-center gap-1">
                    {index > 0 && (
                      <ChevronRight className="h-3 w-3 text-muted-foreground" />
                    )}
                    <span
                      className={cn(
                        'font-mono truncate',
                        index === breadcrumbs.length - 1
                          ? 'text-foreground font-medium'
                          : 'text-muted-foreground'
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
            <span className="h-2 w-2 rounded-full bg-amber-500 shrink-0" />
          )}
        </div>

        {/* Action buttons and status */}
        <div className="flex items-center gap-2">
          {/* Structure creation error */}
          {structureError && (
            <span className="flex items-center gap-1 text-xs text-destructive max-w-48 truncate" title={structureError}>
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              {structureError}
            </span>
          )}

          {/* Create Structure button */}
          <Button
            size="sm"
            variant="outline"
            onClick={handleCreateStructure}
            disabled={isCreatingStructure}
            className="gap-1.5"
          >
            {isCreatingStructure ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FolderPlus className="h-4 w-4" />
            )}
            {isCreatingStructure ? 'Creating...' : 'Create Structure'}
          </Button>

          {/* Save status */}
          {saveStatus === 'saved' && (
            <span className="flex items-center gap-1 text-xs text-emerald-600">
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
            className="gap-1.5"
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
      <ResizablePanelGroup direction="horizontal" className="flex-1">
        {/* File tree panel */}
        <ResizablePanel
          defaultSize={25}
          minSize={15}
          maxSize={40}
          className="min-w-0"
        >
          {filesError ? (
            <div className="flex flex-col items-center justify-center h-full p-4 bg-slate-900 text-slate-400">
              <AlertCircle className="h-8 w-8 mb-2 text-red-400" />
              <p className="text-sm text-center">{filesError}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={loadFiles}
                className="mt-3"
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
        <ResizablePanel defaultSize={75} minSize={40} className="min-w-0">
          {!selectedPath ? (
            // No file selected
            <div className="flex flex-col items-center justify-center h-full bg-gradient-to-br from-background to-muted/20">
              <div className="flex flex-col items-center text-center max-w-md px-8">
                <div className="relative mb-6">
                  <FolderOpen className="h-16 w-16 text-muted-foreground/30" />
                  <FileText className="h-8 w-8 text-muted-foreground/50 absolute -bottom-1 -right-1" />
                </div>
                <h3 className="text-lg font-medium text-foreground mb-2">
                  Select a file to edit
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Choose a markdown file from the file tree to view or edit its content.
                  Generated sections are stored as .md files.
                </p>
              </div>
            </div>
          ) : isLoadingContent ? (
            // Loading content
            <div className="flex items-center justify-center h-full bg-background">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : contentError ? (
            // Error loading content
            <div className="flex flex-col items-center justify-center h-full bg-background">
              <AlertCircle className="h-8 w-8 mb-3 text-destructive" />
              <p className="text-sm text-muted-foreground mb-3">{contentError}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => selectedPath && loadFileContent(selectedPath)}
              >
                Retry
              </Button>
            </div>
          ) : (
            // Editor
            <div className="h-full flex flex-col">
              {/* Read-only banner for JSON files */}
              {isReadOnly && (
                <div className="px-4 py-2 bg-amber-50 border-b border-amber-200 text-amber-800 text-sm flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  This file is read-only
                </div>
              )}
              <div className="flex-1 min-h-0">
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
