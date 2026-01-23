import type { ModuleNode, Document } from '../data/mockData';
import type { ProgramSection } from './api';

interface TreeNode {
  id: string;
  name: string;
  path: string;
  children: Map<string, TreeNode>;
  section?: ProgramSection;
  sectionKey?: string;
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

  // Sort sections by path to ensure parent folders are processed before children
  const sortedEntries = Object.entries(sections).sort((a, b) => 
    a[1].path.localeCompare(b[1].path)
  );

  // Build the tree structure from paths
  for (const [sectionKey, section] of sortedEntries) {
    const pathWithoutFile = section.path.replace(/\/content\.md$/, '');
    const parts = pathWithoutFile.split('/').filter(Boolean);
    
    let current = root;
    let currentPath = '';
    
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      
      if (!current.children.has(part)) {
        current.children.set(part, {
          id: `${programId}-${currentPath.replace(/\//g, '-')}`,
          name: part,
          path: currentPath,
          children: new Map()
        });
      }
      
      current = current.children.get(part)!;
      
      // If this is the last part, attach the section data
      if (i === parts.length - 1) {
        current.section = section;
        current.sectionKey = sectionKey;
        // Use the section title as the display name
        current.name = section.title;
      }
    }
  }

  // Convert the tree structure to ModuleNode array
  function convertToModuleNode(node: TreeNode): ModuleNode {
    const children: ModuleNode[] = [];
    const docs: Document[] = [];
    
    for (const child of node.children.values()) {
      if (child.children.size > 0) {
        // This node has children, so it's a folder
        children.push(convertToModuleNode(child));
      } else if (child.section) {
        // This is a leaf node with section data - create a document
        const docId = `${programId}-doc-${child.sectionKey}`;
        const doc: Document = {
          id: docId,
          name: child.section.title,
          status: statusToDocStatus(child.section.status),
          lastUpdated: formatTimestamp(),
          linkedSources: []
        };
        documents[docId] = doc;
        docs.push(doc);
      }
    }
    
    // If a node has both children and its own section, add it as a document too
    if (node.section && node.sectionKey) {
      const docId = `${programId}-doc-${node.sectionKey}`;
      const doc: Document = {
        id: docId,
        name: node.section.title,
        status: statusToDocStatus(node.section.status),
        lastUpdated: formatTimestamp(),
        linkedSources: []
      };
      documents[docId] = doc;
      docs.push(doc);
    }
    
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
  const sortedRootChildren = Array.from(root.children.values()).sort((a, b) => {
    // Extract numeric prefix for natural sorting (e.g., "Module-1" before "Module-10")
    const aMatch = a.path.match(/^Module-(\d+)/);
    const bMatch = b.path.match(/^Module-(\d+)/);
    
    if (aMatch && bMatch) {
      return parseInt(aMatch[1], 10) - parseInt(bMatch[1], 10);
    }
    
    return a.path.localeCompare(b.path);
  });
  
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






