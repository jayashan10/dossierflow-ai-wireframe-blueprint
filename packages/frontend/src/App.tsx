import { useEffect, useMemo, useState } from 'react';
import { Header } from './components/Header';
import { SetupWizard } from './components/SetupWizard';
import { Dashboard } from './components/Dashboard';
import { DossierView } from './components/DossierView';
import { AuthoringStudio } from './components/AuthoringStudio';
import { CreateProgramWizard, type CreateProgramResult, type TemplateConfigForAuthoring } from './components/CreateProgramWizard';
import {
  programs as initialPrograms,
  dossierStructure as initialStructure,
  dataVaultFolders,
  dataVaultFiles,
  type Document,
  type DocumentComment,
  type ModuleNode,
  type Program
} from './data/mockData';

type DocumentMap = Record<string, Document>;

const PROGRAM_STORAGE_KEY = 'dossierflow.customPrograms';

const loadStoredPrograms = (): Program[] => {
  if (typeof window === 'undefined') {
    return [];
  }

  try {
    const raw = window.sessionStorage.getItem(PROGRAM_STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    // Enforce Program shape for stored entries and ensure they are treated as user created items.
    return parsed
      .filter((program): program is Program => {
        if (!program || typeof program !== 'object') {
          return false;
        }
        const candidate = program as Record<string, unknown>;
        return (
          typeof candidate.id === 'string' &&
          typeof candidate.title === 'string' &&
          typeof candidate.status === 'string' &&
          typeof candidate.progress === 'number'
        );
      })
      .map((program) => ({ ...program, isSample: false }));
  } catch {
    return [];
  }
};

const cloneComment = (comment: DocumentComment): DocumentComment => ({
  ...comment,
  replies: comment.replies ? comment.replies.map(cloneComment) : []
});

const cloneDocument = (document: Document): Document => ({
  ...document,
  assignedReviewers: document.assignedReviewers ? [...document.assignedReviewers] : [],
  comments: document.comments ? document.comments.map(cloneComment) : [],
  versionHistory: document.versionHistory ? document.versionHistory.map((version) => ({ ...version })) : [],
  linkedSources: document.linkedSources ? [...document.linkedSources] : []
});

const buildDocumentMap = (structure: ModuleNode[]): DocumentMap => {
  const map: DocumentMap = {};

  const traverse = (nodes: ModuleNode[]) => {
    nodes.forEach((node) => {
      node.documents?.forEach((doc) => {
        map[doc.id] = cloneDocument(doc);
      });
      if (node.children) traverse(node.children);
    });
  };

  traverse(structure);
  return map;
};

const cloneStructure = (nodes: ModuleNode[]): ModuleNode[] =>
  nodes.map((node) => ({
    ...node,
    documents: node.documents ? node.documents.map(cloneDocument) : undefined,
    children: node.children ? cloneStructure(node.children) : undefined
  }));

const createProgramStructureFromSections = (
  programId: string,
  sections: string[],
  timestamp: string
): { structure: ModuleNode[]; documents: DocumentMap } => {
  if (!sections.length) {
    const emptyRoot: ModuleNode[] = [
      {
        id: `${programId}-sections`,
        name: 'Template Sections',
        documents: []
      }
    ];
    return { structure: emptyRoot, documents: {} };
  }

  const documents: DocumentMap = {};
  const docEntries = sections.map((title, index) => {
    const documentId = `${programId}-section-${index + 1}`;
    const document: Document = {
      id: documentId,
      name: title,
      status: 'To Do',
      lastUpdated: timestamp,
      linkedSources: []
    };
    documents[documentId] = document;
    return document;
  });

  const structure: ModuleNode[] = [
    {
      id: `${programId}-sections`,
      name: 'Template Sections',
      documents: docEntries
    }
  ];

  return { structure, documents };
};

const formatTimestamp = () =>
  new Date().toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });

const addReplyToComments = (comments: DocumentComment[], parentId: string, reply: DocumentComment): boolean => {
  for (const comment of comments) {
    if (comment.id === parentId) {
      comment.replies = [...(comment.replies ?? []), reply];
      return true;
    }
    if (comment.replies && addReplyToComments(comment.replies, parentId, reply)) {
      return true;
    }
  }
  return false;
};

