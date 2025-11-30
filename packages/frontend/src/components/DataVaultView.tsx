import { useMemo, useRef, useState } from 'react';
import { Folder, FolderOpen, Plus, Upload, X, Loader2 } from 'lucide-react';
import { Button } from './ui/button';
import { Checkbox } from './ui/checkbox';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from './ui/sheet';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';
import { Label } from './ui/label';
import { uploadSources, updateSourceTags } from '../lib/api';
import type { DataVaultFolder, DataVaultFile, Document } from '../data/mockData';

interface DataVaultViewProps {
  folders: DataVaultFolder[];
  files: DataVaultFile[];
  documents: Record<string, Document>;
  onUploadFiles: (files: Array<{ id: string; name: string; type: string }>, folderPath: string) => void;
  onCreateFolder: (folderName: string, parentPath: string) => void;
}

interface FileState extends DataVaultFile {
  tags: string[];
}

const flattenFolders = (folders: DataVaultFolder[]) => {
  const list: DataVaultFolder[] = [];
  const traverse = (folder: DataVaultFolder, depth = 0) => {
    list.push({ ...folder, children: folder.children, depth });
    folder.children?.forEach((child) => traverse(child, depth + 1));
  };
  folders.forEach((folder) => traverse(folder));
  return list as Array<DataVaultFolder & { depth?: number }>;
};

