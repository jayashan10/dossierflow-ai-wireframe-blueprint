import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronRight, ChevronDown, Home, Sparkles, FileText, Loader2 } from 'lucide-react';
import { Button } from './ui/button';
import { Checkbox } from './ui/checkbox';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from './ui/breadcrumb';
import { cn } from './ui/utils';
import type { ModuleNode, Document, DataVaultFolder, DataVaultFile } from '../data/mockData';
import { reviewers } from '../data/mockData';
import { DataVaultView } from './DataVaultView';
import { fetchProgramSources, getProgram } from '../lib/api';
import type { SourceSummary } from '../lib/api';
import { buildSectionTree, hasSections } from '../lib/section-tree';

const reviewerNameMap = new Map(reviewers.map((reviewer) => [reviewer.id, reviewer.name] as const));

interface DossierViewProps {
  programId: string;
  isSample?: boolean;
  onBack: () => void;
  onOpenDocument: (documentId: string, mode?: 'author' | 'reviewer') => void;
  onViewFullReport: () => void;
  documents: Record<string, Document>;
  structure: ModuleNode[];
  dataVaultFolders: DataVaultFolder[];
  dataVaultFiles: DataVaultFile[];
  onUploadFiles: (files: Array<{ id: string; name: string; type: string; createdAt?: string }>, folderPath: string) => void;
  onCreateFolder: (folderName: string, parentPath: string) => void;
  onDocumentsUpdate?: (docs: Record<string, Document>) => void;
}

