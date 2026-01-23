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
import { getProgram } from '../lib/api';
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
  onUploadFiles: (files: Array<{ id: string; name: string; type: string }>, folderPath: string) => void;
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

  // Use backend structure for non-sample programs if available, otherwise use prop
  const activeStructure = (!isSample && backendStructure) ? backendStructure : structure;
  const activeDocuments = (!isSample && backendStructure) 
    ? { ...documents, ...backendDocuments } 
    : documents;

  const flattenStructure = (nodes: ModuleNode[]): ModuleNode[] =>
    nodes.flatMap((node) => [node, ...(node.children ? flattenStructure(node.children) : [])]);

  const findFirstNodeWithDocuments = (nodes: ModuleNode[]): ModuleNode | null => {
    for (const node of nodes) {
      if (node.documents && node.documents.length > 0) {
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
    const documentCount = node.documents?.length ?? 0;

    return (
      <div key={node.id}>
        <div
          className={cn(
            'flex items-center gap-2 py-2 px-3 rounded-md cursor-pointer hover:bg-accent',
            isSelected && 'bg-accent',
            level > 0 && 'ml-6'
          )}
          onClick={() => {
            if (hasChildren) toggleNode(node.id);
            setSelectedNode(node.id);
          }}
        >
          {hasChildren ? (
            isExpanded ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )
          ) : (
            <div className="w-4" />
          )}
          <span className={cn('text-sm flex-1', !hasChildren && 'text-muted-foreground')}>{node.name}</span>
          {documentCount > 0 && (
            <Badge variant="outline" className="ml-auto text-xs px-1.5 py-0">
              {documentCount}
            </Badge>
          )}
        </div>
        {isExpanded && node.children && node.children.map((child) => renderNode(child, level + 1))}
      </div>
    );
  };

  const flattenedStructure = useMemo(() => flattenStructure(activeStructure), [activeStructure]);

  const selectedNodeData = useMemo(
    () => flattenedStructure.find((node) => node.id === selectedNode),
    [flattenedStructure, selectedNode]
  );

  const nodeDocuments = selectedNodeData?.documents || [];

  const statusStyles: Record<Document['status'], string> = {
    Approved: 'bg-green-100 text-green-800 border-green-300',
    Drafting: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    'To Do': 'bg-gray-100 text-gray-800 border-gray-300',
    'In Review': 'bg-blue-100 text-blue-800 border-blue-300',
    'Changes Requested': 'bg-orange-100 text-orange-800 border-orange-300'
  };

  return (
    <div className="flex h-screen">
      <div className="w-72 border-r bg-muted/20 p-6 overflow-auto">
        <h3 className="mb-4 text-sm font-medium">Program {programId.toUpperCase()}</h3>
        <div className="space-y-1">
          {isLoadingStructure ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground p-2">
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
        <div className="border-b p-4 bg-white flex-shrink-0">
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
          <TabsList className="border-b rounded-none justify-start bg-muted/40 px-6 flex-shrink-0">
            <TabsTrigger value="dossier">Dossier</TabsTrigger>
            <TabsTrigger value="data-vault">Data Vault</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="dossier" className="flex-1 overflow-auto px-6 py-6 data-[state=active]:flex data-[state=active]:flex-col">
            <div className="flex flex-col gap-6 min-h-0">
              <div className="flex-shrink-0 flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold">{selectedNodeData?.name}</h2>
                  <p className="text-sm text-muted-foreground">
                    Manage drafting status and jump into authoring from here.
                  </p>
                </div>
                <Button onClick={onViewFullReport} variant="outline" className="gap-2">
                  <FileText className="h-4 w-4" />
                  View Full Report
                </Button>
              </div>

              <div className="border rounded-lg overflow-auto flex-1 min-h-0">
                <table className="w-full">
                  <thead className="border-b bg-muted/30">
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
                        <tr key={doc.id} className="border-b last:border-0 hover:bg-muted/20">
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
                            <Badge variant="outline" className={statusStyles[docState.status]}>
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
              folders={dataVaultFolders}
              files={dataVaultFiles}
              documents={activeDocuments}
              onUploadFiles={onUploadFiles}
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
