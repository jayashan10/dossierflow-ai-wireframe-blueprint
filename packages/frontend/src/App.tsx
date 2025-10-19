import { useMemo, useState } from 'react';
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
}

export default function App() {
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [programs, setPrograms] = useState<Program[]>(initialPrograms);
  const [structure] = useState<ModuleNode[]>(initialStructure);
  const [documents, setDocuments] = useState<DocumentMap>(() => buildDocumentMap(initialStructure));
  const [selectedProgram, setSelectedProgram] = useState<string | null>(null);
  const [selectedDocument, setSelectedDocument] = useState<string | null>(null);
  const [documentConfig, setDocumentConfig] = useState<DocumentConfig | null>(null);
  const [authoringMode, setAuthoringMode] = useState<'author' | 'reviewer'>('author');
  const [currentReviewerId, setCurrentReviewerId] = useState<string>('regina');
  const [isProgramWizardOpen, setProgramWizardOpen] = useState(false);

  const formatTimestamp = () => new Date().toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });

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

  const handleCreateNewProgram = () => {
    setProgramWizardOpen(true);
  };

const handleProgramCreated = (result: CreateProgramResult) => {
  const { program, templateConfig } = result;
  setPrograms((prev) => [program, ...prev]);

  if (templateConfig) {
    seedAuthoringFromTemplate(templateConfig);
  } else {
    setProgramWizardOpen(false);
  }
};

const seedAuthoringFromTemplate = (config: TemplateConfigForAuthoring) => {
  setDocumentConfig({
    documentType: config.documentType,
    templateUploaded: config.templateUploaded,
    sections: config.sections
  });
  setSelectedDocument(null);
  setAuthoringMode('author');
  setCurrentView('authoring');
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

  const authoringDocument = useMemo(() => (selectedDocument ? documents[selectedDocument] : null), [documents, selectedDocument]);
  const activeUserId = authoringMode === 'author' ? 'mark' : currentReviewerId;

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
            documents={documents}
            structure={structure}
            dataVaultFolders={dataVaultFolders}
            dataVaultFiles={dataVaultFiles}
          />
        )}
        
        {currentView === 'authoring' && (
          <AuthoringStudio
            documentId={selectedDocument || 'new'}
            documentConfig={documentConfig}
            document={authoringDocument}
            mode={authoringMode}
            currentUserId={activeUserId}
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
