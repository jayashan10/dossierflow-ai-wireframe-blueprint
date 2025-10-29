import { useState } from 'react';
import { Upload, FileText, CheckCircle2, ArrowRight, Sparkles, AlertCircle, RefreshCcw } from 'lucide-react';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Label } from './ui/label';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import { Separator } from './ui/separator';
import { Badge } from './ui/badge';
import { Alert, AlertDescription } from './ui/alert';
import { uploadTemplate, refineTemplate } from '../lib/api';

interface UploadState {
  status: 'idle' | 'uploading' | 'success' | 'error';
  message?: string;
  warnings?: string[];
}

interface SetupWizardProps {
  onComplete: (config: {
    documentType: string;
    templateUploaded: boolean;
    sections: string[];
  }) => void;
  onCancel?: () => void;
}

const documentTypes = [
  { id: 'ctd-m2', name: 'CTD Module 2 - Summaries', description: 'Common Technical Document summaries' },
  { id: 'ctd-m3', name: 'CTD Module 3 - Quality', description: 'Quality documentation' },
  { id: 'ctd-m4', name: 'CTD Module 4 - Nonclinical', description: 'Nonclinical study reports' },
  { id: 'ctd-m5', name: 'CTD Module 5 - Clinical', description: 'Clinical study reports' },
  { id: 'dsur', name: 'DSUR', description: 'Development Safety Update Report' },
  { id: 'custom', name: 'Custom Document', description: 'Upload your own template' }
];

