import type { ModuleNode, Document } from '../data/mockData';
import type { ProgramSection } from './api';

interface TreeNode {
  id: string;
  name: string;
  path: string;
  children: Map<string, TreeNode>;
  section?: ProgramSection;
  sectionKey?: string;
  order?: number;
}

const pathCollator = new Intl.Collator('en', {
  numeric: true,
  sensitivity: 'base'
});

const numericPrefixRegex = /^(\d+(?:\.\d+)*)\b/;

function comparePaths(a: string, b: string): number {
  return pathCollator.compare(a, b);
}

function compareNodes(a: TreeNode, b: TreeNode): number {
  const aOrder = a.order ?? a.section?.order;
  const bOrder = b.order ?? b.section?.order;
  if (typeof aOrder === 'number' && typeof bOrder === 'number' && aOrder !== bOrder) {
    return aOrder - bOrder;
  }
  return comparePaths(a.path, b.path);
}

function getNumericPrefix(title: string): string | null {
  const match = title.match(numericPrefixRegex);
  return match?.[1] ?? null;
}

function statusToDocStatus(status: ProgramSection['status']): Document['status'] {
  switch (status) {
    case 'approved':
      return 'Approved';
    case 'reviewed':
      return 'In Review';
    case 'draft':
      return 'Drafting';
    case 'pending':
    default:
      return 'To Do';
  }
}

function formatTimestamp(): string {
  return new Date().toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
}

/**
 * Build a hierarchical ModuleNode tree from backend program sections.
 * 
 * Takes the sections record from program.json and creates a tree structure
 * that mirrors the file hierarchy, using section titles for display names.
 * 
 * @param sections - Record of section key to ProgramSection from backend
 * @param programId - The program ID for generating unique document IDs
 * @returns Object containing the ModuleNode tree and a map of documents
 */
export function buildSectionTree(
  sections: Record<string, ProgramSection>,
  programId: string
): { structure: ModuleNode[]; documents: Record<string, Document> } {
  const documents: Record<string, Document> = {};
  const root: TreeNode = {
    id: 'root',
    name: 'root',
    path: '',
    children: new Map()
  };

  const prefixToSection = new Map<string, { section: ProgramSection; key: string }>();
  for (const [sectionKey, section] of Object.entries(sections)) {
    const prefix = getNumericPrefix(section.title);
    if (prefix && !prefixToSection.has(prefix)) {
      prefixToSection.set(prefix, { section, key: sectionKey });
    }
  }

  // Sort sections by path to ensure parent folders are processed before children
  const sortedEntries = Object.entries(sections).sort((a, b) => comparePaths(a[1].path, b[1].path));

  // Build the tree structure from paths
  for (const [sectionKey, section] of sortedEntries) {
    const numericPrefix = getNumericPrefix(section.title);
    const pathWithoutFile = section.path.replace(/\/content\.md$/, '');
    const parts = numericPrefix
      ? numericPrefix.split('.').reduce<string[]>((acc, segment) => {
          const next = acc.length ? `${acc[acc.length - 1]}.${segment}` : segment;
          acc.push(next);
          return acc;
        }, [])
      : pathWithoutFile.split('/').filter(Boolean);
    
    let current = root;
    let currentPath = '';
    
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const nodeKey = numericPrefix ? `num:${part}` : part;
      currentPath = currentPath ? `${currentPath}/${nodeKey}` : nodeKey;
      
      if (!current.children.has(nodeKey)) {
        const prefixMatch = numericPrefix ? prefixToSection.get(part) : undefined;
        const displayName = prefixMatch?.section.title ?? part;
        current.children.set(nodeKey, {
          id: `${programId}-${currentPath.replace(/[/.]/g, '-')}`,
          name: displayName,
          path: part,
          order: prefixMatch?.section.order,
          children: new Map()
        });
      }
      
      current = current.children.get(nodeKey)!;
      if (typeof section.order === 'number') {
        current.order = typeof current.order === 'number' ? Math.min(current.order, section.order) : section.order;
      }
      
      // If this is the last part, attach the section data
      if (i === parts.length - 1) {
        current.section = section;
        current.sectionKey = sectionKey;
        current.order = section.order ?? current.order;
        // Use the section title as the display name
        current.name = section.title;
      }
    }
  }

  // Convert the tree structure to ModuleNode array
  function convertToModuleNode(node: TreeNode): ModuleNode {
    const children: ModuleNode[] = [];
    const docs: Document[] = [];
    const sortedChildren = Array.from(node.children.values()).sort(compareNodes);
    
    for (const child of sortedChildren) {
      children.push(convertToModuleNode(child));
    }
    
    // If a node has both children and its own section, add it as a document too
    if (node.section && node.sectionKey) {
      const docId = `${programId}-doc-${node.sectionKey}`;
      const doc: Document = {
        id: docId,
        name: node.section.title,
        summary: node.section.summary,
        status: statusToDocStatus(node.section.status),
        lastUpdated: formatTimestamp(),
        linkedSources: [],
        path: node.section.path,
        sectionKey: node.sectionKey
      };
      documents[docId] = doc;
      docs.push(doc);
    }

    docs.sort((a, b) => {
      const aOrder = a.sectionKey ? sections[a.sectionKey]?.order : undefined;
      const bOrder = b.sectionKey ? sections[b.sectionKey]?.order : undefined;
      if (typeof aOrder === 'number' && typeof bOrder === 'number' && aOrder !== bOrder) {
        return aOrder - bOrder;
      }
      return comparePaths(a.path ?? '', b.path ?? '');
    });
    
    const moduleNode: ModuleNode = {
      id: node.id,
      name: node.name
    };
    
    if (children.length > 0) {
      moduleNode.children = children;
    }
    
    if (docs.length > 0) {
      moduleNode.documents = docs;
    }
    
    return moduleNode;
  }

  // Convert root children to ModuleNode array
  const structure: ModuleNode[] = [];
  
  // Sort root children by their path/name for consistent ordering
  const sortedRootChildren = Array.from(root.children.values()).sort(compareNodes);
  
  for (const child of sortedRootChildren) {
    structure.push(convertToModuleNode(child));
  }

  return { structure, documents };
}

/**
 * Check if a sections record is empty or has no entries
 */
export function hasSections(sections: Record<string, ProgramSection> | undefined): boolean {
  return Boolean(sections && Object.keys(sections).length > 0);
}






