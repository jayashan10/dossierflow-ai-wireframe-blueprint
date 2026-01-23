import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  MessageSquare,
  Clock,
  Sparkles,
  X,
  FileText,
  ChevronLeft,
  Search,
  Bold,
  Italic,
  Underline,
  List,
  Table,
  Link,
  StopCircle,
  Plus,
  FolderOpen
} from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Separator } from './ui/separator';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { MentionableTextarea } from './ui/mentionable-textarea';
import { StreamingPreview } from './StreamingPreview';
import { RichTextEditor } from './RichTextEditor';
import { sourceDocs, reviewers } from '../data/mockData';
import type { Document, DocumentComment } from '../data/mockData';
import { fetchSources, streamGenerateContent } from '../lib/api';
import type { SourceSummary, StreamEvent } from '../lib/api';
import { SubmitForReviewDialog } from './review/SubmitForReviewDialog';
import { CommentThread } from './review/CommentThread';
import { VersionHistoryDrawer } from './VersionHistoryDrawer';
import { BackendPane } from './backend-pane';

interface DocumentConfig {
  documentType: string;
  templateUploaded: boolean;
  sections: string[];
  sectionContent?: Record<string, string>;
}

interface AuthoringStudioProps {
  documentId: string;
  documentConfig: DocumentConfig | null;
  document?: Document | null;
  mode: 'author' | 'reviewer';
  currentUserId: string;
  programId?: string;
  programName?: string;
  isSample?: boolean;
  onBack: () => void;
  onSubmitForReview: (payload: { reviewers: string[]; note?: string }) => void;
  onWithdrawSubmission: () => void;
  onApprove: () => void;
  onRequestChanges: () => void;
  onCreateComment: (comment: DocumentComment) => void;
  onReplyToComment: (parentId: string, reply: DocumentComment) => void;
  onUpdateDocument: (mutator: (doc: Document) => Document) => void;
}

// Default sections for existing documents
const existingDocSections = [
  '2.6.2.1 Brief Summary',
  '2.6.2.2 Primary Pharmacodynamics',
  '2.6.2.3 Secondary Pharmacodynamics',
  '2.6.2.4 Safety Pharmacology',
  '2.6.2.5 Pharmacodynamic Drug Interactions'
];

const defaultPromptTemplate = 'You are drafting the Primary Pharmacodynamics section. Use the following sources to generate a summary and a data table.';
const reviewerLookup = new Map(reviewers.map((reviewer) => [reviewer.id, reviewer.name] as const));

const formatTimestamp = () => new Date().toLocaleString('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit'
});

const toSectionId = (title: string) => {
  const normalized = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return normalized || title;
};

const findCommentById = (comments: DocumentComment[] | undefined, id: string): DocumentComment | undefined => {
  if (!comments) return undefined;
  for (const comment of comments) {
    if (comment.id === id) return comment;
    const nested = findCommentById(comment.replies, id);
    if (nested) return nested;
  }
  return undefined;
};

