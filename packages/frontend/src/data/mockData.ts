export interface Program {
  id: string;
  title: string;
  status: 'In Progress' | 'Under Review' | 'Submitted';
  progress: number;
  documentCount?: number;
  lastUpdated?: string;
  lastUpdatedBy?: string;
  defaultDocumentType?: string;
  defaultSections?: string[];
  templateUploaded?: boolean;
  templateId?: string;
  sectionCount?: number;
  isSample?: boolean;
}

export interface Document {
  id: string;
  name: string;
  status: 'Approved' | 'Drafting' | 'To Do' | 'In Review' | 'Changes Requested';
  lastUpdated: string;
  assignedReviewers?: string[];
  submissionNote?: string;
  comments?: DocumentComment[];
  versionHistory?: DocumentVersion[];
  linkedSources?: string[];
}

export interface DocumentComment {
  id: string;
  author: string;
  createdAt: string;
  text: string;
  section: string;
  replies?: DocumentComment[];
}

export interface DocumentVersion {
  id: string;
  label: string;
  createdAt: string;
  author: string;
  status: 'Drafting' | 'Approved' | 'In Review' | 'Changes Requested';
  summary: string;
  content?: string;
}

export interface ModuleNode {
  id: string;
  name: string;
  children?: ModuleNode[];
  documents?: Document[];
}

export const programs: Program[] = [
  {
    id: 'wea-m2',
    title: 'WEA-M2 Non-Clinical Program',
    status: 'In Progress',
    progress: 75,
    documentCount: 186,
    lastUpdated: '2 hours ago',
    lastUpdatedBy: 'Mark',
    isSample: true
  },
  {
    id: 'cp-05',
    title: 'CP-05 Clinical Trials',
    status: 'Under Review',
    progress: 100,
    documentCount: 254,
    lastUpdated: '3 days ago',
    lastUpdatedBy: 'Regina',
    isSample: true
  },
  {
    id: 'dsur',
    title: 'DSUR-Annual Report',
    status: 'Submitted',
    progress: 100,
    documentCount: 58,
    lastUpdated: '1 week ago',
    lastUpdatedBy: 'System',
    isSample: true
  }
];

export const dossierStructure: ModuleNode[] = [
  {
    id: 'module-1',
    name: 'Module 1: Administrative Information',
    children: []
  },
  {
    id: 'module-2',
    name: 'Module 2: Summaries',
    children: [
      {
        id: 'module-2-1',
        name: '2.1 Introduction to Summary'
      },
      {
        id: 'module-2-2',
        name: '2.2 Quality Overall Summary'
      },
      {
        id: 'module-2-3',
        name: '2.3 Nonclinical Overview'
      },
      {
        id: 'module-2-4',
        name: '2.4 Nonclinical Written and Tabulated Summaries',
        documents: [
          {
            id: 'doc-2-4-1',
            name: '2.6.1 Introduction',
                status: 'Approved',
                lastUpdated: 'Sep 08, 2025',
                versionHistory: [
                  {
                    id: 'doc-2-4-1-v11',
                    label: 'Version 11 (Approved)',
                    createdAt: 'Sep 08, 2025',
                    author: 'Regina',
                    status: 'Approved',
                    summary: 'Final approval issued by regulatory reviewer.'
                  },
                  {
                    id: 'doc-2-4-1-v10',
                    label: 'Version 10',
                    createdAt: 'Sep 05, 2025',
                    author: 'Mark',
                    status: 'Drafting',
                    summary: 'Added safety conclusions based on reviewer feedback.'
                  }
                ]
          },
          {
            id: 'doc-2-4-2',
            name: '2.6.2 Pharmacology written summary',
                status: 'Drafting',
                lastUpdated: 'Sep 08, 2025',
                assignedReviewers: ['regina', 'dr-chen'],
                comments: [
                  {
                    id: 'comment-1',
                    author: 'Regina',
                    createdAt: 'Sep 02, 2025',
                    text: 'Please double-check the IC50 value in section 2.6.2.2.',
                    section: '2.6.2.2 Primary Pharmacodynamics',
                    replies: [
                      {
                        id: 'comment-1-reply',
                        author: 'Mark',
                        createdAt: 'Sep 03, 2025',
                        text: 'Updated with latest lab results. Please confirm.',
                        section: '2.6.2.2 Primary Pharmacodynamics'
                      }
                    ]
                  }
                ],
                versionHistory: [
                  {
                    id: 'doc-2-4-2-v12',
                    label: 'Version 12 (Current Draft)',
                    createdAt: '1 hour ago',
                    author: 'Mark',
                    status: 'Drafting',
                    summary: 'Incorporated latest pharmacodynamics data.',
                    content: 'Current draft content placeholder.'
                  },
                  {
                    id: 'doc-2-4-2-v11',
                    label: 'Version 11 (Approved)',
                    createdAt: '3 days ago',
                    author: 'Regina',
                    status: 'Approved',
                    summary: 'Approved summary for prior submission.',
                    content: 'Previously approved version content.'
                  },
                  {
                    id: 'doc-2-4-2-v10',
                    label: 'Version 10',
                    createdAt: '4 days ago',
                    author: 'Mark',
                    status: 'Drafting',
                    summary: 'Initial draft before reviewer pass.',
                    content: 'Earlier draft content.'
                  }
                ],
                linkedSources: ['file-1', 'file-2']
          },
          {
            id: 'doc-2-4-3',
            name: '2.6.3 Pharmacology tabulated summary',
                status: 'To Do',
                lastUpdated: 'Sep 08, 2025'
          }
        ]
      },
      {
        id: 'module-2-5',
        name: '2.5 Clinical Overview'
      }
    ]
  },
  {
    id: 'module-3',
    name: 'Module 3: Quality',
    children: []
  },
  {
    id: 'module-4',
    name: 'Module 4: Nonclinical Study Reports',
    children: []
  }
];