export function DossierView({
  programId,
  isSample = false,
  onBack,
  onOpenDocument,
  onViewFullReport,
  documents,
  structure,
  dataVaultFolders,
  dataVaultFiles,
  onUploadFiles,
  onCreateFolder,
  onDocumentsUpdate
}: DossierViewProps) {
  // State for backend-loaded structure (non-sample programs)
  const [backendStructure, setBackendStructure] = useState<ModuleNode[] | null>(null);
  const [backendDocuments, setBackendDocuments] = useState<Record<string, Document>>({});
  const [isLoadingStructure, setIsLoadingStructure] = useState(false);
  const [structureError, setStructureError] = useState<string | null>(null);
  const [programVaultFiles, setProgramVaultFiles] = useState<DataVaultFile[]>([]);

  // Load structure from backend for non-sample programs
  const loadBackendStructure = useCallback(async () => {
    if (isSample) return;
    
    setIsLoadingStructure(true);
    setStructureError(null);
    
    try {
      const program = await getProgram(programId);
      
      if (hasSections(program.sections)) {
        const { structure: builtStructure, documents: builtDocs } = buildSectionTree(
          program.sections,
          programId
        );
        setBackendStructure(builtStructure);
        setBackendDocuments(builtDocs);
        
        // Notify parent of new documents if callback provided
        if (onDocumentsUpdate) {
          onDocumentsUpdate(builtDocs);
        }
      } else {
        // No sections in backend, fall back to prop structure
        setBackendStructure(null);
      }
    } catch (error) {
      setStructureError(error instanceof Error ? error.message : 'Failed to load program structure');
      setBackendStructure(null);
    } finally {
      setIsLoadingStructure(false);
    }
  }, [programId, isSample, onDocumentsUpdate]);

  useEffect(() => {
    loadBackendStructure();
  }, [loadBackendStructure]);

  const formatVaultTimestamp = useCallback((value?: string) => {
    if (!value) return '—';
    return new Date(value).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  }, []);

  const mapSourceToVaultFile = useCallback((source: SourceSummary): DataVaultFile => {
    return {
      id: source.id,
      name: source.name,
      type: source.type,
      lastUpdated: formatVaultTimestamp(source.createdAt),
      tags: source.tags ?? [],
      folderPath: '/',
      status: 'Draft',
      versions: [],
      linkedDocuments: []
    };
  }, [formatVaultTimestamp]);

  const loadProgramSources = useCallback(async () => {
    if (isSample) return;
    try {
      const sources = await fetchProgramSources(programId);
      setProgramVaultFiles(sources.map(mapSourceToVaultFile));
    } catch {
      setProgramVaultFiles([]);
    }
  }, [programId, isSample, mapSourceToVaultFile]);

  useEffect(() => {
    loadProgramSources();
  }, [loadProgramSources]);

  // Use backend structure for non-sample programs if available, otherwise use prop
  const activeStructure = (!isSample && backendStructure) ? backendStructure : structure;
  const activeDocuments = (!isSample && backendStructure) 
    ? { ...documents, ...backendDocuments } 
    : documents;

  const activeVaultFolders = isSample ? dataVaultFolders : [
    {
      id: 'root',
      name: 'All Files',
      path: '/',
      children: []
    }
  ];
  const activeVaultFiles = isSample ? dataVaultFiles : programVaultFiles;

  const handleProgramUpload = useCallback((
    files: Array<{ id: string; name: string; type: string; createdAt?: string }>
  ) => {
    setProgramVaultFiles((prev) => [
      ...files.map((file) => mapSourceToVaultFile({
        id: file.id,
        name: file.name,
        type: file.type,
        createdAt: file.createdAt,
        tags: [],
        path: `sources/${file.name}`
      })),
      ...prev
    ]);
  }, [mapSourceToVaultFile]);

  const flattenStructure = (nodes: ModuleNode[]): ModuleNode[] =>
    nodes.flatMap((node) => [node, ...(node.children ? flattenStructure(node.children) : [])]);

  const collectDocuments = useCallback((node: ModuleNode): Document[] => {
    const collected: Document[] = [];
    if (node.documents) {
      collected.push(...node.documents);
    }
    if (node.children) {
      node.children.forEach((child) => {
        collected.push(...collectDocuments(child));
      });
    }
    return collected;
  }, []);

  const getDocumentCount = useCallback((node: ModuleNode): number => {
    return collectDocuments(node).length;
  }, [collectDocuments]);

  const findFirstNodeWithDocuments = (nodes: ModuleNode[]): ModuleNode | null => {
    for (const node of nodes) {
      if (getDocumentCount(node) > 0) {
        return node;
      }
      if (node.children) {
        const found = findFirstNodeWithDocuments(node.children);
        if (found) {
          return found;
        }
      }
    }
    return null;
  };

  const findPathToNode = (nodes: ModuleNode[], targetId: string, path: ModuleNode[] = []): ModuleNode[] | null => {
    for (const node of nodes) {
      const currentPath = [...path, node];
      if (node.id === targetId) {
        return currentPath;
      }
      if (node.children) {
        const childPath = findPathToNode(node.children, targetId, currentPath);
        if (childPath) {
          return childPath;
        }
      }
    }
    return null;
  };

  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [selectedNode, setSelectedNode] = useState<string>('');
  const [selectedDocs, setSelectedDocs] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<'dossier' | 'data-vault' | 'settings'>('dossier');

  // Update selection when structure changes (including after backend load)
  useEffect(() => {
    const nodeWithDocuments = findFirstNodeWithDocuments(activeStructure);
    const fallbackNodeId = activeStructure[0]?.id ?? '';
    const nextSelected = nodeWithDocuments?.id ?? fallbackNodeId;
    const nextPath = nextSelected ? findPathToNode(activeStructure, nextSelected) : null;
    setSelectedNode(nextSelected);
    setExpandedNodes(new Set(nextPath?.map((node) => node.id) ?? (fallbackNodeId ? [fallbackNodeId] : [])));
    setSelectedDocs(new Set());
  }, [activeStructure]);

  const toggleNode = (nodeId: string) => {
    const newExpanded = new Set(expandedNodes);
    if (newExpanded.has(nodeId)) {
      newExpanded.delete(nodeId);
    } else {
      newExpanded.add(nodeId);
    }
    setExpandedNodes(newExpanded);
  };

  const renderNode = (node: ModuleNode, level = 0) => {
    const isExpanded = expandedNodes.has(node.id);
    const isSelected = selectedNode === node.id;
    const hasChildren = node.children && node.children.length > 0;
    const documentCount = getDocumentCount(node);

    return (
      <div key={node.id}>
        <div
          className={cn(
            'section-tree-item flex items-center gap-2 py-2 px-3 rounded-lg cursor-pointer',
            isSelected && 'bg-primary/8 border border-primary/12',
            !isSelected && 'border border-transparent',
            level > 0 && 'ml-5'
          )}
          onClick={() => {
            if (hasChildren) toggleNode(node.id);
            setSelectedNode(node.id);
          }}
        >
          {hasChildren ? (
            <span className={cn('transition-transform duration-200', isExpanded && 'rotate-0', !isExpanded && '-rotate-90')}>
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground/70" />
            </span>
          ) : (
            <div className="w-3.5" />
          )}
          <span className={cn(
            'text-sm flex-1 truncate leading-snug',
            isSelected && 'font-medium text-primary',
            !isSelected && hasChildren && 'font-medium',
            !isSelected && !hasChildren && 'text-muted-foreground'
          )}>{node.name}</span>
          {documentCount > 0 && (
            <span className={cn(
              'ml-auto text-[10px] font-semibold tabular-nums px-1.5 py-0.5 rounded-md',
              isSelected ? 'bg-primary/10 text-primary' : 'bg-muted/80 text-muted-foreground'
            )} style={{ fontFamily: 'var(--font-mono)' }}>
              {documentCount}
            </span>
          )}
        </div>
        {isExpanded && node.children && (
          <div className="animate-fade-in">
            {node.children.map((child) => renderNode(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  const flattenedStructure = useMemo(() => flattenStructure(activeStructure), [activeStructure]);

  const selectedNodeData = useMemo(
    () => flattenedStructure.find((node) => node.id === selectedNode),
    [flattenedStructure, selectedNode]
  );

  const nodeDocuments = selectedNodeData ? collectDocuments(selectedNodeData) : [];

  const statusStyles: Record<Document['status'], string> = {
    Approved: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    Drafting: 'bg-amber-50 text-amber-800 border-amber-200',
    'To Do': 'bg-stone-50 text-stone-600 border-stone-200',
    'In Review': 'bg-blue-50 text-blue-800 border-blue-200',
    'Changes Requested': 'bg-orange-50 text-orange-800 border-orange-200'
  };

  const statusDotColors: Record<Document['status'], string> = {
    Approved: 'bg-emerald-500',
    Drafting: 'bg-amber-500',
    'To Do': 'bg-stone-400',
    'In Review': 'bg-blue-500',
    'Changes Requested': 'bg-orange-500'
  };

  return (
    <div className="flex h-screen">
      <div className="w-72 border-r border-border/50 bg-sidebar p-5 overflow-auto">
        <div className="mb-5 pb-3 border-b border-border/40">
          <span className="dossier-meta text-[10px] text-muted-foreground/70">Program</span>
          <h3 className="text-sm font-semibold mt-0.5 truncate" style={{ fontFamily: 'var(--font-display)' }}>{programId.toUpperCase()}</h3>
        </div>
        <div className="space-y-0.5">
          {isLoadingStructure ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground p-3">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading sections...
            </div>
          ) : structureError ? (
            <div className="text-sm text-destructive p-2">{structureError}</div>
          ) : (
            activeStructure.map((node) => renderNode(node))
          )}
        </div>
      </div>

      <div className="flex-1 overflow-hidden flex flex-col">
        <div className="border-b border-border/50 p-4 bg-card/80 flex-shrink-0">
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink href="#" onClick={onBack} className="flex items-center gap-1">
                  <Home className="h-3 w-3" />
                  Home
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>{programId.toUpperCase()}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>

        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as typeof activeTab)} className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="!w-full !justify-start !rounded-none !border-b !border-[rgba(31,26,20,0.15)] !bg-[rgba(248,243,237,0.95)] !px-6 !py-0 !h-auto !gap-0 flex-shrink-0">
            <TabsTrigger
              value="dossier"
              className="!relative !rounded-none !px-4 !py-3 !text-sm !bg-transparent !text-[rgba(31,26,20,0.45)] !border-b-[3px] !border-transparent !border-t-0 !border-l-0 !border-r-0 !transition-all !duration-150 hover:!text-[rgba(31,26,20,0.7)] hover:!bg-[rgba(31,26,20,0.04)] data-[state=active]:!bg-white data-[state=active]:!text-[rgba(31,59,52,1)] data-[state=active]:!font-semibold data-[state=active]:!border-b-[rgba(31,59,52,0.9)] data-[state=active]:!shadow-[0_1px_3px_rgba(0,0,0,0.08)]"
            >
              Dossier
            </TabsTrigger>
            <TabsTrigger
              value="data-vault"
              className="!relative !rounded-none !px-4 !py-3 !text-sm !bg-transparent !text-[rgba(31,26,20,0.45)] !border-b-[3px] !border-transparent !border-t-0 !border-l-0 !border-r-0 !transition-all !duration-150 hover:!text-[rgba(31,26,20,0.7)] hover:!bg-[rgba(31,26,20,0.04)] data-[state=active]:!bg-white data-[state=active]:!text-[rgba(31,59,52,1)] data-[state=active]:!font-semibold data-[state=active]:!border-b-[rgba(31,59,52,0.9)] data-[state=active]:!shadow-[0_1px_3px_rgba(0,0,0,0.08)]"
            >
              Data Vault
            </TabsTrigger>
            <TabsTrigger
              value="settings"
              className="!relative !rounded-none !px-4 !py-3 !text-sm !bg-transparent !text-[rgba(31,26,20,0.45)] !border-b-[3px] !border-transparent !border-t-0 !border-l-0 !border-r-0 !transition-all !duration-150 hover:!text-[rgba(31,26,20,0.7)] hover:!bg-[rgba(31,26,20,0.04)] data-[state=active]:!bg-white data-[state=active]:!text-[rgba(31,59,52,1)] data-[state=active]:!font-semibold data-[state=active]:!border-b-[rgba(31,59,52,0.9)] data-[state=active]:!shadow-[0_1px_3px_rgba(0,0,0,0.08)]"
            >
              Settings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dossier" className="flex-1 overflow-auto px-6 py-6 data-[state=active]:flex data-[state=active]:flex-col">
            <div className="flex flex-col gap-6 min-h-0">
              <div className="flex-shrink-0 flex items-start justify-between gap-4 animate-fade-in">
                <div>
                  <h2 className="text-xl font-semibold tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>{selectedNodeData?.name}</h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    Manage drafting status and jump into authoring from here.
                  </p>
                </div>
                <Button onClick={onViewFullReport} variant="outline" className="gap-2 border-border/60 hover:border-primary/30 hover:bg-primary/5 transition-colors">
                  <FileText className="h-4 w-4" />
                  View Full Report
                </Button>
              </div>

              <div className="border rounded-lg overflow-auto flex-1 min-h-0">
                <table className="w-full">
                  <thead className="border-b bg-muted/40 sticky top-0">
                    <tr>
                      <th className="w-12 p-4 text-left">
                        <Checkbox
                          checked={nodeDocuments.length > 0 && selectedDocs.size === nodeDocuments.length}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedDocs(new Set(nodeDocuments.map((doc) => doc.id)));
                            } else {
                              setSelectedDocs(new Set());
                            }
                          }}
                        />
                      </th>
                      <th className="p-4 text-left text-xs font-medium uppercase tracking-wide">Name</th>
                      <th className="p-4 text-left text-xs font-medium uppercase tracking-wide">Status</th>
                      <th className="p-4 text-left text-xs font-medium uppercase tracking-wide">Last Updated</th>
                      <th className="p-4 text-left text-xs font-medium uppercase tracking-wide">Reviewers</th>
                      <th className="p-4 text-left text-xs font-medium uppercase tracking-wide">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {nodeDocuments.map((doc) => {
                      const docState = activeDocuments[doc.id] ?? doc;
                      return (
                        <tr key={doc.id} className="border-b last:border-0 table-row-hover">
                          <td className="p-4">
                            <Checkbox
                              checked={selectedDocs.has(doc.id)}
                              onCheckedChange={(checked) => {
                                setSelectedDocs((prev) => {
                                  const next = new Set(prev);
                                  if (checked) next.add(doc.id);
                                  else next.delete(doc.id);
                                  return next;
                                });
                              }}
                            />
                          </td>
                          <td className="p-4 text-sm font-medium">{docState.name}</td>
                          <td className="p-4">
                            <Badge variant="outline" className={`${statusStyles[docState.status]} text-[11px] font-medium px-2 py-0 h-5`}>
                              <span className={`inline-block h-1.5 w-1.5 rounded-full mr-1.5 ${statusDotColors[docState.status]}`} />
                              {docState.status}
                            </Badge>
                          </td>
                          <td className="p-4 text-sm text-muted-foreground">{docState.lastUpdated}</td>
                          <td className="p-4 text-sm text-muted-foreground">
                            {docState.assignedReviewers && docState.assignedReviewers.length
                              ? docState.assignedReviewers
                                  .map((id) => reviewerNameMap.get(id) ?? id)
                                  .join(', ')
                              : '—'}
                          </td>
                          <td className="p-4">
                            <div className="flex gap-2">
                              {docState.status === 'Drafting' && (
                                <Button size="sm" onClick={() => onOpenDocument(doc.id, 'author')}>
                                  Edit Draft
                                </Button>
                              )}
                              {docState.status === 'Changes Requested' && (
                                <Button size="sm" variant="destructive" onClick={() => onOpenDocument(doc.id, 'author')}>
                                  Address Feedback
                                </Button>
                              )}
                              {docState.status === 'In Review' && (
                                <>
                                  <Button size="sm" variant="outline" onClick={() => onOpenDocument(doc.id, 'author')}>
                                    View
                                  </Button>
                                  <Button size="sm" onClick={() => onOpenDocument(doc.id, 'reviewer')}>
                                    Review
                                  </Button>
                                </>
                              )}
                              {docState.status === 'Approved' && (
                                <Button size="sm" variant="outline" onClick={() => onOpenDocument(doc.id, 'author')}>
                                  View
                                </Button>
                              )}
                              {docState.status === 'To Do' && (
                                <Button size="sm" variant="outline" className="gap-2" onClick={() => onOpenDocument(doc.id, 'author')}>
                                  <Sparkles className="h-4 w-4" />
                                  Generate
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {nodeDocuments.length === 0 && (
                      <tr>
                        <td colSpan={6} className="p-6 text-center text-sm text-muted-foreground">
                          No documents available for this module.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="data-vault" className="flex-1 overflow-hidden">
            <DataVaultView
              folders={activeVaultFolders}
              files={activeVaultFiles}
              documents={activeDocuments}
              programId={isSample ? undefined : programId}
              allowFolderCreation={isSample}
              allowTagEditing={isSample}
              onUploadFiles={(files, folderPath) => {
                if (isSample) {
                  onUploadFiles(files, folderPath);
                } else {
                  handleProgramUpload(files);
                }
              }}
              onCreateFolder={onCreateFolder}
            />
          </TabsContent>

          <TabsContent value="settings" className="flex-1 overflow-auto p-6">
            <div className="rounded-md border p-6 bg-muted/20">
              <h3 className="text-sm font-medium mb-2">Program Settings</h3>
              <p className="text-sm text-muted-foreground">
                Configure workflow automations, reviewer assignments, and dossier templates. This view is
                under construction for future releases.
              </p>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