export function AuthoringStudio({
  documentId,
  documentConfig,
  document: documentProp,
  mode,
  currentUserId,
  programId,
  programName,
  isSample = false,
  onBack,
  onSubmitForReview,
  onWithdrawSubmission,
  onApprove,
  onRequestChanges,
  onCreateComment,
  onReplyToComment,
  onUpdateDocument
}: AuthoringStudioProps) {
  const currentDocument = documentProp ?? null;
  // Only use mock data for sample programs
  const initialSelectedSources = isSample ? sourceDocs.slice(0, 2).map((source) => source.id) : [];
  const initialAvailableSources = isSample ? sourceDocs : [];
  const [selectedSources, setSelectedSources] = useState<string[]>(initialSelectedSources);
  const [availableSources, setAvailableSources] = useState<SourceSummary[]>(initialAvailableSources);
  const [isLoadingSources, setIsLoadingSources] = useState(false);
  const [sourcesError, setSourcesError] = useState<string | null>(null);
  const [sourceSearch, setSourceSearch] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [selectedSection, setSelectedSection] = useState<string | null>(null);
  const [promptValue, setPromptValue] = useState(defaultPromptTemplate);
  const [sectionDrafts, setSectionDrafts] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState<'generate' | 'sources' | 'comments' | 'files'>(mode === 'reviewer' ? 'comments' : 'generate');
  const [isSubmitDialogOpen, setSubmitDialogOpen] = useState(false);
  const [isVersionDrawerOpen, setVersionDrawerOpen] = useState(false);
  const [newCommentText, setNewCommentText] = useState('');

  // Streaming state
  const [streamingContent, setStreamingContent] = useState('');
  const [streamingEvents, setStreamingEvents] = useState<StreamEvent[]>([]);
  const [mentionedFileIds, setMentionedFileIds] = useState<string[]>([]);
  const [fileSearchQuery, setFileSearchQuery] = useState('');
  const cancelStreamRef = useRef<(() => void) | null>(null);
  const docStatus = currentDocument?.status ?? 'Drafting';
  const assignedReviewerNames = currentDocument?.assignedReviewers?.map((id) => reviewerLookup.get(id) ?? id) ?? [];
  const isInReview = docStatus === 'In Review';
  const isChangesRequested = docStatus === 'Changes Requested';
  const isReadOnly = mode === 'reviewer' || (mode === 'author' && isInReview);
  const canSubmitForReview = Boolean(currentDocument && (docStatus === 'Drafting' || docStatus === 'Changes Requested'));
  const currentUserName = reviewerLookup.get(currentUserId) ?? 'You';
  const documentComments = currentDocument?.comments ?? [];
  const versionHistory = currentDocument?.versionHistory ?? [];
  const isExistingDocument = Boolean(currentDocument);
  const statusBadgeStyles: Record<Document['status'], string> = {
    Approved: 'bg-green-100 text-green-800 border-green-300',
    Drafting: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    'To Do': 'bg-gray-100 text-gray-800 border-gray-300',
    'In Review': 'bg-blue-100 text-blue-800 border-blue-300',
    'Changes Requested': 'bg-orange-100 text-orange-800 border-orange-300'
  };

  // Use sections from config if available, otherwise use the current document's name as a single section
  const sections = documentConfig?.sections || (currentDocument?.name ? [currentDocument.name] : existingDocSections);
  const isNewDocument = documentConfig !== null;

  useEffect(() => {
    if (mode === 'reviewer') {
      setActiveTab('comments');
    }
  }, [mode]);

  useEffect(() => {
    // Cancel any ongoing generation when document changes
    if (cancelStreamRef.current) {
      cancelStreamRef.current();
      cancelStreamRef.current = null;
    }
    setSelectedSection(null);
    setGenerationError(null);
    setStreamingContent('');
    setStreamingEvents([]);
    setNewCommentText('');
    setIsGenerating(false);
  }, [documentId]);

  // Auto-select the first section when sections are available
  useEffect(() => {
    if (sections.length > 0 && !selectedSection) {
      setSelectedSection(sections[0]);
    }
  }, [sections, selectedSection]);

  // Pre-populate source selection from document's linkedSources
  useEffect(() => {
    if (currentDocument?.linkedSources?.length) {
      setSelectedSources((prev) => {
        const combined = new Set([...prev, ...currentDocument.linkedSources!]);
        return Array.from(combined);
      });
    }
  }, [currentDocument?.id, currentDocument?.linkedSources]);

  // Load saved content from document (single document mode)
  useEffect(() => {
    if (currentDocument?.content && currentDocument.name) {
      setSectionDrafts((prev) => ({
        ...prev,
        [currentDocument.name]: currentDocument.content!
      }));
    }
  }, [currentDocument?.id, currentDocument?.content, currentDocument?.name]);

  // Load saved content from documentConfig (full report mode)
  useEffect(() => {
    if (documentConfig?.sectionContent) {
      setSectionDrafts((prev) => ({
        ...prev,
        ...documentConfig.sectionContent
      }));
    }
  }, [documentConfig]);

  useEffect(() => {
    let cancelled = false;
    const loadSources = async () => {
      setIsLoadingSources(true);
      try {
        const response = await fetchSources();
        if (!cancelled && response.length) {
          setAvailableSources(response);
          setSourcesError(null);
        }
      } catch (error) {
        if (!cancelled) {
          setSourcesError(error instanceof Error ? error.message : 'Unable to load sources');
        }
      } finally {
        if (!cancelled) {
          setIsLoadingSources(false);
        }
      }
    };

    loadSources();

    return () => {
      cancelled = true;
    };
  }, []);

  const sourceIndex = useMemo(() => {
    const map = new Map<string, SourceSummary>();
    // Only include mock data for sample programs
    if (isSample) {
      for (const source of sourceDocs) {
        map.set(source.id, source);
      }
    }
    for (const source of availableSources) {
      map.set(source.id, source);
    }
    return map;
  }, [availableSources, isSample]);

  // Only fall back to mock data for sample programs
  const baseSources = availableSources.length ? availableSources : (isSample ? sourceDocs : []);

  const filteredSources = useMemo(() => {
    if (!sourceSearch.trim()) {
      return baseSources;
    }
    const query = sourceSearch.toLowerCase();
    return baseSources.filter((source) => source.name.toLowerCase().includes(query));
  }, [baseSources, sourceSearch]);

  // Partition sources into linked (to current document) and unlinked
  const { linkedSourcesList, unlinkedSourcesList } = useMemo(() => {
    const linkedIds = new Set(currentDocument?.linkedSources || []);
    const linked: SourceSummary[] = [];
    const unlinked: SourceSummary[] = [];
    for (const source of filteredSources) {
      if (linkedIds.has(source.id)) {
        linked.push(source);
      } else {
        unlinked.push(source);
      }
    }
    return { linkedSourcesList: linked, unlinkedSourcesList: unlinked };
  }, [filteredSources, currentDocument?.linkedSources]);

  const generatedDraftForSection = selectedSection ? sectionDrafts[selectedSection] : undefined;
  const canGenerate = Boolean(selectedSection && promptValue.trim());

  const handleSectionSelect = (section: string) => {
    // Cancel any ongoing generation when switching sections
    if (cancelStreamRef.current) {
      cancelStreamRef.current();
      cancelStreamRef.current = null;
      setIsGenerating(false);
    }
    setSelectedSection(section);
    setGenerationError(null);
    setStreamingContent('');
    setStreamingEvents([]);
  };

  const handleAddSource = (sourceId: string) => {
    if (isReadOnly) return;
    setSelectedSources((prev) => (prev.includes(sourceId) ? prev : [...prev, sourceId]));
  };

  const handleGenerate = useCallback(() => {
    if (!selectedSection || !canGenerate || isReadOnly) {
      return;
    }

    // Cancel any existing stream
    if (cancelStreamRef.current) {
      cancelStreamRef.current();
    }

    setIsGenerating(true);
    setGenerationError(null);
    setStreamingContent('');
    setStreamingEvents([]);

    const cancel = streamGenerateContent(
      {
        sectionId: toSectionId(selectedSection),
        sectionTitle: selectedSection,
        prompt: promptValue,
        selectedSourceIds: selectedSources,
        mentionedFileIds
      },
      {
        onEvent: (event) => {
          setStreamingEvents((prev) => [...prev, event]);

          if (event.type === 'text' && event.content) {
            setStreamingContent((prev) => prev + event.content);
          }

          if (event.type === 'complete') {
            // Stop the loading state immediately upon complete event
            setIsGenerating(false);

            if (event.content) {
              // Save the final content to local state
              setSectionDrafts((prev) => ({
                ...prev,
                [selectedSection]: event.content!
              }));
              setStreamingContent(event.content);

              // Persist content and linked sources to document
              if (onUpdateDocument) {
                onUpdateDocument((doc) => ({
                  ...doc,
                  content: event.content,
                  status: doc.status === 'To Do' ? 'Drafting' : doc.status,
                  linkedSources: [...new Set([...(doc.linkedSources || []), ...selectedSources, ...mentionedFileIds])],
                  lastUpdated: formatTimestamp()
                }));
              }
            }
          }

          if (event.type === 'error' && event.error) {
            setGenerationError(event.error);
          }
        },
        onComplete: () => {
          setIsGenerating(false);
          cancelStreamRef.current = null;
        },
        onError: (error) => {
          setGenerationError(error);
          setIsGenerating(false);
          cancelStreamRef.current = null;
        }
      }
    );

    cancelStreamRef.current = cancel;
  }, [selectedSection, canGenerate, isReadOnly, promptValue, selectedSources, mentionedFileIds, onUpdateDocument]);

  const handleCancelGeneration = useCallback(() => {
    if (cancelStreamRef.current) {
      cancelStreamRef.current();
      cancelStreamRef.current = null;
      setIsGenerating(false);
    }
  }, []);

  const removeSource = (sourceId: string) => {
    if (isReadOnly) return;
    setSelectedSources((prev) => prev.filter(id => id !== sourceId));
  };

  const getFileIcon = (type: string) => {
    return <FileText className="h-4 w-4" />;
  };

  const handleSubmitReview = (payload: { reviewers: string[]; note?: string }) => {
    onSubmitForReview(payload);
    setSubmitDialogOpen(false);
  };

  const handleCreateComment = () => {
    if (!currentDocument || !selectedSection || !newCommentText.trim()) return;
    const comment: DocumentComment = {
      id: `comment-${Date.now()}`,
      author: currentUserName,
      createdAt: formatTimestamp(),
      text: newCommentText.trim(),
      section: selectedSection,
      replies: []
    };
    onCreateComment(comment);
    setNewCommentText('');
    setActiveTab('comments');
  };

  const handleReply = (parentId: string, text: string) => {
    if (!currentDocument || !text.trim()) return;
    const parent = findCommentById(currentDocument.comments, parentId);
    const reply: DocumentComment = {
      id: `reply-${Date.now()}`,
      author: currentUserName,
      createdAt: formatTimestamp(),
      text,
      section: parent?.section ?? selectedSection ?? 'General'
    };
    onReplyToComment(parentId, reply);
  };

  const handleRestoreVersion = (versionId: string) => {
    if (!currentDocument) return;
    const version = versionHistory.find((entry) => entry.id === versionId);
    if (!version) return;

    onUpdateDocument((prev) => ({
      ...prev,
      status: 'Drafting',
      lastUpdated: formatTimestamp(),
      versionHistory: [
        {
          id: `restore-${Date.now()}`,
          label: `Restored from ${version.label}`,
          createdAt: formatTimestamp(),
          author: currentUserName,
          status: 'Drafting',
          summary: 'Restored from version history.',
          content: version.content
        },
        ...(prev.versionHistory ?? [])
      ]
    }));
  };

  const bannerMessage = (() => {
    if (!currentDocument) return null;
    if (mode === 'author' && isInReview) {
      return (
        <Alert className="mb-4">
          <AlertTitle>Awaiting review</AlertTitle>
          <AlertDescription className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <span>
              Awaiting review from {assignedReviewerNames.join(' and ')}.
              {currentDocument.submissionNote ? ` Note: ${currentDocument.submissionNote}` : ''}
            </span>
            <Button variant="outline" size="sm" onClick={onWithdrawSubmission}>
              Withdraw Submission
            </Button>
          </AlertDescription>
        </Alert>
      );
    }

    if (mode === 'author' && isChangesRequested) {
      return (
        <Alert variant="destructive" className="mb-4">
          <AlertTitle>Changes requested</AlertTitle>
          <AlertDescription>
            Reviewers left feedback. Address the comments below and resubmit when ready.
          </AlertDescription>
        </Alert>
      );
    }

    if (mode === 'reviewer' && isInReview) {
      return (
        <Alert className="mb-4 border-blue-200 bg-blue-50">
          <AlertTitle>This document is ready for your review.</AlertTitle>
          <AlertDescription>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" onClick={onRequestChanges}>
                Request Changes
              </Button>
              <Button size="sm" onClick={onApprove}>
                Approve
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      );
    }

    return null;
  })();

  return (
    <div className="flex flex-col h-screen">
      {/* Editor Header */}
      <div className="border-b p-4">
        {bannerMessage}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={onBack}>
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <div>
              <h3>{currentDocument?.name ?? (documentConfig?.documentType ?? 'Document')}</h3>
              <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                <span>Status:</span>
                <Badge variant="outline" className={statusBadgeStyles[docStatus]}>
                  {docStatus}
                </Badge>
                {currentDocument?.lastUpdated && <span>• Updated {currentDocument.lastUpdated}</span>}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" className="gap-2" onClick={() => setActiveTab('comments')}>
              <MessageSquare className="h-4 w-4" />
              Comments
            </Button>
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => setVersionDrawerOpen(true)}
              disabled={!versionHistory.length}
            >
              <Clock className="h-4 w-4" />
              Version History
            </Button>
            {mode === 'author' && isExistingDocument && (
              <Button
                className="gap-2"
                onClick={() => setSubmitDialogOpen(true)}
                disabled={!canSubmitForReview}
              >
                Submit for Review
              </Button>
            )}
          </div>
        </div>

        {/* Formatting Toolbar */}
        <div className={`flex items-center gap-1 border rounded-md p-1 bg-muted/20 ${isReadOnly ? 'pointer-events-none opacity-60' : ''}`}>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
            <Bold className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
            <Italic className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
            <Underline className="h-4 w-4" />
          </Button>
          <Separator orientation="vertical" className="mx-1 h-6" />
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
            <List className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
            <Table className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
            <Link className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Main Content Area - Either Files view or Document Editor + Sidebar */}
      {activeTab === 'files' && programId && programName ? (
        /* Full-width Files/Backend Pane */
        <div className="flex flex-1 overflow-hidden flex-col">
          {/* Tab bar for switching back */}
          <div className="border-b bg-muted/10">
            <div className="flex items-center px-4">
              <button
                onClick={() => setActiveTab('generate')}
                className="flex items-center gap-2 px-4 py-3 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <Sparkles className="h-4 w-4" />
                Generate
              </button>
              <button
                onClick={() => setActiveTab('sources')}
                className="flex items-center gap-2 px-4 py-3 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Sources
              </button>
              <button
                onClick={() => setActiveTab('comments')}
                className="flex items-center gap-2 px-4 py-3 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Comments
              </button>
              <button
                className="flex items-center gap-2 px-4 py-3 text-sm font-medium text-primary border-b-2 border-primary"
              >
                <FolderOpen className="h-4 w-4" />
                Files
              </button>
            </div>
          </div>
          <BackendPane
            programId={programId}
            programName={programName}
            className="flex-1"
          />
        </div>
      ) : (
        /* Normal Two Panel Layout */
        <div className="flex flex-1 overflow-hidden">
          {/* Left Side - Document Editor */}
          <div className="flex-1 overflow-auto p-8 bg-white">
            <div className="max-w-4xl mx-auto">
              <h2 className="mb-6">TABLE OF CONTENTS</h2>
              <div className="space-y-2 mb-8 max-h-96 overflow-y-auto pr-4">
                {sections.map((section, index) => (
                  <div
                    key={index}
                    onClick={() => handleSectionSelect(section)}
                    className={`p-3 rounded-md cursor-pointer transition-colors ${
                      selectedSection === section
                        ? 'bg-primary/10 text-primary'
                        : 'text-muted-foreground hover:bg-muted/50'
                    }`}
                  >
                    {section}
                  </div>
                ))}
              </div>

              <Separator className="my-8" />

              {selectedSection ? (
                <>
                  <div className="flex items-center justify-between mb-4">
                    <h3>{selectedSection}</h3>
                    {generatedDraftForSection && streamingEvents.some(e => e.type === 'complete') && (
                      <Badge
                        variant="outline"
                        className="text-emerald-700 border-emerald-200 bg-emerald-50"
                      >
                        Claude Generated
                      </Badge>
                    )}
                  </div>
                  <div className="space-y-4">
                    <RichTextEditor
                      content={generatedDraftForSection || ''}
                      onChange={(content) => {
                        setSectionDrafts((prev) => ({
                          ...prev,
                          [selectedSection]: content
                        }));
                      }}
                      placeholder="Start writing your content here, or use the AI Assistant panel on the right to generate content..."
                      disabled={isReadOnly}
                    />
                    {generatedDraftForSection && (
                      <div className="flex justify-end">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            // Clear the current draft and streaming state
                            setSectionDrafts((prev) => {
                              const updated = { ...prev };
                              delete updated[selectedSection];
                              return updated;
                            });
                            setStreamingContent('');
                            setStreamingEvents([]);
                            setGenerationError(null);
                          }}
                          disabled={isReadOnly}
                        >
                          Clear Content
                        </Button>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <FileText className="h-16 w-16 mx-auto mb-4 opacity-50" />
                  <p>Select a section from the table of contents to begin</p>
                </div>
              )}
            </div>
          </div>

          {/* Right Side - AI Assistant Panel */}
          <div className="w-96 border-l bg-muted/10 flex flex-col">
          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as typeof activeTab)} className="flex-1 flex flex-col min-h-0">
            <TabsList className="w-full justify-start rounded-none border-b bg-transparent p-0">
              <TabsTrigger value="generate" className="gap-2 rounded-none border-b-2 border-transparent data-[state=active]:border-primary">
                <Sparkles className="h-4 w-4" />
                Generate
              </TabsTrigger>
              <TabsTrigger value="sources" className="gap-2 rounded-none border-b-2 border-transparent data-[state=active]:border-primary">
                Sources
              </TabsTrigger>
              <TabsTrigger value="comments" className="gap-2 rounded-none border-b-2 border-transparent data-[state=active]:border-primary">
                Comments
              </TabsTrigger>
              {programId && (
                <TabsTrigger value="files" className="gap-2 rounded-none border-b-2 border-transparent data-[state=active]:border-primary">
                  <FolderOpen className="h-4 w-4" />
                  Files
                </TabsTrigger>
              )}
            </TabsList>

            <TabsContent value="generate" className="flex-1 p-4 space-y-4 overflow-auto mt-0">
              <div>
                <h4 className="mb-2">Generate for:</h4>
                <p className="text-muted-foreground">
                  {selectedSection || 'Select a section to generate content'}
                </p>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block">Prompt</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="ghost" size="sm" className="gap-1 h-7 text-xs" disabled={isGenerating || isReadOnly}>
                        <Plus className="h-3 w-3" />
                        @file
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-72 p-2" align="end">
                      <div className="space-y-2">
                        <Input
                          placeholder="Search files..."
                          value={fileSearchQuery}
                          onChange={(e) => setFileSearchQuery(e.target.value)}
                          className="h-8 text-sm"
                        />
                        <div className="max-h-40 overflow-auto space-y-0.5">
                          {availableSources
                            .filter(s => s.name.toLowerCase().includes(fileSearchQuery.toLowerCase()))
                            .slice(0, 10)
                            .map(source => (
                              <button
                                key={source.id}
                                type="button"
                                className="w-full flex items-center gap-2 px-2 py-1.5 text-left text-sm hover:bg-accent rounded-sm"
                                onClick={() => {
                                  setPromptValue(prev => `${prev} @${source.name}`);
                                  setFileSearchQuery('');
                                }}
                              >
                                <FileText className="h-3 w-3 text-muted-foreground" />
                                <span className="truncate">{source.name}</span>
                              </button>
                            ))}
                          {availableSources.filter(s => s.name.toLowerCase().includes(fileSearchQuery.toLowerCase())).length === 0 && (
                            <div className="text-sm text-muted-foreground text-center py-2">No files found</div>
                          )}
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
                <MentionableTextarea
                  className="min-h-[120px]"
                  value={promptValue}
                  onChange={setPromptValue}
                  sources={availableSources}
                  disabled={isGenerating || isReadOnly}
                  placeholder="Describe what the agent should generate... Use @ to mention files"
                  onMentionedFilesChange={setMentionedFileIds}
                />
              </div>

              <div>
                <label className="block mb-3">Source Data Selector</label>
                <div className="space-y-2">
                  <Input
                    type="search"
                    value={sourceSearch}
                    placeholder="Search and add source files"
                    className="bg-background"
                    onChange={(event) => setSourceSearch(event.target.value)}
                    disabled={isLoadingSources || isReadOnly}
                  />
                  {sourcesError && (
                    <p className="text-sm text-destructive">{sourcesError}</p>
                  )}

                  <div className="border rounded-md bg-background divide-y max-h-44 overflow-auto">
                    {isLoadingSources && (
                      <div className="p-2 text-sm text-muted-foreground">Loading sources...</div>
                    )}

                    {!isLoadingSources && filteredSources.length === 0 && (
                      <div className="p-2 text-sm text-muted-foreground">No sources found.</div>
                    )}

                    {filteredSources.map((source) => {
                      const isSelected = selectedSources.includes(source.id);
                      return (
                        <button
                          key={source.id}
                          type="button"
                          className={`w-full flex items-center gap-3 p-2 text-left text-sm hover:bg-accent transition-colors ${isSelected ? 'bg-accent/50' : ''}`}
                          onClick={() => handleAddSource(source.id)}
                          disabled={isSelected || isReadOnly}
                        >
                          {getFileIcon(source.type)}
                          <span className="flex-1 truncate">{source.name}</span>
                          {isSelected && (
                            <Badge variant="secondary">Selected</Badge>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  <div className="flex flex-wrap gap-2 min-h-[60px] border rounded-md p-2 bg-background">
                    {selectedSources.length === 0 && (
                      <span className="text-sm text-muted-foreground">No sources selected</span>
                    )}
                    {selectedSources.map((sourceId) => {
                      const source = sourceIndex.get(sourceId);
                      if (!source) return null;
                      return (
                        <Badge key={sourceId} variant="secondary" className="gap-2 pr-1">
                          {source.name}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-4 w-4 p-0 hover:bg-transparent"
                            onClick={() => removeSource(sourceId)}
                            disabled={isReadOnly}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </Badge>
                      );
                    })}
                  </div>
                </div>
              </div>

              {isGenerating ? (
                <Button
                  variant="destructive"
                  className="w-full gap-2"
                  onClick={handleCancelGeneration}
                >
                  <StopCircle className="h-4 w-4" />
                  Stop Generation
                </Button>
              ) : (
                <Button
                  className="w-full gap-2"
                  onClick={handleGenerate}
                  disabled={!canGenerate || isReadOnly}
                >
                  <Sparkles className="h-4 w-4" />
                  Generate Content
                </Button>
              )}

            {/* Streaming Preview */}
              {(isGenerating || streamingContent || generationError) && (
                <StreamingPreview
                  content={streamingContent}
                  events={streamingEvents}
                  isStreaming={isGenerating}
                  error={generationError}
                />
              )}
            </TabsContent>

            <TabsContent value="sources" className="flex-1 p-4 space-y-4 overflow-auto mt-0">
              <h4 className="mb-2">Document Sources</h4>

              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Search Data Vault..."
                  className="pl-10 bg-background"
                  value={sourceSearch}
                  onChange={(event) => setSourceSearch(event.target.value)}
                />
              </div>

              <div className="space-y-4">
                {isLoadingSources && (
                  <div className="p-2 text-sm text-muted-foreground">Loading sources...</div>
                )}
                {!isLoadingSources && filteredSources.length === 0 && (
                  <div className="p-2 text-sm text-muted-foreground">No sources found.</div>
                )}

                {/* Linked sources section */}
                {linkedSourcesList.length > 0 && (
                  <div className="space-y-2">
                    <h5 className="text-sm font-medium text-primary">Linked to this document</h5>
                    {linkedSourcesList.map(source => (
                      <div
                        key={source.id}
                        className="flex items-center gap-3 p-3 rounded-md border border-primary/30 bg-primary/5"
                      >
                        {getFileIcon(source.type)}
                        <span className="flex-1 truncate">{source.name}</span>
                        <Badge variant="outline" className="text-primary border-primary text-xs">
                          Linked
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}

                {/* Other sources section */}
                {unlinkedSourcesList.length > 0 && (
                  <div className="space-y-2">
                    {linkedSourcesList.length > 0 && (
                      <h5 className="text-sm font-medium text-muted-foreground">Other sources</h5>
                    )}
                    {unlinkedSourcesList.map(source => (
                      <div
                        key={source.id}
                        className="flex items-center gap-3 p-3 rounded-md border hover:bg-accent cursor-pointer"
                        onClick={() => handleAddSource(source.id)}
                      >
                        {getFileIcon(source.type)}
                        <span className="flex-1 truncate">{source.name}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="comments" className="flex-1 p-4 overflow-auto mt-0 space-y-4">
              {isExistingDocument ? (
                <>
                  <div className="border rounded-md p-3 space-y-3 bg-muted/30">
                    <div className="text-sm font-medium">Add a comment</div>
                    <p className="text-xs text-muted-foreground">
                      Anchor your comment by selecting a section on the left. Currently selected: {selectedSection ?? 'none'}
                    </p>
                    <Textarea
                      value={newCommentText}
                      onChange={(event) => setNewCommentText(event.target.value)}
                      placeholder="@Regina Please verify the pharmacodynamics table."
                      disabled={!selectedSection}
                      className="min-h-[100px] text-sm"
                    />
                    <div className="flex justify-end">
                      <Button
                        size="sm"
                        onClick={handleCreateComment}
                        disabled={!selectedSection || !newCommentText.trim()}
                      >
                        Add Comment
                      </Button>
                    </div>
                  </div>

                  <CommentThread comments={documentComments} onReply={handleReply} />
                </>
              ) : (
                <p className="text-muted-foreground text-center py-8">Comments will appear here once the document is created.</p>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>
      )}

      <SubmitForReviewDialog
        open={isSubmitDialogOpen}
        onClose={() => setSubmitDialogOpen(false)}
        onSubmit={handleSubmitReview}
        defaultSelected={currentDocument?.assignedReviewers ?? []}
      />

      <VersionHistoryDrawer
        open={isVersionDrawerOpen}
        onClose={() => setVersionDrawerOpen(false)}
        versions={versionHistory}
        onRestore={handleRestoreVersion}
      />
    </div>
  );
}
