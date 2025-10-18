import { useState } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Label } from './ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Plus, ArrowLeft, ArrowRight, Users, Upload, FileText, CheckCircle2, Sparkles } from 'lucide-react';
import { Separator } from './ui/separator';
import type { Program } from '../data/mockData';

interface CreateProgramWizardProps {
  open: boolean;
  onClose: () => void;
  onCreate: (program: Program) => void;
}

interface Invitee {
  email: string;
  role: 'Admin' | 'Author' | 'Reviewer';
}
const documentTypes = [
  { id: 'ctd-m2', name: 'CTD Module 2 - Summaries', description: 'Common Technical Document summaries' },
  { id: 'ctd-m3', name: 'CTD Module 3 - Quality', description: 'Quality documentation' },
  { id: 'ctd-m4', name: 'CTD Module 4 - Nonclinical', description: 'Nonclinical study reports' },
  { id: 'ctd-m5', name: 'CTD Module 5 - Clinical', description: 'Clinical study reports' },
  { id: 'dsur', name: 'DSUR', description: 'Development Safety Update Report' },
  { id: 'custom', name: 'Custom Program', description: 'Upload your own dossier template' }
];

const defaultSections: Record<string, string[]> = {
  'ctd-m2': [
    '2.1 Table of Contents',
    '2.2 Introduction',
    '2.3 Quality Overall Summary',
    '2.4 Nonclinical Overview',
    '2.5 Clinical Overview',
    '2.6 Nonclinical Written and Tabulated Summaries',
    '2.7 Clinical Summary'
  ],
  'ctd-m4': [
    '4.1 Pharmacology',
    '4.2 Pharmacokinetics',
    '4.3 Toxicology',
    '4.4 Local Tolerance Studies',
    '4.5 Other Toxicity Studies'
  ],
  dsur: [
    '1. Executive Summary',
    '2. Introduction',
    '3. Worldwide Marketing Authorization Status',
    '4. Update of Regulatory Authority Actions',
    '5. Changes to Reference Safety Information',
    '6. Estimated Exposure and Use Patterns',
    '7. Presentation of Individual Case Histories',
    '8. Studies',
    '9. Information from Other Clinical Trials',
    '10. Other Periodic Reports',
    '11. Lack of Efficacy',
    '12. Late-breaking Information',
    '13. Overview of Signals',
    '14. Summary',
    '15. Appendices'
  ]
};