export function DataVaultView({ folders, files, documents, onUploadFiles, onCreateFolder }: DataVaultViewProps) {
  const [selectedFolder, setSelectedFolder] = useState<string>('/');
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [selectedFileIds, setSelectedFileIds] = useState<Set<string>>(new Set());
  const [tagDraft, setTagDraft] = useState('');
  const [isUploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [isNewFolderDialogOpen, setNewFolderDialogOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [fileState, setFileState] = useState<Record<string, FileState>>(() => {
    const map: Record<string, FileState> = {};
    files.forEach((file) => {
      map[file.id] = { ...file, tags: [...file.tags] };
    });
    return map;
  });

  const flattenedFolders = useMemo(() => flattenFolders(folders), [folders]);

  const folderFiles = useMemo(() => {
    if (selectedFolder === '/') {
      return files.map((file) => fileState[file.id] ?? file);
    }
    return files
      .filter((file) => file.folderPath === selectedFolder)
      .map((file) => fileState[file.id] ?? file);
  }, [files, fileState, selectedFolder]);

  const activeFile = selectedFileId ? fileState[selectedFileId] : null;

  const toggleFile = (fileId: string, checked: boolean | string) => {
    setSelectedFileIds((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(fileId);
      } else {
        next.delete(fileId);
      }
      return next;
    });
  };

  const handleStatusChange = (fileId: string, status: DataVaultFile['status']) => {
    setFileState((prev) => ({
      ...prev,
      [fileId]: {
        ...prev[fileId],
        status
      }
    }));
  };

  const handleAddTag = async (fileId: string) => {
    if (!tagDraft.trim()) return;

    const currentFile = fileState[fileId];
    if (!currentFile) return;

    const newTag = tagDraft.trim();
    if (currentFile.tags.includes(newTag)) {
      setTagDraft('');
      return;
    }

    const newTags = [...currentFile.tags, newTag];

    // Optimistically update UI
    setFileState((prev) => ({
      ...prev,
      [fileId]: { ...prev[fileId], tags: newTags }
    }));
    setTagDraft('');

    try {
      await updateSourceTags(fileId, newTags);
    } catch (error) {
      // Revert on error
      console.error('Failed to add tag:', error);
      setFileState((prev) => ({
        ...prev,
        [fileId]: { ...prev[fileId], tags: currentFile.tags }
      }));
    }
  };

  const handleRemoveTag = async (fileId: string, tag: string) => {
    const currentFile = fileState[fileId];
    if (!currentFile) return;

    const newTags = currentFile.tags.filter((existing) => existing !== tag);

    // Optimistically update UI
    setFileState((prev) => ({
      ...prev,
      [fileId]: { ...prev[fileId], tags: newTags }
    }));

    try {
      await updateSourceTags(fileId, newTags);
    } catch (error) {
      // Revert on error
      console.error('Failed to remove tag:', error);
      setFileState((prev) => ({
        ...prev,
        [fileId]: { ...prev[fileId], tags: currentFile.tags }
      }));
    }
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = event.target.files;
    if (!selectedFiles || selectedFiles.length === 0) return;

    setIsUploading(true);
    setUploadError(null);

    try {
      const fileArray = Array.from(selectedFiles);
      const result = await uploadSources(fileArray);

      // Convert backend response to the format expected by the parent component
      const uploadedFiles = result.sources.map((source) => ({
        id: source.id,
        name: source.name,
        type: source.type
      }));

      onUploadFiles(uploadedFiles, selectedFolder);
      setUploadDialogOpen(false);

      // Reset the file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Upload failed';
      setUploadError(message);
    } finally {
      setIsUploading(false);
    }
  };

  const handleCreateFolder = () => {
    const trimmedName = newFolderName.trim();
    if (!trimmedName) return;

    onCreateFolder(trimmedName, selectedFolder);
    setNewFolderName('');
    setNewFolderDialogOpen(false);
  };

  return (
    <div className="flex h-full">
      <div className="w-64 border-r bg-muted/30 p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium">Folders</h3>
        </div>
        <div className="space-y-1">
          {flattenedFolders.map((folder) => {
            const depth = (folder as DataVaultFolder & { depth?: number }).depth ?? 0;
            const isActive = selectedFolder === folder.path;
            return (
              <button
                key={folder.path}
                className={`w-full flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-accent ${isActive ? 'bg-accent text-foreground' : 'text-muted-foreground'}`}
                style={{ paddingLeft: 12 + depth * 12 }}
                onClick={() => setSelectedFolder(folder.path)}
              >
                {isActive ? <FolderOpen className="h-4 w-4" /> : <Folder className="h-4 w-4" />}
                <span className="truncate">{folder.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 flex flex-col">
        <div className="flex items-center justify-between p-4 border-b bg-white">
          <div>
            <h3 className="text-base font-medium">Data Vault</h3>
            <p className="text-xs text-muted-foreground">
              Manage the source files that underpin AI-generated content.
            </p>
          </div>
          <div className="flex gap-2">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={handleFileSelect}
              className="hidden"
            />
            <Button variant="outline" className="gap-2" onClick={() => fileInputRef.current?.click()} disabled={isUploading}>
              {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              Upload Files
            </Button>
            <Button variant="outline" className="gap-2" onClick={() => setNewFolderDialogOpen(true)}>
              <Plus className="h-4 w-4" />
              New Folder
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-auto">
          <table className="w-full">
            <thead className="border-b bg-muted/20">
              <tr>
                <th className="w-12 p-3 text-left">
                  <Checkbox
                    checked={folderFiles.length > 0 && selectedFileIds.size === folderFiles.length}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setSelectedFileIds(new Set(folderFiles.map((file) => file.id)));
                      } else {
                        setSelectedFileIds(new Set());
                      }
                    }}
                  />
                </th>
                <th className="p-3 text-left text-xs font-medium uppercase tracking-wide">Name</th>
                <th className="p-3 text-left text-xs font-medium uppercase tracking-wide">Type</th>
                <th className="p-3 text-left text-xs font-medium uppercase tracking-wide">Last Updated</th>
                <th className="p-3 text-left text-xs font-medium uppercase tracking-wide">Tags</th>
              </tr>
            </thead>
            <tbody>
              {folderFiles.map((file) => (
                <tr
                  key={file.id}
                  className={`border-b last:border-0 hover:bg-muted/40 cursor-pointer ${selectedFileId === file.id ? 'bg-muted/40' : ''}`}
                  onClick={() => setSelectedFileId(file.id)}
                >
                  <td className="p-3" onClick={(event) => event.stopPropagation()}>
                    <Checkbox
                      checked={selectedFileIds.has(file.id)}
                      onCheckedChange={(checked) => toggleFile(file.id, checked)}
                    />
                  </td>
                  <td className="p-3 text-sm font-medium text-foreground">{file.name}</td>
                  <td className="p-3 text-sm text-muted-foreground">{file.type}</td>
                  <td className="p-3 text-sm text-muted-foreground">{file.lastUpdated}</td>
                  <td className="p-3 text-sm">
                    <div className="flex flex-wrap gap-1">
                      {file.tags.map((tag) => (
                        <Badge key={tag} variant="secondary" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}

              {folderFiles.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-sm text-muted-foreground">
                    No files in this folder yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Sheet open={Boolean(activeFile)} onOpenChange={(open) => !open && setSelectedFileId(null)}>
        <SheetContent side="right" className="w-[420px] overflow-auto">
          {activeFile && (
            <div className="space-y-6">
              <SheetHeader>
                <SheetTitle>{activeFile.name}</SheetTitle>
                <p className="text-sm text-muted-foreground">Stored in {activeFile.folderPath}</p>
              </SheetHeader>

              <div className="rounded-md border bg-muted/20 p-4 text-center text-sm text-muted-foreground">
                Preview unavailable. Upload previews to see them here.
              </div>

              <section className="space-y-3">
                <h4 className="text-sm font-medium">Metadata</h4>
                <div>
                  <p className="text-xs text-muted-foreground mb-2">Tags</p>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {activeFile.tags.map((tag) => (
                      <Badge key={tag} variant="secondary" className="gap-1">
                        {tag}
                        <button onClick={() => handleRemoveTag(activeFile.id, tag)} className="ml-1 inline-flex">
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Add tag"
                      value={tagDraft}
                      onChange={(event) => setTagDraft(event.target.value)}
                    />
                    <Button type="button" variant="outline" onClick={() => handleAddTag(activeFile.id)}>
                      Add
                    </Button>
                  </div>
                </div>

                <div>
                  <p className="text-xs text-muted-foreground mb-2">Status</p>
                  <Select value={activeFile.status} onValueChange={(value) => handleStatusChange(activeFile.id, value as DataVaultFile['status'])}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Draft">Draft</SelectItem>
                      <SelectItem value="Final">Final</SelectItem>
                      <SelectItem value="Archived">Archived</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </section>

              <section className="space-y-3">
                <h4 className="text-sm font-medium">Version History</h4>
                <div className="space-y-2">
                  {activeFile.versions.map((version) => (
                    <div key={version.id} className="rounded-md border p-2 text-sm">
                      <div className="font-medium">{version.label}</div>
                      <div className="text-xs text-muted-foreground">{version.date}</div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="space-y-3">
                <h4 className="text-sm font-medium">Linked Documents</h4>
                <div className="space-y-2">
                  {activeFile.linkedDocuments.map((docId) => {
                    const doc = documents[docId];
                    return (
                      <div key={docId} className="rounded-md border p-2 text-sm">
                        <div className="font-medium">{doc?.name ?? docId}</div>
                        <div className="text-xs text-muted-foreground">Status: {doc?.status ?? 'Unknown'}</div>
                      </div>
                    );
                  })}

                  {activeFile.linkedDocuments.length === 0 && (
                    <p className="text-xs text-muted-foreground">Not linked to any documents yet.</p>
                  )}
                </div>
              </section>
            </div>
          )}
        </SheetContent>
      </Sheet>

      <Dialog open={isNewFolderDialogOpen} onOpenChange={setNewFolderDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Folder</DialogTitle>
            <DialogDescription>
              Create a new folder in {selectedFolder === '/' ? 'root' : selectedFolder}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="folder-name">Folder Name</Label>
              <Input
                id="folder-name"
                placeholder="Enter folder name"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newFolderName.trim()) {
                    handleCreateFolder();
                  }
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewFolderDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateFolder} disabled={!newFolderName.trim()}>
              Create Folder
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {uploadError && (
        <Dialog open={Boolean(uploadError)} onOpenChange={() => setUploadError(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Upload Error</DialogTitle>
            </DialogHeader>
            <div className="py-4">
              <p className="text-sm text-destructive">{uploadError}</p>
            </div>
            <DialogFooter>
              <Button onClick={() => setUploadError(null)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