const defaultSections = {
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
  'dsur': [
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

export function SetupWizard({ onComplete, onCancel }: SetupWizardProps) {
  const [step, setStep] = useState(1);
  const [selectedDocType, setSelectedDocType] = useState<string>('');
  const [templateFile, setTemplateFile] = useState<File | null>(null);
  const [extractedSections, setExtractedSections] = useState<string[]>([]);
  const [refinedSections, setRefinedSections] = useState<string[]>([]);
  const [uploadState, setUploadState] = useState<UploadState>({ status: 'idle' });
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [isRefining, setIsRefining] = useState(false);
  const [refineError, setRefineError] = useState<string | null>(null);

  const handleDocTypeSelect = (docType: string) => {
    setSelectedDocType(docType);
  };

  const handleTemplateUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setTemplateFile(file);
    setUploadState({ status: 'uploading' });
    setRefinedSections([]);
    setTemplateId(null);
    setRefineError(null);

    try {
      const result = await uploadTemplate(file);
      const raw = result.rawSections.length ? result.rawSections : result.refinedSections.map((section) => section.title);
      setExtractedSections(raw);
      setRefinedSections(result.refinedSections.map((section) => section.title));
      setTemplateId(result.id);
      setUploadState({
        status: 'success',
        message: `${raw.length} sections extracted`,
        warnings: result.warnings
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to upload template.';
      setUploadState({ status: 'error', message });
      setExtractedSections([]);
      setRefinedSections([]);
      setTemplateId(null);
    }
  };

  const handleRetryUpload = () => {
    setTemplateFile(null);
    setUploadState({ status: 'idle' });
    setExtractedSections([]);
    setRefinedSections([]);
    setTemplateId(null);
    setRefineError(null);
  };

  const handleSkipTemplate = () => {
    const sections = defaultSections[selectedDocType as keyof typeof defaultSections] || [
      '1. Introduction',
      '2. Methods',
      '3. Results',
      '4. Discussion',
      '5. Conclusion'
    ];
    setExtractedSections(sections);
    setRefinedSections([]);
    setUploadState({ status: 'idle' });
    setTemplateFile(null);
    setTemplateId(null);
    setRefineError(null);
    setStep(3);
  };

  const handleNext = () => {
    if (step === 1 && selectedDocType) {
      setStep(2);
    } else if (step === 2) {
      if (templateFile || extractedSections.length > 0) {
        setStep(3);
      } else {
        handleSkipTemplate();
      }
    }
  };

  const handleComplete = () => {
    onComplete({
      documentType: selectedDocType,
      templateUploaded: uploadState.status === 'success',
      sections: refinedSections.length ? refinedSections : extractedSections
    });
  };

  const handleRefine = async () => {
    if (!templateId) return;
    setIsRefining(true);
    setRefineError(null);
    try {
      const result = await refineTemplate(templateId);
      const refined = result.refinedSections.map((section) => section.title);
      setRefinedSections(refined);
      setUploadState((prev) => ({
        status: 'success',
        message: `${refined.length} sections refined`,
        warnings: result.warnings ?? prev.warnings
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Codex refinement failed.';
      setRefineError(message);
    } finally {
      setIsRefining(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/20 flex items-center justify-center p-8">
      <Card className="w-full max-w-4xl p-8 relative">
        {onCancel && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onCancel}
            className="absolute top-4 right-4"
          >
            Cancel
          </Button>
        )}
        {/* Progress Steps */}
        <div className="flex items-center justify-center mb-8">
          <div className="flex items-center gap-4">
            <div className={`flex items-center gap-2 ${step >= 1 ? 'text-primary' : 'text-muted-foreground'}`}>
              <div className={`flex h-8 w-8 items-center justify-center rounded-full ${step >= 1 ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                {step > 1 ? <CheckCircle2 className="h-5 w-5" /> : '1'}
              </div>
              <span>Document Type</span>
            </div>
            <Separator className="w-12" />
            <div className={`flex items-center gap-2 ${step >= 2 ? 'text-primary' : 'text-muted-foreground'}`}>
              <div className={`flex h-8 w-8 items-center justify-center rounded-full ${step >= 2 ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                {step > 2 ? <CheckCircle2 className="h-5 w-5" /> : '2'}
              </div>
              <span>Template</span>
            </div>
            <Separator className="w-12" />
            <div className={`flex items-center gap-2 ${step >= 3 ? 'text-primary' : 'text-muted-foreground'}`}>
              <div className={`flex h-8 w-8 items-center justify-center rounded-full ${step >= 3 ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                3
              </div>
              <span>Review Sections</span>
            </div>
          </div>
        </div>

        {/* Step 1: Select Document Type */}
        {step === 1 && (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <h2 className="mb-2">Choose Document Type</h2>
              <p className="text-muted-foreground">Select the type of regulatory document you want to create</p>
            </div>

            <RadioGroup value={selectedDocType} onValueChange={handleDocTypeSelect}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {documentTypes.map((docType) => (
                  <Label
                    key={docType.id}
                    htmlFor={docType.id}
                    className="cursor-pointer"
                  >
                    <Card className={`p-4 hover:border-primary transition-colors ${selectedDocType === docType.id ? 'border-primary bg-primary/5' : ''}`}>
                      <div className="flex items-start gap-3">
                        <RadioGroupItem value={docType.id} id={docType.id} className="mt-1" />
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <FileText className="h-4 w-4" />
                            <span>{docType.name}</span>
                          </div>
                          <p className="text-muted-foreground">{docType.description}</p>
                        </div>
                      </div>
                    </Card>
                  </Label>
                ))}
              </div>
            </RadioGroup>

            <div className="flex justify-end pt-4">
              <Button onClick={handleNext} disabled={!selectedDocType} className="gap-2">
                Continue
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: Upload Template */}
        {step === 2 && (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <h2 className="mb-2">Upload Template (Optional)</h2>
              <p className="text-muted-foreground">
                Upload your custom template or use our standard template for {documentTypes.find(d => d.id === selectedDocType)?.name}
              </p>
            </div>

            <div className="space-y-4">
              <div className="border-2 border-dashed rounded-lg p-12 text-center hover:border-primary transition-colors">
                <input
                  type="file"
                  id="template-upload"
                  className="hidden"
                  accept=".docx,.pdf,.doc"
                  onChange={handleTemplateUpload}
                />
                <Label htmlFor="template-upload" className="cursor-pointer">
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

              {uploadState.status === 'error' && (
                <Alert variant="destructive" className="flex items-start gap-3">
                  <AlertCircle className="mt-0.5" />
                  <AlertDescription className="grid gap-2">
                    <span>{uploadState.message ?? 'Upload failed. Please try again.'}</span>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={handleRetryUpload} className="gap-2">
                        <RefreshCcw className="h-3 w-3" /> Retry
                      </Button>
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              {templateFile && uploadState.status !== 'error' && (
                <Card className="p-4 bg-primary/5 border-primary">
                  <div className="flex items-center gap-3">
                    <FileText className="h-5 w-5 text-primary" />
                    <div className="flex-1">
                      <p>{templateFile.name}</p>
                      <p className="text-muted-foreground">
                        {(templateFile.size / 1024).toFixed(2)} KB
                      </p>
                    </div>
                    {uploadState.status === 'uploading' ? (
                      <div className="flex items-center gap-2 text-primary">
                        <div className="h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                        <span>Processing...</span>
                      </div>
                    ) : uploadState.status === 'success' ? (
                      <CheckCircle2 className="h-5 w-5 text-primary" />
                    ) : (
                      <Button variant="ghost" size="sm" onClick={handleRetryUpload} className="gap-2">
                        <RefreshCcw className="h-4 w-4" />
                        Clear
                      </Button>
                    )}
                  </div>

                  {uploadState.message && (
                    <p className="mt-2 text-sm text-muted-foreground">{uploadState.message}</p>
                  )}

                  {uploadState.warnings && uploadState.warnings.length > 0 && (
                    <div className="mt-3 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md p-3">
                      <p className="font-medium mb-1">Warnings</p>
                      <ul className="list-disc pl-5 space-y-1">
                        {uploadState.warnings.map((warning, index) => (
                          <li key={index}>{warning}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </Card>
              )}
            </div>

            <div className="flex justify-between pt-4">
              <Button variant="outline" onClick={() => setStep(1)}>
                Back
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={handleSkipTemplate}>
                  Skip & Use Default Template
                </Button>
                <Button
                  onClick={handleNext}
                  disabled={uploadState.status !== 'success'}
                  className="gap-2"
                >
                  Continue
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Review Extracted Sections */}
        {step === 3 && (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <h2 className="mb-2">Review Document Sections</h2>
              <p className="text-muted-foreground">
                {templateFile && uploadState.status === 'success'
                  ? 'We extracted the following sections from your template'
                  : 'Using the standard template structure'}
              </p>
            </div>

            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  <h3>{documentTypes.find(d => d.id === selectedDocType)?.name}</h3>
                </div>
                <Badge variant="outline" className="bg-green-100 text-green-800 border-green-300">
                  {(refinedSections.length ? refinedSections : extractedSections).length} sections detected
                </Badge>
              </div>

              <Separator className="my-4" />

              {refineError && (
                <Alert variant="destructive" className="mb-4">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="ml-2 text-sm">
                    {refineError}
                  </AlertDescription>
                </Alert>
              )}

              <div className="max-h-96 overflow-y-auto pr-1">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {(refinedSections.length ? refinedSections : extractedSections).map((section, index) => (
                    <div key={index} className="flex items-start gap-3 p-3 rounded-md bg-muted/30">
                      <CheckCircle2 className="h-4 w-4 text-primary mt-0.5" />
                      <span>{section}</span>
                    </div>
                  ))}
                </div>
              </div>
            </Card>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex gap-3">
                <Sparkles className="h-5 w-5 text-blue-600 mt-0.5" />
                <div>
                  <p className="text-blue-900">Ready to generate content</p>
                  <p className="text-blue-700 mt-1">
                    You can now start generating content for each section using AI, or write manually.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex justify-between pt-4">
              <Button variant="outline" onClick={() => setStep(2)}>
                Back
              </Button>
              <Button onClick={handleComplete} className="gap-2">
                <Sparkles className="h-4 w-4" />
                Start Creating Document
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