export function CreateProgramWizard({ open, onClose, onCreate }: CreateProgramWizardProps) {
  const [step, setStep] = useState(1);
  const [programName, setProgramName] = useState('');
  const [description, setDescription] = useState('');
  const [regulatoryBody, setRegulatoryBody] = useState('FDA');
  const [selectedDocType, setSelectedDocType] = useState('');
  const [templateFile, setTemplateFile] = useState<File | null>(null);
  const [extractedSections, setExtractedSections] = useState<string[]>([]);
  const [isProcessingTemplate, setIsProcessingTemplate] = useState(false);
  const [invitees, setInvitees] = useState<Invitee[]>([]);
  const [inviteDraft, setInviteDraft] = useState<Invitee>({ email: '', role: 'Author' });

  const reset = () => {
    setStep(1);
    setProgramName('');
    setDescription('');
    setRegulatoryBody('FDA');
    setSelectedDocType('');
    setTemplateFile(null);
    setExtractedSections([]);
    setIsProcessingTemplate(false);
    setInvitees([]);
    setInviteDraft({ email: '', role: 'Author' });
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleAddInvite = () => {
    if (!inviteDraft.email.trim()) return;
    setInvitees((prev) => [...prev, inviteDraft]);
    setInviteDraft({ email: '', role: 'Author' });
  };

  const handleCreate = () => {
    const newProgram: Program = {
      id: `program-${Date.now()}`,
      title: programName || 'Untitled Program',
      status: 'In Progress',
      progress: 0,
      documentCount: 0,
      lastUpdated: 'Just now',
      lastUpdatedBy: 'System'
    };
    onCreate(newProgram);
    handleClose();
  };

  const fallbackSections = ['1. Introduction', '2. Methods', '3. Results', '4. Discussion', '5. Conclusion'];

  const ensureDefaultSections = (docType: string) => {
    const sections = defaultSections[docType] ?? fallbackSections;
    setExtractedSections(sections);
  };

  const handleDocTypeSelect = (docType: string) => {
    setSelectedDocType(docType);
    setTemplateFile(null);
    setIsProcessingTemplate(false);
    ensureDefaultSections(docType);
  };

  const handleTemplateUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setTemplateFile(file);
    setIsProcessingTemplate(true);

    setTimeout(() => {
      ensureDefaultSections(selectedDocType);
      setIsProcessingTemplate(false);
    }, 2000);
  };

  const handleSkipTemplate = () => {
    ensureDefaultSections(selectedDocType);
    setStep(4);
  };

  const handleNext = () => {
    if (step === 1) {
      setStep(2);
    } else if (step === 2) {
      if (!selectedDocType) return;
      if (!extractedSections.length) {
        ensureDefaultSections(selectedDocType);
      }
      setStep(3);
    } else if (step === 3) {
      if (isProcessingTemplate) return;
      if (!templateFile && !extractedSections.length) {
        ensureDefaultSections(selectedDocType);
      }
      setStep(4);
    } else if (step === 4) {
      setStep(5);
    }
  };

  const handleBack = () => {
    if (step === 1) return;
    setStep((prev) => prev - 1);
  };

  return (
    <Dialog open={open} onOpenChange={(value) => !value && handleClose()}>
      <DialogContent className="max-w-4xl h-[90vh]">
        <DialogHeader>
          <DialogTitle>Create New Program</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col h-full">
          <div className="flex items-center justify-between border-b pb-4 mb-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className={`font-medium ${step === 1 ? 'text-primary' : ''}`}>1. Details</span>
              <span>→</span>
              <span className={`font-medium ${step === 2 ? 'text-primary' : ''}`}>2. Document Type</span>
              <span>→</span>
              <span className={`font-medium ${step === 3 ? 'text-primary' : ''}`}>3. Template</span>
              <span>→</span>
              <span className={`font-medium ${step === 4 ? 'text-primary' : ''}`}>4. Team</span>
              <span>→</span>
              <span className={`font-medium ${step === 5 ? 'text-primary' : ''}`}>5. Summary</span>
            </div>
            <div className="text-xs text-muted-foreground">Step {step} of 5</div>
          </div>

          <div className="flex-1 overflow-auto pr-2">
            {step === 1 && (
              <section className="space-y-4">
                <div>
                  <Label htmlFor="program-name">Program Name</Label>
                  <Input
                    id="program-name"
                    placeholder="WEA-M3 Pharmacology Program"
                    value={programName}
                    onChange={(event) => setProgramName(event.target.value)}
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="program-description">Description</Label>
                  <Textarea
                    id="program-description"
                    placeholder="Brief overview of the submission goals..."
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    className="mt-2 min-h-[120px]"
                  />
                </div>
                <div>
                  <Label htmlFor="reg-body">Regulatory Body</Label>
                  <select
                    id="reg-body"
                    className="mt-2 w-full rounded-md border border-input bg-background p-2 text-sm"
                    value={regulatoryBody}
                    onChange={(event) => setRegulatoryBody(event.target.value)}
                  >
                    <option value="FDA">FDA</option>
                    <option value="EMA">EMA</option>
                    <option value="PMDA">PMDA</option>
                    <option value="MHRA">MHRA</option>
                  </select>
                </div>
              </section>
            )}

            {step === 2 && (
              <section className="space-y-6">
                <div className="text-center">
                  <h2 className="mb-2">Select Dossier Template</h2>
                  <p className="text-muted-foreground">Choose the regulatory template you want to start from.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {documentTypes.map((docType) => {
                    const isSelected = selectedDocType === docType.id;
                    return (
                      <Card
                        key={docType.id}
                        className={`cursor-pointer transition ${isSelected ? 'ring-2 ring-primary' : 'hover:border-primary/50'}`}
                        onClick={() => handleDocTypeSelect(docType.id)}
                      >
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2">
                            <FileText className="h-4 w-4" />
                            {docType.name}
                          </CardTitle>
                          <CardDescription>{docType.description}</CardDescription>
                        </CardHeader>
                        <CardContent>
                          {isSelected ? (
                            <Badge variant="secondary">Selected</Badge>
                          ) : (
                            <Badge variant="outline">Select</Badge>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </section>
            )}

            {step === 3 && (
              <section className="space-y-6">
                <div className="text-center">
                  <h2 className="mb-2">Upload Template (Optional)</h2>
                  <p className="text-muted-foreground">
                    Upload a custom template or use the standard section structure for your selected document type.
                  </p>
                </div>

                <div className="border-2 border-dashed rounded-lg p-10 text-center hover:border-primary transition-colors">
                  <input
                    type="file"
                    id="program-template-upload"
                    className="hidden"
                    accept=".docx,.pdf,.doc"
                    onChange={handleTemplateUpload}
                  />
                  <Label htmlFor="program-template-upload" className="cursor-pointer">
                    <div className="flex flex-col items-center gap-3">
                      <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                        <Upload className="h-8 w-8 text-primary" />
                      </div>
                      <div>
                        <p>Click to upload or drag and drop</p>
                        <p className="text-muted-foreground">Supports .docx, .pdf, .doc files</p>
                      </div>
                    </div>
                  </Label>
                </div>

                {templateFile && (
                  <Card className="p-4 bg-primary/5 border-primary">
                    <div className="flex items-center gap-3">
                      <FileText className="h-5 w-5 text-primary" />
                      <div className="flex-1">
                        <p>{templateFile.name}</p>
                        <p className="text-muted-foreground">{(templateFile.size / 1024).toFixed(2)} KB</p>
                      </div>
                      {isProcessingTemplate ? (
                        <div className="flex items-center gap-2 text-primary">
                          <div className="h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                          <span>Processing...</span>
                        </div>
                      ) : (
                        <CheckCircle2 className="h-5 w-5 text-primary" />
                      )}
                    </div>
                  </Card>
                )}

                {extractedSections.length > 0 && (
                  <Card className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <FileText className="h-5 w-5 text-primary" />
                        <h3 className="text-sm font-medium">Detected Sections</h3>
                      </div>
                      <Badge variant="outline" className="bg-green-100 text-green-800 border-green-300">
                        {extractedSections.length} sections
                      </Badge>
                    </div>
                    <Separator className="my-4" />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {extractedSections.map((section, index) => (
                        <div key={index} className="flex items-start gap-3 p-2 rounded-md bg-muted/40">
                          <CheckCircle2 className="h-4 w-4 text-primary mt-0.5" />
                          <span className="text-sm">{section}</span>
                        </div>
                      ))}
                    </div>
                  </Card>
                )}

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex gap-3">
                    <Sparkles className="h-5 w-5 text-blue-600 mt-0.5" />
                    <div>
                      <p className="text-blue-900">AI-ready structure</p>
                      <p className="text-blue-700 mt-1 text-sm">
                        The sections above will be available for AI generation once the program is created.
                      </p>
                    </div>
                  </div>
                </div>
              </section>
            )}

            {step === 4 && (
              <section className="space-y-4">
                <div className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <h3 className="text-sm font-medium">Invite team members</h3>
                    <p className="text-xs text-muted-foreground">Add collaborators and assign roles.</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <Label>Email</Label>
                    <Input
                      type="email"
                      placeholder="regina@company.com"
                      value={inviteDraft.email}
                      onChange={(event) => setInviteDraft((prev) => ({ ...prev, email: event.target.value }))}
                      className="mt-2"
                    />
                  </div>
                  <div>
                    <Label>Role</Label>
                    <select
                      className="mt-2 w-full rounded-md border border-input bg-background p-2 text-sm"
                      value={inviteDraft.role}
                      onChange={(event) => setInviteDraft((prev) => ({ ...prev, role: event.target.value as Invitee['role'] }))}
                    >
                      <option value="Admin">Admin</option>
                      <option value="Author">Author</option>
                      <option value="Reviewer">Reviewer</option>
                    </select>
                  </div>
                </div>
                <Button type="button" variant="outline" className="gap-2" onClick={handleAddInvite}>
                  <Plus className="h-4 w-4" /> Add Invitee
                </Button>

                <div className="space-y-2">
                  {invitees.length === 0 && (
                    <p className="text-sm text-muted-foreground">No team members added yet.</p>
                  )}
                  {invitees.map((invitee, index) => (
                    <div key={`${invitee.email}-${index}`} className="flex items-center justify-between rounded-md border p-3">
                      <div>
                        <p className="text-sm font-medium">{invitee.email}</p>
                        <p className="text-xs text-muted-foreground">{invitee.role}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setInvitees((prev) => prev.filter((_, i) => i !== index))}
                      >
                        Remove
                      </Button>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {step === 5 && (
              <section className="space-y-4">
                <h3 className="text-sm font-medium">Review & Create</h3>
                <div className="rounded-md border p-4 bg-muted/30 space-y-3 text-sm">
                  <div>
                    <span className="font-medium">Program:</span> {programName || 'Untitled Program'}
                  </div>
                  <div>
                    <span className="font-medium">Regulatory Body:</span> {regulatoryBody}
                  </div>
                  <div>
                    <span className="font-medium">Document Type:</span>{' '}
                    {documentTypes.find((doc) => doc.id === selectedDocType)?.name || 'Not selected'}
                  </div>
                  <div>
                    <span className="font-medium">Sections Configured:</span> {extractedSections.length}
                  </div>
                  <div>
                    <span className="font-medium">Team Members:</span>
                    <ul className="list-disc list-inside text-muted-foreground">
                      {invitees.length === 0 && <li>None added yet</li>}
                      {invitees.map((invitee, index) => (
                        <li key={`${invitee.email}-${index}`}>{invitee.email} — {invitee.role}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </section>
            )}
          </div>

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <div className="ml-auto flex gap-2">
              {step > 1 && (
                <Button variant="secondary" onClick={handleBack} className="gap-2">
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </Button>
              )}
              {step === 3 && (
                <>
                  <Button variant="outline" onClick={handleSkipTemplate}>
                    Skip & Use Default Structure
                  </Button>
                  <Button
                    onClick={handleNext}
                    className="gap-2"
                    disabled={isProcessingTemplate}
                  >
                    Continue
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </>
              )}
              {step !== 3 && step < 5 && (
                <Button
                  onClick={handleNext}
                  className="gap-2"
                  disabled={step === 2 && !selectedDocType}
                >
                  Next
                  <ArrowRight className="h-4 w-4" />
                </Button>
              )}
              {step === 5 && (
                <Button onClick={handleCreate}>
                  Create Program
                </Button>
              )}
            </div>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
