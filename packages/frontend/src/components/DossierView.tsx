import { useMemo, useState } from 'react';
import { ChevronRight, ChevronDown, Home, Sparkles } from 'lucide-react';
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

const reviewerNameMap = new Map(reviewers.map((reviewer) => [reviewer.id, reviewer.name] as const));

interface DossierViewProps {
  programId: string;
  onBack: () => void;
  onOpenDocument: (documentId: string, mode?: 'author' | 'reviewer') => void;
  documents: Record<string, Document>;
  structure: ModuleNode[];
  dataVaultFolders: DataVaultFolder[];
  dataVaultFiles: DataVaultFile[];
}

export function DossierView({
  programId,
  onBack,
  onOpenDocument,
  documents,
  structure,
  dataVaultFolders,
  dataVaultFiles
}: DossierViewProps) {
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set(['module-2']));
  const [selectedNode, setSelectedNode] = useState<string>('module-2-4');
  const [selectedDocs, setSelectedDocs] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<'dossier' | 'data-vault' | 'settings'>('dossier');

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
          <span className={cn('text-sm', !hasChildren && 'text-muted-foreground')}>{node.name}</span>
        </div>
        {isExpanded && node.children && node.children.map((child) => renderNode(child, level + 1))}
      </div>
    );
  };

  const selectedNodeData = useMemo(() => {
    const flatten = (nodes: ModuleNode[]): ModuleNode[] =>
      nodes.flatMap((node) => [node, ...(node.children ? flatten(node.children) : [])]);
    return flatten(structure).find((node) => node.id === selectedNode);
  }, [structure, selectedNode]);

  const nodeDocuments = selectedNodeData?.documents || [];

  const statusStyles: Record<Document['status'], string> = {
    Approved: 'bg-green-100 text-green-800 border-green-300',
    Drafting: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    'To Do': 'bg-gray-100 text-gray-800 border-gray-300',
    'In Review': 'bg-blue-100 text-blue-800 border-blue-300',
    'Changes Requested': 'bg-orange-100 text-orange-800 border-orange-300'
  };

  return (
    <div className="flex h-full">
      <div className="w-72 border-r bg-muted/20 p-6 overflow-auto">
        <h3 className="mb-4 text-sm font-medium">Program {programId.toUpperCase()}</h3>
        <div className="space-y-1">
          {structure.map((node) => renderNode(node))}
        </div>
      </div>

      <div className="flex-1 overflow-hidden flex flex-col">
        <div className="border-b p-4 bg-white">
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

        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as typeof activeTab)} className="flex-1 flex flex-col">
          <TabsList className="border-b rounded-none justify-start bg-muted/40 px-6">
            <TabsTrigger value="dossier">Dossier</TabsTrigger>
            <TabsTrigger value="data-vault">Data Vault</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="dossier" className="flex-1 overflow-auto px-6 py-6">
            <div className="flex flex-col gap-6">
              <div>
                <h2 className="text-lg font-semibold">{selectedNodeData?.name}</h2>
                <p className="text-sm text-muted-foreground">
                  Manage drafting status and jump into authoring from here.
                </p>
              </div>

              <div className="border rounded-lg overflow-hidden">
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
                      const docState = documents[doc.id] ?? doc;
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
                                <Button size="sm" variant="outline" className="gap-2">
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
            <DataVaultView folders={dataVaultFolders} files={dataVaultFiles} documents={documents} />
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