export const sourceDocs = [
  { id: 'src-1', name: 'clinical-study-report-xyz-123.pdf', type: 'pdf' },
  { id: 'src-2', name: 'pharmacology-data.xlsx', type: 'xlsx' },
  { id: 'src-3', name: 'safety-assessment-report.pdf', type: 'pdf' },
  { id: 'src-4', name: 'toxicology-summary.docx', type: 'docx' }
];

export interface Reviewer {
  id: string;
  name: string;
  role: 'Regulatory Reviewer' | 'Clinical Reviewer' | 'Author';
}

export const reviewers: Reviewer[] = [
  { id: 'regina', name: 'Regina', role: 'Regulatory Reviewer' },
  { id: 'dr-chen', name: 'Dr. Chen', role: 'Clinical Reviewer' },
  { id: 'mark', name: 'Mark', role: 'Author' }
];

export interface DataVaultFolder {
  id: string;
  name: string;
  path: string;
  children?: DataVaultFolder[];
}

export interface DataVaultFile {
  id: string;
  name: string;
  type: string;
  lastUpdated: string;
  tags: string[];
  folderPath: string;
  status: 'Draft' | 'Final' | 'Archived';
  versions: Array<{ id: string; label: string; date: string }>;
  linkedDocuments: string[];
}

export const dataVaultFolders: DataVaultFolder[] = [
  {
    id: 'root',
    name: 'All Files',
    path: '/',
    children: [
      {
        id: 'clinical',
        name: 'Clinical Study Reports',
        path: '/Clinical Study Reports'
      },
      {
        id: 'non-clinical',
        name: 'Non-Clinical Data',
        path: '/Non-Clinical Data'
      }
    ]
  }
];

export const dataVaultFiles: DataVaultFile[] = [
  {
    id: 'file-1',
    name: 'study-report-xyz-123.pdf',
    type: 'PDF',
    lastUpdated: 'Oct 25, 2025',
    tags: ['Clinical Study', 'PK Data'],
    folderPath: '/Clinical Study Reports',
    status: 'Final',
    versions: [
      { id: 'file-1-v2', label: 'v2.0 (current)', date: 'Oct 25, 2025' },
      { id: 'file-1-v1', label: 'v1.0', date: 'Oct 22, 2025' }
    ],
    linkedDocuments: ['doc-2-4-2', 'doc-2-4-3']
  },
  {
    id: 'file-2',
    name: 'pharmacodynamics-tables.xlsx',
    type: 'Spreadsheet',
    lastUpdated: 'Oct 20, 2025',
    tags: ['Non-Clinical', 'Tables'],
    folderPath: '/Non-Clinical Data',
    status: 'Draft',
    versions: [
      { id: 'file-2-v1', label: 'v1.0', date: 'Oct 20, 2025' }
    ],
    linkedDocuments: ['doc-2-4-2']
  }
];