type View = 'dashboard' | 'setup' | 'dossier' | 'authoring';

interface DocumentConfig {
  documentType: string;
  templateUploaded: boolean;
  sections: string[];
  sectionContent?: Record<string, string>;
}

export default function App() {
  const storedProgramsSnapshot = loadStoredPrograms();
  const storedProgramIds = new Set(storedProgramsSnapshot.map((program) => program.id));

  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [programs, setPrograms] = useState<Program[]>(() => {
    const samples = initialPrograms.filter((program) => !storedProgramIds.has(program.id));
    return [...storedProgramsSnapshot, ...samples];
  });
  const [structuresByProgram, setStructuresByProgram] = useState<Record<string, ModuleNode[]>>(() => {
    const map: Record<string, ModuleNode[]> = {};
    initialPrograms.forEach((program) => {
      map[program.id] = cloneStructure(initialStructure);
    });

    storedProgramsSnapshot.forEach((program) => {
      if (map[program.id]) {
        return;
      }
      const sections = program.defaultSections ?? [];
      const { structure } = createProgramStructureFromSections(program.id, sections, formatTimestamp());
      map[program.id] = structure;
    });

    return map;
  });
  const [documents, setDocuments] = useState<DocumentMap>(() => {
    const base = buildDocumentMap(initialStructure);
    storedProgramsSnapshot.forEach((program) => {
      const sections = program.defaultSections ?? [];
      const { documents: docMap } = createProgramStructureFromSections(program.id, sections, formatTimestamp());
      Object.assign(base, docMap);
    });
    return base;
  });
  const [selectedProgram, setSelectedProgram] = useState<string | null>(null);
  const [selectedDocument, setSelectedDocument] = useState<string | null>(null);
  const [documentConfig, setDocumentConfig] = useState<DocumentConfig | null>(null);
  const [authoringMode, setAuthoringMode] = useState<'author' | 'reviewer'>('author');
  const [currentReviewerId, setCurrentReviewerId] = useState<string>('regina');
  const [isProgramWizardOpen, setProgramWizardOpen] = useState(false);
  const [vaultFolders, setVaultFolders] = useState(dataVaultFolders);
  const [vaultFiles, setVaultFiles] = useState(dataVaultFiles);

  const mutateDocument = (documentId: string, mutator: (doc: Document) => Document) => {
    setDocuments((prev) => {
      const current = prev[documentId];
      if (!current) return prev;
      const draft = cloneDocument(current);
      const updated = mutator(draft);
      if (!updated) return prev;
      return { ...prev, [documentId]: updated };
    });
  };

  const handleSubmitForReview = (documentId: string, payload: { reviewers: string[]; note?: string }) => {
    mutateDocument(documentId, (doc) => ({
      ...doc,
      status: 'In Review',
      assignedReviewers: payload.reviewers,
      submissionNote: payload.note,
      lastUpdated: formatTimestamp()
    }));
  };

  const handleWithdrawSubmission = (documentId: string) => {
    mutateDocument(documentId, (doc) => ({
      ...doc,
      status: 'Drafting',
      submissionNote: undefined,
      lastUpdated: formatTimestamp()
    }));
  };

  const handleApprove = (documentId: string) => {
    mutateDocument(documentId, (doc) => ({
      ...doc,
      status: 'Approved',
      lastUpdated: formatTimestamp()
    }));
  };

  const handleRequestChanges = (documentId: string) => {
    mutateDocument(documentId, (doc) => ({
      ...doc,
      status: 'Changes Requested',
      lastUpdated: formatTimestamp()
    }));
  };

  const handleAddComment = (documentId: string, comment: DocumentComment) => {
    mutateDocument(documentId, (doc) => {
      doc.comments = [...(doc.comments ?? []), comment];
      doc.lastUpdated = formatTimestamp();
      return doc;
    });
  };

  const handleReplyToComment = (documentId: string, parentId: string, reply: DocumentComment) => {
    mutateDocument(documentId, (doc) => {
      doc.comments = doc.comments ?? [];
      addReplyToComments(doc.comments, parentId, reply);
      doc.lastUpdated = formatTimestamp();
      return doc;
    });
  };

  const handleUploadFiles = (newFiles: Array<{ id: string; name: string; type: string }>, folderPath: string) => {
    setVaultFiles((prev) => [
      ...newFiles.map((file) => ({
        id: file.id,
        name: file.name,
        type: file.type,
        lastUpdated: formatTimestamp(),
        tags: [],
        folderPath,
        status: 'Draft' as const,
        versions: [{ id: `${file.id}-v1`, label: 'v1.0 (current)', date: formatTimestamp() }],
        linkedDocuments: []
      })),
      ...prev
    ]);
  };

  const handleCreateFolder = (folderName: string, parentPath: string) => {
    const newPath = parentPath === '/' ? `/${folderName}` : `${parentPath}/${folderName}`;
    const newFolderId = `folder-${Date.now()}`;

    setVaultFolders((prev) => {
      const addToFolder = (folders: typeof dataVaultFolders): typeof dataVaultFolders => {
        return folders.map((folder) => {
          if (folder.path === parentPath) {
            return {
              ...folder,
              children: [
                ...(folder.children ?? []),
                {
                  id: newFolderId,
                  name: folderName,
                  path: newPath
                }
              ]
            };
          }
          if (folder.children) {
            return {
              ...folder,
              children: addToFolder(folder.children)
            };
          }
          return folder;
        });
      };
      return addToFolder(prev);
    });
  };

  const handleCreateNewProgram = () => {
    setProgramWizardOpen(true);
  };

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const customPrograms = programs.filter((program) => !program.isSample);
    try {
      window.sessionStorage.setItem(PROGRAM_STORAGE_KEY, JSON.stringify(customPrograms));
    } catch {
      // Swallow storage exceptions (e.g., quota exceeded) silently for now.
    }
  }, [programs]);

  const handleProgramCreated = (result: CreateProgramResult) => {
    const { program, templateConfig } = result;

    const sectionsFromConfig = templateConfig
      ? (templateConfig.refinedSections.length
          ? templateConfig.refinedSections.map((section) => section.title)
          : [...templateConfig.rawSections])
      : program.defaultSections ?? [];

    const enrichedProgram: Program = {
      ...program,
      defaultSections: sectionsFromConfig.length ? sectionsFromConfig : program.defaultSections,
      sectionCount: sectionsFromConfig.length || program.sectionCount
    };

    setPrograms((prev) => [enrichedProgram, ...prev]);
    setSelectedProgram(enrichedProgram.id);

    const timestamp = formatTimestamp();
    const { structure: generatedStructure, documents: generatedDocuments } = createProgramStructureFromSections(
      enrichedProgram.id,
      enrichedProgram.defaultSections ?? [],
      timestamp
    );

    setStructuresByProgram((prev) => ({
      ...prev,
      [enrichedProgram.id]: generatedStructure
    }));

    if (Object.keys(generatedDocuments).length > 0) {
      setDocuments((prev) => ({
        ...prev,
        ...generatedDocuments
      }));
    }

    if (templateConfig) {
      seedAuthoringFromTemplate(templateConfig);
    } else {
      setCurrentView('dossier');
      setProgramWizardOpen(false);
    }
  };

  const seedAuthoringFromTemplate = (config: TemplateConfigForAuthoring) => {
    // After template upload, go directly to dossier view instead of authoring
    setDocumentConfig(null);
    setSelectedDocument(null);
    setAuthoringMode('author');
    setCurrentView('dossier');
    setProgramWizardOpen(false);
  };

  const handleSetupComplete = (config: DocumentConfig) => {
    setDocumentConfig(config);
    setCurrentView('authoring');
  };

  const handleProgramClick = (programId: string) => {
    setSelectedProgram(programId);
    setCurrentView('dossier');
  };

  const handleOpenDocument = (documentId: string, mode: 'author' | 'reviewer' = 'author') => {
    setSelectedDocument(documentId);
    setDocumentConfig(null);
    setAuthoringMode(mode);
    if (mode === 'reviewer') {
      const assigned = documents[documentId]?.assignedReviewers;
      setCurrentReviewerId(assigned?.[0] ?? 'regina');
    } else {
      setCurrentReviewerId('regina');
    }
    setCurrentView('authoring');
  };

  const handleBackToDashboard = () => {
    setCurrentView('dashboard');
    setSelectedProgram(null);
    setSelectedDocument(null);
    setDocumentConfig(null);
    setAuthoringMode('author');
  };

  const handleBackToDossier = () => {
    setCurrentView('dossier');
    setSelectedDocument(null);
    setDocumentConfig(null);
    setAuthoringMode('author');
  };

  const handleViewFullReport = () => {
    // Extract all document/section names and content from the current structure
    const allSections: string[] = [];
    const sectionContent: Record<string, string> = {};
    const traverse = (nodes: ModuleNode[]) => {
      nodes.forEach((node) => {
        if (node.documents) {
          node.documents.forEach((doc) => {
            const docState = documents[doc.id] ?? doc;
            allSections.push(docState.name);
            if (docState.content) {
              sectionContent[docState.name] = docState.content;
            }
          });
        }
        if (node.children) {
          traverse(node.children);
        }
      });
    };
    traverse(currentStructure);

    // Show authoring view with all sections in the table of contents
    setDocumentConfig({
      documentType: selectedProgram || 'Document',
      templateUploaded: true,
      sections: allSections,
      sectionContent
    });
    setSelectedDocument(null);
    setAuthoringMode('author');
    setCurrentView('authoring');
  };

  const authoringDocument = useMemo(() => (selectedDocument ? documents[selectedDocument] : null), [documents, selectedDocument]);
  const activeUserId = authoringMode === 'author' ? 'mark' : currentReviewerId;
  const currentStructure = selectedProgram ? structuresByProgram[selectedProgram] ?? [] : [];

  return (
    <div className="h-screen flex flex-col bg-background">
      {currentView !== 'authoring' && currentView !== 'setup' && (
        <Header onLogoClick={handleBackToDashboard} />
      )}

      <div className="flex-1 overflow-hidden">
        {currentView === 'dashboard' && (
          <Dashboard 
            onProgramClick={handleProgramClick}
            onCreateNew={handleCreateNewProgram}
            programs={programs}
          />
        )}

        {currentView === 'setup' && (
          <SetupWizard 
            onComplete={handleSetupComplete}
            onCancel={handleBackToDashboard}
          />
        )}
        
        {currentView === 'dossier' && selectedProgram && (
          <DossierView
            programId={selectedProgram}
            onBack={handleBackToDashboard}
            onOpenDocument={handleOpenDocument}
            onViewFullReport={handleViewFullReport}
            documents={documents}
            structure={currentStructure}
            dataVaultFolders={vaultFolders}
            dataVaultFiles={vaultFiles}
            onUploadFiles={handleUploadFiles}
            onCreateFolder={handleCreateFolder}
          />
        )}

        {currentView === 'authoring' && (
          <AuthoringStudio
            documentId={selectedDocument || 'new'}
            documentConfig={documentConfig}
            document={authoringDocument}
            mode={authoringMode}
            currentUserId={activeUserId}
            programId={selectedProgram ?? undefined}
            programName={selectedProgram ? programs.find(p => p.id === selectedProgram)?.title : undefined}
            onBack={selectedDocument ? handleBackToDossier : handleBackToDashboard}
            onSubmitForReview={(payload) => {
              if (selectedDocument) {
                handleSubmitForReview(selectedDocument, payload);
              }
            }}
            onWithdrawSubmission={() => {
              if (selectedDocument) {
                handleWithdrawSubmission(selectedDocument);
              }
            }}
            onApprove={() => {
              if (selectedDocument) {
                handleApprove(selectedDocument);
              }
            }}
            onRequestChanges={() => {
              if (selectedDocument) {
                handleRequestChanges(selectedDocument);
              }
            }}
            onCreateComment={(comment) => {
              if (selectedDocument) {
                handleAddComment(selectedDocument, comment);
              }
            }}
            onReplyToComment={(parentId, reply) => {
              if (selectedDocument) {
                handleReplyToComment(selectedDocument, parentId, reply);
              }
            }}
            onUpdateDocument={(mutator) => {
              if (selectedDocument) {
                mutateDocument(selectedDocument, mutator);
              }
            }}
          />
        )}
      </div>

      <CreateProgramWizard
        open={isProgramWizardOpen}
        onClose={() => setProgramWizardOpen(false)}
        onCreate={handleProgramCreated}
      />
    </div>
  );
}
